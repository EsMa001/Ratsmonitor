import {gated,calendarScope} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {parseAgs} from '@/server/integrations/calendar-events.mjs';
import {buildIcs} from '@/server/services/calendar-ics';

/** Sitzungstermine als Kalender-Datei (?ags=…, höchstens 200 Gebiete), für angemeldete Konten mit Kalender (ab Konto).
 *  Für Kalender-Apps gibt es den Abo-Link mit Token (/api/calendar/feed/<token>, Kontoseite), denn Apps schicken kein Cookie.
 *  Jede Sitzung hat eine feste UID (Gebiet, Tag, Gremium): ein erneuter Import legt Termine nicht doppelt an. */
export const GET=gated(icsGet,{feature:'calendar'});
async function icsGet(request:Request){
 const url=new URL(request.url),p=url.searchParams;
 if(!env.DB)return new Response('Datenbank fehlt',{status:503,headers:{'Cache-Control':'no-store'}});
 // Konto und Plus: nur die gespeicherten Kalendergebiete (shared/plans.mjs, calendarAreas)
 const scope=await calendarScope(request);
 const text=await buildIcs(env.DB,parseAgs(p.get('ags')).filter((a:string)=>!scope||scope.has(a)),url.origin);
 return new Response(text,{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':`${p.get('download')?'attachment':'inline'}; filename="sitzungen.ics"`,'Cache-Control':'private, max-age=3600','Vary':'Cookie'}});
}
