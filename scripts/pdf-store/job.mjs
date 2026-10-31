// Aufträge aus dem Admin-Reiter „PDF-Ablage“ ausführen (server/integrations/pdf-store-admin.mjs, system_state 'pdf-store-job':
// {queue, running:{chain,ocr}, recent}). Auf dem Server alle 10 Minuten per Timer und sofort per Knopf (deploy/node/ratsmonitor-pdf-job.*).
// Zwei Bahnen laufen nebeneinander, je Bahn ein Auftrag zur Zeit (laneOf): „Laden“ ('run' Kette wie nachts, 'retry' dazu mit
// erneutem Versuch der fehlgeschlagenen Abrufe, 'others' die übrigen PDFs, 'texts' nur Texte aus schon abgelegten PDFs,
// 'index'/'index-full' Dokumentindex der Dokumentsuche weiter- bzw. neu bauen) und
// „OCR“ ('ocr', nightly.mjs --ocr-only). Je Aufruf:
//  - Lebenszeichen schreiben ('pdf-store-heartbeat'); ohne es sperrt die Seite die Knöpfe (etwa lokal, wo niemand ausführt).
//  - Einen als „läuft“ vermerkten Auftrag, hinter dem keine Sperre seiner Bahn mehr steht (Dienst angehalten, Server neu
//    gestartet), als abgebrochen vermerken.
//  - „Stand neu zählen“ ('pdf-store-count') erledigen: stats.mjs, auch während ein Lauf läuft.
//  - Speicher messen (scripts/server-disk.mjs, Reiter „Speicher & Sicherungen“): höchstens stündlich und auf Wunsch, die
//    Tabellen der Datenbank einmal am Tag (server/integrations/server-storage.mjs, diskDue).
//  - Je freie Bahn den ältesten wartenden Auftrag dieser Bahn starten. Frei ist eine Bahn, wenn hier nichts in ihr läuft und
//    niemand ihre Sperre hält (LANE_LOCKS; die Nachtkette hält die der Bahn „Laden“). Der Dienst bleibt, solange etwas läuft,
//    und startet alle 30 Sekunden, was in einer frei gewordenen Bahn wartet; ein Auftrag startet nur, wenn er in der Restzeit
//    des Dienstes (--service-minutes, Standard 720, wie TimeoutStartSec) fertig wird, sonst beim nächsten Aufruf.
// Angehalten wird eine Bahn über 'pdf-store-stop' (die Skripte prüfen das selbst, nightly.mjs endet dann mit Exit-Code 3), der
// ganze Dienst per SIGTERM (systemctl stop); beides wird als „abgebrochen“ vermerkt.
//
//   node scripts/pdf-store/job.mjs [--budget-gb 80] [--minutes 180] [--service-minutes 720] [--dry-run]   (--dry-run: Kette nur als Probe)
// Datenbank: DATABASE_FILE, sonst die Miniflare-Datei unter .wrangler/; Ablage: RM_PDF_STORE.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {JOB_KEY,COUNT_KEY,HEARTBEAT_KEY,RECENT_MAX,LANES,LANE_LOCKS,laneOf,normalizeJobs} from '../../server/integrations/pdf-store-admin.mjs';
import {DISK_KEY,DISK_COUNT_KEY,diskDue} from '../../server/integrations/server-storage.mjs';
import {databaseFile} from './state.mjs';
import {BUDGET_GB} from '../../shared/pdf-rank.mjs';
import {SCHEDULE_NOW_KEY,slotAt} from '../../server/integrations/schedules.mjs';
import {triggerJob} from '../../server/integrations/job-trigger.mjs';

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
const finished=(j,lane,job,state,exit)=>({...j,running:{...j.running,[lane]:null},recent:[{...job,state,finishedAt:now(),updatedAt:now(),exit},...j.recent].slice(0,RECENT_MAX)});

const store=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE;
const alive=p=>{try{process.kill(p,0);return true;}catch(e){return e.code==='EPERM';}};
/** Prozess, der die Sperre der Bahn hält, oder 0 */
const lanePid=lane=>{try{const p=Number(fs.readFileSync(path.join(store,LANE_LOCKS[lane]),'utf8'));return p&&alive(p)?p:0;}catch{return 0;}};
const children={};
const beat=()=>put(HEARTBEAT_KEY,{at:now(),pid:process.pid,running:Object.fromEntries(LANES.map(l=>[l,children[l]?.job.kind||null])),
 chain:lanePid('chain')||null,ocr:lanePid('ocr')||null});

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

