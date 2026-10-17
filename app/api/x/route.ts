import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {xCached} from '@/server/integrations/plenara-x-query.mjs';
import {xQuery} from '@/server/integrations/plenara-x-query.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
// plenara.X: eine Abfrage für alle Auswertungen (Auswahl × Gliederung × Kennzahl, server/integrations/plenara-x-query.mjs).
// Öffentlich und für alle gleich; die Zahlen (x_cases) ändern sich nur mit dem täglichen Bau im Job rule-texts.
const CACHE='public, max-age=300, stale-while-revalidate=600';
export const GET=gated(xGet,{feature:'analytics'});
// Auswertungen gehören zu Enterprise (shared/plans.mjs); interne Aufrufe (Vorwärmen) kommen durch.
async function xGet(request:Request){
 try {const params=new URL(request.url).searchParams;
  return Response.json(await xCached(env.DB,'x-v6',params,()=>xQuery(env.DB,REGIONS,params)),{headers:{'Cache-Control':CACHE}});}
 catch(error){return Response.json({error:error instanceof AnalyticsError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof AnalyticsError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
