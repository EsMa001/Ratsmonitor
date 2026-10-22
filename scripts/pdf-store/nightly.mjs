// Nächtliche Kette der PDF-Ablage (docs/betrieb/node-server.md, „PDF-Ablage, Texte, Fakten“): jede Stufe liest nur, was die
// vorige abgelegt hat, und fasst nur Neues an. Reihenfolge fest:
//   1. fetch.mjs      Hauptdokumente laden, Monat für Monat ab heute zurück (neue Sitzungen zuerst), mit fester Grenze
//                     --budget-gb (PDFs und Texte): ist sie erreicht, verdrängt eine neue Datei die schlechteste, wenn sie
//                     besser ist (Rang shared/pdf-rank.mjs), sonst fliegt sie selbst raus; die Textebene bleibt immer
//   2. budget.mjs     nur zur Sicherung, wenn die Ablage trotzdem über der Grenze liegt (etwa nach einer gesenkten Grenze)
//      Am Ende stößt die Nachtkette „Themen & Texte“ an (Job rule-texts, nur eingeschaltet; seit 14.10.2026).
//      Danach stellt die Nachtkette (--kind nightly) einen Auftrag „OCR starten“ an: die OCR läuft in der eigenen Bahn neben
//      dem Rest der Kette (Entscheidung 12.10.2026; vorher war sie Schritt 4 hier und im Tausch vor dem Löschen).
//   3. text.mjs       Textebene der neuen PDFs
//   4. budget.mjs --backfill  Dokumentart für den Score nachtragen
//   5. stats.mjs      Stand für den Admin-Reiter „PDF-Ablage“ (system_state 'pdf-store-stats')
// Fehlgeschlagene Abrufe werden nicht erneut versucht, außer mit --retry-errors (Auftrag „Fehlgeschlagene erneut versuchen“
// im Admin-Reiter, scripts/pdf-store/job.mjs); dieser Auftrag versucht nach den Hauptdokumenten auch die übrigen PDFs erneut
// (Schritt „Laden übrige“, je die Hälfte der Ladezeit).
// --others (Auftrag „Übrige PDFs laden“): eigener Lauf für die übrigen PDFs der Berichte (fetch.mjs --others), nur Laden,
// Textebene und Stand; Laden bekommt die ganze Zeit bis auf 15 min.
// --texts (Auftrag „Textebene lesen“): nichts laden, nur aus den schon abgelegten PDFs ohne Text die Textebene lesen, dann
// den Stand.
// --ocr-only (Auftrag „OCR starten“, Bahn „OCR“): OCR aller PDFs, Hauptdokumente und übrige (text.mjs --ocr: leichte zuerst,
// verdrängte kurz nachgeladen, Zeitgrenze je Datei --file-minutes, Standard 5), mit der ganzen Zeit bis auf die Reserve.
// Zusammenfassungen, Fakten und Wortliste gehören nicht hierher (Entscheidung 13.10.2026): Job „rule-texts“
// (scripts/rule-texts.mjs, Reiter „Themen & Texte“) erzeugt sie aus den hier abgelegten Texten.
// Zwei Bahnen laufen nebeneinander (je eine Sperre in der Ablage, LANE_LOCKS in pdf-store-admin.mjs): „Laden“ (alles außer
// --ocr-only, auch die Nachtkette) und „OCR“ (--ocr-only).
// Admin-Reiter (state.mjs): Fortschritt je Schritt in der Bahn des Laufs (die Schritte schreiben ihren eigenen jede Minute
// dazu), Protokoll des Laufs am Ende ('pdf-store-runs', höchstens 50 Läufe, mit Zeit und Zusammenfassung je Schritt), Anhalten
// je Bahn vor jedem Schritt (die Schritte selbst prüfen alle 2 s); angehalten endet der Lauf mit Exit-Code 3. --kind: Art im
// Protokoll (job.mjs setzt sie). Scheitert eine Stufe, laufen die übrigen weiter; der Exit-Code ist dann 1. Zeit: --minutes
// (Standard 180) für alles; Laden höchstens --fetch-share (0.4) davon, OCR bekommt, was bis auf --reserve (25 min) übrig ist.
//
//   node scripts/pdf-store/nightly.mjs [--minutes 180] [--budget-gb 80] [--months 240] [--ocr-workers 3] [--file-minutes 5] [--retry-errors] [--start-month JJJJ-MM] [--others|--texts|--ocr-only] [--kind nightly|run|retry|others|texts|ocr] [--dry-run]
// Umgebung: DATABASE_FILE (Server), RM_PDF_STORE (Ablage), OCR_TOOLS/OCR_CACHE (text.mjs).
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {usedBytes} from './store-lib.mjs';
import {BUDGET_GB} from '../../shared/pdf-rank.mjs';
import {progress,stopRequested,onStop,readState,writeState,queueJob} from './state.mjs';
import {RUNS_KEY,STATS_KEY,LANE_LOCKS} from '../../server/integrations/pdf-store-admin.mjs';
import {triggerJob} from '../../server/integrations/job-trigger.mjs';
import {stepName} from '../../shared/pipeline-terms.mjs';
import {dailyBoundary} from '../../server/integrations/work-failures.mjs';
import {JOBS,SCHEDULES_KEY,SCHEDULE_NOW_KEY,settingOf,slotAt} from '../../server/integrations/schedules.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const others=flag('others'),ocrOnly=!others&&flag('ocr-only'),texts=!others&&!ocrOnly&&flag('texts');
// --daily: Tagespipeline pdf-daily (Job „pdf-nightly“): nur Berichte seit dem letzten Tageslauf ('pdf-daily-last'), mit OCR
const daily=!others&&!ocrOnly&&!texts&&flag('daily'),DAILY_KEY='pdf-daily-last';
const lane=ocrOnly?'ocr':'chain';
// --until HH:MM (deutsche Zeit): spätestens dann enden (Job „ocr“ im Fenster bis 22:00)
const untilAt=/^\d{2}:\d{2}$/.test(opt('until')||'')?slotAt(Date.now(),opt('until')):0;
const minutes=Math.min(Number(opt('minutes',180)),untilAt?Math.max(0,Math.floor((untilAt-Date.now())/60000)):Infinity),budgetGb=Number(opt('budget-gb',BUDGET_GB)),months=Number(opt('months',240));
const retryAll=flag('retry-errors')&&!flag('others')&&!flag('ocr-only')&&!flag('texts');
const fetchShare=Number(opt('fetch-share',0.4)),reserve=Number(opt('reserve',25)),ocrWorkers=Number(opt('ocr-workers',3));
const fileMinutes=String(opt('file-minutes',5));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE;
const t0=Date.now(),left=()=>minutes-(Date.now()-t0)/60000,stamp=()=>new Date().toISOString().slice(0,19).replace('T',' ');
const say=(...a)=>console.log(stamp(),...a);

