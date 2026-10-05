// Area list of a run of the source search.
// - AREAS names a file with areas (e.g. the random sample of the estimate, or shared/nds-regions.json).
// - Otherwise LAND selects areas of the catalog: a state key ("09"), several ("01,13"), or "de" for the 14 states
//   of shared/de-regions.json. Without both: NRW.
import fs from 'node:fs';
import {CATALOG} from '../../shared/catalog.mjs';
/** State keys of the run, e.g. for one Wikidata query per state. */
export function lands(){
 const value=process.env.LAND||'05';
 return value==='de'?[...new Set(CATALOG.filter(r=>r.id.startsWith('de-')).map(r=>r.ags.slice(0,2)))].sort():value.split(',').map(s=>s.trim()).filter(Boolean);
}
export function loadAreas(){
 if(process.env.AREAS)return JSON.parse(fs.readFileSync(process.env.AREAS,'utf8'));
 const wanted=new Set(lands());
 return CATALOG.filter(r=>wanted.has(r.ags.slice(0,2)));
}
// Berlin and Hamburg stand in the catalog as one area each, but their council business runs through the assemblies of
// their boroughs, each with a system of its own. A system found from the city's website belongs to one borough; taken
// as the source of the whole city it would show one borough as Berlin or Hamburg. They are searched once the boroughs
// are areas of their own.
const CITY_STATES=new Set(['11000000','02000000']);
/** Why an area is left out of the search, or null. */
export const skipReason=area=>CITY_STATES.has(area.ags)?'Stadtstaat: Die Bezirke führen eigene Vertretungen und Systeme; sie sind noch keine eigenen Gebiete im Katalog':null;

const norm=s=>String(s).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFKD').replace(/[^a-z0-9]/g,'');
// "Neustadt in Sachsen", "Dillingen a.d.Donau", "Lahr/Schwarzwald": the name without its addition.
const plain=n=>n.replace(/\(.*?\)/g,'').replace(/\s+(an der|am|im|in der|in|bei|vor der|ob der|unter|über|auf der|auf dem)\s+.*$/i,'').replace(/\s+[a-zäöü]{1,3}\.\s?(?:[a-zäöü]{1,3}\.\s?)?\S.*$/i,'').replace(/[/,].*$/,'').trim();
// Plain names of the areas of each state and of their members, to tell whether a part of a hyphenated name is the name of
// another area. Built once per list of areas.
const namesByState=new WeakMap();
function stateNames(areas){
 if(!namesByState.has(areas)){const byState=new Map();for(const o of areas){const key=String(o.ags||'').slice(0,2),names=byState.get(key)||new Map();byState.set(key,names);
  for(const n of [o.shortName||o.name,...(o.members||[]).map(m=>m.name)].filter(Boolean)){const s=norm(plain(n));names.set(s,[...(names.get(s)||[]),o.id]);}}
  namesByState.set(areas,byState);}
 return namesByState.get(areas);
}
/**
 * Parts of a hyphenated name that name the area on their own: "Schladen-Werla" appears as "session.schladen.de". A part
 * counts with six letters or more and only if no other area of the state (or member of one) bears it as its name:
 * "Wittlich" in "Wittlich-Land" is the town next to the association, not the association.
 */
export function nameParts(name,area,areas=CATALOG){
 const p=plain(String(name||''));if(!p.includes('-'))return [];
 const names=stateNames(areas).get(String(area.ags||'').slice(0,2))||new Map();
 return p.split('-').map(norm).filter(s=>s.length>=6&&!(names.get(s)||[]).some(id=>id!==area.id));
}
const nameSlugs=area=>{const names=[area.shortName||area.name,...(area.members||[]).map(m=>m.name)];return [...new Set([...names.flatMap(n=>[n,plain(n),plain(n).replace(/^(Bad|Sankt|St\.)\s+/i,'')]).map(norm),...names.flatMap(n=>nameParts(n,area))])].filter(s=>s.length>=5);};
// Short names under which an area's system appears in addresses (gmh.ris.itebo.de for Georgsmarienhütte), by area id.
// Kept in identity-aliases.json, each one checked by hand.
export const ALIASES=JSON.parse(fs.readFileSync(new URL('./identity-aliases.json',import.meta.url),'utf8'));
const literal=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
/**
 * The alias of the area that an address names, or null. An alias counts only as a whole host label or path segment, or as
 * a tenant folder with the suffix of its public or members' part (suelze_bi/, suelze-ri/): as a substring a three-letter
 * alias would match any address.
 */
