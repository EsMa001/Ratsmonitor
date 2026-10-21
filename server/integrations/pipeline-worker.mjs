import {pipelineAction,selectedRegions,provider,noteImport,PER_PROVIDER,PARTIAL_PREFIX} from './pipeline-jobs.mjs';
import {hasFailureStore,hostStates,hostWaiting} from './work-failures.mjs';
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
export async function ensureJob(db,{regions='sources',window='1w',staleMs=6*3600000,owner=null,now=Date.now()}={}){
 const existing=await currentJob(db);
 const stale=openJob(existing)&&(existing.paused||now-Date.parse(existing.updatedAt||'')>staleMs);
 if(openJob(existing)&&!stale)return {job:existing,created:false,replaced:false};
 const deferred=await deferredRegions(db,selectedRegions(regions),now);
 const job=await pipelineAction(db,{action:'create',stage:'metadata',regions,window,replace:true,deferred},()=>{throw Error('create runs nothing');});
 // owner 'nightly': der Nachtlauf bearbeitet den Auftrag allein (nightlyBusy); der Job „Abrufaufträge“ lässt ihn aus
 if(owner){await db.prepare("UPDATE system_state SET value=json_set(value,'$.owner',?) WHERE key=?").bind(owner,JOB_KEY).run();job.owner=owner;}
 return {job,created:true,replaced:!!existing&&openJob(existing),deferred:Object.keys(deferred).length};
}
/** Ein Auftrag des Nachtlaufs, der sich noch bewegt (jede Minute ein Stand): kein zweiter Prozess soll ihn mit abarbeiten, sonst
 * gilt die Grenze „je Server höchstens 2“ je Prozess (16.10.2026: 48 Bahnen auf dem Nachtauftrag). Bleibt er stehen, hilft der Job. */
export const NIGHTLY_FRESH_MS=10*60000;
export const nightlyBusy=(job,now=Date.now())=>!!job&&job.owner==='nightly'&&openJob(job)&&now-Date.parse(job.updatedAt||'')<NIGHTLY_FRESH_MS;
/**
 * Gebiete, die der Nachtauftrag auslässt (Fehlerspeicher, Migration 0040): eigener Eintrag mit Termin in der Zukunft (die Nacharbeit
 * versucht es dann) oder ihr Server wartet. Ein Eintrag ohne Termin (internal) hält den Nachtlauf nicht auf: der nächtliche Abruf ist
 * dann selbst der Versuch, und kein Gebiet bleibt dauerhaft ausgelassen. {Gebiet: Hinweis}
 */
export async function deferredRegions(db,ids,now=Date.now()){
 if(!await hasFailureStore(db))return {};
 // Einträge „teilweise:“ halten den Nachtlauf nicht auf: das Gebiet liefert, nur ein Teil fehlte; die Nacharbeit holt den Rest
 const {results}=await db.prepare("SELECT key,class,next_try_at FROM work_failures WHERE step='import' AND coalesce(reason,'') NOT LIKE ?").bind(PARTIAL_PREFIX+'%').all();
 const own=new Map((results||[]).map(r=>[r.key,r])),hosts=await hostStates(db),out={};
 for(const id of ids){
  const e=own.get(id),h=hosts.get(provider(id));
  if(e?.next_try_at&&Date.parse(e.next_try_at)>now)out[id]=`Zurückgestellt (${e.class}); nächster Versuch ${e.next_try_at.slice(0,16).replace('T',' ')} über die Nacharbeit.`;
  else if(hostWaiting(h,now))out[id]=`Server ${h.host} wartet (${h.state}) bis ${h.next_try_at?h.next_try_at.slice(0,16).replace('T',' '):'zur Prüfung'}; Abruf über die Nacharbeit.`;
 }
 return out;
}
/**
 * Abruf genau dieser Gebiete ohne gespeicherten Auftrag (import-worker --direct, Job „nacharbeit“): höchstens `lanes`
 * gleichzeitig, je Server höchstens PER_PROVIDER; jeder Ausgang geht in den Fehlerspeicher (noteImport). Rückgabe je Gebiet
 * {region, status, refused, error}.
 */
