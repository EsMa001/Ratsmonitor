import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {collectSessionNet,fetchText,meetingRows,parseAgenda,parseAgendaCards,parseAgendaTopTable,sessionNetLandmark,sessionNetPageIssue,sessionNetClients,meetingClients,SESSIONNET_LOGIN,SESSIONNET_ERROR,SESSIONNET_SOURCE} from '../server/integrations/sessionnet.mjs';
// Excerpts of live pages, 04.10.2026 (see the comment at the top of each file).
const page=name=>fs.readFileSync(new URL('./fixtures/sessionnet-fixes/'+name,import.meta.url),'utf8');
const now=new Date('2026-10-04T12:00:00Z');
const halle={id:'de-15002000',name:'Stadt Halle (Saale)',kind:'city',base:'https://buergerinfo.halle.de/',extension:'asp'};
const schiffweiler={id:'de-10043116',name:'Gemeinde Schiffweiler',kind:'city',base:'https://biswl.rznk.de/',extension:'php'};
const sulzberg={id:'de-09780140',name:'Gemeinde Sulzberg',kind:'city',base:'https://buergerinfo-sulzberg.digitalfabrix.de/',extension:'asp'};
const file=url=>new URL(url).pathname.split('/').pop();
// Login and error pages as SessionNet serves them (Ludwigsburg 5.5.1 ri, Nürnberg 5.5.3, Schiffweiler 4.9.6),
// the unprocessed program code of Bockhorn and the start page of a CMS that echoes any requested address.
const LOGIN_PAGE='<!DOCTYPE html><html lang="de"><head><meta name="author" content="Somacos GmbH & Co. KG,https://www.somacos.de, SessionNet Version 5.5.1 ri (Layout 6)"><meta name="sessionnet" content="V:050501"/><title>SessionNet</title></head><body id="smc_body" class="smc-body">\n<!-- #wrapper --><div id="wrapper" class="smclayout smc-pagetype-logon smc_page_ylogon_layout2"></div></body></html>';
const ERROR_PAGE_6='<!DOCTYPE html><html lang="de"><head><meta name="author" content="Somacos GmbH & Co. KG,https://www.somacos.de, SessionNet Version 5.5.3 bi (Layout 6)"><meta name="sessionnet" content="V:050503"/><title>SessionNet | SessionNet Fehlermeldung</title></head><body id="smc_body" class="smc-body">\n<!-- #wrapper --><div id="wrapper" class="smclayout smc_page_error_layout"></div></body></html>';
const ERROR_PAGE_4='<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"><html lang="de"><head><meta http-equiv="content-type" content="text/html; charset=UTF-8"><meta name="Generator" content="Somacos GmbH & Co. KG,https://www.somacos.de, SessionNet Version 4.9.6 bi (Layout )"/><title>SessionNet Fehlermeldung</title></head><body style="text-align: center; font: 80% arial;"><img src="im/smclogo.jpg"><h1>SessionNet Fehlermeldung</h1><br><br>Die Fehlerinformation steht nicht mehr zur Verf&uuml;gung.</body></html>';
const PHP_SOURCE='<?\n//Festlegung der Art der SessionNet-Anwendung\n\n//Bürgerinfo: \n\n$gifunktion = 3;\n$gstrfeld = "bi";\n?><?\n/// Buergerinfo:\n$user_layout_version="h";\n';
// The landmark a stub calendar needs to count as a page of SessionNet itself.
const MARK='<meta name="sessionnet" content="V:050500"/>';
const SOFT_404='<!DOCTYPE html><html><head><title>de | VG Römerberg-Dudenhofen</title></head><body><script>ay(\'#search-2020-\\x2D65c91aeb\', {"contextPath":"","currentPath":"/sessionnet/si0040.asp/?__cjahr=2026&__cmonat=9"});</script><h1>Willkommen</h1></body></html>';

