// Lückenatlas der Administration: jedes Gebiet des Katalogs mit Anbindung, Grund und Zugang (source-atlas.json, vom
// Build scripts/dashboard/build.mjs) und dem, was die Datenbank gerade weiß (gespeicherte Berichte, letzter Abruf,
// Teilstand, Fehlschlag). Nur lesend. Die Kartenformen liest der Browser aus public/geo/.
import {CATALOG,POPULATION} from '../../shared/catalog.mjs';
import {ALL_LANDS} from '../../shared/lands.mjs';
import {NRW_SOURCES} from './source-catalog.mjs';
import {SOURCES} from './regions.mjs';
import atlas from './source-atlas.json' with {type:'json'};
import robots from './source-robots.json' with {type:'json'};
import {ACCESS_STATUSES,accessOfSource,channelOf,robotsNote,methodName} from '../../shared/source-access.mjs';
import {ATLAS_CATEGORIES} from '../../shared/atlas-categories.mjs';
import {regionFigures} from './admin-data.mjs';
import {atRevision} from './revision-cache.mjs';
const canonical="json_extract(payload,'$.identity.mergedInto') IS NULL";
const TYPE={city:null,district:'Kreis'};
let base=null;
/** The part of every area that does not change between requests: catalog, catalog entry, atlas data. */
function staticAreas(){
 if(base)return base;
 const sources=new Map(NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>[s.id,s]));
 for(const s of SOURCES)if(!sources.has(s.id))sources.set(s.id,s);
 // Münster: the first source, read by its own OParl reader (server/integrations/oparl.mjs), in no catalog file.
 if(!sources.has('muenster'))sources.set('muenster',{id:'muenster',method:'oparl',system:'https://oparl.stadt-muenster.de/system'});
 base=CATALOG.map(r=>{
  const s=sources.get(r.id),a=atlas.areas[r.id];
  const row={id:r.id,n:r.name,l:r.ags.slice(0,2),g:r.ags,t:TYPE[r.kind]||r.municipalityType||'Gemeinde',k:r.kind==='district'?'d':r.independent?'i':'c',p:POPULATION[r.id]||0};
  if(r.members?.length)row.m=r.members.length;
  if(a)Object.assign(row,a);
  // Of a connected source: reader, access, channel, robots.txt verdict in words, date of its check, address (from
  // the catalog entry, so a catalog newer than the atlas build shows its sources). Without a source an "ok" of an
  // older build does not count; an area in neither place is unchecked.
  if(s){const rb=robots.sources?.[r.id]||'';Object.assign(row,{c:s.checkPending?'ready':'ok',v:methodName(s),z:accessOfSource(s,rb),zc:channelOf(s).name,rb,rn:robotsNote(s,rb),at:s.verifiedAt||'',u:s.system||s.base||s.pages?.[0]||''});if(s.checkPending)row.r=s.checkPending;}
  else if(!a){row.c='other';row.z='none';}
  else if(row.c==='ok'||row.c==='ready'){row.c='other';row.z='none';}
  const host=(()=>{try{return new URL(row.u).hostname.replace(/^www\./,'');}catch{return '';}})();
  if(host)row.o=host.split('.').slice(-2).join('.').replace(/^more-rubin[0-9]*\.de$/,'more-rubin.de');
  return row;
 });
 return base;
}
/** Reports per area: from region_stats where present, else one scan kept until the stock changes. */
async function reportCounts(db,now){
 const figures=await regionFigures(db,{now,budgetMs:4000});
 if(figures)return {counts:new Map(figures.rows.map(r=>[r.region_id,Number(r.count||0)])),pending:figures.pending};
 const rows=await atRevision(db,'atlas-counts',async()=>(await db.prepare(`SELECT region_id,count(*) n FROM topics WHERE ${canonical} GROUP BY region_id`).all()).results);
 return {counts:new Map(rows.map(r=>[r.region_id,Number(r.n)])),pending:0};
}
const readJson=s=>{try{return JSON.parse(s||'{}');}catch{return {};}};
export async function adminAtlas(db,{now=new Date()}={}){
 const [{counts,pending},coverage]=await Promise.all([reportCounts(db,now),db.prepare('SELECT region_id,payload FROM source_coverage').all()]);
 const cov=new Map(coverage.results.map(r=>[r.region_id,readJson(r.payload)]));
 let reports=0;
 const areas=staticAreas().map(a=>{
  const row={...a},n=counts.get(a.id)||0,c=cov.get(a.id);
  if(n){row.cnt=n;reports+=n;}
  if(c){const last=c.lastSuccessAt||c.importedAt;if(last)row.last=last;if(c.attemptStatus==='failed')row.st='failed';else if(n&&c.complete===false)row.st='partial';}
  return row;
 });
 return {asOf:now.toISOString(),builtAt:atlas.builtAt,reportDate:atlas.reportDate,statsPending:pending,reports,texts:atlas.texts,
  categories:ATLAS_CATEGORIES,access:ACCESS_STATUSES,lands:Object.fromEntries(ALL_LANDS.map(l=>[l.id,{name:l.name,short:l.short}])),areas};
}
