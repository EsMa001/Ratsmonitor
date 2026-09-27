import {readNrwSnapshot} from './nrw-snapshot-file.mjs';
import fs from 'node:fs/promises';
import {mergeImport} from '../server/integrations/merge-import.mjs';
import {activeTopics} from '../shared/topic-identity.mjs';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [city,regional,nrw,bundle]=await Promise.all(['data/topics.json','data/regions.json','data/nrw-seed.json','data/history-backfill.json'].map(p=>p==='data/nrw-seed.json'?readNrwSnapshot():read(p)));
if(!bundle.results.length||new Set(bundle.results.map(r=>r.coverage.regionId)).size!==bundle.results.length)throw Error('Leeres Nachladepaket oder doppelte Gebiete');
const baseline=[...city.topics.map(t=>({...t,regionId:'muenster'})),...regional.topics,...nrw.topics];
const rows=[];let beforeTotal=0,afterTotal=0;
for(const fresh of bundle.results){
 const id=fresh.coverage.regionId,previous=baseline.filter(t=>t.regionId===id),merged=activeTopics(mergeImport({topics:previous},fresh).topics);
 const dates=merged.flatMap(t=>(t.events||[]).map(e=>e.date).filter(Boolean)).sort();
 const before=activeTopics(previous).length;beforeTotal+=before;afterTotal+=merged.length;
 rows.push({region:id,received:fresh.topics.length,before,after:merged.length,earliest:dates[0]||'—',complete:fresh.coverage.complete,issues:fresh.coverage.issues.length});
}
const lines=['# Nachladung: zwölf Monate', '', 'Abrufstand: '+bundle.revision, '', 'Lokaler Abgleich mit dem bisherigen ausgelieferten Bestand. Die produktive Datenbank kann zusätzliche Änderungen enthalten. Erhaltene Datensätze sind nicht automatisch neue Artikel; amtlich belegte Zusammenführungen können die Anzahl reduzieren. Vollständig bedeutet nur: kein vom Adapter erkannter technischer Fehler.', '', '| Gebiet | Erhalten | Vorher | Nach Abgleich | Frühester gespeicherter Termin | Technisch vollständig | Hinweise |','| --- | ---: | ---: | ---: | --- | --- | ---: |',...rows.map(r=>`| ${r.region} | ${r.received} | ${r.before} | ${r.after} | ${r.earliest} | ${r.complete?'Ja':'Nein'} | ${r.issues} |`),'',`Bestand vorher: ${beforeTotal}; nach lokalem Abgleich: ${afterTotal}.`,'','Lücken bleiben sichtbar. Der früheste Termin beweist keine lückenlose Abdeckung dazwischen. Alte Artikel und Links werden erhalten. Die serverseitige Übernahme erfolgt beim ersten Datenbankzugriff nach Veröffentlichung.'];
await fs.writeFile('requirements/year-backfill-report.md',lines.join('\n')+'\n');console.log(JSON.stringify({beforeTotal,afterTotal,rows}));
