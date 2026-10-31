// Dokumentindex der Dokumentsuche (server/node/doc-index.mjs): Aufbau aus der Ablage, Wiederaufnahme, geänderte und
// weggefallene Texte, Sperre, Neubau in fts.next.sqlite. Testablage mit erfundenen Texten in einem Temp-Ordner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openPdfStore} from '../server/node/pdf-store.mjs';
import {indexDocuments,openDocReader,openDocIndex,docIndexInfo,indexText,DOC_INDEX_FILE,DOC_INDEX_NEXT,INDEX_VERSION} from '../server/node/doc-index.mjs';

const pdf=s=>new TextEncoder().encode('%PDF-1.4\n'+s);
function tempStore(){
 const store=openPdfStore(fs.mkdtempSync(path.join(os.tmpdir(),'doc-index-')));
 /** Datei ablegen samt Textfassung; gibt die Prüfsumme zurück */
 store.add=(url,pages,{topic='t-'+url,region='r1',date='2026-09-01',role=null,status=null}={})=>{
  store.put(url,pdf(url),{topicId:topic,regionId:region,eventDate:date,docType:'paper',...(role?{role}:{})});
  const sha=store.entry(url).sha256;
  store.putText(sha,pages,{method:'text',version:1});
  if(status)store.db.prepare('UPDATE pdfs SET status=? WHERE url=?').run(status,url);
  return sha;
 };
 return store;
}
const LONG='Die kommunale Wärmeplanung der Gemeinde ist bis 2028 vorzulegen und wird gefördert.';
const hits=(reader,match)=>reader.all('SELECT rowid AS id FROM doc_fts WHERE doc_fts MATCH ?',match).length;
const rows=(dir,file=DOC_INDEX_FILE)=>{const db=openDocIndex(path.join(dir,file),{readOnly:true});try{return {pages:Number(db.prepare('SELECT count(*) n FROM doc_pages').get().n),fts:Number(db.prepare('SELECT count(*) n FROM doc_fts_docsize').get().n),files:Number(db.prepare('SELECT count(*) n FROM doc_files').get().n)};}finally{db.close();}};

test('indexes main documents with text: short pages and attachments left out, text-only files in',async()=>{
 const s=tempStore();
 s.add('https://a.example/1.pdf',[LONG,'kurz',`Straße und ${LONG}`]);
 s.add('https://a.example/2.pdf',['Anlage: Lageplan der Wärmeplanung mit vielen Einzelheiten'],{role:'other'});
 s.add('https://a.example/3.pdf',['Das PDF ist verdrängt, der Text zur Kita-Gebühr bleibt in der Ablage.'],{status:'text-only'});
 const r=await indexDocuments({dir:s.dir});
 assert.equal(r.done,true);assert.equal(r.added,2);assert.equal(r.files,2);assert.equal(r.pages,3,'Seite 2 hat weniger als 20 Zeichen');
 const reader=openDocReader(s.dir);
 assert.equal(hits(reader,'"lageplan"'),0,'Anlagen (role other) fehlen');
 assert.equal(hits(reader,'"kita"'),1,'text-only ist drin, Bindestrich trennt Wörter');
 assert.equal(hits(reader,'"strasse"'),1,'ß wird zu ss');
 assert.equal(hits(reader,'"warmeplanung"'),2,'Umlaute gefaltet');
 assert.deepEqual(reader.all('SELECT page FROM doc_pages ORDER BY file_id,page').map(x=>x.page).sort(),[1,1,3],'Seitenzahlen der Textfassung');
 reader.close();s.close();
});

test('joins words split at a line end; keeps real hyphens',()=>{
 assert.equal(indexText('Bebauungs-\nplan Nr. 5, Kita-Gebühren, Straße'),'Bebauungsplan Nr. 5, Kita-Gebühren, Strasse');
 assert.equal(indexText('Kita-\nGebühren'),'Kita-\nGebühren','vor einem Großbuchstaben bleibt der Strich');
});

test('resumes after a stop without duplicates; a second run has nothing to do',async()=>{
 const s=tempStore();
 for(let i=0;i<5;i++)s.add(`https://a.example/${i}.pdf`,[`${LONG} Nummer ${i}`],{date:`2026-09-0${i+1}`});
 let calls=0;
 const first=await indexDocuments({dir:s.dir,stop:()=>++calls>2});
 assert.equal(first.done,false);assert.equal(first.stopped,true);assert.equal(first.added,2);assert.equal(first.remaining,3);
 const reader=openDocReader(s.dir,{recheckMs:0});
 assert.deepEqual(reader.all('SELECT event_date FROM doc_files ORDER BY event_date').map(r=>r.event_date),['2026-09-04','2026-09-05'],'jüngste Sitzung zuerst');
 const second=await indexDocuments({dir:s.dir});
 assert.equal(second.done,true);assert.equal(second.added,3);
 assert.deepEqual(rows(s.dir),{pages:5,fts:5,files:5},'kein Doppel in doc_pages und doc_fts');
 const third=await indexDocuments({dir:s.dir});
 assert.equal(third.added+third.updated+third.meta+third.removed,0);
 const late=await indexDocuments({dir:s.dir,deadline:Date.now()-1});
 assert.equal(late.done,true,'ohne Arbeit ist auch eine abgelaufene Zeit kein Rest');
 reader.close();s.close();
});

