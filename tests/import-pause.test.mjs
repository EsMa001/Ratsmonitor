// Paket 2 der Code-Analyse: ein Server, der abweist (HTTP 429), wird pausiert statt erneut gefragt; ein belegtes Gebiet
// wird zurückgestellt statt den ganzen Auftrag anzuhalten; die OParl-Sonde wird gemerkt (pipeline-jobs.mjs,
// request-budget.mjs, collect-region.mjs).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {pipelineAction,provider,serverLimit,PER_PROVIDER} from '../server/integrations/pipeline-jobs.mjs';
import {budgeted,refusalGate,retryAfterMs,statusError,isRefusal,BUDGET_REACHED,REFUSED} from '../server/integrations/request-budget.mjs';
import {collectRegion,PROBE_DAYS} from '../server/integrations/collect-region.mjs';
function fixture(){const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));return {sql,db:sqliteAdapter(sql)};}
const stored=sql=>JSON.parse(sql.prepare("SELECT value FROM system_state WHERE key='admin-pipeline-job'").get().value);
// Time passes: every pause and every set-back area of the stored job is over.
function rewind(sql){const job=stored(sql),past=new Date(Date.now()-1000).toISOString();for(const s of Object.keys(job.holds||{}))job.holds[s]=past;for(const i of job.items)if(i.notBefore)i.notBefore=past;sql.prepare("UPDATE system_state SET value=? WHERE key='admin-pipeline-job'").run(JSON.stringify(job));}
// Three areas of one server (owl-it.de) and one of its own.
const [a,b,c]=['nrw-05554004','nrw-05974004','nrw-05558004'],other='billerbeck';
const done={status:200,data:{topics:2,coverage:{complete:true,issues:[]}}};

test('the areas used here: three on one server, one on its own',()=>{
 assert.equal(new Set([a,b,c].map(provider)).size,1);assert.notEqual(provider(other),provider(a));
 assert.equal(serverLimit(provider(a)),PER_PROVIDER,'no server is read more than twice at a time unless the owner decides so');
});

test('a server that refuses rests for its Retry-After; its areas follow afterwards, the others go on meanwhile',async()=>{
 const {sql,db}=fixture();
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[a,b,other],window:'1w'},()=>{});
 const asked=[];
 const refusing=async(stage,region)=>{asked.push(region);return region===a?{status:200,data:{topics:3,coverage:{complete:false,issues:[]},resume:true,refused:{retryAfterMs:120000}}}:done;};
 // The server with the most open areas comes first: a refuses, so b (same server) waits; the other area is read.
 job=await pipelineAction(db,{action:'run',id:job.id,lanes:1},refusing);
 assert.deepEqual(asked,[a,other]);assert.equal(job.paused,undefined);
 const first=job.items.find(i=>i.region===a),until=Date.parse(stored(sql).holds[provider(a)]);
 assert.equal(first.status,'queued');assert.equal(first.refusals,1);assert.equal(first.processed,3,'what the import stored counts');assert.match(first.message,/bittet um eine Pause \(HTTP 429\); der Abruf wird ab \d\d:\d\d fortgesetzt/);
 assert.ok(until>Date.now()+110000&&until<Date.now()+125000,'the pause follows Retry-After');
 assert.equal(job.items.find(i=>i.region===b).status,'queued');
 // Only areas of the resting server are left: the page is told when to ask again.
 job=await pipelineAction(db,{action:'run',id:job.id,lanes:2},()=>{throw Error('a resting server is not asked');});
 assert.equal(job.wait,true);assert.equal(Date.parse(job.heldUntil),until);assert.equal(job.holds?.[provider(a)]!==undefined,true);
 // Afterwards both areas are read; the pause is dropped from the stored job.
 rewind(sql);asked.length=0;
 job=await pipelineAction(db,{action:'run',id:job.id,lanes:2},async(stage,region)=>{asked.push(region);return done;});
 assert.deepEqual(asked.sort(),[a,b].sort());assert.equal(job.status,'completed');assert.equal(stored(sql).holds,undefined);
 assert.equal(job.items.find(i=>i.region===a).processed,5);sql.close();
});

