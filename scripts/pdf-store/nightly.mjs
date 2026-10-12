// Nächtliche Kette der PDF-Ablage (docs/betrieb/node-server.md, „PDF-Ablage, Texte, Fakten“): jede Stufe liest nur, was die
// vorige abgelegt hat, und fasst nur Neues an. Reihenfolge fest:
//   1. fetch.mjs      Hauptdokumente laden, Monat für Monat ab heute zurück (neue Sitzungen zuerst), mit fester Grenze
//                     --budget-gb (PDFs und Texte): ist sie erreicht, verdrängt eine neue Datei die schlechteste, wenn sie
//                     besser ist (Rang shared/pdf-rank.mjs), sonst fliegt sie selbst raus; der Text bleibt immer (Scans per OCR)
//   2. budget.mjs     nur zur Sicherung, wenn die Ablage trotzdem über der Grenze liegt (etwa nach einer gesenkten Grenze)
//   3. text.mjs       Textebene der neuen PDFs
//   4. text.mjs --ocr Seiten ohne Textebene (der langsame Teil; was nicht fertig wird, kommt in der nächsten Nacht)
//   5. summaries.mjs  Regel-Zusammenfassung für Berichte ohne, deren Text jetzt vorliegt
//   6. facts.mjs      Fakten für plenara.X (alle Berichte, wenige Minuten)
//   7. refresh-search-words.mjs  Wortliste nachführen (neue Zusammenfassungen ändern den Suchtext)
//   8. stats.mjs      Stand für den Admin-Reiter „PDF-Ablage“ (system_state 'pdf-store-stats')
// Fehlgeschlagene Abrufe werden nicht erneut versucht, außer mit --retry-errors (Auftrag „Fehlgeschlagene erneut versuchen“
// im Admin-Reiter, scripts/pdf-store/job.mjs).
// --others (Auftrag „Übrige PDFs laden“): eigener Lauf für die übrigen PDFs der Berichte (fetch.mjs --others), nur Laden,
// Textebene und Stand, kein OCR, keine Zusammenfassungen und Fakten (die lesen nur Hauptdokumente); Laden bekommt die ganze
// Zeit bis auf 15 min. Dieselbe Sperre: nie zugleich mit dem normalen Lauf.
// --texts (Auftrag „Texte erstellen“): nichts laden, nur aus den schon abgelegten PDFs ohne Text die Textebene lesen, dann
// Zusammenfassungen, Fakten, Wortliste und Stand wie nachts; keine OCR (die hält auf; dafür „OCR starten“ oder die Nacht).
// --ocr-only (Auftrag „OCR starten“): keine Textebene, OCR mit der ganzen Zeit bis auf die Reserve, dann Auswertung.
// Admin-Reiter (state.mjs): Fortschritt je Schritt (die Schritte schreiben ihren eigenen jede Minute dazu), Protokoll des Laufs
// am Ende ('pdf-store-runs', höchstens 50 Läufe, mit Zeit und Zusammenfassung je Schritt), Anhalten vor jedem Schritt (die
// Schritte selbst prüfen jede Minute); angehalten endet der Lauf mit Exit-Code 3. --kind: Art im Protokoll (job.mjs setzt sie).
// Eine Sperre (nightly.lock in der Ablage) verhindert zwei Läufe zugleich. Scheitert eine Stufe, laufen die übrigen weiter;
// der Exit-Code ist dann 1. Zeit: --minutes (Standard 180) für alles; Laden höchstens --fetch-share (0.4) davon, OCR bekommt,
// was bis auf --reserve (25 min für 5 bis 7) übrig ist.
//
//   node scripts/pdf-store/nightly.mjs [--minutes 180] [--budget-gb 100] [--months 240] [--ocr-workers 2] [--retry-errors] [--start-month JJJJ-MM] [--others|--texts|--ocr-only] [--kind nightly|run|retry|others|texts|ocr] [--dry-run]
// Umgebung: DATABASE_FILE (Server), RM_PDF_STORE (Ablage), OCR_TOOLS/OCR_CACHE (text.mjs).
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {usedBytes} from './store-lib.mjs';
import {progress,stopRequested,readState,writeState} from './state.mjs';
import {RUNS_KEY,STATS_KEY} from '../../server/integrations/pdf-store-admin.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const minutes=Number(opt('minutes',180)),budgetGb=Number(opt('budget-gb',100)),months=Number(opt('months',240));
const fetchShare=Number(opt('fetch-share',0.4)),reserve=Number(opt('reserve',25)),ocrWorkers=Number(opt('ocr-workers',2));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE;
const t0=Date.now(),left=()=>minutes-(Date.now()-t0)/60000,stamp=()=>new Date().toISOString().slice(0,19).replace('T',' ');
const say=(...a)=>console.log(stamp(),...a);

