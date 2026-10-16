import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import {CATALOG} from '../../shared/catalog.mjs';
import {LABELS} from '../../shared/labels.mjs';

const REGIONS = new Map(CATALOG.map(region => [region.id,region]));
const LABEL_IDS = new Set(LABELS.map(label => label.id));
const STATUSES = new Set(['announced','consulting','recommended','approved','rejected','postponed','info','unknown']);
const FILTER_KEYS = ['query','regionIds','from','to','label','status','limit'];
const DAY = 86400000;
const COVERAGE_NOTE = 'Counts describe stored active canonical reports, not all political activity or individual meetings. The date filter uses the same search-card date as the public search; missing imports and undated reports are not counted.';
export class CustomerDataError extends Error {
  constructor(message,code='INVALID_INPUT') { super(message);this.name='CustomerDataError';this.code=code; }
}
const fail = message => { throw new CustomerDataError(message); };
function object(value,keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail('Unsupported request fields.');
}
function identifier(value) { return typeof value === 'string' && value.length > 0 && value.length <= 300 && !/[\u0000-\u001f]/u.test(value); }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) fail('Use a valid YYYY-MM-DD date.');
  const parsed = new Date(value+'T00:00:00Z');
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0,10) !== value) fail('Use a valid YYYY-MM-DD date.');
  return value;
}
const text = (value,max=1200) => typeof value === 'string' ? value.slice(0,max) : '';
const strings = (value,count=24,max=8000) => Array.isArray(value) ? value.slice(0,count).filter(entry => typeof entry === 'string').map(entry => text(entry,max)) : [];
const timestamp = value => typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}(?:T|$)/u.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
const number = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const region = id => { const item=REGIONS.get(id);return {id,name:item.name,ags:item.ags,kind:item.kind}; };
const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/gu,'').replaceAll('\u00df','ss');

function publicUrl(value) {
  if (typeof value !== 'string' || value.length > 3000) return null;
  try {
    const url = new URL(value),host=url.hostname.toLowerCase().replace(/\.$/u,'');
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password || isIP(host) || host.includes(':') ||
      !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|lan)$/u.test(host)) return null;
    if ([...url.searchParams.keys()].some(key => /^(?:token|access_token|api[_-]?key|password|secret|authorization|signature|sig)$/iu.test(key))) return null;
    url.hash='';
    return url.href;
  } catch { return null; }
}
function sources(value) {
  return (Array.isArray(value) ? value : []).slice(0,100).flatMap(entry => {
    const url=publicUrl(entry?.url);
    return url ? [{url,title:text(entry.title,1000),kind:text(entry.kind,100)}] : [];
  });
}
function evidence(value) {
  return (Array.isArray(value) ? value : []).slice(0,40).filter(entry => typeof entry?.quote === 'string').map(entry => ({
    quote:text(entry.quote,1600),url:publicUrl(entry.url),page:number(entry.page),
    ...(Number.isInteger(entry.paragraphIndex) && entry.paragraphIndex >= 0 && entry.paragraphIndex < 24 ? {paragraphIndex:entry.paragraphIndex} : {}),
  }));
}
function summaryCoverage(value) {
  if (!value || typeof value !== 'object') return null;
  return {total:number(value.total),available:number(value.available),missing:number(value.missing),partial:number(value.partial),complete:value.complete === true};
}

