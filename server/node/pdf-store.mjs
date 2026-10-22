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
 * (server/integrations/documents.mjs, über useDocumentStore), wenn RM_PDF_STORE gesetzt ist.
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
 // Erst warten lassen, dann WAL: öffnen zwei Prozesse die Ablage gleichzeitig (zwei Bahnen, job.mjs), wartet der zweite, statt
 // sofort mit „database is locked“ abzubrechen. Beim allerersten Anlegen wartet SQLite beim Umstellen auf WAL nicht: dann kurz
 // wiederholen (setup ist mehrfach ausführbar)
 const setup=()=>db.exec(`PRAGMA busy_timeout=30000;PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS pdfs(url TEXT PRIMARY KEY,sha256 TEXT,bytes INTEGER,pages INTEGER,status TEXT NOT NULL,http INTEGER,error TEXT,fetched_at TEXT NOT NULL,region_id TEXT,topic_id TEXT);
  CREATE INDEX IF NOT EXISTS idx_pdfs_sha ON pdfs(sha256);CREATE INDEX IF NOT EXISTS idx_pdfs_status ON pdfs(status,fetched_at);
  -- method: 'text' (Textebene), 'ocr' (alle Seiten per OCR), 'mixed'; ocr_needed: Seiten ohne Textebene, die noch auf OCR warten.
  CREATE TABLE IF NOT EXISTS texts(sha256 TEXT PRIMARY KEY,status TEXT NOT NULL,method TEXT,version INTEGER NOT NULL,pages INTEGER,ocr_pages INTEGER,ocr_needed INTEGER,chars INTEGER,error TEXT,made_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_texts_ocr ON texts(ocr_needed) WHERE ocr_needed>0;
  CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT);
  -- text_hashes, facts_keys: Altlast der Skripte summaries.mjs und facts.mjs (entfernt 20.10.2026, ersetzt durch report_rules);
  -- die Tabellen bleiben in bestehenden Ablagen, niemand liest oder schreibt sie mehr.
  CREATE TABLE IF NOT EXISTS text_hashes(sha256 TEXT PRIMARY KEY,made_at TEXT NOT NULL,hash TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS facts_keys(topic_id TEXT PRIMARY KEY,key TEXT NOT NULL);
  -- Verdrängte PDFs, die für die OCR nachgeladen werden sollten (Auftrag „OCR starten“) und nicht kamen: kein neuer Versuch
  CREATE TABLE IF NOT EXISTS ocr_refetch(sha256 TEXT PRIMARY KEY,error TEXT,tried_at TEXT NOT NULL);
  -- OCR einer Datei über der Zeitgrenze je Datei abgebrochen (Auftrag „OCR starten“, text.mjs --file-minutes): ans Ende der Reihe
  CREATE TABLE IF NOT EXISTS ocr_slow(sha256 TEXT PRIMARY KEY,tried_at TEXT NOT NULL);`);
 for(let i=0;;i++){try{setup();break;}catch(e){if(e.errcode!==5||i>=50)throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);}}
 // head_type: Dokumentart laut Textanfang (documentTypeFromText, shared/document-type.mjs), '' ohne Merkmal, NULL noch nicht bestimmt
 if(!db.prepare('PRAGMA table_info(texts)').all().some(c=>c.name==='head_type'))db.exec('ALTER TABLE texts ADD COLUMN head_type TEXT');
 // Angaben für den Rang (shared/pdf-rank.mjs): Dokumentart (documentType des Titels), Formalie, Sitzungstag.
 // role: 'other' für PDFs, die nicht Hauptdokument sind (fetch.mjs --others); leer = Hauptdokument. Für die OCR zählen beide,
 // bei gleicher Seitenzahl gehen Hauptdokumente vor (ocrQueue).
 const cols=new Set(db.prepare('PRAGMA table_info(pdfs)').all().map(c=>c.name));
 // model_type, model_formal: Dokumentart und Formalie nach dem Modell (scripts/model/apply.mjs, seit 22.10.2026); gehen im Rang vor
 for(const [c,t] of [['doc_type','TEXT'],['formal','INTEGER'],['event_date','TEXT'],['role','TEXT'],['model_type','TEXT'],['model_formal','INTEGER']])if(!cols.has(c))db.exec(`ALTER TABLE pdfs ADD COLUMN ${c} ${t}`);
 const fileOf=(sha,ext='.pdf')=>path.join(dir,'files',sha.slice(0,2),sha+ext);
 const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',data);fs.renameSync(file+'.tmp',file);};
 const q={
  row:db.prepare('SELECT url,sha256,bytes,pages,status,http,error,fetched_at AS fetchedAt,role FROM pdfs WHERE url=?'),
  upsert:db.prepare(`INSERT INTO pdfs(url,sha256,bytes,pages,status,http,error,fetched_at,region_id,topic_id) VALUES(?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(url) DO UPDATE SET sha256=excluded.sha256,bytes=excluded.bytes,pages=COALESCE(excluded.pages,pdfs.pages),status=excluded.status,http=excluded.http,error=excluded.error,
   fetched_at=excluded.fetched_at,region_id=COALESCE(excluded.region_id,pdfs.region_id),topic_id=COALESCE(excluded.topic_id,pdfs.topic_id)`),
  model:db.prepare('UPDATE pdfs SET model_type=?,model_formal=? WHERE url=? AND (model_type IS NOT ? OR model_formal IS NOT ?)'),
  meta:db.prepare('UPDATE pdfs SET doc_type=COALESCE(?,doc_type),formal=COALESCE(?,formal),event_date=COALESCE(?,event_date),role=COALESCE(?,role) WHERE url=?'),
  drop:db.prepare("UPDATE pdfs SET status='text-only' WHERE sha256=? AND status='ok'"),
  stats:db.prepare('SELECT status,COUNT(*) AS n,SUM(bytes) AS bytes FROM pdfs GROUP BY status'),
  size:db.prepare("SELECT COALESCE(SUM(bytes),0) AS b FROM (SELECT DISTINCT sha256,bytes FROM pdfs WHERE status='ok')"),
  text:db.prepare('SELECT status,method,version,pages,ocr_pages AS ocrPages,ocr_needed AS ocrNeeded,chars FROM texts WHERE sha256=?'),
  mark:db.prepare("SELECT p.sha256 AS sha,t.made_at AS madeAt FROM pdfs p JOIN texts t ON t.sha256=p.sha256 WHERE p.url=? AND p.status IN ('ok','text-only') AND t.status='ok'"),
  putText:db.prepare(`INSERT INTO texts(sha256,status,method,version,pages,ocr_pages,ocr_needed,chars,error,made_at,head_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(sha256) DO UPDATE SET status=excluded.status,method=excluded.method,version=excluded.version,pages=excluded.pages,ocr_pages=excluded.ocr_pages,
   ocr_needed=excluded.ocr_needed,chars=excluded.chars,error=excluded.error,made_at=excluded.made_at,head_type=excluded.head_type`),
  headType:db.prepare('UPDATE texts SET head_type=? WHERE sha256=?'),
  metaGet:db.prepare('SELECT value FROM meta WHERE key=?'),
  metaSet:db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'),
  textless:db.prepare(`SELECT DISTINCT p.sha256 AS sha FROM pdfs p LEFT JOIN texts t ON t.sha256=p.sha256 WHERE p.status='ok' AND (t.sha256 IS NULL OR t.version<?)`),
  // OCR (text.mjs --ocr; Betriebsplan 15.10.2026): Dateien mit Seiten ohne Text. Hauptdokumente vor übrigen PDFs (übrige nur auf
  // Wunsch, ?=1), abgelegte vor verdrängten ('text-only', werden kurz nachgeladen), darin die neueste Sitzung zuerst, dann wenigste
  // OCR-Seiten. Dateien, deren OCR schon einmal über der Zeitgrenze lag (ocr_slow), ganz am Ende; ohne die, deren Nachladen schon
  // einmal scheiterte (ocr_refetch). Mit Fehlerspeicher (Migration 0040) führt text.mjs beides dort und leert die Tabellen.
  ocrQueue:db.prepare(`SELECT t.sha256 AS sha,MAX(COALESCE(p.role,'')<>'other') AS main,MAX(p.status='ok') AS present,MAX(p.bytes) AS bytes,t.ocr_needed AS need,MAX(p.event_date) AS eventDate,MAX(p.fetched_at) AS fetchedAt
   FROM texts t JOIN pdfs p ON p.sha256=t.sha256 WHERE t.ocr_needed>0 AND p.status IN ('ok','text-only')
   AND NOT EXISTS(SELECT 1 FROM ocr_refetch r WHERE r.sha256=t.sha256) GROUP BY t.sha256 HAVING main=1 OR ?
   ORDER BY EXISTS(SELECT 1 FROM ocr_slow s WHERE s.sha256=t.sha256),main DESC,present DESC,coalesce(MAX(p.event_date),'') DESC,need,bytes,t.sha256`),
  slow:db.prepare('INSERT INTO ocr_slow(sha256,tried_at) VALUES(?,?) ON CONFLICT(sha256) DO UPDATE SET tried_at=excluded.tried_at'),
  urlsOf:db.prepare("SELECT url FROM pdfs WHERE sha256=? AND status IN ('ok','text-only') ORDER BY fetched_at DESC"),
  present:db.prepare("SELECT 1 FROM pdfs WHERE sha256=? AND status='ok' LIMIT 1"),
  refetchFailed:db.prepare('INSERT INTO ocr_refetch(sha256,error,tried_at) VALUES(?,?,?) ON CONFLICT(sha256) DO UPDATE SET error=excluded.error,tried_at=excluded.tried_at'),
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
  fail(url,error,{http=null,regionId=null,topicId=null,role=null}={}){
   if(q.row.get(url)?.status==='ok')return;
   q.upsert.run(url,null,null,null,'error',http,String(error).slice(0,300),new Date().toISOString(),regionId,topicId);
   // Rolle mitschreiben: Fehler übriger PDFs zählen sonst in Stand und Fehlerliste als Fehler bei Hauptdokumenten
   if(role)q.meta.run(null,null,null,role,url);
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
  /** Dokumentart (Wörter der Ablage: paper, decision, minutes, attachment, invitation, other) und Formalie nach dem Modell; true bei Änderung */
  setModel(url,type,formal){const f=Number(!!formal);return q.model.run(type,f,url,type,f).changes>0;},
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
  /** Stand der Textfassung zur Adresse ('<sha256>:<made_at>') ohne die Datei zu lesen, oder null ohne Text (wie getText). */
  textMark(url){const m=q.mark.get(url);return m?`${m.sha}:${m.madeAt}`:null;},
  /** Textfassung vollständig, keine Seite wartet mehr auf OCR (ein Eintrag im Fehlerspeicher dazu ist dann veraltet). */
  ocrDone(sha){const t=q.text.get(sha);return !!t&&t.status==='ok'&&!(t.ocrNeeded>0);},
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
  /** Dateien mit Seiten, die auf OCR warten, in der Reihenfolge der OCR: [{sha, main (Hauptdokument), present (PDF liegt), need,
      eventDate}]. others:false nur Hauptdokumente. */
  ocrQueue:({others=true}={})=>q.ocrQueue.all(others?1:0).map(r=>({sha:r.sha,main:!!r.main,present:!!r.present,need:r.need,eventDate:r.eventDate||null})),
  /** Adressen einer Datei (geladen oder nur noch als Text), die jüngste zuerst. */
  urlsOf:sha=>q.urlsOf.all(sha).map(r=>r.url),
  /** Liegt das PDF laut Eintrag (Status 'ok')? */
  present:sha=>!!q.present.get(sha),
  /** Nachladen für die OCR ging nicht: vermerken, die Datei kommt nicht wieder in die Reihe. */
  refetchFailed:(sha,error)=>{q.refetchFailed.run(sha,String(error).slice(0,300),new Date().toISOString());},
  /** OCR der Datei lag über der Zeitgrenze je Datei: ans Ende der OCR-Reihe. */
  markSlow:sha=>{q.slow.run(sha,new Date().toISOString());},
  textStats:()=>q.textStats.all().map(r=>({...r})),
  /** Belegter Platz der Dateien in Bytes (jede Datei einmal). */
  size:()=>Number(q.size.get().b),
  close:()=>db.close(),
 };
}
