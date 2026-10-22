// „Was geschieht“ (shared/stage.mjs): Vorrang nach dem Leitfaden im Kopf der Datei; Messung scripts/stage-study/measure.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {stageOf,RULE_STAGES as STAGES,RULE_SONST as SONST} from '../shared/stage.mjs';
import {readReport} from '../server/integrations/report-rules.mjs';
const cases=[
 ['Straßenbenennung Neubaugebiet "Krahm" Bebauungsplan Nr. 02.11.1',SONST],
 ['Zur Information: Gemeindliches Einvernehmen zu Bauanträgen','bericht'],
 ['Quartalsbericht zum Haushalt 2026 - 1. Quartal 2026','bericht'],
 ['Antwort der Verwaltung zu der Anfrage der Fraktion Bündnis90/ Die Grünen betr. Einführung der Bezahlkarte','bericht'],
 ['Bauantrag zum Neubau eines Einfamilienhauses mit Doppelgarage','bauantrag'],
 ['Antrag auf wasserrechtliche Zulassung - Wasserkraftanlage','bauantrag'],
 ['Bebauungsplan "Ortsmitte" für den Bereich der Grundstücke Flurnummern 27/4 und 42/1','planung'],
 ['Antrag der SPD-Fraktion zur Installation von Defibrillatoren','antrag'],
 ['Verbindungsfußweg zwischen Helen-Keller-Str. und Wiesbadener Str. [CDU und FDP]','antrag'],
 ['Antrag der FFW Bergenstetten auf Bezuschussung der Fußbodenerneuerung','foerderung'],
 ['Antrag Hunde-(lauf)wiese','antrag'],
 ['Sanierung der Linzgauhalle – Vergabe der Leistungen für Fenster','vergabe'],
 ['Erhöhung der Nutzungsgebühren für Dauerparkende der Parkgaragen','abgaben'],
 ['Feststellung des Jahresabschlusses 2024','haushalt'],
 ['Entscheidung über die Ausübung eines Vorkaufsrechts','liegenschaft'],
 ['Erstellung eines integrierten Klimaanpassungskonzeptes im Rahmen der Förderrichtlinie','planung'],
 ['Teilnahme am Projektaufruf zum Bundesprogramm "Sanierung kommunaler Sportstätten"','foerderung'],
 ['Neuanlage Grüngutplatz - Baubeschluss','bau'],
 ['Beitritt zur ITEBO Einkaufs- und Dienstleistungsgenossenschaft eG','vertrag'],
 ['Neufassung der Satzung über die Räum- und Streupflicht','regelung'],
 ['Petition der Einwohnerinnen und Einwohner des Ortsteiles Waldow','beteiligung'],
 ['Tiefes Schlagloch in der Straße an der Bahn',SONST],
];
test('Leitfaden: Vorrang und erstes Wort',()=>{
 for(const [title,want] of cases)assert.equal(stageOf({title}),want,title);
 assert.ok(cases.every(([,w])=>w===SONST||STAGES.some(s=>s.id===w)));
});
test('readReport: „Was geschieht“ nur bei Sachpunkten',()=>{
 assert.equal(readReport({title:'Feststellung des Jahresabschlusses 2024',documents:[]}).stage,'haushalt');
 assert.equal(readReport({title:'Genehmigung der Niederschrift',documents:[]}).stage,null);
});
