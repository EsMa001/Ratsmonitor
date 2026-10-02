// Step 3 of the measured estimate: read twelve months from every sample unit with a verified source and keep
// only the figures needed for the estimate. Nothing is written to the database.
// Input:  tmp/sample/sources.json (from scripts/estimate/units.mjs)
// Output: tmp/sample/year/<id>.json per unit (reports with their meeting days and document links)
// Run: node scripts/estimate/count-year.mjs [id,id,…]      An interrupted run continues where it stopped.
import fs from 'node:fs';
import {collectSessionNet,fetchText} from '../../server/integrations/sessionnet.mjs';
import {collectRegionalOparl} from '../../server/integrations/oparl-regional.mjs';
import {collectRubin} from '../../server/integrations/more-rubin.mjs';
import {collectSdnet} from '../../server/integrations/sdnet.mjs';
import {SOURCE_USER_AGENT} from '../../server/integrations/no-redirect.mjs';
const dir=process.env.DIR||'tmp/sample/',out=dir+'year/';fs.mkdirSync(out,{recursive:true});
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sources=read(dir+'sources.json').filter(r=>r.source),only=process.argv[2]?new Set(process.argv[2].split(',')):null;
// Twenty minutes per unit: a year of a large city needs several hundred requests.
const BUDGET=Number(process.env.BUDGET||1200000);
const collect=source=>source.method==='oparl'?collectRegionalOparl(source,{window:'12m',maxDurationMs:BUDGET,maxRequests:8000,maxPages:80})
 :source.adapter==='more-rubin'?collectRubin(source,{window:'12m',maxDurationMs:BUDGET})
 :source.adapter==='sdnet'?collectSdnet(source,{window:'12m',maxDurationMs:BUDGET,maxListPages:200})
 :collectSessionNet(source,{window:'12m',maxDurationMs:BUDGET});
const json=async url=>{const r=await fetch(url,{headers:{'User-Agent':SOURCE_USER_AGENT,Accept:'application/json'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();};
// An association's system holds one body per member municipality: read them all and add them up.
// SessionNet separates them by the calendar parameter __cpanr; without it only the association's own body is listed.
async function collectAll(source,level){
 if(level==='association'&&source.method==='scraper'&&!source.adapter){
  const tenants=[...new Set([...(await fetchText(source.base+'si0040.'+source.extension,source)).matchAll(/__cpanr=([0-9]+)/g)].map(m=>m[1]))];
  if(tenants.length>1){const runs=[];for(const tenant of tenants)try{runs.push(await collectSessionNet(source,{window:'12m',maxDurationMs:BUDGET,get:(url,options)=>fetchText(url.includes('si0040.')?url+'&__cpanr='+tenant:url,options)}));}catch(e){runs.push({topics:[],coverage:{meetings:0,complete:false,issues:['Körperschaft '+tenant+': '+e.message]}});}return runs;}
 }
 if(!source.allBodies)return [await collect(source)];
 const system=await json(source.system),list=await json(system.body),bodies=(Array.isArray(list)?list:list.data)||[],runs=[];
 for(const body of bodies)try{runs.push(await collect({...source,body:body.id}));}catch(e){runs.push({topics:[],coverage:{meetings:0,complete:false,issues:['Körperschaft '+(body.shortName||body.name||'')+': '+e.message]}});}
 return runs;
}
const todo=sources.filter(r=>only?only.has(r.id):!fs.existsSync(out+r.id+'.json'));
// One unit at a time per host; hosts in parallel.
const groups=new Map();for(const r of todo){const host=new URL(r.source.system||r.source.base).hostname;groups.set(host,[...(groups.get(host)||[]),r]);}
const queue=[...groups.values()],keepAlive=setInterval(()=>{},1000);let done=0;
console.log(todo.length,'Einheiten,',groups.size,'Server');
await Promise.all(Array.from({length:6},async()=>{for(let group;(group=queue.shift());)for(const r of group){
 const source=r.source,t0=Date.now();let row={id:r.id,name:r.name,method:source.adapter||source.method,address:source.system||source.base};
 try{
  const runs=await collectAll(source,r.level),issues={},reports=new Map();
  // Issues by kind (addresses removed), with their number: the estimate needs to know whether a list was cut short.
  for(const d of runs)for(const issue of d.coverage.issues||[]){const kind=String(issue).replace(/https?:\S+/g,'…').slice(0,120);issues[kind]=(issues[kind]||0)+1;}
  for(const d of runs)for(const t of d.topics)if(!reports.has(t.id))reports.set(t.id,{id:t.id,days:[...new Set(t.events.map(e=>String(e.date).slice(0,10)))].sort(),results:t.events.filter(e=>e.result).length,documents:t.documents.filter(x=>x.kind!=='html'&&x.kind!=='oparl').map(x=>({url:x.url,title:String(x.title||'').slice(0,140),kind:x.kind}))});
  row={...row,ok:true,seconds:Math.round((Date.now()-t0)/1000),bodies:runs.length,meetings:runs.reduce((n,d)=>n+(d.coverage.meetings||0),0),complete:runs.every(d=>d.coverage.complete),listStrategy:runs[0]?.coverage.listStrategy||null,issues,reports:[...reports.values()]};
 }catch(e){row={...row,ok:false,seconds:Math.round((Date.now()-t0)/1000),error:String(e.message).slice(0,200)};}
 fs.writeFileSync(out+r.id+'.json',JSON.stringify(row));
 console.log(++done+'/'+todo.length,row.ok?'OK ':'ERR',r.name,row.ok?`${row.reports.length} Berichte, ${row.meetings} Sitzungen, ${row.seconds}s`:row.error);
}}));
clearInterval(keepAlive);
