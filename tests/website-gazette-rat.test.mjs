import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSessionText} from '../server/integrations/website-text.mjs';
import {articleCandidates} from '../server/integrations/website-feeds.mjs';

// Nachgebildet nach dem Amtsblatt der Stadt Bochum und ihren Seiten „Sitzungstermine und Tagesordnungen des Rates“ (27.10.2026):
// gekürzt, Titel abgewandelt, ohne Namen von Personen. Vorher las der Website-Leser aus beiden Fassungen keinen einzigen Punkt.

// Die Bekanntmachung der Ratssitzung im Amtsblatt (PDF): Kopf und Inhaltsverzeichnis des Heftes vor der Bekanntmachung, Unterpunkte,
// ein nichtöffentlicher Teil, der eine öffentliche Sache ein zweites Mal nennt, danach die Unterschrift und eine Ausschreibung.
const gazette=['Amtsblatt','Herausgeber: Stadt Musterstadt, Der Oberbürgermeister','13. Juli 2026 I','14. Jahrgang, Ausgabe Nr. 28','Seite','Bekanntmachungen',
 'Nr. 75 / 26 - 8. Sitzung des Rates……………………867 - 869','Benachrichtigungen bzw. öffentliche Zustellungen','siehe Anlage Amtsblatt 28 / 2026 (nur online verfügbar bis 27. Juli 2026)',
 '8. Sitzung des Rates','Eine Sitzung des Rates findet am 16.07.2026, 14:00 Uhr, im Saal des Rathauses, Rathausplatz 1, mit der nachfolgend aufgeführten Tagesordnung statt.',
 'Tagesordnung','Öffentlicher Teil','1 Beschlussangelegenheiten','1.1 Wirtschaftsplan 2026 der Veranstaltungs-GmbH','1.2 Aufhebung der Ordnungsbehördlichen Verordnung über das Verbot des Verkaufs',
 'von Lachgas an Minderjährige in der Stadt','Musterstadt vom 14.07.2025','1.3 Aufhebung von Teilbereichen des Bebauungsplans Nr. 344 – Am Berg –','2 Anträge','2.1 Ausstattung städtischer Sporthallen mit Defibrillatoren',
 '3 Mitteilungen und Antworten','3.1 Senkung des CO² - Ausstoßes städtischer Gebäude','4 Anfragen','4.1 Eignung der Fläche des ehemaligen Kraftwerks','Nichtöffentlicher Teil','5 Beschlussangelegenheiten','keine Tagesordnungspunkte',
 '6 Mitteilungen und Antworten','6.1 Aufhebung von Teilbereichen des Bebauungsplans Nr. 344 – Am Berg – hier: Zuordnung der','Stellungnahmen der Öffentlichkeit zu Namen und Adressen',
 'Musterstadt, 03.07.2026','gez. Name','Oberbürgermeister','Dies ist eine unverbindliche Darstellung der eForms-formatierten Bekanntmachung.','1 Beschaffer','1.1 Beschaffer','2 Verfahren','2.1 Verfahren','5 Los'];

test('Amtsblatt einer Stadt: die Ratssitzung trotz Heftkopf mit anderen Tagen, Unterschrift beendet die Tagesordnung, eine Sache in beiden Teilen',()=>{
 const r=parseSessionText(gazette,{title:'Amtsblatt 28 / 2026',wrapped:true});
 const m=r.meetings.find(x=>x.items.length);
 assert.ok(m,'eine Sitzung mit Punkten');
 assert.equal(m.date,'2026-07-16');
 assert.equal(m.committee,'Rat','„Sitzung des Rates“ ist der Rat');
 assert.equal(m.unclear,false);
 // Der Heftkopf (13. Juli 2026) ist keine Sitzung mit Gremium und Punkten; der Leser übernimmt ihn nicht.
 assert.ok(r.meetings.filter(x=>x!==m).every(x=>!x.committee&&!x.items.length));
 assert.deepEqual(m.items.map(i=>i.number),['1','1.1','1.2','1.3','2','2.1','3','3.1','4','4.1']);
 assert.match(m.items.find(i=>i.number==='1.2').title,/Musterstadt vom 14\.07\.2025$/,'eine Satzung mit Datum in der Folgezeile ist kein anderer Sitzungstag');
 assert.ok(m.closedItems.some(i=>i.number==='6.1'&&/Bebauungsplans Nr\. 344/.test(i.title)),'der nichtöffentliche Punkt bleibt nichtöffentlich');
 assert.ok(!m.items.some(i=>i.number==='6.1'),'und kommt nicht unter die öffentlichen');
 assert.ok(!m.items.some(i=>/Beschaffer|Verfahren|Los/.test(i.title)),'nach der Unterschrift beginnt ein anderer Text');
 assert.deepEqual(r.issues.filter(i=>i.includes('16.07.2026')),[]);
});

