import {processingState,stageColumns} from './processing-status.mjs';
import {lockedUntil} from './import-lock.mjs';
import {atRevision} from './revision-cache.mjs';
import {CATALOG as regions} from '../../shared/catalog.mjs';
import {LABELS} from '../../shared/labels.mjs';
import {sourceHealth,REVIEW_FILTERS} from '../../shared/admin.mjs';
import {NRW_SOURCES} from './source-catalog.mjs';
import {SOURCES} from './regions.mjs';
import {ANALYSIS_PENDING_SQL} from './manual-analysis.mjs';
import {accessOfSource,accessLabel,channelOf} from '../../shared/source-access.mjs';
import robotsVerdicts from './source-robots.json' with {type:'json'};
import atlas from './source-atlas.json' with {type:'json'};
const canonical="json_extract(payload,'$.identity.mergedInto') IS NULL";
const conditions={labels:"coalesce(json_extract(payload,'$.classification.primary'),'unklar')='unklar'",status:"status='unknown'",identity:"json_extract(payload,'$.identity.conflict')=1",summaries:"coalesce(json_extract(payload,'$.documentIssue'),'')!='' OR coalesce(json_extract(payload,'$.summaryIssue'),'')!='' OR json_extract(payload,'$.contentAnalysis.status') IN ('insufficient_source','failed','stale') OR json_extract(payload,'$.contentAnalysis.reason') IS NOT NULL"};
const configuredSources=[...SOURCES.map(s=>({...s,method:s.id==='recklinghausen'?'official-api':'scraper'})),...NRW_SOURCES,{id:'muenster',method:'oparl',system:'https://oparl.stadt-muenster.de/system'}];
// The first entry of an area counts, as in the list above; the catalog holds several thousand areas.
const configuredById=new Map([...configuredSources].reverse().map(s=>[s.id,s]));
// Access of programs per area (shared/source-access.mjs: OParl, then API, then HTML pages, where robots.txt gives the
// label; then a technical block): of a connected source from its reader and the robots.txt verdict of its path
// (source-robots.json), of an area without source from its last check (source-atlas.json, scripts/dashboard/build.mjs).
const accessFields=(id,config)=>{const connected=!!config&&config.method!=='pending',access=connected?accessOfSource(config,robotsVerdicts.sources?.[id]):atlas.areas?.[id]?.z||'none';return {access,accessLabel:accessLabel(access),channel:connected?channelOf(config).name:''};};
const readJson=s=>{try{return JSON.parse(s||'{}');}catch{return {};}};
const label="coalesce(json_extract(payload,'$.classification.primary'),'unklar')";
// Figure of region_stats that counts the reports of a review filter. "status" has none: it is counted on its index.
const REVIEW_FIGURES={labels:'label_unklar',identity:'conflicts',summaries:'textIssues'};
// Up to this many matches over all areas a reason counts as rare: it is read in the areas that hold it.
const RARE_REVIEW=1000;
/**
 * Matching reports of a review filter and the areas that hold them, from the figures of region_stats instead of a scan
 * of all reports (13 s at 900,000). An area changed since its figures were computed is counted on its own, so the
 * total is exact. null without the tables (migration 0011), for "status", or with more than 100 such areas.
 */
