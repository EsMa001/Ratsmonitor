// Gemeinsame Bausteine der PDF-Ablage (server/node/pdf-store.mjs) für text.mjs, budget.mjs und fetch.mjs:
// Textebene und OCR einer Datei, Rang je Datei (shared/pdf-rank.mjs) und die feste Grenze mit Tausch (keeper).
import fs from 'node:fs';
import os from 'node:os';
import {getDocumentProxy,renderPageAsImage} from 'unpdf';
import {rankPdf,TYPE_VALUE} from '../../shared/pdf-rank.mjs';

// Neue Fassung des Leseverfahrens: TEXT_VERSION erhöhen, dann liest der erste Aufruf von text.mjs alle Dateien neu.
export const TEXT_VERSION=1,MIN_CHARS=20,OCR_SCALE=2.5;
export const needsOcr=page=>page.replace(/\s+/g,'').length<MIN_CHARS;

/** Textebene einer Datei lesen und ablegen (Text je Seite wie unpdf getPageText); Rückgabe: Seiten, die auf OCR warten. */
export async function readTextLayer(store,sha){
 const pdf=await getDocumentProxy(new Uint8Array(fs.readFileSync(store.file(sha))),{isEvalSupported:false,verbosity:0});
 try{
  const pages=[];
  for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);pages.push((await page.getTextContent()).items.filter(x=>x.str!=null).map(x=>x.str+(x.hasEOL?'\n':'')).join(''));page.cleanup();}
  const ocrNeeded=pages.filter(needsOcr).length;
  store.putText(sha,pages,{method:'text',version:TEXT_VERSION,ocrNeeded});
  return ocrNeeded;
 }finally{await pdf.loadingTask?.destroy?.();}
}

/** OCR-Worker (tesseract.js, Deutsch) aus OCR_TOOLS; null, wenn die Werkzeuge fehlen. */
export async function ocrScheduler(workers=2){
 const tools=process.env.OCR_TOOLS||process.env.VIDEO_TOOLS||os.homedir()+'/code/video-tools',cache=process.env.OCR_CACHE||tools+'/cache/tesseract';
 let tesseract;try{tesseract=await import(tools+'/node_modules/tesseract.js/src/index.js');}catch{return null;}
 // tesseract.js speichert die Sprachdaten nur in einen vorhandenen Ordner; sonst lädt jeder Lauf sie neu aus dem Internet
 try{fs.mkdirSync(cache,{recursive:true});}catch{/* ohne Cache geht es auch, nur langsamer */}
 const scheduler=tesseract.createScheduler();
 for(let i=0;i<workers;i++)scheduler.addWorker(await tesseract.createWorker('deu',1,{cachePath:cache}));
 return {scheduler,workers,canvasImport:()=>import(tools+'/node_modules/@napi-rs/canvas/index.js'),terminate:()=>scheduler.terminate()};
}

/* Größtes Bild je Seite für OCR (Pixel): Pläne und Plakate im Großformat würden bei OCR_SCALE sonst riesig */
const MAX_PIXELS=12e6;
/** Seiten ohne Textebene einer Datei per OCR lesen; Rückgabe: Zahl der gelesenen Seiten. Die Datei wird einmal geöffnet, die
    Seiten in Gruppen so groß wie die Zahl der OCR-Worker gelesen (alle Seiten auf einmal zu rendern sprengte bei großen Scans
    Speicher und CPU und hielt den Lauf an, 12.10.2026). */
export async function ocrFile(store,sha,ocr){
 const pages=store.textPages(sha);if(!pages)return 0;
 const want=pages.map((p,i)=>needsOcr(p)?i:-1).filter(i=>i>=0);
 if(want.length){
  const pdf=await getDocumentProxy(new Uint8Array(fs.readFileSync(store.file(sha))),{isEvalSupported:false,verbosity:0});
  try{
   for(let k=0;k<want.length;k+=ocr.workers){
    await Promise.all(want.slice(k,k+ocr.workers).map(async i=>{
     const page=await pdf.getPage(i+1),v=page.getViewport({scale:1});page.cleanup();
     const scale=Math.max(0.5,Math.min(OCR_SCALE,Math.sqrt(MAX_PIXELS/Math.max(1,v.width*v.height))));
     const png=await renderPageAsImage(pdf,i+1,{canvasImport:ocr.canvasImport,scale});
     pages[i]=(await ocr.scheduler.addJob('recognize',Buffer.from(png))).data.text;
    }));
   }
  }finally{await pdf.loadingTask?.destroy?.();}
 }
 store.putText(sha,pages,{method:want.length===pages.length?'ocr':'mixed',version:TEXT_VERSION,ocrPages:want.length,ocrNeeded:0});
 return want.length;
}

