import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectEcics,ecicsUrl,ecicsMeetings,parseEcicsMeeting,ecicsResolution,ecicsItems,collectEcics} from '../server/integrations/ecics-ris.mjs';
// Pages of the Ratsinformationssysteme of ecics municipalities (Ilsfeld, Güglingen, Pfaffenhofen, Lauffen, Cleebronn,
// Zaberfeld, Beilstein, Eberdingen) as published on 10.10.2026; the minutes are shortened.
const fixture=name=>fs.readFileSync(new URL('./fixtures/ecics-ris/'+name,import.meta.url),'utf8');
const base='https://www.gueglingen.de/',source={id:'de-08125038',name:'Stadt Güglingen',kind:'city',method:'scraper',adapter:'ecics-ris',base};
const now=new Date('2026-10-10T12:00:00Z');

test('ecics RIS is recognised by its list; other pages are not',()=>{
 const page='<link href="/cssmanager/styles_1.css"><div class="ris-year-box"><a href="/ris?action=show_sitzung&amp;sitzung_id=1">x</a></div>';
 assert.deepEqual(detectEcics('https://www.ilsfeld.de/ris',page),{adapter:'ecics-ris',base:'https://www.ilsfeld.de/'});
 assert.equal(detectEcics('https://www.ilsfeld.de/ris','<html>Gemeinde</html>'),null);
 assert.equal(ecicsUrl(source),base+'ris?action=show_sitzungsliste');
 assert.equal(ecicsUrl(source,'547'),base+'ris?action=show_sitzung&sitzung_id=547');
 assert.throws(()=>ecicsUrl({...source,base:'http://www.gueglingen.de/'},'1'));
});

test('ecics meeting lists of all templates: day (year from the heading), time, body, newest first',()=>{
 const g=ecicsMeetings(fixture('liste-gueglingen.html'));
 assert.deepEqual(g[0],{id:'547',date:'2026-09-22',time:'19:00',body:'Gemeinderat'});
 assert.ok(g.some(m=>m.date==='2025-01-14'),'second year');
 assert.deepEqual(ecicsMeetings(fixture('liste-ilsfeld.html'))[0],{id:'456',date:'2026-10-20',time:'19:00',body:'Gemeinderat'});
 // Entries without a link (the list of Eberdingen opens a meeting by script): the number is in data-sitzung-id.
 assert.deepEqual(ecicsMeetings(fixture('liste-eberdingen.html')).at(-1),{id:'225',date:'2026-01-29',time:'18:30',body:'Gemeinderat'});
 // Marks for agenda and minutes (Lauffen) are not part of the body.
 const l=ecicsMeetings(fixture('liste-lauffen.html'));assert.deepEqual(l.map(m=>m.body).filter(b=>/^[TP] /.test(b)),[]);assert.equal(l[0].body,'Gemeinderat');
 assert.equal(ecicsMeetings(fixture('liste-cleebronn.html'))[0].body,'GR-Sitzung');
 assert.deepEqual(ecicsMeetings('<html>Fehler</html>'),[]);
});

test('ecics meeting page, Güglingen template: items with papers, routine items are marked',()=>{
 const p=parseEcicsMeeting(fixture('sitzung-gueglingen.html'),base+'ris?action=show_sitzung&sitzung_id=547');
 assert.equal(p.date,'2026-09-22');assert.equal(p.time,'19:00');
 const byNumber=Object.fromEntries(p.items.map(i=>[i.number,i]));
 assert.equal(byNumber[1].routine,true);assert.equal(byNumber[12].routine,true);
 const two=byNumber[2];
 assert.equal(two.title,'Kriminalitäts- und Verkehrsstatistik 2025');assert.equal(two.paper,'113/2026');assert.equal(two.routine,false);
 assert.equal(two.documents.length,4);assert.match(two.documents[0].url,/^https:\/\/www\.gueglingen\.de\/ris\/V_20260911_093820-ONLINE_113_2026%20%C3%96\.pdf$/);
 assert.equal(byNumber[3].title,'Vorhabenbezogener Bebauungsplan "Ochsenwiesen-Steinäcker, 4. Änderung" – a) Vorstellung des Konzepts und Aufstellungsbeschluss – b) Beschluss über die Veröffentlichung im Internet und Auslegung');
 assert.equal(parseEcicsMeeting('<html>Fehler</html>').items.length,0);
});

