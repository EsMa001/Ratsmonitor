/**
 * Dokumentindex der Dokumentsuche (Pro, Seite /dokumente; Konzept requirements/dokumentsuche-konzept.md): eigene Datei
 * RM_PDF_STORE/fts.sqlite neben der PDF-Ablage, nicht in der Hauptdatenbank (search_cards hat genug) und nicht in index.sqlite
 * (deren Schreiber sind die Lade- und OCR-Läufe). Nur Node (node:sqlite, node:fs), nicht im Worker.
 *
 *   doc_files   eine Zeile je Datei (Prüfsumme) mit Stand der Textfassung (made_at) und Angaben zum Filtern und Verlinken
 *               (Adresse, Bericht, Gebiet, Sitzungstag, Dokumentart); eine Datei unter mehreren Adressen zählt einmal, mit der
 *               jüngsten Sitzung
 *   doc_pages   eine Zeile je Seite ab MIN_PAGE_CHARS Zeichen; id = rowid in doc_fts
 *   doc_fts     FTS5 ohne Kopie des Textes (content=''): der Text bleibt in den .txt-Dateien, Fundstellen liest die Suche dort.
 *               contentless_delete=1 (SQLite ab 3.43): Seiten lassen sich ohne den alten Text löschen. Das ist nötig, weil die
 *               OCR die .txt-Datei überschreibt; ein „delete“ mit dem neuen Text ließe den alten Eintrag still im Index.
 *               unicode61 mit remove_diacritics 2 faltet wie norm in x-terms.mjs (ä → a), ß → ss macht indexText selbst.
 *               Bindestriche trennen Wörter („Kita-Gebühren“ findet auch „Kita“); die Suche macht aus „Kita-Gebühren“ eine Phrase.
 *   doc_index_state  version (INDEX_VERSION), revision (Stand für Zwischenspeicher und Blättern), lease (Sperre), last (Lauf)
 *
 * Einziger Schreiber ist indexDocuments (scripts/pdf-store/doc-index.mjs, nachts in nightly.mjs, Auftrag „index“ in job.mjs);
 * der Webdienst liest über openDocReader (nur lesen, WAL, eine Verbindung je Prozess bzw. Worker-Thread).
 * Neu gebaut (andere INDEX_VERSION oder --full) wird in fts.next.sqlite; die Suche liest derweil den alten Index, am Ende ersetzt
 * die neue Datei die alte (openDocReader merkt das und öffnet neu).
 */
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {DEFAULT_PDF_STORE} from './pdf-store.mjs';

/** Fassung von Schema, Tokenizer und indexText; eine neue Fassung baut den Index neu (in fts.next.sqlite) */
export const INDEX_VERSION=1;
export const DOC_INDEX_FILE='fts.sqlite',DOC_INDEX_NEXT='fts.next.sqlite';
/** Seiten mit weniger Zeichen (ohne Leerraum) kommen nicht in den Index, wie needsOcr in store-lib.mjs */
export const MIN_PAGE_CHARS=20;
/** Sperre wie search-words-lease: ein zweiter Lauf lässt aus, eine verwaiste Sperre gilt nach dieser Zeit als frei */
export const LEASE_MS=2*3600e3;
/** Dateien je Transaktion */
export const BATCH=200;
const DETAIL='full';

/** Trennstriche am Zeilenende zusammenziehen („Bebauungs-\nplan“ → „Bebauungsplan“), nur vor Kleinbuchstaben; so zeigen auch
    die Fundstellen den Text */
export const dehyphen=page=>String(page).replace(/(\p{L})-[ \t]*\r?\n[ \t]*(\p{Ll})/gu,'$1$2');
/** Text einer Seite, wie er in den Index geht: dehyphen, ß → ss (den Rest faltet der Tokenizer) */
export const indexText=page=>dehyphen(page).replaceAll('ß','ss').replaceAll('ẞ','SS');
const pageFits=page=>page.replace(/\s+/g,'').length>=MIN_PAGE_CHARS;
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};
const textFile=(dir,sha)=>path.join(dir,'files',sha.slice(0,2),sha+'.txt');

