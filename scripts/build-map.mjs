// Karte der Suche (public/data/de_map.json) aus den aktuellen Verwaltungsgrenzen des BKG (VG250, dl-de/by-2-0).
// Vorher stand dort ein Stand von 2018: 287 Gemeinden, die seitdem fusioniert oder umbenannt sind (Eisenach, Wesertal,
// Ingelheim …), bekamen keine Berichte, weil ihre alten Schlüssel im Katalog nicht mehr vorkommen.
//
// Format wie bisher (components/ratsmonitor/types.ts, MapData; gelesen von lib/geo/geoModel.ts):
// - Koordinaten in UTM 32 (EPSG:25832), x=(Ost−x0)/q, y=(Nord−y0)/q, q=10 m.
// - arcs: gemeinsame Kanten benachbarter Flächen, jede genau einmal, Polyline-kodiert; ac: Art jeder Kante
//   (0 Gemeinde, 1 Kreis, 2 Land, 3 Staatsgrenze/Küste).
// - gem, krs, land: Flächen als Polygone aus Ringen von Kanten-Nummern (~i = umgekehrt); a Schlüssel, n Name, b Art,
//   p Beschriftungspunkt; gem.k Kreis, krs.l Land (Indizes).
// - aus (Umrisse der Nachbarstaaten) wird aus der bisherigen Datei übernommen.
// Kreise und Länder werden aus den Kanten der Gemeinden zusammengesetzt, damit alle Ebenen genau aufeinander passen.
// Jede Kante wird einmal vereinfacht (Douglas-Peucker), so entstehen zwischen Nachbarn keine Lücken.
//
// Aufruf: node scripts/build-map.mjs [--tolerance 2.5]   (lädt fehlende Eingaben nach tmp/map/; vorhandene werden genutzt)
// Danach MAP_URL in components/ratsmonitor/state/data.tsx auf die neue Version setzen.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SOURCE_USER_AGENT} from '../server/integrations/no-redirect.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=path.join(root,'tmp','map');fs.mkdirSync(tmp,{recursive:true});
const out=path.join(root,'public','data','de_map.json');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:fallback;};
const TOLERANCE=Number(arg('--tolerance','2.5'));
const Q=10,X0=220000,Y0=5175000;
const pause=ms=>new Promise(r=>setTimeout(r,ms));

/** Alle Objekte einer VG250-Ebene in UTM 32, seitenweise; nur Landflächen (gf=4). */
async function layer(name){
 const file=path.join(tmp,name+'.json');
 if(!fs.existsSync(file)){
  const features=[];let matched=Infinity;
  for(let start=0;features.length<matched;start=features.length){
   const url='https://sgx.geodatenzentrum.de/wfs_vg250?'+new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',outputFormat:'application/json',srsName:'EPSG:25832',TYPENAMES:'vg250:'+name,count:'2000',startIndex:String(start),sortBy:'objid'});
   const r=await fetch(url,{headers:{'User-Agent':SOURCE_USER_AGENT},signal:AbortSignal.timeout(300000)});
   if(!r.ok)throw Error(`VG250 ${name} HTTP ${r.status}`);
   const page=await r.json();matched=page.numberMatched??page.features.length;if(!page.features.length)break;
   features.push(...page.features);process.stdout.write(`${name}: ${features.length}/${matched}\r`);await pause(1600);
  }
  if(features.length<matched)throw Error(`VG250 ${name}: ${features.length} von ${matched} Objekten gelesen`);
  fs.writeFileSync(file,JSON.stringify({features}));console.log();
 }
 return JSON.parse(fs.readFileSync(file,'utf8')).features.filter(f=>f.properties.gf===4);
}

const key=(x,y)=>x*1e6+y;
/** Ringe eines (Multi-)Polygons in Karteneinheiten, ohne doppelte Punkte, geschlossen. */
function rings(geometry){
 const polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 return polys.map(poly=>poly.map(ring=>{
  const pts=[];for(const [e,n] of ring){const x=Math.round((e-X0)/Q),y=Math.round((n-Y0)/Q);const l=pts.at(-1);if(!l||l[0]!==x||l[1]!==y)pts.push([x,y]);}
  if(pts.length>1&&(pts[0][0]!==pts.at(-1)[0]||pts[0][1]!==pts.at(-1)[1]))pts.push(pts[0]);
  return pts;
 }).filter(r=>r.length>=4)).filter(p=>p.length);
}

/** Douglas-Peucker auf einer offenen Punktfolge; Anfang und Ende bleiben. */
function simplify(pts,t){
 if(pts.length<=2)return pts;
 const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const stack=[[0,pts.length-1]];
 while(stack.length){const [a,b]=stack.pop();const [ax,ay]=pts[a],[bx,by]=pts[b];const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);let best=-1,bi=-1;
  for(let i=a+1;i<b;i++){const [px,py]=pts[i];const d=len?Math.abs(dy*px-dx*py+bx*ay-by*ax)/len:Math.hypot(px-ax,py-ay);if(d>best){best=d;bi=i;}}
  if(best>t){keep[bi]=1;stack.push([a,bi],[bi,b]);}}
 return pts.filter((p,i)=>keep[i]);
}

