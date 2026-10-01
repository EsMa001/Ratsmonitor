import {REQUIRED_FIELDS} from './data-completeness.mjs';
import {ANALYSIS_PENDING_SQL} from './manual-analysis.mjs';
const field=id=>REQUIRED_FIELDS.find(f=>f[0]===id)[2];
export const STAGE_SQL={rules:`NOT (${ANALYSIS_PENDING_SQL})`,summary:field('summary'),aiLabel:`(${field('aiLabel')}) AND json_extract(payload,'$.labelAssessments.ai.basis')='source_content'`,keywords:field('keywords')};
export const STAGE_KEYS=Object.keys(STAGE_SQL);
export const CANONICAL="json_extract(payload,'$.identity.mergedInto') IS NULL";
export async function processingStatus(db){
 const cols=Object.entries(STAGE_SQL).map(([key,sql])=>`coalesce(sum(coalesce((${sql}),0)),0) AS ${key}`).join(',');
 const [groups,state,revision]=await db.batch([
  db.prepare(`SELECT region_id,count(*) total,${cols},coalesce(sum(json_extract(payload,'$.contentAnalysis.status')='insufficient_source'),0) insufficient,coalesce(sum(json_extract(payload,'$.contentAnalysis.status')='stale'),0) stale,max(json_extract(payload,'$.metadata.lastFetchedAt')) fetchedAt,max(json_extract(payload,'$.metadata.lastProcessedAt')) processedAt FROM topics WHERE ${CANONICAL} GROUP BY region_id`),
  db.prepare("SELECT key,value FROM system_state WHERE key IN ('last-data-restore','admin-pipeline-job','admin-ai-job','last-ai-apply')"),
  db.prepare("SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) AS revision")
 ]);
 const saved=Object.fromEntries(state.results.map(r=>{try{return [r.key,JSON.parse(r.value)];}catch{return [r.key,null];}}));
 const ai=saved['admin-ai-job'];
 return {regions:groups.results,revision:Number(revision.results[0]?.revision||0),restore:saved['last-data-restore']||null,lastAiApply:saved['last-ai-apply']||null,job:saved['admin-pipeline-job']||null,aiJob:ai?{id:ai.id,createdAt:ai.createdAt,status:ai.status,kinds:ai.kinds,regions:ai.regions,count:ai.articleCount??ai.articles.length,applied:ai.applied||0}:null};
}
