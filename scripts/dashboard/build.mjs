// Lückenatlas: a standalone page (no website, no server) that shows for every area of the catalog whether it is
// connected, and if not, why. It reads only files of the repository and writes one HTML file with all data inside.
//
//   node scripts/dashboard/build.mjs                 # writes dashboard/luecken.html
//   OUT=pfad.html FRAGMENT=1 node scripts/dashboard/build.mjs   # page body only (for hosting inside another page)
//
// Reasons of open areas: the working files open.json of a search run (exact ids) where they exist
// (tmp/source-discovery*/open.json, see scripts/source-discovery/build.mjs), otherwise the tables of the reports in
// requirements/*-sources-report.md, matched by name within the Land.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CATALOG,POPULATION,landName} from '../../shared/catalog.mjs';
import {NRW_SOURCES} from '../../server/integrations/source-catalog.mjs';
import {SOURCES} from '../../server/integrations/regions.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const exists=f=>fs.existsSync(path.join(root,f));
const robots=read('server/integrations/source-robots.json').sources;

// Connected: every source of the catalog that is not switched off, plus the first sources of regions.mjs.
const sources=new Map(NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>[s.id,s]));
for(const id of ['billerbeck','coesfeld','steinfurt','borken','warendorf','recklinghausen','muenster'])if(!sources.has(id))sources.set(id,SOURCES.find(s=>s.id===id)||{id});

const METHOD={sdnet:'SD.NET',allris:'ALLRIS 4','more-rubin':'More! Rubin','cron-ratsinfo':'cron Ratsinfo',allris3:'ALLRIS 3',kic:'KIC-RIS',pio:'PIO',piwi:'PIWi',sessionnet6:'SessionNet 6','muenchen-risi':'RIS München','ti-generator':'TI-Generator',councilservice:'Sitzungsdienst mein-intra',website:'Website'};
const methodOf=s=>s.method==='oparl'?'OParl':METHOD[s.adapter]||(s.base||s.system?'SessionNet':'Stammquelle');

// Open areas with their reason.
const reasons=new Map();
for(const dir of ['tmp/source-discovery/','tmp/source-discovery-nds/','tmp/source-discovery-de/'])
 if(exists(dir+'open.json'))for(const o of read(dir+'open.json'))reasons.set(o.id,{reason:o.reason,url:o.link||''});
let reportDate='';const unmatched=[];
// Switched-off entries of the catalog (method "pending") name their reason in the note, as in the report of build.mjs.
const switchedOff=new Set();
for(const s of NRW_SOURCES)if(s.method==='pending'&&s.note){reasons.set(s.id,{reason:s.note,url:s.system||s.base||''});switchedOff.add(s.id);}
for(const [file,lands] of [['requirements/statewide-sources-report.md',['05']],['requirements/nds-sources-report.md',['03']],['requirements/de-sources-report.md',null]]){
 const text=fs.readFileSync(path.join(root,file),'utf8');
 reportDate=reportDate||(text.match(/Stand: ([0-9.]+)/)||[])[1]||'';
 const rows=text.slice(text.indexOf('## Nicht angebundene Gebiete')).split('\n').filter(l=>l.startsWith('| ')&&!l.startsWith('| Gebiet')).map(l=>l.split('|').map(c=>c.trim()));
 for(const c of rows){
  const list=CATALOG.filter(r=>r.name===c[1]&&(lands?lands.includes(r.ags.slice(0,2)):!['03','05'].includes(r.ags.slice(0,2)))&&!sources.has(r.id));
  const r=list.find(x=>!reasons.has(x.id))||list.find(x=>switchedOff.has(x.id));
  if(!r){unmatched.push(c[1]);continue;}
  if(!switchedOff.has(r.id))reasons.set(r.id,{reason:c[2],url:c[3]||''});
 }
}