test('SessionNet landmark: real pages with version, part, layout and page; login, error and broken pages named; CMS echo is none',()=>{
 assert.deepEqual(sessionNetLandmark(page('halle-si0040.html')),{version:'5.3.3',part:'bi',layout:4,page:'si0040',issue:null});
 assert.deepEqual(sessionNetLandmark(page('schiffweiler-to0040.html')),{version:'4.9.6',part:'bi',layout:5,page:'to0040',issue:null});
 assert.equal(sessionNetLandmark(page('sulzberg-si0056.html')).page,'si0056');
 assert.deepEqual(sessionNetLandmark(LOGIN_PAGE),{version:'5.5.1',part:'ri',layout:6,page:'ylogon',issue:SESSIONNET_LOGIN});
 assert.equal(sessionNetLandmark(ERROR_PAGE_6).issue,SESSIONNET_ERROR);assert.equal(sessionNetLandmark(ERROR_PAGE_4).issue,SESSIONNET_ERROR);assert.equal(sessionNetLandmark(ERROR_PAGE_4).layout,null);
 assert.equal(sessionNetLandmark(SOFT_404),null,'an address echoed by a CMS is no SessionNet page');
 assert.equal(sessionNetLandmark(PHP_SOURCE),null);assert.equal(sessionNetPageIssue(PHP_SOURCE),SESSIONNET_SOURCE);
 assert.equal(sessionNetPageIssue(page('halle-si0040.html')),null);assert.equal(sessionNetPageIssue('<?xml version="1.0"?><rss/>'),null);
 // The product named in the text of a CMS page, a link to the system or a printed page class is no landmark; the
 // version counts only in the page head, and without the part it is still read.
 assert.equal(sessionNetLandmark('<html><body><h1>Neues Ratsinformationssystem</h1><p>Seit Mai nutzen wir SessionNet Version 5.5.1 bi (Layout 6).</p><a href="https://ris.example.de/bi/si0040.asp">Sitzungskalender</a></body></html>'),null);
 assert.equal(sessionNetLandmark('<p>Die Seite /sessionnet/si0040.asp (smc_page_si0040_layout) wurde nicht gefunden.</p>'),null);
 assert.deepEqual(sessionNetLandmark('<meta name="generator" content="SessionNet Version 5.5.2 (Layout 6)"><div class="smclayout smc_page_si0040_layout">'),{version:'5.5.2',part:null,layout:6,page:'si0040',issue:null});
});

test('older layout calendar: meetings linked to the agenda page to0040, a meeting linked twice is read once',()=>{
 const rows=meetingRows(page('halle-si0040.html'),halle.base);
 assert.deepEqual(rows.map(r=>[r.url,r.date,r.committee]),[[halle.base+'to0040.asp?__ksinr=21804','2026-09-01','Bildungsausschuss'],[halle.base+'to0040.asp?__ksinr=21850','2026-09-04','Betriebsausschuss Eigenbetrieb Kindertagesstätten']]);
 const both='<a href="si0057.asp?__ksinr=7" title="Details anzeigen: Rat 11.09.2026">Rat</a><a href="to0040.asp?__ksinr=7" title="Tagesordnung: Rat 11.09.2026">TO</a><a href="to0040.asp?__ksinr=8" title="Details anzeigen: Rat 12.09.2026">Rat</a>';
 assert.deepEqual(meetingRows(both,halle.base).map(r=>file(r.url)+'?'+new URL(r.url).search.slice(1)),['si0057.asp?__ksinr=7','to0040.asp?__ksinr=8']);
 // Only a meeting number joins two links: links without one stay meetings of their own.
 const bare='<a href="si0057.asp?x=1" title="Details anzeigen: Rat 11.09.2026">Rat</a><a href="to0040.asp?x=2" title="Details anzeigen: Bauausschuss 12.09.2026">Bau</a>';
 assert.deepEqual(meetingRows(bare,halle.base).map(r=>file(r.url)+'?'+new URL(r.url).search.slice(1)),['si0057.asp?x=1','to0040.asp?x=2']);
});