export function aliasInAddress(area,url,aliases=ALIASES){
 let hay;try{const u=new URL(url);hay=(u.hostname+u.pathname).toLowerCase();}catch{return null;}
 return (aliases[area?.id]||[]).find(a=>new RegExp(`(?:^|[./])${literal(String(a).toLowerCase())}(?:[_-](?:bi|ri|gi))?(?:[./]|$)`).test(hay))||null;
}
const GENERIC=/^(bi|ri|gi|public|buergerinfo|buergerinformationssystem\d*|ratsinfo|ratsinformation|sessionnet\w*|integration|sdnet|allris|session|ris|info|oparl|webservice|si0040\.(asp|php))$/i;
// The part of an address that names who runs the system: the first folder of a host that serves several municipalities
// under folders (sessionnet.owl-it.de/altshausen/bi/), otherwise the host name.
const tenantOf=url=>{const u=new URL(url),first=u.pathname.split('/').filter(Boolean)[0]||'';return norm(first&&!GENERIC.test(first)?first:u.hostname.replace(/^www\./,''));};
// The system of an address: its host without "www." and the first folder that names a tenant (sessionnet.owl-it.de/altshausen).
const systemKey=url=>{try{const u=new URL(url),folder=u.pathname.replace(/[^/]*$/,'').split('/').filter(Boolean).find(f=>!GENERIC.test(f))||'';return u.hostname.replace(/^www\./,'').toLowerCase()+'/'+folder.toLowerCase();}catch{return null;}};
const SOURCE_FILES=['nrw-sources','nearby-sources','expanded-sources','statewide-sources','nds-sources','de-sources','citystate-sources'];
let usesRead=null;
/** Addresses of the connected sources (not switched off) of the source files, by area id; read once. */
export function sourceUses(){
 if(!usesRead){usesRead=new Map();for(const f of SOURCE_FILES){let list=[];try{list=JSON.parse(fs.readFileSync(new URL('../../server/integrations/'+f+'.json',import.meta.url),'utf8'));}catch{/* file missing */}
  for(const s of list)if(s.method!=='pending'&&(s.system||s.base))usesRead.set(s.id,[...(usesRead.get(s.id)||[]),s.system||s.base]);}}
 return usesRead;
}
/**
 * The name of another municipality that the address of a system names while it does not name this one, or null.
 * A small municipality whose website links the system of its administrative union or of a neighbouring town
 * (Fleischwangen → …/altshausen/bi/) would otherwise receive that town's meetings: the readers cannot separate the
 * councils of a shared system.
 * uses: addresses of the connected sources by area id (sourceUses). A municipality named in the address whose own
 * entry reads another system is no owner of this one (Grasleben's ris-sg-gl-migration.edv-helmstedt.de, while the town
 * of Helmstedt reads ris.stadt-helmstedt.de). One without an entry stays a possible owner: nothing shows it is not.
 */
export function foreignOwner(area,url,areas,uses=sourceUses()){
 let tenant,whole;try{tenant=tenantOf(url);const u=new URL(url);whole=norm(u.hostname+u.pathname);}catch{return null;}
 // The own name anywhere in the address counts: a host may sort its municipalities under a folder of their district
 // (sessionnet.owl-it.de/kreis_steinfurt/wettringen/bi/). So does an alias of the area as a whole part of the address.
 if(nameSlugs(area).some(s=>whole.includes(s))||aliasInAddress(area,url))return null;
 const key=systemKey(url),elsewhere=o=>{const own=uses?.get(o.id)||[];return own.length>0&&!own.some(a=>systemKey(a)===key);};
 // The owner named: preferably in the same district and by its own name rather than by one of its members.
 const own=o=>{const s=norm(plain(o.shortName||o.name));return s.length>=5&&tenant.includes(s);};
 const score=o=>(o.ags.slice(0,5)===area.ags.slice(0,5)?2:0)+(own(o)?1:0);
 return areas.filter(o=>o.id!==area.id&&o.kind==='city'&&o.ags.slice(0,2)===area.ags.slice(0,2)&&nameSlugs(o).some(s=>tenant.includes(s))&&!elsewhere(o)).sort((a,b)=>score(b)-score(a))[0]?.name||null;
}
