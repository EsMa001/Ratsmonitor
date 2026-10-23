import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {xCached} from '@/server/integrations/plenara-x-query.mjs';
import {xQuery} from '@/server/integrations/plenara-x-query.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
import {cachedJson} from '@/server/services/cached-json.mjs';
// plenara.X: eine Abfrage für alle Auswertungen (Auswahl × Gliederung × Kennzahl, server/integrations/plenara-x-query.mjs).
import {dataFailure,X_CACHE} from '@/server/services/data-response.mjs';
// Öffentlich und für alle gleich; die Zahlen (x_cases) ändern sich nur mit dem täglichen Bau im Job rule-texts.
export const GET=gated(xGet,{feature:'analytics'});
// Auswertungen gehören zu Plus (shared/plans.mjs); interne Aufrufe (Vorwärmen) kommen durch.
async function xGet(request:Request){
 try {const params=new URL(request.url).searchParams;
  return cachedJson(request,await xCached(env.DB,'x-v7',params,()=>xQuery(env.DB,REGIONS,params)),{'Cache-Control':X_CACHE});}
 catch(error){return dataFailure(error,AnalyticsError);}
}
