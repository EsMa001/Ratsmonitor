import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectProvoxIip,iipUrl,iipMeetings,parseIipMeeting,parseIipPaper,iipItems,collectProvoxIip} from '../server/integrations/provox-iip.mjs';
// Pages of ris.hameln.de (Provox IIP) as published on 10.10.2026.
const fixture=name=>fs.readFileSync(new URL('./fixtures/provox-iip/'+name,import.meta.url),'utf8');
const base='https://ris.hameln.de/ris/hameln/',source={id:'nds-03252006',name:'Stadt Hameln',kind:'city',method:'scraper',adapter:'provox-iip',base};
const now=new Date('2026-10-10T12:00:00Z');

test('Provox IIP is recognised by its title or footer link and keeps the client path',()=>{
 assert.deepEqual(detectProvoxIip('https://ris.hameln.de/ris/hameln/meeting/list','<title>Monatskalender - Provox IIP</title>'),{adapter:'provox-iip',base});
 assert.deepEqual(detectProvoxIip('https://ris.hameln.de/ris','<a href="https://www.provox.de">Provox</a>'),null);
 assert.equal(detectProvoxIip('https://ratsinfo.example.de/ris/x/','<title>Sitzungsdienst</title>'),null);
 assert.equal(iipUrl('meeting/details/3043',source),base+'meeting/details/3043');
});

test('Provox IIP calendar: meetings with page address, bell removed, newest first; garbage gives nothing',()=>{
 const rows=iipMeetings(fixture('termine.json'),source);
 assert.deepEqual(rows.map(r=>[r.id,r.date,r.body,!!r.url]),[['3007','2026-11-11','Ausschuss für Kultur',false],['3044','2026-11-04','Rat',false],['3043','2026-10-08','Rat',true],['3098','2026-09-23','Ausschuss für Stadtentwicklung',true],['3002','2026-06-10','Ausschuss für Recht und Sicherheit',true],['2941','2025-11-26','Ausschuss für Finanzen, Personal und Wirtschaft',true],['2914','2025-10-09','Ausschuss für Kultur',true]]);
 assert.equal(rows.find(r=>r.id==='3043').url,base+'meeting/details/3043');
 assert.equal(rows.find(r=>r.id==='3043').time,'18:05');
 // The live server answers a request with "Accept: application/json" with the list as a JSON string inside JSON.
 assert.equal(iipMeetings(JSON.stringify(fixture('termine.json')),source).length,7);
 assert.deepEqual(iipMeetings('<html>Fehler</html>',source),[]);
});

