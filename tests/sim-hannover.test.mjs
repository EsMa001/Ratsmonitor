import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectSimHannover,simUrl,simListLinks,simMeetingRows,parseSimMeeting,parseSimPaper,simStatus,simItems,collectSimHannover} from '../server/integrations/sim-hannover.mjs';
// Pages of e-government.hannover-stadt.de/lhhsimwebre.nsf as published on 09.10.2026.
const fixture=name=>fs.readFileSync(new URL('./fixtures/sim-hannover/'+name,import.meta.url),'utf8');
const base='https://e-government.hannover-stadt.de/lhhsimwebre.nsf/',source={id:'nds-03241001',name:'Stadt Hannover',kind:'city',method:'scraper',adapter:'sim-hannover',base};
const now=new Date('2026-10-09T12:00:00Z');

test('SIM Hannover is recognised by its application address; the base is the application',()=>{
 assert.deepEqual(detectSimHannover(base+'TermineAktuell.xsp','<title>SIM - aktuelle Termine</title>'),{adapter:'sim-hannover',base});
 assert.deepEqual(detectSimHannover(base+'TM/20260924_Rat',fixture('sitzung-rat.html')),{adapter:'sim-hannover',base});
 assert.equal(detectSimHannover('https://hannover.gov.de/','<title>Startseite | Stadt Hannover</title>'),null);
});

test('SIM addresses stay below the application; other paths are refused',async()=>{
 assert.equal(simUrl('TM/20260924_Rat',source),base+'TM/20260924_Rat');
 assert.throws(()=>simUrl('../other.nsf/x',source),/Nicht freigegebene/);
 const asked=[];
 await assert.rejects(collectSimHannover({...source,base:'https://e-government.hannover-stadt.de/lhhsimwebre.nsf/'},{now,get:async url=>{asked.push(url);throw Error('Quelle antwortet mit HTTP 404');},window:'3m'}).then(r=>{if(r.coverage.complete)throw Error('complete');throw Error(r.coverage.issues.join('|'));}),/Sitzungsliste/);
 assert.ok(asked.every(u=>u.startsWith(base)));
});

test('SIM lists: links of the committee and district pages, meetings by key, newest first',()=>{
 assert.deepEqual(simListLinks(fixture('ausschuesse.html')),['Termine.xsp?view=Termine&grem=AAGBOB','Termine.xsp?view=Termine&grem=AAWL','Termine.xsp?view=Termine&grem=AHaush']);
 assert.deepEqual(simListLinks(fixture('stadtbezirke.html')).length,2);
 const rows=simMeetingRows(fixture('liste-rat.html'));
 assert.deepEqual(rows.map(r=>[r.key,r.date,r.body]),[['20261008_Rat','2026-10-08','Rat'],['20260924_Rat','2026-09-24','Rat'],['20260129_Rat','2026-01-29','Rat'],['20031113_Rat','2003-11-13','Rat']]);
 assert.deepEqual(simMeetingRows(fixture('kalender.html')).slice(0,2).map(r=>r.key),['20261028_AHaush','20261028_AOrgPers']);
 assert.deepEqual(simMeetingRows('<html>Fehler</html>'),[]);
});

test('SIM meeting page: body, day, place and the items with a paper; routine items are left out',()=>{
 const m=parseSimMeeting(fixture('sitzung-rat.html'));
 assert.equal(m.committee,'Ratsversammlung');assert.equal(m.date,'2026-09-24');assert.equal(m.place,'Rathaus, Ratssaal');assert.equal(m.time,'15:00 Uhr');
 const byNumber=Object.fromEntries(m.items.map(i=>[i.number,i]));
 // Opening and appointments (no paper) are no items; a question carries its reference in the title.
 assert.equal(byNumber['1'],undefined);assert.equal(byNumber['4'],undefined);
 assert.deepEqual(byNumber['3.1.1'],{number:'3.1.1',title:'Anfrage der CDU-Fraktion zur Zukunft der Deutschen Messe AG',paper:'1623-2026',reference:'1623/2026'});
 assert.deepEqual(byNumber['6.1'],{number:'6.1',title:'Erhaltungssatzung - Friedrich-Ebert-Straße / Göttinger Chaussee Satzungsbeschluss',paper:'1389-2026N1',reference:'1389/2026 N1'});
 assert.equal(byNumber['5'].reference,'1253/2026');
 const coming=parseSimMeeting(fixture('sitzung-rat-kommend.html'));assert.equal(coming.date,'2026-10-08');assert.deepEqual(coming.items,[]);
});

