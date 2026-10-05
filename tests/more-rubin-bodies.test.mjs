import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {collectRubin,mapRubinMeeting,rubinBodyMatch,rubinMeetingUrl,readRubinBodies,embeddedMeeting,detectRubin} from '../server/integrations/more-rubin.mjs';
import {CATALOG} from '../shared/catalog.mjs';
// Excerpts of public answers saved on 2026-10-04 (bodies lists, calendars, meetings shortened to a few agenda items).
const fixture=name=>fs.readFileSync(new URL('./fixtures/rubin-fixes/'+name,import.meta.url),'utf8');
const json=name=>JSON.parse(fixture(name));
const bodies=json('bodies.json'),area=id=>CATALOG.find(r=>r.id===id);
const now=new Date('2026-10-04T12:00:00Z');
const source=(id,host,extra={})=>({id,name:area(id).name,kind:area(id).kind,method:'official-api',adapter:'more-rubin',base:`https://${host}/`,...extra});
const NOT_FOUND=()=>{throw Error('Quelle antwortet mit HTTP 404');};
/** Fake get: the first rule whose pattern matches the address answers; every address is recorded. */
const server=rules=>{const calls=[];const get=async url=>{calls.push(url);const rule=rules.find(([pattern])=>pattern.test(url));if(!rule)throw Error('unexpected request '+url);const answer=typeof rule[1]==='function'?rule[1](url):rule[1];return typeof answer==='string'?answer:JSON.stringify(answer);};return {get,calls};};
const meetingId=url=>new URL(url).searchParams.get('meeting_id');

test('rubinBodyMatch: a body belongs to an area only if its core name equals the area or one of its members',()=>{
 assert.deepEqual(rubinBodyMatch(bodies['lauenburg.gremien.info'],area('de-01053083')),['Stadt'],'Stadt Lauenburg/Elbe takes only the town');
 const amt=rubinBodyMatch(bodies['lauenburg.gremien.info'],area('de-010535343'));
 assert.equal(amt.length,11);assert.ok(amt.includes('Amt')&&amt.includes('Lanze')&&!amt.includes('Stadt'),'Amt Lütau: the Amt and its ten Gemeinden, not the town');
 assert.deepEqual(rubinBodyMatch(bodies['voerstetten.gremien.info'],area('de-08316045')),['GDVoe'],'not Denzlingen, Reute or the Verwaltungsverband');
 const npl=rubinBodyMatch(bodies['rockenhausen.gremien.info'],area('de-073335007'));
 for(const id of ['VGNPL','stadtrok','OG054','OG17','OG050','OG053'])assert.ok(npl.includes(id),id);
 assert.ok(!npl.includes('KitaZeckVe'));assert.equal(npl.length,37,'"St. Alban" is "Sankt Alban", "Niederhausen/Appel" is "Niederhausen an der Appel"');
 const rn=rubinBodyMatch(bodies['vgrn.gremien.info'],area('de-073395001'));
 assert.ok(rn.includes('VGRN')&&rn.includes('WLR')&&rn.includes('WAGen')&&rn.includes('BAST')&&!rn.includes('RegiMed'),'"Weiler" is "Weiler bei Bingen"; an Ortsteil belongs to its municipality');
 assert.deepEqual(rubinBodyMatch(bodies['amt-sylt.gremien.info'],area('de-010545439')),['ALS','Gem-Hoe','Gem-Ka','Gem-Li','Gem-We-Bra']);
 assert.deepEqual(rubinBodyMatch(bodies['westerland.gremien.info'],area('de-01054168')),['SYLT']);
 assert.deepEqual(rubinBodyMatch(bodies['ris-dommitzsch.zv-kisa.de'],area('de-147305303')),['SV']);
 const vgw=rubinBodyMatch(bodies['vg-wittlich.gremien.info'],area('de-072315008'));
 assert.equal(vgw.length,46);assert.ok(vgw.includes('VG')&&vgw.includes('35')&&!vgw.some(id=>/^FZV|ZKGH/.test(id)));
 // Equality, not containment.
 const wittlich=[{id:'SW',name:'Stadt Wittlich Der Bürgermeister'},{id:'VG',name:'Verbandsgemeinde Wittlich-Land'}];
 assert.deepEqual(rubinBodyMatch(wittlich,area('de-072315008')),['VG']);assert.deepEqual(rubinBodyMatch(wittlich,area('de-07231134')),['SW']);
 assert.ok(!rubinBodyMatch(bodies['vg-aar-einrich.gremien.info'],area('de-071415011')).includes('OGMud'),'"Muderhausen" is not the member "Mudershausen"');
 // District bodies belong to districts, municipal ones to municipal areas.
 assert.deepEqual(rubinBodyMatch(bodies['ratsinfo.landratsamt-nordhausen.de'],area('de-16062')),['LRA']);
 assert.deepEqual(rubinBodyMatch(bodies['ratsinfo.landratsamt-nordhausen.de'],area('de-16062041')),[]);
 assert.deepEqual(rubinBodyMatch([{id:'LK',name:'Landkreis Leipzig'}],area('de-14713000')),[]);
 assert.deepEqual(rubinBodyMatch(null,area('de-16062')),[]);
});

