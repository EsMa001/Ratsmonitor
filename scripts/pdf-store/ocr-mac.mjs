// OCR auf dem Mac für PDFs, die der Server nur noch als Text hat: Dateien von der Quelle laden (mehrere gleichzeitig, je Server
// begrenzt), Prüfsumme prüfen, die Seiten ohne Textebene mit dem Tesseract-Programm lesen, die PDF danach löschen. Ergebnis je
// Datei: <out>/<sha>.json mit den Seiten. Einspielen auf dem Server: scripts/pdf-store/ocr-import.mjs.
//   node scripts/pdf-store/ocr-mac.mjs <liste.json> --out <ordner> [--shard 0/1] [--dl 6] [--per-host 3] [--ready 20] [--workers 3]
// liste.json: [{"sha":"…","url":"https://…"}, …]. Laden und Lesen laufen getrennt: Ein Ladepool füllt eine Warteschlange, der
// Leser nimmt eine Datei nach der anderen. Dateien, die nicht laden, bleiben offen (fertige werden beim nächsten Lauf übersprungen).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {getDocumentProxy,renderPageAsImage} from 'unpdf';
import {downloader,readTextLayer,needsOcr,TEXT_VERSION,OCR_SCALE} from './store-lib.mjs';

const run=promisify(execFile);
const TESSERACT=process.env.TESSERACT||'/opt/homebrew/bin/tesseract';
const MAX_PIXELS=12e6;
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:d;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* Seiten ohne Textebene lesen: rendern, Tesseract, workers Seiten gleichzeitig */
async function ocrPages(file,pages,workers){
 const pdf=await getDocumentProxy(new Uint8Array(fs.readFileSync(file)),{isEvalSupported:false,verbosity:0});
 const want=pages.map((p,i)=>needsOcr(p)?i:-1).filter(i=>i>=0);
 const out=[...pages];
 try{
  for(let k=0;k<want.length;k+=workers){
   await Promise.all(want.slice(k,k+workers).map(async i=>{
    const page=await pdf.getPage(i+1),v=page.getViewport({scale:1});page.cleanup();
    const scale=Math.max(0.5,Math.min(OCR_SCALE,Math.sqrt(MAX_PIXELS/Math.max(1,v.width*v.height))));
    const png=Buffer.from(await renderPageAsImage(pdf,i+1,{scale,canvasImport:()=>import(process.env.OCR_CANVAS||'/Users/nico/code/video-tools/node_modules/@napi-rs/canvas/index.js')}));
    const img=file+`-s${i}.png`;fs.writeFileSync(img,png);
    try{const {stdout}=await run(TESSERACT,[img,'-','-l','deu'],{maxBuffer:64*1048576});out[i]=stdout;}
    finally{fs.rmSync(img,{force:true});}
   }));
  }
 }finally{await pdf.destroy?.();}
 return {pages:out,ocrPages:want.length};
}

const list=JSON.parse(fs.readFileSync(args[0],'utf8'));
const out=opt('out'),[shardI,shardN]=String(opt('shard','0/1')).split('/').map(Number);
const dl=Number(opt('dl',6)),perHost=Number(opt('per-host',3)),cap=Number(opt('ready',20)),workers=Number(opt('workers',3));
if(!out){console.error('--out <ordner> fehlt');process.exit(1);}
if(!fs.existsSync(TESSERACT)){console.error(`Tesseract fehlt: ${TESSERACT}`);process.exit(1);}
fs.mkdirSync(out,{recursive:true});
const work=fs.mkdtempSync(path.join(os.tmpdir(),'ocr-mac-'));
const get=downloader({timeoutMs:Number(opt('timeout-ms',10000))});

const todo=list.filter((_,i)=>i%shardN===shardI).filter(x=>!fs.existsSync(path.join(out,x.sha+'.json')));
const res={ok:0,changed:0,failed:0,skipped:list.length-todo.length,dl:[]};
const hostCount=new Map();
const hostOf=u=>{try{return new URL(u).host;}catch{return 'x';}};

/* Ladepool: höchstens dl gleichzeitig, je Server höchstens perHost, höchstens cap fertige Dateien warten */
const ready=[];let next=0,active=0;
const fetchOne=async item=>{
 const h=hostOf(item.url);
 while((hostCount.get(h)||0)>=perHost)await sleep(50);
 hostCount.set(h,(hostCount.get(h)||0)+1);
 const t0=Date.now();
 try{const bytes=await get(item.url);return {item,bytes,ms:Date.now()-t0};}
 catch(e){return {item,error:e.message,ms:Date.now()-t0};}
 finally{hostCount.set(h,hostCount.get(h)-1);}
};
const pump=(async()=>{
 while(next<todo.length){
  if(active>=dl||ready.length+active>=cap){await sleep(50);continue;}
  const item=todo[next++];active++;
  fetchOne(item).then(r=>{active--;ready.push(r);});
 }
 while(active>0)await sleep(50);
})();

/* Leser: eine Datei nach der anderen */
let done=0;
while(true){
 if(ready.length===0){if(next>=todo.length&&active===0)break;await sleep(50);continue;}
 const r=ready.shift();const {sha,url}=r.item;
 res.dl.push(r.ms);
 if(r.error){res.failed++;console.log(`Fehler ${sha.slice(0,12)}: ${r.error}`);continue;}
 if(crypto.createHash('sha256').update(r.bytes).digest('hex')!==sha){res.changed++;console.log(`geändert: ${sha.slice(0,12)}`);continue;}
 const tmp=path.join(work,sha+'.pdf');
 try{
  fs.writeFileSync(tmp,r.bytes);
  let layer=null;
  await readTextLayer({file:()=>tmp,putText:(_s,pages)=>{layer=pages;}},sha);
  const o=await ocrPages(tmp,layer,workers);
  const method=o.ocrPages===0?'text':o.ocrPages===layer.length?'ocr':'mixed';
  fs.writeFileSync(path.join(out,sha+'.json'),JSON.stringify({sha,url,version:TEXT_VERSION,pages:o.pages,method,ocrPages:o.ocrPages}));
  res.ok++;console.log(`ok ${sha.slice(0,12)} ${o.pages.length} Seiten, ${o.ocrPages} per OCR`);
 }catch(e){res.failed++;console.log(`Fehler ${sha.slice(0,12)}: ${e.message}`);}
 finally{fs.rmSync(tmp,{force:true});}
 done++;
}
await pump;
fs.rmSync(work,{recursive:true,force:true});
const avg=res.dl.length?Math.round(res.dl.reduce((a,b)=>a+b,0)/res.dl.length):0;
const p90=res.dl.length?[...res.dl].sort((a,b)=>a-b)[Math.floor(res.dl.length*0.9)]:0;
console.log(`fertig: ${res.ok} ok, ${res.changed} geändert, ${res.failed} Fehler, ${res.skipped} schon fertig; Laden Ø ${avg} ms, 90 % unter ${p90} ms`);
