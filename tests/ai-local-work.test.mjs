import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {createAiLocalWork} from '../server/integrations/ai-local-work.mjs';
import {AI_LOCAL_METHOD,AI_LOCAL_LIMITS} from '../shared/ai-local-content.mjs';
import {hashText} from '../shared/database-transfer.mjs';
import {restoreVersions,VERSION_FORMAT} from '../shared/article-version.mjs';

const text = 'Die Verwaltung plant einen neuen Radweg. Die Kosten betragen 120000 Euro.';
const checks = ['source_read','process','numbers','neutrality'].map(name => ({name,passed:true}));
async function fixture({extra=0,gaps=[],ready=true,pages=[{number:1,text}],legacy=false}={}) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE topics(id TEXT PRIMARY KEY,region_id TEXT,event_date TEXT,active INTEGER DEFAULT 1,payload TEXT);
    CREATE TABLE system_state(key TEXT PRIMARY KEY,value TEXT);
    CREATE TABLE article_versions(id TEXT PRIMARY KEY,topic_id TEXT,captured_at TEXT,payload TEXT);`);
  for (const file of ['0003_typical_mauler.sql','0007_ai_usage.sql','0028_ai_local_work.sql'])
    sql.exec(fs.readFileSync(new URL('../drizzle/' + file,import.meta.url),'utf8'));
  const topic = {id:'article-1',regionId:'billerbeck',officialTitle:'Ein neuer Radweg',title:'Ein neuer Radweg',status:'consulting',eventDate:'2026-10-01',reference:'VO/1',events:[],
    ruleSummary:{version:3,long:{sentences:['Unveraenderter Regeltext.']}},labelAssessments:{rule:{primary:'bauen'},review:{primary:'mobilitaet',reviewer:'Max'}},sourceText:text,
    ...(legacy ? {shortSummary:'Alte KI-Fassung.',longSummary:['Bisherige Analyse.'],generatedBy:'KI-Zusammenfassung',contentAnalysis:{method:'ai-agent-content-v1',status:'completed'}} : {})};
  const insert = sql.prepare('INSERT INTO topics(id,region_id,event_date,payload) VALUES(?,?,?,?)');
  insert.run(topic.id,topic.regionId,topic.eventDate,JSON.stringify(topic));
  for (let i=0;i<extra;i++) insert.run('other-' + i,'muenster','2026-09-' + String(28-i%25).padStart(2,'0'),JSON.stringify({...topic,id:'other-' + i,regionId:'muenster'}));
  const loaded = {sources:[{id:'source-1',url:'https://example.test/vorlage.pdf',title:'Vorlage',kind:'attachment',role:'paper',hash:await hashText(pages.map(page => page.text).join('\f')),
    fetchedAt:null,method:'text',pages,words:15}],gaps,coverage:{total:1+gaps.length,available:1,missing:gaps.length,partial:false,complete:gaps.length===0},ready};
  let clock = Date.parse('2026-10-13T08:00:00Z'),reads = 0;
  const db = sqliteAdapter(sql),work = createAiLocalWork(db,{loadSources:async () => { reads++;return loaded; },now:() => clock});
  const result = {agent:'Codex',model:'unknown',shortSummary:'Die Verwaltung plant einen neuen Radweg fuer 120000 Euro.',
    longSummary:['Die Verwaltung plant einen neuen Radweg. Als Kosten nennt die Vorlage 120000 Euro.'],
    coveredSourceIds:['source-1'],evidence:[{sourceId:'source-1',page:pages[0].number,quote:pages[0].text.startsWith('Die Verwaltung') ? 'Die Verwaltung plant einen neuen Radweg.' : pages[0].text.slice(0,20)}],
    aiLabel:{primary:'mobilitaet',secondary:[],reason:'Gegenstand ist ein Radweg.'},checks,usage:{basis:'measured',inputTokens:100,outputTokens:50}};
  async function reserve(agent='Codex') { return (await work.claim({ids:[topic.id],agent})).claimed[0]; }
  async function readAll(claim) {
    const head = await work.read(claim);
    for (const source of head.sources) for (const page of source.pages) {
      let offset=0;
      do { const answer = await work.read({...claim,sourceId:source.id,page:page.number,offset});offset=answer.source.nextOffset; } while (offset !== null);
    }
  }
  const saved = () => JSON.parse(sql.prepare('SELECT payload FROM topics WHERE id=?').get(topic.id).payload);
  return {sql,db,work,topic,loaded,result,reserve,readAll,saved,advance:ms => { clock+=ms; },reads:() => reads};
}
const rejects = (promise,status) => assert.rejects(promise,error => error.status === status);

test('all three outputs save atomically, retain rule/manual data and existing prepared job, and repeat idempotently',async t => {
  const f=await fixture({legacy:true});t.after(() => f.sql.close());
  f.sql.prepare('INSERT INTO system_state VALUES(?,?)').run('admin-ai-job',JSON.stringify({id:'existing',status:'prepared'}));
  const claim=await f.reserve();await f.readAll(claim);
  const receipt=await f.work.submit({...claim,result:f.result});
  assert.equal(receipt.state,'completed');assert.equal(f.saved().summaryMethod,AI_LOCAL_METHOD);
  assert.equal(f.saved().shortSummary,f.result.shortSummary);assert.deepEqual(f.saved().ruleSummary,f.topic.ruleSummary);
  assert.deepEqual(f.saved().labelAssessments.rule,f.topic.labelAssessments.rule);
  assert.deepEqual(f.saved().labelAssessments.review,f.topic.labelAssessments.review);
  assert.equal(f.saved().labelAssessments.ai.primary,'mobilitaet');
  assert.equal(f.sql.prepare('SELECT count(*) n FROM article_analyses').get().n,3);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM ai_usage').get().n,1);
  const versions=f.sql.prepare('SELECT payload FROM article_versions WHERE topic_id=? ORDER BY captured_at DESC').all(f.topic.id).map(row => JSON.parse(row.payload));
  assert.equal(versions.length,1);assert.equal(versions[0].format,VERSION_FORMAT);
  const prior=restoreVersions(f.saved(),versions)[0];
  assert.equal(prior.shortSummary,f.topic.shortSummary);assert.deepEqual(prior.longSummary,f.topic.longSummary);
  assert.deepEqual(prior.contentAnalysis,f.topic.contentAnalysis);
  assert.equal(JSON.parse(f.sql.prepare('SELECT value FROM system_state').get().value).id,'existing');
  f.advance(60*60*1000);
  const repeated=await f.work.submit({...claim,result:{...f.result}});assert.equal(repeated.repeated,true);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM article_analyses').get().n,3);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM article_versions').get().n,1);
  await rejects(f.work.submit({...claim,result:{...f.result,shortSummary:'Eine andere Kurzfassung.'}}),409);
});

test('concurrent agents reserve each report only once',async t => {
  const f=await fixture();t.after(() => f.sql.close());
  const result=await Promise.all([f.work.claim({ids:[f.topic.id],agent:'Codex'}),f.work.claim({ids:[f.topic.id],agent:'Claude Code'})]);
  assert.equal(result.reduce((n,r) => n+r.claimed.length,0),1);assert.equal(result.reduce((n,r) => n+r.conflicts.length,0),1);
  const claim=result.flatMap(r => r.claimed)[0];
  await rejects(f.work.read({...claim,token:'another-token'}),409);
});

test('renew, release and expired reservations allow resume without stale agent writes',async t => {
  const f=await fixture();t.after(() => f.sql.close());
  const first=await f.reserve();f.advance(20*60*1000);
  const renewal=await f.work.renew(first);assert.ok(renewal.expiresAt>first.expiresAt);
  await f.work.release(first);const second=await f.reserve('Claude Code');assert.notEqual(first.token,second.token);
  await rejects(f.work.read(first),409);f.advance(31*60*1000);
  await rejects(f.work.read(second),409);assert.ok(await f.reserve());
});

test('text changes with identical URL and caller hash invalidate inputs and reopen completed records',async t => {
  const f=await fixture();t.after(() => f.sql.close());
  const claim=await f.reserve();await f.readAll(claim);await f.work.submit({...claim,result:f.result});
  f.loaded.sources[0].pages[0].text+=' Die Strecke wird verlaengert.';
  const page=await f.work.list({regions:['billerbeck']});assert.equal(page.items[0].state,'stale');assert.notEqual(page.items[0].inputHash,claim.inputHash);
  const next=await f.reserve();assert.notEqual(next.inputHash,claim.inputHash);
  f.loaded.sources[0].pages[0].text+=' Ein weiterer Absatz.';
  await rejects(f.work.read(next),409);
});

test('unrelated payload changes preserve source fingerprint and are merged on submit',async t => {
  const f=await fixture();t.after(() => f.sql.close());const claim=await f.reserve();await f.readAll(claim);
  const topic=f.saved();topic.ruleSummary.long.sentences.push('Neuer Regeltext.');topic.metadata={lastFetchedAt:'2026-10-13T09:00:00Z'};
  f.sql.prepare('UPDATE topics SET payload=? WHERE id=?').run(JSON.stringify(topic),topic.id);
  await f.work.submit({...claim,result:f.result});assert.deepEqual(f.saved().ruleSummary,topic.ruleSummary);
});

test('all locally stored pages must be read; long pages are bounded and cannot be skipped',async t => {
  const f=await fixture({pages:[{number:7,text:text+' '+ 'a'.repeat(AI_LOCAL_LIMITS.readChars)},{number:9,text:'Weiterer Anhang.'}]});t.after(() => f.sql.close());
  const claim=await f.reserve(),head=await f.work.read(claim);assert.equal(head.source,undefined);assert.deepEqual(head.sources[0].pageNumbers,[7,9]);
  const first=await f.work.read({...claim,sourceId:'source-1'});assert.equal(first.source.page,7);assert.equal(first.source.text.length,AI_LOCAL_LIMITS.readChars);assert.equal(first.nextPage,9);
  await rejects(f.work.read({...claim,sourceId:'source-1',page:7,offset:AI_LOCAL_LIMITS.readChars+1}),409);
  await rejects(f.work.submit({...claim,result:f.result}),400);await f.readAll(claim);
  await f.work.submit({...claim,result:f.result});
});

test('invalid outputs and forged quotes never partially change content or history',async t => {
  const f=await fixture();t.after(() => f.sql.close());const claim=await f.reserve();await f.readAll(claim);
  for (const patch of [
    {shortSummary:'Ein Satz. Noch ein Satz.'},
    {longSummary:[]},
    {aiLabel:{primary:'invented',secondary:[],reason:'Test'}},
    {evidence:[{sourceId:'unknown',page:1,quote:'Die Verwaltung'}]},
    {evidence:[{sourceId:'source-1',page:1,quote:'Der Rat hat beschlossen.'}]},
    {coveredSourceIds:[]},
    {checks:[]},
    {evidence:[{sourceId:'source-1',page:1,quote:'120000 Euro.',paragraphIndex:0}],longSummary:['Nur ein allgemeiner Satz.']},
  ]) await rejects(f.work.submit({...claim,result:{...f.result,...patch}}),400);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM article_analyses').get().n,0);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM article_versions').get().n,0);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM ai_usage').get().n,0);assert.deepEqual(f.saved(),f.topic);
});

test('database failure rolls back all three analyses, usage and displayed texts',async t => {
  const f=await fixture();t.after(() => f.sql.close());const claim=await f.reserve();await f.readAll(claim);
  f.sql.exec("CREATE TRIGGER reject_label BEFORE INSERT ON article_analyses WHEN NEW.kind='ai-label' BEGIN SELECT RAISE(ABORT,'simulated write failure'); END;");
  await assert.rejects(f.work.submit({...claim,result:f.result}),/simulated write failure/);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM article_analyses').get().n,0);assert.equal(f.sql.prepare('SELECT count(*) n FROM ai_usage').get().n,0);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM article_versions').get().n,0);
  assert.deepEqual(f.saved(),f.topic);assert.equal(f.sql.prepare('SELECT state FROM ai_work_items').get().state,'processing');
});

test('failure stores attempt history, keeps old AI, permits retry and distinguishes source gaps',async t => {
  const f=await fixture({legacy:true,gaps:[{url:'https://example.test/anlage.pdf',title:'Anlage',reason:'Text fehlt.'}]});t.after(() => f.sql.close());
  const claim=await f.reserve();assert.equal(claim.coverage.complete,false);
  await f.work.fail({...claim,kind:'failed',reason:'Agent wurde unterbrochen.'});assert.equal(f.saved().shortSummary,f.topic.shortSummary);
  const list=await f.work.list();assert.equal(list.items[0].state,'failed');
  const retry=await f.reserve();await f.readAll(retry);await f.work.submit({...retry,result:f.result});
  assert.equal(f.saved().contentAnalysis.coverage.missing,1);assert.equal(f.saved().contentAnalysis.gaps[0].title,'Anlage');
  assert.equal(f.sql.prepare('SELECT count(*) n FROM article_analyses').get().n,4);
});

test('insufficient source remains outside open list until input changes or explicit retry',async t => {
  const f=await fixture();t.after(() => f.sql.close());const claim=await f.reserve();
  await f.work.fail({...claim,kind:'insufficient_source',reason:'Der Text enthaelt nur einen Verweis.'});
  assert.equal((await f.work.list()).items.length,0);assert.equal((await f.work.list({state:'insufficient_source'})).items.length,1);
  f.loaded.sources[0].pages[0].text+=' Jetzt ist Sachtext ergaenzt.';assert.equal((await f.work.list()).items[0].state,'pending');
  assert.ok(await f.reserve());
});

test('bounded read-only keyset pages expose sparse results without scanning every payload',async t => {
  const f=await fixture({extra:30});t.after(() => f.sql.close());
  const queries=[],base=f.db;
  const guarded={prepare(query){queries.push(query);assert.doesNotMatch(query,/^\s*(INSERT|UPDATE|DELETE|REPLACE)/iu);return base.prepare(query);},batch:statements => base.batch(statements)};
  const work=createAiLocalWork(guarded,{loadSources:async () => f.loaded});
  const first=await work.list({limit:2,state:'completed'});assert.equal(first.items.length,0);assert.equal(first.checked,2);assert.ok(first.nextCursor);
  const second=await work.list({limit:2,state:'all',cursor:first.nextCursor});assert.equal(second.checked,2);assert.equal(second.items.length,2);
  assert.ok(queries.some(query => /INDEXED BY idx_topics_ai_local_date/u.test(query) && /LIMIT \?/u.test(query)));
  assert.equal((await f.work.list({regions:['billerbeck']})).items.length,1);
  await rejects(work.list({cursor:'invalid'}),400);await rejects(work.list({limit:101}),400);
});

test('unknown and inactive IDs cannot be claimed or used as text paths',async t => {
  const f=await fixture();t.after(() => f.sql.close());
  assert.equal((await f.work.claim({ids:['unknown'],agent:'Codex'})).conflicts.length,1);
  const claim=await f.reserve();await rejects(f.work.read({...claim,sourceId:'../../secrets'}),404);
  f.sql.prepare('UPDATE topics SET active=0 WHERE id=?').run(f.topic.id);await rejects(f.work.read(claim),404);
});

test('missing migration or local source configuration returns a useful 503',async t => {
  const f=await fixture();t.after(() => f.sql.close());
  await rejects(createAiLocalWork(f.db).list(),503);f.sql.exec('DROP TABLE ai_work_items');await rejects(f.work.list(),503);
});

test('source content is checked again immediately before the final transaction',async t => {
  const f=await fixture();t.after(() => f.sql.close());const claim=await f.reserve();await f.readAll(claim);
  let calls=0;
  const work=createAiLocalWork(f.db,{loadSources:async () => {
    if (++calls===2) f.loaded.sources[0].pages[0].text+=' Der Text wurde gerade aktualisiert.';
    return f.loaded;
  }});
  await rejects(work.submit({...claim,result:f.result}),409);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM article_analyses').get().n,0);
  assert.deepEqual(f.saved(),f.topic);
});

test('failure transaction does not end another agent claim when ownership changes during the request',async t => {
  const f=await fixture();t.after(() => f.sql.close());const claim=await f.reserve();
  const db={prepare:query => f.db.prepare(query),async batch(statements) {
    f.sql.prepare("UPDATE ai_work_items SET claim_token='new-agent-token',agent='Claude Code' WHERE topic_id=?").run(claim.id);
    return f.db.batch(statements);
  }};
  const work=createAiLocalWork(db,{loadSources:async () => f.loaded});
  await rejects(work.fail({...claim,reason:'Alter Agent wurde unterbrochen.'}),409);
  const saved=f.sql.prepare('SELECT state,claim_token FROM ai_work_items').get();
  assert.equal(saved.state,'processing');assert.equal(saved.claim_token,'new-agent-token');
  assert.equal(f.sql.prepare('SELECT count(*) n FROM article_analyses').get().n,0);
});

test('changed deduplicated source aliases and document memberships reopen processing',async t => {
  const f=await fixture();t.after(() => f.sql.close());
  f.loaded.sources[0].aliases=[{url:'https://example.test/one.pdf',title:'Vorlage'},{url:'https://example.test/two.pdf',title:'Identischer Anhang'}];
  const first=await f.reserve();await f.readAll(first);await f.work.submit({...first,result:f.result});
  f.loaded.sources[0].aliases[1]={url:'https://example.test/new.pdf',title:'Neue Bezeichnung'};
  assert.equal((await f.work.list()).items[0].state,'stale');
  const second=await f.reserve();assert.notEqual(second.inputHash,first.inputHash);await f.readAll(second);await f.work.submit({...second,result:f.result});
  const topic=f.saved();topic.documents=[{url:'https://example.test/related.pdf',title:'Weiterer zugeordneter Text',kind:'application/pdf'}];
  f.sql.prepare('UPDATE topics SET payload=? WHERE id=?').run(JSON.stringify(topic),topic.id);
  assert.equal((await f.work.list()).items[0].state,'stale');assert.ok(await f.reserve());
});
