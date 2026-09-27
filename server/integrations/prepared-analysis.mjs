import {analysisSignature,validKeywords,RECORD_VERSION} from '../../shared/article-record.mjs';
import {classifyTopic,LABELS} from '../../shared/labels.mjs';
import {hasCurrentLabel} from '../../shared/analysis-state.mjs';
import {features,MATCH_VERSION} from '../../shared/similarity.mjs';
import {invalidateReads} from '../services/read-cache.mjs';
const sourceUrl=u=>{try{const v=new URL(u);return v.protocol==='https:'&&v.hostname==='ratsinfo.billerbeck.de'&&v.pathname.startsWith('/bi/')&&!v.username&&!v.password;}catch{return false;}};
export function validatePreparedArticle(a){
 if(!a||!a.articleId?.startsWith('billerbeck-')||!a.officialTitle||!a.expectedSignature||!a.shortSummary||!Array.isArray(a.longSummary)||!a.longSummary.length)throw Error('Ungültiger Artikel');
 const c=a.contentAnalysis;
 if(!c||!['completed','insufficient_source','failed'].includes(c.status)||c.method!=='codex-direct-v1'||!c.id||!c.generatedAt||!/^[a-f0-9]{64}$/.test(c.inputHash))throw Error('Ungültiger Analysenachweis');
 if(!Array.isArray(c.evidence)||!c.evidence.every(e=>sourceUrl(e.url)&&typeof e.quote==='string'&&e.quote.length>0&&e.quote.length<=700)||c.status==='completed'&&!c.evidence.length)throw Error('Belege fehlen');
 if(!Array.isArray(c.sourceDocuments)||!c.sourceDocuments.every(d=>sourceUrl(d.url)&&/^[a-f0-9]{64}$/.test(d.hash)&&d.fetchedAt))throw Error('Quellenstand fehlt');
 if(a.shortSummary.split(/\s+/).length>65||a.longSummary.join(' ').length>6500)throw Error('Zusammenfassung zu lang');
 if(a.weightedKeywords&&!validKeywords(a.weightedKeywords))throw Error('Stichwortgewichte müssen ganzzahlig sein und 100 ergeben');
 if(a.aiLabel&&!LABELS.some(l=>l.id===a.aiLabel.primary))throw Error('Unbekanntes KI-Label');
 if(a.events&&!a.events.every(e=>sourceUrl(e.url)&&(!e.decision||sourceUrl(e.decision.sourceUrl))&&(!e.attendance||e.attendance.people.every(p=>sourceUrl(p.sourceUrl)&&['present','absent','unknown'].includes(p.presence)))))throw Error('Unbelegte Vorgangsdaten');
 return true;
}
// Explicit operator action: stores already evaluated results; never generates AI text.
export async function importPreparedAnalysis(db,bundle,{limit=75}={}){
 if(!db)return {status:503,data:{error:'Datenbank fehlt.'}};
 if(bundle.regionId!=='billerbeck'||!bundle.id||!Array.isArray(bundle.articles)||bundle.articles.length>500)throw Error('Ungültiges Paket');
 bundle.articles.forEach(validatePreparedArticle);
 const at=new Date().toISOString(),runId=crypto.randomUUID(),lease=String(Date.now()+600000);
 const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? RETURNING value").bind(lease,Date.now()).first();
 if(!lock)return {status:409,data:{error:'Ein Import oder eine Analyse läuft bereits.'}};
 let processed=0,skipped=0,conflicts=0,remaining=0;const conflictIds=[];
 try{
  await db.prepare('INSERT INTO import_runs(id,started_at,status,details) VALUES(?,?,?,?)').bind(runId,at,'running',JSON.stringify({mode:'prepared-analysis',region:'billerbeck',trigger:'manual',bundle:bundle.id})).run();
  const result=await db.prepare('SELECT id,payload FROM topics WHERE region_id=? AND json_extract(payload,\'$.identity.mergedInto\') IS NULL').bind('billerbeck').all();
  const current=new Map(result.results.map(r=>[r.id,JSON.parse(r.payload)]));
  for(const a of bundle.articles){
   const t=current.get(a.articleId);
   if(t?.contentAnalysis?.id===a.contentAnalysis.id){skipped++;continue;}
   if(!t||t.officialTitle!==a.officialTitle||analysisSignature(t)!==a.expectedSignature){conflicts++;conflictIds.push(a.articleId);continue;}
   if(processed>=limit){remaining++;continue;}
   const events=a.events||t.events,status=a.status||t.status;
   const rule=hasCurrentLabel(t)?t.classification:{...classifyTopic(t),classifiedAt:at};
   const next={...t,events,status,shortSummary:a.shortSummary,longSummary:a.longSummary,generatedBy:a.contentAnalysis.status==='completed'?'KI-Zusammenfassung · Billerbeck-Test':'Inhaltsanalyse: Quellenlage unzureichend',contentAnalysis:{...a.contentAnalysis,sourceSignature:analysisSignature({...t,events,status})},summaryGeneratedAt:a.contentAnalysis.generatedAt,summaryMethod:a.contentAnalysis.method,summaryEvidence:a.contentAnalysis.evidence.map(e=>e.quote),classification:rule,labelAssessments:{...t.labelAssessments,rule,...(a.aiLabel?{ai:a.aiLabel}:{})},weightedKeywords:a.weightedKeywords||t.weightedKeywords,analysisFeatures:{...features(t),version:MATCH_VERSION,evidence:t.officialTitle,analysedAt:at},metadata:{version:RECORD_VERSION,firstImportedAt:t.metadata?.firstImportedAt||null,sourceModifiedAt:t.metadata?.sourceModifiedAt||null,lastFetchedAt:a.fetchedAt,lastProcessedAt:at},quality:{passed:a.contentAnalysis.status==='completed'&&a.contentAnalysis.checks.every(c=>c.passed),checks:a.contentAnalysis.checks.map(c=>({...c,detail:'Technische Prüfung; keine unabhängige fachliche Freigabe.'})),checkedAt:at,sourceHash:a.contentAnalysis.inputHash}};
   // No full HTML, PDF or transcript enters this result or its version history.
   const versions=[['summary',next.contentAnalysis,{...next.contentAnalysis,shortSummary:a.shortSummary,longSummary:a.longSummary}],['rule-label',rule,rule],...(a.aiLabel?[['ai-label',a.aiLabel,a.aiLabel]]:[]),...(a.weightedKeywords?[['keywords',a.weightedKeywords,a.weightedKeywords]]:[])];
   const statements=[db.prepare('INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES(?,?,?,?)').bind(crypto.randomUUID(),t.id,at,JSON.stringify(t)),...versions.map(([kind,v,payload])=>db.prepare('INSERT OR IGNORE INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,?,?,?,?)').bind(bundle.id+':'+t.id+':'+kind,t.id,kind,v.method||'unknown',v.inputHash||a.contentAnalysis.inputHash,v.generatedAt||at,JSON.stringify(payload))),db.prepare('UPDATE topics SET status=?,payload=? WHERE id=?').bind(status,JSON.stringify(next),t.id)];
   await db.batch(statements);processed++;
  }
  const stored=await db.prepare(`SELECT COUNT(*) AS total,
   COALESCE(SUM(json_extract(payload,'$.contentAnalysis.status')='completed'),0) AS completed,
   COALESCE(SUM(json_extract(payload,'$.contentAnalysis.status')='insufficient_source'),0) AS insufficient,
   COALESCE(SUM(json_extract(payload,'$.contentAnalysis.status')='stale'),0) AS stale,
   COALESCE(SUM(json_extract(payload,'$.labelAssessments.ai.primary') IS NOT NULL),0) AS aiLabels,
   COALESCE(SUM(json_extract(payload,'$.weightedKeywords.items') IS NOT NULL),0) AS keywordProfiles
   FROM topics WHERE region_id=? AND json_extract(payload,'$.identity.mergedInto') IS NULL`).bind('billerbeck').first();
  const data={bundle:bundle.id,processed,skipped,conflicts,conflictIds,remaining,limit,stored};
  await db.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(),conflicts?'partial':'completed',JSON.stringify(data),runId).run();
  return {status:200,data};
 }catch(e){await db.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(),'failed',JSON.stringify({processed,error:String(e.message).slice(0,200)}),runId).run();throw e;}
 finally{invalidateReads();await db.prepare("DELETE FROM system_state WHERE key='import-lock' AND value=?").bind(lease).run();}
}
