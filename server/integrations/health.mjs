/**
 * GET /api/health (app/api/health/route.ts): Erreichbarkeitsprüfung für einen externen Uptime-Dienst, ohne Konto, ohne
 * Stufe, ohne Schreiben (docs/betrieb/node-server.md, „Betriebsüberwachung“). Antwortet 200, wenn die Datenbank eine
 * billige Abfrage beantwortet, sonst 503. Dazu der Datenstand (data_revisions), das Alter der letzten Sicherung und des
 * letzten nächtlichen Abrufs aus den Vermerken des Zeitplaners (system_state 'schedule-runs') und der Speichermessung
 * ('server-disk'). Keine Personendaten, keine Pfade, keine Fehlertexte aus der Datenbank (die Route ist öffentlich).
 */
import {SCHEDULE_RUNS_KEY} from './schedules.mjs';
import {DISK_KEY} from './server-storage.mjs';

export const HEALTH_HEADERS=Object.freeze({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
const parse=v=>{try{return v?JSON.parse(v):null;}catch{return null;}};
const iso=ms=>new Date(ms).toISOString();
/** Zeitpunkt und Alter in Stunden (eine Nachkommastelle); null ohne Zeitpunkt */
export function age(at,now){
 const t=at?Date.parse(at):NaN;
 if(!Number.isFinite(t))return null;
 return {at:iso(t),ageHours:Math.max(0,Math.round((now-t)/360000)/10)};
}
/** Das jüngste von mehreren Zeitpunkten */
const latest=(...ats)=>ats.filter(a=>a&&Number.isFinite(Date.parse(a))).sort().at(-1)||null;

/**
 * {status, body} für die Antwort. db: D1-artiger Zugriff (prepare/bind/first/all). Jeder Teil nach der Grundprüfung ist
 * freiwillig: fehlt eine Tabelle oder ein Vermerk, bleibt er null, die Antwort bleibt 200.
 */
export async function healthReport(db,{now=Date.now()}={}){
 const down={status:503,body:{ok:false,at:iso(now),database:false}};
 if(!db)return down;
 try{
  const row=await db.prepare('SELECT 1 AS ok').first();
  if(!row||Number(row.ok)!==1)return down;
 }catch{return down;}
 const body={ok:true,at:iso(now),database:true,revisions:null,backup:null,import:null};
 try{
  const {results}=await db.prepare('SELECT id,revision FROM data_revisions').all();
  body.revisions=Object.fromEntries((results||[]).map(r=>[String(r.id),Number(r.revision)]));
 }catch{/* Migration 0004 fehlt */}
 try{
  const {results}=await db.prepare('SELECT key,value FROM system_state WHERE key IN (?,?)').bind(SCHEDULE_RUNS_KEY,DISK_KEY).all();
  const by=new Map((results||[]).map(r=>[r.key,parse(r.value)]));
  const runs=by.get(SCHEDULE_RUNS_KEY)||{},disk=by.get(DISK_KEY);
  const okEnd=id=>runs[id]?.result==='ok'?runs[id].lastEnd:null;
  // Sicherung: Ende des Jobs „Sichern“ oder die jüngste Datenbanksicherung der Speichermessung (nur ihr Zeitpunkt)
  const backups=Array.isArray(disk?.backups?.list)?disk.backups.list.filter(b=>b?.kind==='Datenbank').map(b=>b.at):[];
  body.backup=age(latest(okEnd('backup'),...backups),now);
  // Abruf: nächtlicher Lauf oder Abrufaufträge aus der Administration
  body.import=age(latest(okEnd('import-nightly'),okEnd('import')),now);
 }catch{/* ohne Vermerke */}
 return {status:200,body};
}
