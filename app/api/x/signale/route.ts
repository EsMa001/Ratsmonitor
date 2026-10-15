import {env} from 'cloudflare:workers';
import {atRevisionStale,paramsKey} from '@/server/integrations/revision-cache.mjs';
import {REGIONS} from '@/shared/regions';
import {xSignals} from '@/server/integrations/plenara-x-signals.mjs';
import {X_REVISION_SQL} from '@/server/integrations/x-cases.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
// plenara.X Signale: neue Ereignisse je Branche als Liste (server/integrations/plenara-x-signals.mjs). Wie /api/x öffentlich und
// für alle gleich; die Daten ändern sich nur mit dem täglichen Bau im Job rule-texts.
const CACHE='public, max-age=300, stale-while-revalidate=600';
export async function GET(request:Request){
 try {const params=new URL(request.url).searchParams;
  return Response.json(await atRevisionStale(env.DB,paramsKey('x-signale-v7',params),()=>xSignals(env.DB,REGIONS,params),{revisionSql:X_REVISION_SQL}),{headers:{'Cache-Control':CACHE}});}
 catch(error){return Response.json({error:error instanceof AnalyticsError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof AnalyticsError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
