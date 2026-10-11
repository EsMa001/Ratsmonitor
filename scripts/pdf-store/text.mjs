// Textfassungen der lokalen PDF-Ablage (server/node/pdf-store.mjs): je Datei ein .txt neben dem PDF, Seiten roh wie pdf.js
// sie liefert (getrennt durch \f), damit readDocument daraus genau den Text des PDFs bildet (mergePages in documents.mjs).
//
//   node scripts/pdf-store/text.mjs [--limit N]    Textebene aller geladenen PDFs ohne Textfassung auslesen (schnell, ~12 ms je Datei)
//   node scripts/pdf-store/text.mjs --ocr [--workers 4] [--limit N]
//                                                  Seiten ohne Textebene (unter MIN_CHARS Zeichen) per OCR lesen
//   node scripts/pdf-store/text.mjs --stats        Stand der Textfassungen
//   --max-minutes M: danach keine neue Datei mehr anfangen (nächtliche Kette, nightly.mjs); der nächste Lauf macht weiter.
// OCR: tesseract.js (Deutsch) und @napi-rs/canvas aus OCR_TOOLS (Ordner mit node_modules; Standard VIDEO_TOOLS bzw.
// ~/code/video-tools), Sprachdaten in OCR_CACHE (Standard <OCR_TOOLS>/cache/tesseract, beim ersten Lauf geladen),
// Seiten mit OCR_SCALE gerendert. Eine Sperre (ocr.lock in der Ablage) lässt nur einen OCR-Lauf zur Zeit zu: Ein zweiter (etwa der
// Schritt der Nachtkette, während ein langer Lauf von Hand läuft) endet sofort, statt dieselben Seiten noch einmal zu lesen.
// Lesen und OCR je Datei: store-lib.mjs (auch für den Tausch in fetch.mjs). Neue Fassung des Leseverfahrens: TEXT_VERSION
// dort erhöhen, dann liest der erste Aufruf alle Dateien neu.
import fs from 'node:fs';
import path from 'node:path';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {TEXT_VERSION,readTextLayer,ocrScheduler,ocrFile} from './store-lib.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const limit=Number(opt('limit',0)),maxMinutes=Number(opt('max-minutes',0)),started=Date.now();
const late=()=>maxMinutes>0&&Date.now()-started>maxMinutes*60000;
const elapsed=t0=>((Date.now()-t0)/1000).toFixed(0)+' s';

if(flag('stats')){
 for(const r of store.textStats())console.log(String(r.status).padEnd(6),String(r.method||'').padEnd(6),String(r.n).padStart(8),'Dateien',r.chars?(r.chars/1048576).toFixed(0)+' MB Text':'',r.waiting?r.waiting+' warten auf OCR':'');
 process.exit(0);
}

if(!flag('ocr')){
 // Textebene: Text je Seite wie unpdf getPageText (Textstücke, Zeilenende bei hasEOL).
 const todo=store.textless(TEXT_VERSION).slice(0,limit||undefined),t0=Date.now();let ok=0,failed=0,waiting=0;
 console.log(`${todo.length} Dateien ohne Textfassung`);
 for(const sha of todo){
  if(late()){console.log(`Zeitgrenze erreicht (${maxMinutes} min), Rest im nächsten Lauf`);break;}
  try{if(await readTextLayer(store,sha))waiting++;ok++;}
  catch(e){store.failText(sha,e.message,{version:TEXT_VERSION});failed++;}
  if((ok+failed)%2000===0)console.log(`${ok+failed}/${todo.length}, ${failed} defekt, ${waiting} mit Seiten für OCR, ${elapsed(t0)}`);
 }
 console.log(`fertig: ${ok} Textfassungen, ${failed} defekt, ${waiting} mit Seiten für OCR (${elapsed(t0)})`);
}else{
 // OCR: nur Seiten ohne Textebene, jede Seite einzeln gerendert; die übrigen Seiten bleiben, wie pdf.js sie liest.
 // Sperre: Datei mit der Prozessnummer; eine verwaiste (Prozess läuft nicht mehr) wird übernommen
 const lock=path.join(store.dir,'ocr.lock'),alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};
 try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}
 catch{const pid=Number(fs.readFileSync(lock,'utf8'));if(pid&&alive(pid)){console.log(`OCR läuft schon (Prozess ${pid}), nichts zu tun`);store.close();process.exit(0);}fs.writeFileSync(lock,String(process.pid));}
 const release=()=>{try{if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock);}catch{/* schon weg */}};
 process.on('exit',release);for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{release();process.exit(1);});
 const workers=Number(opt('workers',4)),ocr=await ocrScheduler(workers);
 if(!ocr){console.error('OCR-Werkzeuge fehlen (OCR_TOOLS).');process.exit(1);}
 const todo=store.ocrQueue().slice(0,limit||undefined),t0=Date.now();let files=0,pagesDone=0,failed=0;
 console.log(`${todo.length} Dateien mit Seiten ohne Textebene, ${workers} OCR-Worker`);
 const one=async sha=>{
  try{pagesDone+=await ocrFile(store,sha,ocr);files++;}
  catch(e){failed++;console.error('OCR',sha.slice(0,12),e.message);}
  if((files+failed)%100===0)console.log(`${files+failed}/${todo.length} Dateien, ${pagesDone} Seiten, ${failed} Fehler, ${elapsed(t0)}`);
 };
 // Mehrere Dateien gleichzeitig, damit alle OCR-Worker zu tun haben.
 const queue=[...todo];await Promise.all(Array.from({length:workers},async()=>{while(queue.length&&!late())await one(queue.shift());}));
 if(queue.length)console.log(`Zeitgrenze erreicht (${maxMinutes} min), ${queue.length} Dateien im nächsten Lauf`);
 await ocr.terminate();
 console.log(`fertig: ${files} Dateien, ${pagesDone} Seiten per OCR, ${failed} Fehler (${elapsed(t0)})`);
}
store.close();
