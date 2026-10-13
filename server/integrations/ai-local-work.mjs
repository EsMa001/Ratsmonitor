import {AdminError} from './admin-access.mjs';
import {selectedRegions} from './pipeline-jobs.mjs';
import {historyWindow,windowStart} from '../../shared/history-window.mjs';
import {LABELS} from '../../shared/labels.mjs';
import {hashText} from '../../shared/database-transfer.mjs';
import {insertUsage} from '../../shared/ai-usage.mjs';
import {versionPayload} from '../../shared/article-version.mjs';
import {AI_LOCAL_METHOD,AI_LOCAL_CONTRACT,AI_LOCAL_LIMITS,LocalResultError,localInputHash,prepareLocalResult,stableLocalJson} from '../../shared/ai-local-content.mjs';
import {invalidateReads} from '../services/read-cache.mjs';

const LEASE_MS = 30 * 60 * 1000;
const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 300 && !/[\u0000-\u001f]/u.test(id);
const states = new Set(['open','all','pending','processing','completed','failed','insufficient_source','legacy','waiting_text','stale']);
const reason = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1200;
const conflict = message => new AdminError(409,message);
// detail: a fixed validation text the internal MCP may return to the submitting agent.
const invalidResult = message => Object.assign(new AdminError(400,message),{detail:message});
const cursorFor = row => encodeURIComponent(JSON.stringify({date:row.event_date,id:row.id}));
function parseCursor(value) {
  if (!value) return null;
  try {
    if (typeof value !== 'string' || value.length > 1500) throw Error();
    const cursor = JSON.parse(decodeURIComponent(value));
    if (!validId(cursor.id) || typeof cursor.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(cursor.date)) throw Error();
    return cursor;
  } catch { throw new AdminError(400,'Ungueltiger Listencursor.'); }
}

/**
 * A short claim protects each report; database transactions protect only final writes.
 * @param {any} db
 * @param {{loadSources?:(topic:any)=>Promise<any>|any,now?:(()=>number|Date)|number|Date}} [options]
 */
