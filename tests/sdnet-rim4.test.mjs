import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectRim4,rim4Url,rim4Meetings,parseRim4Agenda,parseRim4Process,rim4Items,collectRim4} from '../server/integrations/sdnet-rim4.mjs';
// Pages of ris.wesel.de (SD.NET RIM 4) as published on 09.10.2026.
const fixture=name=>fs.readFileSync(new URL('./fixtures/sdnet-rim4/'+name,import.meta.url),'utf8');
const base='https://ris.wesel.de/',source={id:'nrw-05170048',name:'Stadt Wesel',kind:'city',method:'scraper',adapter:'sdnet-rim4',base};
const now=new Date('2026-10-09T12:00:00Z');
const RAT='https://ris.wesel.de/tops/?__=UGhVM0hpd2NXNFdFcExjZYWuCQwzOiw2bkwmCBDEezw';

test('SD.NET RIM 4 is recognised by its title; the hosts of ratsinfomanagement.net are not served',()=>{
 assert.deepEqual(detectRim4('https://ris.wesel.de/gremien','<title>Gremien - SD.NET RIM 4 | Hansestadt Wesel am Rhein</title>'),{adapter:'sdnet-rim4',base});
 assert.equal(detectRim4('https://velbert.ratsinfomanagement.net/','<title>Gremien - SD.NET RIM 4 | Stadt Velbert</title>'),null);
 assert.equal(detectRim4('https://ratsinfo.flensburg.de/','<title>Sitzungsdienst</title>'),null);
 assert.equal(rim4Url('termine/ics/SD.NET_RIM.ics',source),base+'termine/ics/SD.NET_RIM.ics');
});

test('RIM 4 calendar: meetings with the address of their agenda, newest first; a note after the address is cut off',()=>{
 const rows=rim4Meetings(fixture('termine.ics'));
 assert.deepEqual(rows.map(r=>[r.date,r.body]),[['2026-11-03','Haupt- und Finanzausschuss'],['2026-09-29','Rat'],['2026-09-24','Schul- und Sportausschuss'],['2024-10-29','Haupt- und Finanzausschuss']]);
 assert.equal(rows.find(r=>r.body==='Rat').agenda,RAT);
 assert.equal(rows.find(r=>r.body==='Schul- und Sportausschuss').agenda,'https://ris.wesel.de/tops/?__=UGhVM0hpd2NXNFdFcExjZX5lyfJc2KRTUsuP3aVM2tg');
 const none=rim4Meetings('BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;TZID=Europe/Berlin:20261201T163000\nSUMMARY:Rat\nLOCATION:Rathaus\nEND:VEVENT\nEND:VCALENDAR');
 assert.deepEqual(none.map(r=>[r.date,r.body,r.agenda]),[['2026-12-01','Rat',null]]);
 assert.deepEqual(rim4Meetings('<html>Fehler</html>'),[]);
});

test('RIM 4 agenda: body, day and the public items with a paper number; the non-public part is never read',()=>{
 const a=parseRim4Agenda(fixture('tagesordnung-rat.html'));
 assert.equal(a.committee,'Rat');assert.equal(a.date,'2026-09-29');assert.equal(a.time,'16:30');assert.match(a.place,/Rathaus der Stadt Wesel/);
 const byPaper=Object.fromEntries(a.items.map(i=>[i.paper||'-'+i.number,i]));
 // Items without a paper number are listed but the reports are made of those with one.
 assert.ok(a.items.some(i=>!i.paper));
 const item=byPaper['T 02/325/26'];
 assert.equal(item.number,'3');assert.equal(item.title,'Neu-/Umbesetzung von Ausschüssen Auswirkungen der Bildung der Gruppe AfW Aktiv für Wesel');
 assert.equal(item.kind,'Vorlage zur Kenntnis');assert.equal(item.process,'https://ris.wesel.de/vorgang/?__=UGhVM0hpd2NXNFdFcExjZZX_vMqiAbzwPeEl-j4Ermw');
 assert.deepEqual(item.documents.map(d=>d.title),['Vorlage zur Kenntnis T 02/325/26','Übersichten Besetzung der Ausschüsse']);
 assert.ok(item.documents.every(d=>d.url.startsWith('https://ris.wesel.de/sdnetrim/')));
 // The fixture holds eleven non-public items (class top-noeff-data); none of them is an item.
 const html=fixture('tagesordnung-rat.html'),hidden=[...html.matchAll(/<tr\b[^>]*top-noeff-data[^>]*>[\s\S]*?<\/tr>/g)].map(m=>m[0]);
 assert.equal(hidden.length,11);
 // Their paper numbers and process addresses appear in no item.
 for(const row of hidden){const process=row.match(/href="([^"]*\/vorgang\/[^"]*)"/)?.[1];if(process)assert.ok(!a.items.some(i=>i.process===process),process);}
 assert.equal(parseRim4Agenda('<html>Fehler</html>').items.length,0);
});

