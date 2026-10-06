import test from 'node:test';
import assert from 'node:assert/strict';
import {meetingMoves,truncatedText,CARD_NP,SYMBOL,htmlToLines,pdfLines,normalizeLine,germanDates,timeOf,committeeOf,isSpecialPurposeBody,documentKind,isPublicHeading,isNonPublicHeading,parseItemLine,outcomeOf,parseSessionText,closedLine,isNonPublicText,mentionsNonPublic,repairMojibake,decodeEntities,SESSION_WORDS,NONPUBLIC_WORDS} from '../server/integrations/website-text.mjs';
// All pages and PDF texts below are NACHGEBILDET (made up for these tests, not live pages): they copy the way small
// towns write invitations, minutes and Amtsblatt pages, with invented places (Musterbach, Oberdorf) and no real names.

// Text as unpdf returns it for an invitation (mergePages: pages joined by line breaks): letter-spaced headings,
// wrapped titles, a hyphenated word, page lines, the non-public part and the signature.
const invitationPdf=`Gemeinde Musterbach
Seite 1 von 2
Musterbach, 07.10.2026
B e k a n n t m a c h u n g
Am Dienstag, 14.10.2026, 19.00 Uhr, findet im Sitzungssaal des Rathauses eine
öffentliche Sitzung des Gemeinderates Musterbach statt.
T a g e s o r d n u n g   –   ö f f e n t l i c h e r   T e i l
1. Genehmigung der Niederschrift über die öffentliche Sitzung vom
16.09.2026
2. Bauantrag zur Errichtung eines Carports auf dem Grund-
stück Fl.Nr. 123/4, Gemarkung Musterbach
3. Haupt-
und Finanzausschuss: Bericht über die Haushaltslage
- 2 -
4. Bekanntgabe von Beschlüssen aus nichtöffentlicher Sitzung
5. Verschiedenes
N i c h t ö f f e n t l i c h e r   T e i l
6. Grundstücksangelegenheiten
7. Personalangelegenheiten
Hinweis: Die Sitzungsunterlagen liegen im Rathaus zur Einsicht aus.
gez.
Erste Bürgermeisterin`;

// A report on the town's website ("Aus dem Gemeinderat") with the items as headings and every kind of vote count.
const minutesHtml=`<!doctype html><html><head><title>Aus dem Gemeinderat</title><style>p{color:red}</style></head><body>
<header><nav><ul><li><a href="/">Start</a></li><li><a href="/rathaus">Rathaus</a></li></ul></nav></header>
<main><article><h1>Aus dem Gemeinderat</h1>
<p class="date">Veröffentlicht am 20.09.2026</p>
<p>Bericht aus der öffentlichen Sitzung des Gemeinderates am 16. September 2026</p>
<p>1. Bürgermeister Max Muster eröffnete um 19.00 Uhr die Sitzung und stellte die Beschlussfähigkeit fest.</p>
<h3>TOP 1: Genehmigung der Niederschrift vom 15.07.2026</h3><p>Die Niederschrift wird genehmigt.</p><p>Abstimmung: 12:0</p>
<h3>TOP 2: Bauantrag Neubau eines Einfamilienhauses</h3><p>Beschluss:</p><p>1. Das gemeindliche Einvernehmen wird erteilt.</p><p>2. Die Verwaltung wird beauftragt, den Bescheid zu erstellen.</p><p>Ja: 10 Nein: 2 Enthaltungen: 1</p>
<h3>TOP 3: Antrag auf Tempo 30 in der Hauptstraße</h3><p>Der Gemeinderat lehnt den Antrag ab.</p><p>4 Ja-Stimmen, 9 Nein-Stimmen</p>
<h3>TOP 4: Haushalt 2027</h3><p>Der Punkt wird auf die nächste Sitzung vertagt.</p>
<h3>TOP 5: Bericht der Kämmerei</h3><p>Der Gemeinderat nimmt den Bericht zur Kenntnis.</p>
<h3>TOP 6: Straßenbeleuchtung</h3><p>Der Antrag wurde mit 3:9 Stimmen beschlossen.</p>
<h3>TOP 7: Bekanntgabe von Beschlüssen aus nichtöffentlicher Sitzung</h3><p>Der Vorsitzende gab die Vergabe der Bauarbeiten bekannt.</p>
<h3>TOP 8: Kindergartengebühren</h3><p>Ergebnis 12 : 0</p>
<h3>TOP 9: Feuerwehrbedarfsplan</h3><p>Der Gemeinderat stimmt dem Bedarfsplan zu.</p>
</article></main>
<aside><h2>Termine</h2><p>Sitzung des Bauausschusses am 01.11.2026</p></aside>
<footer><p>Impressum · Datenschutz</p></footer></body></html>`;

test('normalizeLine joins letter-spaced words and makes dashes, quotes and spaces uniform',()=>{
 assert.equal(normalizeLine('T a g e s o r d n u n g'),'Tagesordnung');
 assert.equal(normalizeLine('Ö f f e n t l i c h e   S i t z u n g'),'Öffentliche Sitzung');
 assert.equal(normalizeLine('  Tagesordnung — öffentlich '),'Tagesordnung – öffentlich');
 assert.equal(normalizeLine('Sanierung „Alte Schule“ ‐ Los­ 2'),'Sanierung "Alte Schule" - Los 2');
 assert.equal(normalizeLine('Bau- und Umweltausschuss'),'Bau- und Umweltausschuss','ordinary words stay apart');
 assert.equal(normalizeLine('Ö 1 Bauantrag'),'Ö 1 Bauantrag');
});

test('pdfLines drops page numbers and page lines, keeps the text lines',()=>{
 assert.deepEqual(pdfLines('Einladung\nSeite 2 von 5\n- 3 -\n12\n2/5\nGemeinde Musterbach – Seite 3 von 5\n1. Bauantrag\r\n\fSeite 4'),['Einladung','1. Bauantrag']);
});

test('htmlToLines reads the main content, splits blocks and leaves out navigation, side boxes and footer',()=>{
 const lines=htmlToLines(minutesHtml);
 assert.equal(lines[0],'Aus dem Gemeinderat');
 assert.ok(lines.includes('TOP 1: Genehmigung der Niederschrift vom 15.07.2026'));
 assert.ok(lines.includes('Abstimmung: 12:0'));
 for(const gone of ['Start','Rathaus','Impressum · Datenschutz','Termine','Sitzung des Bauausschusses am 01.11.2026'])assert.ok(!lines.includes(gone),gone);
 // Without main or article: the body without its header, navigation and footer; cells of a row form one line.
 const body='<body><header><a href="/">Gemeinde Oberdorf</a></header><nav>Menü</nav><div><h2>Sitzung&nbsp;des Gemeinderates</h2>Am 14.10.2026<br>um 19 Uhr</div><table><tr><td>TOP 1</td><td>Bauantrag <b>Fl.Nr.</b>&nbsp;12</td></tr><tr><td>TOP 2</td><td>Stra&szlig;e &amp; Weg</td></tr></table><script>var x="TOP 9";</script><form><input value="Suche"><button>Suchen</button></form><footer>Kontakt</footer></body>';
 assert.deepEqual(htmlToLines(body),['Sitzung des Gemeinderates','Am 14.10.2026','um 19 Uhr','TOP 1 Bauantrag Fl.Nr. 12','TOP 2 Straße & Weg']);
 assert.deepEqual(htmlToLines('<div role="main"><p>T<strong>agesordnung</strong></p><div>innen</div></div><div>außen</div>'),['Tagesordnung','innen']);
 assert.deepEqual(htmlToLines('<pre>1. Bauantrag\n2. Verschiedenes</pre>'),['1. Bauantrag','2. Verschiedenes']);
});

test('germanDates reads numeric dates, month names and ISO dates and leaves out impossible days',()=>{
 assert.deepEqual(germanDates('Dienstag, 14. Oktober 2026; 14.10.26; 14. Okt. 2026; 2026-10-14; 3. März 2027').map(d=>d.iso),['2026-10-14','2026-10-14','2026-10-14','2026-10-14','2027-03-03']);
 const [d]=germanDates('Sitzung am Dienstag, 14. Oktober 2026 um 19 Uhr');
 assert.deepEqual(d,{iso:'2026-10-14',index:11,text:'Dienstag, 14. Oktober 2026'});
 assert.deepEqual(germanDates('am 31.02.2026 und 30.02.26'),[]);
 assert.deepEqual(germanDates('TOP 3.1.10 und 19.00 Uhr und 12:2').map(d=>d.iso),[]);
 assert.deepEqual(germanDates('7.10.2026').map(d=>d.iso),['2026-10-07']);
});

test('timeOf reads the time of a session',()=>{
 assert.deepEqual(['Beginn 19:00 Uhr','um 19.30 Uhr','um 9 Uhr','14.10.2026','Abstimmung 12:2'].map(timeOf),['19:00','19:30','09:00',null,null]);
});

test('committeeOf names the body without genitive, with its place and with words before it',()=>{
 const cases={
  'Sitzung des Gemeinderates Oberdorf am 14.10.2026':'Gemeinderat Oberdorf','Sitzung des Gemeinderats am 14.10.2026':'Gemeinderat',
  'Einladung zur Sitzung des Bauausschusses':'Bauausschuss','Sitzung des Bau- und Umweltausschusses vom 3. März 2026':'Bau- und Umweltausschuss',
  'Haupt-, Finanz- und Personalausschuss':'Haupt-, Finanz- und Personalausschuss','Werkausschuss':'Werkausschuss','Sitzung des Seniorenbeirates':'Seniorenbeirat',
  'Sitzung des Marktgemeinderates im Rathaus':'Marktgemeinderat','Marktrat':'Marktrat','Stadtverordnetenversammlung':'Stadtverordnetenversammlung',
  'Sitzung der Gemeindevertretung Oberdorf':'Gemeindevertretung Oberdorf','Stadtvertretung':'Stadtvertretung','Verbandsgemeinderat':'Verbandsgemeinderat',
  'Ortsgemeinderat':'Ortsgemeinderat','Samtgemeinderat':'Samtgemeinderat','Sitzung des Ortschaftsrates Unterdorf':'Ortschaftsrat Unterdorf',
  'Ortsbeirat':'Ortsbeirat','Ortsrat':'Ortsrat','Gemeinschaftsversammlung':'Gemeinschaftsversammlung','Amtsausschuss':'Amtsausschuss',
  'Sitzung des Kreistages':'Kreistag','Kreisausschuss':'Kreisausschuss','Ältestenrat':'Ältestenrat','Gemeinderatssitzung vom 14.10.2026':'Gemeinderat',
  'Sitzung des Stadtrates Bad Musterbach':'Stadtrat Bad Musterbach','Ausschuss für Bau, Umwelt und Verkehr am 14.10.2026':'Ausschuss für Bau, Umwelt und Verkehr',
  'Sitzung des Gemeinderates am 14.10.2026':'Gemeinderat','Sitzung des Gemeinderates vom 1.10.2026':'Gemeinderat','Sitzung des Gemeinderates in Oberdorf':'Gemeinderat',
  'Sitzung des Gemeinderates Dienstag, 14.10.2026':'Gemeinderat','Sitzung des Gemeinderates Tagesordnung':'Gemeinderat',
  // Without an article the next word may be a person's name.
  'Stadtrat Muster stellte den Antrag':'Stadtrat',
 };
 for(const [text,name] of Object.entries(cases))assert.equal(committeeOf(text),name,text);
 assert.equal(committeeOf('Gemeinderätin Muster und Ausschussmitglieder'),null);
 assert.equal(committeeOf('Öffentliche Bekanntmachung'),null);
});