test('Provox IIP meeting: body, day, place and the public items with a paper and their vote',()=>{
 const rat=parseIipMeeting(fixture('sitzung-rat.html'));
 assert.equal(rat.committee,'Rat');assert.equal(rat.date,'2026-10-08');assert.equal(rat.time,'18:05');assert.equal(rat.place,'Weserberglandzentrum');
 const item=rat.items.find(i=>i.reference==='114/2026');
 assert.equal(item.paper,'7918');assert.equal(item.number,'2');assert.equal(item.title,'Umbesetzung von Ausschüssen und sonstigen Gremien');
 assert.deepEqual(item.voting,{yes:38,no:0,abstain:0,outcome:'for'});
 // Items without a paper (minutes, announcements) are listed but carry no paper id.
 assert.ok(rat.items.some(i=>!i.paper));
 const committee=parseIipMeeting(fixture('sitzung-ausschuss.html'));
 assert.equal(committee.committee,'Ausschuss für Recht und Sicherheit');
 assert.deepEqual(committee.items.find(i=>i.reference==='165/2025').voting,{yes:4,no:8,abstain:1,outcome:'against'});
 assert.equal(committee.items.find(i=>i.reference==='23/2026').voting,null);
 const coming=parseIipMeeting(fixture('sitzung-kommend.html'));
 assert.equal(coming.date,'2026-09-23');assert.equal(coming.time,'16:30');assert.equal(coming.items.filter(i=>i.voting).length,0);
 // Only a block marked "Öffentlich" is read.
 const hidden=fixture('sitzung-kommend.html').replace(/<strong class=Gruen> &#xD6;ffentlich<\/strong>/g,'<strong class=Rot> Nichtöffentlich</strong>');
 assert.equal(parseIipMeeting(hidden).items.length,0);
 assert.equal(parseIipMeeting('<html>Fehler</html>').items.length,0);
});

test('Provox IIP paper: title, department, resolution text, file and deliberations',()=>{
 const p=parseIipPaper(fixture('vorlage-90.html'));
 assert.match(p.title,/^Umbenennung des Miegelwegs/);assert.equal(p.department,'FB 4 Planen und Bauen');
 assert.match(p.resolution,/^Der Rat der Stadt Hameln beauftragt/);assert.equal(p.file,'/ris/hameln/file/getfile/96734');
 assert.equal(p.deliberations.length,5);
 assert.deepEqual(p.deliberations[0],{meeting:'3018',body:'Ausschuss für Umwelt, Nachhaltigkeit und Klimaschutz',date:'2026-06-25',top:'4',number:'4/2026',yes:7,no:1,abstain:4,outcome:'for'});
 assert.equal(p.deliberations[1].outcome,null);
});

test('Provox IIP reports: a past item with a vote takes its status, a coming one is "consulting"',()=>{
 const meeting=iipMeetings(fixture('termine.json'),source).find(r=>r.id==='3043');
 const rat=parseIipMeeting(fixture('sitzung-rat.html'));
 const rows=iipItems(rat,meeting,source,new Map(),now);
 assert.ok(rows.length>0&&rows.every(r=>r.id.startsWith('nds-03252006-iip-')&&r.reference));
 const r=rows.find(x=>x.reference==='114/2026');
 assert.equal(r.id,'nds-03252006-iip-114-2026');assert.equal(r.status,'approved');assert.match(r.event.result,/Zugestimmt \(Dafür: 38, Dagegen: 0, Enthalten: 0\)/);
 assert.equal(r.sourceUrl,base+'agendaitem/details/7918');
 // A committee only recommends; a rejection there is no rejection of the matter.
 const ausschuss=parseIipMeeting(fixture('sitzung-ausschuss.html'));
 const b=iipItems(ausschuss,{id:'3002',date:'2026-06-10',body:ausschuss.committee,url:base+'meeting/details/3002'},source,new Map(),now).find(x=>x.reference==='165/2025');
 assert.equal(b.status,'recommended');assert.match(b.event.result,/Abgelehnt/);
 // No vote in the page: unknown; the paper's own deliberation can fill it.
 const coming=parseIipMeeting(fixture('sitzung-kommend.html')),m2={id:'3098',date:'2026-09-23',body:coming.committee,url:base+'meeting/details/3098'};
 assert.equal(iipItems(coming,m2,source,new Map(),now).find(x=>x.reference==='90/2026').status,'unknown');
 const paper=parseIipPaper(fixture('vorlage-90.html')),withPaper=iipItems(coming,m2,source,new Map([['7892',paper]]),now).find(x=>x.reference==='90/2026');
 assert.equal(withPaper.title,paper.title);assert.ok(withPaper.documents.some(d=>d.kind==='pdf'&&d.url===base.replace('/hameln/','/hameln/')+'file/getfile/96734'));
 assert.ok(iipItems(coming,m2,source,new Map(),new Date('2026-09-20T00:00:00Z')).every(x=>x.status==='consulting'));
});

const getFor=asked=>async url=>{
 asked.push(url);
 if(url.startsWith(base+'meeting/ShowEvents'))return fixture('termine.json');
 if(url===base+'meeting/details/3043')return fixture('sitzung-rat.html');
 if(url===base+'meeting/details/3098')return fixture('sitzung-kommend.html');
 if(url===base+'meeting/details/3002')return fixture('sitzung-ausschuss.html');
 if(url===base+'agendaitem/details/7918')return fixture('vorlage-114.html');
 if(url===base+'agendaitem/details/7892')return fixture('vorlage-90.html');
 throw Error('Quelle antwortet mit HTTP 404');
};

test('Provox IIP import reads the calendar, the meetings of the period and the papers once, and keeps marks',async()=>{
 const asked=[];
 const result=await collectProvoxIip(source,{now,get:getFor(asked),window:'3m'});
 // 3m reaches back to July: the meetings of 23.09. and 08.10.; two coming ones have no agenda yet.
 assert.equal(result.coverage.meetings,2);assert.equal(result.readMeetings,2);assert.equal(result.coverage.upcomingWithoutAgenda,2);
 assert.ok(asked.every(u=>u.startsWith(base)&&/(meeting\/ShowEvents|meeting\/details\/\d+|agendaitem\/details\/\d+)/.test(u)));
 const papers=asked.filter(u=>u.includes('agendaitem'));assert.equal(new Set(papers).size,papers.length);
 const t=result.topics.find(x=>x.id==='nds-03252006-iip-114-2026');
 assert.equal(t.regionId,source.id);assert.equal(t.committee,'Rat');assert.equal(t.status,'approved');assert.equal(t.eventDate,'2026-10-08');
 assert.ok(Object.keys(result.marks).includes(base+'meeting/details/3043'));
 const miegel=result.topics.find(x=>x.id==='nds-03252006-iip-90-2026');
 assert.match(miegel.sourceText,/beauftragt die Verwaltung/);assert.ok(miegel.documents.some(d=>d.kind==='pdf'));
 // The feed is asked with the start of the period and an end after today.
 assert.match(asked[0],/ShowEvents\?start=2026-07-10&end=2027-01-08$/);
 // A 12 month period also reaches the older meetings (a failing one is a warning, not an issue).
 const long=await collectProvoxIip(source,{now,get:getFor([]),window:'12m'});
 assert.ok(long.coverage.meetings>=4);
});

test('Provox IIP import: a failing calendar is an issue; organizations keep one body of a shared system',async()=>{
 const bad=await collectProvoxIip(source,{now,get:async()=>{throw Error('Quelle antwortet mit HTTP 403');},window:'3m'});
 assert.equal(bad.coverage.complete,false);assert.match(bad.coverage.issues.join(' '),/Sitzungskalender/);
 const only=await collectProvoxIip({...source,organizations:{include:['Stadtentwicklung']}},{now,get:getFor([]),window:'3m'});
 assert.equal(only.coverage.meetings,1);assert.match((only.coverage.warnings||[]).join(' '),/anderer Gremien/);
 await assert.rejects(()=>collectProvoxIip({...source,base:'https://ris.hameln.de/x/'},{now,get:async u=>u,window:'3m'}).then(r=>{throw Error(r.coverage.issues.join('|'));}),/Sitzungskalender/);
});
