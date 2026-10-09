// Reports per area with the first agenda day and the latest meeting day of its stored reports: from region_stats
// (regionFigures in admin-data.mjs, read only; computed by region-facts.mjs) or, without migration 0011, from one scan kept
// until the stock changes (revision-cache.mjs). Shared by the gap atlas and the overview of the administration.
import {regionFigures} from './admin-data.mjs';
import {atRevision} from './revision-cache.mjs';
import {FIRST_DAY_SQL,LAST_DAY_SQL} from './admin-timeline.mjs';
const canonical="json_extract(payload,'$.identity.mergedInto') IS NULL";
/**
 * @returns {Promise<{rows:Map<string,{count:number,first:string|null,last:string|null}>,pending:number}>} pending: areas
 * whose figures are still being computed (they keep count, first and last of their previous computation, if any).
 */
export async function areaFigures(db,{now=new Date()}={}){
 const figures=await regionFigures(db,{now});
 if(figures)return {rows:new Map(figures.rows.map(r=>[r.region_id,{count:Number(r.count||0),first:r.firstEvent||null,last:r.lastEvent||null}])),pending:figures.pending};
 const rows=await atRevision(db,'area-figures',async()=>(await db.prepare(`SELECT region_id,count(*) n,min(${FIRST_DAY_SQL}) first,max(${LAST_DAY_SQL}) last FROM topics WHERE ${canonical} GROUP BY region_id`).all()).results);
 return {rows:new Map(rows.map(r=>[r.region_id,{count:Number(r.n),first:r.first||null,last:r.last||null}])),pending:0};
}
