// Step 1 of the measured estimate: draw a random sample of areas outside North Rhine-Westphalia.
// Random per federal state and size class, so that areas without an online council system are part of the result
// (they measure how much of the volume can be captured at all). The draw is reproducible: areas are ordered by a
// hash of their official key and a fixed seed.
// Source: Wikidata (municipality key P439, district key P440, population P1082, official website P856).
// Run: node scripts/estimate/draw-sample.mjs   →  tmp/sample/areas.json, tmp/sample/wikidata.json, tmp/sample/frame.json
import fs from 'node:fs';
import {sizeClass,FEDERAL_STATES} from '../../shared/estimate.mjs';
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const SEED='ratsmonitor-2026-10',dir='tmp/sample/';fs.mkdirSync(dir,{recursive:true});
// Five states with different municipal structures, plus the two large city states with their boroughs.
const STATES=['09','07','01','03','14'];
const PER_STATE={tiny:20,small:10,medium:8,large:99,xlarge:99,district:6,association:6};
const ASSOCIATIONS=['Q23006','Q2513995','Q478847','Q447523','Q15725618','Q251987'];
const run=async q=>{for(let attempt=1;;attempt++){try{const r=await fetch('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q),{headers:{'User-Agent':UA,Accept:'application/sparql-results+json'},signal:AbortSignal.timeout(150000)});if(!r.ok)throw Error('Wikidata HTTP '+r.status);return (await r.json()).results.bindings;}catch(e){if(attempt>=3)throw e;await new Promise(done=>setTimeout(done,5000*attempt));}}};
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return h>>>0;};
const shuffled=list=>[...list].sort((a,b)=>fnv(SEED+a.key)-fnv(SEED+b.key)||a.key.localeCompare(b.key));
const latest=rows=>{const m=new Map();for(const r of rows){const old=m.get(r.key);if(!old||(r.date||'')>(old.date||'')||(!old.website&&r.website))m.set(r.key,{...old,...r,website:r.website||old?.website||null});}return [...m.values()];};
const cacheFile=dir+'frame.json';
let frame;
if(process.argv.includes('--offline')&&fs.existsSync(cacheFile))frame=JSON.parse(fs.readFileSync(cacheFile,'utf8'));
else {
 frame={municipalities:[],districts:[],associations:[],boroughs:[]};
 for(const state of [...STATES,'11','02']){
  const rows=await run(`SELECT ?key ?label ?pop ?date ?website WHERE { ?item wdt:P439 ?key. FILTER(STRSTARTS(?key,"${state}")) ?item p:P1082 ?st. ?st ps:P1082 ?pop; a wikibase:BestRank. OPTIONAL{?st pq:P585 ?date} OPTIONAL{?item wdt:P856 ?website} FILTER NOT EXISTS{?item wdt:P576 ?end} ?item rdfs:label ?label. FILTER(LANG(?label)="de") }`);
  frame.municipalities.push(...latest(rows.map(b=>({key:b.key.value,label:b.label.value,pop:Number(b.pop.value),date:b.date?.value?.slice(0,10)||null,website:b.website?.value||null}))).filter(r=>/^\d{8}$/.test(r.key)&&r.pop>0&&(r.date||'')>='2022'));
  const districts=await run(`SELECT ?key ?label ?website WHERE { ?item wdt:P440 ?key. FILTER(STRSTARTS(?key,"${state}")) OPTIONAL{?item wdt:P856 ?website} FILTER NOT EXISTS{?item wdt:P576 ?end} ?item rdfs:label ?label. FILTER(LANG(?label)="de") }`);
  frame.districts.push(...latest(districts.map(b=>({key:b.key.value,label:b.label.value,website:b.website?.value||null}))).filter(r=>/^\d{5}$/.test(r.key)));
  console.log('Land',state,'Gemeinden',frame.municipalities.filter(m=>m.key.startsWith(state)).length,'Kreisschlüssel',frame.districts.filter(d=>d.key.startsWith(state)).length);
 }
 // Municipal associations (Verbandsgemeinde, Amt, Samtgemeinde, Verwaltungsgemeinschaft): their own councils meet as well.
 const associations=await run(`SELECT ?item ?label ?pop ?website ?rs WHERE { VALUES ?class {${ASSOCIATIONS.map(q=>'wd:'+q).join(' ')}} ?item wdt:P31 ?class. ?item wdt:P17 wd:Q183. FILTER NOT EXISTS{?item wdt:P576 ?end} OPTIONAL{?item wdt:P1082 ?pop} OPTIONAL{?item wdt:P856 ?website} OPTIONAL{?item wdt:P1388 ?rs} ?item rdfs:label ?label. FILTER(LANG(?label)="de") }`);
 const seen=new Map();for(const b of associations){const key=b.item.value.split('/').pop(),old=seen.get(key)||{};seen.set(key,{key,label:b.label.value,pop:Math.max(old.pop||0,Number(b.pop?.value||0)),website:old.website||b.website?.value||null,state:old.state||(b.rs?.value||'').slice(0,2)||null});}
 frame.associations=[...seen.values()];
 // Boroughs of Berlin and Hamburg have their own assemblies.
 const boroughs=await run(`SELECT ?item ?label ?pop ?website ?city WHERE { VALUES (?city ?class) {(wd:Q1055 wd:Q278976)} ?item wdt:P31 ?class. OPTIONAL{?item wdt:P1082 ?pop} OPTIONAL{?item wdt:P856 ?website} ?item rdfs:label ?label. FILTER(LANG(?label)="de") }`);
 const berlin=await run(`SELECT ?item ?label ?pop ?website WHERE { ?item wdt:P31/wdt:P279* wd:Q821435. FILTER NOT EXISTS{?item wdt:P576 ?end} OPTIONAL{?item wdt:P1082 ?pop} OPTIONAL{?item wdt:P856 ?website} ?item rdfs:label ?label. FILTER(LANG(?label)="de") }`).catch(()=>[]);
 const unique=(rows,state)=>{const m=new Map();for(const b of rows){const key=b.item.value.split('/').pop(),old=m.get(key)||{};m.set(key,{key,label:b.label.value,pop:Math.max(old.pop||0,Number(b.pop?.value||0)),website:old.website||b.website?.value||null,state});}return [...m.values()];};
 frame.boroughs=[...unique(boroughs,'02'),...unique(berlin,'11')];
 fs.writeFileSync(cacheFile,JSON.stringify(frame));
}
const groups=new Map();for(const m of frame.municipalities){const k=m.key.slice(0,5);groups.set(k,[...(groups.get(k)||[]),m]);}
const areas=[];
const add=(level,kind,key,label,pop,state,website,stratum)=>areas.push({id:'de-'+key,name:label,shortName:label,kind,level,ags:key,state,stateName:FEDERAL_STATES[state],population:pop,class:level==='municipality'?sizeClass('city',pop):level,stratum,website});
for(const state of STATES){
 const own=frame.municipalities.filter(m=>m.key.startsWith(state));
 for(const c of ['tiny','small','medium','large','xlarge'])for(const m of shuffled(own.filter(m=>sizeClass('city',m.pop)===c)).slice(0,PER_STATE[c]))add('municipality','city',m.key,m.label,m.pop,state,m.website,state+':'+c);
 const districts=frame.districts.filter(d=>d.key.startsWith(state)&&groups.has(d.key)&&!groups.get(d.key).some(m=>m.key===d.key+'000'));
 for(const d of shuffled(districts).slice(0,PER_STATE.district))add('district','district',d.key,d.label,groups.get(d.key).reduce((n,m)=>n+m.pop,0),state,d.website,state+':district');
 for(const a of shuffled(frame.associations.filter(a=>a.state===state&&a.pop>0)).slice(0,PER_STATE.association))add('association','city',a.key,a.label,a.pop,state,a.website,state+':association');
}
// The city states themselves and all their boroughs.
for(const state of ['11','02']){for(const m of frame.municipalities.filter(m=>m.key.startsWith(state)))add('municipality','city',m.key,m.label,m.pop,state,m.website,state+':xlarge');for(const b of frame.boroughs.filter(b=>b.state===state))add('borough','city',b.key,b.label,b.pop,state,b.website,state+':borough');}
fs.writeFileSync(dir+'areas.json',JSON.stringify(areas,null,1));
fs.writeFileSync(dir+'wikidata.json',JSON.stringify(areas.map(a=>({ags:a.ags,kind:a.kind,label:a.name,website:a.website})),null,1));
const by={};for(const a of areas)by[a.stratum]=(by[a.stratum]||0)+1;
console.log(areas.length,'Gebiete gezogen | ohne Website',areas.filter(a=>!a.website).length,'| Verbände im Rahmen',frame.associations.length,'davon mit Land',frame.associations.filter(a=>a.state).length,'| Bezirke',frame.boroughs.length);
console.log(Object.entries(by).map(([k,n])=>k+'='+n).join('  '));
