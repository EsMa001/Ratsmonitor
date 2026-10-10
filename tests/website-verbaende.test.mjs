import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sessionScore,SESSION_THRESHOLD,documentLinks,embeddedPdfs,isCmsFileUrl} from '../server/integrations/website-feeds.mjs';
import {parseSessionText,pdfLines,isNonPublicHeading} from '../server/integrations/website-text.mjs';
import {collectWebsite} from '../server/integrations/website.mjs';
// Everything here is NACHGEBILDET (made up for these tests): the way Verwaltungsgemeinschaften, Ämter and small towns publish
// notices (meeting service folders, gazette issues, a PDF in a frame, notices that end with "Anschließend nichtöffentliche
// Sitzung"), with invented places (Oberdorf, Musterstadt, Musterdorf) under *.example.test.
const fixture=name=>readFileSync(new URL(`./fixtures/website-verbaende/${name}`,import.meta.url),'utf8');
const origin='https://www.gemeinde-musterdorf.example.test';
const score=(path,label='')=>sessionScore({url:origin+path,label});
const ok=(path,label)=>assert.ok(score(path,label)>=SESSION_THRESHOLD,`${path} | ${label}: ${score(path,label)}`);
const no=(path,label)=>assert.ok(score(path,label)<SESSION_THRESHOLD,`${path} | ${label}: ${score(path,label)}`);

test('a PDF in the folder of the meeting service, named only by its date, is a document of a meeting',()=>{
 // Amt style: /pdf/sitzungsdienst/<Gemeinde>/<Gemeinde>_<dd_mm_yyyy>.pdf with the date as link text.
 ok('/pdf/sitzungsdienst/Oberdorf/Oberdorf_09_09_2026.pdf','09.09.2026');
 ok('/pdf/sitzungsdienst/Oberdorf/Oberdorf_09_09_2026.pdf','');
 // Not a date as link text: the folder alone does not make it one; the non-public part stays out in any case.
 no('/pdf/sitzungsdienst/Oberdorf/Satzung.pdf','Satzung der Gemeinde');
 no('/pdf/vordrucke/Antrag.pdf','09.09.2026');
 assert.equal(score('/pdf/sitzungsdienst/Oberdorf/Oberdorf_nichtoeffentlich_09_09_2026.pdf','09.09.2026'),-100);
 assert.equal(score('/pdf/sitzungsdienst/Oberdorf/Oberdorf_09_09_2026.pdf','09.09.2026 nicht öffentlich'),-100);
});

test('an issue of the gazette as PDF with its date is read, one without a date is only a lead',()=>{
 ok('/files/mitteilungsblatt/2026-41%20Mitteilungsblatt.pdf','Mitteilungsblatt vom 07. Oktober 2026');
 ok('/amtsblatt/Amtsblatt_2026-10-02.pdf','Amtsblatt');
 no('/files/mitteilungsblatt/aktuell.pdf','Aktuelle Ausgabe Mitteilungsblatt');
 no('/files/mitteilungsblatt/2026-41%20Mitteilungsblatt.html','Mitteilungsblatt vom 07. Oktober 2026');
});

test('a notice named by a body and a date is a document of a meeting, one named by nothing is not',()=>{
 ok('/buergerservice/stadtrat/assets/files/stadtrat_2024-2029/2026/Bekanntmachung%20SR%202026-09-24.pdf','SR 2026-09-24');
 // Short form of the body at the start of the file name (Höchstadt style).
 ok('/wp-content/uploads/2026/10/MGR-2026-060_Bekanntmachung_13.10.2026_Vermerk.pdf','Bekanntmachung');
 ok('/wp-content/uploads/2026/09/GV-2026-070_Bekanntmachung_28.09.2026_Vermerk.pdf','Bekanntmachung');
 no('/wp-content/uploads/2026/10/Bekanntmachung_Kanalarbeiten_05.10.2026.pdf','Kanalarbeiten – Sperrung');
 no('/wp-content/uploads/2026/10/Bekanntmachung_Wasserrecht_05.10.2026.pdf','Bekanntmachung');
 no('/buergerservice/stadtrat/assets/files/stadtrat_2024-2029/2026/Bekanntmachung%20Bebauungsplan.pdf','Bekanntmachung Bebauungsplan');
 no('/wp-content/uploads/2026/10/GR-Programm_13.10.2026.pdf','Programm');
 assert.equal(score('/wp-content/uploads/2026/10/MGR-2026-060_Bekanntmachung_13.10.2026_NOE.pdf','Bekanntmachung'),-100);
});

