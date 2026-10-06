// Stage 1d: official OParl interfaces that are known without a link to read on the municipal website.
// 1. The register of the OParl project (github.com/OParl/resources, endpoints.yml). Each entry names the Wikidata item
//    of its body; the official keys of that item (municipality key P439, district key P440, regional key P1388) assign
//    it to an area of the catalog. Entries without a Wikidata item are left out: a title alone is no assignment.
// 2. Tenants of ekom21 (Hesse, SD.NET RIM). The municipal websites link rim.ekom21.de/<tenant>/, whose pages a web
//    firewall closes to programs. The vendor's interface rim.ekom21.de/<tenant>/webservice/oparl/v1.1/system is open
//    where the municipality has activated it.
// robots.txt does not decide over OParl, an interface for programs, under either rule (shared/source-access.mjs).
// verify.mjs then asks only the address found here (oparlOnly) and accepts it only if the collector reads public agenda
// items from it, as for every other candidate.
// Run: LAND=de DIR=tmp/source-discovery-de/ node scripts/source-discovery/oparl-register.mjs
//      CANDIDATES=candidates-oparl.json OUT=verified-oparl.json LAND=de DIR=… node scripts/source-discovery/verify.mjs
import fs from 'node:fs';
import {loadAreas,skipReason} from './areas.mjs';
import {NRW_SOURCES} from '../../server/integrations/source-catalog.mjs';
const dir=process.env.DIR||'tmp/source-discovery/';
const outFile=dir+(process.env.OUT||'candidates-oparl.json');
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const REGISTER='https://raw.githubusercontent.com/OParl/resources/main/endpoints.yml';
const regions=loadAreas(),connected=new Set(NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>s.id));
const open=regions.filter(r=>!connected.has(r.id)&&!skipReason(r));
const text=async(url,accept)=>{const r=await fetch(url,{headers:{'User-Agent':UA,Accept:accept},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(url+': HTTP '+r.status);return r.text();};
// endpoints.yml is a flat list ("- title: …" followed by "  key: value"); longer descriptions are indented further.
function parseRegister(yml){const out=[];for(const line of yml.split(/\r?\n/)){const first=line.match(/^- (\w+):\s*(.*)$/),next=line.match(/^ {2}(\w+):\s*(.*)$/);if(first)out.push({[first[1]]:first[2].trim()});else if(next&&out.length)out[out.length-1][next[1]]=next[2].trim();}return out;}
const found=new Map();
const add=(region,url,from,kind)=>{if(!found.has(region.id))found.set(region.id,{region,list:[]});const row=found.get(region.id);if(!row.list.some(c=>c.url===url))row.list.push({url,from,byHref:true,oparlOnly:true,register:kind});};
// 1. Register entries, assigned by the official keys of their Wikidata item.
const entries=parseRegister(await text(REGISTER,'text/plain')).filter(e=>/^Q\d+$/.test(e.wd||'')&&/^https?:\/\//.test(e.url||''));
const qids=[...new Set(entries.map(e=>e.wd))];
const sparql=`SELECT ?item ?ags ?kreis ?rs WHERE { VALUES ?item { ${qids.map(q=>'wd:'+q).join(' ')} } OPTIONAL{?item wdt:P439 ?ags} OPTIONAL{?item wdt:P440 ?kreis} OPTIONAL{?item wdt:P1388 ?rs} }`;
const keys=new Map();
for(const b of JSON.parse(await text('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(sparql),'application/sparql-results+json')).results.bindings){
 const id=b.item.value.split('/').pop(),k=keys.get(id)||{ags:new Set(),kreis:new Set(),rs:new Set()};keys.set(id,k);
 if(b.ags)k.ags.add(b.ags.value);if(b.kreis)k.kreis.add(b.kreis.value);if(b.rs)k.rs.add(b.rs.value);
}
// A municipal association has the regional key of its own administration (municipality part 000); a member
// municipality's key starts with the association's key but names the member, not the association.
const owns=(region,k)=>region.ags.length===8?k.ags.has(region.ags):region.ags.length===5?k.kreis.has(region.ags):[...k.rs].some(rs=>rs.length===12&&rs.slice(0,5)+rs.slice(5,9)===region.ags&&rs.slice(9)==='000');
let registerHits=0;
for(const e of entries){const k=keys.get(e.wd);if(!k)continue;for(const region of open)if(owns(region,k)){add(region,e.url.replace(/^http:/,'https:'),'OParl-Register: '+e.title,'OParl-Register');registerHits++;}}
// 2. ekom21 tenants linked from the official websites (verify.mjs recorded the address it was sent to).
const verified=fs.existsSync(dir+'verified.json')?JSON.parse(fs.readFileSync(dir+'verified.json','utf8')):{};
let tenantHits=0;
for(const region of open){
 for(const t of verified[region.id]?.tried||[]){
  const m=String(t.url||'').match(/^https?:\/\/rim\.ekom21\.de\/([a-z0-9-]+)\//i);
  if(!m||/^(error_path|webservice)$/i.test(m[1]))continue;
  add(region,`https://rim.ekom21.de/${m[1].toLowerCase()}/webservice/oparl/v1.1/system`,t.from||t.url,'ekom21-Mandant');tenantHits++;
 }
}
// OParl is an interface for programs: robots.txt does not decide over these addresses, also not with
// ROBOTS_POLICY=obey (shared/source-access.mjs); robots.mjs records its verdict once a source is connected.
const out={};
for(const {region,list} of found.values())out[region.id]={id:region.id,name:region.name,kind:region.kind,ags:region.ags,sites:[],candidates:list,log:[]};
fs.writeFileSync(outFile,JSON.stringify(out,null,1));
console.log(`${Object.keys(out).length} Gebiete mit OParl-Adresse (${registerHits} aus dem Register, ${tenantHits} ekom21-Mandanten); Kandidaten in ${outFile}`);
