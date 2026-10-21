import {gated} from '@/server/services/session';
import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {cachedCoverage,SearchError} from '@/server/integrations/monitor-search.mjs';
import {dataFailure} from '@/server/services/data-response.mjs';
// Gebiete mit Berichten je Ebene und der jüngste Abruf: ändern sich nur mit Importen, deshalb länger wiederverwendbar.
const CACHE='public, max-age=300, stale-while-revalidate=3600';
export const GET=gated(coverageGet);
async function coverageGet(request:Request){
 try {return Response.json(await cachedCoverage(env.DB,REGIONS,new URL(request.url).searchParams.get('level')||'city'),{headers:{'Cache-Control':CACHE}});}
 catch(error){return dataFailure(error,SearchError);}
}
