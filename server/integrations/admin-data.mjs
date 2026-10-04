import {processingState,stageColumns} from './processing-status.mjs';
import {lockedUntil} from './import-lock.mjs';
import {CATALOG as regions} from '../../shared/catalog.mjs';
import {LABELS} from '../../shared/labels.mjs';
import {sourceHealth,REVIEW_FILTERS} from '../../shared/admin.mjs';
import {NRW_SOURCES} from './source-catalog.mjs';
import {SOURCES} from './regions.mjs';
import {ANALYSIS_PENDING_SQL} from './manual-analysis.mjs';
const canonical="json_extract(payload,'$.identity.mergedInto') IS NULL";
const conditions={labels:"coalesce(json_extract(payload,'$.classification.primary'),'unklar')='unklar'",status:"status='unknown'",identity:"json_extract(payload,'$.identity.conflict')=1",summaries:"coalesce(json_extract(payload,'$.documentIssue'),'')!='' OR coalesce(json_extract(payload,'$.summaryIssue'),'')!='' OR json_extract(payload,'$.contentAnalysis.status') IN ('insufficient_source','failed','stale') OR json_extract(payload,'$.contentAnalysis.reason') IS NOT NULL"};
const configuredSources=[...SOURCES.map(s=>({...s,method:s.id==='recklinghausen'?'official-api':'scraper'})),...NRW_SOURCES,{id:'muenster',method:'oparl',system:'https://oparl.stadt-muenster.de/system'}];
const readJson=s=>{try{return JSON.parse(s||'{}');}catch{return {};}};
const label="coalesce(json_extract(payload,'$.classification.primary'),'unklar')";
// total: the number of matching reports if the caller knows it already; the count query is then left out.
export async function adminReview(db,issue='labels',region='all',{total}={}){
 if(!REVIEW_FILTERS.some(f=>f.id===issue)||region!=='all'&&!regions.some(r=>r.id===region))throw Error('Ungültiger Prüffilter');
 const where=`${canonical} AND (${conditions[issue]})`+(region!=='all'?' AND region_id=?':'');
 const args=region!=='all'?[region]:[];
 const [items,count]=await db.batch([
  db.prepare(`SELECT id,region_id AS regionId,status,updated_at AS updatedAt,json_extract(payload,'$.title') AS title,${label} AS label,json_extract(payload,'$.generatedBy') AS generatedBy FROM topics WHERE ${where} ORDER BY updated_at DESC,id LIMIT 25`).bind(...args),
  ...(total===undefined?[db.prepare(`SELECT count(*) total FROM topics WHERE ${where}`).bind(...args)]:[])
 ]);
 return {issue,total:Number(total??count.results[0].total),articles:items.results};
}
// Figures of the reports that are added up over all areas. Each name is a column of the scan below.
const TOTALS=['contentSummaries','insufficient','stale','aiLabels','weightedKeywords','aiSummaries','qualityPassed','updated7d','pdfArticles','conflicts','textIssues','pendingAnalysis'];
/**
 * The reports are read once, grouped by area in the order of an index; every figure of the overview is a sum of that
 * one scan (totals, per area, per label, processing stages). Reading the stored reports is what costs time, so each
 * further scan would add about as much again. Grouping by anything that is not in the index would sort whole rows.
 * review:false leaves out the review list, which needs a scan of its own and is shown on page 2 only.
 */
