import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {xCached} from '@/server/integrations/plenara-x-query.mjs';
import {REGIONS} from '@/shared/regions';
import {trends,trendList,trendSpread} from '@/server/integrations/analytics-trends.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
// Öffentlich und für alle gleich; der Datenbestand ändert sich höchstens täglich.
const CACHE='public, max-age=300, stale-while-revalidate=600';
export const GET=gated(analyticsGet,{feature:'analytics'});
// Auswertungen gehören zu Enterprise (shared/plans.mjs); interne Aufrufe (Vorwärmen) kommen durch.
async function analyticsGet(request:Request){
 try {const params=new URL(request.url).searchParams;
  // Mit by=…: die Vorgänge hinter einer Zahl
  // part=spread: Ausbreitung der gezeigten Begriffe (Seite Trends); das alte Tool fragt das nie
  if(params.get('part')==='spread')return Response.json(await xCached(env.DB,'trends-spread',params,()=>trendSpread(env.DB,REGIONS,params)),{headers:{'Cache-Control':CACHE}});
  return Response.json(await xCached(env.DB,params.get('by')?'trends-list':'trends',params,()=>(params.get('by')?trendList:trends)(env.DB,REGIONS,params)),{headers:{'Cache-Control':CACHE}});}
 catch(error){return Response.json({error:error instanceof AnalyticsError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof AnalyticsError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
