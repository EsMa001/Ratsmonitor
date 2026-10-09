import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {refreshRegionFacts} from '../server/integrations/region-facts.mjs';
import {readSeries,pendingRegions,SERIES_VERSION,FIGURES_VERSION} from '../server/integrations/region-series.mjs';

const root=path.resolve(import.meta.dirname,'..');
const fresh=()=>{const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));return sql;};
const now=new Date('2026-10-08T12:00:00Z');
const put=(sql,id,extra={})=>{
 const t={id,regionId:'billerbeck',status:'consulting',title:'Vorlage '+id,updatedAt:'2026-10-01T12:00:00Z',classification:{primary:'bildung'},documents:[],events:[],...extra};
 // As the import writes (sync.ts): an upsert, so the update trigger sees the former area of a moved report.
 sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET region_id=excluded.region_id,source=excluded.source,event_date=excluded.event_date,updated_at=excluded.updated_at,status=excluded.status,payload=excluded.payload').run(id,t.regionId,'city',t.eventDate||'2026-09-20',t.updatedAt,t.status,JSON.stringify(t));
};
const rows=(sql,table)=>sql.prepare(`SELECT * FROM ${table} ORDER BY region_id`).all().map(r=>{const {computed_at,...rest}=r;return {...rest};});
/** A small deterministic random generator, so a failing round can be repeated. */
const random=seed=>()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const AREAS=['billerbeck','muenster','coesfeld','de-02000000','area-x'];
const DAYS=['2026-08-01','2026-08-01T10:00','2026-09-20','2026-1-5','unbekannt',null];
function randomTopic(rand,id){
 const pick=list=>list[Math.floor(rand()*list.length)];
 const events=Array.from({length:Math.floor(rand()*3)},()=>({date:pick(DAYS)})).filter(e=>e.date!==null);
 const documents=Array.from({length:Math.floor(rand()*3)},()=>({kind:pick(['application/pdf','pdf','text/html'])}));
 return {regionId:pick(AREAS),status:pick(['consulting','approved','unknown']),events,documents,classification:{primary:pick(['bildung','unklar','bauen'])},
  metadata:rand()<0.8?{firstImportedAt:pick(['2026-09-01T08:00:00Z','2026-09-02T08:00:00Z'])}:{},
  contentAnalysis:rand()<0.3?{status:pick(['completed','stale'])}:undefined};
}

test('catching up after random changes gives the same rows as a full build',async()=>{
 const sql=fresh(),db=sqliteAdapter(sql),rand=random(7);
 for(let i=0;i<40;i++)put(sql,'t'+i,randomTopic(rand,'t'+i));
 const built=await refreshRegionFacts(db,{budgetMs:1e9,now});assert.equal(built.pending+built.unbuilt,0);assert.ok(built.done>0);
 for(let round=0;round<6;round++){
  for(let k=0;k<6;k++){
   const id='t'+Math.floor(rand()*50),op=rand();
   if(op<0.4)put(sql,id,randomTopic(rand,id));
   else if(op<0.55)put(sql,id,{...randomTopic(rand,id),identity:{mergedInto:'t0'}});
   else if(op<0.7)sql.prepare('DELETE FROM topics WHERE id=?').run(id);
   else sql.prepare('UPDATE topics SET region_id=? WHERE id=?').run(AREAS[Math.floor(rand()*AREAS.length)],id);
  }
  const step=await refreshRegionFacts(db,{budgetMs:1e9,chunkRows:3,now});
  assert.equal(step.pending+step.unbuilt,0,'round '+round);
  const incremental=[rows(sql,'region_stats'),rows(sql,'region_series')];
  sql.exec('DELETE FROM region_stats;DELETE FROM region_series');
  await refreshRegionFacts(db,{budgetMs:1e9,now});
  const rebuilt=[rows(sql,'region_stats'),rows(sql,'region_series')];
  for(const t of [0,1])for(const [i,row] of incremental[t].entries())assert.deepEqual(row,rebuilt[t][i],'round '+round+' '+['region_stats','region_series'][t]);
  assert.deepEqual(incremental,rebuilt,'round '+round);
 }
 const series=await readSeries(db);
 for(const [,row] of series){assert.equal(row.v,SERIES_VERSION);assert.ok(Array.isArray(row.eventDays)&&Array.isArray(row.importDays));}
});

