// Builds of global evaluations of the administration (class C: keywords, quality checks), in chunks of areas. A build
// keeps its state in system_state['admin-build:<target>']: id, the stock it started at, a cursor (the last area id done,
// areas in binary order of region_revisions), how many areas are done, partial sums and the time spent. Each step takes
// chunks of at most CHUNK_ROWS reports until its budget is spent; the last step stores the result (admin-stored.mjs).
//
// No chunk is counted twice. Every chunk writes in one batch (one transaction): its writes to admin_agg carry the guard
// "the build is at the cursor this chunk started from", and the last statement moves the cursor under the same
// condition. If another step moved the cursor first (a lease that ran out during a long step), the guard fails, nothing
// of the batch changes anything, and the step ends with state 'conflict'.
//
// Deviation from requirements/admin-performance-konzept.md (3.4): the state holds a cursor instead of the list of all
// areas, which kept it small (3,500 ids would come near the 100 KB of a bound value). Areas added during a build are
// counted if they sort after the cursor.
import {keywordChunk,keywordFinish} from './admin-keywords.mjs';
import {writeStored,stockRevisions} from './admin-stored.mjs';
import {QUALITY_BUILDS} from './quality-check.mjs';
import {nextChunk} from './build-chunks.mjs';
const PREFIX='admin-build:';
const CHUNK_ROWS=25000;
// A build whose state was not written for this long is shown as paused; a finish that stopped is taken over after it.
const ACTIVE_MS=60000,FINISH_GRACE_MS=30000;
const FINISHING='\u0000finish';
const GUARD="EXISTS(SELECT 1 FROM system_state s WHERE s.key=? AND json_extract(s.value,'$.id')=? AND json_extract(s.value,'$.next')=?)";
const add=(a,b)=>{const out={...a};for(const [k,v] of Object.entries(b))out[k]=(out[k]||0)+v;return out;};
/**
 * Targets: chunk(db,unit,{build,guard,guardArgs,state}) → {partial,statements}; finish(db,state,now) stores the result.
 * Optional: next(db,state,chunkRows) → {unit,cursor,areas,rows?,heavy?,total?}|null (default: the next chunk of areas,
 * unit = JSON list of ids, cursor = last id, rows = its reports), total(db) (default: number of areas), chunkRows,
 * usesAgg (partial sums in admin_agg). rows lets a step estimate how long the next unit takes; a heavy unit (one query
 * over much of the stock) always starts a step of its own.
 */
const TARGETS={
 ...QUALITY_BUILDS,
 keywords:{
  usesAgg:true,
  async chunk(db,ids,{build,guard,guardArgs,state}){const {sums,statements}=await keywordChunk(db,ids,{build,guard,guardArgs});return {partial:add(state.partial,sums),statements};},
  async finish(db,state,now){const result=await keywordFinish(db,{build:state.id,sums:state.partial,now});await writeStored(db,'keywords',result,{stockSum:state.stockSum,content:state.content,ms:state.ms,computedAt:now.toISOString()});},
 },
};
export const isBuildTarget=target=>typeof target==='string'&&Object.hasOwn(TARGETS,target);
export const buildTargets=()=>Object.keys(TARGETS);
const stateKey=target=>PREFIX+target;
const readJson=text=>{try{return JSON.parse(text||'null');}catch{return null;}};
export async function readBuild(db,target){const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(stateKey(target)).first();const st=row?readJson(row.value):null;return st&&st.id?st:null;}
/** Starts a build, or returns the running one; restart replaces a running build. */
export async function startBuild(db,target,{restart=false,now=new Date()}={}){
 const running=await readBuild(db,target);
 if(running&&!restart)return running;
 if(running)await cancelBuild(db,target);
 const def=TARGETS[target];
 const [{stockSum,content},total]=await Promise.all([stockRevisions(db),def.total?def.total(db):db.prepare('SELECT count(*) n FROM region_revisions').first().then(r=>Number(r?.n||0))]);
 const state={id:crypto.randomUUID(),target,startedAt:now.toISOString(),updatedAt:now.toISOString(),stockSum,content,next:'',done:0,total,partial:{},ms:0};
 // Only if no other start came first.
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING').bind(stateKey(target),JSON.stringify(state)).run();
 return await readBuild(db,target);
}
/** Stops a build and removes its partial sums. */
export async function cancelBuild(db,target){
 const st=await readBuild(db,target);
 await db.batch([
  ...(st?[db.prepare('DELETE FROM admin_agg WHERE build=?').bind(st.id)]:[]),
  db.prepare('DELETE FROM system_state WHERE key=?').bind(stateKey(target)),
 ]);
}
/** Read-only: {target,state:'running'|'paused',done,total,startedAt} or null. */
export async function buildStatus(db,target,{now=new Date()}={}){
 const st=await readBuild(db,target);if(!st)return null;
 return {target,state:now.getTime()-Date.parse(st.updatedAt||st.startedAt)<ACTIVE_MS?'running':'paused',done:st.done,total:Math.max(st.total,st.done),startedAt:st.startedAt};
}
/** The next chunk after the cursor: areas in binary order, their reports adding up to at most CHUNK_ROWS. */
/**
 * Runs chunks of a build until budgetMs is spent; the last one stores the result.
 * Returns {target,state:'running'|'done'|'conflict',done,total,pending}.
 */
