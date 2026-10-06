// Check of the city-state sources (server/integrations/citystate-sources.json) from the owner's machine. robots.txt is
// read and recorded for every address. It decides over none of them, also not with ROBOTS_POLICY=obey: every address
// asked is an interface (CKAN, OParl, open data), not an HTML page (shared/source-access.mjs). A technical refusal
// (HTTP 401/403) still keeps a system out.
//
//   node scripts/source-discovery/stadtstaaten.mjs hamburg   # robots.txt of the Transparenzportal, one month of papers, meetings, communications
//   node scripts/source-discovery/stadtstaaten.mjs berlin    # OParl addresses of the BVV from daten.berlin.de, robots.txt of each
//   DRY=1 …                                                  # print only, change nothing
//
// hamburg: switches the entry on (method "scraper") when the reader found topics (papers and meetings of the districts,
// communications of the Senate); otherwise it stays switched off with the reason as note. The robots.txt verdict of the
// search interface is printed and recorded.
// berlin: reads one month of the open data of the Abgeordnetenhaus (PARDOK) and records the district systems with
// their robots.txt verdict and whether they answer as OParl system. The entry stays on when the Abgeordnetenhaus
// delivered procedures; districts are read where they do not refuse technically (HTTP 403) or a consent is recorded
// (field consent: {by, date, scope}); see requirements/berlin-freigabe-anfrage.md.
// Afterwards: node scripts/source-discovery/servers.mjs; ONLY_UNCLEAR=1 node scripts/source-discovery/robots.mjs;
// node scripts/dashboard/build.mjs; node --test tests/*.test.mjs
import fs from 'node:fs';
import {fetchText} from '../../server/integrations/sessionnet.mjs';
import {robotsVerdict} from '../../server/integrations/robots.mjs';
import {collectHamburgTransparenz,collectPardok,consentValid,eligibleSystems} from '../../server/integrations/citystates.mjs';

const FILE='server/integrations/citystate-sources.json';
const TOKENS=['vorort-politicaltopics','ratsmonitor-sourcecatalog'];
const today=new Date().toISOString().slice(0,10);
const entries=JSON.parse(fs.readFileSync(FILE,'utf8'));
const save=()=>{if(process.env.DRY){console.log('DRY: nichts geschrieben.');return;}fs.writeFileSync(FILE,JSON.stringify(entries,null,2)+'\n');console.log('geschrieben:',FILE);};
const statusOf=e=>Number(String(e?.message).match(/HTTP (\d{3})/)?.[1])||0;
const robotsCache=new Map();
/** robots.txt verdict for one address: 'erlaubt', 'verboten', 'keine' (no robots.txt) or 'unklar'. One request per origin. */
async function robotsFor(url){
 const u=new URL(url);
 if(!robotsCache.has(u.origin))robotsCache.set(u.origin,fetchText(u.origin+'/robots.txt',{base:u.origin+'/'}).then(text=>({status:200,text}),e=>({status:statusOf(e),text:''})));
 const {status,text}=await robotsCache.get(u.origin);
 return robotsVerdict(status,text,u.pathname+u.search,TOKENS);
}
// Every address asked here is an interface (CKAN, OParl): robots.txt is recorded and decides over none of them, also not
// with ROBOTS_POLICY=obey (shared/source-access.mjs).

async function hamburg(){
 const entry=entries.find(e=>e.adapter==='hamburg-transparenz');
 const api=entry.base+'api/3/action/package_search',verdict=await robotsFor(api);
 console.log('robots.txt Transparenzportal für',api+':',verdict);
 // The portal documents its search interface for programs (transparenz.hamburg.de/api-796358): robots.txt is
 // recorded and does not switch the entry off, also not with ROBOTS_POLICY=obey (shared/source-access.mjs).
 entry.robots={verdict,checkedAt:today};
 const d=await collectHamburgTransparenz({...entry,method:'scraper'},{window:'1m',onProgress:m=>console.log(' ',m)});
 // Three kinds of topics: papers of the districts, public agenda items of their meetings, communications of the Senate.
 const kind=t=>t.sourceData?.records?.[0]?.kind==='agenda'?'agenda':t.committee.startsWith('Bürgerschaft')?'senate':'paper';
 const count={paper:0,agenda:0,senate:0},districts=new Set();
 for(const t of d.topics){count[kind(t)]++;const district=t.sourceData?.records?.[0]?.fields?.district;if(district)districts.add(district);}
 console.log(`Im letzten Monat: ${count.paper} Drucksachen der Bezirksversammlungen, ${d.coverage.meetings} Sitzungen mit ${count.agenda} öffentlichen Tagesordnungspunkten, ${count.senate} Mitteilungen des Senats; Bezirke: ${[...districts].sort().join(', ')}`);
 for(const k of ['paper','agenda','senate'])for(const t of d.topics.filter(t=>kind(t)===k).slice(0,3))console.log(' -',t.eventDate,t.committee,t.reference,'|',t.title.slice(0,90),'|',t.sourceUrl);
 for(const i of [...d.coverage.issues,...(d.coverage.warnings||[])])console.log(' !',i);
 if(!d.topics.length){entry.method='pending';entry.note=`Prüflauf am ${today} ohne Drucksachen: ${d.coverage.issues.join(' ')}`.trim();return save();}
 entry.method='scraper';entry.verifiedAt=today;entry.verifiedEvidence={papers:count.paper,meetings:d.coverage.meetings,agendaItems:count.agenda,senatePapers:count.senate,window:'1m',districts:districts.size};delete entry.note;delete entry.checkPending;
 return save();
}