test('committeeOf names the association of an assembly, and such bodies are recognised as special-purpose',()=>{
 const name=committeeOf('Sitzung der Verbandsversammlung des Zweckverbandes Wasserversorgung am 03.11.2026');
 assert.equal(name,'Verbandsversammlung Zweckverband Wasserversorgung');
 assert.equal(isSpecialPurposeBody(name),true);
 assert.equal(isSpecialPurposeBody(committeeOf('Verbandsversammlung des Schulverbandes Oberdorf')),true);
 assert.equal(isSpecialPurposeBody('Abwasserzweckverband Musterbach'),true);
 for(const own of ['Gemeinderat','Verbandsgemeinderat','Bauausschuss','Gemeinschaftsversammlung'])assert.equal(isSpecialPurposeBody(own),false,own);
});

test('documentKind tells minutes from invitations, title first',()=>{
 assert.equal(documentKind('Niederschrift Gemeinderat 16.09.2026',[]),'minutes');
 assert.equal(documentKind('Bericht aus der Sitzung des Gemeinderates',[]),'minutes');
 assert.equal(documentKind('Aus dem Stadtrat',[]),'minutes');
 assert.equal(documentKind('Beschlussübersicht',[]),'minutes');
 assert.equal(documentKind('Ergebnisse der Sitzung vom 14.10.',[]),'minutes');
 assert.equal(documentKind('Einladung Bauausschuss',[]),'invitation');
 assert.equal(documentKind('Tagesordnung 14.10.2026',['Niederschrift']),'invitation');
 assert.equal(documentKind('Gemeinderatssitzung',['Am 14.10.2026 findet eine öffentliche Sitzung des Gemeinderates statt.']),'invitation');
 // The item "Genehmigung der Niederschrift" does not make an invitation minutes; the general title "Öffentliche
 // Bekanntmachung" decides only where the text does not.
 assert.equal(documentKind('Sitzung',['Ladung zur Sitzung','1. Genehmigung der Niederschrift']),'invitation');
 assert.equal(documentKind('Öffentliche Bekanntmachung',['Beschlüsse der Sitzung des Gemeinderates vom 14.10.2026']),'minutes');
 assert.equal(documentKind('Öffentliche Bekanntmachung',['Gemeinde Oberdorf']),'invitation');
 assert.equal(documentKind('Gemeinde Oberdorf',['Rathaus','Öffnungszeiten']),null);
});

test('isPublicHeading recognises the headings of the public part only',()=>{
 for(const h of ['Öffentlicher Teil','Öffentliche Sitzung','Tagesordnung – öffentlich','A. Öffentlich','I. Öffentliche Sitzung','Öffentlich:','Tagesordnung (öffentlich)','Teil A: Öffentlicher Teil','1. Öffentlicher Teil','Öffentliche Sitzung des Gemeinderates am 14.10.2026'])assert.equal(isPublicHeading(h),true,h);
 for(const h of ['Herstellung der Öffentlichkeit','Öffentliche Bekanntmachung','Nichtöffentlicher Teil','Nicht öffentliche Sitzung','3. Information der Öffentlichkeit über den Radweg','öffentliche Sitzung des Gemeinderates statt.',`Öffentlicher Teil ${'x'.repeat(90)}`])assert.equal(isPublicHeading(h),false,h);
});

test('isNonPublicHeading recognises the headings of the non-public part, but not items about it',()=>{
 for(const h of ['Nichtöffentlicher Teil','Nicht öffentliche Sitzung','nicht-öffentlich','B. Nichtöffentlich','II. Nichtöffentliche Sitzung','Unter Ausschluss der Öffentlichkeit','Vertraulich','Geschlossene Sitzung','6. Nichtöffentlicher Teil','TOP 6: Nicht öffentlicher Teil','Tagesordnung – nichtöffentlich'])assert.equal(isNonPublicHeading(h),true,h);
 for(const h of ['7. Bekanntgabe von Beschlüssen aus nichtöffentlicher Sitzung','Öffentlicher Teil','Bekanntgabe der in nichtöffentlicher Sitzung gefassten Beschlüsse','4. Vertrauliche Behandlung von Bauanträgen'])assert.equal(isNonPublicHeading(h),false,h);
});

test('parseItemLine reads the ways items are numbered',()=>{
 const cases={
  '1. Genehmigung der Niederschrift':[null,'1','Genehmigung der Niederschrift'],'1) Bauantrag':[null,'1','Bauantrag'],'1 Bauantrag':[null,'1','Bauantrag'],
  'TOP 1 Bauantrag':[null,'1','Bauantrag'],'TOP 1: Bauantrag':[null,'1','Bauantrag'],'TOP 3':[null,'3',''],'Tagesordnungspunkt 4 Haushalt':[null,'4','Haushalt'],
  'Punkt 5: Verschiedenes':[null,'5','Verschiedenes'],'Ö 1 Bauantrag':['Ö','1','Bauantrag'],'Ö1 Bauantrag':['Ö','1','Bauantrag'],'NÖ 2 Grundstücke':['N','2','Grundstücke'],
  'N 2 Grundstücke':['N','2','Grundstücke'],'TOP Ö 3.1: Bauantrag':['Ö','3.1','Bauantrag'],'1.1 Bauantrag':[null,'1.1','Bauantrag'],'1.1. Bauantrag':[null,'1.1','Bauantrag'],
  '03. Verschiedenes':[null,'3','Verschiedenes'],'3. 2. Änderung des Bebauungsplanes':[null,'3','2. Änderung des Bebauungsplanes'],'§ 1':null,
 };
 for(const [line,want] of Object.entries(cases))assert.deepEqual(parseItemLine(line),want&&{prefix:want[0],number:want[1],title:want[2]},line);
});

test('parseItemLine leaves out dates, times, offices, counts, postcodes, plots and amounts',()=>{
 for(const line of ['14.10.2026 Sitzung des Gemeinderates','14. Oktober 2026 Sitzung','19.00 Uhr Sitzungsbeginn','19 Uhr','1. Bürgermeister Max Muster eröffnete die Sitzung','2. Bürgermeisterin','1. Vorsitzende(r)','1. Beigeordneter','3. Stellvertreter','61. Bauantrag','3 Anlagen','12','97816 Musterbach','123/4 Gemarkung Musterbach','12.500 € Zuschuss','12 : 0','12 Ja-Stimmen','Punkt 3 wurde vertagt','2 Gemeinderäte stimmten dagegen'])assert.equal(parseItemLine(line),null,line);
});

test('outcomeOf reads the outcome categories and leaves out negations',()=>{
 const status=t=>outcomeOf(t).status;
 assert.equal(status('Der Gemeinderat beschließt die Satzung.'),'approved');
 assert.equal(status('Das gemeindliche Einvernehmen wird erteilt.'),'approved');
 assert.equal(status('Der Gemeinderat stimmt dem Bauantrag zu.'),'approved');
 assert.equal(status('Einstimmig.'),'approved');
 assert.equal(status('Der Antrag wurde abgelehnt.'),'rejected');
 assert.equal(status('Der Gemeinderat lehnt den Antrag der Fraktion ab.'),'rejected');
 assert.equal(status('Der Gemeinderat stimmt dem Antrag nicht zu.'),'rejected');
 assert.equal(status('Der Antrag fand keine Mehrheit.'),'rejected');
 assert.equal(status('Der Antrag wurde einstimmig abgelehnt.'),'rejected','unanimous goes with the decision');
 assert.equal(status('Der Gemeinderat nimmt den Bericht der Verwaltung zur Kenntnis.'),'info');
 assert.equal(status('Kenntnisnahme, einstimmig.'),'info');
 assert.equal(status('Der Punkt wurde von der Tagesordnung genommen.'),'postponed');
 assert.equal(status('Der Gemeinderat beschließt, den Punkt zu vertagen. Der Punkt wird vertagt.'),'postponed');
 assert.equal(status('Das Einvernehmen wird nicht erteilt.'),null,'a negation is no approval');
 assert.equal(status('Die Satzung wird nicht genehmigt.'),null);
 assert.deepEqual(outcomeOf('Der Bürgermeister berichtet über den Stand der Bauarbeiten.'),{status:null,result:'',votes:null});
});

test('outcomeOf reads five ways of writing vote counts',()=>{
 assert.deepEqual(outcomeOf('Abstimmungsergebnis: 12:2').votes,{yes:12,no:2,abstentions:null});
 assert.deepEqual(outcomeOf('Der Antrag wurde mit 12:2:1 Stimmen angenommen.').votes,{yes:12,no:2,abstentions:1});
 assert.deepEqual(outcomeOf('Beschluss einstimmig\nErgebnis 12 : 0').votes,{yes:12,no:0,abstentions:null});
 assert.deepEqual(outcomeOf('Ja: 12 Nein: 2 Enthaltung: 1'),{status:'approved',result:'Ja: 12 Nein: 2 Enthaltung: 1',votes:{yes:12,no:2,abstentions:1}});
 assert.deepEqual(outcomeOf('12 Ja-Stimmen, 2 Nein-Stimmen, 1 Enthaltung').votes,{yes:12,no:2,abstentions:1});
 assert.equal(outcomeOf('Abstimmung: 3:9').status,'rejected');
 assert.equal(outcomeOf('Sitzungsbeginn 19:30').votes,null,'a time is no count');
});

