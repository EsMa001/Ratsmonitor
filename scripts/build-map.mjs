// BKG WFS GeoJSON downloaded to tmp/vg-{lan,krs,billerbeck}.json.
// SVG paths are computed from published geometries, never drawn by hand.
import fs from 'node:fs';
const project=([lon,lat])=>[(lon-5.6)*60,(55.2-lat)*96];
function shape(f){let points=[];const poly=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];const path=poly.map(p=>p.map(r=>{const xy=r.map(project);points.push(...xy);return xy.map((v,i)=>(i?'L':'M')+v.map(n=>n.toFixed(2)).join(',')).join('')+'Z'}).join('')).join('');const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];return {path,bounds,center:[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2]};}
const states=JSON.parse(fs.readFileSync('tmp/vg-lan.json')).features.map(f=>({id:f.properties.objid,name:f.properties.gen,...shape(f)}));
const ids={'Coesfeld':'coesfeld','Steinfurt':'steinfurt','Borken':'borken','Warendorf':'warendorf','Recklinghausen':'recklinghausen','Münster':'muenster'};
const regions=JSON.parse(fs.readFileSync('tmp/vg-krs.json')).features.filter(f=>ids[f.properties.gen]).map(f=>({id:ids[f.properties.gen],name:f.properties.gen,ags:f.properties.ags,...shape(f)}));
const city=JSON.parse(fs.readFileSync('tmp/vg-billerbeck.json')).features[0];regions.push({id:'billerbeck',name:'Billerbeck',ags:city.properties.ags,...shape(city)});
const minX=Math.min(...regions.map(r=>r.bounds[0]))-6,minY=Math.min(...regions.map(r=>r.bounds[1]))-6,maxX=Math.max(...regions.map(r=>r.bounds[2]))+6,maxY=Math.max(...regions.map(r=>r.bounds[3]))+6;
const data={states,regions,viewBox:'0 0 600 790',regionViewBox:[minX,minY,maxX-minX,maxY-minY].join(' '),attribution:'© BKG (2026), dl-de/by-2-0',source:'https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf',retrievedAt:new Date().toISOString(),geometryDates:'Kreise/Länder VG2500: 31.12.2024; Billerbeck VG250: aktueller WFS-Abruf 26.09.2026'};
fs.writeFileSync('public/geo/germany.json',JSON.stringify(data));console.log('Map regions',regions.map(r=>r.id),fs.statSync('public/geo/germany.json').size);
