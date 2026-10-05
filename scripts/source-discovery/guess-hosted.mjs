// Stage 1d: tenants of council platforms with one host name per municipality that no municipal website links
// (digitalfabriX in Bavaria, sitzung-mv.de in Mecklenburg-Vorpommern, itebo in Lower Saxony; HOSTED in rules.mjs).
// digitalfabriX and sitzung-mv.de answer DNS for any name, so only the page decides: it is kept as a candidate if it
// shows a council system and names the area in its title or text. The name has to be unique among the areas of the
// state, as in guess-platforms.mjs. verify.mjs then checks the system and its public agenda items as for every link.
// Each platform is one operator: one request at a time and at most one per second, no retries, our own name in the
// User-Agent; after HTTP 401, 403 or 429 the platform is not asked again in this run. robots.txt is recorded, not obeyed (server/integrations/robots-policy.mjs); with ROBOTS_POLICY=obey
// robots.txt of every host is read first and a disallowed path is not asked. Resumable: areas in the output file are
// not asked again.
// Run: LAND=09 DIR=tmp/source-discovery-de/ node scripts/source-discovery/guess-hosted.mjs
//      CANDIDATES=candidates-hosted.json OUT=verified-hosted.json LAND=09 DIR=… node scripts/source-discovery/verify.mjs
import fs from 'node:fs';
import dns from 'node:dns/promises';
import {loadAreas,skipReason} from './areas.mjs';
import {HOSTED,hostSlugs,pageNamesArea} from './rules.mjs';
import {robotsVerdict} from '../../server/integrations/robots.mjs';
import {obeyRobots} from '../../server/integrations/robots-policy.mjs';
import {NRW_SOURCES} from '../../server/integrations/source-catalog.mjs';
import {CATALOG} from '../../shared/catalog.mjs';
import {detectKic} from '../../server/integrations/kic.mjs';
import {fetchText} from '../../server/integrations/sessionnet.mjs';
const dir=process.env.DIR||'tmp/source-discovery/';
const outFile=dir+(process.env.OUT||'candidates-hosted.json');
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const TOKENS=['vorort-politicaltopics','ratsmonitor-sourcecatalog'];
const SPACING=Number(process.env.SPACING_MS)||1000;
const regions=loadAreas(),connected=new Set(NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>s.id));
const done=fs.existsSync(outFile)?JSON.parse(fs.readFileSync(outFile,'utf8')):{};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let last=0;
async function get(url,{manual=false}={}){
 const wait=last+SPACING-Date.now();if(wait>0)await sleep(wait);last=Date.now();
 try{const r=await fetch(url,{redirect:manual?'manual':'follow',signal:AbortSignal.timeout(15000),headers:{'User-Agent':UA,Accept:'text/html'}});
  const body=r.ok?new TextDecoder('utf-8').decode((await r.arrayBuffer()).slice(0,800000)):(await r.body?.cancel(),'');
  return {status:r.status,url:r.url,body};}
 catch(e){return {status:0,url,body:'',error:e.cause?.code||e.message};}
}
const robots=new Map();
async function allowed(url){
 if(!obeyRobots())return true;
 const u=new URL(url);
 if(!robots.has(u.origin)){const r=await get(u.origin+'/robots.txt');robots.set(u.origin,{status:r.status,text:r.body});}
 const {status,text}=robots.get(u.origin);
 return ['erlaubt','keine'].includes(robotsVerdict(status,text,u.pathname,TOKENS));
}
// Evidence for platforms whose page names nobody (confirm in HOSTED). kic-clients: the municipalities the KIC interface
// names (web/clients, two requests on the platform) must name the area: a municipality by its own name, an association
// with members (a Verwaltungsgemeinschaft) by its own name or by every member; otherwise no candidate (fail closed).
const plainName=n=>String(n||'').normalize('NFC').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
 .replace(/^(?:gemeinde|stadt|markt|marktgemeinde|grosse kreisstadt|verwaltungsgemeinschaft|vg)\s+/,'').replace(/\s*\(.*?\)\s*$/,'').replace(/[^a-z0-9]+/g,' ').trim();
