import test from 'node:test';
import assert from 'node:assert/strict';
import {HISTORY_WINDOWS,windowStart,windowYears,calendarMonthsBack} from '../shared/history-window.mjs';
import {KEEP_DAYS,writeMarks,readMarks,newMark} from '../server/integrations/meeting-marks.mjs';
import {collectSessionNet,MAX_MEETINGS} from '../server/integrations/sessionnet.mjs';
import {collectSdnet} from '../server/integrations/sdnet.mjs';
import {collectRegionalOparl} from '../server/integrations/oparl-regional.mjs';
// A period of two years is read in several parts. That needs marks that live as long as the period, limits that
// grow with it, and readers that continue behind what they have read.
const DAY=86400000,now=new Date('2026-10-02T10:00:00Z'),later=ms=>new Date(now.getTime()+ms);
test('the two-year window reaches back 24 months; marks live as long, limits count per year',()=>{
 assert.equal(HISTORY_WINDOWS['24m'].label,'24 Monate');assert.equal(windowStart(now,'24m').toISOString(),'2024-10-02T10:00:00.000Z');assert.equal(calendarMonthsBack(now,windowStart(now,'24m')),24);
 assert.deepEqual(['1w','1m','3m','12m','24m'].map(windowYears),[1,1,1,1,2]);assert.equal(windowYears(undefined),1);
 // A mark of a meeting at the far end of the longest period survives being stored.
 assert.ok(KEEP_DAYS>=24*31+30,String(KEEP_DAYS));
 const first=windowStart(now,'24m').toISOString().slice(0,10),stored=readMarks(writeMarks({far:newMark({date:first},'h',now,1),gone:newMark({date:'2023-01-01'},'h',now,1)},now));
 assert.deepEqual(Object.keys(stored),['far']);
});
test('SessionNet reads a list longer than the limit in parts: meetings read a moment ago do not count',async()=>{
 const source={id:'grossstadt',name:'Stadt Test',kind:'city',base:'https://ris.example.org/bi/',extension:'asp'},german=d=>d.split('-').reverse().join('.');
 // 403 meetings from January to June 2026, one public item without a paper each.
 const meetings=Array.from({length:MAX_MEETINGS+3},(_,i)=>({id:i+1,date:new Date(Date.UTC(2026,0,5+Math.floor(i*170/(MAX_MEETINGS+3)))).toISOString().slice(0,10)})),read=[];
 const get=async url=>{const u=new URL(url),file=u.pathname.split('/').pop();
  if(file==='si0040.asp'){const month=u.searchParams.get('__cjahr')+'-'+String(u.searchParams.get('__cmonat')).padStart(2,'0');return '<html><meta name="sessionnet" content="V:050500"/>SessionNet '+meetings.filter(m=>m.date.startsWith(month)).map(m=>`<a href="si0057.asp?__ksinr=${m.id}" title="Details anzeigen: Rat ${german(m.date)}">Sitzung</a>`).join('')+'</html>';}
  const id=Number(u.searchParams.get('__ksinr'));read.push(id);return `<table><tr><td class="tofnum">Ö 1</td><td class="tobetr"><div class="smc-card-header-title">Thema ${id}</div></td></tr></table>`;};
 const first=await collectSessionNet(source,{now,get,window:'12m'});
 assert.equal(read.length,MAX_MEETINGS);assert.equal(first.readMeetings,MAX_MEETINGS);assert.equal(first.topics.length,MAX_MEETINGS);assert.equal(first.coverage.resumable,true);assert.ok(first.coverage.issues.includes('Sitzungslimit erreicht; weiterer Import erforderlich.'));
 // The newest are read first; the three oldest are left for the continuation.
 assert.deepEqual(meetings.filter(m=>!read.includes(m.id)).map(m=>m.id),[1,2,3]);
 const stock=new Set(first.topics.flatMap(t=>t.events.map(e=>e.url)));read.length=0;
 const second=await collectSessionNet(source,{now:later(600000),get,window:'12m',marks:{known:first.marks,stock}});
 assert.deepEqual(read.sort((a,b)=>a-b),[1,2,3]);assert.equal(second.coverage.unchangedMeetings,MAX_MEETINGS);assert.equal(second.coverage.resumable,undefined);assert.deepEqual(second.coverage.issues,[]);assert.equal(second.coverage.complete,true);
});
test('SD.NET continues a long import behind the meetings it has read; a mark counts only for its period',async()=>{
 const base='https://ris.example.test/',source={id:'nrw-05170004',name:'Gemeinde Alpen',kind:'city',method:'scraper',adapter:'sdnet',base},at=new Date('2026-10-01T12:00:00Z');
 const meetingUrl=n=>base+'tops/?__=MEETING'+n,matterUrl=n=>base+'vorgang/?__=MATTER'+n;
 const paperRow=(n,when,meeting)=>`<tr><td class="column-betreff"><a href="${matterUrl(n)}">${n}/2026</a><br/><span>Thema ${n}</span></td><td class="column-termin"><a href="${meetingUrl(meeting)}" title="Zur Sitzung vom ${when} 18:00 Uhr">${when}</a><br><span>Rat</span></td></tr>`;
 const agenda=(when,n)=>`<html><table><tr><th>Sitzung:</th><td>Rat, 6. Sitzung</td></tr></table><table class="table-data table-top"><tbody><tr class="top-oeff-data" data-vorgang-id="505_${n}"><td class="column-topnrtext">1.</td><td class="column-bezeichnung">Thema ${n}</td><td class="column-nummer">${n}/2026</td><td class="column-dokumente"><a class="link-element" href="${matterUrl(n)}" title="Vorgang öffnen">Vorgang</a></td></tr></tbody></table></html>`;
 const matter=(n,meeting,when)=>`<html><table><tr><th>Betreff:</th><td>Thema ${n}</td></tr></table><table class="table-data table-vorgang"><tbody><tr><td class="column-beginn"><a href="${meetingUrl(meeting)}">${when} 18:00 Uhr</a></td><td class="column-gremium"><span>Rat</span></td><td class="column-ergebnis">Einstimmig dafür</td></tr></tbody></table></html>`;
 const pages={[base+'vorlagen']:`<html><table>${paperRow(1,'Do, 02.07.2026',1)}${paperRow(2,'Do, 13.08.2026',2)}</table></html>`,[base+'termine']:'<html></html>',
  [meetingUrl(1)]:agenda('Do, 02.07.2026',1),[meetingUrl(2)]:agenda('Do, 13.08.2026',2),[matterUrl(1)]:matter(1,1,'Do, 02.07.2026'),[matterUrl(2)]:matter(2,2,'Do, 13.08.2026')};
 const calls=[],web=fail=>async url=>{calls.push(url);if(fail?.(url))throw Error(fail(url));if(!(url in pages))throw Error('Quelle antwortet mit HTTP 404');return pages[url];};
 // Out of time on the second paper: one meeting is read and marked, the import can be continued.
 const cut=await collectSdnet(source,{now:at,window:'12m',get:web(url=>url===matterUrl(2)?'Zeitbudget der Quelle erreicht':null)});
 assert.equal(cut.coverage.resumable,true);assert.equal(cut.readMeetings,1);assert.deepEqual(Object.keys(cut.marks),[meetingUrl(1)]);assert.deepEqual(cut.coverage.issues,['Zeitbudget der Quelle erreicht; 1 Sitzung noch nicht vollständig gelesen.']);
 const stock=new Set(cut.topics.flatMap(t=>t.events.map(e=>e.url)));calls.length=0;
 const next=await collectSdnet(source,{now:new Date(at.getTime()+600000),window:'12m',get:web(),marks:{known:cut.marks,stock}});
 assert.ok(!calls.includes(meetingUrl(1))&&!calls.includes(matterUrl(1)),'the meeting read a moment ago is not asked again');assert.ok(calls.includes(matterUrl(2)));
 assert.equal(next.coverage.unchangedMeetings,1);assert.equal(next.readMeetings,1);assert.equal(next.coverage.resumable,undefined);assert.equal(next.coverage.complete,true);assert.deepEqual(next.topics.map(t=>t.title),['Thema 2']);
 // Later, with an unchanged agenda: nothing behind the meetings is fetched, the import is complete without new reports.
 const all={...cut.marks,...next.marks},known=new Set([meetingUrl(1),meetingUrl(2)]);calls.length=0;
 const same=await collectSdnet(source,{now:new Date(at.getTime()+3*DAY),window:'12m',get:web(),marks:{known:all,stock:known}});
 assert.ok(calls.includes(meetingUrl(1))&&!calls.includes(matterUrl(1))&&!calls.includes(matterUrl(2)));assert.equal(same.coverage.unchangedMeetings,2);assert.equal(same.topics.length,0);assert.equal(same.coverage.complete,true);assert.equal(same.coverage.quiet,false);
 // A longer period: the marks of the shorter one do not count, every meeting is read once more.
 calls.length=0;const wider=await collectSdnet(source,{now:new Date(at.getTime()+600000),window:'24m',get:web(),marks:{known:all,stock:known}});
 assert.ok(calls.includes(matterUrl(1))&&calls.includes(matterUrl(2)));assert.equal(wider.coverage.unchangedMeetings,undefined);assert.equal(wider.topics.length,2);assert.ok(Object.values(wider.marks).every(m=>m[1].startsWith('24m:')));
});
test('SD.NET reads forty pages of the paper list for each year of the period',async()=>{
 const base='https://ris.example.test/',source={id:'nrw-05170004',name:'Gemeinde Alpen',kind:'city',method:'scraper',adapter:'sdnet',base},at=new Date('2026-10-01T12:00:00Z');
 // An endless list whose papers all lead to one meeting inside the period.
 const page=n=>`<html><table><tr><td class="column-betreff">x</td><td class="column-termin"><a href="${base}tops/?__=M" title="Zur Sitzung vom Do, 03.09.2026 18:00 Uhr">x</a></td></tr></table><a href="${base}vorlagen?__=P${n+1}">&gt;</a></html>`;
 const run=async window=>{let lists=0;const d=await collectSdnet(source,{now:at,window,get:async url=>{if(url.includes('vorlagen')){lists++;return page(lists);}return '<html></html>';}});return {lists,issues:d.coverage.issues};};
 const year=await run('12m'),two=await run('24m');
 assert.equal(year.lists,40);assert.equal(two.lists,80);assert.ok(two.issues.some(i=>/Seitenlimit der Vorlagenliste/.test(i)));
});
test('OParl skips meetings that are unchanged since they were read and continues after running out of time',async()=>{
 const root='https://fixture.example/',source={system:root+'body',id:'test',name:'Teststadt',kind:'city'};
 const meetings=[{id:root+'meeting/1',start:'2026-06-10T18:00:00+02:00',modified:'2026-06-20T10:00:00+02:00',name:'Rat',agendaItem:[{id:root+'item/1',name:'Thema 1',public:true,number:'Ö 1',consultation:root+'consultation/1'}]},
  {id:root+'meeting/2',start:'2026-08-05T18:00:00+02:00',modified:'2026-08-10T10:00:00+02:00',name:'Rat',agendaItem:[{id:root+'item/2',name:'Thema 2',public:true,number:'Ö 1',consultation:root+'consultation/2'}]}];
 const seen=[],web=fail=>async url=>{seen.push(url);if(fail?.(url))throw Error(fail(url));
  if(url===root+'body')return {id:root+'body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:root+'meetings'};
  if(url===root+'meetings')return {data:meetings,links:{}};
  const [,kind,n]=url.match(/(consultation|paper)\/(\d+)$/)||[];if(kind==='consultation')return {id:url,paper:root+'paper/'+n};if(kind==='paper')return {id:url,name:'Vorlage '+n,reference:'V/'+n};
  throw Error('unexpected '+url);};
 const behind=()=>seen.filter(u=>/consultation|paper/.test(u)).map(u=>u.replace(root,''));
 const cut=await collectRegionalOparl(source,{now,window:'12m',getJson:web(url=>url===root+'consultation/2'?'Zeitbudget der Quelle erreicht':null)});
 assert.equal(cut.coverage.resumable,true);assert.equal(cut.readMeetings,1);assert.deepEqual(Object.keys(cut.marks),[root+'meeting/1']);assert.ok(cut.coverage.issues.includes('Verknüpfung: Zeitbudget der Quelle erreicht'));
 const stock=new Set(cut.topics.flatMap(t=>t.events.map(e=>e.url)));seen.length=0;
 const next=await collectRegionalOparl(source,{now:later(600000),window:'12m',getJson:web(),marks:{known:cut.marks,stock}});
 assert.deepEqual(behind(),['consultation/2','paper/2']);assert.equal(next.coverage.unchangedMeetings,1);assert.equal(next.readMeetings,1);assert.equal(next.coverage.resumable,undefined);assert.equal(next.coverage.complete,true);assert.deepEqual(next.topics.map(t=>t.title),['Vorlage 2']);
 // Three days later nothing has changed: no item, paper or file is asked for. Then one meeting is modified.
 const all={...cut.marks,...next.marks},known=new Set(meetings.map(m=>m.id));seen.length=0;
 const same=await collectRegionalOparl(source,{now:later(3*DAY),window:'12m',getJson:web(),marks:{known:all,stock:known}});
 assert.deepEqual(behind(),[]);assert.equal(same.coverage.unchangedMeetings,2);assert.equal(same.topics.length,0);assert.equal(same.coverage.complete,true);
 meetings[0]={...meetings[0],modified:'2026-10-03T09:00:00+02:00'};seen.length=0;
 const changed=await collectRegionalOparl(source,{now:later(3*DAY),window:'12m',getJson:web(),marks:{known:all,stock:known}});
 assert.deepEqual(behind(),['consultation/1','paper/1']);assert.equal(changed.coverage.unchangedMeetings,1);assert.deepEqual(changed.topics.map(t=>t.title),['Vorlage 1']);
 // Without marks everything is read, as before.
 seen.length=0;const plain=await collectRegionalOparl(source,{now,window:'12m',getJson:web()});assert.equal(behind().length,4);assert.equal(plain.topics.length,2);assert.equal(plain.coverage.unchangedMeetings,undefined);assert.equal(plain.readMeetings,2);
});
test('OParl list limits grow with the years of the period',async()=>{
 const root='https://fixture.example/',source={system:root+'body',id:'test',name:'Teststadt',kind:'city'};
 // An unsorted list of thirty pages: the fixed page limit applies, six pages for a year.
 const run=async window=>{const pages=[];const d=await collectRegionalOparl(source,{now,window,getJson:async url=>{
   if(url===root+'body')return {id:root+'body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:root+'meetings?page=1'};
   const page=Number(new URL(url).searchParams.get('page'));if(!page||url.includes('modified_since'))throw Error('unexpected '+url);pages.push(page);
   return {data:[{id:root+'meeting/'+page,start:'2001-01-01T10:00:00Z',agendaItem:[]}],links:page<30?{next:root+'meetings?page='+(page+1)}:{}};}});return {pages:pages.length,issues:d.coverage.issues};};
 const year=await run('12m'),two=await run('24m');
 assert.equal(year.pages,6);assert.equal(two.pages,12);assert.ok(two.issues.some(i=>/Listenlimit/.test(i)));
});
test('OParl keeps the meeting list for the step that continues an import, and leaves untouched meetings alone once time is up',async()=>{
 const root='https://fixture.example/',source={system:root+'body',id:'test',name:'Teststadt',kind:'city'};
 const meetings=Array.from({length:5},(_,i)=>({id:root+'meeting/'+(i+1),start:`2026-0${i+2}-10T18:00:00+02:00`,modified:'2026-08-01T10:00:00+02:00',name:'Rat',agendaItem:[{id:root+'item/'+(i+1),name:'Thema '+(i+1),public:true,number:'Ö 1',consultation:root+'consultation/'+(i+1)}]}));
 const seen=[],web=fail=>async url=>{seen.push(url.replace(root,''));if(fail?.(url))throw Error(fail(url));
  if(url===root+'body')return {id:root+'body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:root+'meetings'};
  if(url===root+'meetings')return {data:meetings,links:{}};
  const [,kind,n]=url.match(/(meeting|consultation|paper)\/(\d+)$/)||[];
  if(kind==='meeting')return meetings[n-1];if(kind==='consultation')return {id:url,paper:root+'paper/'+n};if(kind==='paper')return {id:url,name:'Vorlage '+n};
  throw Error('unexpected '+url);};
 // The first three meetings run out of requests; the other two are not started.
 const cut=await collectRegionalOparl(source,{now,window:'12m',getJson:web(url=>/consultation\/[123]$/.test(url)?'Abrufbudget erreicht':null)});
 assert.ok(!seen.some(u=>/consultation\/[45]|paper/.test(u)),seen.join(' '));assert.equal(cut.readMeetings,0);assert.equal(cut.coverage.resumable,true);
 assert.ok(cut.topics.every(t=>/Thema [123]/.test(t.title)),'no report of a meeting that was not started');
 assert.deepEqual(cut.list.rows.map(r=>r[0]),meetings.map(m=>m.id));assert.equal(cut.list.window,'12m');assert.equal(cut.list.body,root+'body');
 // The continuation takes the kept list: the list is not asked again, each unread meeting is asked for by its address.
 seen.length=0;const next=await collectRegionalOparl(source,{now:later(600000),window:'12m',getJson:web(),marks:{known:cut.marks,stock:new Set(),list:cut.list}});
 assert.ok(!seen.includes('meetings')&&!seen.some(u=>u.includes('modified_since')));assert.equal(seen.filter(u=>/^meeting\/\d$/.test(u)).length,5);
 assert.equal(next.readMeetings,5);assert.equal(next.topics.length,5);assert.equal(next.coverage.complete,true);assert.equal(next.coverage.meetings,5);assert.deepEqual(next.list,cut.list);
 // After some hours, for another period or another body the list is asked again.
 for(const [at,window,list] of [[later(7*3600000),'12m',cut.list],[later(600000),'24m',cut.list],[later(600000),'12m',{...cut.list,body:root+'other'}]]){
  seen.length=0;await collectRegionalOparl(source,{now:at,window,getJson:web(),marks:{known:{},stock:new Set(),list}});assert.ok(seen.includes('meetings'),window);}
 // A list that hit a limit is not kept.
 const limited=await collectRegionalOparl(source,{now,window:'12m',maxPages:1,getJson:async url=>url===root+'body'?{id:root+'body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:root+'meetings?page=1'}:url.includes('modified_since')?(()=>{throw Error('x');})():{data:[{...meetings[0],agendaItem:[]}],links:{next:root+'meetings?page='+(Number(new URL(url).searchParams.get('page'))+1)}}});
 assert.ok(limited.coverage.issues.some(i=>/Listenlimit/.test(i)));assert.equal(limited.list,undefined);
});
test('OParl continues a filtered meeting list at the page where the time ran out',async()=>{
 const root='https://fixture.example/',source={system:root+'body',id:'test',name:'Teststadt',kind:'city'};
 const meeting=n=>({id:root+'meeting/'+n,start:`2026-0${n+1}-10T18:00:00+02:00`,modified:'2026-08-01T10:00:00+02:00',name:'Rat',agendaItem:[{id:root+'item/'+n,name:'Thema '+n,public:true,number:'Ö 1'}]});
 const seen=[],web=fail=>async url=>{const short=url.replace(root,'');seen.push(short);if(fail?.(url))throw Error(fail(url));
  if(url===root+'body')return {id:root+'body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:root+'meetings'};
  const u=new URL(url),since=u.searchParams.get('modified_since'),page=Number(u.searchParams.get('page')||1);
  if(u.pathname==='/meetings'&&since){if(since.startsWith('2100'))return {data:[],links:{}};return {data:[meeting(page*2-1),meeting(page*2)],links:page<3?{next:root+'meetings?modified_since='+encodeURIComponent(since)+'&page='+(page+1)}:{}};}
  const n=url.match(/meeting\/(\d+)$/)?.[1];if(n)return meeting(Number(n));
  throw Error('unexpected '+url);};
 const pagesAsked=()=>seen.filter(u=>u.startsWith('meetings?')&&!u.includes('2100')).map(u=>Number(new URL(root+u).searchParams.get('page')||1));
 // Page 2 of the list does not arrive in time: the first page is kept together with the address of page 2.
 const cut=await collectRegionalOparl(source,{now,window:'12m',getJson:web(url=>/page=2$/.test(url)?'Zeitbudget der Quelle erreicht':null)});
 assert.deepEqual(pagesAsked(),[1,2]);assert.equal(cut.coverage.resumable,true);assert.equal(cut.list.rows.length,2);assert.match(cut.list.next,/page=2$/);assert.equal(cut.coverage.listStrategy,'filter');
 // The continuation asks for page 2 and 3 only, neither the test request nor page 1 again, and then reads all meetings.
 seen.length=0;const next=await collectRegionalOparl(source,{now:later(600000),window:'12m',getJson:web(),marks:{known:cut.marks,stock:new Set(cut.topics.flatMap(t=>t.events.map(e=>e.url))),list:cut.list}});
 assert.deepEqual(pagesAsked(),[2,3]);assert.ok(!seen.some(u=>u.includes('2100')));
 assert.equal(next.list.rows.length,6);assert.equal(next.list.next,undefined);assert.ok(next.list.readAt>cut.list.readAt);assert.equal(next.coverage.meetings,6);assert.equal(next.coverage.complete,true);
 // The two meetings of the first page were read by the first step and are not read again.
 assert.equal(cut.readMeetings,2);assert.equal(next.coverage.unchangedMeetings,2);assert.equal(next.topics.length,4);assert.deepEqual(seen.filter(u=>u.startsWith('meeting/')),[]);
 // With the complete list kept, a further step asks for no list page at all.
 seen.length=0;await collectRegionalOparl(source,{now:later(1200000),window:'12m',getJson:web(),marks:{known:{},stock:new Set(),list:next.list}});assert.deepEqual(pagesAsked(),[]);
});