test('older layout agenda (to0040): public part only, number, paper, documents and the decision row of each item',()=>{
 const meeting={date:'2026-09-01',committee:'Bildungsausschuss',url:halle.base+'to0040.asp?__ksinr=21804'};
 const items=parseAgendaTopTable(page('halle-to0040.html'),meeting,halle,now);
 assert.deepEqual(items.map(i=>i.id),['de-15002000-top-21804--1','de-15002000-top-21804--3-1','de-15002000-top-21804--4-1','de-15002000-vo-32100'],'items 10 and 11 of the non-public part stay out');
 assert.equal(items[0].title,'Eröffnung der Sitzung, Feststellung der Ordnungsmäßigkeit der Einladung und der Beschlussfähigkeit');
 assert.equal(items[1].title,'Fragestellerin 1 zur Schulplatzzuweisung und zum Kindeswohl','the addendum note is not part of the number');
 assert.deepEqual(items.map(i=>i.event.result),['','','einstimmig zugestimmt','einstimmig zugestimmt'],'"Abstimmung:" is not the decision');
 assert.deepEqual(items.map(i=>i.status),['unknown','unknown','recommended','recommended'],'a committee recommends');
 const paper=items[3];assert.equal(paper.reference,'VIII/2026/02530');assert.equal(paper.sourceUrl,halle.base+'vo0050.asp?__kvonr=32100&voselect=21804');assert.equal(paper.event.url,meeting.url);
 assert.deepEqual(paper.documents.map(d=>d.url),[halle.base+'getfile.asp?id=340369&type=do&',halle.base+'getfile.asp?id=340371&type=do&']);
 assert.equal(parseAgendaTopTable(page('halle-to0040.html'),{...meeting,committee:'Stadtrat'},halle,now)[3].status,'approved');
 assert.equal(parseAgendaTopTable(page('halle-to0040.html'),{...meeting,date:'2026-10-20'},halle,now)[3].status,'consulting');
 // Without a heading of the public part nothing is taken.
 assert.deepEqual(parseAgendaTopTable(page('halle-to0040.html').replace(/&Ouml;ffentlicher Teil/g,'Sitzung'),meeting,halle,now),[]);
 // Numbers marked "Ö" are public without a heading; "N" is not.
 const marked='<table><tr class="smcrow1 smc_toph"><td class="smc_tophn">&Ouml; 1</td><td class="smc_topht">Haushalt</td></tr><tr class="smcrow2 smc_toph"><td class="smc_tophn">N 2</td><td class="smc_topht">Personal</td></tr></table>';
 assert.deepEqual(parseAgendaTopTable(marked,meeting,halle,now).map(i=>i.id),['de-15002000-top-21804--1']);
});

test('older layout agenda (to0040): only a group row that plainly says public opens the public part; the footer is no part of a row',()=>{
 const meeting={date:'2026-09-01',committee:'Bildungsausschuss',url:halle.base+'to0040.asp?__ksinr=21804'};
 const group=label=>`<tr class="smcrowh smc-table-group"><td colspan="7" class="smcrowh smc-table-group">${label}</td></tr>`;
 const item=(n,title,extra='')=>`<tr class="smcrow1 smc_toph smc_toph1"><td class="smcrow1 smc_tophn smc_tophn1">${n}</td><td colspan="3" class="smcrow1 smc_topht smc_topht1">${title}</td><td class="smcrow1 smc_toph smc_toph1">${extra}</td></tr>`;
 const agenda=(...rows)=>'<table class="smccontenttable smc_page_to0040_contenttable"><tbody>'+rows.join('')+'</tbody></table>';
 const titles=html=>parseAgendaTopTable(html,meeting,halle,now).map(i=>i.title);
 // Any other label ends the public part, even for numbers marked "Ö".
 for(const closed of ['Vertraulicher Teil','Geschlossene Sitzung','Nichtöffentlicher Teil','Nicht-&ouml;ffentlicher Teil','Nicht oeffentlicher Teil','Un&ouml;ffentlicher Teil','Öffentlicher und nicht öffentlicher Teil','Teil B',''])
  assert.deepEqual(titles(agenda(group('&Ouml;ffentlicher Teil'),item(1,'Haushalt'),group(closed),item(2,'Geheim'),item('&Ouml; 3','Personal'))),['Haushalt'],closed||'(empty label)');
 assert.deepEqual(titles(agenda(group('Oeffentlicher Teil'),item(1,'Haushalt'))),['Haushalt'],'spelled without umlaut');
 // A heading row without the group class (older layouts) is a group row as well.
 assert.deepEqual(titles(agenda(group('&Ouml;ffentlicher Teil'),item(1,'Haushalt'),'<tr class="smcrowh"><td colspan="7">Nicht &ouml;ffentlicher Teil</td></tr>',item(2,'Grundstücksverkauf'))),['Haushalt']);
 // A last row without its closing tag ends with its table; the page footer and its documents are not part of it.
 const docs=html=>parseAgendaTopTable(html,meeting,halle,now).map(i=>i.documents.map(d=>d.url));
 const unclosed=item(1,'Haushalt','<a href="getfile.asp?id=1&type=do">Vorlage</a>').replace(/<\/tr>$/,'');
 assert.deepEqual(docs('<table><tbody>'+group('&Ouml;ffentlicher Teil')+unclosed+'</tbody></table><div class="impressum"><a href="Impressum.pdf">Impressum</a></div>'),[[halle.base+'getfile.asp?id=1&type=do']]);
 assert.deepEqual(docs('<table><tbody>'+group('&Ouml;ffentlicher Teil')+unclosed+'<footer><a href="Impressum.pdf">Impressum</a></footer>'),[[halle.base+'getfile.asp?id=1&type=do']]);
 assert.deepEqual(docs('<table><tbody>'+group('&Ouml;ffentlicher Teil')+unclosed+'<div id="smcfooter"><a href="Impressum.pdf">Impressum</a></div>'),[[halle.base+'getfile.asp?id=1&type=do']]);
 // A row that runs into a following row of another kind keeps only its own documents.
 assert.deepEqual(docs(agenda(group('&Ouml;ffentlicher Teil'),unclosed+'<tr><td><a href="getfile.asp?id=8&type=do">Fremd</a></td></tr>')),[[halle.base+'getfile.asp?id=1&type=do']]);
});

