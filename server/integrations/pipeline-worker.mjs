import {pipelineAction} from './pipeline-jobs.mjs';
import {refreshStep} from './admin-refresh.mjs';
/**
 * Drives the stored import job of the administration from a process of its own (server/node/import-worker.mjs, A14 of
 * the code analysis): the same steps the admin page asks for over /api/admin/pipeline, only in parallel lanes inside
 * one process. Job, locks and progress live in the database, so the page shows the run as it does today, and a browser
 * driving the same job at the same time only shares the work (every area is claimed once, pipeline-jobs.mjs).
 */
const JOB_KEY='admin-pipeline-job';
const pause=ms=>new Promise(done=>setTimeout(done,ms));
/** The stored job, or null. */
export async function currentJob(db){
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(JOB_KEY).first();
 return row?JSON.parse(row.value):null;
}
/** Whether a job still has areas to claim or running. */
export const openJob=job=>!!job&&!['completed','cancelled'].includes(job.status)&&job.items.some(i=>i.status==='queued'||i.status==='running');
/**
 * Creates a metadata job (regions: 'sources', 'all' or a list of ids) unless one is still open; then that one is
 * returned. Returns {job, created}.
 */
export async function ensureJob(db,{regions='sources',window='1w'}={}){
 const existing=await currentJob(db);
 if(openJob(existing))return {job:existing,created:false};
 const job=await pipelineAction(db,{action:'create',stage:'metadata',regions,window,replace:true},()=>{throw Error('create runs nothing');});
 return {job,created:true};
}
/**
 * Works the open job to its end: `lanes` loops, each claiming one area after the other (action 'step'), waiting when
 * nothing can be claimed (wait, heldUntil). Ends when the job is completed, cancelled or paused, or when `stop()` says
 * so (a time limit). Returns {state: 'none'|'ended'|'paused'|'completed'|'cancelled'|'stopped', job}.
 * `log(job)` is called once a minute with the latest view; `run` is the import function as the route passes it.
 */
export async function workJob(db,run,{lanes=24,sleep=pause,log=()=>{},stop=()=>false,tickMs=60000}={}){
 const job=await currentJob(db);
 if(!openJob(job))return {state:job?'ended':'none',job};
 if(job.paused)return {state:'paused',job};
 let latest=job,finished=false;
 const lane=async()=>{
  while(!finished&&!stop()){
   let next;
   try{next=await pipelineAction(db,{action:'step',id:job.id},run);}
   catch(e){
    // The stored job was taken by another step for too long (lease): wait like a lane that found nothing.
    if(/Warteschlangenschritt läuft bereits/.test(String(e?.message)))
     {await sleep(2500);continue;}
    throw e;
   }
   if((next.updatedAt||'')>=(latest.updatedAt||''))latest=next;
   if(['completed','cancelled'].includes(next.status)||next.paused){finished=true;break;}
   if(next.wait)await sleep(next.heldUntil?Math.min(30000,Math.max(2500,Date.parse(next.heldUntil)-Date.now())):2500);
  }
 };
 const ticker=setInterval(()=>log(latest),tickMs);
 try{
  const outcomes=await Promise.allSettled(Array.from({length:Math.max(1,lanes)},lane));
  const failed=outcomes.find(o=>o.status==='rejected');
  if(failed&&outcomes.every(o=>o.status==='rejected'))throw failed.reason;
 }finally{clearInterval(ticker);}
 const final=await pipelineAction(db,{action:'status',id:job.id},run);
 return {state:final.paused?'paused':['completed','cancelled'].includes(final.status)?final.status:'stopped',job:final};
}
/**
 * After the imports: brings the values per area of the administration up to date in steps (admin-refresh.mjs), so the
 * pages open without computing. Best effort; returns the number of steps.
 */
export async function catchUp(db,{maxSteps=400,budgetMs=5000,sleep=pause}={}){
 let steps=0;
 while(steps<maxSteps){
  const result=await refreshStep(db,{action:'step',target:'regions',budgetMs});
  steps++;
  if(result.state==='done'||result.missing)break;
  if(result.state==='busy')await sleep(3000);
 }
 return steps;
}
