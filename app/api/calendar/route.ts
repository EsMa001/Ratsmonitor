import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {validSpan,parseAgs,eventsSql} from '@/server/integrations/calendar-events.mjs';

/** Sitzungstermine für den Kalender: je Gebiet, Tag und Gremium mit Anzahl der beratenen Vorgänge.
 *  ?ags=05558012,05558&from=YYYY-MM-DD&to=YYYY-MM-DD (höchstens 200 Gebiete, höchstens ~3 Monate).
 *  Die Antwort darf fünf Minuten zwischengespeichert werden: Termine ändern sich nur mit dem Import. */
export async function GET(request:Request){
 const p=new URL(request.url).searchParams;
 const ags=parseAgs(p.get('ags'));
 const from=p.get('from')||'',to=p.get('to')||'';
 if(!validSpan(from,to))return Response.json({error:'Ungültiger Zeitraum.'},{status:400,headers:{'Cache-Control':'no-store'}});
 if(!env.DB)return Response.json({error:'Datenbank fehlt'},{status:503,headers:{'Cache-Control':'no-store'}});
 const set=new Set(ags),regions=REGIONS.filter(r=>set.has(r.ags)),byId=new Map(regions.map(r=>[r.id,r]));
 const headers={'Cache-Control':'public, max-age=300, stale-while-revalidate=3600'};
 if(!regions.length)return Response.json({events:[]},{headers});
 const rows=await env.DB.prepare(eventsSql(2000)).bind(JSON.stringify(regions.map(r=>r.id)),from,from,to).all<{rid:string;d:string;c:string;n:number;items:string}>();
 return Response.json({events:rows.results.map(r=>({date:r.d,ags:byId.get(r.rid)?.ags??'',place:byId.get(r.rid)?.name??'',committee:r.c,count:r.n,items:(JSON.parse(r.items) as {id:string;title:string}[]).slice(0,5)}))},{headers});
}