/* Sperre der Bahn: Datei mit der Prozessnummer; eine verwaiste Sperre (Prozess läuft nicht mehr) wird übernommen */
fs.mkdirSync(dir,{recursive:true});
const lock=path.join(dir,LANE_LOCKS[lane]);
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};
try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}
catch{
 const pid=Number(fs.readFileSync(lock,'utf8'));
 if(pid&&alive(pid)){say(`Bahn ${lane==='ocr'?'OCR':'Laden'} läuft schon (Prozess ${pid}), nichts zu tun`);process.exit(0);}
 fs.writeFileSync(lock,String(process.pid));say(`verwaiste Sperre von Prozess ${pid} übernommen`);
}
const mine=file=>{try{return fs.readFileSync(file,'utf8')===String(process.pid);}catch{return false;}};
const release=()=>{if(mine(lock))try{fs.unlinkSync(lock);}catch{/* schon weg */}};
let child=null;
process.on('exit',release);

const sizeGb=()=>{const s=openPdfStore(dir);try{return usedBytes(s)/1073741824;}finally{s.close();}};
const failed=[],steps=[],dry=flag('dry-run'),kind=opt('kind','nightly');
const base={kind,startedAt:new Date(t0).toISOString(),until:new Date(t0+minutes*60000).toISOString()};
const summaryFile=path.join(dir,`step-summary-${process.pid}.json`);
let stopped=false,finished=false,plan=[],stepIndex=0;
/* Anhalten ohne Warten auf das Ende des Schritts: Knopf im Reiter PDF-Import (je Bahn, alle 2 s geprüft) oder Signal (systemctl
   stop, Knopf im Reiter Jobs & Zeitpläne). Der laufende Schritt bekommt SIGTERM und hört nach seiner laufenden Einheit auf (Laden:
   Abrufe abgebrochen und offen gelassen; Textebene: nach der Datei; OCR: nach der Seitengruppe; Datenbank-Schritte: offene
   Transaktion zurückgerollt). Die übrigen Schritte entfallen, der Lauf wird als angehalten vermerkt (Exit 3). Hängt ein Schritt,
   endet der Lauf nach STOP_GRACE_MS trotzdem (vor dem SIGKILL von systemd nach 90 s). */
