import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {cachedSearch,SearchError} from '@/server/integrations/monitor-search.mjs';
// Öffentlich und für alle gleich: der Browser darf eine Antwort kurz wiederverwenden (Zurückblättern, Filter zurück).
const CACHE='public, max-age=30, stale-while-revalidate=120';
export async function GET(request:Request){
 try {
  const result=await cachedSearch(env.DB,REGIONS,new URL(request.url).searchParams);
  /* part=stream: Treffer zeilenweise (NDJSON), jede Etappe sofort; kein Zwischenspeichern */
  if(result.stream){
   const encoder=new TextEncoder();
   const body=new ReadableStream({async start(controller){
    try{for await(const part of result.stream)controller.enqueue(encoder.encode(JSON.stringify(part)+'\n'));}
    catch{controller.enqueue(encoder.encode(JSON.stringify({error:'Die Suche konnte nicht abgeschlossen werden.'})+'\n'));}
    controller.close();
   }});
   return new Response(body,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store'}});
  }
  return Response.json(result,{headers:{'Cache-Control':CACHE}});
 }
 catch(error){return Response.json({error:error instanceof SearchError?error.message:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof SearchError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
