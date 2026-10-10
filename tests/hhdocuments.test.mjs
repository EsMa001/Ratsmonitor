import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectHhDocuments,parseHhList,parseHhDocument,hhPaper,collectHhDocuments} from '../server/integrations/hhdocuments.mjs';
// Pages of www.schwentinental.de (hhdocuments: Dokumentenwesen and Sitzungsplanung) as published on 10.10.2026, cut to the content.
const fixture=name=>fs.readFileSync(new URL('./fixtures/hhdocuments/'+name,import.meta.url),'utf8');
const base='https://www.schwentinental.de/verwaltung-politik/',source={id:'de-01057091',name:'Schwentinental',kind:'municipality',method:'scraper',adapter:'hhdocuments',base};
const now=new Date('2026-10-10T12:00:00Z');

test('hhdocuments is recognised by its extension in the pages',()=>{
 assert.deepEqual(detectHhDocuments('https://www.schwentinental.de/verwaltung-politik/sitzungsplanung',fixture('vorlage.html')+'tx_hhdocuments_events'),{adapter:'hhdocuments',base});
 assert.equal(detectHhDocuments('https://example.org/a/sitzungsplanung','<html>Termine</html>'),null);
});

test('hhdocuments list: papers with day, file, category and bodies; the address of the next page',()=>{
 const {rows,next}=parseHhList(fixture('dokumente-seite-1.html'),base);
 assert.deepEqual(rows.map(r=>[r.date,r.category,r.bodies.length]),[['2026-10-09','Vorlagen',3],['2026-10-08','Einladungen',1],['2026-10-07','Vorlagen',2]]);
 assert.match(rows[0].file,/^2026_209_wi23-ha23-st23_20261009_/);assert.match(rows[0].fileUrl,/^https:\/\/api\.schwentinental\.cloud\/files\//);
 assert.match(rows[0].detail,/tx_hhdocuments_documents%5Bid%5D=/);
 assert.match(next(2),/dokumentenwesen\?currentPage=2&date_gt=&date_lt=&q=&sorting=date%3Adesc&cHash=/);assert.equal(next(9),null);
 assert.equal(parseHhList('<html>Fehler</html>',base).rows.length,0);
});

test('hhdocuments paper page: title, day, file and the meetings that deal with it',()=>{
 const d=parseHhDocument(fixture('vorlage.html'),base);
 assert.equal(d.title,'Teileinziehung des Ritzebeker Weges zur Realisierung der Fahrradstraße');assert.equal(d.category,'Vorlagen');assert.equal(d.date,'2026-09-21');
 assert.deepEqual(d.sessions.map(s=>[s.date,s.time,s.body]),[['2026-10-26','19:00','Hauptausschuss'],['2026-10-05','19:00','Ausschuss für Umwelt und Verkehr'],['2026-11-12','19:00','Stadtvertretung']]);
 assert.ok(d.sessions.every(s=>s.url.startsWith(base+'sitzungsplanung?tx_hhdocuments_events')));
 assert.deepEqual(hhPaper('2026_221b_ku23-ha23_20260922_x.pdf'),{reference:'2026/221',key:'2026-221',version:'b'});
 assert.equal(hhPaper('2026_153-d_bi23-ha23_x.pdf').key,'2026-153');assert.equal(hhPaper('ku23_einl_20261008.pdf'),null);
});

test('hhdocuments import: a report per paper and meeting, past and coming meetings, only list and paper pages are requested',async()=>{
 const asked=[];
 const request=async url=>{
  asked.push(url);const u=new URL(url);
  if(u.searchParams.get('tx_hhdocuments_documents[lookingfor]')==='documents')return new Response(fixture('vorlage.html'));
  if(u.pathname.endsWith('/dokumentenwesen')&&!u.searchParams.has('currentPage'))return new Response(fixture('dokumente-seite-1.html'));
  if(u.pathname.endsWith('/dokumentenwesen')&&u.searchParams.get('currentPage')==='2')return new Response('<html></html>');
  return new Response('nicht gefunden',{status:404});
 };
 const result=await collectHhDocuments(source,{now,request,window:'3m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 assert.equal(result.coverage.meetings,3);assert.equal(result.readMeetings,3);
 assert.ok(asked.every(u=>u.startsWith(base+'dokumentenwesen')));
 // Two papers (209 and 196) with the same page in the fixture: two reports, each in three meetings.
 assert.equal(result.topics.length,2);
 const t=result.topics.find(x=>x.id==='de-01057091-hh-2026-209');
 assert.equal(t.title,'Teileinziehung des Ritzebeker Weges zur Realisierung der Fahrradstraße');assert.equal(t.reference,'2026/209');
 assert.equal(t.events.length,3);assert.deepEqual(t.events.map(e=>[e.date,e.committee]),[['2026-10-05','Ausschuss für Umwelt und Verkehr'],['2026-10-26','Hauptausschuss'],['2026-11-12','Stadtvertretung']]);
 assert.equal(t.events[0].status,'unknown');assert.equal(t.events[1].status,'consulting');assert.equal(t.status,'consulting');
 assert.ok(t.documents.some(d=>d.url.startsWith('https://api.schwentinental.cloud/files/2026_209')));
});

test('hhdocuments import: a failing list is an issue; invitations and minutes are no reports',async()=>{
 const bad=await collectHhDocuments(source,{now,get:async()=>{throw Error('Quelle antwortet mit HTTP 403');},window:'3m'});
 assert.equal(bad.coverage.complete,false);assert.match(bad.coverage.issues.join(' '),/Sitzungsübersicht/);
 const only=fixture('dokumente-seite-1.html').replace(/<td class="category">Vorlagen/g,'<td class="category">Protokolle');
 const none=await collectHhDocuments(source,{now,get:async()=>only,window:'3m'});
 assert.equal(none.topics.length,0);
});