test('series keep raw and missing days, sum the estimate columns and count statuses',async()=>{
 const sql=fresh(),db=sqliteAdapter(sql);
 put(sql,'a',{events:[{date:'2026-08-01T09:00'},{date:'2026-09-20'}],documents:[{kind:'application/pdf'},{kind:'pdf'}],metadata:{firstImportedAt:'2026-09-01T08:00:00Z'}});
 put(sql,'b',{events:[{date:'2026-08-01'}],status:'approved',metadata:{firstImportedAt:'2026-09-01T09:00:00Z'}});
 put(sql,'c',{events:[{date:'2026-1-5'}],documents:[{kind:'text/html'}]});
 put(sql,'d',{events:[]});
 put(sql,'alias',{events:[{date:'2026-08-01'}],identity:{mergedInto:'a'}});
 await refreshRegionFacts(db,{budgetMs:1e9,now});
 const row=(await readSeries(db)).get('billerbeck');
 // [day, reports, with PDF, PDF links, reports on more than one day, meeting days]
 assert.deepEqual(row.eventDays,[[null,1,0,0,0,0],['2026-08-01',2,1,2,1,3],['2026-1-5',1,0,0,0,1]]);
 assert.deepEqual(row.importDays,[[null,2],['2026-09-01',2]]);
 assert.deepEqual(row.statuses,{approved:1,consulting:3});
 const stats=JSON.parse(sql.prepare("SELECT stats FROM region_stats WHERE region_id='billerbeck'").get().stats);
 assert.equal(stats.count,4);assert.equal(stats.v,FIGURES_VERSION);assert.equal(stats.firstEvent,'2026-08-01');
});

test('a call with a small budget leaves areas pending; the next call continues',async()=>{
 const sql=fresh(),db=sqliteAdapter(sql);
 for(const [i,area] of AREAS.entries())put(sql,'t'+i,{regionId:area});
 const first=await refreshRegionFacts(db,{budgetMs:0,chunkRows:1,now});
 assert.equal(first.done,1);assert.equal(first.pending+first.unbuilt,AREAS.length-1);
 assert.deepEqual(await pendingRegions(db),{pending:0,unbuilt:AREAS.length-1,total:AREAS.length});
 let calls=1;while((await refreshRegionFacts(db,{budgetMs:0,chunkRows:1,now})).done)calls++;
 assert.equal(calls,AREAS.length);
 assert.deepEqual(await pendingRegions(db),{pending:0,unbuilt:0,total:AREAS.length});
 /* A changed area counts as pending (rows present, other revision), a missing row as unbuilt */
 put(sql,'t0',{regionId:AREAS[0],title:'neu'});sql.exec("DELETE FROM region_series WHERE region_id='"+AREAS[1]+"'");
 assert.deepEqual(await pendingRegions(db),{pending:1,unbuilt:1,total:AREAS.length});
 /* Rows of an older version are stale */
 await refreshRegionFacts(db,{budgetMs:1e9,now});sql.exec('UPDATE region_series SET v=0');
 assert.equal((await pendingRegions(db)).pending,AREAS.length);
});

test('a row is never replaced by one computed at an older revision',async()=>{
 const sql=fresh(),db=sqliteAdapter(sql);
 put(sql,'a');await refreshRegionFacts(db,{budgetMs:1e9,now});
 sql.exec("UPDATE region_series SET revision=revision+5,event_days='[\"keep\"]';UPDATE region_stats SET revision=revision+5,stats='{\"keep\":1}'");
 /* Another version forces a new computation, which reads the older revision of region_revisions */
 sql.exec('UPDATE region_series SET v=0');sql.exec("UPDATE region_stats SET stats=json_set(stats,'$.v',0)");
 await refreshRegionFacts(db,{budgetMs:1e9,now});
 assert.equal(sql.prepare('SELECT event_days FROM region_series').get().event_days,'["keep"]');
 assert.equal(JSON.parse(sql.prepare('SELECT stats FROM region_stats').get().stats).keep,1);
});