// Only public report fields leave SQLite. Source text, job state, tokens and arbitrary metadata are never selected.
const DETAIL_SELECT = `json_object(
 'officialTitle',json_extract(t.payload,'$.officialTitle'),'reference',json_extract(t.payload,'$.reference'),
 'shortSummary',json_extract(t.payload,'$.shortSummary'),'longSummary',json_extract(t.payload,'$.longSummary'),
 'isAi',CASE WHEN json_extract(t.payload,'$.generatedBy') LIKE 'KI-Zusammenfassung%' OR json_extract(t.payload,'$.contentAnalysis.status') IN ('completed','stale') THEN 1 ELSE 0 END,
 'aiStatus',json_extract(t.payload,'$.contentAnalysis.status'),'aiGeneratedAt',coalesce(json_extract(t.payload,'$.contentAnalysis.generatedAt'),json_extract(t.payload,'$.summaryGeneratedAt')),
 'aiReview',json_extract(t.payload,'$.contentAnalysis.reviewStatus'),'aiCoverage',json_extract(t.payload,'$.contentAnalysis.coverage'),
 'aiEvidence',json_extract(t.payload,'$.contentAnalysis.evidence'),'ruleShort',json_extract(t.payload,'$.ruleSummary.short.sentences'),
 'ruleLong',json_extract(t.payload,'$.ruleSummary.long.sentences'),'ruleGeneratedAt',json_extract(t.payload,'$.ruleSummary.generatedAt'),
 'sourceUrl',json_extract(t.payload,'$.sourceUrl'),'documents',json_extract(t.payload,'$.documents'),
 'events',json_extract(t.payload,'$.events')) AS detail`;
const CARD_COLUMNS = 'sc.id,sc.region_id,sc.date,sc.status,sc.label,sc.title,sc.teaser,sc.gremium';
const CARD_SELECT = `${CARD_COLUMNS},
 CASE WHEN json_extract(t.payload,'$.generatedBy') LIKE 'KI-Zusammenfassung%' OR json_extract(t.payload,'$.contentAnalysis.status')='completed' THEN 'ai'
 WHEN json_type(t.payload,'$.ruleSummary.short.sentences')='array' THEN 'rule' ELSE 'source_overview' END AS summary_kind`;
const JOIN = 'FROM search_cards sc JOIN topics t ON t.id=sc.id AND t.region_id=sc.region_id';
// active is virtual JSON: the partial index excludes merged reports without parsing every candidate payload.
const CANONICAL = `NOT EXISTS (SELECT 1 FROM topics inactive INDEXED BY idx_topics_inactive WHERE inactive.id=sc.id AND inactive.active=0)
 AND EXISTS (SELECT 1 FROM topics canonical WHERE canonical.id=sc.id AND canonical.region_id=sc.region_id)`;
function card(row) {
  return {id:row.id,region:region(row.region_id),date:row.date,status:STATUSES.has(row.status)?row.status:'unknown',
    label:LABEL_IDS.has(row.label)?row.label:'unklar',title:text(row.title,1000),shortSummary:text(row.teaser,1200),shortSummaryKind:row.summary_kind,committee:text(row.gremium,1000)};
}

