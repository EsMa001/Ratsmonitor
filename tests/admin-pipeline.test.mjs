import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {pipelineAction,selectedRegions,canImport,provider,PARALLEL,PER_PROVIDER} from '../server/integrations/pipeline-jobs.mjs';
import {mergeJob} from '../shared/pipeline-job.mjs';
import {createAiJob,applyAiResults,cancelAiJob,getAiJob} from '../server/integrations/ai-jobs.mjs';
import {processingStatus} from '../server/integrations/processing-status.mjs';
import {keywordWeights,articleResult,AI_METHOD,LEGACY_AI_METHOD,sourceRole,needsQuickCheck} from '../shared/ai-job.mjs';
import {hashText} from '../shared/database-transfer.mjs';
import {preserveArticleContent,analysisSignature} from '../shared/article-record.mjs';
import {compactOparl,publicParticipants} from '../server/integrations/source-fields.mjs';
function fixture(){const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));const db=sqliteAdapter(sql);const put=(id,region='billerbeck',extra={})=>{const t={id,regionId:region,title:'Schulbau',officialTitle:'Schulbau',status:'consulting',sourceUrl:'https://example.org/paper',documents:[],events:[],classification:{primary:'bildung',method:'title-rules-v2',version:'labels-v2',evidence:'Schulbau'},labelAssessments:{rule:{primary:'bildung',method:'rules'}},metadata:{firstImportedAt:'2026-09-01'},...extra};sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,region,'city','2026-09-27','2026-09-27','consulting',JSON.stringify(t));return t;};return {sql,db,put};}
const checks=['source_read','process','numbers','neutrality'].map(name=>({name,passed:true}));
async function output(job){const quote='Im Rat wird der Schulneubau beraten.',url='https://example.org/paper',e={url,quote};return {format:'ratsmonitor-ai-results-v1',jobId:job.id,articles:job.articles.map(a=>({id:a.id,expectedPayloadHash:a.payloadHash,agent:'Example Agent',model:'test-model',sources:[{url,hash:'a'.repeat(64),fetchedAt:'2026-09-27T19:00:00Z',excerpts:[quote]}],summary:{status:'completed',shortSummary:quote,longSummary:[quote],evidence:[e],checks},aiLabel:{status:'completed',primary:'bildung',secondary:[],reason:'Schulneubau',evidence:[e],checks},keywords:{status:'completed',items:Array.from({length:10},(_,i)=>({term:'Begriff '+i,score:1+i%5,reason:'Testbegründung',evidence:e})),evidence:[e],checks}}))};}

test('selection validates IDs, distinguishes districts, and covers the complete catalogue of all states',()=>{assert.equal(selectedRegions('all').length,427+440+4457);assert.ok(selectedRegions(['nds-033585401']).length===1);assert.ok(selectedRegions(['de-09162000']).length===1);
 // 'sources': every area with a connected source and no other.
 const connected=selectedRegions('sources');assert.ok(connected.length>500&&connected.length<selectedRegions('all').length);assert.ok(connected.every(canImport));assert.equal(connected.length,selectedRegions('all').filter(canImport).length);assert.deepEqual(selectedRegions(['billerbeck','billerbeck','coesfeld']),['billerbeck','coesfeld']);assert.throws(()=>selectedRegions(['x\' OR 1=1']));assert.throws(()=>selectedRegions([]));assert.equal(canImport('billerbeck'),true);});
