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

test('public notice (Heiligenstadt i.OFr.): compound word after the number, a title wrapped onto a number written otherwise, a page break inside a title',()=>{
 const lines=['Öffentliche Bekanntmachung','Am Donnerstag, den 23.04.2026 um 18:00 Uhr findet im Sitzungssaal im Rathaus,','eine Sitzung des Marktgemeinderates statt.','Tagesordnung:',
  '12 Bestellung zum Stellv. Kommandant der FFW Brunn','13 Kinder- und Jugendfeuerwehr Oberleinleiter','14 Anzeige der Höherauslastung von Stromkreisen',
  '15 Bauleitplanverfahren: Bebauungsplan „Feuerwehr und Bauhof“ und','16. Änderung des Flächennutzungsplans Markt Buttenheim, Landkreis','Bamberg im Parallelverfahren',
  '16 Geländeauffüllung zur Errichtung eines Parkplatzes','17 Anbau eines Nebengebäudes','18 Neubau einer Maschinenhalle','19 Errichtung eines Mobilfunkmastens','20 Errichtung eines Mobilfunkmastens Brunn','21 Errichtung eines Mobilfunkmastens Oberngrub','22 Ergebnisse aus Sitzung des Regionalen Planungsverband Oberfranken','17.04.2026','Seite: 2/2','West vom 20 April 2026 bzgl. Windvorranggebiet Brunn - Ost',
  '23 Sonstiges','Anschließend findet eine nichtöffentliche Sitzung statt.'];
 const m=parseSessionText(lines,{title:'Öffentliche Bekanntmachung',wrapped:true}).meetings.find(x=>x.items.length);
 assert.deepEqual(m.items.map(i=>[i.number,i.title]),[
  ['12','Bestellung zum Stellv. Kommandant der FFW Brunn'],['13','Kinder- und Jugendfeuerwehr Oberleinleiter'],['14','Anzeige der Höherauslastung von Stromkreisen'],
  ['15','Bauleitplanverfahren: Bebauungsplan "Feuerwehr und Bauhof" und 16. Änderung des Flächennutzungsplans Markt Buttenheim, Landkreis Bamberg im Parallelverfahren'],
  ['16','Geländeauffüllung zur Errichtung eines Parkplatzes'],['17','Anbau eines Nebengebäudes'],['18','Neubau einer Maschinenhalle'],['19','Errichtung eines Mobilfunkmastens'],['20','Errichtung eines Mobilfunkmastens Brunn'],['21','Errichtung eines Mobilfunkmastens Oberngrub'],
  ['22','Ergebnisse aus Sitzung des Regionalen Planungsverband Oberfranken West vom 20 April 2026 bzgl. Windvorranggebiet Brunn - Ost'],['23','Sonstiges']]);
});

test('notice with the non-public part first (Kirchen (Sieg)): the public part after its own heading is public, a citation „i. V. m. § … GeschO“ is no mark',()=>{
 const lines=['Öffentliche Bekanntmachung','zur 15. Sitzung des Stadtrates der Stadt Kirchen (Sieg)','Sitzungstermin: Mittwoch, 16.09.2026, 17:00 Uhr','Tagesordnung',
  'Nichtöffentliche Sitzung','TOP 1: Feststellungen/Anträge zur Tagesordnung','TOP 2: Personalangelegenheit','TOP 3: Verschiedenes',
  'Öffentliche Sitzung','TOP 1: Begrüßung und Feststellungen/Anträge zur Tagesordnung','TOP 2: Einwohnerfragestunde gemäß § 16 a Gemeindeordnung (GemO)','Seite: 2/3','i. V. m. § 21 Geschäftsordnung (GeschO)',
  'TOP 3: 2. Nachtragshaushaltssatzung und -plan 2026 der Stadt Kirchen','TOP 4: Verschiedenes'];
 const m=parseSessionText(lines,{title:'Öffentliche Bekanntmachung zur 15. Sitzung des Stadtrates',wrapped:true}).meetings.find(x=>x.items.length);
 assert.deepEqual(m.items.map(i=>i.number),['1','2','3','4']);
 assert.match(m.items[1].title,/^Einwohnerfragestunde gemäß § 16 a Gemeindeordnung \(GemO\)/);
 assert.deepEqual(m.closedItems.map(i=>i.title),['Feststellungen/Anträge zur Tagesordnung','Personalangelegenheit','Verschiedenes']);
});

test('notice (Am Mellensee): head row „Top Öffentlicher Teil“, a citation broken after „Abs.“, „Beteiligung der Öffentlichkeit gem. … BauGB“',()=>{
 const lines=['BEKANNTMACHUNG','zur 18. Sitzung der Gemeindevertretung','am Dienstag, 22.09.2026, 19:00 Uhr','Tagesordnung','Top Öffentlicher Teil',
  '1. Eröffnung der Sitzung','2. Feststellung der Ordnungsmäßigkeit der Ladung und der Beschlussfähigkeit','3. Behandlung der Tagesordnungspunkte des öffentlichen Teils der Sitzung',
  '3.1 Beschluss zur Billigung des Entwurfs der 5. Änderung des Flächennutzungsplans und die Beteiligung','der Öffentlichkeit gem. §4a Abs3 BauGB sowie der Behörden gem. § 4 Abs.','2 BauGB zum Umweltbericht',
  '4. Sonstiges','5. Schließung des öffentlichen Teils der Sitzung',
  'Top Nichtöffentlicher Teil','6. Verleihung der Ehrenbürgerschaft der Gemeinde Am Mellensee','7. Schließung des nichtöffentlichen Teils der Sitzung'];
 const m=parseSessionText(lines,{title:'18. Bekanntmachung Gemeindevertretung',wrapped:true}).meetings.find(x=>x.items.length);
 assert.deepEqual(m.items.map(i=>i.number),['1','2','3','3.1','4','5']);
 assert.match(m.items[3].title,/§ 4 Abs\. 2 BauGB zum Umweltbericht$/);
 assert.deepEqual(m.closedItems.map(i=>i.number),['6','7']);
});

