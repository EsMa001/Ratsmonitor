// Lokale PDF-Ablage (server/node/pdf-store.mjs) und ihr Einsatz in readDocument.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openPdfStore} from '../server/node/pdf-store.mjs';
import {primaryPdf} from '../shared/document-type.mjs';

const pdf=s=>new TextEncoder().encode('%PDF-1.4\n'+s);
const tempStore=()=>openPdfStore(fs.mkdtempSync(path.join(os.tmpdir(),'pdf-store-')));

test('stored files come back; equal files are kept once',()=>{
 const s=tempStore();
 assert.equal(s.get('https://a.example/1.pdf'),null);
 assert.equal(s.put('https://a.example/1.pdf',pdf('x')),'ok');
 assert.equal(s.put('https://b.example/2.pdf',pdf('x')),'ok');
 assert.deepEqual(s.get('https://a.example/1.pdf'),pdf('x'));
 assert.equal(s.entry('https://a.example/1.pdf').sha256,s.entry('https://b.example/2.pdf').sha256);
 assert.equal(fs.readdirSync(path.join(s.dir,'files'),{recursive:true}).filter(f=>f.endsWith('.pdf')).length,1);
 s.close();
});

test('answers that are no PDF are only noted; errors keep an earlier file and are retried only when asked',()=>{
 const s=tempStore();
 assert.equal(s.put('https://a.example/page',new TextEncoder().encode('<html>')),'unsupported');
 assert.equal(s.get('https://a.example/page'),null);
 assert.equal(s.wants('https://a.example/page'),false);
 s.put('https://a.example/1.pdf',pdf('y'));s.fail('https://a.example/1.pdf','HTTP 500',{http:500});
 assert.deepEqual(s.get('https://a.example/1.pdf'),pdf('y'));
 s.fail('https://a.example/2.pdf','HTTP 404',{http:404});
 assert.equal(s.wants('https://a.example/2.pdf',{retryDays:Infinity}),false);
 assert.equal(s.wants('https://a.example/2.pdf',{retryDays:-1}),true);
 assert.equal(s.wants('https://a.example/3.pdf'),true);
 // Fehler eines übrigen PDFs behalten ihre Rolle (sonst zählen sie als Fehler bei Hauptdokumenten)
 s.fail('https://a.example/4.pdf','HTTP 404',{http:404,role:'other'});
 assert.equal(s.entry('https://a.example/4.pdf').role,'other');
 assert.equal(s.entry('https://a.example/2.pdf').role,null);
 s.close();
});

test('primaryPdf picks the paper among PDFs, as the import does',()=>{
 const d=(title,kind='application/pdf')=>({title,kind,url:'https://x.example/'+title});
 assert.equal(primaryPdf([d('Anlage 1'),d('Vorlage','text/html'),d('Beschlussvorlage')]).title,'Beschlussvorlage');
 assert.equal(primaryPdf([d('Anlage 1'),d('Bericht')]).title,'Bericht');
 assert.equal(primaryPdf([d('Anlage 1'),d('Anlage 2')]).title,'Anlage 1');
 assert.equal(primaryPdf([d('Vorlage','text/html')]),null);
 assert.equal(primaryPdf(undefined),null);
 // Nach der Art, nicht nach dem Wort „vorlage“ (Fälle aus der Messung vom 12.10.2026)
 assert.equal(primaryPdf([d('Anlage 1 zur Vorlage V_0197_2026'),d('Beschlussvorlage')]).title,'Beschlussvorlage');
 assert.equal(primaryPdf([d('Buergerexemplar (Tagesordnung mit oeffentlichen Vorlagen ohne Anlagen)'),d('A-R-0053-2026')]).title,'A-R-0053-2026');
 assert.equal(primaryPdf([d('Niederschrift öffentlich'),d('Antrag CDU Münster schenkt aus')]).title,'Antrag CDU Münster schenkt aus');
 // Titel ohne Art und Beschlusstext gleich: die Reihenfolge entscheidet; zwei Sitzungsunterlagen: die erste
 assert.equal(primaryPdf([d('FB 1-047-26'),d('Beschluss - Top 2')]).title,'FB 1-047-26');
 assert.equal(primaryPdf([d('Einladung öffentlich'),d('Niederschrift öffentlich')]).title,'Einladung öffentlich');
});

