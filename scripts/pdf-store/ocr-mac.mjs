// OCR auf dem Mac für PDFs, die der Server nur noch als Text hat: je Datei von der Quelle laden, Prüfsumme prüfen, die Seiten
// ohne Textebene per OCR lesen, die PDF sofort wieder löschen. Ergebnis je Datei: <out>/<sha>.json mit den Seiten (wie
// text.mjs sie speichert). Einspielen auf dem Server: scripts/pdf-store/ocr-import.mjs.
//   node scripts/pdf-store/ocr-mac.mjs <liste.json> --out <ordner> [--workers 3] [--timeout-ms 10000]
// liste.json: [{"sha":"…","url":"https://…"}, …] (Adressen aus der Ablage, Prüfsumme = SHA-256 der PDF).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {downloader,ocrScheduler,readTextLayer,ocrFile,TEXT_VERSION} from './store-lib.mjs';

const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:d;};
const list=JSON.parse(fs.readFileSync(args[0],'utf8'));
const out=opt('out'),workers=Number(opt('workers',3)),timeoutMs=Number(opt('timeout-ms',10000));
if(!out){console.error('--out <ordner> fehlt');process.exit(1);}
fs.mkdirSync(out,{recursive:true});
const work=fs.mkdtempSync(path.join(os.tmpdir(),'ocr-mac-'));
const get=downloader({timeoutMs});
const ocr=await ocrScheduler(workers);
if(!ocr){console.error('OCR-Werkzeuge fehlen (OCR_TOOLS, Standard ~/code/video-tools).');process.exit(1);}

const res={ok:0,changed:0,failed:0};
for(const {sha,url} of list){
 const tmp=path.join(work,sha+'.pdf');
 try{
  const bytes=await get(url);
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==sha){res.changed++;console.log(`geändert: ${sha.slice(0,12)}`);continue;}
  fs.writeFileSync(tmp,bytes);
  // Eine Ablage-Attrappe mit genau den Funktionen, die ocrFile und readTextLayer brauchen
  // readTextLayer legt die Textebene per putText ab; ocrFile liest sie per textPages und legt das Ergebnis wieder per putText ab
  let layer=null,saved=null;
  const store={file:()=>tmp,textPages:()=>layer,putText:(_s,pages,meta)=>{if(meta.method==='text')layer=pages;else saved={pages,...meta};}};
  await readTextLayer(store,sha);
  await ocrFile(store,sha,ocr,{});
  if(!saved)throw new Error('kein Ergebnis');
  fs.writeFileSync(path.join(out,sha+'.json'),JSON.stringify({sha,url,version:TEXT_VERSION,pages:saved.pages,method:saved.method,ocrPages:saved.ocrPages}));
  res.ok++;console.log(`ok ${sha.slice(0,12)} ${saved.pages.length} Seiten, ${saved.ocrPages} per OCR`);
 }catch(e){res.failed++;console.log(`Fehler ${sha.slice(0,12)}: ${e.message}`);}
 finally{fs.rmSync(tmp,{force:true});}
}
await ocr.terminate();
fs.rmSync(work,{recursive:true,force:true});
console.log(`fertig: ${res.ok} ok, ${res.changed} geändert, ${res.failed} Fehler`);