test('a new text replaces the old pages (also when the old text is gone); files that leave the store are removed',async()=>{
 const s=tempStore();
 const sha=s.add('https://a.example/1.pdf',['Erste Fassung mit dem Wort Hundesteuer auf der Seite',LONG]);
 s.add('https://a.example/2.pdf',[`Zweites Dokument: ${LONG}`]);
 await indexDocuments({dir:s.dir});
 const reader=openDocReader(s.dir,{recheckMs:0});
 const rev=reader.revision();
 assert.equal(hits(reader,'"hundesteuer"'),1);
 /* OCR überschreibt die .txt-Datei: der alte Text ist danach nicht mehr lesbar */
 await new Promise(r=>setTimeout(r,5));
 s.putText(sha,['Zweite Fassung nach der OCR: Grundsteuer B steigt',LONG,'Eine weitere Seite mit genug Text darauf'],{method:'mixed',version:1});
 const r=await indexDocuments({dir:s.dir});
 assert.equal(r.updated,1);
 assert.equal(hits(reader,'"hundesteuer"'),0,'alte Seite weg (contentless_delete)');
 assert.equal(hits(reader,'"grundsteuer" "b"'),1);
 assert.deepEqual(rows(s.dir),{pages:4,fts:4,files:2});
 assert.notEqual(reader.revision(),rev,'neuer Stand nach Änderungen');
 /* Nur die Angaben geändert (anderer Sitzungstag): kein neues Lesen */
 s.db.prepare("UPDATE pdfs SET event_date='2026-10-01' WHERE url='https://a.example/2.pdf'").run();
 const m=await indexDocuments({dir:s.dir});
 assert.equal(m.meta,1);assert.equal(m.updated,0);
 /* Wird zur Anlage: fällt heraus */
 s.db.prepare("UPDATE pdfs SET role='other' WHERE url='https://a.example/2.pdf'").run();
 const g=await indexDocuments({dir:s.dir});
 assert.equal(g.removed,1);
 assert.deepEqual(rows(s.dir),{pages:3,fts:3,files:1});
 reader.close();s.close();
});

test('only the files of the given reports with ids',async()=>{
 const s=tempStore();
 s.add('https://a.example/1.pdf',[LONG],{topic:'a'});
 s.add('https://a.example/2.pdf',[LONG],{topic:'b'});
 const r=await indexDocuments({dir:s.dir,ids:['b']});
 assert.equal(r.added,1);assert.equal(r.sourceFiles,1);assert.equal(r.done,false,'ein Lauf mit ids ist nie der ganze Lauf');
 assert.deepEqual(openDocReader(s.dir).all('SELECT topic_id FROM doc_files').map(x=>x.topic_id),['b']);
 s.close();
});

test('a second run under a live lease does nothing',async()=>{
 const s=tempStore();
 s.add('https://a.example/1.pdf',[LONG]);
 await indexDocuments({dir:s.dir});
 const db=openDocIndex(path.join(s.dir,DOC_INDEX_FILE));
 db.prepare("INSERT INTO doc_index_state(key,value) VALUES('lease',?)").run(JSON.stringify({pid:process.ppid,at:new Date().toISOString()}));
 db.close();
 s.add('https://a.example/2.pdf',[LONG]);
 const r=await indexDocuments({dir:s.dir});
 assert.equal(r.busy,true);
 /* Verwaiste Sperre (Prozess läuft nicht mehr) gilt als frei */
 const db2=openDocIndex(path.join(s.dir,DOC_INDEX_FILE));
 db2.prepare("UPDATE doc_index_state SET value=? WHERE key='lease'").run(JSON.stringify({pid:2147483646,at:new Date().toISOString()}));
 db2.close();
 assert.equal((await indexDocuments({dir:s.dir})).added,1);
 s.close();
});

test('a new index version builds into fts.next.sqlite; search keeps the old index until the swap',async()=>{
 const s=tempStore();
 s.add('https://a.example/1.pdf',['Alte Fassung des Index mit dem Wort Radweg']);
 await indexDocuments({dir:s.dir});
 /* Index einer älteren Fassung */
 const db=openDocIndex(path.join(s.dir,DOC_INDEX_FILE));
 db.prepare("UPDATE doc_index_state SET value='0' WHERE key='version'").run();db.close();
 s.add('https://a.example/2.pdf',['Neues Dokument zum Radweg an der Landstraße']);
 s.add('https://a.example/3.pdf',['Noch ein Dokument zum Radweg und zur Brücke']);
 assert.equal(docIndexInfo(s.dir).current,false);
 let calls=0;
 const part=await indexDocuments({dir:s.dir,stop:()=>++calls>1});
 assert.equal(part.target,DOC_INDEX_NEXT);assert.equal(part.rebuild,true);assert.equal(part.swapped,false);
 let reader=openDocReader(s.dir);
 assert.equal(hits(reader,'"radweg"'),1,'die Suche liest den alten Index');
 reader.close();
 const rest=await indexDocuments({dir:s.dir});
 assert.equal(rest.swapped,true);
 assert.equal(fs.existsSync(path.join(s.dir,DOC_INDEX_NEXT)),false);
 reader=openDocReader(s.dir);
 assert.equal(hits(reader,'"radweg"'),3,'nach dem Tausch der neue');
 assert.equal(docIndexInfo(s.dir).version,INDEX_VERSION);
 reader.close();s.close();
});

test('without a store or index the reader is not ready',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'doc-index-empty-'));
 assert.equal(openDocReader(dir).ready(),false);
 assert.equal(docIndexInfo(dir),null);
 assert.match((await indexDocuments({dir})).skipped,/index\.sqlite/);
});
