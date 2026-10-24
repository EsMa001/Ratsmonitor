// Lückenatlas: a standalone page (no website, no server) that shows for every area of the catalog whether it is
// connected, and if not, why. It reads only files of the repository and writes one HTML file with all data inside.
//
//   node scripts/dashboard/build.mjs                 # writes dashboard/luecken.html
//   OUT=pfad.html FRAGMENT=1 node scripts/dashboard/build.mjs   # page body only (for hosting inside another page)
//
// Access of every area (shared/source-access.mjs: OParl, then API, then HTML pages, where robots.txt gives the label;
// then a technical block, then nothing found): of a connected source from its reader and the robots.txt verdict, of an
// open area from the reason of its last check. Everything the page shows per area except the shapes is also written to
// server/integrations/source-atlas.json (default run only): the Lückenatlas of the administration reads it and adds
// what the database knows (reports, last import); the categories come from shared/atlas-categories.mjs.
//
// Reasons of open areas: preserve the saved atlas evidence; compare work files and reports
// using explicit check dates. Unknown chronology remains an auditable conflict.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CATALOG,POPULATION,landName} from '../../shared/catalog.mjs';
import {loadAtlasInputs,atlasEvidence,applyConsentEvidence} from '../source-discovery/atlas-inputs.mjs';
import {consentFor,consentsOf} from '../../server/integrations/consents.mjs';
import {ACCESS_STATUSES,accessOfSource,channelOf,robotsNote,methodName} from '../../shared/source-access.mjs';
import {ATLAS_CATEGORIES} from '../../shared/atlas-categories.mjs';
import {mapShapes} from '../../shared/map-shapes.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const exists=f=>fs.existsSync(path.join(root,f));
const robots=read('server/integrations/source-robots.json').sources;

const inputs=loadAtlasInputs({root});
const {sources,reportDate}=inputs;
const consentPath='server/integrations/source-consents.json';
for(const [id,resolution] of inputs.resolutions){
 const consent=consentsOf(id)[0];
 if(consent)inputs.resolutions.set(id,applyConsentEvidence(resolution,consent,{path:consentPath,pointer:`area:${id}`,sha256:inputs.manifest.find(m=>m.path===consentPath)?.sha256||null,consent}));
}
const reasons=new Map([...inputs.resolutions].filter(([,r])=>r.selected).map(([id,r])=>[id,r.selected]));
const unmatched=inputs.diagnostics.filter(d=>d.kind==='unmatched-report-row'||d.kind==='ambiguous-report-match');
const methodOf=methodName;

// Candidates of the research per Land and the list of areas to check again (scripts/source-discovery/candidates/).
const cand='scripts/source-discovery/candidates/';
const research=new Map();
for(const f of fs.readdirSync(path.join(root,cand)).filter(f=>/^research-.*\.json$/.test(f)))
 for(const r of Object.values(read(cand+f)))research.set(r.id,r.candidates.map(c=>({url:c.url,hint:c.research?.hinweis||'',proof:c.research?.beleg||''})));
const RECHECK={DE3:'Der verlinkte Treffer war ein Vorlese-, Teilen- oder Dienstlink; die Linksuche verwirft ihn jetzt und sucht weiter.',DE6:'Die Prüfung fragt jetzt die Einstiegsseite neben der verlinkten Adresse.',DE7:'ALLRIS 3 erkannt; dafür gibt es inzwischen einen Leser.',DE10:'Die Prüfung fragt jetzt die Wurzel des Rechners bzw. die Körperschaftsliste von More! Rubin.',FG4:'Kurz- oder Bindestrichname, unter dem das System das Gebiet führt, wird jetzt erkannt.',Anmeldebereich:'Der Link führte in den Anmeldebereich; jetzt wird der öffentliche Bereich daneben geprüft.'};
const recheck=new Map();
if(exists(cand+'neupruefung-2026-10-gruende.txt'))for(const line of fs.readFileSync(path.join(root,cand+'neupruefung-2026-10-gruende.txt'),'utf8').split('\n').filter(Boolean)){
 const [id,codes]=line.split(' | ')[0].split(' ');recheck.set(id,codes.split(',').map(c=>RECHECK[c]||c));
}

// Kartenformen aus derselben Gemeindekarte wie Suche und Lückenatlas (shared/map-shapes.mjs); je Gebiet eine Form, eine
// kreisfreie Stadt mit ihrer Fläche der Gemeindeebene.
const map=mapShapes(read('public/data/de_map.json'),CATALOG);
const shapeOf=new Map([...map.shapes.filter(r=>r.kind==='district'),...map.shapes.filter(r=>r.kind==='city')].map(r=>[r.id,r]));
const shapes=new Map([...shapeOf].map(([id,r])=>[id,r.path]));