/* Sperre: Datei mit der Prozessnummer; eine verwaiste Sperre (Prozess läuft nicht mehr) wird übernommen */
fs.mkdirSync(dir,{recursive:true});
const lock=path.join(dir,'nightly.lock');
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};
try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}
catch{
 const pid=Number(fs.readFileSync(lock,'utf8'));
 if(pid&&alive(pid)){say(`läuft schon (Prozess ${pid}), nichts zu tun`);process.exit(0);}
 fs.writeFileSync(lock,String(process.pid));say(`verwaiste Sperre von Prozess ${pid} übernommen`);
}
const release=()=>{try{if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock);}catch{/* schon weg */}};
/* Anhalten per Signal (systemctl stop, Knopf „Anhalten“ im Reiter Jobs & Zeitpläne): an den laufenden Schritt weitergeben, Lauf
   als angehalten vermerken, sauber enden (Exit 3). Die Schritte laufen asynchron, damit das Signal sofort ankommt. */
let child=null;
process.on('exit',release);for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{try{child?.kill('SIGTERM');}catch{/* schon weg */}finish('stopped');release();process.exit(3);});

const sizeGb=()=>{const s=openPdfStore(dir);try{return usedBytes(s)/1073741824;}finally{s.close();}};
const failed=[],steps=[],dry=flag('dry-run'),kind=opt('kind','nightly');
const base={kind,startedAt:new Date(t0).toISOString(),until:new Date(t0+minutes*60000).toISOString()};
const summaryFile=path.join(dir,`step-summary-${process.pid}.json`);
let stopped=false,finished=false,plan=[],stepIndex=0;
/* Fortschritt für den Balken im Admin-Reiter: geplante Schritte (plan), laufender Schritt (stepIndex), Beginn und Zeitgrenze des
   Schritts (aus --max-minutes); die Schritte schreiben ihr done/total dazu */
async function step(name,script,stepArgs){
 const cmd=[process.execPath,'--no-warnings','--max-old-space-size=4096',path.join(root,script),...stepArgs];
 if(dry){say('[Probe]',name+':',cmd.slice(3).join(' '));return;}
 if(stopped||(stopped=stopRequested('chain',t0))){say(`${name} übersprungen (angehalten)`);return;}
 const at=plan.indexOf(name);if(at>=0)stepIndex=at;
 const lim=stepArgs.includes('--max-minutes')?Number(stepArgs[stepArgs.indexOf('--max-minutes')+1]):0,now=Date.now();
 const stepBase={...base,plan,stepIndex,stepStartedAt:new Date(now).toISOString(),...(lim?{stepUntil:new Date(now+lim*60000).toISOString()}:{})};
 say(`${name} …`);progress('chain',{...stepBase,step:name});
 try{fs.unlinkSync(summaryFile);}catch{/* keine */}
 const t=Date.now();
 const r=await new Promise(resolve=>{
  child=spawn(cmd[0],cmd.slice(1),{cwd:root,stdio:'inherit',env:{...process.env,RM_PROGRESS_LANE:'chain',RM_PROGRESS_BASE:JSON.stringify(stepBase),RM_STEP_SUMMARY:summaryFile}});
  child.on('error',e=>{say(`${name}: ${e.message}`);resolve({status:127,signal:null});});
  child.on('exit',(status,signal)=>resolve({status,signal}));
 });
 child=null;
 const sec=Math.round((Date.now()-t)/1000);
 let summary=null;try{summary=JSON.parse(fs.readFileSync(summaryFile,'utf8'));fs.unlinkSync(summaryFile);}catch{/* Schritt ohne Zusammenfassung */}
 steps.push({name,seconds:sec,ok:r.status===0,summary});
 if(summary?.stopped)stopped=true;
 if(r.status===0)say(`${name} fertig (${sec} s)`);else{failed.push(name);say(`${name} FEHLER (Exit ${r.status??r.signal}, ${sec} s), weiter mit der nächsten Stufe`);}
}
/* Protokoll des Laufs und Fortschritt löschen (einmal, auch beim Anhalten per Signal) */
function finish(result){
 if(finished||dry)return;finished=true;
 let gb=null;try{gb=Math.round(sizeGb()*10)/10;}catch{/* Ablage gerade nicht lesbar */}
 /* Qualität nach dem Lauf aus der letzten Zählung (Schritt „Stand“; fehlt er, die vorige): Ø Score der Ablage und Anteil der
    Hauptdokumente mit Text */
 let quality=null;try{const st=readState(STATS_KEY);if(st)quality={score:st.quality?.avg??null,text:st.linked?Math.round((st.texts?.linked||0)/st.linked*1000)/1000:null,at:st.at,thisRun:st.at>=base.startedAt};}catch{/* ohne */}
 const run={...base,finishedAt:new Date().toISOString(),result,failed,steps,sizeGb:gb,quality};
 writeState(RUNS_KEY,[run,...(readState(RUNS_KEY)||[])].slice(0,50));
 progress('chain',null);
}