test('outcomeOf keeps the text of a contradictory outcome without a status, and the result paragraph is short',()=>{
 assert.deepEqual(outcomeOf('Der Antrag wurde mit 3:9 Stimmen beschlossen.'),{status:null,result:'Der Antrag wurde mit 3:9 Stimmen beschlossen.',votes:{yes:3,no:9,abstentions:null}});
 assert.equal(outcomeOf('Der Antrag der Fraktion wurde abgelehnt. Der Vorschlag der Verwaltung wurde beschlossen.').status,null);
 const block=['Sachverhalt:','Die Verwaltung erläutert den Antrag. Es folgt eine Aussprache.','Beschluss:','Der Gemeinderat beschließt den Bebauungsplan Nr. 12 "Am Bach" als Satzung.','Abstimmung: 11:1'].join('\n');
 assert.deepEqual(outcomeOf(block),{status:'approved',result:'Beschluss: Der Gemeinderat beschließt den Bebauungsplan Nr. 12 "Am Bach" als Satzung. Abstimmung: 11:1',votes:{yes:11,no:1,abstentions:null}});
 const long=outcomeOf('Der Gemeinderat beschließt '+'die Maßnahme '.repeat(40)+'.');
 assert.equal(long.result.length,300);assert.ok(long.result.endsWith('…'));
});

test('parseSessionText reads an invitation PDF: letter-spaced headings, wrapped titles, non-public part, signature',()=>{
 const {meetings,issues}=parseSessionText(pdfLines(invitationPdf),{title:'Bekanntmachung Gemeinderat',wrapped:true});
 assert.deepEqual(issues,[]);
 assert.equal(meetings.length,1);
 const [m]=meetings;
 assert.deepEqual([m.date,m.time,m.committee,m.kind,m.restricted,m.unclear],['2026-10-14','19:00','Gemeinderat Musterbach','invitation',true,false]);
 // The sentence of the head comes first; the heading below confirms it.
 assert.equal(m.publicEvidence,'Satz „öffentliche Sitzung des Gemeinderates Musterbach statt.“');
 assert.deepEqual(m.items.map(i=>[i.number,i.title]),[
  ['1','Genehmigung der Niederschrift über die öffentliche Sitzung vom 16.09.2026'],
  ['2','Bauantrag zur Errichtung eines Carports auf dem Grundstück Fl.Nr. 123/4, Gemarkung Musterbach'],
  ['3','Haupt- und Finanzausschuss: Bericht über die Haushaltslage'],
  ['4','Bekanntgabe von Beschlüssen aus nichtöffentlicher Sitzung'],
  ['5','Verschiedenes'],
 ]);
 assert.ok(m.items.every(i=>i.status===null&&i.result===''&&i.votes===null),'an invitation has no outcome');
});

test('parseSessionText reads a report page: items as headings, outcomes, an office that is no item',()=>{
 const {meetings,issues}=parseSessionText(htmlToLines(minutesHtml),{title:'Aus dem Gemeinderat'});
 assert.deepEqual(issues,[]);
 const [m]=meetings;
 assert.deepEqual([m.date,m.time,m.committee,m.kind,m.restricted,m.unclear],['2026-09-16','19:00','Gemeinderat','minutes',false,false]);
 assert.match(m.publicEvidence,/^Satz „Bericht aus der öffentlichen Sitzung/);
 assert.deepEqual(m.items.map(i=>[i.number,i.title,i.status]),[
  ['1','Genehmigung der Niederschrift vom 15.07.2026','approved'],['2','Bauantrag Neubau eines Einfamilienhauses','approved'],
  ['3','Antrag auf Tempo 30 in der Hauptstraße','rejected'],['4','Haushalt 2027','postponed'],['5','Bericht der Kämmerei','info'],
  ['6','Straßenbeleuchtung',null],['7','Bekanntgabe von Beschlüssen aus nichtöffentlicher Sitzung',null],['8','Kindergartengebühren','approved'],
  ['9','Feuerwehrbedarfsplan','approved'],
 ]);
 const by=n=>m.items.find(i=>i.number===n);
 assert.deepEqual(by('1').votes,{yes:12,no:0,abstentions:null});
 // The numbered list inside the decision belongs to item 2, it is no item of its own.
 assert.equal(by('2').result,'Beschluss: 1. Das gemeindliche Einvernehmen wird erteilt. 2. Die Verwaltung wird beauftragt, den Bescheid zu erstellen. Ja: 10 Nein: 2 Enthaltungen: 1');
 assert.deepEqual(by('2').votes,{yes:10,no:2,abstentions:1});
 assert.deepEqual(by('3').votes,{yes:4,no:9,abstentions:null});
 assert.equal(by('6').result,'Der Antrag wurde mit 3:9 Stimmen beschlossen.','contradictory: text kept, no status');
 assert.deepEqual(by('8').votes,{yes:12,no:0,abstentions:null});
});

test('parseSessionText takes nothing without evidence of the public part and says so',()=>{
 const lines=['Einladung','zur Sitzung des Gemeinderates am 14.10.2026 um 19:00 Uhr','Tagesordnung:','1. Bauantrag Neubau Scheune','2. Grundstücksangelegenheit','3. Verschiedenes'];
 const {meetings,issues}=parseSessionText(lines,{title:'Einladung Gemeinderat'});
 assert.equal(meetings.length,1);
 assert.deepEqual([meetings[0].date,meetings[0].committee,meetings[0].items,meetings[0].unclear,meetings[0].publicEvidence],['2026-10-14','Gemeinderat',[],true,'']);
 assert.deepEqual(issues,['Öffentlicher Teil nicht eindeutig erkennbar (Gemeinderat 14.10.2026); 3 Punkte nicht übernommen.']);
 // "Öffentliche Bekanntmachung" tells how the notice is made, not that the session is public.
 assert.equal(parseSessionText(lines,{title:'Öffentliche Bekanntmachung'}).meetings[0].items.length,0);
 // A title that names the public session is evidence; one that names the non-public part closes the document.
 const titled=parseSessionText(lines,{title:'Tagesordnung der öffentlichen Sitzung'}).meetings[0];
 assert.deepEqual([titled.items.length,titled.publicEvidence],[3,'Titel „Tagesordnung der öffentlichen Sitzung“']);
 const closed=parseSessionText(['Öffentlicher Teil',...lines.slice(3)],{title:'Tagesordnung nichtöffentliche Sitzung'}).meetings[0];
 assert.deepEqual([closed.items.length,closed.restricted],[0,true]);
});

test('parseSessionText: items marked Ö are public, the first item marked NÖ ends the public part',()=>{
 const lines=['Sitzung des Bauausschusses','am 05.11.2026, 18:30 Uhr','Ö 1 Bauantrag Neubau Doppelhaus','Ö 2 Bauvoranfrage Gewerbehalle','NÖ 3 Vergabe Kanalsanierung','Ö 4 Anfragen'];
 const [m]=parseSessionText(lines,{}).meetings;
 assert.deepEqual([m.date,m.time,m.committee,m.restricted,m.unclear,m.publicEvidence],['2026-11-05','18:30','Bauausschuss',true,false,'Kennzeichnung „Ö“ der Tagesordnungspunkte']);
 assert.deepEqual(m.items.map(i=>[i.prefix,i.number,i.title]),[['Ö','1','Bauantrag Neubau Doppelhaus'],['Ö','2','Bauvoranfrage Gewerbehalle']]);
 // A public heading and plain numbers, then N: the same.
 const [n]=parseSessionText(['Öffentliche Sitzung','TOP 1 Bauantrag','TOP N 2 Grundstück','TOP 3 Anfragen'],{title:'Gemeinderat 14.10.2026'}).meetings;
 assert.deepEqual([n.items.map(i=>i.number),n.restricted,n.date,n.committee],[['1'],true,'2026-10-14','Gemeinderat']);
});

test('parseSessionText splits an Amtsblatt page into meetings of different bodies, each starting without evidence',()=>{
 const amtsblatt=`Amtsblatt der Gemeinde Musterbach Nr. 41 vom 08.10.2026
Amtliche Bekanntmachungen
Sitzung des Gemeinderates Musterbach
Am Dienstag, 14. Oktober 2026, 19:30 Uhr, findet im Rathaus eine öffentliche Sitzung statt.
Tagesordnung
1. Bauleitplanung Baugebiet "Am Bach"
2. Kindergarten: Erweiterung
Nichtöffentlicher Teil
3. Grundstücksangelegenheiten
Sitzung des Bau- und Umweltausschusses am Donnerstag, 16.10.2026, 18:00 Uhr
Öffentliche Sitzung
1. Bauantrag Neubau Carport
2. Bauantrag Anbau Wintergarten
Sitzung der Verbandsversammlung des Zweckverbandes Wasserversorgung
am 20.10.2026 um 17 Uhr
1. Jahresrechnung 2025
2. Wirtschaftsplan 2027
Musterbach, 07.10.2026
gez. Muster, Bürgermeister`;
 const {meetings,issues}=parseSessionText(pdfLines(amtsblatt),{title:'Amtsblatt Nr. 41',wrapped:true});
 assert.deepEqual(meetings.map(m=>[m.date,m.time,m.committee,m.items.map(i=>i.title),m.restricted,m.unclear]),[
  ['2026-10-14','19:30','Gemeinderat Musterbach',['Bauleitplanung Baugebiet "Am Bach"','Kindergarten: Erweiterung'],true,false],
  ['2026-10-16','18:00','Bau- und Umweltausschuss',['Bauantrag Neubau Carport','Bauantrag Anbau Wintergarten'],false,false],
  // The non-public part of the first meeting does not carry over, and neither does the evidence of the second.
  ['2026-10-20','17:00','Verbandsversammlung Zweckverband Wasserversorgung',[],false,true],
 ]);
 assert.equal(isSpecialPurposeBody(meetings[2].committee),true);
 assert.equal(meetings[1].heading,'Sitzung des Bau- und Umweltausschusses am Donnerstag, 16.10.2026, 18:00 Uhr');
 assert.deepEqual(issues,['Öffentlicher Teil nicht eindeutig erkennbar (Verbandsversammlung Zweckverband Wasserversorgung 20.10.2026); 2 Punkte nicht übernommen.']);
});