const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch{return '';}};
const operator=u=>{const h=host(u);if(!h)return '';const p=h.split('.');return p.slice(-2).join('.').replace(/^more-rubin[0-9]*\.de$/,'more-rubin.de');};
const TYPE={city:null,district:'Kreis'};
const areas=CATALOG.map(r=>{
 const s=sources.get(r.id),o=reasons.get(r.id),url=s?(s.system||s.base||s.api||''):o?.url||'';
 const a={id:r.id,n:r.name,l:r.ags.slice(0,2),g:r.ags,t:TYPE[r.kind]||r.municipalityType||'Gemeinde',k:r.kind==='district'?'d':r.independent?'i':'c',p:POPULATION[r.id]||0,u:/^https?:/.test(url)?url:'',o:operator(url)};
 if(r.members?.length)a.m=r.members.length;
 // Switched on without a live check (citystate-sources.json: checkPending): shown apart from checked sources.
 if(s&&s.checkPending){a.c='ready';a.r=s.checkPending;a.v=methodOf(s);a.z=accessOfSource(s,robots[r.id]);a.zc=channelOf(s).name;}
 // robots.txt is recorded, not obeyed (server/integrations/robots-policy.mjs): its verdict stands in the detail view
 // only, in words that say whether it concerns HTML pages or an interface (for which it is not binding); a written
 // consent (source-consents.json) is shown there as well.
 else if(s){const c=robots[r.id]==='verboten'?consentFor(s.system||s.base):null;a.c='ok';a.v=methodOf(s);a.rb=robots[r.id]||'';a.rn=robotsNote(s,robots[r.id]);a.z=accessOfSource(s,robots[r.id]);a.zc=channelOf(s).name;a.at=s.verifiedAt||'';if(c)a.cs=c.date;}
 // Open evidence includes any consent overlay and preserves the original check.
 else if(o){a.c=o.category;a.r=o.reason;a.z=o.access;if(o.category==='consent')a.cs=consentsOf(r.id)[0]?.date||inputs.atlas.areas?.[r.id]?.cs;}
 else{a.c='other';a.r='Kein Prüfergebnis im Bericht';a.z='none';}
 // Candidates of the research help an open area only; a connected area has its source (its candidates would only
 // repeat old notes, such as the robots.txt of the Hamburg district systems that the CKAN interface does not need).
 if(research.has(r.id)&&!s)a.rs=research.get(r.id);
 if(recheck.has(r.id))a.nc=recheck.get(r.id);
 if(shapeOf.has(r.id))a.b=shapeOf.get(r.id).bounds;
 return a;
});

const data={
 builtAt:new Date().toISOString().slice(0,10),reportDate,
 lands:Object.fromEntries([...new Set(CATALOG.map(r=>r.ags.slice(0,2)))].sort().map(l=>[l,landName(l)])),
 areas,
 access:ACCESS_STATUSES.map(({id,label,group,automated,explain})=>({id,label,group,automated,explain})),
 categories:ATLAS_CATEGORIES,
 shapes:Object.fromEntries(areas.filter(a=>shapes.has(a.id)).map(a=>[a.id,shapes.get(a.id)])),
 states:map.states,
 attribution:'© GeoBasis-DE / BKG 2025, dl-de/by-2-0',
};
const missing=areas.filter(a=>!a.b).length;
const page=fs.readFileSync(path.join(root,'scripts/dashboard/page.html'),'utf8').replace('/*__DATA__*/null',()=>JSON.stringify(data).replace(/</g,'\\u003c'));
const out=process.env.OUT||'dashboard/luecken.html';
fs.mkdirSync(path.dirname(path.resolve(root,out)),{recursive:true});
fs.writeFileSync(path.resolve(root,out),process.env.FRAGMENT?page:'<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n'+page+'\n</body>\n</html>\n');
if(!process.env.OUT){
 // One line per area with what the administration cannot derive from catalog, sources and robots.txt verdicts
 // (admin-atlas.mjs): category, access, reason and found address of an open area, consent, recheck notes, research
 // candidates. Reasons and recheck notes once each (texts), referenced by index.
 const texts=[],index=new Map(),text=t=>{if(!index.has(t)){index.set(t,texts.length);texts.push(t);}return index.get(t);};
 const lines=areas.map(a=>{const row={c:a.c,z:a.z};if(a.r)row.r=text(a.r);if(!sources.has(a.id)&&reasons.get(a.id)?.url)row.u=reasons.get(a.id).url;if(a.cs)row.cs=a.cs;if(a.nc)row.nc=a.nc.map(text);if(a.rs)row.rs=a.rs;return ' '+JSON.stringify(a.id)+':'+JSON.stringify(row);});
 const target='server/integrations/source-atlas.json';
 fs.writeFileSync(path.join(root,target),'{"builtAt":'+JSON.stringify(data.builtAt)+',"reportDate":'+JSON.stringify(reportDate)+',"note":"Lückenatlas je Gebiet ohne Kartenformen (scripts/dashboard/build.mjs); Grund r und Neuprüfung nc als Index in texts.",\n"texts":'+JSON.stringify(texts)+',\n"areas":{\n'+lines.join(',\n')+'\n},\n\"evidenceVersion\":1,\n\"evidence\":'+JSON.stringify(atlasEvidence(inputs.resolutions))+'\n}\n');
 console.log(target+': '+areas.length+' Gebiete, '+texts.length+' Texte, '+(fs.statSync(path.join(root,target)).size/1e3).toFixed(0)+' KB');
}
const count=areas.reduce((m,a)=>(m[a.c]=(m[a.c]||0)+1,m),{}),access=areas.reduce((m,a)=>(m[a.z]=(m[a.z]||0)+1,m),{});
console.log(out+': '+areas.length+' Gebiete',JSON.stringify(count),'Zugang '+JSON.stringify(access),'ohne Kartenform '+missing,'Berichtszeilen ohne Gebiet '+unmatched.length,(fs.statSync(path.resolve(root,out)).size/1e6).toFixed(1)+' MB');

console.log('Prüfbelege: '+[...inputs.resolutions.values()].filter(r=>r.conflict).length+' offene Konflikte, '+[...inputs.resolutions.values()].filter(r=>r.decision==='newer-evidence').length+' belegte Aktualisierungen; Details: source-atlas.json/evidence bzw. connection-worklist.mjs');
