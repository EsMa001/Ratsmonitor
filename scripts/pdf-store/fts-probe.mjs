// Probeindex der Dokumentsuche (Konzept requirements/dokumentsuche-konzept.md, Abschnitt 8): baut aus den neuesten N
// Hauptdokumenten mit Text eine Wegwerfdatei RM_PDF_STORE/fts-probe.sqlite mit demselben Schema und Tokenizer wie der echte Index
// (server/node/doc-index.mjs), misst Größe, Dauer und Abfragezeiten und rechnet auf alle Hauptdokumente hoch. Liest index.sqlite
// nur und die .txt-Dateien; ändert nichts an der Ablage. Am Ende wird die Probedatei gelöscht (--keep: behalten, etwa als lokale
// fts.sqlite zum Ausprobieren der Seite).
//
//   node scripts/pdf-store/fts-probe.mjs [--files 20000] [--detail full|column] [--keep]
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {indexText,MIN_PAGE_CHARS} from '../../server/node/doc-index.mjs';
import {toMatch} from '../../server/integrations/doc-search.mjs';

const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:d;};
const N=Number(opt('files',20000)),detail=opt('detail','full');
if(!['full','column'].includes(detail)){console.error('--detail full oder column');process.exit(1);}
const dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE,out=path.join(dir,'fts-probe.sqlite');
for(const f of [out,out+'-wal',out+'-shm'])fs.rmSync(f,{force:true});
const src=new DatabaseSync(path.join(dir,'index.sqlite'),{readOnly:true});
src.exec('PRAGMA busy_timeout=30000');
const WHERE="t.status='ok' AND p.status IN ('ok','text-only') AND COALESCE(p.role,'')<>'other' AND p.topic_id IS NOT NULL AND p.sha256 IS NOT NULL";
const files=src.prepare(`SELECT p.sha256 AS sha,MAX(COALESCE(p.event_date,'')) AS date FROM pdfs p JOIN texts t ON t.sha256=p.sha256 WHERE ${WHERE} GROUP BY p.sha256 ORDER BY date DESC LIMIT ?`).all(N);
const total=Number(src.prepare(`SELECT count(DISTINCT p.sha256) n FROM pdfs p JOIN texts t ON t.sha256=p.sha256 WHERE ${WHERE}`).get().n);
src.close();
const db=new DatabaseSync(out);
db.exec(`PRAGMA journal_mode=WAL;PRAGMA synchronous=OFF;
 CREATE TABLE doc_pages(id INTEGER PRIMARY KEY,file INTEGER NOT NULL,page INTEGER NOT NULL,chars INTEGER NOT NULL);
 CREATE VIRTUAL TABLE doc_fts USING fts5(text,content='',contentless_delete=1,tokenize='unicode61 remove_diacritics 2',detail=${detail});`);
const insPage=db.prepare('INSERT INTO doc_pages(file,page,chars) VALUES(?,?,?)'),insFts=db.prepare('INSERT INTO doc_fts(rowid,text) VALUES(?,?)');
let pages=0,chars=0,missing=0;const t0=Date.now();
db.exec('BEGIN');
for(const [i,f] of files.entries()){
 let text;try{text=fs.readFileSync(path.join(dir,'files',f.sha.slice(0,2),f.sha+'.txt'),'utf8');}catch{missing++;continue;}
 for(const [j,p] of text.split('\f').entries()){
  if(p.replace(/\s+/g,'').length<MIN_PAGE_CHARS)continue;
  const id=Number(insPage.run(i,j+1,p.length).lastInsertRowid);
  insFts.run(id,indexText(p));pages++;chars+=p.length;
 }
 if(i%200===199){db.exec('COMMIT');db.exec('BEGIN');}
 if(i%2000===1999)console.error(`${i+1} von ${files.length} Dateien …`);
}
db.exec('COMMIT');
const buildSecs=(Date.now()-t0)/1000;
db.exec("INSERT INTO doc_fts(doc_fts) VALUES('optimize')");db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
const bytes=fs.statSync(out).size,done=files.length-missing;
console.log(JSON.stringify({detail,files:done,of:total,missing,pages,mb_text:Math.round(chars/1e6),mb_index:Math.round(bytes/1e6),seconds:Math.round(buildSecs),
 ratio_index_to_text:(bytes/Math.max(1,chars)).toFixed(2),projected_gb:(bytes/Math.max(1,done)*total/1e9).toFixed(1),projected_hours:(buildSecs/Math.max(1,done)*total/3600).toFixed(1)}));
/* Abfragen wie die Suche (toMatch), höchstens 20.000 Seiten nach Rang; kalt (erster Lauf) und warm */
const q=db.prepare('SELECT count(*) n FROM (SELECT rowid FROM doc_fts WHERE doc_fts MATCH ? ORDER BY rank LIMIT 20000)');
const terms=['Wärmeplanung','Hebesatz','Bebauungsplan','Kita','Antrag','Haushalt','"kommunale Wärmeplanung"','Windenergie Flächennutzungsplan','Photovoltaik oder Solar','Grundsteuer B','Kita-Gebühren','Wärme NAHE Förderung','wind*'];
for(const term of terms){
 let match;try{({match}=toMatch(term));}catch(e){console.log(term.padEnd(36),'FEHLER',e.message);continue;}
 if(detail==='column'&&/"[^"]+ [^"]+"|NEAR/.test(match)){console.log(term.padEnd(36),'(Phrase/NAHE gibt es mit detail=column nicht)');continue;}
 const a=performance.now(),n=q.get(match).n,cold=performance.now()-a,b=performance.now();q.get(match);const warm=performance.now()-b;
 console.log(term.padEnd(36),String(n).padStart(6),'Seiten',cold.toFixed(0).padStart(6),'ms kalt',warm.toFixed(0).padStart(6),'ms warm');
}
db.close();
if(!args.includes('--keep'))for(const f of [out,out+'-wal',out+'-shm'])fs.rmSync(f,{force:true});