test('pauses stay within bounds, a failed import that was refused is taken up again, and not without end',async()=>{
 const {sql,db}=fixture(),hold=()=>Date.parse(stored(sql).holds[provider(a)])-Date.now();
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[a],window:'1w'},()=>{});
 // Without Retry-After five minutes; a tiny one at least a minute; a huge one at most an hour.
 for(const [wanted,low,high] of [[null,290000,301000],[1000,55000,61000],[86400000,3590000,3601000]]){
  job=await pipelineAction(db,{action:'step',id:job.id},async()=>({status:502,data:{error:'Import fehlgeschlagen',cause:'Quelle antwortet mit HTTP 429',refused:{retryAfterMs:wanted}}}));
  const ms=hold();assert.ok(ms>low&&ms<high,`pause ${ms} for ${wanted}`);assert.equal(job.items[0].status,'queued');rewind(sql);
  // A later, shorter pause never shortens a running one: dropped here by rewind, so each round starts fresh.
  const s=stored(sql);delete s.holds;sql.prepare("UPDATE system_state SET value=? WHERE key='admin-pipeline-job'").run(JSON.stringify(s));
 }
 // The fourth refusal ends the area like any failure, with its cause.
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>({status:502,data:{error:'Import fehlgeschlagen',cause:'Quelle antwortet mit HTTP 429',refused:{retryAfterMs:null}}}));
 assert.equal(job.items[0].status,'failed');assert.equal(job.items[0].refusals,4);assert.match(job.items[0].message,/4-mal um eine Pause.*Ursache: Quelle antwortet mit HTTP 429/);assert.equal(job.status,'completed');sql.close();
});

test('an area busy elsewhere is set back a few times, then given up; a stock held by something else holds the whole job',async()=>{
 const {sql,db}=fixture();
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[other],window:'1w'},()=>{});
 for(let n=1;n<=5;n++){job=await pipelineAction(db,{action:'step',id:job.id},async()=>({status:409,data:{error:'Import läuft bereits',retryAfter:60,busy:'area'}}));assert.equal(job.items[0].status,'queued');assert.equal(job.items[0].busy,n);assert.equal(job.paused,undefined);rewind(sql);}
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>({status:409,data:{error:'Import läuft bereits',retryAfter:60,busy:'area'}}));
 assert.equal(job.items[0].status,'failed');assert.match(job.items[0].message,/nach 5 Versuchen zurückgestellt/);
 // The whole stock is held (AI results being stored): no area is taken for a minute, nothing is counted against the area.
 job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[a,other],window:'1w'},()=>{});
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>({status:409,data:{error:'Import läuft bereits',retryAfter:60,busy:'stock'}}));
 const waiting=job.items.find(i=>i.message);assert.equal(waiting.status,'queued');assert.equal(waiting.busy,undefined);assert.match(waiting.message,/der Auftrag wartet bis/);
 job=await pipelineAction(db,{action:'step',id:job.id},()=>{throw Error('the job waits as a whole');});assert.equal(job.wait,true);assert.ok(Date.parse(job.heldUntil)>Date.now()+50000);
 rewind(sql);job=await pipelineAction(db,{action:'run',id:job.id,lanes:2},async()=>done);assert.equal(job.status,'completed');assert.equal(job.counts.completed,2);sql.close();
});

test('an exception of an import is kept as the cause of the interruption',async()=>{
 const {sql,db}=fixture(),log=console.error;console.error=()=>{};
 try{
  let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[other],window:'1w'},()=>{});
  job=await pipelineAction(db,{action:'step',id:job.id},async()=>{throw Error('database is locked');});
  assert.equal(job.items[0].status,'unknown');assert.match(job.items[0].message,/Ausführung unterbrochen\..*Ursache: database is locked/);
 }finally{console.error=log;sql.close();}
});