export async function loadAdminData(db,{now=new Date(),aiConfigured=false,pushConfigured=false,review=true}={}){
 const week=new Date(now.getTime()-7*86400000).toISOString();
 const queries=[
  db.prepare(`SELECT region_id,count(*) count,coalesce(sum(json_extract(payload,'$.contentAnalysis.status')='completed'),0) contentSummaries,coalesce(sum(json_extract(payload,'$.labelAssessments.ai.primary') IS NOT NULL),0) aiLabels,coalesce(sum(json_extract(payload,'$.weightedKeywords.status')='completed'),0) weightedKeywords,coalesce(sum(json_extract(payload,'$.generatedBy') LIKE 'KI-Zusammenfassung%'),0) aiSummaries,coalesce(sum(json_extract(payload,'$.quality.passed')=1),0) qualityPassed,coalesce(sum(updated_at>=? AND updated_at<=?),0) updated7d,coalesce(sum(EXISTS(SELECT 1 FROM json_each(json_extract(topics.payload,'$.documents')) d WHERE json_extract(d.value,'$.kind')='application/pdf')),0) pdfArticles,coalesce(sum(json_extract(payload,'$.identity.conflict')=1),0) conflicts,coalesce(sum((${conditions.summaries})),0) textIssues,coalesce(sum(${ANALYSIS_PENDING_SQL}),0) pendingAnalysis,${stageColumns({withRules:false})},${LABELS.map(l=>`coalesce(sum(${label}='${l.id}'),0) AS label_${l.id}`).join(',')} FROM topics WHERE ${canonical} GROUP BY region_id`).bind(week,now.toISOString()),
  db.prepare('SELECT region_id,payload FROM source_coverage'),
  db.prepare(`SELECT status AS id,count(*) count FROM topics WHERE ${canonical} GROUP BY status`),
  db.prepare('SELECT id,started_at,finished_at,status,details FROM import_runs ORDER BY started_at DESC LIMIT 30'),
  db.prepare('SELECT (SELECT count(*) FROM article_versions) versions,(SELECT count(*) FROM article_analyses) analysisVersions,(SELECT count(*) FROM topics) stored,(SELECT count(*) FROM push_subscriptions) pushSubscriptions'),
  db.prepare("SELECT key,value FROM system_state WHERE key='import-lock'"),
  db.prepare("SELECT max(started_at) lastScheduledAt FROM import_runs WHERE json_extract(details,'$.trigger')='scheduled'")
 ];
 const [[scan,coverage,statuses,runRows,extra,lockRows,scheduled],state]=await Promise.all([db.batch(queries),processingState(db)]);
 const areas=new Map(scan.results.map(r=>[r.region_id,r])),sum=key=>scan.results.reduce((n,r)=>n+Number(r[key]||0),0),online=sum('count');
 const {stored,...other}=extra.results[0];
 // Merged reports are all stored rows that are not articles of their own.
 const counts={online,unlabelled:sum('label_unklar'),...Object.fromEntries(TOTALS.map(key=>[key==='insufficient'?'summaryInsufficient':key==='stale'?'summaryStale':key,sum(key)])),...Object.fromEntries(Object.entries(other).map(([k,v])=>[k,Number(v||0)])),aliases:Number(stored||0)-online};
 const byCoverage=new Map(coverage.results.map(r=>[r.region_id,readJson(r.payload)]));
 const stages=r=>r?{region_id:r.region_id,total:Number(r.count),rules:Number(r.count)-Number(r.pendingAnalysis),summary:r.summary,aiLabel:r.aiLabel,keywords:r.keywords,insufficient:r.insufficient,stale:r.stale,blocked_summary:r.blocked_summary,blocked_aiLabel:r.blocked_aiLabel,blocked_keywords:r.blocked_keywords,fetchedAt:r.fetchedAt,processedAt:r.processedAt}:{total:0,rules:0,summary:0,aiLabel:0,keywords:0,insufficient:0,stale:0,blocked_summary:0,blocked_aiLabel:0,blocked_keywords:0,fetchedAt:null,processedAt:null};
 const sources=regions.map(r=>{const config=configuredSources.find(s=>s.id===r.id),c={method:config?.method||'pending',complete:false,issues:[],...byCoverage.get(r.id)},area=areas.get(r.id);const count=Number(area?.count||0),health=sourceHealth(c,count,now);return {id:r.id,name:r.name,ags:r.ags,land:r.ags.slice(0,2),kind:r.kind,count,pendingAnalysis:Number(area?.pendingAnalysis||0),method:c.method||'pending',attemptStatus:c.attemptStatus||null,processing:stages(area),...health,canImport:!!config&&config.method!=='pending',complete:!!c.complete,lastAttemptAt:c.lastAttemptAt||c.importedAt||null,nextRetryAt:c.nextRetryAt||null,sourceUrl:c.sourceUrl||config?.system||config?.base||null,issues:Array.isArray(c.issues)?c.issues.map(String):[],warnings:Array.isArray(c.warnings)?c.warnings.map(String):[]};});
 const runs=runRows.results.map(r=>{const d=readJson(r.details);return {id:r.id,startedAt:r.started_at,finishedAt:r.finished_at,status:r.status,region:d.region||'muenster',mode:d.mode||'metadata',trigger:d.trigger||'unbekannt',count:typeof(d.count??d.processed)==='number'?(d.count??d.processed):null,issueCount:Array.isArray(d.issues)?d.issues.length:0,abandoned:r.status==='running'&&Date.parse(r.started_at)<now.getTime()-600000};});
 const until=lockedUntil(lockRows.results[0]?.value);
 // The default review list shows the reports without a label; their number is known from the scan.
 return {asOf:now.toISOString(),processing:{...state,regions:undefined},counts,sources,statuses:statuses.results,labels:LABELS.map(l=>({id:l.id,name:l.name,count:sum('label_'+l.id)})),runs,lastScheduledAt:scheduled.results[0]?.lastScheduledAt||null,importBusyUntil:until>now.getTime()?new Date(until).toISOString():null,operations:{aiConfigured,pushConfigured},review:review?await adminReview(db,'labels','all',{total:counts.unlabelled}):{issue:'labels',total:counts.unlabelled,articles:[]}};
}