test('rubinBodyMatch compares the kind: a town and the association of the same name are two bodies',()=>{
 // One installation for both: the town is not a member of the Verbandsgemeinde Bad Kreuznach.
 const kreuznach=[{id:'VG',name:'Verbandsgemeinde Bad Kreuznach'},{id:'ST',name:'Stadt Bad Kreuznach Der Oberbürgermeister'}];
 assert.deepEqual(rubinBodyMatch(kreuznach,area('de-07133006')),['ST']);assert.deepEqual(rubinBodyMatch(kreuznach,area('de-071335001')),['VG']);
 // Every town/association pair of the catalog that shares a name and a district.
 for(const v of CATALOG.filter(a=>a.members?.length&&a.municipalityType!=='Erfüllende Gemeinde')){
  const t=CATALOG.find(a=>!a.members&&a.kind==='city'&&a.shortName===v.shortName&&a.district===v.district);if(!t)continue;
  const list=[{id:'A',name:v.name},{id:'T',name:t.name+' Der Bürgermeister'}],member=v.members.some(m=>m.name===t.shortName);
  assert.deepEqual(rubinBodyMatch(list,t),['T'],t.name);assert.deepEqual(rubinBodyMatch(list,v),member?['A','T']:['A'],v.name);
 }
 // An association of another type is another body: the Hunsrück Verbandsgemeinde is not the Saxon Verwaltungsgemeinschaft,
 // and its "Ortsgemeinde Hirschfeld" and "Stadt Kirchberg" are not the Saxon members of the same names.
 assert.deepEqual(rubinBodyMatch(bodies['ris.kirchberg-hunsrueck.de'],area('de-145245111')),[]);
 // Without a kind the body cannot be told apart; a name ending in "kreis" is a district.
 assert.deepEqual(rubinBodyMatch([{id:'X',name:'Bad Kreuznach'}],area('de-07133006')),[]);assert.deepEqual(rubinBodyMatch([{id:'X',name:'Bad Kreuznach'}],area('de-071335001')),[]);
 assert.deepEqual(rubinBodyMatch([{id:'RHK',name:'Rhein-Hunsrück-Kreis'}],area('de-07140')),['RHK']);assert.deepEqual(rubinBodyMatch([{id:'RHK',name:'Rhein-Hunsrück-Kreis'}],area('de-071405004')),[]);
 assert.deepEqual(rubinBodyMatch([{id:'RH',name:'Region Hannover'}],area('nds-03241')),['RH']);
});