export async function runDirect(db,run,regions,{window='1w',lanes=4,origin='daily',stop=()=>false}={}){
 const queue=[...regions],busy=new Map(),out=[];
 const lane=async()=>{
  while(queue.length&&!stop()){
   const i=queue.findIndex(r=>(busy.get(provider(r))||0)<PER_PROVIDER);
   if(i<0){await pause(500);continue;}
   const region=queue.splice(i,1)[0],server=provider(region);busy.set(server,(busy.get(server)||0)+1);
   let result=null,failure='';
   try{result=await run('metadata',region,window);}catch(e){failure=String(e?.message||e).slice(0,300);}
   finally{busy.set(server,busy.get(server)-1);}
   await noteImport(db,region,{result,failure,server,origin});
   out.push({region,status:result?.status??null,refused:!!result?.data?.refused,error:failure||result?.data?.cause||result?.data?.error||null});
  }
 };
 await Promise.all(Array.from({length:Math.max(1,lanes)},lane));
 return out;
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
export async function catchUp(db,{maxSteps=400,budgetMs=5000,sleep=pause,busyRounds=3,warn=console.warn}={}){
 let steps=0,busy=0;
 while(steps<maxSteps){
  let result;
  // Die Verarbeitung (Zahlen für plenara.X) hält die Schreibsperre auch mal Minuten: dann kurz warten und nach busyRounds
  // Anläufen ohne Fehler aufhören, der nächste Lauf holt nach (Server 21.10.2026, 06:32: sonst endete der Lauf als
  // „database is locked“ mit Fehler, obwohl nichts zu tun war)
  try{result=await refreshStep(db,{action:'step',target:'regions',budgetMs});}
  catch(e){
   if(!/locked|busy/i.test(String(e?.message||e)))throw e;
   if(++busy>busyRounds){warn(`Kennzahlen der Administration: Datenbank gesperrt, nach ${steps} Schritten vertagt`);break;}
   await sleep(3000);continue;
  }
  steps++;
  if(result.state==='done'||result.missing)break;
  if(result.state==='busy')await sleep(3000);
 }
 return steps;
}
/** Fenster des Nachtlaufs: am Wochentag `weeklyDay` (deutsche Zeit, 0 = Sonntag) das weitere `weeklyWindow`, sonst `window` */
export function windowForTonight({window,weeklyWindow,weeklyDay=0},now=new Date()){
 if(!weeklyWindow)return window;
 const day=['So','Mo','Di','Mi','Do','Fr','Sa'].indexOf(new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'short'}).format(now).replace('.',''));
 return day===weeklyDay?weeklyWindow:window;
}
/**
 * Command line of the import process: --run (default) | --create [sources|all] [--regions a,b] [--window 1w]
 * [--lanes 24] [--max-minutes 240] [--no-catch-up]. Throws on unusable values.
 */
export function parseArgs(argv){
 const args=[...argv],out={create:null,direct:false,origin:'daily',regions:null,window:'1w',weeklyWindow:null,weeklyDay:0,lanes:24,maxMinutes:0,catchUp:true};
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
  else if(a==='--direct')out.direct=true;
  // Wöchentlich ein weiteres Fenster (Nachträge zu älteren Sitzungen: später veröffentlichte Niederschriften und Beschlüsse)
  else if(a==='--weekly-window')out.weeklyWindow=take();
  else if(a==='--weekly-day'){out.weeklyDay=Number(take());if(!Number.isInteger(out.weeklyDay)||out.weeklyDay<0||out.weeklyDay>6)throw Error('--weekly-day: 0 (Sonntag) bis 6');}
  else if(a==='--origin'){out.origin=take();if(!['daily','backlog'].includes(out.origin))throw Error('--origin: daily oder backlog');}
  else throw Error('Unbekannter Schalter: '+a);
 }
 if(out.create&&!['sources','all'].includes(out.create))throw Error('--create: sources oder all');
 if(!/^(1d|1w|1m|3m|12m|24m)$/.test(out.window))throw Error('--window: 1d, 1w, 1m, 3m, 12m oder 24m');
 if(out.weeklyWindow&&!/^(1w|1m|3m|12m|24m)$/.test(out.weeklyWindow))throw Error('--weekly-window: 1w, 1m, 3m, 12m oder 24m');
 if(out.direct&&(out.create||!out.regions))throw Error('--direct braucht --regions und kein --create');
 if(out.regions&&!out.create&&!out.direct)throw Error('--regions nur mit --create oder --direct');
 return out;
}
