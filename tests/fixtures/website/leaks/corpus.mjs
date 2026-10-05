// Leak corpus of the reader "website" (NACHGEBILDET: invented places and persons, written the way German municipalities
// of all Länder publish invitations, notices, minutes and gazettes; PDF texts as unpdf returns them, line by line).
// Each text once let something through that must never come out: an item of the non-public part, an item with the
// wrong day of the meeting, an item of a foreign body (county, special-purpose association, Verbandsgemeinde/Amt, another
// member municipality) or a person as an item. tests/website-leaks.test.mjs reads every case at two levels: the text
// parser (parseSessionText on pdfLines/htmlToLines) and the whole reader (collectWebsite with a list page that links the
// document). A case says
// - forbid: words of titles that must never be an item or topic (case-insensitive substring),
// - allow: if given, every item that comes out starts with one of these titles (nothing else may come out),
// - collectAllow: the same for the reader only (e.g. [] for a foreign body, whose meeting the parser may still read),
// - date / committee: the day and body of every meeting that yields items.
// round: 'r0' = leaks found before the hardening rounds (also pinned in website-text/website tests), 'r1'…'r5' = rounds 1 to 5
// (rounds 4 and 5 also in tests/website-leaks.test.mjs: documents of one meeting read together, feeds, calendars, WordPress,
// JSON-LD events and the documents such copies link).

const page=main=>`<!doctype html><html><head><meta charset="utf-8"><title>Gemeinde Musterbach</title></head><body><header><nav><a href="/">Start</a><a href="/rathaus">Rathaus</a></nav></header><main>${main}</main><footer>Impressum</footer></body></html>`;
const ADORF_HEAD=`Gemeinde Adorf
Am Dienstag, 14.10.2026, 19.00 Uhr, findet im Rathaus eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung`;
const H1='<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026</h1>';
const HEAD_H='<h1>Einladung zur Sitzung des Gemeinderates</h1><p>Am Mittwoch, 14.10.2026, 19:30 Uhr, findet im Sitzungssaal des Rathauses eine öffentliche Sitzung des Gemeinderates statt.</p><h2>Tagesordnung</h2>';
const PUBLIC12=['Bauantrag Fl.Nr. 12','Haushalt 2027'];
const KITA=['Bauantrag Kita','Haushalt 2027'];
const CARPORT=['Genehmigung der Niederschrift','Bauantrag Carport'];
const SECRET=['Grundstück','Personal','Vergabe Schulbus','Vertragsangelegenheit','Lindenweg','Flurstück 412'];

