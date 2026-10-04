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
const nameSlugs=area=>[...new Set([area.shortName||area.name,...(area.members||[]).map(m=>m.name)].flatMap(n=>[n,plain(n),plain(n).replace(/^(Bad|Sankt|St\.)\s+/i,'')]).map(norm))].filter(s=>s.length>=5);
const GENERIC=/^(bi|ri|gi|public|buergerinfo|buergerinformationssystem\d*|ratsinfo|ratsinformation|sessionnet\w*|integration|sdnet|allris|session|ris|info|oparl|webservice|si0040\.(asp|php))$/i;
// The part of an address that names who runs the system: the first folder of a host that serves several municipalities
// under folders (sessionnet.owl-it.de/altshausen/bi/), otherwise the host name.
const tenantOf=url=>{const u=new URL(url),first=u.pathname.split('/').filter(Boolean)[0]||'';return norm(first&&!GENERIC.test(first)?first:u.hostname.replace(/^www\./,''));};
/**
 * The name of another municipality that the address of a system names while it does not name this one, or null.
 * A small municipality whose website links the system of its administrative union or of a neighbouring town
 * (Fleischwangen → …/altshausen/bi/) would otherwise receive that town's meetings: the readers cannot separate the
 * councils of a shared system.
 */
export function foreignOwner(area,url,areas){
 let tenant,whole;try{tenant=tenantOf(url);const u=new URL(url);whole=norm(u.hostname+u.pathname);}catch{return null;}
 // The own name anywhere in the address counts: a host may sort its municipalities under a folder of their district
 // (sessionnet.owl-it.de/kreis_steinfurt/wettringen/bi/).
 if(nameSlugs(area).some(s=>whole.includes(s)))return null;
 // The owner named: preferably in the same district and by its own name rather than by one of its members.
 const own=o=>{const s=norm(plain(o.shortName||o.name));return s.length>=5&&tenant.includes(s);};
 const score=o=>(o.ags.slice(0,5)===area.ags.slice(0,5)?2:0)+(own(o)?1:0);
 return areas.filter(o=>o.id!==area.id&&o.kind==='city'&&o.ags.slice(0,2)===area.ags.slice(0,2)&&nameSlugs(o).some(s=>tenant.includes(s))).sort((a,b)=>score(b)-score(a))[0]?.name||null;
}
