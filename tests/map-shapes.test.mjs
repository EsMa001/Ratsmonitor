import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/data/de_map.json' with {type:'json'};
import {CATALOG} from '../shared/catalog.mjs';
import {mapShapes,decodeArc} from '../shared/map-shapes.mjs';

const {shapes,states,free}=mapShapes(data,CATALOG);
test('every area of the catalog has an area on the one map of search and atlas',()=>{
 const city=new Map(shapes.filter(s=>s.kind==='city').map(s=>[s.id,s])),district=new Map(shapes.filter(s=>s.kind==='district').map(s=>[s.id,s]));
 for(const r of CATALOG){
  const s=(r.kind==='district'?district:city).get(r.id);
  assert.ok(s&&/^M[-.\d]/.test(s.path)&&s.path.endsWith('z')&&s.bounds.every(Number.isFinite),r.id);
 }
 // Kreisebene: jeder Kreis der Karte genau einmal, als Kreis des Katalogs oder als kreisfreie Stadt
 assert.equal(district.size,data.krs.a.length);
 assert.equal(states.length,16);
});
test('each municipality of the map belongs to exactly one area of the catalog, unless it is unincorporated',()=>{
 const owner=new Map();
 for(const r of CATALOG)if(r.kind!=='district')for(const ags of r.members?.length?r.members.map(m=>m.ags):[r.ags]){assert.ok(!owner.has(ags),ags);owner.set(ags,r.id);}
 data.gem.a.forEach((ags,i)=>{if(data.gem.b[i]===2)assert.ok(!owner.has(ags),ags);else assert.ok(owner.has(ags),ags+' '+data.gem.n[i]);});
 for(const ags of owner.keys())assert.ok(data.gem.a.includes(ags),'Katalog-Gemeinde ohne Fläche: '+ags);
 assert.equal(free.length,data.gem.b.filter(b=>b===2).length);
});
test('paths keep the coordinates of the map (km, y downwards, 100 m)',()=>{
 const i=data.gem.a.indexOf('05558008'),ai=data.gem.g[i][0][0][0],arc=decodeArc(data.arcs[ai<0?~ai:ai]);
 const s=shapes.find(r=>r.ags==='05558008');
 const [x0,y0,x1,y1]=s.bounds,x=arc[0]/100,y=-arc[1]/100;
 assert.ok(x>=x0-.1&&x<=x1+.1&&y>=y0-.1&&y<=y1+.1,JSON.stringify({x,y,b:s.bounds}));
});
