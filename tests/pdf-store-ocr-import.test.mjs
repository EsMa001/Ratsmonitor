// Einspielen der Mac-OCR: nur offene Dateien, Seitenzahl und Version müssen passen; Probelauf schreibt nichts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {openPdfStore} from '../server/node/pdf-store.mjs';
import {TEXT_VERSION} from '../scripts/pdf-store/store-lib.mjs';

test('import schreibt nur offene, passende Dateien', () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imp-'));
 const store=openPdfStore(dir);
 const ins=(sha,pages,ocrNeeded)=>{
  store.db.prepare("INSERT INTO pdfs(url,sha256,bytes,pages,status,http,error,fetched_at,region_id,topic_id) VALUES(?,?,?,?,?,?,?,?,?,?)").run('https://x/'+sha,sha,10,pages,'text-only',200,null,'2026-10-01','r','t');
  store.db.prepare("INSERT INTO texts(sha256,status,method,version,pages,ocr_pages,ocr_needed,chars,error,made_at,head_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(sha,'ok','text',TEXT_VERSION,pages,0,ocrNeeded,0,null,'2026-10-01','');
 };
 ins('aa'.repeat(32),2,2);   // offen, Seitenzahl passt
 ins('bb'.repeat(32),3,0);   // schon gelesen
 ins('cc'.repeat(32),2,2);   // offen, Seitenzahl passt nicht
 store.close();
 const out=path.join(dir,'in');fs.mkdirSync(out);
 const put=(sha,pages,version=TEXT_VERSION)=>fs.writeFileSync(path.join(out,sha+'.json'),JSON.stringify({sha,pages,method:'ocr',version,ocrPages:2}));
 put('aa'.repeat(32),['Seite eins text','Seite zwei text']);
 put('bb'.repeat(32),['a','b','c']);
 put('cc'.repeat(32),['nur eine']);
 const run=extra=>execFileSync(process.execPath,['scripts/pdf-store/ocr-import.mjs',out,...extra],{env:{...process.env,RM_PDF_STORE:dir},encoding:'utf8'});
 const dry=run(['--dry-run']);
 assert.match(dry,/Probelauf/);
 assert.match(dry,/"geschrieben":1/);
 assert.equal(fs.existsSync(path.join(dir,'files','aa','aa'.repeat(32)+'.txt')),false,'Probelauf darf nichts ablegen');
 const real=run([]);
 assert.match(real,/"geschrieben":1/);
 assert.match(real,/"nichtOffen":1/);
 assert.match(real,/"seitenPassenNicht":1/);
 assert.equal(fs.readFileSync(path.join(dir,'files','aa','aa'.repeat(32)+'.txt'),'utf8').split('\f').length,2);
 fs.rmSync(dir,{recursive:true,force:true});
});
