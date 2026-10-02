// Diagnosis: runs every connected source once through the real collector (Node, no database writes).
// node scripts/source-discovery/check-connected.mjs [1w|1m|3m|12m] [output.jsonl] [id,id,…]
import fs from 'node:fs';
import {collectRegion} from '../../server/integrations/collect-region.mjs';
import {NRW_SOURCES} from '../../server/integrations/source-catalog.mjs';
import {SOURCES} from '../../server/integrations/regions.mjs';
const window=process.argv[2]||'1m',out=process.argv[3]||'tmp/source-discovery/configured.jsonl';
const all=[{id:'muenster',name:'Stadt Münster',method:'oparl',system:'https://oparl.stadt-muenster.de/system'},...SOURCES.map(s=>({...s,method:s.extension?'scraper':'official-api'})),...NRW_SOURCES].filter(s=>s.method!=='pending');
const only=process.argv[4]?new Set(process.argv[4].split(',')):null;
const list=all.filter(s=>!only||only.has(s.id));
const groups=new Map();for(const s of list){const host=new URL(s.system||s.base).hostname;groups.set(host,[...(groups.get(host)||[]),s]);}
fs.mkdirSync('tmp/source-discovery',{recursive:true});fs.writeFileSync(out,'');const queue=[...groups.values()];let done=0;
// AbortSignal.timeout uses an unreferenced timer; without this interval Node may exit while requests are still pending.
const keepAlive=setInterval(()=>{},1000);
await Promise.all(Array.from({length:8},async()=>{for(let g;(g=queue.shift());)for(const s of g){
 const t0=Date.now();let row={id:s.id,name:s.name,method:s.method,url:s.system||s.base};
 try{const d=await collectRegion(s.id,{maxDurationMs:120000,window});row={...row,ok:true,topics:d.topics.length,meetings:d.coverage.meetings,complete:d.coverage.complete,quiet:d.coverage.quiet,listStrategy:d.coverage.listStrategy,issues:[...new Set(d.coverage.issues)].slice(0,6)};}
 catch(e){row={...row,ok:false,error:String(e.message).slice(0,200),cause:String(e.cause?.code||e.cause?.message||'').slice(0,120)};}
 row.seconds=Math.round((Date.now()-t0)/1000);fs.appendFileSync(out,JSON.stringify(row)+'\n');console.log(++done+'/'+list.length,row.ok?'OK ':'ERR',row.name,row.ok?row.topics+' Artikel':row.error,row.seconds+'s');
}}));
clearInterval(keepAlive);
