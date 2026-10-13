import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {atRevisionStale,paramsKey} from '@/server/integrations/revision-cache.mjs';
import {REGIONS} from '@/shared/regions';
import {radar,radarList,radarMapData} from '@/server/integrations/analytics-radar.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
// Öffentlich und für alle gleich; der Datenbestand ändert sich höchstens täglich.
const CACHE='public, max-age=300, stale-while-revalidate=600';
export const GET=gated(analyticsGet,{feature:'analytics'});
// Auswertungen gehören zu Enterprise (shared/plans.mjs); interne Aufrufe (Vorwärmen) kommen durch.
async function analyticsGet(request:Request){
 try {const params=new URL(request.url).searchParams;
  // Mit by=…: die Vorgänge hinter einer Zahl (Thema, Signal, Monat, Gebiet, Zweck); mit map=1: die Karte
  return Response.json(await (params.get('map')?radarMapData(env.DB,REGIONS,params):params.get('by')?radarList(env.DB,REGIONS,params)
   // Je Radar eigene Filter im Zwischenspeicher, damit Filter eines Radars die Startansicht eines anderen nicht verdrängen
   :atRevisionStale(env.DB,paramsKey('radar-'+(params.get('radar')||''),params),()=>radar(env.DB,REGIONS,params))),{headers:{'Cache-Control':CACHE}});}
 catch(error){return Response.json({error:error instanceof AnalyticsError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof AnalyticsError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