test('notice (Landkreis Harz, Meinerzhagen): a mention inside the non-public part after its heading, an ordinal in a title, „sowie der Öffentlichkeit vorgelegten Stellungnahmen“',()=>{
 const harz=['Sitzung des Kreisausschusses am 07.10.2026','Tagesordnung','I. Öffentlicher Teil','1. Eröffnung der Sitzung','2. Satzung zur Finanzierung des Ausbildungsverkehrs',
  'II. Nicht öffentlicher Teil','3. Eröffnung des nicht öffentlichen Teils der Sitzung, sowie Abstimmung über die Niederschrift','der vorangegangenen Sitzung (nicht öffentlicher Teil) vom 24.06.2026','4. Feststellung der Tagesordnung'];
 const h=parseSessionText(harz,{title:'Sitzung des Kreisausschusses',wrapped:true}).meetings.find(x=>x.items.length);
 assert.deepEqual(h.items.map(i=>i.number),['1','2']);
 assert.deepEqual(h.closedItems.map(i=>i.number),['3','4']);
 const mz=['Bekanntmachung der Stadt Meinerzhagen','Am 02.11.2026, 17:00 Uhr, findet eine Sitzung des Rates statt, zu der jedermann Zutritt hat.','Tagesordnung','Öffentliche Sitzung',
  '1. Sitzungsniederschrift Nr. 8 vom 14.09.2026','2. Brandschutzbedarfsplan (Fortschreibung)','3. 9. Änderung des Bebauungsplanes Nr. 15 "Schwenke"',
  '4. Bebauungsplan Nr. 79 "Gartenstraße"','hier: Prüfung der im Rahmen der Beteiligung der Behörden und sonstigen Träger öffentlicher','Belange (TÖB) sowie der Öffentlichkeit vorgelegten Stellungnahmen',
  'Nichtöffentliche Sitzung','5. Grundstücksangelegenheit'];
 const m=parseSessionText(mz,{title:'Bekanntmachung Rat',wrapped:true}).meetings.find(x=>x.items.length);
 assert.deepEqual(m.items.map(i=>i.number),['1','2','3','4']);
 assert.match(m.items[2].title,/^9\. Änderung des Bebauungsplanes/);
});

test('notice (Ibbenbüren): a day in a title is no item, a list numbered anew inside an item holds its sub-points',()=>{
 const lines=['Bekanntmachung','Sitzung des Planungs- und Umweltausschusses am 22.09.2026','Tagesordnung','Öffentlicher Teil',
  '1. Niederschrift über den öffentlichen Teil der Sitzung des Planungs- und Umweltausschusses','am 2. Juli 2026',
  '2. Bauleitplanung','2.1 170. Änderung des Flächennutzungsplans für den Bereich der Aufstellung des Bebauungsplans','Nr. 55 a "I-NOVA Park - Ost"',
  '1. Beschluss über die Stellungnahmen','2. Beschluss der 170. Änderung des Flächennutzungsplans',
  '2.2 Bebauungsplan Nr. 55 a "I-NOVA Park - Ost", Aufstellung','3. Anträge, Anfragen, Mitteilungen','Nichtöffentlicher Teil','4. Grundstücksangelegenheit'];
 const m=parseSessionText(lines,{title:'Bekanntmachung Planungs- und Umweltausschuss',wrapped:true}).meetings.find(x=>x.items.length);
 assert.deepEqual(m.items.map(i=>i.number),['1','2','2.1','2.2','3']);
 assert.deepEqual(m.closedItems.map(i=>i.number),['4']);
});

test('head „Die nächste öffentliche / nichtöffentliche Sitzung …“ (Templin) is a general announcement, the parts then by their headings',()=>{
 const lines=['Öffentliche Bekanntmachung','Die nächste öffentliche / nichtöffentliche Sitzung des Hauptausschusses findet am','30.09.2026 um 17:00 Uhr','im Sitzungssaal statt.','TAGESORDNUNG:',
  'I. ÖFFENTLICHE SITZUNG','1. Eröffnung der Sitzung','2. Beratung über die Änderung der Betriebssatzung','3. Anfragen','II. NICHTÖFFENTLICHE SITZUNG','4. Grundstücksangelegenheit'];
 const m=parseSessionText(lines,{title:'Öffentliche Bekanntmachung Hauptausschuss',wrapped:true}).meetings.find(x=>x.items.length);
 assert.deepEqual(m.items.map(i=>i.number),['1','2','3']);
 assert.deepEqual(m.closedItems.map(i=>i.number),['4']);
});

test('items after a head inside the non-public part are kept as non-public items of that meeting, not dropped',()=>{
 const lines=['Einladung zur Sitzung des Gemeinderates am 15.10.2026','Öffentlicher Teil','1. Bebauungsplan Ortsmitte','2. Anfragen','Nichtöffentlicher Teil','3. Grundstücksangelegenheit',
  'Sitzung des Gemeinderates am 15.10.2026','4. Personalangelegenheit','5. Vertragsangelegenheit'];
 const r=parseSessionText(lines,{title:'Einladung Gemeinderat'});
 const m=r.meetings.find(x=>x.items.length);
 assert.deepEqual(m.items.map(i=>i.number),['1','2']);
 assert.deepEqual(m.otherItems.filter(i=>i.publicity==='nonpublic').map(i=>i.number).sort(),['3','4','5']);
});
