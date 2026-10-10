import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectHw,hwPlugin,hwUrl,parseHwMonth,hwItems,collectHwTypo3} from '../server/integrations/hw-typo3.mjs';
// Pages of the Ratsinformationsmodul (Hirsch & Wölfl, hwratssystem) of the websites of Höpfingen, Gaiberg and Zwiefalten
// as published on 10.10.2026: the calendar page and the month data its script loads.
const fixture=name=>fs.readFileSync(new URL('./fixtures/hw-typo3/'+name,import.meta.url),'utf8');
const base='https://www.hoepfingen.de/rathaus-service/gemeinde-ortschaftsrat/ratsinformationssystem/sitzungskalender';
const source={id:'de-08225039',name:'Höpfingen',kind:'municipality',method:'scraper',adapter:'hw-typo3',base};
const now=new Date('2026-10-10T12:00:00Z');
const month=(m,y)=>`${base}?tx_hwratssystem_sitzungstermincalendar%5Baction%5D=calendar&tx_hwratssystem_sitzungstermincalendar%5Bcontroller%5D=SitzungsterminCalendarFrontend&tx_hwratssystem_sitzungstermincalendar%5Bajax%5D=true&tx_hwratssystem_sitzungstermincalendar%5Bmonth%5D=${m}&tx_hwratssystem_sitzungstermincalendar%5Byear%5D=${y}&pUid=1209&type=20230522`;

test('hw-typo3: the calendar page is recognised and names its plugin',()=>{
 const page=fixture('kalender-hoepfingen.html');
 assert.deepEqual(detectHw(base,page),{adapter:'hw-typo3',base});
 assert.equal(detectHw(base,'<html><title>Rathaus</title></html>'),null);
 assert.equal(hwPlugin(page),'1209');
 // Older pages leave the number out of the wrapper; the frame in front of it carries it.
 assert.equal(hwPlugin(fixture('kalender-gaiberg.html')),'1198');
 assert.equal(hwPlugin('<html></html>'),null);
 assert.equal(hwUrl(source,{month:9,year:2026,pUid:'1209'}),month(9,2026));
 assert.throws(()=>hwUrl({...source,base:'http://www.hoepfingen.de/x/'}),/Nicht freigegebene/);
});

