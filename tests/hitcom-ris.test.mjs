import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectHitcomRis,hitcomMeetings,parseHitcomMeeting,collectHitcomRis} from '../server/integrations/hitcom-ris.mjs';
// Pages of www.schiltach.de (Rats-Info-System of hitcom, cEasy) as published on 10.10.2026, cut to the content area.
const fixture=name=>fs.readFileSync(new URL('./fixtures/hitcom-ris/'+name,import.meta.url),'utf8');
const base='https://www.schiltach.de/de/Rathaus/',source={id:'de-08325051',name:'Schiltach',kind:'municipality',method:'scraper',adapter:'hitcom-ris',base};
const now=new Date('2026-10-10T12:00:00Z');

test('hitcom Rats-Info-System is recognised by its pages',()=>{
 assert.deepEqual(detectHitcomRis('https://www.schiltach.de/de/Rathaus/Ratsinformationssystem',fixture('suche-2026.html')),{adapter:'hitcom-ris',base});
 assert.equal(detectHitcomRis('https://example.org/x/Ratsinformationssystem','<title>Sitzungsdienst</title>'),null);
});

test('hitcom list: meetings with id, day, time and address, newest first',()=>{
 const rows=hitcomMeetings(fixture('suche-2026.html'),base);
 assert.equal(rows.length,19);
 assert.deepEqual(rows[0],{id:'1391',date:'2026-12-16',time:'18:00',title:'Öffentliche Gemeinderatssitzung',url:base+'Rats-Info-System/Sitzung?view=publish&item=meeting&id=1391'});
 assert.ok(rows.some(r=>r.id==='1419'&&r.date==='2026-01-28'&&/Finanzausschuss/.test(r.title)));
 assert.deepEqual(hitcomMeetings('<html>Fehler</html>',base),[]);
});

test('hitcom meeting: body, day, the items with papers and the minutes',()=>{
 const p=parseHitcomMeeting(fixture('sitzung.html'));
 assert.equal(p.title,'Öffentliche Gemeinderatssitzung 21.01.2026');assert.equal(p.body,'Gemeinderat');assert.equal(p.date,'2026-01-21');assert.equal(p.time,'19:00');
 assert.equal(p.items.length,12);
 const item=p.items.find(i=>i.number==='4');
 assert.match(item.title,/^Satzung über die örtlichen Bauvorschiften .* \(Altstadtsatzung\)/);
 assert.equal(item.documents.length,5);assert.ok(item.documents.every(d=>d.url.startsWith('https://www.schiltach.de/ceasy/resource/')));
 assert.equal(p.items[0].documents.length,0);
 assert.deepEqual(p.minutes,[{title:'Protokoll 2026_01_21',url:'https://www.schiltach.de/ceasy/resource/17791?'}]);
});

test('hitcom import: reports of the items with papers, only the list and meeting pages are requested',async()=>{
 const asked=[];
 const request=async url=>{
  asked.push(url);const u=new URL(url);
  if(u.pathname.endsWith('/Ratsinformationssystem'))return new Response(u.searchParams.get('filters[date]')?.startsWith('2026')?fixture('suche-2026.html'):'<html></html>');
  if(u.pathname.endsWith('/Rats-Info-System/Sitzung'))return new Response(fixture('sitzung.html'));
  return new Response('nicht gefunden',{status:404});
 };
 const result=await collectHitcomRis(source,{now,request,window:'12m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 assert.equal(result.coverage.meetings,19);assert.equal(result.readMeetings,19);
 assert.ok(asked.every(u=>/\/de\/Rathaus\/(?:Ratsinformationssystem\?|Rats-Info-System\/Sitzung\?view=publish&item=meeting&id=\d+$)/.test(u)));
 const t=result.topics.find(x=>/Altstadtsatzung/.test(x.title));
 assert.ok(t.id.startsWith('de-08325051-hc-m')&&t.id.endsWith('-t4'));assert.equal(t.committee,'Gemeinderat');assert.ok(t.documents.length>=5);
 // Fragestunde and Kurzbericht carry no report.
 assert.ok(!result.topics.some(x=>/^(?:Fragestunde|Kurzbericht)/.test(x.title)));
 assert.ok(Object.keys(result.marks).every(k=>k.includes('item=meeting')));
});

test('hitcom import: a failing list is an issue',async()=>{
 const bad=await collectHitcomRis(source,{now,get:async()=>{throw Error('Quelle antwortet mit HTTP 403');},window:'3m'});
 assert.equal(bad.coverage.complete,false);assert.match(bad.coverage.issues.join(' '),/Sitzungsübersicht/);
});