test('readDocument takes the file from the store and does not go to the network',async()=>{
 const {useDocumentStore,readDocument}=await import('../server/integrations/documents.mjs');
 const fetch0=globalThis.fetch,asked=[];globalThis.fetch=async()=>{throw Error('Netz');};
 try{
  useDocumentStore({get:url=>{asked.push(url);return pdf('kaputt');},put:()=>{throw Error('nicht ablegen');}});
  // Das Probe-PDF ist nicht lesbar: der Fehler kommt vom Lesen, nicht vom Netz und nicht vom Ablegen.
  await assert.rejects(readDocument('https://a.example/1.pdf'),e=>!/Netz|nicht ablegen/.test(e.message));
  assert.deepEqual(asked,['https://a.example/1.pdf']);
 }finally{globalThis.fetch=fetch0;useDocumentStore(null);}
});

test('a stored text version gives readDocument the same text as the PDF, without opening it',async()=>{
 const {useDocumentStore,readDocument,mergePages}=await import('../server/integrations/documents.mjs');
 const s=tempStore(),url='https://a.example/t.pdf';s.put(url,pdf('t'));
 const sha=s.entry(url).sha256;s.putText(sha,['Seite  eins\n','\nSeite\fzwei '],{method:'text',version:1,ocrNeeded:1});
 assert.deepEqual(s.getText(url).pages,['Seite  eins\n','\nSeite zwei ']);
 assert.equal(mergePages(['a  b\n','\n\n\nc']),'a b\n\nc');
 useDocumentStore(s);
 try{assert.equal(await readDocument(url),'Seite eins\n\nSeite zwei ');}finally{useDocumentStore(null);s.close();}
 const t=tempStore();t.put(url,pdf('t'));t.putText(t.entry(url).sha256,Array(151).fill('x'),{method:'text',version:1});useDocumentStore(t);
 try{await assert.rejects(readDocument(url),/zu umfangreich/);}finally{useDocumentStore(null);t.close();}
});

test('rankPdf: one score 0..1 from type, formal, text amount and size; too large files keep only their text',async()=>{
 const {rankPdf,MAX_BYTES,FULL_CHARS,FULL_BYTES,OCR_PAGE_CHARS}=await import('../shared/pdf-rank.mjs');
 const kb=1024,r=d=>rankPdf({type:'paper',chars:FULL_CHARS,bytes:50*kb,...d});
 assert.equal(r({}).score,1,'Vorlage mit viel Text in kleiner Datei: 100 %');
 assert.ok(r({type:'minutes'}).score>r({type:'attachment'}).score&&r({type:'attachment'}).score>r({type:'invitation'}).score);
 assert.equal(r({formal:1}).score,0.5);
 assert.equal(r({type:'minutes',formal:1}).score,0.7);
 assert.equal(r({chars:FULL_CHARS/4}).score,0.5,'Inhalt mit der Wurzel');
 assert.equal(r({chars:0,ocrNeeded:5}).score,Math.min(1,Math.sqrt(5*OCR_PAGE_CHARS/FULL_CHARS)),'Seiten, die auf OCR warten, vorläufig geschätzt');
 assert.equal(r({chars:null}).score,0.5,'ohne lesbaren Text halb');
 assert.equal(r({bytes:FULL_BYTES}).score,1);
 assert.ok(Math.abs(r({bytes:8*FULL_BYTES}).score-0.5)<1e-9,'Größe mit der Kubikwurzel');
 for(const d of [{},{chars:10},{bytes:MAX_BYTES},{type:'invitation'}])assert.ok(r(d).score>=0&&r(d).score<=1);
 assert.equal(r({type:'attachment',bytes:MAX_BYTES+1}).keep,false);
 assert.equal(r({type:'attachment',bytes:MAX_BYTES+1}).score,0);
 assert.equal(r({bytes:MAX_BYTES+1}).keep,false,'über 10 MB auch Vorlagen nur Text');
 assert.equal(r({type:'nonsense'}).score,r({type:'other'}).score);
});

