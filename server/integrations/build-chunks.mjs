// Chunks of areas for the builds of the administration (admin-builds.mjs, quality-check.mjs): areas of region_revisions
// in binary order after a cursor, as many as fit into a number of stored reports. Sizes count every stored row of an
// area (index on region_id), merged ones included.
const MAX_IDS=500,CANDIDATES=600;
/** The next chunk after the cursor: {ids,rows}, areas in binary order, their reports adding up to at most chunkRows. */
export async function nextChunk(db,cursor,chunkRows){
 const rows=(await db.prepare('SELECT r.region_id id,(SELECT count(*) FROM topics t WHERE t.region_id=r.region_id) n FROM region_revisions r WHERE r.region_id>? ORDER BY r.region_id LIMIT ?').bind(cursor,CANDIDATES).all()).results;
 const chunk=[];let size=0;
 for(const r of rows){const n=Number(r.n||0);if(chunk.length&&(size+n>chunkRows||chunk.length>=MAX_IDS))break;chunk.push(String(r.id));size+=n;}
 return {ids:chunk,rows:size};
}