test('RIM 4 process: subject, department and the deliberations with resolution',()=>{
 const p=parseRim4Process(fixture('vorgang.html'));
 assert.equal(p.kind,'Vorlage zur Kenntnis');assert.equal(p.number,'T 02/325/26');assert.equal(p.department,'Büro des Bürgermeisters');
 assert.deepEqual(p.deliberations,[{date:'2026-09-29',body:'Rat',resolution:'',vote:''}]);
 const decided=parseRim4Process(fixture('vorgang.html').replace('<td class="column-beschluss"></td>','<td class="column-beschluss">Der Rat beschließt die Vorlage.</td>').replace('<td class="column-ergebnis"></td>','<td class="column-ergebnis">einstimmig</td>'));
 assert.deepEqual(decided.deliberations[0],{date:'2026-09-29',body:'Rat',resolution:'Der Rat beschließt die Vorlage.',vote:'einstimmig'});
});

test('RIM 4 reports: a past item with a resolution takes its status, a coming one is "consulting"',()=>{
 const agenda=parseRim4Agenda(fixture('tagesordnung-rat.html')),meeting={date:'2026-09-29',body:'Rat',agenda:RAT,url:RAT};
 const process=parseRim4Process(fixture('vorgang.html').replace('<td class="column-beschluss"></td>','<td class="column-beschluss">Der Rat beschließt die Vorlage.</td>').replace('<td class="column-ergebnis"></td>','<td class="column-ergebnis">einstimmig</td>'));
 const address=agenda.items.find(i=>i.paper==='T 02/325/26').process;
 const rows=rim4Items(agenda,meeting,source,new Map([[address,process]]),now);
 assert.ok(rows.length>0&&rows.every(r=>r.id.startsWith('nrw-05170048-vo-')&&r.reference));
 const r=rows.find(x=>x.reference==='T 02/325/26');
 assert.equal(r.id,'nrw-05170048-vo-t-02-325-26');assert.equal(r.status,'approved');assert.match(r.event.result,/beschließt/);assert.equal(r.record.kind,'Vorlage zur Kenntnis');
 // Without a published resolution the status stays unknown; the agenda is still a report.
 const open=rim4Items(agenda,meeting,source,new Map(),now).find(x=>x.reference==='T 02/325/26');assert.equal(open.status,'unknown');
 const coming=rim4Items(agenda,meeting,source,new Map(),new Date('2026-09-20T00:00:00Z'));assert.ok(coming.every(x=>x.status==='consulting'));
});

test('RIM 4 import reads the calendar, the agendas and the processes of past meetings, and keeps marks',async()=>{
 const asked=[];
 const get=async url=>{
  asked.push(url);
  if(url===base+'termine/ics/SD.NET_RIM.ics')return fixture('termine.ics');
  if(url.startsWith(base+'tops/'))return fixture('tagesordnung-rat.html');
  if(url.startsWith(base+'vorgang/'))return fixture('vorgang.html');
  throw Error('Quelle antwortet mit HTTP 404');
 };
 const result=await collectRim4(source,{now,get,window:'3m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 // Three meetings inside the period (the one of 2024 lies outside).
 assert.equal(result.coverage.meetings,3);assert.equal(result.readMeetings,3);
 assert.ok(asked.every(u=>u.startsWith(base)&&/(termine\/ics|\/tops\/|\/vorgang\/)/.test(u)));
 // Each process once, though three agendas name it.
 const processes=asked.filter(u=>u.includes('/vorgang/'));assert.equal(new Set(processes).size,processes.length);
 const t=result.topics.find(x=>x.id==='nrw-05170048-vo-t-02-325-26');
 assert.equal(t.regionId,source.id);assert.equal(t.committee,'Rat');assert.ok(t.events.length>=1);
 assert.ok(Object.keys(result.marks).includes(RAT));
 assert.ok(t.documents.some(d=>d.kind==='pdf'));
});

test('RIM 4 import: a meeting without agenda is counted, not an error; a failing calendar is an issue',async()=>{
 const ics='BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;TZID=Europe/Berlin:20261201T163000\nSUMMARY:Rat\nEND:VEVENT\nEND:VCALENDAR';
 const ok=await collectRim4(source,{now,get:async()=>ics,window:'3m'});
 assert.equal(ok.coverage.complete,true);assert.equal(ok.coverage.upcomingWithoutAgenda,1);assert.equal(ok.topics.length,0);
 const bad=await collectRim4(source,{now,get:async()=>{throw Error('Quelle antwortet mit HTTP 403');},window:'3m'});
 assert.equal(bad.coverage.complete,false);assert.match(bad.coverage.issues.join(' '),/Sitzungskalender/);
 await assert.rejects(()=>collectRim4({...source,base:'https://ris.wesel.de/x/'},{now,get:async u=>u,window:'3m'}).then(r=>{throw Error(r.coverage.issues.join('|'));}),/Sitzungskalender/);
});

test('RIM 4 import: organizations keep one municipality of a shared system; other bodies are left out with a warning',async()=>{
 const get=async url=>{
  if(url===base+'termine/ics/SD.NET_RIM.ics')return fixture('termine.ics');
  if(url.startsWith(base+'tops/'))return fixture('tagesordnung-rat.html');
  if(url.startsWith(base+'vorgang/'))return fixture('vorgang.html');
  throw Error('Quelle antwortet mit HTTP 404');
 };
 const result=await collectRim4({...source,organizations:{include:['Schul- und Sport']}},{now,get,window:'3m'});
 assert.equal(result.coverage.meetings,1);
 assert.match((result.coverage.warnings||[]).join(' '),/anderer Gremien/);
 const none=await collectRim4({...source,organizations:{include:['Gibt es nicht']}},{now,get,window:'3m'});
 assert.equal(none.coverage.meetings,0);
});