test('429 is not repeated; Retry-After is read in seconds and as a date',async()=>{
 let calls=0;
 const get=budgeted(async()=>{calls++;throw Error('Quelle antwortet mit HTTP 429');},60000,1,{pauseMs:5});
 await assert.rejects(get('x'),/HTTP 429/);assert.equal(calls,1);
 calls=0;const page=budgeted(async()=>{calls++;throw Error(REFUSED);},60000,1,{pauseMs:5});await assert.rejects(page('x'));assert.equal(calls,1,'a rejection page is not repeated either');
 assert.equal(retryAfterMs('120'),120000);assert.equal(retryAfterMs(''),null);assert.equal(retryAfterMs('soon'),null);
 const now=Date.parse('2026-10-10T12:00:00Z');assert.equal(retryAfterMs('Sat, 10 Oct 2026 12:02:00 GMT',now),120000);assert.equal(retryAfterMs('Sat, 10 Oct 2026 11:00:00 GMT',now),0);
 const e=statusError('Quelle antwortet mit HTTP ',new Response('',{status:429,headers:{'retry-after':'30'}}));assert.equal(e.message,'Quelle antwortet mit HTTP 429');assert.equal(e.retryAfterMs,30000);assert.ok(isRefusal(e));
 assert.equal(statusError('x',new Response('',{status:404})).retryAfterMs,undefined);assert.equal(isRefusal(Error('HTTP 4290')),false);
});

test('after the first refusal no further request of the import reaches the source',async()=>{
 const gate=refusalGate(),asked=[];
 const get=gate.wrap(async url=>{asked.push(url);if(url==='b')throw Object.assign(Error('Quelle antwortet mit HTTP 429'),{retryAfterMs:90000});return 'ok';});
 assert.equal(await get('a'),'ok');await assert.rejects(get('b'),/HTTP 429/);await assert.rejects(get('c'),e=>e.message===BUDGET_REACHED);
 assert.deepEqual(asked,['a','b']);assert.deepEqual(gate.refused,{retryAfterMs:90000});
 // Other failures leave the gate open.
 const open=refusalGate();await assert.rejects(open.wrap(async()=>{throw Error('Quelle antwortet mit HTTP 404');})('x'));assert.equal(open.refused,null);
});

// A SessionNet source without a recorded OParl check; requests go to a stand-in for fetch.
async function collectWith(answer,options={}){
 const real=globalThis.fetch,asked=[];
 globalThis.fetch=async(url)=>{asked.push(String(url));return answer(String(url));};
 try{return {result:await collectRegion('nrw-05158008',{window:'1d',maxDurationMs:5000,...options}),asked};}
 finally{globalThis.fetch=real;}
}
const oparl=asked=>asked.filter(u=>/oparl/i.test(u)).length;

test('a negative OParl probe is remembered for thirty days; an unclear one is not',async()=>{
 const missing=()=>new Response('nicht gefunden',{status:404});
 const first=await collectWith(missing);
 assert.equal(oparl(first.asked),1);const probe=first.result.coverage.oparlProbeAt;assert.ok(Date.now()-Date.parse(probe)<5000);assert.equal(first.result.coverage.apiCheckedAt,probe);
 // Within thirty days the probe is not sent; the source status names when it was.
 const again=await collectWith(missing,{oparlProbeAt:probe});assert.equal(oparl(again.asked),0);assert.equal(again.result.coverage.oparlProbeAt,probe);assert.equal(again.result.coverage.apiCheckedAt,probe);
 const old=new Date(Date.now()-(PROBE_DAYS+1)*864e5).toISOString();
 const expired=await collectWith(missing,{oparlProbeAt:old});assert.equal(oparl(expired.asked),1);assert.notEqual(expired.result.coverage.oparlProbeAt,old);
 // No answer at all: asked again next time.
 const silent=await collectWith(()=>{throw new TypeError('fetch failed');});assert.equal(oparl(silent.asked),1);assert.equal(silent.result.coverage.oparlProbeAt,undefined);
 // An OParl system stops the scraper, as before.
 await assert.rejects(collectWith(url=>/oparl/i.test(url)?Response.json({type:'https://schema.oparl.org/1.0/System'}):missing()),/Adapterfreigabe/);
});

