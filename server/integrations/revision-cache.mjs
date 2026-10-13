/**
 * Results of scans over all stored reports, kept while the content revision is unchanged.
 *
 * Reading every report costs seconds (about ten for 145,000 reports), and the administration asks for the same
 * figures with every page view. The revision (data_revisions, raised by triggers on every change of reports, versions
 * and analyses) says whether the reports changed; if not, the last result is still right.
 * - Kept per database object and key, in the memory of the running worker; a restart starts empty.
 * - Only finished results are kept, never a pending request.
 * - The revision is read before the scan. A change during the scan leaves a result labelled with the older revision;
 *   the next call sees the newer one and scans again.
 */
const kept=new WeakMap();
/** Reports, versions and analyses. */
export const CONTENT_REVISION_SQL="SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) AS revision";
/**
 * Reports, versions, analyses and the source states (source_coverage). Since migration 0018 the source states count
 * 'coverage' of their own, because every import step writes them; before it they raised 'content', and 'coverage' is 0.
 * Both only rise, so the sum changes exactly when either does.
 */
export const SOURCES_REVISION_SQL="SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0)+coalesce((SELECT revision FROM data_revisions WHERE id='coverage'),0) AS revision";
/** options.sources: the result shows source states as well (SOURCES_REVISION_SQL). */
export async function atRevision(db,key,compute,{sources=false}={}){
 const row=await db.prepare(sources?SOURCES_REVISION_SQL:CONTENT_REVISION_SQL).first();
 const revision=Number(row?.revision||0);
 let entries=kept.get(db);if(!entries){entries=new Map();kept.set(db,entries);}
 const hit=entries.get(key);
 if(hit&&hit.revision===revision)return hit.value;
 const value=await compute();
 // A few keys only (the overview per hour); older ones of the same kind are dropped. Timeline keys are kept per basis.
 const kindOf=k=>k.startsWith('timeline|')?k:k.split('|')[0],kind=kindOf(key);for(const other of entries.keys())if(kindOf(other)===kind)entries.delete(other);
 entries.set(key,{revision,value});
 return value;
}
/** Key of a request: kind, today and the sorted query parameters (results that count "the last 12 months" change daily). */
export const paramsKey=(kind,params)=>`${kind}|${new Date().toISOString().slice(0,10)}|${[...new URLSearchParams(params)].map(([k,v])=>k+'='+v).sort().join('&')}`;
/* Requests by filter (paramsKey): up to KEEP_PER_KIND filters per kind, the oldest dropped first. After an import the
   last result of the same key is answered for up to STALE_MS while the new one is computed in the background, as in
   the first view after an import then does not wait for a scan. revisionSql: own revision instead of the content revision
   (plenara.X: X_REVISION_SQL, the numbers change only with a new build of x_cases). */
const byFilter=new WeakMap(),KEEP_PER_KIND=20,STALE_MS=6*3600e3;
export async function atRevisionStale(db,key,compute,{revisionSql=''}={}){
 const row=await db.prepare(revisionSql||CONTENT_REVISION_SQL).first();
 const revision=revisionSql?String(row?.revision??''):Number(row?.revision||0);
 let entries=byFilter.get(db);if(!entries){entries=new Map();byFilter.set(db,entries);}
 const hit=entries.get(key);
 const fresh=()=>compute().then(value=>{
  entries.delete(key);entries.set(key,{revision,value,at:Date.now()});
  const kind=key.split('|')[0],same=[...entries.keys()].filter(k=>k.split('|')[0]===kind);
  for(const k of same.slice(0,Math.max(0,same.length-KEEP_PER_KIND)))entries.delete(k);
  return value;
 });
 if(hit&&hit.revision===revision){entries.delete(key);entries.set(key,hit);return hit.value;}
 if(hit&&Date.now()-hit.at<STALE_MS){
  if(!hit.busy){hit.busy=true;fresh().catch(()=>{}).finally(()=>{hit.busy=false;});}
  return hit.value;
 }
 return fresh();
}
