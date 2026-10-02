// Builds the population figures used by the Germany estimate in the administration:
//   shared/nrw-population.json      inhabitants of every NRW municipality and district of the catalog
//   shared/germany-population.json  inhabitants of every German municipality, district, municipal association and
//                                   city-state borough, by federal state — the frame the estimate is summed over
// Source: Wikidata (municipality key P439, regional key P1388, population P1082 as best-ranked value).
// Districts are the sum of their municipalities. Associations (Verbandsgemeinde, Amt, Samtgemeinde,
// Verwaltungsgemeinschaft) are the municipalities that share the first nine digits of the regional key;
// an association and its members form one unit of the frame, because they usually share one council system.
// Run: node scripts/build-population.mjs [--offline]   --offline reuses the answers stored in tmp/population/.
import fs from 'node:fs';
import {SIZE_CLASSES,FEDERAL_STATES,sizeClass} from '../shared/estimate.mjs';
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const dir='tmp/population/',offline=process.argv.includes('--offline');fs.mkdirSync(dir,{recursive:true});
async function query(q){for(let attempt=1;;attempt++){try{const r=await fetch('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q),{headers:{'User-Agent':UA,Accept:'application/sparql-results+json'},signal:AbortSignal.timeout(150000)});if(!r.ok)throw Error('Wikidata HTTP '+r.status);return (await r.json()).results.bindings;}catch(e){if(attempt>=3)throw e;await new Promise(done=>setTimeout(done,4000*attempt));}}}
// One query per federal state keeps each answer small enough for the public query service.
async function cached(name,fetchRows){const file=dir+name+'.json';if(offline&&fs.existsSync(file))return JSON.parse(fs.readFileSync(file,'utf8'));const rows=await fetchRows();fs.writeFileSync(file,JSON.stringify(rows));return rows;}
const perState=async build=>{const rows=[];for(let state=1;state<=16;state++){const prefix=String(state).padStart(2,'0'),part=await query(build(prefix));rows.push(...part);console.log('Land',prefix,part.length);}return rows;};
const rows=await cached('municipalities',async()=>(await perState(prefix=>`SELECT ?key ?pop ?date WHERE { ?item wdt:P439 ?key. FILTER(STRSTARTS(?key,"${prefix}")) ?item p:P1082 ?st. ?st ps:P1082 ?pop; a wikibase:BestRank. OPTIONAL{?st pq:P585 ?date} FILTER NOT EXISTS{?item wdt:P576 ?end} }`)).map(b=>({key:b.key.value,pop:Number(b.pop.value),date:b.date?.value?.slice(0,10)||null})));
const regionalKeys=await cached('regional-keys',async()=>(await perState(prefix=>`SELECT ?key ?rs WHERE { ?item wdt:P439 ?key. FILTER(STRSTARTS(?key,"${prefix}")) ?item wdt:P1388 ?rs. FILTER NOT EXISTS{?item wdt:P576 ?end} }`)).map(b=>({key:b.key.value,rs:b.rs.value})));
// Boroughs of Hamburg (class Q278976) and Berlin (class Q821435): only current ones carry inhabitants and a website.
const boroughRows=await cached('boroughs',async()=>{const out=[];for(const [state,cls] of [['02','Q278976'],['11','Q821435']]){const part=await query(`SELECT ?item ?pop ?website WHERE { ?item wdt:P31 wd:${cls}. FILTER NOT EXISTS{?item wdt:P576 ?end} ?item wdt:P1082 ?pop. ?item wdt:P856 ?website }`);const seen=new Map();for(const b of part)seen.set(b.item.value,Math.max(seen.get(b.item.value)||0,Number(b.pop.value)));out.push(...[...seen.values()].map(pop=>({state,pop})));}return out;});
// One current value per key: the latest dated figure. Entries without a figure since 2022 are dissolved
// municipalities that Wikidata does not mark as such, or areas without inhabitants.
const latest=new Map();
for(const r of rows){if(!/^\d{8}$/.test(r.key))continue;const old=latest.get(r.key);if(!old||(r.date||'')>(old.date||'')||((r.date||'')===(old.date||'')&&r.pop>old.pop))latest.set(r.key,r);}
const municipalities=[...latest.values()].filter(r=>r.pop>0&&(r.date||'')>='2022');
const population=new Map(municipalities.map(m=>[m.key,m.pop]));
const groupBy=(list,keyOf)=>{const groups=new Map();for(const item of list){const key=keyOf(item);if(key)groups.set(key,[...(groups.get(key)||[]),item]);}return groups;};
// A five-digit key is a district unless it consists of one district-free city (key ending in 000).
const districts=[...groupBy(municipalities,m=>m.key.slice(0,5))].filter(([key,members])=>!members.some(m=>m.key===key+'000')).map(([key,members])=>({key,pop:members.reduce((n,m)=>n+m.pop,0)}));
const regional=new Map(regionalKeys.filter(r=>/^\d{12}$/.test(r.rs)).map(r=>[r.key,r.rs]));
// Baden-Württemberg: the members of an administrative association keep their own town hall, council and council
// system; the association only carries out single tasks. There every municipality stays a unit of its own.
const INDEPENDENT_MEMBERS=new Set(['08']);
const associationGroups=[...groupBy(municipalities,m=>INDEPENDENT_MEMBERS.has(m.key.slice(0,2))?null:regional.get(m.key)?.slice(0,9))].filter(([,members])=>members.length>=2);
const associations=associationGroups.map(([key,members])=>({key,pop:members.reduce((n,m)=>n+m.pop,0),members:members.length}));
// A member municipality runs its council business through its association; in the frame it is part of that unit.
const memberKeys=new Set(associationGroups.flatMap(([,members])=>members.map(m=>m.key)));
const boroughs=boroughRows.filter(b=>b.pop>100000);
const total=municipalities.reduce((n,m)=>n+m.pop,0);
if(municipalities.length<10500||municipalities.length>11200||total<82e6||total>85e6||districts.length!==294||associations.length<850||associations.length>1050||boroughs.length!==19)throw Error(`Unplausible Daten: ${municipalities.length} Gemeinden, ${total} Einwohner, ${districts.length} Kreise, ${associations.length} Verbände, ${boroughs.length} Bezirke`);
// Berlin and Hamburg have no municipal council apart from the state parliament; their boroughs take their place.
const CITY_STATES=new Set(['11','02']);
const byState=(list,stateOf,keep=()=>true)=>Object.fromEntries(Object.keys(FEDERAL_STATES).sort().map(state=>[state,list.filter(x=>stateOf(x)===state&&keep(x)).map(x=>x.pop).sort((a,b)=>b-a)]));
const frame={
 source:'Wikidata: Gemeindeschlüssel (P439), Regionalschlüssel (P1388) und Einwohnerzahl (P1082); Kreise und Gemeindeverbände als Summe ihrer Gemeinden',
 populationYear:[...new Set(municipalities.map(m=>m.date.slice(0,4)))].sort().at(-1),builtAt:new Date().toISOString().slice(0,10),
 totals:{municipalities:municipalities.length,population:total,districts:districts.length,associations:associations.length,memberMunicipalities:memberKeys.size,boroughs:boroughs.length},
 // municipalities: only those outside an association; members are counted within their association.
 municipalities:byState(municipalities,m=>m.key.slice(0,2),m=>!CITY_STATES.has(m.key.slice(0,2))&&!memberKeys.has(m.key)),
 districts:byState(districts,d=>d.key.slice(0,2)),associations:byState(associations,a=>a.key.slice(0,2)),boroughs:byState(boroughs,b=>b.state),
 cityStates:Object.fromEntries([...CITY_STATES].map(state=>[state,municipalities.filter(m=>m.key.startsWith(state)).reduce((n,m)=>n+m.pop,0)])),
};
fs.writeFileSync('shared/germany-population.json',JSON.stringify(frame)+'\n');
const regions=JSON.parse(fs.readFileSync('shared/nrw-regions.json','utf8')),districtPopulation=new Map(districts.map(d=>[d.key,d.pop]));
const nrw={},missing=[];for(const r of regions){const value=r.kind==='city'?population.get(r.ags):districtPopulation.get(r.ags);if(value)nrw[r.id]=value;else missing.push(r.name);}
if(missing.length)throw Error('Ohne Einwohnerzahl: '+missing.join(', '));
fs.writeFileSync('shared/nrw-population.json',JSON.stringify(nrw,null,1)+'\n');
console.log(`${municipalities.length} Gemeinden, ${total.toLocaleString('de-DE')} Einwohner, ${districts.length} Kreise, ${associations.length} Gemeindeverbände, ${boroughs.length} Bezirke; NRW: ${Object.keys(nrw).length} Gebiete.`);
for(const c of SIZE_CLASSES.filter(c=>c.min!==undefined)){const members=Object.values(frame.municipalities).flat().filter(p=>sizeClass('city',p)===c.id);console.log(' ',c.name.padEnd(28),String(members.length).padStart(6),members.reduce((a,b)=>a+b,0).toLocaleString('de-DE').padStart(12));}
