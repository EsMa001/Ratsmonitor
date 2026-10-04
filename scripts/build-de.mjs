// Gebietskatalog, Einwohnerzahlen und Admin-Kartengeometrie für die 14 Länder außer NRW und Niedersachsen.
// Gebiete auf Verwaltungsebene wie in Niedersachsen (scripts/build-nds.mjs): Gemeinden außerhalb eines Verbands,
// Gemeindeverbände (Amt, Verbandsgemeinde, Verwaltungsgemeinschaft …) mit ihren Mitgliedsgemeinden und die Landkreise.
// - Ein Verband ist, was sich die ersten neun Stellen des Regionalschlüssels teilt und mindestens zwei Gemeinden hat
//   (dieselbe Regel wie scripts/build-population.mjs). Verband und Mitglieder führen meist ein gemeinsames System.
// - Baden-Württemberg: Mitgliedsgemeinden bleiben eigene Gebiete (eigener Rat, eigenes Ratsinformationssystem).
// - Berlin und Hamburg stehen als je ein Gebiet. Ihre Bezirke sind noch keine eigenen Gebiete.
// Eingaben: BKG VG250 (gem, vwg, krs je Land) und Wikidata (Einwohner P1082 je Gemeindeschlüssel P439).
// Ausgaben: shared/de-regions.json (kompakte Zeilen, gelesen von shared/catalog.mjs), shared/de-population.json,
//           public/geo/de-areas.json (Geometrie für die Karte der Administration).
// Aufruf: node scripts/build-de.mjs   (lädt fehlende Eingaben nach tmp/de/; vorhandene Dateien werden wiederverwendet)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FEDERAL_STATES} from '../shared/estimate.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),tmp=path.join(root,'tmp','de');
const UA={'User-Agent':'Ratsmonitor-SourceCatalog/1.0 (public council information; contact via github.com/EsMa001/Ratsmonitor)'};
fs.mkdirSync(tmp,{recursive:true});
// NRW und Niedersachsen haben eigene Kataloge mit eigenen Kennungen (nrw-…, nds-…).
const LANDS=Object.keys(FEDERAL_STATES).filter(id=>id!=='05'&&id!=='03').sort();
const INDEPENDENT_MEMBERS=new Set(['08']);
const pause=ms=>new Promise(done=>setTimeout(done,ms));

