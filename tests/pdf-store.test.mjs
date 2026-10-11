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
 s.close();
});

test('primaryPdf picks the paper among PDFs, as the import does',()=>{
 const d=(title,kind='application/pdf')=>({title,kind,url:'https://x.example/'+title});
 assert.equal(primaryPdf([d('Anlage 1'),d('Vorlage','text/html'),d('Beschlussvorlage')]).title,'Beschlussvorlage');
 assert.equal(primaryPdf([d('Anlage 1'),d('Bericht')]).title,'Bericht');
 assert.equal(primaryPdf([d('Anlage 1'),d('Anlage 2')]).title,'Anlage 1');
 assert.equal(primaryPdf([d('Vorlage','text/html')]),null);
 assert.equal(primaryPdf(undefined),null);
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

test('rankPdf: value per byte by type, formal, scan and age; too large files keep only their text',async()=>{
 const {rankPdf,MAX_BYTES}=await import('../shared/pdf-rank.mjs');
 const now=new Date('2026-10-11'),mb=1048576,r=d=>rankPdf({bytes:mb,eventDate:'2026-10-11',...d},now);
 assert.ok(r({type:'paper'}).score>r({type:'minutes'}).score);
 assert.ok(r({type:'minutes'}).score>r({type:'attachment'}).score);
 assert.ok(r({type:'attachment'}).score>r({type:'invitation'}).score);
 assert.equal(r({type:'paper',formal:1}).value,0.5);
 assert.equal(r({type:'minutes',formal:1}).value,r({type:'minutes'}).value);
 assert.equal(r({type:'paper',scan:true}).value,1.5);
 assert.ok(r({type:'paper',eventDate:'2020-01-01'}).value>r({type:'paper'}).value);
 assert.equal(r({type:'paper',bytes:2*mb}).score,r({type:'paper'}).score/2);
 assert.equal(r({type:'attachment',bytes:MAX_BYTES+1}).keep,false);
 assert.equal(r({type:'paper',bytes:MAX_BYTES+1}).keep,true);
 assert.equal(r({type:'nonsense'}).value,r({type:'other'}).value);
});
