import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {cachedSearch,SearchError} from '@/server/integrations/monitor-search.mjs';
import {guard,requestTier,internalCall} from '@/server/services/session';
import {guestPageBlocked,trimResult,trimStream,withoutFilters} from '@/server/accounts/guest-search.mjs';
import {LIMITS} from '@/shared/plans.mjs';
import {dataFailure} from '@/server/services/data-response.mjs';
// Der Zwischenspeicher der Suche ist für alle gleich; gekürzt wird erst danach (shared/plans.mjs: Gast 10, Konto 20 Treffer).
// Gäste suchen ohne Filter (nur Begriff und Ort). Die Suche in den Texten der Dokumente ist eine eigene Route (/api/dokumente, Pro).
// Die Antwort hängt damit an der Sitzung: privat zwischenspeichern.
const CACHE='private, max-age=30, stale-while-revalidate=120';
const DENY={'Cache-Control':'private, no-store','Vary':'Cookie'};
type Limits={maxResults:number;filters:boolean};
export async function GET(request:Request){
 try {
  const denied=await guard(request);
  if(denied)return denied;
  let params=new URL(request.url).searchParams;
  const tier=await requestTier(request);
  const internal=await internalCall(request);
  const limits=(LIMITS as Record<string,Limits>)[tier.tier]??LIMITS.guest;
  const max=limits.maxResults;
  const limited=tier.accounts&&!internal;
  /* Früherer Platzhalter volltext=1: die Dokumentsuche hat eine eigene Route */
  if(params.get('volltext')==='1')return Response.json({error:'Die Suche in den Dokumenten heißt jetzt Dokumentsuche.',moved:'/api/dokumente'},{status:410,headers:DENY});
  if(limited&&!limits.filters)params=withoutFilters(params);
  const guest=limited&&Number.isFinite(max);
  if(guest&&guestPageBlocked(params))return Response.json({error:tier.tier==='guest'?'Weitere Treffer gibt es mit einem Konto.':'Alle Treffer gibt es mit Plus.',limit:'results'},{status:403,headers:DENY});
  const result=await cachedSearch(env.DB,REGIONS,params);
  /* part=stream: Treffer zeilenweise (NDJSON), jede Etappe sofort; kein Zwischenspeichern */
  if(result.stream){
   const stream=guest?trimStream(result.stream,max):result.stream;
   const encoder=new TextEncoder();
   const body=new ReadableStream({async start(controller){
    try{for await(const part of stream)controller.enqueue(encoder.encode(JSON.stringify(part)+'\n'));}
    catch{controller.enqueue(encoder.encode(JSON.stringify({error:'Die Suche konnte nicht abgeschlossen werden.'})+'\n'));}
    controller.close();
   }});
   return new Response(body,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store'}});
  }
  return Response.json(guest?trimResult(result,max):result,{headers:{'Cache-Control':CACHE,'Vary':'Cookie'}});
 }
 catch(error){return dataFailure(error,SearchError);}
}
