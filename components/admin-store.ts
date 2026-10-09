'use client';
import {useEffect,useState} from 'react';
// Browser side of the precomputed values of the administration (requirements/admin-performance-konzept.md, 3.5).
// useRegionCatchUp: while an admin page is open and visible, areas whose values per area are stale or missing are
// computed in steps of a few seconds (POST /api/admin/refresh), so pages never compute while they load. Not while an
// import job of the administration is driven or the stock is locked by an import: the import computes its own area.

/** Fired on window after catch-up steps have computed areas; pages may read their data again. */
export const ADMIN_REGIONS_DONE='admin:regions-done';
export type CatchUp={pending:number;unbuilt:number;running:boolean;missing:boolean};
type Status={regions:{pending?:number;unbuilt?:number;total?:number;missing?:string};jobRunning:boolean;importBusyUntil:string|null};
type Step={state:'running'|'done'|'busy'|'conflict';pending:number;unbuilt?:number;total:number};
// Checks while nothing is left, while a job runs, and after a failed request.
const IDLE_MS=120000,JOB_MS=30000,ERROR_MS=60000,BUSY_MS=3000;

export function useRegionCatchUp():CatchUp{
 const [state,setState]=useState<CatchUp>({pending:0,unbuilt:0,running:false,missing:false});
 useEffect(()=>{
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined,wake:(()=>void)|undefined;
  const wait=(ms:number)=>new Promise<void>(resolve=>{wake=resolve;timer=setTimeout(resolve,ms);});
  // A tab coming back into view checks at once instead of waiting for the next round.
  const onVisible=()=>{if(document.visibilityState==='visible'){clearTimeout(timer);wake?.();}};
  document.addEventListener('visibilitychange',onVisible);
  const json=async<T,>(response:Response)=>response.ok?await response.json() as T:null;
  (async()=>{
   while(!stopped){
    if(document.visibilityState!=='visible'){await wait(IDLE_MS);continue;}
    const status=await fetch('/api/admin/refresh',{cache:'no-store'}).then(r=>json<Status>(r)).catch(()=>null);
    if(stopped)return;
    if(!status){await wait(ERROR_MS);continue;}
    if(status.regions.missing){setState({pending:0,unbuilt:0,running:false,missing:true});return;}
    const pending=Number(status.regions.pending||0),unbuilt=Number(status.regions.unbuilt||0);
    setState({pending,unbuilt,running:false,missing:false});
    if(!pending&&!unbuilt){await wait(IDLE_MS);continue;}
    if(status.jobRunning||(status.importBusyUntil&&Date.parse(status.importBusyUntil)>Date.now())){await wait(JOB_MS);continue;}
    setState(s=>({...s,running:true}));
    let computed=false;
    while(!stopped&&document.visibilityState==='visible'){
     const step=await fetch('/api/admin/refresh',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'step',target:'regions'})}).then(r=>json<Step>(r)).catch(()=>null);
     if(stopped)return;
     if(!step){await wait(ERROR_MS);break;}
     if(step.state==='busy'){await wait(BUSY_MS);continue;}
     if(step.state==='conflict')continue;
     computed=true;
     // step.pending counts stale and never computed areas together.
     setState(s=>({...s,pending:Math.max(0,step.pending-(step.unbuilt||0)),unbuilt:step.unbuilt||0,running:step.state==='running'}));
     if(step.state==='done')break;
    }
    setState(s=>({...s,running:false}));
    if(computed)window.dispatchEvent(new Event(ADMIN_REGIONS_DONE));
   }
  })();
  return()=>{stopped=true;clearTimeout(timer);wake?.();document.removeEventListener('visibilitychange',onVisible);};
 },[]);
 return state;
}

// --- The dashboard of the import and quality pages, put together from its parts (shared/admin-areas.mjs) ---
// summary (live, small), areas (rows of figures, ETag) and static (cached for good under its version). The notes of an area
// are read when somebody opens them (/api/admin/area).
let staticVersion='',staticKept:{v:string;data:{areas:unknown[]}}|null=null;
/** The version of the static list the server rendered the page with; the list is then cached by the browser for good. */
export function setAdminStaticVersion(version:string){staticVersion=version;}
async function readJson<T>(response:Response,fallback:string):Promise<T>{
 const data=await response.json().catch(()=>({})) as T&{error?:string};
 if(!response.ok)throw Error(data.error||fallback);
 return data;
}
async function staticAreasData(signal?:AbortSignal){
 if(staticKept&&(!staticVersion||staticKept.v===staticVersion))return staticKept.data;
 const data=await fetch('/api/admin/static'+(staticVersion?'?v='+encodeURIComponent(staticVersion):''),{cache:staticVersion?'default':'no-cache',signal}).then(r=>readJson<{areas:unknown[]}>(r,'Die Gebiete konnten nicht geladen werden.'));
 staticKept={v:staticVersion,data};return data;
}
/**
 * The dashboard in the form of the former overview: counts, labels, statuses, runs and job from summary, `sources` from the
 * static list and the rows. review: with the first page of the review list (quality page); otherwise only its total.
 */
export async function fetchDashboard({review=false,signal}:{review?:boolean;signal?:AbortSignal}={}):Promise<import('@/shared/admin-types').AdminDashboard>{
 const [summary,areas,statics,list]=await Promise.all([
  fetch('/api/admin/summary',{cache:'no-store',signal}).then(r=>readJson<Record<string,any>>(r,'Der Datenbankstand konnte nicht geladen werden.')),
  fetch('/api/admin/areas',{cache:'no-cache',signal}).then(r=>readJson<{fields:string[];rows:unknown[][]}>(r,'Der Datenbankstand konnte nicht geladen werden.')),
  staticAreasData(signal),
  review?fetch('/api/admin/review?issue=labels&region=all',{cache:'no-store',signal}).then(r=>readJson<Record<string,any>>(r,'Die Prüfliste konnte nicht geladen werden.')):Promise.resolve(null),
 ]);
 const {toSources}=await import('@/shared/admin-areas.mjs');
 return {...summary,sources:toSources(statics as {areas:any[]},areas as {fields:string[];rows:any[][]}),review:list||{issue:'labels',total:summary.counts?.unlabelled??0,articles:[]}} as unknown as import('@/shared/admin-types').AdminDashboard;
}
