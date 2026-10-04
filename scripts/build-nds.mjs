// Gebietskatalog, Einwohnerzahlen und Admin-Kartengeometrie für Niedersachsen.
// Gebiete auf Verwaltungsebene: kreisfreie Städte, Einheitsgemeinden und Samtgemeinden (Ratsinformationssysteme
// gehören dort meist der Samtgemeinde) sowie die 37 Landkreise einschließlich Region Hannover.
// Eingaben: BKG VG250 (gem, vwg, krs; Land 03) und Wikidata (Gemeindeschlüssel P439, Einwohner P1082).
// Ausgaben: shared/nds-regions.json, shared/nds-population.json, Regionen in public/geo/germany.json.
// Aufruf: node scripts/build-nds.mjs  (lädt fehlende Eingaben nach tmp/nds/)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),tmp=path.join(root,'tmp','nds');
const UA={'User-Agent':'Ratsmonitor-SourceCatalog/1.0 (public council information; contact via github.com/EsMa001/Ratsmonitor)'};
fs.mkdirSync(tmp,{recursive:true});

async function layer(name){
 const file=path.join(tmp,name+'.json');
 if(!fs.existsSync(file)){
  const filter='<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo><fes:ValueReference>sn_l</fes:ValueReference><fes:Literal>03</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>';
  const url='https://sgx.geodatenzentrum.de/wfs_vg250?'+new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',outputFormat:'application/json',srsName:'EPSG:4326',TYPENAMES:'vg250:'+name,FILTER:filter});
  const r=await fetch(url,{headers:UA});if(!r.ok)throw Error('VG250 '+name+' HTTP '+r.status);fs.writeFileSync(file,await r.text());
 }
 /* gf=4: Landflächen mit Strukturdaten; gf=2 sind Doppel für Wasser- und Küstenflächen */
 return JSON.parse(fs.readFileSync(file,'utf8')).features.filter(f=>f.properties.gf===4);
}
async function population(){
 const file=path.join(tmp,'population.json');
 if(!fs.existsSync(file)){
  const q=`SELECT ?ags (MAX(?pop) AS ?population) WHERE { ?item wdt:P439 ?ags. FILTER(STRSTARTS(?ags,"03")) ?item wdt:P1082 ?pop. } GROUP BY ?ags`;
  const r=await fetch('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q),{headers:{...UA,Accept:'application/sparql-results+json'}});
  if(!r.ok)throw Error('Wikidata HTTP '+r.status);
  fs.writeFileSync(file,JSON.stringify(Object.fromEntries((await r.json()).results.bindings.map(b=>[b.ags.value,Number(b.population.value)]))));
 }
 return JSON.parse(fs.readFileSync(file,'utf8'));
}

const [gem,vwg,krs,pop]=await Promise.all([layer('vg250_gem'),layer('vg250_vwg'),layer('vg250_krs'),population()]);
const municipalities=gem.filter(f=>f.properties.bez!=='Gemeindefreies Gebiet');
const idOf=key=>'nds-'+key;
// Fusionen nach dem Stand der öffentlichen Karte (VG250 2018): dort stehen noch die früheren Gemeinden.
const FORMER={'03153019':['03153006','03153007','03153009','03153014'],'03358024':['03358004','03358022']};
const regions=[],shapes=[];
for(const f of krs){
 const p=f.properties;if(p.bez==='Kreisfreie Stadt')continue;
 /* Region Hannover steht in VG250 als "Landkreis Region Hannover" */
 const name=p.gen.startsWith('Region ')?p.gen:'Landkreis '+p.gen;
 regions.push({id:idOf(p.ags),name,shortName:p.gen,kind:'district',district:idOf(p.ags),ags:p.ags});shapes.push([regions.at(-1),f]);
}
const districts=new Set(regions.map(r=>r.ags));
for(const f of vwg){
 const p=f.properties,members=municipalities.filter(g=>g.properties.ars.startsWith(p.ars)).map(g=>g.properties);
 if(!members.length)continue;/* gemeindefreie Gebiete: kein Rat */
 const district=districts.has(p.ars.slice(0,5))?idOf(p.ars.slice(0,5)):null;
 if(p.bez==='Samtgemeinde'){
  regions.push({id:idOf(p.ars),name:'Samtgemeinde '+p.gen,shortName:p.gen,kind:'city',district,ags:p.ars,municipalityType:'Samtgemeinde',independent:false,
   members:members.map(m=>({ags:m.ags,name:m.gen})).sort((a,b)=>a.name.localeCompare(b.name,'de'))});
 }else{
  if(members.length!==1)throw Error('Einheitsgemeinde mit '+members.length+' Gemeinden: '+p.gen);
  const m=members[0];
  regions.push({id:idOf(m.ags),name:m.bez+' '+m.gen,shortName:m.gen,kind:'city',district,ags:m.ags,municipalityType:m.bez,independent:district===null,...(FORMER[m.ags]?{formerAgs:FORMER[m.ags]}:{})});
 }
 shapes.push([regions.at(-1),f]);
}
regions.sort((a,b)=>a.kind===b.kind?a.shortName.localeCompare(b.shortName,'de'):a.kind==='city'?1:-1);
const cities=regions.filter(r=>r.kind==='city');
if(districts.size!==37||cities.length!==403)throw Error('Unerwartete Anzahl: '+districts.size+' Landkreise, '+cities.length+' Gemeinden');

/* Einwohner: Einheitsgemeinde direkt, Samtgemeinde und Landkreis als Summe ihrer Gemeinden */
const people={},missing=[];
const count=ags=>{const n=pop[ags];if(!n)missing.push(ags);return n||0;};
for(const r of cities)people[r.id]=r.members?r.members.reduce((s,m)=>s+count(m.ags),0):count(r.ags);
for(const r of regions.filter(r=>r.kind==='district'))people[r.id]=cities.filter(c=>c.district===r.id).reduce((s,c)=>s+people[c.id],0);
if(missing.length)throw Error('Keine Einwohnerzahl in Wikidata: '+missing.join(', '));

/* Kartengeometrie wie scripts/build-nrw.py: gleiche Projektion und Vereinfachung */
function rdp(pts,eps=.22){
 if(pts.length<3)return pts;
 const [a,b]=[pts[0],pts.at(-1)],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
 let max=0,index=0;
 for(let i=1;i<pts.length-1;i++){const [x,y]=pts[i],t=den?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den)):0,d=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);if(d>max){max=d;index=i;}}
 if(max<=eps)return [a,b];
 return [...rdp(pts.slice(0,index+1),eps).slice(0,-1),...rdp(pts.slice(index),eps)];
}
function shape(f){
 const polygons=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates],points=[],paths=[];
 for(const poly of polygons)for(const ring of poly){
  const xy=ring.map(([lon,lat])=>[(lon-5.6)*60,(55.2-lat)*96]);points.push(...xy);let simple=rdp(xy);if(simple.length<4)simple=xy;
  paths.push(simple.map((p,i)=>(i?'L':'M')+p.map(v=>v.toFixed(2)).join(',')).join('')+'Z');
 }
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
 return {path:paths.join(''),bounds,center:[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2]};
}
const mapFile=path.join(root,'public','geo','germany.json'),map=JSON.parse(fs.readFileSync(mapFile,'utf8'));
map.regions=[...map.regions.filter(r=>!r.id.startsWith('nds-')),...shapes.map(([r,f])=>({id:r.id,name:r.shortName,ags:r.ags,kind:r.kind,...shape(f)}))];
const b=[Math.min(...map.regions.map(r=>r.bounds[0]))-6,Math.min(...map.regions.map(r=>r.bounds[1]))-6,Math.max(...map.regions.map(r=>r.bounds[2]))+6,Math.max(...map.regions.map(r=>r.bounds[3]))+6];
map.regionViewBox=[b[0],b[1],b[2]-b[0],b[3]-b[1]].join(' ');
map.geometryDates='NRW-Gemeinden VG250: Abruf 26.09.2026; Niedersachsen VG250 (Gemeinden, Samtgemeinden, Landkreise): Abruf '+new Date().toLocaleDateString('de-DE')+'; Kreise/Länder VG2500: 31.12.2024';

fs.writeFileSync(path.join(root,'shared','nds-regions.json'),JSON.stringify(regions,null,2)+'\n');
fs.writeFileSync(path.join(root,'shared','nds-population.json'),JSON.stringify(people)+'\n');
fs.writeFileSync(mapFile,JSON.stringify(map));
console.log(`Niedersachsen: ${districts.size} Landkreise, ${cities.length} Gemeinden auf Verwaltungsebene (${cities.filter(c=>c.members).length} Samtgemeinden, ${cities.filter(c=>c.independent).length} kreisfrei), ${Object.values(people).filter((n,i)=>regions[i]?.kind==='city').length} mit Einwohnerzahl. Karte: ${map.regions.length} Gebiete, ${fs.statSync(mapFile).size} Bytes.`);