export function createAiLocalWork(db,{loadSources,now=() => Date.now()}={}) {
  const timestamp = () => { const value = typeof now === 'function' ? now() : now; return value instanceof Date ? value.getTime() : Number(value); };
  const at = () => new Date(timestamp()).toISOString();
  async function supported() {
    if (!db || typeof loadSources !== 'function') throw new AdminError(503,'Lokale KI-Textquellen sind in dieser Umgebung nicht eingerichtet.');
    const table = await db.prepare("SELECT 1 present FROM sqlite_master WHERE type='table' AND name='ai_work_items'").first();
    if (!table) throw new AdminError(503,'Datenbankmigration 0028 fuer die lokale KI-Verarbeitung fehlt.');
  }
  async function topicRow(id) {
    if (!validId(id)) throw new AdminError(400,'Ungueltige Artikel-ID.');
    const row = await db.prepare('SELECT id,region_id,event_date,payload FROM topics WHERE id=? AND active=1').bind(id).first();
    if (!row) throw new AdminError(404,'Aktiver Artikel wurde nicht gefunden.');
    return row;
  }
  const workRow = id => db.prepare('SELECT * FROM ai_work_items WHERE topic_id=?').bind(id).first();
  const unpack = row => ({...JSON.parse(row.payload),id:row.id,regionId:row.region_id,eventDate:row.event_date});
  async function input(row) {
    const topic = unpack(row),loaded = await loadSources(topic);
    if (!loaded || !Array.isArray(loaded.sources) || !loaded.coverage || !Array.isArray(loaded.gaps)) throw new AdminError(503,'Lokale Quellen konnten nicht gelesen werden.');
    const ids = new Set();
    for (const source of loaded.sources) {
      if (!validId(source.id) || ids.has(source.id) || !Array.isArray(source.pages) || !source.pages.every(page => Number.isInteger(page.number) && page.number >= 1 && typeof page.text === 'string') ||
        new Set(source.pages.map(page => page.number)).size !== source.pages.length) throw new AdminError(503,'Lokale Quellenzuordnung ist ungueltig.');
      ids.add(source.id);
    }
    return {topic,loaded,inputHash:await localInputHash(topic,loaded)};
  }
  function visibleState(work,current,topic) {
    if (work?.state === 'processing' && work.lease_expires_at > timestamp()) return 'processing';
    if (work && work.input_hash !== current.inputHash) return work.state === 'completed' ? 'stale' : current.loaded.ready ? 'pending' : 'waiting_text';
    if (!current.loaded.ready) return 'waiting_text';
    if (work?.state === 'processing') return 'pending';
    if (work) return work.state;
    return topic.contentAnalysis || /^KI-Zusammenfassung/u.test(topic.generatedBy || '') ? 'legacy' : 'pending';
  }
  async function leased(id,token) {
    if (!validId(id) || !validId(token)) throw new AdminError(400,'Artikel-ID oder Reservierungstoken fehlt.');
    const work = await workRow(id);
    if (!work || work.state !== 'processing' || work.claim_token !== token || work.lease_expires_at <= timestamp()) throw conflict('Reservierung ist abgelaufen oder gehoert einem anderen Agenten.');
    return work;
  }
  async function currentClaim(id,token) {
    const work = await leased(id,token),row = await topicRow(id),current = await input(row);
    if (current.inputHash !== work.input_hash) {
      await db.prepare("UPDATE ai_work_items SET state='stale',claim_token=NULL,lease_expires_at=NULL,last_error=?,updated_at=? WHERE topic_id=? AND claim_token=? AND state='processing'")
        .bind('Die lokalen Textquellen oder Verfahrensdaten haben sich geaendert.',at(),id,token).run();
      throw conflict('Eingabetexte haben sich geaendert. Artikel erneut reservieren.');
    }
    return {work,row,...current};
  }
  const manifest = source => ({id:source.id,url:source.url,title:source.title,kind:source.kind,role:source.role,hash:source.hash,fetchedAt:source.fetchedAt ?? null,
    method:source.method,words:source.words,pageCount:source.pages.length,pageNumbers:source.pages.map(page => page.number),pages:source.pages.map(page => ({number:page.number,chars:page.text.length})),partial:source.partial === true,
    ...(source.aliases ? {aliases:source.aliases} : {}),...(source.rawHash ? {rawHash:source.rawHash} : {})});

  async function list({regions='all',window,limit=25,cursor,state='open'}={}) {
    await supported();
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !states.has(state)) throw new AdminError(400,'Listenfilter oder Paketgroesse ist ungueltig.');
    const all = regions === 'all',regionIds = all ? [] : selectedRegions(regions),position = parseCursor(cursor),where = ['active=1'],args = [];
    if (!all) { where.push('region_id IN (SELECT value FROM json_each(?))'); args.push(JSON.stringify(regionIds)); }
    if (window && window !== 'all') {
      let key;try { key = historyWindow(window); } catch { throw new AdminError(400,'Ungueltiger Zeitraum.'); }
      where.push('event_date>=?');args.push(windowStart(new Date(timestamp()),key).toISOString().slice(0,10));
    }
    if (position) { where.push('(event_date<? OR (event_date=? AND id>?))');args.push(position.date,position.date,position.id); }
    // The ordered inner query contains only indexed columns. At most limit payloads are read, even for sparse filters.
    const index = all ? 'idx_topics_ai_local_date' : 'idx_topics_ai_local_region_date';
    const rows = await db.prepare(`SELECT t.id,t.region_id,t.event_date,t.payload,w.state work_state,w.input_hash,w.agent,w.lease_expires_at,w.attempts,w.last_error
      FROM (SELECT id,event_date FROM topics INDEXED BY ${index} WHERE ${where.join(' AND ')} ORDER BY event_date DESC,id LIMIT ?) c
      CROSS JOIN topics t ON t.id=c.id LEFT JOIN ai_work_items w ON w.topic_id=t.id ORDER BY t.event_date DESC,t.id`).bind(...args,limit).all();
    const items = [];
    for (const row of rows.results) {
      const current = await input(row),work = row.work_state ? {state:row.work_state,input_hash:row.input_hash,lease_expires_at:row.lease_expires_at} : null;
      const visible = visibleState(work,current,current.topic);
      const matches = state === 'all' || state === visible || state === 'open' && (['pending','legacy','stale'].includes(visible) || visible === 'failed' && Number(row.attempts || 0) < 2);
      if (!matches) continue;
      items.push({id:row.id,title:current.topic.officialTitle || current.topic.title || row.id,regionId:row.region_id,eventDate:row.event_date,state:visible,
        ready:current.loaded.ready,coverage:current.loaded.coverage,inputHash:current.inputHash,legacy:visible === 'legacy',
        ...(row.agent ? {agent:row.agent} : {}),...(visible === 'processing' ? {expiresAt:new Date(row.lease_expires_at).toISOString()} : {}),
        attempts:Number(row.attempts || 0),...(row.last_error ? {lastError:row.last_error} : {})});
    }
    const hasMore = rows.results.length === limit;
    return {method:AI_LOCAL_METHOD,items,checked:rows.results.length,hasMore,nextCursor:hasMore ? cursorFor(rows.results.at(-1)) : null,asOf:at()};
  }

  async function claim({ids,agent}={}) {
    await supported();
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || new Set(ids).size !== ids.length || !ids.every(validId) || !reason(agent) || agent.length > 200)
      throw new AdminError(400,'Eindeutige Artikel-IDs und Agentenname sind erforderlich.');
    const claimed = [],conflicts = [];
    for (const id of ids) {
      try {
        const current = await input(await topicRow(id));
        if (!current.loaded.ready) { conflicts.push({id,reason:'Kein ausreichender lokal gespeicherter Sachtext vorhanden.'});continue; }
        const token = crypto.randomUUID(),stamp = timestamp(),expires = stamp + LEASE_MS;
        const saved = await db.prepare(`INSERT INTO ai_work_items(topic_id,input_hash,state,agent,claim_token,lease_expires_at,attempts,last_error,read_state,updated_at)
          VALUES(?,?,'processing',?,?,?,1,NULL,'{}',?) ON CONFLICT(topic_id) DO UPDATE SET input_hash=excluded.input_hash,state='processing',agent=excluded.agent,
          claim_token=excluded.claim_token,lease_expires_at=excluded.lease_expires_at,attempts=CASE WHEN ai_work_items.input_hash=excluded.input_hash THEN ai_work_items.attempts+1 ELSE 1 END,
          last_error=NULL,read_state='{}',updated_at=excluded.updated_at
          WHERE (ai_work_items.state<>'processing' OR ai_work_items.lease_expires_at<=?) AND (ai_work_items.state<>'completed' OR ai_work_items.input_hash<>excluded.input_hash)
          RETURNING topic_id`).bind(id,current.inputHash,agent.trim(),token,expires,new Date(stamp).toISOString(),stamp).first();
        if (!saved) { conflicts.push({id,reason:'Artikel ist bereits reserviert oder fuer diesen Eingabestand abgeschlossen.'});continue; }
        claimed.push({id,token,inputHash:current.inputHash,expiresAt:new Date(expires).toISOString(),coverage:current.loaded.coverage});
      } catch (error) { if (error instanceof AdminError && error.status === 404) conflicts.push({id,reason:error.message});else throw error; }
    }
    return {claimed,conflicts};
  }

  async function read({id,token,sourceId,page,offset=0}={}) {
    await supported();
    const current = await currentClaim(id,token),{topic,loaded,work,inputHash} = current;
    const base = {id,inputHash,agent:work.agent,expiresAt:new Date(work.lease_expires_at).toISOString(),contractVersion:AI_LOCAL_CONTRACT,method:AI_LOCAL_METHOD,limits:AI_LOCAL_LIMITS,
      article:{id,title:topic.officialTitle || topic.title,status:topic.status,regionId:topic.regionId,eventDate:topic.eventDate,reference:topic.reference || '',events:topic.events || []},
      sources:loaded.sources.map(manifest),coverage:loaded.coverage,gaps:loaded.gaps,labelCatalog:LABELS.map(({id,name}) => ({id,name})),
      requiredOutputs:['shortSummary','longSummary','aiLabel']};
    if (sourceId === undefined) return base;
    const source = loaded.sources.find(value => value.id === sourceId);
    if (!source) throw new AdminError(404,'Textquelle wurde nicht gefunden.');
    page ??= source.pages[0]?.number;
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(offset) || offset < 0) throw new AdminError(400,'Seite oder Textposition ist ungueltig.');
    const sourcePage = source.pages.find(value => value.number === page);
    if (!sourcePage || offset > sourcePage.text.length) throw new AdminError(404,'Textseite oder Textposition wurde nicht gefunden.');
    const readState = JSON.parse(work.read_state),prior = Number(readState[sourceId]?.[page] || 0);
    if (offset > prior) throw conflict('Textbloecke in Reihenfolge lesen, damit keine Quellenabschnitte ausgelassen werden.');
    const end = Math.min(sourcePage.text.length,offset + AI_LOCAL_LIMITS.readChars);
    readState[sourceId] = {...readState[sourceId],[page]:Math.max(prior,end)};
    const updated = await db.prepare('UPDATE ai_work_items SET read_state=?,updated_at=? WHERE topic_id=? AND claim_token=? AND state=\'processing\' AND lease_expires_at>? AND read_state=? RETURNING topic_id')
      .bind(JSON.stringify(readState),at(),id,token,timestamp(),work.read_state).first();
    if (!updated) throw conflict('Reservierung oder Lesezustand wurde inzwischen geaendert. Anfrage wiederholen.');
    return {...base,source:{...manifest(source),page,offset,text:sourcePage.text.slice(offset,end),nextOffset:end < sourcePage.text.length ? end : null},
      nextPage:source.pages.find(value => value.number > page)?.number ?? null};
  }

  async function renew({id,token}={}) {
    await supported();await currentClaim(id,token);
    const expires = timestamp() + LEASE_MS;
    const row = await db.prepare("UPDATE ai_work_items SET lease_expires_at=?,updated_at=? WHERE topic_id=? AND claim_token=? AND state='processing' AND lease_expires_at>? RETURNING topic_id")
      .bind(expires,at(),id,token,timestamp()).first();
    if (!row) throw conflict('Reservierung wurde inzwischen geaendert.');
    return {id,token,expiresAt:new Date(expires).toISOString()};
  }

  async function release({id,token}={}) {
    await supported();await leased(id,token);
    const row = await db.prepare("UPDATE ai_work_items SET state='pending',claim_token=NULL,lease_expires_at=NULL,read_state='{}',updated_at=? WHERE topic_id=? AND claim_token=? AND state='processing' AND lease_expires_at>? RETURNING topic_id")
      .bind(at(),id,token,timestamp()).first();
    if (!row) throw conflict('Reservierung wurde inzwischen geaendert.');
    return {id,state:'pending'};
  }

  async function submit({id,token,inputHash,result}={}) {
    await supported();
    if (!validId(id) || !validId(token) || typeof inputHash !== 'string' || !/^[a-f0-9]{64}$/u.test(inputHash)) throw new AdminError(400,'Artikel, Reservierung und Eingabehash sind erforderlich.');
    const resultHash = await hashText(stableLocalJson(result)),previous = await workRow(id);
    if (previous?.last_result_token === token) {
      if (previous.last_result_hash !== resultHash) throw conflict('Unter dieser Reservierung wurde bereits ein anderes Ergebnis gespeichert.');
      const receipt = JSON.parse(previous.last_receipt);
      if (receipt.inputHash !== inputHash) throw conflict('Ergebnis gehoert zu einem anderen Eingabestand.');
      return {...receipt,repeated:true};
    }
    const current = await currentClaim(id,token),{work,topic,loaded} = current;
    if (inputHash !== current.inputHash) throw conflict('Ergebnis gehoert zu einem anderen Eingabestand.');
    const reads = JSON.parse(work.read_state);
    if (loaded.sources.some(source => source.pages.some(page => page.text.length > 0 && Number(reads[source.id]?.[page.number] || 0) < page.text.length)))
      throw invalidResult('Vor dem Speichern muessen alle bereitgestellten lokalen Textseiten vollstaendig gelesen werden.');
    let prepared;try { prepared = await prepareLocalResult(topic,loaded,result,inputHash,at()); }
    catch (error) { throw error instanceof LocalResultError ? invalidResult(error.message) : new AdminError(400,error.message); }
    const confirmed = await currentClaim(id,token);
    if (confirmed.row.payload !== current.row.payload) prepared = await prepareLocalResult(confirmed.topic,confirmed.loaded,result,inputHash,prepared.topic.summaryGeneratedAt);
    const receipt = {id,state:'completed',method:AI_LOCAL_METHOD,inputHash,at:at(),coverage:loaded.coverage,analysisIds:prepared.analyses.map(analysis => analysis.payload.id)};
    const versionId = await hashText([AI_LOCAL_METHOD,id,token,'prior-version'].join('\n'));
    try {
      await db.batch([
        db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM topics WHERE id=? AND active=1 AND payload=?) THEN 1 ELSE json('conflict') END").bind(id,confirmed.row.payload),
        db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM ai_work_items WHERE topic_id=? AND state='processing' AND claim_token=? AND input_hash=? AND lease_expires_at>?) THEN 1 ELSE json('conflict') END").bind(id,token,inputHash,timestamp()),
        db.prepare('INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES(?,?,?,?)')
          .bind(versionId,id,receipt.at,versionPayload(JSON.parse(confirmed.row.payload),prepared.topic)),
        insertUsage(db,{...prepared.usage,topicId:id,regionId:topic.regionId,at:receipt.at}),
        ...prepared.analyses.map(analysis => db.prepare('INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,?,?,?,?)')
          .bind(analysis.payload.id,id,analysis.kind,AI_LOCAL_METHOD,inputHash,receipt.at,JSON.stringify(analysis.payload))),
        db.prepare('UPDATE topics SET payload=? WHERE id=?').bind(JSON.stringify(prepared.topic),id),
        db.prepare("UPDATE ai_work_items SET state='completed',claim_token=NULL,lease_expires_at=NULL,last_error=NULL,updated_at=?,last_result_token=?,last_result_hash=?,last_receipt=? WHERE topic_id=?")
          .bind(receipt.at,token,resultHash,JSON.stringify(receipt),id),
      ]);
    } catch (error) {
      if (/malformed JSON|conflict|UNIQUE constraint/iu.test(error.message || '')) throw conflict('Artikel oder Reservierung wurde beim Speichern geaendert. Ergebnis erneut senden.');
      throw error;
    }
    invalidateReads();
    return receipt;
  }

  async function fail({id,token,reason:message,kind='failed'}={}) {
    await supported();
    if (!reason(message) || !['failed','insufficient_source'].includes(kind)) throw new AdminError(400,'Fehlerart und konkrete Begruendung sind erforderlich.');
    const current = await currentClaim(id,token),stamp = at();
    const analysisId = await hashText([id,token,kind].join('\n'));
    const analysis = {id:analysisId,status:kind,method:AI_LOCAL_METHOD,agent:current.work.agent,model:'unknown',generatedAt:stamp,
      inputHash:current.inputHash,reason:message.trim(),coverage:current.loaded.coverage,reviewStatus:'not_independently_reviewed'};
    try {
      await db.batch([
        db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM ai_work_items WHERE topic_id=? AND state='processing' AND claim_token=? AND lease_expires_at>?) THEN 1 ELSE json('conflict') END").bind(id,token,timestamp()),
        db.prepare('INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,?,?,?,?)').bind(analysisId,id,'ai-local-attempt',AI_LOCAL_METHOD,current.inputHash,stamp,JSON.stringify(analysis)),
        db.prepare("UPDATE ai_work_items SET state=?,claim_token=NULL,lease_expires_at=NULL,last_error=?,updated_at=? WHERE topic_id=?")
          .bind(kind,message.trim(),stamp,id),
      ]);
    } catch (error) {
      if (/malformed JSON|conflict|UNIQUE constraint/iu.test(error.message || '')) throw conflict('Reservierung wurde beim Speichern geaendert.');
      throw error;
    }
    return {id,state:kind,reason:message.trim(),attempts:current.work.attempts};
  }

  return {list,claim,read,renew,release,submit,fail};
}