export const cases=[
 // --- non-public part: footnotes and notes after the agenda ---------------------------------------------------------
 {id:'r1-footnote-star',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten*
4. Personalangelegenheiten*
*) nichtöffentlich`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-footnote-paren',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten (1)
4. Personalangelegenheiten (1)
(1) nicht öffentlich`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-footnote-superscript',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten¹
4. Personalangelegenheiten¹
¹ nichtöffentliche Beratung`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-footnote-superscript-flat',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten1
4. Personalangelegenheiten1
1 nichtöffentliche Beratung`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-footnote-note-hyphen',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten*
4. Personalangelegenheiten*
* Die Punkte 3 und 4 werden in nichtöf-
fentlicher Sitzung behandelt.`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-note-numbers',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten
4. Personalangelegenheiten
Die Tagesordnungspunkte 3 und 4 werden in nichtöffentlicher Sitzung beraten.`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-note-range',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten
4. Personalangelegenheiten
TOP 3 bis 4 nichtöffentlich`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-note-ziffer',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten
4. Personalangelegenheiten
Ab Ziffer 3 nichtöffentlich.`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-note-last-two',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten
4. Personalangelegenheiten
Die beiden letzten Punkte werden unter Ausschluss der Öffentlichkeit behandelt.`,forbid:[...SECRET,'Bauantrag','Haushalt']},
 {id:'r1-note-others',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten
4. Personalangelegenheiten
Die Punkte 1 und 2 sind öffentlich, alle anderen Punkte werden nichtöffentlich beraten.`,forbid:[...SECRET,'Bauantrag','Haushalt']},
 {id:'r1-note-information',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport<br>3. Grundstücksangelegenheit Flurstück 412<br>4. Personalangelegenheit</p><p>Information zu TOP 3 und 4: Die Beratung erfolgt in nichtöffentlicher Sitzung.</p>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-note-star-legend',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<p>TOP 1 Bauantrag Kita</p><p>TOP 2 Grundstücksverkauf Lindenweg*</p><p><small>* Die mit Stern gekennzeichneten Punkte werden in nichtöffentlicher Sitzung behandelt.</small></p>'),forbid:SECRET,allow:['Bauantrag Kita']},
 {id:'r1-head-hyphen-refs',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates
am Mittwoch, 14.10.2026, 19:30 Uhr, im Sitzungssaal
Die Sitzung ist öffentlich. Die Tagesordnungspunkte 3 und 4 werden in nichtöffent-
licher Sitzung beraten.
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Carport
3. Grundstücksangelegenheit Flurstück 412
4. Personalangelegenheit`,forbid:SECRET,allow:CARPORT},
 {id:'r1-head-hyphen',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`Gemeinde Adorf
Am Dienstag, 14.10.2026, 19.00 Uhr, findet im Rathaus eine öffentliche Sitzung des Gemeinderates statt; im Anschluss
daran findet eine nichtöffent-
liche Sitzung statt.
Tagesordnung
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten`,forbid:[...SECRET,'Bauantrag','Haushalt']},
 {id:'r1-head-anschliessend-oe-marks',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`Einladung zur Sitzung des Gemeinderates
am Mittwoch, 14.10.2026, 19:30 Uhr, im Sitzungssaal
Anschließend nichtöffentliche Sitzung
Ö 1 Genehmigung der Niederschrift
Ö 2 Bauantrag Carport
Ö 3 Anfragen
4 Grundstücksangelegenheit Flurstück 412`,forbid:SECRET,allow:[...CARPORT,'Anfragen']},
 {id:'r1-head-anschluss-partly-marked',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page('<h1>Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:30 Uhr</h1><p>Im Anschluss an die öffentliche Sitzung findet eine nichtöffentliche Sitzung statt.</p><p>TOP Ö 1 Genehmigung der Niederschrift<br>TOP Ö 2 Bauantrag Carport<br>TOP 3 Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET,allow:CARPORT},

 // --- non-public part: headings that are hyphenated, letter-spaced, broken by a page or written oddly -----------------
 {id:'r1-hyphen-heading-long-item',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Bebauungsplan "Am Mühlbach" der Gemeinde Adorf; Behandlung der im Rahmen
der frühzeitigen Beteiligung der Öffentlichkeit und der Behörden sowie
sonstiger Träger öffentlicher Belange eingegangenen Stellungnahmen und
Billigung des Entwurfs
Nichtöffent-
licher Teil
3. Grundstücksangelegenheiten
4. Personalangelegenheiten`,forbid:SECRET,allow:['Bauantrag Fl.Nr. 12','Bebauungsplan']},
 {id:'r1-hyphen-heading-nichtoef',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
Nichtöf-
fentlicher Teil
3. Grundstücksangelegenheiten
4. Personalangelegenheiten`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-hyphen-heading-after-prose',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
Anfragen aus der Bürgerschaft
Nicht öffent-
liche Sitzung
3. Grundstücksangelegenheiten`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-page-break-heading',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
Nicht-
Seite 1 von 2
Gemeinde Adorf – Einladung Gemeinderat 14.10.2026
öffentlicher Teil
3. Grundstücksangelegenheiten`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-page-break-heading-two-lines',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
Nichtöf-
- 1 -
Gemeinde Adorf
Einladung Gemeinderat 14.10.2026
fentlicher Teil
3. Grundstücksangelegenheiten`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-letter-spaced-hyphen',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`Gemeinde Adorf
Am Dienstag, 14.10.2026, 19.00 Uhr, findet im Rathaus eine öffentliche Sitzung des Gemeinderates statt.
T a g e s o r d n u n g
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
N i c h t ö f -
f e n t l i c h e r   T e i l
3. Grundstücksangelegenheiten`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-tagesordnung-nicht-hyphen',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
Tagesordnung nicht-
öffentlicher Teil
3. Grundstücksangelegenheiten`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-status-lines',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`Gemeinde Adorf
Sitzung des Gemeinderates am Dienstag, 14.10.2026, 19.00 Uhr
öffentlich
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
nicht
öffentlich
3. Grundstücksangelegenheiten`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-teil-a-b-legend',round:'r1',doc:'pdf',label:'Bekanntmachung Amtsausschuss 20.10.2026',source:{name:'Amt Odorf'},text:`Amt Odorf
Bekanntmachung
Am Montag, 20.10.2026, 18.00 Uhr findet die öffentliche Sitzung des Amtsausschusses statt.
Tagesordnung
Teil A
1. Einwohnerfragestunde
2. Haushaltssatzung 2027
Teil B
3. Vergabe Schulbus
4. Personalangelegenheiten
Teil A: öffentlich, Teil B: nicht öffentlich`,forbid:SECRET,allow:['Einwohnerfragestunde','Haushaltssatzung 2027']},
 {id:'r1-teil-b-without-word',round:'r1',doc:'html',label:'Tagesordnung Marktgemeinderat 14.10.2026',text:page('<h1>Sitzung des Marktgemeinderates am 14.10.2026</h1><h2>Teil A – öffentlich</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Teil B</h2><p>TOP 3 Grundstücksverkauf Lindenweg</p>'),forbid:SECRET,allow:KITA},
 {id:'r1-roman-ii',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
I. Öffentliche Sitzung
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
II.
3. Grundstücksangelegenheiten`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-typo-nichtoefentlich',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page('<h1>Sitzung des Gemeinderates am 14.10.2026</h1><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nichtöfentlicher Teil</h2><p>TOP 3 Grundstücksverkauf Lindenweg</p>'),forbid:SECRET,allow:KITA},
 {id:'r1-typo-nicht-oeffentl',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page('<h1>Sitzung des Gemeinderates am 14.10.2026</h1><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nicht öffentl. Teil</h2><p>TOP 3 Grundstücksverkauf Lindenweg</p>'),forbid:SECRET,allow:KITA},
 {id:'r1-interne-beratung',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page('<h1>Sitzung des Gemeinderates am 14.10.2026</h1><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Interne Beratung</h2><p>TOP 3 Grundstücksverkauf Lindenweg</p>'),forbid:SECRET,allow:KITA},
 {id:'r1-en-dash',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport</p><h3>Nicht – öffentlicher Teil</h3><p>3. Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-zero-width-entity',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport</p><h3>Nicht&ZeroWidthSpace;öffentlicher Teil</h3><p>3. Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-n-oe-teil',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport</p><h3>N ö Teil</h3><p>3. Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-shy-teil-b',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H.replace('eine öffentliche Sitzung','eine Sitzung')+'<h3>A. Öffentlicher Teil</h3><p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport</p><h3>B. Nicht&shy;öffent&shy;licher Teil</h3><p>3. Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-image-alt-heading',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport</p><p><img src="/noe.png" alt="Nichtöffentlicher Teil"></p><p>3. Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-ausschluss-heading',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport</p><p>Unter Ausschluß der Öffentlichkeit:</p><p>3. Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET,allow:CARPORT},

 // --- non-public part: sentences that end it ------------------------------------------------------------------------
 {id:'r1-schluss-oeffentliche-sitzung',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p><p>Schluss der öffentlichen Sitzung</p><p>3. Grundstücksverkauf Lindenweg</p>'),forbid:SECRET,allow:KITA},
 {id:'r1-ende-oeffentlicher-teil-minutes',round:'r1',doc:'html',now:'2026-10-20',label:'Niederschrift Gemeinderat 14.10.2026',text:page('<h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 14.10.2026</h1><p>1. Bauantrag Kita</p><p>Der Gemeinderat erteilt das Einvernehmen. Abstimmung: 12:0</p><p>2. Haushalt 2027</p><p>Der Gemeinderat beschließt den Haushalt. Abstimmung: 11:1</p><p>Ende des öffentlichen Teils: 20:15 Uhr</p><p>3. Grundstücksverkauf Lindenweg</p><p>Der Gemeinderat stimmt dem Verkauf zu. Abstimmung: 12:0</p>'),forbid:SECRET,allow:KITA},
 {id:'r1-oeffentlichkeit-ausgeschlossen',round:'r1',doc:'html',now:'2026-10-20',label:'Niederschrift Gemeinderat 14.10.2026',text:page('<h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 14.10.2026</h1><p>1. Bauantrag Kita</p><p>Der Gemeinderat erteilt das Einvernehmen. Abstimmung: 12:0</p><p>2. Haushalt 2027</p><p>Der Gemeinderat beschließt den Haushalt. Abstimmung: 11:1</p><p>Für die folgenden Punkte wird die Öffentlichkeit ausgeschlossen.</p><p>3. Grundstücksverkauf Lindenweg</p><p>Der Gemeinderat stimmt dem Verkauf zu. Abstimmung: 12:0</p>'),forbid:SECRET,allow:KITA},
 {id:'r1-ende-oeffentlicher-teil',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport<br>3. Anfragen</p><p>Ende des öffentlichen Teils</p><p>4. Grundstücksangelegenheit Flurstück 412<br>5. Personalangelegenheit</p>'),forbid:SECRET,allow:[...CARPORT,'Anfragen']},
 {id:'r1-oeffentlicher-teil-endet',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport</p><p>Der öffentliche Teil endet um 20:45 Uhr.</p><p>3. Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-anschluss-hyphen',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`Gemeinde Musterbach
Einladung zur öffentlichen Sitzung des Gemeinderates
am Mittwoch, 14.10.2026, 19:30 Uhr, im Sitzungssaal
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Carport
Im Anschluss findet eine nichtöf-
fentliche Sitzung statt mit folgenden Punkten:
3. Grundstücksangelegenheit Flurstück 412`,forbid:SECRET,allow:CARPORT},
 {id:'r1-bericht-in-np-sitzung',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport</p><p>Bericht der Verwaltung in nichtöffentlicher Sitzung:</p><p>3. Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-mitteilungen-in-np-sitzung-item',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport<br>3. Mitteilungen in nichtöffentlicher Sitzung: Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-item-ausschluss',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page('<h1>Bekanntmachung</h1><p>Der Gemeinderat tritt am Mittwoch, 14.10.2026, 19:30 Uhr, zu einer öffentlichen Sitzung zusammen.</p><p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport<br>3. Grundstücksangelegenheit Flurstück 412 – unter Ausschluß der Öffentlichkeit</p>'),forbid:SECRET,allow:CARPORT},

 // --- non-public part: marks of an item (columns, brackets, badges, icons, status lines) -----------------------------
 {id:'r1-mark-line-below',round:'r1',doc:'pdf',label:'Einladung Ortsbeirat Kerndorf 15.10.2026',source:{name:'Stadt Hdorf'},text:`Stadt Hdorf
Einladung zur Sitzung des Ortsbeirates Kerndorf
am Mittwoch, 15.10.2026, 19.30 Uhr, im Bürgerhaus. Die Sitzung ist öffentlich.
Tagesordnung
TOP 1 Mitteilungen des Ortsvorstehers
TOP 2 Haushalt 2027 – Anmeldungen des Ortsbeirates
TOP 3 Grundstücksangelegenheit Gemarkung Kerndorf, Flur 2
(nichtöffentlich)
TOP 4 Verschiedenes`,forbid:[...SECRET,'Verschiedenes'],allow:['Mitteilungen des Ortsvorstehers','Haushalt 2027']},
 {id:'r1-mark-line-below-wrapped',round:'r1',doc:'pdf',label:'Bekanntmachung Ortsgemeinderat 16.10.2026',source:{name:'Ortsgemeinde Ldorf'},text:`Ortsgemeinde Ldorf
Bekanntmachung
Am Donnerstag, 16.10.2026, 19.00 Uhr findet im Gemeindehaus eine öffentliche Sitzung des Ortsgemeinderates statt.
Tagesordnung:
1. Einwohnerfragestunde
2. Ausbau der Gemeindestraße "Im Wingert"; Vergabe der
Bauleistungen
– nicht öffentlich –
3. Mitteilungen`,forbid:['Ausbau der Gemeindestraße','Mitteilungen'],allow:['Einwohnerfragestunde']},
 {id:'r1-column-art',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`Gemeinde Adorf
Einladung zur Sitzung des Gemeinderates am Dienstag, 14.10.2026, 19.00 Uhr. Die Sitzung ist öffentlich.
Nr. Gegenstand Art
1 Bauantrag Fl.Nr. 12 Ö
2 Haushalt 2027 Ö
3 Grundstücksangelegenheiten N
4 Personalangelegenheiten N`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-column-lowercase',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`Gemeinde Adorf
Öffentliche Bekanntmachung
Am Dienstag, 14.10.2026, 19.00 Uhr, findet eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung
1. Bauantrag Fl.Nr. 12 ö
2. Haushalt 2027 ö
3. Grundstücksangelegenheiten n
4. Vergabe Bauleistungen n`,forbid:[...SECRET,'Vergabe Bauleistungen'],allow:PUBLIC12},
 {id:'r1-column-paren-n',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten (N)
4. Personalangelegenheiten (N)`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-column-top-gegenstand',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`Gemeinde Adorf
Einladung zur öffentlichen Sitzung des Gemeinderates am Dienstag, 14.10.2026, 19.00 Uhr
TOP Gegenstand
1 Bauantrag Fl.Nr. 12 Ö
2 Haushalt 2027 Ö
3 Grundstücksangelegenheiten N
4 Personalangelegenheiten N`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-dash-noe',round:'r1',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
3. Grundstücksangelegenheiten - n.ö.
4. Personalangelegenheiten - nö`,forbid:SECRET,allow:PUBLIC12},
 {id:'r1-n-line-before-item',round:'r1',doc:'pdf',label:'Bekanntmachung Stadtrat 16.10.2026',source:{name:'Stadt Mdorf'},text:`Stadt Mdorf
Öffentliche Bekanntmachung
Die 23. Sitzung des Stadtrates findet am Donnerstag, 16.10.2026, 18.00 Uhr im Ratssaal statt.
Tagesordnung
Ö 1 Feststellung der Beschlussfähigkeit
Ö 2 Bebauungsplan Nr. 12
N
3 Vergabe Bauleistungen
N
4 Grundstücksangelegenheiten`,forbid:[...SECRET,'Vergabe Bauleistungen'],allow:['Feststellung der Beschlussfähigkeit','Bebauungsplan Nr. 12']},
 {id:'r1-html-table-oe-n',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<table><tr><th>TOP</th><th>Betreff</th><th>Ö/N</th></tr><tr><td>1</td><td>Bauantrag Kita</td><td>Ö</td></tr><tr><td>2</td><td>Grundstücksverkauf Lindenweg</td><td>N</td></tr></table>'),forbid:SECRET,allow:['Bauantrag Kita']},
 {id:'r1-html-table-ja-nein',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<table><tr><th>TOP</th><th>Gegenstand</th><th>öffentlich</th></tr><tr><td>1</td><td>Genehmigung der Niederschrift</td><td>ja</td></tr><tr><td>2</td><td>Bauantrag Carport</td><td>ja</td></tr><tr><td>3</td><td>Grundstücksangelegenheit Flurstück 412</td><td>nein</td></tr></table>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-html-table-n-end',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<table><tr><th>Nr.</th><th>Gegenstand</th><th>Ö/N</th></tr><tr><td>1</td><td>Genehmigung der Niederschrift</td><td>Ö</td></tr><tr><td>2</td><td>Bauantrag Carport</td><td>Ö</td></tr><tr><td>3</td><td>Grundstücksangelegenheit Flurstück 412</td><td>N</td></tr></table>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-paren-n-end',round:'r1',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page(HEAD_H+'<p>1. Genehmigung der Niederschrift (Ö)<br>2. Bauantrag Carport (Ö)<br>3. Grundstücksangelegenheit Flurstück 412 (N)</p>'),forbid:SECRET,allow:CARPORT},
 {id:'r1-badges',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<ul><li><span>TOP 1</span><span>Bauantrag Kita</span><span class="badge">Ö</span></li><li><span>TOP 2</span><span>Grundstücksverkauf Lindenweg</span><span class="badge">NÖ</span></li><li><span>TOP 3</span><span>Personalangelegenheit</span><span class="badge">nö</span></li></ul>'),forbid:SECRET,allow:['Bauantrag Kita']},
 {id:'r1-status-after-item',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<div><h3>TOP 1 Bauantrag Kita</h3><p>öffentlich</p></div><div><h3>TOP 2 Grundstücksverkauf Lindenweg</h3><p>nichtöffentlich</p></div>'),forbid:SECRET,allow:['Bauantrag Kita']},
 {id:'r1-status-dd',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<dl><dt>TOP 1</dt><dd>Bauantrag Kita</dd><dd>Status: öffentlich</dd><dt>TOP 2</dt><dd>Grundstücksverkauf Lindenweg</dd><dd>Status: nicht öffentlich</dd></dl>'),forbid:SECRET,allow:['Bauantrag Kita']},
 {id:'r1-lock-icons',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<table><tr><td>1</td><td>Bauantrag Kita</td><td></td></tr><tr><td>2</td><td>Grundstücksverkauf Lindenweg</td><td><i class="fa fa-lock" title="nichtöffentlich"></i></td></tr><tr><td>3</td><td>Personalangelegenheit</td><td><img src="schloss.png" alt="nicht öffentlich"></td></tr></table>'),forbid:SECRET,allow:['Bauantrag Kita']},
 {id:'r1-svg-title',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<ul><li>TOP 1 Bauantrag Kita</li><li>TOP 2 Grundstücksverkauf Lindenweg <svg class="icon"><title>nichtöffentlich</title><path d="M0 0"/></svg></li></ul>'),forbid:SECRET,allow:['Bauantrag Kita']},
 {id:'r1-abbr-title',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<ul><li>TOP 1 Bauantrag Kita</li><li>TOP 2 Grundstücksverkauf Lindenweg <span aria-label="nicht öffentlich" class="icon-lock"></span></li></ul>'),forbid:SECRET,allow:['Bauantrag Kita']},

 // --- non-public part: markup that hid it (buttons, tabs, navigation, articles, encodings, entities) -----------------
 {id:'r1-accordion-buttons',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page('<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026</h1><p>Beginn: 19:00 Uhr</p><div class="accordion"><h2><button class="accordion-button">Öffentlicher Teil</button></h2><div class="accordion-body"><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p></div><h2><button class="accordion-button">Nichtöffentlicher Teil</button></h2><div class="accordion-body"><p>TOP 3 Grundstücksangelegenheit Flurstück 412</p><p>TOP 4 Personalangelegenheit</p></div></div>'),forbid:SECRET,allow:KITA},
 {id:'r1-tablist-buttons',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page('<h1>Sitzung des Gemeinderates am 14.10.2026</h1><div role="tablist"><button role="tab" aria-controls="oe">Öffentliche Sitzung</button><button role="tab" aria-controls="noe">Nichtöffentliche Sitzung</button></div><div role="tabpanel" id="oe"><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p></div><div role="tabpanel" id="noe"><p>TOP 3 Grundstücksverkauf Lindenweg</p><p>TOP 4 Personalangelegenheit</p></div>'),forbid:SECRET,allow:KITA},
 {id:'r1-tabs-in-nav',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page('<h1>Sitzung des Gemeinderates am 14.10.2026</h1><nav class="tabs"><a href="#oe">Öffentliche Sitzung</a><a href="#noe">Nichtöffentliche Sitzung</a></nav><div id="oe"><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p></div><div id="noe"><p>TOP 3 Grundstücksverkauf Lindenweg</p><p>TOP 4 Personalangelegenheit</p></div>'),forbid:SECRET,allow:KITA},
 {id:'r1-articles-without-main',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:'<html><body><div id="content"><h1>Sitzung des Gemeinderates am 14.10.2026</h1><h2>Öffentlicher Teil</h2><article class="top"><h3>TOP 1 Bauantrag Kita</h3></article><article class="top"><h3>TOP 2 Haushalt 2027</h3></article><h2>Nichtöffentlicher Teil</h2><article class="top"><h3>TOP 3 Grundstücksverkauf Lindenweg</h3></article></div></body></html>',forbid:SECRET,allow:KITA},
 {id:'r1-double-entity',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<p>TOP 1 Bauantrag Kita</p><h2>Nicht&amp;ouml;ffentlicher Teil</h2><p>TOP 2 Grundstücksverkauf Lindenweg</p>'),forbid:SECRET,allow:['Bauantrag Kita']},
 {id:'r1-triple-entity',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<p>TOP 1 Bauantrag Kita</p><h2>Nicht&amp;amp;#246;ffentlicher Teil</h2><p>TOP 2 Grundstücksverkauf Lindenweg</p>'),forbid:SECRET,allow:['Bauantrag Kita']},
 {id:'r1-numeric-entity',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page(H1+'<p>TOP 1 Bauantrag Kita</p><h2>Nicht&#246;ffentlicher Teil</h2><p>TOP 2 Grundstücksverkauf Lindenweg</p><h2>N&Ouml;</h2><p>TOP 3 X Y</p>'),forbid:[...SECRET,'X Y'],allow:['Bauantrag Kita']},
 {id:'r1-mojibake-text',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page('<h1>Sitzung des Gemeinderates am 14.10.2026</h1><h2>Ã–ffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>NichtÃ¶ffentlicher Teil</h2><p>TOP 3 GrundstÃ¼cksverkauf Lindenweg</p>'),forbid:['Grundst','Lindenweg']},
 {id:'r1-replacement-char',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page('<h1>Sitzung des Gemeinderates am 14.10.2026</h1><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nicht�ffentlicher Teil</h2><p>TOP 3 Grundst�cksverkauf Lindenweg</p>'),forbid:['Grundst','Lindenweg']},
 {id:'r1-question-mark',round:'r1',doc:'html',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:page('<h1>Sitzung des Gemeinderates am 14.10.2026</h1><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nicht?ffentlicher Teil</h2><p>TOP 3 Grundst?cksverkauf Lindenweg</p>'),forbid:['Grundst','Lindenweg']},
 // Bytes in one encoding, declared in another (see bytes in the test).
 {id:'r1-charset-utf8-as-latin1',round:'r1',doc:'html',encoding:'utf8-declared-latin1',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:'<!doctype html><html><head><meta charset="iso-8859-1"></head><body><main><h1>Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nichtöffentlicher Teil</h2><p>TOP 3 Grundstücksverkauf Lindenweg</p></main></body></html>',forbid:['Grundst','Lindenweg'],allow:KITA},
 {id:'r1-charset-latin1-as-utf8',round:'r1',doc:'html',encoding:'latin1-declared-utf8',label:'Tagesordnung öffentliche Sitzung Gemeinderat 14.10.2026',text:'<!doctype html><html><head><meta charset="utf-8"></head><body><main><h1>Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nichtöffentlicher Teil</h2><p>TOP 3 Grundstücksverkauf Lindenweg</p></main></body></html>',forbid:['Grundst','Lindenweg'],allow:KITA},

 // --- non-public part: probes of earlier rounds that held (kept so that they keep holding) ---------------------------
 {id:'r0-numbering-restarts',round:'r0',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
Öffentlicher Teil
Ö 1 Bauantrag Fl.Nr. 12
Ö 2 Haushalt 2027
N 1 Grundstücksangelegenheiten
N 2 Personalangelegenheiten`,forbid:SECRET,allow:PUBLIC12},
 {id:'r0-subitems',round:'r0',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`${ADORF_HEAD}
Öffentlicher Teil
1. Bauantrag Fl.Nr. 12
2. Bauangelegenheiten
2.1 Bauantrag Hauptstraße 3
2.2 Bauvoranfrage Flur 4
Nichtöffentlicher Teil
2.3 Vergabe Ingenieurleistungen
3. Grundstücke`,forbid:[...SECRET,'Vergabe Ingenieurleistungen','Grundstücke']},
 {id:'r0-bw-two-blocks',round:'r0',doc:'pdf',label:'Einladung Gemeinderat 13.10.2026',source:{name:'Gemeinde Cdorf'},text:`Gemeinde Cdorf
Öffentliche Sitzung des Gemeinderates am Montag, 13.10.2026, 19.00 Uhr
1. Bürgerfragestunde
2. Bebauungsplan "Hinter den Gärten" - Satzungsbeschluss
3. Bekanntgaben
Nichtöffentliche Sitzung des Gemeinderates am Montag, 13.10.2026, im Anschluss
1. Grundstücksangelegenheiten
2. Personalangelegenheiten`,forbid:SECRET},
 {id:'r0-bw-two-blocks-reversed',round:'r0',doc:'pdf',label:'Einladung Gemeinderat 13.10.2026',source:{name:'Gemeinde Cdorf'},text:`Gemeinde Cdorf
Nichtöffentliche Sitzung des Gemeinderates am Montag, 13.10.2026, 18.00 Uhr
1. Grundstücksangelegenheiten
2. Personalangelegenheiten
Öffentliche Sitzung des Gemeinderates am Montag, 13.10.2026, 19.00 Uhr
1. Bürgerfragestunde
2. Bebauungsplan "Hinter den Gärten"`,forbid:SECRET},
 {id:'r0-bw-nicht-line',round:'r0',doc:'pdf',label:'Einladung Gemeinderat 13.10.2026',source:{name:'Gemeinde Cdorf'},text:`Gemeinde Cdorf
Öffentliche Sitzung des Gemeinderates am Montag, 13.10.2026, 19.00 Uhr
1. Bürgerfragestunde
2. Bebauungsplan "Hinter den Gärten" - Satzungsbeschluss
Nicht
öffentliche Sitzung des Gemeinderates am Montag, 13.10.2026, im Anschluss
1. Grundstücksangelegenheiten`,forbid:SECRET},
 {id:'r0-nonpublic-ortschaftsrat-then-gr',round:'r0',doc:'pdf',label:'Bekanntmachung Sitzungen',source:{name:'Gemeinde Cdorf'},text:`Gemeinde Cdorf
Nichtöffentliche Sitzung des Ortschaftsrates Unterdorf am Montag, 12.10.2026, 19.00 Uhr
1. Grundstücksangelegenheiten
2. Bauvoranfrage Flst. 44
Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19.00 Uhr
1. Bürgerfragestunde
2. Haushalt`,forbid:[...SECRET,'Bauvoranfrage Flst. 44']},
 {id:'r0-noe-dot-prefix',round:'r0',doc:'pdf',label:'Bekanntmachung Stadtrat 15.10.2026',source:{name:'Stadt Ndorf'},text:`Stadt Ndorf
Der Stadtrat tritt am Mittwoch, 15.10.2026, 18.30 Uhr zu einer öffentlichen Sitzung zusammen.
Tagesordnung
Ö 1 Bürgerfragestunde
Ö 2 Haushalt 2027
nö. 3 Grundstücksverkauf
nö. 4 Personalangelegenheiten`,forbid:SECRET,allow:['Bürgerfragestunde','Haushalt 2027']},
 {id:'r0-html-pdf-same-meeting',round:'r0',doc:'html',label:'Einladung Gemeinderat 14.10.2026',text:page('<h1>Einladung zur Sitzung des Gemeinderates am 14.10.2026</h1><p>Die Sitzung ist öffentlich.</p><p>1. Genehmigung der Niederschrift<br>2. Bauantrag Carport</p><p>Nichtöffentlicher Teil</p><p>3. Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET,allow:CARPORT},
 {id:'r0-trailing-n-pdf',round:'r0',doc:'pdf',label:'Einladung Gemeinderat 14.10.2026',text:`Einladung zur öffentlichen Sitzung des Gemeinderates
am Mittwoch, 14.10.2026, 19:30 Uhr
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Carport
3. Grundstücksangelegenheit Flurstück 412 N`,forbid:SECRET,allow:CARPORT},
 {id:'r0-wp-noeff',round:'r0',doc:'html',label:'Einladung zur Sitzung des Gemeinderates am 14.10.2026',text:page('<p>Am Mittwoch, 14.10.2026, 19:30 Uhr, findet eine öffentliche Sitzung des Gemeinderates statt.</p><p><strong>Tagesordnung</strong></p><ol><li>Bauantrag Neubau Carport</li><li>Vergabe Straßenbeleuchtung</li><li>Grundstücksangelegenheit Flurstück 412 (nichtöff.)</li></ol>'),forbid:SECRET},
 {id:'r0-ics-anschl',round:'r0',doc:'html',label:'Öffentliche Sitzung des Gemeinderates 14.10.2026',text:page('<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>Tagesordnung:</p><p>1. Bauantrag Neubau Carport</p><p>2. Vergabe Straßenbeleuchtung</p><p>anschl. nichtöffentl. Sitzung:</p><p>3. Grundstücksangelegenheit Flurstück 412</p>'),forbid:SECRET},
 {id:'r0-atom-ab-uhrzeit',round:'r0',doc:'html',label:'Einladung zur öffentlichen Sitzung des Bauausschusses am 21.10.2026',text:page('<p>Der Bauausschuss der Gemeinde Musterbach tritt am Mittwoch, 21.10.2026, 18:00 Uhr, im Sitzungssaal des Rathauses zu einer Sitzung zusammen.</p><p>Öffentlich ab 18:00 Uhr:<br>1. Bauantrag Neubau Wohnhaus, Fl.Nr. 33<br>2. Bauvoranfrage Garage</p><p>Ab 19:30 Uhr (nicht öffentlich):<br>3. Vertragsangelegenheit Lindenweg</p>'),forbid:SECRET},
 {id:'r0-atom-punkte-3-5',round:'r0',doc:'html',label:'Einladung zur öffentlichen Sitzung des Bauausschusses am 21.10.2026',text:page('<p>Der Bauausschuss tritt am Mittwoch, 21.10.2026, 18:00 Uhr, zu einer Sitzung zusammen.</p><ol><li>Bauantrag Neubau Wohnhaus, Fl.Nr. 33</li><li>Bauvoranfrage Garage</li><li>Vertragsangelegenheit Lindenweg</li></ol><p>Die Punkte 3 bis 5 werden nichtöffentlich behandelt.</p>'),forbid:SECRET},

 // --- persons as items ----------------------------------------------------------------------------------------------
 {id:'r1-members-list-numbered',round:'r1',doc:'pdf',now:'2026-10-20',label:'Niederschrift Gemeinderat 14.10.2026',text:`Gemeinde Adorf
Niederschrift über die öffentliche Sitzung des Gemeinderates
Sitzungstag: Dienstag, 14.10.2026
Sitzungsort: Sitzungssaal Rathaus
Vorsitzender: Erster Bürgermeister Max Muster
Schriftführer: Peter Probe
Gemeinderatsmitglieder:
1. Huber Josef
2. Maier Anna
3. Schmid Georg
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Fl.Nr. 12
Der Gemeinderat erteilt das Einvernehmen. Abstimmung: 12:0`,forbid:['Huber','Maier','Schmid'],allow:['Genehmigung der Niederschrift','Bauantrag Fl.Nr. 12'],date:'2026-10-14'},
 {id:'r1-members-erschienen',round:'r1',doc:'pdf',now:'2026-10-20',label:'Niederschrift Gemeinderat 14.10.2026',text:`Gemeinde Adorf
Niederschrift über die öffentliche Sitzung des Gemeinderates am 14.10.2026
Erschienen sind:
1. Bürgermeister Max Muster
2. Huber, Josef (CSU)
3. Maier, Anna (FW)
Tagesordnung
TOP 1 Genehmigung der Niederschrift
TOP 2 Bauantrag Fl.Nr. 12`,forbid:['Huber','Maier','Muster'],allow:['Genehmigung der Niederschrift','Bauantrag Fl.Nr. 12']},
 {id:'r1-es-waren-anwesend',round:'r1',doc:'html',now:'2026-10-20',label:'Niederschrift Gemeinderat 14.10.2026',text:page('<h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 14.10.2026</h1><p>Es waren anwesend:</p><p>1. Max Mustermann (CSU)</p><p>2. Erika Beispiel (SPD)</p><p>Tagesordnung:</p><p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p>'),forbid:['Mustermann','Beispiel'],allow:KITA},
 {id:'r1-anwesende-mitglieder',round:'r1',doc:'html',now:'2026-10-20',label:'Niederschrift Gemeinderat 14.10.2026',text:page('<h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 14.10.2026</h1><p>Anwesende Mitglieder des Gemeinderates</p><p>1. Max Mustermann (CSU)</p><p>2. Erika Beispiel (SPD)</p><p>Tagesordnung:</p><p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p>'),forbid:['Mustermann','Beispiel'],allow:KITA},
 {id:'r1-role-colon',round:'r1',doc:'html',now:'2026-10-20',label:'Niederschrift Gemeinderat 14.10.2026',text:page('<h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 14.10.2026</h1><p>1. Vorsitzender: Erster Bürgermeister Max Muster</p><p>2. Gemeinderäte: Hans Probe, Erika Beispiel, Karl Test</p><p>3. Verwaltung: Kämmerer Fritz Zahl</p><h2>Tagesordnung</h2><p>1. Bauantrag Kita</p>'),forbid:['Muster','Probe','Zahl','Gemeinderäte','Verwaltung'],allow:['Bauantrag Kita']},
 {id:'r1-geehrt-wurden',round:'r1',doc:'html',now:'2026-10-20',label:'Niederschrift Gemeinderat 14.10.2026',text:page('<h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 14.10.2026</h1><h2>Öffentlicher Teil</h2><p>1. Ehrungen</p><p>Geehrt wurden:</p><p>1. Hans Probe</p><p>2. Erika Beispiel</p><p>2. Bauantrag Kita</p><p>Der Gemeinderat erteilt das Einvernehmen. Abstimmung: 12:0</p>'),forbid:['Probe','Beispiel'],allow:['Ehrungen','Bauantrag Kita']},
 {id:'r1-members-comma',round:'r1',doc:'pdf',label:'Niederschrift Gemeinderat 16.09.2026',text:`Niederschrift über die öffentliche Sitzung des Gemeinderates Musterbach
am Mittwoch, 16.09.2026, im Sitzungssaal des Rathauses
Vorsitzender: Erster Bürgermeister Huber
Gemeinderatsmitglieder:
1. Maier, Hans
2. Schulz, Petra
3. Weber, Klaus (entschuldigt)
Schriftführer: Müller
Tagesordnung
1. Genehmigung der Niederschrift
Beschluss: Die Niederschrift wird genehmigt. Abstimmung: 12:0
2. Bauantrag Carport
Beschluss: Das Einvernehmen wird erteilt. Abstimmung: 11:1`,forbid:['Maier','Schulz','Weber'],allow:CARPORT},
 {id:'r1-members-table-party',round:'r1',doc:'pdf',label:'Niederschrift Gemeinderat 16.09.2026',text:`Niederschrift über die öffentliche Sitzung des Gemeinderates Musterbach
am Mittwoch, 16.09.2026, im Sitzungssaal des Rathauses
Anwesend:
Vorsitz
Huber, Anna Erste Bürgermeisterin
Mitglieder
1 Maier Hans CSU
2 Schulz Petra SPD
3 Weber Klaus Freie Wähler
Verwaltung
4 Müller Eva Kämmerin
Tagesordnung
1. Genehmigung der Niederschrift
Beschluss: Die Niederschrift wird genehmigt. Abstimmung: 12:0`,forbid:['Maier','Schulz','Weber','Müller'],allow:['Genehmigung der Niederschrift']},
 {id:'r1-election-result',round:'r1',doc:'pdf',label:'Niederschrift Gemeinderat 16.09.2026',text:`Niederschrift über die öffentliche Sitzung des Gemeinderates Musterbach
am Mittwoch, 16.09.2026
Öffentlicher Teil
1. Wahl des Zweiten Bürgermeisters
Gewählt wurde:
1. Gemeinderat Hans Maier mit 9 Stimmen
2. Gemeinderätin Petra Schulz mit 4 Stimmen
2. Bauantrag Carport
Beschluss: Das Einvernehmen wird erteilt. Abstimmung: 11:1`,forbid:['Maier','Schulz'],allow:['Wahl des Zweiten Bürgermeisters','Bauantrag Carport']},

 // --- day of the meeting --------------------------------------------------------------------------------------------
 {id:'r1-date-letterhead',round:'r1',doc:'pdf',label:'Einladung Gemeinderat',text:`Gemeinde Adorf · Hauptstraße 1 · 12345 Adorf
Datum: 07.10.2026
Einladung
Gremium: Gemeinderat
Sitzungstermin: 14.10.2026
Sitzungsbeginn: 19:00 Uhr
Öffentlicher Teil
1. Genehmigung der Niederschrift
2. Bauantrag Fl.Nr. 12`,date:'2026-10-14'},
 {id:'r1-date-letterhead-weekday',round:'r1',doc:'pdf',label:'Einladung Gemeindevertretung Gdorf',source:{name:'Gemeinde Gdorf'},text:`Amt Fdorf
Der Amtsdirektor
Datum: Dienstag, 07.10.2026
Einladung zur Sitzung
der Gemeindevertretung Gdorf
Sitzungsdatum: 14.10.2026
Öffentlicher Teil
1. Einwohnerfragestunde
2. Bauleitplanung`,date:'2026-10-14'},
 {id:'r1-date-cancelled-meeting',round:'r1',doc:'pdf',label:'Einladung Gemeinderat',text:`Gemeinde Adorf
Einladung
Sehr geehrte Damen und Herren des Gemeinderates,
hiermit lade ich Sie zur Sitzung ein.
Datum: 14.10.2026
Beginn: 19:00 Uhr
Ort: Rathaus, Sitzungssaal
Die für Montag, 13.10.2026, 18 Uhr angesetzte Sitzung des Bauausschusses entfällt.
Öffentlicher Teil
1. Genehmigung der Niederschrift
2. Bauantrag Fl.Nr. 12`,date:'2026-10-14',committee:'Gemeinderat'},
 {id:'r1-date-replacement',round:'r1',doc:'pdf',label:'Bekanntmachung Bauausschuss',text:`Gemeinde Adorf
Öffentliche Bekanntmachung
Sitzung des Bauausschusses
am Montag, 20.10.2026, 18.00 Uhr
(Ersatz für die ausgefallene Sitzung vom Montag, 13.10.2026, 18.00 Uhr)
Öffentlicher Teil
1. Bauantrag Fl.Nr. 12`,date:'2026-10-20'},
 {id:'r1-date-amtsblatt-no-year',round:'r1',doc:'pdf',label:'Amtsblatt Nr. 40/2026 mit Tagesordnung Gemeinderat',source:{name:'Gemeinde Musterbach'},text:`Mitteilungsblatt der Gemeinde Musterbach
Freitag, 2. Oktober 2026 Nr. 40
Amtliche Bekanntmachungen
Einladung zur Sitzung des Gemeinderates
Die nächste öffentliche Sitzung des Gemeinderates findet am Mittwoch, 14. Oktober, um 19.30 Uhr im Sitzungssaal des Rathauses statt.
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Carport
3. Anfragen`,date:'2026-10-14'},
 {id:'r1-date-gemeindeblatt-no-year',round:'r1',doc:'pdf',label:'Amtsblatt Nr. 41/2026 mit Tagesordnung Gemeinderat',source:{name:'Gemeinde Musterbach'},text:`Gemeindeblatt Musterbach · Ausgabe 41 · 9. Oktober 2026
Öffentliche Sitzung des Gemeinderates
am Mittwoch, 14.10., 19:30 Uhr, im Rathaus
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Carport`,date:'2026-10-14'},
 {id:'r1-date-news-article',round:'r1',doc:'html',now:'2026-10-25',label:'Aus dem Gemeinderat',path:'aktuelles/aus-dem-gemeinderat.html',text:page('<article><p class="date">20.10.2026</p><h1>Aus dem Gemeinderat</h1><p>In seiner öffentlichen Sitzung am 14. Oktober hat sich der Gemeinderat mit folgenden Themen befasst:</p><p>TOP 1 Bauantrag Kita</p><p>Der Gemeinderat erteilte das Einvernehmen einstimmig.</p></article>'),date:'2026-10-14'},
 {id:'r1-date-news-weekday-only',round:'r1',doc:'html',now:'2026-10-25',label:'Aus dem Gemeinderat',path:'aktuelles/aus-dem-gemeinderat-2.html',text:page('<article><p>20.10.2026 | Rathaus</p><h1>Aus dem Gemeinderat</h1><p>Die öffentliche Sitzung des Gemeinderates fand am Mittwoch statt.</p><p>TOP 1 Bauantrag Kita</p><p>Der Gemeinderat erteilte das Einvernehmen einstimmig.</p></article>'),date:'2026-10-14'},
 {id:'r1-date-calendar-page',round:'r1',doc:'html',label:'Sitzungstermine Gemeinderat und Ausschüsse',path:'rathaus/sitzungstermine.html',text:page('<h1>Termine</h1><h3>Mittwoch, 14.10.2026</h3><p>19:00 Uhr Gemeinderat, Sitzungssaal Rathaus</p><p>Öffentliche Tagesordnung</p><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h3>Dienstag, 20.10.2026</h3><p>18:00 Uhr Bauausschuss, Rathaus</p><p>Öffentliche Tagesordnung</p><p>TOP 1 Bauvoranfrage Hauptstraße 5</p><p>TOP 2 Neubau Feuerwehrhaus</p><p>TOP 3 Vergabe Kanalarbeiten Lindenweg</p>'),
  check:'calendar'},

 // --- foreign bodies on the municipality's site ---------------------------------------------------------------------
 {id:'r1-vg-other-member',round:'r1',doc:'pdf',label:'Mitteilungsblatt Nr. 20/2026 – Sitzung',source:{name:'Gemeinde Adorf'},text:`Mitteilungsblatt der Verwaltungsgemeinschaft Oberland
Nr. 20/2026
Gemeinde Bdorf
Öffentliche Sitzung des Gemeinderates am Donnerstag, 16.10.2026, 20.00 Uhr, im Rathaus Bdorf
Tagesordnung
1. Feuerwehrbedarfsplan Bdorf
2. Kindergartengebühren`,collectAllow:[]},
 {id:'r1-vg-other-member-2',round:'r1',doc:'pdf',label:'Amtsblatt Nr. 40/2026 mit Tagesordnung Gemeinderat',source:{name:'Gemeinde Musterbach'},text:`Mitteilungsblatt der Verwaltungsgemeinschaft Musterland Nr. 40 vom 02.10.2026
Gemeinde Nachbarhausen
Öffentliche Bekanntmachung
Am Mittwoch, 14.10.2026, 19:30 Uhr, findet im Rathaus eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung
Öffentlicher Teil
1. Bauantrag Neubau Lagerhalle Nachbarhausen
2. Sanierung Dorfgemeinschaftshaus Nachbarhausen
Nichtöffentlicher Teil
3. Personalangelegenheit`,forbid:['Personal'],collectAllow:[]},
 {id:'r1-vg-own-member',round:'r1',doc:'pdf',label:'Mitteilungsblatt Nr. 20/2026 – Sitzung Gemeinderat',source:{name:'Gemeinde Adorf'},text:`Mitteilungsblatt der Verwaltungsgemeinschaft Oberland
Nr. 20/2026 Ausgabe vom 09.10.2026
Gemeinde Adorf
Öffentliche Bekanntmachung
Am Dienstag, 14.10.2026, 19.30 Uhr, findet eine öffentliche Sitzung des Gemeinderates Adorf statt.
Tagesordnung
1. Bauantrag Fl.Nr. 12
2. Haushalt 2027
Nichtöffentlicher Teil
3. Grundstücksangelegenheiten
Gemeinde Bdorf
Am Donnerstag, 16.10.2026, 20.00 Uhr, findet eine öffentliche Sitzung des Gemeinderates Bdorf statt.
Tagesordnung
1. Feuerwehrbedarfsplan
2. Kindergartengebühren
Nichtöffentlicher Teil
3. Personalangelegenheiten`,forbid:SECRET,collectAllow:PUBLIC12},
 {id:'r1-zweckverband-issuer',round:'r1',doc:'pdf',label:'Einladung Werkausschuss 21.10.2026',source:{name:'Gemeinde Adorf'},text:`Zweckverband zur Abwasserbeseitigung Oberland
Einladung
Sitzung des Werkausschusses am Dienstag, 21.10.2026, 17.00 Uhr, Kläranlage Oberland
Öffentlicher Teil
1. Jahresabschluss 2025
2. Gebührenkalkulation`,collectAllow:[]},
 {id:'r1-zweckverband-in-amtsblatt',round:'r1',doc:'pdf',label:'Amtsblatt Nr. 40/2026 mit Tagesordnung Gemeinderat',source:{name:'Gemeinde Musterbach'},text:`Amtsblatt der Verwaltungsgemeinschaft Musterland
Freitag, 2. Oktober 2026 Nr. 40
Zweckverband Wasserversorgung Musterbachgruppe
Öffentliche Bekanntmachung
Am Dienstag, 20.10.2026, 18:00 Uhr, findet im Sitzungssaal eine öffentliche Sitzung des Werkausschusses statt.
Tagesordnung
Öffentlicher Teil
1. Feststellung des Jahresabschlusses 2025
2. Vergabe der Rohrnetzerneuerung
gez. Schmid, Verbandsvorsitzender`,collectAllow:[]},
 {id:'r1-abwasserzweckverband-verbandsausschuss',round:'r1',doc:'pdf',label:'Amtsblatt Nr. 40/2026 mit Tagesordnung',source:{name:'Gemeinde Musterbach'},text:`Amtsblatt der Verwaltungsgemeinschaft Musterland
Freitag, 2. Oktober 2026 Nr. 40
Abwasserzweckverband Oberes Mustertal
Einladung
zur Sitzung des Verbandsausschusses am Mittwoch, 21.10.2026, 17:00 Uhr
Tagesordnung:
Öffentlicher Teil
1. Kalkulation der Abwassergebühren 2027
2. Sanierung Kläranlage`,collectAllow:[]},
 {id:'r1-landkreis-issuer',round:'r1',doc:'pdf',label:'Bekanntmachung Sitzung Jugendhilfeausschuss',source:{name:'Gemeinde Adorf'},text:`Landkreis Musterkreis
Öffentliche Bekanntmachung
Sitzung des Jugendhilfeausschusses am Montag, 20.10.2026, 14.00 Uhr, im Landratsamt, Großer Sitzungssaal
Öffentlicher Teil
1. Bedarfsplanung Kindertagesbetreuung 2027
2. Jugendhilfeplanung
Nichtöffentlicher Teil
3. Personalangelegenheiten`,forbid:['Personal'],collectAllow:[]},
 {id:'r1-landkreis-in-amtsblatt',round:'r1',doc:'pdf',label:'Amtsblatt Nr. 40/2026 mit Tagesordnung',source:{name:'Gemeinde Musterbach'},text:`Amtsblatt der Verwaltungsgemeinschaft Musterland
Freitag, 2. Oktober 2026 Nr. 40
Landkreis Musterkreis
Bekanntmachung
Am Montag, 19.10.2026, 14:00 Uhr, findet im Landratsamt eine öffentliche Sitzung des Jugendhilfeausschusses statt.
Tagesordnung
Öffentlicher Teil
1. Bedarfsplanung Kindertagesstätten im Landkreis
2. Jugendhilfeplanung 2027`,collectAllow:[]},
 {id:'r1-landratsamt-issuer',round:'r1',doc:'pdf',label:'Sitzung Ausschuss für Umwelt und Kreisentwicklung',source:{name:'Gemeinde Adorf'},text:`Landratsamt Musterkreis
Sitzung des Ausschusses für Umwelt und Kreisentwicklung am Mittwoch, 22.10.2026, 15.00 Uhr
Öffentliche Sitzung
1. Abfallwirtschaftskonzept
2. ÖPNV Nahverkehrsplan`,collectAllow:[]},
 {id:'r1-bekanntmachung-des-landkreises',round:'r1',doc:'pdf',label:'Amtsblatt Nr. 40/2026 mit Tagesordnung',source:{name:'Gemeinde Musterbach'},text:`Amtsblatt der Verwaltungsgemeinschaft Musterland
Freitag, 2. Oktober 2026 Nr. 40
Bekanntmachung des Landkreises Musterkreis
Öffentliche Sitzung des Ausschusses für Umwelt, Bauen und Verkehr am Dienstag, 20.10.2026, 15:00 Uhr
Tagesordnung:
1. Radwegekonzept Landkreis
2. ÖPNV-Nahverkehrsplan`,collectAllow:[]},
 {id:'r1-schulverband',round:'r1',doc:'pdf',label:'Einladung Schulverbandsversammlung',source:{name:'Gemeinde Adorf'},text:`Schulverband Oberland
Einladung zur öffentlichen Sitzung der Schulverbandsversammlung am Donnerstag, 23.10.2026, 19.00 Uhr
Tagesordnung
1. Haushaltsplan 2027 des Schulverbandes
2. Sanierung Turnhalle`,collectAllow:[]},
 {id:'r1-verbandsgemeinderat',round:'r1',doc:'html',label:'Sitzung Verbandsgemeinderat 14.10.2026',source:{name:'Ortsgemeinde Musterbach'},text:page('<h1>Sitzung des Verbandsgemeinderates Musterbach-Land am 14.10.2026</h1><p>Beginn: 19:00 Uhr</p><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nichtöffentlicher Teil</h2><p>TOP 3 Grundstück</p>'),forbid:SECRET,collectAllow:[]},
 {id:'r1-verbandsgemeinderat-wochenblatt',round:'r1',doc:'pdf',label:'Wochenblatt KW 41 – Sitzung Verbandsgemeinderat',source:{name:'Ortsgemeinde Musterbach'},text:`Wochenblatt der Verbandsgemeinde Musterland
Öffentliche Bekanntmachung
Sitzung des Verbandsgemeinderates am Donnerstag, 15.10.2026, 18:00 Uhr
Die Sitzung ist öffentlich.
Tagesordnung:
1. Fortschreibung des Feuerwehrbedarfsplans der Verbandsgemeinde
2. Neubau Grundschule Musterland`,collectAllow:[]},
 {id:'r1-samtgemeinderat',round:'r1',doc:'html',label:'Sitzung Samtgemeinderat 14.10.2026',text:page('<h1>Sitzung des Samtgemeinderates am 14.10.2026</h1><p>Beginn: 19:00 Uhr</p><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nichtöffentlicher Teil</h2><p>TOP 3 Grundstück</p>'),forbid:SECRET,collectAllow:[]},
 {id:'r1-samtgemeinderat-pdf',round:'r1',doc:'pdf',label:'Bekanntmachung Sitzung Samtgemeinderat 15.10.2026',text:`Bekanntmachung
Sitzung des Samtgemeinderates am Donnerstag, 15.10.2026, 19:00 Uhr, im Rathaus der Samtgemeinde
Öffentlicher Teil
1. Eröffnung
2. Haushaltssatzung 2027 der Samtgemeinde
3. Umbau Feuerwehrhaus Samtgemeinde`,collectAllow:[]},
 {id:'r1-amtsausschuss',round:'r1',doc:'html',label:'Sitzung Amtsausschuss 14.10.2026',text:page('<h1>Sitzung des Amtsausschusses des Amtes Musterland am 14.10.2026</h1><p>Beginn: 19:00 Uhr</p><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nichtöffentlicher Teil</h2><p>TOP 3 Grundstück</p>'),forbid:SECRET,collectAllow:[]},
 {id:'r1-amtsausschuss-pdf',round:'r1',doc:'pdf',label:'Einladung Amtsausschuss 21.10.2026',text:`Amt Musterland
Der Amtsvorsteher
Einladung
zur Sitzung des Amtsausschusses am Mittwoch, 21.10.2026, 19:30 Uhr, im Amtsgebäude
Tagesordnung:
Öffentlicher Teil
1. Einwohnerfragestunde
2. Erweiterung des Amtsgebäudes
3. Amtsumlage 2027`,collectAllow:[]},
 {id:'r1-hauptausschuss-der-vg',round:'r1',doc:'html',label:'Sitzung Hauptausschuss 14.10.2026',source:{name:'Ortsgemeinde Musterbach'},text:page('<h1>Sitzung des Haupt- und Finanzausschusses der Verbandsgemeinde Musterland am 14.10.2026</h1><p>Beginn: 19:00 Uhr</p><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nichtöffentlicher Teil</h2><p>TOP 3 Grundstück</p>'),forbid:SECRET,collectAllow:[]},
 {id:'r1-vg-ausschuss-issuer',round:'r1',doc:'pdf',label:'Amtsblatt Nr. 40/2026 mit Tagesordnung',source:{name:'Gemeinde Musterbach'},text:`Amtsblatt der Verwaltungsgemeinschaft Musterland
Freitag, 2. Oktober 2026 Nr. 40
Verwaltungsgemeinschaft Musterland
Öffentliche Bekanntmachung
Am Donnerstag, 15.10.2026, 18:00 Uhr, findet im Sitzungssaal der Verwaltungsgemeinschaft eine öffentliche Sitzung des Haupt- und Finanzausschusses statt.
Tagesordnung
Öffentlicher Teil
1. Haushaltsvollzug 2026 der Verwaltungsgemeinschaft
2. Beschaffung einer Telefonanlage
gez. Maier, Gemeinschaftsvorsitzender`,collectAllow:[]},
 {id:'r1-gemeinschaftsausschuss',round:'r1',doc:'html',label:'Sitzung Gemeinschaftsausschuss 14.10.2026',text:page('<h1>Sitzung des Gemeinschaftsausschusses Musterland am 14.10.2026</h1><p>Beginn: 19:00 Uhr</p><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nichtöffentlicher Teil</h2><p>TOP 3 Grundstück</p>'),forbid:SECRET,collectAllow:[]},
 {id:'r1-stadtrat-der-stadt-x',round:'r1',doc:'html',label:'Sitzung Stadtrat 14.10.2026',text:page('<h1>Sitzung des Stadtrates der Stadt Nachbarstadt am 14.10.2026</h1><p>Beginn: 19:00 Uhr</p><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nichtöffentlicher Teil</h2><p>TOP 3 Grundstück</p>'),forbid:SECRET,collectAllow:[]},
 {id:'r1-rat-der-stadt-x',round:'r1',doc:'pdf',label:'Amtsblatt Nr. 40/2026 Tagesordnung Ratssitzung',source:{name:'Stadt Musterbach'},text:`Amtsblatt Nr. 40 vom 02.10.2026
Bekanntmachung
Öffentliche Sitzung des Rates der Stadt Nachbarstadt am Donnerstag, 15.10.2026, 18:00 Uhr
Tagesordnung
1. Neubau Feuerwache Nachbarstadt
2. Haushaltssatzung 2027`,collectAllow:[]},
 {id:'r1-stvv-der-stadt-x',round:'r1',doc:'pdf',label:'Amtsblatt Nr. 40/2026 Tagesordnung',source:{name:'Gemeinde Musterbach'},text:`Amtsblatt Nr. 40 vom 02.10.2026
Einladung zur öffentlichen Sitzung der Stadtverordnetenversammlung der Stadt Nachbarstadt am Donnerstag, 15.10.2026, 19:00 Uhr
Tagesordnung
1. Neubau Feuerwache Nachbarstadt
2. Haushaltssatzung 2027`,collectAllow:[]},
 {id:'r1-gv-der-gemeinde-x',round:'r1',doc:'pdf',label:'Amtsblatt Nr. 40/2026 Tagesordnung Gemeindevertretung',source:{name:'Gemeinde Musterbach'},text:`Amtsblatt des Amtes Musterland Nr. 40 vom 02.10.2026
Einladung zur öffentlichen Sitzung der Gemeindevertretung der Gemeinde Nachbardorf am Donnerstag, 15.10.2026, 19:00 Uhr
Tagesordnung
1. Einwohnerfragestunde
2. Ausbau Dorfstraße Nachbardorf`,collectAllow:[]},
 {id:'r0-ortschaftsrat-other-town',round:'r0',doc:'html',label:'Sitzung Ortschaftsrat 14.10.2026',text:page('<h1>Sitzung des Ortschaftsrates Nachbardorf am 14.10.2026</h1><p>Beginn: 19:00 Uhr</p><h2>Öffentlicher Teil</h2><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p><h2>Nichtöffentlicher Teil</h2><p>TOP 3 Grundstück</p>'),forbid:SECRET},
 {id:'r0-kreistag-on-city',round:'r0',doc:'html',label:'Kreistag tagt',source:{name:'Stadt Musterbach'},text:page('<h1>Kreistag tagt am 14.10.2026</h1><p>Öffentliche Sitzung des Kreistags Musterland am 14.10.2026 um 15 Uhr im Landratsamt</p><p>TOP 1 Kreishaushalt 2027</p><p>TOP 2 ÖPNV</p>'),collectAllow:[]},
];

// Feeds and calendars: the day of a postponed or continued meeting.
export const feedCases=[
 {id:'r1-rss-postponed',round:'r1',kind:'rss',title:'Gemeinderat: Sitzung verlegt',html:'<p>Die für den 07.10.2026 geplante öffentliche Sitzung des Gemeinderates wird auf Mittwoch, 14.10.2026, 19:30 Uhr, verlegt.</p><p>Tagesordnung:</p><p>1. Bauantrag Neubau Carport Fl.Nr. 210<br>2. Vergabe Straßenbeleuchtung<br>3. Anfragen</p>',date:'2026-10-14'},
 {id:'r1-ics-continued',round:'r1',kind:'ics',dtstart:'20261014T190000',summary:'Öffentliche Sitzung des Gemeinderates (Fortsetzung der Sitzung vom 07.10.2026)',description:'Tagesordnung:\\n1. Bauantrag Neubau Carport\\n2. Vergabe Straßenbeleuchtung',date:'2026-10-14'},
 {id:'r0-ics-anschl-noe',round:'r0',kind:'ics',dtstart:'20261014T190000',summary:'Öffentliche Sitzung des Gemeinderates',description:'Tagesordnung:\\n1. Bauantrag Neubau Carport\\n2. Vergabe Straßenbeleuchtung\\nanschl. nichtöffentl. Sitzung:\\n3. Grundstücksangelegenheit Flurstück 412',forbid:SECRET},
 {id:'r0-ics-n-mark',round:'r0',kind:'ics',dtstart:'20261015T190000',summary:'Öffentliche Sitzung des Bauausschusses',description:'TOP 1 Bauantrag Garage\\nTOP 2 Bauvoranfrage\\nTOP 3 (N) Vertragsangelegenheit Lindenweg',forbid:SECRET},
 {id:'r0-ics-part-two',round:'r0',kind:'ics',dtstart:'20261014T200000',summary:'Sitzung des Gemeinderates – Teil 2',description:'Öffentliche Sitzung\\n3. Grundstücksangelegenheit Flurstück 412 – N',forbid:SECRET},
];

// Links, addresses of a sitemap and redirect targets that name the non-public part: never fetched.
export const closedLabels=['Niederschrift Gemeinderat 16.09.2026 (nö)','Niederschrift GR 16.09.2026 N.Ö.','Protokoll Gemeinderatssitzung 16.09.2026 nichtöff.','Protokoll Gemeinderatssitzung 16.09.2026 (n.öff.)',
 'Protokoll Gemeinderatssitzung 16.09.2026 nöff. Teil','Niederschrift Gemeinderat 16.09.2026 – nichtöffentl. Teil','Niederschrift Gemeinderat 16.09.2026 (NÖS)','Niederschrift Gemeinderat 16.09.2026 nicht-öff.',
 'Niederschrift Gemeinderat 16.09.2026 (geschl. Sitzung)','Niederschrift Gemeinderat 16.09.2026 – nichtöfftl.','Niederschrift Gemeinderat 16.09.2026 – Teil N','Niederschrift Gemeinderat 16.09.2026 (vertr.)',
 'Niederschrift Gemeinderat 16.09.2026 nichtöffentlicher Teil','Niederschrift Gemeinderat 16.09.2026 (interner Teil)','Niederschrift Gemeinderat 16.09.2026 (unter Ausschluss der Öffentlichkeit)',
 'Niederschrift Gemeinderat 16.09.2026 nicht öffentl.','Niederschrift Gemeinderat 16.09.2026 (NÖ-Teil)','Niederschrift Gemeinderat 16.09.2026 nichtöffentliche','Niederschrift Gemeinderat 16.09.2026 Nicht&amp;ouml;ffentlich',
 'Niederschrift Gemeinderat 16.09.2026 nichtÃ¶ffentlich','Niederschrift Gemeinderat 16.09.2026 (geschlossene Sitzung)'];
export const closedPaths=['/f/Protokoll_GR_2026-09-16_nicht%F6ffentlich.pdf','/f/protokoll-gr-2026-09-16-nichtoeffentl.pdf','/f/protokoll_gr_20260916_noeS.pdf','/f/Protokoll%20GR%2016.09.2026%20n%C3%B6.pdf',
 '/f/protokoll-gr-16-09-2026-n-oe.pdf','/f/protokoll-gr-16-09-2026-nichtoef.pdf','/f/gr-2026-09-16-NOE.pdf','/f/gr-2026-09-16_n%C3%B6.pdf','/f/gr-2026-09-16-nicht%C3%B6ff.pdf','/f/Gemeinderat%2016.09.2026%20(N%C3%96).pdf',
 '/f/gr-2026-09-16-geschlossen.pdf','/f/gr-2026-09-16-%6Eicht%6Fffentlich.pdf','/f/gr-2026-09-16-Nicht%C3%96ffentlich.pdf','/f/gr-2026-09-16-nicht%2Doeffentlich.pdf',
 '/f/gr-2026-09-16-nicht+oeffentlich.pdf','/f/gr-2026-09-16-nicht%5Foeffentlich.pdf','/f/gr-2026-09-16-NichtOEffentlich.pdf','/f/gr-2026-09-16-nicht%E2%80%91oeffentlich.pdf','/f/gr-2026-09-16-n.oeff.pdf',
 '/f/2026/geschlossen/gr-2026-09-16.pdf','/f/intern/nichtoef/gr.pdf','/rathaus/gremien/gemeinderat/niederschrift-2026-09-16-nicht%F6ffentlich.html','/rathaus/gremien/gemeinderat/sitzung-2026-09-16-n-oeff.html',
 '/rathaus/gremien/gemeinderat/niederschrift-2026-09-16-noe.html'];

// --- round 2 -----------------------------------------------------------------------------------------------------------
// expect: [[title start, day, body], …] for texts with several meetings; collectForbid: words forbidden for the reader only.
const MB_HEAD=`Gemeinde Musterbach
Am Mittwoch, 14.10.2026, 19.00 Uhr, findet im Sitzungssaal des Rathauses eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung`;
const MB_MARKT=`Markt Musterbach
Am Mittwoch, 14.10.2026, 19.00 Uhr, findet im Sitzungssaal des Rathauses eine öffentliche Sitzung des Marktgemeinderates statt.
Tagesordnung`;
const SIGN=`Musterbach, 07.10.2026
gez. Huber
Erster Bürgermeister`;
const GNK=['Genehmigung der Niederschrift','Bauantrag Kita'];
const NP=['Grundstück','Personal'];
const EINL='Einladung Gemeinderat 14.10.2026';
const r2pdf=(id,text,more={})=>({id,round:'r2',doc:'pdf',label:EINL,text,forbid:NP,date:'2026-10-14',...more});
const r2html=(id,main,more={})=>({id,round:'r2',doc:'html',label:'Sitzung des Gemeinderates am 14.10.2026',text:page(main),forbid:NP,...more});
const NIED=main=>page(`<h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 16.09.2026</h1><p>Beginn: 19:00 Uhr</p><h3>TOP 1 Bauantrag Kita</h3><p>Beschluss: Das Einvernehmen wird erteilt.</p><p>Abstimmung: 12 : 0</p><h3>TOP 2 Haushalt 2027</h3><p>Der Gemeinderat nimmt den Entwurf zur Kenntnis.</p>${main}<h3>TOP 3 Grundstücksangelegenheit Fl.Nr. 412</h3><p>Beschluss: Der Verkauf an Familie Huber wird beschlossen.</p><p>Abstimmung: 10 : 2</p>`);
const nied=(id,sep)=>({id,round:'r2',doc:'html',label:'Niederschrift Gemeinderat 16.09.2026',text:NIED(sep),forbid:NP,allow:['Bauantrag Kita','Haushalt 2027'],date:'2026-09-16',now:'2026-10-04'});
const SH=sentence=>page(`<h1>Einladung zur öffentlichen Sitzung der Gemeindevertretung Musterbach</h1><p>am Mittwoch, 14.10.2026, 19:30 Uhr, im Dörpshus.</p><p>Tagesordnung:</p><p>1. Einwohnerfragestunde<br>2. Bericht des Bürgermeisters<br>3. Bebauungsplan Nr. 12<br>4. Grundstücksangelegenheit</p><p>${sentence}</p>`);
const sh=(id,sentence)=>({id,round:'r2',doc:'html',label:'Sitzung des Gemeinderates am 14.10.2026',text:SH(sentence),forbid:NP,allow:['Einwohnerfragestunde','Bericht des Bürgermeisters','Bebauungsplan Nr. 12']});
const MINUTES_PDF=sep=>`Niederschrift über die öffentliche Sitzung des Gemeinderates
am Mittwoch, 16.09.2026, im Sitzungssaal des Rathauses
1. Bauantrag Kita
Der Gemeinderat erteilt das gemeindliche Einvernehmen. Abstimmung: 12:0
2. Haushalt 2027
Der Gemeinderat nimmt den Entwurf zur Kenntnis.
${sep}
3. Grundstücksangelegenheit Fl.Nr. 412
Der Gemeinderat beschließt den Verkauf. Abstimmung: 10:2
4. Personalangelegenheit
Der Gemeinderat stimmt der Einstellung zu.`;
const MBLATT=heading=>`Mitteilungsblatt Musterbach
Aus der Sitzung des Gemeinderates vom 16.09.2026
Öffentlicher Teil
1. Bauantrag Kita
Der Gemeinderat erteilt das Einvernehmen. Abstimmung: 12:0
2. Haushalt 2027
Der Gemeinderat nimmt den Entwurf zur Kenntnis.
${heading}
3. Vergabe der Planungsleistungen an das Ingenieurbüro Muster
4. Grundstücksverkauf an die Firma Beispiel GmbH`;
const TERMINE='<h1>Sitzungstermine</h1>';
const GAZ_VG=section=>`Mitteilungsblatt der Verwaltungsgemeinschaft Oberland
Freitag, 2. Oktober 2026 Nr. 40
Amtliche Bekanntmachungen
${section}
Öffentliche Sitzung des Gemeinderates
am Mittwoch, 14.10.2026, 19:30 Uhr, im Sitzungssaal
Tagesordnung
1. Bauantrag Feuerwehrhaus Bdorf
2. Jahresrechnung Bdorf 2025`;
const LETTER=(issuer,sentence,items)=>`${issuer}
Hauptstraße 1
12345 Musterstadt
Telefon 01234 567-0
Telefax 01234 567-99
E-Mail: poststelle@example.test
Internet: www.example.test
Bekanntmachung
${sentence}
Tagesordnung
${items}`;

cases.push(
 // Ö/N column between the number and the title or after the title (table rows as one text line each)
 r2pdf('r2-column-mid-vorlage',`${MB_HEAD}
TOP Vorlage Ö/N Betreff
1 GR/2026/041 Ö Genehmigung der Niederschrift
2 GR/2026/042 Ö Bauantrag Kita
3 GR/2026/043 N Grundstücksangelegenheit Fl.Nr. 412
4 GR/2026/044 N Personalangelegenheit`),
 r2pdf('r2-column-mid-after-title',`${MB_HEAD}
TOP Betreff Ö/N Vorlage
1 Genehmigung der Niederschrift Ö GR/2026/041
2 Bauantrag Kita Ö GR/2026/042
3 Grundstücksangelegenheit Fl.Nr. 412 N GR/2026/043
4 Personalangelegenheit N GR/2026/044`),
 r2pdf('r2-column-two-checkboxes',`${MB_HEAD}
TOP Betreff Ö N
1 Genehmigung der Niederschrift x
2 Bauantrag Kita x
3 Grundstücksangelegenheit Fl.Nr. 412 x
4 Personalangelegenheit x`),
 r2pdf('r2-column-oeffentlich-mid',`${MB_HEAD}
Nr. Betreff öffentlich Vorlage
1 Genehmigung der Niederschrift ja GR/041
2 Bauantrag Kita ja GR/042
3 Grundstücksangelegenheit nein GR/043
4 Personalangelegenheit nein GR/044`),
 // notes after the agenda that name an item by its title
 r2pdf('r2-note-by-title',`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Grundstücksangelegenheiten – Verkauf einer Teilfläche
3. Bauantrag Kita
4. Anfragen
Der Tagesordnungspunkt „Grundstücksangelegenheiten“ wird nichtöffentlich behandelt.
${SIGN}`,{allow:[]}),
 r2pdf('r2-note-title-after-signature',`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Grundstücksangelegenheiten
3. Bauantrag Kita
4. Anfragen
Musterbach, 07.10.2026
Grundstücksangelegenheiten: nichtöffentlich`,{allow:[]}),
 r2pdf('r2-head-names-item',`Gemeinde Musterbach
Am Mittwoch, 14.10.2026, 19.00 Uhr, findet im Rathaus eine öffentliche Sitzung des Gemeinderates statt.
Die Beratung der Erbbaurechtsangelegenheit erfolgt unter Ausschluss der Öffentlichkeit.
Tagesordnung
Öffentlicher Teil
1. Genehmigung der Niederschrift
2. Erbbaurechtsangelegenheit Kirchweg 3
3. Bauantrag Kita
Nichtöffentlicher Teil
4. Personalangelegenheit`,{forbid:[...NP,'Erbbau'],allow:[]}),
 // reports in a gazette of decisions taken in the non-public part
 ...['In nichtöffentlicher Sitzung gefasste Beschlüsse','Bekanntgabe der in nichtöffentlicher Sitzung gefassten Beschlüsse','Nichtöffentlich gefasste Beschlüsse, deren Geheimhaltungsgrund weggefallen ist:'].map((h,n)=>({id:`r2-gazette-np-decisions-${n+1}`,round:'r2',doc:'pdf',label:'Aus der Sitzung des Gemeinderates vom 16.09.2026',text:MBLATT(h),forbid:['Vergabe der Planungs','Grundstücksverkauf'],allow:['Bauantrag Kita','Haushalt 2027'],date:'2026-09-16'})),
 // sentences of minutes that close the public part
 ...['Der öffentliche Teil der Sitzung wurde um 20:15 Uhr geschlossen.','Um 20:15 Uhr schloss der Vorsitzende den öffentlichen Teil der Sitzung.'].map((s,n)=>({id:`r2-minutes-closed-${n+1}`,round:'r2',doc:'pdf',label:'Niederschrift Gemeinderat 16.09.2026',text:MINUTES_PDF(s),forbid:NP,allow:['Bauantrag Kita','Haushalt 2027'],date:'2026-09-16'})),
 // marks of unknown meaning and their legends
 ...[['■','■ = nichtöffentlich'],['#','# nichtöffentlich'],['(+)','(+) = nichtöffentliche Beratung'],['(V)','V = vertraulich']].map(([m,legend],n)=>r2pdf(`r2-symbol-mark-${n+1}`,`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
3. Grundstücksangelegenheit ${m}
4. Personalangelegenheit ${m}
${legend}`)),
 // the paragraph of the municipal code that excludes the public, without the word "nichtöffentlich"
 {id:'r2-paragraph-hgo',round:'r2',doc:'pdf',label:'Einladung Sitzung Gemeindevertretung 15.10.2026',text:`Gemeinde Musterbach
Einladung
zur 12. Sitzung der Gemeindevertretung am Donnerstag, 15.10.2026, 20.00 Uhr, im Bürgerhaus.
Die Sitzung ist öffentlich.
Tagesordnung
1. Mitteilungen des Vorsitzenden
2. Bebauungsplan „Am Sportplatz“ – Aufstellungsbeschluss
3. Stundung von Gewerbesteuer (§ 52 Abs. 1 HGO)
4. Grundstücksangelegenheit (§ 52 Abs. 1 Satz 2 HGO)`,forbid:[...NP,'Stundung'],date:'2026-10-15'},
 ...[['thuerko','gem. § 40 Abs. 1 ThürKO:'],['kvmv','Beratung gemäß § 29 Abs. 5 KV M-V:'],['gemo','Danach findet eine Sitzung gemäß § 35 Abs. 1 Satz 2 GemO statt:'],['gonrw','Gemäß § 48 Abs. 2 GO NRW:'],['bygo','gemäß Art. 52 Abs. 2 GO:']].map(([k,line])=>r2pdf(`r2-paragraph-${k}`,`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Haushalt 2027
${line}
3. Grundstücksangelegenheit
4. Personalangelegenheit`,{forbid:[...NP,'§','ThürKO','KV M-V','GemO']})),
 // abbreviations of the mark in brackets or in the middle of the title
 ...['(nichtö.)','(unter Ausschl. d. Öff.)','[N]','(N.)','(NS)'].map((m,n)=>r2pdf(`r2-abbrev-mark-${n+1}`,`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
3. Grundstücksangelegenheit ${m}
4. Personalangelegenheit ${m}`)),
 r2pdf('r2-abbrev-mark-mid',`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
3. Grundstücksangelegenheit (N) Vorlage 2026/043
4. Personalangelegenheit (N) Vorlage 2026/044`),
 r2pdf('r2-mark-colon-before-number',`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
N: 3. Grundstücksangelegenheit
N: 4. Personalangelegenheit`,{allow:GNK}),
 // short headings of the parts
 ...[['Ö-Teil','N-Teil'],['Erster Teil – öffentlich','Zweiter Teil'],['A Öffentliche Sitzung','B Sitzung'],['ÖT','NÖT']].map(([a,b],n)=>({id:`r2-part-short-${n+1}`,round:'r2',doc:'pdf',label:'Einladung Marktgemeinderat 14.10.2026',text:`${MB_MARKT}
${a}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
${b}
3. Grundstücksangelegenheit
4. Personalangelegenheit`,forbid:NP,allow:GNK,date:'2026-10-14'})),
 // postponed meeting: old and new day in one sentence
 ...['Die öffentliche Sitzung des Gemeinderates am 07.10.2026 wird auf Mittwoch, 14.10.2026, 19.00 Uhr verlegt.',
  'Die am Mittwoch, 07.10.2026 geplante öffentliche Sitzung des Gemeinderates findet am Mittwoch, 14.10.2026, 19.00 Uhr statt.',
  'Die öffentliche Sitzung des Gemeinderates findet (ursprünglich Mittwoch, 07.10.2026) am Mittwoch, 14.10.2026, 19.00 Uhr statt.',
  'Die öffentliche Sitzung des Gemeinderates findet nicht am Mittwoch, 07.10.2026, sondern am Mittwoch, 14.10.2026, 19.00 Uhr statt.'].map((s,n)=>({id:`r2-date-moved-${n+1}`,round:'r2',doc:'pdf',label:'Bekanntmachung Sitzung des Gemeinderates',text:`Gemeinde Musterbach
Bekanntmachung
${s}
Tagesordnung
1. Bauantrag Kita
2. Haushalt 2027`,date:'2026-10-14'})),
 // notices of several meetings
 {id:'r2-collective-notice-head-block',round:'r2',doc:'pdf',label:'Bekanntmachung Sitzungen Oktober 2026',text:`Gemeinde Musterbach
Bekanntmachung
Am Dienstag, 13.10.2026, 18.00 Uhr, findet im Rathaus eine öffentliche Sitzung des Bauausschusses statt.
Tagesordnung
1. Bauantrag Garage Fl.Nr. 77
2. Bauantrag Carport Fl.Nr. 78
Tagesordnung für die Sitzung des Gemeinderates
Sitzungsort: Rathaus, Sitzungssaal
Beginn: 19.00 Uhr
Sitzungstag: Mittwoch, 14.10.2026
Öffentlicher Teil
1. Genehmigung der Niederschrift
2. Bauantrag Kita
3. Haushalt 2027 Kita
4. Feuerwehrbedarfsplan Kita
Nichtöffentlicher Teil
5. Grundstücksangelegenheit`,forbid:NP,expect:[['Bauantrag Garage','2026-10-13','Bauausschuss'],['Bauantrag Carport','2026-10-13','Bauausschuss'],['Genehmigung','2026-10-14','Gemeinderat'],['Bauantrag Kita','2026-10-14','Gemeinderat'],['Haushalt','2026-10-14','Gemeinderat'],['Feuerwehr','2026-10-14','Gemeinderat']]},
 {id:'r2-collective-notice-full-hour',round:'r2',doc:'pdf',label:'Bekanntmachung Sitzungen Oktober 2026',text:`Gemeinde Musterbach
Bekanntmachung
Gemeinderat
Sitzung am Mittwoch, 14.10.2026, 19.00 Uhr
Die Sitzung ist öffentlich.
Tagesordnung
1. Genehmigung der Niederschrift
2. Haushalt 2027
Bauausschuss
Dienstag, 20. Oktober 2026, 18 Uhr
Sitzungssaal Rathaus
Tagesordnung
1. Bauantrag Garage Fl.Nr. 77
2. Bauantrag Carport Fl.Nr. 78
3. Bauvoranfrage Wohnhaus Fl.Nr. 79
4. Bauantrag Scheune Fl.Nr. 80`,expect:[['Genehmigung','2026-10-14','Gemeinderat'],['Haushalt','2026-10-14','Gemeinderat'],['Bauantrag','2026-10-20','Bauausschuss'],['Bauvoranfrage','2026-10-20','Bauausschuss']]},
 ...['Sitzung des Bauausschusses vom 22.09.2026','öffentlichen Sitzung des Bauausschusses vom 22.09.2026'].map((cont,n)=>({id:`r2-wrapped-title-names-meeting-${n+1}`,round:'r2',doc:'pdf',label:EINL,text:`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19.00 Uhr
Tagesordnung
Ö 1 Genehmigung der Niederschrift
Ö 2 Bebauungsplan „Am Mühlbach“ – Satzungsbeschluss; Empfehlung aus der
${cont}
Ö 3 Bauantrag Kita
Ö 4 Haushalt 2027
N 5 Grundstücksangelegenheit`,forbid:NP,date:'2026-10-14',committee:'Gemeinderat'})),
 // bodies of other municipalities, of the county, an Amt, a Verwaltungsgemeinschaft or an association
 {id:'r2-ortsgemeinderat-other-pdf',round:'r2',doc:'pdf',label:'Bekanntmachung Sitzung 15.10.2026',source:{name:'Ortsgemeinde Musterbach'},text:`Öffentliche Bekanntmachung
Sitzung des Ortsgemeinderates Nachbarhausen
am Donnerstag, 15.10.2026, 19.30 Uhr, im Dorfgemeinschaftshaus Nachbarhausen
Tagesordnung
Öffentlicher Teil
1. Feuerwehrhaus Umbau
2. Straßenausbau Lindenweg
Nichtöffentlicher Teil
3. Grundstücksangelegenheit`,forbid:['Grundstück'],collectAllow:[]},
 ...['Nachbarhausen','Aus der Gemeinde Nachbarhausen','Amtliche Bekanntmachungen der Gemeinde Nachbarhausen'].map((sec,n)=>({id:`r2-gazette-member-sections-${n+1}`,round:'r2',doc:'pdf',label:'Mitteilungsblatt Nr. 41/2026 – Sitzungen der Gemeinderäte',text:`Mitteilungsblatt Oberland
Freitag, 9. Oktober 2026 Nr. 41
Amtliche Bekanntmachungen
Musterbach
Öffentliche Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19.00 Uhr, Rathaus Musterbach
Tagesordnung
1. Bauantrag Kita
2. Haushalt 2027
${sec}
Öffentliche Sitzung des Gemeinderates am Donnerstag, 15.10.2026, 19.30 Uhr, Rathaus Nachbarhausen
Tagesordnung
1. Feuerwehrhaus Nachbarhausen Umbau
2. Straßenausbau Lindenweg`,forbid:['Haushalt 2027 Nachbarhausen'],collectForbid:['Nachbarhausen','Lindenweg'],expect:[['Bauantrag Kita','2026-10-14','Gemeinderat'],['Haushalt','2026-10-14','Gemeinderat']]})),
 {id:'r2-amtsblatt-gv-other',round:'r2',doc:'pdf',label:'Amtsblatt Nr. 10/2026 Sitzung Gemeindevertretung',text:`Amtsblatt Nr. 10/2026
Öffentliche Bekanntmachung
Gemeindevertretung Nachbarhausen
Sitzung am Donnerstag, 15.10.2026, 19.00 Uhr
Ort: Gemeindezentrum Nachbarhausen
Tagesordnung
Öffentlicher Teil
1. Feuerwehrhaus Umbau
2. Straßenausbau Lindenweg
Nichtöffentlicher Teil
3. Grundstücksangelegenheiten`,forbid:['Grundstück'],collectAllow:[]},
 ...[['Landratsamt Musterkreis','Am Montag, 19.10.2026, 14.00 Uhr findet im großen Sitzungssaal eine öffentliche Sitzung des Ausschusses für Umwelt und Klimaschutz statt.','1. Abfallwirtschaftskonzept\n2. Nahverkehrsplan'],
  ['Zweckverband Wasserversorgung Oberland','Am Mittwoch, 21.10.2026, 18.00 Uhr findet eine öffentliche Sitzung des Werkausschusses statt.','1. Wasserpreis 2027\n2. Leitungserneuerung'],
  ['Amt Oberland','Am Mittwoch, 21.10.2026, 18.00 Uhr findet eine öffentliche Sitzung des Hauptausschusses statt.','1. Kita-Bedarfsplanung Amtsbereich\n2. Haushalt 2027'],
  ['Verwaltungsgemeinschaft Oberland','Am Mittwoch, 21.10.2026, 18.00 Uhr findet eine öffentliche Sitzung des Bauausschusses statt.','1. Bauantrag Oberland Hauptstraße 5\n2. Bauvoranfrage Oberland']].map(([issuer,s,items],n)=>({id:`r2-letterhead-${n+1}`,round:'r2',doc:'pdf',label:'Bekanntmachung Sitzung Ausschuss Oktober 2026',text:LETTER(issuer,s,items),collectAllow:[]})),
 // status of an item under its details (accordions, cards)
 r2html('r2-status-after-vorlage','<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><details><summary>TOP 1 Bauantrag Kita</summary><p>Vorlage: 2026/015</p><p>Sitzungsteil: öffentlich</p></details><details><summary>TOP 2 Haushalt 2027</summary><p>Vorlage: 2026/025</p><p>Sitzungsteil: öffentlich</p></details><details><summary>TOP 3 Grundstücksangelegenheit Fl.Nr. 412</summary><p>Vorlage: 2026/035</p><p>Sitzungsteil: nichtöffentlich</p></details>',{allow:['Bauantrag Kita','Haushalt 2027']}),
 r2html('r2-status-after-berichterstatter','<h1>Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>Die Sitzung ist öffentlich.</p><div class=top><h3>TOP 1 Bauantrag Kita</h3><p>Berichterstatter: Bürgermeister</p><p>öffentlich</p></div><div class=top><h3>TOP 2 Haushalt 2027</h3><p>Berichterstatter: Bürgermeister</p><p>öffentlich</p></div><div class=top><h3>TOP 3 Grundstücksangelegenheit</h3><p>Berichterstatter: Bürgermeister</p><p>nicht öffentlich</p></div>',{allow:['Bauantrag Kita','Haushalt 2027']}),
 // only the public items carry the mark Ö
 r2html('r2-oe-legend-unmarked','<h1>Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>Mit (Ö) gekennzeichnete Punkte werden öffentlich beraten.</p><p>1. Bauantrag Kita (Ö)<br>2. Haushalt 2027 (Ö)<br>3. Grundstücksangelegenheit</p>',{allow:['Bauantrag Kita','Haushalt 2027']}),
 r2html('r2-oe-lower-unmarked','<h1>Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>1. Bauantrag Kita (ö)<br>2. Haushalt 2027 (ö)<br>3. Grundstücksangelegenheit</p>',{allow:['Bauantrag Kita','Haushalt 2027']}),
 r2html('r2-top-oe-mixed','<h1>Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>TOP Ö 1 Bauantrag Kita<br>TOP Ö 2 Haushalt 2027<br>TOP 3 Grundstücksangelegenheit</p>',{allow:['Bauantrag Kita','Haushalt 2027']}),
 r2html('r2-table-oe-column-empty','<h1>Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><table><tr><td>1</td><td>Ö</td><td>Bauantrag Kita</td></tr><tr><td>2</td><td>Ö</td><td>Haushalt 2027</td></tr><tr><td>3</td><td></td><td>Grundstücksangelegenheit</td></tr></table>',{allow:['Bauantrag Kita','Haushalt 2027']}),
 r2html('r2-sup-noe','<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>1. Bauantrag Kita<br>2. Haushalt 2027<br>3. Grundstücksangelegenheit<sup>NÖ</sup></p>',{allow:['Bauantrag Kita','Haushalt 2027']}),
 r2html('r2-sup-n','<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>TOP 1 Bauantrag Kita<br>TOP 2 Haushalt 2027<br>TOP 3 Grundstücksangelegenheit<sup>N</sup></p>',{allow:['Bauantrag Kita','Haushalt 2027']}),
 // Schleswig-Holstein: the public is to be excluded for an item
 sh('r2-sh-soll-ausgeschlossen','Die Öffentlichkeit soll bei Tagesordnungspunkt 4 ausgeschlossen werden.'),
 sh('r2-sh-beabsichtigt','Es ist beabsichtigt, die Öffentlichkeit für den Tagesordnungspunkt 4 auszuschließen.'),
 sh('r2-sh-ausschliessen-wird','Für Tagesordnungspunkt 4 wird die Gemeindevertretung voraussichtlich die Öffentlichkeit ausschließen.'),
 sh('r2-sh-viele-worte','Die Öffentlichkeit wird voraussichtlich bei dem Tagesordnungspunkt 4 ausgeschlossen.'),
 // minutes: the sentence that ends the public part in other word orders
 ...['Bürgermeister Muster schließt den öffentlichen Teil der Sitzung um 20:15 Uhr.','Die Öffentlichkeit wurde um 20:15 Uhr ausgeschlossen.','Der öffentliche Teil der Sitzung wird um 20:15 Uhr geschlossen.','Um 20:15 Uhr beendet der Vorsitzende den öffentlichen Sitzungsteil.','Ende öffentliche Sitzung: 20:15 Uhr','Die Zuhörer und die Vertreter der Presse verlassen um 20:15 Uhr den Sitzungssaal.','Nach einer kurzen Pause wird die Sitzung ohne Zuhörer fortgesetzt.'].map((s,n)=>nied(`r2-minutes-separator-${n+1}`,`<p>${s}</p>`)),
 // marks as symbols in a responsive table, icons and classes
 r2html('r2-datalabel-circles','<h1>Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>Die Sitzung ist öffentlich.</p><table><tr><td data-label=TOP>1</td><td data-label=Betreff>Bauantrag Carport</td><td data-label=öffentlich>●</td></tr><tr><td data-label=TOP>2</td><td data-label=Betreff>Haushalt 2027</td><td data-label=öffentlich>●</td></tr><tr><td data-label=TOP>3</td><td data-label=Betreff>Personalangelegenheit</td><td data-label=öffentlich>○</td></tr></table>',{allow:['Bauantrag Carport','Haushalt 2027']}),
 r2html('r2-datalabel-ticks','<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><table><tr><td data-label=TOP>1</td><td data-label=Betreff>Bauantrag Carport</td><td data-label=öffentlich>✓</td></tr><tr><td data-label=TOP>2</td><td data-label=Betreff>Haushalt 2027</td><td data-label=öffentlich>✓</td></tr><tr><td data-label=TOP>3</td><td data-label=Betreff>Personalangelegenheit</td><td data-label=öffentlich>✗</td></tr></table>',{allow:['Bauantrag Carport','Haushalt 2027']}),
 r2html('r2-eye-slash','<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><ul><li>TOP 1 Bauantrag Kita</li><li>TOP 2 Haushalt 2027</li><li><i class="fa fa-eye-slash" aria-hidden="true"></i> TOP 3 Grundstücksangelegenheit</li></ul>',{allow:['Bauantrag Kita','Haushalt 2027']}),
 r2html('r2-tr-class','<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><table><tr><td>1</td><td>Bauantrag Kita</td></tr><tr><td>2</td><td>Haushalt 2027</td></tr><tr class="nichtoeffentlich"><td>3</td><td>Grundstücksangelegenheit</td></tr></table>',{allow:['Bauantrag Kita','Haushalt 2027']}),
 r2html('r2-css-class-item','<p>Mittwoch, 14.10.2026, 19:00 Uhr. Die Sitzung ist öffentlich.</p><ul><li class="top">1. Bauantrag Carport</li><li class="top top--np">2. Grundstücksangelegenheit Flurstück 412</li><li class="top">3. Haushalt 2027</li></ul><p class="legende"><span class="top--np"></span> nichtöffentlicher Tagesordnungspunkt</p>',{label:'Sitzung Gemeinderat 14.10.2026',allow:['Bauantrag Carport']}),
 r2html('r2-lock-src','<h1>Sitzung des Gemeinderates</h1><p>Mittwoch, 14.10.2026, 19:00 Uhr, Sitzungssaal. Die Sitzung ist öffentlich.</p><table><tr><td>1</td><td>Bauantrag Carport</td><td></td></tr><tr><td>2</td><td>Haushalt 2027</td><td></td></tr><tr><td>3</td><td>Grundstücksangelegenheit Flurstück 412</td><td><img src="/typo3conf/ext/sitzung/Resources/Public/Icons/schloss.svg"></td></tr></table>',{allow:['Bauantrag Carport','Haushalt 2027']}),
 // pages of dates with several meetings
 r2html('r2-termine-termin-lines',TERMINE+'<h2>Gemeinderat</h2><p>Termin: 14.10.2026, 19:00 Uhr</p><p>Ort: Rathaus, Sitzungssaal</p><h3>Öffentliche Tagesordnung</h3><ol><li>1. Bauantrag Kita</li><li>2. Haushalt 2027</li></ol><h2>Bauausschuss</h2><p>Termin: 21.10.2026, 18:00 Uhr</p><p>Ort: Rathaus, Sitzungssaal</p><h3>Öffentliche Tagesordnung</h3><ol><li>1. Bauvoranfrage Hofstelle</li><li>2. Antrag Dachgaube</li><li>3. Neubau Lagerhalle Gewerbegebiet</li><li>4. Abbruch Scheune Ortsmitte</li></ol>',{expect:[['Bauantrag Kita','2026-10-14','Gemeinderat'],['Haushalt','2026-10-14','Gemeinderat'],['Bauvoranfrage','2026-10-21','Bauausschuss'],['Antrag Dachgaube','2026-10-21','Bauausschuss'],['Neubau','2026-10-21','Bauausschuss'],['Abbruch','2026-10-21','Bauausschuss']]}),
 r2html('r2-termine-pipe-headers',TERMINE+'<h3>Gemeinderat | Mittwoch 14.10.2026 | 19:00 Uhr</h3><p>Öffentliche Tagesordnung</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p><h3>Bauausschuss | Mittwoch 21.10.2026 | 18:00 Uhr</h3><p>Öffentliche Tagesordnung</p><p>3. Bauvoranfrage Hofstelle<br>4. Abbruch Scheune</p>',{expect:[['Bauantrag Kita','2026-10-14','Gemeinderat'],['Haushalt','2026-10-14','Gemeinderat'],['Bauvoranfrage','2026-10-21','Bauausschuss'],['Abbruch','2026-10-21','Bauausschuss']]}),
 r2html('r2-termine-second-without-evidence',TERMINE+'<h2>Bauausschuss</h2><p>Termin: 21.10.2026, 18:00 Uhr</p><h3>Tagesordnung – öffentlich</h3><p>1. Bauvoranfrage Hofstelle<br>2. Antrag Dachgaube</p><h2>Gemeinderat</h2><p>Termin: 14.10.2026, 19:00 Uhr</p><p>Tagesordnung:</p><p>3. Vergabe Bauleistungen Kita<br>4. Personalangelegenheit</p>',{forbid:[...NP,'Vergabe Bauleistungen'],expect:[['Bauvoranfrage','2026-10-21','Bauausschuss'],['Antrag Dachgaube','2026-10-21','Bauausschuss']]}),
 r2html('r2-calendar-program','<h1>Veranstaltungskalender Oktober</h1><div class=event><h3>Mi, 14.10.2026, 19:00 Uhr | Öffentliche Sitzung des Gemeinderates</h3><p>Tagesordnung:</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p></div><div class=event><h3>Do, 15.10.2026, 14:00 Uhr | Seniorennachmittag im Pfarrheim</h3><p>Programm:</p><p>1. Kaffee und Kuchen<br>2. Lichtbildervortrag Heimatverein<br>3. Vortrag der Polizei zum Enkeltrick<br>4. Gemeinsames Singen</p></div>',{forbid:['Kaffee','Lichtbild','Polizei','Singen'],allow:['Bauantrag Kita','Haushalt 2027'],date:'2026-10-14'}),
 r2html('r2-termine-list-before-agenda','<h1>Gemeinderat</h1><h2>Sitzungstermine 2026</h2><ul><li>Sitzung am Mittwoch, 16.09.2026, 19:00 Uhr</li><li>Sitzung am Mittwoch, 14.10.2026, 19:00 Uhr</li><li>Sitzung am Mittwoch, 11.11.2026, 19:00 Uhr</li></ul><h2>Tagesordnung der öffentlichen Sitzung am 14.10.2026</h2><p>1. Bauantrag Kita<br>2. Haushalt 2027</p>',{label:'Gemeinderat',date:'2026-10-14'}),
 // persons in lists of minutes
 ...[['persons-feuerwehr','<p>1. Bauantrag Kita</p><p>Das Einvernehmen wird einstimmig erteilt.</p><p>2. Bestätigung der Feuerwehrführung</p><p>Die Feuerwehrversammlung hat gewählt:</p><p>1. Feuerwehrkommandant Hans Huber<br>2. Stellvertreter Max Probe<br>3. Kassierer Tim Test<br>4. Jugendwart Paul Beispiel</p><p>Der Gemeinderat bestätigt die Wahl einstimmig.</p>',['Bauantrag Kita','Bestätigung der Feuerwehrführung']],
  ['persons-ehrung','<p>1. Ehrungen</p><p>Für 25 Jahre Mitgliedschaft im Gemeinderat wurden geehrt:</p><p>2. Bürgermeister a. D. Fritz Alt<br>3. Altbürgermeister Fritz Alt<br>4. Gemeinderat a. D. Hans Huber</p>',['Ehrungen']],
  ['persons-ausschussbesetzung','<p>1. Besetzung der Ausschüsse</p><p>Der Gemeinderat beschließt folgende Besetzung des Bauausschusses:</p><p>2. Vorsitz: Bürgermeister Max Muster</p><p>3. Mitglied: GR Hans Huber, Vertreter: GR Tim Test</p><p>4. Mitglied: GRin Eva Beispiel, Vertreterin: GR Paul Probe</p>',['Besetzung der Ausschüsse']]].map(([k,body,allow])=>({id:`r2-${k}`,round:'r2',doc:'html',label:'Niederschrift Gemeinderat 16.09.2026',text:page(`<h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 16.09.2026</h1>${body}`),forbid:['Huber','Probe','Test','Beispiel','Alt','Muster'],allow,date:'2026-09-16'})),
 {id:'r2-persons-entsandt',round:'r2',doc:'pdf',label:'Niederschrift Gemeinderat 16.09.2026',text:`Niederschrift über die öffentliche Sitzung des Gemeinderates
am Mittwoch, 16.09.2026, 19:00 Uhr
1. Neubesetzung des Bauausschusses
In den Bauausschuss werden entsandt:
1. Herr Hans Maier
2. Frau Erika Huber
3. Herr Karl Muster
4. Frau Anna Probe
2. Bauantrag Carport
Beschluss: Das Einvernehmen wird erteilt. Abstimmung: 12:0`,forbid:['Maier','Huber','Muster','Probe'],allow:['Neubesetzung des Bauausschusses','Bauantrag Carport'],date:'2026-09-16'},
 // Verbandsgemeinde and other Ortsgemeinde on a member's site
 {id:'r2-vg-verwaltung-issuer',round:'r2',doc:'html',label:'Sitzung Haupt- und Finanzausschuss 14.10.2026',source:{name:'Ortsgemeinde Musterbach'},text:page('<p>Verbandsgemeindeverwaltung Musterland</p><h1>Einladung zur Sitzung des Haupt- und Finanzausschusses</h1><p>am Mittwoch, 14.10.2026, 18:00 Uhr, im Sitzungssaal der Verwaltung.</p><p>Öffentliche Tagesordnung:</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p>'),collectAllow:[]},
 {id:'r2-ortsgemeinderat-other-html',round:'r2',doc:'html',label:'Sitzung Ortsgemeinderat 14.10.2026',source:{name:'Ortsgemeinde Musterbach'},text:page('<h1>Öffentliche Sitzung des Ortsgemeinderates Nachbarhausen</h1><p>am Mittwoch, 14.10.2026, 19:00 Uhr, im Dorfgemeinschaftshaus.</p><p>Öffentliche Tagesordnung:</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p>'),collectAllow:[]},
 // ÖT/NÖT
 {id:'r2-noet-pdf',round:'r2',doc:'pdf',label:EINL,text:`Gemeinde Musterbach
Einladung
zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:00 Uhr
im Sitzungssaal des Rathauses. Die Sitzung ist öffentlich.
Tagesordnung
ÖT
1. Bauantrag Carport
2. Haushalt 2027
NÖT
3. Grundstücksangelegenheit Flurstück 412
4. Personalangelegenheit
${SIGN}`,forbid:[...NP,'NÖT'],allow:['Bauantrag Carport','Haushalt 2027'],date:'2026-10-14'},
 ...['<h2>Tagesordnung ÖT</h2>|<h2>Tagesordnung NÖT</h2>','<h3>ÖT:</h3>|<h3>NÖT:</h3>','<h3>Öffentlicher Teil</h3>|<h3>ÖT / NÖT</h3>'].map((pair,n)=>{const [a,b]=pair.split('|');return r2html(`r2-noet-html-${n+1}`,`<h1>Sitzung des Gemeinderates am 14.10.2026</h1><p>Am Mittwoch, 14.10.2026, 19:00 Uhr, findet im Rathaus eine öffentliche Sitzung des Gemeinderates statt.</p>${a}<p>1. Bauantrag Carport<br>2. Haushalt 2027</p>${b}<p>3. Grundstücksangelegenheit Flurstück 412<br>4. Personalangelegenheit</p>`,{allow:['Bauantrag Carport','Haushalt 2027']});}),
 {id:'r2-noet-after-public-heading',round:'r2',doc:'pdf',label:'Tagesordnung Gemeinderat 14.10.2026',text:`Tagesordnung
für die Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:00 Uhr
Öffentlicher Teil
1. Bauantrag Carport
2. Haushalt 2027
NÖT
3. Grundstücksangelegenheit Flurstück 412`,forbid:[...NP,'NÖT'],allow:['Bauantrag Carport','Haushalt 2027']},
 // a meeting expressly not public
 r2html('r2-keiner-oeffentlichen','<h1>Einladung zur Sitzung des Ältestenrates</h1><p>Mittwoch, 14.10.2026, 18:00 Uhr, Besprechungsraum Rathaus</p><p>Der Ältestenrat tagt in keiner öffentlichen Sitzung.</p><p>Tagesordnung</p><p>1. Personalangelegenheit Bauhof<br>2. Grundstücksangelegenheit Lindenweg</p>',{label:'Einladung Ältestenrat 14.10.2026',allow:[]}),
 r2html('r2-nicht-in-oeffentlicher','<h1>Einladung zur Sitzung des Bauausschusses</h1><p>am Mittwoch, 14.10.2026, 18:00 Uhr. Die Beratung erfolgt nicht in öffentlicher Sitzung.</p><p>Tagesordnung</p><p>1. Personalangelegenheit Bauhof<br>2. Grundstücksangelegenheit Lindenweg</p>',{label:'Einladung Bauausschuss 14.10.2026',allow:[]}),
 r2html('r2-field-dl-nein','<h1>Sitzung des Hauptausschusses</h1><dl><dt>Datum</dt><dd>Mittwoch, 14.10.2026, 18:00 Uhr</dd><dt>Öffentliche Sitzung</dt><dd>nein</dd></dl><h2>Tagesordnung</h2><p>1. Personalangelegenheit Bauhof<br>2. Grundstücksangelegenheit Lindenweg</p>',{label:'Sitzung Hauptausschuss 14.10.2026',allow:[]}),
 r2html('r2-field-table-nein','<h1>Sitzung des Hauptausschusses</h1><table><tr><th>Datum</th><td>Mittwoch, 14.10.2026, 18:00 Uhr</td></tr><tr><th>Öffentliche Sitzung</th><td>Nein</td></tr></table><h2>Tagesordnung</h2><p>1. Personalangelegenheit Bauhof<br>2. Grundstücksangelegenheit Lindenweg</p>',{label:'Sitzung Hauptausschuss 14.10.2026',allow:[]}),
 // minutes repeating the agenda, the item marked at its report
 {id:'r2-minutes-repeat-marked',round:'r2',doc:'pdf',label:'Niederschrift Gemeinderat 16.09.2026',text:`Niederschrift über die öffentliche Sitzung des Gemeinderates
am Mittwoch, 16.09.2026, 19:00 Uhr
Tagesordnung
1. Genehmigung der Niederschrift
2. Vergabe Straßenbeleuchtung
3. Bauantrag Carport Fl.Nr. 210
4. Grundstücksangelegenheit Flurstück 412
1. Genehmigung der Niederschrift
Die Niederschrift wird genehmigt. Abstimmung: 12:0
2. Vergabe Straßenbeleuchtung
Der Gemeinderat beschließt die Vergabe an die Firma Licht GmbH. Abstimmung: 11:1
3. Bauantrag Carport Fl.Nr. 210
Das Einvernehmen wird erteilt. Abstimmung: 12:0
4. Grundstücksangelegenheit Flurstück 412
Der Punkt wurde in nichtöffentlicher Sitzung behandelt.`,forbid:['Flurstück 412'],date:'2026-09-16'},
 // a gazette of a Verwaltungsgemeinschaft: sections of other member municipalities
 ...['Bekanntmachungen der Gemeinde Bdorf','Amtliche Bekanntmachungen der Gemeinde Bdorf','Mitgliedsgemeinde Bdorf','Aus der Gemeinde Bdorf','BDORF','Bdorf'].map((sec,n)=>({id:`r2-vg-gazette-section-${n+1}`,round:'r2',doc:'pdf',label:'Amtsblatt Nr. 40/2026 mit Tagesordnung Gemeinderat',text:GAZ_VG(sec),collectAllow:[]})),
 // a county's gazette with notices of its towns
 {id:'r2-county-gazette-stadtrat',round:'r2',doc:'pdf',label:'Amtsblatt Nr. 40/2026 Sitzung Stadtrat',source:{name:'Landkreis Musterkreis',kind:'district'},text:`Amtsblatt des Landkreises Musterkreis
Nr. 40 vom 02.10.2026
Am Mittwoch, 14.10.2026, 19:30 Uhr findet im Rathaus eine öffentliche Sitzung des Stadtrates statt.
Tagesordnung
1. Bebauungsplan Am Bahnhof
2. Jahresrechnung 2025`,collectAllow:[]},
 {id:'r2-county-gazette-gemeinderat',round:'r2',doc:'pdf',label:'Amtsblatt Nr. 40/2026 Sitzung Gemeinderat',source:{name:'Landkreis Musterkreis',kind:'district'},text:`Amtsblatt des Landkreises Musterkreis
Nr. 40 vom 02.10.2026
Bekanntmachungen kreisangehöriger Gemeinden
Adorf
Öffentliche Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:30 Uhr
Tagesordnung
1. Bauantrag Feuerwehrhaus
2. Jahresrechnung 2025`,collectAllow:[]},
 // associations in an Amt's gazette
 {id:'r2-amt-wasser-bodenverband',round:'r2',doc:'pdf',label:'Amtsblatt Nr. 10/2026 Sitzung Verbandsversammlung',source:{name:'Amt Musterland'},text:`Amtsblatt für das Amt Musterland
Jahrgang 2026 Nr. 10
Wasser- und Bodenverband Musterniederung
Einladung zur Sitzung der Verbandsversammlung
am Dienstag, 20.10.2026, 18:00 Uhr, in der Gaststätte Zur Linde
Die Sitzung ist öffentlich.
Tagesordnung
1. Haushaltsplan 2027 des Verbandes
2. Beitragssatzung Gewässerunterhaltung`,collectAllow:[]},
 {id:'r2-amt-planungsverband',round:'r2',doc:'pdf',label:'Amtsblatt Nr. 10/2026 Sitzung Verbandsversammlung',source:{name:'Amt Musterland'},text:`Amtsblatt für das Amt Musterland
Jahrgang 2026 Nr. 10
Einladung zur Sitzung der Verbandsversammlung des Planungsverbandes Gewerbegebiet Nord
am Dienstag, 20.10.2026, 18:00 Uhr, im Amtsgebäude
Die Sitzung ist öffentlich.
Tagesordnung
1. Haushaltsplan 2027 des Planungsverbandes
2. Erschließung Gewerbegebiet Nord`,collectAllow:[]},
 {id:'r2-amt-verbandsausschuss',round:'r2',doc:'pdf',label:'Amtsblatt Nr. 10/2026 Sitzung Verbandsausschuss',source:{name:'Amt Musterland'},text:`Amtsblatt für das Amt Musterland
Jahrgang 2026 Nr. 10
Bekanntmachung des Wasser- und Bodenverbandes Musterniederung
Am Dienstag, 20.10.2026, 18:00 Uhr findet eine öffentliche Sitzung des Verbandsausschusses statt.
Tagesordnung
1. Gewässerschau 2026
2. Beitragsveranlagung 2027`,collectAllow:[]},
);

feedCases.push(
 {id:'r2-rss-klausur',round:'r2',kind:'rss',title:'Einladung zur Klausurtagung des Gemeinderates',html:'<p>Der Gemeinderat trifft sich am Samstag, 17.10.2026, 9:00 Uhr, im Feuerwehrhaus zu seiner Klausurtagung. Es handelt sich um keine öffentliche Sitzung.</p><p>Tagesordnung:</p><p>1. Haushaltsplanentwurf 2027<br>2. Personalentwicklung der Verwaltung<br>3. Strategie Gewerbeflächen</p>',forbid:['Haushaltsplanentwurf','Personalentwicklung','Strategie']},
 {id:'r2-ics-oeffentlich-nein',round:'r2',kind:'ics',dtstart:'20261021T180000',summary:'Sitzung des Hauptausschusses',description:'Öffentliche Sitzung: nein\\nTagesordnung:\\n1. Stundung von Gewerbesteuer\\n2. Erlass von Forderungen\\n3. Klage gegen Bescheid',forbid:['Stundung','Erlass','Klage']},
);

closedLabels.push('Niederschrift GR 16.09.2026 NÖT','Niederschrift GR 16.09.2026 (nöT)','Niederschrift GR 16.09.2026 (NOeT)','Niederschrift GR 16.09.2026 (geschl.)','Niederschrift GR 16.09.2026 – geheim');
closedPaths.push('/fileadmin/protokolle/2026/GR_16092026_NOeT.pdf','/fileadmin/protokolle/2026/GR_16092026_N%C3%96T.pdf','/fileadmin/protokolle/2026/GR-16.09.2026-n%C3%B6T.pdf','/fileadmin/protokolle/2026/gr-2026-09-16-np.pdf');

// Several documents of one meeting on one list: what one of them puts in the non-public part never comes out of another.
export const multiCases=[
 {id:'r2-invitation-and-minutes',round:'r2',docs:[
  {path:'fileadmin/einladung-gr-2026-09-16.pdf',label:'Einladung Gemeinderat 16.09.2026',doc:'pdf',text:`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, 16.09.2026, 19:00 Uhr
Öffentliche Sitzung
1. Genehmigung der Niederschrift
2. Bauantrag Carport Fl.Nr. 210
Nichtöffentliche Sitzung
3. Grundstücksangelegenheit Flurstück 412
4. Personalangelegenheit Bauhof`},
  {path:'fileadmin/niederschrift-gr-2026-09-16.pdf',label:'Niederschrift Gemeinderat 16.09.2026',doc:'pdf',text:`Niederschrift über die öffentliche Sitzung des Gemeinderates
am Mittwoch, 16.09.2026
Tagesordnung:
TOP 1 Genehmigung der Niederschrift
TOP 2 Bauantrag Carport Fl.Nr. 210
TOP 3 Grundstücksangelegenheit Flurstück 412
TOP 4 Personalangelegenheit Bauhof
Zu TOP 1: Die Niederschrift wird genehmigt. Abstimmung: 12:0
Zu TOP 2: Das Einvernehmen wird erteilt. Abstimmung: 12:0`}],forbid:['Flurstück 412','Personalangelegenheit']},
 {id:'r2-html-lock-and-pdf',round:'r2',docs:[
  {path:'rathaus/sitzungen/gr-2026-10-14.html',label:'Sitzung Gemeinderat 14.10.2026',doc:'html',text:page('<h1>Sitzung des Gemeinderates</h1><p>Mittwoch, 14.10.2026, 19:00 Uhr, Sitzungssaal. Die Sitzung ist öffentlich.</p><table><tr><td>1</td><td>Bauantrag Carport</td><td></td></tr><tr><td>2</td><td>Haushalt 2027</td><td></td></tr><tr><td>3</td><td>Grundstücksangelegenheit Flurstück 412</td><td><img src="/typo3conf/ext/sitzung/Resources/Public/Icons/lock_closed.gif"></td></tr></table>')},
  {path:'fileadmin/einladung-gr-2026-10-14.pdf',label:'Einladung Gemeinderat 14.10.2026',doc:'pdf',text:`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:00 Uhr
Öffentlicher Teil
1. Bauantrag Carport
2. Haushalt 2027
Nichtöffentlicher Teil
3. Grundstücksangelegenheit Flurstück 412`}],forbid:['Flurstück 412']},
];
// Redirect targets that name the non-public part: never fetched.
export const closedRedirects=['fileadmin/protokolle/GR_2026-09-16_NOeT.pdf','fileadmin/protokolle/GR_2026-09-16_N%C3%96T.pdf','fileadmin/protokolle/gr-2026-09-16-geheim.pdf'];

// Round 2, found while repairing: the same causes in other forms.
cases.push(
 r2pdf('r2-note-split-over-page',`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
3. Grundstücksangelegenheit
4. Personalangelegenheit
Die Öffentlichkeit soll bei Tagesordnungspunkt 3 und 4 aus-
Gemeinde Musterbach – Einladung Gemeinderat
geschlossen werden.`,{allow:GNK}),
 r2pdf('r2-note-quotes-last-item',`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
3. Grundstücksangelegenheit
4. Personalangelegenheit
Zu „Personalangelegenheit“: Beratung unter Ausschluss der Öffentlichkeit.`,{forbid:['Personal']}),
 r2pdf('r2-noet-mojibake',`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
NÃ–T
3. Grundstücksangelegenheit`,{allow:GNK}),
 r2html('r2-calendar-same-day','<h1>Veranstaltungen</h1><h3>Mi, 14.10.2026, 19:00 Uhr | Öffentliche Sitzung des Gemeinderates</h3><p>1. Bauantrag Kita<br>2. Haushalt 2027</p><h3>Mi, 14.10.2026, 15:00 Uhr | Seniorennachmittag</h3><p>3. Kaffee und Kuchen<br>4. Vortrag der Polizei</p>',{forbid:['Kaffee','Polizei','Senioren'],allow:['Bauantrag Kita','Haushalt 2027']}),
 r2html('r2-list-then-parts','<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026</h1><ol><li>1. Bauantrag Kita</li><li>2. Haushalt 2027</li><li>3. Grundstücksangelegenheit Lindenweg</li></ol><h2>Nichtöffentlicher Teil</h2><p>3. Grundstücksangelegenheit Lindenweg</p>',{forbid:[...NP,'Lindenweg'],allow:['Bauantrag Kita','Haushalt 2027']}),
);

// --- round 3 -----------------------------------------------------------------------------------------------------------
const MB_INV=`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19.00 Uhr, im Sitzungssaal des Rathauses.`;
const FIVE=`Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Kita
3. Haushalt 2027
4. Grundstücksverkauf Fl.Nr. 412
5. Personalangelegenheit Bauhof`;
const r3pdf=(id,text,more={})=>({id,round:'r3',doc:'pdf',label:'Bekanntmachung Sitzung Gemeinderat 14.10.2026',text,forbid:NP,date:'2026-10-14',...more});
const r3html=(id,main,more={})=>({id,round:'r3',doc:'html',label:'Öffentliche Sitzung des Gemeinderates am 14.10.2026',text:page(main),forbid:NP,...more});
const H1R3='<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1>';
const NIED_H1='<h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 16.09.2026</h1>';
const nied3=(id,main,more={})=>({id,round:'r3',doc:'html',label:'Niederschrift Gemeinderat 16.09.2026',text:page(NIED_H1+main),now:'2026-10-04',date:'2026-09-16',...more});
const PERSONS=['Huber','Maier','Schmid','Lang','Weber','Fischer','Kommandant','Wart','Kassier','Spenden','Ortssprecher','Kämmerer','Bauamtsleiter','beauftragt','von Berg','de Vries'];

cases.push(
 // the head names the public items or the others by number, without the word "nichtöffentlich"
 ...['Die Sitzung ist öffentlich mit Ausnahme der Tagesordnungspunkte 4 und 5.','Die Sitzung ist öffentlich, ausgenommen TOP 4 und 5.','Die Sitzung ist öffentlich (TOP 1 bis 3).',
  'Die Sitzung ist öffentlich bis TOP 3.','Öffentliche Sitzung: TOP 1–3','Die Sitzung ist öffentlich, die Punkte 4 und 5 sind es nicht.'].map((s,n)=>r3pdf(`r3-head-numbers-${n+1}`,`${MB_INV}
${s}
${FIVE}`,{label:'Einladung Gemeinderat',allow:['Genehmigung der Niederschrift','Bauantrag Kita','Haushalt 2027']})),
 // a note after the agenda that names an item by another word
 ...[['3. Erwerb einer Teilfläche aus Fl.Nr. 412\n4. Anfragen','Die Grundstücksangelegenheit wird nichtöffentlich beraten.','Erwerb'],
  ['2. Veräußerung des ehemaligen Schulhauses\n3. Bauantrag Kita\n4. Anfragen','Der Verkauf wird in nichtöffentlicher Sitzung behandelt.','Veräußerung'],
  ['3. Stellenbesetzung Leitung Bauhof\n4. Anfragen','(Die Personalangelegenheit wird nichtöffentlich beraten)','Stellenbesetzung']].map(([items,note,word],n)=>r3pdf(`r3-note-synonym-${n+1}`,`${MB_HEAD}
1. Genehmigung der Niederschrift
${n===1?'':'2. Bauantrag Kita\n'}${items}
${note}`,{forbid:[...NP,word]})),
 // "Nicht-öffent-" / footer and head of the next page / "liche Sitzung"
 r3pdf('r3-hyphen-over-long-footer',`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
Nicht-öffent-
Gemeinde Musterbach · Hauptstraße 1 · 91234 Musterbach
Telefon 09123 4567-0 · Telefax 09123 4567-99
E-Mail: poststelle@musterbach.de · www.musterbach.de
Sparkasse Musterkreis IBAN DE12 7605 0101 0000 1234 56
Raiffeisenbank Oberland IBAN DE34 7606 9559 0000 6543 21
Seite 1 von 2
Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am 14.10.2026
liche Sitzung
3. Grundstücksverkauf Fl.Nr. 412
4. Personalangelegenheit`,{forbid:[...NP,'Telefax','öffent'],allow:GNK}),
 // a narrow column "nicht-/öffent-/lich" wrapped with the title
 r3pdf('r3-column-wrapped-with-title',`${MB_HEAD}
1 Genehmigung der Niederschrift
2 Bauantrag Kita
3 Grundstücksangele- nicht-
genheit Fl.Nr. 412 öffent-
lich
4 Personalangele- nicht-
genheit öffent-
lich`,{allow:GNK}),
 // the Ö/N column drawn before the rows
 r3pdf('r3-column-before-rows',`${MB_HEAD}
Ö
Ö
N
N
1 Genehmigung der Niederschrift
2 Bauantrag Kita
3 Grundstücksverkauf Fl.Nr. 412
4 Personalangelegenheit`,{allow:GNK}),
 // a footnote digit after a plot number, its note read as item "1"
 ...['3. Grundstücksverkauf Fl.Nr. 4121','3. Grundstücksverkauf Fl.Nr. 412 1'].map((l,n)=>r3pdf(`r3-footnote-after-plot-${n+1}`,`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
${l}
4. Anfragen
1 Beratung voraussichtlich nichtöffentlich`,{allow:GNK})),
 // a gazette whose next text frame (non-public items of the council) follows another notice
 {id:'r3-gazette-frame-after-other-notice',round:'r3',doc:'pdf',label:'Mitteilungsblatt Nr. 41/2026 (Bekanntmachungen, Sitzungen)',text:`Mitteilungsblatt der Gemeinde Musterbach
Freitag, 9. Oktober 2026 Nr. 41
Amtliche Bekanntmachungen
Öffentliche Sitzung des Gemeinderates
am Mittwoch, 14.10.2026, 19.00 Uhr, im Rathaus
Tagesordnung
1. Bauantrag Kita
2. Haushalt 2027
3. Anfragen
Nichtöffentlicher Teil
Öffentliche Sitzung des Bauausschusses
am Dienstag, 20.10.2026, 18.00 Uhr, im Rathaus
Tagesordnung
1. Bauantrag Carport Fl.Nr. 12
2. Bauantrag Garage Fl.Nr. 14
4. Grundstücksverkauf Fl.Nr. 412 an Fa. Bau GmbH
5. Personalangelegenheit Bauhof`,forbid:[...NP,'Bau GmbH'],expect:[['Bauantrag Kita','2026-10-14','Gemeinderat'],['Bauantrag Carport','2026-10-20','Bauausschuss']]},
 {id:'r3-gazette-frame-member-np',round:'r3',doc:'pdf',label:'Mitteilungsblatt Nr. 41/2026 (Bekanntmachungen, Sitzungen)',text:`Mitteilungsblatt der Verwaltungsgemeinschaft Oberland
Freitag, 9. Oktober 2026 Nr. 41
Amtliche Bekanntmachungen
Gemeinde Musterbach
Öffentliche Sitzung des Gemeinderates
am Mittwoch, 14.10.2026, 19.00 Uhr, im Rathaus Musterbach
Tagesordnung
1. Bauantrag Kita
2. Haushalt 2027
Gemeinde Nachbarhausen
Öffentliche Sitzung des Gemeinderates
am Donnerstag, 15.10.2026, 19.30 Uhr, im Feuerwehrhaus
Tagesordnung
1. Feuerwehrbedarfsplan
2. Vergabe Friedhofsmauer
3. Anfragen
Nichtöffentlicher Teil
4. Personalangelegenheit Leitung Kindergarten
5. Vertragsangelegenheit Fa. Bau GmbH`,forbid:[...NP,'Vertrag'],collectForbid:['Feuerwehr','Friedhof','Anfragen']},
 // a Verwaltungsgemeinschaft gives notice of the councils of two members meeting the same evening
 ...['',`
Nichtöffentlicher Teil
4. Grundstücksangelegenheit Nachbarhausen`].map((np,n)=>({id:`r3-vg-members-same-evening-${n+1}`,round:'r3',doc:'pdf',label:'Bekanntmachung Sitzungen Gemeinderäte 14.10.2026',text:`Verwaltungsgemeinschaft Oberland
Bekanntmachung
Sitzungen der Gemeinderäte der Mitgliedsgemeinden
Gemeinde Musterbach
Öffentliche Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 18.00 Uhr, Rathaus Musterbach
Tagesordnung
1. Bauantrag Kita
2. Haushalt 2027
Gemeinde Nachbarhausen
Öffentliche Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19.30 Uhr, Feuerwehrhaus Nachbarhausen
Tagesordnung
1. Bauantrag Garage Fl.Nr. 77
2. Feuerwehrbedarfsplan
3. Vergabe Friedhofsmauer${np}`,forbid:NP,collectForbid:['Garage','Feuerwehr','Friedhof'],date:'2026-10-14'})),
 // the town that gives notice is named only below the agenda
 {id:'r3-ortsgemeinde-in-signature',round:'r3',doc:'pdf',label:'Bekanntmachung Sitzung Ortsgemeinderat Nachbarhausen',source:{name:'Ortsgemeinde Musterbach'},text:`Öffentliche Bekanntmachung
Am Donnerstag, 15.10.2026, 19:30 Uhr, findet im Dorfgemeinschaftshaus eine öffentliche Sitzung des Ortsgemeinderates statt.
Tagesordnung:
1. Einwohnerfragestunde
2. Ausbau der Hauptstraße
3. Haushalt 2027
Nachbarhausen, 07.10.2026
Ortsgemeinde Nachbarhausen
Max Muster, Ortsbürgermeister`,collectAllow:[]},
 {id:'r3-gemeinde-in-signature-by',round:'r3',doc:'pdf',label:'Bekanntmachung Sitzung Gemeinderat 15.10.2026',text:`Bekanntmachung
Am Donnerstag, 15.10.2026, 19:30 Uhr, findet im Sitzungssaal eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung:
1. Bauantrag Garage Fl.Nr. 77
2. Feuerwehrbedarfsplan
gez. Max Muster
Erster Bürgermeister der Gemeinde Nachbarhausen`,collectAllow:[]},
 // the date of the letter on the line of the subject
 ...[['Einladung zur Sitzung des Gemeinderates Datum: 07.10.2026','Termin: 14.10.2026\nOrt: Rathaus, Sitzungssaal\nBeginn: 19.00 Uhr\nDie Sitzung ist öffentlich.'],
  ['Öffentliche Sitzung des Gemeinderates Musterbach, den 7. Oktober 2026','Sitzungstag: 14.10.2026'],
  ['Öffentliche Sitzung des Gemeinderates Musterbach, 07.10.2026','am 14.10.2026 im Rathaus, Großer Sitzungssaal']].map(([a,b],n)=>r3pdf(`r3-letter-date-on-subject-${n+1}`,`Gemeinde Musterbach
${a}
${b}
Tagesordnung
1. Bauantrag Kita
2. Haushalt 2027`,{label:'Einladung Gemeinderat'})),
 // lists of those present with an introduction in other words
 ...['Folgende Gemeinderatsmitglieder waren anwesend:','Von den Gemeinderatsmitgliedern waren anwesend:','Vom Gemeinderat waren anwesend:','Zur Sitzung erschienen:','Es nahmen teil:','Teilgenommen haben:',
  'Der Sitzung wohnten bei:','Ordnungsgemäß geladen und erschienen:','Beschlussfähigkeit: anwesend sind','Vorsitzender: 1. Bürgermeister Hans Huber'].map((intro,n)=>({id:`r3-attendance-intro-${n+1}`,round:'r3',doc:'pdf',label:'Niederschrift Gemeinderat',now:'2026-10-04',date:'2026-09-16',text:`Gemeinde Musterbach
Niederschrift über die öffentliche Sitzung des Gemeinderates
am Mittwoch, 16.09.2026, 19.00 Uhr
${intro}
1. Huber Josef
2. Maier Anna
3. Schmid Peter
1. Eröffnung und Begrüßung
Der Bürgermeister eröffnet die Sitzung.
2. Bauantrag Kita
Beschluss: Der Gemeinderat stimmt zu. Abstimmung: 12:0`,forbid:['Huber','Maier','Schmid']})),
 // the paragraph with a Roman number, the rules of procedure, "geheim"; rare headings
 ...['(Art. 52 II GO)','(§ 21 Nr. 3 GeschO)','(geheim)','(§ 35 I GemO)'].map((m,n)=>r3pdf(`r3-item-law-${n+1}`,`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
3. Grundstücksverkauf Fl.Nr. 412 ${m}
4. Personalangelegenheit ${m}`,{allow:GNK})),
 ...['Geheime Sitzung','Sitzung hinter geschlossenen Türen','Nichtöffentiiche Sitzung','NichtöffentIiche Sitzung','Nicht öffentiich','Nichtöentliche Sitzung'].map((h,n)=>r3pdf(`r3-heading-rare-pdf-${n+1}`,`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
${h}
3. Grundstücksverkauf Fl.Nr. 412
4. Personalangelegenheit`,{allow:GNK})),
 // the mark glued to the title
 r3pdf('r3-mark-glued',`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
3. Grundstücksverkauf Fl.Nr. 412N
4. PersonalangelegenheitN`,{allow:GNK}),
 // HTML: headings and marks in other words
 ...['Unter Ausschluss von Presse und Öffentlichkeit','Beratung unter Ausschluss der Presse und der Öffentlichkeit','Fortsetzung ohne Publikum','Unter Ausschluss der Zuhörer','Geheime Sitzung',
  'Beratung hinter verschlossenen Türen','Nur für Ratsmitglieder','Nur für Gemeinderatsmitglieder'].map((h,n)=>r3html(`r3-html-heading-${n+1}`,`${H1R3}<p>1. Bauantrag Kita<br>2. Haushalt 2027</p><h2>${h}</h2><p>3. Grundstücksangelegenheit Fl.Nr. 412<br>4. Personalangelegenheit</p>`,{allow:KITA})),
 ...['(unter Ausschluss d. Ö.)','(unter Ausschl. Öffentlichkeit)','(Ausschluss Öff.)','(o. Öff.)','– wird intern beraten','(geschlossen)','(geheim)','(gem. § 7 Abs. 2 GeschO)'].map((m,n)=>r3html(`r3-html-item-mark-${n+1}`,`${H1R3}<p>1. Bauantrag Kita<br>2. Haushalt 2027<br>3. Grundstücksangelegenheit ${m}<br>4. Personalangelegenheit ${m}</p>`,{allow:KITA})),
 r3html('r3-html-head-not-admitted',`${H1R3}<p>Zu den Tagesordnungspunkten 3 und 4 ist die Öffentlichkeit nicht zugelassen.</p><p>1. Bauantrag Kita<br>2. Haushalt 2027<br>3. Grundstücksangelegenheit<br>4. Personalangelegenheit</p>`,{allow:KITA}),
 {id:'r3-html-report-hall-cleared',round:'r3',doc:'html',label:'Bericht aus der Gemeinderatssitzung vom 14.10.2026',now:'2026-10-20',text:page('<article><h1>Bericht aus der Gemeinderatssitzung vom 14.10.2026</h1><p>In öffentlicher Sitzung wurden behandelt:</p><p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p><p>Danach mussten die Zuhörer den Sitzungssaal räumen.</p><p>3. Grundstücksangelegenheit Am Mühlbach</p><p>4. Personalangelegenheit</p></article>'),forbid:[...NP,'Mühlbach'],allow:KITA},
 ...[['zugelassen','zugelassen','ausgeschlossen'],['gegeben','gegeben','ausgeschl.']].map(([a,b,c],n)=>r3html(`r3-html-column-access-${n+1}`,`${H1R3}<table><tr><th>Nr.</th><th>Gegenstand</th><th>Öffentlichkeit</th></tr><tr><td>1</td><td>Bauantrag Kita</td><td>${a}</td></tr><tr><td>2</td><td>Haushalt 2027</td><td>${b}</td></tr><tr><td>3</td><td>Grundstücksangelegenheit</td><td>${c}</td></tr></table>`,{forbid:[...NP,'ausgeschl']})),
 // HTML5 section heads without main
 {id:'r3-html-section-header-no-main',round:'r3',doc:'html',label:'Öffentliche Sitzung des Gemeinderates am 14.10.2026',text:'<html><body><article><header><h1>Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1></header><section><header><h2>Teil A</h2></header><p>TOP 1 Bauantrag Kita</p><p>TOP 2 Haushalt 2027</p></section><section><header><h2>Teil B</h2></header><p>TOP 3 Grundstücksangelegenheit</p><p>TOP 4 Personalangelegenheit</p></section></article></body></html>',forbid:NP,allow:KITA},
 {id:'r3-html-div-header-second-part',round:'r3',doc:'html',label:'Gemeinderatssitzung am 14.10.2026',text:'<html><body><div class="content"><header><h1>Gemeinderatssitzung am 14.10.2026, 19:00 Uhr</h1></header><p>Die Sitzung ist öffentlich.</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p><header><h3>Zweiter Teil</h3></header><p>3. Grundstücksangelegenheit<br>4. Personalangelegenheit</p></div></body></html>',forbid:NP,allow:KITA},
 // several meetings on one page: heads without body, without session word, a preview, a look back, a calendar
 {id:'r3-decisions-two-sessions',round:'r3',doc:'html',label:'Beschlüsse des Gemeinderates',now:'2026-10-20',text:page('<h1>Beschlüsse des Gemeinderates</h1><h2>Öffentliche Sitzung vom 14.10.2026</h2><p>1. Bauantrag Kita</p><p>Der Gemeinderat stimmt zu. Abstimmung: 12:0</p><p>2. Haushalt 2027</p><p>Zur Kenntnis genommen.</p><h2>Öffentliche Sitzung vom 16.09.2026</h2><p>1. Friedhofssatzung</p><p>Beschlossen, 11:1</p><p>2. Straßenausbau Bergweg</p><p>Beschlossen, 12:0</p><p>3. Feuerwehrbedarfsplan</p><p>Beschlossen, 12:0</p><p>4. Vergabe Winterdienst</p><p>Beschlossen, 12:0</p>'),expect:[['Bauantrag Kita','2026-10-14','Gemeinderat'],['Haushalt','2026-10-14','Gemeinderat'],['Friedhof','2026-09-16','Gemeinderat'],['Straßenausbau','2026-09-16','Gemeinderat'],['Feuerwehr','2026-09-16','Gemeinderat'],['Vergabe Winterdienst','2026-09-16','Gemeinderat']]},
 {id:'r3-decisions-two-sessions-colon',round:'r3',doc:'html',label:'Beschlüsse des Gemeinderates',now:'2026-10-20',text:page('<h1>Beschlüsse des Gemeinderates</h1><p>Aus der öffentlichen Sitzung am 14. Oktober 2026:</p><p>1. Bauantrag Kita – beschlossen</p><p>2. Haushalt 2027 – zur Kenntnis genommen</p><p>Aus der öffentlichen Sitzung am 16. September 2026:</p><p>1. Friedhofssatzung – beschlossen</p><p>2. Straßenausbau Bergweg – beschlossen</p><p>3. Feuerwehrbedarfsplan – beschlossen</p>'),expect:[['Bauantrag Kita','2026-10-14','Gemeinderat'],['Friedhof','2026-09-16','Gemeinderat'],['Straßenausbau','2026-09-16','Gemeinderat'],['Feuerwehr','2026-09-16','Gemeinderat']]},
 {id:'r3-report-committees',round:'r3',doc:'html',label:'Bericht aus den Ausschüssen',now:'2026-10-20',text:page('<h1>Bericht aus den Ausschüssen</h1><h2>Bauausschuss vom 06.10.2026</h2><p>In öffentlicher Sitzung wurden behandelt:</p><p>1. Bauantrag Garage<br>Einvernehmen erteilt.</p><p>2. Bauvoranfrage Fl.Nr. 12<br>Einvernehmen erteilt.</p><h2>Hauptausschuss vom 29.09.2026</h2><p>1. Vergabe Winterdienst<br>Beschlossen.</p><p>2. Feuerwehrbedarfsplan<br>Beschlossen.</p><p>3. Kindergartengebühren<br>Beschlossen.</p>'),expect:[['Bauantrag Garage','2026-10-06','Bauausschuss'],['Bauvoranfrage','2026-10-06','Bauausschuss'],['Vergabe Winterdienst','2026-09-29','Hauptausschuss'],['Feuerwehr','2026-09-29','Hauptausschuss'],['Kindergarten','2026-09-29','Hauptausschuss']]},
 {id:'r3-report-preview',round:'r3',doc:'html',label:'Aus dem Gemeinderat',now:'2026-10-20',text:page('<article><p class="date">20.10.2026</p><h1>Aus dem Gemeinderat</h1><p>Bericht aus der öffentlichen Sitzung des Gemeinderates vom 14.10.2026</p><p>1. Bauantrag Kita</p><p>Der Gemeinderat erteilte das Einvernehmen einstimmig.</p><p>2. Haushalt 2027</p><p>Der Entwurf wurde zur Kenntnis genommen.</p><h2>Vorschau</h2><p>Die nächste Sitzung des Gemeinderates findet am Mittwoch, 11.11.2026, 19:00 Uhr statt. Auf der Tagesordnung stehen unter anderem:</p><p>1. Haushalt 2027 – Beratung<br>2. Bauantrag Kita – Nachtrag<br>3. Friedhofssatzung<br>4. Erlass einer Hundesteuersatzung</p></article>'),forbid:['Friedhof','Hundesteuer','Nachtrag','– Beratung'],date:'2026-10-14'},
 {id:'r3-report-look-back',round:'r3',doc:'html',label:'Aus dem Gemeinderat',now:'2026-10-20',text:page('<article><h1>Aus dem Gemeinderat</h1><p class="date">Veröffentlicht am 20.10.2026</p><p>In seiner Sitzung am Mittwoch, 14.10.2026, befasste sich der Gemeinderat in öffentlicher Sitzung mit folgenden Themen:</p><p>1. Bauantrag Kita<br>Der Gemeinderat erteilte das Einvernehmen.</p><p>2. Haushalt 2027<br>Der Entwurf wurde vorgestellt.</p><p>Bereits in der Sitzung am Mittwoch, 16.09.2026, hatte der Gemeinderat beschlossen:</p><p>3. Erhöhung der Kindergartengebühren<br>4. Vergabe Winterdienst</p></article>'),forbid:['Kindergarten','Winterdienst'],date:'2026-10-14'},
 {id:'r3-cms-updated-date',round:'r3',doc:'html',label:'Sitzung des Gemeinderates',text:page('<h1>Sitzung des Gemeinderates</h1><p>Datum: 14.10.2026</p><p>Aktualisiert am 07.10.2026, 09:15 Uhr</p><h2>Öffentliche Tagesordnung</h2><p>1. Bauantrag Kita<br>2. Haushalt 2027</p>'),date:'2026-10-14'},
 {id:'r3-calendar-no-weekday',round:'r3',doc:'html',label:'Sitzungstermine Gemeinderat und Ausschüsse',text:page('<h1>Sitzungstermine</h1><div class="event"><h3>14.10.2026</h3><p>Gemeinderat – öffentliche Sitzung</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p></div><div class="event"><h3>21.10.2026</h3><p>Bauausschuss – öffentliche Sitzung</p><p>TOP 1 Bauvoranfrage Fl.Nr. 88<br>TOP 2 Straßensanierung Bergweg</p></div>'),expect:[['Bauantrag Kita','2026-10-14','Gemeinderat'],['Haushalt','2026-10-14','Gemeinderat'],['Bauvoranfrage','2026-10-21','Bauausschuss'],['Straßensanierung','2026-10-21','Bauausschuss']]},
 {id:'r3-calendar-first-without-agenda',round:'r3',doc:'html',label:'Sitzungstermine Gemeinderat und Ausschüsse',text:page('<h1>Sitzungstermine</h1><div class="event"><h3>14.10.2026</h3><p>Gemeinderat – öffentliche Sitzung</p><p>Die Tagesordnung wird rechtzeitig bekanntgegeben.</p></div><div class="event"><h3>21.10.2026</h3><p>Bauausschuss – öffentliche Sitzung</p><p>1. Bauvoranfrage Fl.Nr. 88<br>2. Straßensanierung Bergweg</p></div>'),expect:[['Bauvoranfrage','2026-10-21','Bauausschuss'],['Straßensanierung','2026-10-21','Bauausschuss']]},
 // persons in minutes
 nied3('r3-minutes-present-names',`<p>Beginn: 19:00 Uhr</p><p>Anwesend:</p><p>1. Bürgermeister Hans Maier<br>2. Anna-Lena Huber-Schmidt<br>3. Hans von Berg<br>4. Peter Schmid<br>5. Maria de Vries<br>6. Josef Huber jun.</p><h2>Öffentlicher Teil</h2><p>1. Bauantrag Kita</p><p>Beschluss: Das Einvernehmen wird erteilt. Abstimmung: 12:0</p><p>2. Haushalt 2027</p><p>Zur Kenntnis genommen.</p>`,{forbid:PERSONS,allow:KITA}),
 nied3('r3-minutes-present-table',`<h3>Anwesende Mitglieder</h3><table><tr><th>Nr.</th><th>Name</th><th>Funktion</th></tr><tr><td>1</td><td>Maier, Hans</td><td>Erster Bürgermeister</td></tr><tr><td>2</td><td>Huber, Anna</td><td>Gemeinderätin</td></tr><tr><td>3</td><td>Schmid, Peter</td><td>Gemeinderat</td></tr><tr><td>4</td><td>Lang, Petra</td><td>Gemeinderätin</td></tr><tr><td>5</td><td>Weber, Klaus</td><td>Gemeinderat</td></tr></table><h2>Öffentlicher Teil</h2><p>1. Bauantrag Kita</p><p>Beschluss: Einvernehmen erteilt. 12:0</p><p>2. Haushalt 2027</p><p>Zur Kenntnis genommen.</p>`,{forbid:PERSONS,allow:KITA}),
 nied3('r3-minutes-further-participants',`<p>Weitere Teilnehmer:</p><p>1. Ortssprecher Hans Maier<br>2. Kämmerer Fritz Zahl<br>3. Bauamtsleiter Tim Test<br>4. Seniorenbeauftragte Anna Huber<br>5. Jugendbeauftragter Max Klein</p><h2>Öffentliche Sitzung</h2><p>1. Bauantrag Kita</p><p>Zugestimmt, 12:0</p>`,{forbid:PERSONS,allow:['Bauantrag Kita']}),
 nied3('r3-minutes-lay-judges',`<p>1. Genehmigung der Niederschrift</p><p>Einstimmig genehmigt.</p><p>2. Aufstellung der Vorschlagsliste für Schöffen</p><p>Sachverhalt: Die Gemeinde hat 6 Personen vorzuschlagen. Folgende Personen werden in die Vorschlagsliste aufgenommen</p><p>1. Huber, Anna, Hausfrau, Musterbach<br>2. Maier, Hans, Landwirt, Musterbach<br>3. Schmid, Peter, Schreiner, Oberdorf<br>4. Lang, Petra, Bankkauffrau, Musterbach<br>5. Weber, Klaus, Rentner, Unterdorf<br>6. Fischer, Eva, Lehrerin, Musterbach</p><p>Abstimmung: 12:0</p><p>3. Anfragen</p>`,{forbid:PERSONS}),
 nied3('r3-minutes-fire-brigade',`<p>1. Genehmigung der Niederschrift</p><p>Einstimmig genehmigt.</p><p>2. Bestätigung der Wahlen der Freiwilligen Feuerwehr Musterbach</p><p>Die Dienstversammlung der Feuerwehr wählte am 12.09.2026 folgende Funktionsträger</p><p>1. Kommandant Max Muster<br>2. Stellvertretender Kommandant Tim Test<br>3. Jugendwartin: Karla Klein<br>4. Gerätewart: Paul Groß<br>5. Kassiererin: Anna Huber</p><p>Der Gemeinderat bestätigt die Wahlen. Abstimmung: 12:0</p>`,{forbid:[...PERSONS,'Klein','Groß','Max Muster','Tim Test']}),
 nied3('r3-minutes-blood-donors',`<p>1. Genehmigung der Niederschrift</p><p>Einstimmig genehmigt.</p><p>2. Ehrung von Blutspendern</p><p>Der Bürgermeister ehrte folgende Blutspender</p><p>1. Anna Huber (50 Spenden)<br>2. Hans Maier (25 Spenden)<br>3. Peter Schmid (75 Spenden)<br>4. Petra Lang (25 Spenden)<br>5. Klaus Weber (100 Spenden)</p><p>3. Anfragen</p>`,{forbid:PERSONS}),
 // a day in the link text that is the day of the notice or posting
 {id:'r3-link-posting-date',round:'r3',doc:'pdf',label:'Aushang vom 02.10.2026: Einladung Sitzung Gemeinderat',text:`Gemeinde Musterbach
Einladung
Die nächste öffentliche Sitzung des Gemeinderates findet am kommenden Mittwoch, 19:00 Uhr, im Sitzungssaal des Rathauses statt.
Tagesordnung
1. Bauantrag Neubau Carport, Fl.Nr. 210
2. Haushaltsplan 2027 – Vorberatung
3. Anfragen`,collectForbid:['Carport','Haushaltsplan','Anfragen']},
 // gazettes of an association, a Zweckverband or a county: the head of the text, not the link text, names it
 {id:'r3-gazette-linktext-vg',round:'r3',doc:'pdf',label:'Amtsblatt Nr. 41/2026 – Sitzungen',text:`Amtsblatt der Verwaltungsgemeinschaft Oberland
Freitag, 9. Oktober 2026 Nr. 41
Amtliche Bekanntmachungen
Am Donnerstag, 15.10.2026, 20.00 Uhr, findet im Sitzungssaal des Rathauses Talheim eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung
1. Neubau Feuerwehrhaus Talheim
2. Friedhofssatzung`,collectAllow:[]},
 ...['ZWECKVERBAND WASSERVERSORGUNG OBERLAND','ZWECKVERBAND ABWASSERBESEITIGUNG MUSTERBACH-TALHEIM'].map((zv,n)=>({id:`r3-gazette-zv-caps-${n+1}`,round:'r3',doc:'pdf',label:'Sitzungsbekanntmachungen KW 41',text:`Amtsblatt der Gemeinde Musterbach
Freitag, 9. Oktober 2026 Nr. 41
${zv}
Einladung
Am Dienstag, 20.10.2026, 17.00 Uhr, findet im Verbandsgebäude eine öffentliche Sitzung des Werkausschusses statt.
Tagesordnung
1. Wasserpreiskalkulation 2027
2. Sanierung Hochbehälter Talheim
GEMEINDE MUSTERBACH
Am Mittwoch, 14.10.2026, 19.00 Uhr, findet im Rathaus eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung
1. Bauantrag Kita
2. Haushalt 2027`,collectForbid:['Wasserpreis','Hochbehälter'],expect:[['Bauantrag Kita','2026-10-14','Gemeinderat']]})),
 {id:'r3-gazette-member-caps',round:'r3',doc:'pdf',label:'Sitzungsbekanntmachungen KW 41',text:`Wochenblatt Musterland
Freitag, 9. Oktober 2026 Nr. 41
ORTSGEMEINDE NACHBARHAUSEN
Am Donnerstag, 15.10.2026, 20.00 Uhr, findet im Dorfgemeinschaftshaus eine öffentliche Sitzung des Ortsgemeinderates statt.
Tagesordnung
1. Neubau Dorfgemeinschaftshaus
2. Friedhofssatzung
ORTSGEMEINDE MUSTERBACH
Am Mittwoch, 14.10.2026, 19.00 Uhr, findet im Gemeindehaus eine öffentliche Sitzung des Ortsgemeinderates statt.
Tagesordnung
1. Bauantrag Kita
2. Haushalt 2027`,collectForbid:['Dorfgemeinschaftshaus','Friedhof']},
 ...[['Sitzung Haupt- und Finanzausschuss 20.10.2026','<h1>Einladung zur öffentlichen Sitzung des Haupt- und Finanzausschusses der Verbandsgemeinde</h1><p>am Dienstag, 20.10.2026, 18:00 Uhr, im Sitzungssaal der Verbandsgemeindeverwaltung</p><p>1. Haushaltsplan VG 2027</p><p>2. Stellenplan</p>'],
  ['Sitzung Feuerwehrausschuss 20.10.2026','<h1>Einladung zur öffentlichen Sitzung des Feuerwehrausschusses der Samtgemeinde</h1><p>am Dienstag, 20.10.2026, 18:00 Uhr, im Rathaus</p><p>1. Feuerwehrbedarfsplan</p><p>2. Ersatzbeschaffung HLF 20</p>'],
  ['Sitzung Finanzausschuss 20.10.2026','<h1>Einladung zur öffentlichen Sitzung des Finanzausschusses des Amtes</h1><p>am Dienstag, 20.10.2026, 18:00 Uhr, im Amtsgebäude</p><p>1. Amtsumlage 2027</p><p>2. Stellenplan</p>'],
  ['Sitzung Samtgemeindeausschuss 20.10.2026','<h1>Öffentliche Sitzung des Samtgemeindeausschusses am 20.10.2026</h1><p>Beginn: 18:00 Uhr</p><p>1. Feuerwehrbedarfsplan Samtgemeinde</p><p>2. Schulentwicklungsplan</p>']].map(([label,main],n)=>({id:`r3-association-body-${n+1}`,round:'r3',doc:'html',label,text:page(main),collectAllow:[]})),
 ...['STADT MUSTERSTADT','Musterstadt'].map((sec,n)=>({id:`r3-district-town-section-${n+1}`,round:'r3',doc:'pdf',label:'Amtsblatt Nr. 41/2026 – Sitzungen',source:{name:'Landkreis Musterkreis',kind:'district'},text:`Amtsblatt des Landkreises Musterkreis
Freitag, 9. Oktober 2026 Nr. 41
Bekanntmachungen der Städte und Gemeinden
${sec}
Am Dienstag, 20.10.2026, 18.00 Uhr, findet im Rathaus eine öffentliche Sitzung des Bau- und Umweltausschusses statt.
Tagesordnung
1. Bauantrag Neubau Supermarkt Bahnhofstraße
2. Bebauungsplan „Am Mühlbach“
LANDKREIS MUSTERKREIS
Am Donnerstag, 22.10.2026, 14.00 Uhr, findet im Landratsamt eine öffentliche Sitzung des Kreistages statt.
Tagesordnung
1. Kreisumlage 2027`,collectAllow:['Kreisumlage 2027']})),
);
feedCases.push(
 {id:'r3-rss-title-posting-date',round:'r3',kind:'rss',title:'Amtliche Bekanntmachung vom 05.10.2026 – Sitzung des Gemeinderates',html:'<p>Die nächste öffentliche Sitzung des Gemeinderates findet am kommenden Mittwoch um 19:00 Uhr im Sitzungssaal des Rathauses statt.</p><p>Tagesordnung:</p><p>1. Bauantrag Neubau Carport, Fl.Nr. 210<br>2. Haushaltsplan 2027 – Vorberatung<br>3. Anfragen</p>',forbid:['Carport','Haushaltsplan','Anfragen']},
 {id:'r3-rss-only-members',round:'r3',kind:'rss',title:'Öffentliche Sitzung des Gemeinderates am 14.10.2026',html:'<p>Am Mittwoch, 14.10.2026, 19:00 Uhr findet im Rathaus eine öffentliche Sitzung des Gemeinderates statt.</p><p>Tagesordnung:</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p><p>Nur für Ratsmitglieder:</p><p>3. Grundstücksangelegenheit Lindenweg<br>4. Personalangelegenheit Bauhof</p>',forbid:[...NP,'Lindenweg']},
);
const R3_INV=(np)=>`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, 16.09.2026, 19:00 Uhr
Öffentlicher Teil
1. Genehmigung der Niederschrift
2. Bauantrag Carport Fl.Nr. 210
Nichtöffentlicher Teil
${np}`;
const R3_MIN=(items)=>`Niederschrift über die öffentliche Sitzung des Gemeinderates
am Mittwoch, 16.09.2026, 19:00 Uhr
Tagesordnung:
TOP 1 Genehmigung der Niederschrift
TOP 2 Bauantrag Carport Fl.Nr. 210
${items}
Zu TOP 1: Die Niederschrift wird genehmigt. Abstimmung: 12:0
Zu TOP 2: Das Einvernehmen wird erteilt. Abstimmung: 12:0`;
const pair=(id,np,items,forbid,more={})=>({id,round:'r3',docs:[{path:`fileadmin/${id}-einladung.pdf`,label:'Einladung Gemeinderat 16.09.2026',doc:'pdf',text:R3_INV(np)},{path:`fileadmin/${id}-niederschrift.pdf`,label:'Niederschrift Gemeinderat 16.09.2026',doc:'pdf',text:R3_MIN(items)}],forbid,...more});
multiCases.push(
 pair('r3-cross-precise-title','3. Grundstücksangelegenheiten\n4. Personalangelegenheiten','TOP 3 Verkauf einer Teilfläche aus Flurstück 412 an Familie Lindner\nTOP 4 Stellenbesetzung Leitung Bauhof',['Lindner','Stellenbesetzung']),
 pair('r3-cross-standard-title','3. Information zum Rechtsstreit mit der Baufirma Huber GmbH\n4. Mitteilung zum Grundstückserwerb Fl.Nr. 412','TOP 3 Information zum Rechtsstreit mit der Baufirma Huber GmbH\nTOP 4 Mitteilung zum Grundstückserwerb Fl.Nr. 412',['Rechtsstreit','Grundstückserwerb']),
 pair('r3-cross-plot-precise','3. Erwerb Grundstück Fl.Nr. 412','TOP 3 Erwerb Grundstück Fl.Nr. 412/3',['Erwerb']),
 {id:'r3-cross-markt-names',round:'r3',source:{name:'Markt Musterbach'},docs:[{path:'fileadmin/r3-markt-einladung.pdf',label:'Einladung Marktgemeinderat 16.09.2026',doc:'pdf',text:`Markt Musterbach
Einladung zur Sitzung des Marktgemeinderates am Mittwoch, 16.09.2026, 19:00 Uhr
Öffentlicher Teil
1. Genehmigung der Niederschrift
2. Bauantrag Carport Fl.Nr. 210
Nichtöffentlicher Teil
3. Grundstücksangelegenheit Flurstück 412
4. Personalangelegenheit Bauhof`},{path:'fileadmin/r3-markt-niederschrift.pdf',label:'Niederschrift Marktrat 16.09.2026',doc:'pdf',text:`Niederschrift über die öffentliche Sitzung des Marktrates
am Mittwoch, 16.09.2026
Tagesordnung:
TOP 1 Genehmigung der Niederschrift
TOP 2 Bauantrag Carport Fl.Nr. 210
TOP 3 Grundstücksangelegenheit Flurstück 412
TOP 4 Personalangelegenheit Bauhof`}],forbid:['Flurstück 412','Personal']},
 {id:'r3-cross-committee-names',round:'r3',docs:[{path:'fileadmin/r3-bua-einladung.pdf',label:'Einladung Bau- und Umweltausschuss 16.09.2026',doc:'pdf',text:`Gemeinde Musterbach
Einladung zur Sitzung des Bau- und Umweltausschusses am Mittwoch, 16.09.2026, 18:00 Uhr
Öffentlicher Teil
1. Bauantrag Carport Fl.Nr. 210
Nichtöffentlicher Teil
2. Flurstück 412 – Kaufangebot
3. Vergabe Rechtsstreit Kanal`},{path:'rathaus/sitzungen/bua-2026-09-16.html',label:'Ausschuss für Bauen und Umwelt 16.09.2026',doc:'html',text:page('<h1>Öffentliche Sitzung des Ausschusses für Bauen und Umwelt am 16.09.2026</h1><p>Beginn: 18:00 Uhr</p><p>1. Bauantrag Carport Fl.Nr. 210</p><p>2. Flurstück 412 – Kaufangebot</p><p>3. Vergabe Rechtsstreit Kanal</p>')}],forbid:['Flurstück 412','Rechtsstreit']},
);
closedRedirects.push('fileadmin/protokolle/2026/gr_0916_vertr.pdf','fileadmin/protokolle/2026/gr_0916_NS.pdf','fileadmin/protokolle/2026/gr_0916_N-Teil.pdf','fileadmin/protokolle/2026/gr_0916_TeilB_N.pdf');
closedLabels.push('Niederschrift GR 16.09.2026 (NS)','Niederschrift GR 16.09.2026 N-Sitzung','Niederschrift GR 16.09.2026 (Ö-Teil) und (N-Teil)','Niederschrift Gemeinderat 16.09.2026 – nur für Ratsmitglieder',
 'Niederschrift Gemeinderat 16.09.2026 Nichföffentlich','Niederschrift Gemeinderat 16.09.2026 Nicht öffentich');
closedPaths.push('/fileadmin/protokolle/2026/gr-2026-09-16-N.pdf','/fileadmin/protokolle/2026/gr_2026-09-16_TeilB_N.pdf','/fileadmin/protokolle/2026/gr_2026-09-16_intern.pdf','/fileadmin/protokolle/2026/gr_2026-09-16_ns.pdf','/fileadmin/protokolle/2026/gr_2026-09-16_NOS.pdf');

// --- round 4 -----------------------------------------------------------------------------------------------------------
const SIGN4=`Musterbach, 07.10.2026
gez. Hans Huber
Erster Bürgermeister`;
// Words of a sentence or mark between the items that must never be read as part of a title.
const NP4=['Grundstück','Personal','Zuhörer','Presse','Besucher','Gäste','ausgeschlossen','zugelassen','Öffentlichkeit','öffentlich','Sitzung','Runde','Mandat','intern','Punkte','N-'];
const r4pdf=(id,text,more={})=>({id,round:'r4',doc:'pdf',label:'Einladung Gemeinderat',text,forbid:NP4,allow:GNK,date:'2026-10-14',...more});
const between=(id,sentence,more={})=>r4pdf(id,`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
${sentence}
3. Grundstücksverkauf Fl.Nr. 412
4. Personalangelegenheit
${SIGN4}`,more);
const NIED4=sep=>`Gemeinde Musterbach
Niederschrift über die öffentliche Sitzung des Gemeinderates
am Mittwoch, 16.09.2026, 19.00 Uhr, im Sitzungssaal des Rathauses
1. Genehmigung der Niederschrift
Die Niederschrift wird einstimmig genehmigt.
2. Bauantrag Kita
Der Gemeinderat erteilt das Einvernehmen. Abstimmung: 12:0
${sep}
3. Grundstücksverkauf Fl.Nr. 412
Der Gemeinderat stimmt dem Verkauf an die Huber GmbH zu. Abstimmung: 11:1
4. Personalangelegenheit
Der Einstellung wird zugestimmt. Abstimmung: 12:0`;
const nied4=(id,sep)=>({id,round:'r4',doc:'pdf',label:'Niederschrift Gemeinderat 16.09.2026',text:NIED4(sep),forbid:NP4,allow:GNK,date:'2026-09-16',now:'2026-10-04'});
const H1R4='<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1>';
const r4html=(id,main,more={})=>({id,round:'r4',doc:'html',label:'Tagesordnung Gemeinderat 14.10.2026',text:page(main),forbid:NP,date:'2026-10-14',...more});
const OPEN_SESSION='<h1>Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>Die Sitzung ist öffentlich.</p>';

cases.push(
 // sentences between the items of an invitation that end the public part (PDF lines, read as wrapped)
 between('r4-between-presse-zuhoerer-colon','Für die folgenden Punkte sind Presse und Zuhörer ausgeschlossen:'),
 between('r4-between-besucher-not-admitted','Besucher sind zu den folgenden Punkten nicht zugelassen.'),
 between('r4-between-gaeste-not-admitted','Gäste sind bei den folgenden Punkten nicht zugelassen.'),
 between('r4-between-zuhoerer-hyphen','Für die folgenden Punkte sind Zuhö-\nrer nicht zugelassen.'),
 between('r4-between-ohne-beteiligung','Die weiteren Punkte werden ohne Beteiligung der Öffentlichkeit beraten.'),
 between('r4-between-presse-zuhoerer-short','Presse und Zuhörer sind ausgeschlossen'),
 ...['Nichöffentliche Sitzung','Nichtöfffentliche Sitzung','Nichtöffenttliche Sitzung','Nichtöffetnliche Sitzung','Nciht öffentliche Sitzung','Nichttöffentliche Sitzung','NICHÖFFENTLICHE SITZUNG','Unöffentliche Sitzung'].map((h,n)=>between(`r4-between-typo-${n+1}`,h)),
 between('r4-between-n-sitzung','N-Sitzung'),
 between('r4-between-geschlossene-runde','Weitere Punkte in geschlossener Runde'),
 between('r4-between-mandatstraeger','Sitzungsfortsetzung nur für Mandatsträger'),
 between('r4-between-public-numbers','Öffentlich sind die Tagesordnungspunkte 1 und 2.'),
 between('r4-between-public-range','Die Punkte 1 bis 2 werden öffentlich beraten.'),
 // a note in the head that names the items by number without the word "nichtöffentlich"
 ...['Zu den Tagesordnungspunkten 3 und 4 sind Zuhörer nicht zugelassen.','Besucher sind zu TOP 3 und 4 nicht zugelassen.','Bei TOP 3 und 4 sind Presse und Zuhörer ausgeschlossen.'].map((s,n)=>r4pdf(`r4-head-note-${n+1}`,`Gemeinde Musterbach
Am Mittwoch, 14.10.2026, 19.00 Uhr, findet im Sitzungssaal des Rathauses eine öffentliche Sitzung des Gemeinderates statt.
${s}
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Kita
3. Grundstücksverkauf Fl.Nr. 412
4. Personalangelegenheit`)),
 // a mark at the item
 ...['(Zuhörer ausgeschlossen)','(§ 35 (1) GemO)','(Art. 52 (2) GO)','(gem. § 35 I 2 GemO)','(nichöffentlich)','(Ausschluss Presse)','intern'].map((m,n)=>r4pdf(`r4-item-mark-${n+1}`,`${MB_HEAD}
1. Genehmigung der Niederschrift
2. Bauantrag Kita
3. Grundstücksverkauf Fl.Nr. 412 ${m}
4. Anfragen
${SIGN4}`,{forbid:[...NP4,'Anfragen']})),
 // footnote letters
 ...['a)','(a)'].map((m,n)=>r4pdf(`r4-footnote-letter-${n+1}`,`Gemeinde Musterbach
Öffentliche Bekanntmachung
Am Mittwoch, 14.10.2026, 19.00 Uhr, findet im Sitzungssaal des Rathauses eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung
1. Fragestunde für Einwohner
2. Bauantrag Kita
3. Grundstücksverkauf Fl.Nr. 412 ${m}
4. Personalangelegenheit ${m}
${m} nichtöffentlich
Musterbach, 07.10.2026
Hans Huber, Bürgermeister`,{allow:['Fragestunde für Einwohner','Bauantrag Kita']})),
 // minutes: sentences that close the public
 ...['Der Vorsitzende schließt die Öffentlichkeit für die weiteren Tagesordnungspunkte aus.','Die anwesenden Zuhörer werden für die weiteren Punkte ausgeschlossen.','Presse und Zuhörer sind ab hier ausgeschlossen',
  'Die Sitzung wird intern fortgesetzt.','Der Vorsitzende stellt die Nichtöffentlichkeit her.','Die Zuhörer werden gebeten, den Saal zu verlassen.'].map((s,n)=>nied4(`r4-minutes-sentence-${n+1}`,s)),
 // the day of the meeting wrapped between day and month
 r4pdf('r4-date-wrapped',`Gemeinde Musterbach
Einladung
zur öffentlichen Sitzung des Gemeinderates
Die Sitzung findet statt am Mittwoch, 14.
Oktober 2026, um 19.00 Uhr im Rathaus.
Die Niederschrift der letzten Sitzung vom 16.09.2026 liegt zur Einsicht aus.
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Kita`,{label:'Einladung'}),
 r4pdf('r4-date-wrapped-anschluss',`Gemeinde Musterbach
Im Anschluss an die Sitzung vom 16.09.2026 lade ich Sie zur öffentlichen Sitzung des Gemeinderates am Mittwoch, 14.
Oktober 2026, um 19.00 Uhr in den Sitzungssaal ein.
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Kita`,{label:'Einladung'}),
 // foreign bodies
 {id:'r4-county-youth-committee',round:'r4',doc:'pdf',label:'Einladung Jugendhilfeausschuss',text:`Einladung zur öffentlichen Sitzung des Jugendhilfeausschusses
Datum: Mittwoch, 14.10.2026
Beginn: 14:00 Uhr
Ort: Landratsamt Musterkreis, Großer Sitzungssaal
Tagesordnung
1. Jugendhilfeplanung 2027
2. Kita-Bedarfsplanung im Landkreis
Max Mustermann
Landrat`,forbid:['Mustermann','Landrat'],collectAllow:[]},
 {id:'r4-county-title',round:'r4',doc:'pdf',label:'Kreistag – Ausschuss für Umwelt 14.10.2026',text:`Einladung
zur öffentlichen Sitzung des Ausschusses für Umwelt und Landwirtschaft
am Mittwoch, 14.10.2026, 14.00 Uhr
Tagesordnung
1. Abfallwirtschaftskonzept 2027
2. Naturschutzgebiet Moorwiesen`,collectAllow:[]},
 {id:'r4-zv-in-signature',round:'r4',doc:'pdf',label:'Einladung Werkausschuss',text:`Einladung
zur öffentlichen Sitzung des Werkausschusses
am Mittwoch, 21.10.2026, 17.00 Uhr
im Sitzungssaal des Rathauses Musterbach
Tagesordnung
1. Wasserpreis 2027
2. Erneuerung Hochbehälter Oberland
Musterbach, 07.10.2026
Hans Huber
Verbandsvorsitzender
Zweckverband Wasserversorgung Oberland`,collectAllow:[]},
 {id:'r4-vg-werke',round:'r4',doc:'pdf',label:'Einladung Werkausschuss',source:{name:'Ortsgemeinde Musterbach'},text:`Verbandsgemeindewerke Musterland
Einladung
zur öffentlichen Sitzung des Werkausschusses
am Dienstag, 20.10.2026, 17.00 Uhr, Sitzungssaal der Verbandsgemeindeverwaltung
Tagesordnung
1. Wirtschaftsplan 2027 der Abwasserbeseitigung
2. Kanalsanierung Hauptstraße
Musterland, 07.10.2026
Erika Beispiel
Bürgermeisterin`,collectAllow:[]},
 {id:'r4-other-member-place',round:'r4',doc:'pdf',label:'Sitzung Gemeinderat 14.10.2026',text:`Bekanntmachung
Am Mittwoch, 14.10.2026, 19.30 Uhr, findet im Sitzungssaal des Rathauses Bdorf eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung
1. Bauantrag Fl.Nr. 77, Gemarkung Bdorf
2. Feuerwehrhaus Bdorf
Bdorf, 07.10.2026
Max Muster
Erster Bürgermeister`,collectAllow:[]},
 // gazettes of a Verwaltungsgemeinschaft under other names; associations in the Rathaus of a member; the Landrat as issuer
 ...[['Gemeindezeitung der Verwaltungsgemeinschaft Oberland\nJahrgang 32 · Freitag, 9. Oktober 2026 · Nr. 41\nAmtliche Bekanntmachungen\nNACHBARHAUSEN'],
  ['Oberland-Rundschau\nJahrgang 32 · Freitag, 9. Oktober 2026 · Nr. 41\nAmtliche Bekanntmachungen\nAus der Gemeinde Nachbarhausen'],
  ['Heimatzeitung Oberland\nFreitag, 9. Oktober 2026 · Nr. 41\nAmtliche Bekanntmachungen\nNachbarhausen']].map(([head],n)=>({id:`r4-gazette-member-${n+1}`,round:'r4',doc:'pdf',label:'Sitzungsbekanntmachungen KW 41',text:`${head}
Öffentliche Sitzung des Gemeinderates
Am Dienstag, 13.10.2026, 19.30 Uhr, findet im Sitzungssaal eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Neubau Feuerwehrhaus Nachbarhausen
3. Kanalsanierung Bachstraße`,collectAllow:[]})),
 ...[['ZV Wasserversorgung Oberland-Gruppe','im Rathaus Musterbach','Werkausschusses','1. Wasserpreise 2027\n2. Erneuerung Hochbehälter'],
  ['Grund- und Mittelschule Oberland','in der Grundschule Musterbach','Schulausschusses','1. Schülerbeförderung\n2. Digitalpakt']].map(([issuer,venue,body,items],n)=>({id:`r4-gazette-association-venue-${n+1}`,round:'r4',doc:'pdf',label:'Sitzungsbekanntmachungen KW 41',text:`Mitteilungsblatt der Verwaltungsgemeinschaft Oberland
Freitag, 9. Oktober 2026 Nr. 41
Amtliche Bekanntmachungen
${issuer}
Am Dienstag, 13.10.2026, 17.00 Uhr, findet ${venue} eine öffentliche Sitzung des ${body} statt.
Tagesordnung
${items}
Gemeinde Musterbach
Am Mittwoch, 14.10.2026, 19.00 Uhr, findet im Rathaus Musterbach eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung
1. Bauantrag Kita
2. Haushalt 2027`,collectForbid:['Wasserpreis','Hochbehälter','Schülerbeförderung','Digitalpakt']})),
 {id:'r4-gazette-landrat',round:'r4',doc:'pdf',label:'Sitzungsbekanntmachungen KW 41',text:`Amtliche Bekanntmachungen
Der Landrat des Landkreises Musterkreis
Bekanntmachung
Am Montag, 19.10.2026, 14.00 Uhr, findet im großen Sitzungssaal eine öffentliche Sitzung des Jugendhilfeausschusses statt.
Tagesordnung
1. Bedarfsplanung Kindertagesstätten 2027
2. Jugendsozialarbeit an Schulen`,collectAllow:[]},
 // HTML: a status line, a field or a badge inside the card of one item
 ...['<p>Sitzungsart: nichtöffentlich</p>','<p>Öffentlichkeit: nein</p>','<p>Öffentlichkeit: ausgeschlossen</p>','<p>Teil: nichtöffentlich</p>','<p>Zugang: nicht öffentlich</p>','<p>Beratungsart: vertraulich</p>'].map((f,n)=>r4html(`r4-html-card-field-${n+1}`,`${H1R4}<div class=top><h3>TOP 1 Bauantrag Kita</h3><p>Vorlage: 2026/041</p></div><div class=top><h3>TOP 2 Haushalt 2027</h3><p>Vorlage: 2026/042</p></div><div class=top><h3>TOP 3 Grundstücksverkauf Fl.Nr. 412</h3><p>Vorlage: 2026/043</p>${f}</div><div class=top><h3>TOP 4 Personalangelegenheit</h3>${f}</div>`,{allow:KITA})),
 r4html('r4-html-dl-public-field',`${H1R4}<dl><dt>TOP 1</dt><dd>Bauantrag Kita</dd><dt>Öffentlich</dt><dd>ja</dd><dt>TOP 2</dt><dd>Grundstücksverkauf</dd><dt>Öffentlich</dt><dd>nein</dd></dl>`,{allow:['Bauantrag Kita']}),
 ...['N-Teil','Geheim','Teil B','Sitzungsteil B','Teil 2','II','privat'].map((b,n)=>r4html(`r4-html-card-badge-${n+1}`,`${H1R4}<div class=card><h3>TOP 1 Bauantrag Kita</h3><p>Vorlage 2026/041</p></div><div class=card><h3>TOP 2 Haushalt 2027</h3><p>Vorlage 2026/042</p></div><div class=card><h3>TOP 3 Grundstücksverkauf</h3><p>Vorlage 2026/043</p><span class=badge>${b}</span></div>`,{allow:KITA})),
 r4html('r4-html-card-badge-after-title',`${H1R4}<div class=card><h3>TOP 1 Bauantrag Kita</h3></div><div class=card><h3>TOP 2 Haushalt 2027</h3></div><div class=card><h3>TOP 3 Grundstücksverkauf</h3><span class=badge>N-Teil</span></div>`,{allow:KITA}),
 // reports of a meeting that go on in its closed part in other words
 ...['Anschließend befasste sich der Gemeinderat in geschlossener Runde mit den folgenden Themen:','Folgende Themen wurden anschließend intern diskutiert:','Im zweiten Teil der Sitzung, zu dem Zuhörer keinen Zutritt hatten, ging es um:',
  'Im Anschluss an den öffentlichen Teil wurde weiter beraten über:','Bei den folgenden Punkten mussten die Zuhörer draußen bleiben:','Nach einer kurzen Pause wurde unter sich weiterberaten über:','In der sich anschließenden Klausur des Gremiums ging es um:',
  'Außerdem standen auf der Tagesordnung:'].map((s,n)=>({id:`r4-report-closed-${n+1}`,round:'r4',doc:'html',label:'Bericht aus der Gemeinderatssitzung',now:'2026-10-20',date:'2026-10-14',text:page(`<article><h1>Bericht aus der Gemeinderatssitzung vom 14.10.2026</h1><p>In öffentlicher Sitzung befasste sich der Gemeinderat mit folgenden Themen:</p><p>1. Bauantrag Kita</p><p>Der Gemeinderat erteilte das Einvernehmen einstimmig.</p><p>2. Haushalt 2027</p><p>Der Kämmerer stellte den Entwurf vor.</p><p>${s}</p><p>3. Grundstücksverkauf Fl.Nr. 412</p><p>4. Personalangelegenheit</p></article>`),forbid:NP,allow:KITA})),
 // the end of the public part in the lines of minutes
 ...['Ende der Sitzung (öffentlicher Teil): 20:15 Uhr','Öffentliche Sitzung Ende: 20:15 Uhr','Ende ÖT 20:15 Uhr','Öffentlicher Sitzungsteil: 19:00 Uhr bis 20:15 Uhr','Ende des öffentlichen Sitzungsteils um 20:15 Uhr'].map((s,n)=>({id:`r4-minutes-end-${n+1}`,round:'r4',doc:'html',label:'Niederschrift Gemeinderat 16.09.2026',now:'2026-10-04',date:'2026-09-16',text:page(`<h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 16.09.2026</h1><p>Beginn: 19:00 Uhr</p><p>1. Bauantrag Kita</p><p>Beschluss: Das Einvernehmen wird erteilt. Abstimmung: 12:0</p><p>2. Haushalt 2027</p><p>Der Gemeinderat nimmt den Bericht zur Kenntnis.</p><p>${s}</p><p>3. Grundstücksverkauf Fl.Nr. 412</p><p>Der Gemeinderat stimmt dem Verkauf zu.</p><p>4. Personalangelegenheit</p>`),forbid:NP,allow:KITA})),
 // the norm of a county code that excludes the public
 ...['(Art. 46 Abs. 2 LKrO)','(§ 30 LKrO)','(§ 33 Abs. 2 KrO NRW)','(§ 32 HKO)','(§ 33 SächsLKrO)','(Art. 41 Abs. 2 BezO)','(u. A. d. Ö.)'].map((m,n)=>({id:`r4-county-law-${n+1}`,round:'r4',doc:'html',label:'Tagesordnung Kreisausschuss 14.10.2026',source:{name:'Landkreis Musterkreis',kind:'district'},date:'2026-10-14',text:page(`<h1>Öffentliche Sitzung des Kreisausschusses am 14.10.2026, 14:00 Uhr</h1><p>1. Kreishaushalt 2027</p><p>2. Schulbau Gymnasium</p><p>3. Personalangelegenheit ${m}</p><p>4. Grundstückserwerb ${m}</p>`),forbid:NP,allow:['Kreishaushalt 2027','Schulbau Gymnasium']})),
 // symbols, icon fonts, classes and data attributes in a status column
 ...['<img src="/fileadmin/icons/nicht_oeffentlich.png" alt="">','<img src="/fileadmin/icons/nichtoeff.gif" alt="">','<img src="/fileadmin/icons/closed.png" alt="">','<img src="/fileadmin/icons/status_n.gif" alt="">','<img src="/fileadmin/icons/key.svg" alt="">','<img src="/fileadmin/icons/privat.png" alt="">',
  '<i class="mdi mdi-eye-off"></i>','<i class="fa fa-key"></i>','<span class="ico_noeff"></span>','<span class="status-nö"></span>','<span class="topNichtOeffentlich"></span>','<span class="badge-private"></span>','<span class="status-closed"></span>','<i class="icon-confidential"></i>',
  '<span class="material-icons" aria-hidden="true">lock</span>','<span class="material-symbols-outlined">visibility_off</span>','<svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>'].map((icon,n)=>r4html(`r4-html-status-symbol-${n+1}`,`${OPEN_SESSION}<table><tr><td>1</td><td>Bauantrag Kita</td><td><img src="/fileadmin/icons/oeffentlich.png" alt=""></td></tr><tr><td>2</td><td>Grundstücksverkauf</td><td>${icon}</td></tr></table>`,{allow:['Bauantrag Kita'],forbid:[...NP,'lock','visibility']})),
 r4html('r4-html-li-data-status',`${OPEN_SESSION}<ul><li>1. Bauantrag Kita</li><li data-status="nichtoeffentlich">2. Grundstücksverkauf</li></ul>`,{allow:['Bauantrag Kita']}),
 r4html('r4-html-tr-class-camel',`${OPEN_SESSION}<table><tr><td>1</td><td>Bauantrag Kita</td></tr><tr class="rowNonPublic"><td>2</td><td>Grundstücksverkauf</td></tr></table>`,{allow:['Bauantrag Kita']}),
 r4html('r4-html-status-intern',`${OPEN_SESSION}<table><tr><td>1</td><td>Bauantrag Kita</td><td>öffentlich</td></tr><tr><td>2</td><td>Grundstücksverkauf</td><td>intern</td></tr></table>`,{allow:['Bauantrag Kita']}),
 // persons in minutes
 nied3('r4-minutes-present-name-office',`<p>Beginn: 19:00 Uhr</p><p>Zur Sitzung waren erschienen:</p><p>1. Hans Huber, Erster Bürgermeister<br>2. Anna Maier, Gemeinderätin<br>3. Josef Bauer, Gemeinderat<br>4. Erika Probe, Gemeinderätin</p><h2>Öffentlicher Teil</h2><p>1. Bauantrag Kita</p><p>Beschluss: Das Einvernehmen wird erteilt. Abstimmung: 12:0</p><p>2. Haushalt 2027</p><p>Zur Kenntnis genommen.</p><h2>Nichtöffentlicher Teil</h2><p>3. Grundstücksverkauf</p>`,{forbid:[...PERSONS,'Bauer','Probe','Grundstück'],allow:KITA}),
 nied3('r4-minutes-lay-judges-numbered-on',`<p>1. Genehmigung der Niederschrift</p><p>Die Niederschrift wird genehmigt.</p><p>2. Aufstellung der Vorschlagsliste für Schöffen</p><p>In die Vorschlagsliste werden aufgenommen:</p><p>3. Anna Maier, Hausfrau, Musterbach<br>4. Josef Bauer, Landwirt, Oberdorf<br>5. Erika Probe, Lehrerin, Musterbach</p><p>Abstimmung: 12:0</p>`,{forbid:[...PERSONS,'Bauer','Probe']}),
 ...['<p>Der Bauausschuss wird wie folgt besetzt:</p>',''].map((intro,n)=>nied3(`r4-minutes-committee-table-${n+1}`,`<p>1. Genehmigung der Niederschrift</p><p>Die Niederschrift wird genehmigt.</p><p>2. Besetzung des Bauausschusses</p>${intro}<table><tr><th>Nr.</th><th>Mitglied</th><th>Stellvertreter</th></tr><tr><td>1</td><td>${n?'GR ':''}Anna Maier${n?'':' (CSU)'}</td><td>${n?'GR ':''}Josef Bauer${n?'':' (CSU)'}</td></tr><tr><td>2</td><td>${n?'GRin ':''}Erika Probe${n?'':' (SPD)'}</td><td>${n?'GR ':''}Tim Test${n?'':' (SPD)'}</td></tr><tr><td>3</td><td>${n?'GR ':''}Karl Klein${n?'':' (FW)'}</td><td>${n?'GR ':''}Fritz Zahl${n?'':' (FW)'}</td></tr><tr><td>4</td><td>${n?'GRin ':''}Lena Lang${n?'':' (Grüne)'}</td><td>${n?'GR ':''}Paul Post${n?'':' (Grüne)'}</td></tr></table><p>Abstimmung: 12:0</p><p>3. Haushalt 2027</p><p>Zur Kenntnis genommen.</p>`,{forbid:[...PERSONS,'Bauer','Probe','Klein','Zahl','Post','Test']})),
 // the day of an article's publication is not the day of the meeting
 {id:'r4-article-date-headline',round:'r4',doc:'html',label:'Gemeinderatssitzung: Kita-Neubau beschlossen',now:'2026-10-21',text:page('<article><p class="date">Dienstag, 20.10.2026</p><h2>Gemeinderatssitzung: Kita-Neubau beschlossen</h2><p>In der öffentlichen Sitzung am vergangenen Mittwoch standen auf der Tagesordnung:</p><p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p></article>'),date:'2026-10-14'},
 {id:'r4-article-date-past-weekday',round:'r4',doc:'html',label:'Aus dem Gemeinderat',now:'2026-10-21',text:page('<article><p class="date">Dienstag, 20. Oktober 2026</p><h1>Aus dem Gemeinderat</h1><p>Der Gemeinderat tagte am vergangenen Mittwoch in öffentlicher Sitzung. Behandelt wurden:</p><p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p></article>'),date:'2026-10-14'},
 // a struck day of a moved meeting
 ...['<h1>Öffentliche Sitzung des Gemeinderates am <del>07.10.2026</del> 14.10.2026, 19:00 Uhr</h1>','<h1>Öffentliche Sitzung des Gemeinderates</h1><p>am Mittwoch, <s>07.10.2026</s> 14.10.2026</p>',
  '<h1>Öffentliche Sitzung des Gemeinderates</h1><p>Termin: <span style="text-decoration:line-through">Mittwoch, 07.10.2026</span> <strong>NEU: Mittwoch, 14.10.2026</strong></p>','<h1>Öffentliche Sitzung des Gemeinderates</h1><p><del>am Mittwoch, 07.10.2026, 19:00 Uhr</del></p><p>am Mittwoch, 14.10.2026, 19:00 Uhr</p>'].map((h,n)=>({id:`r4-struck-date-${n+1}`,round:'r4',doc:'html',label:'Sitzung des Gemeinderates (verlegt)',date:'2026-10-14',text:page(`${h}<p>Tagesordnung</p><p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p>`)})),
 // a table of dates with the bodies and agendas in one row each
 ...[['<th>Datum</th><th>Gremium</th><th>Tagesordnung der öffentlichen Sitzung</th>','<td>14.10.2026</td><td>Gemeinderat</td>','<td>21.10.2026</td><td>Bauausschuss</td>'],
  ['<th>Sitzung</th><th>Öffentliche Sitzung – Tagesordnung</th>','<td>Gemeinderat<br>14.10.2026</td>','<td>Bauausschuss<br>21.10.2026</td>']].map(([th,a,b],n)=>({id:`r4-dates-table-${n+1}`,round:'r4',doc:'html',label:'Tagesordnungen Gemeinderat und Ausschüsse',text:page(`<h1>Sitzungstermine</h1><table><tr>${th}</tr><tr>${a}<td>1. Bauantrag Kita</td></tr><tr>${b}<td>1. Bauvoranfrage Hauptstraße 5<br>2. Straßenbau Lindenweg</td></tr></table>`),expect:[['Bauantrag Kita','2026-10-14','Gemeinderat'],['Bauvoranfrage','2026-10-21','Bauausschuss'],['Straßenbau','2026-10-21','Bauausschuss']]})),
);
closedLabels.push('Niederschrift GR 16.09.2026 (o. Ö.)','Niederschrift GR 16.09.2026 nichtöffntl.','Niederschrift_GR_16.09.2026_ohneÖff');
closedPaths.push('/fileadmin/protokolle/GR-2026-09-16_ohne_Oeffentlichkeit.pdf','/fileadmin/protokolle/gr-2026-09-16-ohne-oeffentlichkeit.pdf');
closedRedirects.push('fileadmin/protokolle/GR-2026-09-16_ohne_Oeffentlichkeit.pdf');
// Round 4, found while repairing: the same causes in other forms.
cases.push(
 between('r4-between-keine-zuhoerer','Bei den weiteren Beratungsgegenständen sind keine Zuhörer zugelassen.'),
 between('r4-between-anschliessende-punkte','Für die anschließenden Tagesordnungspunkte ist die Öffentlichkeit nicht zugelassen.'),
 between('r4-between-gaeste-field','Gäste: nein'),
 r4pdf('r4-pdf-card-badge',`${MB_HEAD}
TOP 1 Genehmigung der Niederschrift
Vorlage: 2026/040
TOP 2 Bauantrag Kita
Vorlage: 2026/041
TOP 3 Grundstücksverkauf Fl.Nr. 412
Vorlage: 2026/043
N-Teil
TOP 4 Personalangelegenheit`),
 r4html('r4-html-status-cell-style',`${OPEN_SESSION}<table><tr><td>1</td><td>Bauantrag Kita</td><td class="status"></td></tr><tr><td>2</td><td>Grundstücksverkauf</td><td class="status status-2"></td></tr></table>`,{allow:['Bauantrag Kita']}),
 r4html('r4-html-details-status',`${H1R4}<details><summary>TOP 1 Bauantrag Kita</summary><p>Status: öffentlich</p></details><details><summary>TOP 2 Grundstücksverkauf</summary><p>Status: NÖ</p></details><details><summary>TOP 3 Personalangelegenheit</summary><p>Status: öffentlich</p></details>`,{allow:['Bauantrag Kita']}),
);

// --- round 5 -----------------------------------------------------------------------------------------------------------
const r5pdf=(id,text,more={})=>({id,round:'r5',doc:'pdf',label:'Einladung Gemeinderat',text,forbid:NP4,allow:KITA,date:'2026-10-14',...more});
const BY_ITEMS=tail=>`${MB_HEAD}
1. Bauantrag Kita
2. Haushalt 2027
3. Grundstücksverkauf Fl.Nr. 412${tail}`;
const OVERVIEW_INV=`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19.00 Uhr, im Rathaus
Die Sitzung ist öffentlich, ausgenommen die mit N gekennzeichneten Punkte.
Tagesordnung
Ö 1 Genehmigung der Niederschrift
Ö 2 Bauantrag Kita
N 3 Grundstücksverkauf Fl.Nr. 412
N 4 Personalangelegenheit
gez. Huber
Erster Bürgermeister
Tagesordnung
1. Genehmigung der Niederschrift
Sachvortrag: Die Niederschrift lag aus.
2. Bauantrag Kita
Sachvortrag: Der Bauantrag liegt vor.
3. Grundstücksverkauf Fl.Nr. 412
Sachvortrag: Ein Kaufangebot liegt vor.
4. Personalangelegenheit
Sachvortrag: Siehe Vorlage.`;
const PAGE_HEAD_SPLIT=head=>`Gemeinde Musterbach
Am Mittwoch, 14.10.2026, 19.00 Uhr, findet im Sitzungssaal des Rathauses eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung
1. Bauantrag Kita
2. Haushalt 2027
\f${head}
3. Grundstücksverkauf Fl.Nr. 412
4. Personalangelegenheit`;
const R5_OPEN='<h1>Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>Die Sitzung ist öffentlich.</p>';
const r5html=(id,main,more={})=>({id,round:'r5',doc:'html',label:'Sitzung Gemeinderat',text:page(main),forbid:NP4,allow:KITA,date:'2026-10-14',...more});
const SCHOEFFEN=(colon,names)=>`Gemeinde Musterbach
Niederschrift über die öffentliche Sitzung des Gemeinderates
am Mittwoch, 16.09.2026, 19.00 Uhr
1. Genehmigung der Niederschrift
Die Niederschrift wird genehmigt. Abstimmung: 12:0
2. Aufstellung der Vorschlagsliste für Schöffen
Folgende Personen werden in die Vorschlagsliste aufgenommen${colon}
${names.map((n,k)=>`${k+1}. ${n}`).join('\n')}
Abstimmung: 12:0`;
const NAMES5=['Yilmaz, Ayse, Verkäuferin, Musterbach','Kowalski, Piotr, Schlosser, Musterbach','Brandl, Wiebke, Erzieherin, Musterbach','Gruber, Hiltrud, Rentnerin, Musterbach'];
const NEWS5=sep=>`<main><article><h1>Aus dem Gemeinderat</h1><p>Bericht aus der öffentlichen Sitzung des Gemeinderates vom 14.10.2026</p><p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p><p>${sep}</p><p>3. Grundstücksverkauf Fl.Nr. 412</p><p>4. Vergabe Feuerwehrfahrzeug</p></article></main>`;
cases.push(
 // a short agenda marked Ö/N, then the agenda again with the reports (Sachvortrag) under a second "Tagesordnung"
 r5pdf('r5-marked-overview-invitation',OVERVIEW_INV,{label:'Einladung öffentliche Sitzung Gemeinderat 14.10.2026',allow:GNK}),
 {id:'r5-marked-overview-minutes',round:'r5',doc:'pdf',label:'Niederschrift Gemeinderat 16.09.2026',text:`Gemeinde Musterbach
Niederschrift über die Sitzung des Gemeinderates
am Mittwoch, 16.09.2026, 19.00 Uhr, im Rathaus
Übersicht
Ö 1 Genehmigung der Niederschrift
Ö 2 Bauantrag Kita
N 3 Grundstücksverkauf Fl.Nr. 412
Tagesordnung – öffentlicher Teil
1. Genehmigung der Niederschrift
Die Niederschrift wird genehmigt. Abstimmung: 12:0
2. Bauantrag Kita
Das Einvernehmen wird erteilt. Abstimmung: 11:1
3. Grundstücksverkauf Fl.Nr. 412
Dem Verkauf wird zugestimmt. Abstimmung: 12:0`,forbid:NP4,allow:GNK,date:'2026-09-16'},
 // the heading of the non-public part on the line of the page number (running head of a section)
 ...['Nichtöffentlicher Teil Seite 2 von 2','Nichtöffentlicher Teil Seite 2 / 2','Einladung GR 14.10.2026 – nichtöffentlicher Teil Seite 2 von 2','Gemeinde Musterbach – Nichtöffentliche Sitzung – Seite 2 von 2','Seite 2 von 2 Nichtöffentlicher Teil'].map((h,n)=>r5pdf(`r5-page-number-heading-${n+1}`,PAGE_HEAD_SPLIT(h))),
 // the paragraph that excludes the public in other spellings
 ...[' (§ 37 Abs. 1 Satz 1 Sächs. GemO)',' (§ 37 Abs. 1 Satz 1 Sächs GemO)',' gemäß § 36 Abs. 2 Bbg. KVerf',' gemäß § 36 Abs. 2 KVerf',' (Art. 52 Abs. 2 Bayerische Gemeindeordnung)',' – Beratung gem. § 40 Abs. 1 Thüringer Kommunalordnung',' (gem. § 52 Abs. 2 Kommunalverfassungsgesetz)',' (§ 52 Abs. 1 Hessische Gemeindeordnung)',' (nach § 37 Absatz 1 der Sächsischen Gemeindeordnung)',' (geschl.)'].map((m,n)=>r5pdf(`r5-item-law-${n+1}`,BY_ITEMS(m)+'\n4. Personalangelegenheit'+m)),
 r5pdf('r5-head-verschwiegenheit',`${MB_HEAD}
Die Beratung der Tagesordnungspunkte 3 und 4 unterliegt der Verschwiegenheitspflicht.
1. Bauantrag Kita
2. Haushalt 2027
3. Grundstücksverkauf Fl.Nr. 412
4. Personalangelegenheit`),
 ...['Teilnahme nur Gemeinderatsmitglieder','Nur Ratsmitglieder','Danach blieb der Rat unter sich','Im Anschluss tagte das Gremium intern weiter.','Die folgenden Beratungen fanden nicht vor Publikum statt','Folgende Punkte wurden ohne Bürger beraten','Im kleinen Kreis wurde anschließend beraten'].map((s,n)=>r5pdf(`r5-between-${n+1}`,`${MB_HEAD}
1. Bauantrag Kita
2. Haushalt 2027
${s}
3. Grundstücksverkauf Fl.Nr. 412
4. Personalangelegenheit`,{forbid:[...NP4,'Teilnahme','Rat','Gremium','Publikum','Bürger','Kreis']})),
 // foreign bodies in collective notices of a VG or an Amt, a Zweckverband named otherwise
 {id:'r5-vg-sections-caps',round:'r5',doc:'pdf',label:'Sitzungsbekanntmachungen KW 42',text:`Verwaltungsgemeinschaft Oberland
Amtliche Bekanntmachungen
MUSTERBACH
Öffentliche Sitzung des Gemeinderates
am Mittwoch, 14.10.2026, 19.00 Uhr, im Sitzungssaal des Rathauses
Tagesordnung
1. Bauantrag Kita
2. Haushalt 2027
NACHBARHAUSEN
Öffentliche Sitzung des Bauausschusses
am Donnerstag, 15.10.2026, 19.30 Uhr, im Sitzungssaal des Rathauses
Tagesordnung
1. Bauantrag Fl.Nr. 99 Gemarkung Nachbarhausen
2. Bauvoranfrage Lindenweg`,collectForbid:['Fl.Nr. 99','Lindenweg']},
 {id:'r5-amt-two-notices',round:'r5',doc:'pdf',label:'Sitzungsbekanntmachungen Amt Oktober',text:`Amt Musterland
Der Amtsdirektor
Bekanntmachung
Einladung zur Sitzung des Amtsausschusses
am Montag, 19.10.2026, 18.00 Uhr, im Amtsgebäude
Die Sitzung ist öffentlich.
Tagesordnung
1. Haushaltssatzung des Amtes 2027
2. Amtsumlage
Einladung zur Sitzung des Finanzausschusses
am Dienstag, 20.10.2026, 18.00 Uhr, im Amtsgebäude
Die Sitzung ist öffentlich.
Tagesordnung
1. Prüfung der Jahresrechnung 2025
2. Kreditaufnahme Schulsanierung`,collectAllow:[]},
 {id:'r5-amt-member-venue',round:'r5',doc:'pdf',label:'Bekanntmachungen Sitzungen Oktober',text:`Amt Musterland
Öffentliche Bekanntmachungen
Gemeinde Musterbach
Sitzung der Gemeindevertretung am Donnerstag, 15.10.2026, 19.00 Uhr, im Bürgerhaus
Die Sitzung ist öffentlich.
1. Bauantrag Kita
2. Haushalt 2027
Sitzung des Hauptausschusses am Montag, 19.10.2026, 19.00 Uhr, im Gemeindezentrum Nachbarhausen
Die Sitzung ist öffentlich.
1. Vergabe Winterdienst Nachbarhausen
2. Friedhofsgebühren Nachbarhausen`,collectForbid:['Nachbarhausen']},
 ...['Wasserversorgungsgruppe Oberland','Gruppenwasserversorgung Oberland','Fernwasserversorgung Oberland','Abwasserbeseitigung Oberland'].map((issuer,n)=>({id:`r5-zv-named-${n+1}`,round:'r5',doc:'pdf',label:'Einladung Werkausschuss',text:`${issuer}
Einladung zur öffentlichen Sitzung des Werkausschusses
am Dienstag, 20.10.2026, 17.00 Uhr, im Rathaus Musterbach
Tagesordnung
1. Wirtschaftsplan 2027
2. Wassergebühren`,collectAllow:[]})),
 // the day of another appointment in the head
 ...[['am Mittwoch, 14.10.2026, 18.30 Uhr, im Rathaus','Am Vortag, Dienstag, 13.10.2026, findet um 17.00 Uhr eine Ortsbesichtigung statt.'],
  ['am Mittwoch, 14.10.2026, 18.30 Uhr, im Rathaus','Zuvor findet am Montag, 12.10.2026, um 19.00 Uhr die Bürgerversammlung statt.'],
  ['Datum: Mittwoch, 14.10.2026','Vorbesprechung der Fraktionen am Montag, 12.10.2026, 19:00 Uhr'],
  ['Datum: Mittwoch, 14.10.2026, 18:30 Uhr','Ortsbesichtigung am Dienstag, 13.10.2026, 17:00 Uhr'],
  ['Beginn der Ortsbesichtigung: Dienstag, 13.10.2026, 17.00 Uhr','Sitzungsbeginn: Mittwoch, 14.10.2026, 18.00 Uhr']].map(([a,b],n)=>({id:`r5-date-other-appointment-${n+1}`,round:'r5',doc:'pdf',label:'Einladung Bauausschuss',text:`Gemeinde Musterbach
Einladung zur öffentlichen Sitzung des Bauausschusses
${a}
${b}
Tagesordnung
1. Bauantrag Kita
2. Bauvoranfrage Lindenweg`,date:'2026-10-14',committee:'Bauausschuss'})),
 {id:'r5-date-hyphenated-body',round:'r5',doc:'pdf',label:'Mitteilungsblatt Nr. 41',text:`Mitteilungsblatt der Gemeinde Musterbach
Freitag, 9. Oktober 2026 Nr. 41
Amtliche Bekanntmachungen
Hinweis: Die Sitzung des Gemeinderates am Mittwoch, 14.10.2026 beginnt bereits um 18.00 Uhr.
Öffentliche Sitzung des Bau-
und Umweltausschusses
am Dienstag, 20.10.2026, 18.00 Uhr, im Rathaus
Tagesordnung
1. Bauantrag Kita
2. Bauvoranfrage Lindenweg`,date:'2026-10-20',committee:'Bau- und Umweltausschuss'},
 // a list of lay judges with first names the reader does not know
 {id:'r5-schoeffen-colon',round:'r5',doc:'pdf',label:'Niederschrift Gemeinderat 16.09.2026',text:SCHOEFFEN(':',NAMES5),forbid:['Yilmaz','Kowalski','Brandl','Gruber','Öztürk'],date:'2026-09-16'},
 {id:'r5-schoeffen-no-colon',round:'r5',doc:'pdf',label:'Niederschrift Gemeinderat 16.09.2026',text:SCHOEFFEN('',[...NAMES5,'Öztürk, Mehmet, Techniker, Musterbach']),forbid:['Yilmaz','Kowalski','Brandl','Gruber','Öztürk'],date:'2026-09-16'},
 // legends by formatting, also outside main, tab bars after their panels, roman references, full-width letters
 ...['Kursiv: nichtöffentliche Punkte','grau hinterlegt: nichtöffentlicher Teil','Rot markierte Tagesordnungspunkte: nicht öffentlich','Anmerkung: kursive TOPs nichtöffentlich'].map((l,n)=>r5html(`r5-html-format-legend-${n+1}`,`${R5_OPEN}<p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p><p><em>3. Grundstücksverkauf</em></p><p><em>4. Personalangelegenheit</em></p><p>${l}</p>`,{allow:[]})),
 r5html('r5-html-format-legend-bold-public',`${R5_OPEN}<p><b>1. Bauantrag Kita</b></p><p><b>2. Haushalt 2027</b></p><p>3. Grundstücksverkauf</p><p>4. Personalangelegenheit</p><p>Fett gedruckte Punkte werden öffentlich beraten.</p>`),
 {id:'r5-html-legend-in-footer',round:'r5',doc:'html',label:'Sitzung Gemeinderat',text:`<html><body><main>${R5_OPEN}<p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p><p class="grau">3. Grundstücksverkauf</p><p class="grau">4. Personalangelegenheit</p></main><footer><p>Grau dargestellte Punkte werden nichtöffentlich beraten.</p></footer></body></html>`,forbid:NP4,allow:[],date:'2026-10-14'},
 r5html('r5-html-legend-in-aside',`${R5_OPEN}<p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p><p><em>3. Grundstücksverkauf</em></p><p><em>4. Personalangelegenheit</em></p><aside><p>Kursiv: nichtöffentliche Punkte</p></aside>`,{allow:[]}),
 ...[R5_OPEN,'<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1>'].map((h,n)=>r5html(`r5-html-tabs-after-panels-${n+1}`,`${h}<div class="tab-content"><div class="tab-pane active" id="tab1"><p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p></div><div class="tab-pane" id="tab2"><p>3. Grundstücksverkauf Fl.Nr. 412</p><p>4. Personalangelegenheit</p></div></div><ul class="nav-tabs"><li><a href="#tab1">Öffentlich</a></li><li><a href="#tab2">Nichtöffentlich</a></li></ul>`)),
 r5html('r5-html-tabs-aria',`${R5_OPEN}<div class="tab-content"><div class="tab-pane" id="p1" role="tabpanel" aria-labelledby="tab-oe"><p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p></div><div class="tab-pane" id="p2" role="tabpanel" aria-labelledby="tab-noe"><p>3. Grundstücksverkauf</p><p>4. Personalangelegenheit</p></div></div>`),
 ...['Danach blieb der Rat unter sich','Im Anschluss tagte das Gremium intern weiter.','Danach tagte der Rat unter sich','Die folgenden Beratungen fanden nicht vor Publikum statt','Folgende Punkte wurden ohne Bürger beraten','Im kleinen Kreis wurde anschließend beraten','Nur Ratsmitglieder'].map((s,n)=>({id:`r5-news-colloquial-${n+1}`,round:'r5',doc:'html',label:'Sitzung Gemeinderat',now:n%2?'2026-10-21':'2026-10-05',text:page(NEWS5(s).replace(/^<main>|<\/main>$/g,'')),forbid:['Grundstück','Feuerwehrfahrzeug'],allow:KITA,date:'2026-10-14'})),
 r5html('r5-html-roman-refs',`${R5_OPEN}<p>1. Bauantrag Kita<br>2. Haushalt 2027<br>3. Grundstücksverkauf<br>4. Personalangelegenheit</p><p>Hinweis: TOP III und IV nichtöffentlich</p>`),
 r5html('r5-html-fullwidth-heading','<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>1. Bauantrag Kita<br>2. Haushalt 2027</p><h3>ＮＩＣＨＴÖＦＦＥＮＴＬＩＣＨＥＲ ＴＥＩＬ</h3><p>3. Grundstücksverkauf<br>4. Personalangelegenheit</p>'),
 // the day of the post above an article that names the meeting by its weekday only
 ...['<article><p class="date">09.10.2026</p><h1>Gemeinderat tagt</h1><p>Der Gemeinderat tritt am kommenden Mittwoch um 19 Uhr zu einer öffentlichen Sitzung zusammen.</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p></article>',
  '<article><header><time>09.10.2026</time></header><h1>Gemeinderat tagt</h1><p>Der Gemeinderat tritt am kommenden Mittwoch um 19 Uhr zu einer öffentlichen Sitzung zusammen.</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p></article>',
  '<div class="news-list-date">09.10.2026</div><h1>Gemeinderat</h1><p>Am Mittwoch um 19:00 Uhr findet im Rathaus eine öffentliche Sitzung des Gemeinderates statt.</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p>',
  '<h1>09.10.2026: Einladung zur öffentlichen Sitzung des Gemeinderates</h1><p>am Mittwoch, 19 Uhr</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p>',
  '<ol class="breadcrumb"><li>Start</li><li>09.10.2026</li></ol><h1>Gemeinderat tagt</h1><p>Der Gemeinderat tritt am kommenden Mittwoch um 19 Uhr zu einer öffentlichen Sitzung zusammen.</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p>',
  '<article><p class="date">09.10.2026</p><h1>Bauausschuss</h1><p>Der Bauausschuss tagt am Dienstag nächster Woche um 18 Uhr in öffentlicher Sitzung.</p><p>1. Bauantrag Kita<br>2. Haushalt 2027</p></article>'].map((main,n)=>({id:`r5-news-posting-date-${n+1}`,round:'r5',doc:'html',label:'Sitzung Gemeinderat',text:page(main),forbid:[],date:'2026-10-14'})),
 // a note that moves the meeting, below the items or in a box above the heading
 ...['<h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>1. Bauantrag Kita<br>2. Haushalt 2027</p><p><strong>Achtung: Die Sitzung wird auf Mittwoch, 21.10.2026 verschoben.</strong></p>',
  '<div class="alert">Terminänderung: neuer Termin 21.10.2026</div><h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026, 19:00 Uhr</h1><p>1. Bauantrag Kita<br>2. Haushalt 2027</p>'].map((main,n)=>({id:`r5-moved-note-${n+1}`,round:'r5',doc:'html',label:'Sitzung Gemeinderat',text:page(main),forbid:[],date:'2026-10-21'})),
);
closedLabels.push('Niederschrift GR 16.09.2026 (nur Ratsmitglieder)','Sitzungsprotokoll Gemeinderat 16.09.2026 (GR-intern)','Niederschrift GR 16.09.2026 (Interna)');
closedPaths.push('/fileadmin/protokolle/gr-2026-09-16_nur-ratsmitglieder.pdf','/fileadmin/protokolle/intern/gr-2026-09-16.pdf','/ratsmitglieder/protokolle/gr-2026-09-16.pdf');
closedRedirects.push('fileadmin/protokolle/gr-2026-09-16_nur-ratsmitglieder.pdf','fileadmin/protokolle/intern/gr-2026-09-16.pdf','ratsmitglieder/protokolle/gr-2026-09-16.pdf');
cases.push(
 // a part heading written by unpdf without its space ("TeilB")
 r5pdf('r5-pdf-teilb',`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:00 Uhr
Teil A (öffentlich)
1. Genehmigung der Niederschrift
2. Bauantrag Kita
TeilB
3. Grundstücksverkauf Fl.Nr. 412
4. Personalangelegenheit`,{allow:GNK,forbid:[...NP4,'Teil']}),
);
