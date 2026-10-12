/**
 * Admin-Reiter „PDF-Ablage“ (requirements/admin-pdf-ablage-konzept.md): Stand, Fortschritt, Aufträge, Protokoll.
 * Die Ablage selbst liegt nur auf dem Node-Server (server/node/pdf-store.mjs); die Seite liest deshalb nur, was die Skripte
 * unter scripts/pdf-store/ in system_state hinterlegen, und legt dort Wünsche ab:
 *  - 'pdf-store-stats'     Stand nach dem letzten Zählen (stats.mjs)
 *  - 'pdf-store-job'       Aufträge: {queue:[…], current, recent:[…]}; ausgeführt von job.mjs (Timer alle 10 Minuten)
 *  - 'pdf-store-progress-chain' / '-ocr'  Fortschritt des laufenden Laufs bzw. OCR-Laufs (jede Minute, state.mjs)
 *  - 'pdf-store-runs'      Protokoll der letzten Läufe (nightly.mjs)
 *  - 'pdf-store-stop'      Anhalten je Bahn ('chain' Lauf, 'ocr' OCR-Lauf von Hand)
 *  - 'pdf-store-count'     Wunsch „Stand neu zählen“
 *  - 'pdf-store-heartbeat' Lebenszeichen von job.mjs; fehlt es, führt niemand Aufträge aus (etwa lokal)
 *  - 'pdf-store-errors-csv:N'  Fehlerliste als gepacktes CSV in Stücken (stats.mjs)
 * GETs lesen nur. Aufträge: 'run' (Lauf wie nachts), 'retry' (dazu fehlgeschlagene Abrufe erneut versuchen), 'others'
 * (übrige PDFs der Berichte laden, nur Textebene), 'texts' (nichts laden, Texte aus abgelegten PDFs ohne Text, OCR, Auswertung), 'ocr' (nur OCR und Auswertung). Es läuft immer nur einer; weitere warten in der Reihe.
 */
export const STATS_KEY='pdf-store-stats',JOB_KEY='pdf-store-job',RUNS_KEY='pdf-store-runs',STOP_KEY='pdf-store-stop',
 COUNT_KEY='pdf-store-count',HEARTBEAT_KEY='pdf-store-heartbeat',ERRORS_KEY='pdf-store-errors-csv',
 PROGRESS_KEYS=Object.freeze({chain:'pdf-store-progress-chain',ocr:'pdf-store-progress-ocr'}),
 JOB_KINDS=['run','retry','others','texts','ocr'],LANES=['chain','ocr'];
/** Höchstens so viele wartende Aufträge; so viele beendete bleiben in der Liste */
export const QUEUE_MAX=5,RECENT_MAX=10;
/** Fortschritt älter als das gilt als beendet (geschrieben wird jede Minute) */
export const PROGRESS_STALE_MS=3*60000;
/** Ohne Lebenszeichen so lange: niemand führt Aufträge aus (Timer alle 10 Minuten) */
export const HEARTBEAT_STALE_MS=20*60000;
/** Ein Auftrag, der so lange ohne Rückmeldung „läuft“, gilt als abgebrochen (job.mjs meldet sich jede halbe Minute) */
export const JOB_STALE_MS=30*60000;
const parse=v=>{try{return v?JSON.parse(v):null;}catch{return null;}};
const age=(at,now)=>now-Date.parse(at||0);

/** Auftragsliste; die frühere Form (ein einzelner Auftrag {kind,state,…}) wird übernommen */
export function normalizeJobs(v){
 if(v&&Array.isArray(v.queue))return {queue:v.queue,current:v.current||null,recent:Array.isArray(v.recent)?v.recent:[]};
 if(v?.kind){
  const job={id:v.id||v.requestedAt,...v};
  if(v.state==='waiting')return {queue:[job],current:null,recent:[]};
  if(v.state==='running')return {queue:[],current:job,recent:[]};
  return {queue:[],current:null,recent:[job]};
 }
 return {queue:[],current:null,recent:[]};
}
/** Läuft der Auftrag noch (Rückmeldung nicht zu alt)? */
export const active=(job,now=Date.now())=>!!job&&job.state==='running'&&age(job.updatedAt||job.startedAt||job.requestedAt,now)<JOB_STALE_MS;

