import {TIMELINE_BASES} from '../../shared/timeline.mjs';
import {atRevision} from './revision-cache.mjs';
const canonical="json_extract(payload,'$.identity.mergedInto') IS NULL";
// The day a report first appeared on an agenda, or the day it was first stored. Reports stored before the
// import date was recorded carry none; they are returned as undated instead of being guessed.
const DAY_SQL={
 event:"substr((SELECT min(json_extract(value,'$.date')) FROM json_each(payload,'$.events')),1,10)",
 import:"substr(json_extract(payload,'$.metadata.firstImportedAt'),1,10)",
};
/**
 * Stored reports per area and day, compact: days[] plus, per area, pairs of [index into days, count].
 * Read-only. Merged duplicates are excluded, as in every other stock figure of the administration.
 */
export async function adminTimeline(db,{basis='event',now=new Date()}={}){
 if(!Object.hasOwn(TIMELINE_BASES,basis))throw Error('Ungültiger Zeitbezug');
 // The scan reads every report; its rows are kept until the reports change (revision-cache.mjs).
 const rows=await atRevision(db,'timeline|'+basis,async()=>(await db.prepare(`SELECT region_id AS area,${DAY_SQL[basis]} AS day,count(*) AS count FROM topics WHERE ${canonical} GROUP BY region_id,day ORDER BY day,region_id`).all()).results);
 const days=[],index=new Map(),areas={},undated={};let total=0;
 for(const row of rows){
  const count=Number(row.count);total+=count;
  if(typeof row.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.day)){undated[row.area]=(undated[row.area]||0)+count;continue;}
  if(!index.has(row.day)){index.set(row.day,days.length);days.push(row.day);}
  (areas[row.area]||=[]).push([index.get(row.day),count]);
 }
 return {basis,asOf:now.toISOString(),today:now.toISOString().slice(0,10),total,days,areas,undated};
}
