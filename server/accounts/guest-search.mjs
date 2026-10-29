// Treffergrenze der Suche (requirements/konten-konzept.md, Abschnitt 7): Gast und Konto nur die erste Seite und höchstens
// LIMITS[tier].maxResults Treffer (10 bzw. 20). Gekürzt wird erst nach cachedSearch, der Zwischenspeicher bleibt für alle gleich.
import {LIMITS} from '../../shared/plans.mjs';
export const GUEST_RESULTS=LIMITS.guest.maxResults;

/** Seite 2 und folgende sind für Stufen mit Treffergrenze gesperrt */
export const guestPageBlocked=params=>Number(params.get('page')||'1')>1;

/** Filter, die Gäste nicht setzen (LIMITS.guest.filters): Thema, Unterthema, Monat, Zeitraum, Status, Exakt, Sortierung;
    Formalien bleiben wie in der Oberfläche ausgeblendet (noformal=1) */
export const GUEST_FILTERS=['label','sub','month','from','status','noformal','exact','sort'];
const dayOf=(ms,zone)=>new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(new Date(ms));
/**
 * Suche ohne Filter: Begriff und Ort (mit Umkreis und weiteren Orten) bleiben, die Filter fallen weg, der Zeitraum endet heute
 * (ohne künftige Sitzungen). Der Browser rechnet „heute“ in seiner Zeitzone; ein Tag Abweichung bleibt deshalb stehen.
 */
export function withoutFilters(params,{now=Date.now(),zone='Europe/Berlin'}={}){
 const out=new URLSearchParams(params);
 for(const key of GUEST_FILTERS)out.delete(key);
 out.set('noformal','1');
 const days=[-1,0,1].map(d=>dayOf(now+d*86400000,zone));
 if(!days.includes(out.get('to')||''))out.set('to',days[1]);
 return out;
}

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