test('a PDF shown in a frame is a link to that PDF (PDF Embedder, viewer with ?file=), other frames are not',()=>{
 const html=fixture('artikel-pdf-eingebettet.html'),at=origin+'/aktuelles/bekanntmachung-der-gemeinderatssitzung/';
 assert.deepEqual(embeddedPdfs(html,at),[
  {url:origin+'/wp-content/uploads/Bekanntmachung-2026-10-13.pdf',label:'Bekanntmachung 2026-10-13'},
  {url:origin+'/wp-content/uploads/Einladung.pdf',label:'Viewer'}]);
 const links=documentLinks(html,at).filter(l=>l.kind==='pdf');
 assert.deepEqual(links.map(l=>l.url),[origin+'/wp-content/uploads/Bekanntmachung-2026-10-13.pdf',origin+'/wp-content/uploads/Einladung.pdf']);
 assert.equal(links[0].date,'2026-10-13');
 assert.deepEqual(embeddedPdfs('<iframe src="data:application/pdf;base64,AAAA"></iframe><iframe src="javascript:alert(1)"></iframe>',at),[]);
});

test('a notice that ends with "Anschließend nichtöffentliche Sitzung" gives the agenda before it as public part',()=>{
 const lines=pdfLines(fixture('einladung-anschliessend-np.txt'));
 const {meetings,issues}=parseSessionText(lines,{title:'',wrapped:true});
 assert.equal(meetings.length,1,JSON.stringify(issues));
 const m=meetings[0];
 assert.equal(m.date,'2026-10-08');assert.equal(m.unclear,false);
 assert.match(m.publicEvidence,/Anschließend nichtöffentliche Sitzung/);
 assert.equal(m.items.length,6);
 assert.match(m.items[0].title,/Dorfhalle/);
 // Without the closing note nothing marks the part as public: nothing is taken.
 const without=lines.filter(l=>!/nichtöffentliche/.test(l));
 const bare=parseSessionText(without,{title:'',wrapped:true}).meetings[0];
 assert.equal(bare.items.length,0);
 // The note must come after the items: before them it proves nothing about them.
 const before=[...lines.slice(0,6),'Anschließend findet eine nichtöffentliche Sitzung statt.',...lines.slice(6,12),...lines.slice(13)];
 assert.equal(parseSessionText(before,{title:'',wrapped:true}).meetings[0]?.items.length??0,0);
});

test('"Im Anschluss nichtöffentliche Sitzung" ends the public part like a heading, "Öffentlichkeits- und Behördenbeteiligung" is no secret',()=>{
 const {meetings,issues}=parseSessionText(pdfLines(fixture('einladung-oeffentlichkeits-und-behoerden.txt')),{title:'',wrapped:true});
 assert.deepEqual(issues,[]);
 assert.equal(meetings.length,1);
 assert.equal(meetings[0].unclear,false);
 assert.equal(meetings[0].items.length,4);
 assert.match(meetings[0].items[1].title,/Billigungsbeschluss/);
 assert.equal(meetings[0].items.some(i=>/nichtöffentlich/i.test(i.title)),false);
 assert.equal(isNonPublicHeading('Nichtöffentliche Sitzung'),true);
 // A real mention of the public stays suspect: "unter Ausschluss der Öffentlichkeit" inside the list is not covered by the new rule.
 const lines=pdfLines(fixture('einladung-oeffentlichkeits-und-behoerden.txt'));
 const risky=[...lines.slice(0,8),'Die Beratung erfolgt unter Ausschluss der Öffentlichkeit',...lines.slice(8)];
 assert.equal(parseSessionText(risky,{title:'',wrapped:true}).meetings[0].items.length<4,true);
});