test('SIM paper: title, deliberations with result, text and attachments; a confidential paper is none',()=>{
 const p=parseSimPaper(fixture('drucksache-1389-2026-n1.html'));
 assert.equal(p.number,'1389/2026 N1');assert.match(p.title,/^Erhaltungssatzung - Friedrich-Ebert-Straße/);
 assert.deepEqual(p.deliberations,[{key:'20260924_Rat',date:'2026-09-24',body:'Ratsversammlung',result:'Einstimmig'}]);
 assert.equal(p.attachments.length,4);assert.match(p.text,/^Beschlussdrucksache In die Ratsversammlung/);assert.ok(p.text.length<=2600);
 assert.deepEqual(parseSimPaper('<html><body>Die Dokumente sind vertraulich und daher nicht zur Veröffentlichung im Internet freigegeben.</body></html>'),{restricted:true});
});

test('SIM results: only the deciding bodies approve or reject',()=>{
 assert.equal(simStatus('Einstimmig','Ratsversammlung'),'approved');
 assert.equal(simStatus('Einstimmig','Stadtentwicklungs- und Bauausschuss'),'recommended');
 assert.equal(simStatus('Abgelehnt','Ratsversammlung'),'rejected');
 assert.equal(simStatus('Zur Kenntnis genommen','Verwaltungsausschuss'),'info');
 assert.equal(simStatus('Vertagt','Ratsversammlung'),'postponed');
 assert.equal(simStatus('','Ratsversammlung'),null);
});

const pages=name=>({
 'Termine.xsp':fixture('liste-rat.html'),'Ausschuesse.xsp':fixture('ausschuesse.html').split('\n').slice(0,2).join('\n')+'\n</ul>','AuswahlStadtbezirke.xsp':'<ul></ul>',
 'Termine.xsp?view=Termine&grem=AAGBOB':'<a href="TM/20031113_AAGBOB">13.11.2003</a>','TM/20260924_Rat':fixture('sitzung-rat.html'),'TM/20261008_Rat':fixture('sitzung-rat-kommend.html')
})[name];

test('SIM reports: a past item takes status and event from the paper, a coming one is "consulting"',()=>{
 const parsed=parseSimMeeting(fixture('sitzung-rat.html')),paper=parseSimPaper(fixture('drucksache-1389-2026-n1.html'));
 const rows=simItems(parsed,{key:'20260924_Rat',date:'2026-09-24',url:base+'TM/20260924_Rat'},source,new Map([['1389-2026N1',paper]]),now);
 const r=rows.find(x=>x.record.paper==='1389-2026N1');
 assert.equal(r.id,'nds-03241001-ds-1389-2026');assert.equal(r.status,'approved');assert.equal(r.event.result,'Einstimmig');assert.equal(r.sourceUrl,base+'DS/1389-2026N1');
 // A paper that was not read (confidential, error) still yields the item from the agenda, without a result.
 const other=rows.find(x=>x.record.paper==='1623-2026');assert.equal(other.status,'unknown');assert.equal(other.event.result,'');
 const later=simItems(parsed,{key:'20261008_Rat',date:'2026-10-08',url:base+'TM/20261008_Rat'},source,new Map(),new Date('2026-09-20T00:00:00Z'));
 assert.ok(later.every(x=>x.status==='consulting'));
});

test('SIM import reads the lists, the meeting pages and the papers of past meetings, and keeps marks',async()=>{
 const asked=[];
 const get=async url=>{
  asked.push(url);const path=url.slice(base.length);
  if(path.startsWith('DS/'))return fixture('drucksache-1389-2026-n1.html');
  const page=pages(path);if(page!==undefined)return page;
  throw Error('Quelle antwortet mit HTTP 404');
 };
 const result=await collectSimHannover(source,{now,get,window:'3m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 assert.equal(result.coverage.meetings,2);assert.equal(result.readMeetings,2);
 assert.ok(asked.every(u=>u.startsWith(base)&&!/TOPS\/|TO\//.test(u)));
 // Every paper once, though the meeting names it as 1389/2026 and 1389/2026 N1.
 const papers=asked.filter(u=>u.includes('/DS/'));assert.equal(new Set(papers).size,papers.length);
 const matter=result.topics.find(t=>t.id==='nds-03241001-ds-1389-2026');
 assert.equal(matter.regionId,source.id);assert.equal(matter.committee,'Ratsversammlung');assert.equal(matter.eventDate,'2026-09-24');assert.equal(matter.status,'approved');
 assert.equal(matter.events.length,2);assert.ok(matter.identityLinks.includes(base+'DS/1389-2026')&&matter.identityLinks.includes(base+'DS/1389-2026N1'));
 assert.ok(Object.keys(result.marks).includes(base+'TM/20260924_Rat'));
});
