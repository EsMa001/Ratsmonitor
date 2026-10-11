// Textfassungen der lokalen PDF-Ablage (server/node/pdf-store.mjs): je Datei ein .txt neben dem PDF, Seiten roh wie pdf.js
// sie liefert (getrennt durch \f), damit readDocument daraus genau den Text des PDFs bildet (mergePages in documents.mjs).
//
//   node scripts/pdf-store/text.mjs [--limit N]    Textebene aller geladenen PDFs ohne Textfassung auslesen (schnell, ~12 ms je Datei)
//   node scripts/pdf-store/text.mjs --ocr [--workers 4] [--limit N]
//                                                  Seiten ohne Textebene (unter MIN_CHARS Zeichen) per OCR lesen
//   node scripts/pdf-store/text.mjs --stats        Stand der Textfassungen
// OCR: tesseract.js (Deutsch) und @napi-rs/canvas aus ~/code/video-tools (VIDEO_TOOLS), Seiten mit OCR_SCALE gerendert.
// Neue Fassung des Leseverfahrens: TEXT_VERSION erhöhen, dann liest der erste Aufruf alle Dateien neu.
import fs from 'node:fs';
import os from 'node:os';
import {getDocumentProxy,renderPageAsImage} from 'unpdf';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';

export const TEXT_VERSION=1,MIN_CHARS=20,OCR_SCALE=2.5;
const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const limit=Number(opt('limit',0));
const needsOcr=page=>page.replace(/\s+/g,'').length<MIN_CHARS;
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
  try{
   const pdf=await getDocumentProxy(new Uint8Array(fs.readFileSync(store.file(sha))),{isEvalSupported:false,verbosity:0});
   try{
    const pages=[];
    for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);pages.push((await page.getTextContent()).items.filter(x=>x.str!=null).map(x=>x.str+(x.hasEOL?'\n':'')).join(''));page.cleanup();}
    const ocrNeeded=pages.filter(needsOcr).length;
    store.putText(sha,pages,{method:'text',version:TEXT_VERSION,ocrNeeded});ok++;if(ocrNeeded)waiting++;
   }finally{await pdf.loadingTask?.destroy?.();}
  }catch(e){store.failText(sha,e.message,{version:TEXT_VERSION});failed++;}
  if((ok+failed)%2000===0)console.log(`${ok+failed}/${todo.length}, ${failed} defekt, ${waiting} mit Seiten für OCR, ${elapsed(t0)}`);
 }
 console.log(`fertig: ${ok} Textfassungen, ${failed} defekt, ${waiting} mit Seiten für OCR (${elapsed(t0)})`);
}else{
 // OCR: nur Seiten ohne Textebene, jede Seite einzeln gerendert; die übrigen Seiten bleiben, wie pdf.js sie liest.
 const tools=process.env.VIDEO_TOOLS||os.homedir()+'/code/video-tools';
 const {createScheduler,createWorker}=await import(tools+'/node_modules/tesseract.js/src/index.js');
 const canvasImport=()=>import(tools+'/node_modules/@napi-rs/canvas/index.js');
 const workers=Number(opt('workers',4)),scheduler=createScheduler();
 for(let i=0;i<workers;i++)scheduler.addWorker(await createWorker('deu',1,{cachePath:tools+'/cache/tesseract'}));
 const todo=store.ocrQueue().slice(0,limit||undefined),t0=Date.now();let files=0,pagesDone=0,failed=0;
 console.log(`${todo.length} Dateien mit Seiten ohne Textebene, ${workers} OCR-Worker`);
 const one=async sha=>{
  const pages=store.textPages(sha);if(!pages)return;
  const bytes=fs.readFileSync(store.file(sha)),want=pages.map((p,i)=>needsOcr(p)?i:-1).filter(i=>i>=0);
  try{
   await Promise.all(want.map(async i=>{
    const png=await renderPageAsImage(new Uint8Array(bytes),i+1,{canvasImport,scale:OCR_SCALE});
    pages[i]=(await scheduler.addJob('recognize',Buffer.from(png))).data.text;pagesDone++;
   }));
   store.putText(sha,pages,{method:want.length===pages.length?'ocr':'mixed',version:TEXT_VERSION,ocrPages:want.length,ocrNeeded:0});files++;
  }catch(e){failed++;console.error('OCR',sha.slice(0,12),e.message);}
  if((files+failed)%100===0)console.log(`${files+failed}/${todo.length} Dateien, ${pagesDone} Seiten, ${failed} Fehler, ${elapsed(t0)}`);
 };
 // Mehrere Dateien gleichzeitig, damit alle OCR-Worker zu tun haben.
 const queue=[...todo];await Promise.all(Array.from({length:workers},async()=>{while(queue.length)await one(queue.shift());}));
 await scheduler.terminate();
 console.log(`fertig: ${files} Dateien, ${pagesDone} Seiten per OCR, ${failed} Fehler (${elapsed(t0)})`);
}
store.close();
