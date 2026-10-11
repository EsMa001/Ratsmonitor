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
// A lane that found nothing to claim asks again after this long (plus a little spread, so lanes do not all ask at once).
const IDLE_MS=5000,IDLE_SPREAD_MS=2000;
// A lane whose step threw (a database lock held too long, a failure while storing) rests, then goes on; after this
// many failures in a row it gives up and the others carry on.
const LANE_RETRIES=5,LANE_REST_MS=5000;
/** The stored job, or null. */
export async function currentJob(db){
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(JOB_KEY).first();
 return row?JSON.parse(row.value):null;
}
/** Whether a job still has areas to claim or running. */
export const openJob=job=>!!job&&!['completed','cancelled'].includes(job.status)&&job.items.some(i=>i.status==='queued'||i.status==='running');
/**
 * Creates a metadata job (regions: 'sources', 'all' or a list of ids). An open job is continued instead, unless it is
 * paused or has not moved for `staleMs` (a job someone paused and forgot must not stop the nightly run for good);
 * such a job is ended by the new one. Returns {job, created, replaced}.
 */
export async function ensureJob(db,{regions='sources',window='1w',staleMs=6*3600000,now=Date.now()}={}){
 const existing=await currentJob(db);
 const stale=openJob(existing)&&(existing.paused||now-Date.parse(existing.updatedAt||'')>staleMs);
 if(openJob(existing)&&!stale)return {job:existing,created:false,replaced:false};
 const job=await pipelineAction(db,{action:'create',stage:'metadata',regions,window,replace:true},()=>{throw Error('create runs nothing');});
 return {job,created:true,replaced:!!existing&&openJob(existing)};
}
/** The import function as the route passes it (app/api/admin/pipeline/route.ts): rule labelling behind its cursor, imports with their window. */
export const importRunner=(db,{runSync,analysePending})=>(stage,region,lookback,cursor)=>stage==='analysis'?analysePending(db,region,{after:cursor||''}):runSync('metadata',region,'manual',{window:lookback});
/**
 * Works the open job to its end: `lanes` loops, each claiming one area after the other (action 'step'), waiting when
 * nothing can be claimed (wait, heldUntil). Ends when the job is completed, cancelled, paused or replaced by another
 * one, or when `stop()` says so (a time limit; the running imports still finish). Returns
 * {state: 'none'|'ended'|'paused'|'completed'|'cancelled'|'replaced'|'stopped', job, failures}.
 * `log(job)` is called once a minute with the latest view, `warn(message, error)` for lanes that threw.
 */
export async function workJob(db,run,{lanes=24,sleep=pause,log=()=>{},warn=()=>{},stop=()=>false,tickMs=60000,random=Math.random}={}){
 const job=await currentJob(db);
 if(!openJob(job))return {state:job?'ended':'none',job,failures:0};
 if(job.paused)return {state:'paused',job,failures:0};
 let latest=job,finished=false,replaced=false,failures=0;
 const lane=async(number)=>{
  let errors=0;
  while(!finished&&!stop()){
   let next;
   try{next=await pipelineAction(db,{action:'step',id:job.id},run);errors=0;}
   catch(e){
    const message=String(e?.message||e);
    // The stored job was taken by another step for too long (lease): wait like a lane that found nothing.
    if(/Warteschlangenschritt läuft bereits/.test(message)){await sleep(2500);continue;}
    // The page replaced the job: this one is over, the caller may start on the new one.
    if(/inzwischen geändert/.test(message)){replaced=true;finished=true;break;}
    failures++;errors++;warn(`Bahn ${number}: ${message}${errors<LANE_RETRIES?`; weiter in ${LANE_REST_MS/1000} s`:'; Bahn gibt auf'}`,e);
    if(errors>=LANE_RETRIES)break;
    await sleep(LANE_REST_MS);continue;
   }
   if((next.updatedAt||'')>=(latest.updatedAt||''))latest=next;
   if(['completed','cancelled'].includes(next.status)||next.paused){finished=true;break;}
   if(next.wait)await sleep(next.heldUntil?Math.min(30000,Math.max(2500,Date.parse(next.heldUntil)-Date.now())):IDLE_MS+random()*IDLE_SPREAD_MS);
  }
 };
 const ticker=setInterval(()=>log(latest),tickMs);
 try{await Promise.all(Array.from({length:Math.max(1,lanes)},(_,i)=>lane(i+1)));}
 finally{clearInterval(ticker);}
 if(replaced)return {state:'replaced',job:await currentJob(db),failures};
 const final=await pipelineAction(db,{action:'status',id:job.id},run);
 return {state:final.paused?'paused':['completed','cancelled'].includes(final.status)?final.status:'stopped',job:final,failures};
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
/**
 * Command line of the import process: --run (default) | --create [sources|all] [--regions a,b] [--window 1w]
 * [--lanes 24] [--max-minutes 240] [--no-catch-up]. Throws on unusable values.
 */
export function parseArgs(argv){
 const args=[...argv],out={create:null,regions:null,window:'1w',lanes:24,maxMinutes:0,catchUp:true};
 const take=()=>{const v=args.shift();if(v===undefined||v.startsWith('--'))throw Error('Wert fehlt');return v;};
 while(args.length){
  const a=args.shift();
  if(a==='--run')continue;
  else if(a==='--create')out.create=args[0]&&!args[0].startsWith('--')?args.shift():'sources';
  else if(a==='--regions')out.regions=take().split(',').map(s=>s.trim()).filter(Boolean);
  else if(a==='--window')out.window=take();
  else if(a==='--lanes'){out.lanes=Number(take());if(!Number.isInteger(out.lanes)||out.lanes<1||out.lanes>64)throw Error('--lanes: 1 bis 64');}
  else if(a==='--max-minutes'){out.maxMinutes=Number(take());if(!Number.isFinite(out.maxMinutes)||out.maxMinutes<0)throw Error('--max-minutes: Zahl');}
  else if(a==='--no-catch-up')out.catchUp=false;
  else throw Error('Unbekannter Schalter: '+a);
 }
 if(out.create&&!['sources','all'].includes(out.create))throw Error('--create: sources oder all');
 if(!/^(1d|1w|1m|3m|12m|24m)$/.test(out.window))throw Error('--window: 1d, 1w, 1m, 3m, 12m oder 24m');
 if(out.regions&&!out.create)throw Error('--regions nur mit --create');
 return out;
}