test('persistent queue handles partial sources, unavailable territory, cancellation and interrupted steps without replay',async()=>{
 const {sql,db}=fixture();const unavailable=selectedRegions('all').find(id=>!canImport(id));let calls=0;
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:['billerbeck',unavailable]},()=>{throw Error('must not run');});assert.equal(job.items[1].status,'unavailable');assert.equal(calls,0);
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>{calls++;return {status:200,data:{topics:5,coverage:{complete:false,issues:['Zeitlimit']}}};});assert.equal(job.status,'completed');assert.equal(job.items[0].status,'partial');assert.equal(calls,1);
 await pipelineAction(db,{action:'step',id:job.id},()=>{throw Error('duplicate');});
 job=await pipelineAction(db,{action:'create',stage:'analysis',regions:['billerbeck']},()=>{});
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>({status:200,data:{processed:500,remaining:1,more:true,cursor:'a0499'}}));assert.equal(job.status,'queued');assert.equal(job.items[0].cursor,'a0499');assert.equal(job.items[0].remaining,1);
 // Rule labelling is repeatable: an interrupted package is queued again, and the next package continues behind the cursor.
 job.items[0].status='running';await db.prepare("UPDATE system_state SET value=? WHERE key='admin-pipeline-job'").bind(JSON.stringify(job)).run();
 let seen;job=await pipelineAction(db,{action:'step',id:job.id},async(stage,region,window,cursor)=>{seen=[stage,region,cursor];return {status:200,data:{processed:1,remaining:0,more:false,cursor:'a0500'}};});
 assert.deepEqual(seen,['analysis','billerbeck','a0499']);assert.equal(job.status,'completed');assert.equal(job.items[0].processed,501);assert.equal(job.items[0].cursor,undefined);assert.equal(job.items[0].message,'Alle offenen Berichte bearbeitet.');
 // An interrupted import is never silently repeated.
 job=await pipelineAction(db,{action:'create',stage:'metadata',regions:['billerbeck']},()=>{});job.items[0].status='running';await db.prepare("UPDATE system_state SET value=? WHERE key='admin-pipeline-job'").bind(JSON.stringify(job)).run();
 job=await pipelineAction(db,{action:'step',id:job.id},()=>{throw Error('must not replay');});assert.equal(job.items[0].status,'unknown');
 job=await pipelineAction(db,{action:'create',stage:'analysis',regions:['billerbeck']},()=>{});job=await pipelineAction(db,{action:'cancel',id:job.id},()=>{});assert.equal(job.status,'cancelled');sql.close();
});
test('rule labelling of the whole stock is one item: package after package behind the cursor, pausable between packages',async()=>{
 const {sql,db}=fixture();
 let job=await pipelineAction(db,{action:'create',stage:'analysis',regions:'all'},()=>{});assert.equal(job.scope,'all');assert.deepEqual(job.items.map(i=>i.region),['all']);assert.equal(job.items[0].status,'queued');
 // The whole stock is not counted after every package: the answer says only whether more may follow.
 job=await pipelineAction(db,{action:'step',id:job.id},async(stage,region,window,cursor)=>{assert.equal(region,'all');assert.equal(cursor,undefined);return {status:200,data:{processed:500,remaining:null,more:true,cursor:'x1'}};});
 assert.equal(job.status,'queued');assert.equal(job.items[0].cursor,'x1');assert.equal(job.items[0].remaining,undefined);assert.match(job.items[0].message,/nächste Paket/);
 // Paused: no package is claimed; the stored packages stay. Resume continues behind the cursor.
 job=await pipelineAction(db,{action:'pause',id:job.id},()=>{});job=await pipelineAction(db,{action:'step',id:job.id},()=>{throw Error('paused jobs claim nothing');});assert.equal(job.items[0].status,'queued');assert.equal(job.paused,true);
 job=await pipelineAction(db,{action:'resume',id:job.id},()=>{});
 job=await pipelineAction(db,{action:'step',id:job.id},async(stage,region,window,cursor)=>({status:200,data:{processed:7,remaining:0,more:false,cursor:cursor+'!'}}));assert.equal(job.status,'completed');assert.equal(job.items[0].processed,507);assert.equal(job.items[0].cursor,undefined);
 // A package that did not answer (interrupted request) pauses the job instead of marking the stock unknown.
 job=await pipelineAction(db,{action:'create',stage:'analysis',regions:'all'},()=>{});job=await pipelineAction(db,{action:'step',id:job.id},()=>{throw Error('interrupted');});assert.equal(job.items[0].status,'queued');assert.equal(job.paused,true);
 const unchanged=await pipelineAction(db,{action:'create',stage:'metadata',regions:'all'},()=>{throw Error('must not run');}).catch(e=>e);assert.equal(unchanged.status,409);sql.close();
});
test('integer keyword allocation totals 100 and breaks ties consistently without filling missing terms',()=>{const items=Array.from({length:10},(_,i)=>({term:String(i),score:1+i%4}));const result=keywordWeights(items);assert.equal(result.reduce((n,k)=>n+k.weight,0),100);assert.ok(result.every(k=>Number.isInteger(k.weight)&&k.weight>0));assert.deepEqual(Object.fromEntries(result.map(k=>[k.term,k.weight])),Object.fromEntries(keywordWeights([...items].reverse()).map(k=>[k.term,k.weight])));assert.throws(()=>keywordWeights(items.slice(1)));assert.throws(()=>keywordWeights(items.map(i=>({...i,term:'same'}))));});
test('AI job applies separate results atomically, preserves rules and owner, counts current state and repeats safely',async()=>{
 const {sql,db,put}=fixture();put('a');put('other','muenster');put('alias','billerbeck',{identity:{mergedInto:'a'}});sql.exec("INSERT INTO system_state VALUES('admin-owner-v1','local-owner')");
 const before=JSON.parse(sql.prepare("SELECT payload FROM topics WHERE id='a'").get().payload);
 const job=await createAiJob(db,{regions:['billerbeck'],kinds:['summary','aiLabel','keywords'],limit:10});assert.equal(job.articles.length,1);assert.ok(!JSON.stringify(job).includes('title-rules-v2'));
 const result=await output(job);let receipt=await applyAiResults(db,job,result);assert.equal(receipt.applied,1);assert.equal(receipt.conflicts.length,0);
 const topic=JSON.parse(sql.prepare("SELECT payload FROM topics WHERE id='a'").get().payload);assert.deepEqual(topic.labelAssessments.rule,before.labelAssessments.rule);assert.deepEqual(topic.classification,before.classification);assert.equal(topic.weightedKeywords.items.reduce((n,i)=>n+i.weight,0),100);assert.equal(sql.prepare("SELECT value FROM system_state WHERE key='admin-owner-v1'").get().value,'local-owner');
 receipt=await applyAiResults(db,job,result);assert.equal(receipt.skipped,1);assert.equal(sql.prepare('SELECT count(*) n FROM article_analyses').get().n,3);assert.equal(sql.prepare('SELECT count(*) n FROM article_versions').get().n,1);
 const status=await processingStatus(db);const region=status.regions.find(r=>r.region_id==='billerbeck');assert.equal(region.total,1);for(const k of ['summary','aiLabel','keywords'])assert.equal(region[k],1,k);assert.ok(status.revision>0);sql.close();
});
test('AI rejects invalid labels, evidence, tampering and stale snapshots; failures preserve good old summaries',async()=>{
 const {sql,db,put}=fixture();put('a','billerbeck',{shortSummary:'Gute alte Zusammenfassung',longSummary:['Bisheriger Text'],contentAnalysis:{status:'completed',evidence:[{}]}});
 const job=await createAiJob(db,{regions:['billerbeck'],kinds:['summary','aiLabel','keywords']});let result=await output(job);
 result.articles[0].aiLabel.primary='invented';await assert.rejects(applyAiResults(db,job,result),/Label/);assert.equal(sql.prepare('SELECT count(*) n FROM article_analyses').get().n,0);
 assert.deepEqual(job.articles[0].kinds,['aiLabel','keywords']); // Zusammenfassung ist schon vorhanden
 result=await output(job);result.articles[0].aiLabel.evidence[0]={url:'https://evil.example',quote:'not read'};await assert.rejects(applyAiResults(db,job,result),/Beleg/);
 result=await output(job);sql.prepare("UPDATE topics SET payload=json_set(payload,'$.reference','new') WHERE id='a'").run();assert.deepEqual((await applyAiResults(db,job,result)).conflicts,['a']);assert.equal(sql.prepare('SELECT count(*) n FROM article_versions').get().n,0);
 await cancelAiJob(db,job.id);await assert.rejects(applyAiResults(db,job,result),/aktiv/);
 const next=await createAiJob(db,{regions:['billerbeck'],kinds:['summary','aiLabel']});result=await output(next);for(const k of next.kinds)result.articles[0][k]={status:'insufficient_source',reason:'Nur Titel öffentlich verfügbar'};result.articles[0].sources=[];
 assert.equal((await applyAiResults(db,next,result)).applied,1);assert.equal(JSON.parse(sql.prepare("SELECT payload FROM topics WHERE id='a'").get().payload).shortSummary,'Gute alte Zusammenfassung');sql.close();
});
test('article commit rolls back all versions if database write fails',async()=>{
 const {sql,db,put}=fixture();put('a');const job=await createAiJob(db,{regions:['billerbeck'],kinds:['summary']});const before=sql.prepare('SELECT payload FROM topics').get().payload;
 sql.exec("CREATE TRIGGER refuse_ai BEFORE UPDATE ON topics BEGIN SELECT RAISE(ABORT,'test write failure'); END;");await assert.rejects(applyAiResults(db,job,await output(job)),/test write failure/);assert.equal(sql.prepare('SELECT count(*) n FROM article_analyses').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM article_versions').get().n,0);assert.equal(sql.prepare('SELECT payload FROM topics').get().payload,before);sql.close();
});
test('source extraction retains public structured fields and does not copy private agenda lists or full text',async()=>{
 const r=compactOparl({id:'id',name:'Rat',meetingState:'durchgeführt',agendaItem:[{public:false,name:'Private'}],text:'Long body',created:'now'},'meeting');assert.equal(r.fields.meetingState,'durchgeführt');assert.equal(r.fields.agendaItem,undefined);assert.equal(r.fields.text,undefined);
 const attendance=await publicParticipants({id:'https://example.org/meeting',participant:['person']},async()=>({name:'Example Person'}),'now');assert.equal(attendance.status,'available');assert.equal(attendance.people[0].presence,'present');
});


test('generic jobs retain arbitrary agent provenance in storage, hashes and counters',async()=>{
 const {sql,db,put}=fixture();put('a');
 const job=await createAiJob(db,{regions:['billerbeck'],kinds:['summary','aiLabel','keywords']});
 assert.equal(job.method,AI_METHOD);assert.ok(!/claude/i.test(job.instructions));
 const result=await output(job);delete result.articles[0].agent;
 await assert.rejects(applyAiResults(db,job,result),/KI-Agenten/);
 for(const agent of ['Codex','Claude Code','Another Agent']){
  result.articles[0].agent=agent;
  const prepared=await articleResult(job,job.articles[0],result.articles[0]);
  assert.equal(prepared.analyses[0].payload.agent,agent);
  assert.equal(prepared.analyses[0].payload.method,AI_METHOD);
 }
 const first=await articleResult(job,job.articles[0],result.articles[0]);
 result.articles[0].agent='Different Agent';
 const second=await articleResult(job,job.articles[0],result.articles[0]);
 assert.notEqual(first.analyses[0].payload.id,second.analyses[0].payload.id);
 await applyAiResults(db,job,result);
 for(const row of sql.prepare('SELECT method,payload FROM article_analyses').all()){
  assert.equal(row.method,AI_METHOD);assert.equal(JSON.parse(row.payload).agent,'Different Agent');
 }
 assert.equal(JSON.parse(sql.prepare('SELECT details FROM import_runs').get().details).mode,'ai-agent-analysis');
 assert.equal((await applyAiResults(db,job,result)).skipped,1);
 assert.equal((await processingStatus(db)).regions[0].keywords,1);sql.close();
});

test('legacy results retain their original hashes and repeat without relabelling',async()=>{
 const {sql,db,put}=fixture();put('a');
 const job=await createAiJob(db,{regions:['billerbeck'],kinds:['summary']});job.method=LEGACY_AI_METHOD;
 sql.prepare("UPDATE system_state SET value=? WHERE key='admin-ai-job'").run(JSON.stringify(job));
 const result=await output(job),r=result.articles[0];delete r.agent;
 const prepared=await articleResult(job,job.articles[0],r);
 const oldHash=await hashText(JSON.stringify({signature:job.articles[0].sourceSignature,sources:r.sources.map(s=>[s.url,s.hash]).sort(),method:LEGACY_AI_METHOD,model:r.model}));
 assert.equal(prepared.analyses[0].payload.inputHash,oldHash);
 assert.equal(prepared.analyses[0].payload.id,await hashText(['a','summary',oldHash,LEGACY_AI_METHOD].join('\n')));
 await applyAiResults(db,job,result);assert.equal((await applyAiResults(db,job,result)).skipped,1);
 assert.equal(sql.prepare('SELECT method FROM article_analyses').get().method,LEGACY_AI_METHOD);
 r.agent='Codex';await assert.rejects(applyAiResults(db,job,result),/neuen Auftrag/);
 assert.equal(sql.prepare('SELECT count(*) n FROM article_analyses').get().n,1);sql.close();
});

test('limited exports rotate after cancellation and failed results, survive restart, and keep kinds separate',async()=>{
 const {sql,db,put}=fixture();try{
  for(const id of ['a','b','c'])put(id);
  const request={regions:['billerbeck'],kinds:['summary'],limit:1};
  const first=await createAiJob(db,request);assert.equal(first.articles[0].id,'a');
  await assert.rejects(createAiJob(db,request),/bereits vorbereitet/);
  const redownload=await getAiJob(sqliteAdapter(sql));assert.equal(redownload.id,first.id);assert.equal(redownload.articles[0].id,'a');
  await cancelAiJob(db,first.id);
  const second=await createAiJob(sqliteAdapter(sql),request);assert.equal(second.articles[0].id,'b');
  const failed=await output(second);failed.articles[0].summary={status:'insufficient_source',reason:'Nur Tagesordnung verfügbar'};
  await applyAiResults(db,second,failed);
  const third=await createAiJob(db,request);assert.equal(third.articles[0].id,'c');
  await applyAiResults(db,third,await output(third));
  const fourth=await createAiJob(db,request);assert.equal(fourth.articles[0].id,'a'); // oldest export, c is completed
  await cancelAiJob(db,fourth.id);
  const otherKind=await createAiJob(db,{...request,kinds:['keywords']});assert.equal(otherKind.articles[0].id,'a'); // never exported for keywords
 }finally{sql.close();}
});
test('all freezes more than 100 inputs in rows, pages downloads, and accepts idempotent partial results',async()=>{
 const {sql,db,put}=fixture();try{
  for(let i=0;i<205;i++)put('article-'+String(i).padStart(3,'0'));
  put('outside','muenster');put('alias','billerbeck',{identity:{mergedInto:'article-000'}});
  const revision=sql.prepare("SELECT revision FROM data_revisions WHERE id='content'").get().revision;
  const job=await createAiJob(db,{regions:['billerbeck'],kinds:['summary'],limit:'all'},{metadataOnly:true});
  assert.equal(job.articleCount,205);assert.equal(job.articles,undefined);
  assert.equal(sql.prepare("SELECT revision FROM data_revisions WHERE id='content'").get().revision,revision);
  const stored=JSON.parse(sql.prepare("SELECT value FROM system_state WHERE key='admin-ai-job'").get().value);
  assert.equal(stored.articles,undefined);assert.equal(sql.prepare('SELECT count(*) n FROM ai_job_articles').get().n,205);
  const first=await getAiJob(db,{id:job.id,limit:100}),second=await getAiJob(db,{id:job.id,offset:100,limit:100}),last=await getAiJob(db,{id:job.id,offset:200,limit:100});
  assert.deepEqual([first.articles.length,second.articles.length,last.articles.length],[100,100,5]);
  assert.equal(new Set([...first.articles,...second.articles,...last.articles].map(a=>a.id)).size,205);
  await assert.rejects(getAiJob(db,{id:'changed',limit:100}),/geändert/);
  const partial=await output(first);assert.equal((await applyAiResults(db,job,partial)).applied,100);
  assert.equal((await processingStatus(db)).aiJob.applied,100);assert.equal((await processingStatus(db)).aiJob.status,'prepared');
  assert.equal((await applyAiResults(db,job,partial)).skipped,100);
  await assert.rejects(createAiJob(db,{regions:['billerbeck'],kinds:['summary'],limit:100}),/bereits vorbereitet/);
  await applyAiResults(db,job,await output(second));await applyAiResults(db,job,await output(last));
  assert.equal((await processingStatus(db)).aiJob.applied,205);assert.equal((await processingStatus(db)).aiJob.status,'completed');
  const empty=await createAiJob(db,{regions:['billerbeck'],kinds:['summary'],limit:'all'});assert.equal(empty.articles.length,0);
 }finally{sql.close();}
});
test('job creation failure does not advance dispatches or replace the previous manifest',async()=>{
 const {sql,db,put}=fixture();try{
  put('a');const job=await createAiJob(db,{regions:['billerbeck'],kinds:['summary'],limit:1});await cancelAiJob(db,job.id);
  const before=sql.prepare('SELECT * FROM ai_dispatches').all();
  sql.exec("CREATE TRIGGER refuse_job BEFORE INSERT ON ai_job_articles BEGIN SELECT RAISE(ABORT,'test snapshot failure'); END;");
  await assert.rejects(createAiJob(db,{regions:['billerbeck'],kinds:['summary'],limit:'all'}),/snapshot failure/);
  assert.deepEqual(sql.prepare('SELECT * FROM ai_dispatches').all(),before);
  assert.equal((await getAiJob(db)).id,job.id);
  assert.equal(sql.prepare("SELECT count(*) n FROM system_state WHERE key IN ('import-lock','ai-job-lease')").get().n,0);
  sql.exec('DROP TRIGGER refuse_job');
  for(const limit of [0,101,-1,'100',null,'ALL']){
   if(limit===null)continue;
   await assert.rejects(createAiJob(db,{regions:['billerbeck'],kinds:['summary'],limit}),/Paketgröße/);
  }
 }finally{sql.close();}
});
// Four areas of one server and thirty areas of thirty other servers, all with a connected source.
function parallelAreas(){
 const groups=new Map();for(const id of selectedRegions('all').filter(canImport))groups.set(provider(id),[...(groups.get(provider(id))||[]),id]);
 const shared=[...groups.values()].find(ids=>ids.length>=4).slice(0,4),single=[...groups.values()].filter(ids=>ids[0]!==shared[0]).map(ids=>ids[0]).slice(0,30);
 return {shared,single};
}
const wait=ms=>new Promise(done=>setTimeout(done,ms));
const stored=sql=>JSON.parse(sql.prepare("SELECT value FROM system_state WHERE key='admin-pipeline-job'").get().value);
const done={status:200,data:{topics:1,coverage:{complete:true,issues:[]}}};
test('import steps run side by side: at most 24, at most two on one server, the largest server first, every area exactly once',async()=>{
 const {sql,db}=fixture(),{shared,single}=parallelAreas();
 assert.equal(new Set(shared.map(provider)).size,1);assert.equal(new Set([...shared,...single].map(provider)).size,31);assert.equal(PARALLEL.metadata,24);assert.equal(PARALLEL.analysis,1);assert.equal(PER_PROVIDER,2);
 // The areas of the shared server stand last in the list and are still taken first.
 const job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[...single.slice(0,26),...shared],window:'1w'},()=>{});
 assert.ok(job.items.every(i=>i.server===provider(i.region)));assert.equal(job.counts.queued,30);
 const active=new Set(),seen=[];let most=0,mostShared=0;
 const run=async(stage,region,window)=>{
  assert.equal(stage,'metadata');assert.equal(window,'1w');
  active.add(region);most=Math.max(most,active.size);mostShared=Math.max(mostShared,[...active].filter(other=>provider(other)===provider(shared[0])).length);
  // Long enough for 24 callers to get their turn at the stored job while the first imports still run.
  seen.push(region);await wait(1500);active.delete(region);
  return {status:200,data:{topics:2,coverage:{complete:true,issues:[]}}};
 };
 // Thirty callers, more than the server allows: the surplus is told to wait and asks again.
 let waits=0;
 const worker=async()=>{for(;;){const state=await pipelineAction(db,{action:'step',id:job.id},run);if(state.status==='completed')return state;if(state.wait){waits++;await wait(4);}}};
 const finished=await Promise.all(Array.from({length:30},worker));
 assert.equal(most,24);assert.equal(mostShared,2,'two on one server at once, never three');assert.ok(waits>0);assert.equal(seen.length,30);assert.equal(new Set(seen).size,30,'no area is imported twice');
 assert.ok(seen.slice(0,2).every(region=>shared.includes(region)),'the server with the most open areas starts first');
 const final=stored(sql);assert.equal(final.status,'completed');assert.ok(finished.every(f=>f.status==='completed'));
 assert.ok(final.items.every(i=>i.status==='completed'&&i.processed===2&&!i.startedAt));assert.equal(final.wait,undefined,'wait is an answer, not part of the stored job');
 assert.equal(sql.prepare("SELECT count(*) n FROM system_state WHERE key='pipeline-lease'").get().n,0);sql.close();
});
test('a step waits while the only open areas belong to a busy operator; rule labelling stays one at a time',async()=>{
 const {sql,db}=fixture(),{shared}=parallelAreas();
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:shared.slice(0,3)},()=>{});
 let release;const gate=new Promise(open=>{release=open;}),calls=[];
 const held=async(stage,region)=>{calls.push(region);await gate;return done;};
 const first=pipelineAction(db,{action:'step',id:job.id},held);await wait(10);
 const second=pipelineAction(db,{action:'step',id:job.id},held);await wait(10);
 const third=await pipelineAction(db,{action:'step',id:job.id},()=>{throw Error('must wait for the operator');});
 assert.equal(third.wait,true);assert.equal(third.status,'running');assert.deepEqual(third.items.map(i=>i.status),['running','running','queued']);assert.ok(third.items[0].startedAt);
 release();await first;job=await second;assert.deepEqual(job.items.map(i=>i.status),['completed','completed','queued']);assert.equal(job.status,'queued');
 job=await pipelineAction(db,{action:'step',id:job.id},async(stage,region)=>{calls.push(region);return done;});
 assert.equal(job.status,'completed');assert.deepEqual(calls,shared.slice(0,3));
 // Rule labelling: a second caller waits even though another area is open.
 job=await pipelineAction(db,{action:'create',stage:'analysis',regions:['billerbeck','coesfeld']},()=>{});
 let free;const hold=new Promise(open=>{free=open;});
 const labelling=pipelineAction(db,{action:'step',id:job.id},async()=>{await hold;return {status:200,data:{processed:10,remaining:0}};});
 await wait(10);
 assert.equal((await pipelineAction(db,{action:'step',id:job.id},()=>{throw Error('one at a time');})).wait,true);
 free();await labelling;sql.close();
});
test('a silent step is marked for checking after five minutes, a recent one is left alone; a cancelled job keeps results',async()=>{
 const {sql,db}=fixture(),{single}=parallelAreas();
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:single.slice(0,3)},()=>{});
 job.status='running';
 Object.assign(job.items[0],{status:'running',startedAt:new Date(Date.now()-6*60000).toISOString()});
 Object.assign(job.items[1],{status:'running',startedAt:new Date(Date.now()-60000).toISOString()});
 await db.prepare("UPDATE system_state SET value=? WHERE key='admin-pipeline-job'").bind(JSON.stringify(job)).run();
 const calls=[];
 job=await pipelineAction(db,{action:'step',id:job.id},async(stage,region)=>{calls.push(region);return done;});
 assert.deepEqual(calls,[single[2]],'neither running area is repeated');
 assert.deepEqual(job.items.map(i=>i.status),['unknown','running','completed']);assert.match(job.items[0].message,/Antwort unterbrochen/);assert.equal(job.status,'running');
 // Nothing left to claim, one step still out: the caller is asked to wait.
 assert.equal((await pipelineAction(db,{action:'step',id:job.id},()=>{throw Error('nothing to claim');})).wait,true);
 // A job cancelled while a step runs still records what that step stored, and stays cancelled.
 job=await pipelineAction(db,{action:'cancel',id:job.id},()=>{});assert.equal(job.status,'cancelled');
 job=await pipelineAction(db,{action:'create',stage:'metadata',regions:single.slice(0,2)},()=>{});
 const id=job.id,running=pipelineAction(db,{action:'step',id},async()=>{await wait(20);return {status:502,data:{error:'Import fehlgeschlagen',cause:'HTTP 503'}};});
 await wait(5);await pipelineAction(db,{action:'cancel',id},()=>{});
 job=await running;assert.equal(job.status,'cancelled');assert.equal(job.items[0].status,'failed');assert.match(job.items[0].message,/Ursache: HTTP 503/);assert.equal(job.items[1].status,'queued');
 assert.equal((await pipelineAction(db,{action:'step',id},()=>{throw Error('cancelled jobs do not run');})).status,'cancelled');
 await assert.rejects(pipelineAction(db,{action:'step',id:'other'},()=>{}),/inzwischen geändert/);sql.close();
});
test('an import cut off by the time limit continues in the same job, but not without end; unchanged meetings are named',async()=>{
 const {sql,db}=fixture(),{single}=parallelAreas();
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[single[0]],window:'12m'},()=>{});
 const cut={status:200,data:{topics:40,resume:true,attemptComplete:false,coverage:{complete:false,issues:['Zeitbudget der Quelle erreicht; 80 Sitzungen noch nicht vollständig gelesen.']}}};
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>cut);
 assert.equal(job.items[0].status,'queued');assert.equal(job.items[0].processed,40);assert.match(job.items[0].message,/wird fortgesetzt \(Teil 2\)/);assert.equal(job.status,'queued');
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>({status:200,data:{topics:35,unchanged:60,attemptComplete:true,coverage:{complete:true,issues:[]}}}));
 assert.equal(job.items[0].status,'completed');assert.equal(job.items[0].processed,75);assert.match(job.items[0].message,/60 unveränderte Sitzungen übersprungen/);assert.equal(job.status,'completed');
 // A warning is shown with the result and does not turn a complete import into a partial one.
 job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[single[3]]},()=>{});
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>({status:200,data:{topics:3,attemptComplete:true,warnings:['Vorlage nicht öffentlich (HTTP 401): x'],coverage:{complete:true,issues:[]}}}));
 assert.equal(job.items[0].status,'completed');assert.equal(job.items[0].message,'Ergebnis in der Datenbank gespeichert. Warnung: Vorlage nicht öffentlich (HTTP 401): x');
 // A source that never gets through: after ten continuations the item ends as a partial result.
 job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[single[1]],window:'12m'},()=>{});
 let attempts=0;for(;job.status!=='completed'&&attempts<30;attempts++)job=await pipelineAction(db,{action:'step',id:job.id},async()=>cut);
 assert.equal(attempts,11);assert.equal(job.items[0].status,'partial');assert.match(job.items[0].message,/Zeitbudget/);
 // Two years are twice the work: twenty continuations.
 job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[single[4]],window:'24m'},()=>{});
 for(attempts=0;job.status!=='completed'&&attempts<50;attempts++)job=await pipelineAction(db,{action:'step',id:job.id},async()=>cut);
 assert.equal(attempts,21);assert.equal(job.items[0].status,'partial');assert.equal(job.window,'24m');
 // An attempt that read nothing further is not continued.
 job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[single[2]]},()=>{});
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>({status:200,data:{...cut.data,resume:false}}));assert.equal(job.items[0].status,'partial');sql.close();
});
test('one request runs several lanes; pause holds further areas until resume; answers can list only what changed',async()=>{
 const {sql,db}=fixture(),{single}=parallelAreas();
 const active=new Set(),calls=[];let most=0;
 const run=async(stage,region)=>{calls.push(region);active.add(region);most=Math.max(most,active.size);await wait(40);active.delete(region);return done;};
 // Three lanes take area after area until the job is done.
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:single.slice(0,8),window:'1w'},()=>{});
 job=await pipelineAction(db,{action:'run',id:job.id,lanes:3},run);
 assert.equal(job.status,'completed');assert.equal(job.counts.completed,8);assert.equal(most,3);assert.equal(new Set(calls).size,8);assert.equal(job.wait,undefined);
 // More lanes than allowed are cut to eight. The imports last long enough for every lane to get its turn at the stored job.
 most=0;job=await pipelineAction(db,{action:'create',stage:'metadata',regions:single.slice(0,12)},()=>{});
 job=await pipelineAction(db,{action:'run',id:job.id,lanes:99},async(stage,region)=>{active.add(region);most=Math.max(most,active.size);await wait(900);active.delete(region);return done;});assert.equal(most,8);assert.equal(job.status,'completed');
 // Rule labelling stays one at a time, whatever the number of lanes.
 most=0;job=await pipelineAction(db,{action:'create',stage:'analysis',regions:['billerbeck','coesfeld','steinfurt']},()=>{});
 job=await pipelineAction(db,{action:'run',id:job.id,lanes:4},async(stage,region)=>{active.add(region);most=Math.max(most,active.size);await wait(20);active.delete(region);return {status:200,data:{processed:5,remaining:0}};});
 assert.equal(most,1);assert.equal(job.status,'completed');
 // since: only the areas changed from that moment on are listed, the numbers cover the whole job.
 const created=await pipelineAction(db,{action:'create',stage:'metadata',regions:single.slice(0,3)},()=>{});
 assert.equal(created.delta,undefined);assert.equal(created.items.length,3);
 await wait(5);
 const first=await pipelineAction(db,{action:'step',id:created.id,since:created.updatedAt},async()=>done);
 assert.equal(first.delta,true);assert.deepEqual(first.items.map(i=>i.status),['completed']);assert.deepEqual(first.counts,{completed:1,queued:2});
 const status=await pipelineAction(db,{action:'status',id:created.id,since:first.updatedAt},()=>{throw Error('status only reads');});
 assert.equal(status.updatedAt,first.updatedAt);assert.equal(status.items.length,1);assert.equal(stored(sql).counts,undefined,'the numbers are part of the answer, not of the stored job');
 // pause: nothing further is claimed, neither by a step nor by lanes; resume continues.
 job=await pipelineAction(db,{action:'pause',id:created.id},()=>{});assert.equal(job.paused,true);
 const refused=()=>{throw Error('a paused job claims nothing');};
 job=await pipelineAction(db,{action:'step',id:created.id},refused);assert.equal(job.wait,undefined);assert.equal(job.counts.queued,2);
 job=await pipelineAction(db,{action:'run',id:created.id,lanes:4},refused);assert.equal(job.paused,true);assert.equal(job.wait,undefined);
 job=await pipelineAction(db,{action:'resume',id:created.id},()=>{});assert.equal(job.paused,undefined);
 job=await pipelineAction(db,{action:'run',id:created.id,lanes:4},run);assert.equal(job.status,'completed');
 // An import refused because another process holds the stock pauses the job instead of asking again and again.
 job=await pipelineAction(db,{action:'create',stage:'metadata',regions:single.slice(0,4)},()=>{});
 let asked=0;job=await pipelineAction(db,{action:'run',id:job.id,lanes:1},async()=>{asked++;return {status:409,data:{error:'Import läuft bereits'}};});
 assert.equal(asked,1);assert.equal(job.paused,true);assert.equal(job.counts.queued,4);assert.match(job.items.find(i=>i.message).message,/läuft bereits/);
 await assert.rejects(pipelineAction(db,{action:'run',id:'other',lanes:2},run),/inzwischen geändert/);
 await pipelineAction(db,{action:'cancel',id:job.id},()=>{});
 // The nationwide job: every connected source, no area without one, named by its scope.
 job=await pipelineAction(db,{action:'create',stage:'metadata',regions:'sources',window:'1w'},()=>{});
 assert.equal(job.scope,'sources');assert.equal(job.items.length,selectedRegions('sources').length);assert.equal(job.counts.unavailable,undefined);assert.equal(job.window,'1w');
 assert.ok(JSON.stringify(stored(sql)).length<400*job.items.length,'the stored job stays small');sql.close();
});
test('a new job replaces an open one only when asked to, and never while imports of it still run',async()=>{
 const {sql,db}=fixture(),{single}=parallelAreas(),put=job=>db.prepare("UPDATE system_state SET value=? WHERE key='admin-pipeline-job'").bind(JSON.stringify(job)).run();
 const old=await pipelineAction(db,{action:'create',stage:'metadata',regions:single.slice(0,3),window:'12m'},()=>{});
 const germany={action:'create',stage:'metadata',regions:'sources',window:'1w'};
 await assert.rejects(pipelineAction(db,germany,()=>{}),/fortsetzen oder beenden/);
 // An import of the open job is still running (another tab): it is waited for.
 Object.assign(old.items[0],{status:'running',startedAt:new Date().toISOString()});old.status='running';await put(old);
 await assert.rejects(pipelineAction(db,{...germany,replace:true},()=>{}),/laufenden Abrufe/);
 assert.equal(stored(sql).id,old.id);
 // An interrupted one (silent for more than five minutes) does not hold the replacement back.
 old.items[0].startedAt=new Date(Date.now()-6*60000).toISOString();await put(old);
 const next=await pipelineAction(db,{...germany,replace:true},()=>{});
 assert.notEqual(next.id,old.id);assert.equal(next.scope,'sources');assert.equal(next.window,'1w');assert.equal(stored(sql).id,next.id);
 await assert.rejects(pipelineAction(db,{action:'step',id:old.id},()=>{throw Error('the old job is gone');}),/inzwischen geändert/);
 sql.close();
});
test('the page follows a job through parallel requests: its merged answers equal the stored job',async()=>{
 const {sql,db}=fixture(),{shared,single}=parallelAreas();
 const number=text=>[...text].reduce((n,c)=>(n*31+c.charCodeAt(0))%9973,7);
 // Imports of different length and outcome: complete, partial, failed, cut off once and continued.
 const cut=new Set();
 const run=async(stage,region)=>{
  await wait(5+number(region)%60);
  if(number(region)%7===0)return {status:502,data:{error:'Import fehlgeschlagen',cause:'HTTP 503'}};
  if(number(region)%5===0&&!cut.has(region)){cut.add(region);return {status:200,data:{topics:4,resume:true,attemptComplete:false,coverage:{complete:false,issues:['Zeitbudget der Quelle erreicht']}}};}
  return {status:200,data:{topics:3,coverage:{complete:number(region)%3!==0,issues:number(region)%3?[]:['Begrenzter Abruf']}}};
 };
 let latest=await pipelineAction(db,{action:'create',stage:'metadata',regions:[...single.slice(0,26),...shared],window:'1w'},()=>{});
 // As the page does: four requests with six lanes each, and a status question in between; every answer names `since`.
 let watching=true,answers=0,deltas=0;
 const call=async(action,extra={})=>{const next=await pipelineAction(db,{action,id:latest.id,since:latest.updatedAt,...extra},run);answers++;if(next.delta)deltas++;latest=mergeJob(latest,next);return next;};
 const worker=async()=>{while(!['completed','cancelled'].includes(latest.status)){const next=await call('run',{lanes:6});if(next.wait)await wait(5);}};
 const watch=async()=>{while(watching){await wait(9);await call('status');}};
 const watcher=watch();await Promise.all(Array.from({length:4},worker));watching=false;await watcher;
 const final=stored(sql);
 assert.equal(latest.status,'completed');assert.deepEqual(latest.items,final.items);assert.equal(latest.updatedAt,final.updatedAt);
 assert.ok(deltas>3&&deltas===answers,'every answer listed only changes');assert.equal(latest.delta,undefined);assert.equal(latest.wait,undefined);
 assert.ok(final.items.some(i=>i.status==='failed')&&final.items.some(i=>i.status==='partial')&&final.items.some(i=>i.status==='completed')&&final.items.some(i=>i.resumes===1));
 // An older answer that arrives late changes nothing; a whole job replaces the held one only if it is not older.
 const area=final.items[0],stale={...final,updatedAt:'2000-01-01T00:00:00.000Z',delta:true,items:[{...area,status:'running',at:'2000-01-01T00:00:00.000Z'}]};
 assert.deepEqual(mergeJob(latest,stale),latest);
 assert.deepEqual(mergeJob(latest,{...final,updatedAt:'2000-01-01T00:00:00.000Z',items:[]}).items,latest.items);
 assert.equal(mergeJob(latest,{...final,id:'another job',items:[]}),latest);
 const newer={...final,updatedAt:'2999-01-01T00:00:00.000Z',status:'cancelled',delta:true,items:[{...area,status:'unknown',at:'2999-01-01T00:00:00.000Z'}]},merged=mergeJob(latest,newer);
 assert.equal(merged.status,'cancelled');assert.equal(merged.items[0].status,'unknown');assert.equal(merged.items.length,final.items.length);assert.deepEqual(merged.items.slice(1),final.items.slice(1));sql.close();
});

