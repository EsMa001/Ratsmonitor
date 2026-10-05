import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';

/* iCalendar-Text: Sonderzeichen maskieren, Zeilen nach 74 Zeichen falten (RFC 5545) */
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
const fold=(line:string)=>line.match(/.{1,74}/gu)!.join('\r\n ');
const day=(d:Date)=>d.toISOString().slice(0,10);
const ics=(d:string)=>d.replace(/-/g,'');
const hash=(s:string)=>{let h=5381;for(const c of s)h=(h*33)^c.charCodeAt(0);return (h>>>0).toString(36);};

/** Sitzungstermine als Kalender-Datei bzw. -Abo (?ags=…): 30 Tage zurück bis 180 Tage voraus.
 *  Jede Sitzung hat eine feste UID (Gebiet, Tag, Gremium). Kalender-Apps erkennen Termine daran wieder:
 *  ein Abo aktualisiert sie, ein erneuter Import legt sie nicht doppelt an. */
export async function GET(request:Request){
 const url=new URL(request.url),p=url.searchParams;
 const ags=(p.get('ags')||'').split(',').filter(a=>/^\d{2,9}$/.test(a)).slice(0,500);
 if(!env.DB)return new Response('Datenbank fehlt',{status:503});
 const set=new Set(ags),regions=REGIONS.filter(r=>set.has(r.ags)),byId=new Map(regions.map(r=>[r.id,r]));
 const now=Date.now(),from=day(new Date(now-30*864e5)),to=day(new Date(now+180*864e5));
 const rows=regions.length?(await env.DB.prepare(`SELECT t.region_id rid,substr(json_extract(e.value,'$.date'),1,10) d,coalesce(json_extract(e.value,'$.committee'),'') c,
   json_group_array(json_object('id',t.id,'title',json_extract(t.payload,'$.title'))) items
  FROM topics t,json_each(t.payload,'$.events') e
  WHERE t.region_id IN (SELECT value FROM json_each(?)) AND json_extract(t.payload,'$.identity.mergedInto') IS NULL
   AND substr(json_extract(e.value,'$.date'),1,10) BETWEEN ? AND ?
  GROUP BY rid,d,c ORDER BY d LIMIT 3000`).bind(JSON.stringify(regions.map(r=>r.id)),from,to).all<{rid:string;d:string;c:string;items:string}>()).results:[];
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
 return new Response(lines.map(fold).join('\r\n')+'\r\n',{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':`${p.get('download')?'attachment':'inline'}; filename="sitzungen.ics"`,'Cache-Control':'no-store'}});
}
