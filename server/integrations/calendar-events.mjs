/**
 * Meeting calendar (/api/calendar and /api/calendar/ics): checks of the request, the query and the iCalendar text
 * (E3 and E7 of the code analysis of 10.10.2026). Pure functions, shared by the two routes and their tests.
 */
export const MAX_AREAS=200,MAX_SPAN_DAYS=100;
/** A real day as YYYY-MM-DD: "0000-00-00" or "2026-02-30" pass a pattern but not the round trip through Date. */
export function validDay(s){
 return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
}
/** Both days valid, in order and at most maxDays apart. */
export function validSpan(from,to,maxDays=MAX_SPAN_DAYS){
 return validDay(from)&&validDay(to)&&from<=to&&Date.parse(to)-Date.parse(from)<=maxDays*864e5;
}
/** The official keys of the areas asked for (?ags=…), without repeats, at most `max` of them. */
export function parseAgs(value,max=MAX_AREAS){
 return [...new Set(String(value||'').split(',').filter(a=>/^\d{2,9}$/.test(a)))].slice(0,max);
}
/**
 * Meetings of the areas between two days: per area, day and committee, with the reports discussed. Bind:
 * (ids as JSON, from, from, to). topics.event_date is the day of a report's last meeting (the readers set it so), so a
 * report with a meeting from `from` on has event_date >= from: the index on event_date narrows the scan to recent
 * reports before their events are unpacked, instead of reading every report of the areas.
 */
export const eventsSql=limit=>`SELECT t.region_id rid,substr(json_extract(e.value,'$.date'),1,10) d,coalesce(json_extract(e.value,'$.committee'),'') c,count(*) n,
   json_group_array(json_object('id',t.id,'title',json_extract(t.payload,'$.title'))) items
  FROM topics t,json_each(t.payload,'$.events') e
  WHERE t.region_id IN (SELECT value FROM json_each(?)) AND t.event_date>=? AND json_extract(t.payload,'$.identity.mergedInto') IS NULL
   AND substr(json_extract(e.value,'$.date'),1,10) BETWEEN ? AND ?
  GROUP BY rid,d,c ORDER BY d,rid,c LIMIT ${Number(limit)}`;
/** Text of an iCalendar property value: backslash, semicolon, comma and line breaks escaped (RFC 5545, 3.3.11). */
export const icsEscape=s=>String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
