// Stage 3: write the verified sources to server/integrations/statewide-sources.json and a report.
// Existing entries are never deleted; entries with an explicitly assigned body are curated and stay as they are.
// Another state: DIR, AREAS, TARGET, REPORT and TITLE (e.g. Niedersachsen → nds-sources.json, see README).
import fs from 'node:fs';
const dir=process.env.DIR||'tmp/source-discovery/',target=process.env.TARGET||'server/integrations/statewide-sources.json',reportFile=process.env.REPORT||'requirements/statewide-sources-report.md',title=process.env.TITLE||'Quellen für ganz NRW';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const regions=read(process.env.AREAS||'shared/nrw-regions.json'),verified=read(dir+'verified.json');
// Results for guessed addresses (guess.mjs) are kept in their own file and only add sources.
if(fs.existsSync(dir+'verified-guessed.json'))for(const row of Object.values(read(dir+'verified-guessed.json')))if(row.accepted&&!verified[row.id]?.accepted)verified[row.id]=row;
const candidates=fs.existsSync(dir+'candidates.json')?read(dir+'candidates.json'):{};
const other=['nrw-sources','nearby-sources','expanded-sources','statewide-sources','nds-sources'].map(f=>'server/integrations/'+f+'.json').filter(f=>f!==target&&fs.existsSync(f)).flatMap(read);
const core=['muenster','billerbeck','coesfeld','steinfurt','borken','warendorf','recklinghausen'];
const elsewhere=new Set([...core,...other.map(s=>s.id)]);
// Sources that are switched off (method "pending") stay in their file but do not count as connected.
const switchedOff=new Map(other.filter(s=>s.method==='pending').map(s=>[s.id,s]));
const existing=fs.existsSync(target)?read(target):[];
const byId=new Map(existing.map(s=>[s.id,s]));
const evidence=new Map();
for(const row of Object.values(verified)){
 if(!row.accepted||elsewhere.has(row.id))continue;
 const {evidence:e,...source}=row.accepted;evidence.set(row.id,e);
 if(byId.get(row.id)?.body)continue;
 byId.set(row.id,source);
}
// One address may serve exactly one area; shared systems need an explicit body.
const address=s=>(s.system||s.base)+'|'+(s.body||'');
const seen=new Map(),dropped=[];
for(const s of byId.values())seen.set(address(s),[...(seen.get(address(s))||[]),s.id]);
for(const [key,ids] of seen)if(ids.length>1){for(const id of ids){byId.delete(id);dropped.push(id);}console.log('Mehrfach zugeordnet, nicht übernommen:',key,ids.join(', '));}
const sources=[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id));
for(const s of sources){const r=regions.find(r=>r.id===s.id);if(!r||r.name!==s.name||r.kind!==s.kind)throw Error('Gebiet passt nicht: '+s.id);}
fs.writeFileSync(target,JSON.stringify(sources,null,2)+String.fromCharCode(10));

