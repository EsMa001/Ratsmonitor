// State of an admin job as the page shows it, built from the answers of the server (server/integrations/pipeline-jobs.mjs).
// Without server dependencies: the page and the tests use the same rule.
/**
 * Answers of parallel requests can arrive out of order, and most list only the areas changed since the state the page
 * named (delta). An area is replaced only by a newer state of itself, the job as a whole only by a newer one.
 * latest: the job the page holds, with all its areas; next: an answer of the server. Returns the job to show.
 */
export function mergeJob(latest,next){
 if(next.id!==latest.id)return latest;
 const newer=next.updatedAt>=latest.updatedAt,{delta,wait,heldUntil,...head}=newer?next:latest;
 if(!delta&&newer)return head;
 const changed=new Map(next.items.map(i=>[i.region,i]));
 const items=next.delta?latest.items.map(i=>{const other=changed.get(i.region);return other&&(other.at||'')>=(i.at||'')?other:i;}):latest.items;
 return {...head,items};
}