test('rubinBodyMatch: two different additions are two places; a missing addition counts only next to an exact match',()=>{
 assert.deepEqual(rubinBodyMatch([{id:'N',name:'Stadt Neustadt an der Aisch'}],area('de-09473151')),[],'not Neustadt b.Coburg');
 assert.deepEqual(rubinBodyMatch([{id:'H',name:'Stadt Halle (Westf.)'}],area('de-15002000')),[],'not Halle (Saale)');
 assert.deepEqual(rubinBodyMatch([{id:'F',name:'Stadt Frankfurt (Oder)'}],area('de-06412000')),[],'not Frankfurt am Main');
 // "Oberhausen/Appel" is neither the member "Oberhausen an der Nahe" of the VG Rüdesheim nor the town Oberhausen.
 assert.deepEqual(rubinBodyMatch([{id:'VG',name:'Verbandsgemeinde Rüdesheim'},{id:'OA',name:'Ortsgemeinde Oberhausen/Appel'},{id:'W',name:'Ortsgemeinde Weinsheim'}],area('de-071335006')),['VG','W']);
 assert.deepEqual(rubinBodyMatch(bodies['rockenhausen.gremien.info'],area('nrw-05119000')),[]);
 // "Stadt Kirchberg" of the Hunsrück is no proof for Kirchberg an der Jagst; inside its own Verbandsgemeinde
 // "Kirchberg (Hunsrück)" the Ortsgemeinden match exactly, so the town, the VG and "Hirschfeld (Hunsrück)" count too.
 assert.deepEqual(rubinBodyMatch(bodies['ris.kirchberg-hunsrueck.de'],area('de-08127046')),[]);
 const kirchberg=rubinBodyMatch(bodies['ris.kirchberg-hunsrueck.de'],area('de-071405004'));
 assert.equal(kirchberg.length,41);assert.ok(['41','15','13','01','40'].every(id=>kirchberg.includes(id))&&!kirchberg.some(id=>/^4[2-7]/.test(id)));
});

test('rubinBodyMatch: a member name alone is no proof; an Ortsgemeinde is never a town of its own',()=>{
 // "Ortsgemeinde Roth" of the Verbandsgemeinde Aar-Einrich is not the Bavarian Stadt Roth.
 assert.deepEqual(rubinBodyMatch(bodies['vg-aar-einrich.gremien.info'],area('de-09576143')),[]);
 // "Gemeinde Basedow" next to "Amt Lütau" is not the member Basedow of the Amt Malchin am Kummerower See.
 assert.deepEqual(rubinBodyMatch(bodies['lauenburg.gremien.info'],area('de-130715153')),[]);
 // "Ortsgemeinde Weiler" next to the Verbandsgemeindeverwaltung Rhein-Nahe is not the member Weiler of the VG Ulmen.
 assert.deepEqual(rubinBodyMatch(bodies['vgrn.gremien.info'],area('de-071355003')),[]);
 // Without any association body the seat's own body counts; a list naming another association, or only another member, does not.
 const dommitzsch=area('de-147305303');
 assert.deepEqual(rubinBodyMatch([{id:'SV',name:'Stadtverwaltung Dommitzsch'},{id:'E',name:'Gemeinde Elsnig'}],dommitzsch),['SV','E']);
 assert.deepEqual(rubinBodyMatch([{id:'SV',name:'Stadtverwaltung Dommitzsch'},{id:'A',name:'Amt Lütau'}],dommitzsch),[]);
 assert.deepEqual(rubinBodyMatch([{id:'E',name:'Gemeinde Elsnig'}],dommitzsch),[]);
 // Every saved list against every area of the catalog: only the areas the installation serves. The Vörstetten
 // installation also serves Denzlingen and Reute.
 const served={'amt-sylt.gremien.info':['de-010545439'],'ratsinfo.landratsamt-nordhausen.de':['de-16062'],'ris-dommitzsch.zv-kisa.de':['de-147305303'],
  'ris.kirchberg-hunsrueck.de':['de-071405004'],'rockenhausen.gremien.info':['de-073335007'],'vg-aar-einrich.gremien.info':['de-071415011'],
  'vg-wittlich.gremien.info':['de-072315008'],'vgrn.gremien.info':['de-073395001'],'westerland.gremien.info':['de-01054168'],
  'lauenburg.gremien.info':['de-01053083','de-010535343'],'voerstetten.gremien.info':['de-08316009','de-08316036','de-08316045'],'ris.dahme-spreewald.de':['de-12061']};
 assert.deepEqual(Object.keys(bodies).sort(),Object.keys(served).sort());
 for(const [host,list] of Object.entries(bodies))assert.deepEqual(CATALOG.filter(a=>rubinBodyMatch(list,a).length).map(a=>a.id).sort(),served[host].sort(),host);
});

