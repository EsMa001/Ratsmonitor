import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {xCached} from '@/server/integrations/plenara-x-query.mjs';
import {REGIONS} from '@/shared/regions';
import {trends,trendList,trendSpread} from '@/server/integrations/analytics-trends.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
import {cachedJson} from '@/server/services/cached-json.mjs';
// Öffentlich und für alle gleich; der Datenbestand ändert sich höchstens täglich.
import {dataFailure,X_CACHE} from '@/server/services/data-response.mjs';
export const GET=gated(analyticsGet,{feature:'analytics'});
// Auswertungen gehören zu Plus (shared/plans.mjs); interne Aufrufe (Vorwärmen) kommen durch.
async function analyticsGet(request:Request){
 try {const params=new URL(request.url).searchParams;
  // Mit by=…: die Vorgänge hinter einer Zahl
  // part=spread: Ausbreitung der gezeigten Begriffe (Seite Trends); das alte Tool fragt das nie
  if(params.get('part')==='spread')return cachedJson(request,await xCached(env.DB,'trends-spread',params,()=>trendSpread(env.DB,REGIONS,params)),{'Cache-Control':X_CACHE});
  return cachedJson(request,await xCached(env.DB,params.get('by')?'trends-list':'trends',params,()=>(params.get('by')?trendList:trends)(env.DB,REGIONS,params)),{'Cache-Control':X_CACHE});}
 catch(error){return dataFailure(error,AnalyticsError);}
}