test('an item read from to0040 keeps the id it has on the table page si0057',()=>{
 const meeting={date:'2026-09-28',committee:'Hauptausschuss',url:schiffweiler.base+'si0057.php?__ksinr=1192'};
 const top=parseAgendaTopTable(page('schiffweiler-to0040.html'),{...meeting,url:schiffweiler.base+'to0040.php?__ksinr=1192'},schiffweiler,now),table=parseAgenda(page('schiffweiler-si0057-session.html'),meeting,schiffweiler,now);
 assert.deepEqual(top.map(i=>i.id),['de-10043116-top-1192--1','de-10043116-vo-3194','de-10043116-top-1192--4']);
 assert.deepEqual(top.map(i=>i.id),table.map(i=>i.id));assert.deepEqual(top.map(i=>i.title),table.map(i=>i.title));
});

test('Halle: calendar and agenda pages of the older layout give public items, read from to0040 only',async()=>{
 const log=[];
 const get=async url=>{const u=new URL(url),f=file(url);log.push(f);
  if(f==='si0040.asp')return u.searchParams.get('__cmonat')==='9'?page('halle-si0040.html'):page('halle-si0040.html').replace(/<tr valign[\s\S]*?<\/tr>\n/g,'');
  // The second meeting has items of its non-public part only.
  if(f==='to0040.asp')return u.searchParams.get('__ksinr')==='21804'?page('halle-to0040.html'):page('halle-to0040.html').replace('&Ouml;ffentlicher Teil: Beginn','Nicht &ouml;ffentlicher Teil: Beginn');
  if(f==='vo0050.asp')return '<table><tr><td>Vorlage</td><td>VIII/2026/02530</td></tr></table><a href="getfile.asp?id=1&type=do">Vorlage</a><a href="https://www.halle.de/datenschutz.pdf">Datenschutz</a>';
  throw Error('Quelle antwortet mit HTTP 404');};
 const result=await collectSessionNet(halle,{now:new Date('2026-09-20T12:00:00Z'),window:'1m',get});
 assert.deepEqual([...new Set(log)].sort(),['si0040.asp','to0040.asp','vo0050.asp']);
 assert.equal(result.coverage.meetings,2);assert.deepEqual(result.coverage.issues,[]);assert.equal(result.coverage.complete,true);
 assert.deepEqual(result.topics.map(t=>t.id).sort(),['de-15002000-top-21804--1','de-15002000-top-21804--3-1','de-15002000-top-21804--4-1','de-15002000-vo-32100']);
 const paper=result.topics.find(t=>t.id==='de-15002000-vo-32100');assert.equal(paper.events[0].url,halle.base+'to0040.asp?__ksinr=21804');assert.ok(paper.documents.some(d=>d.url===halle.base+'getfile.asp?id=1&type=do'));
 assert.ok(!paper.documents.some(d=>/halle\.de\/datenschutz/.test(d.url)),'a link to another host is no document of the paper');
 assert.deepEqual(Object.keys(result.marks).sort(),[halle.base+'to0040.asp?__ksinr=21804',halle.base+'to0040.asp?__ksinr=21850']);
});

