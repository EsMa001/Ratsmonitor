/**
 * Debug-Seite der Pipeline (Admin-Reiter „Pipeline-Debug“, vorübergehend; Betriebsplan 15.10.2026). Liest nur system_state und
 * die kleinen Tabellen des Fehlerspeichers, nie die Berichte: welcher Job und welcher Schritt wann lief (schedule-log, Protokolle
 * der Extraktion, der Verarbeitung, der Nacharbeit, des Altbestands), wie viele Berichte welchen Weg genommen haben (pipeline-trace,
 * gezählt von scripts/pipeline-trace.mjs) und was im Fehlerspeicher steht, getrennt nach Tagesbereich und Altbestand.
 * Aktionen (POST): Server freigeben, Einträge des Tagesbereichs wieder öffnen (den Altbestand bearbeitet seine eigene Seite).
 */
import {failureCounts,hasFailureStore,releaseHost,reopen,CLASSES,rangeWhere,dailyBoundary,DAILY_SINCE,PHASE_ORDER,providerRamps,rampAllowance} from './work-failures.mjs';
import {PROVIDER_AREAS} from './pipeline-jobs.mjs';
import {JOBS,UNITS_KEY,unitsWarning} from './schedules.mjs';

export const SCHEDULE_LOG_KEY='schedule-log';
const KEYS=[SCHEDULE_LOG_KEY,'schedule-runs','pdf-store-runs','rule-texts-last','nacharbeit-last','ai-counts','pipeline-trace','pdf-daily-last','admin-pipeline-job','altbestand-last','altbestand-requests',UNITS_KEY];
const parse=v=>{try{return v?JSON.parse(v):null;}catch{return null;}};

/** Auftrag des Imports knapp: Zähler je Zustand statt aller Posten */
function jobBrief(job){
 if(!job)return null;
 const counts={};for(const i of job.items||[])counts[i.status]=(counts[i.status]||0)+1;
 return {id:job.id,stage:job.stage,window:job.window||null,status:job.status,paused:!!job.paused,createdAt:job.createdAt,updatedAt:job.updatedAt,counts,
  deferred:(job.items||[]).filter(i=>i.status==='deferred').slice(0,30).map(i=>({region:i.region,message:i.message})),
  failed:(job.items||[]).filter(i=>i.status==='failed'||i.status==='unknown').slice(0,30).map(i=>({region:i.region,message:i.message}))};
}

/**
 * Anbieter des Abrufs, die nicht frei sind: gesperrt oder gebremst (Fehlerspeicher) oder im Anlauf nach einer Sperre (work-failures.mjs,
 * rampAllowance), mit der Zahl ihrer Gebiete und wie viele davon heute abgerufen werden. Nur Servergruppen mit angebundenen Gebieten.
 */
export async function providerStates(db,now=Date.now()){
 if(!await hasFailureStore(db))return [];
 const areas=PROVIDER_AREAS(),ramps=await providerRamps(db),out=[];
 const {results}=await db.prepare("SELECT host,state,level,next_try_at,last_ok_at,last_fail_at,reason FROM source_hosts WHERE state<>'ok'").all();
 for(const h of results||[]){const n=areas.get(h.host)?.length;if(n)out.push({server:h.host,state:h.state,level:h.level,areas:n,today:0,next_try_at:h.next_try_at,since:h.last_fail_at,reason:h.reason});}
 for(const [server,since] of Object.entries(ramps)){const n=areas.get(server)?.length;if(n&&!out.some(p=>p.server===server))out.push({server,state:'anlauf',level:0,areas:n,today:Math.min(n,rampAllowance(since,now)),next_try_at:null,since,reason:null});}
 return out.sort((a,b)=>b.areas-a.areas||a.server.localeCompare(b.server));
}

/** Alles für die Seite, nur lesend */
export async function pipelineDebug(db,now=Date.now()){
 const {results}=await db.prepare(`SELECT key,value FROM system_state WHERE key IN (${KEYS.map(()=>'?').join(',')})`).bind(...KEYS).all();
 const by=new Map((results||[]).map(r=>[r.key,parse(r.value)]));
 const store=await hasFailureStore(db);
 const failures=store?await failureCounts(db,now):{missing:'0040'};
 const d=rangeWhere('daily',now);
 const hosts=store?(await db.prepare(`SELECT host,state,fails,level,next_try_at,last_ok_at,last_fail_at,reason,(SELECT count(*) FROM work_failures w WHERE w.host=h.host) AS entries FROM source_hosts h WHERE state<>'ok' ORDER BY entries DESC,host LIMIT 60`).all()).results:[];
 const internal=store?(await db.prepare("SELECT step,key,reason,release,last_at,tries FROM work_failures WHERE class='internal' ORDER BY last_at DESC LIMIT 40").all()).results:[];
 const recent=store?(await db.prepare(`SELECT step,key,host,class,reason,http,tries,last_at,next_try_at,origin,event_date,CASE WHEN ${d.sql} THEN 'daily' ELSE 'backlog' END AS range FROM work_failures ORDER BY last_at DESC LIMIT 60`).bind(...d.args).all()).results:[];
 const req=by.get('altbestand-requests')||{},providers=await providerStates(db,now);
 return {at:new Date(now).toISOString(),boundary:dailyBoundary(now),since:DAILY_SINCE,phases:PHASE_ORDER,
  units:unitsWarning(by.get(UNITS_KEY),now),
  jobs:JOBS.map(j=>({id:j.id,label:j.label,flow:j.flow,time:j.time||null,every:j.every||null,window:j.window||null})),
  log:(by.get(SCHEDULE_LOG_KEY)||[]).slice(0,200),runs:by.get('schedule-runs')||{},
  pdfRuns:(by.get('pdf-store-runs')||[]).slice(0,12),ruleTexts:by.get('rule-texts-last'),nacharbeit:by.get('nacharbeit-last'),
  altbestand:{last:by.get('altbestand-last'),importOpen:!!req.import&&!req.import.finishedAt&&!req.import.stoppedAt,reworkOpen:!!req.rework&&!req.rework.finishedAt,ocrOpen:!!req.ocr&&!req.ocr.stoppedAt},
  aiCounts:by.get('ai-counts'),trace:by.get('pipeline-trace'),pdfDaily:by.get('pdf-daily-last'),
  importJob:jobBrief(by.get('admin-pipeline-job')),failures,hosts,providers,internal,recent,classes:CLASSES};
}

/** Aktion: {action:'release',host} | {action:'reopen',cls?,step?,host?,key?,phase?} (nur Tagesbereich) */
export async function pipelineDebugAction(db,body,now=Date.now()){
 if(!await hasFailureStore(db))throw Object.assign(Error('Fehlerspeicher fehlt (Migration 0040).'),{status:409});
 const str=v=>typeof v==='string'&&v.length&&v.length<600?v:null;
 if(body.action==='release'&&str(body.host)){await releaseHost(db,str(body.host),now);return {ok:true};}
 if(body.action==='reopen'){
  const f={cls:CLASSES.includes(body.cls)?body.cls:null,step:str(body.step),host:str(body.host),key:str(body.key),phase:PHASE_ORDER.includes(body.phase)?body.phase:null};
  if(!f.cls&&!f.step&&!f.host&&!f.key&&!f.phase)throw Object.assign(Error('Bitte Stufe, Grund, Schritt, Server oder Eintrag angeben.'),{status:400});
  return {ok:true,reopened:await reopen(db,{...f,range:'daily'},now)};
 }
 throw Object.assign(Error('Unbekannte Aktion.'),{status:400});
}
