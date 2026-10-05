import test from 'node:test';
import assert from 'node:assert/strict';
import {collectRegionalOparl,organizationFilter} from '../server/integrations/oparl-regional.mjs';
// Bremen: one OParl body holds Landtag and Stadtbürgerschaft. Only the councils of the Stadtgemeinde may be read.
const root='https://sd.example/webservice/oparl/v1.1/',now=new Date('2026-09-27T12:00:00Z');
const bodyId=root+'body/1',org=n=>root+'organization/'+n;
const organizations={1:'Stadtbürgerschaft',2:'Landtag',3:'Städtische Deputation für Inneres',4:'Staatliche Deputation für Inneres',5:'Haushalts- und Finanzausschuss (Land)',6:'Haushalts- und Finanzausschuss (Stadt)',7:'Vorstand der Bremischen Bürgerschaft',9:''};
// Meeting n → its organizations; 7 has none, 8 refers to an organization that cannot be read, 9 is a joint meeting.
const plan={1:[1],2:[2],3:[3],4:[4],5:[5],6:[6],7:[],8:[8],9:[3,4],10:[7]};
const BREMEN={include:['Stadtbürgerschaft','(Stadt)','Städtische Deputation'],exclude:['(Land)','Landtag','Staatliche Deputation']};
const meeting=n=>({id:root+'meeting/'+n,type:'https://schema.oparl.org/1.1/Meeting',name:'Sitzung '+n,start:'2026-09-'+String(10+n).padStart(2,'0')+'T10:00:00+02:00',organization:plan[n].map(org),agendaItem:[root+'agendaItem/'+n]});
function server({meetings=Object.keys(plan).map(Number).map(meeting)}={}){
 const seen=[];
 const getJson=async url=>{seen.push(url);
  if(url===root+'system')return {id:url,type:'https://schema.oparl.org/1.1/System',body:root+'bodies'};
  if(url===root+'bodies')return {data:[{id:bodyId,type:'https://schema.oparl.org/1.1/Body',name:'Bremische Bürgerschaft',meeting:root+'meetings',organization:root+'organizations'}],links:{}};
  if(url.startsWith(root+'meetings'))return {data:meetings,links:{}};
  const o=url.match(/organization\/(\d+)$/);if(o){if(!(o[1] in organizations))throw Error('OParl HTTP 500');return {id:url,type:'https://schema.oparl.org/1.1/Organization',name:organizations[o[1]]};}
  const a=url.match(/agendaItem\/(\d+)$/);if(a)return {id:url,type:'https://schema.oparl.org/1.1/AgendaItem',name:'Thema '+a[1],public:true,number:'1'};
  throw Error('unexpected URL '+url);};
 return {seen,getJson};
}
const run=(organizationsField,options={})=>{const {seen,getJson}=server(options);return collectRegionalOparl({id:'de-04011000',name:'Stadt Bremen',kind:'city',system:root+'system',body:bodyId,...(organizationsField?{organizations:organizationsField}:{})},{getJson,now,window:'1m'}).then(result=>({result,seen}));};
const titles=result=>result.topics.map(t=>t.title).sort((a,b)=>a.localeCompare(b,'de',{numeric:true}));
test('only meetings of the Stadtbürgerschaft and its committees are read',async()=>{
 const {result}=await run(BREMEN);
 assert.deepEqual(titles(result),['Thema 1','Thema 3','Thema 6']);
 assert.deepEqual(result.topics.map(t=>t.committee).sort(),['Haushalts- und Finanzausschuss (Stadt)','Stadtbürgerschaft','Städtische Deputation für Inneres']);
 assert.ok(result.topics.every(t=>!/Landtag|\(Land\)|Staatliche/.test(t.committee)));
});
test('skipped and unassigned meetings are counted in coverage',async()=>{
 const {result}=await run(BREMEN);
 assert.equal(result.coverage.meetings,10);
 // Landtag, staatliche Deputation, HFA (Land), joint meeting, Vorstand (no included committee).
 assert.equal(result.coverage.filteredMeetings,5);assert.equal(result.coverage.mixedMeetings,1);
 // No organization; organization not readable.
 assert.equal(result.coverage.unassignedMeetings,2);
 assert.deepEqual(result.coverage.issues,[]);assert.equal(result.coverage.complete,true);
});
test('the agenda of a skipped meeting is never asked',async()=>{
 const {seen}=await run(BREMEN);
 const asked=seen.filter(u=>u.includes('agendaItem/')).map(u=>Number(u.split('/').pop())).sort((a,b)=>a-b);
 assert.deepEqual(asked,[1,3,6]);
 // Every organization is asked once, also when several meetings share it.
 assert.equal(seen.filter(u=>u===org(3)).length,1);
});
test('without the field the behaviour is unchanged: every meeting is read',async()=>{
 const {result}=await run(null);
 assert.equal(result.topics.length,10);
 assert.ok(!('filteredMeetings' in result.coverage)&&!('unassignedMeetings' in result.coverage));
 const committee=n=>result.topics.find(t=>t.title==='Thema '+n).committee;
 assert.equal(committee(2),'Landtag');assert.equal(committee(7),'Sitzung 7');assert.equal(committee(8),'Gremium laut Originalquelle');
});
test('exclude alone keeps every named committee that is not excluded',async()=>{
 const {result}=await run({exclude:['Landtag','(Land)','Staatliche Deputation']});
 assert.deepEqual(titles(result),['Thema 1','Thema 3','Thema 6','Thema 10']);
 assert.equal(result.coverage.filteredMeetings,4);assert.equal(result.coverage.mixedMeetings,1);assert.equal(result.coverage.unassignedMeetings,2);
});
test('patterns ignore case and umlaut spelling; full addresses select single organizations',async()=>{
 const {result}=await run({include:['STAEDTISCHE deputation','stadtbuergerschaft']});
 // The joint meeting (9) holds the staatliche Deputation, which is not included but not excluded either: without
 // exclude patterns it is read. Bremen therefore needs both lists.
 assert.deepEqual(titles(result),['Thema 1','Thema 3','Thema 9']);assert.equal(result.coverage.mixedMeetings,undefined);
 const byId=await run({include:[org(6).replace('https:','http:')]});
 assert.deepEqual(titles(byId.result),['Thema 6']);
});
test('an organization without a name counts only when its address is named',async()=>{
 const meetings=[{...meeting(1),organization:[org(9)]}];
 const unnamed=await run(BREMEN,{meetings});
 assert.equal(unnamed.result.topics.length,0);assert.equal(unnamed.result.coverage.unassignedMeetings,1);
 const named=await run({include:[org(9)]},{meetings});
 assert.equal(named.result.topics.length,1);assert.equal(named.result.topics[0].committee,'Gremium laut Originalquelle');
});
test('embedded organization objects and short names are matched as well',async()=>{
 const meetings=[{...meeting(1),organization:[{id:org(21),name:'',shortName:'Stadtbürgerschaft'}]},{...meeting(2),organization:[{id:org(22),name:'Bremische Bürgerschaft (Landtag)'}]},{...meeting(3),organization:org(1)}];
 const {result,seen}=await run(BREMEN,{meetings});
 assert.deepEqual(titles(result),['Thema 1','Thema 3']);assert.equal(result.topics.find(t=>t.title==='Thema 1').committee,'Stadtbürgerschaft');
 assert.equal(result.coverage.filteredMeetings,1);assert.ok(!seen.includes(org(21))&&!seen.includes(org(22)));
});
test('skipped meetings get no mark, so a changed filter reads them at the next import',async()=>{
 const {result}=await run(BREMEN);
 assert.deepEqual(Object.keys(result.marks).map(u=>Number(u.split('/').pop())).sort((a,b)=>a-b),[1,3,6]);
 assert.equal(result.readMeetings,3);
});
test('the filter decides kept, filtered, mixed and unassigned',()=>{
 const f=organizationFilter(BREMEN),o=(name,id='')=>({id,name,shortName:''});
 assert.equal(f([o('Städtische Deputation für Sport')]),'kept');
 assert.equal(f([o('Staatliche Deputation für Sport')]),'filtered');
 assert.equal(f([o('Ausschuss für Angelegenheiten der Häfen im Lande Bremen')]),'filtered');
 assert.equal(f([o('Städtische Deputation für Sport'),o('Staatliche Deputation für Sport')]),'mixed');
 // Included and excluded at once: excluded wins.
 assert.equal(f([o('Städtische Deputation (Land)')]),'filtered');
 assert.equal(f([]),'unassigned');assert.equal(f([o('Stadtbürgerschaft'),o('',org(99))]),'unassigned');
});
test('a malformed field is refused before any request',async()=>{
 for(const bad of [{},[],'Stadtbürgerschaft',{include:'Stadtbürgerschaft'},{include:[1]},{include:['  ']},{exclude:[]}])assert.throws(()=>organizationFilter(bad),/Gremienfilter/);
 const {seen,getJson}=server();
 await assert.rejects(collectRegionalOparl({id:'de-04011000',name:'Stadt Bremen',kind:'city',system:root+'system',body:bodyId,organizations:{include:[]}},{getJson,now,window:'1m'}),/Gremienfilter/);
 assert.equal(seen.length,0);
});