test('ecics meeting page, Ilsfeld template: title lines, paper from the document, no private items',()=>{
 const p=parseEcicsMeeting(fixture('sitzung-ilsfeld.html'),'https://www.ilsfeld.de/ris?action=show_sitzung&sitzung_id=454');
 assert.equal(p.date,'2026-09-22');
 const four=p.items.find(i=>i.number==='4');
 assert.match(four.title,/^Bebauungsplan „Steinhäldenweg, 2\. Erweiterung - 1\. Änderung“ – Hier: Abwägung/);
 assert.equal(four.documents.length,7);assert.match(four.paper,/GR 09\/4/);
 assert.ok(p.items.find(i=>i.number==='1').routine);
 assert.ok(p.items.every(i=>i.documents.every(d=>/^https:\/\/www\.ilsfeld\.de\/ris\/V_.*\.pdf$/.test(d.url))));
});

test('ecics meeting pages with minutes: Beilstein, Lauffen, Zaberfeld, Cleebronn, Pfaffenhofen',()=>{
 const b=parseEcicsMeeting(fixture('sitzung-beilstein.html'),'https://ratsinformationssystem.beilstein.de/ris');
 assert.equal(b.date,'2026-02-17');assert.equal(b.items.length,3);
 const two=b.items[1];assert.match(two.title,/^Bestellung von Frau Rebecca Bernet/);assert.equal(two.documents.length,1);assert.match(two.minutes,/einstimmig den Beschluss/);
 assert.equal(ecicsResolution(two.minutes),'Ohne Sachaussprache fasst der Gemeinderat einstimmig den Beschluss, der Wahl von Frau Rebecca Bernet zur stellvertretenden Feuerwehrkommandantin der Freiwilligen Feuerwehr Beilstein zuzustimmen.');
 assert.equal(ecicsResolution('Keine Wortmeldungen.'),'');
 // The attendance block of Lauffen is no item; items with a paper carry its number.
 const l=parseEcicsMeeting(fixture('sitzung-lauffen.html'),'https://www.lauffen.de/ris');
 assert.equal(l.date,'2026-02-11');assert.equal(l.items[0].number,'1');assert.ok(l.items[0].routine);
 assert.equal(l.items.find(i=>i.number==='4').paper,'2026 Nr. 17');
 const z=parseEcicsMeeting(fixture('sitzung-zaberfeld.html'),'https://www.zaberfeld.de/ris');
 const three=z.items.find(i=>i.number==='3');assert.equal(three.documents.length,0);assert.ok(three.minutes.length>100&&!three.routine,'minutes without a paper are an item');
 assert.equal(z.items.find(i=>i.number==='4').paper,'09/2026 GR Ö');
 const c=parseEcicsMeeting(fixture('sitzung-cleebronn.html'),'https://www.cleebronn.de/ris');
 assert.deepEqual(c.items.map(i=>i.number),['13','14','15','16','17','18']);
 assert.equal(c.items[1].title,'Haushaltsplan und Haushaltssatzung 2026 - Beschlussfassung');
 const f=parseEcicsMeeting(fixture('sitzung-pfaffenhofen.html'),'https://www.pfaffenhofen-wuertt.de/ris');
 assert.equal(f.items.length,2);assert.equal(f.items[0].documents.length,2);assert.equal(f.items[0].title,'Haushaltsplan und Haushaltssatzung 2026 Verabschiedung');
});

