import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {cachedSearch,SearchError} from '@/server/integrations/monitor-search.mjs';
// Öffentlich und für alle gleich: der Browser darf eine Antwort kurz wiederverwenden (Zurückblättern, Filter zurück).
const CACHE='public, max-age=30, stale-while-revalidate=120';
export async function GET(request:Request){
 try {return Response.json(await cachedSearch(env.DB,REGIONS,new URL(request.url).searchParams),{headers:{'Cache-Control':CACHE}});}
 catch(error){return Response.json({error:error instanceof SearchError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof SearchError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