const STOP_GRACE_MS=60000;
onStop(dry?null:lane,t0,why=>{
 stopped=true;say(`angehalten (${why==='admin'?'Admin-Reiter':why}), laufender Schritt wird beendet`);
 try{child?.kill('SIGTERM');}catch{/* schon weg */}
 setTimeout(()=>{say('Schritt endet nicht, Lauf wird beendet');try{child?.kill('SIGKILL');}catch{/* schon weg */}finish('stopped');release();process.exit(3);},STOP_GRACE_MS);
});
/* Fortschritt für den Balken im Admin-Reiter: geplante Schritte (plan), laufender Schritt (stepIndex), Beginn und Zeitgrenze des
   Schritts (aus --max-minutes); die Schritte schreiben ihr done/total dazu */
async function step(name,script,stepArgs){
 const cmd=[process.execPath,'--no-warnings','--max-old-space-size=4096',path.join(root,script),...stepArgs];
 if(dry){say('[Probe]',name+':',cmd.slice(3).join(' '));return;}
 if(stopped||(stopped=stopRequested(lane,t0))){say(`${name} übersprungen (angehalten)`);return;}
 const at=plan.indexOf(name);if(at>=0)stepIndex=at;
 const lim=stepArgs.includes('--max-minutes')?Number(stepArgs[stepArgs.indexOf('--max-minutes')+1]):0,now=Date.now();
 const stepBase={...base,plan,stepIndex,stepStartedAt:new Date(now).toISOString(),...(lim?{stepUntil:new Date(now+lim*60000).toISOString()}:{})};
 say(`${name} …`);progress(lane,{...stepBase,step:name});
 try{fs.unlinkSync(summaryFile);}catch{/* keine */}
 const t=Date.now();
 const r=await new Promise(resolve=>{
  child=spawn(cmd[0],cmd.slice(1),{cwd:root,stdio:'inherit',env:{...process.env,RM_PROGRESS_LANE:lane,RM_PROGRESS_BASE:JSON.stringify(stepBase),RM_STEP_SUMMARY:summaryFile}});
  child.on('error',e=>{say(`${name}: ${e.message}`);resolve({status:127,signal:null});});
  child.on('exit',(status,signal)=>resolve({status,signal}));
  if(stopped)child.kill('SIGTERM');
 });
 child=null;
 const sec=Math.round((Date.now()-t)/1000);
 let summary=null;try{summary=JSON.parse(fs.readFileSync(summaryFile,'utf8'));fs.unlinkSync(summaryFile);}catch{/* Schritt ohne Zusammenfassung */}
 if(summary?.stopped)stopped=true;
 const halted=stopped&&(r.status!==0||!!summary?.stopped);
 steps.push({name,seconds:sec,ok:r.status===0||halted,summary:summary||(halted?{stopped:true}:null)});
 if(halted)say(`${name} angehalten (${sec} s)`);
 else if(r.status===0)say(`${name} fertig (${sec} s)`);else{failed.push(name);say(`${name} FEHLER (Exit ${r.status??r.signal}, ${sec} s), weiter mit der nächsten Stufe`);}
}
const skip=(name,why)=>{say(`${name} ausgelassen (${why})`);steps.push({name,seconds:0,ok:true,summary:{skipped:why}});};
/* Protokoll des Laufs und Fortschritt löschen (einmal, auch beim Anhalten per Signal) */
function finish(result){
 if(finished||dry)return;finished=true;
 let gb=null;try{gb=Math.round(sizeGb()*10)/10;}catch{/* Ablage gerade nicht lesbar */}
 /* Qualität nach dem Lauf aus der letzten Zählung (Schritt „Stand“; fehlt er, die vorige): Ø Score der Ablage und Anteil der
    Hauptdokumente mit Text */
 let quality=null;try{const st=readState(STATS_KEY);if(st)quality={score:st.quality?.avg??null,text:st.linked?Math.round((st.texts?.linked||0)/st.linked*1000)/1000:null,at:st.at,thisRun:st.at>=base.startedAt};}catch{/* ohne */}
 const run={...base,finishedAt:new Date().toISOString(),result,failed,steps,sizeGb:gb,quality};
 writeState(RUNS_KEY,[run,...(readState(RUNS_KEY)||[])].slice(0,50));
 progress(lane,null);
}
/* Ende: Protokoll, Meldung, Exit-Code (0 fertig, 1 Fehler in einem Schritt, 3 angehalten) */
const end=()=>{
 const result=stopped?'stopped':failed.length?'failed':'done';
 finish(result);
 say(`Ende nach ${Math.round((Date.now()-t0)/60000)} min, Ablage ${sizeGb().toFixed(1)} GB${failed.length?`, Fehler in: ${failed.join(', ')}`:''}${stopped?', angehalten':''}`);
 process.exit(stopped?3:failed.length?1:0);
};

