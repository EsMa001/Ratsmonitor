import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,listAddress,calendarMeetings,parseAllrisAgenda,parseAllrisPaper,collectAllris} from '../server/integrations/allris.mjs';
import {collectRegion} from '../server/integrations/collect-region.mjs';
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
const base='https://ratsinfo.example.test/public/',source={id:'nrw-05513000',name:'Stadt Gelsenkirchen',kind:'city',method:'scraper',adapter:'allris',base};
const now=new Date('2026-10-01T12:00:00Z');
const meetingUrl=n=>base+'to010?SILFDNR='+n,paperUrl=n=>base+'vo020?VOLFDNR='+n,doc=n=>base+'wicket/resource/org.apache.wicket.Application/doc'+n+'.pdf';
const monthPage=(month,year,page=0)=>`<html><head><title>ALLRIS - Sitzungen Kalender</title><script>Wicket.Event.add(window,"domready",function(event){Wicket.Ajax.ajax({"u":"./si010?${page}-1.0-form-calNav-months-0-monthlink&MM=${month}&YY=${year}","c":"id4","e":"click"});;Wicket.Ajax.ajax({"u":"./si010?${page}-1.0-&MM=${month}&YY=${year}","c":"id27"});;});</script></head><body><div id="mainContent"><div class="calendar"></div></div></body></html>`;
const listUrl=(month,year,page=0)=>base+`si010?${page}-1.0-&MM=${month}&YY=${year}`;
const calendarRow=(weekday,dom,time,id,name,when)=>`<tr class="${dom?'':'sameday '}${weekday} odd">${dom?`<td class="nowrapContent"><span class="dow">${weekday}</span><span class="dom">${dom}</span></td>`:''}<td class="time"><div>${time}</div></td><td class="textCol"><div><a href="./to010?SILFDNR=${id}&amp;refresh=false" id="si_${id}" ${when?`data-simpletooltip-text=" am ${when} um ${time} Uhr."`:''} class="js-simple-tooltip tooltipProvider">${name}</a></div></td><td class="raum"><div>Ratssaal</div></td></tr>`;
const list=rows=>`<?xml version="1.0" encoding="UTF-8"?><ajax-response><component id="id2a" ><![CDATA[<div id="id2a"><table id="id2d" class="calenderView hoverRow stickyHeader"><caption>Kalender</caption><thead><tr class="headers"><th class="dateCol" scope="col"><span>Datum</span></th></tr></thead><tbody><tr class="tue odd emptyRow"><td class="nowrapContent"><span class="dow">Di.</span><span class="dom">01</span></td><td colspan="3"></td></tr>${rows.join('')}</tbody></table></div>]]></component></ajax-response>`;
const part=label=>`<tr class="even beratung"><td class="expandCloseCol"> </td><td class="tonr"> </td><td class="tobetreff"><div><p>${label}</p></div></td><td class="tovonr"> </td><td class="tobanr"> </td></tr>`;
// linked: the system links a page of its own for the agenda item (to020); others name the item only by its id.
const item=(top,number,title,{paper,reference,result='',role='',linked=false}={})=>`<tr id="id${top}" class="odd numodd"><td class="expandCloseCol"> </td><td class="tonr">${number?`<div><a href="#" id="link_${top}">${number}</a></div>`:' '}</td><td class="tobetreff"><div><a ${linked?`href="./to020?TOLFDNR=${top}&amp;SILFDNR=1"`:''} id="betreff_${top}">${title}<span class="zusatzinfo"></span> </a><div id="idx${top}" hidden="" data-wicket-placeholder=""></div></div></td><td class="attach"> </td><td class="tovonr">${paper?`<div><a href="./vo020?VOLFDNR=${paper}&amp;refresh=false&amp;TOLFDNR=${top}" id="vo_${top}">${reference}</a></div>`:' '}</td><td class="tozunr"><div>${role}</div></td><td class="tobanr"><div>${result}</div></td></tr>`;
const agenda=(committee,when,rows)=>`<html><h1 class="title">${committee} - ${when}</h1><div id="head"><dl><dt class="colTitle"><span class="label">Gremium:</span></dt><dd class="colEntry"><span class="text1" id="sigremium"> <a href="./gr020?GRLFDNR=28">${committee}</a> </span></dd></dl><dl><dt><span class="label">Datum:</span></dt><dd><span class="text4" id="sidatum"> <a href="./si010?DD=1">Do., ${when}</a> </span></dd></dl></div><table id="id2d" class="dataTable captionVisible stickyHeader toTable"><caption>Tagesordnung</caption><thead><tr class="headers"><th class="tonr" scope="col"><span>TOP</span></th><th class="tobetreff" scope="col"><span>Betreff</span></th></tr></thead><tbody>${rows.join('')}</tbody></table></html>`;
const paper=(reference,subject,{status='Öffentlich',consultations=[],documents=[['Vorlage',1],['Sammeldokument öffentlich',2]]}={})=>`<html><h1 class="title">Beschlussvorlage - ${reference}</h1><div id="head"><div id="headLeft"><dl><dt class="colTitle"><span class="label"><a aria-describedby="vobetreff">Betreff:</a></span></dt><dd class="colEntry3"><span class="text1" id="vobetreff"><p>${subject}</p></span></dd></dl><dl><dt><span class="label"><a>Status:</a></span></dt><dd><span class="text4" id="vostatus">${status}</span> <span class="text4" id="vostat"><a> (Vorlage freigegeben)</a></span></dd></dl><dl><dt><span class="label"><a>Vorlageart:</a></span></dt><dd><span class="text4" id="voart">Beschlussvorlage</span></dd></dl><dl><dt><span class="label"><a>Verfasser:</a></span></dt><dd><span class="text4" id="voverfasser1">Frau Beispiel</span></dd></dl></div><div id="headRight"><aside tabindex="-1" id="dokumenteHeaderPanel" class="documents"><ul><li><a href="./wicket/resource/org.apache.wicket.Application/doc7.pdf" target="_blank" class="hpDocLink disable doclink js-simple-tooltip pdf" data-simpletooltip-text="Öffnet PDF-Datei &#039; in neuem Fenster">Dokument</a></li>${documents.map(([title,n])=>`<li><a href="./wicket/resource/org.apache.wicket.Application/doc${n}.pdf" target="_blank" data-simpletooltip-text="Öffnet PDF-Datei &#039;${title}&#039; in neuem Fenster" class="js-simple-tooltip doclink pdf">${title.split(' ')[0]}</a></li>`).join('')}</ul></aside><aside id="anlagenHeaderPanel" class="attachments"><ul><li><a href="./vo020?0--anlagenHeaderPanel-attachmentsList-0-attachment-link&amp;VOLFDNR=9" target="_blank">Anlage 1</a></li></ul></aside></div></div><div id="mainContent"><table id="id22" class="dataTable captionVisible stickyHeader bfTable nonStickyHeader"><caption>Beratungsfolge</caption><thead><tr class="headers"><th class="colorCol" scope="col">Status</th><th scope="col">Datum</th><th scope="col">Gremium</th><th scope="col">Beschluss</th><th class="toLink" scope="col">NA</th></tr></thead><tbody>${consultations.map(c=>`<tr class="even"><td class="colorCol"><div>● Erledigt</div></td><td> </td><td><div>${c.committee}</div></td><td><div>Entscheidung</div></td><td class="toLink"> </td></tr><tr class="odd"><td class="colorCol"> </td><td class="date"><div>2026 Sep 3</div></td><td><div><a href="./to010?SILFDNR=${c.meeting}&amp;TOLFDNR=${c.top}">Sitzung</a></div></td><td><div>${c.result?`<a href="./to020?TOLFDNR=${c.top}">${c.result}</a>`:''}</div></td><td class="toLink"><div></div></td></tr>`).join('')}</tbody></table><div class="docPart readOnly"><p>Der Text der Vorlage wird nicht übernommen.</p></div></div></html>`;
const refusal='<html><title>ALLRIS</title><div id="mainContent"><div class="compFull roundedBorder"><div class="message_header">Es ist ein Fehler aufgetreten</div><div class="message_text">Zu viele Zugriffe aus Ihrem Netzwerk, Zugriff temporär gesperrt.</div></div></div></html>';
test('ALLRIS session carries the cookies of earlier answers and marks the follow-up request of a page',async()=>{
 const sent=[];const answers=[['JSESSIONID=abc; Path=/public; HttpOnly','TS01=x1; Path=/'],['TS01=x2; Path=/'],[]];
 const session=createSession(async(url,init)=>{sent.push({url,headers:init.headers});return new Response('ok',{headers:answers[sent.length-1].map(c=>['set-cookie',c])});});
 await session.plain(base+'si010',{headers:{'User-Agent':'x'}});await session.follow('si010?MM=9&YY=2026')(base+'si010?0-1.0-&MM=9&YY=2026',{headers:{'User-Agent':'x'}});await session.plain(base+'to010?SILFDNR=1',{headers:{}});
 assert.equal(sent[0].headers.Cookie,undefined);assert.equal(sent[0].headers['User-Agent'],'x');assert.equal(sent[0].headers['Wicket-Ajax'],undefined);
 assert.equal(sent[1].headers.Cookie,'JSESSIONID=abc; TS01=x1');assert.equal(sent[1].headers['Wicket-Ajax'],'true');assert.equal(sent[1].headers['Wicket-Ajax-BaseURL'],'si010?MM=9&YY=2026');
 assert.equal(sent[2].headers.Cookie,'JSESSIONID=abc; TS01=x2');assert.equal(sent[2].headers['Wicket-Ajax'],undefined);
});
test('ALLRIS calendar page names the address of its rows; the rows name each meeting and its day',()=>{
 assert.equal(listAddress(monthPage(9,2026),base+'si010?MM=9&YY=2026',source),listUrl(9,2026));
 assert.equal(listAddress(monthPage(9,2026,3).replace('"./si010?3-1.0-&','"'+base+'si010?3-1.0-&'),base+'si010?MM=9&YY=2026',source),listUrl(9,2026,3));
 assert.equal(listAddress('<html>ALLRIS</html>',base+'si010',source),null);
 assert.throws(()=>listAddress(monthPage(9,2026).replace('"./si010?0-1.0-&','"https://elsewhere.example/si010?0-1.0-&'),base+'si010',source),/Nicht freigegebene/);
 const rows=list([calendarRow('thu','03','15:00',1000587,'Sitzung des Rates der Stadt','Do., 03.09.2026'),calendarRow('tue','08','16:00',1000589,'Sitzung der Bezirksvertretung Süd',''),calendarRow('tue','','18:00',1000590,'Sitzung des Beirates','')]);
 assert.deepEqual(calendarMeetings(rows,source,{year:2026,month:9}),[{url:meetingUrl(1000587),date:'2026-09-03',name:'Sitzung des Rates der Stadt'},{url:meetingUrl(1000589),date:'2026-09-08',name:'Sitzung der Bezirksvertretung Süd'},{url:meetingUrl(1000590),date:'2026-09-08',name:'Sitzung des Beirates'}]);
});
test('ALLRIS agenda keeps only the public part, even where the system prints the titles of the non-public part',()=>{
 const meeting={url:meetingUrl(5),date:'2026-09-17',name:'Sitzung des Rates'};
 const html=agenda('Rat der Stadt','17.09.2026',[part('Öffentlicher Teil (16:00 - 19:08 Uhr)'),item(11,'','Tagesordnungsdebatte',{linked:true}),item(12,'','Dringlichkeitsantrag',{paper:901,reference:'25-30/01629',result:'nicht auf die Tagesordnung aufgenommen',linked:true}),item(13,'Ö 1','Fragestunde',{linked:true}),item(14,'Ö 2','Haushaltssatzung<br/>2027',{paper:902,reference:'25-30/01551',result:'einstimmig zugestimmt',role:'Entscheidung',linked:true}),item(15,'Ö 2.1','Bericht',{paper:903,reference:'25-30/01552',result:'zur Kenntnis genommen'}),part('Nichtöffentlicher Teil (bis 19:25 Uhr)'),item(16,'N 3','Neubeschaffung von Stromaggregaten',{paper:904,reference:'25-30/09999'}),item(17,'','Grundstücksangelegenheit',{paper:905,reference:'25-30/09998'})]);
 const read=parseAllrisAgenda(html,meeting,source,now);
 assert.equal(read.date,'2026-09-17');assert.equal(read.committee,'Rat der Stadt');
 assert.deepEqual(read.items.map(i=>[i.id,i.title,i.reference,i.status,i.event.result]),[
  ['nrw-05513000-vo-901','Dringlichkeitsantrag','25-30/01629','unknown','nicht auf die Tagesordnung aufgenommen'],
  ['nrw-05513000-top-13','Fragestunde','','unknown',''],
  ['nrw-05513000-vo-902','Haushaltssatzung 2027','25-30/01551','approved','einstimmig zugestimmt'],
  ['nrw-05513000-vo-903','Bericht','25-30/01552','info','zur Kenntnis genommen']]);
 assert.ok(!/Stromaggregat|Grundstück|Tagesordnungsdebatte/.test(JSON.stringify(read.items)));
 // Addresses carry the record number only; the item page is named only where the system links one.
 assert.equal(read.items[2].sourceUrl,paperUrl(902));assert.deepEqual(read.items[2].identityLinks,[paperUrl(902),base+'to020?TOLFDNR=14']);assert.deepEqual(read.items[3].identityLinks,[paperUrl(903)]);
 assert.equal(read.items[1].sourceUrl,base+'to020?TOLFDNR=13');assert.equal(read.items[2].event.url,meeting.url);assert.match(read.items[2].event.publicEvidence,/Ö 2/);assert.equal(read.items[2].agenda.role,'Entscheidung');
 // A committee recommends; a meeting that is still ahead is announced, never decided.
 assert.equal(parseAllrisAgenda(agenda('Bauausschuss','17.09.2026',[item(1,'Ö 1','Bebauungsplan',{paper:7,reference:'1/26',result:'mehrheitlich zugestimmt'})]),meeting,source,now).items[0].status,'recommended');
 assert.deepEqual(parseAllrisAgenda(agenda('Rat der Stadt','03.11.2026',[item(1,'Ö 1','Haushalt',{paper:7,reference:'1/26'}),item(2,'Ö 2','Mitteilungen')]),{...meeting,date:'2026-11-03'},source,now).items.map(i=>i.status),['consulting','announced']);
 // Without "Ö" numbers the heading of the part decides; without either nothing counts as public.
 const plain=[item(1,'1','Mitteilungen'),item(2,'2','Vergabe',{paper:8,reference:'2/26'})];
 assert.deepEqual(parseAllrisAgenda(agenda('Rat','17.09.2026',[part('Öffentliche Sitzung (17:00 Uhr)'),...plain,part('Nichtöffentliche Sitzung'),item(3,'3','Personal')]),meeting,source,now).items.map(i=>i.title),['Mitteilungen','Vergabe']);
 assert.deepEqual(parseAllrisAgenda(agenda('Rat','17.09.2026',plain),meeting,source,now).items,[]);
 // An "Ö" number below the heading of the non-public part is not trusted.
 assert.deepEqual(parseAllrisAgenda(agenda('Rat','17.09.2026',[part('Nichtöffentlicher Teil'),item(4,'Ö 4','Vertrag')]),meeting,source,now).items,[]);
 assert.equal(parseAllrisAgenda('<html><h1>Rat - 17.09.2026</h1><p>Keine Tagesordnung.</p></html>',meeting,source,now),null);
});
test('ALLRIS paper page yields fields, documents with an address of their own and the result per meeting',()=>{
 const detail=parseAllrisPaper(paper('25-30/01551','Haushaltssatzung 2027',{consultations:[{committee:'Hauptausschuss',meeting:4,top:40,result:'einstimmig zugestimmt'},{committee:'Rat der Stadt',meeting:5,top:14,result:''}]}),source);
 // The author of a paper can be a member of staff and is not kept; neither is the text of the paper.
 assert.deepEqual(detail.fields,[{field:'Betreff',value:'Haushaltssatzung 2027'},{field:'Status',value:'Öffentlich (Vorlage freigegeben)'},{field:'Vorlageart',value:'Beschlussvorlage'}]);
 // The disabled link and the attachment, which is reachable through the page's session only, are left out.
 assert.deepEqual(detail.documents,[{title:'Vorlage',url:doc(1),kind:'application/pdf'},{title:'Sammeldokument öffentlich',url:doc(2),kind:'application/pdf'}]);
 assert.deepEqual(detail.consultations,[{meeting:'4',top:'40',result:'einstimmig zugestimmt'},{meeting:'5',top:'14',result:''}]);
 const restricted=parseAllrisPaper(paper('1/26','Personal',{status:'Nichtöffentlich'}),source);assert.equal(restricted.restricted,true);assert.deepEqual(restricted.documents,[]);
 assert.deepEqual(parseAllrisPaper(paper('1/26','x').replace('./wicket/resource/org.apache.wicket.Application/doc1.pdf','https://elsewhere.example/doc1.pdf'),source).documents.map(d=>d.url),[doc(2)]);
});
const web=()=>{
 const pages={
  [base+'si010?MM=9&YY=2026']:monthPage(9,2026),[listUrl(9,2026)]:list([calendarRow('thu','03','16:00',4,'Sitzung des Hauptausschusses','Do., 03.09.2026'),calendarRow('thu','24','17:00',5,'Sitzung des Rates','Do., 24.09.2026')]),
  [base+'si010?MM=10&YY=2026']:monthPage(10,2026),[listUrl(10,2026)]:list([calendarRow('tue','20','17:00',6,'Sitzung des Bauausschusses','Di., 20.10.2026')]),
  [base+'si010?MM=11&YY=2026']:monthPage(11,2026),[listUrl(11,2026)]:list([]),
  [meetingUrl(4)]:agenda('Hauptausschuss','03.09.2026',[part('Öffentlicher Teil'),item(40,'Ö 1','Haushaltssatzung 2027',{paper:902,reference:'25-30/01551',role:'Vorberatung'}),part('Nichtöffentlicher Teil'),item(41,'N 2','Personalangelegenheit',{paper:950,reference:'25-30/09000'})]),
  [meetingUrl(5)]:agenda('Rat der Stadt','24.09.2026',[part('Öffentlicher Teil'),item(13,'Ö 1','Fragestunde'),item(14,'Ö 2','Haushaltssatzung 2027',{paper:902,reference:'25-30/01551',result:'einstimmig beschlossen'})]),
  [meetingUrl(6)]:'<html><h1>Bauausschuss - 20.10.2026</h1><p>Die Tagesordnung liegt noch nicht vor.</p></html>',
  [paperUrl(902)]:paper('25-30/01551','Haushaltssatzung 2027',{consultations:[{committee:'Hauptausschuss',meeting:4,top:40,result:'einstimmig zugestimmt'},{committee:'Rat der Stadt',meeting:5,top:14,result:'einstimmig beschlossen'}]}),
 };
 const calls=[];return {pages,calls,get:async url=>{calls.push(url);if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];}};
};
test('ALLRIS collector reads calendar, public agendas and each paper once, and takes a missing result from the paper',async()=>{
 const {calls,get}=web();
 const d=await collectAllris(source,{now,get,window:'1m'});
 assert.deepEqual(calls.slice(0,2),[base+'si010?MM=11&YY=2026',listUrl(11,2026)],'the first month opens the session before anything else is asked');
 assert.equal(calls.filter(u=>u===paperUrl(902)).length,1);assert.ok(!calls.includes(paperUrl(950)),'a paper of the non-public part is never requested');assert.ok(calls.every(u=>u.startsWith(base)));
 assert.equal(d.coverage.method,'scraper');assert.equal(d.coverage.meetings,2);assert.equal(d.coverage.upcomingWithoutAgenda,1);assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.complete,true);assert.equal(d.readMeetings,2);
 assert.deepEqual(d.topics.map(t=>t.id).sort(),['nrw-05513000-top-13','nrw-05513000-vo-902']);
 const budget=d.topics.find(t=>t.id==='nrw-05513000-vo-902');
 assert.deepEqual(budget.events.map(e=>[e.date,e.committee,e.status,e.result,e.description]),[['2026-09-03','Hauptausschuss','recommended','einstimmig zugestimmt','Ergebnis laut Beratungsfolge: einstimmig zugestimmt'],['2026-09-24','Rat der Stadt','approved','einstimmig beschlossen','Ergebnis laut Tagesordnung: einstimmig beschlossen']]);
 assert.equal(budget.status,'approved');assert.equal(budget.eventDate,'2026-09-24');assert.equal(budget.regionId,source.id);assert.equal(budget.reference,'25-30/01551');assert.equal(budget.sourceUrl,paperUrl(902));
 assert.deepEqual(budget.documents,[{title:'Vorlage',url:doc(1),kind:'application/pdf'},{title:'Sammeldokument öffentlich',url:doc(2),kind:'application/pdf'},{title:'Vorlage / öffentliche Tagesordnung',url:paperUrl(902),kind:'html'}]);
 assert.equal(budget.sourceData.method,'allris');assert.deepEqual(budget.sourceData.records.map(r=>r.kind),['agenda','paper']);assert.equal(budget.events[0].attendance.status,'not_collected');
 assert.ok(!JSON.stringify(d).includes('Personalangelegenheit'));assert.ok(!JSON.stringify(d).includes('Text der Vorlage'));
 assert.match(budget.longSummary[0],/Stadt Gelsenkirchen/);
});
test('ALLRIS collector skips meetings whose agenda is unchanged since their papers were read',async()=>{
 const {calls,get,pages}=web();
 const first=await collectAllris(source,{now,get,window:'1m'});assert.deepEqual(Object.keys(first.marks).sort(),[meetingUrl(4),meetingUrl(5)]);
 // Fifteen days later: both meetings lie more than two weeks back, the one in October is still ahead.
 const later=new Date(now.getTime()+15*86400000),stock=new Set([meetingUrl(4),meetingUrl(5)]);
 for(const month of [7,8]){pages[base+`si010?MM=${month}&YY=2026`]=monthPage(month,2026);pages[listUrl(month,2026)]=list([]);}calls.length=0;
 const second=await collectAllris(source,{now:later,get,window:'3m',marks:{known:first.marks,stock}});
 assert.equal(second.coverage.unchangedMeetings,2);assert.equal(second.topics.length,0);assert.ok(!calls.includes(paperUrl(902)));assert.equal(second.coverage.complete,true);
 // The agenda says something new: the meeting is read again.
 pages[meetingUrl(5)]=pages[meetingUrl(5)].replace('einstimmig beschlossen','mehrheitlich beschlossen');calls.length=0;
 const changed=await collectAllris(source,{now:later,get,window:'3m',marks:{known:first.marks,stock}});
 assert.equal(changed.coverage.unchangedMeetings,1);assert.ok(calls.includes(paperUrl(902)));assert.deepEqual(changed.topics.map(t=>t.id).sort(),['nrw-05513000-top-13','nrw-05513000-vo-902']);
});
test('ALLRIS collector stops at once when the system reports too many requests, and does not resume by itself',async()=>{
 const {calls,get}=web();
 const d=await collectAllris(source,{now,window:'1m',get:async url=>url===meetingUrl(5)?refusal:get(url)});
 assert.ok(d.coverage.issues.some(i=>/zu viele Zugriffe/.test(i)));assert.equal(d.coverage.resumable,undefined);assert.equal(d.coverage.complete,false);
 assert.ok(!calls.includes(meetingUrl(4))&&!calls.includes(paperUrl(902)),'nothing is asked after the refusal');
 // Refused on the first request: no further month, no meeting.
 const asked=[];const blocked=await collectAllris(source,{now,window:'12m',get:async url=>{asked.push(url);return refusal;}});
 assert.equal(asked.length,1);assert.equal(blocked.topics.length,0);assert.ok(blocked.coverage.issues.some(i=>/zu viele Zugriffe/.test(i)));assert.equal(blocked.coverage.quiet,false);
});
test('ALLRIS collector does not solve an access check: it ends the import and never mistakes the check for a quiet period',async()=>{
 const gate='<html><head><title>Zugriff pruefen</title><script async defer src="/public/_gate/assets/altcha.js" type="module"></script></head><body><h1>Zugriff pruefen</h1><p>Zum Schutz vor automatisierten Zugriffen ist die folgende Pruefung einmalig notwendig.</p><form id="gateForm" method="post" action="/public/_gate/verify"><altcha-widget challengeurl="/public/_gate/challenge"></altcha-widget><span>Weiterleitung zu ALLRIS net</span></form></body></html>';
 const asked=[];const d=await collectAllris(source,{now,window:'12m',checkOparl:true,get:async url=>{asked.push(url);return gate;}});
 assert.deepEqual(asked,[base+'oparl/system'],'nothing is asked after the check appeared, least of all its challenge');
 assert.equal(d.topics.length,0);assert.equal(d.coverage.quiet,false);assert.equal(d.coverage.complete,false);assert.equal(d.coverage.resumable,undefined);assert.match(d.coverage.issues[0],/Zugriffsprüfung gegen automatisierte Abrufe; sie wird nicht umgangen/);
 // The check can appear in the middle of an import as well.
 const {get,calls}=web();const later=await collectAllris(source,{now,window:'1m',get:async url=>url===meetingUrl(5)?gate:get(url)});
 assert.ok(later.coverage.issues.some(i=>/Zugriffsprüfung/.test(i)));assert.ok(!calls.includes(meetingUrl(4)));
});
test('ALLRIS collector reports a calendar it cannot read and a past meeting without an agenda as gaps',async()=>{
 const {get,pages}=web();
 const empty=await collectAllris(source,{now,window:'1m',get:async url=>url===listUrl(11,2026)?'<?xml version="1.0" encoding="UTF-8"?><ajax-response></ajax-response>':get(url)});
 assert.deepEqual(empty.coverage.issues,['Kalender 11/2026: Kalenderliste ohne Inhalt','Noch keine Artikel erfolgreich erfasst.']);assert.equal(empty.coverage.quiet,false);
 const asked=[];for(const page of ['<html>Rathaus</html>','<html>Wartungsarbeiten - ALLRIS</html>']){asked.length=0;const foreign=await collectAllris(source,{now,window:'12m',get:async url=>{asked.push(url);return page;}});assert.match(foreign.coverage.issues[0],/Unbekanntes Kalenderformat/);assert.equal(foreign.coverage.quiet,false);assert.equal(asked.length,1,'the other months are not asked');}
 // Older page versions carry the calendar table in the page itself.
 const inline=await collectAllris(source,{now,window:'1m',get:async url=>url.includes('si010?')?'<html><title>ALLRIS</title><table class="calenderView"><tbody>'+calendarRow('thu','24','17:00',5,'Sitzung des Rates','Do., 24.09.2026')+'</tbody></table></html>':get(url)});assert.equal(inline.coverage.meetings,1);assert.equal(inline.topics.length,2);
 pages[meetingUrl(5)]='<html><h1>Rat - 24.09.2026</h1></html>';
 const gap=await collectAllris(source,{now,window:'1m',get});assert.ok(gap.coverage.issues.includes('Keine lesbare öffentliche Tagesordnung: '+meetingUrl(5)));assert.equal(gap.coverage.complete,false);assert.equal(gap.coverage.warnings,undefined);
 // The system shows the meeting with its basic data but publishes no agenda for it: a remark, the import stays complete.
 pages[meetingUrl(5)]='<html><h1 class="title">Partnerschaftskomitee - 24.09.2026</h1><span class="text1" id="sigremium">Partnerschaftskomitee</span><span class="text4" id="sidatum">Do., 24.09.2026</span><span id="sistatus">öffentlich</span></html>';
 const bare=await collectAllris(source,{now,window:'1m',get});assert.deepEqual(bare.coverage.warnings,['Sitzung ohne veröffentlichte Tagesordnung: '+meetingUrl(5)]);assert.deepEqual(bare.coverage.issues,[]);assert.equal(bare.coverage.complete,true);assert.equal(bare.topics.length,1);
 // Out of time: what was not read is named and the import can be resumed.
 const slow=web();let n=0;const cut=await collectAllris(source,{now,window:'1m',get:async url=>{if(url===paperUrl(902)&&++n)throw Error('Zeitbudget der Quelle erreicht');return slow.get(url);}});
 assert.equal(cut.coverage.resumable,true);assert.ok(cut.coverage.issues.some(i=>/Zeitbudget der Quelle erreicht; 2 Sitzungen/.test(i)));assert.deepEqual(cut.marks,{});
});
test('an ALLRIS source is read only while its own OParl address does not answer as an OParl system',async()=>{
 const {get,calls}=web();
 const d=await collectAllris(source,{now,window:'1m',checkOparl:true,get});assert.equal(calls[0],base+'oparl/system');assert.equal(d.topics.length,2);
 const asked=[];await assert.rejects(collectAllris(source,{now,window:'1m',checkOparl:true,get:async url=>{asked.push(url);return '{"type":"https://schema.oparl.org/1.1/System"}';}}),/Adapterfreigabe/);assert.deepEqual(asked,[base+'oparl/system']);
 // Through the catalog: the same gate, and every request stays inside the approved source.
 const entry=NRW_SOURCES.find(s=>s.adapter==='allris'&&!s.oparlFallback);if(!entry)return;
 const original=globalThis.fetch,requests=[];
 try{
  globalThis.fetch=async(url,init)=>{requests.push({url:String(url),cookie:init.headers.Cookie});return new Response('<html>ALLRIS</html>',{status:200,headers:[['content-type','text/html; charset=utf-8'],['set-cookie','JSESSIONID=s1; Path=/']]});};
  const read=await collectRegion(entry.id,{window:'1w'});
  assert.equal(read.coverage.method,'scraper');assert.equal(requests[0].url,entry.base+'oparl/system');assert.ok(requests.every(r=>r.url.startsWith(entry.base)));
  assert.equal(requests[0].cookie,undefined);assert.ok(requests.slice(1).every(r=>r.cookie==='JSESSIONID=s1'),'one session for the whole import');
  requests.length=0;globalThis.fetch=async url=>{requests.push(String(url));return new Response('{"type":"https://schema.oparl.org/1.1/System"}',{status:200,headers:{'content-type':'application/json'}});};
  await assert.rejects(collectRegion(entry.id,{window:'1w'}),/Adapterfreigabe/);assert.equal(requests.length,1);
 }finally{globalThis.fetch=original;}
});
