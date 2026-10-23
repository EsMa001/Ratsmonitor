import test from 'node:test';
import assert from 'node:assert/strict';
import {collectRegionalOparl} from '../server/integrations/oparl-regional.mjs';
// ALLRIS 4 at sitzung-online.de (OParl since 2026): every object carries the placeholder date 2000-01-01, meetings list no
// agenda, the body keeps one list of all agenda items (each naming its meeting, with an explicit public flag; non-public
// items only as "(nichtöffentlich)", public:false). Nachgebildet nach den Antworten von www.wadern.sitzung-online.de.
const root='https://www.beispielstadt.sitzung-online.de/oparl/',now=new Date('2026-10-06T12:00:00Z');
const placeholder={created:'2000-01-01T00:00:00+01:00',modified:'2000-01-01T00:00:00+01:00'};
const meeting=(n,day)=>({id:root+'meetings/'+n,type:'https://schema.oparl.org/1.1/Meeting',name:'Sitzung des Stadtrates der Stadt Beispielstadt',start:`2026-${day}T18:00:00+02:00`,...placeholder});
const MEETINGS=[meeting(10,'01-20'),meeting(20,'08-18'),meeting(21,'09-15')];
const item=(id,m,name,pub)=>({id:root+'agendaItems/'+id,type:'https://schema.oparl.org/1.1/AgendaItem',meeting:root+'meetings/'+m,number:String(id%10),order:id,name,public:pub,...placeholder});
// Pages of the body's agenda list, oldest record first; the newest page also holds a late item of an old meeting.
const PAGES={1:[item(101,10,'Haushalt 2026',true),item(102,10,'(nichtöffentlich)',false)],2:[item(201,20,'Radweg Hauptstraße',true),item(202,20,'(nichtöffentlich)',false),item(203,21,'Neubau Kita',true)],3:[item(301,10,'Genehmigung des Protokolls',true)]};
function server(){
 const seen=[];
 const getJson=async url=>{seen.push(url);const u=new URL(url);
  if(url===root+'system')return {id:url,type:'https://schema.oparl.org/1.1/System',body:root+'bodies',...placeholder};
  if(u.pathname.endsWith('/oparl/bodies'))return {data:[{id:root+'bodies/1',type:'https://schema.oparl.org/1.1/Body',name:'Stadt Beispielstadt',meeting:root+'bodies/1/meetings',agendaItem:root+'bodies/1/agendaItems',...placeholder}],links:{}};
  if(u.pathname.endsWith('/bodies/1/meetings')){if(u.searchParams.has('modified_since'))throw Error('modified_since asked');return {data:MEETINGS,links:{}};}
  if(u.pathname.endsWith('/bodies/1/agendaItems')){const page=Number(u.searchParams.get('page')||1),last=root+'bodies/1/agendaItems?page=3&size=100';return {data:PAGES[page],links:{last,self:url}};}
  const m=u.pathname.match(/\/meetings\/(\d+)$/);if(m)return MEETINGS.find(x=>x.id===url);
  throw Error('unexpected URL '+url);};
 return {seen,getJson};
}
test('agenda from the body list when meetings carry none; no modified_since on placeholder dates; public flag decides',async()=>{
 const {seen,getJson}=server();
 const d=await collectRegionalOparl({id:'de-1',name:'Stadt Beispielstadt',kind:'city',system:root+'system'},{now,window:'3m',getJson});
 assert.deepEqual(d.topics.filter(t=>!t.publicity).map(t=>t.title).sort(),['Neubau Kita','Radweg Hauptstraße'],'items of the meetings of the period, public ones');
 assert.ok(d.topics.filter(t=>t.publicity).every(t=>!/^\(?nicht/i.test(t.title)),'a placeholder title gives no topic');
 assert.ok(!seen.some(u=>u.includes('modified_since')),'the filter is not asked on placeholder dates');
 assert.ok(seen.some(u=>u.includes('agendaItems')&&u.includes('size=100')),'100 records a page');
 assert.ok(d.topics.every(t=>!/nichtöffentlich/.test(t.title)));
});

// SD.NET RIM: meetings embed their agenda; an upcoming meeting without agenda has no agendaItem field, and the body
// list refuses the page size ("Ein angegebener Parameter ist nicht erlaubt", HTTP 400). Nachgebildet nach ris.goch.de.
test('SD.NET RIM: an upcoming meeting without agenda does not send the import to the body list',async()=>{
 const sd='https://ris.example.test/webservice/oparl/v1.1/';
 const upcoming={id:sd+'body/1/meeting/2',type:'https://schema.oparl.org/1.1/Meeting',name:'Rat',start:'2026-11-18T18:00:00+01:00',modified:'2026-10-01T10:00:00+02:00'};
 const past={id:sd+'body/1/meeting/1',type:'https://schema.oparl.org/1.1/Meeting',name:'Rat',start:'2026-10-01T18:00:00+02:00',modified:'2026-10-02T10:00:00+02:00',agendaItem:[{id:sd+'body/1/agendaitem/7',type:'https://schema.oparl.org/1.1/AgendaItem',meeting:sd+'body/1/meeting/1',number:'1',order:1,name:'Haushalt',public:true}]};
 const run=async list=>{const seen=[];const getJson=async url=>{seen.push(url);const u=new URL(url);
  if(url===sd+'system')return {id:url,type:'https://schema.oparl.org/1.1/System',body:sd+'body'};
  if(u.pathname.endsWith('/v1.1/body'))return {data:[{id:sd+'body/1',type:'https://schema.oparl.org/1.1/Body',name:'Stadt',meeting:sd+'body/1/meeting',agendaItem:sd+'body/1/agendaitem'}],links:{}};
  if(u.pathname.endsWith('/body/1/meeting'))return {data:list,links:{}};
  if(u.pathname.endsWith('/body/1/agendaitem'))throw Error('OParl HTTP 400');
  const m=list.find(x=>x.id===url);if(m)return m;
  throw Error('unexpected URL '+url);};
  return {seen,d:await collectRegionalOparl({id:'nrw-1',name:'Stadt',kind:'city',system:sd+'system'},{now,window:'3m',getJson})};};
 const both=await run([upcoming,past]);
 assert.ok(!both.seen.some(u=>u.includes('agendaitem?')),'the agenda comes from the meetings');assert.ok(!both.d.coverage.issues.some(i=>/Tagesordnungsliste/.test(i)));
 assert.deepEqual(both.d.topics.map(t=>t.title),['Haushalt']);
 // Only upcoming meetings, none with an agenda yet: the refused list is no gap.
 const ahead=await run([upcoming]);assert.ok(!ahead.d.coverage.issues.some(i=>/Tagesordnungsliste/.test(i)));
});