// Open-data portals of Berlin with a CKAN interface (the address changed with the relaunch of daten.berlin.de).
const BERLIN_APIS=['https://datenregister.berlin.de/api/3/action/package_search','https://daten.berlin.de/api/3/action/package_search'];
const districtOf=title=>String(title).match(/BVV\s+(?:Berlin[- ]+)?(.+?)(?:\s+von Berlin)?\s*$/i)?.[1]?.trim()||null;
const oparlUrl=pkg=>{
 const urls=[...(pkg.resources||[]).map(r=>({url:r.url,format:String(r.format||'')})),{url:pkg.url,format:''}].filter(x=>/^https?:\/\//.test(x.url||''));
 return (urls.find(x=>/oparl/i.test(x.url)||/oparl/i.test(x.format))||null)?.url?.replace(/^http:/,'https:')||null;
};
async function berlin(){
 const entry=entries.find(e=>e.id==='de-11000000');
 // 1. Abgeordnetenhaus: robots.txt of the site and one month of procedures from the open-data file.
 const house=await collectPardok(entry,{window:'1m',onProgress:m=>console.log(' ',m)});
 console.log('Abgeordnetenhaus, Vorgänge im letzten Monat:',house.topics.length);
 for(const t of house.topics.slice(0,3))console.log(' -',t.eventDate,t.reference,'|',t.title.slice(0,90),'|',t.sourceUrl);
 for(const i of [...house.coverage.issues,...(house.coverage.warnings||[])])console.log(' !',i);
 // 2. District assemblies: OParl addresses from daten.berlin.de and robots.txt of each.
 let packages=null;
 for(const api of BERLIN_APIS){
  const verdict=await robotsFor(api);console.log('robots.txt',api+':',verdict,'(festgehalten; gilt nicht für die Schnittstelle)');
  try{const body=JSON.parse(await fetchText(api+'?'+new URLSearchParams({q:'"Informationssystem der BVV"',rows:'50'}),{base:new URL(api).origin+'/'}));if(body?.success===true&&Array.isArray(body.result?.results)){packages=body.result.results;break;}}
  catch(e){console.log(' ',api,e.message);}
 }
 if(!packages){console.log('Kein Open-Data-Portal mit lesbarer Suchschnittstelle; OParl-Adressen bitte von Hand in',FILE,'eintragen (systems: [{district, system}]).');}
 const found=new Map((entry.systems||[]).map(s=>[s.district,s]));
 for(const pkg of packages||[]){const district=districtOf(pkg.title),system=oparlUrl(pkg);if(district&&system)found.set(district,{...found.get(district),district,system,dataset:pkg.name?'https://daten.berlin.de/datensaetze/'+pkg.name:undefined});}
 for(const s of found.values()){
  // A system that refused this day (HTTP 401/403) is not asked again on the same day: no repetition after a refusal.
  if(s.checkedAt===today&&/HTTP 40[13]\b/.test(String(s.error||''))){console.log(' ',s.district.padEnd(28),'heute schon abgewiesen ('+s.error+'), nicht erneut gefragt');continue;}
  s.robots=await robotsFor(s.system);s.checkedAt=today;delete s.error;delete s.oparl;
  // The system is asked once to confirm that the address is an OParl system. A refusal (HTTP 403) is recorded as
  // error and keeps the district out.
  try{const body=JSON.parse(await fetchText(s.system,{base:new URL(s.system).origin+'/'}));s.oparl=String(body?.type||'').endsWith('/System');}catch(e){s.oparl=false;s.error=e.message;}
  console.log(' ',s.district.padEnd(28),s.robots.padEnd(9),s.oparl===undefined?'':s.oparl?'OParl':'kein OParl ('+(s.error||'Typ')+')',s.system);
 }
 entry.systems=[...found.values()].sort((a,b)=>a.district.localeCompare(b.district,'de'));
 for(const s of entry.systems)if(s.robots==='keine')s.robots='erlaubt';
 // eligibleSystems reads oparl and error; the robots.txt verdict stays as recorded.
 const eligible=eligibleSystems(entry);
 console.log(`${entry.systems.length} Bezirke mit Adresse, davon lesbar: ${eligible.length}${consentValid(entry.consent)?' (Freigabe eingetragen)':' (ohne Freigabe alle, die nicht technisch sperren)'}`);
 if(house.topics.length){entry.method='scraper';entry.verifiedAt=today;entry.verifiedEvidence={procedures:house.topics.length,window:'1m',districts:eligible.length};delete entry.note;delete entry.checkPending;}
 else if(eligible.length){entry.method='scraper';entry.verifiedAt=today;delete entry.note;}
 else{entry.method='pending';entry.note=`Prüflauf am ${today}: Abgeordnetenhaus ohne Vorgänge (${house.coverage.issues.join(' ')}); Bezirke nur mit Freigabe.`;}
 return save();
}

const task={hamburg,berlin}[process.argv[2]];
if(!task){console.log('Aufruf: node scripts/source-discovery/stadtstaaten.mjs hamburg|berlin');process.exit(1);}
await task();