test('ecics reports: a past item takes its status from the minutes, a coming one is "consulting"',()=>{
 const m={id:'326',date:'2026-02-17',body:'Gemeinderat'},src={...source,id:'de-08125008',name:'Stadt Beilstein',base:'https://ratsinformationssystem.beilstein.de/'};
 const parsed=parseEcicsMeeting(fixture('sitzung-beilstein.html'),src.base+'ris');
 const rows=ecicsItems(parsed,m,src,now);
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.id.startsWith('de-08125008-ec-326-')));
 const r=rows.find(x=>x.id.endsWith('-2'));
 assert.equal(r.status,'approved');assert.match(r.event.result,/einstimmig den Beschluss/);assert.equal(r.sourceUrl,src.base+'ris?action=show_sitzung&sitzung_id=326');assert.equal(r.documents.length,1);
 assert.ok(ecicsItems(parsed,m,src,new Date('2026-02-01T00:00:00Z')).every(x=>x.status==='consulting'));
 const bare=ecicsItems(parseEcicsMeeting(fixture('sitzung-gueglingen.html'),base),{id:'547',date:'2026-09-22',body:'Gemeinderat'},source,now);
 assert.ok(bare.every(x=>x.status==='unknown')&&bare.length===9);
});

test('ecics import reads the list and the meetings of the period, only public addresses, and keeps marks',async()=>{
 const asked=[];
 const get=async url=>{
  asked.push(url);
  if(url===base+'ris?action=show_sitzungsliste')return fixture('liste-gueglingen.html');
  if(url.startsWith(base+'ris?action=show_sitzung&sitzung_id='))return fixture('sitzung-gueglingen.html');
  throw Error('Quelle antwortet mit HTTP 404');
 };
 const result=await collectEcics(source,{now,get,window:'3m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 // The meetings of 22.09. and 21.07. lie inside the period; the others are earlier.
 assert.equal(result.coverage.meetings,2);assert.equal(result.readMeetings,2);
 assert.ok(asked.every(u=>u.startsWith(base+'ris?action=show_sitzung')));
 const t=result.topics.find(x=>x.id==='de-08125038-ec-547-2');
 assert.equal(t.regionId,source.id);assert.equal(t.committee,'Gemeinderat');assert.equal(t.reference,'113/2026');assert.ok(t.documents.some(d=>d.kind==='pdf')&&t.documents.some(d=>d.kind==='html'));
 assert.ok(Object.keys(result.marks).includes(base+'ris?action=show_sitzung&sitzung_id=547'));
 // A guard stops addresses outside the list and the meeting pages.
 await assert.rejects(()=>collectEcics(source,{now,get:async u=>u,request:async()=>{throw Error('no');},window:'3m'}).then(r=>{throw Error(r.coverage.issues.join('|'));}),/Sitzungsliste|keine Sitzungen/);
});

test('ecics import: a failing list is an issue; a coming meeting without page is not',async()=>{
 const bad=await collectEcics(source,{now,get:async()=>{throw Error('Quelle antwortet mit HTTP 403');},window:'3m'});
 assert.equal(bad.coverage.complete,false);assert.match(bad.coverage.issues.join(' '),/Sitzungsliste/);
 const list='<h2>2026</h2><ul><li><a href="/ris?action=show_sitzung&amp;sitzung_id=900"><p class="date">20.10. - 19:00 Uhr: </p><p class="title">Gemeinderat</p></a></li><li><a href="/ris?action=show_sitzung&amp;sitzung_id=547"><p class="date">22.09. - 19:00 Uhr: </p><p class="title">Gemeinderat</p></a></li></ul>';
 const ok=await collectEcics(source,{now,get:async url=>{if(url.includes('=900'))throw Error('Quelle antwortet mit HTTP 403');return url.includes('sitzungsliste')?list:fixture('sitzung-gueglingen.html');},window:'3m'});
 assert.equal(ok.coverage.complete,true,JSON.stringify(ok.coverage.issues));assert.equal(ok.coverage.meetings,2);assert.equal(ok.readMeetings,1);assert.match(ok.coverage.warnings.join(' '),/Sitzung ohne Seite/);
});
