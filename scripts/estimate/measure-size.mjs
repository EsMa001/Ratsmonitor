// Step 4 of the measured estimate: how large are the documents of a report?
// Draws a reproducible sample of reports with documents from every area with a year of stock (the local database
// for NRW, tmp/sample/year for the sample outside NRW), downloads their public documents once and keeps only
// figures: bytes, pages, characters, tokens, whether the file has a text layer. No text is stored, nothing is
// written to the database.
// Run: TOKENIZER_DIR=<folder with node_modules of @anthropic-ai/tokenizer and gpt-tokenizer> node scripts/estimate/measure-size.mjs [reports per area, default 12]
// Output: tmp/size/documents.jsonl (one line per document, also the cache for interrupted runs), tmp/size/measured.json
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {extractText,getDocumentProxy} from 'unpdf';
import {areaClass} from '../../shared/estimate.mjs';
import {rangeStart} from '../../shared/timeline.mjs';
import {documentType,primaryDocument} from '../../shared/document-type.mjs';
import {SOURCE_USER_AGENT} from '../../server/integrations/no-redirect.mjs';
const PER_AREA=Number(process.argv[2]||12),MAX_BYTES=12e6,MAX_DOCUMENTS=20,to=process.env.TO||new Date().toISOString().slice(0,10),from=rangeStart('12m',to,new Map());
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),out='tmp/size/';fs.mkdirSync(out,{recursive:true});
// Token counters are optional and live outside the project: the legacy Claude tokenizer and, for comparison, o200k.
let claudeTokens=null,otherTokens=null;
if(process.env.TOKENIZER_DIR){const require=createRequire(path.join(path.resolve(process.env.TOKENIZER_DIR),'package.json'));claudeTokens=require('@anthropic-ai/tokenizer').countTokens;const o200k=require('gpt-tokenizer/encoding/o200k_base');otherTokens=text=>o200k.encode(text).length;}
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return h>>>0;};
const isPdf=d=>d.kind==='application/pdf'||d.kind==='pdf';
// --- areas and their complete report lists of the period ---
const areas=[];
const regions=read('shared/nrw-regions.json'),population=read('shared/nrw-population.json');
const dbDir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/',db=new DatabaseSync(dbDir+fs.readdirSync(dbDir).find(f=>f.endsWith('.sqlite')),{readOnly:true});
const byArea=new Map();
for(const row of db.prepare("SELECT id,region_id AS area,json_extract(payload,'$.events') AS events,json_extract(payload,'$.documents') AS documents FROM topics WHERE json_extract(payload,'$.identity.mergedInto') IS NULL").all()){
 const day=JSON.parse(row.events||'[]').map(e=>String(e.date||'').slice(0,10)).filter(Boolean).sort()[0];
 if(!day||day<from||day>to)continue;
 byArea.set(row.area,[...(byArea.get(row.area)||[]),{id:row.id,documents:JSON.parse(row.documents||'[]').filter(isPdf).map(d=>({url:d.url,title:String(d.title||'')}))}]);
}
db.close();
for(const region of regions)if(byArea.has(region.id))areas.push({id:region.id,name:region.name,level:region.kind==='district'?'district':'municipality',state:'05',population:population[region.id],external:false,reports:byArea.get(region.id)});
if(fs.existsSync('tmp/sample/sources.json')){
 const units=new Map(read('tmp/sample/sources.json').map(u=>[u.id,u]));
 for(const file of fs.readdirSync('tmp/sample/year')){
  const year=read('tmp/sample/year/'+file),unit=units.get(year.id);if(!year.ok||!unit)continue;
  areas.push({id:unit.id,name:unit.name,level:unit.level,state:unit.state,population:unit.population,external:true,reports:year.reports.filter(r=>r.days[0]>=from&&r.days[0]<=to).map(r=>({id:r.id,documents:r.documents.filter(isPdf).map(d=>({url:d.url,title:d.title}))}))});
 }
}
// --- sample: reports with documents, ordered by a hash of their id ---
const picked=[];
for(const area of areas){
 const share=new Map();for(const r of area.reports)for(const url of new Set(r.documents.map(d=>d.url)))share.set(url,(share.get(url)||0)+1);
 area.share=share;area.withDocuments=area.reports.filter(r=>r.documents.length).length;
 area.links=area.reports.reduce((n,r)=>n+r.documents.length,0);area.distinct=share.size;
 area.types={};for(const r of area.reports)for(const d of r.documents){const type=documentType(d.title);area.types[type]=(area.types[type]||0)+1/share.get(d.url);}
 area.sample=area.reports.filter(r=>r.documents.length).sort((a,b)=>fnv(a.id)-fnv(b.id)).slice(0,PER_AREA);
 picked.push(...area.sample.map(report=>({area,report})));
}
console.log(areas.length,'Gebiete,',picked.length,'Berichte in der Stichprobe,',picked.reduce((n,p)=>n+Math.min(MAX_DOCUMENTS,p.report.documents.length),0),'Dokumentabrufe (vor Abzug doppelter); Zeitraum',from,'bis',to);
// --- measuring one document ---
const cacheFile=out+'documents.jsonl',cache=new Map();
if(fs.existsSync(cacheFile))for(const line of fs.readFileSync(cacheFile,'utf8').split('\n'))if(line.trim()){const d=JSON.parse(line);cache.set(d.url,d);}
const pause=()=>new Promise(done=>setTimeout(done,350));
const locks=new Map();const withHost=(url,fn)=>{const host=new URL(url).hostname,prev=locks.get(host)||Promise.resolve(),next=prev.then(pause,pause).then(fn);locks.set(host,next.catch(()=>{}));return next;};
const release=pdf=>pdf.destroy?pdf.destroy():pdf.loadingTask?.destroy?.();
async function download(url){
 const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(90000),headers:{'User-Agent':SOURCE_USER_AGENT}});
 if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status);}
 const declared=Number(r.headers.get('content-length'))||0;
 // Larger than the limit of the pipeline: the size is taken from the header, the file is not loaded.
 if(declared>MAX_BYTES){await r.body?.cancel();return {bytes:declared,large:true};}
 const chunks=[];let size=0;
 for await(const chunk of r.body){size+=chunk.byteLength;if(size>MAX_BYTES){await r.body.cancel().catch(()=>{});return {bytes:Math.max(declared,size),large:true};}chunks.push(chunk);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
 return {bytes:size,data:bytes};
}
async function measure(url){
 const file=await download(url);if(file.large)return {bytes:file.bytes,large:true};
 const head=new TextDecoder('latin1').decode(file.data.subarray(0,1024));
 if(!head.includes('%PDF'))return {bytes:file.bytes,format:/<html|<!doctype/i.test(head)?'html':'other'};
 const pdf=await getDocumentProxy(file.data,{isEvalSupported:false});
 try{
  const {text}=await extractText(pdf,{mergePages:false}),pages=text.map(page=>page.replace(/\s+/g,' ').trim()),joined=pages.join('\n'),chars=joined.length;
  // A page without a text layer is a scan (or a drawing): its content is only readable as an image.
  return {bytes:file.bytes,format:'pdf',pages:pdf.numPages,chars,scanPages:pages.filter(page=>page.length<50).length,tokens:claudeTokens?claudeTokens(joined):null,tokensOther:otherTokens?otherTokens(joined):null};
 }finally{await release(pdf);}
}
const pending=new Map();
const measured=url=>{
 if(cache.has(url))return Promise.resolve(cache.get(url));
 if(!pending.has(url))pending.set(url,withHost(url,()=>measure(url)).catch(e=>({error:String(e.message).slice(0,80)})).then(result=>{const row={url,...result};cache.set(url,row);fs.appendFileSync(cacheFile,JSON.stringify(row)+'\n');return row;}));
 return pending.get(url);
};
// --- run ---
const keepAlive=setInterval(()=>{},1000),queue=[...picked],rows=[];let done=0;
await Promise.all(Array.from({length:10},async()=>{for(let item;(item=queue.shift());){
 const {area,report}=item,unique=[...new Map(report.documents.map(d=>[d.url,d])).values()],tried=unique.slice(0,MAX_DOCUMENTS),documents=[];
 for(const d of tried){const m=await measured(d.url);documents.push({type:documentType(d.title),share:area.share.get(d.url),primary:primaryDocument(unique)===d,...m,url:undefined});}
 rows.push({area:area.id,linked:unique.length,documents});
 if(++done%50===0)console.log(done+'/'+picked.length);
}}));
clearInterval(keepAlive);
fs.writeFileSync(out+'measured.json',JSON.stringify({from,to,measuredAt:new Date().toISOString().slice(0,10),tokenizer:claudeTokens?'@anthropic-ai/tokenizer':null,perArea:PER_AREA,maxBytes:MAX_BYTES,
 areas:areas.map(a=>({id:a.id,name:a.name,level:a.level,state:a.state,population:a.population,class:areaClass(a),external:a.external,reports:a.reports.length,withDocuments:a.withDocuments,links:a.links,distinct:a.distinct,types:a.types})),reports:rows}));
const all=rows.flatMap(r=>r.documents),errors={};for(const d of all.filter(d=>d.error))errors[d.error]=(errors[d.error]||0)+1;
console.log('Dokumente',all.length,'| gelesen',all.filter(d=>d.format==='pdf').length,'| größer als 12 MB',all.filter(d=>d.large).length,'| kein PDF',all.filter(d=>d.format&&d.format!=='pdf').length,'| Fehler',all.filter(d=>d.error).length,JSON.stringify(errors));