test('the reader follows the PDF in a frame on a notice page whose title names the meeting',async()=>{
 const base=origin+'/',page=origin+'/aktuelles/bekanntmachung-der-gemeinderatssitzung/',pdf=origin+'/wp-content/uploads/Bekanntmachung-2026-10-13.pdf';
 const pages={
  [base+'robots.txt']:'',
  [base+'aktuelles/']:`<html><body><h1>Aktuelles</h1><ul><li><a href="${page}">Bekanntmachung der Gemeinderatssitzung am 13.10.2026</a></li></ul></body></html>`,
  [page]:fixture('artikel-pdf-eingebettet.html').replace(/<iframe[^>]*viewer[^>]*><\/iframe>/,''),
 };
 const text=`Gemeinde Musterdorf
BEKANNTMACHUNG
Einladung zur Sitzung des Gemeinderates
Am Dienstag, 13.10.2026 um 18:00 Uhr
findet im Sitzungssaal im Rathaus Musterdorf
eine öffentliche Sitzung statt.
Tagesordnung:
A.) Öffentlicher Teil
1. Eröffnung und Begrüßung
2. Aktuelle Bürgerfragestunde
3. Genehmigung des öffentlichen Sitzungsprotokolls vom 08.09.2026
4. Kommunale Wärmeplanung
B.) Nichtöffentlicher Teil
Gemeinde Musterdorf, den 07.10.2026`;
 const asked=[];
 const get=async url=>{asked.push(url);if(pages[url]===undefined)throw Error('Quelle antwortet mit HTTP 404');return pages[url];};
 // Article pages come as documents too (bytes of HTML); the PDF is stood in for by its text (pdfText is injected).
 const getBytes=async url=>{asked.push(url);
  if(url===pdf)return {bytes:new TextEncoder().encode('%PDF-1.7 x'),type:'application/pdf'};
  if(pages[url]!==undefined)return {bytes:new TextEncoder().encode(pages[url]),type:'text/html; charset=utf-8'};
  throw Error('Quelle antwortet mit HTTP 404');};
 const source={id:'de-09999002',name:'Gemeinde Musterdorf',kind:'city',method:'scraper',adapter:'website',base,pages:[base+'aktuelles/']};
 const d=await collectWebsite(source,{now:new Date('2026-10-09T10:00:00Z'),get,getBytes,pdfText:async()=>text,window:'3m',expectNames:['Musterdorf']});
 assert.equal(d.topics.length,4,JSON.stringify(d.coverage?.issues));
 assert.equal(d.coverage.namesArea,true);
 assert.ok(d.topics.every(t=>t.sourceUrl.startsWith(pdf)));
 assert.ok(asked.includes(pdf));
 assert.ok(asked.every(u=>u.startsWith(origin)),'only the site itself is asked');
});

const parse=(name,opts={})=>parseSessionText(pdfLines(fixture(name)),{title:'',wrapped:true,...opts});

test('"Eine nicht-öffentliche Sitzung schließt sich an." after a public Gemeinderatsitzung closes the agenda like "Anschließend nichtöffentliche Sitzung"',()=>{
 const {meetings}=parse('einladung-np-schliesst-sich-an.txt');
 assert.equal(meetings[0].unclear,false);
 assert.equal(meetings[0].items.length,5);
 assert.match(meetings[0].publicEvidence,/öffentliche/i);
 // A note before the items proves nothing about them.
 const lines=pdfLines(fixture('einladung-np-schliesst-sich-an.txt'));
 const moved=[...lines.slice(0,7),'Eine nichtöffentliche Sitzung schließt sich an.',...lines.slice(7,12),...lines.slice(13)];
 assert.ok((parseSessionText(moved,{title:'',wrapped:true}).meetings[0]?.items.length??0)<5);
});

test('an invitation of the citizens to a meeting is evidence of a public meeting only where nothing speaks of a closed part',()=>{
 const ok=parse('einladung-buerger-eingeladen.txt').meetings[0];
 assert.equal(ok.unclear,false);assert.equal(ok.items.length,4);
 assert.match(ok.publicEvidence,/Bürger/);
 const lines=pdfLines(fixture('einladung-buerger-eingeladen.txt'));
 // Any hint at a closed part, before or after the items, takes the evidence away.
 for(const hint of ['Im Anschluss folgt ein nichtöffentlicher Teil.','Die Beratung erfolgt unter Ausschluss der Öffentlichkeit.','Einzelne Punkte werden vertraulich behandelt.']){
  const withHint=[...lines.slice(0,3),hint,...lines.slice(3)];
  assert.equal(parseSessionText(withHint,{title:'',wrapped:true}).meetings[0]?.items.length??0,0,hint);
 }
});

