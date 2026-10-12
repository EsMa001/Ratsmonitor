/**
 * Lokale PDF-Ablage: Originaldokumente einmal laden und danach von der Platte lesen statt aus dem Internet.
 * Vorstufe dafür, die Originale später in Plenara selbst zu speichern. Nur Node (node:fs, node:sqlite), nicht im Worker.
 *
 *   <dir>/index.sqlite                Adresse → Prüfsumme, Größe, Seiten, Status, Abrufzeit (eine Zeile je Adresse)
 *   <dir>/files/<ab>/<sha256>.pdf     Datei, nach Prüfsumme benannt; gleiche Dateien unter mehreren Adressen liegen einmal
 *
 *   <dir>/files/<ab>/<sha256>.txt     Textfassung: Seiten roh, wie pdf.js sie liefert, getrennt durch \f (Seitenumbruch);
 *                                     Seiten ohne Textebene per OCR (scripts/pdf-store/text.mjs), Herkunft in Tabelle texts
 *
 * Status: 'ok' (Datei liegt), 'error' (HTTP-Fehler, Zeitüberschreitung, zu groß; wird nach `retryDays` erneut versucht),
 * 'unsupported' (Antwort ist kein PDF), 'text-only' (PDF fiel aus dem Budget, scripts/pdf-store/budget.mjs; nur die Textfassung bleibt). Gefüllt von scripts/pdf-store/fetch.mjs; gelesen von readDocument
 * (server/integrations/documents.mjs, über useDocumentStore) und fetchSource (scripts/ai-batch/lib.mjs), wenn RM_PDF_STORE gesetzt ist.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {documentTypeFromText} from '../../shared/document-type.mjs';

export const DEFAULT_PDF_STORE='tmp/pdf-store';
const isPdf=bytes=>bytes.byteLength>4&&bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d;

export function openPdfStore(dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE){
 fs.mkdirSync(path.join(dir,'files'),{recursive:true});
 const db=new DatabaseSync(path.join(dir,'index.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=30000;
  CREATE TABLE IF NOT EXISTS pdfs(url TEXT PRIMARY KEY,sha256 TEXT,bytes INTEGER,pages INTEGER,status TEXT NOT NULL,http INTEGER,error TEXT,fetched_at TEXT NOT NULL,region_id TEXT,topic_id TEXT);
  CREATE INDEX IF NOT EXISTS idx_pdfs_sha ON pdfs(sha256);CREATE INDEX IF NOT EXISTS idx_pdfs_status ON pdfs(status,fetched_at);
  -- method: 'text' (Textebene), 'ocr' (alle Seiten per OCR), 'mixed'; ocr_needed: Seiten ohne Textebene, die noch auf OCR warten.
  CREATE TABLE IF NOT EXISTS texts(sha256 TEXT PRIMARY KEY,status TEXT NOT NULL,method TEXT,version INTEGER NOT NULL,pages INTEGER,ocr_pages INTEGER,ocr_needed INTEGER,chars INTEGER,error TEXT,made_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_texts_ocr ON texts(ocr_needed) WHERE ocr_needed>0;
  CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT);`);
 // head_type: Dokumentart laut Textanfang (documentTypeFromText, shared/document-type.mjs), '' ohne Merkmal, NULL noch nicht bestimmt
 if(!db.prepare('PRAGMA table_info(texts)').all().some(c=>c.name==='head_type'))db.exec('ALTER TABLE texts ADD COLUMN head_type TEXT');
 // Angaben für den Rang (shared/pdf-rank.mjs): Dokumentart (documentType des Titels), Formalie, Sitzungstag.
 // role: 'other' für PDFs, die nicht Hauptdokument sind (fetch.mjs --others: nur Textebene, kein OCR); leer = Hauptdokument.
 const cols=new Set(db.prepare('PRAGMA table_info(pdfs)').all().map(c=>c.name));
 for(const [c,t] of [['doc_type','TEXT'],['formal','INTEGER'],['event_date','TEXT'],['role','TEXT']])if(!cols.has(c))db.exec(`ALTER TABLE pdfs ADD COLUMN ${c} ${t}`);
 const fileOf=(sha,ext='.pdf')=>path.join(dir,'files',sha.slice(0,2),sha+ext);
 const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',data);fs.renameSync(file+'.tmp',file);};
 const q={
  row:db.prepare('SELECT url,sha256,bytes,pages,status,http,error,fetched_at AS fetchedAt,role FROM pdfs WHERE url=?'),
  upsert:db.prepare(`INSERT INTO pdfs(url,sha256,bytes,pages,status,http,error,fetched_at,region_id,topic_id) VALUES(?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(url) DO UPDATE SET sha256=excluded.sha256,bytes=excluded.bytes,pages=COALESCE(excluded.pages,pdfs.pages),status=excluded.status,http=excluded.http,error=excluded.error,
   fetched_at=excluded.fetched_at,region_id=COALESCE(excluded.region_id,pdfs.region_id),topic_id=COALESCE(excluded.topic_id,pdfs.topic_id)`),
  meta:db.prepare('UPDATE pdfs SET doc_type=COALESCE(?,doc_type),formal=COALESCE(?,formal),event_date=COALESCE(?,event_date),role=COALESCE(?,role) WHERE url=?'),
  drop:db.prepare("UPDATE pdfs SET status='text-only' WHERE sha256=? AND status='ok'"),
  stats:db.prepare('SELECT status,COUNT(*) AS n,SUM(bytes) AS bytes FROM pdfs GROUP BY status'),
  size:db.prepare("SELECT COALESCE(SUM(bytes),0) AS b FROM (SELECT DISTINCT sha256,bytes FROM pdfs WHERE status='ok')"),
  text:db.prepare('SELECT status,method,version,pages,ocr_pages AS ocrPages,ocr_needed AS ocrNeeded,chars FROM texts WHERE sha256=?'),
  putText:db.prepare(`INSERT INTO texts(sha256,status,method,version,pages,ocr_pages,ocr_needed,chars,error,made_at,head_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(sha256) DO UPDATE SET status=excluded.status,method=excluded.method,version=excluded.version,pages=excluded.pages,ocr_pages=excluded.ocr_pages,
   ocr_needed=excluded.ocr_needed,chars=excluded.chars,error=excluded.error,made_at=excluded.made_at,head_type=excluded.head_type`),
  headType:db.prepare('UPDATE texts SET head_type=? WHERE sha256=?'),
  metaGet:db.prepare('SELECT value FROM meta WHERE key=?'),
  metaSet:db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'),
  textless:db.prepare(`SELECT DISTINCT p.sha256 AS sha FROM pdfs p LEFT JOIN texts t ON t.sha256=p.sha256 WHERE p.status='ok' AND (t.sha256 IS NULL OR t.version<?)`),
  // OCR nur für Hauptdokumente: Dateien, die nur als übrige PDFs (role 'other') verlinkt sind, behalten nur die Textebene
  ocrQueue:db.prepare("SELECT sha256 AS sha FROM texts t WHERE ocr_needed>0 AND EXISTS(SELECT 1 FROM pdfs p WHERE p.sha256=t.sha256 AND COALESCE(p.role,'')<>'other')"),
  textStats:db.prepare("SELECT status,method,COUNT(*) AS n,SUM(chars) AS chars,SUM(ocr_needed>0) AS waiting FROM texts GROUP BY status,method"),
 };
 return {
  dir,
  /** Eintrag zur Adresse oder null. */
  entry:url=>q.row.get(url)||null,
  /** Datei zur Adresse (Uint8Array) oder null, wenn sie fehlt oder nur ein Fehler vermerkt ist. */
  get(url){
   const r=q.row.get(url);if(r?.status!=='ok')return null;
   try{return new Uint8Array(fs.readFileSync(fileOf(r.sha256)));}catch{return null;}
  },
  /** Legt eine geladene Antwort ab; was kein PDF ist, wird nur als 'unsupported' vermerkt. */
  put(url,bytes,{pages=null,regionId=null,topicId=null,fetchedAt=new Date().toISOString(),...meta}={}){
   if(!isPdf(bytes)){q.upsert.run(url,null,bytes.byteLength,null,'unsupported',null,'kein PDF',fetchedAt,regionId,topicId);return 'unsupported';}
   const sha=crypto.createHash('sha256').update(bytes).digest('hex'),file=fileOf(sha);
   if(!fs.existsSync(file))write(file,bytes);
   q.upsert.run(url,sha,bytes.byteLength,pages,'ok',200,null,fetchedAt,regionId,topicId);
   this.setMeta(url,meta);
   return 'ok';
  },
  /** Vermerkt einen Fehlschlag; eine früher geladene Datei bleibt dabei erhalten. */
  fail(url,error,{http=null,regionId=null,topicId=null}={}){
   if(q.row.get(url)?.status==='ok')return;
   q.upsert.run(url,null,null,null,'error',http,String(error).slice(0,300),new Date().toISOString(),regionId,topicId);
  },
  /** Muss die Adresse (erneut) geladen werden? Nein bei 'ok' und 'unsupported', bei 'error' erst nach retryDays. textOnlyBelow:
      ein Hauptdokument, das nur noch als Text vorliegt und höchstens so groß ist, wieder laden (fetch.mjs, solange übrige PDFs
      verdrängt werden können). */
  wants(url,{retryDays=7,textOnlyBelow=0}={}){
   const r=q.row.get(url);if(!r)return true;
   if(r.status==='text-only')return textOnlyBelow>0&&r.role!=='other'&&r.bytes<=textOnlyBelow;
   return r.status==='error'&&Date.now()-Date.parse(r.fetchedAt)>retryDays*864e5;
  },
  stats:()=>q.stats.all().map(r=>({...r})),
  /** Angaben für den Rang: {docType, formal, eventDate, role}; fehlende bleiben, wie sie sind. */
  setMeta(url,{docType=null,formal=null,eventDate=null,role=null}={}){q.meta.run(docType,formal==null?null:Number(!!formal),eventDate,role,url);},
  /** Löscht das PDF einer Prüfsumme, die Textfassung bleibt (Status 'text-only' für alle Adressen dieser Datei). */
  dropPdf(sha){q.drop.run(sha);try{fs.unlinkSync(fileOf(sha));}catch{/* schon weg */}},
  /** Viele PDFs löschen: erst alle Einträge in einer Transaktion auf 'text-only', dann die Dateien. Endet der Prozess dazwischen,
      bleiben höchstens Dateien ohne Eintrag liegen, nie Einträge ohne Datei. */
  dropPdfs(shas){
   db.exec('BEGIN');try{for(const sha of shas)q.drop.run(sha);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
   for(const sha of shas)try{fs.unlinkSync(fileOf(sha));}catch{/* schon weg */}
  },
  db,
  /** Pfad der Datei zu einer Prüfsumme. */
  file:sha=>fileOf(sha),
  /** Textfassung zur Adresse: {pages:[Text je Seite], method, ocrNeeded} oder null. */
  getText(url){
   const r=q.row.get(url);if(r?.status!=='ok'&&r?.status!=='text-only')return null;
   const t=q.text.get(r.sha256);if(t?.status!=='ok')return null;
   try{return {pages:fs.readFileSync(fileOf(r.sha256,'.txt'),'utf8').split('\f'),method:t.method,ocrNeeded:t.ocrNeeded};}catch{return null;}
  },
  /** Seiten der Textfassung zu einer Prüfsumme (für die OCR-Runde) oder null. */
  textPages(sha){try{return fs.readFileSync(fileOf(sha,'.txt'),'utf8').split('\f');}catch{return null;}},
  /** Legt die Textfassung ab (Seiten ohne \f). */
  putText(sha,pages,{method,version,ocrPages=0,ocrNeeded=0}){
   const text=pages.map(p=>p.replaceAll('\f',' ')).join('\f');
   write(fileOf(sha,'.txt'),text);
   q.putText.run(sha,'ok',method,version,pages.length,ocrPages,ocrNeeded,text.length,null,new Date().toISOString(),documentTypeFromText(text)||'');
  },
  failText(sha,error,{version}){q.putText.run(sha,'error',null,version,null,0,0,null,String(error).slice(0,300),new Date().toISOString(),null);},
  /** Dokumentart laut Textanfang nachtragen ('' ohne Merkmal) */
  setHeadType(sha,type){q.headType.run(type??'',sha);},
  /** Kleine Merkzettel der Ablage (Fassungen von Nachträgen) */
  note:key=>q.metaGet.get(key)?.value??null,
  setNote:(key,value)=>{q.metaSet.run(key,String(value));},
  /** Prüfsummen geladener PDFs ohne Textfassung der Fassung `version`. */
  textless:version=>q.textless.all(version).map(r=>r.sha),
  /** Prüfsummen mit Seiten, die auf OCR warten. */
  ocrQueue:()=>q.ocrQueue.all().map(r=>r.sha),
  textStats:()=>q.textStats.all().map(r=>({...r})),
  /** Belegter Platz der Dateien in Bytes (jede Datei einmal). */
  size:()=>Number(q.size.get().b),
  close:()=>db.close(),
 };
}