test('readRubinBodies returns the list or throws: a failed or empty answer is never one body',async()=>{
 const ok=server([[/api\.php\?.*action=bodies/,bodies['voerstetten.gremien.info']]]);
 assert.equal((await readRubinBodies(source('de-08316045','voerstetten.gremien.info'),{get:ok.get})).length,6);
 // Older installations: api.php is missing, the mobile web service answers.
 const old=server([[/\/api\.php/,NOT_FOUND],[/webservice-mobile\/webservice\.php\?json=true&system=ris&platform=ris&id=organizations&action=bodies/,bodies['ris.dahme-spreewald.de']]]);
 assert.deepEqual(await readRubinBodies(source('de-12061','ris.dahme-spreewald.de'),{get:old.get}),[{id:'LDS',name:'Landkreis Dahme-Spreewald'}]);
 for(const answer of [[],[{ErrorCode:101}],{bodies:[]},'<html>Ratsinfosystem</html>'])
  await assert.rejects(readRubinBodies(source('de-08316045','voerstetten.gremien.info'),{get:server([[/./,answer]]).get}),/Körperschaftsliste/);
 await assert.rejects(readRubinBodies(source('de-08316045','voerstetten.gremien.info'),{get:async()=>{throw Error('Quelle antwortet mit HTTP 500');}}),/HTTP 500/);
});

test('rubinMeetingUrl keeps the meeting on the approved source; another host name needs a body filter',()=>{
 const zwenkau=source('de-14729430','ris-zwenkau.zv-kisa.de'),[sr]=json('zwenkau.json').calendar.meetings.filter(m=>m.nummer==='2026-SR-103');
 assert.equal(sr.full_url,'http:///ris-zwenkau.zv-kisa.de/meeting?id=2026-SR-103');
 assert.equal(rubinMeetingUrl(sr,zwenkau),'https://ris-zwenkau.zv-kisa.de/meeting?id=2026-SR-103');
 const [ka]=json('lkl-calendar.json').meetings.filter(m=>m.nummer==='ni_2026-KA-108');
 assert.equal(rubinMeetingUrl(ka,source('de-14729','www.lk-l.info')),'https://www.lk-l.info/meeting.php?id=ni_2026-KA-108');
 const [voe]=json('voerstetten.json').calendar.meetings.filter(m=>m.nummer==='2026-GRVoe-106');
 assert.equal(rubinMeetingUrl(voe,source('de-08316045','voerstetten.gremien.info',{bodies:['GDVoe']})),'https://voerstetten.gremien.info/meeting?id=2026-GRVoe-106');
 assert.throws(()=>rubinMeetingUrl(voe,source('de-08316045','voerstetten.gremien.info')),/anderem Host \(denzlingen\.gremien\.info\)/);
 const lauenburg=source('de-01053083','lauenburg.gremien.info');
 assert.equal(rubinMeetingUrl({full_url:'https://lauenburg.gremien.info/meeting?id=2026-ST-124'},lauenburg),'https://lauenburg.gremien.info/meeting?id=2026-ST-124');
 assert.equal(rubinMeetingUrl({nummer:'2026-ST-124'},lauenburg),'https://lauenburg.gremien.info/meeting?id=2026-ST-124');
 assert.throws(()=>rubinMeetingUrl({full_url:'https://elsewhere.example/sitzung/1'},lauenburg),/Nicht freigegebene/);
 // A session parameter in the path does not become part of the meeting address.
 assert.equal(rubinMeetingUrl({full_url:'https://lauenburg.gremien.info/meeting;jsessionid=8F3A?id=2026-ST-124'},lauenburg),'https://lauenburg.gremien.info/meeting?id=2026-ST-124');
 assert.equal(rubinMeetingUrl({full_url:'http://www.lk-l.info/meeting.php;jsessionid=8F3A?id=ni_2026-KA-108'},source('de-14729','www.lk-l.info')),'https://www.lk-l.info/meeting.php?id=ni_2026-KA-108');
});