test('the standing item "Bekanntgabe der in nichtöffentlicher Sitzung gefassten Beschlüsse … Gründe für Geheimhaltung weggefallen" is a public item, not a hint at a closed part',()=>{
 const {meetings}=parse('bekanntmachung-geheimhaltung-weggefallen.txt');
 assert.equal(meetings[0].unclear,false);
 assert.equal(meetings[0].items.length,5);
 // Another mention of secrecy between the items stays suspect.
 const lines=pdfLines(fixture('bekanntmachung-geheimhaltung-weggefallen.txt'));
 const risky=[...lines.slice(0,9),'Dieser Punkt wird vertraulich behandelt.',...lines.slice(9)];
 assert.ok((parseSessionText(risky,{title:'',wrapped:true}).meetings[0]?.items.length??0)<5);
});

test('headings of the parts with dashes ("- öffentlicher Sitzungsteil -") divide the agenda; "Beschlüsse des nichtöffentlichen Sitzungsteiles" is a public item',()=>{
 const {meetings}=parse('bekanntmachung-sitzungsteile-mit-strichen.txt');
 assert.equal(meetings[0].unclear,false);
 assert.equal(meetings[0].items.length,7);
 assert.equal(meetings[0].items.some(i=>/Vergabe|Grundstück|Personal/.test(i.title)),false);
 assert.equal(isNonPublicHeading('- nichtöffentlicher Sitzungsteil –'),true);
});

test('a public notice of the meeting without any hint at a closed part gives its agenda; one with a hint does not',()=>{
 const ok=parse('bekanntmachung-ohne-nichtoeffentlichen-teil.txt').meetings[0];
 assert.equal(ok.unclear,false);assert.equal(ok.items.length,5);
 assert.match(ok.publicEvidence,/Bekanntmachung/);
 const lines=pdfLines(fixture('bekanntmachung-ohne-nichtoeffentlichen-teil.txt'));
 for(const hint of ['Anschließend Sitzung unter Ausschluss der Öffentlichkeit.','Die Punkte 4 und 5 sind nichtöffentlich.','Hinweis: geheime Beratung möglich.']){
  const risky=[...lines.slice(0,8),hint,...lines.slice(8)];
  assert.equal(parseSessionText(risky,{title:'',wrapped:true}).meetings[0]?.items.length??0,0,hint);
 }
 // An invitation that does not call itself a notice is not covered.
 const invitation=lines.map(l=>/BEKANNTMACHUNG/i.test(l)?'Einladung zur Sitzung':l);
 assert.equal(parseSessionText(invitation,{title:'',wrapped:true}).meetings[0]?.items.length??0,0);
});

test('a "Bericht aus dem Gemeinderat" gives the items it reports; a text of another title does not',()=>{
 const lines=pdfLines(fixture('bericht-aus-dem-gemeinderat.txt'));
 const ok=parseSessionText(lines,{title:'',wrapped:true}).meetings[0];
 assert.equal(ok.unclear,false);assert.ok(ok.items.length>=2);
 const other=[...lines];other[0]='Niederschrift über die Sitzung vom 20.07.2026';
 assert.equal(parseSessionText(other,{title:'',wrapped:true}).meetings[0]?.items.length??0,0);
});

test('the file storage of the CMS publish.cmcitymedia.de counts as the website\'s own, like the one of verwaltungsportal.de',()=>{
 assert.equal(isCmsFileUrl('https://publish.cmcitymedia.de/news/getFile.php?id=1&file=a.pdf'),true);
 assert.equal(isCmsFileUrl('http://publish.cmcitymedia.de/news/getFile.php'),false);
 assert.equal(isCmsFileUrl('https://publish.cmcitymedia.de.example.test/x.pdf'),false);
 assert.equal(isCmsFileUrl('https://www.cmcitymedia.de/'),false);
});
