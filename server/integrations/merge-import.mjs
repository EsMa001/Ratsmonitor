import {reconcileTopics,withSafeTopicIds,safeIdWarning} from '../../shared/topic-identity.mjs';
import {importedMetadata} from '../../shared/article-record.mjs';
import {windowSpanDays,DEFAULT_HISTORY_WINDOW} from '../../shared/history-window.mjs';
// Notes of an earlier failed attempt; a later successful attempt removes them.
const FAILURE_NOTE=/^(Abruf fehlgeschlagen;|Fehlerursache: )/;
/** Merge a bounded import without erasing older events or the last successful data date. */
export function mergeImport(previous,incoming){
 // Ids that cannot be opened (TOPIC_ID) never reach the stock, whichever path delivered them: collectRegion fixes them
 // already, the packed history of apply-backfill.mjs not.
 const safe=withSafeTopicIds(incoming.topics),warning=safeIdWarning(safe.changed);
 if(warning)incoming={...incoming,topics:safe.topics,coverage:{...incoming.coverage,warnings:[...(incoming.coverage?.warnings||[]),warning]}};
 const prior=new Map((previous?.topics||[]).map(t=>[t.id,t]));
 const merged=reconcileTopics(previous?.topics||[],incoming.topics.map(t=>({...t,metadata:importedMetadata(t,prior.get(t.id),incoming.coverage?.importedAt)})));
 const requested=incoming.coverage?.window,span=windowSpanDays(requested),stored=windowSpanDays(previous?.coverage?.window);
 // No meeting inside a short look-back window is a successful attempt without new data, not an empty source.
 const quiet=incoming.coverage?.quiet===true&&!incoming.topics.length&&span<windowSpanDays(DEFAULT_HISTORY_WINDOW);
 // Every meeting unchanged since it was last read: nothing new to store, and the attempt describes the stock.
 const unchangedOnly=!incoming.topics.length&&incoming.coverage?.unchangedMeetings>0;
 let coverage={...incoming.coverage};delete coverage.quiet;
 if(!incoming.topics.length&&previous?.topics?.length&&!unchangedOnly){
  const lastAttemptAt=incoming.coverage.lastAttemptAt||incoming.coverage.importedAt;
  coverage=quiet?{...previous.coverage,issues:(previous.coverage?.issues||[]).filter(i=>!FAILURE_NOTE.test(String(i))),lastAttemptAt,lastWindow:requested,lastWindowFrom:incoming.coverage.from}
   :{...previous.coverage,complete:false,lastAttemptAt,issues:[...new Set([...(incoming.coverage.issues||[]),'Letzter erfolgreicher Artikelbestand erhalten; der neue Abruf lieferte keine Artikel.'])]};
 }
 // A narrower refresh adds to the stored stock. It neither shrinks the documented period nor
 // turns an older partial period into a complete one.
 else if((incoming.topics.length||unchangedOnly)&&span<stored&&previous?.coverage?.from&&coverage.from&&previous.coverage.from<coverage.from)
  coverage={...coverage,from:previous.coverage.from,window:previous.coverage.window||DEFAULT_HISTORY_WINDOW,lastWindow:requested,lastWindowFrom:incoming.coverage.from,complete:Boolean(previous.coverage.complete)&&Boolean(coverage.complete)};
 if(previous?.coverage&&(previous.coverage.lastAttemptAt||previous.coverage.importedAt||'')>(coverage.lastAttemptAt||coverage.importedAt||''))coverage=previous.coverage;
 return {topics:merged,coverage,quiet};
}