test('parseSessionText: dates of signature, notice and earlier minutes are not the day of the meeting',()=>{
 const lines=['Oberdorf, den 07.10.2026','Bekanntmachung vom 08.10.2026','Einladung','Der Gemeinderat tritt am Mittwoch, 21.10.2026, 19.00 Uhr zu einer öffentlichen Sitzung zusammen.','Tagesordnung','1. Genehmigung der Niederschrift vom 16.09.2026','2. Bekanntgaben','gez. Muster','01.10.2026'];
 const [m]=parseSessionText(lines,{title:'Einladung 30.09.2026'}).meetings;
 assert.deepEqual([m.date,m.time,m.committee],['2026-10-21','19:00','Gemeinderat']);
 assert.equal(m.items[0].title,'Genehmigung der Niederschrift vom 16.09.2026');
 // Only a signature date in the head: the title gives the day.
 const [t]=parseSessionText(['Musterbach, 07.10.2026','Öffentliche Sitzung','1. Bauantrag'],{title:'Gemeinderat am 14.10.2026'}).meetings;
 assert.deepEqual([t.date,t.committee],['2026-10-14','Gemeinderat']);
});

test('parseSessionText keeps the first of two items with one number, says so and takes nothing after it',()=>{
 // A list numbered anew may be another meeting's (a collective notice whose second head was not recognised).
 const {meetings,issues}=parseSessionText(['Öffentliche Sitzung des Gemeinderates am 14.10.2026','1. Bauantrag Scheune','2. Haushalt','2. Friedhofssatzung','3. Anfragen'],{});
 assert.deepEqual(meetings[0].items.map(i=>[i.number,i.title]),[['1','Bauantrag Scheune'],['2','Haushalt']]);
 assert.deepEqual(issues,['Punkt 2 doppelt (Gemeinderat 14.10.2026); nur der erste übernommen.']);
});

test('parseSessionText: minutes that list the agenda first take the outcome from the report on each item',()=>{
 const lines=['Niederschrift über die öffentliche Sitzung des Stadtrates am 30.09.2026','Tagesordnung','1. Bebauungsplan "Mühlweg"','2. Zuschuss Sportverein','Nichtöffentlicher Teil','3. Personalsache'];
 // Behind the non-public heading nothing more is taken, also not the report on the public items.
 const [closed]=parseSessionText([...lines,'1. Bebauungsplan "Mühlweg"','Der Stadtrat beschließt den Plan.'],{}).meetings;
 assert.deepEqual(closed.items.map(i=>[i.number,i.status]),[['1',null],['2',null]]);
 const report=['Niederschrift über die öffentliche Sitzung des Stadtrates am 30.09.2026','Tagesordnung','1. Bebauungsplan "Mühlweg"','2. Zuschuss Sportverein','Zu den Punkten:','1. Bebauungsplan "Mühlweg"','Der Stadtrat beschließt den Plan als Satzung.','Abstimmung: 20:3','2. Zuschuss Sportverein','Der Antrag wird zurückgestellt.'];
 const {meetings,issues}=parseSessionText(report,{});
 assert.deepEqual(issues,[]);
 assert.deepEqual(meetings[0].items.map(i=>[i.number,i.title,i.status]),[['1','Bebauungsplan "Mühlweg"','approved'],['2','Zuschuss Sportverein','postponed']]);
 assert.equal(meetings[0].committee,'Stadtrat');
});

test('parseSessionText reads an item heading without title from the next line',()=>{
 const lines=htmlToLines('<main><h2>Öffentliche Sitzung des Gemeinderates am 14.10.2026</h2><h3>TOP 1</h3><p>Bauantrag Neubau Scheune</p><h3>TOP 2</h3><p>Verschiedenes</p></main>');
 assert.deepEqual(parseSessionText(lines,{}).meetings[0].items.map(i=>[i.number,i.title]),[['1','Bauantrag Neubau Scheune'],['2','Verschiedenes']]);
});

test('parseSessionText drops titles without letters or of absurd length',()=>{
 const lines=['Öffentliche Sitzung','1. Bauantrag','2. "§"',`3. Bau${'x'.repeat(420)}`,'4. Anfragen'];
 assert.deepEqual(parseSessionText(lines,{}).meetings[0].items.map(i=>i.number),['1','4']);
});

test('SESSION_WORDS and NONPUBLIC_WORDS sort links and addresses',()=>{
 for(const t of ['Einladung zur Gemeinderatssitzung','Tagesordnung Bauausschuss','Niederschrift 14.10.2026','Sitzungsbericht','Beschlüsse','Stadtrat'])assert.match(t,SESSION_WORDS);
 for(const t of ['Abfallkalender 2026','Öffnungszeiten Rathaus'])assert.doesNotMatch(t,SESSION_WORDS);
 for(const t of ['Tagesordnung nichtöffentlich','Nicht öffentliche Sitzung','/files/nicht-oeffentlich/top3.pdf','/doc/nicht_oeffentliche_sitzung.pdf','tagesordnung%20nicht%20%C3%B6ffentlich.pdf','Vertraulich','Unter Ausschluss der Öffentlichkeit'])assert.match(t,NONPUBLIC_WORDS,t);
 for(const t of ['Tagesordnung öffentliche Sitzung','/files/oeffentliche-sitzung.pdf'])assert.doesNotMatch(t,NONPUBLIC_WORDS,t);
});

test('parseSessionText takes nothing where the head names a non-public part that the agenda does not mark off',()=>{
 const head='Am 14.10.2026 findet eine öffentliche Sitzung des Gemeinderates statt, anschließend eine nichtöffentliche Sitzung.';
 const open=parseSessionText([head,'1. Bauantrag','2. Grundstücksankauf'],{});
 assert.deepEqual([open.meetings[0].items,open.meetings[0].unclear],[[],true]);
 assert.deepEqual(open.issues,['Ende des öffentlichen Teils nicht erkennbar (Gemeinderat 14.10.2026): die Einladung nennt einen nichtöffentlichen Teil, die Tagesordnung grenzt ihn nicht ab; 2 Punkte nicht übernommen.']);
 const marked=parseSessionText([head,'1. Bauantrag','Nichtöffentlicher Teil','2. Grundstücksankauf'],{}).meetings[0];
 assert.deepEqual([marked.items.map(i=>i.title),marked.restricted,marked.unclear],[['Bauantrag'],true,false]);
});

test('parseSessionText reads a page of meeting dates as meetings without items',()=>{
 const {meetings,issues}=parseSessionText(['Sitzungstermine 2026','Gemeinderat – Sitzung am 14.10.2026, 19 Uhr','Bauausschuss – Sitzung am 21.10.2026, 18 Uhr','Gemeinderat – Sitzung am 11.11.2026, 19 Uhr'],{title:'Sitzungstermine'});
 assert.deepEqual(meetings.map(m=>[m.date,m.time,m.committee,m.items.length,m.unclear]),[['2026-10-14','19:00','Gemeinderat',0,false],['2026-10-21','18:00','Bauausschuss',0,false],['2026-11-11','19:00','Gemeinderat',0,false]]);
 assert.deepEqual(issues,[]);
});

// --- fail-closed reading of the public part (texts NACHGEBILDET, not live) ------------------------------------------
const head=['Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026','Öffentlicher Teil','1. Bauantrag Kita','2. Haushalt 2027'];
const titles=(lines,options={})=>parseSessionText(lines,options).meetings.map(m=>m.items.map(i=>i.title));

test('parseSessionText: an item whose own line marks it non-public ends the public part, in any form',()=>{
 for(const rows of [['3. Grundstücksverkauf Lindenweg (nichtöffentlich)','4. Personalangelegenheit Bauhof – nichtöffentlich –'],['3 N Grundstücksverkauf Lindenweg'],['3. Grundstücksverkauf Lindenweg nichtöffentlich'],
  ['N-3 Grundstücksverkauf Lindenweg'],['NÖ/3 Grundstücksverkauf Lindenweg'],['nö 3 Grundstücksverkauf Lindenweg'],['3 (NÖ) Grundstücksverkauf Lindenweg'],['3. Grundstücksverkauf Lindenweg (nö)']]){
  for(const wrapped of [false,true]){
   const [m]=parseSessionText([...head,...rows,'5. Verschiedenes'],{wrapped}).meetings;
   assert.deepEqual([m.items.map(i=>i.title),m.restricted],[['Bauantrag Kita','Haushalt 2027'],true],rows.join(' / '));
  }
 }
 // With keyword items, also a line the item rules do not read ("TOP 3 nichtöffentlich: …") is no continuation of item 2.
 for(const row of ['TOP 3 nichtöffentlich: Grundstücksverkauf Lindenweg','TOP nö 3 Grundstücksverkauf Lindenweg','TOP 3 (nichtöffentlich) Grundstücksverkauf'])
  assert.deepEqual(titles(['Einladung zur Sitzung des Gemeinderates am 14.10.2026','Öffentlicher Teil','TOP 1 Bauantrag Kita','TOP 2 Haushalt 2027',row,'TOP 4 Verschiedenes'],{wrapped:true}),[['Bauantrag Kita','Haushalt 2027']],row);
 // An item of the public part that reports from the non-public part is no such mark.
 assert.deepEqual(titles([...head,'3. Bekanntgabe von Beschlüssen aus nichtöffentlicher Sitzung','4. Verschiedenes']),[['Bauantrag Kita','Haushalt 2027','Bekanntgabe von Beschlüssen aus nichtöffentlicher Sitzung','Verschiedenes']]);
 // A keyword style does not let an item marked NÖ pass unnoticed: TOP 5 behind it is not taken.
 assert.deepEqual(titles(['Einladung zur Sitzung des Gemeinderates am 14.10.2026','Öffentlicher Teil','TOP 1 Bauantrag Kita','TOP 2 Haushalt 2027','NÖ 3 Grundstücksverkauf Lindenweg','NÖ 4 Personalangelegenheit','TOP 5 Verschiedenes']),[['Bauantrag Kita','Haushalt 2027']]);
});