test('the AI batch reads the stored text version and does not go to the network',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pdf-store-ai-'));process.env.RM_PDF_STORE=dir;
 const s=openPdfStore(dir),url='https://a.example/vorlage.pdf';s.put(url,pdf('v'));s.putText(s.entry(url).sha256,['Erste Seite.\n','Zweite Seite.'],{method:'ocr',version:1});s.close();
 const fetch0=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Netz');};
 try{
  const {fetchSource}=await import('../scripts/ai-batch/lib.mjs');
  const r=await fetchSource(url);
  assert.equal(r.via,'pdf-store-text');assert.equal(r.status,'ok');
  assert.match(r.text,/Erste Seite\.[\s\S]*Zweite Seite\./);assert.equal(r.pagesTotal,2);
 }finally{globalThis.fetch=fetch0;delete process.env.RM_PDF_STORE;}
});

test('vorläufige Fehlschläge nach 7 Tagen erneut, höchstens dreimal; nicht öffentlich nie erneut',async()=>{
 const {temporaryFailure}=await import('../server/node/pdf-store.mjs');
 assert.equal(temporaryFailure({http:403}),true);assert.equal(temporaryFailure({http:503}),true);assert.equal(temporaryFailure({http:404}),false);
 assert.equal(temporaryFailure({http:null,error:'The operation was aborted due to timeout'}),true);assert.equal(temporaryFailure({http:null,error:'Dokument zu groß'}),false);
 const s=tempStore(),old=new Date(Date.now()-8*864e5).toISOString();
 s.fail('https://a.example/t.pdf','The operation was aborted due to timeout');
 assert.equal(s.wants('https://a.example/t.pdf',{retryDays:Infinity}),false,'nicht vor 7 Tagen');
 s.db.prepare('UPDATE pdfs SET fetched_at=? WHERE url=?').run(old,'https://a.example/t.pdf');
 assert.equal(s.wants('https://a.example/t.pdf',{retryDays:Infinity}),true,'nach 7 Tagen');
 s.fail('https://a.example/t.pdf','timeout');s.fail('https://a.example/t.pdf','timeout');
 s.db.prepare('UPDATE pdfs SET fetched_at=? WHERE url=?').run(old,'https://a.example/t.pdf');
 assert.equal(s.entry('https://a.example/t.pdf').attempts,3);
 assert.equal(s.wants('https://a.example/t.pdf',{retryDays:Infinity}),false,'nach drei Versuchen endgültig');
 s.fail('https://a.example/404.pdf','HTTP 404',{http:404});s.db.prepare('UPDATE pdfs SET fetched_at=? WHERE url=?').run(old,'https://a.example/404.pdf');
 assert.equal(s.wants('https://a.example/404.pdf',{retryDays:Infinity}),false,'404 endgültig');
 s.private('https://a.example/p.pdf',{role:'other'});
 assert.equal(s.entry('https://a.example/p.pdf').status,'private');assert.equal(s.wants('https://a.example/p.pdf',{retryDays:-1}),false);
 s.close();
});
test('Weiterleitung auf eine Anmeldeseite heißt nicht öffentlich',async()=>{
 const {LOGIN_PAGE}=await import('../scripts/pdf-store/store-lib.mjs');
 for(const p of ['/BI/noauth.asp','/login','/ris/anmeldung','/auth'])assert.ok(LOGIN_PAGE.test(p),p);
 for(const p of ['/BI/do027.asp','/files/bericht.pdf','/author/x'])assert.ok(!LOGIN_PAGE.test(p),p);
});
