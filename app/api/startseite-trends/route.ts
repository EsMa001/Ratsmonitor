import {env} from 'cloudflare:workers';
// Vorab gerechnete Daten der Startseite (scripts/startseite-trends.mjs, Job „startseite-trends“): echte Pops und Trends.
// Fehlt der Eintrag, antwortet die Route 404 und die Startseite nimmt public/data/startseite-trends.json.
const CACHE='public, max-age=3600, stale-while-revalidate=86400';
export async function GET(){
 try{
  if(!env.DB)return Response.json({error:'Keine Datenbank.'},{status:404,headers:{'Cache-Control':'no-store'}});
  const row=await env.DB.prepare('SELECT value FROM system_state WHERE key=?').bind('startseite-trends').first<{value:string}>();
  if(!row?.value)return Response.json({error:'Noch nicht berechnet.'},{status:404,headers:{'Cache-Control':'no-store'}});
  return new Response(row.value,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':CACHE}});
 }catch{return Response.json({error:'Der Datenbestand ist gerade nicht erreichbar.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
