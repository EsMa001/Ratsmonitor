// A14 of the code analysis: the import process drives the stored job like the admin page, in lanes, and shares it safely.
import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryDb} from './helpers/d1.mjs';
import {workJob,ensureJob,currentJob,openJob,catchUp,nightlyBusy,NIGHTLY_FRESH_MS} from '../server/integrations/pipeline-worker.mjs';
import {pipelineAction} from '../server/integrations/pipeline-jobs.mjs';

const regions=['billerbeck','coesfeld','nrw-05334002','nrw-05554004','nrw-05974004','nrw-05558004'];
const done={status:200,data:{topics:1,coverage:{complete:true,issues:[]}}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('without a job, with an ended job and with a paused job the worker does nothing',async()=>{
 const {sql,db}=memoryDb();
 assert.deepEqual(await workJob(db,()=>{throw Error('must not run');}),{state:'none',job:null,failures:0});
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:['billerbeck'],window:'1w'},()=>{});
 await pipelineAction(db,{action:'pause',id:job.id},()=>{});
 assert.equal((await workJob(db,()=>{throw Error('paused jobs are left alone');})).state,'paused');
 await pipelineAction(db,{action:'cancel',id:job.id},()=>{});
 assert.equal((await workJob(db,()=>{throw Error('ended')})).state,'ended');
 assert.equal(openJob(await currentJob(db)),false);sql.close();
});

test('the worker claims every area exactly once over its lanes and ends with the job',async()=>{
 const {sql,db}=memoryDb();
 const job=await pipelineAction(db,{action:'create',stage:'metadata',regions,window:'1w'},()=>{});
 const seen=[],active=new Set();let most=0;
 const run=async(stage,region,window)=>{assert.equal(stage,'metadata');assert.equal(window,'1w');seen.push(region);active.add(region);most=Math.max(most,active.size);await wait(60);active.delete(region);return done;};
 const logs=[];
 const result=await workJob(db,run,{lanes:4,log:j=>logs.push(j),tickMs:20});
 assert.equal(result.state,'completed');assert.equal(result.job.counts.completed,regions.length);
 assert.deepEqual([...seen].sort(),[...regions].sort());assert.ok(most>=2&&most<=4,'lanes work side by side: '+most);
 assert.ok(logs.length>=1,'progress was logged');assert.equal(logs.at(-1).id,job.id);
 sql.close();
});

test('two workers on the same job never import an area twice',async()=>{
 const {sql,db}=memoryDb();
 await pipelineAction(db,{action:'create',stage:'metadata',regions,window:'1w'},()=>{});
 const seen=[];
 const run=async(stage,region)=>{seen.push(region);await wait(30);return done;};
 const [a,b]=await Promise.all([workJob(db,run,{lanes:3}),workJob(db,run,{lanes:3})]);
 assert.equal(a.state,'completed');assert.equal(b.state,'completed');
 assert.deepEqual([...seen].sort(),[...regions].sort());sql.close();
});

test('a set-back area is waited for, a time limit stops the worker, a pause ends it',async()=>{
 const {sql,db}=memoryDb();
 const job=await pipelineAction(db,{action:'create',stage:'metadata',regions:['billerbeck','coesfeld'],window:'1w'},()=>{});
 const slept=[];
 // billerbeck is busy elsewhere (409): set back a minute; coesfeld imports. Then only a held area is left: the lane waits with heldUntil.
 let calls=0;
 const result=await workJob(db,async(stage,region)=>{calls++;return region==='billerbeck'?{status:409,data:{error:'Import läuft bereits',retryAfter:60,busy:'area'}}:done;},{lanes:2,sleep:async ms=>{slept.push(ms);},stop:()=>slept.length>=3});
 assert.equal(result.state,'stopped');assert.equal(calls,2);assert.ok(slept.length>=3);assert.ok(slept.every(ms=>ms>=2500&&ms<=30000),'waits follow heldUntil: '+slept);
 assert.equal(result.job.items.find(i=>i.region==='billerbeck').status,'queued');
 // A pause from the page ends the worker; the job keeps its areas.
 await pipelineAction(db,{action:'pause',id:job.id},()=>{});
 assert.equal((await workJob(db,()=>{throw Error('paused');})).state,'paused');sql.close();
});

