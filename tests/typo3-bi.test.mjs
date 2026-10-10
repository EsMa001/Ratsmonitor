import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectTypo3Bi,typo3Url,typo3Meetings,parseTypo3Agenda,typo3Items,committeeOf,collectTypo3Bi} from '../server/integrations/typo3-bi.mjs';
// Pages of stadtrat.monheim.de (TYPO3 Bürgerinformationssystem) as published on 10.10.2026.
const fixture=name=>fs.readFileSync(new URL('./fixtures/typo3-bi/'+name,import.meta.url),'utf8');
const base='https://stadtrat.monheim.de/bi/',source={id:'nrw-05158016',name:'Stadt Monheim am Rhein',kind:'city',method:'scraper',adapter:'typo3-bi',base};
const now=new Date('2026-10-10T12:00:00Z');

test('TYPO3 BIS is recognised by its page and the address of the application',()=>{
 assert.deepEqual(detectTypo3Bi('https://stadtrat.monheim.de/bi',fixture('start.html')),{adapter:'typo3-bi',base});
 assert.equal(detectTypo3Bi('https://example.de/bi','<html>kein TYPO3</html>'),null);
 assert.equal(typo3Url('api/meetings/month/2026-09',source),'https://stadtrat.monheim.de/api/meetings/month/2026-09');
 assert.throws(()=>typo3Url('bi/download/00192576.pdf',source),/Nicht freigegeben/);
 assert.throws(()=>typo3Url('https://fremd.example/api/meetings/stream/1',source),/Nicht freigegeben/);
});

test('TYPO3 BIS month list: meetings newest first; broken answers give none',()=>{
 const rows=typo3Meetings(fixture('monat-2026-09.json'));
 assert.equal(rows.length,7);assert.deepEqual([rows[0].date,rows[0].id,rows[0].time],['2026-09-30','5008','17:00']);
 assert.equal(committeeOf('Sitzung des Haupt- und Finanzausschusses'),'Haupt- und Finanzausschuss');
 assert.equal(committeeOf('Sitzung des Rates'),'Rat');
 assert.equal(committeeOf('Ausschuss für Chancengerechtigkeit und Integration'),'Ausschuss für Chancengerechtigkeit und Integration');
 assert.deepEqual(typo3Meetings('<html>Fehler</html>'),[]);
});

test('TYPO3 BIS agenda: items, papers with kind, date, result and documents',()=>{
 const items=parseTypo3Agenda(fixture('stream-5003.html'),source);
 assert.equal(items.length,16);assert.ok(items.some(i=>!i.paper));
 const p=items.find(i=>i.paper==='XI/0380');
 assert.equal(p.kind,'Mitteilungsvorlage');assert.equal(p.date,'07.09.2026');assert.equal(p.result,'zur Kenntnis genommen');
 assert.match(p.content,/Bericht über die Ausführung von Beschlüssen/);
 assert.deepEqual(p.documents,[{title:'Vorlage',url:'https://stadtrat.monheim.de/bi/download/00192737.pdf'}]);
 assert.deepEqual(parseTypo3Agenda('',source),[]);
});

test('TYPO3 BIS reports: result gives the status, a coming meeting is "consulting"',()=>{
 const items=parseTypo3Agenda(fixture('stream-5003.html'),source),m={date:'2026-09-24',body:'Sitzung des Haupt- und Finanzausschusses',url:base+'sitzungen/5003'};
 const rows=typo3Items(items,m,source,now);
 assert.ok(rows.length>0&&rows.every(r=>r.id.startsWith('nrw-05158016-vo-')&&r.reference));
 const r=rows.find(x=>x.reference==='XI/0380');
 assert.equal(r.id,'nrw-05158016-vo-xi-0380');assert.equal(r.status,'info');assert.equal(r.event.committee,'Haupt- und Finanzausschuss');
 assert.ok(typo3Items(items,{...m,date:'2026-11-01'},source,now).every(x=>x.status==='consulting'));
});

const getFor=asked=>async url=>{
 asked.push(url);
 if(/api\/meetings\/month\/2026-09$/.test(url))return fixture('monat-2026-09.json');
 if(/api\/meetings\/month\//.test(url))return '[]';
 if(/api\/meetings\/stream\/5003$/.test(url))return fixture('stream-5003.html');
 if(/api\/meetings\/stream\/4968$/.test(url))return fixture('stream-4968.html');
 if(/api\/meetings\/stream\//.test(url))return '\n\n';
 throw Error('Quelle antwortet mit HTTP 404');
};

test('TYPO3 BIS import reads month lists and agendas, keeps marks, reads nothing else',async()=>{
 const asked=[];
 const result=await collectTypo3Bi(source,{now,get:getFor(asked),window:'3m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 assert.equal(result.coverage.meetings,7);assert.equal(result.readMeetings,2);
 assert.ok(asked.every(u=>u.startsWith('https://stadtrat.monheim.de/api/meetings/')));
 const t=result.topics.find(x=>x.id==='nrw-05158016-vo-xi-0380');
 assert.equal(t.regionId,source.id);assert.equal(t.status,'info');assert.ok(t.documents.some(d=>d.kind==='pdf'));
 assert.ok(Object.keys(result.marks).includes(base+'sitzungen/5003'));
});

test('TYPO3 BIS import: failing calendar is an issue; organizations select bodies',async()=>{
 const bad=await collectTypo3Bi(source,{now,get:async()=>{throw Error('Quelle antwortet mit HTTP 403');},window:'3m'});
 assert.equal(bad.coverage.complete,false);assert.match(bad.coverage.issues.join(' '),/Sitzungskalender/);
 const one=await collectTypo3Bi({...source,organizations:{include:['Haupt- und Finanz']}},{now,get:getFor([]),window:'3m'});
 assert.equal(one.coverage.meetings,1);
});
