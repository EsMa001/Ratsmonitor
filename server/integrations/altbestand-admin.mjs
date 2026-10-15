/**
 * Seite „Altbestand“ (Admin, Debug-Bereich; Betriebsplan 15.10.2026): alles, was älter ist als der Tagesbereich (Sitzungen der
 * letzten 7 Tage, frühestens 12.10.2026) oder vorher gescheitert ist, wird nur hier auf Knopfdruck bearbeitet:
 *  - Abruf: Gebiete rückwirkend abrufen (1 bis 24 Monate), mit Extraktion und Verarbeitung der geschriebenen Berichte
 *  - Extraktion: ältere Monate laden, Anlagen laden, Text lesen (Aufträge der PDF-Ablage), OCR des Altbestands
 *  - Fehler: alte Fehler erneut versuchen (Fehlerspeicher, Bereich Altbestand), je Stufe
 *  - Verarbeitung: Regeln für geänderte Berichte, alle neu; KI-Stand
 * Die Seite liest nur system_state und den Fehlerspeicher und legt Wünsche ab ('altbestand-requests'); ausgeführt wird von den Jobs
 * „altbestand“ (scripts/altbestand.mjs), „OCR, tagsüber“ und „PDF-Aufträge“ (scripts/pdf-store/job.mjs).
 */
import {failureCounts,hasFailureStore,reopen,releaseHost,dailyBoundary,DAILY_SINCE,PHASE_ORDER,rangeWhere} from './work-failures.mjs';
import {requestPdfJob,normalizeJobs,JOB_KEY,HEARTBEAT_KEY,STATS_KEY,HEARTBEAT_STALE_MS} from './pdf-store-admin.mjs';
import {runScheduleNow,requestRuleTextsAll,SCHEDULE_RUNS_KEY} from './schedules.mjs';
import {selectedRegions} from './pipeline-jobs.mjs';

export const REQUESTS_KEY='altbestand-requests';
/** Zeiträume für den rückwirkenden Abruf */
export const BACKLOG_WINDOWS=Object.freeze(['1m','3m','12m','24m']);
const KEYS=[REQUESTS_KEY,'altbestand-last','altbestand-rework-last','rule-texts-last','ai-counts',JOB_KEY,HEARTBEAT_KEY,STATS_KEY,SCHEDULE_RUNS_KEY];
const parse=v=>{try{return v?JSON.parse(v):null;}catch{return null;}};
const bad=(msg,status=400)=>Object.assign(Error(msg),{status});

/** Alles für die Seite, nur lesend */
export async function altbestandState(db,now=Date.now()){
 const {results}=await db.prepare(`SELECT key,value FROM system_state WHERE key IN (${KEYS.map(()=>'?').join(',')})`).bind(...KEYS).all();
 const by=new Map((results||[]).map(r=>[r.key,parse(r.value)]));
 const req=by.get(REQUESTS_KEY)||{},stats=by.get(STATS_KEY),hb=by.get(HEARTBEAT_KEY),runs=by.get(SCHEDULE_RUNS_KEY)||{};
 const store=await hasFailureStore(db);
 const counts=store?await failureCounts(db,now):{missing:'0040'};
 let hosts=[];
 if(store){
  const b=rangeWhere('backlog',now);
  hosts=(await db.prepare(`SELECT h.host,h.state,h.level,h.next_try_at,h.reason,count(w.key) AS entries FROM source_hosts h JOIN work_failures w ON w.host=h.host AND ${b.sql.replaceAll('event_date','w.event_date').replaceAll('first_at','w.first_at').replaceAll('origin','w.origin')} WHERE h.state<>'ok' GROUP BY h.host ORDER BY entries DESC LIMIT 40`).bind(...b.args).all()).results||[];
 }
 const imp=req.import?{...req.import,regions:undefined,total:(req.import.regions||[]).length,done:(req.import.done||[]).length,failed:(req.import.failed||[]).length,failedRegions:(req.import.failed||[]).slice(0,40)}:null;
 return {at:new Date(now).toISOString(),boundary:dailyBoundary(now),since:DAILY_SINCE,phases:PHASE_ORDER,
  requests:{...req,import:imp},last:by.get('altbestand-last'),rework:by.get('altbestand-rework-last'),
  jobRuns:{altbestand:runs.altbestand||null,ocr:runs.ocr||null,'pdf-job':runs['pdf-job']||null},
  failures:counts,hosts,pdfJobs:normalizeJobs(by.get(JOB_KEY)),worker:!!hb&&now-Date.parse(hb.at||0)<HEARTBEAT_STALE_MS,
  store:stats?{at:stats.at,linked:stats.linked,loaded:stats.loaded,textOnly:stats.textOnly,ocrWaiting:stats.texts?.ocrWaitingAll??stats.texts?.ocrWaiting??null,others:stats.others?{linked:stats.others.linked,loaded:stats.others.loaded}:null}:null,
  ruleTexts:by.get('rule-texts-last')?{startedAt:by.get('rule-texts-last').startedAt,finishedAt:by.get('rule-texts-last').finishedAt,result:by.get('rule-texts-last').result}:null,
  aiCounts:by.get('ai-counts')};
}

