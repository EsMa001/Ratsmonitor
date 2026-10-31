import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {gated} from '@/server/services/session';
import {searchDocuments,DocSearchError} from '@/server/integrations/doc-search.mjs';
import {xOffload} from '@/server/integrations/x-offload.mjs';
import {dataFailure} from '@/server/services/data-response.mjs';

/**
 * Dokumentsuche (Pro, FEATURES.fulltext; server/integrations/doc-search.mjs): Dokumente mit Fundstellen aus dem Dokumentindex
 * der PDF-Ablage. Gerechnet im plenara.X-Worker-Thread, wenn es ihn gibt (der Node-Server ist ein Prozess, eine lange Abfrage
 * hielte sonst alle an), sonst im Prozess über env.DOC_INDEX. Ohne Index (Cloudflare-Build, Dev-Server unter Miniflare, Server
 * ohne fts.sqlite) 503. Die Antwort hängt an der Stufe: privat zwischenspeichern.
 */
export const GET=gated(dokumenteGet,{feature:'fulltext'});
async function dokumenteGet(request:Request){
 try{
  const params=new URL(request.url).searchParams;
  const result=(await xOffload('dokumente',params))??await searchDocuments(env.DB,env.DOC_INDEX,REGIONS,params);
  return Response.json(result,{headers:{'Cache-Control':'private, max-age=30','Vary':'Cookie'}});
 }
 catch(error){return dataFailure(error,DocSearchError);}
}