test('ensureJob creates a job only while none is open; catchUp ends on an empty database',async()=>{
 const {sql,db}=memoryDb();
 const first=await ensureJob(db,{regions:['billerbeck','coesfeld'],window:'1d'});
 assert.equal(first.created,true);assert.equal(first.job.items.length,2);assert.equal(first.job.window,'1d');
 const again=await ensureJob(db,{regions:['billerbeck'],window:'1w'});
 assert.equal(again.created,false);assert.equal(again.job.id,first.job.id);
 await workJob(db,async()=>done,{lanes:2});
 const next=await ensureJob(db,{regions:['billerbeck'],window:'1w'});
 assert.equal(next.created,true);assert.notEqual(next.job.id,first.job.id);
 assert.ok((await catchUp(db,{maxSteps:5,budgetMs:200}))>=1);
 sql.close();
});

test('a lane that throws rests and goes on; lanes that keep failing give up and are reported',async()=>{
 const {sql,db}=memoryDb();
 await pipelineAction(db,{action:'create',stage:'metadata',regions,window:'1w'},()=>{});
 const warned=[];
 // The step throws when the lease cannot be taken (a lock held too long); here: the first attempt of every lane. (Failing
 // at the release of the lease would leave it behind for 30 s, which is not what a lock error does.)
 const original=db.prepare.bind(db);let fail=2;
 db.prepare=sql=>{if(fail>0&&sql.includes("VALUES('pipeline-lease'")){fail--;throw Error('D1_ERROR: database is locked');}return original(sql);};
 const result=await workJob(db,async()=>done,{lanes:2,sleep:async()=>{},warn:m=>warned.push(m)});
 assert.equal(result.state,'completed');assert.equal(result.failures,2);assert.equal(warned.length,2);assert.match(warned[0],/database is locked; weiter in 5 s/);
 // Nothing but failures: every lane gives up after its retries, the job stays as it is, the caller learns the count.
 const {sql:sql2,db:db2}=memoryDb();
 await pipelineAction(db2,{action:'create',stage:'metadata',regions:['billerbeck'],window:'1w'},()=>{});
 const original2=db2.prepare.bind(db2);db2.prepare=sql=>{if(sql.includes("VALUES('pipeline-lease'"))throw Error('D1_ERROR: database is locked');return original2(sql);};
 const warned2=[];const broken=await workJob(db2,async()=>done,{lanes:2,sleep:async()=>{},warn:m=>warned2.push(m)});
 assert.equal(broken.state,'stopped');assert.equal(broken.failures,10);assert.match(warned2.at(-1),/gibt auf/);assert.equal(broken.job.counts.queued,1,'the job is untouched');
 sql.close();sql2.close();
});

test('a job replaced by the page while the worker runs ends the worker with state replaced',async()=>{
 const {sql,db}=memoryDb();
 const job=await pipelineAction(db,{action:'create',stage:'metadata',regions,window:'1w'},()=>{});
 let calls=0;
 const run=async()=>{calls++;if(calls===2){const other={...JSON.parse(sql.prepare("SELECT value FROM system_state WHERE key='admin-pipeline-job'").get().value),id:'other-job'};sql.prepare("UPDATE system_state SET value=? WHERE key='admin-pipeline-job'").run(JSON.stringify(other));}await wait(20);return done;};
 const result=await workJob(db,run,{lanes:2,sleep:async()=>{}});
 assert.equal(result.state,'replaced');assert.equal(result.job.id,'other-job');assert.notEqual(result.job.id,job.id);sql.close();
});

