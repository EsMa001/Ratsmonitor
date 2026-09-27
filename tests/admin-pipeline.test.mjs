import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/claude-job.mjs';
import {pipelineAction,selectedRegions,canImport} from '../server/integrations/pipeline-jobs.mjs';
import {createAiJob,applyAiResults,cancelAiJob,getAiJob} from '../server/integrations/ai-jobs.mjs';
import {processingStatus} from '../server/integrations/processing-status.mjs';
import {keywordWeights} from '../shared/ai-job.mjs';
import {hashText} from '../shared/database-transfer.mjs';
import {preserveArticleContent} from '../shared/article-record.mjs';
import {compactOparl,publicParticipants} from '../server/integrations/source-fields.mjs';
function fixture(){const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));const db=sqliteAdapter(sql);const put=(id,region='billerbeck',extra={})=>{const t={id,regionId:region,title:'Schulbau',officialTitle:'Schulbau',status:'consulting',sourceUrl:'https://example.org/paper',documents:[],events:[],classification:{primary:'bildung',method:'title-rules-v2',version:'labels-v2',evidence:'Schulbau'},labelAssessments:{rule:{primary:'bildung',method:'rules'}},metadata:{firstImportedAt:'2026-09-01'},...extra};sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,region,'city','2026-09-27','2026-09-27','consulting',JSON.stringify(t));return t;};return {sql,db,put};}
const checks=['source_read','process','numbers','neutrality'].map(name=>({name,passed:true}));
async function output(job){const quote='Im Rat wird der Schulneubau beraten.',url='https://example.org/paper',e={url,quote};return {format:'ratsmonitor-ai-results-v1',jobId:job.id,articles:job.articles.map(a=>({id:a.id,expectedPayloadHash:a.payloadHash,model:'test-model',sources:[{url,hash:'a'.repeat(64),fetchedAt:'2026-09-27T19:00:00Z',excerpts:[quote]}],summary:{status:'completed',shortSummary:quote,longSummary:[quote],evidence:[e],checks},aiLabel:{status:'completed',primary:'bildung',secondary:[],reason:'Schulneubau',evidence:[e],checks},keywords:{status:'completed',items:Array.from({length:10},(_,i)=>({term:'Begriff '+i,score:1+i%5,reason:'Testbegründung',evidence:e})),evidence:[e],checks}}))};}

test('selection validates IDs, distinguishes districts, and covers the complete NRW catalogue',()=>{assert.equal(selectedRegions('all').length,427);assert.deepEqual(selectedRegions(['billerbeck','billerbeck','coesfeld']),['billerbeck','coesfeld']);assert.throws(()=>selectedRegions(['x\' OR 1=1']));assert.throws(()=>selectedRegions([]));assert.equal(canImport('billerbeck'),true);});
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
 result=await output(job);result.articles[0].summary.evidence[0]={url:'https://evil.example',quote:'not read'};await assert.rejects(applyAiResults(db,job,result),/Beleg/);
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