test('one body: the calendar is asked for it, and a meeting of another body is still not taken',async()=>{
 const voe=json('voerstetten.json'),own=voe.calendar.meetings.find(m=>m.nummer==='2026-GRVoe-106'),detail=voe.meetings['2026-GRVoe-106'];
 // As if the server ignored the filter: a Denzlingen meeting in the answer.
 const foreign={...own,nummer:'2026-GRDe-50',gremium_1:'GRDe',datum:'2026-09-21',full_url:'https://denzlingen.gremien.info/meeting?id=2026-GRDe-50'};
 const rules=[[/id=calendar/,{...voe.calendar,meetings:[own,foreign]}],[/id=meetings/,url=>meetingId(url)==='2026-GRDe-50'?{...detail,nummer:'2026-GRDe-50',committees:[{id:'GRDe',name:'Gemeinderat Denzlingen',Koerperschaftsnummer:'GD'}]}:detail]];
 const s=source('de-08316045','voerstetten.gremien.info',{bodies:['GDVoe']}),{get,calls}=server(rules);
 const d=await collectRubin(s,{now,get,window:'1m'});
 assert.match(calls[0],/^https:\/\/voerstetten\.gremien\.info\/api\.php\?json=true&id=calendar&action=get&from=2026-09&to=2026-11&view=list&body_id=GDVoe$/);
 assert.equal(d.coverage.meetings,1);assert.equal(d.coverage.otherBodyMeetings,1);assert.deepEqual(d.coverage.seenBodies,['GD','GDVoe']);
 assert.deepEqual(d.topics.map(t=>t.id).sort(),['de-08316045-top-6367','de-08316045-vo-202633108100066','de-08316045-vo-202633108100067']);
 assert.ok(d.topics.every(t=>t.committee==='Gemeinderat Vörstetten'&&t.sourceUrl==='https://voerstetten.gremien.info/meeting?id=2026-GRVoe-106'));
 assert.ok(d.topics.every(t=>t.documents.every(x=>x.url.startsWith('https://voerstetten.gremien.info/'))));
 assert.equal(d.coverage.complete,true);assert.deepEqual(d.coverage.issues,[]);
 // Read a moment ago: the next step asks only for the calendar.
 const again=server(rules),stock=new Set(d.topics.flatMap(t=>t.events.map(e=>e.url)));
 const next=await collectRubin(s,{now:new Date(now.getTime()+3600000),get:again.get,window:'1m',marks:{known:d.marks,stock}});
 assert.equal(again.calls.filter(u=>/id=meetings/.test(u)).length,1,'only the foreign meeting is asked again');assert.equal(next.coverage.unchangedMeetings,1);assert.equal(next.coverage.complete,true);
 // Without the body filter the shared installation shows itself by the other host name, and nothing is taken.
 const open=await collectRubin(source('de-08316045','voerstetten.gremien.info'),{now,get:server(rules).get,window:'1m'});
 assert.equal(open.topics.length,0);assert.match(open.coverage.issues[0],/anderem Host/);assert.equal(open.coverage.complete,false);
});