async function reviewScope(db,issue,region){
 const figure=REVIEW_FIGURES[issue];if(!figure)return null;
 const one=region!=='all',args=one?[region]:[];
 let rows;
 try{rows=(await db.prepare(`SELECT r.region_id,CASE WHEN s.revision=r.revision THEN coalesce(json_extract(s.stats,'$.${figure}'),0) END n FROM region_revisions r LEFT JOIN region_stats s ON s.region_id=r.region_id WHERE (s.revision IS NOT r.revision OR json_extract(s.stats,'$.${figure}')>0)${one?' AND r.region_id=?':''}`).bind(...args).all()).results;}
 catch(e){if(/no such table/i.test(String(e?.message||e)))return null;throw e;}
 const stale=rows.filter(r=>r.n===null).map(r=>r.region_id);
 if(stale.length>D1_MAX_PARAMETERS)return null;
 let changed=0;
 if(stale.length)changed=Number((await db.prepare(`SELECT count(*) n FROM topics WHERE ${canonical} AND (${conditions[issue]}) AND region_id IN (${stale.map(()=>'?').join(',')})`).bind(...stale).first())?.n||0);
 return {total:rows.reduce((n,r)=>n+Number(r.n||0),0)+changed,regions:rows.map(r=>r.region_id)};
}
// total: the number of matching reports if the caller knows it already; the count query is then left out.
export async function adminReview(db,issue='labels',region='all',{total}={}){
 if(!REVIEW_FILTERS.some(f=>f.id===issue)||region!=='all'&&!regions.some(r=>r.id===region))throw Error('Ungültiger Prüffilter');
 const all=region==='all';
 let where=`${canonical} AND (${conditions[issue]})`+(all?'':' AND region_id=?'),args=all?[]:[region];
 const scope=total===undefined||all?await reviewScope(db,issue,region):null;
 let known=total??scope?.total;
 if(known===undefined&&issue==='status')known=Number((await db.prepare(`SELECT count(*) total FROM topics INDEXED BY idx_topics_canonical_region_status WHERE ${where}`).bind(...args).first())?.total||0);
 if(known===0)return {issue,total:0,articles:[]};
 // Over all areas a rare reason is read in the areas that hold it; a frequent one from the newest report on (index of
 // migration 0012), which stops after 25 hits instead of sorting every report.
 let from='topics';
 if(all&&scope&&scope.total<=RARE_REVIEW&&scope.regions.length<=D1_MAX_PARAMETERS){where+=` AND region_id IN (${scope.regions.map(()=>'?').join(',')})`;args=scope.regions;}
 else if(all)from='topics INDEXED BY idx_topics_canonical_updated';
 const list=table=>db.prepare(`SELECT id,region_id AS regionId,status,updated_at AS updatedAt,json_extract(payload,'$.title') AS title,${label} AS label,json_extract(payload,'$.generatedBy') AS generatedBy FROM ${table} WHERE ${where} ORDER BY updated_at DESC,id LIMIT 25`).bind(...args).all();
 // Without migration 0012 the index is missing: then the former plan.
 const items=await list(from).catch(e=>{if(from!=='topics'&&/no such index/i.test(String(e?.message||e)))return list('topics');throw e;});
 if(known===undefined)known=Number((await db.prepare(`SELECT count(*) total FROM topics WHERE ${where}`).bind(...args).first())?.total||0);
 return {issue,total:Number(known),articles:items.results};
}
// Figures of the reports that are added up over all areas. Each name is a column of the scan below.
const TOTALS=['contentSummaries','insufficient','stale','aiLabels','weightedKeywords','aiSummaries','qualityPassed','updated7d','pdfArticles','conflicts','textIssues','pendingAnalysis'];
// Figures of one area from its stored reports; every one is a sum over the area's canonical reports.
const FIGURES=`coalesce(sum(json_extract(payload,'$.contentAnalysis.status')='completed'),0) contentSummaries,coalesce(sum(json_extract(payload,'$.labelAssessments.ai.primary') IS NOT NULL),0) aiLabels,coalesce(sum(json_extract(payload,'$.weightedKeywords.status')='completed'),0) weightedKeywords,coalesce(sum(json_extract(payload,'$.generatedBy') LIKE 'KI-Zusammenfassung%'),0) aiSummaries,coalesce(sum(json_extract(payload,'$.quality.passed')=1),0) qualityPassed,coalesce(sum(EXISTS(SELECT 1 FROM json_each(json_extract(topics.payload,'$.documents')) d WHERE json_extract(d.value,'$.kind')='application/pdf')),0) pdfArticles,coalesce(sum(json_extract(payload,'$.identity.conflict')=1),0) conflicts,coalesce(sum((${conditions.summaries})),0) textIssues,coalesce(sum(${ANALYSIS_PENDING_SQL}),0) pendingAnalysis,${stageColumns({withRules:false})},${LABELS.map(l=>`coalesce(sum(${label}='${l.id}'),0) AS label_${l.id}`).join(',')}`;
/**
 * Figures per area for the overview, from region_stats. Every change of a report raises the revision of its area
 * (triggers of migration 0011); only areas whose revision differs from the one their figures were computed at are read
 * again, a few areas at a time until budgetMs is spent. Areas left over keep their previous figures and are counted in
 * pending; the next call continues with them. The number of reports and "updated in the last seven days" come from
 * indexes on every call and are always current.
 * Returns null if the tables are missing (migration not applied): the caller then scans all reports as before.
 */