test('hw-typo3 month data: meetings with their public items, files and the committee',()=>{
 const rows=parseHwMonth(fixture('monat-hoepfingen-2026-09.json'),source);
 assert.equal(rows.length,1);const m=rows[0];
 assert.equal(m.id,'100');assert.equal(m.date,'2026-09-21');assert.equal(m.time,'19:00');assert.equal(m.committee,'Gemeinderat');
 assert.match(m.url,/^https:\/\/www\.hoepfingen\.de\/rathaus-service\/gemeinde-ortschaftsrat\/ratsinformationssystem\/sitzungstermine\/100\//);
 assert.equal(m.items.length,8);
 assert.deepEqual(m.items.slice(0,2).map(i=>[i.number,i.title]),[['1','Annahme von Spenden'],['2','Kommunaler Stromlieferungvertrag']]);
 assert.ok(m.items.some(i=>i.documents.length&&i.documents.every(d=>/^https:\/\/www\.hoepfingen\.de\/index\.php\?eID=dumpFile/.test(d.url))));
 // The title names the body where the site files everything under "Ratssystem" (Zwiefalten).
 const z=parseHwMonth(fixture('monat-zwiefalten-2026-09.json'),{base:'https://www.zwiefalten.de/rathaus-service/ratsinformationssystem/kalender'});
 assert.equal(z[0].committee,'Gemeinderat');assert.ok(z[0].items.length>=5);
 // Gaiberg numbers its items in the title ("4. Honorarangebot …").
 const g=parseHwMonth(fixture('monat-gaiberg-2026-09.json'),{base:'https://www.gaiberg.de/x/'});
 assert.equal(g.length,2);assert.equal(g[0].items.length,18);assert.equal(g[1].items.length,0);
 assert.deepEqual([g[0].items[3].number,g[0].items[3].title.startsWith('Honorarangebot')],['4',true]);
 assert.equal(parseHwMonth('<html>Fehler</html>'),null);assert.equal(parseHwMonth('{"a":1}'),null);assert.deepEqual(parseHwMonth('[]'),[]);
});

test('hw-typo3 reports: formal points are left out, a past item without a resolution stays "unknown", a coming one is "consulting"',()=>{
 const g=parseHwMonth(fixture('monat-gaiberg-2026-09.json'),{base:'https://www.gaiberg.de/x/'})[0],gs={...source,id:'de-08226022',name:'Gaiberg',base:'https://www.gaiberg.de/x/'};
 const rows=hwItems(g,gs,now);
 // Of the 18 items the protocol, the notice of non-public resolutions, the citizens' hour, announcements and questions are formal.
 assert.ok(rows.length<18&&rows.length>=10);
 assert.ok(!rows.some(r=>/Bürgerfragestunde|Kenntnisnahme des Protokolls|Fragen und Anträge/.test(r.title)));
 assert.ok(rows.every(r=>r.status==='unknown'&&r.id.startsWith('de-08226022-hw-121-')));
 const coming=hwItems(g,gs,new Date('2026-09-01T00:00:00Z'));assert.ok(coming.every(r=>r.status==='consulting'));
 const decided=hwItems({...g,items:[{...g.items[3],resolution:'Der Gemeinderat beschließt einstimmig die Vergabe.'}]},gs,now);
 assert.equal(decided[0].status,'approved');assert.match(decided[0].event.result,/beschließt/);
});

test('hw-typo3 import reads the calendar page and the months of the period; each meeting once; marks are kept',async()=>{
 const asked=[];
 const get=async url=>{
  asked.push(url);
  if(url===base)return fixture('kalender-hoepfingen.html');
  if(url===month(9,2026))return fixture('monat-hoepfingen-2026-09.json');
  if(url===month(10,2026))return fixture('monat-hoepfingen-2026-10.json');
  if(url.startsWith(base+'?'))return '[]';
  throw Error('Quelle antwortet mit HTTP 404');
 };
 const result=await collectHwTypo3(source,{now,get,window:'3m'});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.coverage.issues));
 assert.equal(result.coverage.meetings,2);assert.equal(result.readMeetings,2);
 assert.ok(asked.every(u=>u===base||u.startsWith(base+'?tx_hwratssystem_sitzungstermincalendar')));
 assert.equal(new Set(asked).size,asked.length);
 // July to December: the months of the period up to two months ahead.
 assert.ok(asked.includes(month(7,2026))&&asked.includes(month(12,2026)));
 const t=result.topics.find(x=>x.id==='de-08225039-hw-101-1');
 assert.ok(t,result.topics.map(x=>x.id).join());
 assert.equal(t.regionId,source.id);assert.equal(t.committee,'Gemeinderat');assert.equal(t.status,'consulting');assert.equal(t.title,'Kommunale Wärmeplanung Höpfingen');
 assert.ok(t.documents.some(d=>d.kind==='pdf'));assert.equal(t.sourceData.method,'hw-typo3');
 const past=result.topics.find(x=>x.id==='de-08225039-hw-100-1');assert.equal(past.status,'unknown');
 const url=Object.keys(result.marks).find(u=>u.includes('/sitzungstermine/100/'));assert.ok(url);
});

test('hw-typo3 import: a page without the module and month data of another format are issues; organizations select bodies',async()=>{
 const bad=await collectHwTypo3(source,{now,get:async()=>'<html>Seite</html>',window:'3m'});
 assert.equal(bad.coverage.complete,false);assert.match(bad.coverage.issues.join(' '),/Sitzungskalender/);
 const odd=await collectHwTypo3(source,{now,get:async u=>u===base?fixture('kalender-hoepfingen.html'):'<html>Fehler</html>',window:'3m'});
 assert.equal(odd.coverage.complete,false);assert.match(odd.coverage.issues.join(' '),/Unbekanntes Format der Monatsdaten/);
 const get=async u=>u===base?fixture('kalender-hoepfingen.html'):u===month(9,2026)?fixture('monat-hoepfingen-2026-09.json'):'[]';
 const none=await collectHwTypo3({...source,organizations:{include:['Gibt es nicht']}},{now,get,window:'3m'});
 assert.equal(none.topics.length,0);assert.match((none.coverage.warnings||[]).join(' '),/anderer Gremien/);
 await assert.rejects(()=>collectHwTypo3({...source,base:'http://www.hoepfingen.de/x/'},{now,get:async u=>u,window:'3m'}).then(r=>{throw Error(r.coverage.issues.join('|'));}),/Sitzungskalender/);
});

test('hw-typo3 import: a site whose meetings carry no items (one collected file per meeting) yields no reports',async()=>{
 const empty=JSON.stringify([{title:'Gemeinderat (GR öff)',id:'sitzung_654',start:'2026-09-24 18:30',gremium:'Gemeinderat',extendedProps:{sitzungsterminUrl:'/x/sitzungstermine/654/gemeinderat-gr-oeff',tagesOrdnungsPunkte:[],tagesOrdnungsPunkteNoe:[],additionalTerminInfos:{einladungDateien:[]}}}]);
 const get=async u=>u===base?fixture('kalender-hoepfingen.html'):empty;
 const r=await collectHwTypo3(source,{now,get,window:'3m'});
 assert.equal(r.topics.length,0);assert.equal(r.coverage.meetingsWithoutItems,1);
});
