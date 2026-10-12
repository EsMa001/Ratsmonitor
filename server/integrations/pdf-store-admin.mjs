/**
 * Admin-Reiter „PDF-Ablage“: Stand der Ablage und Aufträge für einen Lauf von Hand.
 * Die Ablage selbst liegt nur auf dem Node-Server (server/node/pdf-store.mjs); die Seite liest deshalb nur, was die Skripte in
 * system_state hinterlegen: 'pdf-store-stats' (scripts/pdf-store/stats.mjs, nach jedem Lauf) und 'pdf-store-job' (Auftrag).
 * Ein Auftrag wird nur angelegt; ausgeführt wird er von scripts/pdf-store/job.mjs (Timer alle 10 Minuten auf dem Server,
 * lokal von Hand). Arten: 'run' (Lauf wie nachts), 'retry' (dazu fehlgeschlagene Abrufe erneut versuchen) und 'others'
 * (übrige PDFs der Berichte laden, nur Textebene).
 */
export const STATS_KEY='pdf-store-stats',JOB_KEY='pdf-store-job',JOB_KINDS=['run','retry','others'];
const parse=v=>{try{return v?JSON.parse(v):null;}catch{return null;}};
// Ein Auftrag, der so lange ohne Rückmeldung „läuft“, gilt als abgebrochen (der Lauf dauert höchstens drei Stunden)
const STALE_MS=4*3600000;
export const active=job=>!!job&&(job.state==='waiting'||job.state==='running'&&Date.now()-Date.parse(job.updatedAt||job.requestedAt)<STALE_MS);

/** Stand und Auftrag (nur lesen) */
export async function pdfStoreState(db){
 const {results}=await db.prepare('SELECT key,value FROM system_state WHERE key IN (?,?)').bind(STATS_KEY,JOB_KEY).all();
 const by=new Map(results.map(r=>[r.key,parse(r.value)]));
 return {stats:by.get(STATS_KEY)||null,job:by.get(JOB_KEY)||null};
}

/** Auftrag anlegen, wenn keiner wartet oder läuft; sonst den laufenden zurückgeben */
export async function requestPdfJob(db,kind,now=new Date()){
 if(!JOB_KINDS.includes(kind))throw Object.assign(Error('Unbekannter Auftrag.'),{status:400});
 const {job}=await pdfStoreState(db);
 if(active(job))return {job,created:false};
 const next={kind,state:'waiting',requestedAt:now.toISOString(),updatedAt:now.toISOString()};
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(JOB_KEY,JSON.stringify(next)).run();
 return {job:next,created:true};
}
