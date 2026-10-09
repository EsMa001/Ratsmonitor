// Computes the values per area of the administration: region_stats (figures of the overview, FIGURES in
// admin-data.mjs) and region_series (reports by first agenda day, by import day and by status, migration 0016).
// Only areas whose revision (region_revisions, triggers of migration 0011) differs from the one their row was computed
// at, or whose row was computed by another version, are read again; smallest first, a few at a time until the budget is
// spent. Called by the import of an area for that area (server/services/sync.ts), by the catch-up steps of the
// administration (admin-refresh.mjs) and locally by scripts/refresh-admin.mjs. Pages never compute (region-series.mjs).
import {FIGURES} from './admin-data.mjs';
import {SERIES_VERSION,FIGURES_VERSION,binary,missingTable} from './region-series.mjs';
const canonical="json_extract(payload,'$.identity.mergedInto') IS NULL";
// Per report: first agenda day, day of first import, linked PDFs and meeting days. The expressions are those of
// admin-timeline.mjs (days) and admin-estimate.mjs (DETAILS_SQL). MATERIALIZED keeps the grouping from evaluating them
// again.
const SERIES_SQL=`WITH t AS MATERIALIZED (
  SELECT region_id,
    substr((SELECT min(json_extract(value,'$.date')) FROM json_each(payload,'$.events')),1,10) eday,
    substr(json_extract(payload,'$.metadata.firstImportedAt'),1,10) iday,
    (SELECT count(*) FROM json_each(payload,'$.documents') WHERE json_extract(value,'$.kind') IN ('application/pdf','pdf')) pdfs,
    (SELECT count(DISTINCT substr(json_extract(value,'$.date'),1,10)) FROM json_each(payload,'$.events')) days
  FROM topics WHERE ${canonical} AND region_id IN (SELECT value FROM json_each(?)))
SELECT region_id,eday,iday,count(*) n,sum(pdfs>0) wd,sum(pdfs) links,sum(days>1) fu,sum(days) cons
FROM t GROUP BY region_id,eday,iday`;
const STATUS_SQL=`SELECT region_id,status,count(*) n FROM topics WHERE ${canonical} AND region_id IN (SELECT value FROM json_each(?)) GROUP BY 1,2`;
const STATS_SQL=`SELECT region_id,count(*) count,${FIGURES} FROM topics WHERE ${canonical} AND region_id IN (SELECT value FROM json_each(?)) GROUP BY region_id`;
// D1 takes at most about 100 KB per bound value: rows are written as JSON lists of at most this many characters.
const MAX_JSON=90000;
const MAX_IDS=500;
/** JSON lists of rows, each at most MAX_JSON characters (a single larger row gets a list of its own). */
function packs(rows){
 const out=[];let pack=[],size=2;
 for(const row of rows){const n=JSON.stringify(row).length+1;if(pack.length&&size+n>MAX_JSON){out.push(JSON.stringify(pack));pack=[];size=2;}pack.push(row);size+=n;}
 if(pack.length)out.push(JSON.stringify(pack));
 return out;
}
const UPSERT_SERIES=`INSERT INTO region_series(region_id,revision,v,computed_at,event_days,import_days,statuses)
SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]'),
       json_extract(value,'$[4]'),json_extract(value,'$[5]'),json_extract(value,'$[6]')
FROM json_each(?) WHERE true
ON CONFLICT(region_id) DO UPDATE SET revision=excluded.revision,v=excluded.v,computed_at=excluded.computed_at,
  event_days=excluded.event_days,import_days=excluded.import_days,statuses=excluded.statuses
WHERE excluded.revision>=region_series.revision`;
const UPSERT_STATS=`INSERT INTO region_stats(region_id,revision,computed_at,stats)
SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]')
FROM json_each(?) WHERE true
ON CONFLICT(region_id) DO UPDATE SET revision=excluded.revision,computed_at=excluded.computed_at,stats=excluded.stats
WHERE excluded.revision>=region_stats.revision`;
/** Rows of the series query of one chunk folded per area: event_days, import_days (days kept raw, null first). */
function foldSeries(rows){
 const areas=new Map();
 for(const r of rows){
  let a=areas.get(r.region_id);if(!a){a={event:new Map(),import:new Map()};areas.set(r.region_id,a);}
  const eday=r.eday??null,iday=r.iday??null;
  const e=a.event.get(eday)||[eday,0,0,0,0,0];
  e[1]+=Number(r.n||0);e[2]+=Number(r.wd||0);e[3]+=Number(r.links||0);e[4]+=Number(r.fu||0);e[5]+=Number(r.cons||0);a.event.set(eday,e);
  const i=a.import.get(iday)||[iday,0];i[1]+=Number(r.n||0);a.import.set(iday,i);
 }
 const sorted=map=>[...map.values()].sort((x,y)=>binary(x[0],y[0]));
 return new Map([...areas].map(([id,a])=>[id,{eventDays:sorted(a.event),importDays:sorted(a.import)}]));
}
/** Chunks of areas: sizes add up to at most chunkRows, at most MAX_IDS ids; a larger area forms a chunk of its own. */
function chunks(list,chunkRows){
 const out=[];let chunk=[],rows=0;
 for(const item of list){if(chunk.length&&(rows+item.rows>chunkRows||chunk.length>=MAX_IDS)){out.push(chunk);chunk=[];rows=0;}chunk.push(item);rows+=item.rows;}
 if(chunk.length)out.push(chunk);
 return out;
}
/**
 * Computes stale and missing areas (region_stats and/or region_series), smallest first, chunk by chunk until budgetMs is
 * spent (at least one chunk per call). regions: only these areas (the import of an area).
 * Returns {done,pending,unbuilt,ms}, or {missing:'0016'} without the tables. pending and unbuilt are the areas left over
 * among those looked at (stale rows and areas without rows); the next call continues with them.
 * Safe to run twice at once: a row is never replaced by one computed at an older revision.
 */