test('Schiffweiler: si0057 and si0056 lead to the error page without a session; the agenda comes from to0040, later meetings go there directly',async()=>{
 const log=[];const calendar=page('schiffweiler-si0040.html').replace('</tbody>',[1193,1194,1195].map(n=>`<tr><td><a href="si0057.php?__ksinr=${n}" title="Details anzeigen: Ortsrat ${n} 22.09.2026 ">Ortsrat</a></td></tr>`).join('')+'</tbody>');
 const request=async url=>{const u=new URL(url),f=file(url);log.push(f);
  if(/^si005[67]\.php$/.test(f))return new Response(null,{status:302,headers:{location:'error2.php'}});
  if(f==='si0040.php')return new Response(u.searchParams.get('__cmonat')==='9'?calendar:calendar.replace(/<tr>[\s\S]*<\/tr>/,''));
  if(f==='to0040.php')return new Response(page('schiffweiler-to0040.html').replace(/1192/g,u.searchParams.get('__ksinr')));
  if(f==='vo0050.php')return new Response('<table><tr><td>Vorlage</td><td>BV/473/2026</td></tr></table><a href="getfile.php?id=56629&type=do">Vorlage</a>');
  return new Response('',{status:404});};
 const result=await collectSessionNet(schiffweiler,{now,window:'1m',get:(url,source,timeout)=>fetchText(url,source,timeout,request)});
 const count=name=>log.filter(f=>f===name).length;
 assert.equal(count('error2.php'),0,'the error page itself is not requested');assert.equal(count('to0040.php'),5);
 assert.ok(count('si0057.php')<5&&count('si0056.php')<5,'once to0040 was needed, the pages before it are not asked again');
 assert.equal(result.coverage.meetings,5);assert.deepEqual(result.coverage.issues,[]);assert.equal(result.coverage.complete,true);
 const paper=result.topics.find(t=>t.id==='de-10043116-vo-3194');assert.equal(paper.events.length,5);assert.equal(paper.events[0].url.replace(/\d+$/,''),schiffweiler.base+'to0040.php?__ksinr=');
 assert.ok(result.topics.some(t=>t.id==='de-10043116-top-1192--4'));
 assert.equal(Object.keys(result.marks).every(url=>/si0057\.php/.test(url)),true,'marks keep the address of the calendar');
});

test('redirects to the login or error page are named; error pages of other systems are followed as before',async()=>{
 const source={base:'https://ratsinfo.example.de/'};
 await assert.rejects(fetchText(source.base+'si0040.php?__cjahr=2026&__cmonat=9',source,5000,async()=>new Response(null,{status:302,headers:{location:'ylogon.php?smcpn=si0040&__cjahr=2026&__cmonat=9&smclom=1'}})),{message:SESSIONNET_LOGIN});
 await assert.rejects(fetchText(source.base+'si0057.asp?__ksinr=1',source,5000,async()=>new Response(null,{status:302,headers:{location:'error.asp'}})),{message:SESSIONNET_ERROR});
 const calls=[];const html=await fetchText(source.base+'agenda',source,5000,async url=>{calls.push(url);return calls.length===1?new Response(null,{status:302,headers:{location:'error.asp'}}):new Response('Fehlerseite');});
 assert.equal(html,'Fehlerseite');assert.deepEqual(calls,[source.base+'agenda',source.base+'error.asp']);
});