test('agent usage, words and attachments are stored once per article; missing figures stay unknown',async()=>{
 const {sql,db,put}=fixture();put('a');put('b');
 const job=await createAiJob(db,{regions:['billerbeck'],kinds:['summary','aiLabel','keywords']});
 const result=await output(job);
 const [one,two]=result.articles;
 one.sources[0].words=1200;one.sources[0].kind='page';
 one.sources.push({...one.sources[0],url:'https://example.org/paper',words:3000,kind:'attachment'});
 one.usage={basis:'measured',inputTokens:9000,outputTokens:700,cachedTokens:2000};
 await applyAiResults(db,job,{...result,articles:[one,two]});
 const rows=sql.prepare('SELECT * FROM ai_usage ORDER BY topic_id').all();
 assert.equal(rows.length,2);
 assert.deepEqual([rows[0].agent,rows[0].model,rows[0].token_basis,rows[0].word_count,rows[0].source_count,rows[0].attachment_count,rows[0].input_tokens,rows[0].output_tokens,rows[0].cached_tokens,rows[0].total_tokens],['Example Agent','test-model','measured',4200,2,1,9000,700,2000,9700]);
 assert.deepEqual([rows[1].token_basis,rows[1].total_tokens,rows[1].word_count],['unknown',null,null]);
 await assert.rejects(articleResult(job,job.articles[0],{...one,usage:{basis:'measured',inputTokens:'x',outputTokens:1}}),/usage/);
 sql.close();
});
test('exports request only missing steps and remember unsuccessful attempts until the sources change',async()=>{
 const {sql,db,put}=fixture();try{
  put('done','billerbeck',{shortSummary:'Fertig',longSummary:['Text'],contentAnalysis:{status:'completed',evidence:[{}]}});put('thin');put('broken');
  const all={regions:['billerbeck'],kinds:['summary','aiLabel'],limit:'all'};
  const first=await createAiJob(db,all),kindsOf=Object.fromEntries(first.articles.map(a=>[a.id,a.kinds]));
  assert.deepEqual(kindsOf,{broken:['summary','aiLabel'],done:['aiLabel'],thin:['summary','aiLabel']});assert.equal(first.requestedSteps,5);
  assert.deepEqual(sql.prepare("SELECT kind FROM ai_dispatches WHERE topic_id='done'").all().map(r=>r.kind),['aiLabel']);
  const result=await output(first),fail=(a,status,reason)=>{a.summary={status,reason};a.aiLabel={status,reason};};
  for(const a of result.articles){if(a.id==='thin')fail(a,'insufficient_source','Nur Tagesordnung');if(a.id==='broken')fail(a,'failed','Abruf scheiterte');}
  const receipt=await applyAiResults(db,first,result);
  assert.equal(receipt.applied,3);assert.equal(receipt.ignored,4); // nicht angeforderte Schritte werden nicht gespeichert
  assert.equal(JSON.parse(sql.prepare("SELECT payload FROM topics WHERE id='done'").get().payload).shortSummary,'Fertig');
  // failed: ein weiterer Versuch; insufficient_source: keiner, solange die Quelldaten gleich bleiben
  const second=await createAiJob(db,all);assert.deepEqual(second.articles.map(a=>a.id),['broken']);assert.equal(second.blocked,1);
  const again=await output(second);fail(again.articles[0],'failed','Abruf scheiterte erneut');
  assert.equal((await applyAiResults(db,second,again)).applied,1);
  const third=await createAiJob(db,all);assert.equal(third.articleCount,0);assert.equal(third.blocked,2);
  assert.equal((await processingStatus(db)).regions.find(r=>r.region_id==='billerbeck').blocked_summary,2);
  const forced=await createAiJob(db,{...all,retryBlocked:true});assert.deepEqual(forced.articles.map(a=>a.id).sort(),['broken','thin']);await cancelAiJob(db,forced.id);
  // Geänderte Quelldaten heben die Sperre auf
  const old=JSON.parse(sql.prepare("SELECT payload FROM topics WHERE id='thin'").get().payload),{aiAttempts,...incoming}=old;
  assert.equal(aiAttempts.summary.retry,false);
  const changed=preserveArticleContent(old,{...incoming,documents:[{url:'https://example.org/vorlage.pdf'}]});assert.equal(changed.aiAttempts,undefined);
  sql.prepare("UPDATE topics SET payload=? WHERE id='thin'").run(JSON.stringify(changed));
  const fourth=await createAiJob(db,all);assert.deepEqual(fourth.articles.map(a=>a.id),['thin']);
 }finally{sql.close();}
});
test('earlier unsuccessful agent results are recognised only while the sources are unchanged',async()=>{
 const {sql,db,put}=fixture();try{
  const same=put('same'),moved=put('moved');
  const add=(t,signature)=>sql.prepare('INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,?,?,?,?)').run('x-'+t.id,t.id,'summary',AI_METHOD,'h','2026-09-30T10:00:00Z',JSON.stringify({status:'insufficient_source',reason:'Nur Titel',method:AI_METHOD,model:'m',generatedAt:'2026-09-30T10:00:00Z',sourceSignature:signature}));
  add(same,analysisSignature(same));add(moved,'{"old":true}');
  const job=await createAiJob(db,{regions:['billerbeck'],kinds:['summary'],limit:'all'});
  assert.deepEqual(job.articles.map(a=>a.id),['moved']);assert.equal(job.blocked,1);
  assert.equal(JSON.parse(sql.prepare("SELECT payload FROM topics WHERE id='same'").get().payload).aiAttempts.summary.retry,false);
 }finally{sql.close();}
});
test('source roles steer reading order and flag articles without own paper for a quick check',()=>{
 const session='https://ris.example/bi/si0057.asp?__ksinr=1';
 assert.equal(sourceRole('https://ris.example/bi/to0050.asp?__ktonr=2','Vorlage / Öffentliche Tagesordnung'),'item');
 assert.equal(sourceRole('https://ris.example/bi/vo0050.asp?__kvonr=3','Vorlage / Öffentliche Tagesordnung'),'paper');
 assert.equal(sourceRole(session,'',new Set([session])),'session');
 assert.equal(sourceRole('https://ris.example/public/si010?SILFDNR=4'),'session');
 assert.equal(sourceRole('https://ris.example/oparl/bodies/1/agendaitems/5'),'item');
 assert.equal(sourceRole('https://ris.example/meeting?id=6','Öffentliche Sitzung'),'session');
 assert.equal(sourceRole('https://ris.example/getfile.asp?id=7','Öffentliche Niederschrift (Rat)'),'minutes');
 assert.equal(sourceRole('https://ris.example/doc?id=8','Sammeldokument öffentlich'),'bundle');
 assert.equal(sourceRole('https://ris.example/getfile.asp?id=9','Sitzungskalender 2026'),'agenda');
 assert.equal(sourceRole('https://ris.example/getfile.asp?id=10','Beschlussvorlage'),'paper');
 assert.equal(needsQuickCheck([{role:'item'},{role:'session'},{role:'agenda'}]),true);
 assert.equal(needsQuickCheck([{role:'item'},{role:'minutes'}]),false);
});
test('jobs list each source with its role once, group articles by session and keep internal fields out of the download',async()=>{
 const {sql,db,put}=fixture();try{
  const s1='https://ris.example/bi/si0057.asp?__ksinr=1',s2='https://ris.example/bi/si0057.asp?__ksinr=2',minutes='https://ris.example/bi/getfile.asp?id=99';
  const ev=url=>({date:'2026-09-01',committee:'Rat',status:'announced',description:'Öffentlich auf der Tagesordnung.',decision:{kind:'unknown',text:''},url});
  put('a1','billerbeck',{sourceUrl:'https://ris.example/bi/to0050.asp?__ktonr=1',documents:[{url:'https://ris.example/bi/to0050.asp?__ktonr=1',title:'Vorlage / Öffentliche Tagesordnung'}],events:[ev(s2)]});
  put('b1','billerbeck',{sourceUrl:'https://ris.example/bi/vo0050.asp?__kvonr=1',documents:[{url:minutes,title:'Öffentliche Niederschrift (Rat)'}],events:[ev(s1)]});
  put('c1','billerbeck',{sourceUrl:'https://ris.example/bi/vo0050.asp?__kvonr=2',documents:[{url:minutes,title:'Öffentliche Niederschrift (Rat)'}],events:[ev(s2)]});
  const job=await createAiJob(db,{regions:['billerbeck'],kinds:['summary'],limit:'all'});
  assert.deepEqual(job.articles.map(a=>a.id),['b1','a1','c1']); // nach Sitzung gruppiert
  const a1=job.articles.find(a=>a.id==='a1'),b1=job.articles.find(a=>a.id==='b1');
  assert.equal(a1.quickCheck,true);assert.equal(b1.quickCheck,undefined);
  assert.deepEqual(b1.sources.map(x=>x.role),['paper','minutes','session']);
  assert.equal(a1.sourceSignature,undefined);assert.equal(a1.events[0].description,undefined);assert.equal(a1.events[0].decision,undefined);
  assert.ok(JSON.parse(sql.prepare("SELECT payload FROM ai_job_articles WHERE topic_id='a1'").get().payload).sourceSignature);
  assert.deepEqual(job.sharedSources.map(x=>[x.url,x.role,x.articles]),[[minutes,'minutes',2],[s2,'session',2]]);
  assert.equal(job.quickChecks,1);
  const ok=await output(job);for(const a of ok.articles){const url=job.articles.find(x=>x.id===a.id).sources[0].url;a.sources[0].url=url;a.summary.evidence=[{url,quote:a.summary.evidence[0].quote}];}
  assert.equal((await applyAiResults(db,job,ok)).applied,3);
 }finally{sql.close();}
});
