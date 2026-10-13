import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createLocalSourceReader} from '../server/node/ai-local-sources.mjs';

const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const passage='Die Verwaltung plant die Erneuerung des Spielplatzes und legt die notwendigen Arbeiten sowie die geplanten Kosten zur Beratung vor.';
const doc=(url,title='Beschlussvorlage')=>({url,title,kind:'application/pdf'});
const report=documents=>({id:'example-report',officialTitle:'Neugestaltung des Spielplatzes',sourceUrl:'https://example.test/report',documents});

function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ai-local-sources-'));
 const db=new DatabaseSync(path.join(directory,'index.sqlite'));
 db.exec(`CREATE TABLE pdfs(url TEXT PRIMARY KEY,sha256 TEXT,status TEXT,fetched_at TEXT,topic_id TEXT);
  CREATE TABLE texts(sha256 TEXT PRIMARY KEY,status TEXT,method TEXT,ocr_needed INTEGER,pages INTEGER);`);
 const put=(url,pages,{sha=hash(url),status='ok',method='text',ocrNeeded=0,title}={})=>{
  const file=path.join(directory,'files',sha.slice(0,2),sha+'.txt');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,pages.join('\f'));
  db.prepare('INSERT OR REPLACE INTO pdfs VALUES(?,?,?,?,?)').run(url,sha,status,'2026-10-12T08:00:00.000Z','another-report');
  db.prepare('INSERT OR REPLACE INTO texts VALUES(?,?,?,?,?)').run(sha,'ok',method,ocrNeeded,pages.length);
  return {doc:doc(url,title),sha,file};
 };
 t.after(()=>{db.close();fs.rmSync(directory,{recursive:true,force:true});});
 return {directory,db,put,read:createLocalSourceReader({directory})};
}

test('loads every stored page through document links, without changing the SQLite index',async t=>{
 const f=fixture(t),pages=Array.from({length:52},(_,i)=>'Seite '+(i+1)+': '+passage);
 const stored=f.put('https://example.test/report.pdf',pages);
 const before=fs.readFileSync(path.join(f.directory,'index.sqlite'));
 const result=await f.read(report([stored.doc]));
 assert.equal(result.sources.length,1);assert.equal(result.sources[0].pages.length,52);
 assert.deepEqual(result.sources[0].pages[51],{number:52,text:pages[51]});
 assert.equal(result.sources[0].hash,hash(pages.join('\f')));
 assert.equal(result.sources[0].fetchedAt,'2026-10-12T08:00:00.000Z');
 assert.equal(result.ready,true);
 assert.deepEqual(result.coverage,{total:1,available:1,missing:0,partial:0,complete:true});
 assert.deepEqual(fs.readFileSync(path.join(f.directory,'index.sqlite')),before);
});

test('reads text-only entries and deduplicates equal content while retaining both URLs',async t=>{
 const f=fixture(t),a=f.put('https://example.test/a.pdf',[passage]),b=f.put('https://example.test/b.pdf',[passage],{status:'text-only'});
 const result=await f.read(report([a.doc,b.doc]));
 assert.equal(result.sources.length,1);
 assert.deepEqual(result.sources[0].aliases.map(x=>x.url),[a.doc.url,b.doc.url]);
 assert.deepEqual(result.coverage,{total:2,available:2,missing:0,partial:0,complete:true});
});

test('title and event metadata are insufficient, even when previous generated summaries are present',async()=>{
 const read=createLocalSourceReader({directory:path.join(os.tmpdir(),'missing-ai-store-'+crypto.randomUUID())});
 const result=await read({...report([]),sourceText:'Neugestaltung des Spielplatzes\n2026-10-12 Neugestaltung des Spielplatzes',
  events:[{date:'2026-10-12',description:'Neugestaltung des Spielplatzes'}],
  shortSummary:passage,longSummary:[passage],ruleSummary:{short:{sentences:[passage]}}});
 assert.deepEqual(result.sources,[]);assert.equal(result.ready,false);assert.equal(result.coverage.complete,false);
});

test('long keyword and catalogue metadata without factual prose do not become a content source',async()=>{
 const result=await createLocalSourceReader()({...report([]),sourceText:'Neugestaltung des Spielplatzes\n'+
  'Oeffentlicher Vorgang des Abgeordnetenhauses von Berlin\nDrucksache\nParlamentsdokumentation\n'+
  'Bildung Jugend Stadtentwicklung Gruenflaechen Kommunales Sport Freizeit Schule Gesundheit Bauvorhaben Infrastruktur Verwaltung Finanzen Haushalt'});
 assert.equal(result.ready,false);assert.deepEqual(result.sources,[]);
});