// Why an area is open. The texts cover the reasons of the reports and the newer ones of reasons.mjs.
const CATEGORY=[
 ['ready',/Prüflauf vom Rechner des Projektinhabers ausstehend/],
 ['special',/^Stadtstaat/],
 ['shared',/Mitbenutztes System|nicht eindeutig|mehreren Gebieten|Demo-Mandanten/],
 ['robots',/robots\.txt/],
 ['blocked',/HTTP 403|Web-Firewall|Zugriffsprüfung|Zugriffsschutz/],
 ['website',/Sitzungen nur als Webseite oder PDF|Vorlese-, Teilen-/],
 ['nolink',/kein Link|Keine offizielle Website|antwortet Programmen nicht|Link auf der Website gefunden, noch nicht geprüft/i],
 ['noreader',/^ALLRIS 3|Kein unterstütztes|^SessionNet 6$|^KIC-RIS$|komfa|ohne erreichbare OParl/],
 ['readfail',/lieferte keine|keine verwertbaren|zu viele Zugriffe|Wartungsarbeiten|erwähnt|nicht erreichbar|antwortet Programmen mit HTTP|Vorlagenliste|HTTP 404|abgebrochen/],
];
const categoryOf=reason=>(CATEGORY.find(([,re])=>re.test(reason))||['other'])[0];

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

// Map shapes: NRW and Niedersachsen in germany.json, the other 14 Länder in de-areas.json (same projection).
const germany=read('public/geo/germany.json'),rest=read('public/geo/de-areas.json');
const shapes=new Map([...germany.regions,...rest.regions].map(r=>[r.id,r.path]));
const bbox=d=>{const n=d.match(/-?[0-9.]+/g).map(Number);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=0;i<n.length;i+=2){x0=Math.min(x0,n[i]);x1=Math.max(x1,n[i]);y0=Math.min(y0,n[i+1]);y1=Math.max(y1,n[i+1]);}return [x0,y0,x1,y1].map(v=>Math.round(v*10)/10);};

const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch{return '';}};
const operator=u=>{const h=host(u);if(!h)return '';const p=h.split('.');return p.slice(-2).join('.').replace(/^more-rubin[0-9]*\.de$/,'more-rubin.de');};
const TYPE={city:null,district:'Kreis'};
const areas=CATALOG.map(r=>{
 const s=sources.get(r.id),o=reasons.get(r.id),url=s?(s.system||s.base||s.api||''):o?.url||'';
 const a={id:r.id,n:r.name,l:r.ags.slice(0,2),g:r.ags,t:TYPE[r.kind]||r.municipalityType||'Gemeinde',k:r.kind==='district'?'d':r.independent?'i':'c',p:POPULATION[r.id]||0,u:/^https?:/.test(url)?url:'',o:operator(url)};
 if(r.members?.length)a.m=r.members.length;
 if(s){a.c=robots[r.id]==='verboten'?'okRobots':'ok';a.v=methodOf(s);a.rb=robots[r.id]||'';a.at=s.verifiedAt||'';}
 else if(o){a.c=categoryOf(o.reason);a.r=o.reason;}
 else{a.c='other';a.r='Kein Prüfergebnis im Bericht';}
 if(research.has(r.id))a.rs=research.get(r.id);
 if(recheck.has(r.id))a.nc=recheck.get(r.id);
 if(shapes.has(r.id))a.b=bbox(shapes.get(r.id));
 return a;
});

const data={
 builtAt:new Date().toISOString().slice(0,10),reportDate,
 lands:Object.fromEntries([...new Set(CATALOG.map(r=>r.ags.slice(0,2)))].sort().map(l=>[l,landName(l)])),
 areas,
 shapes:Object.fromEntries(areas.filter(a=>shapes.has(a.id)).map(a=>[a.id,shapes.get(a.id)])),
 states:germany.states.map(s=>s.path),
 attribution:'© BKG (2026), dl-de/by-2-0',
};
const missing=areas.filter(a=>!a.b).length;
const page=fs.readFileSync(path.join(root,'scripts/dashboard/page.html'),'utf8').replace('/*__DATA__*/null',()=>JSON.stringify(data).replace(/</g,'\\u003c'));
const out=process.env.OUT||'dashboard/luecken.html';
fs.mkdirSync(path.dirname(path.resolve(root,out)),{recursive:true});
fs.writeFileSync(path.resolve(root,out),process.env.FRAGMENT?page:'<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n'+page+'\n</body>\n</html>\n');
const count=areas.reduce((m,a)=>(m[a.c]=(m[a.c]||0)+1,m),{});
console.log(out+': '+areas.length+' Gebiete',JSON.stringify(count),'ohne Kartenform '+missing,'Berichtszeilen ohne Gebiet '+unmatched.length,(fs.statSync(path.resolve(root,out)).size/1e6).toFixed(1)+' MB');