const CONFIRM={
 'kic-clients':async(page,area)=>{
  // The reader's own requests (fetchText: the project's user agent), at the pace of this search.
  const paced=async(u,init={})=>{const wait=last+SPACING-Date.now();if(wait>0)await sleep(wait);last=Date.now();return fetch(u,init);};
  const found=await detectKic(page.url,page.body,{clients:true,get:(u,source,timeout,request)=>fetchText(u,source,15000,request||paced),request:paced});
  const names=(found?.clients||[]).map(c=>c.name);if(!names.length)return null;
  const named=new Set(names.map(plainName)),own=plainName(area.shortName||area.name),members=(area.members||[]).map(m=>plainName(m.name));
  const ok=members.length?names.some(n=>/^(?:verwaltungsgemeinschaft|vg)\s/i.test(n)&&plainName(n)===own)||members.every(m=>named.has(m)):named.has(own);
  return ok?'Mandant der Schnittstelle: '+names.join(', ').slice(0,100):null;
 },
};
let found=0,refused=0,asked=0;
// PLATFORMS: names of HOSTED entries to ask (comma-separated); without it every entry.
const chosen=process.env.PLATFORMS?new Set(process.env.PLATFORMS.split(',').map(s=>s.trim())):null;
for(const p of HOSTED.filter(p=>!chosen||chosen.has(p.name))){
 const inLand=regions.filter(r=>r.ags.startsWith(p.land));
 // A label that two areas of the state share never counts: the host could belong to either. A platform of all Länder
 // (land '') compares with every area of the catalog, also those of other working folders.
 const owners=new Map();for(const r of p.land?inLand:CATALOG)for(const s of hostSlugs(r.shortName||r.name))owners.set(s,[...(owners.get(s)||[]),r.id]);
 // Resumable: an area in the output file is not asked again. A DNS-only platform records which platforms asked an area
 // (asked), so the next DNS platform still asks it; use a file of its own for them (OUT=candidates-hosted-dns.json).
 const fresh=r=>p.dnsOnly?!done[r.id]?.candidates?.length&&!(done[r.id]?.asked||[]).includes(p.name):!done[r.id];
 const queue=inLand.filter(r=>!connected.has(r.id)&&!skipReason(r)&&fresh(r));
 console.log(`${p.name}: ${queue.length} offene Gebiete`);
 let refusal=0;
 for(const r of queue){
  const row=p.dnsOnly&&done[r.id]?done[r.id]:{id:r.id,name:r.name,kind:r.kind,ags:r.ags,sites:[],candidates:[],log:[]};
  if(p.dnsOnly)row.asked=[...new Set([...(row.asked||[]),p.name])];
  // Further names a platform uses (slugs in HOSTED) count only where no other area of the state has them as a label.
  for(const slug of [...new Set([...hostSlugs(r.shortName||r.name),...(p.slugs?p.slugs(r):[])])]){
   if(owners.get(slug)?.length>1||owners.get(slug)?.length===1&&owners.get(slug)[0]!==r.id){row.log.push(slug+': Name im Land mehrdeutig');continue;}
   for(const host of p.hosts(slug,r)){
    if(!p.wildcard){try{await dns.resolve4(host);}catch{continue;}}
    const url=`https://${host}${p.path}`;
    if(p.dnsOnly){row.candidates.push({url,from:host,byHref:true,guessed:`${p.name}-Adresse (DNS), Name eindeutig`});row.log.push(url+' DNS');found++;break;}
    if(!(await allowed(url))){refused++;row.log.push(url+': robots.txt untersagt den Abruf');continue;}
    const page=await get(url,{manual:p.manual});asked++;row.log.push(url+' '+(page.status||page.error));
    if([401,403,429].includes(page.status)){refusal=page.status;break;}
    if(page.status===200&&(p.marker||/sessionnet|si0040|allris|sitzungsdienst|bürgerinfo|buergerinfo/i).test(page.body)){
     let evidence=null;
     try{evidence=p.confirm?await CONFIRM[p.confirm](page,r):pageNamesArea(page.body,r)?'Seite nennt das Gebiet':null;}
     catch(e){row.log.push(url+': '+e.message.slice(0,80));if(/HTTP (?:401|403|429)\b/.test(e.message)){refusal=Number(e.message.match(/HTTP (\d+)/)[1]);break;}}
     if(evidence){row.candidates.push({url:page.url,from:host,byHref:true,guessed:`${p.name}-Adresse, ${evidence}`});found++;break;}
    }
   }
   if(row.candidates.length||refusal)break;
  }
  // An area whose question met the refusal is not recorded: a later run asks it again.
  if(refusal){console.log(`${p.name}: HTTP ${refusal} bei ${r.name}; diese Plattform wird in diesem Lauf nicht weiter gefragt.`);break;}
  done[r.id]=row;
  if(Object.keys(done).length%20===0)fs.writeFileSync(outFile,JSON.stringify(done,null,1));
  if(row.candidates.length)console.log(' +',r.name,'→',row.candidates[0].url);
 }
}
fs.writeFileSync(outFile,JSON.stringify(done,null,1));
console.log(`${found} Kandidaten, ${asked} Seiten gefragt, ${refused} Adressen per robots.txt ausgeschlossen; Kandidaten in ${outFile}`);