test('statements stay within the limits of D1: 100 parameters, 100 KB per value, few writes per call',async()=>{
 const sql=fresh(),base=sqliteAdapter(sql);
 for(let i=0;i<700;i++)put(sql,'t'+i,{regionId:'area-'+String(i).padStart(3,'0'),events:[{date:'2026-08-'+String(1+i%28).padStart(2,'0')}]});
 const binds=[],batches=[];
 const strict={prepare(q){const s=base.prepare(q),bind=s.bind.bind(s);s.bind=(...v)=>{binds.push(v);if(v.length>100)throw Error('D1_ERROR: too many SQL variables');return bind(...v);};return s;},batch:s=>{batches.push(s.length);return base.batch(s);}};
 const result=await refreshRegionFacts(strict,{budgetMs:1e9,now});
 assert.equal(result.done,700);
 assert.ok(binds.every(v=>v.length<=100));
 assert.ok(binds.every(v=>v.every(x=>typeof x!=='string'||new TextEncoder().encode(x).length<100000)),'every bound value below 100 KB');
 // Two chunks (at most 500 ids each), each written in one transaction with one statement per table and pack.
 assert.equal(batches.length,1+2);assert.ok(batches.every(n=>n<=10),'statements per batch: '+batches);
});

test('the series query reads the chunk through the canonical index, with three subqueries per report',()=>{
 const sql=fresh();
 const source=fs.readFileSync(path.join(root,'server','integrations','region-facts.mjs'),'utf8');
 const query=source.match(/const SERIES_SQL=`([\s\S]*?)`;/)[1].replace('${canonical}',"json_extract(payload,'$.identity.mergedInto') IS NULL");
 const plan=sql.prepare('EXPLAIN QUERY PLAN '+query).all('["x"]').map(r=>r.detail);
 assert.ok(plan.includes('MATERIALIZE t'),plan.join('\n'));
 assert.ok(plan.some(d=>/SEARCH topics USING INDEX idx_topics_canonical_region_updated/.test(d)),plan.join('\n'));
 const subqueries=plan.map((d,i)=>[d,i]).filter(([d])=>/CORRELATED SCALAR SUBQUERY/.test(d));
 assert.equal(subqueries.length,3);
 assert.ok(subqueries.every(([,i])=>i<plan.indexOf('SCAN t')),'all evaluated while materializing');
});

test('without migration 0016 nothing is read and the missing table is reported',async()=>{
 const sql=fresh();sql.exec('DROP TABLE region_series');const db=sqliteAdapter(sql);put(sql,'a');
 assert.equal(await readSeries(db),null);
 assert.deepEqual(await pendingRegions(db),{missing:'0016'});
 assert.deepEqual(await refreshRegionFacts(db,{now}),{missing:'0016'});
});

test('with regions given, only those areas are read (the import of an area)',async()=>{
 const sql=fresh(),base=sqliteAdapter(sql);
 put(sql,'a');put(sql,'b',{regionId:'muenster'});
 const asked=[];const watched={prepare(q){const s=base.prepare(q),bind=s.bind.bind(s);const entry={q,args:[]};asked.push(entry);s.bind=(...v)=>{entry.args=v;return bind(...v);};return s;},batch:s=>base.batch(s)};
 const result=await refreshRegionFacts(watched,{regions:['billerbeck'],budgetMs:1e9,now});
 assert.equal(result.done,1);
 assert.deepEqual(sql.prepare('SELECT region_id FROM region_series').all().map(r=>r.region_id),['billerbeck']);
 const reads=asked.filter(a=>/^\s*(SELECT|WITH)/.test(a.q));
 assert.ok(reads.every(a=>/region_id IN \(SELECT value FROM json_each\(\?\)\)/.test(a.q)&&a.args[0]==='["billerbeck"]'),reads.map(a=>a.q.slice(0,80)).join('\n'));
 assert.ok(!reads.some(a=>/FROM region_stats(?! WHERE region_id IN)/.test(a.q)),'region_stats only for the area');
});