test('body filter: a meeting without a body number, or body numbers never named, is reported instead of a quiet area',async()=>{
 const voe=json('voerstetten.json'),own=voe.calendar.meetings.find(m=>m.nummer==='2026-GRVoe-106'),detail=voe.meetings['2026-GRVoe-106'];
 const calendar={...voe.calendar,meetings:[own]},s=source('de-08316045','voerstetten.gremien.info',{bodies:['GDVoe']});
 // The installation does not name the body of its committees: nothing is taken, and the gap is an issue.
 const unnamed={...detail,committees:detail.committees.map(({Koerperschaftsnummer,...c})=>c)};
 const d=await collectRubin(s,{now,get:server([[/id=calendar/,calendar],[/id=meetings/,unnamed]]).get,window:'1m'});
 assert.equal(d.topics.length,0);assert.equal(d.coverage.unknownBodyMeetings,1);assert.equal(d.coverage.meetings,0);
 assert.match(d.coverage.issues[0],/Körperschaft der Sitzungen unbekannt: 1 Sitzung/);assert.equal(d.coverage.quiet,false);assert.equal(d.coverage.complete,false);
 // A body number the installation never names (wrong or outdated entry): only meetings of other bodies come back.
 const wrong=await collectRubin({...s,bodies:['Voe']},{now,get:server([[/id=calendar/,calendar],[/id=meetings/,detail]]).get,window:'1m'});
 assert.equal(wrong.topics.length,0);assert.equal(wrong.coverage.otherBodyMeetings,1);
 assert.match(wrong.coverage.issues[0],/Körperschaft der Quelle \(Voe\) in keiner Sitzung genannt; gelesene Sitzungen gehören zu GDVoe/);assert.equal(wrong.coverage.quiet,false);
 // No meeting in the window at all is still quiet.
 const none=await collectRubin(s,{now,get:server([[/id=calendar/,{...voe.calendar,meetings:[]}]]).get,window:'1m'});
 assert.equal(none.coverage.quiet,true);assert.deepEqual(none.coverage.issues,[]);
});

test('several bodies: one calendar, meetings of other bodies are dropped and their committees are not asked again',async()=>{
 const l=json('lauenburg.json'),cal=l.calendarAll.meetings,st=cal.find(m=>m.nummer==='2026-ST-124');
 const later=(n,datum)=>({...st,nummer:n,datum,full_url:'https://lauenburg.gremien.info/meeting?id='+n});
 const calendar={...l.calendarAll,meetings:[...cal,later('2026-ST-126','2026-10-15'),later('2026-ST-127','2026-10-20')]};
 const detail=id=>id==='2026-GV3-77'?l.meetings[id]:id==='2026-HA-194'?{...l.meetings['2026-ST-124'],nummer:id,committees:[{id:'HA',Kuerzel:'HA',name:'Hauptausschuss',Koerperschaftsnummer:'Stadt'}]}:{...l.meetings['2026-ST-124'],nummer:id};
 const s=source('de-010535343','lauenburg.gremien.info',{bodies:rubinBodyMatch(bodies['lauenburg.gremien.info'],area('de-010535343'))});
 const {get,calls}=server([[/id=calendar/,calendar],[/id=meetings/,url=>detail(meetingId(url))]]);
 const d=await collectRubin(s,{now,get,window:'1m'});
 assert.match(calls[0],/body_id=$/);
 // Before the window (Lanze, 01.09.) and cancelled ("Abgesagt - …") are not asked; the third town council meeting neither.
 assert.deepEqual(calls.slice(1).map(meetingId),['2026-ST-127','2026-ST-126','2026-HA-194','2026-GV3-77']);
 assert.equal(d.coverage.otherBodyMeetings,4);assert.equal(d.coverage.meetings,1);
 assert.ok(d.topics.every(t=>t.committee==='Gemeindevertretung Buchhorst'));
 // "1" is the opening item of every meeting, not a paper number.
 assert.deepEqual(d.topics.map(t=>t.id).sort(),['de-010535343-top-26852','de-010535343-vo-20261009100251','de-010535343-vo-20261009100255']);
 assert.deepEqual(d.topics.find(t=>t.id==='de-010535343-top-26852').identityRecords.map(r=>r.kind),['agenda']);
});

