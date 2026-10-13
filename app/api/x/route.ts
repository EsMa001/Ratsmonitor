import {env} from 'cloudflare:workers';
import {atRevisionStale,paramsKey} from '@/server/integrations/revision-cache.mjs';
import {REGIONS} from '@/shared/regions';
import {xQuery} from '@/server/integrations/plenara-x-query.mjs';
import {X_REVISION_SQL} from '@/server/integrations/x-cases.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
// plenara.X: eine Abfrage für alle Auswertungen (Auswahl × Gliederung × Kennzahl, server/integrations/plenara-x-query.mjs).
// Öffentlich und für alle gleich; die Zahlen (x_cases) ändern sich nur mit dem täglichen Bau im Job rule-texts.
const CACHE='public, max-age=300, stale-while-revalidate=600';
export async function GET(request:Request){
 try {const params=new URL(request.url).searchParams;
  return Response.json(await atRevisionStale(env.DB,paramsKey('x',params),()=>xQuery(env.DB,REGIONS,params),{revisionSql:X_REVISION_SQL}),{headers:{'Cache-Control':CACHE}});}
 catch(error){return Response.json({error:error instanceof AnalyticsError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof AnalyticsError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
