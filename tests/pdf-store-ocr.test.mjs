// PDF-Ablage: OCR aller PDFs (Auftrag „OCR starten“): gemeinsame Reihe (ocrQueue) und Lesen mit kurzem Nachladen
// (ocrWithRefetch in scripts/pdf-store/store-lib.mjs). Ohne Netz und ohne OCR-Werkzeuge: download und read sind Attrappen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {openPdfStore} from '../server/node/pdf-store.mjs';
import {ocrWithRefetch} from '../scripts/pdf-store/store-lib.mjs';

const bytes=name=>new Uint8Array(Buffer.from(`%PDF-1.4\n% ${name}\n%%EOF`,'latin1'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
/* Datei mit `pages` Seiten ohne Textebene ablegen; drop: danach verdrängen (nur noch Text); main: Hauptdokument statt übriges PDF */
function file(store,name,{drop=false,main=false,pages=1}={}){
 const b=bytes(name),url='https://x.test/'+name;
 store.put(url,b,{role:main?null:'other'});
 const s=sha(b);store.putText(s,['Seite eins mit Text.',...Array(pages).fill('')],{method:'text',version:1,ocrNeeded:pages});
 if(drop)store.dropPdf(s);
 return {b,s,url};
}
const queue=store=>store.ocrQueue().map(x=>x.sha);
/* read wie ocrFile: Seite ergänzen, ocr_needed auf 0; merkt sich, ob die Datei beim Lesen da war */
const reader=store=>{const seen=[];return {seen,read:async s=>{seen.push(fs.existsSync(store.file(s)));store.putText(s,['Seite eins mit Text.','Seite zwei per OCR.'],{method:'mixed',version:1,ocrPages:1,ocrNeeded:0});return 1;}};};
const withStore=fn=>async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pdf-ocr-'));
 const store=openPdfStore(dir);
 try{await fn(store);}finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
};

test('OCR-Reihe: leichte zuerst, bei gleich vielen Seiten Hauptdokumente vor übrigen und abgelegte vor verdrängten; langsame ans Ende',withStore(async store=>{
 const heavyMain=file(store,'heavy-main',{main:true,pages:3}),lightOther=file(store,'light-other',{drop:true});
 const lightMainGone=file(store,'light-main-gone',{main:true,drop:true}),lightMain=file(store,'light-main',{main:true});
 assert.deepEqual(queue(store),[lightMain.s,lightMainGone.s,lightOther.s,heavyMain.s],'eine Seite vor drei, auch ein übriges PDF vor einem schweren Hauptdokument');
 assert.deepEqual(store.ocrQueue().map(x=>x.main),[true,true,false,true]);
 store.markSlow(lightMain.s);
 assert.deepEqual(queue(store),[lightMainGone.s,lightOther.s,heavyMain.s,lightMain.s],'über der Zeitgrenze: ans Ende');
}));

test('OCR: abgelegte Datei gelesen, verdrängte kurz nachgeladen, gelesen und gleich wieder gelöscht, auch Hauptdokumente',withStore(async store=>{
 const kept=file(store,'kept'),gone=file(store,'gone',{drop:true}),main=file(store,'main',{main:true,drop:true});
 const asked=[],{seen,read}=reader(store);
 const download=async url=>{asked.push(url);const f=[gone,main].find(x=>x.url===url);if(!f)throw Error('unerwartet');return f.b;};
 assert.deepEqual(await ocrWithRefetch(store,kept.s,{download,read}),{pages:1,fetched:false,result:'ok'});
 assert.ok(fs.existsSync(store.file(kept.s)),'abgelegtes PDF bleibt');
 for(const f of [gone,main]){
  assert.deepEqual(await ocrWithRefetch(store,f.s,{download,read}),{pages:1,fetched:true,result:'ok'});
  assert.ok(!fs.existsSync(store.file(f.s)),'nachgeladenes PDF ist danach wieder gelöscht');
  assert.equal(store.entry(f.url).status,'text-only','der Eintrag bleibt „nur Text“, die Grenze sieht die Datei nie');
 }
 assert.deepEqual(asked,[gone.url,main.url],'nur verdrängte Dateien werden geladen');
 assert.deepEqual(seen,[true,true,true],'beim Lesen lag die Datei da');
 assert.deepEqual(queue(store),[],'alles gelesen, nichts mehr offen');
}));

test('OCR: Fehler vermerkt ohne neuen Versuch, geänderte Datei nicht übernommen, ausgelassener Server und Anhalten lassen sie offen',withStore(async store=>{
 const fail=file(store,'fail',{drop:true}),changed=file(store,'changed',{drop:true}),skip=file(store,'skip',{drop:true}),stop=file(store,'stop',{drop:true});
 const {seen,read}=reader(store);
 assert.deepEqual(await ocrWithRefetch(store,fail.s,{download:async()=>{throw Error('HTTP 404');},read}),{pages:0,fetched:false,result:'failed'});
 assert.deepEqual(await ocrWithRefetch(store,changed.s,{download:async()=>bytes('heute anders'),read}),{pages:0,fetched:false,result:'changed'});
 assert.ok(!fs.existsSync(store.file(changed.s))&&!fs.existsSync(store.file(sha(bytes('heute anders')))),'eine andere Datei wird nicht abgelegt');
 assert.deepEqual(await ocrWithRefetch(store,skip.s,{download:async()=>{throw Object.assign(Error('Server ausgelassen'),{skip:true});},read}),{pages:0,fetched:false,result:'skipped'});
 await assert.rejects(ocrWithRefetch(store,stop.s,{download:async()=>{throw Error('abgebrochen');},read,halted:()=>true}),e=>e.halted===true);
 assert.deepEqual(seen,[],'nichts gelesen');
 assert.equal(store.entry(fail.url).status,'text-only','ein Fehlschlag ändert den Eintrag nicht (der Text bleibt)');
 assert.deepEqual(queue(store).sort(),[skip.s,stop.s].sort(),'Fehler und geänderte Dateien kommen nicht wieder, ausgelassene und angehaltene schon');
}));

test('OCR: wird eine Lesung angehalten oder über der Zeitgrenze abgebrochen, ist die nachgeladene Datei trotzdem weg',withStore(async store=>{
 const gone=file(store,'gone',{drop:true});
 for(const err of [{halted:true},{slow:true}]){
  await assert.rejects(ocrWithRefetch(store,gone.s,{download:async()=>gone.b,read:async()=>{throw Object.assign(Error('abgebrochen'),err);}}),e=>e.halted||e.slow);
  assert.ok(!fs.existsSync(store.file(gone.s)));
 }
 assert.deepEqual(queue(store),[gone.s],'bleibt offen für den nächsten Lauf');
}));
