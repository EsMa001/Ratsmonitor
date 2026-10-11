// PDF-Ablage: feste Grenze mit Tausch (keeper in scripts/pdf-store/store-lib.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openPdfStore} from '../server/node/pdf-store.mjs';
import {keeper,usedBytes} from '../scripts/pdf-store/store-lib.mjs';

/* Kleines gültiges PDF mit einer Textzeile; pad füllt einen Kommentar auf, damit die Dateien gleich groß sind */
function pdf(text,pad=4000){
 const content=`BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
 const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let out='%PDF-1.4\n%'+'x'.repeat(pad)+'\n';const at=[];
 objs.forEach((o,i)=>{at.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`;});
 const xref=out.length;
 out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+at.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new Uint8Array(Buffer.from(out,'latin1'));
}

test('feste Grenze: neue Datei verdrängt die schlechteste oder fliegt selbst raus, der Text bleibt',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pdf-keeper-'));
 const store=openPdfStore(dir);
 try{
  const day=new Date().toISOString().slice(0,10);
  const put=async(k,name,docType)=>{store.put('https://x.test/'+name,pdf('Dokument '+name),{docType,formal:false,eventDate:day});return k.admit(store.entry('https://x.test/'+name).sha256);};
  const size=pdf('Dokument A').byteLength;
  // Platz für zwei Dateien samt Text
  const k=keeper(store,size*2+200);
  assert.equal(await put(k,'A','paper'),'behalten');
  assert.equal(await put(k,'B','invitation'),'behalten');
  // C (Vorlage) ist besser als B (Einladung): B fliegt raus
  assert.equal(await put(k,'C','paper'),'behalten');
  assert.equal(store.entry('https://x.test/B').status,'text-only');
  // D (Einladung) ist schlechter als alles in der Ablage: D fliegt selbst raus
  assert.equal(await put(k,'D','invitation'),'nicht besser');
  assert.equal(store.entry('https://x.test/D').status,'text-only');
  assert.ok(usedBytes(store)<=size*2+200);
  // Der fortgeschriebene Platz stimmt mit der vollen Zählung überein
  assert.ok(Math.abs(k.used()-usedBytes(store))<1,'used '+k.used()+' vs '+usedBytes(store));
  // Texte bleiben auch bei gelöschten PDFs
  for(const n of ['B','D'])assert.match(store.getText('https://x.test/'+n).pages.join(' '),new RegExp('Dokument '+n));
  assert.deepEqual({...k.stats(),ocrPages:0},{kept:3,swapped:1,rejected:1,tooBig:0,ocrPages:0,stuck:0});
  await k.close();
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});
