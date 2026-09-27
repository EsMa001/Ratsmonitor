import {reconcileTopics} from '../../shared/topic-identity.mjs';
import {importedMetadata} from '../../shared/article-record.mjs';
/** Merge a bounded import without erasing older events or the last successful data date. */
export function mergeImport(previous,incoming){
 const prior=new Map((previous?.topics||[]).map(t=>[t.id,t]));
 const merged=reconcileTopics(previous?.topics||[],incoming.topics.map(t=>({...t,metadata:importedMetadata(t,prior.get(t.id),incoming.coverage?.importedAt)})));
 let coverage={...incoming.coverage};
 if(!incoming.topics.length&&previous?.topics?.length){coverage={...previous.coverage,complete:false,lastAttemptAt:incoming.coverage.lastAttemptAt||incoming.coverage.importedAt,issues:[...new Set([...(incoming.coverage.issues||[]),'Letzter erfolgreicher Artikelbestand erhalten; der neue Abruf lieferte keine Artikel.'])]};}
 if(previous?.coverage&&(previous.coverage.lastAttemptAt||previous.coverage.importedAt||'')>(coverage.lastAttemptAt||coverage.importedAt||''))coverage=previous.coverage;
 return {topics:merged,coverage};
}
