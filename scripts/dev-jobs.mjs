// Dev: Knöpfe der Administration (Jobs & Zeitpläne, Themen & Texte, PDF-Import) lokal ausführen. Auf dem Server startet systemd
// die Jobs über die Auslöser-Dateien (server/integrations/job-trigger.mjs); lokal gibt es die Einheiten nicht. Dieser Takt sieht
// alle 15 s nach, ob ein Job angefordert wurde („jetzt ausführen“ in 'schedule-now' oder offene Arbeit, pendingWork), und ruft
// dann `scripts/schedule.mjs <job>` auf; „Anhalten“ ('schedule-stop') hält den lokal gestarteten Job an. Geplante Zeiten
// (etwa der nächtliche Abruf) laufen lokal nicht. Gestartet von scripts/run-framework.mjs dev, endet mit dem Dev-Server.
// Ausgabe der Jobs: tmp/dev-jobs.log. Abschalten: RM_SKIP_DEV_JOBS=1.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {JOBS,SCHEDULE_RUNS_KEY,SCHEDULE_NOW_KEY,SCHEDULE_STOP_KEY,pendingWork} from '../server/integrations/schedules.mjs';
import {databaseFile} from './pdf-store/state.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const parent=Number(process.argv[2])||process.ppid,EVERY_MS=15000;
fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
const log=fs.openSync(path.join(root,'tmp/dev-jobs.log'),'a');
const say=(...a)=>fs.writeSync(log,`${new Date().toISOString()} ${a.join(' ')}\n`);
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};

/* Nur ein Takt zur Zeit (zwei Dev-Server starten sonst Jobs doppelt) */
const lock=path.join(root,'tmp/dev-jobs.pid');
try{const pid=Number(fs.readFileSync(lock,'utf8'));if(pid&&pid!==process.pid&&alive(pid))process.exit(0);}catch{/* keine Sperre */}
fs.writeFileSync(lock,String(process.pid));
process.on('exit',()=>{try{if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock);}catch{/* schon weg */}});

const running=new Map(); // Job → {child, startedAt}
function tick(){
 if(!alive(parent)){for(const {child} of running.values())child.kill('SIGTERM');process.exit(0);}
 const file=databaseFile();if(!file)return;
 let state;
 try{
  const db=new DatabaseSync(file,{readOnly:true});
  try{db.exec('PRAGMA busy_timeout=5000');const get=key=>{const r=db.prepare('SELECT value FROM system_state WHERE key=?').get(key);try{return r?JSON.parse(r.value):null;}catch{return null;}};
   state={now:get(SCHEDULE_NOW_KEY)||{},runs:get(SCHEDULE_RUNS_KEY)||{},stop:get(SCHEDULE_STOP_KEY)||{},pending:Object.fromEntries(JOBS.map(j=>[j.id,pendingWork(j.id,get)]))};}
  finally{db.close();}
 }catch{return;} // Datenbank gerade gesperrt oder ohne Tabelle: beim nächsten Takt
 for(const job of JOBS){
  const mine=running.get(job.id);
  if(mine){
   if(state.stop[job.id]&&Date.parse(state.stop[job.id])>=mine.startedAt){say(job.id,'anhalten');mine.child.kill('SIGTERM');}
   continue;
  }
  const last=state.runs[job.id]?.lastStart,asked=state.now[job.id];
  if(!(asked&&(!last||Date.parse(asked)>Date.parse(last)))&&!state.pending[job.id])continue;
  say(job.id,'startet');
  const child=spawn(process.execPath,['--no-warnings',path.join(root,'scripts/schedule.mjs'),job.id],{cwd:root,stdio:['ignore',log,log],env:process.env});
  running.set(job.id,{child,startedAt:Date.now()});
  child.on('exit',code=>{running.delete(job.id);say(job.id,'Ende',code);});
 }
}
tick();
setInterval(tick,EVERY_MS);
