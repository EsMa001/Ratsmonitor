// Computing steps of the administration (rule R4 of requirements/admin-performance-konzept.md): pages only read stored
// values; computing happens in short POST steps under one lease, each continuing where the last one stopped.
// target 'regions': values per area (region-facts.mjs); other targets are builds of global evaluations (admin-builds.mjs).
import {refreshRegionFacts} from './region-facts.mjs';
import {pendingRegions} from './region-series.mjs';
import {processingState} from './processing-status.mjs';
import {lockedUntil} from './import-lock.mjs';
import {AdminError} from './admin-access.mjs';
import {isBuildTarget,buildTargets,startBuild,stepBuild,cancelBuild,buildStatus} from './admin-builds.mjs';
const LEASE='admin-refresh-lease';
// A lease outlives its step by this much, so a step stopped without its finally (worker cancelled) frees it soon.
const GRACE_MS=20000;
// A job whose state was not written for this long is no longer driven by any page.
const JOB_IDLE_MS=300000;
/** Lease without waiting: fn runs only if the lease is free; otherwise {busy:true,until}. */
export async function withRefreshLease(db,budgetMs,fn,{now=Date.now()}={}){
 const value=String(now+budgetMs+GRACE_MS);
 const got=await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER)<? RETURNING value').bind(LEASE,value,now).first();
 if(!got){const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(LEASE).first();return {busy:true,until:new Date(lockedUntil(row?.value)).toISOString()};}
 try{return await fn();}
 finally{await db.prepare('DELETE FROM system_state WHERE key=? AND value=?').bind(LEASE,value).run();}
}
const validTarget=target=>target==='regions'||isBuildTarget(target);
/**
 * One step: action 'step' | 'start' | 'cancel'; target 'regions' or a registered build.
 * Returns {target,state:'running'|'done'|'busy'|'conflict',done,total,pending,ms,until?}.
 */
export async function refreshStep(db,{action='step',target='regions',restart=false,budgetMs=5000,now=new Date()}={}){
 if(typeof target!=='string'||!validTarget(target))throw new AdminError(400,'Unbekanntes Rechenziel.');
 if(!['step','start','cancel'].includes(action))throw new AdminError(400,'Ungültige Aktion.');
 const started=Date.now();
 const result=await withRefreshLease(db,budgetMs,async()=>{
  if(target==='regions'){
   const step=await refreshRegionFacts(db,{budgetMs,now});
   if(step.missing)return {target,state:'done',missing:step.missing,done:0,total:0,pending:0};
   const left=await pendingRegions(db),pending=Number(left.pending||0)+Number(left.unbuilt||0);
   return {target,state:pending?'running':'done',done:Number(left.total||0)-pending,total:Number(left.total||0),pending,unbuilt:Number(left.unbuilt||0)};
  }
  if(action==='cancel'){await cancelBuild(db,target);return {target,state:'done',done:0,total:0,pending:0,cancelled:true};}
  if(action==='start')await startBuild(db,target,{restart,now});
  return stepBuild(db,target,{budgetMs,now});
 });
 if(result.busy)return {target,state:'busy',done:0,total:0,pending:0,until:result.until,ms:Date.now()-started};
 return {...result,ms:Date.now()-started};
}
/**
 * Read-only: {regions:{pending,unbuilt,total}|{missing:'0016'},builds:{[target]:state},busy?:{until},jobRunning,
 * importBusyUntil}. jobRunning: an import job of the administration is being driven (then pages do not catch up, so the
 * job keeps the database).
 */
export async function refreshStatus(db,{now=new Date()}={}){
 const [regions,state,rows]=await Promise.all([
  pendingRegions(db),processingState(db),
  db.prepare("SELECT key,value FROM system_state WHERE key IN ('import-lock',?)").bind(LEASE).all()
 ]);
 const value=key=>rows.results.find(r=>r.key===key)?.value;
 const job=state.job,updated=Date.parse(job?.updatedAt||'');
 const jobRunning=!!job&&['queued','running'].includes(job.status)&&Number.isFinite(updated)&&now.getTime()-updated<JOB_IDLE_MS;
 const lock=lockedUntil(value('import-lock')),lease=lockedUntil(value(LEASE));
 const builds={};
 for(const target of buildTargets()){const b=await buildStatus(db,target,{now});if(b)builds[target]=b;}
 return {regions,builds,...(lease>now.getTime()?{busy:{until:new Date(lease).toISOString()}}:{}),jobRunning,importBusyUntil:lock>now.getTime()?new Date(lock).toISOString():null};
}
