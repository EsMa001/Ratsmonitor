import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {bucketStart,mergeAreas,rangeStart,timelineSeries,timelineStats,TIMELINE_BUCKETS,TIMELINE_RANGES,TIMELINE_BASES} from '../shared/timeline.mjs';
import {adminTimeline} from '../server/integrations/admin-timeline.mjs';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {refreshRegionFacts} from '../server/integrations/region-facts.mjs';
test('buckets start on the day, on Monday or on the first of the month',()=>{
 assert.deepEqual(Object.keys(TIMELINE_BUCKETS),['day','week','month']);assert.deepEqual(Object.keys(TIMELINE_RANGES),['3m','12m','24m','all']);assert.deepEqual(Object.keys(TIMELINE_BASES),['event','import']);
 assert.equal(bucketStart('2026-09-30','day'),'2026-09-30');assert.equal(bucketStart('2026-09-30','week'),'2026-09-28');assert.equal(bucketStart('2026-09-28','week'),'2026-09-28');
 assert.equal(bucketStart('2026-10-04','week'),'2026-09-28');assert.equal(bucketStart('2027-01-01','week'),'2026-12-28');assert.equal(bucketStart('2026-09-30','month'),'2026-09-01');
});
const dataset={days:['2025-06-01','2026-09-01','2026-09-02','2026-09-28','2026-10-20'],areas:{a:[[0,5],[1,2],[3,4]],b:[[1,1],[2,3],[4,6]],c:[]},undated:{b:7}};
test('areas are added up for the chosen selection; all areas when nothing is chosen',()=>{
 const all=mergeAreas(dataset);assert.deepEqual([...all.counts],[['2025-06-01',5],['2026-09-01',3],['2026-09-28',4],['2026-09-02',3],['2026-10-20',6]]);assert.equal(all.undated,7);assert.equal(all.areas,2);
 const onlyA=mergeAreas(dataset,new Set(['a','c','unknown']));assert.deepEqual([...onlyA.counts],[['2025-06-01',5],['2026-09-01',2],['2026-09-28',4]]);assert.equal(onlyA.undated,0);assert.equal(onlyA.areas,1);
 assert.equal(mergeAreas(dataset,[]).counts.size,0);assert.equal(mergeAreas(dataset,['b']).undated,7);
});
test('the series fills empty buckets, counts earlier and undated reports into the stock and keeps scheduled ones apart',()=>{
 const {counts,undated}=mergeAreas(dataset);
 const weekly=timelineSeries(counts,{bucket:'week',from:'2026-09-01',to:'2026-10-01',undated});
 assert.deepEqual(weekly.points,[{start:'2026-08-31',count:6,total:18},{start:'2026-09-07',count:0,total:18},{start:'2026-09-14',count:0,total:18},{start:'2026-09-21',count:0,total:18},{start:'2026-09-28',count:4,total:22}]);
 assert.equal(weekly.before,12);assert.equal(weekly.after,6);assert.equal(weekly.total,22);
 const daily=timelineSeries(counts,{bucket:'day',from:'2026-09-01',to:'2026-09-03'});assert.deepEqual(daily.points.map(p=>[p.start,p.count,p.total]),[['2026-09-01',3,8],['2026-09-02',3,11],['2026-09-03',0,11]]);
 const monthly=timelineSeries(counts,{bucket:'month',from:'2025-06-01',to:'2026-10-01'});assert.equal(monthly.points.length,17);assert.equal(monthly.points[0].count,5);assert.equal(monthly.points.at(-2).count,10);assert.equal(monthly.points.at(-1).count,0);
 assert.throws(()=>timelineSeries(counts,{bucket:'year',from:'2026-09-01',to:'2026-10-01'}),/Zeitraster/);assert.throws(()=>timelineSeries(counts,{from:'2026-10-02',to:'2026-10-01'}),/Zeitraum/);
});
test('workload figures average over every calendar day and name the peaks',()=>{
 const {counts}=mergeAreas(dataset);const s=timelineStats(counts,{from:'2026-09-01',to:'2026-09-30'});
 assert.equal(s.days,30);assert.equal(s.total,10);const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' ≠ '+b);near(s.perDay,10/30);near(s.perWeek,70/30);near(s.perYear,3650/30);
 assert.equal(s.activeDays,3);assert.equal(s.perActiveDay,10/3);assert.deepEqual(s.peakDay,{day:'2026-09-28',count:4});assert.deepEqual(s.peakWeek,{start:'2026-08-31',count:6});
 const empty=timelineStats(new Map(),{from:'2026-09-01',to:'2026-09-30'});assert.equal(empty.total,0);assert.equal(empty.perDay,0);assert.equal(empty.peakDay,null);assert.equal(empty.perActiveDay,0);
});
test('the period starts a number of calendar months back, or at the first dated report',()=>{
 const {counts}=mergeAreas(dataset);
 assert.equal(rangeStart('3m','2026-10-01',counts),'2026-07-02');assert.equal(rangeStart('12m','2026-10-01',counts),'2025-10-02');assert.equal(rangeStart('12m','2024-02-29',counts),'2023-03-01');
 assert.equal(rangeStart('all','2026-10-01',counts),'2025-06-01');assert.equal(rangeStart('all','2026-10-01',new Map()),'2026-10-01');
});
test('the database query counts each report once on its first meeting day or its first import day',async()=>{
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));const db=sqliteAdapter(sql);
 const put=(id,area,events,extra={})=>sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,area,'city',events.at(-1),'2026-10-01T10:00:00.000Z','unknown',JSON.stringify({id,regionId:area,events:events.map(date=>({date,committee:'Rat'})),...extra}));
 put('a1','billerbeck',['2026-09-03','2026-09-24'],{metadata:{firstImportedAt:'2026-10-01T09:00:00.000Z'}});
 put('a2','billerbeck',['2026-09-24','2026-09-03']);
 put('a3','billerbeck',['2026-09-24'],{metadata:{firstImportedAt:'2026-10-01T18:00:00.000Z'}});
 put('b1','coesfeld',['2026-09-24']);
 put('merged','billerbeck',['2026-09-03'],{identity:{mergedInto:'a1'}});
 const now=new Date('2026-10-01T12:00:00Z');
 // The timeline reads the values per area (region_series); they are computed first, as after an import.
 await refreshRegionFacts(db,{budgetMs:1e9,now});
 const byMeeting=await adminTimeline(db,{basis:'event',now});
 assert.equal(byMeeting.total,4);assert.deepEqual(byMeeting.days,['2026-09-03','2026-09-24']);assert.deepEqual(byMeeting.areas,{billerbeck:[[0,2],[1,1]],coesfeld:[[1,1]]});assert.deepEqual(byMeeting.undated,{});assert.equal(byMeeting.today,'2026-10-01');
 // Reports stored before the import date was recorded are undated, not guessed.
 const byImport=await adminTimeline(db,{basis:'import',now});
 assert.deepEqual(byImport.days,['2026-10-01']);assert.deepEqual(byImport.areas,{billerbeck:[[0,2]]});assert.deepEqual(byImport.undated,{billerbeck:1,coesfeld:1});assert.equal(byImport.total,4);
 await assert.rejects(adminTimeline(db,{basis:'updated'}),/Zeitbezug/);
 // End to end: the stock of Billerbeck by first meeting day.
 const {counts,undated}=mergeAreas(byMeeting,['billerbeck']);const series=timelineSeries(counts,{bucket:'week',from:'2026-09-01',to:'2026-10-01',undated});
 assert.deepEqual(series.points.map(p=>[p.start,p.count,p.total]),[['2026-08-31',2,2],['2026-09-07',0,2],['2026-09-14',0,2],['2026-09-21',1,3],['2026-09-28',0,3]]);sql.close();
});