/* Schrittnamen: shared/pipeline-terms.mjs (gleich in Protokoll, Admin-Seiten, Konzept) */
const N={pdf:stepName('pdf'),others:stepName('others'),text:stepName('text'),ocr:stepName('ocr'),doctype:stepName('doctype'),budget:stepName('budget'),stats:stepName('stats')};
const TAIL=[N.doctype,N.stats];
// OCR-Lauf (Job „ocr“, alle 10 Minuten im Fenster): ohne „Stand“ (zählt Minuten lang; das macht die Nachtkette), Art nur nach gelesenen Dateien
plan=others?[N.others,N.text,N.doctype,N.stats]:ocrOnly?[N.ocr,N.doctype,stepName('rules'),stepName('search')]:texts?[N.text,...TAIL]:daily?[N.pdf,N.others,N.text,N.ocr,...TAIL]:[N.pdf,...(retryAll?[N.others]:[]),N.text,...TAIL];
say(`Start${others?' (übrige PDFs)':ocrOnly?' (OCR)':texts?' (nur Texte aus vorhandenen PDFs)':''}: Ablage ${dir}, ${sizeGb().toFixed(1)} GB (PDFs und Texte), feste Grenze ${budgetGb} GB, ${minutes} min`);

if(ocrOnly){
 // Im Fenster (--until) keine Reserve für Folgeschritte: OCR bis kurz vor Schluss
 const ocr=Math.floor(left()-(untilAt?2:reserve)),range=opt('range','all');
 const ocrArgs=(r,min,fm=fileMinutes,slow=flag('include-slow'))=>['--ocr','--range',r,'--workers',String(ocrWorkers),'--file-minutes',String(fm),'--max-minutes',String(min),...(slow?['--include-slow']:[]),...(flag('main-only')?['--main-only']:[])];
 if(ocr>=5)await step(N.ocr,'scripts/pdf-store/text.mjs',ocrArgs(range,ocr));
 else skip(N.ocr,`nur ${Math.max(0,ocr)} min übrig`);
 /* Tagesbereich fertig: hat die Seite „Altbestand“ die OCR des Altbestands angefordert, danach diese (10 bis 22 Uhr, längere
    Zeitgrenze je Datei, auch zu langsame vom letzten Mal) */
 const backlogAsked=readState('altbestand-requests')?.ocr,backlogOpen=!!backlogAsked&&!backlogAsked.stoppedAt;
 const t=Date.now(),inBacklog=t>=slotAt(t,'10:00')&&t<slotAt(t,'22:00')-5*60000;
 if(range==='daily'&&backlogOpen&&inBacklog&&!stopped&&!dry){
  const rest=Math.min(Math.floor(left()-2),Math.floor((slotAt(t,'22:00')-t)/60000));
  if(rest>=5){say('OCR des Altbestands (angefordert)');await step(N.ocr+' (Altbestand)','scripts/pdf-store/text.mjs',[...ocrArgs('backlog',rest,15,true),'--origin','backlog']);}
 }
 // Nichts gelesen (Reihe leer): kein Nachtrag und kein Protokolleintrag je 10 Minuten
 if(!dry&&!stopped&&!steps.some(s=>s.summary?.files>0)){progress(lane,null);release();say('nichts zu lesen');process.exit(0);}
 await step(N.doctype,'scripts/pdf-store/budget.mjs',['--backfill']);
 /* Folgekette (Betriebsplan): Berichte, deren Text die OCR gerade ergänzt hat, gleich verarbeiten (Regeln anwenden, Suche
    aktualisieren), statt bis zur nächsten Nacht zu warten. Nicht, solange „Verarbeitung, nachts“ läuft (dieselben Berichte). */
 if(!dry&&!stopped){
  const rt=(readState('schedule-runs')||{})['rule-texts']?.running,busy=!!rt?.pid&&(()=>{try{process.kill(rt.pid,0);return true;}catch(e){return e.code==='EPERM';}})();
  const s=openPdfStore(dir);let ids=[];
  try{ids=s.db.prepare("SELECT DISTINCT p.topic_id AS id FROM texts t JOIN pdfs p ON p.sha256=t.sha256 WHERE t.made_at>=? AND t.method IN ('ocr','mixed') AND p.topic_id IS NOT NULL").all(base.startedAt).map(r=>r.id);}finally{s.close();}
  if(busy)skip(stepName('rules'),'„Verarbeitung, nachts“ läuft gerade; der neue Text kommt dort an');
  else if(ids.length){
   const idFile=path.join(dir,`ocr-ids-${process.pid}.txt`);fs.writeFileSync(idFile,ids.join('\n'));
   await step(stepName('model'),'scripts/model/apply.mjs',['--ids',idFile]);
   await step(stepName('rules'),'scripts/pdf-store/read-reports.mjs',['--ids',idFile]);
   try{fs.unlinkSync(idFile);}catch{/* weg */}
   await step(stepName('search'),'scripts/refresh-search-words.mjs',['--quiet']);
  }
 }
 end();
}else if(daily){
 /* Tagespipeline (Betriebsplan 15.10.2026): nur die PDFs der Berichte, die der Import seit dem letzten Tageslauf geschrieben
    hat (Hauptdokumente, dann Anlagen); Fehler gehen als 'daily' in den Fehlerspeicher. Kein Laden älterer Monate (Bestandsaufbau, Auftrag „Laden“). */
 const since=readState(DAILY_KEY)?.startedAt||new Date(t0-48*3600000).toISOString();
 say(`Berichte geschrieben seit ${since}`);
 const boundary=dailyBoundary(t0);
 await step(N.pdf,'scripts/pdf-store/fetch.mjs',['--since-updated',since,'--event-from',boundary,'--origin','daily','--budget-gb',String(budgetGb),'--max-minutes',String(Math.max(5,Math.floor(minutes*fetchShare*0.6))),'--report-mb','1000']);
 /* Anlagen derselben Berichte: die KI liest alle PDFs eines Berichts (ai-local-sources.mjs). In der Grenze stehen sie unter
    allen Hauptdokumenten; was nicht passt, bleibt als Text. */
 if(!stopped)await step(N.others,'scripts/pdf-store/fetch.mjs',['--others','--since-updated',since,'--event-from',boundary,'--origin','daily','--budget-gb',String(budgetGb),'--max-minutes',String(Math.max(5,Math.floor(minutes*fetchShare*0.4))),'--report-mb','1000']);
 if(sizeGb()>budgetGb){
  await step(N.doctype,'scripts/pdf-store/budget.mjs',['--backfill']);
  await step(N.budget,'scripts/pdf-store/budget.mjs',['--budget-gb',String(budgetGb),'--apply']);
 }
}else if(!texts){
 await step(N.pdf,'scripts/pdf-store/fetch.mjs',[...(others?['--others']:[]),'--months',String(months),'--budget-gb',String(budgetGb),...(flag('retry-errors')?['--retry-days','0']:[]),...(opt('start-month')?['--start-month',opt('start-month')]:[]),'--max-minutes',String(Math.max(5,Math.floor(others?minutes-15:minutes*fetchShare*(retryAll?0.5:1)))),'--report-mb','1000']);
 if(retryAll&&!stopped)await step(N.others,'scripts/pdf-store/fetch.mjs',['--others','--months',String(months),'--budget-gb',String(budgetGb),'--retry-days','0',...(opt('start-month')?['--start-month',opt('start-month')]:[]),'--max-minutes',String(Math.max(5,Math.floor(minutes*fetchShare*0.5))),'--report-mb','1000']);
 if(sizeGb()>budgetGb){
  await step(N.doctype,'scripts/pdf-store/budget.mjs',['--backfill']);
  await step(N.budget,'scripts/pdf-store/budget.mjs',['--budget-gb',String(budgetGb),'--apply']);
 }
 /* Den OCR-Rückstand liest seit dem Betriebsplan (15.10.2026) der Job „ocr“ im Fenster 10 bis 22 Uhr; hier wird nichts angestellt */
}
if(others){
 await step(N.text,'scripts/pdf-store/text.mjs',['--max-minutes',String(Math.max(5,Math.floor(left()-5)))]);
 await step(N.doctype,'scripts/pdf-store/budget.mjs',['--backfill']);
 await step(N.stats,'scripts/pdf-store/stats.mjs',['--budget-gb',String(budgetGb)]);
 end();
}
if(!ocrOnly)await step(N.text,'scripts/pdf-store/text.mjs',['--max-minutes',String(Math.max(5,Math.floor(left()-reserve)))]);
/* Tagespipeline: OCR der PDFs (Hauptdokumente zuerst, dann Anlagen), deren Textebene in diesem Lauf entstand und Seiten ohne Text
   hat, vor den Regeln; höchstens --daily-ocr-minutes (45). Was an der Grenze scheitert, geht als slow in den Fehlerspeicher; was
   in der Zeit nicht drankommt, liest der Job „ocr“ tagsüber (die Reihe nimmt die neuesten Sitzungen zuerst). */