test('parseSessionText: any line naming the non-public part after the first item ends the public part',()=>{
 for(const variant of ['Im Anschluss findet eine nichtöffentliche Sitzung statt.','Nichtöffentlicher Teil (ab TOP 3)','Nichtöffentliche Sitzung ab 20:00 Uhr','*Nichtöffentlicher Teil*','Nichtöffentliche Angelegenheiten','NÖ-Teil',
  'Nichtöffentlicher Teil der Gemeinderatssitzung','Nicht-\nöffentlicher Teil','Nicht\nöffentlicher Teil','– Nichtöffentlicher Teil –','Nicht¨offentlicher Teil','Nichtöffentlicher Teil'.normalize('NFD'),'N.Ö. Teil','Unter Ausschluss der Öffentlichkeit:']){
  const [m]=parseSessionText([...head,...variant.split('\n'),'3. Grundstücksangelegenheit Schmidt','4. Personalangelegenheit'],{}).meetings;
  assert.deepEqual([m.items.map(i=>i.title),m.restricted],[['Bauantrag Kita','Haushalt 2027'],true],variant);
 }
 // The same in HTML: "<b>Nicht</b><br>öffentlicher Teil".
 assert.deepEqual(titles(htmlToLines(`<main><p>${head.join('</p><p>')}</p><p><b>Nicht</b><br>öffentlicher Teil</p><p>3. Grundstücksverkauf Lindenweg</p></main>`)),[['Bauantrag Kita','Haushalt 2027']]);
 // A note after the agenda that names items already read by their numbers: those and all after them are not taken.
 const agenda=['Am 14.10.2026 findet eine öffentliche Sitzung des Gemeinderates statt.','1. Bauantrag Kita','2. Haushalt 2027','3. Grundstücksverkauf','4. Personalangelegenheit Bauhof'];
 const late=parseSessionText([...agenda,'Die Punkte 3 und 4 werden in nichtöffentlicher Sitzung beraten.'],{});
 assert.deepEqual(late.meetings[0].items.map(i=>i.title),['Bauantrag Kita','Haushalt 2027']);
 // A note that does not name them exactly: which are public is not known, nothing is taken.
 for(const note of ['Die beiden letzten Punkte werden unter Ausschluss der Öffentlichkeit behandelt.','Die mit * gekennzeichneten Punkte werden nichtöffentlich beraten.','Die Punkte 1 und 2 sind öffentlich, alle anderen nichtöffentlich.','Die Punkte 4 und 5 werden nichtöffentlich beraten.']){
  const vague=parseSessionText([...agenda,note],{});
  assert.deepEqual([vague.meetings[0].items,vague.meetings[0].unclear],[[],true],note);
  assert.match(vague.issues[0],/^Nichtöffentliche Punkte erst nach der Tagesordnung benannt \(Gemeinderat 14\.10\.2026\)/,note);
 }
});

test('parseSessionText: a head inside the non-public part starts no public meeting',()=>{
 const base=['Einladung zur Sitzung des Gemeinderates Musterbach am 14.10.2026','Öffentlicher Teil','1. Bauantrag Kita','2. Haushalt 2027','Nichtöffentlicher Teil','3. Grundstücksverkauf Lindenweg'];
 for(const note of ['(Vorberatung in öffentlicher Sitzung des Bauausschusses am 23.09.2026)','Öffentliche Sitzung des Gemeinderates am 14.10.2026','Der Bauausschuss empfiehlt in seiner Sitzung am 23.09.2026 die Zustimmung.']){
  const {meetings}=parseSessionText([...base,note,'4. Personalangelegenheit Bauhof','5. Stundung Gewerbesteuer'],{});
  assert.deepEqual(meetings.map(m=>[m.date,m.committee,m.items.map(i=>i.number),m.restricted]),[['2026-10-14','Gemeinderat Musterbach',['1','2'],true]],note);
 }
 // A meeting of another body on another day after it starts afresh (Amtsblatt).
 const {meetings}=parseSessionText([...base,'Sitzung des Bauausschusses am 21.10.2026','Öffentlicher Teil','1. Ausbau Schulweg','Nichtöffentlicher Teil','2. Vergabe Kanalarbeiten'],{});
 assert.deepEqual(meetings.map(m=>[m.date,m.committee,m.items.map(i=>i.title)]),[['2026-10-14','Gemeinderat Musterbach',['Bauantrag Kita','Haushalt 2027']],['2026-10-21','Bauausschuss',['Ausbau Schulweg']]]);
});

test('closedLine reads short headings of the non-public part without spaces and frames; such a line ends the public part',()=>{
 for(const l of ['NICHTOEFFENTLICHERTEIL','B. Nichtöffentlich','*** N.Ö. ***','– Nichtöffentlicher Teil –','NichtöffentlicheAngelegenheiten'])assert.equal(closedLine(l),true,l);
 for(const l of ['Bauantrag Kita','Öffentlicher Teil','7. Bekanntgabe von Beschlüssen aus nichtöffentlicher Sitzung'])assert.equal(closedLine(l),false,l);
 // Also in the head, after the heading of the public part: what follows is not taken.
 const [m]=parseSessionText(['Sitzung des Gemeinderates am 14.10.2026','Tagesordnung – öffentlicher Teil','*** N.Ö. ***','1. Bauantrag Kita'],{}).meetings;
 assert.deepEqual([m.items,m.restricted],[[],true]);
});

test('parseSessionText: the list of those present is no agenda, and offices and mandates are no items',()=>{
 const lines=['Niederschrift über die öffentliche Sitzung des Gemeinderates am 16.09.2026','Anwesend:','1. Bürgermeister Muster','2. Gemeinderat Beispiel','3. Gemeinderätin Probe','4. Gemeinderat Exempel','Tagesordnung:','1. Bauantrag Kita','Der Gemeinderat stimmt zu. Abstimmung: 12:0','2. Haushalt 2027','Der Gemeinderat beschließt den Haushalt. Abstimmung: 11:1'];
 assert.deepEqual(parseSessionText(lines,{}).meetings[0].items.map(i=>[i.number,i.title,i.status]),[['1','Bauantrag Kita','approved'],['2','Haushalt 2027','approved']]);
 // Names without office in the list, then the agenda without a heading: the numbering starts again.
 const plain=['Niederschrift über die öffentliche Sitzung des Gemeinderates am 16.09.2026','Anwesend:','1. Max Muster','2. Erika Probe','1. Bauantrag Kita','Der Gemeinderat stimmt zu.'];
 assert.deepEqual(parseSessionText(plain,{}).meetings[0].items.map(i=>i.title),['Bauantrag Kita']);
 for(const line of ['1. Ortsbürgermeister Muster','1. Bgm. Muster','1. Stadtrat Muster','1. Kämmerin Beispiel','2. Gemeinderätin Probe','1. Hauptamtsleiter Muster','3. GR Beispiel'])assert.equal(parseItemLine(line),null,line);
 assert.deepEqual(parseItemLine('5. Stadtrat – Umbesetzung der Ausschüsse'),{prefix:null,number:'5',title:'Stadtrat – Umbesetzung der Ausschüsse'});
 // A mark glued to the number (Sonneberg: "1ö", "3nö").
 assert.deepEqual(parseItemLine('1ö Beschluss über die Änderung der Feuerwehrsatzung'),{prefix:'Ö',number:'1',title:'Beschluss über die Änderung der Feuerwehrsatzung'});
 assert.deepEqual(parseItemLine('3nö Grundstücksangelegenheit'),{prefix:'N',number:'3',title:'Grundstücksangelegenheit'});
});

test('parseSessionText: deadlines, periods and papers are not the day of the meeting',()=>{
 const day=lines=>parseSessionText(lines,{}).meetings[0].date;
 assert.equal(day(['Einladung','zur öffentlichen Sitzung des Gemeinderates','Anträge zur Tagesordnung sind bis 07.10.2026 einzureichen.','Mittwoch, 14.10.2026, 19:00 Uhr','1. Bauantrag Kita']),'2026-10-14');
 assert.equal(day(['Sitzung des Gemeinderates','Vorlage vom 28.09.2026','am Mittwoch, 14.10.2026','Öffentlicher Teil','1. Bauantrag Kita']),'2026-10-14');
 assert.equal(day(['Öffentliche Bekanntmachung','Auslegung vom 05.10.2026 bis 06.11.2026','Die öffentliche Sitzung des Gemeinderates findet am 14.10.2026 statt.','1. Bauantrag Kita']),'2026-10-14');
 assert.equal(day(['Öffentliche Sitzung des Gemeinderates','Anträge bis zum 07.10.2026','Sitzungstermin: 14.10.2026','1. Bauantrag Kita']),'2026-10-14');
 assert.equal(day(['Sitzung des Gemeinderates am Mittwoch, 14.10.2026','Öffentlicher Teil','1. Bauantrag Kita']),'2026-10-14','a head with weekday is no "place, date" line');
});

test('parseSessionText splits meetings at heads without the word "Sitzung" and at heads on two lines',()=>{
 const gr=['Sitzung des Gemeinderates am Mittwoch, 14.10.2026','Öffentlicher Teil','1. Bauantrag Kita','2. Haushalt 2027'];
 const read=lines=>parseSessionText(lines,{wrapped:true}).meetings.map(m=>[m.date,m.committee,m.items.map(i=>i.title)]);
 assert.deepEqual(read([...gr,'Tagesordnung des Bauausschusses am Dienstag, 21.10.2026, 18:00 Uhr','Öffentlicher Teil','3. Ausbau Lindenstraße','4. Vergabe Pflasterarbeiten']),
  [['2026-10-14','Gemeinderat',['Bauantrag Kita','Haushalt 2027']],['2026-10-21','Bauausschuss',['Ausbau Lindenstraße','Vergabe Pflasterarbeiten']]]);
 assert.deepEqual(read([...gr,'Bauausschuss','Sitzung am Dienstag, 21.10.2026, 18:00 Uhr','Öffentlicher Teil','1. Ausbau Lindenstraße','2. Vergabe Pflasterarbeiten']),
  [['2026-10-14','Gemeinderat',['Bauantrag Kita','Haushalt 2027']],['2026-10-21','Bauausschuss',['Ausbau Lindenstraße','Vergabe Pflasterarbeiten']]]);
 // Numbers again just after the name of a body: the items are not given to the meeting before.
 const {meetings,issues}=parseSessionText([...gr,'Bauausschuss','Termin folgt','1. Ausbau Lindenstraße'],{});
 assert.deepEqual([meetings[0].items,meetings[0].unclear],[[],true]);assert.match(issues.at(-1),/^Punktnummern doppelt nach Angabe eines Gremiums oder Tages/);
});

test('parseSessionText reads an item taken out of order in minutes as an item of its own',()=>{
 const lines=['Niederschrift über die öffentliche Sitzung des Gemeinderates am 16.09.2026','1. Bauantrag Kita','Der Gemeinderat stimmt zu. Abstimmung: 12:0','3. Haushalt 2027 (vorgezogen)','Der Gemeinderat lehnt den Haushaltsentwurf ab. Abstimmung: 3:9','2. Neubau Feuerwehrhaus','Der Gemeinderat beschließt den Neubau. Abstimmung: 11:1'];
 assert.deepEqual(parseSessionText(lines,{}).meetings[0].items.map(i=>[i.number,i.status,i.votes?.yes]),[['1','approved',12],['3','rejected',3],['2','approved',11]]);
});