test('calendar of a members-only, failing or broken system: one clear issue instead of a quiet empty result',async()=>{
 const source={id:'de-08118',name:'Landkreis Ludwigsburg',kind:'district',base:'https://ratsinfo.kreis-lb.de/',extension:'php'};
 const run=async answer=>{const calls=[];const result=await collectSessionNet(source,{now,window:'12m',get:async url=>{calls.push(url);return answer();}});return {calls,coverage:result.coverage};};
 const login=await run(()=>{throw Error(SESSIONNET_LOGIN);});
 assert.deepEqual(login.coverage.issues,[SESSIONNET_LOGIN,'Noch keine Artikel erfolgreich erfasst.']);assert.equal(login.coverage.quiet,false);assert.ok(login.calls.length<14,'the other months are not asked');
 assert.deepEqual((await run(()=>LOGIN_PAGE)).coverage.issues[0],SESSIONNET_LOGIN,'a login page served without a redirect');
 assert.deepEqual((await run(()=>ERROR_PAGE_6)).coverage.issues[0],SESSIONNET_ERROR);assert.deepEqual((await run(()=>ERROR_PAGE_4)).coverage.issues[0],SESSIONNET_ERROR);
 assert.deepEqual((await run(()=>PHP_SOURCE)).coverage.issues[0],SESSIONNET_SOURCE);
 assert.equal((await run(()=>SOFT_404)).coverage.issues[0],'Unbekanntes Kalenderformat');
 // A CMS page that names the product and links the system, or a 404 page that prints the address, is no calendar:
 // said once, and no meeting is taken from it.
 const cms=await run(()=>'<html><body><h2>Ratsinformationen (SessionNet)</h2><a href="si0057.asp?__ksinr=1" title="Details anzeigen: Kreistag 29.09.2026">Kreistag</a></body></html>');
 assert.deepEqual(cms.coverage.issues,['Unbekanntes Kalenderformat','Noch keine Artikel erfolgreich erfasst.']);assert.equal(cms.coverage.meetings,0);assert.equal(cms.coverage.quiet,false);
 assert.ok(cms.calls.every(url=>/si0040\.php/.test(url)),'no meeting page is asked');
 const echo=await run(()=>'<html><body><p>Die Seite /sessionnet/si0040.asp wurde nicht gefunden.</p></body></html>');
 assert.deepEqual(echo.coverage.issues,['Unbekanntes Kalenderformat','Noch keine Artikel erfolgreich erfasst.']);assert.equal(echo.coverage.quiet,false);
 // A real calendar without meetings stays a quiet period.
 const quiet=await run(()=>page('halle-si0040.html').replace(/<tr valign[\s\S]*?<\/tr>\n/g,''));assert.deepEqual(quiet.coverage.issues,['Noch keine Artikel erfolgreich erfasst.']);assert.equal(quiet.coverage.quiet,true);
 // An error page for some months is said once; the other months are still read.
 const asked=[];const months=await collectSessionNet(source,{now,window:'3m',get:async url=>{asked.push(url);const month=new URL(url).searchParams.get('__cmonat');
  if(/si0040/.test(url))return month==='8'||month==='7'?ERROR_PAGE_6:MARK+(month==='9'?'<a href="si0057.php?__ksinr=4" title="Details anzeigen: Kreistag 22.09.2026">Kreistag</a>':'');
  return '<table><tr><td class="tofnum">Ö 1</td><td class="tobetr"><div class="smc-card-header-title">Kreisstraße</div></td></tr></table>';}});
 assert.equal(asked.filter(url=>/si0040/.test(url)).length,5,'every month of the window is asked');
 assert.deepEqual(months.coverage.issues,[SESSIONNET_ERROR]);assert.equal(months.coverage.complete,false);assert.deepEqual(months.topics.map(t=>t.title),['Kreisstraße']);
 // A calendar that leads to the error page or to an unknown page for every month is not asked for all twelve.
 for(const answer of [()=>ERROR_PAGE_6,()=>SOFT_404]){const broken=await run(answer);assert.ok(broken.calls.length<=5,String(broken.calls.length));assert.equal(broken.coverage.issues.length,2);}
});

test('a layout learnt from earlier meetings is asked first; a meeting whose page of that layout cannot be read falls back to the table page',async()=>{
 const calendar=MARK+[1,2,3,4].map(n=>`<a href="si0057.php?__ksinr=${n}" title="Details anzeigen: Hauptausschuss 2${n}.09.2026">Sitzung</a>`).join('');
 // Meetings 4 to 2, read first, answer only on to0040; meeting 1 has an empty to0040 but a readable table page.
 const log=[];const get=async url=>{const u=new URL(url),f=file(url),n=u.searchParams.get('__ksinr');log.push(f+'?'+n);
  if(f==='si0040.php')return u.searchParams.get('__cmonat')==='9'?calendar:MARK;
  if(n!=='1'&&/^si005[67]\.php$/.test(f))throw Error(SESSIONNET_ERROR);
  if(f==='to0040.php')return n==='1'?MARK+'<div class="smclayout smc_page_to0040_layout"><table class="smccontenttable"><tbody></tbody></table></div>':page('schiffweiler-to0040.html').replace(/1192/g,n);
  if(f==='si0057.php')return page('schiffweiler-si0057-session.html').replace(/1192/g,n);
  if(f==='vo0050.php')return '<table><tr><td>Vorlage</td><td>BV/473/2026</td></tr></table>';
  throw Error('Quelle antwortet mit HTTP 404');};
 const result=await collectSessionNet(schiffweiler,{now,window:'1m',get});
 assert.deepEqual(log.filter(entry=>/\?1$/.test(entry)),['to0040.php?1','si0057.php?1']);
 assert.deepEqual(result.coverage.issues,[]);assert.equal(result.readMeetings,4);
 assert.ok(result.topics.find(t=>t.id==='de-10043116-top-1--1').events.some(e=>e.url===schiffweiler.base+'si0057.php?__ksinr=1'));
});

