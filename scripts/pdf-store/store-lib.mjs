// Gemeinsame Bausteine der PDF-Ablage (server/node/pdf-store.mjs) für text.mjs, budget.mjs und fetch.mjs:
// Textebene und OCR einer Datei, Score je Datei (shared/pdf-rank.mjs) und die feste Grenze mit Tausch (keeper).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {getDocumentProxy,renderPageAsImage} from 'unpdf';
import {rankPdf,TYPE_VALUE} from '../../shared/pdf-rank.mjs';
import {effectiveType} from '../../shared/document-type.mjs';
import {fetchDocument} from '../../server/integrations/document-proxy.mjs';
import {bodyBytes} from '../../server/integrations/body-bytes.mjs';
import {SOURCE_USER_AGENT} from '../../server/integrations/no-redirect.mjs';

/** Abruf wie /api/dokument (nur öffentliche https-Adressen, jede Weiterleitung geprüft), aber mit der Projektkennung (fetch.mjs,
    text.mjs --ocr --others). Die Zeitgrenze gilt je Abruf für Kopf und Inhalt zusammen; signal bricht ab (Anhalten). */
export function downloader({timeoutMs=10000,signal=null}={}){
 const request=(url,init)=>fetch(url,{...init,signal:AbortSignal.any([init.signal,AbortSignal.timeout(timeoutMs),signal].filter(Boolean)),headers:{'User-Agent':SOURCE_USER_AGENT}});
 return async url=>{
  const {response:r}=await fetchDocument(url,{request});
  if(!r.ok){await r.body?.cancel().catch(()=>{});throw Object.assign(Error('HTTP '+r.status),{http:r.status});}
  return bodyBytes(r,30*1048576,{message:'Dokument zu groß'});
 };
}

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
 // Tesseract meldet jedes Textstück unter 3 Pixel Breite (Tabellenstrich, Fleck im Scan), das es auslässt; der Rest der Seite
 // wird normal gelesen. Die Zeilen verdeckten im Protokoll echte Meldungen (443 an einem Tag), deshalb einmal je Prozess ausfiltern.
 for(const stream of [process.stdout,process.stderr])if(!stream.__rmQuiet){const write=stream.write.bind(stream);stream.__rmQuiet=true;
  stream.write=(chunk,...rest)=>/^Image too small to scale!!/.test(String(chunk))?(typeof rest.at(-1)==="function"&&rest.at(-1)(),true):write(chunk,...rest);}
 const scheduler=tesseract.createScheduler();
 for(let i=0;i<workers;i++)scheduler.addWorker(await tesseract.createWorker('deu',1,{cachePath:cache}));
 return {scheduler,workers,canvasImport:()=>import(tools+'/node_modules/@napi-rs/canvas/index.js'),terminate:()=>scheduler.terminate()};
}

/* Größtes Bild je Seite für OCR (Pixel): Pläne und Plakate im Großformat würden bei OCR_SCALE sonst riesig */
const MAX_PIXELS=12e6;
/** Seiten ohne Textebene einer Datei per OCR lesen; Rückgabe: Zahl der gelesenen Seiten. Die Datei wird einmal geöffnet, die
    Seiten in Gruppen so groß wie die Zahl der OCR-Worker gelesen (alle Seiten auf einmal zu rendern sprengte bei großen Scans
    Speicher und CPU und hielt den Lauf an, 12.10.2026). halt(): vor jeder Gruppe gefragt; true bricht ab (Fehler mit halted),
    ohne etwas zu schreiben: Die Datei bleibt in der OCR-Reihe. deadline (ms seit 1970, 0 = keine): danach ebenso abbrechen,
    Fehler mit slow (OCR-Knöpfe: lieber viele leichte Dateien als eine schwere). */
