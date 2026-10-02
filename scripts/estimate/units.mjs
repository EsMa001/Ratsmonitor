// Step 2b of the measured estimate: decide for every sampled area which unit runs its council business and which
// source was found for it.
// In most states a municipal association (Verbandsgemeinde, Amt, Samtgemeinde, Verwaltungsgemeinschaft) keeps one
// council information system for itself and all its member municipalities; the member's website links to it.
// A sampled member municipality therefore stands for its association as a whole.
//   node scripts/estimate/units.mjs prepare   → tmp/sample/units.json, candidates-units.json (then verify, see below)
//   node scripts/estimate/units.mjs           → tmp/sample/sources.json: one row per unit with source and outcome
// DIR=tmp/sample2/ selects another sample folder.
// Verification of the units between the two calls:
//   DIR=tmp/sample/ AREAS=tmp/sample/units.json CANDIDATES=candidates-units.json OUT=verified-units.json TRUST_LINK=1 node scripts/source-discovery/verify.mjs
import fs from 'node:fs';
import {FEDERAL_STATES} from '../../shared/estimate.mjs';
const UA='Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),dir=process.env.DIR||'tmp/sample/',optional=file=>fs.existsSync(dir+file)?read(dir+file):{};
const areas=read(dir+'areas.json'),candidates=read(dir+'candidates.json'),verified=read(dir+'verified.json');
const latest=new Map();for(const r of read('tmp/population/municipalities.json')){if(!/^\d{8}$/.test(r.key))continue;const old=latest.get(r.key);if(!old||(r.date||'')>(old.date||''))latest.set(r.key,r);}
const population=new Map([...latest.values()].filter(r=>r.pop>0&&(r.date||'')>='2022').map(r=>[r.key,r.pop]));
const regional=new Map(read('tmp/population/regional-keys.json').filter(r=>/^\d{12}$/.test(r.rs)&&population.has(r.key)).map(r=>[r.key,r.rs.slice(0,9)]));
const members=new Map();for(const [key,rs] of regional)members.set(rs,[...(members.get(rs)||[]),key]);
// Baden-Württemberg: members of an administrative association keep their own council system and stay units of their own
// (the same rule as in scripts/build-population.mjs).
const INDEPENDENT_MEMBERS=new Set(['08']);
const association=key=>{const rs=INDEPENDENT_MEMBERS.has(key.slice(0,2))?null:regional.get(key);return rs&&members.get(rs).length>=2?rs:null;};
const sampledMembers=areas.filter(a=>a.level==='municipality'&&association(a.ags));
// One unit per association that a sampled municipality belongs to.
const units=new Map();
for(const a of sampledMembers){
 const rs=association(a.ags),id='de-verband-'+rs,state=rs.slice(0,2);
 if(!units.has(id))units.set(id,{id,name:'',kind:'city',level:'association',ags:rs,state,stateName:FEDERAL_STATES[state],population:members.get(rs).reduce((n,key)=>n+population.get(key),0),memberCount:members.get(rs).length,class:'association',stratum:state+':association',sampledVia:[]});
 units.get(id).sampledVia.push(a.id);
}
const byId=new Map(areas.map(a=>[a.id,a]));
if(process.argv[2]==='prepare'){
 // Names of the associations: the administrative unit a member municipality is located in (Wikidata P131).
 const names=new Map(),keys=sampledMembers.map(a=>a.ags);
 for(let i=0;i<keys.length;i+=50){
  const q=`SELECT ?key ?label WHERE { VALUES ?key {${keys.slice(i,i+50).map(k=>'"'+k+'"').join(' ')}} ?m wdt:P439 ?key. ?m wdt:P131 ?a. ?a wdt:P31 ?c. VALUES ?c {wd:Q23006 wd:Q2513995 wd:Q478847 wd:Q447523 wd:Q15725618 wd:Q251987} ?a rdfs:label ?label. FILTER(LANG(?label)="de") }`;
  try{const r=await fetch('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q),{headers:{'User-Agent':UA,Accept:'application/sparql-results+json'},signal:AbortSignal.timeout(120000)});if(r.ok)for(const b of (await r.json()).results.bindings)names.set(association(b.key.value),b.label.value);}catch{}
 }
 const unitCandidates={};
 for(const u of units.values()){
  u.name=u.shortName=names.get(u.ags)||`Verband von ${byId.get(u.sampledVia[0]).name} (${u.memberCount} Gemeinden)`;
  unitCandidates[u.id]={id:u.id,name:u.name,kind:'city',candidates:[]};
  for(const via of u.sampledVia)for(const c of candidates[via]?.candidates||[])if(!unitCandidates[u.id].candidates.some(x=>x.url===c.url))unitCandidates[u.id].candidates.push(c);
 }
 fs.writeFileSync(dir+'units.json',JSON.stringify([...units.values()],null,1));
 fs.writeFileSync(dir+'candidates-units.json',JSON.stringify(unitCandidates,null,1));
 console.log('gezogene Gemeinden',areas.filter(a=>a.level==='municipality').length,'| Mitglied eines Verbands',sampledMembers.length,'| Verbandseinheiten',units.size,'| mit Link',Object.values(unitCandidates).filter(u=>u.candidates.length).length,'| benannt',names.size);
 process.exit(0);
}
const named=new Map(read(dir+'units.json').map(u=>[u.id,u])),retry=optional('verified-retry.json'),verifiedUnits=optional('verified-units.json'),unitCandidates=optional('candidates-units.json');
const boroughs=fs.existsSync(dir+'boroughs.json')?read(dir+'boroughs.json'):[];
const addressOf=source=>source.system||source.base;
const outcome=(check,linked)=>{
 const systems=(check?.systems||[]).filter(s=>s!=='unknown'),blocked=(check?.tried||[]).some(t=>t.status===403);
 if(systems.length||blocked)return {outcome:'unreadable',system:systems[0]||'gesperrt'};
 return {outcome:linked?'link':'none',system:null};
};
const rows=[];
const row=(a,check,linked)=>{
 const source={...check?.accepted};delete source.evidence;
 return {id:a.id,name:a.name,level:a.level,state:a.state,stateName:a.stateName,population:a.population,class:a.class,members:a.memberCount||null,sampledVia:a.sampledVia||null,...(check?.accepted?{outcome:'connected',system:source.adapter||(source.method==='oparl'?'oparl':'sessionnet'),source}:outcome(check,linked))};
};
for(const a of areas){
 // The city states themselves have state parliaments, not councils; their boroughs are the municipal level.
 if(a.level==='municipality'&&(a.state==='11'||a.state==='02'))continue;
 if(a.level==='borough'){
  if(!(a.population>100000&&a.website))continue;
  // Checked by hand: all boroughs of Berlin and Hamburg run ALLRIS without a readable interface (tmp/sample/boroughs.json).
  rows.push({...row(a,null,false),outcome:boroughs.length?'unreadable':'none',system:boroughs.length?'allris':null});continue;
 }
 if(a.level==='municipality'&&association(a.ags))continue;
 const check=verified[a.id]?.accepted?verified[a.id]:retry[a.id]?.accepted?retry[a.id]:verified[a.id];
 rows.push(row(a,check,!!candidates[a.id]?.candidates?.length));
}
for(const u of units.values()){
 const unit={...u,...named.get(u.id)},own=u.sampledVia.map(id=>verified[id]).find(v=>v?.accepted);
 const check=verifiedUnits[u.id]?.accepted?verifiedUnits[u.id]:own||verifiedUnits[u.id]||u.sampledVia.map(id=>verified[id]).find(v=>v&&(v.systems||[]).some(s=>s!=='unknown'));
 const r=row(unit,check,!!unitCandidates[u.id]?.candidates?.length);
 // An OParl system of an association lists one body per member municipality; the unit is all of them together.
 if(r.source?.method==='oparl'){delete r.source.body;r.source.allBodies=true;}
 rows.push(r);
}
// The same association can be drawn directly and through a member: keep one row per source address.
const seen=new Set(),unique=rows.filter(r=>{if(!r.source)return true;const key=addressOf(r.source);if(seen.has(key))return false;seen.add(key);return true;});
fs.writeFileSync(dir+'sources.json',JSON.stringify(unique,null,1));
const table={};for(const r of unique){table[r.class]=table[r.class]||{connected:0,unreadable:0,link:0,none:0};table[r.class][r.outcome]++;}
console.log(unique.length,'Einheiten (',rows.length-unique.length,'doppelt )');for(const [k,t] of Object.entries(table))console.log(' ',k.padEnd(12),JSON.stringify(t));