// Dieselbe Tagesordnung als Seite der Stadt: Nummer und Titel stehen in getrennten Zellen, Titel mit Genderstern, ein Unterpunkt nennt
// eine frühere Ratssitzung, ein Titel beginnt mit einer Ordnungszahl.
const page=['Ratssitzung','am 1. Oktober 2026','Sitzungstermine und Tagesordnungen des Rates','9. Sitzung',
 'Eine Sitzung des Rates findet am 1. Oktober 2026, 14 Uhr, im Saal des Rathauses, mit der nachfolgend aufgeführten Tagesordnung statt.',
 'Öffentlicher Teil','1 Beschlussangelegenheiten','1.1','Neuwahl der Ausschüsse','1.2','Besetzung des Beirates "Leben im Alter"','1.2.1','Besetzung Beirat "Leben im Alter"',
 '1.3','Öffentliche Ausschreibung Beigeordnete*r (w/m/d) für Bildung und Kultur','2 Anträge','2.1','Hitzeschutz auf Schulhöfen','3 Mitteilungen und Antworten','3.1','9. Sachstandsbericht Stadtpark',
 '3.2','Eingriff in die freie Rede im Rahmen der Aussprache zu TOP 1.5 der Ratssitzung vom 16.07.2026','4 Anfragen','4.1','Verlängerung der Sommerpause',
 'Nichtöffentlicher Teil','5 Beschlussangelegenheiten','5.1','Übernahme einer Ausfallbürgschaft','Musterstadt, 21.09.2026','gez. Name','Oberbürgermeister'];

test('Seite der Ratssitzungen: Nummer und Titel in getrennten Zeilen, Genderstern ist keine Fußnote, ein Unterpunkt nennt eine frühere Sitzung',()=>{
 const r=parseSessionText(page,{title:'Ratssitzung am 1. Oktober 2026'});
 const m=r.meetings.find(x=>x.items.length);
 assert.ok(m,'eine Sitzung mit Punkten');
 assert.equal(m.date,'2026-10-01');
 assert.equal(m.committee,'Rat','„Ratssitzung“ ist der Rat');
 assert.deepEqual(m.items.map(i=>i.number),['1','1.1','1.2','1.2.1','1.3','2','2.1','3','3.1','3.2','4','4.1']);
 assert.equal(m.items.find(i=>i.number==='1.1').title,'Neuwahl der Ausschüsse');
 assert.match(m.items.find(i=>i.number==='1.3').title,/Beigeordnete\*r/);
 assert.equal(m.items.find(i=>i.number==='3.1').title,'9. Sachstandsbericht Stadtpark');
 assert.match(m.items.find(i=>i.number==='3.2').title,/der Ratssitzung vom 16\.07\.2026$/);
 assert.ok(m.closedItems.some(i=>i.title==='Übernahme einer Ausfallbürgschaft'));
});

test('eine Nummer allein vor einer Überschrift wird kein Punkt (nur innerhalb einer Tagesordnung)',()=>{
 const lines=['Ratssitzung','am 1. Oktober 2026','Eine Sitzung des Rates findet am 1. Oktober 2026, 14 Uhr, im Rathaus statt.','12','Tagesordnung','Öffentlicher Teil','1 Eröffnung','2 Bericht der Verwaltung'];
 const m=parseSessionText(lines,{title:'Ratssitzung am 1. Oktober 2026'}).meetings.find(x=>x.items.length);
 assert.deepEqual(m.items.map(i=>i.number),['1','2']);
});

test('Artikelseiten einer Lotus-Domino-Site (vwContentByKey) gelten als Artikel einer Liste',()=>{
 const list='https://www.musterstadt.example.test/Amtsblatt';
 const links=[{url:'https://www.musterstadt.example.test/C125830C0038F229/vwContentByKey/W2DZ5954612BOCMDE',kind:'html',label:'Ausgabe 28 / 2026 vom 13. Juli 2026'},
  {url:'https://www.musterstadt.example.test/kontakt',kind:'html',label:'Kontakt'}];
 assert.deepEqual(articleCandidates(links,list),['https://www.musterstadt.example.test/C125830C0038F229/vwContentByKey/W2DZ5954612BOCMDE']);
});

