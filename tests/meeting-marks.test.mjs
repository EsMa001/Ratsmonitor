import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSessionNet} from '../server/integrations/sessionnet.mjs';
import {usableMark,newMark,readMarks,writeMarks,phase,marksKey,MARKS_VERSION,RECENT_DAYS,TRUST_HOURS,MIN_AGE_DAYS,AGE_SPREAD_DAYS} from '../server/integrations/meeting-marks.mjs';
import {mergeImport} from '../server/integrations/merge-import.mjs';
import {importHealth} from '../server/integrations/import-health.mjs';
const DAY=86400000,now=new Date('2026-10-02T10:00:00Z'),later=ms=>new Date(now.getTime()+ms);
const meeting=(date,url='https://ris.example.org/bi/si0057.asp?__ksinr=1')=>({date,url});
test('a mark is relied on only for the same side of today, outside the days after a meeting, while fresh enough and stored',()=>{
 const past=meeting('2026-06-10'),stock=new Set([past.url]),known={[past.url]:newMark(past,'abc',now,3)};
 assert.deepEqual(known[past.url],['2026-06-10','abc',now.getTime(),'p',3]);assert.equal(phase('2026-10-02',now),'p');assert.equal(phase('2026-10-03',now),'f');
 assert.deepEqual(usableMark({known,stock},past,later(DAY)),{print:'abc',trusted:false});
 assert.deepEqual(usableMark({known,stock},past,later(3600000)),{print:'abc',trusted:true},'read within the last hours: no request at all');
 assert.equal(usableMark({known,stock},past,later(TRUST_HOURS*3600000+1)).trusted,false);
 assert.equal(usableMark({known,stock:new Set()},past,later(DAY)),null,'its reports are gone from the database');
 assert.equal(usableMark({known,stock},meeting('2026-06-10','https://ris.example.org/bi/si0057.asp?__ksinr=2'),later(DAY)),null,'no mark for this meeting');
 assert.equal(usableMark(undefined,past,now),null);assert.equal(usableMark({known:{[past.url]:'x'},stock},past,now),null);
 // Read again from time to time: after 45 to 75 days, spread per meeting.
 assert.ok(usableMark({known,stock},past,later((MIN_AGE_DAYS-1)*DAY)));assert.equal(usableMark({known,stock},past,later((MIN_AGE_DAYS+AGE_SPREAD_DAYS)*DAY)),null);
 assert.equal(usableMark({known,stock},past,later(-DAY)),null,'a mark from the future is not trusted');
 // A meeting that took place within the last two weeks: results and attendance are still being published.
 const recent=meeting('2026-09-25'),recentMarks={known:{[recent.url]:newMark(recent,'r',now,2)},stock:new Set([recent.url])};
 assert.equal(usableMark(recentMarks,recent,later(DAY)),null);assert.ok(usableMark(recentMarks,recent,later(RECENT_DAYS*DAY)));
 assert.equal(usableMark(recentMarks,recent,later(3600000)).trusted,true,'an import that continues after the time limit does not read it again');
 // A meeting that has taken place since it was read: results can have arrived.
 const coming=meeting('2026-10-20'),comingMarks={known:{[coming.url]:newMark(coming,'c',now,0)},stock:new Set()};
 assert.deepEqual(usableMark(comingMarks,coming,later(5*DAY)),{print:'c',trusted:false},'a meeting without public items needs no reports in the database');
 assert.equal(usableMark(comingMarks,coming,later(19*DAY)),null);
});
test('marks are stored with a version and without meetings older than the longest import period',()=>{
 // The longest period is two years: a meeting of last year keeps its mark, one from before the period loses it.
 const marks={a:['2026-09-01','h',1,'p',2],lastYear:['2025-06-01','h',1,'p',2],old:['2024-06-01','h',1,'p',2],broken:'x'},text=writeMarks(marks,now);
 assert.deepEqual(readMarks(text),{a:marks.a,lastYear:marks.lastYear});assert.equal(JSON.parse(text).v,MARKS_VERSION);assert.equal(marksKey('billerbeck'),'import-marks:billerbeck');
 assert.deepEqual(readMarks(JSON.stringify({v:MARKS_VERSION+1,marks})),{},'marks of another version are void');
 for(const bad of [undefined,'','{','[]','{"v":1}','{"v":1,"marks":[1]}'])assert.deepEqual(readMarks(bad),{});
});
const source={id:'teststadt',name:'Stadt Test',kind:'city',base:'https://ris.example.org/bi/',extension:'asp'};
const german=date=>date.split('-').reverse().join('.');
// A small SessionNet: calendar, agenda pages with one public item each, a paper page and an attendance page per meeting.
function site(meetings){
 const state={meetings,log:[],fail:null};
 state.get=async url=>{
  const u=new URL(url),file=u.pathname.split('/').pop(),id=Number(u.searchParams.get('__ksinr')||u.searchParams.get('__kvonr'));state.log.push(file);
  const failure=state.fail?.(file,id);if(failure)throw Error(failure);
  if(file==='si0040.asp'){const month=u.searchParams.get('__cjahr')+'-'+String(u.searchParams.get('__cmonat')).padStart(2,'0');return '<html><meta name="sessionnet" content="V:050500"/>SessionNet '+state.meetings.filter(m=>m.date.startsWith(month)).map(m=>`<a href="si0057.asp?__ksinr=${m.id}" title="Details anzeigen: ${m.committee} ${german(m.date)}">Sitzung</a>`).join('')+'</html>';}
  if(file==='si0057.asp'){const m=state.meetings.find(x=>x.id===id);return `<table><tr><td class="tofnum">Ö 1</td><td class="tobetr"><div class="smc-card-header-title">Thema ${m.id}</div><a href="vo0050.asp?__kvonr=${m.paper}">V/${m.paper}</a>${m.result?' Beschluss: '+m.result:''}</td></tr></table><a href="to0045.asp?__ksinr=${m.id}">Anwesenheit</a>`;}
  if(file==='vo0050.asp')return `<table><tr><td>Vorlage</td><td>V/${id}</td></tr></table><a href="getfile.asp?id=${id}">Vorlage</a>`;
  if(file==='to0045.asp')return '<table id="smc_page_to0045_contenttable1"><tr><td>Anna Beispiel</td><td></td><td>Mitglied</td></tr></table>';
  throw Error('Quelle antwortet mit HTTP 404');
 };
 state.count=()=>{const by={};for(const file of state.log.splice(0))by[file]=(by[file]||0)+1;return by;};
 return state;
}
const three=()=>site([{id:1,date:'2026-06-10',committee:'Rat',result:'einstimmig beschlossen',paper:11},{id:2,date:'2026-09-25',committee:'Bauausschuss',result:'',paper:12},{id:3,date:'2026-10-20',committee:'Rat',result:'',paper:13}]);
const address=id=>source.base+'si0057.asp?__ksinr='+id;
const stockOf=(...ids)=>new Set(ids.map(address));
test('the pages behind an unchanged agenda are not fetched again',async()=>{
 const web=three();
 // First import: everything is read; each meeting costs its agenda, its paper and its attendance page.
 const first=await collectSessionNet(source,{now,get:web.get,window:'12m'});
 assert.deepEqual(web.count(),{'si0040.asp':14,'si0057.asp':3,'vo0050.asp':3,'to0045.asp':3});
 assert.equal(first.topics.length,3);assert.equal(first.readMeetings,3);assert.equal(first.coverage.complete,true);assert.equal(first.coverage.unchangedMeetings,undefined);assert.deepEqual(Object.keys(first.marks).sort(),[1,2,3].map(address));
 assert.deepEqual(first.marks[address(1)].slice(2),[now.getTime(),'p',1]);assert.equal(first.marks[address(3)][3],'f');
 // Without marks nothing is skipped, as before.
 await collectSessionNet(source,{now:later(DAY),get:web.get,window:'12m'});assert.equal(web.count()['vo0050.asp'],3);
 // The next day: the old meeting and the coming one are unchanged; the one of last week is read in full.
 const marks={known:first.marks,stock:stockOf(1,2,3)},second=await collectSessionNet(source,{now:later(DAY),get:web.get,window:'12m',marks});
 assert.deepEqual(web.count(),{'si0040.asp':14,'si0057.asp':3,'vo0050.asp':1,'to0045.asp':1});
 assert.deepEqual(second.topics.map(t=>t.id),['teststadt-vo-12']);assert.equal(second.coverage.unchangedMeetings,2);assert.equal(second.readMeetings,1);assert.equal(second.coverage.meetings,3);assert.equal(second.coverage.complete,true);assert.deepEqual(second.coverage.issues,[]);
 assert.deepEqual(second.marks[address(1)],first.marks[address(1)],'an unchanged meeting keeps the time of its complete reading');assert.equal(second.marks[address(2)][2],later(DAY).getTime());
 // A result appears on the agenda of the old meeting: it is read again.
 web.meetings[0].result='mehrheitlich abgelehnt';
 const changed=await collectSessionNet(source,{now:later(DAY),get:web.get,window:'12m',marks});
 assert.equal(web.count()['vo0050.asp'],2);assert.deepEqual(changed.topics.map(t=>t.id).sort(),['teststadt-vo-11','teststadt-vo-12']);assert.equal(changed.topics.find(t=>t.id==='teststadt-vo-11').status,'rejected');assert.equal(changed.coverage.unchangedMeetings,1);
 web.meetings[0].result='einstimmig beschlossen';
 // Its reports are no longer in the database: it is read again.
 const lost=await collectSessionNet(source,{now:later(DAY),get:web.get,window:'12m',marks:{known:first.marks,stock:stockOf(2,3)}});
 assert.equal(web.count()['vo0050.asp'],2);assert.equal(lost.coverage.unchangedMeetings,1);
 // Three weeks on: the coming meeting has taken place and is read; the other two are unchanged.
 const after=await collectSessionNet(source,{now:later(21*DAY),get:web.get,window:'12m',marks});
 assert.deepEqual(after.topics.map(t=>t.id),['teststadt-vo-13']);assert.equal(after.coverage.unchangedMeetings,2);
});
test('everything unchanged is a complete reading without reports; an hour later not even the agendas are fetched',async()=>{
 const web=site([{id:1,date:'2026-06-10',committee:'Rat',result:'beschlossen',paper:11},{id:4,date:'2026-07-01',committee:'Rat',result:'beschlossen',paper:14}]);
 const first=await collectSessionNet(source,{now,get:web.get,window:'12m'});web.count();
 const marks={known:first.marks,stock:stockOf(1,4)};
 const still=await collectSessionNet(source,{now:later(2*DAY),get:web.get,window:'12m',marks});
 assert.deepEqual(web.count(),{'si0040.asp':14,'si0057.asp':2});
 assert.deepEqual(still.topics,[]);assert.equal(still.coverage.unchangedMeetings,2);assert.equal(still.coverage.complete,true);assert.deepEqual(still.coverage.issues,[]);assert.equal(still.coverage.quiet,false);assert.equal(still.readMeetings,0);
 const soon=await collectSessionNet(source,{now:later(3600000),get:web.get,window:'12m',marks});
 assert.deepEqual(web.count(),{'si0040.asp':14});assert.equal(soon.coverage.unchangedMeetings,2);assert.equal(soon.coverage.complete,true);
});
test('an exhausted time budget is reported once; the next attempt continues behind what was read',async()=>{
 const web=three();
 // The budget ends while the papers of two meetings are still open.
 web.fail=(file,id)=>file==='vo0050.asp'&&id!==13?'Zeitbudget der Quelle erreicht':null;
 const cut=await collectSessionNet(source,{now,get:web.get,window:'12m'});web.count();
 assert.deepEqual(cut.coverage.issues,['Zeitbudget der Quelle erreicht; 2 Sitzungen noch nicht vollständig gelesen.']);assert.equal(cut.coverage.resumable,true);assert.equal(cut.coverage.complete,false);
 assert.equal(cut.readMeetings,1);assert.deepEqual(Object.keys(cut.marks),[address(3)]);assert.equal(cut.topics.length,3,'what the agendas say is stored; the papers follow');
 // A minute later: the meeting that was read is not asked for again.
 web.fail=null;
 const resumed=await collectSessionNet(source,{now:later(60000),get:web.get,window:'12m',marks:{known:cut.marks,stock:stockOf(1,2,3)}});
 assert.deepEqual(web.count(),{'si0040.asp':14,'si0057.asp':2,'vo0050.asp':2,'to0045.asp':2});
 assert.equal(resumed.coverage.complete,true);assert.equal(resumed.coverage.resumable,undefined);assert.equal(resumed.coverage.unchangedMeetings,1);assert.equal(resumed.readMeetings,2);assert.equal(Object.keys(resumed.marks).length,3);
 // A paper page that fails for another reason: reported, and the meeting is not marked as read.
 web.fail=(file,id)=>file==='vo0050.asp'&&id===11?'Quelle antwortet mit HTTP 500':null;
 const broken=await collectSessionNet(source,{now,get:web.get,window:'12m'});
 assert.deepEqual(broken.coverage.issues,['Vorlagendetails: Quelle antwortet mit HTTP 500']);assert.equal(broken.marks[address(1)],undefined);assert.equal(broken.readMeetings,2);
 // An attendance page that fails does not keep the meeting from being marked; it is reported.
 web.fail=(file,id)=>file==='to0045.asp'&&id===2?'Quelle antwortet mit HTTP 500':null;
 const attendance=await collectSessionNet(source,{now,get:web.get,window:'12m'});
 assert.deepEqual(attendance.coverage.issues,['Teilnahmeangaben: Quelle antwortet mit HTTP 500']);assert.equal(Object.keys(attendance.marks).length,3);
});
test('an import of unchanged meetings keeps the stock and counts as a successful attempt',()=>{
 const topic={id:'teststadt-vo-11',regionId:'teststadt',sourceUrl:source.base+'vo0050.asp?__kvonr=11',title:'Thema',status:'approved',eventDate:'2026-06-10',updatedAt:'2026-10-01T10:00:00.000Z',events:[{url:address(1),date:'2026-06-10',committee:'Rat'}],documents:[]};
 const previous={topics:[topic],coverage:{regionId:'teststadt',window:'12m',from:'2025-10-02',to:'2026-10-01',importedAt:'2026-10-01T10:00:00.000Z',meetings:3,complete:true,issues:[]}};
 const attempt={regionId:'teststadt',window:'12m',from:'2025-10-03',to:'2026-10-02',importedAt:'2026-10-02T10:00:00.000Z',meetings:3,complete:true,issues:[],quiet:false};
 const unchanged=mergeImport(previous,{topics:[],coverage:{...attempt,unchangedMeetings:3}});
 assert.equal(unchanged.topics.length,1);assert.equal(unchanged.coverage.complete,true);assert.deepEqual(unchanged.coverage.issues,[]);assert.equal(unchanged.coverage.from,'2025-10-03');assert.equal(unchanged.quiet,false);
 // Without unchanged meetings an import without reports is an empty source, as before.
 const empty=mergeImport(previous,{topics:[],coverage:attempt});assert.equal(empty.coverage.complete,false);assert.match(empty.coverage.issues.join(' '),/lieferte keine Artikel/);
 // A narrower window does not shrink the documented period.
 const narrow=mergeImport(previous,{topics:[],coverage:{...attempt,window:'1w',from:'2026-09-25',meetings:1,unchangedMeetings:1}});
 assert.equal(narrow.coverage.from,'2025-10-02');assert.equal(narrow.coverage.window,'12m');assert.equal(narrow.coverage.lastWindow,'1w');assert.equal(narrow.coverage.complete,true);
 // Health: unchanged meetings count like reports — a complete attempt succeeds, an incomplete one is partial, not empty.
 assert.equal(importHealth({},{at:'2026-10-02T10:00:00.000Z',count:3,complete:true}).attemptStatus,'completed');
 const partial=importHealth({failureCount:2},{at:'2026-10-02T10:00:00.000Z',count:3,complete:false});assert.equal(partial.attemptStatus,'partial');assert.equal(partial.failureCount,0);assert.equal(partial.nextRetryAt,null);
});