export async function ocrFile(store,sha,ocr,{halt,deadline=0}={}){
 const pages=store.textPages(sha);if(!pages)return 0;
 const want=pages.map((p,i)=>needsOcr(p)?i:-1).filter(i=>i>=0);
 if(want.length){
  const pdf=await getDocumentProxy(new Uint8Array(fs.readFileSync(store.file(sha))),{isEvalSupported:false,verbosity:0});
  try{
   for(let k=0;k<want.length;k+=ocr.workers){
    if(halt?.())throw Object.assign(new Error('angehalten'),{halted:true});
    if(deadline&&Date.now()>deadline)throw Object.assign(new Error('Zeitgrenze je Datei'),{slow:true});
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

/**
 * OCR einer Datei für beide OCR-Aufträge (text.mjs --ocr [--others]). Liegt das PDF, wie ocrFile. Ist es
 * verdrängt ('text-only'), wird es einmal kurz nachgeladen: dieselbe Datei (Prüfsumme), gelesen, sofort wieder gelöscht. Der
 * Eintrag bleibt dabei 'text-only', die Grenze sieht die Datei nie; es liegt also höchstens eine nachgeladene Datei zur Zeit da.
 * read(sha): liest die Seiten (ocrFile), Rückgabe Seitenzahl; seine Fehler (Anhalten, Zeitgrenze je Datei) gehen weiter, eine
 * nachgeladene Datei ist dann trotzdem wieder gelöscht. download(url): Bytes; ein Fehler mit skip (Server ausgelassen)
 * oder Anhalten (halted()) lässt die Datei offen, jeder andere wird vermerkt (refetchFailed), sie kommt nicht wieder.
 * Rückgabe {pages, fetched, result}: 'ok' | 'changed' (unter der Adresse liegt heute eine andere Datei) | 'failed' | 'skipped'.
 */
export async function ocrWithRefetch(store,sha,{download,read,halted=()=>false}){
 const file=store.file(sha);
 if(fs.existsSync(file)){
  try{return {pages:await read(sha),fetched:false,result:'ok'};}
  finally{if(!store.present(sha))fs.rmSync(file,{force:true});}
 }
 let error='keine Adresse',changed=false;
 for(const url of store.urlsOf(sha)){
  let bytes;
  try{bytes=await download(url);}
  catch(e){if(halted())throw Object.assign(new Error('angehalten'),{halted:true});if(e.skip)return {pages:0,fetched:false,result:'skipped'};error=e.message;continue;}
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==sha){changed=true;error='Datei geändert';continue;}
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
  // Löschen auch beim Anhalten oder bei einem Lesefehler; nur nicht, wenn die Datei inzwischen wirklich abgelegt ist
  try{return {pages:await read(sha),fetched:true,result:'ok'};}
  finally{if(!store.present(sha))fs.rmSync(file,{force:true});}
 }
 store.refetchFailed(sha,error);
 return {pages:0,fetched:false,result:changed?'changed':'failed'};
}

// Eine Zeile je Datei (gleiche Datei unter mehreren Adressen: der höchste Wert zählt). other: nur als übriges PDF verlinkt
// (role 'other', fetch.mjs --others), dann gilt nur die Textebene, kein OCR.
const FILES=`SELECT p.sha256 AS sha,MAX(p.bytes) AS bytes,GROUP_CONCAT(COALESCE(p.doc_type,'other')) AS types,MAX(COALESCE(p.formal,0)) AS formal,MIN(p.formal) AS minFormal,
 MIN(COALESCE(p.role,'')='other') AS other,
 MIN(p.event_date) AS eventDate,t.pages,t.ocr_pages AS ocrPages,t.ocr_needed AS ocrNeeded,t.chars,t.status AS textStatus,t.head_type AS headType
 FROM pdfs p LEFT JOIN texts t ON t.sha256=p.sha256 WHERE p.status='ok'`;
const ranked=f=>{
 /* Art: die beste der Titel (gleiche Datei unter mehreren Adressen), berichtigt durch den Textanfang (effectiveType) */
 const type=effectiveType(f.types.split(',').sort((a,b)=>(TYPE_VALUE[b]??0)-(TYPE_VALUE[a]??0))[0],f.headType||null);
 const scan=f.pages>0&&((f.ocrPages||0)+(f.ocrNeeded||0))>=f.pages/2;
 const r=rankPdf({type,formal:f.minFormal===1,chars:f.textStatus==='ok'?f.chars:null,ocrNeeded:f.ocrNeeded,bytes:f.bytes});
 /* Feste Regel: übrige PDFs stehen immer unter allen Hauptdokumenten. order ist die Reihenfolge der Grenze (Score 0 bis 1,
    bei übrigen PDFs minus 1); score bleibt der Score der Datei selbst (Anzeige). Ein neues Hauptdokument verdrängt zuerst
    übrige PDFs, ein übriges nie ein Hauptdokument */
 return {...f,type,scan,...r,order:f.other?r.score-1:r.score};
};
/** Alle geladenen Dateien mit Score, beste zuerst (übrige PDFs nach allen Hauptdokumenten) */
export const rankedFiles=store=>store.db.prepare(FILES+' GROUP BY p.sha256').all().map(ranked).sort((a,b)=>b.order-a.order);
/** Eine Datei mit Rang (oder null, wenn sie nicht geladen ist) */
/** Dateien, die nur noch als Text vorliegen (aus der Grenze verdrängt), mit dem Score, den sie als PDF hätten */
export const rankedTextOnly=store=>store.db.prepare(FILES.replace("p.status='ok'","p.status='text-only'")+' GROUP BY p.sha256').all().map(ranked);
const QUALITY_TYPES=['paper','decision','minutes','attachment','other','invitation'];
const QUALITY_BANDS=[[0.75,Infinity],[0.5,0.75],[0.25,0.5],[0,0.25]];
/**
 * Qualität der Ablage (Admin-Reiter „PDF-Import“): Mittel des Scores je Datei (shared/pdf-rank.mjs, 0 bis 1), je
 * Dokumentart und in Stufen; dazu das Mittel der Dateien, die nur als Text bleiben (zum Vergleich: was verdrängt wurde).
 */
export function storeQuality(files,textOnly=[]){
 const avg=list=>list.length?Math.round(list.reduce((a,f)=>a+f.score,0)/list.length*1000)/1000:null;
 const part=list=>({files:list.length,bytes:list.reduce((a,f)=>a+f.bytes,0),avg:avg(list)});
 return {...part(files),
  primary:part(files.filter(f=>!f.other)),others:part(files.filter(f=>f.other)),
  formal:files.filter(f=>f.minFormal===1).length,scans:files.filter(f=>f.scan).length,
  types:QUALITY_TYPES.map(type=>({type,...part(files.filter(f=>f.type===type))})).filter(t=>t.files),
  bands:QUALITY_BANDS.map(([lo,hi])=>({lo,hi:hi===Infinity?null:hi,...part(files.filter(f=>f.score>=lo&&f.score<hi))})),
  textOnly:{files:textOnly.length,avg:avg(textOnly)}};
}
export const rankedFile=(store,sha)=>{const f=store.db.prepare(FILES+' AND p.sha256=? GROUP BY p.sha256').get(sha);return f?ranked(f):null;};
/** Zu große Datei (rankPdf keep:false) mit gelesener Textebene: PDF löschen, Text bleibt (text.mjs gleich nach dem Lesen, der
    Tausch beim nächsten Laden). Auch ein Scan wartet nicht auf seine OCR: die holt die Datei später kurz nach (ocrWithRefetch,
    Entscheidung 12.10.2026). true, wenn gelöscht */
export function dropIfTooBig(store,sha){
 const f=rankedFile(store,sha);
 if(!f||f.keep||f.chars==null)return false;
 store.dropPdf(sha);return true;
}
/** Platz der Textfassungen in Bytes (sie zählen mit in die Grenze und bleiben immer) */
export const textBytes=store=>Number(store.db.prepare("SELECT COALESCE(SUM(chars),0) AS c FROM texts WHERE status='ok'").get().c)*1.05;
/** Belegter Platz: PDFs und Texte */
export const usedBytes=store=>store.size()+textBytes(store);

/**
 * Feste Grenze mit Tausch (fetch.mjs --budget-gb): Solange Platz ist, bleibt jede neue Datei. Ist die Grenze erreicht, wird
 * die neue Datei sofort bewertet (Textebene gelesen: Textmenge und Seiten, die auf OCR warten, gehen in den Score ein) und mit der schlechtesten behaltenen verglichen:
 * besser → die schlechteste fliegt raus, sonst die neue. Zu große Dateien (rankPdf keep:false) behalten nur den Text.
 * Vor dem Löschen wird die Textebene gelesen, falls sie fehlt; keine OCR (Entscheidung 12.10.2026): Seiten ohne Text liest
 * später der Auftrag „OCR starten“, der die Datei dafür kurz nachlädt (ocrWithRefetch).
 * Entscheidungen laufen nacheinander; überschritten wird die Grenze nur um gerade geladene, noch nicht entschiedene Dateien.
 */
export function keeper(store,limit,{halt=()=>false}={}){
 const all=rankedFiles(store),kept=all.filter(f=>f.keep).sort((a,b)=>a.order-b.order),have=new Set(kept.map(f=>f.sha));
 const c={kept:0,swapped:0,rejected:0,tooBig:0};
 let lock=Promise.resolve();
 /* Belegter Platz: einmal gezählt, dann fortgeschrieben (die volle Zählung liest alle Einträge der Ablage und wäre je Datei
    zu langsam); alle SYNC Entscheidungen neu gezählt, damit sich keine Abweichung ansammelt */
 const SYNC=2000,textOf=sha=>Number(store.db.prepare("SELECT chars FROM texts WHERE sha256=? AND status='ok'").get(sha)?.chars||0)*1.05;
 let used=usedBytes(store),since=0;
 /* Zu große Dateien (nie als PDF behalten) mit gelesener Textebene vom letzten Mal jetzt löschen */
 for(const f of all)if(!f.keep&&f.chars!=null){store.dropPdf(f.sha);used-=f.bytes;c.tooBig++;}
 /** Textebene lesen, falls sie fehlt (der Text bleibt in jedem Fall) */
 const complete=async f=>{
  const t=store.db.prepare('SELECT version FROM texts WHERE sha256=?').get(f.sha),before=textOf(f.sha);
  if(t&&t.version>=TEXT_VERSION)return;
  try{await readTextLayer(store,f.sha);}catch(e){store.failText(f.sha,e.message,{version:TEXT_VERSION});}
  finally{used+=textOf(f.sha)-before;}
 };
 const drop=async f=>{await complete(f);store.dropPdf(f.sha);used-=f.bytes;};
 /* Gleicher Score: die neue Datei hinter die schon behaltenen (bei Gleichstand fliegt die älteste Entscheidung zuerst) */
 const insert=f=>{let lo=0,hi=kept.length;while(lo<hi){const m=(lo+hi)>>1;if(kept[m].order<=f.order)lo=m+1;else hi=m;}kept.splice(lo,0,f);have.add(f.sha);};
 const decide=async(sha,before)=>{
  if(have.has(sha))return 'schon da';
  const f=rankedFile(store,sha);if(!f)return 'fehlt';
  used+=f.bytes+textOf(sha)-before;
  if(++since>=SYNC){since=0;used=usedBytes(store);}
  /* Zu groß (nie als PDF behalten, die Grenze betrifft das nicht): sofort löschen, auch einen Scan */
  if(!f.keep){await drop(f);c.tooBig++;return 'zu groß';}
  /* Angehalten: nichts mehr verdrängen, die neue Datei bleibt (über der Grenze bis zum nächsten Lauf mit Budget) */
  while(used>limit&&!halt()){
   const worst=kept[0];
   if(!worst||worst.order>=f.order){await drop(f);c.rejected++;return 'nicht besser';}
   kept.shift();have.delete(worst.sha);
   await drop(worst);c.swapped++;
  }
  insert(f);c.kept++;return 'behalten';
 };
 return {
  /** Neue Datei einordnen: Textebene sofort und parallel (Textmenge für den Score, und der Text bleibt in jedem Fall),
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
  close:async()=>{await lock.catch(()=>{});},
 };
}

/** Server, die nicht liefern (fetch.mjs lässt sie aus, stats.mjs zeigt sie): mindestens BLOCK_MIN Abrufe, davon mindestens
    BLOCK_SHARE fehlgeschlagen oder „kein PDF“ */
export const BLOCK_MIN=10,BLOCK_SHARE=0.9;

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
