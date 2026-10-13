// Textfassungen der lokalen PDF-Ablage (server/node/pdf-store.mjs): je Datei ein .txt neben dem PDF, Seiten roh wie pdf.js
// sie liefert (getrennt durch \f), damit readDocument daraus genau den Text des PDFs bildet (mergePages in documents.mjs).
//
//   node scripts/pdf-store/text.mjs [--limit N]    Textebene aller geladenen PDFs ohne Textfassung auslesen (schnell, ~12 ms je Datei)
//   node scripts/pdf-store/text.mjs --ocr [--workers 3] [--limit N] [--timeout-ms 10000] [--file-minutes M]
//                                                  Seiten ohne Textebene (unter MIN_CHARS Zeichen) per OCR lesen (Auftrag „OCR
//                                                  starten“): alle PDFs, Hauptdokumente und übrige, in einer Reihe (ocrQueue): die
//                                                  mit den wenigsten OCR-Seiten zuerst, bei gleich vielen Hauptdokumente vor
//                                                  übrigen. Verdrängte Dateien ('text-only') werden kurz nachgeladen, gelesen und
//                                                  gleich wieder gelöscht (ocrWithRefetch in store-lib.mjs); ein Server mit 3
//                                                  Fehlern in Folge fällt für den Lauf heraus. Je Worker eine Datei zur Zeit.
//   --recycle N: Paketgröße (Standard 25); --rss-mb N: Speichergrenze je Paket (Standard 2500); jedes Paket läuft als eigener Prozess (--child), gegen wachsenden Speicher
//   --file-minutes M (nightly.mjs setzt 5): Zeitgrenze je Datei; wer länger braucht, wird abgebrochen, nichts geschrieben und
//                                                  ans Ende der Reihe gestellt (ocr_slow). Ohne: keine Grenze.
//   node scripts/pdf-store/text.mjs --stats        Stand der Textfassungen
//   --max-minutes M: danach keine neue Datei mehr anfangen (nächtliche Kette, nightly.mjs); der nächste Lauf macht weiter.
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
import {TEXT_VERSION,readTextLayer,ocrScheduler,ocrFile,ocrWithRefetch,downloader,dropIfTooBig} from './store-lib.mjs';
import {progress,onStop,stepSummary,lane} from './state.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const limit=Number(opt('limit',0)),maxMinutes=Number(opt('max-minutes',0)),started=Date.now();
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