test('a source that answers 429 is asked once in the import; the refusal and its Retry-After are reported',async()=>{
 const {result,asked}=await collectWith(()=>new Response('',{status:429,headers:{'retry-after':'120'}}));
 assert.equal(asked.length,1,'the probe was refused; nothing further was asked');assert.deepEqual(result.refused,{retryAfterMs:120000});
 assert.equal(result.coverage.oparlProbeAt,undefined,'a refused probe is no negative probe');
});

test('a fourth refusal still rests the server, then ends the area with what was stored',async()=>{
 const {sql,db}=fixture();
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[a,other],window:'1w'},()=>{});
 const partly=async(stage,region)=>region===a?{status:200,data:{topics:1,coverage:{complete:false,issues:[]},resume:true,refused:{retryAfterMs:3600000}}}:done;
 for(let n=1;n<=3;n++){job=await pipelineAction(db,{action:'step',id:job.id},partly);assert.equal(job.items.find(i=>i.region===a).status,'queued');rewind(sql);}
 // The other area is read meanwhile; a's fourth refusal: the server rests again (its areas would otherwise be read at
 // once, the import brought resume:true), a ends as partial.
 job=await pipelineAction(db,{action:'run',id:job.id,lanes:2},partly);
 const first=job.items.find(i=>i.region===a);assert.equal(first.status,'partial');assert.equal(first.refusals,4);assert.equal(first.processed,4);assert.match(first.message,/4-mal um eine Pause/);
 assert.ok(Date.parse(stored(sql).holds?.[provider(a)]||0)>Date.now()+3500000,'the server still rests');assert.equal(job.status,'completed');sql.close();
});

test('after the gate closed, a paced reader does not wait between the requests it cannot send any more',async()=>{
 const {paced}=await import('../server/integrations/request-budget.mjs');
 const gate=refusalGate();let sent=0;
 const get=paced(gate.wrap(async url=>{sent++;if(url==='refused')throw Error(REFUSED);return 'ok';}),{spacingMs:400});
 await get('a');await assert.rejects(get('refused'));
 const began=Date.now();for(let i=0;i<20;i++)await assert.rejects(get('x'+i),e=>e.message===BUDGET_REACHED);
 assert.ok(Date.now()-began<1500,'only the first call after the refusal waits');assert.equal(sent,2);
});

// An ALLRIS source (the reader probes the system's own OParl address itself).
async function collectAllrisWith(answer,options={}){
 const real=globalThis.fetch,asked=[];
 globalThis.fetch=async(url)=>{asked.push(String(url));return answer(String(url));};
 try{return {result:await collectRegion('nrw-05117000',{window:'1d',maxDurationMs:5000,...options}),asked};}
 catch(e){e.asked=asked;throw e;}
 finally{globalThis.fetch=real;}
}
test('an unclear ALLRIS probe (refused, no answer) is not remembered; a clear one is',async()=>{
 const empty=()=>new Response('<html><body></body></html>',{status:200,headers:{'content-type':'text/html'}});
 // Refused at the probe: the import ends there, nothing is remembered.
 const refused=await collectAllrisWith(()=>new Response('',{status:429,headers:{'retry-after':'60'}})).catch(e=>e);
 const coverage=refused.result?.coverage||refused.coverage;assert.ok(refused.result?.refused||refused.refused,'the refusal is reported');
 assert.equal(coverage?.oparlProbeAt,undefined);
 // A clear 404: remembered.
 const clear=await collectAllrisWith(url=>/oparl/i.test(url)?new Response('x',{status:404}):empty());
 assert.ok(clear.result.coverage.oparlProbeAt);assert.equal(clear.asked.filter(u=>/oparl/i.test(u)).length,1);
 const again=await collectAllrisWith(empty,{oparlProbeAt:clear.result.coverage.oparlProbeAt});assert.equal(again.asked.filter(u=>/oparl/i.test(u)).length,0);
 // An OParl system stops the reader, as before.
 await assert.rejects(collectAllrisWith(url=>/oparl/i.test(url)?Response.json({type:'https://schema.oparl.org/1.0/System'}):empty()),/Adapterfreigabe/);
});
