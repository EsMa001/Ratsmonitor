import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectRisPortal,risPortalMonthUrl,risPortalMeetings,parseRisPortalMeeting,parseRisPortalVote,collectRisPortal} from '../server/integrations/ris-portal.mjs';
import {READERS} from '../server/integrations/readers.mjs';
// Public pages of three RIS-Portal systems, retrieved on 05.10.2026 and shortened (scripts, participants and meeting
// data left out; the agenda markup as served): Gemeinde Welver (public and non-public part), Gemeindeverwaltungsverband
// Hexental (one system for the councils of its members, with published votes), Gemeinde Großefehn (heading
// "Öffentlich", a voting form of the members inside every item). The month lists are the JSON of the meeting portlet.
// RIS-Portal has no pages for papers; the document of a paper (Sitzungsvorlage) joins its consultations.
const fixture=name=>readFileSync(new URL('./fixtures/ris-portal/'+name,import.meta.url),'utf8');
const now=new Date('2026-10-05T12:00:00Z');
const welver={id:'nrw-05974048',name:'Gemeinde Welver',kind:'city',method:'scraper',adapter:'ris-portal',base:'https://welver.ris-portal.de/web/ratsinformation/'};
const hexental={id:'de-08315074',name:'Gemeinde Merzhausen',kind:'city',method:'scraper',adapter:'ris-portal',base:'https://vghexental.ris-portal.de/'};
const grossefehn={id:'nds-03452006',name:'Gemeinde Großefehn',kind:'city',method:'scraper',adapter:'ris-portal',base:'https://grossefehn.ris-portal.de/web/ratsinformation/'};
const meetingOf=(source,id,date,committee)=>({id,url:source.base.replace(/\/web\/ratsinformation\/$/,'/web/ratsinformation/')+'sitzungen?sitzungId='+id,date,committee});

test('RIS-Portal is recognised from the theme and its meeting portlet; the site comes from the page',async()=>{
 assert.deepEqual(detectRisPortal('https://welver.ris-portal.de/web/ratsinformation/sitzungen',fixture('welver-sitzungen.html')),{adapter:'ris-portal',base:welver.base});
 // A host mapped to its site: the root, although the meeting links run below /web/guest/.
 assert.deepEqual(detectRisPortal('https://vghexental.ris-portal.de/startseite',fixture('vghexental-startseite.html')),{adapter:'ris-portal',base:hexental.base});
 // Without the portlet's own address the site is taken from the address of the page.
 assert.deepEqual(detectRisPortal('https://hinte.ris-portal.de/web/ratsinformation/startseite','<link href="/o/obis-theme/css/main.css"><div id="p_p_id_RisSitzung_"></div>'),{adapter:'ris-portal',base:'https://hinte.ris-portal.de/web/ratsinformation/'});
 // The general start page of a portal links its sites; the council site is taken (welver.ris-portal.de/startseite).
 assert.deepEqual(detectRisPortal('https://welver.ris-portal.de/startseite','<link href="/o/obis-theme/css/main.css"><script src="/o/ris-sitzung/js/portlet.functions.js"></script><a href="/web/guest">Start</a><a href="/web/ratsinformation">Ratsinformation</a><a href="/web/stellenportal">Stellen</a>'),{adapter:'ris-portal',base:welver.base});
 // Another Liferay portal, and a municipal page that links the system, are no RIS-Portal.
 assert.equal(detectRisPortal('https://www.example.test/web/guest/','<link href="/o/classic-theme/css/main.css"><div id="p_p_id_RisSitzung_"></div>'),null);
 assert.equal(detectRisPortal('https://www.welver.de/','<a href="https://welver.ris-portal.de/web/ratsinformation/sitzungen">Ratsinformation</a>'),null);
 assert.deepEqual(await READERS['ris-portal'].detect('https://welver.ris-portal.de/web/ratsinformation/sitzungen',fixture('welver-sitzungen.html')),{base:welver.base});
});