test('ensureJob continues a fresh open job, but ends a paused or forgotten one for the nightly run',async()=>{
 const {sql,db}=memoryDb();
 const first=await ensureJob(db,{regions:['billerbeck'],window:'1d'});
 const paused=await pipelineAction(db,{action:'pause',id:first.job.id},()=>{});assert.equal(paused.paused,true);
 const second=await ensureJob(db,{regions:['coesfeld'],window:'1w'});
 assert.equal(second.created,true);assert.equal(second.replaced,true);assert.notEqual(second.job.id,first.job.id);assert.deepEqual(second.job.items.map(i=>i.region),['coesfeld']);
 // An open job that has not moved for six hours is given up on as well.
 const old={...JSON.parse(sql.prepare("SELECT value FROM system_state WHERE key='admin-pipeline-job'").get().value),updatedAt:new Date(Date.now()-7*3600000).toISOString()};
 sql.prepare("UPDATE system_state SET value=? WHERE key='admin-pipeline-job'").run(JSON.stringify(old));
 const third=await ensureJob(db,{regions:['billerbeck'],window:'1w'});assert.equal(third.replaced,true);
 // A fresh one is continued.
 const fourth=await ensureJob(db,{regions:['coesfeld'],window:'1w'});assert.equal(fourth.created,false);assert.equal(fourth.job.id,third.job.id);
 sql.close();
});

test('the command line is read strictly',async()=>{
 const {parseArgs}=await import('../server/integrations/pipeline-worker.mjs');
 assert.deepEqual(parseArgs([]),{create:null,direct:false,origin:'daily',regions:null,window:'1w',weeklyWindow:null,weeklyDay:0,lanes:24,maxMinutes:0,catchUp:true});
 assert.deepEqual(parseArgs(['--run','--max-minutes','240','--lanes','12','--no-catch-up']),{create:null,direct:false,origin:'daily',regions:null,window:'1w',weeklyWindow:null,weeklyDay:0,lanes:12,maxMinutes:240,catchUp:false});
 assert.equal(parseArgs(['--create']).create,'sources');assert.equal(parseArgs(['--create','all','--window','1d']).window,'1d');
 assert.deepEqual(parseArgs(['--create','--regions','a, b']).regions,['a','b']);
 for(const bad of [['--lanes','abc'],['--lanes','0'],['--window','x'],['--create','foo'],['--regions','a'],['--nope'],['--window']])assert.throws(()=>parseArgs(bad),bad.join(' '));
});

test('two connections on one file: a writer holds the lock, the other waits its busy timeout, then fails or proceeds',async()=>{
 const {openD1}=await import('../server/node/d1-sqlite.mjs');
 const fs=await import('node:fs');const path=await import('node:path');const os=await import('node:os');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rm-busy-')),file=path.join(dir,'t.sqlite');
 const a=openD1(file,{create:true,busyTimeoutMs:100}),b=openD1(file,{create:true,busyTimeoutMs:300});
 await a.prepare('CREATE TABLE t(x)').run();
 // a holds a write transaction (as a long batch would); b runs into its busy timeout and gets a D1 error, nothing hangs.
 await a.prepare('BEGIN IMMEDIATE').run();
 const t=Date.now();await assert.rejects(b.prepare('INSERT INTO t VALUES(1)').run(),/locked|busy/i);assert.ok(Date.now()-t>=250,'waited the busy timeout');
 await a.prepare('COMMIT').run();
 await b.prepare('INSERT INTO t VALUES(2)').run();assert.equal((await a.prepare('SELECT count(*) n FROM t').first()).n,1);
 a.close();b.close();fs.rmSync(dir,{recursive:true,force:true});
});