// Eine Zeile je Datei (gleiche Datei unter mehreren Adressen: der höchste Wert zählt). other: nur als übriges PDF verlinkt
// (role 'other', fetch.mjs --others), dann gilt nur die Textebene, kein OCR.
const FILES=`SELECT p.sha256 AS sha,MAX(p.bytes) AS bytes,GROUP_CONCAT(COALESCE(p.doc_type,'other')) AS types,MAX(COALESCE(p.formal,0)) AS formal,MIN(p.formal) AS minFormal,
 MIN(COALESCE(p.role,'')='other') AS other,
 MIN(p.event_date) AS eventDate,t.pages,t.ocr_pages AS ocrPages,t.ocr_needed AS ocrNeeded,t.chars
 FROM pdfs p LEFT JOIN texts t ON t.sha256=p.sha256 WHERE p.status='ok'`;
const ranked=f=>{
 const type=f.types.split(',').sort((a,b)=>(TYPE_VALUE[b]??0)-(TYPE_VALUE[a]??0))[0];
 const scan=f.pages>0&&((f.ocrPages||0)+(f.ocrNeeded||0))>=f.pages/2;
 const r=rankPdf({type,formal:f.minFormal===1,scan,eventDate:f.eventDate,bytes:f.bytes});
 /* Feste Regel: übrige PDFs stehen immer unter allen Hauptdokumenten (Wert je Byte liegt weit unter 1, also negativ):
    ein neues Hauptdokument verdrängt zuerst übrige PDFs, ein übriges nie ein Hauptdokument */
 return {...f,type,scan,...r,score:f.other?r.score-1:r.score};
};
/** Alle geladenen Dateien mit Rang, beste zuerst */
export const rankedFiles=store=>store.db.prepare(FILES+' GROUP BY p.sha256').all().map(ranked).sort((a,b)=>b.score-a.score);
/** Eine Datei mit Rang (oder null, wenn sie nicht geladen ist) */
export const rankedFile=(store,sha)=>{const f=store.db.prepare(FILES+' AND p.sha256=? GROUP BY p.sha256').get(sha);return f?ranked(f):null;};
/** Platz der Textfassungen in Bytes (sie zählen mit in die Grenze und bleiben immer) */
export const textBytes=store=>Number(store.db.prepare("SELECT COALESCE(SUM(chars),0) AS c FROM texts WHERE status='ok'").get().c)*1.05;
/** Belegter Platz: PDFs und Texte */
export const usedBytes=store=>store.size()+textBytes(store);

/**
 * Feste Grenze mit Tausch (fetch.mjs --budget-gb): Solange Platz ist, bleibt jede neue Datei. Ist die Grenze erreicht, wird
 * die neue Datei sofort bewertet (Textebene gelesen, damit Scan bekannt ist) und mit der schlechtesten behaltenen verglichen:
 * besser → die schlechteste fliegt raus, sonst die neue. Zu große Dateien (rankPdf keep:false) behalten nur den Text.
 * Vor dem Löschen ist der Text immer vollständig: fehlende Textebene wird gelesen, Seiten ohne Text per OCR (sofort, auch bei
 * vielen Seiten; nicht bei übrigen PDFs, die behalten nur die Textebene). Fehlen die OCR-Werkzeuge, bleibt ein Scan als PDF liegen (lieber kurz über der Grenze als Text verlieren).
 * Entscheidungen laufen nacheinander; überschritten wird die Grenze nur um gerade geladene, noch nicht entschiedene Dateien.
 */
