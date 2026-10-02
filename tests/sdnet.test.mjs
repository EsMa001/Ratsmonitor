import test from 'node:test';
import assert from 'node:assert/strict';
import {paperListMeetings,calendarMeetings,parseSdnetAgenda,parseSdnetMatter,resultStatus,collectSdnet} from '../server/integrations/sdnet.mjs';
const base='https://ris.example.test/',source={id:'nrw-05170004',name:'Gemeinde Alpen',kind:'city',method:'scraper',adapter:'sdnet',base};
const now=new Date('2026-10-01T12:00:00Z');
const meetingUrl=n=>base+'tops/?__=MEETING'+n,matterUrl=n=>base+'vorgang/?__=MATTER'+n;
const paperRow=(reference,subject,when,committee,meeting)=>`<tr class="row-1"><td class="column-dokument"></td><td class="column-betreff"><a href="${matterUrl(reference.replace(/\D/g,''))}">${reference}</a> - Verwaltungsvorlage<br/><span>${subject}</span></td><td class="column-termin">${when?`<a href="${meetingUrl(meeting)}" title="Zur Sitzung vom ${when} 18:00 Uhr">${when} 18:00 Uhr</a><br><span>${committee}</span>`:''}</td></tr>`;
const paperList=(rows,next)=>`<html><table><tbody>${rows.join('')}</tbody></table>${next?`<a href="${base}vorlagen?__=PAGE${next}">2</a><a href="${base}vorlagen?__=PAGE${next}">&gt;</a>`:''}</html>`;
const agendaRow=(marker,number,title,reference,key,documents='')=>`<tr class="row-0 original ${marker}" ${key?`data-vorgang-id="${key}"`:''}><td class="column-topnrtext">${number}</td><td class="column-bezeichnung">${title}</td><td class="column-nummer">${reference||'&nbsp;'}</td><td class="column-dokumente">${documents}</td></tr>`;
const paperLinks=reference=>`<a class="link-element" href="${base}sdnetrim/FILE${reference.replace(/\D/g,'')}/Vorlage.pdf" title="Verwaltungsvorlage ${reference} im PDF-Format öffnen"><span class="hide-text">Verwaltungsvorlage ${reference} (exportiert: 21.08.2026) (94 KB)</span></a><a class="link-element" href="${matterUrl(reference.replace(/\D/g,''))}" title="Verwaltungsvorlage ${reference} - Vorgang. Vorgang öffnen"><span class="hide-text">Vorgang</span></a>`;
const agenda=(committee,when,rows)=>`<html><table><tr><th>Sitzung:</th><td>${committee}, 6. Sitzung</td></tr><tr><th>Termin:</th><td>${when} 18:00 Uhr</td></tr></table><table id="table0" class="table-data table-top table-cols-4"><caption>Tagesordnungspunkte</caption><tbody>${rows.join('')}</tbody></table></html>`;
const matter=(reference,subject,consultations)=>`<html><table><tr><th>Verwaltungsvorlage:</th><td>${reference}</td></tr><tr><th>Betreff:</th><td>${subject}</td></tr></table><table id="table0" class="table-data table-vorgang table-cols-4"><caption>Beratungsfolge</caption><tbody>${consultations.map(c=>`<tr class="row-1"><td class="column-beginn"><a href="${meetingUrl(c.meeting)}" title="Zur Sitzung">${c.when} 18:00 Uhr</a></td><td class="column-gremium"><a href="${base}gremien/?__=G"><span>${c.committee}</span></a></td><td class="column-beschluss"></td><td class="column-ergebnis">${c.result||''}</td></tr>`).join('')}</tbody></table></html>`;
test('SD.NET paper list yields the linked meetings and the plain link to the next page',()=>{
 const list=paperListMeetings(paperList([paperRow('119/2026','Mobilitätskonzept','Di, 29.09.2026','Bauausschuss',1),paperRow('118/2026','Pfandflaschen','Di, 29.09.2026','Bauausschuss',1),paperRow('120/2026','noch nicht terminiert','','',0)],2),source);
 assert.equal(list.rows,3);assert.deepEqual(list.meetings.map(m=>[m.url,m.date,m.committee]),[[meetingUrl(1),'2026-09-29','Bauausschuss'],[meetingUrl(1),'2026-09-29','Bauausschuss']]);assert.equal(list.next,base+'vorlagen?__=PAGE2');
 assert.equal(paperListMeetings(paperList([paperRow('1/2026','x','Di, 29.09.2026','Rat',1)]),source).next,null);
 // A meeting link that leaves the approved source is refused.
 assert.throws(()=>paperListMeetings('<tr><td class="column-betreff">x</td><td class="column-termin"><a href="https://elsewhere.example/tops/?__=X" title="Zur Sitzung vom Di, 29.09.2026">x</a></td></tr>',source),/Nicht freigegebene/);
});
test('SD.NET calendar export yields upcoming meetings and marks cancelled ones',()=>{
 const ics=['BEGIN:VCALENDAR','BEGIN:VEVENT','DTSTART;TZID=Europe/Berlin:20261013T180000','SUMMARY:Haupt- und Finanzausschuss','DESCRIPTION:Link zur Tagesordnung: '+meetingUrl(7)+'\\n\\nBemerkung:\\nDie Sitzung entfällt!','END:VEVENT','BEGIN:VEVENT','DTSTART;TZID=Europe/Berlin:20261103T180000','SUMMARY:Rat','DESCRIPTION:Link zur Tagesordnung: '+meetingUrl(8),'END:VEVENT','BEGIN:VEVENT','DTSTART:20261104T180000','SUMMARY:Fremd','DESCRIPTION:Link zur Tagesordnung: https://elsewhere.example/tops/?__=X','END:VEVENT','END:VCALENDAR'].join('\r\n');
 assert.deepEqual(calendarMeetings(ics,source),[{url:meetingUrl(7),date:'2026-10-13',committee:'Haupt- und Finanzausschuss',cancelled:true},{url:meetingUrl(8),date:'2026-11-03',committee:'Rat',cancelled:false}]);
});
test('SD.NET agenda keeps only rows of the public part and identifies items without relying on opaque addresses',()=>{
 const meeting={url:meetingUrl(1),date:'2026-09-03',committee:'Haupt- und Finanzausschuss'};
 const html=agenda('Haupt- und Finanzausschuss','Do, 03.09.2026',[agendaRow('top-oeff-head','','Öffentliche Sitzung','','200_1'),agendaRow('top-oeff-data','1.','Feststellung der Ausschließungsgründe','','200_6040'),agendaRow('top-oeff-data','3.','Bestellung einer Geschäftsführung','79/2026','505_3022',paperLinks('79/2026')),agendaRow('top-noeff-head','','Nichtöffentliche Sitzung','','200_9'),agendaRow('top-noeff-data','9.','Grundstücksangelegenheit','90/2026','505_9999',paperLinks('90/2026'))]);
 const items=parseSdnetAgenda(html,meeting,source,now);
 assert.deepEqual(items.map(i=>[i.id,i.title,i.reference,i.status]),[['nrw-05170004-top-200_6040','Feststellung der Ausschließungsgründe','','unknown'],['nrw-05170004-vo-505_3022','Bestellung einer Geschäftsführung','79/2026','unknown']]);
 assert.deepEqual(items[1].documents,[{title:'Verwaltungsvorlage 79/2026',url:base+'sdnetrim/FILE792026/Vorlage.pdf',kind:'application/pdf'}]);
 assert.equal(items[1].sourceUrl,matterUrl('792026'));assert.equal(items[0].sourceUrl,meeting.url);assert.match(items[0].event.publicEvidence,/Öffentliche Sitzung/);
 assert.ok(!JSON.stringify(items).includes('Grundstücksangelegenheit'));
 // Older installations without record ids: the paper number, or date, committee, number and title.
 const plain=parseSdnetAgenda(agenda('Rat','Do, 01.10.2026',[agendaRow('top-oeff-data','1.1','Mitteilungen',''),agendaRow('top-oeff-data','11','Anfragen',''),agendaRow('top-oeff-data','5','Bebauungsplan','0287/26','',paperLinks('0287/26'))]),{url:meetingUrl(2),date:'2026-10-01',committee:'Rat'},source,now);
 assert.equal(plain[2].id,'nrw-05170004-vo-nr-0287-26');assert.match(plain[0].id,/^nrw-05170004-top-20261001-[0-9a-f]{8}$/);assert.notEqual(plain[0].id,plain[1].id);
 // A meeting that is still ahead is announced, never decided; a page without an agenda table is not an empty agenda.
 assert.equal(parseSdnetAgenda(agenda('Rat','Di, 03.11.2026',[agendaRow('top-oeff-data','1','Haushalt','130/2026','505_1',paperLinks('130/2026')),agendaRow('top-oeff-data','2','Mitteilungen','','200_2')]),{url:meetingUrl(3),date:'2026-11-03',committee:'Rat'},source,now).map(i=>i.status).join(),'consulting,announced');
 assert.equal(parseSdnetAgenda('<html><p>Für diese Sitzung liegt noch keine Tagesordnung vor.</p></html>',meeting,source,now),null);
});
test('SD.NET paper page yields the consultation sequence; a status needs a vote that names the outcome',()=>{
 const detail=parseSdnetMatter(matter('79/2026','Bestellung',[{meeting:1,when:'Do, 03.09.2026',committee:'Haupt- und Finanzausschuss',result:'Einstimmig, 0 Enthaltung(en)'},{meeting:2,when:'Do, 24.09.2026',committee:'Rat'}]),source);
 assert.deepEqual(detail.consultations,[{url:meetingUrl(1),date:'2026-09-03',committee:'Haupt- und Finanzausschuss',result:'Einstimmig, 0 Enthaltung(en)'},{url:meetingUrl(2),date:'2026-09-24',committee:'Rat',result:''}]);
 assert.deepEqual(detail.fields,[{field:'Verwaltungsvorlage',value:'79/2026'},{field:'Betreff',value:'Bestellung'}]);
 assert.equal(resultStatus('Einstimmig, 0 Enthaltung(en)','Rat'),null);assert.equal(resultStatus('12 Ja-Stimme(n), 3 Gegenstimme(n)','Rat'),null);
 assert.equal(resultStatus('Einstimmig dafür, 0 Enthaltungen','Rat'),'approved');assert.equal(resultStatus('Einstimmig dafür, 0 Enthaltungen','Bauausschuss'),'recommended');
 assert.equal(resultStatus('Mehrheitlich abgelehnt','Rat'),'rejected');assert.equal(resultStatus('Zur Kenntnis genommen','Rat'),'info');assert.equal(resultStatus('vertagt','Rat'),'postponed');
});
test('SD.NET collector follows a paper to the earlier committee meeting the paper list does not show',async()=>{
 // The paper list names only the latest meeting of paper 79/2026 (Rat). Its paper page also names the committee meeting.
 const pages={
  [base+'vorlagen']:paperList([paperRow('79/2026','Bestellung','Do, 24.09.2026','Rat',2)],2),
  [base+'vorlagen?__=PAGE2']:paperList([paperRow('10/2026','Alt','Do, 05.02.2026','Rat',90)],3),
  [base+'vorlagen?__=PAGE3']:paperList([paperRow('9/2026','Älter','Do, 15.01.2026','Rat',91)],4),
  [base+'termine']:`<html><button id="btn-export-ics" data-export-url="${base}termine/ics/?__=EXPORT"></button></html>`,
  [base+'termine/ics/?__=EXPORT']:['BEGIN:VEVENT','DTSTART:20261103T180000','SUMMARY:Rat','DESCRIPTION:Link zur Tagesordnung: '+meetingUrl(8),'END:VEVENT'].join('\r\n'),
  [meetingUrl(2)]:agenda('Rat','Do, 24.09.2026',[agendaRow('top-oeff-data','4.','Bestellung','79/2026','505_3022',paperLinks('79/2026'))]),
  [meetingUrl(1)]:agenda('Haupt- und Finanzausschuss','Do, 03.09.2026',[agendaRow('top-oeff-data','1.','Mitteilungen','','200_6040'),agendaRow('top-oeff-data','3.','Bestellung','79/2026','505_3022',paperLinks('79/2026'))]),
  [meetingUrl(8)]:'<html><p>Noch keine Tagesordnung.</p></html>',
  [matterUrl('792026')]:matter('79/2026','Bestellung',[{meeting:1,when:'Do, 03.09.2026',committee:'Haupt- und Finanzausschuss',result:'Einstimmig dafür, 0 Enthaltungen'},{meeting:2,when:'Do, 24.09.2026',committee:'Rat',result:'Einstimmig dafür, 0 Enthaltungen'},{meeting:95,when:'Do, 02.07.2026',committee:'Rat',result:'vertagt'}]),
 };
 const calls=[];const get=async url=>{calls.push(url);if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];};
 const d=await collectSdnet(source,{now,get,window:'1m'});
 // Two list pages without a meeting in the window end the list; page 4 and the meeting of July are never requested.
 assert.ok(!calls.includes(base+'vorlagen?__=PAGE4'));assert.ok(!calls.includes(meetingUrl(95)));assert.ok(!calls.includes(meetingUrl(90)));
 assert.equal(calls.filter(u=>u===matterUrl('792026')).length,1,'the paper page is read once');
 assert.equal(d.coverage.meetings,2);assert.equal(d.coverage.method,'scraper');assert.equal(d.topics.length,2);
 const paper=d.topics.find(t=>t.id==='nrw-05170004-vo-505_3022');
 assert.deepEqual(paper.events.map(e=>[e.date,e.committee,e.status,e.result]),[['2026-09-03','Haupt- und Finanzausschuss','recommended','Einstimmig dafür, 0 Enthaltungen'],['2026-09-24','Rat','approved','Einstimmig dafür, 0 Enthaltungen']]);
 assert.equal(paper.status,'approved');assert.equal(paper.eventDate,'2026-09-24');assert.equal(paper.regionId,source.id);assert.equal(paper.reference,'79/2026');
 // The meeting in November has no agenda yet: nothing public to read, so it is counted and not reported as a gap.
 assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.upcomingWithoutAgenda,1);assert.equal(d.coverage.complete,true);
 // A past meeting without a readable agenda is a gap.
 const gap=await collectSdnet(source,{now,window:'1m',get:async url=>url===meetingUrl(2)?'<html><p>Seite ohne Tagesordnung</p></html>':get(url)});
 assert.deepEqual(gap.coverage.issues,['Keine lesbare öffentliche Tagesordnung: '+meetingUrl(2),'Noch keine Artikel erfolgreich erfasst.']);assert.equal(gap.coverage.quiet,false);assert.equal(gap.coverage.complete,false);
 // Nothing published in a short window and no error: a quiet period, even when an upcoming meeting is already scheduled.
 const quiet=await collectSdnet(source,{now,window:'1w',get:async url=>url===base+'vorlagen'?paperList([paperRow('10/2026','Alt','Do, 05.02.2026','Rat',90)]):url in pages&&url!==base+'vorlagen'?pages[url]:(()=>{throw Error('unexpected '+url);})()});
 assert.equal(quiet.coverage.quiet,true);assert.equal(quiet.topics.length,0);assert.equal(quiet.coverage.upcomingWithoutAgenda,1);assert.deepEqual(quiet.coverage.issues,['Noch keine Artikel erfolgreich erfasst.']);
 // An unreadable paper list is an error note, never a quiet period.
 const failed=await collectSdnet(source,{now,window:'1w',get:async()=>{throw Error('Quelle antwortet mit HTTP 403');}});
 assert.equal(failed.coverage.quiet,false);assert.ok(failed.coverage.issues.some(i=>/HTTP 403/.test(i)));
});
test('SD.NET agenda is not confused with the table of late papers on the same page',()=>{
 const late='<table id="table1" class="table-data table-top.tischvorlagen table-cols-2"><caption>Tischvorlagen</caption><tbody><tr class="row-1" data-vorgang-id="505_1637"><td class="column-dokument"></td><td class="column-betreff">Ergänzung</td></tr></tbody></table>';
 const html=agenda('Rat','Do, 17.09.2026',[agendaRow('top-oeff-data','1.','Haushalt','67/2026','505_1637',paperLinks('67/2026'))]).replace('<table id="table0"',late+'<table id="table0"');
 const items=parseSdnetAgenda(html,{url:meetingUrl(4),date:'2026-09-17',committee:'Rat'},source,now);
 assert.deepEqual(items.map(i=>i.title),['Haushalt']);
 assert.equal(parseSdnetAgenda('<html>'+late+'</html>',{url:meetingUrl(4),date:'2026-09-17',committee:'Rat'},source,now),null);
});
