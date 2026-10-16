// Textfassungen der lokalen PDF-Ablage (server/node/pdf-store.mjs): je Datei ein .txt neben dem PDF, Seiten roh wie pdf.js
// sie liefert (getrennt durch \f), damit readDocument daraus genau den Text des PDFs bildet (mergePages in documents.mjs).
//
//   node scripts/pdf-store/text.mjs [--limit N] [--shas datei]
//        Textebene aller geladenen PDFs ohne Textfassung auslesen (schnell, ~12 ms je Datei); --shas: nur diese Prüfsummen
//   node scripts/pdf-store/text.mjs --ocr [--workers 3] [--limit N] [--timeout-ms 10000] [--file-minutes M] [--page-seconds 90]
//        [--shas datei] [--main-only] [--include-slow] [--origin daily|backlog]
//        Seiten ohne Textebene (unter MIN_CHARS Zeichen) per OCR lesen. Reihe (ocrQueue, Betriebsplan 15.10.2026): alle PDFs
//        eines Berichts, weil die KI alle liest (ai-local-sources.mjs); Hauptdokumente vor übrigen PDFs (Anlagen), abgelegte vor
//        verdrängten, neueste Sitzung zuerst. --main-only: nur Hauptdokumente. Verdrängte Dateien
//        ('text-only') werden kurz nachgeladen, gelesen und gleich wieder gelöscht (ocrWithRefetch in store-lib.mjs); ein Server
//        mit 3 Fehlern in Folge fällt für den Lauf heraus. Je Worker eine Datei zur Zeit.
//   --shas datei: nur diese Prüfsummen (eine je Zeile; Tagespipeline pdf-daily und Job „nacharbeit“)
//   --recycle N: Paketgröße (Standard 25); --rss-mb N: Speichergrenze je Paket (Standard 2500); jedes Paket läuft als eigener
//        Prozess (--child), gegen wachsenden Speicher
//   --file-minutes M: Zeitgrenze je Datei; --page-seconds S (Standard 90): Zeitgrenze je Seitengruppe. Wer länger braucht, wird
//        abgebrochen, nichts geschrieben; Klasse slow im Fehlerspeicher (ein zweiter Versuch im Bestandsfenster mit
//        --include-slow und längerer Grenze, danach bleibt die Textebene). Hängt eine Seite, endet das Paket sofort (der hängende
//        Auftrag läuft im OCR-Worker weiter); blockiert sie den Prozess ganz, beendet ihn der Wächter des Treibers nach
//        --watch-seconds (Standard 180 s ohne Lebenszeichen) und vermerkt die laufenden Dateien als slow.
//   node scripts/pdf-store/text.mjs --stats        Stand der Textfassungen
//   --max-minutes M: danach keine neue Datei mehr anfangen (nächtliche Kette, nightly.mjs); der nächste Lauf macht weiter.
// Fehlerspeicher (Migration 0040, failures.mjs): Mit ihm werden Nachladefehler ('ocr-fetch') und zu langsame Dateien ('ocr', slow)
// dort vermerkt statt in ocr_refetch und ocr_slow; Dateien mit wartendem Eintrag stehen nicht in der Reihe, fällige schon.
// Defekte PDFs (Textebene nicht lesbar) gehen als 'text' mit Klasse internal hinein (neuer Versuch nach dem nächsten Deploy).
// OCR: tesseract.js (Deutsch) und @napi-rs/canvas aus OCR_TOOLS (Ordner mit node_modules; Standard VIDEO_TOOLS bzw.
// ~/code/video-tools), Sprachdaten in OCR_CACHE (Standard <OCR_TOOLS>/cache/tesseract, beim ersten Lauf geladen),
// Seiten mit OCR_SCALE gerendert. Eine Sperre (ocr.lock in der Ablage) lässt nur einen OCR-Lauf zur Zeit zu: Ein zweiter (etwa der
// Schritt der Nachtkette, während ein langer Lauf von Hand läuft) endet sofort, statt dieselben Seiten noch einmal zu lesen.
// Lesen und OCR je Datei: store-lib.mjs (auch für den Tausch in fetch.mjs). Neue Fassung des Leseverfahrens: TEXT_VERSION
// dort erhöhen, dann liest der erste Aufruf alle Dateien neu.
// Zu große Dateien (über 10 MB, shared/pdf-rank.mjs) verlieren ihr PDF gleich nach der Textebene (dropIfTooBig), auch Scans:
// deren OCR lädt die Datei später kurz nach.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {TEXT_VERSION,readTextLayer,ocrScheduler,ocrFile,ocrWithRefetch,downloader,dropIfTooBig,ocrRange} from './store-lib.mjs';
import {progress,onStop,stepSummary,lane} from './state.mjs';
import {openFailures,seedFromStore,originOf} from './failures.mjs';
import {dailyBoundary} from '../../server/integrations/work-failures.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const limit=Number(opt('limit',0)),maxMinutes=Number(opt('max-minutes',0)),started=Date.now();
const onlyShas=opt('shas')?new Set(fs.readFileSync(opt('shas'),'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)):null;
const originOpt=opt('origin');
// Fortschritt und Anhalten (Admin-Reiter, state.mjs): in der Kette deren Bahn, ein OCR-Lauf von Hand die Bahn 'ocr'
const myLane=lane(flag('ocr')?'ocr':'chain'),chained=!!process.env.RM_PROGRESS_BASE;
// Anhalten (Admin-Reiter alle 2 s, Signal, Strg+C): Textebene nach der laufenden Datei, OCR nach der laufenden Seitengruppe;
// fertige Textfassungen bleiben, eine halb gelesene Datei bleibt in der OCR-Reihe
let halted=false,child=null;const halt=new AbortController();
if(!flag('stats'))onStop(myLane,started,why=>{halted=true;halt.abort();try{child?.kill('SIGTERM');}catch{/* schon weg */}console.log(`Angehalten (${why==='admin'?'Admin-Reiter':why})`);});
const late=()=>halted||(maxMinutes>0&&Date.now()-started>maxMinutes*60000);
let told=0;
// Ein OCR-Paket (--child) schreibt keinen eigenen Fortschritt, das macht der Treiber mit den Summen aller Pakete
const tell=(detail,force)=>{if(process.env.RM_NO_PROGRESS||!force&&Date.now()-told<60000)return;told=Date.now();
 progress(myLane,{...(chained?{}:{kind:flag('ocr')?'ocr':'text',startedAt:new Date(started).toISOString()}),...detail});};
const elapsed=t0=>((Date.now()-t0)/1000).toFixed(0)+' s';

if(flag('stats')){
 for(const r of store.textStats())console.log(String(r.status).padEnd(6),String(r.method||'').padEnd(6),String(r.n).padStart(8),'Dateien',r.chars?(r.chars/1048576).toFixed(0)+' MB Text':'',r.waiting?r.waiting+' warten auf OCR':'');
 process.exit(0);
}
const F=flag('dry-run')?null:await openFailures();
if(F&&!flag('child'))await seedFromStore(store,F);
/* Herkunft eines Eintrags aus dem jüngsten Sitzungstag der Datei */
const eventOf=sha=>store.db.prepare('SELECT max(event_date) AS d FROM pdfs WHERE sha256=?').get(sha)?.d||null;
const originFor=sha=>originOpt==='daily'||originOpt==='backlog'?originOpt:originOf(eventOf(sha));

if(!flag('ocr')){
 // Textebene: Text je Seite wie unpdf getPageText (Textstücke, Zeilenende bei hasEOL).
 const known=F?F.known('text'):new Set();
 const todo=store.textless(TEXT_VERSION).filter(s=>!onlyShas||onlyShas.has(s)).slice(0,limit||undefined),t0=Date.now();let ok=0,failed=0,waiting=0,dropped=0;
 console.log(`${todo.length} Dateien ohne Textfassung`);
 for(const sha of todo){
  if(late()){console.log(halted?'Rest im nächsten Lauf':`Zeitgrenze erreicht (${maxMinutes} min), Rest im nächsten Lauf`);break;}
  try{if(await readTextLayer(store,sha))waiting++;ok++;if(dropIfTooBig(store,sha))dropped++;if(known.has(sha))await F.ok({step:'text',key:sha});}
  catch(e){store.failText(sha,e.message,{version:TEXT_VERSION});failed++;await F?.fail({step:'text',key:sha,cls:'internal',error:e.message,eventDate:eventOf(sha),origin:originFor(sha)});}
  if((ok+failed)%2000===0)console.log(`${ok+failed}/${todo.length}, ${failed} defekt, ${waiting} mit Seiten für OCR, ${elapsed(t0)}`);
  tell({step:'Textebene',text:{done:ok+failed,total:todo.length,failed,waiting}});
 }
 console.log(`fertig: ${ok} Textfassungen, ${failed} defekt, ${waiting} mit Seiten für OCR, ${dropped} zu große PDFs gelöscht (${elapsed(t0)})`);
 stepSummary({files:ok,failed,waiting,dropped,open:todo.length-ok-failed,stopped:halted});
 if(!chained)progress(myLane,null);
 F?.close();
}else{
 // OCR-Reihe: alle PDFs, Hauptdokumente zuerst (nur sie mit --main-only), ohne Dateien mit wartendem Eintrag im Fehlerspeicher (fällige ja; slow
 // nur mit --include-slow), mit --shas nur diese
 const waitingKeys=new Set();
 if(F){
  const now=new Date().toISOString();
  for(const r of F.sql.prepare("SELECT key,class,next_try_at FROM work_failures WHERE step IN ('ocr','ocr-fetch')").all())
   if(r.class==='slow'?!flag('include-slow')||!r.next_try_at:!r.next_try_at||r.next_try_at>now)waitingKeys.add(r.key);
 }
 // --range daily: nur Dateien von Sitzungen im Tagesbereich (dailyBoundary), ohne Sitzungstag die seit dem Stichtag geladenen;
 // backlog: der Rest; sonst alle (ocrRange in store-lib.mjs)
 const range=opt('range','all'),boundary=dailyBoundary();
 const inRange=x=>ocrRange(x,range,boundary);
 const queueNow=()=>store.ocrQueue({others:!flag('main-only')}).filter(x=>(!onlyShas||onlyShas.has(x.sha))&&!waitingKeys.has(x.sha)&&inRange(x));
 // OCR: nur Seiten ohne Textebene, jede Seite einzeln gerendert; die übrigen Seiten bleiben, wie pdf.js sie liest.
 // Sperre: Datei mit der Prozessnummer; eine verwaiste (Prozess läuft nicht mehr) wird übernommen
 // Die Sperre hält der Treiber; ein Paket (--child) läuft unter seiner Sperre
 if(!flag('child')){
  const lock=path.join(store.dir,'ocr.lock'),alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};
  try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}
  catch{const pid=Number(fs.readFileSync(lock,'utf8'));if(pid&&alive(pid)){console.log(`OCR läuft schon (Prozess ${pid}), nichts zu tun`);stepSummary({skipped:'OCR-Lauf von Hand läuft'});store.close();process.exit(0);}fs.writeFileSync(lock,String(process.pid));}
  const release=()=>{try{if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock);}catch{/* schon weg */}};
  process.on('exit',release);
  /* Treiber: jedes Paket zu --recycle Dateien (Standard 25) läuft als eigener Prozess und endet danach. Beim Ende eines Prozesses
     gibt das System allen Speicher frei; im selben Prozess wuchs die OCR über Stunden auf 5,8 GB und hing an der Grenze des
     Auftragsdienstes (13.10.2026, auch mit frischen OCR-Workern je Paket). Fortschritt und Zusammenfassung sind die Summen.
     Wächter: Das Paket schreibt bei jeder Seitengruppe ein Lebenszeichen (ocr-beat-<pid>.json mit den laufenden Dateien); fehlt
     es --watch-seconds lang, wird das Paket beendet (SIGKILL) und seine laufenden Dateien gelten als slow (13.10.2026: ein Paket
     stand 19 Minuten, SIGTERM wirkte nicht). */
  const per=Number(opt('recycle',25)),me=fileURLToPath(import.meta.url),fileMin=opt('file-minutes'),watchMs=Number(opt('watch-seconds',180))*1000;
  const tot={files:0,primary:0,pages:0,failed:0,changed:0,fetched:0,skipped:0,dropped:0,slow:0,killed:0},t0=Date.now();
  const total=queueNow().length,workers=Number(opt('workers',3));
  console.log(`${total} Dateien mit Seiten ohne Textebene${flag('main-only')?' (nur Hauptdokumente)':' (Hauptdokumente zuerst, dann Anlagen)'}, in Paketen zu ${per} Dateien als eigene Prozesse`);
  const show=force=>{const done=tot.files+tot.failed+tot.skipped+tot.slow,h=(Date.now()-t0)/3600000;
   tell({step:'OCR',ocr:{done,total,pages:tot.pages,failed:tot.failed,workers,perHour:h>0.05?Math.round(done/h):null,fetched:tot.fetched,...(fileMin?{slow:tot.slow}:{})}},force);};
  show(true);
  let stoppedChild=false;
  const pass=[...args.filter((a,i)=>['--shas','--main-only','--include-slow','--origin','--page-seconds','--range'].includes(a)||['--shas','--origin','--page-seconds','--range'].includes(args[i-1]))];
  while(!late()){
   const left=maxMinutes?Math.floor(maxMinutes-(Date.now()-started)/60000):0;
   if(maxMinutes&&left<1)break;
   const sumFile=path.join(store.dir,`ocr-paket-${process.pid}.json`);try{fs.unlinkSync(sumFile);}catch{/* keine */}
   let beatFile='';
   const code=await new Promise(resolve=>{
    child=spawn(process.execPath,['--no-warnings','--max-old-space-size=2048',me,'--ocr','--child','--limit',String(per),'--workers',String(workers),'--timeout-ms',opt('timeout-ms','10000'),'--rss-mb',opt('rss-mb','2500'),
     ...(fileMin?['--file-minutes',fileMin]:[]),...(left?['--max-minutes',String(left)]:[]),...pass],{stdio:'inherit',env:{...process.env,RM_STEP_SUMMARY:sumFile,RM_NO_PROGRESS:'1'}});
    beatFile=path.join(store.dir,`ocr-beat-${child.pid}.json`);
    const born=Date.now();
    const watch=setInterval(()=>{
     let at=born;try{at=JSON.parse(fs.readFileSync(beatFile,'utf8')).at;}catch{/* noch keins */}
     if(Date.now()-at>watchMs){console.log(`OCR-Paket ${child.pid} ohne Lebenszeichen seit ${Math.round((Date.now()-at)/1000)} s: beendet`);try{child.kill('SIGKILL');}catch{/* schon weg */}tot.killed++;}
    },Math.min(15000,watchMs/4));
    child.on('error',()=>{clearInterval(watch);resolve(127);});child.on('exit',(c,sig)=>{clearInterval(watch);resolve(c??sig);});
   });
   child=null;
   let r={};try{r=JSON.parse(fs.readFileSync(sumFile,'utf8'));fs.unlinkSync(sumFile);}catch{/* Paket ohne Zusammenfassung */}
   // Abgeschossenes oder abgestürztes Paket: die Dateien, an denen es gerade las, gelten als zu langsam
   if(code==='SIGKILL'||!Object.keys(r).length){
    let current=[];try{current=JSON.parse(fs.readFileSync(beatFile,'utf8')).current||[];}catch{/* ohne */}
    for(const sha of current){if(F)await F.fail({step:'ocr',key:sha,cls:'slow',error:'Paket hing (Wächter)',eventDate:eventOf(sha),origin:originFor(sha)});else store.markSlow(sha);waitingKeys.add(sha);}
    if(current.length){r={slow:current.length};console.log(`${current.length} Dateien als zu langsam vermerkt`);}
   }
   try{fs.unlinkSync(beatFile);}catch{/* keins */}
   for(const k of Object.keys(tot))if(typeof r[k]==='number')tot[k]+=r[k];
   show(true);
   if(halted||r.stopped){stoppedChild=true;break;}
   const worked=(r.files||0)+(r.failed||0)+(r.slow||0)+(r.skipped||0);
   if(!worked){if(code!==0)console.error(`OCR-Paket endete mit ${code} ohne Ergebnis, Lauf beendet`);break;}
  }
  const open=queueNow().length;
  console.log(`fertig: ${tot.files} Dateien (${tot.primary} Hauptdokumente), ${tot.pages} Seiten per OCR, ${tot.failed} Fehler (davon ${tot.changed} geändert), ${tot.fetched} nachgeladen und wieder gelöscht, ${tot.skipped} Server ausgelassen, ${tot.slow} über der Zeitgrenze, ${tot.killed} Pakete vom Wächter beendet, ${tot.dropped} zu große PDFs gelöscht, ${open} offen (${elapsed(t0)})`);
  stepSummary({...tot,open,seconds:Math.round((Date.now()-t0)/1000),stopped:halted||stoppedChild});
  if(!chained)progress(myLane,null);
  F?.close();store.close();process.exit(0);
 }
 const workers=Number(opt('workers',3)),recycle=Number(opt('recycle',25));
 // Speicherwächter: nativer Speicher (Canvas, WebAssembly) wächst je Seite und gibt ihn im Prozess nicht zurück; über der Grenze
 // beendet sich das Paket nach der laufenden Datei, der Treiber startet das nächste (13.10.2026: 6,6 GB bei 150 Dateien)
 const rssMb=()=>process.memoryUsage.rss()/1048576,rssLimit=Number(opt('rss-mb',2500));let ocr=await ocrScheduler(workers);
 if(!ocr){console.error('OCR-Werkzeuge fehlen (OCR_TOOLS).');process.exit(1);}
 const todo=queueNow().slice(0,limit||undefined),main=new Set(todo.filter(x=>x.main).map(x=>x.sha)),t0=Date.now();
 let files=0,primary=0,pagesDone=0,failed=0,dropped=0,fetched=0,changed=0,skipped=0,slow=0;
 const fileMs=Number(opt('file-minutes',0))*60000,pageMs=Number(opt('page-seconds',90))*1000;
 // Lebenszeichen für den Wächter des Treibers: Zeit und die Dateien, an denen gerade gelesen wird
 const current=new Set(),beatFile=path.join(store.dir,`ocr-beat-${process.pid}.json`);
 const beat=()=>{try{fs.writeFileSync(beatFile,JSON.stringify({at:Date.now(),current:[...current]}));}catch{/* nicht wichtig */}};
 beat();
 console.log(`${todo.length} Dateien mit Seiten ohne Textebene (${main.size} Hauptdokumente), ${workers} OCR-Worker`);
 // Nachladen: ein Server mit 3 Fehlern in Folge fällt für diesen Lauf heraus (seine Dateien bleiben offen); mit Fehlerspeicher
 // auch Server, die dort warten
 const get=downloader({timeoutMs:Number(opt('timeout-ms',10000)),signal:halt.signal}),fails=new Map();
 const download=async url=>{
  const host=new URL(url).host;
  if((fails.get(host)||0)>=3||F?.waiting(host))throw Object.assign(Error('Server ausgelassen'),{skip:true});
  try{const b=await get(url);fails.set(host,0);if(F?.hosts.has(host))await F.hostOk(host);return b;}catch(e){if(!halted)fails.set(host,(fails.get(host)||0)+1);throw e;}
 };
 const knownOcr=F?F.known('ocr'):new Set(),knownFetch=F?F.known('ocr-fetch'):new Set();
 // Nachladen gescheitert: mit Fehlerspeicher dort (Klasse aus HTTP-Code, „geändert“ endgültig), sonst ocr_refetch
 const refetchFailed=async(sha,error,info={})=>{
  if(!F){store.refetchFailed(sha,error);return;}
  let host=null;try{host=info.url?new URL(info.url).host:null;}catch{/* ohne */}
  await F.fail({step:'ocr-fetch',key:sha,host,http:info.http??null,error,changed:!!info.changed,retryAfterMs:info.retryAfterMs??null,eventDate:eventOf(sha),origin:originFor(sha)});
 };
 // Hängt eine Seite (Zeitgrenze je Seite), endet das Paket sofort mit Zusammenfassung: der hängende Auftrag läuft im Worker weiter
 let stuck=false;
 const summary=()=>({files,primary,pages:pagesDone,failed,changed,fetched,skipped,dropped,open:Math.max(0,todo.length-files-failed-skipped-slow),seconds:Math.round((Date.now()-t0)/1000),stopped:halted,slow});
 const read=sha=>ocrFile(store,sha,ocr,{halt:()=>halted||stuck,deadline:fileMs?Date.now()+fileMs:0,pageMs,onGroup:beat});
 const one=async sha=>{
  current.add(sha);beat();
  try{
   const r=await ocrWithRefetch(store,sha,{download,read,halted:()=>halted,failed:refetchFailed});
   pagesDone+=r.pages;if(r.fetched)fetched++;
   if(r.result==='ok'){files++;if(main.has(sha))primary++;if(dropIfTooBig(store,sha))dropped++;
    if(knownOcr.has(sha))await F.ok({step:'ocr',key:sha});if(knownFetch.has(sha))await F.ok({step:'ocr-fetch',key:sha});}
   else if(r.result==='skipped')skipped++;else{failed++;if(r.result==='changed')changed++;}
  }
  catch(e){
   if(e.halted){if(!stuck)queue.unshift(sha);return;}
   if(e.slow){slow++;
    if(F)await F.fail({step:'ocr',key:sha,cls:'slow',error:e.message,eventDate:eventOf(sha),origin:originFor(sha)});else store.markSlow(sha);
    console.log(`OCR ${sha.slice(0,12)} über der Zeitgrenze (${e.message}), später erneut`);
    if(e.stuck&&!stuck){stuck=true;stepSummary(summary());console.log('Eine Seite hängt: Paket endet, der Treiber startet das nächste');try{fs.unlinkSync(beatFile);}catch{/* keins */}F?.close();process.exit(0);}
   }
   else{failed++;console.error('OCR',sha.slice(0,12),e.message);}
  }finally{current.delete(sha);beat();}
  const done=files+failed+skipped+slow,h=(Date.now()-t0)/3600000;
  if(done%100===0)console.log(`${done}/${todo.length} Dateien, ${pagesDone} Seiten, ${failed} Fehler, ${slow} zu langsam, ${fetched} nachgeladen, ${Math.round(process.memoryUsage.rss()/1048576)} MB, ${elapsed(t0)}`);
  tell({step:'OCR',ocr:{done,total:todo.length,pages:pagesDone,failed,workers,perHour:h>0.05?Math.round(done/h):null,fetched,mb:Math.round(process.memoryUsage.rss()/1048576),...(fileMs?{slow}:{})}});
 };
 tell({step:'OCR',ocr:{done:0,total:todo.length,pages:0,failed:0,workers,perHour:null,fetched:0,...(fileMs?{slow:0}:{})}},true);
 // Je Worker eine Datei zur Zeit (bei den vielen Dateien mit einer Seite hätten sonst nicht alle Worker zu tun); so liegen
 // höchstens so viele nachgeladene Dateien wie Worker gleichzeitig da
 // In Paketen zu --recycle Dateien (Standard 25), danach frische OCR-Worker: tesseract.js gibt Speicher nicht vollständig
 // frei, ein Lauf über tausende Dateien wuchs auf 4 GB und brachte den Auftragsdienst an seine Grenze (12.10.2026)
 const queue=todo.map(x=>x.sha);
 while(queue.length&&!late()){
  const batch=queue.splice(0,recycle);
  await Promise.all(Array.from({length:workers},async()=>{while(batch.length&&!late()&&rssMb()<rssLimit)await one(batch.shift());}));
  if(batch.length)queue.unshift(...batch);
  if(rssMb()>=rssLimit){console.log(`Speicher ${Math.round(rssMb())} MB über ${rssLimit} MB: Paket endet, der nächste Lauf übernimmt ${queue.length} Dateien`);break;}
  if(queue.length&&!late()){await ocr.terminate();ocr=await ocrScheduler(workers);}
 }
 if(queue.length&&late())console.log(`${halted?'Angehalten':`Zeitgrenze erreicht (${maxMinutes} min)`}, ${queue.length} Dateien im nächsten Lauf`);
 await ocr.terminate();
 console.log(`fertig: ${files} Dateien (${primary} Hauptdokumente), ${pagesDone} Seiten per OCR, ${failed} Fehler (davon ${changed} geändert), ${fetched} nachgeladen und wieder gelöscht, ${skipped} Server ausgelassen${fileMs?`, ${slow} über der Zeitgrenze (später)`:''}, ${dropped} zu große PDFs gelöscht (${elapsed(t0)})`);
 stepSummary({...summary(),open:queue.length+skipped+slow,...(fileMs?{}:{slow:undefined})});
 try{fs.unlinkSync(beatFile);}catch{/* keins */}
 if(!chained)progress(myLane,null);
 F?.close();
}
store.close();
