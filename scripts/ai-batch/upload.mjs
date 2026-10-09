// Übernimmt Ergebnisse über die lokale Adminseite (POST /api/admin/ai-job, action apply), wie „Ergebnisse prüfen & speichern“:
// Pakete mit höchstens 100 Artikeln und 2,9 MB, laufender Dev-Server, gemeinsame Importsperre, keine Datenbankkopie.
// node scripts/ai-batch/upload.mjs <auftrag.json> [--only-model] [--limit N] [--base http://localhost:5173]
// Quittungen je Paket in <Laufordner>/upload-receipts.json; eine Wiederholung mit derselben Datei erzeugt keine Doppelanalysen.
import fs from 'node:fs';
import path from 'node:path';
import {loadJob,runDir,readJson,writeJson} from './lib.mjs';

const args=process.argv.slice(2),opt=n=>{const i=args.indexOf('--'+n);return i<0?null:args[i+1]??true;};
const job=loadJob(args[0]),dir=runDir(job),base=opt('base')||'http://localhost:5173';
const RULES='regelbasierte Vorprüfung (scripts/ai-batch)';
let articles=[];
for(const f of fs.readdirSync(path.join(dir,'results')).filter(f=>/^ergebnisse-\d+\.json$/.test(f)).sort())articles.push(...readJson(path.join(dir,'results',f)).articles);
if(opt('only-model'))articles=articles.filter(a=>a.agent!==RULES);
const receiptsFile=path.join(dir,'upload-receipts.json'),receipts=readJson(receiptsFile)||[];
const done=new Set(receipts.flatMap(r=>r.ok?r.ids:[]));
articles=articles.filter(a=>!done.has(a.id));
if(opt('limit'))articles=articles.slice(0,Number(opt('limit')));
// Pakete: höchstens 100 Artikel und 2,9 MB Anfrage.
const packs=[];let cur=[];
const size=list=>Buffer.byteLength(JSON.stringify({action:'apply',result:{format:'ratsmonitor-ai-results-v1',jobId:job.id,articles:list}}));
for(const a of articles){if(cur.length&&(cur.length>=100||size([...cur,a])>2_900_000)){packs.push(cur);cur=[];}cur.push(a);}
if(cur.length)packs.push(cur);
console.log(`${articles.length} Artikel in ${packs.length} Paketen an ${base}`);
const totals={};
for(const [k,list] of packs.entries()){
 const body=JSON.stringify({action:'apply',result:{format:'ratsmonitor-ai-results-v1',jobId:job.id,articles:list}});
 let r,text;
 for(let attempt=1;attempt<=5;attempt++){
  try{r=await fetch(base+'/api/admin/ai-job',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:'__sites_local_auth=1'},body,signal:AbortSignal.timeout(600000)});text=await r.text();}
  catch(e){r=null;text=e.message;}
  // Importsperre oder kurzer Serverfehler: warten und erneut (die Übernahme ist wiederholbar).
  if(r&&(r.ok||r.status<500&&r.status!==409&&r.status!==423))break;
  console.log(`Paket ${k+1}: ${r?.status??'Netz'} ${String(text).slice(0,160)} – Versuch ${attempt}, warte 20 s`);
  await new Promise(res=>setTimeout(res,20000));
 }
 let json=null;try{json=JSON.parse(text);}catch{}
 const entry={pack:k+1,at:new Date().toISOString(),status:r?.status??null,ok:!!r?.ok,ids:list.map(a=>a.id),receipt:json??String(text).slice(0,500)};
 receipts.push(entry);writeJson(receiptsFile,receipts);
 if(!r?.ok){console.log(`Paket ${k+1}: FEHLER ${r?.status} ${String(text).slice(0,300)}`);break;}
 for(const [key,v] of Object.entries(json||{}))if(typeof v==='number')totals[key]=(totals[key]||0)+v;else if(Array.isArray(v))totals[key]=(totals[key]||0)+v.length;
 console.log(`Paket ${k+1}/${packs.length}: ${JSON.stringify(json).slice(0,200)}`);
}
console.log('Summe',JSON.stringify(totals));
