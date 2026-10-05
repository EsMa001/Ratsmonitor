import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectAllris3,calendarProgram,refusedProgram,declaredCharset,parseAllris3Calendar,parseAllris3Agenda,parseAllris3Paper,collectAllris3} from '../server/integrations/allris3.mjs';
import {fetchText} from '../server/integrations/sessionnet.mjs';
import {SOURCE_USER_AGENT} from '../server/integrations/no-redirect.mjs';
// Excerpts of live pages read on 04.10.2026: Landkreis Osnabrück (responsive _r), Stadt Regensburg (classic si010),
// Gemeinde Hohenhameln (classic, two meetings on one day), Stadt Neustadt in Holstein (si010_e, non-public items),
// Stadt Westerstede (menu of the start page), Gemeinde Giesen (_r inside the municipality's page, ISO-8859-15).
const page=name=>readFileSync(new URL('./fixtures/allris3/'+name,import.meta.url),'utf8');
const now=new Date('2026-10-04T12:00:00Z');
const lkos={id:'nds-03459',name:'Landkreis Osnabrück',kind:'district',method:'scraper',adapter:'allris3',base:'https://kis.lkos.de/bi/',calendar:'si010_r.asp'};
const rgb={id:'de-09362000',name:'Stadt Regensburg',kind:'city',method:'scraper',adapter:'allris3',base:'https://srv19.regensburg.de/bi/',calendar:'si010.asp'};
const giesen={id:'nds-03254017',name:'Gemeinde Giesen',kind:'city',method:'scraper',adapter:'allris3',base:'https://www.giesen.de/buergerinformationssystem/',calendar:'si010_r.asp'};
const refusal=program=>`Zugriff verweigert (Programm ${program}).<br>`;
const withoutRows=html=>html.replace(/<tbody>[\s\S]*<\/tbody>/,'<tbody></tbody>');
test('ALLRIS 3 is recognised from the linked page; the calendar program is the one the installation names',()=>{
 assert.deepEqual(detectAllris3('https://kis.lkos.de/bi/si010_r.asp',page('lkos-si010_r.html')),{base:'https://kis.lkos.de/bi/',calendar:'si010_r.asp'});
 assert.deepEqual(detectAllris3('https://srv19.regensburg.de/bi/si010.asp?MM=9&YY=2026',page('rgb-si010.html')),{base:'https://srv19.regensburg.de/bi/',calendar:'si010.asp'});
 assert.deepEqual(detectAllris3('https://www.giesen.de/buergerinformationssystem/si010_r.asp',page('gie-si010_r.html')),{base:'https://www.giesen.de/buergerinformationssystem/',calendar:'si010_r.asp'});
 // Any page of the installation names the program in its menu; the refusal of a program names none.
 assert.deepEqual(detectAllris3('https://ris.westerstede.de/bi/allris.net.asp',page('wst-allris.net.html')),{base:'https://ris.westerstede.de/bi/',calendar:'si010_e.asp'});
 assert.deepEqual(detectAllris3('https://ris.stadt-neustadt.eu/bi/to010.asp?SILFDNR=3345',page('nsh-to010.html')),{base:'https://ris.stadt-neustadt.eu/bi/',calendar:'si010_e.asp'});
 assert.deepEqual(detectAllris3('https://ris.westerstede.de/bi/si010_r.asp',refusal('si010_r.asp')),{base:'https://ris.westerstede.de/bi/',calendar:null});
 assert.equal(calendarProgram(page('wst-allris.net.html')),'si010_e.asp');assert.equal(calendarProgram(refusal('si010.asp')),null);
 assert.equal(refusedProgram(refusal('si010_r.asp')),'si010_r.asp');assert.equal(refusedProgram(page('rgb-si010.html')),null);
 assert.equal(refusedProgram('Zugriff verweigert (Programm /buergerinformationssystem2/si010.asp).<br>'),'si010.asp');
 // Wernigerode: the navigation of the municipality's website around the calendar links an installation in another folder.
 const wrapped='<html><head><meta charset="ISO-8859-15"></head><body><ul><li><a href="https://www.wernigerode.de/buergerinformationssystem/si010.asp" target="_top">Sitzungskalender</a></li></ul><div id="allris" class="si010 normal"><a href="/buergerinformationssystem2/si010_r.asp">Kalender</a></div></body></html>';
 assert.equal(calendarProgram(wrapped,'https://www.wernigerode.de/buergerinformationssystem2/'),'si010_r.asp');assert.equal(calendarProgram(wrapped),'si010.asp');
 assert.deepEqual(detectAllris3('https://www.wernigerode.de/buergerinformationssystem2/allris.net.asp',wrapped),{base:'https://www.wernigerode.de/buergerinformationssystem2/',calendar:'si010_r.asp'});
 // The members' login leads to the public folder next to it; its own links are not the public calendar.
 assert.deepEqual(detectAllris3('https://ris.hohenhameln.de/ri/logon.asp','<html><title>ALLRIS net</title><link rel="shortcut icon" href="images/ALLRIS.ico" /><a href="si010.asp">Kalender</a></html>'),{base:'https://ris.hohenhameln.de/bi/',calendar:null});
 // A folder address that only frames the start page; a page of the municipality's website that links the calendar.
 assert.deepEqual(detectAllris3('https://www.sehnde.de/bi/','<html><frameset><frame src="allris.net.asp" name="main"></frameset></html>'),{base:'https://www.sehnde.de/bi/',calendar:null});
 assert.deepEqual(detectAllris3('https://www.sehnde.de/stadt/politik/politische-sitzungen/','<html><title>politische Sitzungen | Stadt Sehnde</title><a href="https://www.sehnde.de/allris/si010_e.asp">Sitzungskalender</a><a href="https://www.sehnde.de/allris/si018_a.asp">Recherche</a></html>'),{base:'https://www.sehnde.de/allris/',calendar:'si010_e.asp'});
 // ALLRIS 4, SessionNet, a page linking another host, and a page without ALLRIS are no ALLRIS 3.
 assert.equal(detectAllris3('https://ratsinfo.example.test/public/si010','<html><title>ALLRIS</title><span>Weiterleitung zu ALLRIS net</span><a href="./si010?MM=9&amp;YY=2026">September</a></html>'),null);
 assert.equal(detectAllris3('https://ris.example.test/bi/si0040.asp','<html><title>SessionNet</title><a href="si0057.asp?__ksinr=1">Rat</a></html>'),null);
 assert.equal(detectAllris3('https://www.example.test/politik/','<html><a href="https://other.example.test/bi/allris.net.asp">ALLRIS net</a></html>'),null);
 assert.equal(detectAllris3('https://www.example.test/bi/si010.asp','<html><h1>Seite nicht gefunden</h1></html>'),null);
});
test('ALLRIS 3 at folder addresses of a tenant; the members\' area leads to the public folder next to it',()=>{
 // Modelled on the Westerstede start page: a tenant folder of the ratsinfo-online hosting answers with the start page.
 const folder='https://ratsinfo-online.net/landkreismittelsachsen-bi/',start=page('wst-allris.net.html').replaceAll('/bi/allris.net.asp','/landkreismittelsachsen-bi/allris.net.asp');
 assert.deepEqual(detectAllris3(folder,start),{base:folder,calendar:'si010_e.asp'});
 // Login of a tenant (Saale-Holzland-Kreis) and of a plain ri/ folder: the public part is <name>-bi/ or bi/.
 const login='<html><title>ALLRIS net</title><link rel="shortcut icon" href="images/ALLRIS.ico" /><form action="logon.asp" method="post"></form></html>';
 assert.deepEqual(detectAllris3('https://ssl.ratsinfo-online.net/landkreisshk-ri/logon.asp',login),{base:'https://ssl.ratsinfo-online.net/landkreisshk-bi/',calendar:null});
 assert.deepEqual(detectAllris3('https://www.harsefeld.sitzung-online.de/ri/logon.asp',login),{base:'https://www.harsefeld.sitzung-online.de/bi/',calendar:null});
 assert.deepEqual(detectAllris3('https://www.example.test/rat_ri/logon.asp',login),{base:'https://www.example.test/rat_bi/',calendar:null});
 // A folder address in the members' area that frames the login or the start page (Glienicke/Nordbahn, Diekholzen type).
 assert.deepEqual(detectAllris3('https://ratsinfo-online.de/glienicke-ri/','<html><title>ALLRIS net</title><frameset><frame src="logon.asp" name="main"></frameset></html>'),{base:'https://ratsinfo-online.de/glienicke-bi/',calendar:null});
 assert.deepEqual(detectAllris3('https://www.example.test/ri/','<html><frameset><frame src="allris.net.asp" name="main"></frameset><link rel="shortcut icon" href="images/ALLRIS.ico" /></html>'),{base:'https://www.example.test/bi/',calendar:null});
 // A public page whose menu offers the members' login keeps its own folder; a login link alone without ALLRIS marks is nothing.
 assert.deepEqual(detectAllris3('https://ris.westerstede.de/bi/allris.net.asp',page('wst-allris.net.html').replace('</ul>\n</div>','<li><a href="../ri/logon.asp">Anmelden</a></li></ul>\n</div>')),{base:'https://ris.westerstede.de/bi/',calendar:'si010_e.asp'});
 assert.equal(detectAllris3('https://www.example.test/politik/','<html><a href="https://www.example.test/ri/logon.asp">Login für Ratsmitglieder</a></html>'),null);
 // A folder name that only ends in "ri" (…/bri/) is no members' area.
 assert.deepEqual(detectAllris3('https://www.example.test/bri/allris.net.asp',page('wst-allris.net.html')),{base:'https://www.example.test/bri/',calendar:'si010_e.asp'});
});
test('ALLRIS 3 calendar: classic and responsive months, further meetings of a day, only meetings with a public agenda',()=>{
 const url=(source,n,program='to010_r.asp')=>source.base+program+'?SILFDNR='+n;
 assert.deepEqual(parseAllris3Calendar(page('lkos-si010_r.html'),lkos,{year:2026,month:9}),[
  {url:url(lkos,1601),date:'2026-09-01',name:'Sitzung des Ausschusses für Personal und Organisation'},
  {url:url(lkos,1561),date:'2026-09-02',name:'Sitzung des Ausschusses für Soziales, Senioren und Gleichstellung'},
  {url:url(lkos,1575),date:'2026-09-03',name:'Sitzung des Ausschusses für Planen und Bauen'},
  {url:url(lkos,1543),date:'2026-09-28',name:'Sitzung des Kreistages des Landkreises Osnabrück'}]);
 assert.deepEqual(parseAllris3Calendar(page('rgb-si010.html'),rgb,{year:2026,month:9}).map(m=>[m.url,m.date]),[[url(rgb,2665,'to010.asp'),'2026-09-17'],[url(rgb,2667,'to010.asp'),'2026-09-22']]);
 const hoh={...rgb,base:'https://ris.hohenhameln.de/bi/'};
 assert.deepEqual(parseAllris3Calendar(page('hoh-si010.html'),hoh,{year:2026,month:9}).map(m=>[m.url,m.date,m.name]),[[url(hoh,1206,'to010.asp'),'2026-09-03','Sitzung des Ortsrates Harber'],[url(hoh,1207,'to010.asp'),'2026-09-03','Sitzung des Ortsrates Hohenhameln']]);
 // Links given as absolute paths (Giesen) stay inside the approved folder.
 assert.deepEqual(parseAllris3Calendar(page('gie-si010_r.html'),giesen,{year:2026,month:9}).map(m=>[m.url,m.date]),[[url(giesen,2160),'2026-09-02'],[url(giesen,2142),'2026-09-07']]);
 assert.throws(()=>parseAllris3Calendar(page('gie-si010_r.html').replaceAll('/buergerinformationssystem/to010_r','/andere/to010_r'),giesen,{year:2026,month:9}),/Nicht freigegebene/);
 assert.equal(parseAllris3Calendar(refusal('si010.asp'),rgb,{year:2026,month:9}),null);
});
test('ALLRIS 3 responsive agenda: header spans, the doubled table opening, items keyed by item and paper number',()=>{
 const meeting={url:lkos.base+'to010_r.asp?SILFDNR=1543',date:'2026-09-28',name:'Sitzung des Kreistages'};
 const read=parseAllris3Agenda(page('lkos-to010_r.html'),meeting,lkos,now);
 assert.equal(read.date,'2026-09-28');assert.equal(read.committee,'Kreistag des Landkreises Osnabrück');
 assert.deepEqual(read.items.map(i=>[i.id,i.agenda.number,i.title,i.reference,i.status,i.sourceUrl]),[
  ['nds-03459-top-24115','Ö 1','Sitzungseröffnung','','unknown',meeting.url],
  ['nds-03459-top-24118','Ö 2','Genehmigung des Protokolls der Sitzung vom 29.06.2026','','unknown',meeting.url],
  ['nds-03459-vo-3999','Ö 3.1','Antrag der GRÜNE/FDP/CDW-Gruppe','VO/2026/171','unknown',lkos.base+'vo020_r.asp?VOLFDNR=3999'],
  ['nds-03459-vo-4010','Ö 7','Fortführung Lütti in Bramsche und Melle / Förderung ODV in kreisangehörigen Kommunen','VO/2026/181','unknown',lkos.base+'vo020_r.asp?VOLFDNR=4010']]);
 assert.equal(read.items[2].agenda.top,'24130');assert.match(read.items[2].event.publicEvidence,/„Ö 3.1“/);
 // A meeting that is still ahead is announced, never decided.
 assert.deepEqual(parseAllris3Agenda(page('lkos-to010_r.html').replace('28.09.2026</a>','20.10.2026</a>'),meeting,lkos,now).items.map(i=>i.status),['announced','announced','consulting','consulting']);
 assert.equal(parseAllris3Agenda('<html><h1 class="title">Kreisausschuss - 21.09.2026</h1><span id="sidatum">21.09.2026</span></html>',meeting,lkos,now),null);
});
test('ALLRIS 3 classic agenda: result from the item button, non-public items skipped wherever they stand',()=>{
 const meeting={url:rgb.base+'to010.asp?SILFDNR=2667',date:'2026-09-22',name:'Sitzung'};
 const read=parseAllris3Agenda(page('rgb-to010.html'),meeting,rgb,now);
 assert.equal(read.committee,'Ausschuss für Stadtplanung, Verkehr und Wohnungsfragen');assert.equal(read.date,'2026-09-22');
 assert.deepEqual(read.items.map(i=>[i.id,i.reference,i.event.result,i.status,i.event.description]),[
  ['de-09362000-top-65837','','','unknown','Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.'],
  ['de-09362000-vo-22821','VO/26/23344/63','ungeändert beschlossen','recommended','Ergebnis laut Tagesordnung: ungeändert beschlossen'],
  ['de-09362000-vo-22820','VO/26/23343/D2','ungeändert beschlossen','recommended','Ergebnis laut Tagesordnung: ungeändert beschlossen'],
  ['de-09362000-vo-22826','VO/26/23349/63','geändert beschlossen','recommended','Ergebnis laut Tagesordnung: geändert beschlossen']]);
 assert.deepEqual(read.items[0].identityLinks,[rgb.base+'to020.asp?TOLFDNR=65837']);assert.equal(read.items[0].sourceUrl,rgb.base+'to020.asp?TOLFDNR=65837');
 assert.deepEqual(read.items[2].identityLinks,[rgb.base+'vo020.asp?VOLFDNR=22820',rgb.base+'to020.asp?TOLFDNR=65866']);
 assert.match(read.items[3].title,/^Antrag auf Berichterstattung zur Baugenehmigung .*Antrag von Hr\. Stadtrat Friedl vom 27\.07\.2026$/);
 // Only the council decides; the same result of a committee is a recommendation.
 assert.equal(parseAllris3Agenda(page('rgb-to010.html').replace('>Ausschuss für Stadtplanung, Verkehr und Wohnungsfragen</a>','>Stadtrat</a>'),meeting,rgb,now).items[1].status,'approved');
 const nsh={...rgb,id:'de-01055032',base:'https://ris.stadt-neustadt.eu/bi/'};
 const later=parseAllris3Agenda(page('nsh-to010.html'),{url:nsh.base+'to010.asp?SILFDNR=3345',date:'2026-09-02',name:'Hauptausschuss'},nsh,now);
 assert.equal(later.committee,'Hauptausschuss');assert.equal(later.date,'2026-09-02');
 assert.deepEqual(later.items.map(i=>[i.agenda.number,i.title,i.reference,i.status]),[
  ['Ö 3','Niederschrift der Sitzung vom 19.08.2026','','unknown'],['Ö 4','Bericht über die Umsetzung von Beschlüssen','','unknown'],['Ö 6','Haushaltsprognose Juni 2026','VO/3561/26','info'],['Ö 15','Bekanntgabe der in nichtöffentlicher Sitzung gefassten Beschlüsse','','unknown']]);
 assert.ok(!JSON.stringify(later).includes('28742')&&!JSON.stringify(later).includes('nichtöffentlich)'),'items numbered N are never taken');
});
test('ALLRIS 3 paper page: fields without people, document program addresses, results per meeting',()=>{
 const detail=parseAllris3Paper(page('lkos-vo020_r.html'),lkos);
 assert.deepEqual(detail.fields,[{field:'Betreff',value:'Fortführung Lütti in Bramsche und Melle / Förderung ODV in kreisangehörigen Kommunen'},{field:'Status',value:'öffentlich'},{field:'Vorlage-Art',value:'öffentliche Beschlussvorlage'},{field:'Federführend',value:'BEVOS Beteiligungs- und Vermögensverwaltungsgesellschaft mbH'}]);
 assert.deepEqual(detail.documents,[{title:'Vorlage',url:lkos.base+'do027.asp?DOLFDNR=168137&options=64',kind:'application/pdf'},{title:'Vorlage-Sammeldokument',url:lkos.base+'do027.asp?DOLFDNR=168144&options=64&typ=130',kind:'application/pdf'}]);
 // The meeting of the Kreisausschuss is not public: it has no link and is not named.
 assert.deepEqual(detail.consultations,[{meeting:'1575',top:'24060',date:'2026-09-03',result:'ungeändert beschlossen'},{meeting:'1543',top:null,date:'2026-09-28',result:''}]);
 assert.ok(!/Kebschull|Opitz|Beschluss:/.test(JSON.stringify(detail)));
 const restricted=parseAllris3Paper(page('lkos-vo020_r.html').replace('id="vostatus">öffentlich','id="vostatus">nichtöffentlich'),lkos);assert.equal(restricted.restricted,true);assert.deepEqual(restricted.documents,[]);
 const classic=parseAllris3Paper(page('rgb-vo020.html').replace('</form>  ','</form><a href="___tmp/tmp/45-181-136/8RF5OvCG/bWKGeBrd/42-Anlagen/01/Konzept.pdf" target="_blank">Konzept</a>'),rgb);
 assert.deepEqual(classic.fields,[{field:'Betreff',value:'Förderprojekt "Klimaanpassung in Regensburg - Resilienz erfahrbar machen" (KlaR) - Abschlussbericht'},{field:'Status',value:'öffentlich'},{field:'Vorlage-Art',value:'Beschlussvorlage'},{field:'Federführend',value:'Direktorium 2'}]);
 // Forms become plain addresses of the document program; temporary attachment addresses are not kept.
 assert.deepEqual(classic.documents,[{title:'Vorlage',url:rgb.base+'do027.asp?DOLFDNR=451003&options=64',kind:'application/pdf'},{title:'Vorlage-Sammeldokument',url:rgb.base+'do027.asp?DOLFDNR=451004&options=64&typ=130',kind:'application/pdf'}]);
 assert.deepEqual(classic.consultations,[{meeting:'2667',top:'65866',date:'2026-09-22',result:'ungeändert beschlossen'},{meeting:'2669',top:'65857',date:'2026-09-24',result:'ungeändert beschlossen'}]);
 assert.ok(!/Sigloch|Sachverhalt|checkClickResult/.test(JSON.stringify(classic)));
});
test('ALLRIS 3 pages are decoded with the character set they declare first, also ISO-8859-15',async()=>{
 const url=giesen.base+'si010_r.asp?MM=9&YY=2026',bytes=Buffer.from(page('gie-si010_r.html'),'latin1');
 const answer=(body,type='text/html')=>async()=>new Response(body,{status:200,headers:{'content-type':type}});
 assert.doesNotMatch(await fetchText(url,giesen,5000,answer(bytes)),/Groß Förste/,'fetchText alone does not know the quoted -15 declaration');
 assert.match(await fetchText(url,giesen,5000,declaredCharset(answer(bytes))),/Sitzung des Ortsrates Groß Förste/);
 // The first declaration counts; embedded parts may declare UTF-8 further down.
 assert.match(await fetchText(url,giesen,5000,declaredCharset(answer(Buffer.from('<?xml version="1.0" encoding="iso-8859-1"?><html><script charset="UTF-8"></script><p>Kreistag Osnabrück</p></html>','latin1')))),/Osnabrück/);
 assert.match(await fetchText(url,giesen,5000,declaredCharset(answer(Buffer.from('<html><meta charset="utf-8"><p>Kreistag Osnabrück</p></html>','utf8')))),/Osnabrück/);
 const typed=new Response('x',{headers:{'content-type':'text/html; charset=utf-8'}});assert.equal(await declaredCharset(async()=>typed)(url,{}),typed);
});
// Landkreis Osnabrück on 04.10.2026 with the window "1 Monat": September from the 4th, October, November.
const lkosWeb=()=>{
 const month=n=>lkos.base+`si010_r.asp?MM=${n}&YY=2026`,meeting=n=>lkos.base+'to010_r.asp?SILFDNR='+n,paper=n=>lkos.base+'vo020_r.asp?VOLFDNR='+n;
 const calendar=page('lkos-si010_r.html');
 const pages={
  [month(11)]:withoutRows(calendar),
  [month(10)]:calendar.replace(/<tbody>[\s\S]*<\/tbody>/,'<tbody><tr class="tue odd"><td class="nowrapContent"><span class="dow">Di</span><span class="dom">20</span></td><td class="time"><div>15:00</div></td><td class="textCol"><a href="to010_r.asp?SILFDNR=1650">Sitzung des Kreisausschusses</a></td></tr></tbody>'),
  [month(9)]:calendar,
  [meeting(1543)]:page('lkos-to010_r.html'),
  [meeting(1650)]:'<html><h1 class="title">Kreisausschuss - 20.10.2026</h1><span class="text4" id="sidatum">Di, 20.10.2026</span></html>',
  [paper(4010)]:page('lkos-vo020_r.html'),
  // The amended motion was rejected by the Kreistag: the consultation names the meeting, not the item.
  [paper(3999)]:page('lkos-vo020_r.html').replace('VOLFDNR=4010','VOLFDNR=3999').replace(/(SILFDNR=1543">[\s\S]*?<div>)(<\/div>)/,'$1mehrheitlich abgelehnt$2').replace('Fortführung Lütti in Bramsche und Melle / Förderung ODV in kreisangehörigen Kommunen</span>','Antrag der GRÜNE/FDP/CDW-Gruppe</span>'),
 };
 const calls=[];return {pages,calls,month,meeting,paper,get:async url=>{calls.push(url);if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];}};
};
test('ALLRIS 3 collector reads the released calendar, public agendas and each paper once, results from the paper',async()=>{
 const web=lkosWeb();const d=await collectAllris3(lkos,{now,get:web.get,window:'1m'});
 assert.deepEqual(web.calls.slice(0,3),[web.month(11),web.month(10),web.month(9)]);
 assert.ok(web.calls.every(u=>u.startsWith(lkos.base)));assert.equal(web.calls.filter(u=>u===web.paper(4010)).length,1);
 assert.ok(!web.calls.includes(web.meeting(1601))&&!web.calls.includes(web.meeting(1575)),'meetings before the window are not read');
 assert.equal(d.coverage.method,'scraper');assert.equal(d.coverage.meetings,1);assert.equal(d.coverage.upcomingWithoutAgenda,1);assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.complete,true);
 assert.equal(d.coverage.from,'2026-09-04');assert.equal(d.coverage.sourceUrl,lkos.base);assert.equal(d.readMeetings,1);assert.deepEqual(Object.keys(d.marks),[web.meeting(1543)]);
 assert.deepEqual(d.topics.map(t=>[t.id,t.status]).sort(),[['nds-03459-top-24115','unknown'],['nds-03459-top-24118','unknown'],['nds-03459-vo-3999','rejected'],['nds-03459-vo-4010','unknown']]);
 const motion=d.topics.find(t=>t.id==='nds-03459-vo-3999');
 assert.deepEqual(motion.events.map(e=>[e.date,e.committee,e.result,e.description,e.decision.kind]),[['2026-09-28','Kreistag des Landkreises Osnabrück','mehrheitlich abgelehnt','Ergebnis laut Beratungsfolge: mehrheitlich abgelehnt','decision']]);
 const lutti=d.topics.find(t=>t.id==='nds-03459-vo-4010');
 assert.deepEqual(lutti.documents.map(x=>x.url),[lkos.base+'do027.asp?DOLFDNR=168137&options=64',lkos.base+'do027.asp?DOLFDNR=168144&options=64&typ=130',web.paper(4010)]);
 assert.equal(lutti.regionId,lkos.id);assert.equal(lutti.source,'district');assert.equal(lutti.reference,'VO/2026/181');assert.equal(lutti.eventDate,'2026-09-28');assert.equal(lutti.public,true);
 assert.equal(lutti.sourceData.method,'allris3');assert.deepEqual(lutti.sourceData.records.map(r=>r.kind),['agenda','paper']);assert.equal(lutti.events[0].attendance.status,'not_collected');
 assert.match(lutti.longSummary[0],/Landkreis Osnabrück/);assert.ok(!JSON.stringify(d).includes('Opitz'));
});
test('ALLRIS 3 collector skips meetings whose agenda is unchanged since their papers were read',async()=>{
 const web=lkosWeb();const first=await collectAllris3(lkos,{now,get:web.get,window:'1m'});
 const later=new Date(now.getTime()+16*86400000),stock=new Set(Object.keys(first.marks));
 web.pages[lkos.base+'si010_r.asp?MM=12&YY=2026']=withoutRows(page('lkos-si010_r.html'));web.calls.length=0;
 const second=await collectAllris3(lkos,{now:later,get:web.get,window:'1m',marks:{known:first.marks,stock}});
 assert.equal(second.coverage.unchangedMeetings,1);assert.equal(second.topics.length,0);assert.ok(!web.calls.includes(web.paper(4010)));assert.equal(second.coverage.complete,true);
 web.pages[web.meeting(1543)]=web.pages[web.meeting(1543)].replace('Sitzungseröffnung','Eröffnung');web.calls.length=0;
 const changed=await collectAllris3(lkos,{now:later,get:web.get,window:'1m',marks:{known:first.marks,stock}});
 assert.ok(web.calls.includes(web.paper(4010)));assert.equal(changed.topics.length,4);
 // Out of time on a paper: the meeting is not marked and the import can be resumed.
 const cut=await collectAllris3(lkos,{now,window:'1m',get:async url=>url===web.paper(4010)?Promise.reject(Error('Zeitbudget der Quelle erreicht')):web.get(url)});
 assert.equal(cut.coverage.resumable,true);assert.deepEqual(cut.marks,{});assert.ok(cut.coverage.issues.some(i=>/Zeitbudget der Quelle erreicht; 1 Sitzung/.test(i)));
});
test('ALLRIS 3 collector without a calendar program takes it from the start page; classic results from the agenda',async()=>{
 const source={...rgb};delete source.calendar;
 const month=n=>rgb.base+`si010.asp?MM=${n}&YY=2026`,meeting=n=>rgb.base+'to010.asp?SILFDNR='+n;
 const pages={[rgb.base+'allris.net.asp']:page('wst-allris.net.html').replace('href="si010_e.asp"','href="si010.asp"'),[month(11)]:page('rgb-si010.html').replace(/<tr class="zl12" valign="top">[\s\S]*<\/tr>/,''),[month(10)]:page('rgb-si010.html').replace(/<tr class="zl12" valign="top">[\s\S]*<\/tr>/,''),[month(9)]:page('rgb-si010.html'),
  [meeting(2667)]:page('rgb-to010.html'),[meeting(2665)]:page('rgb-to010.html').replace(/<table class="tl1"[\s\S]*<\/table>/,'').replace('22.09.2026','17.09.2026')};
 for(const n of [22821,22820,22807,22826])pages[rgb.base+'vo020.asp?VOLFDNR='+n]=page('rgb-vo020.html');
 const calls=[];const d=await collectAllris3(source,{now,window:'1m',get:async url=>{calls.push(url);if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];}});
 assert.deepEqual(calls.slice(0,4),[rgb.base+'allris.net.asp',month(11),month(10),month(9)]);assert.ok(!calls.some(u=>/si010_[a-z]\.asp/.test(u)),'no other calendar variant is tried');
 assert.deepEqual(d.coverage.issues,[]);assert.deepEqual(d.coverage.warnings,['Sitzung ohne veröffentlichte Tagesordnung: '+meeting(2665)]);assert.equal(d.coverage.complete,true);assert.equal(d.coverage.meetings,2);
 const klar=d.topics.find(t=>t.id==='de-09362000-vo-22820');
 assert.deepEqual(klar.events.map(e=>[e.date,e.committee,e.status,e.result,e.description]),[['2026-09-22','Ausschuss für Stadtplanung, Verkehr und Wohnungsfragen','recommended','ungeändert beschlossen','Ergebnis laut Tagesordnung: ungeändert beschlossen']]);
 assert.deepEqual(klar.sourceData.records[1].fields.map(f=>f.field),['Betreff','Status','Vorlage-Art','Federführend']);
});
test('ALLRIS 3 collector ends at a refused program and does not try other variants',async()=>{
 const asked=[];const d=await collectAllris3({...giesen,calendar:'si010_r.asp'},{now,window:'12m',get:async url=>{asked.push(url);return refusal('si010_r.asp');}});
 assert.equal(asked.length,1);assert.equal(d.topics.length,0);assert.equal(d.coverage.quiet,false);assert.equal(d.coverage.complete,false);assert.match(d.coverage.issues[0],/Programm si010_r\.asp ist auf dieser Installation nicht freigegeben/);
 const menu=[];const none=await collectAllris3({...giesen,calendar:undefined},{now,window:'1m',get:async url=>{menu.push(url);return '<html><div id="allriscontainer"><a href="au010.asp">Gremien</a></div></html>';}});
 assert.deepEqual(menu,[giesen.base+'allris.net.asp']);assert.match(none.coverage.issues[0],/nennt keinen Sitzungskalender/);
 // The start page forwards to the calendar inside the municipality's website, which first links another folder.
 const forwarded=[];const giesenPage=page('gie-si010_r.html').replace('<body>','<body><a href="https://www.giesen.de/alt/si010.asp">Sitzungskalender</a>');
 await collectAllris3({...giesen,calendar:undefined},{now,window:'1m',get:async url=>{forwarded.push(url);return url.endsWith('allris.net.asp')?giesenPage:withoutRows(giesenPage);}});
 assert.deepEqual(forwarded.slice(0,2),[giesen.base+'allris.net.asp',giesen.base+'si010_r.asp?MM=11&YY=2026']);
 await assert.rejects(collectAllris3({...giesen,calendar:'../si010.asp'},{now,get:async()=>''}),/Unbekanntes Kalenderprogramm/);
 // A refused agenda program is not asked again once the refusal is known (two meetings are read side by side).
 const web=lkosWeb(),october=web.month(10);
 web.pages[october]=web.pages[october].replace('</tbody>','<tr class="thu odd"><td class="nowrapContent"><span class="dow">Do</span><span class="dom">22</span></td><td class="textCol"><a href="to010_r.asp?SILFDNR=1651">Sitzung des Jugendhilfeausschusses</a></td></tr></tbody>');
 for(const n of [1543,1650,1651])web.pages[web.meeting(n)]=refusal('to010_r.asp');
 const agendas=await collectAllris3(lkos,{now,window:'1m',get:web.get});
 assert.equal(web.calls.filter(u=>/to010_r/.test(u)).length,2);assert.equal(agendas.coverage.issues.filter(i=>/to010_r\.asp ist/.test(i)).length,1);assert.equal(agendas.coverage.complete,false);
});
test('ALLRIS 3 collector does not solve an access check and asks the OParl address of the system when told to',async()=>{
 const gate='<html><head><title>Zugriff pruefen</title><script src="/bi/_gate/assets/altcha.js"></script></head><body><altcha-widget challengeurl="/bi/_gate/challenge"></altcha-widget></body></html>';
 const asked=[];const d=await collectAllris3(lkos,{now,window:'12m',get:async url=>{asked.push(url);return gate;}});
 assert.equal(asked.length,1);assert.equal(d.coverage.resumable,undefined);assert.match(d.coverage.issues[0],/Zugriffsprüfung/);
 const web=lkosWeb();const read=await collectAllris3(lkos,{now,window:'1m',checkOparl:true,get:web.get});
 assert.equal(web.calls[0],lkos.base+'oparl/1.0/system.asp');assert.equal(read.topics.length,4);
 await assert.rejects(collectAllris3(lkos,{now,window:'1m',checkOparl:true,get:async()=>'{"type":"https://schema.oparl.org/1.1/System"}'}),/Adapterfreigabe/);
});
test('ALLRIS 3 collector through fetchText: one session, the project\'s user agent, pages in their declared character set',async()=>{
 const latin=s=>Buffer.from(s,'latin1'),month=n=>giesen.base+`si010_r.asp?MM=${n}&YY=2026`,meeting=giesen.base+'to010_r.asp?SILFDNR=2142';
 const agenda='<html><head><meta charset="ISO-8859-15"></head><body><div id="allris"><h1 class="title">Ortsrat Groß Förste - 07.09.2026</h1><span class="text4" id="sigremium">Ortsrat Groß Förste</span><span class="text4" id="sidatum">Mo, 07.09.2026</span><table class="dataTable toTable"><tbody><tr><td class="tonr"><a href="/buergerinformationssystem/to010_r.asp?SILFDNR=2142&TOLFDNR=900#beschluss">Ö 1</a></td><td class="tobetreff"><div>Bürgerfragestunde</td></tr></tbody></table></div></body></html>';
 const pages={[month(11)]:withoutRows(page('gie-si010_r.html')),[month(10)]:withoutRows(page('gie-si010_r.html')),[month(9)]:page('gie-si010_r.html'),[meeting]:agenda};
 const sent=[];
 const request=async(url,init)=>{sent.push({url,agent:init.headers['User-Agent'],cookie:init.headers.Cookie});if(!(url in pages))return new Response('',{status:404});return new Response(latin(pages[url]),{status:200,headers:[['content-type','text/html'],['set-cookie','ASPSESSIONIDCUDBTSDD=HGOF; secure; path=/']]});};
 const d=await collectAllris3(giesen,{now,window:'1m',request});
 assert.deepEqual(sent.map(s=>s.url),[month(11),month(10),month(9),meeting]);assert.ok(sent.every(s=>s.agent===SOURCE_USER_AGENT));
 assert.equal(sent[0].cookie,undefined);assert.ok(sent.slice(1).every(s=>s.cookie==='ASPSESSIONIDCUDBTSDD=HGOF'));
 assert.deepEqual(d.topics.map(t=>[t.id,t.title,t.committee]),[['nds-03254017-top-900','Bürgerfragestunde','Ortsrat Groß Förste']]);assert.deepEqual(d.coverage.issues,[]);
});

test('ALLRIS 3 collector reads only the bodies of one member of a shared system, by the name the calendar gives each meeting',async()=>{
 const web=lkosWeb();const d=await collectAllris3({...lkos,organizations:{exclude:['Kreistag']}},{now,get:web.get,window:'1m'});
 assert.ok(!web.calls.includes(web.meeting(1543)),'the meeting of the excluded body is not asked');
 // The Kreisausschuss of 20.10. is asked and has no agenda yet.
 assert.ok(web.calls.includes(web.meeting(1650)));assert.equal(d.coverage.meetings,0);assert.equal(d.coverage.upcomingWithoutAgenda,1);
 assert.ok(d.coverage.warnings.includes('1 Sitzungen anderer Gremien des gemeinsamen Systems ausgelassen.'));
 assert.ok(!d.topics.some(t=>t.events.some(e=>/Kreistag/.test(e.committee))));
});