test('RIS-Portal month list: meetings with day, full body name and their own page; foreign links are dropped',()=>{
 const url=new URL(risPortalMonthUrl(welver,2026,8));
 assert.equal(url.origin+url.pathname,'https://welver.ris-portal.de/web/ratsinformation/sitzungen');
 assert.equal(url.searchParams.get('_RisSitzung_resource'),'loadSessions');assert.equal(url.searchParams.get('_RisSitzung_month'),'8');assert.equal(url.searchParams.get('p_p_lifecycle'),'2');
 const list=risPortalMeetings(fixture('welver-sessions-2026-09.json'),welver);
 assert.equal(list.length,5);
 assert.deepEqual(list[0],{id:'216451',url:'https://welver.ris-portal.de/web/ratsinformation/sitzungen?sitzungId=216451',date:'2026-09-03',committee:'Rat',shortName:'Rat',cancelled:false});
 assert.equal(list[1].committee,'Ausschuss für Sicherheit, Umwelt und Mobilität');assert.equal(list[1].shortName,'SUM');
 const shared=risPortalMeetings(fixture('vghexental-sessions-2026-09.json'),hexental);
 assert.deepEqual(shared.map(m=>m.committee),['Gemeinderat Wittnau','Gemeinderat Horben','Technischer Ausschuss Merzhausen','Gemeinderat Merzhausen','Gemeinderat Au','Gemeinderat Sölden']);
 assert.equal(shared[3].url,'https://vghexental.ris-portal.de/web/guest/sitzungen?sitzungId=192529');
 const odd=JSON.stringify([{sitzungId:1,start:'2026-09-01T18:00',sessionLink:'https://other.example.test/sitzungen?sitzungId=1',text:''},{sitzungId:2,start:'2026-09-02T18:00',sessionLink:'https://welver.ris-portal.de/web/ratsinformation/sitzungen?sitzungId=2',label:'Rat 02.09.2026',text:'<div class=\'rp-gremium-badge mbsc-hide-in-calendar\'>Rat</div><strong>Sitzung Rat am 02.09.2026 – abgesagt</strong>'},{sitzungId:'x',start:'2026-09-03'}]);
 assert.deepEqual(risPortalMeetings(odd,welver).map(m=>[m.id,m.cancelled]),[['2',true]]);
 assert.throws(()=>risPortalMeetings('{"error":"x"}',welver),/Unbekanntes Format/);
});

test('RIS-Portal meeting: only the items under the heading of the public part; the non-public part is cut off',()=>{
 const html=fixture('welver-sitzung-216451.html');
 const agenda=parseRisPortalMeeting(html,meetingOf(welver,'216451','2026-09-03','Rat'),welver,now);
 assert.equal(agenda.date,'2026-09-03');assert.equal(agenda.committee,'Rat');
 assert.deepEqual(agenda.items.map(i=>i.title.slice(0,40)),['Einwohnerfragestunde','Wirtschaftliche Beteiligung der Gemeinde','Errichtung eines Radweges entlang der K7','Anfragen / Mitteilungen']);
 // The titles of the non-public part stand on the same page; none of them is taken.
 const all=JSON.stringify(agenda);
 for(const secret of ['Ankauf Wohnhaus','Fortschreibung Wirtschaftswege','Reinigungsleistung'])assert.ok(!all.includes(secret),secret);
 assert.ok(html.includes('Ankauf Wohnhaus im Zentralort'),'the fixture holds the non-public part');
 // The paper is named by the id of its document; documents link the portlet resource on the same host.
 const paper=agenda.items[1];
 assert.equal(paper.id,'nrw-05974048-rp-vo-2828454');assert.equal(paper.status,'unknown');assert.equal(paper.event.publicEvidence,'Öffentliche Tagesordnung, Abschnitt „Öffentlicher Teil“');
 assert.ok(paper.documents.length>1&&paper.documents.every(d=>d.url.startsWith('https://welver.ris-portal.de/web/ratsinformation/sitzungen?')&&/_RisSitzung_resource=singleDocument/.test(d.url)));
 assert.match(agenda.items[0].id,/^nrw-05974048-rp-top-20260903-[0-9a-f]{8}$/);
 // A future meeting: announced, or consulting with a paper.
 const ahead=parseRisPortalMeeting(html,{...meetingOf(welver,'216451','2026-11-03','Rat')},welver,now);
 assert.equal(ahead.items[0].status,'announced');assert.equal(ahead.items[1].status,'consulting');
});

