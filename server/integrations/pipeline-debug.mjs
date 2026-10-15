/**
 * Debug-Seite der Pipeline (Admin-Reiter „Pipeline-Debug“, vorübergehend; Betriebsplan 15.10.2026). Liest nur system_state und
 * die kleinen Tabellen des Fehlerspeichers, nie die Berichte: welcher Job und welcher Schritt wann lief (schedule-log, Protokolle
 * der Extraktion, der Verarbeitung, der Nacharbeit, des Altbestands), wie viele Berichte welchen Weg genommen haben (pipeline-trace,
 * gezählt von scripts/pipeline-trace.mjs) und was im Fehlerspeicher steht, getrennt nach Tagesbereich und Altbestand.
 * Aktionen (POST): Server freigeben, Einträge des Tagesbereichs wieder öffnen (den Altbestand bearbeitet seine eigene Seite).
 */
import {failureCounts,hasFailureStore,releaseHost,reopen,CLASSES,rangeWhere,dailyBoundary,DAILY_SINCE,PHASE_ORDER} from './work-failures.mjs';
import {JOBS} from './schedules.mjs';

export const SCHEDULE_LOG_KEY='schedule-log';
const KEYS=[SCHEDULE_LOG_KEY,'schedule-runs','pdf-store-runs','rule-texts-last','nacharbeit-last','ai-counts','pipeline-trace','pdf-daily-last','admin-pipeline-job','altbestand-last','altbestand-requests'];
const parse=v=>{try{return v?JSON.parse(v):null;}catch{return null;}};

/** Auftrag des Imports knapp: Zähler je Zustand statt aller Posten */
function jobBrief(job){
 if(!job)return null;
 const counts={};for(const i of job.items||[])counts[i.status]=(counts[i.status]||0)+1;
 return {id:job.id,stage:job.stage,window:job.window||null,status:job.status,paused:!!job.paused,createdAt:job.createdAt,updatedAt:job.updatedAt,counts,
  deferred:(job.items||[]).filter(i=>i.status==='deferred').slice(0,30).map(i=>({region:i.region,message:i.message})),
  failed:(job.items||[]).filter(i=>i.status==='failed'||i.status==='unknown').slice(0,30).map(i=>({region:i.region,message:i.message}))};
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
 const req=by.get('altbestand-requests')||{};
 return {at:new Date(now).toISOString(),boundary:dailyBoundary(now),since:DAILY_SINCE,phases:PHASE_ORDER,
  jobs:JOBS.map(j=>({id:j.id,label:j.label,flow:j.flow,time:j.time||null,every:j.every||null,window:j.window||null})),
  log:(by.get(SCHEDULE_LOG_KEY)||[]).slice(0,200),runs:by.get('schedule-runs')||{},
  pdfRuns:(by.get('pdf-store-runs')||[]).slice(0,12),ruleTexts:by.get('rule-texts-last'),nacharbeit:by.get('nacharbeit-last'),
  altbestand:{last:by.get('altbestand-last'),importOpen:!!req.import&&!req.import.finishedAt&&!req.import.stoppedAt,reworkOpen:!!req.rework&&!req.rework.finishedAt,ocrOpen:!!req.ocr&&!req.ocr.stoppedAt},
  aiCounts:by.get('ai-counts'),trace:by.get('pipeline-trace'),pdfDaily:by.get('pdf-daily-last'),
  importJob:jobBrief(by.get('admin-pipeline-job')),failures,hosts,internal,recent,classes:CLASSES};
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