test('older installation without api.php: calendar from the mobile web service, agenda from the meeting page',async()=>{
 const s=source('de-14521170','ris.eibenstock.de');
 const {get,calls}=server([[/\/api\.php/,NOT_FOUND],[/webservice-mobile\/webservice\.php\?json=true&system=ris&platform=ris&id=calendar/,fixture('eibenstock-calendar.json')],[/meeting\.php\?id=ni_2026-STR-240$/,fixture('eibenstock-meeting.html')],[/meeting\.php\?id=2026-HA-174$/,'<html><body>Wartungsarbeiten</body></html>']]);
 const d=await collectRubin(s,{now,get,window:'1m'});
 assert.deepEqual(calls.map(u=>u.replace(/\?.*/,'')),['https://ris.eibenstock.de/api.php','https://ris.eibenstock.de/webservice-mobile/webservice.php','https://ris.eibenstock.de/meeting.php','https://ris.eibenstock.de/meeting.php']);
 assert.equal(d.coverage.endpoint,'webservice');assert.deepEqual(d.coverage.seenBodies,['SVE']);
 // Item ids of this interface name the meeting; "ni_" (minutes published) is left out so the id stays the same.
 assert.deepEqual(d.topics.map(t=>t.id).sort(),['de-14521170-top-2026-STR-240-zt_0-1','de-14521170-vo-660906100038','de-14521170-vo-662008100058']);
 const statute=d.topics.find(t=>t.id==='de-14521170-vo-660906100038');
 assert.equal(statute.reference,'039/26');assert.equal(statute.committee,'Stadtrat');assert.equal(statute.sourceUrl,'https://ris.eibenstock.de/meeting.php?id=ni_2026-STR-240');
 assert.ok(statute.documents.some(x=>/documents\.php\?document_type_id=4&submission_id=660906100038/.test(x.url)));
 // A past meeting whose page shows no agenda is a gap.
 assert.deepEqual(d.coverage.issues,['https://ris.eibenstock.de/meeting.php?id=2026-HA-174: Keine öffentliche Tagesordnung verfügbar']);assert.equal(d.coverage.complete,false);
 // An entry that already names the web service does not ask api.php first.
 const direct=server([[/webservice-mobile\/.*id=calendar/,fixture('eibenstock-calendar.json')],[/meeting\.php/,fixture('eibenstock-meeting.html')]]);
 await collectRubin({...s,endpoint:'webservice'},{now,get:direct.get,window:'1m'});assert.ok(!direct.calls.some(u=>/api\.php/.test(u)));
});

test('embedded meeting: strings with braces and quotes, string flags, and only public items',()=>{
 const meeting={nummer:'2026-X-1',datum:'2026-09-30',is_draft:'0',fraktionssitzung:'0',full_url:'https://ris.example.test/meeting.php?id=2026-X-1',committees:[{id:'KT',name:'Kreistag',Koerperschaftsnummer:'LK'}],agenda_items:[{id:'2026-X-1|7|1',vorlagennummer:'7',topart:'at',status:'1',is_draft:'0',title:'Bericht {Teil "A"}',abstimmungstext:'einstimmig beschlossen'},{id:'2026-X-1|8|1',vorlagennummer:'8',topart:'at',status:'2',title:'Vertragsangelegenheit'}]};
 const html=`<html><script>window.components["MeetingPage__abc"] = {\n props: ${JSON.stringify({'passed-meeting':meeting}).replace(/\//g,'\\/')},\n store: [],\n};</script></html>`;
 assert.deepEqual(embeddedMeeting(html),meeting);assert.equal(embeddedMeeting('<html></html>'),null);
 const s={id:'district',name:'Landkreis Beispiel',kind:'district',base:'https://ris.example.test/'};
 const items=mapRubinMeeting(embeddedMeeting(html),s,now);
 assert.equal(items.length,1);assert.equal(items[0].title,'Bericht {Teil "A"}');assert.equal(items[0].status,'approved');assert.equal(items[0].id,'district-top-2026-X-1-7-1');
 // The component written as JSON, with a quoted props key.
 assert.deepEqual(embeddedMeeting(`<script>window.components["MeetingPage__a"]={"props":${JSON.stringify({'passed-meeting':meeting})}}</script>`),meeting);
 // Only the MeetingPage component is read: props of a later component are not its meeting.
 assert.equal(embeddedMeeting(`<script>window.components["MeetingPage__a"]={store:[]};window.components["OtherPage__b"]={props:${JSON.stringify({'passed-meeting':meeting})}};</script>`),null);
 // Items and documents without the public status are left out, whatever else they say.
 const mixed={...meeting,agenda_items:[{...meeting.agenda_items[0],status:undefined},{...meeting.agenda_items[0],id:'2026-X-1|9|1',status:3,title:'Grundstücksangelegenheit (nichtöffentlich)'},
  {...meeting.agenda_items[0],id:'2026-X-1|10|1',documents:[{documentName:'Vorlage',documentUrl:'https://ris.example.test/documents.php?id=1',documentPublicStatusId:'1'},{documentName:'Anlage vertraulich',documentUrl:'https://ris.example.test/documents.php?id=2',documentPublicStatusId:2},{documentName:'Anlage',documentUrl:'https://ris.example.test/documents.php?id=3'}]}]};
 const [only,...rest]=mapRubinMeeting(mixed,s,now);
 assert.equal(rest.length,0);assert.equal(only.id,'district-top-2026-X-1-10-1');assert.deepEqual(only.documents.map(x=>x.title),['Vorlage','Öffentliche Sitzung']);
});

