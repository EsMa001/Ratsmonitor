// Flächen der Gebiete als SVG-Pfade aus der einen Gemeindekarte (public/data/de_map.json, BKG VG250, scripts/build-map.mjs).
// Suche, Lückenatlas, Abrufkarte und eigenständiger Atlas zeichnen damit dieselben Grenzen; nur die Färbung unterscheidet sich.
// Ein Gebiet der Gemeindeebene ist die Fläche seiner Gemeinde bzw. die seiner Mitgliedsgemeinden (Gemeindeverband), ein Kreis
// die Fläche des Kreises; kreisfreie Städte stehen auf der Kreisebene mit ihrer eigenen Kennung. Einheit der Pfade: km (UTM 32,
// y nach unten), auf 100 m gerundet.

/** Adresse der Karte; die Fassung im Parameter ändert sich mit neuen Grenzen. */
export const MAP_URL='/data/de_map.json?v=2025-1';

/** Dekodiert einen polyline-kodierten Arc (Google-Algorithmus, 10-m-Einheiten). */
export function decodeArc(s){
 const out=[];let i=0,x=0,y=0;
 const next=()=>{let r=0,sh=0,b;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5;}while(b>=32);return r&1?~(r>>1):r>>1;};
 while(i<s.length){x+=next();y+=next();out.push(x,y);}
 return Int32Array.from(out);
}

const num=v=>{const s=(v/10).toFixed(1).replace(/\.0$/,'');return s.replace(/^(-?)0\./,'$1.');};

/**
 * Baut die Flächen. catalog: Gebiete mit id, ags, kind ('city'|'district'), members [{ags}].
 * Ergebnis: shapes [{id, ags, kind, path, bounds}], states [Pfad je Land], free [{ags, name, land, path, bounds}].
 */
export function mapShapes(data,catalog){
 const arcs=data.arcs.map(decodeArc);
 // Ein Ring als Pfad: absolute Punkte auf 100 m gerundet, als Abstände geschrieben (kurz und ohne Rundungsdrift).
 const ringPath=(ring,b)=>{
  let d='',px=0,py=0,first=true;
  for(const ai of ring){
   const rev=ai<0,a=arcs[rev?~ai:ai],n=a.length>>1;
   for(let j=first?0:1;j<n;j++){
    const t=rev?n-1-j:j,x=Math.round(a[2*t]/10),y=-Math.round(a[2*t+1]/10);
    if(x<b[0])b[0]=x;if(y<b[1])b[1]=y;if(x>b[2])b[2]=x;if(y>b[3])b[3]=y;
    if(first&&j===0)d+='M'+num(x)+' '+num(y);
    else if(x!==px||y!==py){const dx=num(x-px),dy=num(y-py);d+='l'+dx+(dy.startsWith('-')?'':' ')+dy;}
    px=x;py=y;
   }
   first=false;
  }
  return d+'z';
 };
 const layer=L=>L.g.map(polys=>{const b=[Infinity,Infinity,-Infinity,-Infinity];let d='';for(const poly of polys)for(const ring of poly)d+=ringPath(ring,b);return {d,b};});
 const gem=layer(data.gem),krs=layer(data.krs),land=layer(data.land);
 const gemAt=new Map(data.gem.a.map((a,i)=>[a,i])),krsAt=new Map(data.krs.a.map((a,i)=>[a,i]));
 const km=b=>b.map(v=>v/10);
 const union=parts=>{const b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of parts){b[0]=Math.min(b[0],p.b[0]);b[1]=Math.min(b[1],p.b[1]);b[2]=Math.max(b[2],p.b[2]);b[3]=Math.max(b[3],p.b[3]);}return km(b);};
 const shapes=[],cityByAgs=new Map();
 for(const r of catalog){
  if(r.kind==='district'){const i=krsAt.get(r.ags.slice(0,5));if(i!==undefined)shapes.push({id:r.id,ags:r.ags,kind:'district',path:krs[i].d,bounds:km(krs[i].b)});continue;}
  const parts=(r.members?.length?r.members.map(m=>m.ags):[r.ags]).map(a=>gem[gemAt.get(a)]).filter(Boolean);
  if(!parts.length)continue;
  shapes.push({id:r.id,ags:r.ags,kind:'city',path:parts.map(p=>p.d).join(''),bounds:union(parts)});
  cityByAgs.set(r.ags,r);
 }
 // Kreisfreie Städte (Kreis ohne eigenes Kreisgebiet im Katalog) auf der Kreisebene
 const districts=new Set(catalog.filter(r=>r.kind==='district').map(r=>r.ags.slice(0,5)));
 data.krs.a.forEach((a,i)=>{if(districts.has(a))return;const city=cityByAgs.get(a+'000');if(city)shapes.push({id:city.id,ags:city.ags,kind:'district',path:krs[i].d,bounds:km(krs[i].b)});});
 const free=[];
 data.gem.a.forEach((a,i)=>{if(data.gem.b?.[i]===2)free.push({ags:a,name:data.gem.n[i],land:a.slice(0,2),path:gem[i].d,bounds:km(gem[i].b)});});
 return {shapes,states:land.map(l=>l.d),free};
}
