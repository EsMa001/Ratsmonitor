// Stage 1d: tenants of council platforms with one host name per municipality that no municipal website links
// (digitalfabriX in Bavaria, sitzung-mv.de in Mecklenburg-Vorpommern, itebo in Lower Saxony; HOSTED in rules.mjs).
// digitalfabriX and sitzung-mv.de answer DNS for any name, so only the page decides: it is kept as a candidate if it
// shows a council system and names the area in its title or text. The name has to be unique among the areas of the
// state, as in guess-platforms.mjs. verify.mjs then checks the system and its public agenda items as for every link.
// Each platform is one operator: one request at a time and at most one per second, robots.txt of every host first,
// no retries, our own name in the User-Agent. Resumable: areas in the output file are not asked again.
// Run: LAND=09 DIR=tmp/source-discovery-de/ node scripts/source-discovery/guess-hosted.mjs
//      CANDIDATES=candidates-hosted.json OUT=verified-hosted.json LAND=09 DIR=… node scripts/source-discovery/verify.mjs
import fs from 'node:fs';
import dns from 'node:dns/promises';
import {loadAreas,skipReason} from './areas.mjs';
import {HOSTED,hostSlugs,pageNamesArea} from './rules.mjs';
import {robotsVerdict} from '../../server/integrations/robots.mjs';
import {NRW_SOURCES} from '../../server/integrations/source-catalog.mjs';
const dir=process.env.DIR||'tmp/source-discovery/';
const outFile=dir+(process.env.OUT||'candidates-hosted.json');
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const TOKENS=['vorort-politicaltopics','ratsmonitor-sourcecatalog'];
const SPACING=Number(process.env.SPACING_MS)||1000;
const regions=loadAreas(),connected=new Set(NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>s.id));
const done=fs.existsSync(outFile)?JSON.parse(fs.readFileSync(outFile,'utf8')):{};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let last=0;
async function get(url){
 const wait=last+SPACING-Date.now();if(wait>0)await sleep(wait);last=Date.now();
 try{const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'User-Agent':UA,Accept:'text/html'}});
  const body=r.ok?new TextDecoder('utf-8').decode((await r.arrayBuffer()).slice(0,800000)):(await r.body?.cancel(),'');
  return {status:r.status,url:r.url,body};}
 catch(e){return {status:0,url,body:'',error:e.cause?.code||e.message};}
}
const robots=new Map();
async function allowed(url){
 const u=new URL(url);
 if(!robots.has(u.origin)){const r=await get(u.origin+'/robots.txt');robots.set(u.origin,{status:r.status,text:r.body});}
 const {status,text}=robots.get(u.origin);
 return ['erlaubt','keine'].includes(robotsVerdict(status,text,u.pathname,TOKENS));
}
let found=0,refused=0,asked=0;
for(const p of HOSTED){
 const inLand=regions.filter(r=>r.ags.startsWith(p.land));
 // A label that two areas of the state share never counts: the host could belong to either.
 const owners=new Map();for(const r of inLand)for(const s of hostSlugs(r.shortName||r.name))owners.set(s,[...(owners.get(s)||[]),r.id]);
 const queue=inLand.filter(r=>!connected.has(r.id)&&!skipReason(r)&&!done[r.id]);
 console.log(`${p.name}: ${queue.length} offene Gebiete`);
 for(const r of queue){
  const row={id:r.id,name:r.name,kind:r.kind,ags:r.ags,sites:[],candidates:[],log:[]};
  for(const slug of hostSlugs(r.shortName||r.name)){
   if(owners.get(slug)?.length>1){row.log.push(slug+': Name im Land mehrdeutig');continue;}
   for(const host of p.hosts(slug)){
    if(!p.wildcard){try{await dns.resolve4(host);}catch{continue;}}
    const url=`https://${host}${p.path}`;
    if(!(await allowed(url))){refused++;row.log.push(url+': robots.txt untersagt den Abruf');continue;}
    const page=await get(url);asked++;row.log.push(url+' '+(page.status||page.error));
    if(page.status===200&&/sessionnet|si0040|allris|sitzungsdienst|bürgerinfo|buergerinfo/i.test(page.body)&&pageNamesArea(page.body,r)){
     row.candidates.push({url:page.url,from:host,byHref:true,guessed:`${p.name}-Adresse, Seite nennt das Gebiet`});found++;break;
    }
   }
   if(row.candidates.length)break;
  }
  done[r.id]=row;
  if(Object.keys(done).length%20===0)fs.writeFileSync(outFile,JSON.stringify(done,null,1));
  if(row.candidates.length)console.log(' +',r.name,'→',row.candidates[0].url);
 }
}
fs.writeFileSync(outFile,JSON.stringify(done,null,1));
console.log(`${found} Kandidaten, ${asked} Seiten gefragt, ${refused} Adressen per robots.txt ausgeschlossen; Kandidaten in ${outFile}`);
