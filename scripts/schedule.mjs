// Zeitplaner der Server-Jobs (server/integrations/schedules.mjs, Admin-Reiter „Jobs & Zeitpläne“): Die Auslöser auf dem Server
// (systemd-Timer, sofort auch über die .path-Einheiten der Knöpfe) rufen alle 10 Minuten `node scripts/schedule.mjs <job>` auf. Ist der Job nach seiner Einstellung jetzt
// dran (täglich zur eingestellten Uhrzeit, nachgeholt bis 3 Stunden danach, oder alle N Minuten) oder wurde „jetzt
// ausführen“ oder eine andere Arbeit aus der Administration gewünscht (pendingWork, etwa „Stand neu zählen“; auch
// ausgeschaltet), startet er ihn im Programmordner, gibt seine Ausgabe durch, vermerkt Start, Ende, Dauer und Ergebnis
// ('schedule-runs') und endet mit dessen Exit-Code. Sonst endet er still. Ausgeschaltet: ein Vermerk „ausgelassen“, wenn der
// Job dran gewesen wäre. Läuft der Job noch (Prozess lebt), wird nichts gestartet.
//
//   node scripts/schedule.mjs <job> [--force]     --force: ohne Rücksicht auf Zeit und Schalter (von Hand)
//   node scripts/schedule.mjs --list              Jobs mit Einstellung und nächstem Start
// Datenbank: DATABASE_FILE, sonst die Miniflare-Datei unter .wrangler/.
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {JOBS,SCHEDULES_KEY,SCHEDULE_RUNS_KEY,SCHEDULE_NOW_KEY,UNITS_KEY,UNITS_EVERY_MS,unitNames,settingOf,dueNow,nextRun,pendingWork} from '../server/integrations/schedules.mjs';
import {databaseFile} from './pdf-store/state.mjs';

const args=process.argv.slice(2),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=databaseFile();
if(!file){console.error('Keine Datenbank (DATABASE_FILE oder .wrangler/).');process.exit(1);}
const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=30000');
const get=key=>{const r=db.prepare('SELECT value FROM system_state WHERE key=?').get(key);try{return r?JSON.parse(r.value):null;}catch{return null;}};
const put=(key,value)=>db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
/* Schreibsperre mit Geduld: die Verarbeitung hält die Sperre der Inhaltsdatei auch mal länger als die 30 s busy_timeout; bis zu
   6 weitere Anläufe im Abstand von 10 s, sonst stand ein Lauf als „failed“ im Journal, nur weil der Eintrag nicht ging (16.10.2026) */
const sleepSync=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
const tx=fn=>{
 for(let attempt=0;;attempt++){
  try{db.exec('BEGIN IMMEDIATE');}
  catch(e){if(attempt<6&&/locked|busy/i.test(e.message)){sleepSync(10000);continue;}throw e;}
  try{fn();db.exec('COMMIT');return;}catch(e){db.exec('ROLLBACK');throw e;}
 }
};
/* Eintrag eines Jobs in 'schedule-runs' ändern (in einer Schreibsperre: mehrere Jobs schreiben dieselbe Zeile) */
const record=(id,fn)=>tx(()=>{const all=get(SCHEDULE_RUNS_KEY)||{};all[id]=fn(all[id]||{});put(SCHEDULE_RUNS_KEY,all);});
const alive=p=>{try{process.kill(p,0);return true;}catch(e){return e.code==='EPERM';}};

if(args[0]==='--list'){
 const saved=get(SCHEDULES_KEY),runs=get(SCHEDULE_RUNS_KEY)||{};
 for(const j of JOBS){const s=settingOf(j,saved),n=nextRun(j,s,runs[j.id]);console.log(j.id.padEnd(15),s.enabled?'an ':'aus',(s.time||'alle '+s.every+' min').padEnd(12),'zuletzt',runs[j.id]?.lastStart||'–','nächster',n?new Date(n).toISOString():'–');}
 process.exit(0);
}
const job=JOBS.find(j=>j.id===args[0]);
if(!job){console.error(`Unbekannter Job. Jobs: ${JOBS.map(j=>j.id).join(', ')}`);process.exit(2);}

