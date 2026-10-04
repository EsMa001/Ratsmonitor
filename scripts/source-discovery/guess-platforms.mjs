// Stage 1c: tenants of council platforms that give each municipality its own host name, found by DNS alone.
// komm.one (Baden-Württemberg, SessionNet: <name>-sitzungsdienst.komm.one) and KISA (Saxony, More! Rubin:
// ris-<name>.zv-kisa.de) answer DNS only for hosts that exist, so a lookup puts no load on the platform.
// Neither system links back to the municipality's website. A guessed address therefore becomes a candidate only if
// the name is unique among the areas of its state; verify.mjs then has to find the area's name in the system and read
// public agenda items, as for every other candidate. robots.txt of both platforms allows the paths read.
// Run: LAND=de DIR=tmp/source-discovery-de/ node scripts/source-discovery/guess-platforms.mjs
//      CANDIDATES=candidates-guessed.json OUT=verified-guessed.json LAND=de DIR=… node scripts/source-discovery/verify.mjs
import fs from 'node:fs';
import dns from 'node:dns/promises';
import {loadAreas,skipReason} from './areas.mjs';
import {NRW_SOURCES} from '../../server/integrations/source-catalog.mjs';
const dir=process.env.DIR||'tmp/source-discovery/';
const outFile=dir+(process.env.OUT||'candidates-guessed.json');
const PLATFORMS=[
 {name:'komm.one',land:'08',host:slug=>`${slug}-sitzungsdienst.komm.one`,page:host=>`https://${host}/bi/`},
 {name:'KISA',land:'14',host:slug=>`ris-${slug}.zv-kisa.de`,page:host=>`https://${host}/`},
];
// "Böbingen an der Rems" → boebingen, "Feldberg (Schwarzwald)" → feldberg; the platforms also cut long names to 12 letters.
const base=name=>name.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/\(.*?\)/g,'').replace(/\/.*$/,'').replace(/\s+[a-z]{1,3}\.\s?(?:[a-z]{1,3}\.\s?)?\S.*$/,'').replace(/\s+(an der|am|im|in der|in|bei|vor der|ob der|unter|über|auf der|auf dem)\s+.*$/,'').trim();
const slugs=name=>{const b=base(name),dash=b.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),flat=dash.replace(/-/g,'');return [...new Set([dash,flat,dash.slice(0,12).replace(/-$/,''),flat.slice(0,12)])].filter(s=>s.length>=4);};
const regions=loadAreas(),connected=new Set(NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>s.id));
const done=fs.existsSync(outFile)?JSON.parse(fs.readFileSync(outFile,'utf8')):{};
let found=0,ambiguous=0;
for(const p of PLATFORMS){
 const inLand=regions.filter(r=>r.ags.startsWith(p.land));
 // A name that two areas of the state share (Altdorf …) never counts: the address could belong to either.
 const owners=new Map();for(const r of inLand)for(const s of slugs(r.shortName))owners.set(s,[...(owners.get(s)||[]),r.id]);
 const queue=inLand.filter(r=>!connected.has(r.id)&&!skipReason(r)&&!done[r.id]?.candidates?.length);
 await Promise.all(Array.from({length:8},async()=>{for(let r;(r=queue.shift());){
  for(const slug of slugs(r.shortName)){
   if(owners.get(slug).length>1){ambiguous++;break;}
   const host=p.host(slug);
   try{await dns.resolve4(host);}catch{continue;}
   done[r.id]={id:r.id,name:r.name,kind:r.kind,ags:r.ags,sites:[],candidates:[{url:p.page(host),from:host,byHref:true,guessed:`${p.name}-Adresse (DNS), Name im Land eindeutig`}],log:[]};found++;break;
  }
 }}));
}
fs.writeFileSync(outFile,JSON.stringify(done,null,1));
console.log(`${found} Plattform-Adressen gefunden, ${ambiguous} wegen mehrdeutigem Namen übergangen; Kandidaten in ${outFile}`);
