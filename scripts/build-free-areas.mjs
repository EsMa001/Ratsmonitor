// Gemeindefreie Gebiete (Forste, Seen, Truppenübungsplätze) für die Karte der Administration: Flächen ohne Rat und
// ohne Einwohner, die im Gebietskatalog fehlen (scripts/build-de.mjs und build-nds.mjs überspringen sie) und auf der
// Karte sonst als Löcher erscheinen. Der Lückenatlas zeichnet sie grau schraffiert und nicht anklickbar.
// Eingabe: BKG VG250 (vg250_gem mit bez „Gemeindefreies Gebiet“, alle Länder). Ausgabe: public/geo/de-free.json.
// Projektion und Vereinfachung wie scripts/build-de.mjs (dieselbe Karte). Aufruf: node scripts/build-free-areas.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FEDERAL_STATES} from '../shared/estimate.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),tmp=path.join(root,'tmp','de');
const UA={'User-Agent':'Ratsmonitor-SourceCatalog/1.0 (public council information; contact via github.com/EsMa001/Ratsmonitor)'};
fs.mkdirSync(tmp,{recursive:true});
const pause=ms=>new Promise(done=>setTimeout(done,ms));

async function freeAreas(){
 const file=path.join(tmp,'free-gem.json');
 if(!fs.existsSync(file)){
  const filter='<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo><fes:ValueReference>bez</fes:ValueReference><fes:Literal>Gemeindefreies Gebiet</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>';
  const features=[];let matched=Infinity;
  for(let start=0;features.length<matched;start=features.length){
   const url='https://sgx.geodatenzentrum.de/wfs_vg250?'+new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',outputFormat:'application/json',srsName:'EPSG:4326',TYPENAMES:'vg250:vg250_gem',FILTER:filter,...(start?{startIndex:String(start),sortBy:'ags'}:{})});
   const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(`VG250 gemeindefreie Gebiete HTTP ${r.status}`);
   const page=await r.json();matched=page.numberMatched??page.features.length;if(!page.features.length)break;features.push(...page.features);await pause(300);
  }
  if(features.length<matched)throw Error(`VG250: ${features.length} von ${matched} Objekten gelesen`);
  fs.writeFileSync(file,JSON.stringify({features}));
 }
 /* gf=4: Landflächen; gf=2 sind Doppel für Wasser- und Küstenflächen */
 return JSON.parse(fs.readFileSync(file,'utf8')).features.filter(f=>f.properties.gf===4);
}
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

const features=await freeAreas();
const byAgs=new Map();for(const f of features){const key=f.properties.ags||f.properties.ars;byAgs.set(key,[...(byAgs.get(key)||[]),f]);}
const areas=[...byAgs].map(([ags,list])=>({ags,land:ags.slice(0,2),name:list[0].properties.gen,...shape(list)})).sort((a,b)=>a.ags.localeCompare(b.ags));
const today=new Date().toISOString().slice(0,10);
fs.writeFileSync(path.join(root,'public','geo','de-free.json'),JSON.stringify({attribution:'© BKG (2026), dl-de/by-2-0',source:'https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf',retrievedAt:today,note:'Gemeindefreie Gebiete: keine Gemeinde, kein Rat, keine Einwohner (scripts/build-free-areas.mjs)',areas}));
const perLand={};for(const a of areas)perLand[a.land]=(perLand[a.land]||0)+1;
console.log(areas.length,'gemeindefreie Gebiete:',Object.entries(perLand).map(([l,n])=>`${FEDERAL_STATES[l]||l} ${n}`).join(', '));