test('uses meaningful database text when no local store exists and never fetches or initializes files',async t=>{
 const directory=path.join(os.tmpdir(),'missing-ai-store-'+crypto.randomUUID());
 const fetch0=globalThis.fetch;t.after(()=>{globalThis.fetch=fetch0;});
 globalThis.fetch=async()=>{assert.fail('A local text reader must not fetch');};
 const result=await createLocalSourceReader({directory})({...report([doc('https://example.test/missing.pdf')]),documentText:passage,updatedAt:'2026-10-12T08:00:00Z'});
 assert.equal(result.sources.length,1);assert.equal(result.sources[0].method,'database-documentText');
 assert.equal(result.sources[0].url,'urn:ratsmonitor:article:example-report:documentText');
 assert.equal(result.sources[0].fetchedAt,null);assert.equal(result.ready,true);
 assert.deepEqual(result.coverage,{total:2,available:1,missing:1,partial:0,complete:false});
 assert.equal(result.gaps.length,1);assert.equal(fs.existsSync(directory),false);
});

test('preserves substantive saved sourceText while discarding its metadata-only lines',async()=>{
 const directory=path.join(os.tmpdir(),'missing-ai-store-'+crypto.randomUUID());
 const result=await createLocalSourceReader({directory})({...report([]),sourceText:'Neugestaltung des Spielplatzes\n'+passage,
  metadata:{lastFetchedAt:'2026-10-12T08:00:00.000Z'}});
 assert.equal(result.sources.length,1);assert.equal(result.sources[0].pages[0].text,passage);
 assert.equal(result.sources[0].hash,hash(passage));assert.equal(result.sources[0].fetchedAt,'2026-10-12T08:00:00.000Z');
});

test('OCR waiting pages are explicitly partial rather than complete',async t=>{
 const f=fixture(t),stored=f.put('https://example.test/scan.pdf',[passage,''],{method:'mixed',ocrNeeded:1});
 const result=await f.read(report([stored.doc]));
 assert.equal(result.sources[0].method,'mixed');assert.equal(result.sources[0].partial,true);
 assert.equal(result.sources[0].pages.length,2);assert.equal(result.ready,true);
 assert.deepEqual(result.coverage,{total:1,available:1,missing:0,partial:1,complete:false});
 assert.match(result.gaps[0].reason,/OCR/);
});

test('unreadable scans and missing text files create gaps without sources',async t=>{
 const f=fixture(t),a=f.put('https://example.test/scan.pdf',['',''],{ocrNeeded:2}),b=f.put('https://example.test/gone.pdf',[passage]);
 fs.unlinkSync(b.file);
 const result=await f.read(report([a.doc,b.doc]));
 assert.equal(result.ready,false);assert.equal(result.sources.length,0);assert.equal(result.gaps.length,2);
 assert.deepEqual(result.coverage,{total:2,available:0,missing:2,partial:0,complete:false});
});

test('rejects malformed SHA paths instead of reading arbitrary local files',async t=>{
 const f=fixture(t),url='https://example.test/unsafe.pdf';
 f.db.prepare('INSERT INTO pdfs VALUES(?,?,?,?,?)').run(url,'../../secrets','ok','2026-10-12T08:00:00Z','example-report');
 f.db.prepare('INSERT INTO texts VALUES(?,?,?,?,?)').run('../../secrets','ok','text',0,1);
 const result=await f.read(report([doc(url)]));
 assert.equal(result.ready,false);assert.match(result.gaps[0].reason,/ungueltigen Pfad/);
});

test('a session document only contributes its uniquely matched bounded TOP section with original page numbers',async t=>{
 const f=fixture(t),stored=f.put('https://example.test/minutes.pdf',[
  'Niederschrift der Sitzung\nTOP 1 Andere Angelegenheit\n'+passage,
  'TOP 2 Neugestaltung des Spielplatzes\n'+passage,
  'Fortsetzung: '+passage+'\nTOP 3 Andere Sache\nDieser fremde Punkt darf nicht in den Bericht gelangen.',
 ],{title:'Niederschrift der Sitzung'});
 const result=await f.read(report([stored.doc]));
 assert.equal(result.sources.length,1);assert.deepEqual(result.sources[0].pages.map(x=>x.number),[2,3]);
 assert.match(result.sources[0].pages[0].text,/TOP 2/);
 assert.doesNotMatch(result.sources[0].pages.map(x=>x.text).join(' '),/Andere Angelegenheit|fremde Punkt|TOP 3/);
 assert.ok(result.sources[0].rawHash);assert.equal(result.coverage.complete,true);
});

