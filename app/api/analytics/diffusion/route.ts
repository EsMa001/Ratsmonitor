import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {xCached} from '@/server/integrations/plenara-x-query.mjs';
import {REGIONS} from '@/shared/regions';
import {diffusion,diffusionList,AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
import {cachedJson} from '@/server/services/cached-json.mjs';
// Ausbreitung in plenara.X Trends: gehört zu Plus (Merkmal analytics); für alle Berechtigten gleich, der Datenbestand ändert sich höchstens täglich.
// Die Startseite rechnet ihre Daten im Skript (scripts/startseite-trends.mjs) und braucht die Route nicht.
import {dataFailure,X_CACHE} from '@/server/services/data-response.mjs';
export const GET=gated(diffusionGet,{feature:'analytics'});
async function diffusionGet(request:Request){
 try {const params=new URL(request.url).searchParams;
  // Mit by=…: die Vorgänge hinter einer Zahl
  return cachedJson(request,await xCached(env.DB,params.get('by')?'diffusion-list':'diffusion',params,()=>(params.get('by')?diffusionList:diffusion)(env.DB,REGIONS,params)),{'Cache-Control':X_CACHE});}
 catch(error){return dataFailure(error,AnalyticsError);}
}