test('outcomeOf: a decision to reject, a negated rejection, a motion on the procedure and a tie',()=>{
 assert.equal(outcomeOf('Der Gemeinderat beschließt, den Bauantrag abzulehnen. Abstimmung: 10:3').status,'rejected');
 assert.equal(outcomeOf('Das gemeindliche Einvernehmen wird versagt.').status,'rejected');
 assert.equal(outcomeOf('Der Gemeinderat lehnt den Antrag nicht ab, sondern verweist ihn in den Ausschuss.').status,null);
 assert.equal(outcomeOf('Der Antrag auf Ablehnung des Bauantrags wurde angenommen.').status,null);
 assert.equal(outcomeOf('Der Antrag auf Vertagung wurde abgelehnt.').status,null);
 assert.equal(outcomeOf('Der Gemeinderat beschließt mit 9:9 Stimmen.').status,'rejected');
 assert.equal(outcomeOf('Der Gemeinderat beschließt den Neubau. Abstimmung: 11:1').status,'approved');
});

test('normalizeLine and NONPUBLIC_WORDS read umlauts in any Unicode form and the short forms of the non-public part',()=>{
 assert.equal(normalizeLine('Nicht¨offentlicher Teil'),'Nichtöffentlicher Teil');
 assert.equal(normalizeLine('Nichto¨ffentlicher Teil'),'Nichtöffentlicher Teil');
 assert.equal(normalizeLine('Nichtöffentlicher Teil'.normalize('NFD')),'Nichtöffentlicher Teil');
 for(const t of ['Niederschrift nichtöffentliche Sitzung Gemeinderat'.normalize('NFD'),'Protokoll (nö) Gemeinderat','Niederschrift N.Ö. Sitzung','dl/nichtoeff-gr-2026-09-16.pdf','dl/protokoll_noe_2026-09-16.pdf'])assert.equal(isNonPublicText(t),true,t);
 for(const t of ['Noether-Straße','Ö 1 Bauantrag','Tagesordnung öffentliche Sitzung'])assert.equal(isNonPublicText(t),false,t);
});

// --- hardening round 1: the structural rule of the public part (texts NACHGEBILDET) ----------------------------------
test('mentionsNonPublic reads the non-public part in every spelling, but not a report from it',()=>{
 for(const t of ['Nichtöffentlicher Teil','nichtöf- fentlicher Teil','N i c h t ö f - f e n t l i c h e r','Nichtöfentlicher Teil','nicht öffentl. Teil','nichtöfftl.','(n.öff.)','nöff. Teil','(NÖS)','Nicht\ufffdffentlicher Teil','Nicht?ffentlicher Teil',
  'unter Ausschluß der Öffentlichkeit','Für die folgenden Punkte wird die Öffentlichkeit ausgeschlossen.','Vertraulich','Geschlossene Sitzung','geschl. Sitzung','Schluss der öffentlichen Sitzung','Ende des öffentlichen Teils: 20:15 Uhr',
  'Der öffentliche Teil endet um 20:45 Uhr.','Interne Beratung','Information zu TOP 3 und 4: Die Beratung erfolgt in nichtöffentlicher Sitzung.','Bericht der Verwaltung in nichtöffentlicher Sitzung:'])assert.equal(mentionsNonPublic(t),true,t);
 for(const t of ['Bekanntgabe von Beschlüssen aus nichtöffentlicher Sitzung','Bekanntgabe der in nichtöffentlicher Sitzung gefassten Beschlüsse','Öffentlicher Teil','Herstellung der Öffentlichkeit','Bauantrag Noether-Straße','Die Tür ist nicht offen','nicht öffnen'])assert.equal(mentionsNonPublic(t),false,t);
});

test('repairMojibake and decodeEntities undo text read in the wrong charset or escaped more than once',()=>{
 assert.equal(repairMojibake('NichtÃ¶ffentlicher Teil â€“ GrundstÃ¼cke'),'Nichtöffentlicher Teil – Grundstücke');
 assert.equal(repairMojibake(repairMojibake('Ã–ffentlich')),'Öffentlich');
 assert.equal(repairMojibake('NichtÃƒÂ¶ffentlich'),'Nichtöffentlich','read wrongly twice');
 assert.equal(repairMojibake('Ärger über Öl'),'Ärger über Öl','correct text stays');
 assert.equal(decodeEntities('Nicht&amp;ouml;ffentlich &amp;amp;#246; Nicht&ZeroWidthSpace;öffentlich'),'Nichtöffentlich ö Nichtöffentlich');
 assert.equal(normalizeLine('NichtÃ¶ffentlicher Teil'),'Nichtöffentlicher Teil');
 assert.equal(normalizeLine('Nicht – öffentlicher Teil'),'Nicht-öffentlicher Teil');
});

test('htmlToLines keeps buttons, summaries, icon titles and image alternatives as text and separates inline cells',()=>{
 const lines=htmlToLines('<main><h2><button>Nichtöffentlicher Teil</button></h2><details><summary>Teil B</summary></details><ul><li><span>TOP 2</span><span>Lindenweg</span><span class="badge">NÖ</span></li></ul><p>Grundstück <i class="fa fa-lock" title="nichtöffentlich"></i></p><p><img src="x.png" alt="nicht öffentlich"></p><p><abbr title="nichtöffentlich">N</abbr></p><p>Kita <i class="icon-lock"></i></p><p>A<br/>B</p><p><strong>T</strong>agesordnung</p></main>');
 assert.deepEqual(lines,['Nichtöffentlicher Teil','Teil B','TOP 2 Lindenweg NÖ','Grundstück nichtöffentlich','nicht öffentlich','nichtöffentlich N','Kita (nichtöffentlich)','A','B','Tagesordnung']);
 // Without main: the body without its frame, also the headings of a part between articles; a frame that names the
 // non-public part (tabs in <nav>) stays.
 assert.deepEqual(htmlToLines('<body><header>Gemeinde</header><h2>Öffentlicher Teil</h2><article><h3>TOP 1 Kita</h3></article><h2>Nichtöffentlicher Teil</h2><article><h3>TOP 2 Lindenweg</h3></article><footer>Impressum</footer></body>'),['Öffentlicher Teil','TOP 1 Kita','Nichtöffentlicher Teil','TOP 2 Lindenweg']);
 assert.deepEqual(htmlToLines('<main><nav><a href="#a">Öffentliche Sitzung</a><a href="#b">Nichtöffentliche Sitzung</a></nav><nav><a href="/">Start</a></nav><p>TOP 1 Kita</p></main>'),['Öffentliche Sitzung Nichtöffentliche Sitzung','TOP 1 Kita']);
});

test('parseSessionText: a mark of the non-public part next to an item drops that item and all after it',()=>{
 const head=['Einladung zur öffentlichen Sitzung des Gemeinderates am Mittwoch, 14.10.2026','Tagesordnung','1. Bauantrag Kita','2. Haushalt 2027','3. Grundstücksverkauf Lindenweg'];
 for(const mark of ['(nichtöffentlich)','– nicht öffentlich –','Status: nicht öffentlich','N','wird nichtöffentlich beraten'])
  for(const wrapped of [false,true])assert.deepEqual(titles([...head,mark,'4. Verschiedenes'],{wrapped}),[['Bauantrag Kita','Haushalt 2027']],mark);
 // A column of marks at the end of each row, or a status below each item.
 assert.deepEqual(titles(['Öffentliche Sitzung des Gemeinderates am 14.10.2026','Nr. Gegenstand Ö/N','1 Bauantrag Kita Ö','2 Haushalt 2027 ö','3 Lindenweg N','4 Verschiedenes Ö']),[['Bauantrag Kita','Haushalt 2027']]);
 assert.deepEqual(titles(['Öffentliche Sitzung des Gemeinderates am 14.10.2026','TOP Gegenstand öffentlich','1 Bauantrag Kita ja','2 Lindenweg nein','3 Verschiedenes ja']),[['Bauantrag Kita']]);
 assert.deepEqual(titles(['Öffentliche Sitzung des Gemeinderates am 14.10.2026','TOP Gegenstand öffentlich','1 Bauantrag Kita ja','2 Lindenweg']),[[]],'a row without its mark: nothing');
 assert.deepEqual(titles(['Öffentliche Sitzung des Gemeinderates am 14.10.2026','TOP 1 Bauantrag Kita','öffentlich','TOP 2 Haushalt 2027','TOP 3 Verschiedenes','öffentlich']),[[]],'a status below some items only: nothing');
 // An item marked Ö keeps its mark; the bare N on the next line belongs to the next item.
 assert.deepEqual(titles(['Öffentliche Sitzung des Gemeinderates am 14.10.2026','Ö 1 Bauantrag Kita','Ö 2 Haushalt 2027','N','3 Lindenweg']),[['Bauantrag Kita','Haushalt 2027']]);
});

test('parseSessionText: footnote marks, vague notes and an unclassified mention drop the whole meeting',()=>{
 const head=['Am Mittwoch, 14.10.2026 findet eine öffentliche Sitzung des Gemeinderates statt.','1. Bauantrag Kita','2. Haushalt 2027'];
 for(const rows of [['3. Lindenweg*','*) nichtöffentlich'],['3. Lindenweg¹','¹ nichtöffentliche Beratung'],['3. Lindenweg (1)','(1) nicht öffentlich'],['3. Lindenweg','Die beiden letzten Punkte werden unter Ausschluss der Öffentlichkeit behandelt.'],
  ['3. Lindenweg','Die Unterlagen liegen im Rathaus aus.','Zu diesem Zeitpunkt wird über die Sache auch im Kreis der Mitglieder nichtöffentlich gesprochen werden, wie in der Geschäftsordnung vorgesehen.']]){
  const r=parseSessionText([...head,...rows],{});
  assert.deepEqual([r.meetings[0].items,r.meetings[0].unclear],[[],true],rows.join(' / '));
 }
 // A note that names its items exactly drops those and all after them.
 assert.deepEqual(titles([...head,'3. Lindenweg','4. Personal','Ab Ziffer 3 nichtöffentlich.']),[['Bauantrag Kita','Haushalt 2027']]);
 assert.deepEqual(titles([...head,'3. Lindenweg','TOP 3 bis 4 nichtöffentlich','4. Personal']),[['Bauantrag Kita','Haushalt 2027']]);
});

test('parseSessionText: another heading of a part ends the public block, and a legend must agree with it',()=>{
 const head=['Am Montag, 20.10.2026, 18.00 Uhr findet die öffentliche Sitzung des Gemeinderates statt.','Tagesordnung','Teil A','1. Einwohnerfragestunde','2. Haushaltssatzung 2027','Teil B','3. Vergabe Schulbus'];
 assert.deepEqual(titles(head),[['Einwohnerfragestunde','Haushaltssatzung 2027']]);
 assert.deepEqual(titles([...head,'Teil A: öffentlich, Teil B: nicht öffentlich']),[['Einwohnerfragestunde','Haushaltssatzung 2027']]);
 assert.deepEqual(titles([...head,'Teil A: nicht öffentlich, Teil B: öffentlich']),[[]],'a legend that contradicts the parts: nothing');
 assert.deepEqual(titles(['Öffentliche Sitzung des Marktgemeinderates am 14.10.2026','I. Öffentliche Sitzung','1. Bauantrag Kita','II.','2. Lindenweg']),[['Bauantrag Kita']]);
});