export async function stepBuild(db,target,{budgetMs=8000,now=new Date(),chunkRows}={}){
 const def=TARGETS[target],started=Date.now(),key=stateKey(target),rows=chunkRows||def.chunkRows||CHUNK_ROWS;
 let units=0,lastMs=0,perRow=null;
 let st=await readBuild(db,target);
 const progress=state=>({target,done:state.done,total:Math.max(state.total,state.done),pending:Math.max(0,state.total-state.done)});
 if(!st)return {target,state:'done',done:0,total:0,pending:0,idle:true};
 for(;;){
  if(st.next===FINISHING){
   // Another step is finishing; take over only if it stopped.
   if(Date.now()-Date.parse(st.updatedAt)<FINISH_GRACE_MS)return {...progress(st),state:'running'};
   await finish(db,def,st,now);return {...progress(st),state:'done'};
  }
  const step=def.next?await def.next(db,st,rows):await nextChunk(db,st.next,rows).then(c=>c.ids.length?{unit:JSON.stringify(c.ids),cursor:c.ids.at(-1),areas:c.ids.length,rows:c.rows}:null);
  // Before a further unit in this step: stop if it would overrun the budget (estimated from the time per report so far).
  if(units&&step){
   const estimate=step.heavy?Infinity:step.rows&&perRow!==null?perRow*step.rows:lastMs;
   if(Date.now()-started+estimate>budgetMs)return {...progress(st),state:'running'};
  }
  if(!step){
   const claimed=await db.prepare("UPDATE system_state SET value=? WHERE key=? AND json_extract(value,'$.id')=? AND json_extract(value,'$.next')=?").bind(JSON.stringify({...st,next:FINISHING,updatedAt:new Date().toISOString()}),key,st.id,st.next).run();
   if(!changed(claimed))return {...progress(st),state:'conflict'};
   await finish(db,def,st,now);
   return {...progress(st),state:'done'};
  }
  const began=Date.now(),guardArgs=[key,st.id,st.next];
  const {partial,statements}=await def.chunk(db,step.unit,{build:st.id,guard:GUARD,guardArgs,state:st});
  const next={...st,next:step.cursor,done:st.done+step.areas,...(step.total!==undefined?{total:step.total}:{}),partial,ms:st.ms+(Date.now()-began),updatedAt:new Date().toISOString()};
  const results=await db.batch([...statements,db.prepare("UPDATE system_state SET value=? WHERE key=? AND json_extract(value,'$.id')=? AND json_extract(value,'$.next')=?").bind(JSON.stringify(next),key,st.id,st.next)]);
  if(!changed(results.at(-1)))return {...progress(st),state:'conflict'};
  st=next;units++;lastMs=Date.now()-began;if(step.rows)perRow=lastMs/step.rows;
  if(Date.now()-started>=budgetMs)return {...progress(st),state:'running'};
 }
}
const changed=result=>Number(result?.meta?.changes??result?.changes??0)>0;
async function finish(db,def,st,now){
 await def.finish(db,st,now);
 await db.batch([
  ...(def.usesAgg?[db.prepare('DELETE FROM admin_agg WHERE build=?').bind(st.id)]:[]),
  db.prepare("DELETE FROM system_state WHERE key=? AND json_extract(value,'$.id')=?").bind(stateKey(st.target),st.id),
 ]);
}