export async function refreshRegionFacts(db,{regions,budgetMs=5000,chunkRows=25000,now=new Date()}={}){
 const started=Date.now();
 const only=Array.isArray(regions),ids=only?JSON.stringify([...new Set(regions.map(String))]):null;
 const filter=(column='region_id')=>only?` WHERE ${column} IN (SELECT value FROM json_each(?))`:'';
 const bound=statement=>only?statement.bind(ids):statement;
 if(only&&!JSON.parse(ids).length)return {done:0,pending:0,unbuilt:0,ms:0};
 let revisions,stats,series,sizes;
 try{
  // The revisions are read before the reports: a change during the scan leaves a row of the older revision, which
  // counts as stale and is read again.
  [revisions,stats,series,sizes]=await db.batch([
   bound(db.prepare('SELECT region_id,revision FROM region_revisions'+filter())),
   bound(db.prepare("SELECT region_id,revision,json_extract(stats,'$.v') v FROM region_stats"+filter())),
   bound(db.prepare('SELECT region_id,revision,v FROM region_series'+filter())),
   bound(db.prepare(`SELECT region_id,count(*) n FROM topics WHERE ${canonical}${only?' AND region_id IN (SELECT value FROM json_each(?))':''} GROUP BY region_id`))
  ]);
 }catch(e){if(missingTable(e))return {missing:'0016'};throw e;}
 const statsAt=new Map(stats.results.map(r=>[r.region_id,r])),seriesAt=new Map(series.results.map(r=>[r.region_id,r]));
 const size=new Map(sizes.results.map(r=>[r.region_id,Number(r.n)]));
 const todo=[];
 for(const r of revisions.results){
  const revision=Number(r.revision),s=statsAt.get(r.region_id),t=seriesAt.get(r.region_id);
  const needStats=!s||Number(s.revision)!==revision||Number(s.v)!==FIGURES_VERSION,needSeries=!t||Number(t.revision)!==revision||Number(t.v)!==SERIES_VERSION;
  if(needStats||needSeries)todo.push({id:r.region_id,revision,rows:size.get(r.region_id)||0,stats:needStats,series:needSeries,unbuilt:!s||!t});
 }
 todo.sort((a,b)=>a.rows-b.rows||binary(a.id,b.id));
 let done=0;
 for(const chunk of chunks(todo,chunkRows)){
  if(done&&Date.now()-started>=budgetMs)break;
  const at=now.toISOString(),writes=[];
  const statIds=chunk.filter(c=>c.stats).map(c=>c.id),seriesIds=chunk.filter(c=>c.series).map(c=>c.id);
  if(statIds.length){
   const found=new Map((await db.prepare(STATS_SQL).bind(JSON.stringify(statIds)).all()).results.map(r=>[r.region_id,r]));
   // An area without canonical reports gets empty figures, so it is not read again until it changes.
   const rows=chunk.filter(c=>c.stats).map(c=>[c.id,c.revision,at,JSON.stringify({...(found.get(c.id)||{region_id:c.id,count:0}),v:FIGURES_VERSION})]);
   for(const pack of packs(rows))writes.push(db.prepare(UPSERT_STATS).bind(pack));
  }
  if(seriesIds.length){
   const list=JSON.stringify(seriesIds);
   const [days,statuses]=await Promise.all([db.prepare(SERIES_SQL).bind(list).all(),db.prepare(STATUS_SQL).bind(list).all()]);
   const folded=foldSeries(days.results),byStatus=new Map();
   for(const r of statuses.results){const s=byStatus.get(r.region_id)||{};s[r.status]=Number(r.n);byStatus.set(r.region_id,s);}
   const rows=chunk.filter(c=>c.series).map(c=>{const f=folded.get(c.id)||{eventDays:[],importDays:[]};return [c.id,c.revision,SERIES_VERSION,at,JSON.stringify(f.eventDays),JSON.stringify(f.importDays),JSON.stringify(byStatus.get(c.id)||{})];});
   for(const pack of packs(rows))writes.push(db.prepare(UPSERT_SERIES).bind(pack));
  }
  // One transaction per chunk: both tables of an area change together.
  if(writes.length)await db.batch(writes);
  done+=chunk.length;
 }
 const left=todo.slice(done);
 return {done,pending:left.filter(c=>!c.unbuilt).length,unbuilt:left.filter(c=>c.unbuilt).length,ms:Date.now()-started};
}