test('parseSessionText joins a heading broken by hyphenation, letter spacing and a page break before it reads it',()=>{
 const head=['Am Dienstag, 14.10.2026, 19.00 Uhr, findet eine öffentliche Sitzung des Gemeinderates statt.','1. Bauantrag Kita','2. Haushalt 2027'];
 for(const broken of [['Nichtöf-','fentlicher Teil'],['Nicht-','Gemeinde Adorf – Einladung Gemeinderat 14.10.2026','öffentlicher Teil'],['Nichtöffent-','- 2 -','Gemeinde Adorf','Einladung','licher Teil'],['N i c h t ö f -','f e n t l i c h e r   T e i l'],['Nicht-','Gemeinde Adorf']])
  assert.deepEqual(titles(pdfLines([...head,...broken,'3. Grundstücksverkauf Lindenweg'].join('\n')),{wrapped:true}).flat().filter(t=>/Lindenweg/.test(t)),[],broken.join(' / '));
 // In the head: "… eine nichtöffent-" / "liche Sitzung statt." names the non-public part; the agenda does not mark it.
 const r=parseSessionText(pdfLines('Am Dienstag, 14.10.2026, findet eine öffentliche Sitzung des Gemeinderates statt; im Anschluss\ndaran findet eine nichtöffent-\nliche Sitzung statt.\n1. Bauantrag Kita\n2. Lindenweg'),{wrapped:true});
 assert.deepEqual([r.meetings[0].items,r.meetings[0].unclear],[[],true]);
});

test('parseSessionText: the day is not that of a letter head, a gazette issue, a cancelled meeting or a report without year',()=>{
 const day=(lines,title='')=>parseSessionText(lines,{title}).meetings[0].date;
 assert.equal(day(['Gemeinde Adorf','Datum: 07.10.2026','Einladung','Gremium: Gemeinderat','Sitzungstermin: 14.10.2026','Öffentlicher Teil','1. Bauantrag Kita']),'2026-10-14');
 assert.equal(day(['Amt Fdorf','Datum: Dienstag, 07.10.2026','Einladung zur Sitzung','der Gemeindevertretung Gdorf','Sitzungsdatum: 14.10.2026','Öffentlicher Teil','1. Bauantrag Kita']),'2026-10-14');
 const cancelled=parseSessionText(['Einladung','Datum: 14.10.2026','Beginn: 19:00 Uhr','Die für Montag, 13.10.2026, 18 Uhr angesetzte Sitzung des Bauausschusses entfällt.','Öffentlicher Teil','1. Bauantrag Kita'],{title:'Einladung Gemeinderat'}).meetings[0];
 assert.deepEqual([cancelled.date,cancelled.committee,cancelled.time],['2026-10-14','Gemeinderat','19:00']);
 assert.equal(day(['Sitzung des Bauausschusses','am Montag, 20.10.2026, 18.00 Uhr','(Ersatz für die ausgefallene Sitzung vom Montag, 13.10.2026, 18.00 Uhr)','Öffentlicher Teil','1. Bauantrag Kita']),'2026-10-20');
 assert.equal(day(['Die für den 07.10.2026 geplante öffentliche Sitzung des Gemeinderates wird auf Mittwoch, 14.10.2026, 19:30 Uhr, verlegt.','1. Bauantrag Kita']),'2026-10-14');
 assert.equal(day(['Mitteilungsblatt der Gemeinde Musterbach','Freitag, 2. Oktober 2026 Nr. 40','Die nächste öffentliche Sitzung des Gemeinderates findet am Mittwoch, 14. Oktober, um 19.30 Uhr statt.','1. Bauantrag Kita']),'2026-10-14');
 assert.equal(day(['Gemeindeblatt Musterbach · Ausgabe 41 · 9. Oktober 2026','Öffentliche Sitzung des Gemeinderates','am Mittwoch, 14.10., 19:30 Uhr, im Rathaus','1. Bauantrag Kita']),'2026-10-14');
 assert.equal(day(['20.10.2026','Aus dem Gemeinderat','In seiner öffentlichen Sitzung am 14. Oktober hat sich der Gemeinderat befasst:','TOP 1 Bauantrag Kita'],'Aus dem Gemeinderat'),null);
 assert.equal(day(['20.10.2026 | Rathaus','Die öffentliche Sitzung des Gemeinderates fand am Mittwoch statt.','TOP 1 Bauantrag Kita'],'Aus dem Gemeinderat'),null);
});

test('parseSessionText splits a page of dates at each day with its body',()=>{
 const {meetings}=parseSessionText(htmlToLines('<main><h1>Termine</h1><h3>Mittwoch, 14.10.2026</h3><p>19:00 Uhr Gemeinderat, Sitzungssaal Rathaus</p><p>Öffentliche Tagesordnung</p><p>TOP 1 Bauantrag Kita</p><h3>Dienstag, 20.10.2026</h3><p>18:00 Uhr Bauausschuss, Rathaus</p><p>Öffentliche Tagesordnung</p><p>TOP 1 Bauvoranfrage</p><p>TOP 2 Vergabe Kanalarbeiten</p></main>'),{title:'Sitzungstermine'});
 assert.deepEqual(meetings.map(m=>[m.date,m.time,m.committee,m.items.map(i=>i.title)]),[['2026-10-14','19:00','Gemeinderat',['Bauantrag Kita']],['2026-10-20','18:00','Bauausschuss',['Bauvoranfrage','Vergabe Kanalarbeiten']]]);
});

test('parseSessionText: members, roles and those elected before or inside the agenda are no items',()=>{
 assert.deepEqual(titles(['Niederschrift über die öffentliche Sitzung des Gemeinderates am 14.10.2026','Gemeinderatsmitglieder:','1. Huber Josef','2. Maier Anna','Tagesordnung','1. Genehmigung der Niederschrift','2. Bauantrag Kita']),[['Genehmigung der Niederschrift','Bauantrag Kita']]);
 assert.deepEqual(titles(['Niederschrift über die öffentliche Sitzung des Gemeinderates am 14.10.2026','1. Vorsitzender: Erster Bürgermeister Max Muster','2. Gemeinderäte: Hans Probe, Erika Beispiel','3. Verwaltung: Kämmerer Fritz Zahl','Tagesordnung','1. Bauantrag Kita']),[['Bauantrag Kita']]);
 assert.deepEqual(titles(['Niederschrift über die öffentliche Sitzung des Gemeinderates am 14.10.2026','Öffentlicher Teil','1. Wahl des Zweiten Bürgermeisters','Gewählt wurde:','1. Gemeinderat Hans Maier mit 9 Stimmen','2. Gemeinderätin Petra Schulz mit 4 Stimmen','2. Bauantrag Kita','Abstimmung: 11:1']),[['Wahl des Zweiten Bürgermeisters','Bauantrag Kita']]);
 for(const line of ['1. Huber, Josef (CSU)','2. Maier Hans CSU','3. Max Mustermann (SPD)','4. Huber, Anna Erste Bürgermeisterin','5. Gemeinderat Hans Maier mit 9 Stimmen','6. Gemeinderäte: Hans Probe, Erika Beispiel'])assert.equal(parseItemLine(line),null,line);
 assert.deepEqual(parseItemLine('3. Verschiedenes, Anfragen'),{prefix:null,number:'3',title:'Verschiedenes, Anfragen'});
});

test('outcomeOf reads refusals and a motion whose wording holds "nicht zu" (round 2)',()=>{
 const cases=[
  ['Der Gemeinderat stimmt dem Antrag der CSU-Fraktion, die Hebesätze nicht zu erhöhen, einstimmig zu.','approved'],
  ['Beschluss: Der Gemeinderat beschließt, dem Antrag nicht stattzugeben.\nAbstimmung: 12 : 3','rejected'],
  ['Beschluss: Das gemeindliche Einvernehmen wird nicht hergestellt.\nAbstimmung: einstimmig','rejected'],
  ['Beschluss: Das gemeindliche Einvernehmen wird nicht erteilt.\nAbstimmung: 9 : 4','rejected'],
  ['Beschluss: Dem Antrag wird nicht entsprochen.\nAbstimmung: 10 : 3','rejected'],
  ['Beschluss: Ein Zuschuss wird nicht gewährt.\nAbstimmung: einstimmig','rejected'],
  ['Das Einvernehmen wurde nicht in Aussicht gestellt. Der Bauwerber wird informiert.\nAbstimmung: 12 : 1','rejected'],
  ['Der Gemeinderat stimmt dem Antrag nicht zu.','rejected'],
  ['Der Gemeinderat stimmt dem Antrag zu.','approved'],
 ];
 for(const [text,status] of cases)assert.equal(outcomeOf(text).status,status,text);
});

test('outcomeOf reads votes "dafür/dagegen" and a refusal that is negated (round 3)',()=>{
 const a=outcomeOf('Beschluss: Der Gemeinderat stimmt dem Antrag zu.\nAbstimmungsergebnis: 3 dafür, 9 dagegen');
 assert.deepEqual(a.votes,{yes:3,no:9,abstentions:null});
 assert.notEqual(a.status,'approved');
 assert.deepEqual(outcomeOf('Abstimmung: dafür: 9, dagegen: 3, Enthaltungen: 1').votes,{yes:9,no:3,abstentions:1});
 assert.notEqual(outcomeOf('Beschluss: Das gemeindliche Einvernehmen wird nicht verweigert. Einstimmig.').status,'rejected');
 assert.notEqual(outcomeOf('Beschluss: Die Genehmigung wird nicht versagt. Abstimmung: 12:0').status,'rejected');
});

// Round 4: regressions of leaks found by the hardening agents (texts NACHGEBILDET).
test('outcomeOf: a negation after the verb or before the object rejects',()=>{
 for(const t of ['Der Bauausschuss erteilt das gemeindliche Einvernehmen nicht.','Der Gemeinderat befürwortet den Antrag nicht.','Der Gemeinderat genehmigt die Niederschrift nicht.','Der Gemeinderat erteilt keine Zustimmung.','Der Bauausschuss erteilt das gemeindliche Einvernehmen nicht. Abstimmung: 10:2'])
  assert.equal(outcomeOf(t).status,'rejected',t);
 for(const t of ['Der Gemeinderat erteilt das Einvernehmen. Abstimmung: 12:0','Der Gemeinderat beschließt den Haushalt, der keine neuen Schulden vorsieht.','Der Gemeinderat genehmigt die Niederschrift. Herr Maier war nicht anwesend.'])
  assert.equal(outcomeOf(t).status,'approved',t);
});

