import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {searchMonitor,SearchError} from '@/server/integrations/monitor-search.mjs';
export async function GET(request:Request){
 try {return Response.json(await searchMonitor(env.DB,REGIONS,new URL(request.url).searchParams),{headers:{'Cache-Control':'no-store'}});}
 catch(error){return Response.json({error:error instanceof SearchError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof SearchError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
