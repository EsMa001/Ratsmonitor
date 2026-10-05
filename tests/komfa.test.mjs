import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectKomfa,komfaMonthUrl,parseKomfaCalendar,parseKomfaAgenda,collectKomfa,NOT_PUBLIC} from '../server/integrations/komfa.mjs';
import {READERS} from '../server/integrations/readers.mjs';
// Pages of KOMFA-RIS (kommunalfabrik) saved on 05.10.2026: Delitzsch (one town, "Öffentlicher Teil") and the Amt Woldegk
// (several municipalities; "I. öffentliche Sitzung" and the titles of the non-public part; agendas without a heading).
const fixture=name=>readFileSync(new URL('./fixtures/komfa/'+name,import.meta.url),'utf8');
const now=new Date('2026-10-05T12:00:00Z');
const delitzsch={id:'de-14730070',name:'Stadt Delitzsch',kind:'city',method:'scraper',adapter:'komfa',base:'https://ris-delitzsch.komfa.de/'};
const woldegk={id:'de-130715755',name:'Amt Woldegk',kind:'city',method:'scraper',adapter:'komfa',base:'https://ris-woldegk.komfa.de/'};
const meetingUrl=(source,id)=>source.base+'index.php?module=komfaris&action=to&id='+id;

test('KOMFA is recognised from its module and the vendor; a page that only links it is not',async()=>{
 assert.deepEqual(detectKomfa('https://ris-delitzsch.komfa.de/index.php?module=komfaris&action=cal',fixture('delitzsch-cal-2026-09.html')),{base:'https://ris-delitzsch.komfa.de/'});
 assert.deepEqual(detectKomfa('http://ris-woldegk.komfa.de/index.php',fixture('woldegk-neetzka-hauptausschuss-2026-09-24.html')),{base:'https://ris-woldegk.komfa.de/'});
 assert.equal(detectKomfa('https://www.delitzsch.de/','<a href="https://ris-delitzsch.komfa.de/index.php?module=komfaris&action=main">Ratsinformationssystem</a>'),null);
 assert.equal(detectKomfa('https://www.delitzsch.de/','<p>kommunalfabrik</p>'),null);
 assert.deepEqual(await READERS.komfa.detect('https://ris-delitzsch.komfa.de/index.php',fixture('delitzsch-cal-2026-09.html')),{base:'https://ris-delitzsch.komfa.de/'});
});

test('KOMFA month view: the meetings of the month asked for, with day and title; another month or page is refused',()=>{
 assert.equal(komfaMonthUrl(delitzsch,2026,9),'https://ris-delitzsch.komfa.de/index.php?module=komfaris&action=cal&SetFilter=calstartdate&FilterValue=2026-09-01');
 const meetings=parseKomfaCalendar(fixture('delitzsch-cal-2026-09.html'),delitzsch,{year:2026,month:9});
 assert.deepEqual(meetings.map(m=>[m.date,m.title]),[['2026-09-07','Stadt Delitzsch, Ausschuss für Schule, Kultur und Soziales'],['2026-09-08','Stadt Delitzsch, Technischer Ausschuss'],['2026-09-10','Stadt Delitzsch, Verwaltungs- und Finanzausschuss'],['2026-09-24','Stadt Delitzsch, Stadtrat']]);
 assert.equal(meetings[3].url,meetingUrl(delitzsch,'A7779B1DA212BBB3E314668D087DB6D8'));
 // The filter of the month was not taken: the view shows September for October.
 assert.throws(()=>parseKomfaCalendar(fixture('delitzsch-cal-2026-09.html'),delitzsch,{year:2026,month:10}),/September 2026 statt Oktober 2026/);
 assert.throws(()=>parseKomfaCalendar('<html><p>Wartung</p></html>',delitzsch,{year:2026,month:9}),/Unbekanntes Kalenderformat/);
});

