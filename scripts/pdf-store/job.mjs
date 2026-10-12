// Aufträge aus dem Admin-Reiter „PDF-Ablage“ ausführen (server/integrations/pdf-store-admin.mjs, system_state 'pdf-store-job':
// {queue, current, recent}). Auf dem Server alle 10 Minuten per Timer (deploy/node/ratsmonitor-pdf-job.*). Je Aufruf:
//  - Lebenszeichen schreiben ('pdf-store-heartbeat'); ohne es sperrt die Seite die Knöpfe (etwa lokal, wo niemand ausführt).
//  - Einen als „läuft“ vermerkten Auftrag ohne laufende Kette (Dienst angehalten, Server neu gestartet) als abgebrochen vermerken.
//  - „Stand neu zählen“ ('pdf-store-count') erledigen: stats.mjs, auch während ein Lauf läuft.
//  - Speicher messen (scripts/server-disk.mjs, Reiter „Speicher & Sicherungen“): höchstens stündlich und auf Wunsch, die
//    Tabellen der Datenbank einmal am Tag (server/integrations/server-storage.mjs, diskDue).
//  - Den ältesten wartenden Auftrag starten (höchstens einen je Aufruf, der Dienst darf 4 Stunden laufen; der nächste kommt
//    beim nächsten Aufruf dran): 'run' Kette wie nachts (nightly.mjs), 'retry' dazu mit erneutem Versuch der
//    fehlgeschlagenen Abrufe, 'others' die übrigen PDFs (nightly.mjs --others), 'texts' nur Texte
//    aus schon abgelegten PDFs ohne Text und Auswertung, ohne OCR (nightly.mjs --texts), 'ocr' nur OCR und Auswertung
//    (nightly.mjs --ocr-only). Läuft die nächtliche Kette (Sperre
//    nightly.lock), wartet er. Während er läuft, alle 30 Sekunden Lebenszeichen und Wünsche „neu zählen“.
// Angehalten wird ein Lauf über 'pdf-store-stop' (die Skripte prüfen das selbst, nightly.mjs endet dann mit Exit-Code 3) oder
// per SIGTERM (systemctl stop); beides wird als „abgebrochen“ vermerkt.
//
//   node scripts/pdf-store/job.mjs [--budget-gb 80] [--minutes 180] [--dry-run]   (--dry-run: Kette nur als Probe)
// Datenbank: DATABASE_FILE, sonst die Miniflare-Datei unter .wrangler/; Ablage: RM_PDF_STORE.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {JOB_KEY,COUNT_KEY,HEARTBEAT_KEY,RECENT_MAX,normalizeJobs} from '../../server/integrations/pdf-store-admin.mjs';
import {DISK_KEY,DISK_COUNT_KEY,diskDue} from '../../server/integrations/server-storage.mjs';
import {databaseFile} from './state.mjs';
import {BUDGET_GB} from '../../shared/pdf-rank.mjs';

const args=process.argv.slice(2),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const file=databaseFile();
if(!file){console.error('Keine Datenbank (DATABASE_FILE oder .wrangler/).');process.exit(1);}
const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=30000');
const now=()=>new Date().toISOString();
const get=key=>{const r=db.prepare('SELECT value FROM system_state WHERE key=?').get(key);try{return r?JSON.parse(r.value):null;}catch{return null;}};
const put=(key,value)=>db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
/* Auftragsliste in einer Schreibsperre ändern (die Website ändert sie nur, wenn sie sich dazwischen nicht geändert hat);
   fn gibt die neue Liste zurück oder null für „nichts ändern“ */
const jobs=fn=>{
 db.exec('BEGIN IMMEDIATE');
 try{const next=fn(normalizeJobs(get(JOB_KEY)));if(next)put(JOB_KEY,next);db.exec('COMMIT');}
 catch(e){db.exec('ROLLBACK');throw e;}
};
const finished=(j,job,state,exit)=>({...j,current:null,recent:[{...job,state,finishedAt:now(),updatedAt:now(),exit},...j.recent].slice(0,RECENT_MAX)});

