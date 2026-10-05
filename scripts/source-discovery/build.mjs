// Stage 3: write the verified sources to server/integrations/statewide-sources.json and a report.
// Existing entries are never deleted; entries with an explicitly assigned body are curated and stay as they are.
// Another state: DIR, LAND or AREAS, TARGET, REPORT and TITLE (e.g. Niedersachsen → nds-sources.json, see README).
import fs from 'node:fs';
import {loadAreas,skipReason,foreignOwner} from './areas.mjs';
import {READERS} from '../../server/integrations/readers.mjs';
import {mergeChecks,openReason,foundLink,sourceAddress,fixedBody,ACCEPTED_FILES,TARGETED_FILES,GUESSED_FILES,CANDIDATE_FILES} from './reasons.mjs';
const dir=process.env.DIR||'tmp/source-discovery/',target=process.env.TARGET||'server/integrations/statewide-sources.json',reportFile=process.env.REPORT||'requirements/statewide-sources-report.md',title=process.env.TITLE||'Quellen für ganz NRW';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const regions=loadAreas();
// Results for guessed addresses (guess.mjs, guess-platforms.mjs), for OParl addresses from the register
// (oparl-register.mjs), for targeted candidates (web search, corrections) and for the official website (website.mjs)
// are kept in their own files. Which of their rows count, and in which order, is decided in reasons.mjs (mergeChecks):
// accepted sources; targeted checks that tried something; guessed addresses that led to a system or to robots.txt.
// verified-website.json comes last: it adds an area only where no check of a council information system accepted one.
const checkFiles=Object.fromEntries([...new Set([...ACCEPTED_FILES,...TARGETED_FILES,...GUESSED_FILES])].filter(f=>fs.existsSync(dir+f)).map(f=>[f,read(dir+f)]));
const verified=mergeChecks(read(dir+'verified.json'),checkFiles);
// Website checks that took nothing: their reason completes "no link found" in the report (see reasons.mjs).
const websiteChecks=new Map(Object.values(checkFiles['verified-website.json']||{}).filter(r=>!r.accepted&&r.reason).map(r=>[r.id,r]));
// Areas whose OParl address was asked without success (for ekom21: the interface is not activated for the tenant).
const oparlAsked=new Set(fs.existsSync(dir+'verified-oparl.json')?Object.values(read(dir+'verified-oparl.json')).filter(r=>!r.accepted).map(r=>r.id):[]);
// Crawl results (candidates.json: sites, pages, log) and the other candidate files, for the reason and the address shown.
const candidateFiles=CANDIDATE_FILES.map(f=>fs.existsSync(dir+f)?read(dir+f):{}),candidates=candidateFiles[0];
const other=['nrw-sources','nearby-sources','expanded-sources','statewide-sources','nds-sources','de-sources','citystate-sources'].map(f=>'server/integrations/'+f+'.json').filter(f=>f!==target&&fs.existsSync(f)).flatMap(read);
const core=['muenster','billerbeck','coesfeld','steinfurt','borken','warendorf','recklinghausen'];
const elsewhere=new Set([...core,...other.map(s=>s.id)]);
// Sources that are switched off (method "pending") stay in their file but do not count as connected.
const switchedOff=new Map(other.filter(s=>s.method==='pending').map(s=>[s.id,s]));
const existing=fs.existsSync(target)?read(target):[];
// The demo body of a vendor's generic system ("Stadt Musterstadt") is never the source of a real area, also not in an
// entry that an earlier run wrote with that body fixed.
const PLACEHOLDER=/„[^“]*(muster|demo|test|beispiel)[^“]*“/i,placeholder=new Set(existing.filter(s=>PLACEHOLDER.test(s.note||'')).map(s=>s.id));
const byId=new Map(existing.filter(s=>!placeholder.has(s.id)).map(s=>[s.id,s]));
const evidence=new Map();
// A municipality's page reader would take the meetings of another municipality whose system it shares (areas.mjs).
// Entries with a fixed body (OParl body, More! Rubin bodies) read only their own bodies and are not affected.
const foreign=new Map(),claims=[];
for(const row of Object.values(verified)){
 if(!row.accepted||elsewhere.has(row.id))continue;
 const {evidence:e,...source}=row.accepted;evidence.set(row.id,e);
 if(byId.get(row.id)?.body)continue;
 if(placeholder.has(row.id)||PLACEHOLDER.test(source.note||'')){placeholder.add(row.id);continue;}
 const area=regions.find(r=>r.id===row.id),owner=area?.kind==='city'&&!fixedBody(source)?foreignOwner(area,source.system||source.base,regions):null;
 if(owner){foreign.set(row.id,owner);claims.push(source);continue;}
 byId.set(row.id,source);
}
// One address may serve exactly one area; shared systems need an explicit body. A municipality left out above as a
// guest of another one's system still counts: that system serves both, and its reader cannot tell them apart.
// Entries of one system with different fixed bodies (lauenburg.gremien.info: the town and the Amt Lütau) are different addresses.
const address=sourceAddress;
const seen=new Map(),dropped=[];
for(const s of [...byId.values(),...claims])seen.set(address(s),[...(seen.get(address(s))||[]),s.id]);
// Addresses connected in the files of the other states count as well; only this file is changed.
for(const s of other.filter(s=>s.method!=='pending'))if(seen.has(address(s)))seen.get(address(s)).push('elsewhere:'+s.id);
for(const [key,ids] of seen)if(ids.length>1){for(const id of ids){if(id.startsWith('elsewhere:'))continue;byId.delete(id);if(!foreign.has(id))dropped.push(id);}console.log('Mehrfach zugeordnet, nicht übernommen:',key,ids.join(', '));}
const sources=[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id));
// The name comes from the area catalog: it may have been corrected since the check (the key stays the same).
for(const s of sources){const r=regions.find(r=>r.id===s.id);if(!r||r.kind!==s.kind)throw Error('Gebiet passt nicht: '+s.id);s.name=r.name;
 // Found by web search, not by a link of the official website: the system's own address stands as the source.
 if(!/^https?:\/\//.test(s.verifiedSource||'')){s.foundBy=s.verifiedSource||'Websuche';s.verifiedSource=s.system||s.base;}}
fs.writeFileSync(target,JSON.stringify(sources,null,2)+String.fromCharCode(10));

// Only areas of this list count; the other files also hold sources of other states.
const listed=new Set(regions.map(r=>r.id));
const connected=new Set([...[...elsewhere].filter(id=>!switchedOff.has(id)),...sources.map(s=>s.id)].filter(id=>listed.has(id)));
const context={skipReason,dropped:new Set(dropped),placeholder,foreign,oparlAsked,websiteChecks,readerName:adapter=>READERS[adapter]?.name||adapter};
const open=regions.filter(r=>!connected.has(r.id)).map(r=>({...r,reason:switchedOff.get(r.id)?.note||openReason(r,verified[r.id]||null,candidates[r.id]||null,context),link:switchedOff.get(r.id)?.system||foundLink(verified[r.id],candidateFiles.map(f=>f[r.id]))}));
const count=(list,key)=>Object.entries(list.reduce((a,x)=>(a[key(x)]=(a[key(x)]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]);
const methodName=s=>READERS[s.adapter]?READERS[s.adapter].name:s.method==='oparl'?'OParl':s.method==='official-api'?'More! Rubin (Kalender-API)':s.adapter==='sdnet'?'SD.NET (öffentliche Seiten)':s.adapter==='allris'?'ALLRIS 4 (öffentliche Seiten)':'SessionNet (öffentliche Seiten)';
const today=new Date().toISOString().slice(0,10).split('-').reverse().join('.');
const lines=['# '+title+': Ergebnis der automatischen Suche','',
 `Stand: ${today}. Erzeugt von \`scripts/source-discovery/\` (Ablauf siehe README dort).`,'',
 `Von ${regions.length} auswählbaren Gebieten sind ${connected.size} angebunden, ${open.length} nicht. Diese Datei beschreibt die ${sources.length} Quellen in \`${target}\` und nennt für jedes nicht angebundene Gebiet den Grund.`,'',
 'Eine Quelle wurde nur übernommen, wenn das Abrufprogramm bei der Prüfung öffentliche Tagesordnungspunkte der letzten drei Monate geliefert hat. Das ist kein Nachweis der Vollständigkeit.','',
 '## Übernommene Quellen','',...count(sources,methodName).map(([k,n])=>`- ${n} × ${k}`),'',
 '| Gebiet | Verfahren | Adresse | Artikel bei der Prüfung (3 Monate) |','|---|---|---|---|',
 ...sources.map(s=>`| ${s.name} | ${methodName(s)} | ${s.system||s.base} | ${evidence.get(s.id)?.topics??'einzeln geprüft'} |`),'',
 '## Nicht angebundene Gebiete','',...count(open,o=>o.reason.replace(/ \(.*\)$/,'').replace(/^Prüfung abgebrochen.*/,'Prüfung abgebrochen')).map(([k,n])=>`- ${n} × ${k}`),'',
 '| Gebiet | Grund | Gefundene Adresse |','|---|---|---|',...open.map(o=>`| ${o.name} | ${o.reason} | ${o.link} |`),''];
fs.writeFileSync(reportFile,lines.join(String.fromCharCode(10)));
// The open areas with their reason, for further steps of the search (work lists); a working file, not part of the repository.
fs.writeFileSync(dir+'open.json',JSON.stringify(open.map(o=>({id:o.id,name:o.name,kind:o.kind,ags:o.ags,reason:o.reason,link:o.link})),null,1));
console.log(sources.length+' Quellen in '+target+'; '+connected.size+' von '+regions.length+' Gebieten angebunden; Bericht: '+reportFile);