test('RIS-Portal meeting: published votes, items naming the non-public part left out, the members\' voting form no end',()=>{
 const shared=parseRisPortalMeeting(fixture('vghexental-sitzung-192529.html'),{id:'192529',url:'https://vghexental.ris-portal.de/web/guest/sitzungen?sitzungId=192529',date:'2026-09-24',committee:'Gemeinderat Merzhausen'},hexental,now);
 assert.equal(shared.items.length,7);assert.equal(shared.left,1);
 assert.ok(!shared.items.some(i=>/nichtöffentlich/i.test(i.title)),'"Bekanntgabe der Beschlüsse aus nichtöffentlichen Sitzungen" is not taken');
 const forest=shared.items.find(i=>/Beförsterung/.test(i.title));
 assert.equal(forest.status,'approved');assert.equal(forest.event.result,'Dem Beschlussvorschlag wird zugestimmt. (Ja 9, Nein 2, Enthalten 2)');
 assert.equal(shared.items.find(i=>/Tätigkeitsberichte/.test(i.title)).event.result,'Dem Beschlussvorschlag wird zugestimmt. (Ja 8, Nein 3, Enthalten 1, Befangen 1)');
 assert.equal(parseRisPortalVote('<div id="offcanvas-abstimmung1"></div>','2'),null);
 const council=parseRisPortalMeeting(fixture('grossefehn-sitzung-221624.html'),{id:'221624',url:'https://grossefehn.ris-portal.de/web/ratsinformation/sitzungen?sitzungId=221624',date:'2026-09-23',committee:'Rat der Gemeinde Großefehn'},grossefehn,now);
 assert.equal(council.items.length,14);assert.equal(council.items.at(-1).title,'Einwohnerfragestunde');
 assert.equal(council.items[0].event.publicEvidence,'Öffentliche Tagesordnung, Abschnitt „Öffentlich“');
});

test('RIS-Portal meeting fails closed: no public heading, a non-public or unknown heading first, nothing',()=>{
 const m={id:'1',url:welver.base+'sitzungen?sitzungId=1',date:'2026-09-03',committee:'Rat'};
 const list=(heading,title)=>`<h3 class="h4 accordion-list-header">${heading}</h3><ul><li class="rp-lis-item" data-top-number="1."><div class="top-item"><div class="top-item-content"><p><span>1.</span><span>${title}</span></p></div></div></li></ul>`;
 assert.equal(parseRisPortalMeeting('<h2 class="h1">Sitzung Rat am 03.09.2026</h2><p>Die Tagesordnung ist noch nicht veröffentlicht.</p>',m,welver,now),null);
 assert.equal(parseRisPortalMeeting(list('Nichtöffentlicher Teil','Grundstücksangelegenheit'),m,welver,now),null);
 // "Tagesordnung" alone names no part: the public agenda only when it is the page's only part.
 assert.deepEqual(parseRisPortalMeeting(list('Tagesordnung','Bebauungsplan Nord'),m,welver,now).items.map(i=>i.title),['Bebauungsplan Nord']);
 assert.equal(parseRisPortalMeeting(list('Tagesordnung','Bebauungsplan Nord')+list('Teil B','Personalsache Müller'),m,welver,now),null);
 for(const heading of ['Nicht öffentlicher Teil','- nichtöffentlich -','II. Nichtöffentlicher Teil','Tagesordnung: nichtöffentlich','Tagesordnung - Nichtöffentlich','Öffentlichkeitsarbeit','Teil A'])
  assert.equal(parseRisPortalMeeting(list(heading,'Bebauungsplan Nord'),m,welver,now),null,heading);
 // After the public part every further part ends the agenda, whatever it is called.
 const two=parseRisPortalMeeting(list('Öffentlicher Teil','Bebauungsplan Nord')+list('Teil B','Personalsache Müller'),m,welver,now);
 assert.deepEqual(two.items.map(i=>i.title),['Bebauungsplan Nord']);
 const named=parseRisPortalMeeting(list('Öffentlich','Grundstücksangelegenheit (nö)'),m,welver,now);
 assert.equal(named.items.length,0);assert.equal(named.left,1);
});

