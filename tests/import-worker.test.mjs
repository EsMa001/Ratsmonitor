// A14 of the code analysis: the import process drives the stored job like the admin page, in lanes, and shares it safely.
import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryDb} from './helpers/d1.mjs';
import {workJob,ensureJob,currentJob,openJob,catchUp} from '../server/integrations/pipeline-worker.mjs';
import {pipelineAction} from '../server/integrations/pipeline-jobs.mjs';

const regions=['billerbeck','coesfeld','nrw-05334002','nrw-05554004','nrw-05974004','nrw-05558004'];
const done={status:200,data:{topics:1,coverage:{complete:true,issues:[]}}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('without a job, with an ended job and with a paused job the worker does nothing',async()=>{
 const {sql,db}=memoryDb();
 assert.deepEqual(await workJob(db,()=>{throw Error('must not run');}),{state:'none',job:null});
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