// Fehlerspeicher (Migration 0040, work-failures.mjs): Ausgänge der Importe, Rückstellung im Nachtauftrag, Direktabruf
import {deferredRegions,runDirect} from '../server/integrations/pipeline-worker.mjs';
import {provider,partialCause} from '../server/integrations/pipeline-jobs.mjs';
import {recordFailure} from '../server/integrations/work-failures.mjs';
test('import outcomes go to the failure store; the nightly job defers waiting areas; --direct retries them',async()=>{
 const {sql,db}=memoryDb();
 const [a,b,c]=regions;
 const outcome={[a]:{status:502,data:{error:'Import fehlgeschlagen',cause:'fetch failed'}},[b]:{status:200,data:{topics:0,refused:{retryAfterMs:7200000},coverage:{complete:false,issues:[]}}},[c]:done};
 const job=await pipelineAction(db,{action:'create',stage:'metadata',regions:[a,b,c],window:'1w'},()=>{});
 const t0=Date.now();await workJob(db,async(stage,region)=>outcome[region],{lanes:2,sleep:()=>wait(5),tickMs:1e6,stop:()=>Date.now()-t0>400});
 const rows=Object.fromEntries(sql.prepare("SELECT key,class,host FROM work_failures WHERE step='import'").all().map(r=>[r.key,r]));
 assert.equal(rows[a].class,'transient');assert.equal(rows[b].class,'blocked');assert.equal(rows[b].host,provider(b));
 assert.equal(rows[c],undefined);
 assert.equal(sql.prepare('SELECT state FROM source_hosts WHERE host=?').get(provider(b)).state,'bremsen');
 // next night: both are deferred, the third is queued
 await pipelineAction(db,{action:'cancel',id:job.id},()=>{});
 const deferred=await deferredRegions(db,[a,b,c]);
 assert.deepEqual(Object.keys(deferred).sort(),[a,b].sort());
 const made=await ensureJob(db,{regions:[a,b,c],window:'1w'});
 assert.equal(made.deferred,2);
 assert.deepEqual(made.job.items.map(i=>i.status).sort(),['deferred','deferred','queued']);
 // a final entry (internal) does not hold the nightly run off: the night is the retry
 await recordFailure(db,{step:'import',key:c,cls:'internal',error:'TypeError',release:'r'},Date.now());
 assert.deepEqual(Object.keys(await deferredRegions(db,[c])),[],'kein Termin: nicht zurückgestellt');
 // the nacharbeit retries a directly; success clears its entry
 const out=await runDirect(db,async()=>done,[a],{lanes:1});
 assert.deepEqual(out.map(r=>[r.region,r.status]),[[a,200]]);
 assert.equal(sql.prepare("SELECT count(*) n FROM work_failures WHERE key=?").get(a).n,0);
 sql.close();
});
test('weekly window: Sundays wider, otherwise the daily window',async()=>{
 const {parseArgs,windowForTonight}=await import('../server/integrations/pipeline-worker.mjs');
 const o=parseArgs(['--create','sources','--window','1d','--weekly-window','1m']);
 assert.equal(o.weeklyWindow,'1m');assert.equal(o.weeklyDay,0);
 assert.equal(windowForTonight(o,new Date('2026-10-18T00:30:00Z')),'1m','Sonntag 02:30 deutscher Zeit');
 assert.equal(windowForTonight(o,new Date('2026-10-19T00:30:00Z')),'1d','Montag');
 assert.equal(windowForTonight(parseArgs(['--create','sources','--window','1d']),new Date('2026-10-18T00:30:00Z')),'1d','ohne weiteres Fenster');
 assert.throws(()=>parseArgs(['--weekly-window','1d']),/--weekly-window/);
});

test('--direct is read strictly',async()=>{
 const {parseArgs}=await import('../server/integrations/pipeline-worker.mjs');
 assert.throws(()=>parseArgs(['--direct']),/--direct braucht --regions/);
 assert.throws(()=>parseArgs(['--direct','--create','sources','--regions','billerbeck']),/--direct/);
 assert.deepEqual(parseArgs(['--direct','--regions','billerbeck,coesfeld','--origin','backlog']).regions,['billerbeck','coesfeld']);
 assert.throws(()=>parseArgs(['--regions','billerbeck']),/--regions nur mit/);
});