if(!flag('ocr')){
 // Textebene: Text je Seite wie unpdf getPageText (Textstücke, Zeilenende bei hasEOL).
 const todo=store.textless(TEXT_VERSION).slice(0,limit||undefined),t0=Date.now();let ok=0,failed=0,waiting=0,dropped=0;
 console.log(`${todo.length} Dateien ohne Textfassung`);
 for(const sha of todo){
  if(late()){console.log(halted?'Rest im nächsten Lauf':`Zeitgrenze erreicht (${maxMinutes} min), Rest im nächsten Lauf`);break;}
  try{if(await readTextLayer(store,sha))waiting++;ok++;if(dropIfTooBig(store,sha))dropped++;}
  catch(e){store.failText(sha,e.message,{version:TEXT_VERSION});failed++;}
  if((ok+failed)%2000===0)console.log(`${ok+failed}/${todo.length}, ${failed} defekt, ${waiting} mit Seiten für OCR, ${elapsed(t0)}`);
  tell({step:'Textebene',text:{done:ok+failed,total:todo.length,failed,waiting}});
 }
 console.log(`fertig: ${ok} Textfassungen, ${failed} defekt, ${waiting} mit Seiten für OCR, ${dropped} zu große PDFs gelöscht (${elapsed(t0)})`);
 stepSummary({files:ok,failed,waiting,dropped,open:todo.length-ok-failed,stopped:halted});
 if(!chained)progress(myLane,null);
}else{
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
     Auftragsdienstes (13.10.2026, auch mit frischen OCR-Workern je Paket). Fortschritt und Zusammenfassung sind die Summen. */
  const per=Number(opt('recycle',25)),me=fileURLToPath(import.meta.url),fileMin=opt('file-minutes');
  const tot={files:0,primary:0,pages:0,failed:0,changed:0,fetched:0,skipped:0,dropped:0,slow:0},t0=Date.now();
  const total=store.ocrQueue().length,workers=Number(opt('workers',3));
  console.log(`${total} Dateien mit Seiten ohne Textebene, in Paketen zu ${per} Dateien als eigene Prozesse`);
  const show=force=>{const done=tot.files+tot.failed+tot.skipped+tot.slow,h=(Date.now()-t0)/3600000;
   tell({step:'OCR',ocr:{done,total,pages:tot.pages,failed:tot.failed,workers,perHour:h>0.05?Math.round(done/h):null,fetched:tot.fetched,...(fileMin?{slow:tot.slow}:{})}},force);};
  show(true);
  let stoppedChild=false;
  while(!late()){
   const left=maxMinutes?Math.floor(maxMinutes-(Date.now()-started)/60000):0;
   if(maxMinutes&&left<1)break;
   const sumFile=path.join(store.dir,`ocr-paket-${process.pid}.json`);try{fs.unlinkSync(sumFile);}catch{/* keine */}
   const code=await new Promise(resolve=>{
    child=spawn(process.execPath,['--no-warnings','--max-old-space-size=2048',me,'--ocr','--child','--limit',String(per),'--workers',String(workers),'--timeout-ms',opt('timeout-ms','10000'),'--rss-mb',opt('rss-mb','2500'),
     ...(fileMin?['--file-minutes',fileMin]:[]),...(left?['--max-minutes',String(left)]:[])],{stdio:'inherit',env:{...process.env,RM_STEP_SUMMARY:sumFile,RM_NO_PROGRESS:'1'}});
    child.on('error',()=>resolve(127));child.on('exit',(c,sig)=>resolve(c??sig));
   });
   child=null;
   let r={};try{r=JSON.parse(fs.readFileSync(sumFile,'utf8'));fs.unlinkSync(sumFile);}catch{/* Paket ohne Zusammenfassung */}
   for(const k of Object.keys(tot))if(typeof r[k]==='number')tot[k]+=r[k];
   show(true);
   if(halted||r.stopped){stoppedChild=true;break;}
   const worked=(r.files||0)+(r.failed||0)+(r.slow||0);
   if(!worked){if(code!==0)console.error(`OCR-Paket endete mit ${code} ohne Ergebnis, Lauf beendet`);break;}
  }
  const open=store.ocrQueue().length;
  console.log(`fertig: ${tot.files} Dateien (${tot.primary} Hauptdokumente), ${tot.pages} Seiten per OCR, ${tot.failed} Fehler (davon ${tot.changed} geändert), ${tot.fetched} nachgeladen und wieder gelöscht, ${tot.skipped} Server ausgelassen${fileMin?`, ${tot.slow} über der Zeitgrenze (später)`:''}, ${tot.dropped} zu große PDFs gelöscht, ${open} offen (${elapsed(t0)})`);
  stepSummary({...tot,open,seconds:Math.round((Date.now()-t0)/1000),stopped:halted||stoppedChild,...(fileMin?{}:{slow:undefined})});
  if(!chained)progress(myLane,null);
  store.close();process.exit(0);
 }
 const workers=Number(opt('workers',3)),recycle=Number(opt('recycle',25));
 // Speicherwächter: nativer Speicher (Canvas, WebAssembly) wächst je Seite und gibt ihn im Prozess nicht zurück; über der Grenze
 // beendet sich das Paket nach der laufenden Datei, der Treiber startet das nächste (13.10.2026: 6,6 GB bei 150 Dateien)
 const rssMb=()=>process.memoryUsage.rss()/1048576,rssLimit=Number(opt('rss-mb',2500));let ocr=await ocrScheduler(workers);
 if(!ocr){console.error('OCR-Werkzeuge fehlen (OCR_TOOLS).');process.exit(1);}
 const todo=store.ocrQueue().slice(0,limit||undefined),main=new Set(todo.filter(x=>x.main).map(x=>x.sha)),t0=Date.now();
 let files=0,primary=0,pagesDone=0,failed=0,dropped=0,fetched=0,changed=0,skipped=0,slow=0;
 const fileMs=Number(opt('file-minutes',0))*60000;
 console.log(`${todo.length} Dateien mit Seiten ohne Textebene (${main.size} Hauptdokumente), ${workers} OCR-Worker`);
 // Nachladen: ein Server mit 3 Fehlern in Folge fällt für diesen Lauf heraus (seine Dateien bleiben offen)
 const get=downloader({timeoutMs:Number(opt('timeout-ms',10000)),signal:halt.signal}),fails=new Map();
 const download=async url=>{
  const host=new URL(url).host;
  if((fails.get(host)||0)>=3)throw Object.assign(Error('Server ausgelassen'),{skip:true});
  try{const b=await get(url);fails.set(host,0);return b;}catch(e){if(!halted)fails.set(host,(fails.get(host)||0)+1);throw e;}
 };
 const read=sha=>ocrFile(store,sha,ocr,{halt:()=>halted,deadline:fileMs?Date.now()+fileMs:0});
 const one=async sha=>{
  try{
   const r=await ocrWithRefetch(store,sha,{download,read,halted:()=>halted});
   pagesDone+=r.pages;if(r.fetched)fetched++;
   if(r.result==='ok'){files++;if(main.has(sha))primary++;if(dropIfTooBig(store,sha))dropped++;}
   else if(r.result==='skipped')skipped++;else{failed++;if(r.result==='changed')changed++;}
  }
  catch(e){
   if(e.halted){queue.unshift(sha);return;}
   if(e.slow){slow++;store.markSlow(sha);console.log(`OCR ${sha.slice(0,12)} über der Zeitgrenze (${fileMs/60000} min), ans Ende der Reihe`);}
   else{failed++;console.error('OCR',sha.slice(0,12),e.message);}
  }
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
 stepSummary({files,primary,pages:pagesDone,failed,changed,fetched,skipped,dropped,open:queue.length+skipped+slow,seconds:Math.round((Date.now()-t0)/1000),stopped:halted,...(fileMs?{slow}:{})});
 if(!chained)progress(myLane,null);
}
store.close();
