import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {xCached} from '@/server/integrations/plenara-x-query.mjs';
import {REGIONS} from '@/shared/regions';
import {decisions,decisionList} from '@/server/integrations/analytics-decisions.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
import {cachedJson} from '@/server/services/cached-json.mjs';
// Öffentlich und für alle gleich; der Datenbestand ändert sich höchstens täglich.
import {dataFailure,X_CACHE} from '@/server/services/data-response.mjs';
export const GET=gated(analyticsGet,{feature:'analytics'});
// Auswertungen gehören zu Enterprise (shared/plans.mjs); interne Aufrufe (Vorwärmen) kommen durch.
async function analyticsGet(request:Request){
 try {const params=new URL(request.url).searchParams;
  // Mit by=…: die Vorgänge hinter einer Zahl
  return cachedJson(request,await xCached(env.DB,params.get('by')?'decisions-list':'decisions',params,()=>(params.get('by')?decisionList:decisions)(env.DB,REGIONS,params)),{'Cache-Control':X_CACHE});}
 catch(error){return dataFailure(error,AnalyticsError);}
}