export function keeper(store,limit,{ocrWorkers=2,log=()=>{}}={}){
 const all=rankedFiles(store),kept=all.filter(f=>f.keep).sort((a,b)=>a.score-b.score),have=new Set(kept.map(f=>f.sha));
 const c={kept:0,swapped:0,rejected:0,tooBig:0,tooBigLater:0,ocrPages:0,stuck:0};
 let ocr,lock=Promise.resolve();
 /* Belegter Platz: einmal gezählt, dann fortgeschrieben (die volle Zählung liest alle Einträge der Ablage und wäre je Datei
    zu langsam); alle SYNC Entscheidungen neu gezählt, damit sich keine Abweichung ansammelt */
 const SYNC=2000,textOf=sha=>Number(store.db.prepare("SELECT chars FROM texts WHERE sha256=? AND status='ok'").get(sha)?.chars||0)*1.05;
 let used=usedBytes(store),since=0;
 /* Zu große Dateien (nie als PDF behalten) mit vollständigem Text vom letzten Mal jetzt löschen: Ihre Scans hat inzwischen der
    OCR-Schritt der Nachtkette gelesen (siehe decide) */
 for(const f of all)if(!f.keep&&f.chars!=null&&!(f.ocrNeeded>0&&!f.other)){store.dropPdf(f.sha);used-=f.bytes;c.tooBig++;}
 /** Text vollständig? Sonst Textebene lesen und Seiten ohne Text per OCR (übrige PDFs nur Textebene); false, wenn OCR nötig,
     aber nicht möglich ist */
 const complete=async f=>{
  const t=store.db.prepare('SELECT version,ocr_needed AS ocrNeeded,status FROM texts WHERE sha256=?').get(f.sha),before=textOf(f.sha);
  let waiting=t&&t.version>=TEXT_VERSION?(t.status==='ok'?t.ocrNeeded:0):null;
  try{
   if(waiting===null){try{waiting=await readTextLayer(store,f.sha);}catch(e){store.failText(f.sha,e.message,{version:TEXT_VERSION});waiting=0;}}
   if(!waiting||f.other)return true;
   ocr??=await ocrScheduler(ocrWorkers)||false;
   if(!ocr)return false;
   c.ocrPages+=await ocrFile(store,f.sha,ocr);return true;
  }finally{used+=textOf(f.sha)-before;}
 };
 const drop=async f=>{if(!await complete(f)){c.stuck++;log(`OCR nicht möglich, PDF bleibt: ${f.sha.slice(0,12)}`);return false;}store.dropPdf(f.sha);used-=f.bytes;return true;};
 const insert=f=>{let lo=0,hi=kept.length;while(lo<hi){const m=(lo+hi)>>1;if(kept[m].score<f.score)lo=m+1;else hi=m;}kept.splice(lo,0,f);have.add(f.sha);};
 const decide=async(sha,before)=>{
  if(have.has(sha))return 'schon da';
  const f=rankedFile(store,sha);if(!f)return 'fehlt';
  used+=f.bytes+textOf(sha)-before;
  if(++since>=SYNC){since=0;used=usedBytes(store);}
  /* Zu groß (nie als PDF behalten, die Grenze betrifft das nicht): ohne Scan sofort löschen; einen Scan nicht hier per OCR
     lesen (das hielte alle Downloads an), sondern liegen lassen, bis der OCR-Schritt der Nachtkette ihn gelesen hat */
  if(!f.keep){if(f.ocrNeeded>0&&!f.other){c.tooBigLater++;return 'zu groß, OCR folgt';}await drop(f);c.tooBig++;return 'zu groß';}
  while(used>limit){
   const worst=kept[0];
   if(!worst||worst.score>=f.score){await drop(f);c.rejected++;return 'nicht besser';}
   kept.shift();have.delete(worst.sha);
   if(!await drop(worst)){insert(worst);await drop(f);c.rejected++;return 'nicht besser';}
   c.swapped++;
  }
  insert(f);c.kept++;return 'behalten';
 };
 return {
  /** Neue Datei einordnen: Textebene sofort und parallel (sie zeigt, ob es ein Scan ist, und der Text bleibt in jedem Fall),
      die Entscheidung danach nacheinander in Aufrufreihenfolge */
  admit:async sha=>{
   if(have.has(sha))return 'schon da';
   const before=textOf(sha);
   try{await readTextLayer(store,sha);}catch(e){store.failText(sha,e.message,{version:TEXT_VERSION});}
   return lock=lock.then(()=>decide(sha,before),()=>decide(sha,before));
  },
  stats:()=>({...c}),
  /** Belegter Platz, wie fortgeschrieben */
  used:()=>used,
  close:async()=>{await lock.catch(()=>{});if(ocr)await ocr.terminate();},
 };
}

/** Grund eines fehlgeschlagenen Abrufs in festen Gruppen (Admin-Reiter, fetch.mjs --errors) */
export function errorReason({status,http,error}){
 const e=String(error||'');
 if(status==='unsupported')return 'Kein PDF (Antwort ist etwas anderes)';
 if(http===404||http===410)return 'Nicht gefunden (404/410)';
 if(http===401||http===403)return 'Kein Zugriff (401/403)';
 if(http===429||http===503)return 'Server überlastet (429/503)';
 if(http>=500)return 'Serverfehler (5xx)';
 if(http>=400)return 'Abgelehnte Anfrage (4xx)';
 if(/timeout|aborted/i.test(e))return 'Zeitüberschreitung (über 10 s)';
 if(/zu groß/i.test(e))return 'Zu groß (über 30 MB)';
 if(/ENOTFOUND|EAI_AGAIN/.test(e))return 'Server nicht gefunden (DNS)';
 if(/fetch failed|ECONN|socket|TLS|certificate|SSL/i.test(e))return 'Keine Antwort (Verbindung fehlgeschlagen)';
 return 'Sonstiges';
}
