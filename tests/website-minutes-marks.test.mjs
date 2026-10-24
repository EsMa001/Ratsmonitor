import test from 'node:test';
import assert from 'node:assert/strict';
import {mentionsNonPublic,parseSessionText} from '../server/integrations/website-text.mjs';
import {declaredBase,documentLinks} from '../server/integrations/website-feeds.mjs';

// Nachgebildet nach den Niederschriften der Stadt Neutraubling und dem Amtsblatt der Stadt Sonneberg (24.10.2026).
test('a rule of the standing orders that gives a competence, and the end of secrecy, are no mention of the non-public part',()=>{
 assert.equal(mentionsNonPublic('Erteilung fällt nach § 12 Abs. 2 Nr. 5 Buchstabe d GeschO in die Zuständigkeit des ersten'),false);
 assert.equal(mentionsNonPublic('Gemäß Art. 52 Abs. 3 GO wird der Wegfall der Nichtöffentlichkeit bei Auftragsvergaben bekannt gegeben'),false);
 assert.equal(mentionsNonPublic('Die Beratung erfolgt nach § 22 GeschO nichtöffentlich'),true);
 assert.equal(mentionsNonPublic('nichtöffentlich gemäß § 22 Abs. 1 GeschO'),true);
});

test('lettered sub-points of an item are neither another session nor a part of the meeting',()=>{
 const lines=['Niederschrift über die Sitzung des Stadtrates','Sitzungsdatum: Donnerstag, 18.06.2026','TAGESORDNUNG','Öffentliche Sitzung',
  '1. Eröffnung, Beschlussfähigkeit, Tagesordnung','2. Genehmigung der öffentlichen Niederschrift','a) über die Sitzung vom 23.04.2026','b) über die konstituierende Sitzung vom 12.05.2026',
  '3. Aufstellung des Bebauungsplans "Kauf- und Wohnpark"','A) Abwägungsbeschluss','B) Feststellungsbeschluss Flächennutzungsplan','C) Satzungsbeschluss',
  '4. Bestellung der Seniorenbeauftragten','Nichtöffentliche Sitzung','5. Grundstücksangelegenheit'];
 const m=parseSessionText(lines,{title:'2026-06-18 Stadtratssitzung'}).meetings.find(x=>x.items.length);
 assert.deepEqual(m.items.map(i=>i.number),['1','2','3','4']);
 assert.deepEqual((m.closedItems||[]).map(i=>i.number),['5']);
});

test('relative links resolve against the base the page declares',()=>{
 const html='<head><base href="https://sonneberg.de/"></head><a href="files/uploads/Amtsblatt_01_2026.pdf">Amtsblatt 01/2026</a>';
 assert.equal(declaredBase(html,'https://sonneberg.de/rathaus/verwaltung/amtsblatt.html'),'https://sonneberg.de/');
 assert.equal(documentLinks(html,'https://sonneberg.de/rathaus/verwaltung/amtsblatt.html')[0].url,'https://sonneberg.de/files/uploads/Amtsblatt_01_2026.pdf');
 assert.equal(declaredBase('<a href="x.pdf">x</a>','https://a.example/b/'),'https://a.example/b/');
 assert.equal(declaredBase('<base href="javascript:void(0)">','https://a.example/b/'),'https://a.example/b/');
});

test('minutes: a note on attendance and the running head of each page that names this meeting change nothing',()=>{
 const lines=['NIEDERSCHRIFT ÜBER DIE SITZUNG DES STADTRATES','Sitzungsdatum: Donnerstag,18.06.2026','ANWESENHEITSLISTE','Herr Thomas Jäger Abwesend ab 20:20 Uhr (ab TOP 7 / nö.)',
  'Sitzung des Stadtrates am 18.06.2026','TAGESORDNUNG','Öffentliche Sitzung','1. Eröffnung, Beschlussfähigkeit, Tagesordnung','2. Antrag auf Baugenehmigung: Neubau einer Halle','3. Anfragen',
  '-401-','Sitzung des Stadtrates am 18.06.2026','ÖFFENTLICHE SITZUNG','1 Eröffnung, Beschlussfähigkeit, Tagesordnung','Der Bürgermeister begrüßt alle Anwesenden.',
  '-402-','Sitzung des Stadtrates am 18.06.2026','2 Antrag auf Baugenehmigung: Neubau einer Halle','Beschluss:','Das Einvernehmen wird erteilt.','Abstimmungsergebnis: Ja-Stimmen: 20 Nein-Stimmen: 0',
  '-403-','Sitzung des Stadtrates am 18.06.2026','3 Anfragen','Keine.'];
 const m=parseSessionText(lines,{title:'2026-06-18 Stadtratssitzung'}).meetings.find(x=>x.items.length||(x.otherItems||[]).length);
 assert.deepEqual(m.items.map(i=>i.number),['1','2','3']);
 assert.deepEqual(m.otherItems||[],[]);
});
