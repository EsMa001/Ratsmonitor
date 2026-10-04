// Records for every connected source whether its robots.txt allows the path our readers fetch, in
// server/integrations/source-robots.json. One request for /robots.txt per host, at most two at a time per server
// group (source-servers.mjs), with the user agent of the imports. Nothing else is fetched.
// Run after the catalog changed: node scripts/source-discovery/robots.mjs
import fs from 'node:fs';
import {NRW_SOURCES} from '../../server/integrations/source-catalog.mjs';
import {SOURCES} from '../../server/integrations/regions.mjs';
import {serverOf,MUENSTER} from '../../server/integrations/source-servers.mjs';
import {SOURCE_USER_AGENT} from '../../server/integrations/no-redirect.mjs';
import {robotsVerdict} from '../../server/integrations/robots.mjs';
// Product tokens of the import and of the source search.
const TOKENS=['vorort-politicaltopics','ratsmonitor-sourcecatalog'];
// The path a reader asks for: More! Rubin reads api.php next to its base, the others the base or OParl system address.
export const readPath=source=>{const u=new URL(source.system||source.base);return source.adapter==='more-rubin'?u.pathname.replace(/[^/]*$/,'')+'api.php':u.pathname||'/';};
const sources=[...SOURCES,...NRW_SOURCES.filter(s=>s.method!=='pending'),MUENSTER];
const file='server/integrations/source-robots.json',previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).sources:{};
// ONLY_NEW=1 asks only the hosts of sources without a verdict (after build.mjs added sources); all others keep theirs.
const asked=s=>!process.env.ONLY_NEW||!previous[s.id];
const origins=new Map();
for(const s of sources.filter(asked)){let u;try{u=new URL(s.system||s.base);}catch{continue;}if(!origins.has(u.origin))origins.set(u.origin,{origin:u.origin,server:serverOf(u.origin+'/')||u.origin});}
// Platforms such as komm.one give every municipality its own host; at least GAP between two requests to one server
// keeps their 160 robots.txt from arriving as a burst (komm.one blocked the network after discovery traffic).
const GAP=1000;
const answers={},busy=new Map(),nextAt=new Map(),queue=[...origins.values()];
const keepAlive=setInterval(()=>{},1000);
await Promise.all(Array.from({length:16},async()=>{for(let o;(o=queue.shift());){
 if((busy.get(o.server)||0)>=2||(nextAt.get(o.server)||0)>Date.now()){queue.push(o);await new Promise(d=>setTimeout(d,200));continue;}
 busy.set(o.server,(busy.get(o.server)||0)+1);nextAt.set(o.server,Date.now()+GAP);
 try{const r=await fetch(o.origin+'/robots.txt',{headers:{'User-Agent':SOURCE_USER_AGENT},signal:AbortSignal.timeout(15000)});answers[o.origin]={status:r.status,text:r.ok?(await r.text()).slice(0,20000):''};}
 catch{answers[o.origin]={status:0,text:''};}
 finally{busy.set(o.server,busy.get(o.server)-1);}
}}));
clearInterval(keepAlive);
// A host that does not answer this time keeps the verdict of the last run: a passing failure changes nothing known.
const verdicts={};
for(const s of sources){let u;try{u=new URL(s.system||s.base);}catch{continue;}const a=answers[u.origin];if(!a){if(previous[s.id])verdicts[s.id]=previous[s.id];continue;}const v=robotsVerdict(a.status,a.text,readPath(s),TOKENS);verdicts[s.id]=v==='unklar'&&previous[s.id]&&previous[s.id]!=='unklar'?previous[s.id]:v;}
fs.writeFileSync(file,JSON.stringify({builtAt:new Date().toISOString().slice(0,10),agent:SOURCE_USER_AGENT,sources:Object.fromEntries(Object.entries(verdicts).sort())},null,1)+'\n');
const count={};for(const v of Object.values(verdicts))count[v]=(count[v]||0)+1;
console.log(`${Object.keys(verdicts).length} Quellen auf ${origins.size} Rechnern: ${Object.entries(count).map(([k,n])=>n+' '+k).join(', ')}`);