test('detectRubin recognises the hosting, the older pages and the empty single-page shell, not a page that links to one',()=>{
 assert.deepEqual(detectRubin('https://lauenburg.gremien.info/meeting?id=2026-ST-124'),{adapter:'more-rubin',method:'official-api',base:'https://lauenburg.gremien.info/',endpoint:'api',evidence:'host'});
 assert.equal(detectRubin('http://ris-zwenkau.zv-kisa.de/').base,'https://ris-zwenkau.zv-kisa.de/');
 assert.deepEqual(detectRubin('https://ris.villingen-schwenningen.de/',fixture('spa-start.html')),{adapter:'more-rubin',method:'official-api',base:'https://ris.villingen-schwenningen.de/',endpoint:'api',evidence:'shell'});
 assert.deepEqual(detectRubin('https://ris.eibenstock.de/meeting.php?id=ni_2026-STR-240',fixture('eibenstock-meeting.html')),{adapter:'more-rubin',method:'official-api',base:'https://ris.eibenstock.de/',endpoint:'webservice',evidence:'markup'});
 assert.equal(detectRubin('https://ris.dahme-spreewald.de/index.php','<meta name="author" content="more! software"><script src="includes/js/dist/main.1.js"></script>').base,'https://ris.dahme-spreewald.de/');
 assert.equal(detectRubin('https://www.stadt.example/rathaus/','<a href="https://stadt.gremien.info/">Ratsinformationssystem (more! rubin)</a>'),null);
 assert.equal(detectRubin('https://www.stadt.example/','<title>Ratsinfosystem</title><div id="app"></div>'),null);
 // The vendor's own website is not the system of an area.
 assert.equal(detectRubin('https://gremien.info/'),null);assert.equal(detectRubin('https://www.gremien.info/referenzen'),null);
 assert.equal(detectRubin('https://ris.amt.gremien.info/').base,'https://ris.amt.gremien.info/');
 assert.equal(detectRubin('not a url'),null);
});

test('rubinBodyMatch: the "Nationalparkverbandsgemeinde" Herrstein-Rhaunen is the Verbandsgemeinde, its Ortsgemeinden belong to it',()=>{
 /* Nachgebildet im Aufbau der Körperschaftsliste von herrstein-rhaunen.gremien.info (Namen wie im System, Kennungen erfunden) */
 const vg=area('de-071345005'),list=[{id:'NLPVG',name:'Nationalparkverbandsgemeinde Herrstein-Rhaunen'},...vg.members.slice(0,3).map((m,i)=>({id:'OG'+i,name:'Ortsgemeinde '+m.name})),{id:'ZV',name:'Zweckverband Wasserversorgung Hunsrück'}];
 assert.deepEqual(rubinBodyMatch(list,vg),['NLPVG','OG0','OG1','OG2']);
 /* Ohne die eigene Verbandsgemeinde bleibt es bei der bisherigen Regel: nichts zuordnen */
 assert.deepEqual(rubinBodyMatch(list.filter(b=>b.id!=='NLPVG').concat([{id:'VGX',name:'Verbandsgemeinde Kirner Land'}]),vg),[]);
});
