import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {funding,fundingList} from '@/server/integrations/analytics-funding.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
// Öffentlich und für alle gleich; der Datenbestand ändert sich höchstens täglich.
const CACHE='public, max-age=300, stale-while-revalidate=600';
export async function GET(request:Request){
 try {const params=new URL(request.url).searchParams;
  // Mit by=…: die Vorgänge hinter einer Zahl
  return Response.json(await (params.get('by')?fundingList:funding)(env.DB,REGIONS,params),{headers:{'Cache-Control':CACHE}});}
 catch(error){return Response.json({error:error instanceof AnalyticsError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof AnalyticsError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
