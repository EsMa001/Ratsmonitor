import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {pipelineAction,selectedRegions,canImport,provider,PARALLEL,PER_PROVIDER} from '../server/integrations/pipeline-jobs.mjs';
import {createAiJob,applyAiResults,cancelAiJob,getAiJob} from '../server/integrations/ai-jobs.mjs';
import {processingStatus} from '../server/integrations/processing-status.mjs';
import {keywordWeights,articleResult,AI_METHOD,LEGACY_AI_METHOD,sourceRole,needsQuickCheck} from '../shared/ai-job.mjs';
import {hashText} from '../shared/database-transfer.mjs';
import {preserveArticleContent,analysisSignature} from '../shared/article-record.mjs';
import {compactOparl,publicParticipants} from '../server/integrations/source-fields.mjs';
function fixture(){const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));const db=sqliteAdapter(sql);const put=(id,region='billerbeck',extra={})=>{const t={id,regionId:region,title:'Schulbau',officialTitle:'Schulbau',status:'consulting',sourceUrl:'https://example.org/paper',documents:[],events:[],classification:{primary:'bildung',method:'title-rules-v2',version:'labels-v2',evidence:'Schulbau'},labelAssessments:{rule:{primary:'bildung',method:'rules'}},metadata:{firstImportedAt:'2026-09-01'},...extra};sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,region,'city','2026-09-27','2026-09-27','consulting',JSON.stringify(t));return t;};return {sql,db,put};}
const checks=['source_read','process','numbers','neutrality'].map(name=>({name,passed:true}));
async function output(job){const quote='Im Rat wird der Schulneubau beraten.',url='https://example.org/paper',e={url,quote};return {format:'ratsmonitor-ai-results-v1',jobId:job.id,articles:job.articles.map(a=>({id:a.id,expectedPayloadHash:a.payloadHash,agent:'Example Agent',model:'test-model',sources:[{url,hash:'a'.repeat(64),fetchedAt:'2026-09-27T19:00:00Z',excerpts:[quote]}],summary:{status:'completed',shortSummary:quote,longSummary:[quote],evidence:[e],checks},aiLabel:{status:'completed',primary:'bildung',secondary:[],reason:'Schulneubau',evidence:[e],checks},keywords:{status:'completed',items:Array.from({length:10},(_,i)=>({term:'Begriff '+i,score:1+i%5,reason:'Testbegründung',evidence:e})),evidence:[e],checks}}))};}

test('selection validates IDs, distinguishes districts, and covers the complete catalogue of NRW and Niedersachsen',()=>{assert.equal(selectedRegions('all').length,427+440);assert.ok(selectedRegions(['nds-033585401']).length===1);assert.deepEqual(selectedRegions(['billerbeck','billerbeck','coesfeld']),['billerbeck','coesfeld']);assert.throws(()=>selectedRegions(['x\' OR 1=1']));assert.throws(()=>selectedRegions([]));assert.equal(canImport('billerbeck'),true);});
test('persistent queue handles partial sources, unavailable territory, cancellation and interrupted steps without replay',async()=>{
 const {sql,db}=fixture();const unavailable=selectedRegions('all').find(id=>!canImport(id));let calls=0;
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:['billerbeck',unavailable]},()=>{throw Error('must not run');});assert.equal(job.items[1].status,'unavailable');assert.equal(calls,0);
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>{calls++;return {status:200,data:{topics:5,coverage:{complete:false,issues:['Zeitlimit']}}};});assert.equal(job.status,'completed');assert.equal(job.items[0].status,'partial');assert.equal(calls,1);
 await pipelineAction(db,{action:'step',id:job.id},()=>{throw Error('duplicate');});
 job=await pipelineAction(db,{action:'create',stage:'analysis',regions:['billerbeck']},()=>{});
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>({status:200,data:{processed:500,remaining:1}}));assert.equal(job.status,'queued');
 job.items[0].status='running';await db.prepare("UPDATE system_state SET value=? WHERE key='admin-pipeline-job'").bind(JSON.stringify(job)).run();
 job=await pipelineAction(db,{action:'step',id:job.id},()=>{throw Error('must not replay');});assert.equal(job.items[0].status,'unknown');
 job=await pipelineAction(db,{action:'create',stage:'analysis',regions:['billerbeck']},()=>{});job=await pipelineAction(db,{action:'cancel',id:job.id},()=>{});assert.equal(job.status,'cancelled');sql.close();
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
// Four areas of one operator and six of six other operators, all with a connected source.
function parallelAreas(){
 const groups=new Map();for(const id of selectedRegions('all').filter(canImport))groups.set(provider(id),[...(groups.get(provider(id))||[]),id]);
 const shared=[...groups.values()].find(ids=>ids.length>=4).slice(0,4),single=[...groups.values()].filter(ids=>ids[0]!==shared[0]).map(ids=>ids[0]).slice(0,6);
 return {shared,single};
}
const wait=ms=>new Promise(done=>setTimeout(done,ms));
const stored=sql=>JSON.parse(sql.prepare("SELECT value FROM system_state WHERE key='admin-pipeline-job'").get().value);
const done={status:200,data:{topics:1,coverage:{complete:true,issues:[]}}};
test('import steps run side by side: at most six, at most two of one operator, every area exactly once',async()=>{
 const {sql,db}=fixture(),{shared,single}=parallelAreas();
 assert.equal(new Set(shared.map(provider)).size,1);assert.equal(new Set([...shared,...single].map(provider)).size,7);assert.equal(PARALLEL.metadata,6);assert.equal(PARALLEL.analysis,1);assert.equal(PER_PROVIDER,2);
 const job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[...shared,...single],window:'1w'},()=>{});
 const active=new Set(),seen=[];let most=0,mostShared=0;
 const run=async(stage,region,window)=>{
  assert.equal(stage,'metadata');assert.equal(window,'1w');
  active.add(region);most=Math.max(most,active.size);mostShared=Math.max(mostShared,[...active].filter(other=>provider(other)===provider(shared[0])).length);
  // Long enough for six callers to get their turn at the stored job while the first imports still run.
  seen.push(region);await wait(350);active.delete(region);
  return {status:200,data:{topics:2,coverage:{complete:true,issues:[]}}};
 };
 // Nine callers, more than the server allows: the surplus is told to wait and asks again.
 let waits=0;
 const worker=async()=>{for(;;){const state=await pipelineAction(db,{action:'step',id:job.id},run);if(state.status==='completed')return state;if(state.wait){waits++;await wait(4);}}};
 const finished=await Promise.all(Array.from({length:9},worker));
 assert.equal(most,6);assert.equal(mostShared,2,'two of one operator at once, never three');assert.ok(waits>0);assert.equal(seen.length,10);assert.equal(new Set(seen).size,10,'no area is imported twice');
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
