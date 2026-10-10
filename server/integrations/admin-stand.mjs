// Stand of the administration's data, in one batch of small queries (a few ms): how far the stock and the values per area
// are, for the ETags of the reading routes (admin-http.ts) and the stand line of the pages (components/admin-stand.tsx).
// stockSum rises with every change of a report (triggers of migration 0011); content (data_revisions content + coverage) also with
// changes of source states, versions and analyses. The stamps of region_series and region_stats include the time of their last
// computation, so a new build at the same revision (--full, a new version) changes them as well.
import {pendingRegions,missingTable,SERIES_VERSION,FIGURES_VERSION} from './region-series.mjs';
import {SOURCES_REVISION_SQL} from './revision-cache.mjs';
/** {stock,stockSum,seriesStamp,statsStamp,pending,unbuilt,total,content,seriesComputedAt,statsComputedAt} or {missing:'0016',content,stockSum}. */
export async function adminStand(db){
 // content: with the source states (the area list shows them), see SOURCES_REVISION_SQL.
 const content=async()=>Number((await db.prepare(SOURCES_REVISION_SQL).first())?.revision||0);
 let stock,series,stats;
 try{
  [stock,series,stats]=await db.batch([
   db.prepare('SELECT count(*) n,total(revision) s FROM region_revisions'),
   db.prepare('SELECT count(*) n,total(revision) s,max(computed_at) m FROM region_series'),
   db.prepare('SELECT count(*) n,total(revision) s,max(computed_at) m FROM region_stats'),
  ]);
 }catch(e){
  if(!missingTable(e))throw e;
  let stockSum=0;try{stockSum=Number((await db.prepare('SELECT total(revision) s FROM region_revisions').first())?.s||0);}catch(e){console.error('[admin-stand] region_revisions nicht lesbar:',e);}
  return {missing:'0016',content:await content(),stockSum};
 }
 const one=r=>r.results[0]||{},left=await pendingRegions(db);
 const st=one(stock),se=one(series),sa=one(stats);
 return {stock:Number(st.n||0),stockSum:Number(st.s||0),
  seriesStamp:`${se.n||0}:${se.s||0}:${se.m||''}`,statsStamp:`${sa.n||0}:${sa.s||0}:${sa.m||''}`,
  pending:Number(left.pending||0),unbuilt:Number(left.unbuilt||0),total:Number(left.total||0),
  content:await content(),seriesComputedAt:se.m||null,statsComputedAt:sa.m||null};
}
/** Version parts every ETag of values per area carries. */
export const VERSIONS=`s${SERIES_VERSION}f${FIGURES_VERSION}`;
/**
 * Stand of a view derived from the values per area (class B): computed at the latest computation of the table it reads,
 * stale while areas are pending.
 * @param {any} s adminStand
 * @param {'series'|'stats'} table
 */
export function derivedStand(s,table='series'){
 if(s.missing)return {computedAt:null,stale:false,changes:null,pending:0,unbuilt:0,total:0,missing:'0016'};
 return {computedAt:(table==='stats'?s.statsComputedAt:s.seriesComputedAt)||null,stale:s.pending>0,changes:s.pending,pending:s.pending,unbuilt:s.unbuilt,total:s.total};
}
/**
 * Stand of a stored evaluation (class C): changes are the changes of reports since it was computed (stockSum then and
 * now); without a stockSum of its own it counts as stale. build: state of a running build, if any.
 * @param {any} s adminStand
 * @param {{computedAt?:string|null,stockSum?:number|null}|null} meta
 * @param {any} [build]
 */
export function storedStand(s,meta,build=null){
 const computedAt=meta?.computedAt||null;
 const changes=!computedAt?null:typeof meta?.stockSum==='number'?Math.max(0,Number(s.stockSum||0)-meta.stockSum):null;
 return {computedAt,stale:computedAt?changes!==0:false,changes,pending:0,unbuilt:0,total:0,...(build?{build}:{})};
}
