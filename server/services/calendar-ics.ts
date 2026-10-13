import 'server-only';
import {REGIONS} from '@/shared/regions';
import {eventsSql,icsEscape as esc} from '@/server/integrations/calendar-events.mjs';

/* iCalendar-Text: Zeilen nach 74 Zeichen falten (RFC 5545); Sonderzeichen maskiert icsEscape */
const fold=(line:string)=>line.match(/.{1,74}/gu)!.join('\r\n ');
const day=(d:Date)=>d.toISOString().slice(0,10);
const ics=(d:string)=>d.replace(/-/g,'');
const hash=(s:string)=>{let h=5381;for(const c of s)h=(h*33)^c.charCodeAt(0);return (h>>>0).toString(36);};

/** Sitzungstermine der Gebiete (AGS) als iCalendar-Text: 30 Tage zurück bis 180 Tage voraus. Links zeigen auf origin. */
export async function buildIcs(db:D1Database,ags:string[],origin:string){
 const url={origin};
 const set=new Set(ags),regions=REGIONS.filter(r=>set.has(r.ags)),byId=new Map(regions.map(r=>[r.id,r]));
 const now=Date.now(),from=day(new Date(now-30*864e5)),to=day(new Date(now+180*864e5));
 const rows=regions.length?(await db.prepare(eventsSql(3000)).bind(JSON.stringify(regions.map(r=>r.id)),from,from,to).all<{rid:string;d:string;c:string;items:string}>()).results:[];
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Plenara//Sitzungskalender//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Sitzungen in meinen Gebieten','X-PUBLISHED-TTL:PT6H','REFRESH-INTERVAL;VALUE=DURATION:PT6H'];
 for(const r of rows){
  const place=byId.get(r.rid)?.name??'',items=(JSON.parse(r.items) as {id:string;title:string}[]);
  const next=day(new Date(Date.parse(r.d)+864e5));
  const desc=items.slice(0,15).map(i=>`• ${i.title}\n  ${url.origin}/beschluss/${i.id}`).join('\n')+(items.length>15?`\n… und ${items.length-15} weitere`:'');
  lines.push('BEGIN:VEVENT',`UID:${r.rid}-${ics(r.d)}-${hash(r.c)}@plenara`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${ics(r.d)}`,`DTEND;VALUE=DATE:${ics(next)}`,
   `SUMMARY:${esc(`${r.c||'Sitzung'} · ${place}`)}`,`LOCATION:${esc(place)}`,`DESCRIPTION:${esc(`${items.length} ${items.length===1?'Vorgang':'Vorgänge'}\n${desc}`)}`,'TRANSP:TRANSPARENT','END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 return lines.map(fold).join('\r\n')+'\r\n';
}
