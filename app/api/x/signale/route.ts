import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {xCached} from '@/server/integrations/plenara-x-query.mjs';
import {xSignals} from '@/server/integrations/plenara-x-signals.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
// plenara.X Signale: neue Ereignisse je Branche als Liste (server/integrations/plenara-x-signals.mjs). Wie /api/x öffentlich und
// für alle gleich; die Daten ändern sich nur mit dem täglichen Bau im Job rule-texts.
const CACHE='public, max-age=300, stale-while-revalidate=600';
export const GET=gated(analyticsGet,{feature:'analytics'});
// Auswertungen gehören zu Enterprise (shared/plans.mjs); interne Aufrufe (Vorwärmen) kommen durch.
async function analyticsGet(request:Request){
 try {const params=new URL(request.url).searchParams;
  return Response.json(await xCached(env.DB,'x-signale-v8',params,()=>xSignals(env.DB,REGIONS,params)),{headers:{'Cache-Control':CACHE}});}
 catch(error){return Response.json({error:error instanceof AnalyticsError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof AnalyticsError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
