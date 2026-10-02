import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {historyStart,HISTORY_MONTHS} from '../server/integrations/history-window.mjs';
import {HISTORY_WINDOWS,DEFAULT_HISTORY_WINDOW,historyWindow,windowStart,windowSpanDays,calendarMonthsBack} from '../shared/history-window.mjs';
import {collectSessionNet} from '../server/integrations/sessionnet.mjs';
import {collectRegion} from '../server/integrations/collect-region.mjs';
import {mergeImport} from '../server/integrations/merge-import.mjs';
import {importHealth} from '../server/integrations/import-health.mjs';
import {pipelineAction} from '../server/integrations/pipeline-jobs.mjs';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
const source={id:'test',name:'Test',kind:'city',extension:'asp',base:'https://example.test/'};
const now=new Date('2026-09-27T12:00:00Z');
test('twelve-month calendar window clamps leap day and preserves month ends',()=>{
 assert.equal(HISTORY_MONTHS,12);
 assert.equal(historyStart(new Date('2026-09-27T12:00:00Z')).toISOString(),'2025-09-27T12:00:00.000Z');
 assert.equal(historyStart(new Date('2024-02-29T12:00:00Z')).toISOString(),'2023-02-28T12:00:00.000Z');
});
test('SessionNet requests thirteen overlapping calendar months plus next month',async()=>{
 const calls=[];const result=await collectSessionNet(source,{now,get:async url=>{calls.push(url);return 'sessionnet';}});
 assert.equal(calls.length,14);assert.ok(calls.some(u=>u.includes('__cjahr=2025&__cmonat=9')));assert.equal(result.coverage.from,'2025-09-27');assert.equal(result.coverage.complete,false);
});
test('selectable look-back windows resolve to exact start dates and reject unknown values',()=>{
 assert.deepEqual(Object.keys(HISTORY_WINDOWS),['1w','1m','3m','12m']);assert.equal(DEFAULT_HISTORY_WINDOW,'12m');
 assert.equal(windowStart(now,'1w').toISOString(),'2026-09-20T12:00:00.000Z');
 assert.equal(windowStart(now,'1m').toISOString(),'2026-08-27T12:00:00.000Z');
 assert.equal(windowStart(now,'3m').toISOString(),'2026-06-27T12:00:00.000Z');
 assert.equal(windowStart(now,'12m').toISOString(),'2025-09-27T12:00:00.000Z');
 // Callers that do not choose keep the established twelve months.
 assert.equal(windowStart(now).toISOString(),historyStart(now).toISOString());assert.equal(historyWindow(undefined),'12m');assert.equal(historyWindow(''),'12m');
 assert.equal(windowStart(new Date('2026-03-31T12:00:00Z'),'1m').toISOString(),'2026-02-28T12:00:00.000Z');
 for(const bad of ['2y','12M',7,{},'__proto__'])assert.throws(()=>historyWindow(bad),/Rückblick/);
 const spans=Object.keys(HISTORY_WINDOWS).map(windowSpanDays);assert.deepEqual(spans,[...spans].sort((a,b)=>a-b));assert.equal(new Set(spans).size,4);
 assert.equal(calendarMonthsBack(now,windowStart(now,'12m')),12);assert.equal(calendarMonthsBack(now,windowStart(now,'1w')),0);
 const october=new Date('2026-10-03T12:00:00Z');assert.equal(calendarMonthsBack(october,windowStart(october,'1w')),1);
});
test('SessionNet requests only the calendar months of the selected window',async()=>{
 const run=async(window,at=now)=>{const calls=[];const result=await collectSessionNet(source,{now:at,window,get:async url=>{calls.push(url);return 'sessionnet';}});return {calls,result};};
 const week=await run('1w');
 assert.equal(week.calls.length,2);assert.ok(week.calls.some(u=>u.includes('__cjahr=2026&__cmonat=10')));assert.ok(week.calls.some(u=>u.includes('__cjahr=2026&__cmonat=9')));
 assert.equal(week.result.coverage.from,'2026-09-20');assert.equal(week.result.coverage.quiet,true);
 // A week that reaches into the previous month needs that month's calendar page as well.
 assert.equal((await run('1w',new Date('2026-10-03T12:00:00Z'))).calls.length,3);
 const quarter=await run('3m');assert.equal(quarter.calls.length,5);assert.equal(quarter.result.coverage.from,'2026-06-27');
 const month=await run('1m');assert.equal(month.calls.length,3);assert.equal(month.result.coverage.from,'2026-08-27');
 // A failed calendar request is an issue, never a quiet period.
 const failed=await collectSessionNet(source,{now,window:'1w',get:async()=>{throw Error('HTTP 500');}});assert.equal(failed.coverage.quiet,false);
});
test('collectRegion rejects an unknown window before any request',async()=>{
 await assert.rejects(collectRegion('billerbeck',{window:'2y'}),/Rückblick/);
});
const topic=(n,eventDate)=>({id:'billerbeck-top-'+n,regionId:'billerbeck',source:'city',sourceUrl:'https://fixture.example/agendaitem/'+n,officialTitle:'Thema '+n,title:'Thema '+n,status:'consulting',eventDate,updatedAt:eventDate+'T10:00:00.000Z',events:[{url:'https://fixture.example/meeting/'+n,date:eventDate,committee:'Rat',status:'consulting',description:'Beratung'}],documents:[]});
const stored=(extra={})=>({topics:[topic(1,'2026-03-01')],coverage:{from:'2025-09-27',to:'2026-09-27',complete:false,window:'12m',importedAt:'2026-09-27T10:00:00.000Z',issues:['Listenlimit erreicht'],...extra}});
const refresh=(topics,extra={})=>({topics,coverage:{from:'2026-09-21',to:'2026-09-28',complete:true,window:'1w',quiet:false,importedAt:'2026-09-28T10:00:00.000Z',issues:[],...extra}});
test('a narrower refresh adds articles without shrinking the stored period or completing an older partial one',()=>{
 let merged=mergeImport(stored(),refresh([topic(2,'2026-09-25')]));
 assert.equal(merged.topics.length,2);assert.equal(merged.quiet,false);
 assert.equal(merged.coverage.from,'2025-09-27');assert.equal(merged.coverage.window,'12m');assert.equal(merged.coverage.lastWindow,'1w');assert.equal(merged.coverage.lastWindowFrom,'2026-09-21');
 assert.equal(merged.coverage.complete,false);assert.ok(!('quiet' in merged.coverage));
 merged=mergeImport(stored({complete:true}),refresh([topic(2,'2026-09-25')]));assert.equal(merged.coverage.complete,true);
 // Legacy status without a recorded window counts as twelve months.
 merged=mergeImport(stored({window:undefined}),refresh([topic(2,'2026-09-25')]));assert.equal(merged.coverage.from,'2025-09-27');assert.equal(merged.coverage.window,'12m');
 // An equal or wider window replaces the status as before.
 merged=mergeImport({topics:[topic(1,'2026-09-22')],coverage:{from:'2026-09-21',complete:true,window:'1w',importedAt:'2026-09-28T10:00:00.000Z'}},{topics:[topic(3,'2026-07-01')],coverage:{from:'2026-06-29',complete:true,window:'3m',quiet:false,importedAt:'2026-09-29T10:00:00.000Z',issues:[]}});
 assert.equal(merged.coverage.from,'2026-06-29');assert.equal(merged.coverage.window,'3m');assert.equal(merged.coverage.lastWindow,undefined);
});
test('a short window without meetings keeps the stored status; twelve empty months still count as a gap',()=>{
 const quietWeek=refresh([],{complete:false,quiet:true,issues:['Noch keine Artikel erfolgreich erfasst.']});
 let merged=mergeImport(stored({complete:true}),quietWeek);
 assert.equal(merged.quiet,true);assert.equal(merged.topics.length,1);assert.equal(merged.coverage.complete,true);assert.equal(merged.coverage.from,'2025-09-27');
 assert.equal(merged.coverage.lastWindow,'1w');assert.equal(merged.coverage.lastAttemptAt,'2026-09-28T10:00:00.000Z');assert.deepEqual(merged.coverage.issues,['Listenlimit erreicht']);
 // Errors are never quiet, and a full year without any article remains suspicious.
 merged=mergeImport(stored({complete:true}),refresh([],{complete:false,quiet:false,issues:['HTTP 500']}));assert.equal(merged.quiet,false);assert.equal(merged.coverage.complete,false);
 merged=mergeImport(stored({complete:true}),refresh([],{complete:false,quiet:true,window:'12m',from:'2025-09-28'}));assert.equal(merged.quiet,false);assert.equal(merged.coverage.complete,false);assert.ok(merged.coverage.issues.some(i=>/lieferte keine Artikel/.test(i)));
 const previous={lastSuccessAt:'2026-09-27T10:00:00.000Z',lastCompleteAt:'2026-09-27T10:00:00.000Z',failureCount:0};
 assert.deepEqual(importHealth(previous,{at:'2026-09-28T10:00:00.000Z',count:0,complete:false,quiet:true}),{lastAttemptAt:'2026-09-28T10:00:00.000Z',lastSuccessAt:previous.lastSuccessAt,lastCompleteAt:previous.lastCompleteAt,attemptStatus:'unchanged',failureCount:0,nextRetryAt:null});
 assert.equal(importHealth(previous,{at:'2026-09-28T10:00:00.000Z',count:0,complete:false}).attemptStatus,'empty');
 assert.equal(importHealth(previous,{at:'2026-09-28T10:00:00.000Z',failed:true,quiet:true}).attemptStatus,'failed');
});
function fixture(){const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));return {sql,db:sqliteAdapter(sql)};}
test('admin pipeline fixes the chosen window per job, passes it to the import and validates it',async()=>{
 const {sql,db}=fixture();const calls=[];
 const run=async(...args)=>{calls.push(args);return {status:200,data:{topics:0,quiet:true,attemptComplete:true,coverage:{complete:false,issues:[]}}};};
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:['billerbeck'],window:'1w'},run);
 assert.equal(job.window,'1w');assert.equal(calls.length,0);
 job=await pipelineAction(db,{action:'step',id:job.id},run);
 assert.deepEqual(calls[0],['metadata','billerbeck','1w']);assert.equal(job.status,'completed');assert.equal(job.items[0].status,'completed');assert.match(job.items[0].message,/Keine Sitzungen im gewählten Zeitraum/);
 // Without a choice the job keeps the established twelve months.
 job=await pipelineAction(db,{action:'create',stage:'metadata',regions:['billerbeck']},run);assert.equal(job.window,'12m');
 job=await pipelineAction(db,{action:'step',id:job.id},async(...args)=>{calls.push(args);return {status:200,data:{topics:5,attemptComplete:true,coverage:{complete:false,issues:[]}}};});
 assert.deepEqual(calls[1],['metadata','billerbeck','12m']);assert.equal(job.items[0].status,'completed');assert.equal(job.items[0].processed,5);
 await assert.rejects(pipelineAction(db,{action:'create',stage:'metadata',regions:['billerbeck'],window:'2y'},run),/Zeitraum/);
 // Rule labelling has no look-back window.
 job=await pipelineAction(db,{action:'create',stage:'analysis',regions:['billerbeck'],window:'1w'},run);assert.equal(job.window,undefined);
 await pipelineAction(db,{action:'step',id:job.id},async(...args)=>{calls.push(args);return {status:200,data:{processed:0,remaining:0}};});
 assert.deepEqual(calls[2],['analysis','billerbeck',undefined]);sql.close();
});
test('SessionNet calendars that link the meeting overview (si0056) lead to the agenda page (si0057)',async()=>{
 const {meetingRows}=await import('../server/integrations/sessionnet.mjs');
 const html='<a href="si0056.asp?__ksinr=15478" title="Details anzeigen: Kreistag 10.09.2026">Kreistag</a><a href="si0057.php?__ksinr=7" title="Details anzeigen: Rat 11.09.2026">Rat</a><a href="si0056.asp?__ksinr=1">ohne Datum</a>';
 const rows=meetingRows(html,'https://example.test/bi/');
 assert.deepEqual(rows.map(r=>[r.url,r.date,r.committee]),[['https://example.test/bi/si0057.asp?__ksinr=15478','2026-09-10','Kreistag'],['https://example.test/bi/si0057.php?__ksinr=7','2026-09-11','Rat']]);
});