test('unmapped or repeated session sections are gaps, never whole-session sources',async t=>{
 const f=fixture(t),a=f.put('https://example.test/a.pdf',['Niederschrift der Sitzung\nTOP 1 Andere Sache\n'+passage],{title:'Niederschrift'});
 const b=f.put('https://example.test/b.pdf',[
  'TOP 1 Neugestaltung des Spielplatzes\n'+passage+'\nTOP 2 Andere Sache\n'+passage,
  'TOP 1 Neugestaltung des Spielplatzes\n'+passage,
 ],{title:'Sitzungsmappe (Sammeldokument)'});
 const result=await f.read(report([a.doc,b.doc]));
 assert.equal(result.ready,false);assert.equal(result.gaps.length,2);assert.equal(result.coverage.missing,2);
});

test('identifies whole-session text despite a generic misleading document title',async t=>{
 const f=fixture(t),stored=f.put('https://example.test/minutes.pdf',['Niederschrift der Sitzung\nTOP 1 Andere Sache\n'+passage],{title:'Beschlussvorlage'});
 const result=await f.read(report([stored.doc]));
 assert.equal(result.ready,false);assert.match(result.gaps[0].reason,/Sitzungsunterlage/);
});

test('changed text at the same document URL and PDF SHA produces a new source hash',async t=>{
 const f=fixture(t),stored=f.put('https://example.test/same.pdf',[passage]);
 const topic=report([stored.doc]),first=await f.read(topic);
 fs.writeFileSync(stored.file,passage+' Die Kosten wurden nach der Beratung berichtigt.');
 const second=await f.read(topic);
 assert.notEqual(first.sources[0].hash,second.sources[0].hash);
 assert.notEqual(first.sources[0].id,second.sources[0].id);
});

test('saved duplicate document text and source text are not read again alongside the complete PDF text',async t=>{
 const f=fixture(t),stored=f.put('https://example.test/paper.pdf',[passage]);
 const result=await f.read({...report([stored.doc]),documentSource:stored.doc.url,documentText:passage,
  sourceText:'Neugestaltung des Spielplatzes\n'+passage});
 assert.equal(result.sources.length,1);assert.equal(result.coverage.total,1);
});

test('database texts without URLs retain distinct stable identities rather than invented web provenance',async()=>{
 const directory=path.join(os.tmpdir(),'missing-ai-store-'+crypto.randomUUID());
 const result=await createLocalSourceReader({directory})({id:'article/1',title:'Planung',documentText:passage,
  sourceText:passage+' Weitere Mittel sollen im Haushalt vorgesehen werden.'});
 assert.equal(result.sources.length,2);assert.notEqual(result.sources[0].id,result.sources[1].id);
 assert.match(result.sources[0].url,/^urn:ratsmonitor:article:article%2F1:documentText$/);
});

test('unlinked stored minutes cannot expose other agenda items through either database text field',async()=>{
 const text='Niederschrift der Sitzung\nTOP 1 Andere Sache\n'+passage+'\nTOP 2 Noch ein fremder Punkt\n'+passage;
 for(const field of ['documentText','sourceText']){
  const result=await createLocalSourceReader()({...report([]),[field]:text});
  assert.equal(result.ready,false,field);assert.equal(result.sources.length,0,field);
  assert.match(result.gaps[0].reason,/Sitzungstext/,field);
 }
});

test('unlinked stored minutes only expose the uniquely matched report section and retain field provenance',async()=>{
 const text='Niederschrift der Sitzung\nTOP 1 Andere Sache\n'+passage+'\fTOP 2 Neugestaltung des Spielplatzes\n'+passage+
  '\nTOP 3 Fremder Punkt\nDieser andere Punkt darf nicht in der bereitgestellten Quelle stehen.';
 for(const field of ['documentText','sourceText']){
  const result=await createLocalSourceReader()({...report([]),[field]:text});
  assert.equal(result.ready,true,field);assert.equal(result.sources.length,1,field);
  assert.deepEqual(result.sources[0].pages.map(page=>page.number),[2],field);
  assert.doesNotMatch(result.sources[0].pages[0].text,/Andere Sache|Fremder Punkt|TOP 3/,field);
  assert.equal(result.sources[0].url,field==='documentText'?'urn:ratsmonitor:article:example-report:documentText':'https://example.test/report');
 }
});

test('a report title mentioning minutes does not misclassify its unlinked substantive text as an entire meeting',async()=>{
 const result=await createLocalSourceReader()({...report([]),officialTitle:'Genehmigung des Protokolls',documentText:passage});
 assert.equal(result.ready,true);assert.equal(result.gaps.length,0);
});
