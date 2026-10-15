// Gastgrenze der Suche (requirements/konten-konzept.md, Abschnitt 7): ohne freigeschaltete Stufe nur die erste Seite und
// höchstens 10 Treffer. Gekürzt wird erst nach cachedSearch, der Zwischenspeicher bleibt für alle gleich.
import {LIMITS} from '../../shared/plans.mjs';
export const GUEST_RESULTS=LIMITS.guest.maxResults;

/** Seite 2 und folgende sind für Gäste gesperrt */
export const guestPageBlocked=params=>Number(params.get('page')||'1')>1;

/** Ergebnis ohne Strom: Artikel kürzen, „weitere“ melden */
export function trimResult(result,max=GUEST_RESULTS){
 if(!result||!Array.isArray(result.articles)||result.articles.length<=max)return result;
 return {...result,articles:result.articles.slice(0,max),hasMore:true,guestLimit:true};
}
/** Strom der ersten Seite: über alle Etappen höchstens max Artikel, danach ein eigenes Ende und die Quelle beenden */
export async function* trimStream(stream,max=GUEST_RESULTS){
 let shown=0;
 try{
  for await(const part of stream){
   if(Array.isArray(part?.articles)){
    const list=part.articles.slice(0,max-shown);
    shown+=list.length;
    if(list.length)yield {...part,articles:list};
    if(shown>=max&&part.articles.length>=list.length){yield {end:true,hasMore:true,revision:null,pageSize:max,guestLimit:true};return;}
    continue;
   }
   if(part?.end){yield {...part,guestLimit:part.hasMore||undefined};return;}
   yield part;
  }
 }finally{await stream.return?.();}
}