test('Sulzberg: cards on si0056 when si0057 leads to the error page; the footer after the last card is not read',async()=>{
 const meeting={date:'2026-08-13',committee:'Sitzung des Marktgemeinderates',url:sulzberg.base+'si0056.asp?__ksinr=161'};
 const items=parseAgendaCards(page('sulzberg-si0056.html'),meeting,sulzberg,now);
 assert.deepEqual(items.map(i=>[i.id,i.event.result,i.documents.length]),[['de-09780140-top-161--1','Einstimmig beschlossen',0],['de-09780140-top-161--2','Mehrheitlich beschlossen',0]]);
 assert.equal(items[1].title,'Bauantrag - Schellenbergstr. 14, FlNr. 140/7 Gmk. Sulzberg - Errichtung einer Außensauna - Tektur, Änderung des Standortes');
 // Even a card that holds a link to another host keeps the meeting readable.
 const foreign=page('sulzberg-si0056.html').replace('<!-- /doc-record -->','<a href="https://sulzberg.de/plan.pdf">Plan</a>');
 assert.equal(parseAgendaCards(foreign.replace(/<footer[\s\S]*<\/footer>/,''),meeting,sulzberg,now)[1].documents.length,0);
 const log=[];const get=async url=>{const f=file(url);log.push(f);
  if(f==='si0040.asp')return new URL(url).searchParams.get('__cmonat')==='8'?MARK+'<a href="si0057.asp?__ksinr=161" title="Details anzeigen: Sitzung des Marktgemeinderates 13.08.2026">Sitzung</a>':MARK;
  if(f==='si0057.asp')throw Error(SESSIONNET_ERROR);if(f==='si0056.asp')return page('sulzberg-si0056.html');throw Error('Quelle antwortet mit HTTP 404');};
 const result=await collectSessionNet(sulzberg,{now,window:'3m',get});
 assert.deepEqual(result.coverage.issues,[]);assert.equal(result.topics.length,2);assert.equal(result.topics[0].events[0].url,meeting.url);assert.equal(result.topics[0].events[0].result,'Einstimmig beschlossen');
});

test('systems with several clients: the calendar query selects one, and the clients on offer are listed',async()=>{
 const menu='<a href="si0040.asp?__cpanr=3&__cjahr=2026&__cmonat=9" class="smce-a-u dropdown-item smcfiltermenumandant" onclick="smcBoxMaximieren(\'dropdown-item smcfiltermenumandant\');">Gemeinde Bartelshagen II</a>'
  +'<a href="si0040.asp?__cpanr=9&amp;__cjahr=2026&amp;__cmonat=9" class="smce-a-u dropdown-item smcfiltermenumandant">Gemeinde Kenz-K&#252;strow</a>'
  +'<a href="si0040.asp?__cpanr=2&__cjahr=2026&__cmonat=9" class="smce-a-u dropdown-item smcfiltermenumandant">Stadt Barth</a>'
  +'<a href="si0040.asp?__cmandant=2&__cjahr=2026&__cmonat=9&__cselect=0" class="smce-a-u dropdown-item smcfiltermenumandant" >Alle Mandanten</a><a href="si0040.asp?__cjahr=2026&__cmonat=10">Oktober</a>';
 assert.deepEqual(sessionNetClients(menu),[{name:'Gemeinde Bartelshagen II',query:'__cpanr=3'},{name:'Gemeinde Kenz-Küstrow',query:'__cpanr=9'},{name:'Stadt Barth',query:'__cpanr=2'},{name:'Alle Mandanten',query:'__cmandant=2&__cselect=0'}]);
 assert.deepEqual(sessionNetClients(page('halle-si0040.html')),[]);
 const calls=[];await collectSessionNet({id:'de-130735352',name:'Amt Barth',kind:'city',base:'https://session.amt-barth.de/bi/',extension:'asp',calendarQuery:'__cmandant=2&__cselect=0'},{now,window:'1w',get:async url=>{calls.push(url);return MARK;}});
 assert.ok(calls.length>0);for(const url of calls)assert.match(url,/^https:\/\/session\.amt-barth\.de\/bi\/si0040\.asp\?__cmandant=2&__cselect=0&__cjahr=2026&__cmonat=\d+$/);
});