const started=Date.now(),serviceMs=Number(opt('service-minutes',720))*60000,jobMinutes=Number(opt('minutes','180'));
/* Bestandsfenster (Betriebsplan 15.10.2026): Aufträge laufen von 10:00 bis 22:00 Uhr; --no-window hebt es auf (von Hand) */
const BACKLOG_WINDOW=['10:00','22:00'];
const inBacklogWindow=(t=Date.now())=>args.includes('--no-window')||t>=slotAt(t,BACKLOG_WINDOW[0])&&t<slotAt(t,BACKLOG_WINDOW[1])-30*60000;
const hasFailures=!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='work_failures'").get();
let stopping='';
/* Auftrag in seiner Bahn starten: Kette (nightly.mjs) als Kindprozess; am Ende als fertig, mit Fehlern oder abgebrochen vermerkt */
function run(lane,job){
 console.log(`Auftrag ${job.kind} vom ${job.requestedAt} startet (Bahn ${lane==='ocr'?'OCR':'Laden'})`);
 const child=spawn(process.execPath,['--no-warnings','scripts/pdf-store/nightly.mjs','--kind',job.kind,'--minutes',String(jobMinutes),'--budget-gb',opt('budget-gb',String(BUDGET_GB)),
  ...(job.kind==='retry'?['--retry-errors']:[]),...(job.kind==='others'?['--others']:[]),...(job.kind==='texts'?['--texts']:[]),...(job.kind==='ocr'?['--ocr-only']:[]),
  ...(job.kind==='index'?['--index']:[]),...(job.kind==='index-full'?['--index','--full']:[]),
  ...(args.includes('--no-window')?[]:['--until',BACKLOG_WINDOW[1]]),...(args.includes('--dry-run')?['--dry-run']:[])],{cwd:root,stdio:'inherit',env:process.env});
 const done=new Promise(resolve=>child.on('exit',(c,s)=>resolve(c??s))).then(code=>{
  const stopped=!!stopping||code===3;
  jobs(j=>finished(j,lane,j.running[lane]?.id===job.id?j.running[lane]:job,code===0?'done':'failed',stopped?'abgebrochen':code));
  console.log(`Auftrag ${job.kind} ${code===0?'fertig':stopped?'abgebrochen':'mit Fehlern beendet'}`);
  delete children[lane];
 });
 children[lane]={job,child,done};
}
/* Je freie Bahn den ältesten wartenden Auftrag dieser Bahn starten (nicht, wenn er in der Restzeit des Dienstes nicht fertig würde) */
function startNext(){
 if(stopping||Date.now()-started+(jobMinutes+10)*60000>serviceMs)return;
 for(const lane of LANES){
  if(children[lane])continue;
  const pid=lanePid(lane);
  if(pid){continue;}
  // Bestandsaufbau nur im Fenster 10:00 bis 22:00 Uhr (die Nacht gehört der Tagespipeline), mindestens 30 Minuten vor Schluss;
  // „Fehlgeschlagene erneut versuchen“ und „OCR starten“ übergeben nur und gehen immer
  const open=inBacklogWindow();
  let job=null;
  jobs(j=>{
   if(j.running[lane])return null;
   const i=j.queue.findIndex(x=>laneOf(x.kind)===lane&&(open||x.kind==='ocr'||x.kind==='retry'&&hasFailures));if(i<0)return null;
   job={...j.queue[i],state:'running',startedAt:now(),updatedAt:now()};
   return {...j,queue:j.queue.filter((_,k)=>k!==i),running:{...j.running,[lane]:job}};
  });
  if(!job)continue;
  // „Fehlgeschlagene erneut versuchen“ mit Fehlerspeicher (Migration 0040): kein eigener Ladelauf mehr, sondern alle
  // wiederholbaren Abruffehler (vorübergehend, blockiert, verweigert) und wartenden Server sind sofort fällig; die Nacharbeit
  // arbeitet sie in ihren Läufen ab (je Server erst eine Stichprobe). Endgültige Fehler (404, kein PDF) bleiben.
  if(job.kind==='retry'&&hasFailures){
   // Die alten Abruffehler gehören fast alle zum Altbestand: „Alte Fehler erneut versuchen“ des Jobs „altbestand“ anfordern
   const at=now();
   const n=db.prepare("UPDATE work_failures SET next_try_at=?,tries=0 WHERE step IN ('pdf','ocr-fetch') AND class IN ('transient','denied','blocked')").run(at).changes;
   const h=db.prepare("UPDATE source_hosts SET next_try_at=?,state=CASE WHEN state='pruefen' THEN 'gesperrt' ELSE state END,updated_at=? WHERE state<>'ok'").run(at,at).changes;
   put('altbestand-requests',{...(get('altbestand-requests')||{}),rework:{requestedAt:at,by:'PDF-Import'}});
   jobs(j=>finished(j,lane,job,'done',`${n} Einträge und ${h} Server an den Altbestand übergeben`));
   console.log(`Auftrag retry: ${n} Einträge und ${h} Server sofort fällig; Altbestand „Alte Fehler erneut versuchen“ angefordert`);
   triggerJob('altbestand').catch(()=>{});triggerJob('nacharbeit').catch(()=>{});
   continue;
  }
  // Die OCR hat seit dem Betriebsplan (15.10.2026) einen eigenen Job mit eigener Einheit („ocr“, schedules.mjs): der Knopf
  // „OCR starten“ fordert ihn nur an; so trifft Anhalten nur die OCR, nicht den Ladeauftrag
  if(lane==='ocr'){
   // „OCR des Altbestands“: Anforderung für den Job „OCR, tagsüber“, der nach dem Tagesbereich den Altbestand liest (10 bis 22 Uhr)
   const now_=now();
   put('altbestand-requests',{...(get('altbestand-requests')||{}),ocr:{requestedAt:now_,by:'PDF-Import'}});
   put(SCHEDULE_NOW_KEY,{...(get(SCHEDULE_NOW_KEY)||{}),ocr:now_});
   jobs(j=>finished(j,lane,job,'done','an den Job „OCR, tagsüber“ übergeben (Altbestand angefordert)'));
   console.log('Auftrag ocr: OCR des Altbestands angefordert, Job „OCR, tagsüber“ übernimmt');
   triggerJob('ocr').catch(()=>{});
   continue;
  }
  run(lane,job);
 }
}