async function layer(name,land){
 const file=path.join(tmp,land+'-'+name+'.json');
 if(!fs.existsSync(file)){
  const filter=`<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo><fes:ValueReference>sn_l</fes:ValueReference><fes:Literal>${land}</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>`;
  const features=[];let matched=Infinity;
  // Der Dienst nennt die Zahl der Treffer; liefert er weniger, wird seitenweise weitergelesen.
  for(let start=0;features.length<matched;start=features.length){
   const url='https://sgx.geodatenzentrum.de/wfs_vg250?'+new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',outputFormat:'application/json',srsName:'EPSG:4326',TYPENAMES:'vg250:'+name,FILTER:filter,...(start?{startIndex:String(start),sortBy:'objid'}:{})});
   const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(`VG250 ${name} Land ${land} HTTP ${r.status}`);
   const page=await r.json();matched=page.numberMatched??page.features.length;if(!page.features.length)break;features.push(...page.features);await pause(300);
  }
  if(features.length<matched)throw Error(`VG250 ${name} Land ${land}: ${features.length} von ${matched} Objekten gelesen`);
  fs.writeFileSync(file,JSON.stringify({features}));
 }
 /* gf=4: Landflächen mit Strukturdaten; gf=2 sind Doppel für Wasser- und Küstenflächen */
 return JSON.parse(fs.readFileSync(file,'utf8')).features.filter(f=>f.properties.gf===4);
}
// Einwohner je Gemeindeschlüssel: die Antworten von scripts/build-population.mjs, sonst dieselbe Abfrage je Land.
async function population(){
 const shared=path.join(root,'tmp','population','municipalities.json'),own=path.join(tmp,'population.json');
 let rows;
 if(fs.existsSync(shared))rows=JSON.parse(fs.readFileSync(shared,'utf8'));
 else if(fs.existsSync(own))rows=JSON.parse(fs.readFileSync(own,'utf8'));
 else{
  rows=[];
  for(const land of LANDS){
   const q=`SELECT ?key ?pop ?date WHERE { ?item wdt:P439 ?key. FILTER(STRSTARTS(?key,"${land}")) ?item p:P1082 ?st. ?st ps:P1082 ?pop; a wikibase:BestRank. OPTIONAL{?st pq:P585 ?date} FILTER NOT EXISTS{?item wdt:P576 ?end} }`;
   const r=await fetch('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q),{headers:{...UA,Accept:'application/sparql-results+json'},signal:AbortSignal.timeout(150000)});
   if(!r.ok)throw Error('Wikidata HTTP '+r.status);
   rows.push(...(await r.json()).results.bindings.map(b=>({key:b.key.value,pop:Number(b.pop.value),date:b.date?.value?.slice(0,10)||null})));await pause(1000);
  }
  fs.writeFileSync(own,JSON.stringify(rows));
 }
 // Je Schlüssel der jüngste datierte Wert.
 const latest=new Map();
 for(const r of rows){const old=latest.get(r.key);if(!old||(r.date||'')>(old.date||'')||((r.date||'')===(old.date||'')&&r.pop>old.pop))latest.set(r.key,r);}
 return new Map([...latest].map(([key,r])=>[key,r.pop]));
}

/* Kartengeometrie wie scripts/build-nds.mjs: gleiche Projektion; gröbere Vereinfachung und eine Nachkommastelle,
   weil die Datei rund 4.500 Gebiete enthält und nur die Übersichtskarte der Administration bedient. */
function rdp(pts,eps){
 if(pts.length<3)return pts;
 const [a,b]=[pts[0],pts.at(-1)],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
 let max=0,index=0;
 for(let i=1;i<pts.length-1;i++){const [x,y]=pts[i],t=den?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den)):0,d=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);if(d>max){max=d;index=i;}}
 if(max<=eps)return [a,b];
 return [...rdp(pts.slice(0,index+1),eps).slice(0,-1),...rdp(pts.slice(index),eps)];
}
function shape(features,eps=.3){
 const points=[],paths=[];
 for(const f of features){
  const polygons=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];
  for(const poly of polygons)for(const ring of poly){
   const xy=ring.map(([lon,lat])=>[(lon-5.6)*60,(55.2-lat)*96]);points.push(...xy);let simple=rdp(xy,eps);if(simple.length<4)simple=xy;
   paths.push(simple.map((p,i)=>(i?'L':'M')+p.map(v=>v.toFixed(1)).join(',')).join('')+'Z');
  }
 }
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),round=v=>Math.round(v*10)/10;
 return {path:paths.join(''),bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)].map(round)};
}

