/**
 * Record of one import, for looking into a run on demand: every request to the source with its duration and
 * outcome, and the figures of the import (meetings, reports, what was stored, notes, warnings, the error).
 *
 * - The record of the last import of each area is kept in system_state under 'import-debug:<area>'; the next import
 *   of that area replaces it, so the store stays bounded.
 * - A short summary (number of requests, failures, time on the network) goes into the details of the run.
 * - Nothing is fetched or computed when the admin pages are opened. The record is written by the import and only read
 *   when it is asked for.
 * The addresses are those of public council systems; no content of pages or documents is recorded.
 */
const MAX_REQUESTS=1500,MAX_URL=220,MAX_ERROR=160;
export const debugKey=region=>'import-debug:'+region;
/** Kind of a request, read from its address: the page type of SessionNet (si0057, vo0050 …) or ALLRIS (si010, to010 …), 'oparl', or the last path segment. */
export function requestKind(url){
 try{
  const u=new URL(url),last=u.pathname.split('/').filter(Boolean).pop()||'';
  const page=last.match(/^([a-z]{2}[0-9]{4})\.(?:asp|php)$/i)||last.match(/^([a-z]{2}[0-9]{3})$/i);if(page)return page[1].toLowerCase();
  if(/oparl/i.test(u.pathname)||/^oparl\./i.test(u.hostname))return 'oparl';
  if(last==='api.php')return 'api '+(u.searchParams.get('id')||'');
  return last.replace(/[0-9]+/g,'#').slice(0,24)||'/';
 }catch{return 'unbekannt';}
}
/** Figures over a list of recorded requests. */
export function summarize(requests){
 const kinds={},errors={};let failed=0,networkMs=0;
 for(const r of requests){
  const kind=kinds[r.kind]=kinds[r.kind]||{requests:0,failed:0,ms:0};kind.requests++;kind.ms+=r.ms;networkMs+=r.ms;
  if(!r.ok){failed++;kind.failed++;errors[r.error]=(errors[r.error]||0)+1;}
 }
 return {requests:requests.length,failed,networkMs,kinds,errors,slowest:[...requests].sort((a,b)=>b.ms-a.ms).slice(0,5).map(r=>({url:r.url,ms:r.ms,ok:r.ok}))};
}
/**
 * trace.wrap(fn) returns fn with the same arguments and result, recording every call: start (ms after the beginning
 * of the import), duration, address, and either the size of a text answer or the error.
 * trace.finish(figures) returns the complete record.
 * @param {string} region
 * @param {{window?:string,now?:()=>number}} [options]
 */
export function createTrace(region,{window,now=()=>Date.now()}={}){
 const started=now(),requests=[];let dropped=0;
 const record=(url,from,outcome)=>{
  const entry={t:from-started,ms:now()-from,kind:requestKind(url),url:String(url).slice(0,MAX_URL),...outcome};
  if(requests.length<MAX_REQUESTS)requests.push(entry);else dropped++;
 };
 return {
  region,
  wrap:fn=>async(url,...rest)=>{
   const from=now();
   try{const result=await fn(url,...rest);record(url,from,{ok:true,...(typeof result==='string'?{size:result.length}:{})});return result;}
   catch(e){record(url,from,{ok:false,error:String(e?.message||e).slice(0,MAX_ERROR)});throw e;}
  },
  finish:(figures={})=>({version:1,region,window:window||null,startedAt:new Date(started).toISOString(),durationMs:now()-started,...figures,summary:summarize(requests),droppedRequests:dropped,requests}),
 };
}
const readJson=text=>{try{return JSON.parse(text||'null');}catch{return null;}};
export const saveDebug=(db,record)=>db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(debugKey(record.region),JSON.stringify(record)).run();
/** The record of the last import of an area and its recent runs. Read-only. */
export async function readDebug(db,region){
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(debugKey(region)).first();
 const runs=(await db.prepare("SELECT id,started_at,finished_at,status,details FROM import_runs WHERE json_extract(details,'$.region')=? ORDER BY started_at DESC LIMIT 12").bind(region).all()).results;
 return {region,last:readJson(row?.value),runs:runs.map(r=>{const d=readJson(r.details)||{};return {id:r.id,startedAt:r.started_at,finishedAt:r.finished_at,status:r.status,mode:d.mode||'metadata',window:d.window||null,count:d.count??d.processed??null,unchangedMeetings:d.unchangedMeetings??null,error:d.error||null,issues:Array.isArray(d.issues)?d.issues.slice(0,20):[],warnings:Array.isArray(d.warnings)?d.warnings.slice(0,20):[],debug:d.debug||null};})};
}