test('a paper page behind the error or login page is noted with its item and does not keep the meeting open',async()=>{
 const source={id:'t',name:'Test',kind:'city',base:'https://ris.example.org/bi/',extension:'asp'};
 const get=async url=>{const f=file(url);
  if(f==='si0040.asp')return new URL(url).searchParams.get('__cmonat')==='9'?'<html>'+MARK+'<a href="si0057.asp?__ksinr=1" title="Details anzeigen: Rat 29.09.2026">Sitzung</a></html>':'<html>'+MARK+'</html>';
  if(f==='si0057.asp')return '<table>'+[5,6].map(n=>`<tr><td class="tofnum">Ö ${n}</td><td class="tobetr"><div class="smc-card-header-title">Thema ${n}</div><a href="vo0050.asp?__kvonr=${n}">V/${n}</a></td></tr>`).join('')+'</table>';
  // Paper 5 redirects to the error page, paper 6 answers with the login page.
  if(new URL(url).searchParams.get('__kvonr')==='5')throw Error(SESSIONNET_ERROR);
  return LOGIN_PAGE;};
 const result=await collectSessionNet(source,{now,window:'1w',get});
 assert.deepEqual(result.coverage.issues,[]);assert.equal(result.coverage.complete,true);assert.equal(result.readMeetings,1);assert.equal(Object.keys(result.marks).length,1);
 assert.deepEqual(result.topics.map(t=>[t.id,t.sourceData.detailStatus,t.sourceData.issues]),[['t-vo-5','partial',[SESSIONNET_ERROR]],['t-vo-6','partial',[SESSIONNET_LOGIN]]]);
});

test('a client of a shared system: only meetings whose calendar row names that client are read (fail closed)',async()=>{
 // Nachgebildet nach sessionnet.owl-it.de/altshausen (05.10.2026): die Kalenderzeilen nennen den Mandanten in der Zelle
 // "Mandant" (Klasse pagel<Nummer>); die Ausschüsse tragen keinen Gemeindenamen.
 const row=(ksinr,title,panr,name)=>`<tr><td data-label="Sitzung" class="smc-t-cl991 silink"><a href="si0057.asp?__ksinr=${ksinr}" title="Details anzeigen: ${title}">${title}</a></td><td data-label="Mandant" class="smc-t-cl991 pagel pagel${panr}">${name}</td></tr>`;
 const calendar='<html>'+MARK+'<table>'+row(301,'Technischer Ausschuss 15.09.2026',3,'Gemeinde Altshausen')+row(302,'Gemeinderat 16.09.2026',2,'Gemeinde Boms')+'</table>'
  +'<div class="next"><a href="si0057.asp?__ksinr=303" title="Details anzeigen: Gemeinderat 17.09.2026">Nächste Sitzung</a></div></html>';
 assert.deepEqual([...meetingClients(calendar)],[['301',{panr:'3',name:'Gemeinde Altshausen'}],['302',{panr:'2',name:'Gemeinde Boms'}]]);
 const agendas=[];
 const get=async url=>{const f=file(url);if(f==='si0040.asp')return new URL(url).searchParams.get('__cmonat')==='9'?calendar:'<html>'+MARK+'</html>';agendas.push(new URL(url).searchParams.get('__ksinr'));return '<table></table>';};
 await collectSessionNet({id:'de-08436005',name:'Gemeinde Altshausen',kind:'city',base:'https://sessionnet.owl-it.de/altshausen/bi/',extension:'asp',calendarQuery:'__cpanr=3'},{now,window:'1m',get});
 assert.deepEqual([...new Set(agendas)],['301'],'the meeting of Boms and the meeting without client cell are not read');
 // Without a client every meeting of the calendar is read, as before.
 agendas.length=0;await collectSessionNet({id:'x',name:'GVV',kind:'city',base:'https://sessionnet.owl-it.de/altshausen/bi/',extension:'asp'},{now,window:'1m',get});
 assert.deepEqual([...new Set(agendas)].sort(),['301','302','303']);
});