/** The caller must open db read-only. Permissions come from trusted startup configuration, never tool arguments. */
export function createCustomerData(db,{customerId,allowedRegionIds,allowSourceText=false}={}) {
  if (!identifier(customerId) || !Array.isArray(allowedRegionIds) || !allowedRegionIds.length || allowedRegionIds.length > 10000 ||
    allowedRegionIds.some(id => !REGIONS.has(id))) fail('A customer and a nonempty allowlist of known region IDs are required.');
  if (allowSourceText !== false) fail('Raw source text is not available in the customer interface.');
  const allowed = Object.freeze([...new Set(allowedRegionIds)].sort()),allowedSet=new Set(allowed),secret=randomBytes(32);
  const sign = value => createHmac('sha256',secret).update(value).digest();
  const scopeHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

  function filters(input,extra=[]) {
    object(input,[...FILTER_KEYS,...extra]);
    if (input.query !== undefined && (typeof input.query !== 'string' || input.query.length > 200)) fail('Query must contain at most 200 characters.');
    const query=(input.query || '').trim(),terms=normalize(query).split(/\s+/u).filter(Boolean);
    if (terms.length > 12) fail('Use at most 12 search terms.');
    if (input.regionIds !== undefined && (!Array.isArray(input.regionIds) || input.regionIds.length > 100 || input.regionIds.some(id => !identifier(id)))) fail('Invalid requested regions.');
    const ids=input.regionIds === undefined ? [...allowed] : [...new Set(input.regionIds.filter(id => allowedSet.has(id)))].sort();
    const today=new Date().toISOString().slice(0,10),to=date(input.to ?? today);
    // A date-only upper bound can also select a historical twelve-month window.
    const defaultFrom=new Date(Date.parse(to+'T00:00:00Z'));defaultFrom.setUTCFullYear(defaultFrom.getUTCFullYear()-1);defaultFrom.setUTCDate(defaultFrom.getUTCDate()+1);
    const from=date(input.from ?? defaultFrom.toISOString().slice(0,10));
    if (from > to || (Date.parse(to)-Date.parse(from))/DAY >= 366) fail('Choose an ordered date range of at most 366 days.');
    if (input.label !== undefined && !LABEL_IDS.has(input.label)) fail('Unknown label.');
    if (input.status !== undefined && !STATUSES.has(input.status)) fail('Unknown status.');
    const limit=input.limit ?? (extra.includes('groupBy') ? 50 : 20);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail('Limit must be between 1 and 100.');
    const where=[CANONICAL,'sc.region_id IN (SELECT value FROM json_each(?))','sc.date>=?','sc.date<=?'],args=[JSON.stringify(ids),from,to];
    for (const term of terms) { where.push('instr(sc.search,?)>0');args.push(term); }
    if (input.label !== undefined) { where.push('sc.label=?');args.push(input.label); }
    if (input.status !== undefined) { where.push('sc.status=?');args.push(input.status); }
    const scope={regionIds:ids,from,to,query,label:input.label ?? null,status:input.status ?? null,dateField:'searchDate',
      searchSemantics:'All whitespace-separated terms must occur as substrings in the indexed title, short summary or committee. Full original texts and long summaries are not searched.'};
    return {where:where.join(' AND '),args,limit,scope,fingerprint:scopeHash([customerId,allowed,scope])};
  }
  function cursor(value,fingerprint) {
    if (typeof value !== 'string' || value.length > 1500 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value)) fail('Invalid or expired cursor.');
    const [body,signature]=value.split('.'),actual=Buffer.from(signature,'base64url'),expected=sign(body);
    if (actual.length !== expected.length || !timingSafeEqual(actual,expected)) fail('Invalid or expired cursor.');
    let decoded;
    try { decoded=JSON.parse(Buffer.from(body,'base64url').toString('utf8')); } catch { fail('Invalid or expired cursor.'); }
    if (!decoded || decoded.fingerprint !== fingerprint || !identifier(decoded.id)) fail('Cursor does not belong to this query.');
    date(decoded.date);
    return decoded;
  }
  const encodeCursor = (row,fingerprint) => {
    const body=Buffer.from(JSON.stringify({id:row.id,date:row.date,fingerprint})).toString('base64url');
    return body+'.'+sign(body).toString('base64url');
  };

  return {
    async listRegions(input={}) {
      object(input,[]);
      return {regions:allowed.map(region)};
    },
    async searchReports(input={}) {
      const f=filters(input,['cursor']),args=[...f.args];let where=f.where;
      if (input.cursor !== undefined) {
        const edge=cursor(input.cursor,f.fingerprint);
        where+=' AND (sc.date<? OR (sc.date=? AND sc.id>?))';args.push(edge.date,edge.date,edge.id);
      }
      /* LIMIT als Kommazahl wie in der Suche (monitor-search.mjs): als Ganzzahl liest SQLite alle Karten statt über den Datumsindex
         nach einer Seite aufzuhören (Server 16.10.2026: 800 statt 1 ms). Gleiches Ergebnis. */
      const {results}=await db.prepare(`WITH page AS MATERIALIZED (
        SELECT ${CARD_COLUMNS} FROM search_cards sc WHERE ${where} ORDER BY sc.date DESC,sc.id ASC LIMIT CAST(? AS REAL)
      ) SELECT ${CARD_SELECT} FROM page sc JOIN topics t ON t.id=sc.id AND t.region_id=sc.region_id ORDER BY sc.date DESC,sc.id ASC`).bind(...args,f.limit+1).all();
      const rows=results.slice(0,f.limit);
      return {reports:rows.map(card),nextCursor:results.length > f.limit ? encodeCursor(rows.at(-1),f.fingerprint) : null,scope:f.scope};
    },
    async getReport(input) {
      object(input,['id']);if (!identifier(input.id)) fail('Invalid report ID.');
      const row=await db.prepare(`SELECT ${CARD_SELECT},t.updated_at,${DETAIL_SELECT} ${JOIN} WHERE sc.id=? AND t.active=1 AND sc.region_id IN (SELECT value FROM json_each(?)) LIMIT 1`).bind(input.id,JSON.stringify(allowed)).first();
      if (!row) throw new CustomerDataError('Report not found.','NOT_FOUND');
      const detail=JSON.parse(row.detail),long=strings(detail.longSummary),ruleShort=strings(detail.ruleShort,24,1200),ruleLong=strings(detail.ruleLong,100,2000);
      const summaries={ai:detail.isAi ? {short:text(detail.shortSummary,1200),paragraphs:long,
        status:['completed','stale'].includes(detail.aiStatus)?detail.aiStatus:'legacy',generatedAt:timestamp(detail.aiGeneratedAt),
        reviewStatus:detail.aiReview === 'reviewed' ? 'reviewed' : 'not_independently_reviewed',coverage:summaryCoverage(detail.aiCoverage),evidence:evidence(detail.aiEvidence),
        truncated:Array.isArray(detail.longSummary) && (detail.longSummary.length > 24 || detail.longSummary.some(p => typeof p === 'string' && p.length > 8000))} : null,
        rule:ruleShort.length || ruleLong.length ? {short:ruleShort,paragraphs:ruleLong,generatedAt:timestamp(detail.ruleGeneratedAt),
          truncated:Array.isArray(detail.ruleShort) && (detail.ruleShort.length > 24 || detail.ruleShort.some(sentence => typeof sentence === 'string' && sentence.length > 1200)) ||
            Array.isArray(detail.ruleLong) && (detail.ruleLong.length > 100 || detail.ruleLong.some(sentence => typeof sentence === 'string' && sentence.length > 2000))} : null};
      const events=(Array.isArray(detail.events)?detail.events:[]).slice(0,100).map(event => ({date:timestamp(event?.date),committee:text(event?.committee,1000),
        status:STATUSES.has(event?.status)?event.status:'unknown',description:text(event?.description,3000),result:text(event?.result,3000),url:publicUrl(event?.url)}));
      return {...card(row),officialTitle:text(detail.officialTitle,2000),reference:text(detail.reference,300),updatedAt:timestamp(row.updated_at),summaries,
        sourceUrl:publicUrl(detail.sourceUrl),documents:sources(detail.documents),events,documentsTruncated:Array.isArray(detail.documents) && detail.documents.length > 100,
        eventsTruncated:Array.isArray(detail.events) && detail.events.length > 100,rawSourceTextAvailable:false};
    },
    async aggregateReports(input) {
      const f=filters(input,['groupBy']);
      const groups={region:'sc.region_id',month:'substr(sc.date,1,7)',label:'sc.label',status:'sc.status'};
      if (!Object.hasOwn(groups,input.groupBy)) fail('Choose region, month, label or status as groupBy.');
      const {results}=await db.prepare(`SELECT ${groups[input.groupBy]} AS value,count(*) AS count,sum(count(*)) OVER () AS total,count(*) OVER () AS group_count FROM search_cards sc WHERE ${f.where} GROUP BY ${groups[input.groupBy]} ORDER BY count DESC,value ASC LIMIT ?`).bind(...f.args,f.limit).all();
      return {groups:results.map(row => ({value:row.value,count:row.count,...(input.groupBy === 'region'?{region:region(row.value)}:{})})),
        totalMatched:results[0]?.total ?? 0,hasMoreGroups:(results[0]?.group_count ?? 0) > results.length,scope:f.scope,coverageNote:COVERAGE_NOTE};
    },
  };
}
