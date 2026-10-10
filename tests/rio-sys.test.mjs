import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectRioSys,parseRioSysYear,collectRioSys} from '../server/integrations/rio-sys.mjs';
// Pages of badboll.rio-sys.de (rio-sys) as published on 10.10.2026; the year page is cut to its first two meetings.
const fixture=name=>fs.readFileSync(new URL('./fixtures/rio-sys/'+name,import.meta.url),'utf8');
const base='https://badboll.rio-sys.de/',source={id:'de-08117012',name:'Bad Boll',kind:'municipality',method:'scraper',adapter:'rio-sys',base};
const now=new Date('2026-10-10T12:00:00Z');
const YEAR=base+'index.php?b=sitzungen&jahr=';

test('rio-sys is recognised by its host and title',()=>{
 assert.deepEqual(detectRioSys('https://badboll.rio-sys.de/','<title>rio-sys App</title>'),{adapter:'rio-sys',base});
 assert.equal(detectRioSys('https://www.badboll.de/','<title>Gemeinde</title>'),null);
});

test('rio-sys year page: meetings with place, body and the public items with papers',()=>{
 const rows=parseRioSysYear(fixture('sitzungen-2026.html'),base);
 assert.deepEqual(rows.map(r=>[r.id,r.date,r.time,r.place,r.body]),[['381','2026-02-05','19:00','Aula','Gemeinderat'],['369','2026-01-22','19:00','Altes Schulhaus','Gemeinderat']]);
 const m=rows.find(r=>r.id==='369');
 assert.equal(m.items.length,12);
 const item=m.items.find(i=>i.number==='3');
 assert.equal(item.title,'Ausscheiden von Gemeinderat Lars Ziegler');
 assert.deepEqual(item.documents.map(d=>d.url),[base+'file.php?id=10498',base+'file.php?id=10511']);
 assert.equal(item.documents[0].title,'2026-515-Sitzungsvorlage_8067.pdf');
 assert.equal(m.items.find(i=>i.number==='1').documents.length,0);
 assert.deepEqual(parseRioSysYear('<html>Fehler</html>',base),[]);
});

test('rio-sys import: reports of the items with papers or substance, only year pages are requested',async()=>{
 const asked=[];
 const request=async url=>{
  asked.push(url);
  if(url===YEAR+'2026')return new Response(fixture('sitzungen-2026.html'));
  if(url===YEAR+'2025')return new Response('<html><body>keine Sitzungen</body></html>');
  return new Response('nicht gefunden',{status:404});
 };
 const result=await collectRioSys(source,{now,request,window:'12m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 assert.equal(result.coverage.meetings,2);assert.equal(result.readMeetings,2);
 assert.ok(asked.every(u=>/^https:\/\/badboll\.rio-sys\.de\/index\.php\?b=sitzungen&jahr=\d{4}$/.test(u)));
 assert.equal(new Set(asked).size,asked.length);
 const t=result.topics.find(x=>x.id==='de-08117012-rs-s369-t3');
 assert.equal(t.title,'Ausscheiden von Gemeinderat Lars Ziegler');assert.equal(t.committee,'Gemeinderat');assert.equal(t.eventDate,'2026-01-22');
 assert.equal(t.status,'unknown');
 assert.ok(t.documents.some(d=>d.url===base+'file.php?id=10498'));
 // Opening and the residents' question time carry no report.
 assert.ok(!result.topics.some(x=>/^(?:Eröffnung|Einwohner)/.test(x.title)));
 assert.ok(Object.keys(result.marks).length===2);
});

test('rio-sys import: a coming meeting is "consulting"; a failing year is an issue',async()=>{
 const get=async url=>url===YEAR+'2026'?fixture('sitzungen-2026.html'):'<html></html>';
 const coming=await collectRioSys(source,{now:new Date('2026-01-10T12:00:00Z'),get,window:'3m'});
 assert.ok(coming.topics.length>0&&coming.topics.every(t=>t.status==='consulting'));
 const bad=await collectRioSys(source,{now,get:async()=>{throw Error('Quelle antwortet mit HTTP 503');},window:'3m'});
 assert.equal(bad.coverage.complete,false);assert.match(bad.coverage.issues.join(' '),/Sitzungsübersicht/);
});
