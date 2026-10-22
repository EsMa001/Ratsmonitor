#!/usr/bin/env node
/**
 * Betriebsprüfung (Zeitplaner-Job „betrieb“, täglich 09:30; server/integrations/ops-check.mjs hat die Schwellen, hier stehen
 * die Eingaben und der Versand): Auslöser (system_state 'systemd-units'), Läufe der Tagespipeline ('schedule-runs',
 * 'schedules'), jüngste Sicherung (BACKUP_DIR, sonst backups/ neben dem Datenordner), Platte (statfs des Datenordners),
 * Größe der Datenbank samt WAL gegen die vorige Messung. Neue Befunde gehen als eine Sammelmail über den Webdienst an
 * OPERATOR_EMAIL (scripts/operator-mail.mjs, POST /api/internal/notify); dieselbe Warnung höchstens einmal am Tag. Stand in
 * system_state 'ops-check'. Scheitert der Versand, endet das Skript mit 1 (die notify-Einheit meldet das, falls der Webdienst
 * wieder da ist) und merkt sich die Befunde nicht als gemeldet.
 *
 *   node scripts/ops-check.mjs [--dry-run] [--print]    --dry-run: nichts verschicken, nichts speichern; --print: Mailtext zeigen
 * Datenbank: DATABASE_FILE, sonst die Miniflare-Datei unter .wrangler/. Grenzen: OPS_BACKUP_HOURS, OPS_DISK_PERCENT, OPS_DB_GROWTH_GB.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {OPS_KEY,opsThresholds,opsWarnings,opsDigest,opsMail} from '../server/integrations/ops-check.mjs';
import {SCHEDULES_KEY,SCHEDULE_RUNS_KEY,UNITS_KEY} from '../server/integrations/schedules.mjs';
import {databaseFile} from './pdf-store/state.mjs';
import {sendOperatorMail} from './operator-mail.mjs';

const args=process.argv.slice(2),dryRun=args.includes('--dry-run'),print=args.includes('--print');
const file=databaseFile();
if(!file){console.error('Keine Datenbank (DATABASE_FILE oder .wrangler/).');process.exit(1);}
const now=Date.now(),abs=path.resolve(file),dataDir=path.dirname(abs);
const db=new DatabaseSync(abs);db.exec('PRAGMA busy_timeout=30000');
const get=key=>{const r=db.prepare('SELECT value FROM system_state WHERE key=?').get(key);try{return r?JSON.parse(r.value):null;}catch{return null;}};
const put=(key,value)=>db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
const size=p=>{try{return fs.statSync(p).size;}catch{return 0;}};

/* Jüngste Sicherung der Datenbank (backup.sh: ratsmonitor-<Datum>.sqlite.zst, ältere ungepackt .sqlite), nach Änderungszeit */
const backupDir=path.resolve(process.env.BACKUP_DIR||path.join(path.dirname(dataDir),'backups'));
let backupAt=null;
try{
 for(const name of fs.readdirSync(backupDir)){
  if(!/^ratsmonitor-.*\.sqlite(\.zst)?$/.test(name))continue;
  const at=fs.statSync(path.join(backupDir,name)).mtime.toISOString();
  if(!backupAt||at>backupAt)backupAt=at;
 }
}catch{/* kein Ordner: Warnung backup-none */}
/* Platte des Datenordners */
let disk=null;try{const s=fs.statfsSync(dataDir);disk={total:s.blocks*s.bsize,used:(s.blocks-s.bfree)*s.bsize};}catch{/* nicht ermittelbar */}
const dbBytes=size(abs)+size(abs+'-wal');

const state=get(OPS_KEY),thresholds=opsThresholds(process.env);
const warnings=opsWarnings({now,units:get(UNITS_KEY),runs:get(SCHEDULE_RUNS_KEY)||{},schedules:get(SCHEDULES_KEY),backupAt,disk,dbBytes,prev:state?.measure||null},thresholds);
const gbOf=b=>(b/1073741824).toFixed(1);
console.log(`${new Date(now).toISOString()} Betriebsprüfung: ${warnings.length} Befund(e); Sicherung ${backupAt||'keine'}, Platte ${disk?Math.round(disk.used/disk.total*100)+' %':'?'}, Datenbank ${gbOf(dbBytes)} GB${state?.measure?` (vorige Messung ${gbOf(state.measure.dbBytes)} GB)`:''}`);
for(const w of warnings)console.log(`  - [${w.key}] ${w.text}`);

let {fresh,state:next}=opsDigest(state,warnings,{now});
next.measure={at:new Date(now).toISOString(),dbBytes};
const mail=fresh.length?opsMail(fresh,warnings,{now,host:os.hostname()}):null;
if(print&&mail){console.log('');console.log(mail.subject);console.log(mail.message);}
let exit=0;
if(dryRun)console.log(`Probelauf: ${fresh.length} neue(r) Befund(e), nichts verschickt, nichts gespeichert.`);
else{
 if(mail){
  const result=await sendOperatorMail(mail);
  if(result.sent)console.log(`Sammelmail mit ${fresh.length} neuen Befund(en) verschickt (${result.transport||'?'}).`);
  else{
   console.error(`Sammelmail nicht verschickt: ${result.reason||'?'}`);
   // Nicht als gemeldet merken: der nächste Lauf versucht es erneut
   ({state:next}=opsDigest(state,warnings,{now,markSent:false}));next.measure={at:new Date(now).toISOString(),dbBytes};
   exit=1;
  }
 }else console.log(fresh.length===0&&warnings.length?'Alle Befunde heute schon gemeldet.':'Keine Befunde.');
 put(OPS_KEY,next);
}
db.close();
process.exit(exit);