const others=flag('others'),ocrOnly=!others&&flag('ocr-only'),texts=!others&&(ocrOnly||flag('texts'));
const TAIL=['Zusammenfassungen','Fakten','Wortliste','Stand'];
plan=others?['Laden','Textebene','Stand']:ocrOnly?['OCR',...TAIL]:texts?['Textebene',...TAIL]:['Laden','Textebene','OCR',...TAIL];
say(`Start${others?' (übrige PDFs)':ocrOnly?' (nur OCR)':texts?' (nur Texte aus vorhandenen PDFs)':''}: Ablage ${dir}, ${sizeGb().toFixed(1)} GB (PDFs und Texte), feste Grenze ${budgetGb} GB, ${minutes} min`);
if(!texts)await step('Laden','scripts/pdf-store/fetch.mjs',[...(others?['--others']:[]),'--months',String(months),'--budget-gb',String(budgetGb),'--ocr-workers',String(ocrWorkers),...(flag('retry-errors')?['--retry-days','0']:[]),...(opt('start-month')?['--start-month',opt('start-month')]:[]),'--max-minutes',String(Math.max(5,Math.floor(others?minutes-15:minutes*fetchShare))),'--report-mb','1000']);
if(!texts&&sizeGb()>budgetGb){
 await step('Rang nachtragen','scripts/pdf-store/budget.mjs',['--backfill']);
 await step('Budget','scripts/pdf-store/budget.mjs',['--budget-gb',String(budgetGb),'--apply']);
}
/* Ende: Protokoll, Meldung, Exit-Code (0 fertig, 1 Fehler in einem Schritt, 3 angehalten) */
const end=()=>{
 const result=stopped?'stopped':failed.length?'failed':'done';
 finish(result);
 say(`Ende nach ${Math.round((Date.now()-t0)/60000)} min, Ablage ${sizeGb().toFixed(1)} GB${failed.length?`, Fehler in: ${failed.join(', ')}`:''}${stopped?', angehalten':''}`);
 process.exit(stopped?3:failed.length?1:0);
};
if(others){
 await step('Textebene','scripts/pdf-store/text.mjs',['--max-minutes',String(Math.max(5,Math.floor(left()-5)))]);
 await step('Stand','scripts/pdf-store/stats.mjs',['--budget-gb',String(budgetGb)]);
 end();
}
if(!ocrOnly)await step('Textebene','scripts/pdf-store/text.mjs',['--max-minutes',String(Math.max(5,Math.floor(left()-reserve)))]);
const ocr=Math.floor(left()-reserve);
if(texts&&!ocrOnly){say('OCR ausgelassen (Texte erstellen)');steps.push({name:'OCR',seconds:0,ok:true,summary:{skipped:'bei „Texte erstellen“ keine OCR'}});}
else if(ocr>=5||stopped)await step('OCR','scripts/pdf-store/text.mjs',['--ocr','--workers',String(ocrWorkers),'--max-minutes',String(ocr)]);
else{say(`OCR übersprungen (nur ${Math.max(0,ocr)} min übrig)`);steps.push({name:'OCR',seconds:0,ok:true,summary:{skipped:`nur ${Math.max(0,ocr)} min übrig`}});}
await step('Zusammenfassungen','scripts/pdf-store/summaries.mjs',[]);
await step('Fakten','scripts/pdf-store/facts.mjs',[]);
await step('Wortliste','scripts/refresh-search-words.mjs',['--quiet']);
await step('Stand','scripts/pdf-store/stats.mjs',['--budget-gb',String(budgetGb)]);
end();
