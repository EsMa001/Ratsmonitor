import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LOGIN,detectPiwi,piwiCalendar,parsePiwiAgenda,parsePiwiPaper,parsePiwiVote,collectPiwi} from '../server/integrations/piwi.mjs';
// Excerpts of pages of piwi.wiesbaden.de as published on 04.10.2026.
const fixture=name=>fs.readFileSync(new URL('./fixtures/piwi-pio/'+name,import.meta.url),'utf8');
const base='https://piwi.wiesbaden.de/',source={id:'de-06414000',name:'Stadt Wiesbaden',kind:'city',method:'scraper',adapter:'piwi',base};
const now=new Date('2026-10-04T12:00:00Z');
const agendaUrl=id=>`${base}sitzung/detail/${id}/tagesordnung/oeffentlich`,voteUrl=id=>`${base}sitzung/top/${id}/abstimmungsergebnis`;
const stv={url:agendaUrl(3710849),date:'2026-09-30',committee:'Stadtverordnetenversammlung'};
// A public agenda with one row per item: [number, title, paper kind, paper id, reference].
const agenda=(heading,rows)=>`<main><h1 class="font-size-biggest"><span class="d-inline-block">${heading}</span></h1><section class="card"><div class="card-header"><div><h2>Öffentliche Tagesordnung</h2></div></div><div class="d-table w-100">${rows.map(([number,title,kind,id,reference])=>`<div class="d-table-row odd"><div class="d-table-cell px-1 py-2 text-center"><img class="svg-icon" src="../../../../images/TO_TOP.svg" alt=""></div><div class="d-table-cell px-1 py-2 text-center"><span>${number}</span></div><div class="d-table-cell px-1 py-2"><div class="d-flex"><div class="flex-grow-1"><span class="text-keepwhitespace">${title}</span></div></div>${kind?`<div class="mt-2 d-flex"><div><a href="../../../../${kind}/detail/${id}" title="Öffnet den Vorgang „${reference}“">${reference}</a></div></div>`:''}</div></div>`).join('')}</div></section><section class="col-12 docview-visibility"></section></main>`;
test('PIWi is recognised by its pages; the base is the root of the application',()=>{
 assert.deepEqual(detectPiwi('https://piwi.wiesbaden.de/aktuelles;jsessionid=546D4143607FAFB8908A1310DCE79DF0?0','<title>PIWi - Politisches Informationssystem Wiesbaden - Aktuelle Sitzungen</title>'),{adapter:'piwi',base});
 assert.deepEqual(detectPiwi(stv.url,fixture('piwi-to-stv.html')),{adapter:'piwi',base});
 assert.equal(detectPiwi('https://pio.offenbach.de/',fixture('pio-tagesordnungen.html')),null);
 // The members' login carries the same title; its base is the root as well, not the login folder.
 assert.deepEqual(detectPiwi('https://piwi.wiesbaden.de/extranet/login;jsessionid=0123ABCD.node1?0','<title>PIWi - Politisches Informationssystem Wiesbaden - Anmeldung</title>'),{adapter:'piwi',base});
 assert.deepEqual(detectPiwi('https://piwi.wiesbaden.de/abo/neu','<title>PIWi - Politisches Informationssystem Wiesbaden</title>'),{adapter:'piwi',base});
});
test('PIWi calendar export yields the agenda address, the local day and the body; cancelled meetings are marked',()=>{
 const list=piwiCalendar(fixture('piwi-kalender.ics'),source);
 assert.deepEqual(list.map(m=>[m.url,m.date,m.committee,m.cancelled]),[
  [agendaUrl(3585879),'2026-01-13','Ortsbeirat Kastel',false],[agendaUrl(3509343),'2026-08-27','Ortsbeirat Mitte',true],
  [agendaUrl(3823664),'2026-09-30','Ausschuss für Finanzen und Beteiligungen',false],[agendaUrl(3823682),'2026-09-30','Ausschuss für Frauen, Gleichstellung, Gesundheit und Pflege',false],
  [stv.url,'2026-09-30','Stadtverordnetenversammlung',false],[agendaUrl(3547929),'2026-10-01','Ortsbeirat Biebrich',false],[agendaUrl(3710949),'2026-12-10','Stadtverordnetenversammlung',false]]);
 // Times are UTC: a meeting at 0:30 in Wiesbaden is on the local day; a link outside the source is not taken.
 const ics='BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260930T223000Z\r\nSUMMARY:Sitzung Rat\r\nURL:https://piwi.wiesbaden.de/sitzung/detail/1\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20260930T100000Z\r\nSUMMARY:Sitzung Fremd\r\nURL:https://elsewhere.example/sitzung/detail/2\r\nEND:VEVENT\r\nEND:VCALENDAR';
 assert.deepEqual(piwiCalendar(ics,source).map(m=>m.date),['2026-10-01']);
 // A meeting called off only by the status of the entry is marked as well.
 const off='BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260930T160000Z\r\nSUMMARY:Sitzung Ortsbeirat Mitte\r\nSTATUS:CANCELLED\r\nURL:https://piwi.wiesbaden.de/sitzung/detail/3\r\nEND:VEVENT\r\nEND:VCALENDAR';
 assert.deepEqual(piwiCalendar(off,source).map(m=>[m.committee,m.cancelled]),[['Ortsbeirat Mitte',true]]);
});
test('PIWi public agenda: parts, papers, votes and decision documents; a paper in two parts is one item',()=>{
 const a=parsePiwiAgenda(fixture('piwi-to-stv.html'),stv,source,now);
 assert.equal(a.date,'2026-09-30');assert.equal(a.committee,'Stadtverordnetenversammlung');
 assert.deepEqual(a.items.map(i=>[i.agenda.section,i.agenda.number,i.reference,i.agenda.voteUrl]),[
  ['Tagesordnung I','1.','',null],['Tagesordnung I','3.1','26-V-01-0012',null],['Tagesordnung II','1.','26-F-01-0032',voteUrl(3827953)],
  ['Tagesordnung I','25.','26-V-41-0020',null],['Tagesordnung II','10.','26-V-15-0004',voteUrl(3826900)],['Tagesordnung III','3.','26-V-61-0014',voteUrl(3823047)]]);
 const plan=a.items.at(-1);
 assert.equal(plan.id,'de-06414000-vo-26-v-61-0014');assert.equal(plan.sourceUrl,base+'sitzungsvorlage/detail/3747762');assert.deepEqual(plan.identityLinks,[base+'sitzungsvorlage/detail/3747762']);
 assert.deepEqual(plan.documents,[{title:'0315_Beschluss',url:base+'dokument/v/3832098',kind:'application/pdf'}]);
 assert.match(plan.event.publicEvidence,/Tagesordnung III/);
 // The paper of item 18 in part I was decided in part II: one item that carries the vote of part II.
 assert.equal(a.items.filter(i=>i.reference==='26-F-01-0032').length,1);
 assert.match(a.items[0].id,/^de-06414000-top-20260930-[0-9a-f]{8}$/);assert.equal(a.items[0].sourceUrl,stv.url);
 assert.equal(a.items[0].event.description,'Öffentlich auf der Tagesordnung; ein Beschluss liegt laut Quelle noch nicht vor.');
 // A meeting still ahead: announced, a paper under consultation.
 const ahead=parsePiwiAgenda(fixture('piwi-to-stv.html'),stv,source,new Date('2026-09-01T12:00:00Z'));
 assert.deepEqual(ahead.items.slice(0,2).map(i=>i.status),['announced','consulting']);
 // Rows below a heading of the non-public part are never taken; a page without a public agenda is none.
 for(const heading of ['Nichtöffentliche Tagesordnung','III. Nicht öffentlicher Teil','Vertrauliche Angelegenheiten']){
  const closed=fixture('piwi-to-stv.html').replace('font-weight-medium">Tagesordnung III','font-weight-medium">'+heading);
  assert.ok(!parsePiwiAgenda(closed,stv,source,now).items.some(i=>i.reference==='26-V-61-0014'),heading);
 }
 // … also when the heading row carries another icon.
 const other=fixture('piwi-to-stv.html').replace(/TO_Ueberschrift(\.svg(?:(?!TO_)[\s\S])*?Tagesordnung) III/,'TO_Abschnitt$1 III – nicht öffentlich');
 assert.equal(other.match(/TO_Ueberschrift/g).length,3);assert.ok(!parsePiwiAgenda(other,stv,source,now).items.some(i=>i.reference==='26-V-61-0014'));
 assert.equal(parsePiwiAgenda('<main><h1>Anmeldung</h1></main>',stv,source,now),null);
 // Links that Wicket rewrote with the session (";jsessionid=…") keep the papers, votes, documents and ids.
 const rewritten=fixture('piwi-to-stv.html').replace(/href="([^"]*(?:detail\/\d+|abstimmungsergebnis|dokument\/v\/\d+))"/g,'href="$1;jsessionid=0123ABCD.node1?2"');
 const same=list=>list.items.map(i=>[i.id,i.reference,i.sourceUrl,i.identityLinks,i.documents,i.agenda]);
 assert.equal(rewritten.match(/jsessionid/g).length,12);assert.deepEqual(same(parsePiwiAgenda(rewritten,stv,source,now)),same(a));
});
test('PIWi paper page yields fields, documents and the consultation sequence; the vote page yields the vote',()=>{
 const p=parsePiwiPaper(fixture('piwi-vorlage.html'),source,base+'sitzungsvorlage/detail/3747762');
 assert.deepEqual(p.fields,[{field:'Vorgang',value:'Sitzungsvorlage 26-V-61-0014'},{field:'Betreff',value:'Neuer Flächennutzungsplan der Landeshauptstadt Wiesbaden - Beschluss des Vorentwurfs -'},{field:'Vom',value:'16.06.2026'},{field:'Art',value:'Öffentlicher Vorgang'}]);
 assert.deepEqual(p.documents.map(d=>[d.title,d.url]),[['Anlage 4 Teil 8_Landschaftsplan 1. Fortschreibung',base+'dokument/v/3747799'],['Anlage 4 Teil 1_Landschaftsplan 1. Fortschreibung',base+'dokument/v/3747785']]);
 assert.deepEqual(p.consultations.map(c=>[c.url,c.date,c.committee,c.documents.map(d=>d.url)]),[
  [stv.url,'2026-09-30','Stadtverordnetenversammlung',[base+'dokument/v/3832098']],[agendaUrl(3766507),'2026-09-22','Ausschuss für Stadtentwicklung, Planung und Sicherheit',[]],[agendaUrl(3710648),'2026-09-15','Umweltausschuss',[base+'dokument/v/3824769']]]);
 assert.equal(p.restricted,false);
 // A paper marked as not public keeps no document.
 const restricted=parsePiwiPaper(fixture('piwi-vorlage.html').replace('<span>Öffentlicher Vorgang</span>','<span>Nichtöffentlicher Vorgang</span>'),source,base+'sitzungsvorlage/detail/3747762');
 assert.equal(restricted.restricted,true);assert.deepEqual(restricted.documents,[]);assert.ok(restricted.consultations.every(c=>!c.documents.length));
 assert.ok(!restricted.fields.some(f=>f.field==='Betreff'),'the subject of a paper that is not public is not kept');
 assert.equal(restricted.consultations.length,3,'the meetings that discussed it are still named');
 // A paper whose mark is missing or says something else counts as not public as well.
 for(const mark of ['<span>Vertraulicher Vorgang</span>','<span>Sonstiges</span>']){
  const p=parsePiwiPaper(fixture('piwi-vorlage.html').replace('<span>Öffentlicher Vorgang</span>',mark),source,base+'sitzungsvorlage/detail/3747762');
  assert.equal(p.restricted,true,mark);assert.deepEqual(p.documents,[]);
 }
 const unmarked=parsePiwiPaper(fixture('piwi-vorlage.html').replace(/<div class="keyvalue-key">Art:/,'<div class="keyvalue-key">Typ:'),source,base+'sitzungsvorlage/detail/3747762');
 assert.equal(unmarked.restricted,true);assert.deepEqual(unmarked.documents,[]);
 // A page that is not recognisable is none.
 assert.equal(parsePiwiPaper('<html><body>Internal error</body></html>',source,base+'antrag/detail/1'),null);
 assert.equal(parsePiwiVote(fixture('piwi-abstimmung.html')),'Einstimmig');assert.equal(parsePiwiVote(fixture('piwi-abstimmung-umsetzung.html')),'Umsetzung auf TO I');
 assert.equal(parsePiwiVote('<html><body>Internal error</body></html>'),null);
});
test('PIWi collector: calendar, public agendas, votes and papers; follows the consultation sequence; never asks for the login',async()=>{
 const minimal=(id,heading)=>agenda(heading,[['1.','Neuer Flächennutzungsplan der Landeshauptstadt Wiesbaden - Beschluss des Vorentwurfs -','sitzungsvorlage',3747762,'26-V-61-0014']]);
 const pages={
  [base+'gremium/ical/gremium/0']:fixture('piwi-kalender.ics'),
  [stv.url]:fixture('piwi-to-stv.html'),
  [agendaUrl(3547929)]:agenda('Donnerstag, 1. Oktober 2026, 18:30 Uhr - Ortsbeirat Biebrich',[['1.','Mitteilungen']]),
  [agendaUrl(3766507)]:minimal(3766507,'Dienstag, 22. September 2026, 17:00 Uhr - Ausschuss für Stadtentwicklung, Planung und Sicherheit'),
  [agendaUrl(3710648)]:minimal(3710648,'Dienstag, 15. September 2026, 18:00 Uhr - Umweltausschuss'),
  [base+'sitzungsvorlage/detail/3747762']:fixture('piwi-vorlage.html'),
  [voteUrl(3826900)]:fixture('piwi-abstimmung.html'),[voteUrl(3823047)]:fixture('piwi-abstimmung-umsetzung.html'),
  [voteUrl(3827953)]:fixture('piwi-abstimmung.html').replace('<div class="card-body">Einstimmig</div>','<div class="card-body">Mehrheitlich abgelehnt</div>'),
 };
 // The meetings without a released public agenda answer with the redirect to the login, which the reader refuses.
 const login=new Set([agendaUrl(3823664),agendaUrl(3823682),agendaUrl(3710949)]);
 const calls=[];const get=async url=>{calls.push(url);if(login.has(url))throw Error(LOGIN);if(url in pages)return pages[url];if(/\/(antrag|sitzungsvorlage)\/detail\/\d+$/.test(url))return '<main><h1><span>Antrag</span></h1></main>';throw Error('Quelle antwortet mit HTTP 404');};
 const d=await collectPiwi(source,{now,get,window:'1m'});
 assert.ok(!calls.includes(agendaUrl(3585879)),'the meeting of January lies outside the period');
 assert.ok(!calls.includes(agendaUrl(3509343)),'a cancelled meeting is not read');
 assert.ok(calls.includes(agendaUrl(3766507))&&calls.includes(agendaUrl(3710648)),'meetings named in the consultation sequence are read');
 assert.equal(calls.filter(u=>u===base+'sitzungsvorlage/detail/3747762').length,1,'the paper page is read once');
 assert.ok(calls.every(u=>u.startsWith(base)&&!/extranet|nichtoeffentlich|dokument\//.test(u)));
 // Past meetings without a released public agenda are a remark; the one ahead has nothing public yet.
 assert.deepEqual([...d.coverage.warnings].sort(),[agendaUrl(3823664),agendaUrl(3823682)].map(u=>'Sitzung ohne öffentliche Tagesordnung: '+u));
 assert.ok(!calls.includes(agendaUrl(3710949)),'meetings after the end of next month are not read');assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.complete,true);
 assert.equal(d.coverage.meetings,6);
 const plan=d.topics.find(t=>t.id==='de-06414000-vo-26-v-61-0014');
 assert.deepEqual(plan.events.map(e=>[e.date,e.committee,e.status,e.result]),[['2026-09-15','Umweltausschuss','unknown',''],['2026-09-22','Ausschuss für Stadtentwicklung, Planung und Sicherheit','unknown',''],['2026-09-30','Stadtverordnetenversammlung','unknown','Umsetzung auf TO I']]);
 assert.ok(plan.documents.some(x=>x.url===base+'dokument/v/3747799')&&plan.documents.some(x=>x.url===base+'dokument/v/3832098'));
 const rejected=d.topics.find(t=>t.reference==='26-F-01-0032');assert.equal(rejected.status,'rejected');assert.equal(rejected.events[0].decision.kind,'decision');
 const unanimous=d.topics.find(t=>t.reference==='26-V-15-0004');assert.equal(unanimous.status,'unknown');assert.equal(unanimous.events[0].description,'Abstimmungsergebnis: Einstimmig. Der Beschlusstext liegt als PDF vor.');
 assert.ok(d.topics.every(t=>t.regionId===source.id&&t.public===true&&t.sourceData.method==='piwi'&&!('event' in t)&&!('agenda' in t)));
 // A later import with the marks of this one reads the agendas again, but not the pages behind them.
 const again=[],next=await collectPiwi(source,{now:new Date('2026-10-25T12:00:00Z'),window:'1m',marks:{known:d.marks,stock:new Set(Object.keys(d.marks))},get:async url=>{again.push(url);return get(url);}});
 assert.equal(next.coverage.unchangedMeetings,2);assert.ok(again.includes(stv.url)&&!again.some(u=>/abstimmungsergebnis|sitzungsvorlage\/detail/.test(u)));
 // Only a meeting ahead without a released agenda: nothing public yet, a quiet period.
 const quiet=await collectPiwi(source,{now:new Date('2026-11-20T12:00:00Z'),get,window:'1w'});
 assert.equal(quiet.coverage.upcomingWithoutAgenda,1);assert.equal(quiet.coverage.quiet,true);assert.deepEqual(quiet.coverage.issues,['Noch keine Artikel erfolgreich erfasst.']);
 // A period that reaches before the first meeting of the export is reported as a gap.
 const long=await collectPiwi(source,{now,get,window:'12m'});
 assert.ok(long.coverage.issues.some(i=>/Kalenderexport der Quelle beginnt am 13\.01\.2026/.test(i)));assert.equal(long.coverage.complete,false);
 // An unreadable calendar export is an error note, never a quiet period.
 const failed=await collectPiwi(source,{now,window:'1m',get:async()=>{throw Error('Quelle antwortet mit HTTP 403');}});
 assert.equal(failed.coverage.quiet,false);assert.ok(failed.coverage.issues.some(i=>/Kalenderexport: Quelle antwortet mit HTTP 403/.test(i)));
 // A meeting called off only by the status of its calendar entry is not read, even when a paper names it in its
 // consultation sequence. A paper page or vote page that is not recognisable is a gap, never an empty result.
 const ics=fixture('piwi-kalender.ics').replace('END:VCALENDAR','BEGIN:VEVENT\r\nDTSTART:20260922T150000Z\r\nSUMMARY:Sitzung Ausschuss für Stadtentwicklung, Planung und Sicherheit\r\nSTATUS:CANCELLED\r\nURL:https://piwi.wiesbaden.de/sitzung/detail/3766507\r\nEND:VEVENT\r\nEND:VCALENDAR');
 const broken={[base+'gremium/ical/gremium/0']:ics,[base+'sitzungsvorlage/detail/3822882']:'<html><body>Internal error</body></html>',[voteUrl(3827953)]:'<html><body>Internal error</body></html>'};
 const asked=[],odd=await collectPiwi(source,{now,window:'1m',get:async url=>{asked.push(url);return url in broken?broken[url]:get(url);}});
 assert.ok(!asked.includes(agendaUrl(3766507))&&asked.includes(agendaUrl(3710648)));
 assert.ok(odd.coverage.issues.includes('Vorlagendetails: Unbekanntes Format der Vorlagenseite: '+base+'sitzungsvorlage/detail/3822882'));
 assert.ok(odd.coverage.issues.includes('Abstimmungsergebnis: Unbekanntes Format der Abstimmungsseite: '+voteUrl(3827953)));assert.equal(odd.coverage.complete,false);
 assert.equal(odd.topics.find(t=>t.reference==='26-V-15-0004').sourceData.detailStatus,'partial');
});
test('PIWi collector refuses the redirect to the login before it is sent and keeps one session',async()=>{
 const sent=[];
 const request=async(url,init)=>{sent.push({url,cookie:init.headers.Cookie||''});
  if(url===base+'gremium/ical/gremium/0')return new Response(fixture('piwi-kalender.ics'),{status:200,headers:{'content-type':'text/calendar;charset=UTF-8','set-cookie':'JSESSIONID=ABC; Path=/; Secure; HttpOnly'}});
  if(url===stv.url)return new Response(agenda('Mittwoch, 30. September 2026, 16:00 Uhr - Stadtverordnetenversammlung',[['1.','Mitteilungen']]),{status:200,headers:{'content-type':'text/html;charset=UTF-8'}});
  if(/\/sitzung\/detail\/\d+\/tagesordnung\/oeffentlich$/.test(url))return new Response(null,{status:302,headers:{location:'../../../../extranet/login;jsessionid=DEF'}});
  return new Response('nicht gefunden',{status:404});};
 const d=await collectPiwi(source,{now,request,window:'1w'});
 assert.ok(sent.length>2&&sent.every(s=>!/extranet/.test(s.url)));
 assert.ok(sent.slice(1).every(s=>s.cookie==='JSESSIONID=ABC'),'later requests carry the cookie of the first answer');
 assert.equal(d.topics.length,1);assert.ok(d.coverage.warnings.every(w=>/^Sitzung ohne öffentliche Tagesordnung/.test(w)));
});
