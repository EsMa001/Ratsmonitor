import {REQUIRED_FIELDS} from './data-completeness.mjs';
import {ANALYSIS_PENDING_SQL} from './manual-analysis.mjs';
const field=id=>REQUIRED_FIELDS.find(f=>f[0]===id)[2];
export const STAGE_SQL={rules:`NOT (${ANALYSIS_PENDING_SQL})`,summary:field('summary'),aiLabel:`(${field('aiLabel')}) AND json_extract(payload,'$.labelAssessments.ai.basis')='source_content'`,keywords:field('keywords')};
export const STAGE_KEYS=Object.keys(STAGE_SQL);
export const AI_STAGE_KEYS=['summary','aiLabel','keywords'];
/** Ein KI-Schritt ist exportierbar, solange für die aktuellen Quelldaten kein gesperrter Fehlversuch vorliegt (aiAttempts, siehe shared/ai-job.mjs). */
export const attemptOpen=k=>`coalesce(json_extract(payload,'$.aiAttempts.${k}.retry'),1)`;
export const blockedSQL=k=>`(NOT coalesce((${STAGE_SQL[k]}),0) AND NOT ${attemptOpen(k)})`;
export const CANONICAL="json_extract(payload,'$.identity.mergedInto') IS NULL";
const stageColumn=([key,sql])=>`coalesce(sum(coalesce((${sql}),0)),0) AS ${key}`;
/**
 * Columns of the processing state per area, for a query over the reports grouped by area. The admin overview puts
 * them into its own single scan of the reports (admin-data.mjs). withRules:false leaves out the rule stage for a
 * caller that counts the pending rule analysis anyway: the rule stage is the total minus the pending ones.
 */
export const stageColumns=({withRules=true}={})=>[...Object.entries(STAGE_SQL).filter(([key])=>withRules||key!=='rules').map(stageColumn),"coalesce(sum(json_extract(payload,'$.contentAnalysis.status')='insufficient_source'),0) insufficient",...AI_STAGE_KEYS.map(k=>`coalesce(sum(${blockedSQL(k)}),0) blocked_${k}`),"coalesce(sum(json_extract(payload,'$.contentAnalysis.status')='stale'),0) stale","max(json_extract(payload,'$.metadata.lastFetchedAt')) fetchedAt","max(json_extract(payload,'$.metadata.lastProcessedAt')) processedAt"].join(',');
/** The stored state of jobs and data revisions. Small rows only; the reports are not read. */
export async function processingState(db){
 const [state,revision]=await db.batch([
  db.prepare("SELECT key,value FROM system_state WHERE key IN ('last-data-restore','admin-pipeline-job','admin-ai-job','last-ai-apply')"),
  db.prepare("SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) AS revision")
 ]);
 const saved=Object.fromEntries(state.results.map(r=>{try{return [r.key,JSON.parse(r.value)];}catch{return [r.key,null];}}));
 const ai=saved['admin-ai-job'];
 return {revision:Number(revision.results[0]?.revision||0),restore:saved['last-data-restore']||null,lastAiApply:saved['last-ai-apply']||null,job:saved['admin-pipeline-job']||null,aiJob:ai?{id:ai.id,createdAt:ai.createdAt,status:ai.status,kinds:ai.kinds,scope:ai.scope||'selection',window:ai.window||null,regions:ai.regions,count:ai.articleCount??ai.articles.length,steps:ai.requestedSteps??null,blocked:ai.blocked??0,applied:ai.applied||0}:null};
}
export async function processingStatus(db){
 const [groups,state]=await Promise.all([db.prepare(`SELECT region_id,count(*) total,${stageColumns()} FROM topics WHERE ${CANONICAL} GROUP BY region_id`).all(),processingState(db)]);
 return {regions:groups.results,...state};
}