/** Polyline-Kodierung wie decodeArc in geoModel.ts (Differenzen, beginnend bei 0,0). */
function encode(pts){
 let s='',px=0,py=0;
 const num=v=>{let r=v<0?((~v)<<1)|1:v<<1;let o='';while(r>=32){o+=String.fromCharCode((32|(r&31))+63);r>>=5;}return o+String.fromCharCode(r+63);};
 for(const [x,y] of pts){s+=num(x-px)+num(y-py);px=x;py=y;}
 return s;
}

/** Punkt sicher in der Fläche: Mitte des breitesten Abschnitts einer waagrechten Linie durch den Schwerpunkt des größten Polygons. */
function labelPoint(polys){
 let best=null,bestArea=-1;
 for(const poly of polys){let a=0,cx=0,cy=0;const r=poly[0];for(let i=0;i<r.length-1;i++){const f=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1];a+=f;cx+=(r[i][0]+r[i+1][0])*f;cy+=(r[i][1]+r[i+1][1])*f;}
  if(Math.abs(a)>bestArea){bestArea=Math.abs(a);best={poly,cx:a?cx/(3*a):r[0][0],cy:a?cy/(3*a):r[0][1]};}}
 const {poly,cx,cy}=best;const xs=[];
 for(const r of poly)for(let i=0;i<r.length-1;i++){const [x1,y1]=r[i],[x2,y2]=r[i+1];if((y1>cy)!==(y2>cy))xs.push(x1+(cy-y1)*(x2-x1)/(y2-y1));}
 xs.sort((a,b)=>a-b);let w=-1,mx=cx;for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>w){w=xs[i+1]-xs[i];mx=(xs[i]+xs[i+1])/2;}
 return [Math.round(mx),Math.round(cy)];
}

const GEM_B=bez=>/gemeindefrei/i.test(bez)?2:/stadt/i.test(bez)?1:0;
const KRS_B=bez=>({Landkreis:0,Kreis:1,'Kreisfreie Stadt':2,Stadtkreis:3})[bez]??0;

const [gemF,krsF,lanF]=[await layer('vg250_gem'),await layer('vg250_krs'),await layer('vg250_lan')];
const old=JSON.parse(fs.readFileSync(out,'utf8'));

// Gemeinden: ein Eintrag je Schlüssel (Exklaven als weitere Polygone).
const gems=new Map();
for(const f of gemF){const p=f.properties;const g=gems.get(p.ags)||{ags:p.ags,name:p.gen,bez:p.bez,polys:[]};g.polys.push(...rings(f.geometry));gems.set(p.ags,g);}
const gem=[...gems.values()].filter(g=>g.polys.length).sort((a,b)=>a.ags.localeCompare(b.ags));
const krsName=new Map(krsF.map(f=>[f.properties.ags,f.properties])),lanName=new Map(lanF.map(f=>[f.properties.ags.slice(0,2),f.properties]));

// Kanten: Besitzer jeder Strecke und Nachbarn jedes Punkts.
const owners=new Map(),nb=new Map();
const segKey=(a,b)=>{const ka=key(a[0],a[1]),kb=key(b[0],b[1]);return ka<kb?ka+':'+kb:kb+':'+ka;};
gem.forEach((g,gi)=>{for(const poly of g.polys)for(const r of poly)for(let i=0;i<r.length-1;i++){
 const k=segKey(r[i],r[i+1]);const o=owners.get(k);if(o){if(!o.includes(gi))o.push(gi);}else owners.set(k,[gi]);
 const ka=key(r[i][0],r[i][1]),kb=key(r[i+1][0],r[i+1][1]);(nb.get(ka)||nb.set(ka,new Set()).get(ka)).add(kb);(nb.get(kb)||nb.set(kb,new Set()).get(kb)).add(ka);}});
const ownersOf=(a,b)=>owners.get(segKey(a,b)).slice().sort((x,y)=>x-y).join(',');

// Ringe an Knoten (Punkte, an denen sich die Besitzer ändern oder mehr als zwei Strecken treffen) in Kanten teilen.
const arcs=[],arcIndex=new Map(),arcOwners=[];
function arcRef(pts){
 const k=pts.map(p=>key(p[0],p[1])).join(',');if(arcIndex.has(k))return arcIndex.get(k);
 const rk=pts.map(p=>key(p[0],p[1])).reverse().join(',');if(arcIndex.has(rk))return ~arcIndex.get(rk);
 arcIndex.set(k,arcs.length);arcs.push(pts);arcOwners.push(owners.get(segKey(pts[0],pts[1])));return arcs.length-1;
}
function ringToArcs(r){
 const n=r.length-1;const junction=i=>{const p=r[i],prev=r[(i-1+n)%n],next=r[(i+1)%n];return nb.get(key(p[0],p[1])).size>2||ownersOf(prev,p)!==ownersOf(p,next);};
 const js=[];for(let i=0;i<n;i++)if(junction(i))js.push(i);
 if(!js.length){
  // Ring ohne Knoten (Insel, Enklave): einheitlich am kleinsten Punkt beginnen, damit beide Seiten dieselbe Kante finden.
  let m=0;for(let i=1;i<n;i++)if(key(r[i][0],r[i][1])<key(r[m][0],r[m][1]))m=i;
  const rot=[...r.slice(m,n),...r.slice(0,m),r[m]];const rev=[...rot].reverse();
  const k=rot.map(p=>key(p[0],p[1])).join(','),rk=rev.map(p=>key(p[0],p[1])).join(',');
  if(arcIndex.has(k))return [arcIndex.get(k)];if(arcIndex.has(rk))return [~arcIndex.get(rk)];return [arcRef(rot)];
 }
 const refs=[];for(let j=0;j<js.length;j++){const a=js[j],b=js[(j+1)%js.length];const seg=[];for(let i=a;;i=(i+1)%n){seg.push(r[i]);if(i===b&&seg.length>1)break;}refs.push(arcRef(seg));}
 return refs;
}
const gemRings=gem.map(g=>g.polys.map(poly=>poly.map(ringToArcs)));