test('Nachtauftrag (owner nightly): der Job „Abrufaufträge“ lässt ihn aus, solange er sich bewegt; ein stehender wird übernommen',async()=>{
 const {sql,db}=memoryDb();
 const made=await ensureJob(db,{regions:['billerbeck','coesfeld'],window:'1d',owner:'nightly'});
 assert.equal(made.job.owner,'nightly');
 const stored=await currentJob(db);
 assert.equal(stored.owner,'nightly','im Auftrag gespeichert');
 const now=Date.parse(stored.updatedAt);
 assert.equal(nightlyBusy(stored,now+60000),true);
 assert.equal(nightlyBusy(stored,now+NIGHTLY_FRESH_MS+1),false,'nach 10 Minuten ohne Bewegung hilft der Job');
 assert.equal(nightlyBusy({...stored,owner:undefined},now+60000),false,'Aufträge der Seite wie bisher');
 await workJob(db,async()=>done,{lanes:2});
 assert.equal(nightlyBusy(await currentJob(db),now+60000),false,'fertig: nichts mehr zu schützen');
 const plain=await ensureJob(db,{regions:['billerbeck'],window:'1w'});
 assert.equal(plain.job.owner,undefined);
 sql.close();
});

test('teilweise mit Netzfehler: vermerkt für die Nacharbeit, ohne Server-Bremse, Nachtlauf nicht zurückgestellt; vollständig löscht',async()=>{
 const {sql,db}=memoryDb();
 const [a,b,c]=regions;
 const partial=issues=>({status:200,data:{topics:3,coverage:{complete:false,issues}}});
 const outcome={[a]:partial(['Kalender 11/2026: fetch failed','Noch keine Artikel erfolgreich erfasst.']),[b]:partial(['Sitzungsliste 12/2026: Quelle antwortet mit HTTP 403']),[c]:partial(['Teilnahmeangaben: Quelle antwortet mit HTTP 500'])};
 await pipelineAction(db,{action:'create',stage:'metadata',regions:[a,b,c],window:'1w'},()=>{});
 const t0=Date.now();await workJob(db,async(stage,region)=>outcome[region],{lanes:2,sleep:()=>wait(5),tickMs:1e6,stop:()=>Date.now()-t0>400});
 const rows=Object.fromEntries(sql.prepare("SELECT key,class,host,reason,next_try_at FROM work_failures WHERE step='import'").all().map(r=>[r.key,r]));
 assert.equal(rows[a].class,'transient');assert.equal(rows[a].host,null,'keine Server-Bremse');assert.match(rows[a].reason,/^teilweise: Kalender 11\/2026: fetch failed/);
 assert.ok(Date.parse(rows[a].next_try_at)>=Date.now()+864e5-60000,'Termin für die Nacharbeit frühestens in einem Tag');
 assert.equal(rows[b],undefined,'gesperrter künftiger Monat ist kein Netzfehler');
 assert.match(rows[c].reason,/HTTP 500/);
 assert.equal(sql.prepare('SELECT count(*) n FROM source_hosts').get().n,0);
 assert.deepEqual(Object.keys(await deferredRegions(db,[a,b,c])),[],'der Nachtlauf ruft sie trotzdem ab');
 // die Nacharbeit holt a vollständig: Eintrag weg
 await runDirect(db,async()=>done,[a],{lanes:1});
 assert.equal(sql.prepare("SELECT count(*) n FROM work_failures WHERE key=?").get(a).n,0);
 assert.equal(partialCause({coverage:{complete:true,issues:['fetch failed']}}),null);
 assert.equal(partialCause({attemptComplete:true,coverage:{complete:false,issues:['fetch failed']}}),null,'Versuch vollständig');
 sql.close();
});