/** Stand, Fortschritt, Aufträge, Protokoll (nur lesen) */
export async function pdfStoreState(db,now=Date.now()){
 const keys=[STATS_KEY,JOB_KEY,RUNS_KEY,STOP_KEY,COUNT_KEY,HEARTBEAT_KEY,PROGRESS_KEYS.chain,PROGRESS_KEYS.ocr];
 const {results}=await db.prepare(`SELECT key,value FROM system_state WHERE key IN (${keys.map(()=>'?').join(',')})`).bind(...keys).all();
 const by=new Map(results.map(r=>[r.key,parse(r.value)]));
 const jobs=normalizeJobs(by.get(JOB_KEY));
 if(jobs.current&&!active(jobs.current,now))jobs.current={...jobs.current,state:'stale'};
 const progress=Object.fromEntries(LANES.map(l=>{const p=by.get(PROGRESS_KEYS[l]);return [l,p&&age(p.at,now)<PROGRESS_STALE_MS?p:null];}));
 const heartbeat=by.get(HEARTBEAT_KEY)||null;
 return {stats:by.get(STATS_KEY)||null,jobs,progress,runs:by.get(RUNS_KEY)||[],stop:by.get(STOP_KEY)||{},count:by.get(COUNT_KEY)||null,
  heartbeat,worker:!!heartbeat&&age(heartbeat.at,now)<HEARTBEAT_STALE_MS};
}

/* Lesen und nur schreiben, wenn sich der Wert dazwischen nicht geändert hat (job.mjs nimmt gerade einen Auftrag); sonst
   noch einmal. fn gibt den neuen Wert zurück oder undefined für „nichts ändern“. */
async function change(db,key,fn){
 for(let i=0;i<5;i++){
  const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(key).first();
  const old=row?.value??null,next=fn(parse(old));
  if(next===undefined)return parse(old);
  const value=JSON.stringify(next);
  const r=old===null
   ?await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING').bind(key,value).run()
   :await db.prepare('UPDATE system_state SET value=? WHERE key=? AND value=?').bind(value,key,old).run();
  if(r.meta?.changes)return next;
 }
 throw Object.assign(Error('Die Auftragsliste ändert sich gerade, bitte noch einmal versuchen.'),{status:409});
}
const bad=msg=>Object.assign(Error(msg),{status:400});

/** Auftrag anstellen. Dieselbe Art direkt hintereinander wird nicht doppelt angestellt (created:false). */
/** Auftrag anlegen; dieselbe Art nie doppelt: läuft oder wartet sie schon, kein neuer (created:false, reason 'running'|'waiting') */
export async function requestPdfJob(db,kind,now=new Date()){
 if(!JOB_KINDS.includes(kind))throw bad('Unbekannter Auftrag.');
 let created=false,reason=null;
 const jobs=await change(db,JOB_KEY,v=>{
  const j=normalizeJobs(v);
  if(j.current?.state==='running'&&j.current.kind===kind){reason='running';return undefined;}
  if(j.queue.some(x=>x.kind===kind)){reason='waiting';return undefined;}
  if(j.queue.length>=QUEUE_MAX)throw Object.assign(Error(`Es warten schon ${QUEUE_MAX} Aufträge.`),{status:409});
  created=true;
  return {...j,queue:[...j.queue,{id:now.getTime().toString(36)+Math.random().toString(36).slice(2,6),kind,state:'waiting',requestedAt:now.toISOString()}]};
 });
 return {jobs:normalizeJobs(jobs),created,reason};
}
/** Wartenden Auftrag aus der Reihe nehmen */
export async function removePdfJob(db,id){
 if(typeof id!=='string'||!id)throw bad('Unbekannter Auftrag.');
 const jobs=await change(db,JOB_KEY,v=>{const j=normalizeJobs(v);return j.queue.some(x=>x.id===id)?{...j,queue:j.queue.filter(x=>x.id!==id)}:undefined;});
 return {jobs:normalizeJobs(jobs)};
}
/** Lauf ('chain') oder OCR-Lauf ('ocr') anhalten: die Skripte prüfen das alle 2 s (onStop in state.mjs) und hören sofort auf,
    ohne Verlust (Abrufe bleiben offen, halb gelesene Dateien in der Reihe) */
export async function requestStop(db,lane,now=new Date()){
 if(!LANES.includes(lane))throw bad('Unbekannter Vorgang.');
 const stop=await change(db,STOP_KEY,v=>({...(v||{}),[lane]:{requestedAt:now.toISOString()}}));
 return {stop};
}
/** Stand neu zählen (stats.mjs, etwa eine Minute; auch während eines Laufs) */
export async function requestCount(db,now=new Date()){
 const count={requestedAt:now.toISOString()};
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(COUNT_KEY,JSON.stringify(count)).run();
 return {count};
}

/** Fehlerliste als CSV-Text oder null (Stücke 'pdf-store-errors-csv:0' …, gzip, base64; geschrieben von stats.mjs) */
export async function errorsCsv(db){
 const {results}=await db.prepare('SELECT key,value FROM system_state WHERE key LIKE ?').bind(ERRORS_KEY+':%').all();
 if(!results.length)return null;
 const b64=results.map(r=>[Number(r.key.slice(ERRORS_KEY.length+1)),r.value]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join('');
 const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
 return new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