export const D1_MAX_PARAMETERS=100;
export async function regionFigures(db,{now=new Date(),budgetMs=8000,chunkRows=25000}={}){
 const started=Date.now(),week=new Date(now.getTime()-7*86400000).toISOString();
 let revisions,stored,sizes,recent;
 try{
  [revisions,stored,sizes,recent]=await db.batch([
   db.prepare('SELECT region_id,revision FROM region_revisions'),
   db.prepare('SELECT region_id,revision,stats FROM region_stats'),
   db.prepare(`SELECT region_id,count(*) n FROM topics WHERE ${canonical} GROUP BY region_id`),
   db.prepare(`SELECT region_id,count(*) n FROM topics WHERE ${canonical} AND updated_at>=? AND updated_at<=? GROUP BY region_id`).bind(week,now.toISOString())
  ]);
 }catch(e){if(/no such table/i.test(String(e?.message||e)))return null;throw e;}
 const kept=new Map(stored.results.map(r=>[r.region_id,{revision:Number(r.revision),row:readJson(r.stats)}]));
 const size=new Map(sizes.results.map(r=>[r.region_id,Number(r.n)])),week7=new Map(recent.results.map(r=>[r.region_id,Number(r.n)]));
 // Smallest areas first: most areas are done within the first call, the largest get a query of their own.
 const stale=revisions.results.filter(r=>kept.get(r.region_id)?.revision!==Number(r.revision)).map(r=>({id:r.region_id,revision:Number(r.revision),rows:size.get(r.region_id)||0})).sort((a,b)=>a.rows-b.rows||a.id.localeCompare(b.id));
 let done=0;
 while(done<stale.length&&Date.now()-started<budgetMs){
  // D1 binds at most 100 parameters per statement: the ids of one chunk are bound in its IN list.
  const chunk=[];let rows=0;
  while(done+chunk.length<stale.length&&chunk.length<D1_MAX_PARAMETERS&&(chunk.length===0||rows+stale[done+chunk.length].rows<=chunkRows)){const next=stale[done+chunk.length];chunk.push(next);rows+=next.rows;}
  const scan=await db.prepare(`SELECT region_id,count(*) count,${FIGURES} FROM topics WHERE ${canonical} AND region_id IN (${chunk.map(()=>'?').join(',')}) GROUP BY region_id`).bind(...chunk.map(c=>c.id)).all();
  const found=new Map(scan.results.map(r=>[r.region_id,r])),at=now.toISOString();
  // An area without canonical reports gets empty figures, so it is not read again until it changes.
  await db.batch(chunk.map(c=>{const row=found.get(c.id)||{region_id:c.id,count:0};kept.set(c.id,{revision:c.revision,row});return db.prepare('INSERT OR REPLACE INTO region_stats(region_id,revision,computed_at,stats) VALUES(?,?,?,?)').bind(c.id,c.revision,at,JSON.stringify(row));}));
  done+=chunk.length;
 }
 const rows=[];
 for(const [id,n] of size){const row=kept.get(id)?.row||{};rows.push({...row,region_id:id,count:n,updated7d:week7.get(id)||0});}
 return {rows,pending:stale.length-done};
}
/**
 * The reports are read once, grouped by area in the order of an index; every figure of the overview is a sum of that
 * one scan (totals, per area, per label, processing stages). Reading the stored reports is what costs time, so each
 * further scan would add about as much again. Grouping by anything that is not in the index would sort whole rows.
 * review:false leaves out the review list, which needs a scan of its own and is shown on page 2 only.
 */