test('KOMFA agenda: the items under "Öffentlicher Teil", papers by their number with their documents',()=>{
 const agenda=parseKomfaAgenda(fixture('delitzsch-stadtrat-2026-09-24.html'),{url:meetingUrl(delitzsch,'A7779B1DA212BBB3E314668D087DB6D8'),date:'2026-09-24',title:'Stadt Delitzsch, Stadtrat'},delitzsch,now);
 assert.equal(agenda.date,'2026-09-24');assert.equal(agenda.committee,'Stadtrat');assert.equal(agenda.left,0);
 assert.equal(agenda.items.length,11);
 const vote=agenda.items.find(i=>i.reference==='63-26');
 assert.equal(vote.id,'de-14730070-kf-vo-63-26');assert.equal(vote.title,'Wahl Referatsleitung Öffentlichkeitsarbeit');assert.equal(vote.status,'unknown');
 assert.deepEqual(vote.documents,[{title:'DS 63-26',url:'https://ris-delitzsch.komfa.de/index.php?module=komfaris&action=dla&id=54438',kind:'application/pdf'},{title:'Entwurf Stimmzettel',url:'https://ris-delitzsch.komfa.de/index.php?module=komfaris&action=dla&id=54415',kind:'application/pdf'}]);
 assert.ok(agenda.items.some(i=>i.title.startsWith('Wohnbauvorhaben „Flst. 43/32')),'typographic quotes are decoded');
 // Items without a paper are told apart by meeting, number and title.
 assert.match(agenda.items[0].id,/^de-14730070-kf-top-20260924-[0-9a-f]{8}$/);
 const ahead=parseKomfaAgenda(fixture('delitzsch-stadtrat-2026-09-24.html'),{url:meetingUrl(delitzsch,'X'),date:'2026-09-24',title:'Stadt Delitzsch, Stadtrat'},delitzsch,new Date('2026-09-01T12:00:00Z'));
 assert.equal(ahead.items.find(i=>i.reference==='63-26').status,'consulting');assert.equal(ahead.items[0].status,'announced');
});

test('KOMFA agenda: the non-public part ends the agenda; its titles are never taken, nor a title that names it',()=>{
 const agenda=parseKomfaAgenda(fixture('woldegk-stadtvertretung-2026-09-08.html'),{url:meetingUrl(woldegk,'S'),date:'2026-09-08',title:'Windmühlenstadt Woldegk, Stadtvertretung'},woldegk,now);
 assert.equal(agenda.committee,'Windmühlenstadt Woldegk, Stadtvertretung');
 const titles=agenda.items.map(i=>i.title).join('\n');
 for(const hidden of ['Veräußerung eines Grundstückes','Verlängerung eines sachgrundbefristeten Arbeitsvertrages','Billigung der Niederschrift des nichtöffentlichen Teils','Schließen der nichtöffentlichen Sitzung'])assert.ok(!titles.includes(hidden),hidden);
 assert.ok(!titles.includes('in letzter nichtöffentlicher Sitzung'),'an item that names the non-public part is left out');
 assert.ok(agenda.left>=1);
 assert.equal(agenda.items.at(-1).title,'Anfragen der Stadtvertreter und Mitteilungen');
 assert.ok(agenda.items.some(i=>i.reference==='47/2026-239'&&i.id==='de-130715755-kf-vo-47-2026-239'));
});

test('KOMFA agenda without a part heading: public with the meeting\'s public notice, otherwise nothing (fail closed)',()=>{
 const page=fixture('woldegk-neetzka-hauptausschuss-2026-09-24.html'),m={url:meetingUrl(woldegk,'N'),date:'2026-09-24',title:'Gemeinde Neetzka, Hauptausschuss'};
 const agenda=parseKomfaAgenda(page,m,woldegk,now);
 assert.equal(agenda.committee,'Gemeinde Neetzka, Hauptausschuss');assert.equal(agenda.items.length,7);
 assert.match(agenda.items[0].event.publicEvidence,/ohne Teilüberschrift; öffentliche Bekanntmachung/);
 assert.equal(parseKomfaAgenda(page.replaceAll('Bekanntmachung-oeffentlich','Einladung'),m,woldegk,now).items,null);
 // A heading of the non-public part before any public one: nothing, also with a public notice.
 const closedFirst=page.replace(/(<table class="table table-hover">)/,'$1<tr><td class="w05 right"><b>I.</b></td><td class="left"><b>nichtöffentliche Sitzung</b></td><td class="w20 right"></td><td class="w10 left"></td></tr>');
 assert.equal(parseKomfaAgenda(closedFirst,m,woldegk,now).items,null);
 // The agenda closes its public part itself: what stands before is public, what follows is not read.
 const closing=page.replace('Anfragen, Verschiedenes','Schließen der öffentlichen Sitzung').replaceAll('Bekanntmachung-oeffentlich','Einladung');
 assert.deepEqual(parseKomfaAgenda(closing,m,woldegk,now).items.map(i=>i.agenda.number),['1.','2.','3.','4.','5.']);
 // "Die Tagesordnung ist nicht verfügbar."
 const missing=parseKomfaAgenda(fixture('delitzsch-ausschuss-2026-09-07.html'),{url:meetingUrl(delitzsch,'A'),date:'2026-09-07',title:'Stadt Delitzsch, Ausschuss für Schule, Kultur und Soziales'},delitzsch,now);
 assert.equal(missing.available,false);assert.equal(missing.items,null);
});

