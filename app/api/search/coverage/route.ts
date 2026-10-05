import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {cachedCoverage,SearchError} from '@/server/integrations/monitor-search.mjs';
// Gebiete mit Berichten je Ebene und der jüngste Abruf: ändern sich nur mit Importen, deshalb länger wiederverwendbar.
const CACHE='public, max-age=300, stale-while-revalidate=3600';
export async function GET(request:Request){
 try {return Response.json(await cachedCoverage(env.DB,REGIONS,new URL(request.url).searchParams.get('level')||'city'),{headers:{'Cache-Control':CACHE}});}
 catch(error){return Response.json({error:error instanceof SearchError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof SearchError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
