// Kalender-Abo für Kalender-Apps: Token statt Cookie (Kontoseite erzeugt den Link). Gebiete aus den Kontoeinstellungen,
// Links in den Terminen aus SITE_URL. Ungültige oder widerrufene Tokens und Konten ohne Kalender-Stufe: 404.
import {env} from 'cloudflare:workers';
import {accountsConfig} from '@/server/accounts/config.mjs';
import {feedAreas} from '@/server/accounts/account.mjs';
import {buildIcs} from '@/server/services/calendar-ics';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const cfg=accountsConfig(env);
 const none=()=>new Response('Kalender nicht gefunden.',{status:404,headers:{'Cache-Control':'no-store'}});
 if(!cfg.db||!env.DB)return none();
 try{
  const ags=await feedAreas(cfg.db,token);
  if(!ags)return none();
  const text=await buildIcs(env.DB,ags,cfg.siteUrl||new URL(request.url).origin);
  return new Response(text,{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="sitzungen.ics"','Cache-Control':'private, max-age=3600','Referrer-Policy':'no-referrer'}});
 }catch(error){console.error('[konten] Kalender-Abo:',error instanceof Error?error.message:String(error));return new Response('Kalender gerade nicht erreichbar.',{status:503,headers:{'Cache-Control':'no-store'}});}
}