// The period of a month back from 08.10. begins on 08.09.: the meeting of 07.09. lies before it.
const later=new Date('2026-10-08T12:00:00Z');
// A fake system: the September view of Delitzsch, empty views of the other months (the same page without events) and the
// agenda pages; every address asked is recorded.
function system(){
 const september=fixture('delitzsch-cal-2026-09.html'),asked=[];
 const empty=month=>september.replace('September 2026',month).replace(/<div class="cal_event">[\s\S]*?<\/div><\/div>/g,'');
 const pages={
  [komfaMonthUrl(delitzsch,2026,12)]:empty('Dezember 2026'),[komfaMonthUrl(delitzsch,2026,11)]:empty('November 2026'),[komfaMonthUrl(delitzsch,2026,10)]:empty('Oktober 2026'),[komfaMonthUrl(delitzsch,2026,9)]:september,
  [meetingUrl(delitzsch,'A7779B1DA212BBB3E314668D087DB6D8')]:fixture('delitzsch-stadtrat-2026-09-24.html'),
  [meetingUrl(delitzsch,'A7779B1DA212BBB3E314648DE46D03B7')]:fixture('delitzsch-ausschuss-2026-09-07.html').replace('17:30','18:00'),
  [meetingUrl(delitzsch,'A7779B1DA212BBB3E314638D144CC4C0')]:fixture('delitzsch-ausschuss-2026-09-07.html'),
 };
 return {asked,get:async url=>{asked.push(url);if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];}};
}

test('collectKomfa reads the months of the period, newest first, and the agenda of each meeting in it',async()=>{
 const web=system();
 const d=await collectKomfa(delitzsch,{now:later,get:web.get,window:'1m'});
 assert.deepEqual(web.asked.slice(0,4),[komfaMonthUrl(delitzsch,2026,12),komfaMonthUrl(delitzsch,2026,11),komfaMonthUrl(delitzsch,2026,10),komfaMonthUrl(delitzsch,2026,9)]);
 assert.ok(!web.asked.includes(meetingUrl(delitzsch,'A7779B1DA212BBB3E314628D7410ECCA')),'a meeting before the period is not asked');
 assert.ok(web.asked.every(u=>u.startsWith(delitzsch.base)));
 assert.equal(d.coverage.meetings,3);assert.equal(d.readMeetings,1);
 assert.equal(d.topics.length,11);assert.ok(d.topics.every(t=>t.committee==='Stadtrat'&&t.regionId===delitzsch.id&&t.public===true));
 assert.equal(d.topics.find(t=>t.id==='de-14730070-kf-vo-63-26').sourceData.method,'komfa');
 assert.deepEqual(d.coverage.warnings.filter(w=>/ohne veröffentlichte Tagesordnung/.test(w)).length,2);
 assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.complete,true);
 assert.match(d.topics[0].longSummary[0],/Stadt Delitzsch/);
});

test('collectKomfa keeps the meetings of one member by the calendar title (organizations) and names a list it cannot read',async()=>{
 const web=system();
 const d=await collectKomfa({...delitzsch,organizations:{include:['Technischer Ausschuss']}},{now:later,get:web.get,window:'1m'});
 assert.deepEqual(web.asked.slice(4),[meetingUrl(delitzsch,'A7779B1DA212BBB3E314638D144CC4C0')]);
 assert.ok(d.coverage.warnings.includes('2 Sitzungen anderer Gremien des gemeinsamen Systems ausgelassen.'));
 const broken=await collectKomfa(delitzsch,{now:later,get:async()=>{throw Error('Quelle antwortet mit HTTP 403');},window:'1m'});
 assert.deepEqual(broken.coverage.issues,['Kalender 12/2026: Quelle antwortet mit HTTP 403','Noch keine Artikel erfolgreich erfasst.']);
 assert.equal(NOT_PUBLIC,'Sitzung ohne öffentlichen Teil auf der Seite');
});