const SCHEMA=`
CREATE TABLE IF NOT EXISTS doc_files(id INTEGER PRIMARY KEY,sha256 TEXT NOT NULL UNIQUE,made_at TEXT,url TEXT,topic_id TEXT,region_id TEXT,
 event_date TEXT,doc_type TEXT,pages INTEGER NOT NULL DEFAULT 0,indexed_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_doc_files_region ON doc_files(region_id,event_date);
CREATE INDEX IF NOT EXISTS idx_doc_files_date ON doc_files(event_date);
CREATE TABLE IF NOT EXISTS doc_pages(id INTEGER PRIMARY KEY,file_id INTEGER NOT NULL,page INTEGER NOT NULL,chars INTEGER NOT NULL,UNIQUE(file_id,page));
CREATE VIRTUAL TABLE IF NOT EXISTS doc_fts USING fts5(text,content='',contentless_delete=1,tokenize='unicode61 remove_diacritics 2',detail=${DETAIL});
CREATE TABLE IF NOT EXISTS doc_index_state(key TEXT PRIMARY KEY,value TEXT);`;

/** Index öffnen (zum Schreiben legt er das Schema an). file: Pfad der Datei */
export function openDocIndex(file,{readOnly=false}={}){
 if(readOnly){
  const db=new DatabaseSync(file,{readOnly:true});
  db.exec('PRAGMA busy_timeout=5000;PRAGMA query_only=1;PRAGMA cache_size=-65536');
  return db;
 }
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const db=new DatabaseSync(file);
 db.exec(`PRAGMA busy_timeout=30000;PRAGMA journal_mode=WAL;PRAGMA synchronous=NORMAL;${SCHEMA}`);
 return db;
}
const stateGet=(db,key)=>{const r=db.prepare('SELECT value FROM doc_index_state WHERE key=?').get(key);try{return r?JSON.parse(r.value):null;}catch{return null;}};
const stateSet=(db,key,value)=>db.prepare('INSERT INTO doc_index_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
const versionOf=file=>{let db;try{db=openDocIndex(file,{readOnly:true});return stateGet(db,'version');}catch{return null;}finally{db?.close();}};

/* Dateien der Ablage, die in den Index gehören: Textfassung vorhanden (auch verdrängte PDFs, 'text-only'), Hauptdokument
   (role leer; Anlagen tragen 'other'), mit Bericht. Je Prüfsumme die Adresse der jüngsten Sitzung (bei gleicher die zuletzt
   geladene); die übrigen Spalten kommen aus derselben Zeile (SQLite: nackte Spalten neben MAX). */
const SOURCE_SQL=`SELECT p.sha256 AS sha,MAX(COALESCE(p.event_date,'')||'|'||COALESCE(p.fetched_at,'')) AS k,p.url,p.topic_id AS topic,p.region_id AS region,
 p.event_date AS date,COALESCE(p.model_type,p.doc_type) AS type,t.made_at AS made
 FROM pdfs p JOIN texts t ON t.sha256=p.sha256
 WHERE t.status='ok' AND p.status IN ('ok','text-only') AND COALESCE(p.role,'')<>'other' AND p.topic_id IS NOT NULL AND p.sha256 IS NOT NULL`;

/**
 * Index aufbauen bzw. nachführen. Liest index.sqlite der Ablage (kurz, nur lesen), vergleicht mit doc_files und arbeitet die
 * geänderten Dateien ab, die jüngste Sitzung zuerst (so ist die Suche früh nützlich). Wiederaufnehmbar: jede Transaktion
 * (BATCH Dateien) ist fertig, der nächste Lauf beginnt beim Rest. Nur die Angaben geändert: nur doc_files; Text geändert
 * (made_at, etwa nach OCR): alte Seiten weg, neue rein; nicht mehr in der Ablage: Datei raus.
 * @param {{dir?:string,full?:boolean,ids?:string[]|null,deadline?:number,stop?:()=>boolean,dryRun?:boolean,tick?:(p:object)=>void,now?:()=>Date}} o
 *   full: neu bauen (in fts.next.sqlite); ids: nur die Dateien dieser Berichte; deadline: Zeitstempel (ms), danach aufhören
 */
export async function indexDocuments({dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE,full=false,ids=null,deadline=Infinity,stop=()=>false,dryRun=false,tick=()=>{},now=()=>new Date()}={}){
 const t0=Date.now(),main=path.join(dir,DOC_INDEX_FILE),next=path.join(dir,DOC_INDEX_NEXT);
 const srcFile=path.join(dir,'index.sqlite');
 if(!fs.existsSync(srcFile))return {skipped:'keine Ablage (index.sqlite fehlt)'};
 /* Ziel: ein angefangener Neubau geht vor; sonst neu bauen bei --full oder anderer Fassung, wenn es schon einen Index gibt */
 const mainVersion=fs.existsSync(main)?versionOf(main):null;
 const rebuild=fs.existsSync(next)||(fs.existsSync(main)&&(full||mainVersion!==INDEX_VERSION));
 const target=rebuild?next:main;
 if(rebuild&&ids)return {skipped:'Neubau läuft, nur im ganzen Lauf'};
 if(dryRun&&!fs.existsSync(target))return {dryRun:true,target:path.basename(target),...countSource(srcFile,null)};
 const db=openDocIndex(target);
 try{
  /* Sperre: frei, wenn sie abgelaufen ist oder ihr Prozess nicht mehr läuft */
  const lease=stateGet(db,'lease');
  if(lease&&lease.pid!==process.pid&&Date.now()-Date.parse(lease.at||0)<LEASE_MS&&alive(lease.pid))return {busy:true,lease};
  const takeLease=()=>stateSet(db,'lease',{pid:process.pid,at:now().toISOString()});
  if(!dryRun)takeLease();
  if(stateGet(db,'version')==null&&!dryRun)stateSet(db,'version',INDEX_VERSION);

  /* Quelle in eine temporäre Tabelle: index.sqlite bleibt nur kurz offen (die Ladeläufe schreiben dort) */
  db.exec(`DROP TABLE IF EXISTS temp.src;CREATE TEMP TABLE src(sha TEXT PRIMARY KEY,url TEXT,topic TEXT,region TEXT,date TEXT,type TEXT,made TEXT);
   CREATE INDEX temp.src_order ON src(date,sha)`);
  const src=new DatabaseSync(srcFile,{readOnly:true});
  let shas=null;
  try{
   src.exec('PRAGMA busy_timeout=30000');
   if(ids){
    /* Nur Dateien dieser Berichte, aber mit allen ihren Adressen (sonst wählte ein Lauf mit --ids einen anderen Bericht als der ganze Lauf) */
    shas=src.prepare("SELECT DISTINCT sha256 AS sha FROM pdfs WHERE topic_id IN (SELECT value FROM json_each(?)) AND sha256 IS NOT NULL").all(JSON.stringify(ids)).map(r=>r.sha);
   }
   const ins=db.prepare('INSERT OR REPLACE INTO temp.src(sha,url,topic,region,date,type,made) VALUES(?,?,?,?,?,?,?)');
   db.exec('BEGIN');
   const rows=shas?src.prepare(`${SOURCE_SQL} AND p.sha256 IN (SELECT value FROM json_each(?)) GROUP BY p.sha256`).iterate(JSON.stringify(shas)):src.prepare(`${SOURCE_SQL} GROUP BY p.sha256`).iterate();
   /* Ohne Sitzungstag '' statt NULL: so trägt der Index src_order die Reihenfolge, und Zeiträume schließen sie aus */
   for(const r of rows)ins.run(r.sha,r.url,r.topic,r.region,r.date||'',r.type||null,r.made);
   db.exec('COMMIT');
  }finally{src.close();}
  const sourceFiles=Number(db.prepare('SELECT count(*) n FROM temp.src').get().n);

  const q={
   gone:shas?db.prepare('SELECT id,sha256 FROM doc_files WHERE sha256 IN (SELECT value FROM json_each(?)) AND sha256 NOT IN (SELECT sha FROM temp.src)'):db.prepare('SELECT id,sha256 FROM doc_files WHERE sha256 NOT IN (SELECT sha FROM temp.src)'),
   changed:`FROM temp.src s LEFT JOIN doc_files d ON d.sha256=s.sha WHERE (d.id IS NULL OR d.made_at IS NOT s.made OR d.url IS NOT s.url OR d.topic_id IS NOT s.topic
    OR d.region_id IS NOT s.region OR d.event_date IS NOT s.date OR d.doc_type IS NOT s.type)`,
   dropPages:db.prepare('DELETE FROM doc_fts WHERE rowid IN (SELECT id FROM doc_pages WHERE file_id=?)'),
   dropPageRows:db.prepare('DELETE FROM doc_pages WHERE file_id=?'),
   dropFile:db.prepare('DELETE FROM doc_files WHERE id=?'),
   meta:db.prepare('UPDATE doc_files SET url=?,topic_id=?,region_id=?,event_date=?,doc_type=?,indexed_at=? WHERE id=?'),
   file:db.prepare(`INSERT INTO doc_files(sha256,made_at,url,topic_id,region_id,event_date,doc_type,pages,indexed_at) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(sha256) DO UPDATE SET made_at=excluded.made_at,url=excluded.url,topic_id=excluded.topic_id,region_id=excluded.region_id,
    event_date=excluded.event_date,doc_type=excluded.doc_type,pages=excluded.pages,indexed_at=excluded.indexed_at RETURNING id`),
   page:db.prepare('INSERT INTO doc_pages(file_id,page,chars) VALUES(?,?,?)'),
   fts:db.prepare('INSERT INTO doc_fts(rowid,text) VALUES(?,?)'),
  };
  const remainingAll=()=>Number(db.prepare(`SELECT count(*) n ${q.changed}`).get().n);
  const goneRows=q.gone.all(...(shas?[JSON.stringify(shas)]:[]));
  const todo=remainingAll();
  if(dryRun)return {dryRun:true,target:path.basename(target),sourceFiles,indexedFiles:Number(db.prepare('SELECT count(*) n FROM doc_files').get().n),todo,gone:goneRows.length};

  const c={added:0,updated:0,meta:0,removed:0,missing:0,read:0,newPages:0};
  let stopped=false,late=false;
  const dropFile=id=>{q.dropPages.run(id);q.dropPageRows.run(id);};
  /* Weggefallene Dateien zuerst (in einer Transaktion) */
  if(goneRows.length){
   db.exec('BEGIN');
   try{for(const r of goneRows){dropFile(r.id);q.dropFile.run(r.id);c.removed++;}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  }
  /* Geänderte in Stücken, jüngste Sitzung zuerst (Schlüssel: Datum, Prüfsumme absteigend) */
  const batchSql=db.prepare(`SELECT s.*,d.id AS fid,d.made_at AS dmade ${q.changed} AND (s.date,s.sha)<(?,?) ORDER BY s.date DESC,s.sha DESC LIMIT ${BATCH}`);
  let cursor=['￿','￿'],told=0;
  while(!stopped&&!late){
   const rows=batchSql.all(...cursor);
   if(!rows.length)break;
   cursor=[rows.at(-1).date,rows.at(-1).sha];
   db.exec('BEGIN');
   try{
    for(const r of rows){
     if((stopped=stop()))break;
     if((late=Date.now()>deadline))break;
     const at=now().toISOString();
     if(r.fid&&r.dmade===r.made){q.meta.run(r.url,r.topic,r.region,r.date,r.type,at,r.fid);c.meta++;continue;}
     let pages=null;
     try{pages=fs.readFileSync(textFile(dir,r.sha),'utf8').split('\f');}catch{/* Textfassung fehlt */}
     if(r.fid)dropFile(r.fid);
     /* Ohne Datei bleibt die Zeile mit 0 Seiten stehen; erst ein neuer Stand (made_at) versucht es wieder */
     if(!pages)c.missing++;
     const id=Number(q.file.get(r.sha,r.made,r.url,r.topic,r.region,r.date,r.type,0,at).id);
     let n=0;
     for(const [i,p] of (pages||[]).entries()){
      if(!pageFits(p))continue;
      const pid=Number(q.page.run(id,i+1,p.length).lastInsertRowid);
      q.fts.run(pid,indexText(p));n++;
     }
     if(n)db.prepare('UPDATE doc_files SET pages=? WHERE id=?').run(n,id);
     c.newPages+=n;c.read++;if(r.fid)c.updated++;else c.added++;
    }
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   takeLease();
   /* Zwischen den Stücken kommt die Ereignisschleife zu Wort: Anhalten (Admin-Reiter, Signal) greift nach dem laufenden Stück */
   await new Promise(r=>setImmediate(r));
   if(Date.now()-told>60000){told=Date.now();tick({done:c.read+c.meta,total:todo,pages:c.newPages});}
  }
  const remaining=remainingAll();
  const done=!remaining&&!ids;
  const changed=c.read+c.meta+c.removed>0;
  if(changed)stateSet(db,'revision',String(Date.now()));
  const totals=db.prepare('SELECT count(*) AS files,coalesce(sum(pages),0) AS pages FROM doc_files').get();
  db.exec('DELETE FROM doc_index_state WHERE key=\'lease\'');
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  db.close();
  /* Neubau fertig: neue Datei ersetzt die alte (die Suche öffnet beim nächsten Blick neu) */
  let swapped=false;
  if(done&&target===next){
   try{
    for(const ext of ['-wal','-shm'])fs.rmSync(main+ext,{force:true});
    fs.renameSync(next,main);swapped=true;
    for(const ext of ['-wal','-shm'])fs.rmSync(next+ext,{force:true});
   }catch{/* Windows: alte Datei noch offen; der nächste Lauf versucht es wieder */}
  }
  return {target:path.basename(target),rebuild,swapped,sourceFiles,files:Number(totals.files),pages:Number(totals.pages),todo,remaining,done,stopped,late,...c,
   seconds:Math.round((Date.now()-t0)/1000),bytes:indexBytes(dir)};
 }finally{if(db.isOpen)db.close();}
}

/** Dateien der Ablage, die in den Index gehören (ohne Index, für den Probelauf) */
function countSource(srcFile){
 const src=new DatabaseSync(srcFile,{readOnly:true});
 try{return {sourceFiles:Number(src.prepare(`SELECT count(*) n FROM (${SOURCE_SQL} GROUP BY p.sha256)`).get().n),indexedFiles:0};}finally{src.close();}
}

/** Belegter Platz des Index (fts.sqlite und ein angefangener Neubau, je mit WAL) */
export function indexBytes(dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE){
 let b=0;for(const f of [DOC_INDEX_FILE,DOC_INDEX_NEXT])for(const ext of ['','-wal','-shm'])try{b+=fs.statSync(path.join(dir,f+ext)).size;}catch{/* fehlt */}
 return b;
}

/** Stand des Index für Admin und Betriebsprüfung, ohne zu schreiben: Dateien, Seiten, Stand, letzter Lauf, Neubau; null ohne Index */
export function docIndexInfo(dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE){
 const main=path.join(dir,DOC_INDEX_FILE),next=path.join(dir,DOC_INDEX_NEXT);
 const read=file=>{
  if(!fs.existsSync(file))return null;
  let db;
  try{
   db=openDocIndex(file,{readOnly:true});
   const t=db.prepare('SELECT count(*) AS files,coalesce(sum(pages),0) AS pages FROM doc_files').get();
   return {files:Number(t.files),pages:Number(t.pages),version:stateGet(db,'version'),revision:stateGet(db,'revision'),lease:stateGet(db,'lease')};
  }catch(e){return {error:e.message};}finally{db?.close();}
 };
 const m=read(main),n=read(next);
 if(!m&&!n)return null;
 return {...(m||{files:0,pages:0}),current:m?.version===INDEX_VERSION,rebuild:n,bytes:indexBytes(dir)};
}

/**
 * Lesender Zugang für die Suche (doc-search.mjs): Index nur lesen (eine Verbindung, beim ersten Zugriff geöffnet, nach einem
 * Neubau neu geöffnet; geprüft höchstens alle recheckMs) und Seiten der Textfassungen. ready() ist false ohne Index; dann antwortet die Route 503.
 */
export function openDocReader(dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE,{recheckMs=30000}={}){
 const file=path.join(dir,DOC_INDEX_FILE);
 let db=null,stamp='',checked=0;
 const statStamp=()=>{try{const s=fs.statSync(file);return `${s.ino}:${s.birthtimeMs}`;}catch{return '';}};
 function handle(){
  if(db&&Date.now()-checked<recheckMs)return db;
  checked=Date.now();
  const s=statStamp();
  if(db&&s===stamp)return db;
  try{db?.close();}catch{/* schon zu */}
  db=null;stamp=s;
  if(!s)return null;
  try{db=openDocIndex(file,{readOnly:true});}catch{db=null;}
  return db;
 }
 return {
  dir,
  ready:()=>!!handle(),
  /** Stand des Index (wechselt nach jedem Lauf mit Änderungen) */
  revision(){const d=handle();if(!d)return null;const r=d.prepare("SELECT value FROM doc_index_state WHERE key='revision'").get();try{return r?String(JSON.parse(r.value)):'0';}catch{return '0';}},
  all(sql,...args){const d=handle();if(!d)throw Object.assign(new Error('Dokumentindex fehlt'),{status:503});return d.prepare(sql).all(...args);},
  /** Seiten der Textfassung (roh, getrennt durch \f) oder null */
  pages(sha){try{return fs.readFileSync(textFile(dir,sha),'utf8').split('\f');}catch{return null;}},
  close(){try{db?.close();}catch{/* schon zu */}db=null;},
 };
}
