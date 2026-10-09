import {TIMELINE_BASES} from '../../shared/timeline.mjs';
import {readSeries,binary} from './region-series.mjs';
const canonical="json_extract(payload,'$.identity.mergedInto') IS NULL";
// The day a report first appeared on an agenda, or the day it was first stored. Reports stored before the
// import date was recorded carry none; they are returned as undated instead of being guessed.
const EVENT_DAY="substr((SELECT min(json_extract(value,'$.date')) FROM json_each(payload,'$.events')),1,10)";
const DAY_SQL={
 event:EVENT_DAY,
 import:"substr(json_extract(payload,'$.metadata.firstImportedAt'),1,10)",
};
// Day expressions for the figures per area (admin-data.mjs, area-figures.mjs): the first agenda day of a report, as
// above, and its latest meeting day (column event_date). Only well-formed days, so a placeholder never becomes the
// first or last day of an area.
const wellFormed=x=>`CASE WHEN ${x} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' THEN ${x} END`;
export const FIRST_DAY_SQL=wellFormed(EVENT_DAY),LAST_DAY_SQL=wellFormed('substr(event_date,1,10)');
/**
 * Stored reports per area and day, compact: days[] plus, per area, pairs of [index into days, count].
 * Read-only, from the values per area (region_series, computed by region-facts.mjs for changed areas only); never a
 * scan of the reports. Merged duplicates are excluded, as in every other stock figure of the administration.
 * Without migration 0016 the result is empty and says so (missing:'0016').
 */
export async function adminTimeline(db,{basis='event',now=new Date()}={}){
 if(!Object.hasOwn(TIMELINE_BASES,basis))throw Error('Ungültiger Zeitbezug');
 const series=await readSeries(db,{columns:[basis==='event'?'event_days':'import_days']});
 if(!series)return {basis,missing:'0016',asOf:now.toISOString(),today:now.toISOString().slice(0,10),total:0,days:[],areas:{},undated:{}};
 const rows=[];
 for(const [area,row] of series)for(const [day,count] of (basis==='event'?row.eventDays:row.importDays)||[])rows.push({area,day,count});
 // The order of the former query (ORDER BY day,region_id): days are kept raw, null first, binary like SQL.
 rows.sort((a,b)=>binary(a.day,b.day)||binary(a.area,b.area));
 return timelineFromRows(rows,{basis,now});
}
/** The former scan over all reports, for tests and comparisons only (scripts, tests/admin-series.test.mjs). */
export async function timelineRowsSql(db,basis){
 return (await db.prepare(`SELECT region_id AS area,${DAY_SQL[basis]} AS day,count(*) AS count FROM topics WHERE ${canonical} GROUP BY region_id,day ORDER BY day,region_id`).all()).results;
}
export function timelineFromRows(rows,{basis,now}){
 const days=[],index=new Map(),areas={},undated={};let total=0;
 for(const row of rows){
  const count=Number(row.count);total+=count;
  if(typeof row.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.day)){undated[row.area]=(undated[row.area]||0)+count;continue;}
  if(!index.has(row.day)){index.set(row.day,days.length);days.push(row.day);}
  (areas[row.area]||=[]).push([index.get(row.day),count]);
 }
 return {basis,asOf:now.toISOString(),today:now.toISOString().slice(0,10),total,days,areas,undated};
}
