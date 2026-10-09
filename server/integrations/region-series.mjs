// Values per area for the administration, read-only (migration 0016). region_series holds per area the reports by
// first agenda day (with the columns of the estimate), by day of first import and by status; region_stats (0011) the
// figures of the overview. Both are computed by region-facts.mjs for areas whose revision changed; pages only read.
// This module imports no admin-* module (admin-data.mjs imports it; region-facts.mjs imports admin-data.mjs).
/** Version of region_series rows: raising it makes every area count again once. */
export const SERIES_VERSION=1;
/** Version of the figures in region_stats (FIGURES in admin-data.mjs). */
export const FIGURES_VERSION=4;
export const SERIES_COLUMNS=['event_days','import_days','statuses'];
const KEYS={event_days:'eventDays',import_days:'importDays',statuses:'statuses'};
export const missingTable=e=>/no such table/i.test(String(e?.message||e));
const parse=(text,fallback)=>{try{return JSON.parse(text);}catch{return fallback;}};
/**
 * Map<region_id,{revision,v,computedAt,eventDays?,importDays?,statuses?}> with the JSON columns parsed, or null if the
 * table is missing. Rows of every age are returned; pendingRegions says how many are stale.
 */
export async function readSeries(db,{columns=SERIES_COLUMNS}={}){
 const wanted=columns.filter(c=>SERIES_COLUMNS.includes(c));
 let rows;
 try{rows=(await db.prepare(`SELECT region_id,revision,v,computed_at${wanted.map(c=>','+c).join('')} FROM region_series`).all()).results;}
 catch(e){if(missingTable(e))return null;throw e;}
 const out=new Map();
 for(const r of rows){const row={revision:Number(r.revision),v:Number(r.v),computedAt:r.computed_at};for(const c of wanted)row[KEYS[c]]=parse(r[c],c==='statuses'?{}:[]);out.set(r.region_id,row);}
 return out;
}
/**
 * {pending,unbuilt,total} over the areas of region_revisions, or {missing:'0016'} without the tables.
 * unbuilt: no row in region_series or region_stats yet (never computed). pending: rows present, but computed at another
 * revision or by another version (stale).
 */
export async function pendingRegions(db){
 try{
  const r=await db.prepare(`SELECT coalesce(sum(s.region_id IS NULL OR t.region_id IS NULL),0) unbuilt,
 coalesce(sum(s.region_id IS NOT NULL AND t.region_id IS NOT NULL AND (s.revision IS NOT r.revision OR s.v IS NOT ?
   OR t.revision IS NOT r.revision OR json_extract(t.stats,'$.v') IS NOT ?)),0) pending,
 count(*) total
FROM region_revisions r LEFT JOIN region_series s ON s.region_id=r.region_id LEFT JOIN region_stats t ON t.region_id=r.region_id`).bind(SERIES_VERSION,FIGURES_VERSION).first();
  return {pending:Number(r?.pending||0),unbuilt:Number(r?.unbuilt||0),total:Number(r?.total||0)};
 }catch(e){if(missingTable(e))return {missing:'0016'};throw e;}
}
/** Order of SQL for area ids and days (binary, null first), never localeCompare. */
export const binary=(a,b)=>a===b?0:a===null||a===undefined?-1:b===null||b===undefined?1:a<b?-1:1;
