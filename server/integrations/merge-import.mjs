import {reconcileTopics} from '../../shared/topic-identity.mjs';
import {importedMetadata} from '../../shared/article-record.mjs';
import {windowSpanDays,DEFAULT_HISTORY_WINDOW} from '../../shared/history-window.mjs';
/** Merge a bounded import without erasing older events or the last successful data date. */
export function mergeImport(previous,incoming){
 const prior=new Map((previous?.topics||[]).map(t=>[t.id,t]));
 const merged=reconcileTopics(previous?.topics||[],incoming.topics.map(t=>({...t,metadata:importedMetadata(t,prior.get(t.id),incoming.coverage?.importedAt)})));
 const requested=incoming.coverage?.window,span=windowSpanDays(requested),stored=windowSpanDays(previous?.coverage?.window);
 // No meeting inside a short look-back window is a successful attempt without new data, not an empty source.
 const quiet=incoming.coverage?.quiet===true&&!incoming.topics.length&&span<windowSpanDays(DEFAULT_HISTORY_WINDOW);
 let coverage={...incoming.coverage};delete coverage.quiet;
 if(!incoming.topics.length&&previous?.topics?.length){
  const lastAttemptAt=incoming.coverage.lastAttemptAt||incoming.coverage.importedAt;
  coverage=quiet?{...previous.coverage,lastAttemptAt,lastWindow:requested,lastWindowFrom:incoming.coverage.from}
   :{...previous.coverage,complete:false,lastAttemptAt,issues:[...new Set([...(incoming.coverage.issues||[]),'Letzter erfolgreicher Artikelbestand erhalten; der neue Abruf lieferte keine Artikel.'])]};
 }
 // A narrower refresh adds to the stored stock. It neither shrinks the documented period nor
 // turns an older partial period into a complete one.
 else if(incoming.topics.length&&span<stored&&previous?.coverage?.from&&coverage.from&&previous.coverage.from<coverage.from)
  coverage={...coverage,from:previous.coverage.from,window:previous.coverage.window||DEFAULT_HISTORY_WINDOW,lastWindow:requested,lastWindowFrom:incoming.coverage.from,complete:Boolean(previous.coverage.complete)&&Boolean(coverage.complete)};
 if(previous?.coverage&&(previous.coverage.lastAttemptAt||previous.coverage.importedAt||'')>(coverage.lastAttemptAt||coverage.importedAt||''))coverage=previous.coverage;
 return {topics:merged,coverage,quiet};
}