const lock=path.join(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE,'nightly.lock');
const alive=p=>{try{process.kill(p,0);return true;}catch(e){return e.code==='EPERM';}};
const chainPid=()=>{try{const p=Number(fs.readFileSync(lock,'utf8'));return p&&alive(p)?p:0;}catch{return 0;}};
let running=null;
const beat=()=>put(HEARTBEAT_KEY,{at:now(),pid:process.pid,running:running?.kind||null,chain:chainPid()||null});

/* Stand neu zählen, wenn gewünscht und noch nicht begonnen; läuft neben allem anderen */
let counting=null;
function maybeCount(){
 const c=get(COUNT_KEY);
 if(counting||!c?.requestedAt||c.startedAt)return;
 put(COUNT_KEY,{...c,startedAt:now()});
 console.log('Stand neu zählen …');
 counting=new Promise(resolve=>{
  const child=spawn(process.execPath,['--no-warnings','scripts/pdf-store/stats.mjs','--budget-gb',opt('budget-gb',String(BUDGET_GB))],{cwd:root,stdio:'inherit',env:process.env});
  child.on('exit',code=>{put(COUNT_KEY,{...get(COUNT_KEY),finishedAt:now(),ok:code===0});counting=null;resolve();});
 });
}

/* Speicher messen, wenn fällig (neben allem anderen, einer zur Zeit) */
let measuring=null;
function maybeDisk(){
 if(measuring)return;
 const count=get(DISK_COUNT_KEY),due=diskDue(get(DISK_KEY),count);
 if(!due.run)return;
 if(due.asked)put(DISK_COUNT_KEY,{...count,startedAt:now()});
 console.log(`Speicher messen${due.tables?' (mit Tabellen)':''} …`);
 measuring=new Promise(resolve=>{
  const child=spawn(process.execPath,['--no-warnings','scripts/server-disk.mjs',...(due.tables?['--tables']:[])],{cwd:root,stdio:'inherit',env:process.env});
  child.on('exit',code=>{if(due.asked)put(DISK_COUNT_KEY,{...get(DISK_COUNT_KEY),finishedAt:now(),ok:code===0});measuring=null;resolve();});
 });
}

beat();
// Verwaist: „läuft“, aber keine Kette mehr dahinter
jobs(j=>{if(!j.current||chainPid())return null;console.log(`Auftrag ${j.current.kind} lief nicht mehr, als abgebrochen vermerkt`);return finished(j,j.current,'failed','abgebrochen');});
maybeCount();maybeDisk();

const pid=chainPid();
if(pid)console.log(`Kette läuft schon (Prozess ${pid}), wartende Aufträge kommen danach dran`);
else jobs(j=>{if(!j.queue.length)return null;running={...j.queue[0],state:'running',startedAt:now(),updatedAt:now()};return {...j,queue:j.queue.slice(1),current:running};});
if(running){
 console.log(`Auftrag ${running.kind} vom ${running.requestedAt} startet`);
 beat();
 const child=spawn(process.execPath,['--no-warnings','scripts/pdf-store/nightly.mjs','--kind',running.kind,'--minutes',opt('minutes','180'),'--budget-gb',opt('budget-gb',String(BUDGET_GB)),
  ...(running.kind==='retry'?['--retry-errors']:[]),...(running.kind==='others'?['--others']:[]),...(running.kind==='texts'?['--texts']:[]),...(running.kind==='ocr'?['--ocr-only']:[]),...(args.includes('--dry-run')?['--dry-run']:[])],{cwd:root,stdio:'inherit',env:process.env});
 // Anhalten per Signal: an die Kette weitergeben, sie vermerkt den Lauf selbst als angehalten
 let signal='';for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{signal=sig;child.kill('SIGTERM');});
 const tick=setInterval(()=>{try{beat();jobs(j=>j.current?.id===running.id?{...j,current:{...j.current,updatedAt:now()}}:null);maybeCount();maybeDisk();}catch(e){console.error('Lebenszeichen:',e.message);}},30000);
 const code=await new Promise(resolve=>child.on('exit',(c,s)=>resolve(c??s)));
 clearInterval(tick);
 const stopped=!!signal||code===3;
 jobs(j=>finished(j,j.current?.id===running.id?j.current:running,code===0?'done':'failed',stopped?'abgebrochen':code));
 console.log(`Auftrag ${running.kind} ${code===0?'fertig':stopped?'abgebrochen':'mit Fehlern beendet'}`);
 running=null;
}
await counting;await measuring;
beat();
db.close();