// Art jeder Kante: wer auf beiden Seiten liegt.
const ac=arcOwners.map(o=>{if(o.length<2)return 3;const [a,b]=o.map(i=>gem[i].ags);return a.slice(0,2)!==b.slice(0,2)?2:a.slice(0,5)!==b.slice(0,5)?1:0;}).join('');

// Kreise und Länder: Kanten, die innerhalb der Gruppe nur einmal vorkommen, zu Ringen verketten.
function group(keyOf){
 const groups=new Map();gem.forEach((g,gi)=>{const k=keyOf(g.ags);(groups.get(k)||groups.set(k,[]).get(k)).push(gi);});
 const res=[];
 for(const [k,members] of groups){
  const count=new Map();for(const gi of members)for(const poly of gemRings[gi])for(const ring of poly)for(const ref of ring){const i=ref<0?~ref:ref;count.set(i,(count.get(i)||0)+1);}
  const edges=[];for(const gi of members)for(const poly of gemRings[gi])for(const ring of poly)for(const ref of ring){const i=ref<0?~ref:ref;if(count.get(i)===1)edges.push(ref);}
  const start=ref=>{const a=arcs[ref<0?~ref:ref];const p=ref<0?a.at(-1):a[0];return key(p[0],p[1]);},end=ref=>{const a=arcs[ref<0?~ref:ref];const p=ref<0?a[0]:a.at(-1);return key(p[0],p[1]);};
  const byStart=new Map();for(const e of edges)(byStart.get(start(e))||byStart.set(start(e),[]).get(start(e))).push(e);
  const used=new Set(),ringsOut=[];
  for(const e of edges){if(used.has(e))continue;const ring=[e];used.add(e);let cur=e;
   while(end(cur)!==start(e)){const next=(byStart.get(end(cur))||[]).find(x=>!used.has(x));if(next===undefined)break;ring.push(next);used.add(next);cur=next;}
   ringsOut.push(ring);}
  res.push({key:k,members,polys:ringsOut.map(r=>[r])});
 }
 return res.sort((a,b)=>a.key.localeCompare(b.key));
}
const krs=group(a=>a.slice(0,5)),land=group(a=>a.slice(0,2));
const krsIdx=new Map(krs.map((k,i)=>[k.key,i])),landIdx=new Map(land.map((l,i)=>[l.key,i]));

// Vereinfachen und kodieren.
let points=0;const enc=arcs.map(a=>{let s=simplify(a,TOLERANCE);if(s.length<4&&a[0][0]===a.at(-1)[0]&&a[0][1]===a.at(-1)[1])s=simplify(a,TOLERANCE/4).length>=4?simplify(a,TOLERANCE/4):a;points+=s.length;return encode(s);});

const flat=ps=>ps.flat();
const data={q:Q,x0:X0,y0:Y0,arcs:enc,ac,
 gem:{g:gemRings,a:gem.map(g=>g.ags),n:gem.map(g=>g.name),b:gem.map(g=>GEM_B(g.bez)),k:gem.map(g=>krsIdx.get(g.ags.slice(0,5))),p:flat(gem.map(g=>labelPoint(g.polys)))},
 krs:{g:krs.map(k=>k.polys),a:krs.map(k=>k.key),n:krs.map(k=>krsName.get(k.key)?.gen??k.key),b:krs.map(k=>KRS_B(krsName.get(k.key)?.bez)),l:krs.map(k=>landIdx.get(k.key.slice(0,2))),
  p:flat(krs.map(k=>labelPoint(k.members.flatMap(i=>gem[i].polys))))},
 land:{g:land.map(l=>l.polys),a:land.map(l=>l.key),n:land.map(l=>lanName.get(l.key)?.gen??l.key)},
 aus:old.aus};
fs.writeFileSync(out,JSON.stringify(data));
console.log(JSON.stringify({gemeinden:gem.length,kreise:krs.length,laender:land.length,kanten:arcs.length,punkte:points,bytes:fs.statSync(out).size,stand:gemF.reduce((m,f)=>f.properties.beginn>m?f.properties.beginn:m,'')}));
