import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {atRevisionStale,paramsKey} from '@/server/integrations/revision-cache.mjs';
import {REGIONS} from '@/shared/regions';
import {xTeaser,teaserParams} from '@/server/integrations/plenara-x-teaser.mjs';
import {X_REVISION_SQL} from '@/server/integrations/x-cases.mjs';
import {AnalyticsError} from '@/server/integrations/analytics-diffusion.mjs';
import {cachedJson} from '@/server/services/cached-json.mjs';
// plenara.X Auszug für die Anwenderseiten (server/integrations/plenara-x-teaser.mjs): nur fest gewählte Signale, nur die Zusammenfassung,
import {dataFailure,X_CACHE} from '@/server/services/data-response.mjs';
// deshalb ohne Stufe Plus (wie die Suche). Zwischenspeicher je Auszug und Tag, neu mit dem täglichen Bau von x_cases.
export const GET=gated(teaserGet);
async function teaserGet(request:Request){
 try {const id=new URL(request.url).searchParams.get('id')||'';const p=teaserParams(id);p.set('id',id);
  return cachedJson(request,await atRevisionStale(env.DB,paramsKey('x-teaser-v1',p),()=>xTeaser(env.DB,REGIONS,id),{revisionSql:X_REVISION_SQL}),{'Cache-Control':X_CACHE});}
 catch(error){return dataFailure(error,AnalyticsError);}
}