// A fake portal: month lists and meeting pages from the fixtures, every address asked recorded.
function portal(source,months,pages){
 const asked=[];
 const get=async url=>{asked.push(url);const u=new URL(url);
  if(u.searchParams.get('_RisSitzung_resource')==='loadSessions'){const key=u.searchParams.get('_RisSitzung_year')+'-'+u.searchParams.get('_RisSitzung_month');return months[key]??'[]';}
  const id=u.searchParams.get('sitzungId');if(id&&pages[id])return pages[id];throw Error('Quelle antwortet mit HTTP 404');};
 return {asked,get};
}
test('RIS-Portal meeting: the public heading in the wordings of the tenants',()=>{
 const m={id:'1',url:welver.base+'sitzungen?sitzungId=1',date:'2026-09-03',committee:'Rat'};
 const list=(heading,title)=>`<h3 class="h4 accordion-list-header">${heading}</h3><ul><li class="rp-lis-item" data-top-number="1."><div class="top-item"><div class="top-item-content"><p><span>1.</span><span>${title}</span></p></div></div></li></ul>`;
 // Bad Tennstedt, Landkreis Rastatt, Bad Soden-Salmünster, Bad Tabarz, Buggingen, Elchesheim-Illingen, Föritztal,
 // Gechingen, Harztor, Haßmersheim (05.10.2026).
 for(const heading of ['- öffentlich -','Tagesordnung öffentlich','Öffentliche Tagesordnungspunkte','Tagesordnung - öffentlicher Teil','Tagesordnung - Öffentlich','A.) Öffentlicher Teil','ÖFFENTLICHER TEIL:','Tagesordnung: öffentlich','I. Öffentlicher Teil','I. öffentlich']){
  const agenda=parseRisPortalMeeting(list(heading,'Bebauungsplan Nord')+list('Nichtöffentlicher Teil','Grundstücksangelegenheit'),m,welver,now);
  assert.deepEqual(agenda?.items.map(i=>i.title),['Bebauungsplan Nord'],heading);
 }
});

test('collectRisPortal reads the months of the period and the public part of each meeting, nothing else',async()=>{
 const web=portal(welver,{'2026-8':fixture('welver-sessions-2026-09.json')},{'216451':fixture('welver-sitzung-216451.html')});
 const d=await collectRisPortal(welver,{now,get:web.get,window:'1m'});
 // One request per month from the end of the month after next back to the start of the period, then the meetings.
 const months=web.asked.filter(u=>/loadSessions/.test(u)).map(u=>{const p=new URL(u).searchParams;return p.get('_RisSitzung_year')+'-'+p.get('_RisSitzung_month');});
 assert.deepEqual(months,['2026-11','2026-10','2026-9','2026-8']);
 assert.ok(web.asked.every(u=>u.startsWith(welver.base)),'only the portal');
 assert.ok(!web.asked.some(u=>/top-detail|singleDocument|topDocument|login/.test(u)),'no item page, no document, no login');
 // The meeting of 03.09. lies before the period of one month (from 05.09.); the four in the period answer 404 here.
 assert.ok(!web.asked.some(u=>u.endsWith('sitzungId=216451')));
 assert.equal(d.topics.length,0);assert.equal(d.coverage.complete,false);assert.ok(d.coverage.issues.some(i=>/HTTP 404/.test(i)));
 const year=await collectRisPortal(welver,{now,get:portal(welver,{'2026-8':fixture('welver-sessions-2026-09.json')},{'216451':fixture('welver-sitzung-216451.html')}).get,window:'3m'});
 const paper=year.topics.find(t=>t.id==='nrw-05974048-rp-vo-2828454');
 assert.ok(paper);assert.equal(paper.committee,'Rat');assert.equal(paper.eventDate,'2026-09-03');assert.equal(paper.public,true);
 assert.equal(paper.sourceData.method,'ris-portal');assert.ok(paper.documents.some(d=>d.url.endsWith('sitzungId=216451')));
 assert.ok(!JSON.stringify(year.topics).includes('Ankauf Wohnhaus'));
});