// Only areas of this list count; the other files also hold sources of other states.
const listed=new Set(regions.map(r=>r.id));
const connected=new Set([...[...elsewhere].filter(id=>!switchedOff.has(id)),...sources.map(s=>s.id)].filter(id=>listed.has(id)));
const reason=row=>{
 if(!row)return 'Auf der offiziellen Website kein Link zu einem Ratsinformationssystem gefunden';
 if(dropped.includes(row.id))return 'Adresse mehreren Gebieten zugeordnet';
 if(row.error)return 'Prüfung abgebrochen: '+row.error;
 const tried=row.tried||[],systems=(row.systems||[]).filter(s=>s!=='unknown');
 if(tried.some(t=>t.snError||t.snTopics===0))return 'SessionNet gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte';
 if(tried.some(t=>t.system==='sdnet'&&t.oparl))return 'SD.NET mit antwortender OParl-Schnittstelle, die keine verwertbaren Sitzungen lieferte; öffentliche Seiten werden dann nicht gelesen (Freigabe erforderlich)';
 if(tried.some(t=>(t.sdIssues||[]).some(i=>i.startsWith('Vorlagenliste: Quelle antwortet mit HTTP'))))return 'SD.NET auf der Website erwähnt; das System selbst wurde dort nicht gefunden';
 if(tried.some(t=>t.sdTopics===0||t.sdError))return 'SD.NET gefunden, Abruf der öffentlichen Seiten lieferte keine Tagesordnungspunkte'+(tried.find(t=>t.sdIssues?.length)?' ('+tried.find(t=>t.sdIssues?.length).sdIssues[0]+')':'');
 if(tried.some(t=>t.oparl&&!t.oparlTopics))return 'OParl-Schnittstelle antwortet, lieferte aber keine verwertbaren Sitzungen'+(tried.find(t=>t.oparlError)?' ('+tried.find(t=>t.oparlError).oparlError+')':'');
 if(tried.length&&tried.every(t=>t.status===403))return 'Zugriffsschutz (HTTP 403) für Programme; OParl nicht aktiviert';
 if(systems.includes('sdnet'))return 'SD.NET erwähnt, System selbst nicht erreichbar oder nicht gefunden';
 if(tried.some(t=>t.system==='allris'&&/Wartungsarbeiten/i.test(t.title||'')))return 'ALLRIS 4; die Bürgerinformation war bei der Prüfung wegen Wartungsarbeiten nicht verfügbar. Erneut prüfen';
 if(tried.some(t=>(t.allrisIssues||[]).some(i=>/Zugriffsprüfung/.test(i))))return 'ALLRIS 4 mit Zugriffsprüfung des Herstellers gegen automatisierte Abrufe (wird nicht umgangen); OParl nicht aktiviert';
 if(tried.some(t=>(t.allrisIssues||[]).some(i=>/zu viele Zugriffe/.test(i))))return 'ALLRIS 4 gefunden; das System meldete bei der Prüfung zu viele Zugriffe und sperrte vorübergehend. Erneut prüfen';
 if(tried.some(t=>t.allrisTopics===0||t.allrisError))return 'ALLRIS 4 gefunden, Abruf der öffentlichen Seiten lieferte keine Tagesordnungspunkte'+(tried.find(t=>t.allrisError||t.allrisIssues?.length)?' ('+(tried.find(t=>t.allrisError)?.allrisError||tried.find(t=>t.allrisIssues?.length).allrisIssues[0])+')':'');
 if(tried.some(t=>t.allrisGeneration===3))return 'ALLRIS 3 (ältere Generation) ohne OParl-Schnittstelle; für diese Generation gibt es keinen Leser';
 if(systems.includes('allris'))return 'ALLRIS ohne erreichbare OParl-Schnittstelle';
 if(tried.some(t=>t.identity&&!t.identity.ok)&&!tried.some(t=>t.identity?.ok))return 'Gefundenes System nicht eindeutig dem Gebiet zuzuordnen';
 return 'Kein unterstütztes Ratsinformationssystem erkannt';
};
const open=regions.filter(r=>!connected.has(r.id)).map(r=>({...r,reason:switchedOff.get(r.id)?.note||reason(verified[r.id]||(candidates[r.id]?.candidates?.length?{tried:[],systems:[]}:null)),link:switchedOff.get(r.id)?.system||(verified[r.id]?.tried||[]).find(t=>t.url)?.url||candidates[r.id]?.candidates?.[0]?.url||''}));
const count=(list,key)=>Object.entries(list.reduce((a,x)=>(a[key(x)]=(a[key(x)]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]);
const methodName=s=>s.method==='oparl'?'OParl':s.method==='official-api'?'More! Rubin (Kalender-API)':s.adapter==='sdnet'?'SD.NET (öffentliche Seiten)':s.adapter==='allris'?'ALLRIS 4 (öffentliche Seiten)':'SessionNet (öffentliche Seiten)';
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
console.log(sources.length+' Quellen in '+target+'; '+connected.size+' von '+regions.length+' Gebieten angebunden; Bericht: '+reportFile);