// Nachgebildet nach der Bekanntmachung des Gemeinderats der Stadt Bruchsal (Oktober 2026): der feste Punkt 1 auf drei Zeilen.
test('ein umbrochener fester Punkt „… im / nichtöffentlichen Teil gefassten Beschlüsse“ ist keine Überschrift des nichtöffentlichen Teils',()=>{
 const lines=['Stadt Musterbruch','Öffentliche Bekanntmachung','Am Dienstag, 20.10.2026, 17:00 Uhr, findet im Bürgersaal des Rathauses eine öffentliche Sitzung des Gemeinderats statt.','Tagesordnung',
  '1 Bekanntgabe der','in der Gemeinderatssitzung am 29.09.2026 im','nichtöffentlichen Teil gefassten Beschlüsse','2 Übernahme einer Bürgschaft für die Energie- und','Wasserversorgung in Höhe von 4.000.000 Euro','3 Verschiedenes',
  'Musterbruch, 12.10.2026','gez. Name','Oberbürgermeisterin'];
 const m=parseSessionText(lines,{title:'Öffentliche Bekanntmachung Gemeinderat',wrapped:true}).meetings.find(x=>x.items.length);
 assert.deepEqual(m.items.map(i=>i.number),['1','2','3']);
 assert.equal(m.items[0].title,'Bekanntgabe der in der Gemeinderatssitzung am 29.09.2026 im nichtöffentlichen Teil gefassten Beschlüsse');
 assert.deepEqual(m.closedItems||[],[]);
});

// Nachgebildet nach dem Amtsblatt der Stadt Lünen (Nr. 33 und 36/2026): Vermerk „2. Ergänzung“ unter einem Antrag, Spalte „2N“ (Nachträge).
test('ein Vermerk „2. Ergänzung“ ist kein Punkt 2, „VL-144/2026 2N“ zählt Nachträge und ist keine Markierung „nichtöffentlich“',()=>{
 const lines=['Amtsblatt','Nr. 33/2026','BEKANNTMACHUNG 6 / 2026','GREMIUM Rat der Stadt Musterlünen','SITZUNGSTERMIN Donnerstag, 08.10.2026, 17:00 Uhr','TAGESORDNUNG','ÖF FENTLICHER TE I L',
  '1 Einwohnerfragestunde','2 Beschlussangelegenheiten','2.1 Antrag zum Tag der Vereine','AF-72/2026','2. Ergänzung','2.2 Neufassung der Standgeldsatzung VL-144/2026 2N','3 Mündliche Mitteilungen der Verwaltung',
  'NI CHTÖFFENTLICHER TE I L','4 Beschlussangelegenheiten','4.1 Grundstücksangelegenheit'];
 const m=parseSessionText(lines,{title:'Amtsblatt Nr. 33/2026',wrapped:true}).meetings.find(x=>x.items.length);
 assert.deepEqual(m.items.map(i=>i.number),['1','2','2.1','2.2','3']);
 assert.equal(m.items.find(i=>i.number==='2.2').title,'Neufassung der Standgeldsatzung VL-144/2026');
 assert.deepEqual(m.closedItems.map(i=>i.number),['4','4.1']);
});

// Nachgebildet nach einer Bekanntmachung des Wahlausschusses (Fulda 2026), Namen erfunden.
test('Wahlergebnisse mit Namen und Stimmenzahl werden nie Punkte',()=>{
 const lines=['Öffentliche Bekanntmachung','des Wahlausschusses der Stadt Musterfeld','Der Wahlausschuss hat in seiner Sitzung am 23.03.2026 das endgültige Wahlergebnis festgestellt.','Gewählt sind:',
  '1 Mustermann, Sebastian 9.420','2 Beispiel, Carsten 14.112','3 Probe, Anna-Lena 3.409','4 Testmann, Peter 1.461','Musterfeld, 24.03.2026','gez. Name','Wahlleiter'];
 const r=parseSessionText(lines,{title:'Wahlausschuss',wrapped:true});
 assert.ok(r.meetings.every(m=>!m.items.length&&!(m.otherItems||[]).length&&!(m.closedItems||[]).length));
 assert.ok(r.issues.some(i=>/Wahlergebnis/.test(i)));
});
