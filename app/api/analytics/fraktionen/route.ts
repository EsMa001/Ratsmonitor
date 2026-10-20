import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {xCached} from '@/server/integrations/plenara-x-query.mjs';
import {REGIONS} from '@/shared/regions';
import {factions,factionList} from '@/server/integrations/analytics-factions.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
import {cachedJson} from '@/server/services/cached-json.mjs';
// Öffentlich und für alle gleich; der Datenbestand ändert sich höchstens täglich.
const CACHE='public, max-age=300, stale-while-revalidate=600';
export const GET=gated(analyticsGet,{feature:'analytics'});
// Auswertungen gehören zu Enterprise (shared/plans.mjs); interne Aufrufe (Vorwärmen) kommen durch.
async function analyticsGet(request:Request){
 try {const params=new URL(request.url).searchParams;
  // Mit by=…: die Vorgänge hinter einer Zahl
  return cachedJson(request,await xCached(env.DB,params.get('by')?'fraktionen-list':'fraktionen',params,()=>(params.get('by')?factionList:factions)(env.DB,REGIONS,params)),{'Cache-Control':CACHE});}
 catch(error){return Response.json({error:error instanceof AnalyticsError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof AnalyticsError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