test('collectRisPortal separates a shared system by its bodies and joins the consultations of a paper',async()=>{
 const pages={'192529':fixture('vghexental-sitzung-192529.html')};
 const web=portal(hexental,{'2026-8':fixture('vghexental-sessions-2026-09.json')},pages);
 const d=await collectRisPortal({...hexental,organizations:{include:['Merzhausen']}},{now,get:web.get,window:'3m'});
 const read=web.asked.filter(u=>/sitzungId=/.test(u)).map(u=>new URL(u).searchParams.get('sitzungId'));
 // Gemeinderat Merzhausen and its Technical Committee; the councils of Wittnau, Horben, Au and Sölden are not asked.
 assert.deepEqual(read.sort(),['192529','217283']);
 assert.ok(d.coverage.warnings.some(w=>/^4 Sitzungen anderer Gremien/.test(w)));
 assert.ok(d.topics.every(t=>/Merzhausen/.test(t.committee)));
 assert.ok(d.topics.some(t=>t.status==='approved'));
 // Without a filter every body of the system is read.
 const all=portal(hexental,{'2026-8':fixture('vghexental-sessions-2026-09.json')},pages);
 await collectRisPortal(hexental,{now,get:all.get,window:'3m'});
 assert.equal(all.asked.filter(u=>/sitzungId=/.test(u)).length,6);
 // A body the filter cannot assign is not read.
 const none=await collectRisPortal({...hexental,organizations:{include:['Ebringen']}},{now,get:portal(hexental,{'2026-8':fixture('vghexental-sessions-2026-09.json')},pages).get,window:'3m'});
 assert.equal(none.topics.length,0);
 // The same paper document in a committee and in the council: one report with two consultations.
 const page=(heading,title,docid)=>`<h2 class="h1">${heading}</h2><h3 class="h4 accordion-list-header">Öffentlicher Teil</h3><ul><li class="rp-lis-item" data-top-number="1."><div class="top-item"><div class="top-item-content"><p><span>1.</span><span>${title}</span></p><button class="document-button" data-href="${welver.base}sitzungen?p_p_id=RisSitzung&amp;p_p_lifecycle=2&amp;_RisSitzung_resource=singleDocument&amp;_RisSitzung_schriftgutId=${docid}" data-docid="${docid}" data-type="Sitzungsvorlage"><span class="d-none doc-title">Sitzungsvorlage</span></button></div></div></li></ul>`;
 const json=JSON.stringify([{sitzungId:11,start:'2026-09-10T17:00',sessionLink:welver.base+'sitzungen?sitzungId=11',label:'GBP 10.09.2026',text:'<div class=\'rp-gremium-badge mbsc-hide-in-calendar\'>Ausschuss für Gemeindeentwicklung, Bau und Planung</div>'},{sitzungId:12,start:'2026-09-24T17:00',sessionLink:welver.base+'sitzungen?sitzungId=12',label:'Rat 24.09.2026',text:'<div class=\'rp-gremium-badge mbsc-hide-in-calendar\'>Rat</div>'}]);
 const joined=await collectRisPortal(welver,{now,get:portal(welver,{'2026-8':json},{'11':page('Sitzung Ausschuss am 10.09.2026','Radweg Borgeln','777'),'12':page('Sitzung Rat am 24.09.2026','Radweg Borgeln','777')}).get,window:'3m'});
 assert.equal(joined.topics.length,1);
 assert.deepEqual(joined.topics[0].events.map(e=>[e.date,e.committee]),[['2026-09-10','Ausschuss für Gemeindeentwicklung, Bau und Planung'],['2026-09-24','Rat']]);
 assert.equal(joined.topics[0].committee,'Rat');
});

