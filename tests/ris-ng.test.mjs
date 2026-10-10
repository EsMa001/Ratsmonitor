import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectRisNg,risNgMeetings,parseRisNgMeeting,collectRisNg} from '../server/integrations/ris-ng.mjs';
// Pages of ratsinformationssystem.beilstein.de ("ris") as published on 10.10.2026.
const fixture=name=>fs.readFileSync(new URL('./fixtures/ris-ng/'+name,import.meta.url),'utf8');
const base='https://ratsinformationssystem.beilstein.de/ris',source={id:'de-08125008',name:'Beilstein',kind:'municipality',method:'scraper',adapter:'ris-ng',base};
const now=new Date('2026-10-10T12:00:00Z');
const MEETING=base+'?action=show_sitzung&sitzung_id=';

test('ris is recognised by its title and meeting list',()=>{
 assert.deepEqual(detectRisNg('https://ratsinformationssystem.beilstein.de/ris',fixture('sitzungsliste.html')),{adapter:'ris-ng',base});
 assert.equal(detectRisNg('https://example.org/ris','<title>Sitzungsdienst</title>'),null);
});

test('ris list: meetings of all years with id, day, time and body, newest first',()=>{
 const rows=risNgMeetings(fixture('sitzungsliste.html'));
 assert.ok(rows.length>100);
 assert.deepEqual(rows[0],{id:'386',date:'2026-10-13',time:'17:30',body:'Ausschuss für Umwelt und Technik'});
 assert.ok(rows.some(r=>r.id==='325'&&r.date==='2026-01-27'&&r.body==='Gemeinderat'));
 assert.ok(rows.every((r,i)=>i===0||rows[i-1].date>=r.date));
 assert.deepEqual(risNgMeetings('<html>Fehler</html>'),[]);
});

test('ris meeting: body, day and the items with papers and published minutes',()=>{
 const p=parseRisNgMeeting(fixture('sitzung.html'),base);
 assert.equal(p.body,'Gemeinderat');assert.equal(p.date,'2026-01-27');assert.equal(p.time,'19:00');
 assert.equal(p.items.length,9);
 const sale=p.items.find(i=>i.number==='3');
 assert.match(sale.title,/Verkauf der Grundstücke Katharinenring/);
 assert.deepEqual(sale.documents.map(d=>d.title),['Beschlussvorlage','Anlage 1']);
 assert.ok(sale.documents.every(d=>d.url.startsWith('https://ratsinformationssystem.beilstein.de/ris/V_')&&!/ /.test(d.url)));
 assert.match(sale.protocol,/einstimmigen Beschluss/);
 assert.equal(p.items.find(i=>i.number==='5').title,'Bebauungsplan „Hartäcker“ 2. Änderung');
 assert.equal(p.items[0].protocol,'');
});

test('ris import: reports of the public items, status from the minutes, only the allowed pages are requested',async()=>{
 const asked=[];
 const request=async url=>{
  asked.push(url);
  if(url===base)return new Response(fixture('sitzungsliste.html'));
  if(url.startsWith(MEETING))return new Response(fixture('sitzung.html'));
  return new Response('nicht gefunden',{status:404});
 };
 const result=await collectRisNg(source,{now,request,window:'3m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 assert.ok(result.coverage.meetings>=2&&result.readMeetings===result.coverage.meetings);
 assert.ok(asked.every(u=>u===base||/^https:\/\/ratsinformationssystem\.beilstein\.de\/ris\?action=show_sitzung&sitzung_id=\d+$/.test(u)));
 const t=result.topics.find(x=>x.id.endsWith('-t3'));
 assert.ok(t.id.startsWith('de-08125008-rg-s'));assert.equal(t.regionId,source.id);
 assert.match(t.title,/Verkauf der Grundstücke/);
 // The fixture page is a meeting of 27.01.2026: past, with minutes that state an unanimous resolution.
 assert.ok(['approved','recommended'].includes(t.status));
 assert.ok(t.documents.some(d=>d.kind==='pdf'));
 // The formal items (Einwohnerfragestunde, Bekanntgaben) without paper or minutes are no reports.
 assert.ok(!result.topics.some(x=>/^Einwohnerfragestunde/.test(x.title)));
 assert.ok(Object.keys(result.marks).every(k=>k.startsWith(MEETING)));
});

test('ris import: a failing list is an issue; other pages of the host are refused',async()=>{
 const bad=await collectRisNg(source,{now,get:async()=>{throw Error('Quelle antwortet mit HTTP 403');},window:'3m'});
 assert.equal(bad.coverage.complete,false);assert.match(bad.coverage.issues.join(' '),/Sitzungsübersicht/);
 const other=await collectRisNg({...source,base:'https://ratsinformationssystem.beilstein.de/ris/intern'},{now,get:async u=>u,window:'3m'});
 assert.equal(other.coverage.complete,false);
});

test('ris import: organizations keep one body of a shared system',async()=>{
 const get=async url=>url===base?fixture('sitzungsliste.html'):fixture('sitzung.html');
 const all=await collectRisNg(source,{now,get,window:'12m'});
 const some=await collectRisNg({...source,organizations:{include:['Gibt es nicht']}},{now,get,window:'12m'});
 assert.ok(all.coverage.meetings>some.coverage.meetings);assert.equal(some.coverage.meetings,0);
});
