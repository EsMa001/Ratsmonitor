import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {kita,kitaList} from '@/server/integrations/analytics-kita.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
// Öffentlich und für alle gleich; der Datenbestand ändert sich höchstens täglich.
const CACHE='public, max-age=300, stale-while-revalidate=600';
export async function GET(request:Request){
 try {const params=new URL(request.url).searchParams;
  // Mit by=…: die Vorgänge hinter einer Zahl (Richtung, Gebiet)
  return Response.json(await (params.get('by')?kitaList:kita)(env.DB,REGIONS,params),{headers:{'Cache-Control':CACHE}});}
 catch(error){return Response.json({error:error instanceof AnalyticsError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof AnalyticsError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