/* Wache über die Auslöser: einmal je 9 Minuten (egal welcher Job gerade fragt) den Zustand aller Timer und Pfade vermerken
   (UNITS_KEY). Ohne systemctl (lokal) nichts. Nur lesend auf systemd, kein Neustart: das bleibt Handarbeit, aber sichtbar. */
function unitsState(names,run=spawnSync){
 const r=run('systemctl',['is-active',...names],{encoding:'utf8',timeout:10000});
 if(r.error||typeof r.stdout!=='string')return null;
 const lines=r.stdout.trim().split('\n');
 if(lines.length!==names.length)return null;
 return Object.fromEntries(names.map((n,i)=>[n,lines[i].trim()||'unknown']));
}
try{
 const last=get(UNITS_KEY);
 if(!last?.at||Date.now()-Date.parse(last.at)>=UNITS_EVERY_MS){
  const units=unitsState(unitNames());
  if(units){
   const inactive=Object.entries(units).filter(([,v])=>v!=='active').map(([k])=>k);
   if(inactive.length&&inactive.join()!==(last?.inactive||[]).join())console.log(`${new Date().toISOString()} Auslöser inaktiv: ${inactive.join(', ')} (systemctl start …)`);
   tx(()=>put(UNITS_KEY,{at:new Date().toISOString(),units,inactive}));
  }
 }
}catch(e){console.error('Auslöser-Wache:',e.message);}
const setting=settingOf(job,get(SCHEDULES_KEY)),run=(get(SCHEDULE_RUNS_KEY)||{})[job.id]||{};
const asked=(get(SCHEDULE_NOW_KEY)||{})[job.id],now=Date.now();
const wanted=!!asked&&(!run.lastStart||Date.parse(asked)>Date.parse(run.lastStart))||pendingWork(job.id,get);
const {due}=dueNow(job,setting,run,now),force=args.includes('--force');
if(run.running?.pid&&alive(run.running.pid)){if(force||wanted)console.log(`${job.id} läuft noch (Prozess ${run.running.pid})`);db.close();process.exit(0);}
if(!force&&!wanted){
 if(!due){db.close();process.exit(0);}
 if(!setting.enabled){
  console.log(`${new Date().toISOString()} ${job.id} ausgelassen (ausgeschaltet)`);
  record(job.id,r=>({...r,lastStart:new Date(now).toISOString(),skipped:true,running:null}));
  db.close();process.exit(0);
 }
}

/* Starten: Ausgabe durchreichen, Lauf vermerken */
const started=new Date();
console.log(`${started.toISOString()} ${job.id} startet${force?' (von Hand)':wanted?' (jetzt ausführen)':''}`);
const [cmd,...rest]=job.cmd,child=spawn(cmd==='node'?process.execPath:cmd,rest,{cwd:root,stdio:'inherit',env:process.env});
record(job.id,r=>({...r,lastStart:started.toISOString(),skipped:false,trigger:force?'hand':wanted?'jetzt':'plan',running:{pid:child.pid,startedAt:started.toISOString()}}));
// Anhalten (systemctl stop): an den Job weitergeben, das Ende wird unten vermerkt
let signal='';for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{signal=sig;child.kill(sig);});
const code=await new Promise(resolve=>{child.on('error',e=>{console.error(e.message);resolve(127);});child.on('exit',(c,s)=>resolve(c??s));});
const seconds=Math.round((Date.now()-started)/1000);
record(job.id,r=>({...r,lastEnd:new Date().toISOString(),seconds,exit:code,result:signal?'stopped':code===0?'ok':'failed',running:null}));
/* Laufbuch für die Debug-Seite (system_state 'schedule-log', neueste zuerst, höchstens 400 Läufe aller Jobs): welcher Job wann lief */
try{
 tx(()=>{
  const log=get('schedule-log')||[];
  put('schedule-log',[{job:job.id,start:started.toISOString(),end:new Date().toISOString(),seconds,result:signal?'stopped':code===0?'ok':'failed',exit:code,trigger:force?'hand':wanted?'jetzt':'plan'},...log].slice(0,400));
 });
}catch(e){console.error('Laufbuch:',e.message);}
console.log(`${new Date().toISOString()} ${job.id} ${code===0?'fertig':signal?'angehalten':'mit Fehler '+code} nach ${seconds} s`);
db.close();
process.exit(typeof code==='number'?code:1);