async function putRequests(db,fn){
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(REQUESTS_KEY).first();
 const next=fn(parse(row?.value)||{});
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(REQUESTS_KEY,JSON.stringify(next)).run();
 return next;
}

/**
 * Wunsch ablegen. Rückgabe {ok, trigger:[Jobs, die gleich starten sollen], …}.
 *  {action:'import', regions:'sources'|[ids], window}   rückwirkend abrufen (ersetzt einen früheren Wunsch)
 *  {action:'release', host}                              wartenden Server jetzt prüfen lassen (Stichprobe)
 *  {action:'import-stop'}                                 anhalten (erledigte Gebiete bleiben erledigt)
 *  {action:'rework', phase?, reopen?}                     alte Fehler erneut versuchen; reopen: auch wartende und endgültige sofort fällig
 *  {action:'ocr'} | {action:'ocr-stop'}                   OCR des Altbestands
 *  {action:'pdf', kind:'run'|'others'|'texts'}            Auftrag der PDF-Ablage
 *  {action:'rules', all?}                                 Verarbeitung: Regeln für geänderte Berichte (oder alle neu)
 */
export async function altbestandAction(db,body,now=new Date()){
 const at=now.toISOString();
 if(body.action==='import'){
  if(!BACKLOG_WINDOWS.includes(body.window))throw bad('Bitte einen Zeitraum wählen (1, 3, 12 oder 24 Monate).');
  let ids;try{ids=selectedRegions(body.regions==='sources'?'sources':body.regions);}catch(e){throw bad(e.message||'Bitte gültige Gebiete angeben.');}
  if(!ids.length)throw bad('Keine Gebiete gewählt.');
  await putRequests(db,r=>({...r,import:{regions:ids,window:body.window,scope:body.regions==='sources'?'sources':'list',requestedAt:at,done:[],failed:[]}}));
  return {ok:true,regions:ids.length,trigger:['altbestand']};
 }
 if(body.action==='release'){if(typeof body.host!=='string'||!body.host||body.host.length>300)throw bad('Unbekannter Server.');await releaseHost(db,body.host,now.getTime());return {ok:true,trigger:['altbestand']};}
 if(body.action==='import-stop'){await putRequests(db,r=>r.import?{...r,import:{...r.import,stoppedAt:at}}:r);return {ok:true,trigger:[]};}
 if(body.action==='rework'){
  if(!await hasFailureStore(db))throw bad('Fehlerspeicher fehlt (Migration 0040).',409);
  const phase=PHASE_ORDER.includes(body.phase)?body.phase:null,cls=typeof body.cls==='string'&&/^[a-z]+$/.test(body.cls)?body.cls:null;
  const reopened=body.reopen?await reopen(db,{range:'backlog',phase,cls},now.getTime()):0;
  await putRequests(db,r=>({...r,rework:{requestedAt:at,phase}}));
  return {ok:true,reopened,trigger:['altbestand']};
 }
 if(body.action==='ocr'){await putRequests(db,r=>({...r,ocr:{requestedAt:at}}));await runScheduleNow(db,'ocr',now);return {ok:true,trigger:['ocr']};}
 if(body.action==='ocr-stop'){await putRequests(db,r=>r.ocr?{...r,ocr:{...r.ocr,stoppedAt:at}}:r);return {ok:true,trigger:[]};}
 if(body.action==='pdf'){
  if(!['run','others','texts'].includes(body.kind))throw bad('Unbekannter Auftrag.');
  const r=await requestPdfJob(db,body.kind,now);
  return {ok:true,created:r.created,reason:r.reason,trigger:['pdf-job']};
 }
 if(body.action==='rules'){
  if(body.all)await requestRuleTextsAll(db,now);else await runScheduleNow(db,'rule-texts',now);
  return {ok:true,trigger:['rule-texts']};
 }
 throw bad('Unbekannte Aktion.');
}