if(daily&&!stopped){
 const shasFile=path.join(dir,`ocr-daily-${process.pid}.txt`);
 let n=0;
 if(!dry){const s=openPdfStore(dir);try{
  const shas=s.db.prepare(`SELECT t.sha256 AS sha FROM texts t JOIN pdfs p ON p.sha256=t.sha256 WHERE t.status='ok' AND t.ocr_needed>0 AND t.made_at>=? GROUP BY t.sha256 ORDER BY MIN(coalesce(p.role,'')='other'),t.ocr_needed`).all(base.startedAt).map(r=>r.sha);
  n=shas.length;fs.writeFileSync(shasFile,shas.join('\n'));
 }finally{s.close();}}
 const ocrMin=Math.min(Number(opt('daily-ocr-minutes',45)),Math.floor(left()-15));
 if(dry)await step(N.ocr,'scripts/pdf-store/text.mjs',['--ocr','--shas','<Datei>','--origin','daily','--workers',String(ocrWorkers),'--file-minutes',fileMinutes,'--max-minutes',String(ocrMin)]);
 else if(!n)skip(N.ocr,'keine neuen Seiten ohne Text');
 else if(ocrMin<5)skip(N.ocr,`nur ${Math.max(0,ocrMin)} min übrig`);
 else await step(N.ocr,'scripts/pdf-store/text.mjs',['--ocr','--shas',shasFile,'--origin','daily','--workers',String(ocrWorkers),'--file-minutes',fileMinutes,'--max-minutes',String(ocrMin)]);
 try{fs.unlinkSync(shasFile);}catch{/* keine */}
}
/* Dokumentart und Art laut Textanfang für den Score (nur Fehlendes; nach neuen Regeln einmal alles) */
await step(N.doctype,'scripts/pdf-store/budget.mjs',['--backfill']);
await step(N.stats,'scripts/pdf-store/stats.mjs',['--budget-gb',String(budgetGb)]);
/* Nachts: danach gleich „Themen & Texte“ anstoßen (Regeln, Wortliste, Zahlen für plenara.X), statt bis zu seiner festen Zeit
   zu warten; nur wenn er eingeschaltet ist. Die feste Zeit bleibt als Rückfall (etwa bei ausgeschalteter Nachtkette). */
/* Stand des Tageslaufs: Beginn des Laufs, damit der nächste die seitdem geschriebenen Berichte nimmt */
if(daily&&!dry&&!stopped)writeState(DAILY_KEY,{startedAt:base.startedAt,finishedAt:new Date().toISOString(),failed});
if(kind==='nightly'&&!dry&&!stopped){
 try{
  const job=JOBS.find(j=>j.id==='rule-texts');
  if(settingOf(job,readState(SCHEDULES_KEY)).enabled){
   writeState(SCHEDULE_NOW_KEY,{...(readState(SCHEDULE_NOW_KEY)||{}),'rule-texts':new Date().toISOString()});
   await triggerJob('rule-texts');
   say('„Themen & Texte“ angestoßen');
  }else say('„Themen & Texte“ ist ausgeschaltet, nicht angestoßen');
 }catch(e){say('„Themen & Texte“ nicht angestoßen:',e.message);}
}
end();