beat();
// Verwaist: „läuft“, aber keine Sperre seiner Bahn mehr dahinter (hier läuft beim Start noch nichts)
jobs(j=>{
 let next=null;
 for(const lane of LANES){const job=(next||j).running[lane];if(!job||lanePid(lane))continue;console.log(`Auftrag ${job.kind} lief nicht mehr, als abgebrochen vermerkt`);next=finished(next||j,lane,job,'failed','abgebrochen');}
 return next;
});
maybeCount();maybeDisk();
for(const lane of LANES){const pid=lanePid(lane);if(pid)console.log(`Bahn ${lane==='ocr'?'OCR':'Laden'} belegt (Prozess ${pid}), ihre Aufträge kommen danach dran`);}
startNext();
// Anhalten per Signal: an alle Läufe weitergeben, sie vermerken sich selbst als angehalten; nichts Neues mehr starten
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{stopping=sig;for(const c of Object.values(children))c.child.kill('SIGTERM');});
// Solange etwas läuft: alle 30 Sekunden Lebenszeichen, Rückmeldung der laufenden Aufträge, Wünsche, frei gewordene Bahnen
while(Object.keys(children).length){
 await Promise.race([...Object.values(children).map(c=>c.done),new Promise(r=>setTimeout(r,30000))]);
 try{
  beat();
  jobs(j=>{let n=null;for(const lane of LANES){const c=children[lane];if(c&&j.running[lane]?.id===c.job.id)n={...(n||j),running:{...(n||j).running,[lane]:{...j.running[lane],updatedAt:now()}}};}return n;});
  maybeCount();maybeDisk();startNext();
 }catch(e){console.error('Lebenszeichen:',e.message);}
}
await counting;await measuring;
beat();
db.close();