export async function loadAdminData(db,{now=new Date(),aiConfigured=false,pushConfigured=false,review=true,statsBudgetMs=8000}={}){
 const week=new Date(now.getTime()-7*86400000).toISOString();
 // The scan of the reports is kept until the reports change (revision-cache.mjs); "updated in the last seven days" moves
 // with the clock, so a kept result also ends with the hour.
 // Figures per area from region_stats (computed for changed areas only, see regionFigures); without that table (migration
 // 0011 not applied) the former single scan over all reports, kept until the reports change. The count by status reads
 // the partial index of migration 0002 (forced: left alone, SQLite reads the whole table, 0.5 s per 100,000 reports).
 const figures=await regionFigures(db,{now,budgetMs:statsBudgetMs});
 const scanned=()=>db.batch([
  db.prepare(`SELECT region_id,count(*) count,coalesce(sum(updated_at>=? AND updated_at<=?),0) updated7d,${FIGURES} FROM topics WHERE ${canonical} GROUP BY region_id`).bind(week,now.toISOString()),
  db.prepare(`SELECT status AS id,count(*) count FROM topics WHERE ${canonical} GROUP BY status`)
 ]);
 const queries=[
  db.prepare('SELECT region_id,payload FROM source_coverage'),
  db.prepare('SELECT id,started_at,finished_at,status,details FROM import_runs ORDER BY started_at DESC LIMIT 30'),
  db.prepare('SELECT (SELECT count(*) FROM article_versions) versions,(SELECT count(*) FROM article_analyses) analysisVersions,(SELECT count(*) FROM topics) stored,(SELECT count(*) FROM push_subscriptions) pushSubscriptions'),
  db.prepare("SELECT key,value FROM system_state WHERE key='import-lock'"),
  db.prepare("SELECT max(started_at) lastScheduledAt FROM import_runs WHERE json_extract(details,'$.trigger')='scheduled'")
 ];
 const [[scan,statuses],[coverage,runRows,extra,lockRows,scheduled],state]=await Promise.all([figures?db.batch([db.prepare(`SELECT status AS id,count(*) count FROM topics INDEXED BY idx_topics_canonical_region_status WHERE ${canonical} GROUP BY status`)]).then(([statuses])=>[{results:figures.rows},statuses]):atRevision(db,'overview|'+now.toISOString().slice(0,13),scanned),db.batch(queries),processingState(db)]);
 const areas=new Map(scan.results.map(r=>[r.region_id,r])),sum=key=>scan.results.reduce((n,r)=>n+Number(r[key]||0),0),online=sum('count');
 const {stored,...other}=extra.results[0];
 // Merged reports are all stored rows that are not articles of their own.
 const counts={online,unlabelled:sum('label_unklar'),...Object.fromEntries(TOTALS.map(key=>[key==='insufficient'?'summaryInsufficient':key==='stale'?'summaryStale':key,sum(key)])),...Object.fromEntries(Object.entries(other).map(([k,v])=>[k,Number(v||0)])),aliases:Number(stored||0)-online};
 const byCoverage=new Map(coverage.results.map(r=>[r.region_id,readJson(r.payload)]));
 const stages=r=>r?{region_id:r.region_id,total:Number(r.count),rules:Number(r.count)-Number(r.pendingAnalysis),summary:r.summary,aiLabel:r.aiLabel,keywords:r.keywords,insufficient:r.insufficient,stale:r.stale,blocked_summary:r.blocked_summary,blocked_aiLabel:r.blocked_aiLabel,blocked_keywords:r.blocked_keywords,fetchedAt:r.fetchedAt,processedAt:r.processedAt}:{total:0,rules:0,summary:0,aiLabel:0,keywords:0,insufficient:0,stale:0,blocked_summary:0,blocked_aiLabel:0,blocked_keywords:0,fetchedAt:null,processedAt:null};
 const sources=regions.map(r=>{const config=configuredById.get(r.id),c={method:config?.method||'pending',complete:false,issues:[],...byCoverage.get(r.id)},area=areas.get(r.id);const count=Number(area?.count||0),health=sourceHealth(c,count,now);return {id:r.id,name:r.name,ags:r.ags,land:r.ags.slice(0,2),kind:r.kind,count,pendingAnalysis:Number(area?.pendingAnalysis||0),method:c.method||'pending',attemptStatus:c.attemptStatus||null,processing:stages(area),...health,canImport:!!config&&config.method!=='pending',...accessFields(r.id,config),complete:!!c.complete,lastAttemptAt:c.lastAttemptAt||c.importedAt||null,nextRetryAt:c.nextRetryAt||null,sourceUrl:c.sourceUrl||config?.system||config?.base||null,issues:Array.isArray(c.issues)?c.issues.map(String):[],warnings:Array.isArray(c.warnings)?c.warnings.map(String):[]};});
 const runs=runRows.results.map(r=>{const d=readJson(r.details);return {id:r.id,startedAt:r.started_at,finishedAt:r.finished_at,status:r.status,region:d.region||'muenster',mode:d.mode||'metadata',trigger:d.trigger||'unbekannt',count:typeof(d.count??d.processed)==='number'?(d.count??d.processed):null,issueCount:Array.isArray(d.issues)?d.issues.length:0,abandoned:r.status==='running'&&Date.parse(r.started_at)<now.getTime()-600000};});
 const until=lockedUntil(lockRows.results[0]?.value);
 // The default review list shows the reports without a label; their number is known from the scan.
 return {asOf:now.toISOString(),...(figures?.pending?{statsPending:figures.pending}:{}),processing:{...state,regions:undefined},counts,sources,statuses:statuses.results,labels:LABELS.map(l=>({id:l.id,name:l.name,count:sum('label_'+l.id)})),runs,lastScheduledAt:scheduled.results[0]?.lastScheduledAt||null,importBusyUntil:until>now.getTime()?new Date(until).toISOString():null,operations:{aiConfigured,pushConfigured},review:review?await adminReview(db,'labels','all',{total:counts.unlabelled}):{issue:'labels',total:counts.unlabelled,articles:[]}};
}
