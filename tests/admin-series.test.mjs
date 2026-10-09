import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {refreshRegionFacts} from '../server/integrations/region-facts.mjs';
import {readSeries} from '../server/integrations/region-series.mjs';
import {adminTimeline,timelineRowsSql,timelineFromRows} from '../server/integrations/admin-timeline.mjs';
import {detailsFromSeries,DETAILS_SQL} from '../server/integrations/admin-estimate.mjs';

// The views derived from region_series give exactly what the former scans over all reports gave.
const root=path.resolve(import.meta.dirname,'..');
const now=new Date('2026-10-08T12:00:00Z');
function stock(){
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
 let seed=11;const rand=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;},pick=l=>l[Math.floor(rand()*l.length)];
 const days=['2025-10-02','2025-12-24','2026-03-01','2026-08-01','2026-08-01T18:00','2026-09-30','2026-10-08','2026-1-5','unbekannt'];
 for(let i=0;i<300;i++){
  const area=pick(['billerbeck','muenster','coesfeld','de-02000000','zz-unbekannt']);
  const events=Array.from({length:Math.floor(rand()*4)},()=>({date:pick(days)}));
  const documents=Array.from({length:Math.floor(rand()*3)},()=>({kind:pick(['application/pdf','pdf','html'])}));
  const payload={id:'t'+i,regionId:area,events,documents,...(rand()<0.7?{metadata:{firstImportedAt:pick(['2026-09-01T08:00:00Z','2026-10-02T23:59:00Z','2026-10-08T00:00:00Z'])}}:{}),...(rand()<0.1?{identity:{mergedInto:'t0'}}:{})};
  sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run('t'+i,area,'city',events.at(-1)?.date||'','2026-10-01T00:00:00Z',pick(['consulting','approved']),JSON.stringify(payload));
 }
 return sqliteAdapter(sql);
}

test('the timeline from region_series equals the former scan, for both bases and in the same order',async()=>{
 const db=stock();await refreshRegionFacts(db,{budgetMs:1e9,chunkRows:40,now});
 for(const basis of ['event','import']){
  const derived=await adminTimeline(db,{basis,now}),scanned=timelineFromRows(await timelineRowsSql(db,basis),{basis,now});
  assert.deepEqual(derived,scanned,basis);
  assert.ok(Object.keys(derived.undated).length>0,'the fixture has undated reports');
 }
});

test('documents and consultations per area from region_series equal the former scan',async()=>{
 const db=stock();await refreshRegionFacts(db,{budgetMs:1e9,now});
 const series=await readSeries(db,{columns:['event_days']});
 for(const [from,to] of [['2025-10-09','2026-10-08'],['2026-08-01','2026-08-31']]){
  const old=(await db.prepare(DETAILS_SQL).bind(from,to).all()).results.map(r=>({area:r.area,withDocuments:Number(r.withDocuments),links:Number(r.links),followUps:Number(r.followUps),consultations:Number(r.consultations)}));
  const byArea=(a,b)=>a.area<b.area?-1:1;
  assert.deepEqual(detailsFromSeries(series,from,to).sort(byArea),old.sort(byArea),from+'..'+to);
 }
});

test('without migration 0016 the timeline is empty and says so, without reading the reports',async()=>{
 const asked=[];const db={prepare(q){asked.push(q);return {bind(){return this;},async all(){throw Error('D1_ERROR: no such table: region_series');}};}};
 const t=await adminTimeline(db,{basis:'event',now});
 assert.equal(t.missing,'0016');assert.equal(t.total,0);assert.deepEqual(t.days,[]);
 assert.ok(!asked.some(q=>/FROM topics/.test(q)));
});
