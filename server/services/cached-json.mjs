// Antworten aus dem Zwischenspeicher (xCached, atRevisionStale): JSON-Text und schwaches ETag einmal je gemerktem Ergebnis,
// nicht bei jedem Abruf (Fakten rund 1 MB, Atlas 400 KB gingen sonst je Treffer durch JSON.stringify im Hauptprozess).
// Fragt der Browser nach Ablauf von max-age mit If-None-Match nach demselben Stand, kommt 304 ohne Körper.
import {etagMatches,fnv} from './admin-etag.mjs';

const texts=new WeakMap();
/**
 * @param {Request} request
 * @param {unknown} value gemerktes Ergebnis (dasselbe Objekt, solange der Zwischenspeicher es hält)
 * @param {Record<string,string>} headers
 */
export function cachedJson(request,value,headers={}){
 const keep=value!==null&&typeof value==='object';
 let entry=keep?texts.get(value):undefined;
 if(!entry){const text=JSON.stringify(value);entry={text,etag:`W/"${fnv([text])}"`};if(keep)texts.set(value,entry);}
 if(etagMatches(request.headers.get('If-None-Match'),entry.etag))return new Response(null,{status:304,headers:{...headers,ETag:entry.etag}});
 return new Response(entry.text,{headers:{'Content-Type':'application/json',...headers,ETag:entry.etag}});
}
