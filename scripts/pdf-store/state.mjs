// Gemeinsames für die Skripte der PDF-Ablage: Datenbankdatei, kleine Einträge in system_state (Fortschritt, Anhalten,
// Protokoll; Schlüssel in server/integrations/pdf-store-admin.mjs) und die Zusammenfassung eines Schritts für nightly.mjs.
// Alles hier ist Beiwerk: Gelingt ein Schreiben nicht (Datenbank gerade gesperrt), läuft das Skript trotzdem weiter.
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {PROGRESS_KEYS,STOP_KEY} from '../../server/integrations/pdf-store-admin.mjs';

/** Datenbank: DATABASE_FILE, sonst die Miniflare-Datei unter .wrangler/ (oder null) */
export function databaseFile(){
 if(process.env.DATABASE_FILE)return process.env.DATABASE_FILE;
 const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
 const local=fs.existsSync(dir)?fs.readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
 return local?dir+local:null;
}

/* Kurz öffnen, lesen oder schreiben, schließen: die Hauptdatenbank wird nebenher vom Import beschrieben */
function withDb(fn,file=databaseFile()){
 if(!file)return null;
 let db;
 try{db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=5000');return fn(db);}
 catch{return null;}
 finally{try{db?.close();}catch{/* schon zu */}}
}
export const readState=key=>withDb(db=>{const r=db.prepare('SELECT value FROM system_state WHERE key=?').get(key);return r?JSON.parse(r.value):null;});
export const writeState=(key,value)=>withDb(db=>{
 if(value===null)db.prepare('DELETE FROM system_state WHERE key=?').run(key);
 else db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
 return true;
});

/** Bahn des Fortschritts: 'chain' (Lauf und seine Schritte) oder 'ocr' (OCR-Lauf von Hand); nightly.mjs setzt RM_PROGRESS_LANE */
export const lane=(fallback='chain')=>process.env.RM_PROGRESS_LANE||fallback;
/** Fortschritt schreiben: Grundangaben des Laufs (RM_PROGRESS_BASE von nightly.mjs) und die des Schritts; null löscht */
export function progress(laneName,detail){
 if(detail===null)return writeState(PROGRESS_KEYS[laneName],null);
 let base={};try{base=JSON.parse(process.env.RM_PROGRESS_BASE||'{}');}catch{/* ohne */}
 return writeState(PROGRESS_KEYS[laneName],{...base,...detail,pid:process.pid,at:new Date().toISOString()});
}
/** Wurde die Bahn angehalten, nachdem `since` (ms) begonnen hat? */
export function stopRequested(laneName,since){
 const at=readState(STOP_KEY)?.[laneName]?.requestedAt;
 return !!at&&Date.parse(at)>=since;
}
/** Anhalten ohne Warten: fn(grund) einmal, sobald die Bahn im Admin-Reiter angehalten wird (alle STOP_POLL_MS geprüft; ohne
    laneName nicht) oder ein Signal kommt (systemctl stop, Strg+C, nightly.mjs gibt es an den Schritt weiter). Das Skript hört dann
    nach der laufenden Einheit auf (Datei, Seite) und schreibt, was fertig ist. Mit dem Handler beendet SIGTERM den Prozess nicht
    mehr sofort; ein zweites Strg+C schon. Laufende SQLite-Transaktionen und synchrone Schleifen enden so immer vollständig. */
export const STOP_POLL_MS=2000;
export function onStop(laneName,since,fn){
 let fired=false,ints=0;
 const timer=laneName?setInterval(()=>{if(stopRequested(laneName,since))fire('admin');},STOP_POLL_MS):null;
 timer?.unref();
 function fire(why){if(fired)return;fired=true;if(timer)clearInterval(timer);fn(why);}
 process.on('SIGTERM',()=>fire('SIGTERM'));
 process.on('SIGINT',()=>{if(++ints>1)process.exit(130);fire('SIGINT');});
 return ()=>{if(timer)clearInterval(timer);};
}
/** Zusammenfassung des Schritts für nightly.mjs (Datei aus RM_STEP_SUMMARY), sonst nichts */
export function stepSummary(obj){
 const file=process.env.RM_STEP_SUMMARY;if(!file)return;
 try{fs.writeFileSync(file,JSON.stringify(obj));}catch{/* nur Beiwerk */}
}
