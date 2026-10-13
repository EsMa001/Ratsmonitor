// Art eines Tagesordnungspunkts aus dem Titel (shared/item-kind.mjs); Messung: scripts/item-study/measure.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {itemKind} from '../shared/item-kind.mjs';

const expect=(kind,titles)=>{for(const t of titles)assert.equal(itemKind(t),kind,t);};

test('Sitzungsablauf',()=>expect('formal',[
 'Eröffnung der Sitzung, Feststellung der ordnungsgemäßen Einberufung, der fehlenden Mitglieder und der Beschlussfähigkeit',
 'Genehmigung der Niederschrift der Sitzung vom 25.09.2025','Anträge auf Ergänzung/Änderung der Tagesordnung',
 'Bekanntgabe der in nichtöffentlicher Sitzung gefassten Beschlüsse','Hinweis auf das Mitwirkungsverbot (§ 22 BbgKVerf)',
 'Schließen des öffentlichen Teils','Beschlusskontrolle','Ausschusssitzung Struktur, Umwelt, Bauen & Energie vom 26.08.2026',
 'Eröffnung der Bau- und Vergabeausschusssitzung, Feststellung der ordnungsgemäßen Einberufung',
]));
test('Sammelpunkte',()=>expect('collection',[
 'Mitteilungen','Anfragen und Anregungen','Verschiedenes, Bekanntgaben und Anfragen','Einwohner- und Einwohnerinnenfragestunde',
 'Bericht des Bürgermeisters','Mitteilungen des Eigenbetriebs','Einwohneranfragen','Bericht der Verwaltung über wichtige öffentliche Angelegenheiten',
 'Anfragen und Anregungen, Schließung des öffentlichen Sitzungsteils','Finanzen, Beteiligungen und Liegenschaften -unbesetzt-',
]));
test('Routine: Personen, Gremien, Spenden',()=>expect('routine',[
 'Wahl des/der stellvertretenden Ortsvorstehers/in','Beschlussfassung über die Besetzung der Ausschüsse','Verpflichtung sachkundiger Bürger',
 'Bestellen einer Protokollantin / eines Protokollanten','Annahme der Spende von Herrn Wolfgang Ohle','Annahme von Geldspenden',
 'Angelegenheiten der Gemeindewerke Brüggen GmbH hier: Abberufung und Bestellung eines Gesellschaftervertreters',
 'Einführung und Verpflichtung eines neuen Ratsmitglieds',
]));
test('Sachpunkte, auch mit Sammel- oder Verfahrenswort',()=>expect('subject',[
 'Mitteilungen: Antrag der Fraktion der FDP zur Überprüfung eines "Böllerverbots"; Kenntnisnahme','Information zur Katastrophenschutzübung "Schwarzer Freitag"',
 'Bericht zur Umsetzung der Istanbul-Konvention und des Gewalthilfegesetzes in Wuppertal','Bericht des Fördermanagements Anfrage von Ratsmitglied Stamm',
 'Einführung eines Ampelmännchens mit dem Symbolbild Bote Veit','Bauvoranfragen (beschliessend)','Beschlussfassung über die Satzung über die Erhebung von Hundesteuer',
 'Beantwortung des Änderungsantrags der GALF-Fraktion zur Entwicklung des Gewerbegebietes','Festlegung des Wahltermins und Stichwahltermins für die Bürgermeisterwahl 2026',
 'Bekanntgabe einer Eilentscheidung - Vergabe der Mangelbeseitigung der Brandmeldeanlagen Stadtmuseum',
]));
