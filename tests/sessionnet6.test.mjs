import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectSessionNet6,parseMeetings,parseSessionNet6Agenda,agendaDocuments,collectSessionNet6} from '../server/integrations/sessionnet6.mjs';
// Excerpts of the public interface of buergerinfo.sangerhausen.de and sitzungen.liebenwalde.de/buergerportal/ (October 2026).
const fixture=name=>fs.readFileSync(new URL('./fixtures/sessionnet6/'+name,import.meta.url),'utf8');
const json=name=>JSON.parse(fixture(name));
const base='https://buergerinfo.sangerhausen.de/',source={id:'de-15087370',name:'Stadt Sangerhausen',kind:'city',method:'scraper',adapter:'sessionnet6',base};
const now=new Date('2026-10-04T12:00:00Z');
const page=n=>base+'sitzungen/'+n,api=path=>base+'api/v1/'+path;
const committees=new Map(json('sangerhausen-gremien.json').map(g=>[String(g.grNr),g.name]));
const meetingOf=n=>parseMeetings(json('sangerhausen-sitzungen.json'),source,now).find(m=>m.id===String(n));
test('SessionNet 6 is recognised by the app shell; the base is the app folder',()=>{
 const shell=fixture('sangerhausen-shell.html'),start=fixture('liebenwalde-start.html');
 assert.deepEqual(detectSessionNet6('https://buergerinfo.sangerhausen.de/',shell),{adapter:'sessionnet6',base,version:'1.2.1 (2026-06-26T10:36)'});
 // The server fills in <base href>; the placeholder version is left out.
 assert.deepEqual(detectSessionNet6('https://sitzungen.liebenwalde.de/buergerportal/startseite',start),{adapter:'sessionnet6',base:'https://sitzungen.liebenwalde.de/buergerportal/'});
 // Without a filled-in <base href> the address decides, without the app's route.
 assert.equal(detectSessionNet6('https://rat.elbe-parey.de/startseite',shell).base,'https://rat.elbe-parey.de/');
 assert.equal(detectSessionNet6('http://sitzungen.liebenwalde.de/buergerportal/sitzungen/1127',shell).base,'https://sitzungen.liebenwalde.de/buergerportal/');
 assert.equal(detectSessionNet6('https://sitzungen.liebenwalde.de/buergerportal',shell).base,'https://sitzungen.liebenwalde.de/buergerportal/');
 assert.equal(detectSessionNet6('https://ratsinfo.ahlden.eu/index.html',shell).base,'https://ratsinfo.ahlden.eu/');
 // Not SessionNet 6: SessionNet 5 pages, the members' area, other products, other titles.
 assert.equal(detectSessionNet6('https://ris.example.test/bi/si0040.asp','<html><head><title>SessionNet | Sitzungskalender</title></head><body><a href="si0057.asp?__ksinr=1">Rat</a></body></html>'),null);
 assert.equal(detectSessionNet6('https://ris.example.test/gi/login',shell),null);
 assert.equal(detectSessionNet6('https://ris.example.test/',shell.replace('Bürgerinformationssystem','Gremieninformationssystem')),null);
 assert.equal(detectSessionNet6('https://ris.example.test/',shell.replace(/<title>[^<]*/,'<title>ALLRIS net')),null);
 assert.equal(detectSessionNet6('https://ris.example.test/',shell.replace('<app-root></app-root>','')),null);
 assert.equal(detectSessionNet6('not a url',shell),null);
});
test('SessionNet 6 meeting list: the app page of each meeting, and whether the app opens it',()=>{
 const list=parseMeetings(json('sangerhausen-sitzungen.json'),source,now);
 assert.deepEqual(list.map(m=>[m.id,m.url,m.date,m.name,m.number,m.released]),[
  ['2207',page(2207),'2026-09-09','38. Sitzung des Hauptausschusses','HA/038/2026',true],
  ['2217',page(2217),'2026-09-10','19. Ratssitzung','SR/019/2026',true],
  ['2413',page(2413),'2026-10-07','Sitzung des Sanierungsausschusses','SA/019/2026',true],
  ['2580',page(2580),'2026-10-09','Klausurtagung','KT 7',false]]);
 // A release date still ahead: the meeting is not published yet.
 assert.equal(parseMeetings([{siNr:7,dat:'2026-10-20',name:'Rat',freigabeDatum:'2026-10-10'}],source,now)[0].released,false);
 assert.throws(()=>parseMeetings({error:'x'},source),/Unbekanntes Format/);
});
test('SessionNet 6 agenda keeps public items, joins a paper by its number and skips section headings',()=>{
 const list=json('sangerhausen-2217-tagesordnung.json');
 // An item that the interface marked otherwise than public is never taken, whatever it carries.
 list.push({toNr:41400,oSt:2,nummer:'9',text:'Grundstücksangelegenheit',voNr:9999,grNr:1,abstimmungTyp:1,beschluss:'einstimmig beschlossen',sort:95});
 const items=parseSessionNet6Agenda(list,meetingOf(2217),source,committees,now);
 assert.deepEqual(items.map(i=>[i.id,i.title.slice(0,30),i.status,i.event.committee,i.event.result]),[
  ['de-15087370-top-41285','Eröffnung der Sitzung, Festste','unknown','Stadtrat','bestätigt'],
  ['de-15087370-top-41288','Bericht des Oberbürgermeisters','info','Stadtrat','zur Kenntnis genommen'],
  ['de-15087370-vo-4220','Neufassung der Vergabeordnung ','approved','Stadtrat','mehrheitlich beschlossen'],
  ['de-15087370-vo-4221','3. Änderung der Hauptsatzung','approved','Stadtrat','mehrheitlich beschlossen'],
  ['de-15087370-vo-4230','Annahme der Angebote von Zuwen','unknown','Stadtrat','nicht abgestimmt'],
  ['de-15087370-vo-4206','Bericht der Stadt Sangerhausen','info','Stadtrat','zur Kenntnis genommen'],
  ['de-15087370-top-41299','Wiederherstellung der Öffentli','unknown','Stadtrat','']]);
 assert.ok(!/Grundstück|Beratungsgegenstände|Informationsvorlagen in/.test(JSON.stringify(items)));
 const paper=items[2];
 assert.equal(paper.sourceUrl,page(2217)+'#top-41322');assert.equal(paper.event.url,page(2217));assert.equal(paper.event.date,'2026-09-10');assert.equal(paper.reference,'');
 assert.equal(paper.event.description,'Ergebnis laut Tagesordnung: mehrheitlich beschlossen');assert.deepEqual(paper.agenda,{number:'6.1',top:'41322',paper:'4220'});
 // The longer official wording is kept with the record where it differs.
 assert.match(parseSessionNet6Agenda(json('sangerhausen-2207-tagesordnung.json').map(t=>t.toNr===41596?{...t,textLang:'3. Änderung der Hauptsatzung der Stadt Sangerhausen'}:t),meetingOf(2207),source,committees,now).find(i=>i.agenda.top==='41596').agenda.longTitle,/der Stadt Sangerhausen$/);
 // A committee recommends; without the committee names the meeting's name stands in and decides nothing.
 const committee=parseSessionNet6Agenda(json('sangerhausen-2207-tagesordnung.json'),meetingOf(2207),source,committees,now);
 assert.deepEqual(committee.map(i=>[i.agenda.number,i.id,i.status,i.event.committee]),[
  ['1','de-15087370-top-41578','unknown','Hauptausschuss'],['3.1','de-15087370-top-41603','unknown','Hauptausschuss'],
  ['4.1.1','de-15087370-vo-4220','unknown','Hauptausschuss'],['4.1.2','de-15087370-vo-4221','unknown','Hauptausschuss'],['4.4','de-15087370-top-41585','unknown','Hauptausschuss']]);
 assert.deepEqual(parseSessionNet6Agenda(json('sangerhausen-2217-tagesordnung.json'),meetingOf(2217),source,new Map(),now).filter(i=>i.agenda.paper==='4220').map(i=>[i.event.committee,i.status]),[['Ratssitzung','recommended']]);
 // An office keeps one "Gemeindevertretung" per member municipality; the meeting's name says whose.
 const office={...source,id:'de-130725254',name:'Amt Gnoien',base:'https://ratsinfo.amt-gnoien.de/'},bodies=new Map([['9','Gemeindevertretung'],['6','Stadtvertretung'],['1','Amtsausschuss']]);
 const council=(name,grNr)=>parseSessionNet6Agenda([{toNr:20430,oSt:1,nummer:'7',text:'Klarstellungssatzung Nr. 3',voNr:3283,grNr,abstimmungTyp:1,beschluss:'einstimmig beschlossen'}],{id:'1127',url:office.base+'sitzungen/1127',date:'2026-09-16',name},office,bodies,now)[0];
 assert.deepEqual([council('Sitzung der Gemeindevertretung Walkendorf',9),council('Sitzung der Stadtvertretung der Warbelstadt Gnoien',6),council('Sitzung des Amtsausschusses des Amtes Gnoien',1),council('Gemeindevertretung (Sondersitzung)',9)].map(i=>[i.event.committee,i.status]),
  [['Gemeindevertretung Walkendorf','approved'],['Stadtvertretung der Warbelstadt Gnoien','approved'],['Amtsausschuss','approved'],['Gemeindevertretung','approved']]);
 // A meeting still ahead is announced, never decided.
 const ahead=parseSessionNet6Agenda([{toNr:1,oSt:1,nummer:'1',text:'Sanierungsgebiet',voNr:5,grNr:5,beschluss:'beschlossen'},{toNr:2,oSt:1,nummer:'2',text:'Mitteilungen',voNr:0,grNr:5}],meetingOf(2413),source,committees,now);
 assert.deepEqual(ahead.map(i=>[i.status,i.event.committee,i.event.description]),[['consulting','Sanierungsausschuss','Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.'],['announced','Sanierungsausschuss','Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.']]);
 assert.equal(parseSessionNet6Agenda({title:'Not Found'},meetingOf(2217),source,committees,now),null);
});
test('SessionNet 6 agenda takes published vote counts as part of the result, not as an outcome',()=>{
 const lw={...source,id:'de-12065193',name:'Stadt Liebenwalde',base:'https://sitzungen.liebenwalde.de/buergerportal/'};
 const meeting={id:'1127',url:lw.base+'sitzungen/1127',date:'2026-07-09',name:'Sitzung der Stadtverordnetenversammlung'};
 const items=parseSessionNet6Agenda(json('liebenwalde-1127-tagesordnung.json'),meeting,lw,new Map([['2','Stadtverordnetenversammlung']]),now);
 assert.deepEqual(items.map(i=>[i.agenda.number,i.status,i.event.result]),[
  ['1.1','unknown',''],['1.2','unknown','Abstimmung: Ja 11, Nein 0, Enthaltung 1'],['6','approved','einstimmig beschlossen (Ja 13, Nein 0, Enthaltung 0)']]);
 // Without the committee names: "Sitzung der Stadtverordnetenversammlung" is no name of a deciding body.
 assert.equal(parseSessionNet6Agenda(json('liebenwalde-1127-tagesordnung.json'),meeting,lw,new Map(),now).at(-1).status,'recommended');
 // Documents: the reference is the app's own address; one outside the source folder or host is left out.
 const docs=agendaDocuments([...json('liebenwalde-1127-dokumente.json'),{toNr:2412,doNr:1,name:'Fremd',ref:'/api/v1/dokumente/1/datei'},{toNr:2412,doNr:2,name:'Fremd',ref:'https://elsewhere.example/buergerportal/api/v1/dokumente/2/datei'},{toNr:2412,doNr:3,name:'ohne Adresse'}],lw);
 assert.deepEqual([...docs.keys()],['2412']);
 assert.deepEqual(docs.get('2412'),[{title:'Beschlussvorlage',url:lw.base+'api/v1/dokumente/3135/datei',kind:'application/pdf'},{title:'Entgeltordnung für die Nutzung von kommunalen Räumen der Stadt Liebenwalde',url:lw.base+'api/v1/dokumente/3173/datei',kind:'application/pdf'}]);
 assert.throws(()=>agendaDocuments('<html>',lw),/Unbekanntes Format/);
});
const ahead=[{toNr:50001,oSt:1,nummer:'1',text:'Sanierungsgebiet Altstadt',textLang:'Sanierungsgebiet Altstadt',voNr:4300,grNr:5,abstimmungTyp:1,sort:10}];
const web=()=>{
 const agenda2217=json('sangerhausen-2217-tagesordnung.json');agenda2217.push({toNr:41400,oSt:2,nummer:'9',text:'Grundstücksangelegenheit',voNr:9999,grNr:1,sort:95});
 const pages={
  [api('gremien')]:fixture('sangerhausen-gremien.json'),
  [api('sitzungen/2207/tagesordnung')]:fixture('sangerhausen-2207-tagesordnung.json'),
  [api('sitzungen/2207/tagesordnung/dokumente')]:JSON.stringify([{toNr:41595,doNr:54135,name:'Beschlussvorlage',ref:'/api/v1/dokumente/54135/datei',sort:0}]),
  [api('sitzungen/2217/tagesordnung')]:JSON.stringify(agenda2217),
  [api('sitzungen/2217/tagesordnung/dokumente')]:JSON.stringify([...json('sangerhausen-2217-dokumente.json'),{toNr:41400,doNr:99999,name:'Kaufvertrag',ref:'/api/v1/dokumente/99999/datei'}]),
  [api('sitzungen/2413/tagesordnung')]:JSON.stringify(ahead),
  [api('sitzungen/2413/tagesordnung/dokumente')]:'[]',
 };
 const calls=[];let list=fixture('sangerhausen-sitzungen.json');
 return {pages,calls,setList:value=>{list=value;},get:async url=>{calls.push(url);if(/\/api\/v1\/sitzungen\?von=\d{4}-\d{2}-\d{2}&bis=\d{4}-\d{2}-\d{2}$/.test(url))return list;if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];}};
};
test('SessionNet 6 collector reads the list, each released agenda with its documents, and joins a paper across meetings',async()=>{
 const {calls,get}=web();
 const d=await collectSessionNet6(source,{now,get,window:'1m'});
 assert.equal(calls[0],api('sitzungen?von=2026-09-04&bis=2026-11-30'),'one span covers the month and the end of next month');
 assert.equal(calls.filter(u=>u===api('gremien')).length,1);assert.ok(calls.every(u=>u.startsWith(base)));
 assert.ok(!calls.some(u=>u.includes('/2580/')),'a meeting the app does not open is not asked');
 assert.ok(!calls.some(u=>/99999|teilnehmer|personen/.test(u)));
 assert.equal(d.coverage.method,'scraper');assert.equal(d.coverage.meetings,3);assert.equal(d.coverage.upcomingWithoutAgenda,1);assert.deepEqual(d.coverage.issues,[]);assert.equal(d.coverage.complete,true);assert.equal(d.readMeetings,3);
 assert.deepEqual(Object.keys(d.marks).sort(),[page(2207),page(2217),page(2413)]);
 const paper=d.topics.find(t=>t.id==='de-15087370-vo-4220');
 assert.deepEqual(paper.events.map(e=>[e.date,e.committee,e.status,e.result]),[['2026-09-09','Hauptausschuss','unknown','Abstimmung Ausschuss'],['2026-09-10','Stadtrat','approved','mehrheitlich beschlossen']]);
 assert.equal(paper.status,'approved');assert.equal(paper.eventDate,'2026-09-10');assert.equal(paper.committee,'Stadtrat');assert.equal(paper.regionId,source.id);assert.equal(paper.public,true);
 assert.deepEqual(paper.documents.map(x=>x.url),[api('dokumente/54135/datei'),api('dokumente/54137/datei'),api('dokumente/54966/datei'),paper.sourceUrl]);
 assert.equal(paper.events[1].decision.kind,'decision');assert.equal(paper.events[0].attendance.status,'not_collected');
 assert.equal(paper.sourceData.method,'sessionnet6');assert.deepEqual(paper.sourceData.records.map(r=>r.url),[api('sitzungen/2207/tagesordnung'),api('sitzungen/2217/tagesordnung')]);
 assert.deepEqual(paper.sourceData.records[1].fields,{number:'6.1',title:paper.title,paper:'4220',result:'mehrheitlich beschlossen',meeting:'19. Ratssitzung',meetingNumber:'SR/019/2026'});
 // The item of the latest meeting is the address, whatever order the meetings were read in.
 assert.equal(paper.sourceUrl,page(2217)+'#top-41322');
 const reversed=(await collectSessionNet6(source,{now,get:web().get,window:'1m',oldestFirst:true})).topics.find(t=>t.id===paper.id);assert.deepEqual(reversed,paper);
 assert.match(paper.longSummary[0],/Stadt Sangerhausen/);
 assert.equal(d.topics.find(t=>t.id==='de-15087370-top-41288').documents[0].title,'OB-Bericht');
 assert.equal(d.topics.find(t=>t.id==='de-15087370-vo-4300').status,'consulting');
 assert.ok(!/Grundstück|Kaufvertrag|99999/.test(JSON.stringify(d)),'nothing of the non-public part');
 // A meeting that took place but was never released is a remark, not a gap.
 const {get:get2,setList}=web();setList(JSON.stringify(json('sangerhausen-sitzungen.json').map(m=>m.siNr===2580?{...m,dat:'2026-09-20'}:m)));
 const bare=await collectSessionNet6(source,{now,get:get2,window:'1m'});
 assert.deepEqual(bare.coverage.warnings,['Sitzung ohne freigegebene Tagesordnung: '+page(2580)]);assert.deepEqual(bare.coverage.issues,[]);assert.equal(bare.coverage.meetings,4);assert.equal(bare.coverage.upcomingWithoutAgenda,undefined);
});
test('SessionNet 6 collector asks a long period in spans and skips meetings whose agenda is unchanged',async()=>{
 const {calls,get,pages}=web();
 const first=await collectSessionNet6(source,{now,get,window:'1m'});
 const later=new Date(now.getTime()+15*86400000),stock=new Set([page(2207),page(2217),page(2413)]);calls.length=0;
 const second=await collectSessionNet6(source,{now:later,get,window:'12m',marks:{known:first.marks,stock}});
 assert.deepEqual(calls.filter(u=>u.includes('sitzungen?')),['von=2025-10-19&bis=2026-01-18','von=2026-01-18&bis=2026-04-19','von=2026-04-19&bis=2026-07-19','von=2026-07-19&bis=2026-10-18','von=2026-10-18&bis=2026-11-30'].map(q=>api('sitzungen?'+q)));
 // The two meetings in September are unchanged; the one of 7 October has taken place since and is read again.
 assert.equal(second.coverage.unchangedMeetings,2);assert.ok(!calls.includes(api('sitzungen/2217/tagesordnung/dokumente')));assert.ok(calls.includes(api('sitzungen/2413/tagesordnung/dokumente')));
 assert.equal(second.coverage.complete,true);assert.deepEqual(second.topics.map(t=>t.id),['de-15087370-vo-4300']);
 // The agenda says something new: the meeting is read again.
 pages[api('sitzungen/2217/tagesordnung')]=pages[api('sitzungen/2217/tagesordnung')].replace('"nicht abgestimmt"','"vertagt"');calls.length=0;
 const changed=await collectSessionNet6(source,{now:later,get,window:'12m',marks:{known:first.marks,stock}});
 assert.equal(changed.coverage.unchangedMeetings,1);assert.ok(calls.includes(api('sitzungen/2217/tagesordnung/dokumente')));
 assert.equal(changed.topics.find(t=>t.id==='de-15087370-vo-4230').status,'postponed');
 // Read a moment ago: not even the agenda is asked.
 calls.length=0;const resumed=await collectSessionNet6(source,{now:new Date(now.getTime()+3600000),get,window:'1m',marks:{known:first.marks,stock}});
 assert.equal(resumed.coverage.unchangedMeetings,3);assert.deepEqual(calls,[api('sitzungen?von=2026-09-04&bis=2026-11-30')]);
});
test('SessionNet 6 collector stops at once on HTTP 429, 401 or 403 and never mistakes them for a quiet period',async()=>{
 const {calls,get}=web();
 const d=await collectSessionNet6(source,{now,window:'1m',get:async url=>url===api('sitzungen/2217/tagesordnung')?(calls.push(url),Promise.reject(Error('Quelle antwortet mit HTTP 429'))):get(url)});
 assert.ok(d.coverage.issues.some(i=>/zu viele Zugriffe; Abruf beendet/.test(i)));assert.equal(d.coverage.resumable,undefined);assert.equal(d.coverage.complete,false);
 assert.equal(calls.filter(u=>u===api('sitzungen/2217/tagesordnung')).length,1,'not repeated');assert.ok(!calls.includes(api('sitzungen/2207/tagesordnung')),'nothing is asked after the refusal');
 for(const status of [401,403,429]){
  const asked=[];const closed=await collectSessionNet6(source,{now,window:'12m',get:async url=>{asked.push(url);throw Error('Quelle antwortet mit HTTP '+status);}});
  assert.equal(asked.length,1);assert.equal(closed.topics.length,0);assert.equal(closed.coverage.quiet,false);assert.equal(closed.coverage.complete,false);assert.match(closed.coverage.issues[0],status===429?/zu viele Zugriffe/:new RegExp('HTTP '+status));
 }
 // A firewall's rejection page counts as a refusal as well.
 const asked=[];await collectSessionNet6(source,{now,window:'12m',get:async url=>{asked.push(url);throw Error('Quelle antwortet mit HTTP 429: Abruf vom Server vorübergehend abgewiesen');}});assert.equal(asked.length,1);
});
test('SessionNet 6 collector reports an address without the interface, a gap and an import cut short by time',async()=>{
 // The app answers unknown addresses with its own page: no interface at this base.
 const asked=[];const wrong=await collectSessionNet6(source,{now,window:'12m',get:async url=>{asked.push(url);return fixture('sangerhausen-shell.html');}});
 assert.equal(asked.length,1);assert.match(wrong.coverage.issues[0],/kein JSON/);assert.equal(wrong.coverage.quiet,false);assert.equal(wrong.coverage.complete,false);
 // Nothing in a short window: a quiet period.
 const quiet=await collectSessionNet6(source,{now,window:'1w',get:async url=>{if(url.includes('sitzungen?'))return '[]';throw Error('unexpected '+url);}});
 assert.equal(quiet.coverage.quiet,true);assert.equal(quiet.coverage.meetings,0);assert.deepEqual(quiet.coverage.issues,['Noch keine Artikel erfolgreich erfasst.']);
 const {get,pages}=web();pages[api('sitzungen/2207/tagesordnung')]='{"status":500}';
 const gap=await collectSessionNet6(source,{now,window:'1m',get});assert.ok(gap.coverage.issues.includes('Keine lesbare öffentliche Tagesordnung: '+page(2207)));assert.equal(gap.coverage.complete,false);
 // Out of time while reading documents: the meeting is not marked as read and the import can continue.
 const slow=web();const cut=await collectSessionNet6(source,{now,window:'1m',get:async url=>{if(url===api('sitzungen/2217/tagesordnung/dokumente'))throw Error('Zeitbudget der Quelle erreicht');return slow.get(url);}});
 assert.equal(cut.coverage.resumable,true);assert.ok(cut.coverage.issues.some(i=>/Zeitbudget der Quelle erreicht; 1 Sitzung/.test(i)));assert.ok(!(page(2217) in cut.marks));
 assert.equal(cut.topics.find(t=>t.id==='de-15087370-vo-4221').sourceData.detailStatus,'partial');
 // Committee names that cannot be read: the meeting's name stands in, noted as a remark.
 const named=web();delete named.pages[api('gremien')];const plain=await collectSessionNet6(source,{now,window:'1m',get:named.get});
 assert.match(plain.coverage.warnings[0],/Gremienliste nicht lesbar/);assert.equal(plain.topics.find(t=>t.id==='de-15087370-vo-4221').committee,'Ratssitzung');
});
test('SessionNet 6 collector stays inside an app that lives in a folder of its host',async()=>{
 const lw={id:'de-12065193',name:'Stadt Liebenwalde',kind:'city',method:'scraper',adapter:'sessionnet6',base:'https://sitzungen.liebenwalde.de/buergerportal/'};
 const pages={[lw.base+'api/v1/sitzungen?von=2026-06-04&bis=2026-08-31']:JSON.stringify([{nummer:'SVV/011/2026',oSt:4,siNr:1127,name:'Sitzung der Stadtverordnetenversammlung',dat:'2026-07-09',typ:0,freigabeDatum:'2026-06-30'}]),
  [lw.base+'api/v1/gremien']:JSON.stringify([{grNr:2,name:'Stadtverordnetenversammlung',paNr:2}]),
  [lw.base+'api/v1/sitzungen/1127/tagesordnung']:fixture('liebenwalde-1127-tagesordnung.json'),[lw.base+'api/v1/sitzungen/1127/tagesordnung/dokumente']:fixture('liebenwalde-1127-dokumente.json')};
 const calls=[];const d=await collectSessionNet6(lw,{now:new Date('2026-07-04T12:00:00Z'),window:'1m',get:async url=>{calls.push(url);if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];}});
 assert.ok(calls.every(u=>u.startsWith(lw.base)));assert.deepEqual(d.coverage.issues,[]);
 const paper=d.topics.find(t=>t.id==='de-12065193-vo-1143');
 assert.equal(paper.status,'consulting');assert.equal(paper.events[0].url,lw.base+'sitzungen/1127');
 assert.deepEqual(paper.documents.map(x=>x.url),[lw.base+'api/v1/dokumente/3135/datei',lw.base+'api/v1/dokumente/3173/datei',lw.base+'sitzungen/1127#top-2412']);
});