test('parseSessionText: a numbered list of decisions after "Der Gemeinderat beschließt:" is the text of its item',()=>{
 const html='<main><h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 16.09.2026</h1><p>1. Bebauungsplan "Am Mühlbach" – Satzungsbeschluss</p><p>Der Gemeinderat beschließt:</p><p>1. Die Abwägung wird gebilligt.<br>2. Der Bebauungsplan wird als Satzung beschlossen.<br>3. Die Verwaltung wird beauftragt, den Satzungsbeschluss bekannt zu machen.</p><p>Abstimmung: 12:0</p><p>2. Haushalt 2027</p><p>Der Antrag wird mit 4:9 Stimmen abgelehnt.</p><p>3. Kita-Gebühren</p><p>Der Gemeinderat lehnt die Erhöhung ab.</p></main>';
 const m=parseSessionText(htmlToLines(html),{title:'Niederschrift Gemeinderat 16.09.2026'}).meetings[0];
 assert.deepEqual(m.items.map(i=>[i.number,i.title,i.status]),[['1','Bebauungsplan "Am Mühlbach" – Satzungsbeschluss','approved'],['2','Haushalt 2027','rejected'],['3','Kita-Gebühren','rejected']]);
});

test('mentionsNonPublic: listeners not admitted, typing errors, county codes and the end of the public part in other words',()=>{
 for(const t of ['Besucher sind zu den folgenden Punkten nicht zugelassen.','Presse und Zuhörer sind ausgeschlossen','Der Vorsitzende schließt die Öffentlichkeit für die weiteren Tagesordnungspunkte aus.','Die weiteren Punkte werden ohne Beteiligung der Öffentlichkeit beraten.',
  'Im zweiten Teil der Sitzung, zu dem Zuhörer keinen Zutritt hatten, ging es um:','Bei den folgenden Punkten mussten die Zuhörer draußen bleiben:','Nach einer kurzen Pause wurde unter sich weiterberaten über:','Die Sitzung wird intern fortgesetzt.',
  'Nichöffentliche Sitzung','Nichtöffetnliche Sitzung','Nciht öffentliche Sitzung','NICHÖFFENTLICHE SITZUNG','Unöffentliche Sitzung','N-Sitzung','Weitere Punkte in geschlossener Runde','Sitzungsfortsetzung nur für Mandatsträger',
  'Grundstücksverkauf (§ 35 (1) GemO)','(gem. § 35 I 2 GemO)','(Art. 46 Abs. 2 LKrO)','(§ 33 Abs. 2 KrO NRW)','(§ 32 HKO)','(Art. 41 Abs. 2 BezO)','(u. A. d. Ö.)',
  'Ende der Sitzung (öffentlicher Teil): 20:15 Uhr','Öffentliche Sitzung Ende: 20:15 Uhr','Ende ÖT 20:15 Uhr','Öffentlicher Sitzungsteil: 19:00 Uhr bis 20:15 Uhr','Im Anschluss an den öffentlichen Teil wurde weiter beraten über:'])
  assert.ok(mentionsNonPublic(t),t);
 for(const t of ['Bebauungsplan Nr. 12 – frühzeitige Beteiligung der Öffentlichkeit','Unterlagen sind noch öffentlich ausgelegt','Bericht über Besucherzahlen im Freibad','Breitbandausbau Internet','Nichtigkeitsklage gegen Bescheid'])
  assert.ok(!mentionsNonPublic(t),t);
});

test('htmlToLines: struck days go, symbols of unknown meaning stand as SYMBOL, the badge of an item\'s card marks it',()=>{
 assert.deepEqual(htmlToLines('<main><h1>Sitzung des Gemeinderates am <del>07.10.2026</del> 14.10.2026</h1><p><span style="text-decoration: line-through">Mittwoch, 07.10.2026</span> NEU</p></main>'),['Sitzung des Gemeinderates am 14.10.2026','NEU']);
 assert.deepEqual(htmlToLines('<main><p><del>Nichtöffentlicher Teil</del></p></main>'),['Nichtöffentlicher Teil'],'struck text that names the non-public part stays');
 assert.deepEqual(htmlToLines('<main><table><tr><td>2</td><td>Grundstück</td><td><img src="/i/status.gif" alt=""></td></tr><tr><td>3</td><td>Kita</td><td><i class="mdi mdi-eye-off"></i></td></tr><tr><td>4</td><td>Haushalt <span class="material-icons">lock</span></td></tr></table></main>'),[`2 Grundstück ${SYMBOL}`,'3 Kita (nichtöffentlich)','4 Haushalt (nichtöffentlich)']);
 assert.deepEqual(htmlToLines('<main><ul><li data-status="nichtoeffentlich">2. Grundstück</li></ul><table><tr class="rowNonPublic"><td>3</td><td>Kita</td></tr></table></main>'),['2. Grundstück (nichtöffentlich)','3 Kita (nichtöffentlich)']);
 assert.deepEqual(htmlToLines('<main><div class=card><h3>TOP 3 Grundstück</h3><p>Vorlage 2026/043</p><span class=badge>II</span></div></main>').at(-1),CARD_NP);
 assert.deepEqual(htmlToLines('<main><p>1. Bauantrag <a href="/v.pdf"><img src="/i/pdf.gif" alt=""></a> <i class="fa fa-chevron-right"></i></p></main>'),['1. Bauantrag'],'symbols of a link or of plain meaning are none');
});

test('meetingMoves and truncatedText read notices of moved meetings and cropped teasers',()=>{
 assert.deepEqual(meetingMoves(['Die für Mittwoch, 07.10.2026 angesetzte Sitzung des Gemeinderates wird auf Mittwoch, 14.10.2026, 19:00 Uhr verlegt.','Die Sitzung des Bauausschusses am 13.10.2026 entfällt.']),[{from:'2026-10-07',to:'2026-10-14',committee:'Gemeinderat'},{from:'2026-10-13',to:null,committee:'Bauausschuss'}]);
 assert.deepEqual(meetingMoves(['Öffentliche Sitzung des Gemeinderates (Fortsetzung der Sitzung vom 07.10.2026)']),[]);
 for(const l of [['4. Grundstücksverkauf Fl.Nr. 412 …'],['4. Grundstück (n...'],['Weiterlesen »'],['[…]']])assert.ok(truncatedText(l),l[0]);
 assert.ok(!truncatedText(['1. Bauantrag Kita','2. Haushalt 2027']));
});

// --- round 5 (texts NACHGEBILDET) -------------------------------------------------------------------------------------
test('outcomeOf: a decision that refuses ("nicht genehmigt", "nicht gegeben", "keine Möglichkeit … zuzustimmen") is a rejection whatever the count',()=>{
 for(const t of ['Beschluss: Der Antrag wird nicht genehmigt.\nAbstimmung: 13:0','Beschluss: Die Zustimmung zum Bauvorhaben wird nicht gegeben.\nAbstimmung: 13:0','Der Gemeinderat sieht keine Möglichkeit, dem Antrag zuzustimmen.\nAbstimmung: 13:0'])assert.equal(outcomeOf(t).status,'rejected',t);
 assert.equal(outcomeOf('Der Antrag wird genehmigt. Abstimmung: 13:0').status,'approved');
});
test('pdfLines keeps a heading of a part that shares its line with the page number; normalizeLine reads full-width letters and "TeilB"',()=>{
 assert.deepEqual(pdfLines('1. Bauantrag Kita\nNichtöffentlicher Teil Seite 2 von 2\nSeite 2 / 3\nGemeinde Musterbach Seite 1 von 2\nEinladung GR – nichtöffentlicher Teil Seite 2 / 2'),['1. Bauantrag Kita','Nichtöffentlicher Teil','Einladung GR – nichtöffentlicher Teil']);
 assert.equal(normalizeLine('ＮＩＣＨＴÖＦＦＥＮＴＬＩＣＨＥＲ ＴＥＩＬ'),'NICHTÖFFENTLICHER TEIL');
 assert.equal(normalizeLine('TeilB'),'Teil B');assert.equal(normalizeLine('Teilnahme'),'Teilnahme');
});
test('mentionsNonPublic reads the paragraph that excludes the public with the Land before the code, and other words of the closed part',()=>{
 for(const t of ['(§ 37 Abs. 1 Satz 1 Sächs. GemO)','gemäß § 36 Abs. 2 Bbg. KVerf','(Art. 52 Abs. 2 Bayerische Gemeindeordnung)','gem. § 40 Abs. 1 Thüringer Kommunalordnung','(gem. § 52 Abs. 2 Kommunalverfassungsgesetz)','(§ 52 Abs. 1 Hessische Gemeindeordnung)','(nach § 37 Absatz 1 der Sächsischen Gemeindeordnung)','Grundstück (geschl.)','unterliegt der Verschwiegenheitspflicht','Teilnahme nur Gemeinderatsmitglieder','Danach blieb der Rat unter sich','tagte intern weiter','nicht vor Publikum','ohne Bürger beraten','Im kleinen Kreis'])assert.ok(mentionsNonPublic(t),t);
 for(const t of ['Einvernehmen nach § 36 BauGB','Bauvorhaben im Außenbereich nach § 35 BauGB','Antrag auf Zuschuss für die Bürgerstiftung'])assert.ok(!mentionsNonPublic(t),t);
});
test('htmlToLines puts the label of a tab at the start of its panel and keeps a legend of the template outside main',()=>{
 const tabs=htmlToLines('<main><div id="t1"><p>1. Bauantrag Kita</p></div><div id="t2"><p>3. Grundstück</p></div><ul class="nav-tabs"><li><a href="#t1">Öffentlich</a></li><li><a href="#t2">Nichtöffentlich</a></li></ul></main>');
 assert.deepEqual(tabs.slice(0,4),['Öffentlich','1. Bauantrag Kita','Nichtöffentlich','3. Grundstück']);
 assert.ok(htmlToLines('<html><body><main><p>1. Bauantrag Kita</p></main><footer><p>Grau dargestellte Punkte werden nichtöffentlich beraten.</p><p>Impressum</p></footer></body></html>').includes('Grau dargestellte Punkte werden nichtöffentlich beraten.'));
});