test('collectRisPortal names a list it cannot read and stops at the time budget',async()=>{
 const broken=await collectRisPortal(welver,{now,get:async()=>'<html>Wartung</html>',window:'1m'});
 assert.equal(broken.topics.length,0);assert.equal(broken.coverage.complete,false);
 assert.ok(broken.coverage.issues.every(i=>/Sitzungsliste|Noch keine Artikel/.test(i)));
 assert.ok(broken.coverage.issues.some(i=>/Sitzungsliste \d{2}\/2026: Unexpected token|Sitzungsliste \d{2}\/2026: .*JSON/.test(i)));
});

// Redesigned theme (ris-redesign-theme, ris.dachau.de, 09.10.2026): items are div.rp-session-top-result under
// <h3 class="accordion-list-header">, the documents are links "document-link" with data-href.
const dachau={id:'de-09174115',name:'Stadt Dachau',kind:'city',method:'scraper',adapter:'ris-portal',base:'https://ris.dachau.de/'};
test('RIS-Portal redesigned theme: the body is named by the link text of the month list',()=>{
 const list=risPortalMeetings(fixture('dachau-sessions-2026-10.json'),dachau);
 assert.deepEqual(list.map(m=>[m.id,m.date,m.committee]),[['2762','2026-10-14','Stadtrat']]);
});
test('RIS-Portal redesigned theme: public items with number, title and documents; a part with another heading ends the agenda',()=>{
 const meeting={id:'2762',url:'https://ris.dachau.de/web/guest/sitzungen?sitzungId=2762',date:'2026-10-14',committee:'Stadtrat'};
 const page=fixture('dachau-sitzung-2762.html');
 const parsed=parseRisPortalMeeting(page,meeting,dachau,new Date('2026-10-09T12:00:00Z'));
 assert.equal(parsed.items.length,3);
 const first=parsed.items[0];
 assert.match(first.title,/^1\. Änderung der Mobilitätssatzung/);assert.equal(first.status,'consulting');assert.equal(first.number,'1.');
 assert.ok(first.documents.some(d=>/Sitzungsvorlage/.test(d.title)||d.url.includes('schriftgutId=30116')));
 assert.ok(first.id.startsWith('de-09174115-rp-vo-'));
 // Everything after a heading that is not the public part is cut off.
 const withNonPublic=page.replace('</div></div></div></body>','</div><h3 class="accordion-list-header">Nichtöffentliche Tagesordnungspunkte</h3><div class="list-group-item rp-result rp-session-top-result " data-top-number="9."><h3><a href="#">Personalangelegenheit geheim</a></h3></div></div></div></body>');
 const cut=parseRisPortalMeeting(withNonPublic,meeting,dachau,new Date('2026-10-09T12:00:00Z'));
 assert.equal(cut.items.length,3);assert.ok(!cut.items.some(i=>/geheim/.test(i.title)));
});

test('RIS-Portal: the part "Teil A - Öffentlicher Teil" (Langen) is the public agenda, "Teil B" is not read',()=>{
 const src={id:'de-06438006',name:'Stadt Langen (Hessen)',kind:'city',method:'scraper',adapter:'ris-portal',base:'https://langen.ris-portal.de/'};
 const item=(n,t)=>`<li class="rp-lis-item" data-top-number="${n}"><div class="top-item-content"><p><span>${n}</span><span>${t}</span></p></div></li>`;
 const html=`<h2 class="h1">Sitzung Stadtverordnetenversammlung am 24.09.2026</h2><h3 class="h4 accordion-list-header">Teil A - Öffentlicher Teil</h3><ul>${item('1','Haushalt 2027')}</ul><h3 class="h4 accordion-list-header">Teil B - Nichtöffentlicher Teil</h3><ul>${item('2','Personalangelegenheit')}</ul>`;
 const m=parseRisPortalMeeting(html,{date:'2026-09-24',committee:'Stadtverordnetenversammlung',url:'https://langen.ris-portal.de/web/guest/sitzungen?sitzungId=1'},src,new Date('2026-10-09T00:00:00Z'));
 assert.deepEqual(m.items.map(i=>i.title),['Haushalt 2027']);
});