const pop=await population();
const types=[],typeOf=name=>{let i=types.indexOf(name);if(i<0){i=types.length;types.push(name);}return i;};
const districts=[],areas=[],shapes=[],people={},missing=[],report=[];
const count=ags=>{const n=pop.get(ags);if(!n)missing.push(ags);return n||0;};
const byKey=(features,keyOf)=>{const groups=new Map();for(const f of features){const key=keyOf(f.properties);groups.set(key,[...(groups.get(key)||[]),f]);}return groups;};
for(const land of LANDS){
 const [gem,vwg,krs]=[await layer('vg250_gem',land),await layer('vg250_vwg',land),await layer('vg250_krs',land)];
 const municipalities=gem.filter(f=>f.properties.bez!=='Gemeindefreies Gebiet');
 const before={districts:districts.length,areas:areas.length,associations:areas.filter(a=>a[3]).length};
 // Landkreise; kreisfreie Städte und Stadtkreise sind Gemeinden ohne Kreis.
 const kreise=new Set();
 for(const [ags,features] of byKey(krs,p=>p.ags)){
  const p=features[0].properties;if(/^(Kreisfreie Stadt|Stadtkreis)$/.test(p.bez))continue;
  /* Der Regionalverband Saarbrücken und Kreise wie der Burgenlandkreis tragen ihre Art schon im Namen. */
  kreise.add(ags);districts.push([ags,typeOf(/^Regionalverband |kreis/i.test(p.gen)?'':p.bez),p.gen]);shapes.push({id:'de-'+ags,ags,kind:'district',...shape(features)});
  people['de-'+ags]=municipalities.filter(g=>g.properties.ags.startsWith(ags)).reduce((n,g)=>n+(pop.get(g.properties.ags)||0),0);
 }
 const single=(m,features)=>{areas.push([m.ags,typeOf(m.bez),m.gen]);shapes.push({id:'de-'+m.ags,ags:m.ags,kind:'city',...shape(features)});people['de-'+m.ags]=count(m.ags);};
 if(INDEPENDENT_MEMBERS.has(land)){for(const [,features] of byKey(municipalities,p=>p.ags))single(features[0].properties,features);}
 else for(const [ars,features] of byKey(vwg,p=>p.ars)){
  const p=features[0].properties,members=[...byKey(municipalities.filter(g=>g.properties.ars.startsWith(ars)),g=>g.ags).values()].map(list=>list[0].properties);
  if(!members.length)continue;/* gemeindefreie Gebiete: kein Rat */
  if(members.length===1){single(members[0],features);continue;}
  if(members.some(m=>m.ags.slice(0,5)!==ars.slice(0,5)))throw Error('Verband über Kreisgrenzen: '+ars);
  areas.push([ars,typeOf(p.bez),p.gen,members.map(m=>[m.ags.slice(5),m.gen]).sort((a,b)=>a[1].localeCompare(b[1],'de'))]);
  shapes.push({id:'de-'+ars,ags:ars,kind:'city',...shape(features)});people['de-'+ars]=members.reduce((n,m)=>n+count(m.ags),0);
 }
 report.push(`${land} ${FEDERAL_STATES[land].padEnd(24)} ${String(districts.length-before.districts).padStart(4)} Kreise ${String(areas.length-before.areas).padStart(5)} Gebiete der Gemeindeebene, davon ${String(areas.filter(a=>a[3]).length-before.associations).padStart(4)} Verbände`);
}
const order=(a,b)=>a[2].localeCompare(b[2],'de')||a[0].localeCompare(b[0]);
districts.sort(order);areas.sort(order);
const ids=new Set([...districts,...areas].map(r=>r[0]));
if(ids.size!==districts.length+areas.length)throw Error('Schlüssel mehrfach vergeben');
if(districts.length<200||districts.length>240||areas.length<3800||areas.length>4800)throw Error(`Unerwartete Anzahl: ${districts.length} Kreise, ${areas.length} Gebiete`);
const today=new Date().toISOString().slice(0,10);
fs.writeFileSync(path.join(root,'shared','de-regions.json'),JSON.stringify({builtAt:today,source:'BKG VG250 (Gemeinden, Verwaltungsgemeinschaften, Kreise)',types,districts,areas})+'\n');
fs.writeFileSync(path.join(root,'shared','de-population.json'),JSON.stringify(people)+'\n');
const mapFile=path.join(root,'public','geo','de-areas.json');
fs.writeFileSync(mapFile,JSON.stringify({attribution:'© BKG (2026), dl-de/by-2-0',source:'https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf',retrievedAt:today,regions:shapes}));
console.log(report.join('\n'));
console.log(`${districts.length} Kreise, ${areas.length} Gebiete der Gemeindeebene (${areas.filter(a=>a[3]).length} Verbände mit ${areas.reduce((n,a)=>n+(a[3]?.length||0),0)} Mitgliedsgemeinden). Ohne Einwohnerzahl in Wikidata: ${missing.length}${missing.length?' ('+missing.slice(0,12).join(', ')+(missing.length>12?' …':'')+')':''}. Katalog: ${fs.statSync(path.join(root,'shared','de-regions.json')).size} Bytes, Karte: ${fs.statSync(mapFile).size} Bytes.`);
console.log('Arten:',types.join(', '));
