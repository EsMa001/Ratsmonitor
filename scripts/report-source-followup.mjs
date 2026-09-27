import fs from 'node:fs';
import {readNrwSnapshot} from './nrw-snapshot-file.mjs';
import {activeTopics} from '../shared/topic-identity.mjs';
import baseline from '../requirements/import-followup-baseline.json' with {type:'json'};
const current=readNrwSnapshot(),number=n=>n.toLocaleString('de-DE');
const rows=baseline.regions.map(before=>{const coverage=current.coverage.find(c=>c.regionId===before.id),topics=activeTopics(current.topics.filter(t=>t.regionId===before.id));return {...before,beforeIssues:before.issues,coverage,count:topics.length,before:before.count,added:topics.length-before.count};});
const added=rows.reduce((n,r)=>n+r.added,0);
const lines=['# Nachprüfung der sieben Quellen mit Datenlücken','',
 'Stand: 27.09.2026. Vergleich des versionierten Bestands vor und nach dem gezielten Folgeimport. Keine Live-Datenbankmessung; keine Vollständigkeitszusage.',
 '',`Vorher: Revision ${baseline.revision}, Quellcode ${baseline.sourceCommit}. Nachher: Revision ${current.revision}.`,
 '',`**${number(added)} zusätzliche kanonische Artikel; neuer Gesamtbestand ${number(baseline.canonicalTotal+added)}.** Die Zahl datenführender Gebiete bleibt bei 43 (39 Kommunen, vier Kreise).`,
 '', '| Gebiet | Vorher | Nachher | Veränderung | Verbleibende Hinweise |','| --- | ---: | ---: | ---: | --- |',
 ...rows.map(r=>`| ${r.name} | ${number(r.before)} | ${number(r.count)} | ${r.added>=0?'+':''}${number(r.added)} | ${r.coverage.complete?'Keine gemeldet':r.coverage.issues.length+'; Teilstand'} |`),
 '', '## Behobene Ursachen','',
 'Der öffentliche SessionNet-Einstieg leitet einige Sitzungstermine von der Tagesordnung auf eine Informationsseite um. Diese Weiterleitungen werden jetzt innerhalb des freigegebenen HTTPS-Hosts und Portalpfads geprüft und bis zu drei Mal verfolgt. Alle Schritte teilen sich ein Zeitbudget. Fremde Hosts, Anmeldedaten in URLs, andere Pfade, HTTP-Downgrades und Schleifen werden abgewiesen. Eine Zugangssperre wird weiterhin nicht umgangen.',
 '', 'Wenn das Portal erklärt, dass Sitzungsdetails noch nicht freigegeben sind, lautet der Quellenhinweis entsprechend. Solche Termine bleiben eine Datenlücke. Es werden weder Artikel erfunden noch fehlende Tagesordnungen als leere, vollständige Sitzungen gewertet.',
 '', 'Der OParl-Import erhält einen bereits eindeutig öffentlichen Tagesordnungspunkt auch dann, wenn seine Vorlagenverknüpfung nicht abgerufen werden konnte. Verfügbar bleiben Originaltitel, Sitzung, veröffentlichter Ergebnistext und tatsächlich erreichbare Dokumentverweise. Fehlende Vorlageninhalte werden nicht ergänzt. Die Zuordnung bleibt offen und der Quellenstand unvollständig. Sobald die amtliche Beziehung später eingelesen wird, führt die vorhandene Identitätslogik die Einträge zusammen und erhält alte Artikellinks.',
 '', '## Grenzen','',
 'Ochtrups Listenlimit bleibt sichtbar. Nicht freigegebene Sitzungsdetails und weiterhin fehlerhafte Portalantworten können durch diesen Import nicht ersetzt werden. Dropdowns zeigen weiterhin tatsächliche Artikelzahlen und Teilstände. Die neuen Datensätze erhalten Regelklassifikationen; es wurden keine neuen KI-Labels oder KI-Zusammenfassungen erstellt. Der regelmäßige Hintergrundimport bleibt unaktiviert.',
 '', '## Hinweise je Quelle','',...rows.flatMap(r=>['### '+r.name,'',...(r.coverage.issues.length?r.coverage.issues.map(i=>'- '+i):['Keine technischen Probleme im letzten Abruf gemeldet.']),'']),
 'Reproduzieren: `node scripts/report-source-followup.mjs`. Ausgangszahlen und frühere Hinweise: `requirements/import-followup-baseline.json`.'];
fs.writeFileSync('requirements/source-followup-report.md',lines.join('\n')+'\n');
fs.writeFileSync('tmp/follow-stats.json',JSON.stringify({added,total:baseline.canonicalTotal+added,rows},null,2));
console.log(JSON.stringify({added,total:baseline.canonicalTotal+added,rows:rows.map(r=>({name:r.name,before:r.before,after:r.count,issues:r.coverage.issues.length}))}));
