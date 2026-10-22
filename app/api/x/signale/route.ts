import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {xCached} from '@/server/integrations/plenara-x-query.mjs';
import {xSignals} from '@/server/integrations/plenara-x-signals.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
import {cachedJson} from '@/server/services/cached-json.mjs';
// plenara.X Signale: neue Ereignisse je Branche als Liste (server/integrations/plenara-x-signals.mjs). Wie /api/x öffentlich und
import {dataFailure,X_CACHE} from '@/server/services/data-response.mjs';
// für alle gleich; die Daten ändern sich nur mit dem täglichen Bau im Job rule-texts.
export const GET=gated(analyticsGet,{feature:'analytics'});
// Auswertungen gehören zu Enterprise (shared/plans.mjs); interne Aufrufe (Vorwärmen) kommen durch.
async function analyticsGet(request:Request){
 try {const params=new URL(request.url).searchParams;
  return cachedJson(request,await xCached(env.DB,'x-signale-v9',params,()=>xSignals(env.DB,REGIONS,params)),{'Cache-Control':X_CACHE});}
 catch(error){return dataFailure(error,AnalyticsError);}
}
