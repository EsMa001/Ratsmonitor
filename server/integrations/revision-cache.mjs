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
