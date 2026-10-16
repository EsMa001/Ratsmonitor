import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {atRevisionStale,paramsKey} from '@/server/integrations/revision-cache.mjs';
import {REGIONS} from '@/shared/regions';
import {xTeaser,teaserParams} from '@/server/integrations/plenara-x-teaser.mjs';
import {X_REVISION_SQL} from '@/server/integrations/x-cases.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
// plenara.X Auszug für die Anwenderseiten (server/integrations/plenara-x-teaser.mjs): nur fest gewählte Signale, nur die Zusammenfassung,
// deshalb ohne Stufe Enterprise (wie die Suche). Zwischenspeicher je Auszug und Tag, neu mit dem täglichen Bau von x_cases.
const CACHE='public, max-age=300, stale-while-revalidate=600';
export const GET=gated(teaserGet);
async function teaserGet(request:Request){
 try {const id=new URL(request.url).searchParams.get('id')||'';const p=teaserParams(id);p.set('id',id);
  return Response.json(await atRevisionStale(env.DB,paramsKey('x-teaser-v1',p),()=>xTeaser(env.DB,REGIONS,id),{revisionSql:X_REVISION_SQL}),{headers:{'Cache-Control':CACHE}});}
 catch(error){return Response.json({error:error instanceof AnalyticsError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof AnalyticsError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
