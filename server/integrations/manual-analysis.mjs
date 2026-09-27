import {LABELS,LABEL_VERSION,CLASSIFIER_VERSION,classifyTopic} from '../../shared/labels.mjs';
import {MATCH_VERSION,features} from '../../shared/similarity.mjs';
import {sourceTitle,hasCurrentLabel} from '../../shared/analysis-state.mjs';
import {invalidateReads} from '../services/read-cache.mjs';
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const title="coalesce(nullif(json_extract(payload,'$.officialTitle'),''),json_extract(payload,'$.title'),'')";
export const LABEL_PENDING_SQL=`NOT coalesce(json_extract(payload,'$.classification.version')=${quote(LABEL_VERSION)} AND json_extract(payload,'$.classification.method')=${quote(CLASSIFIER_VERSION)} AND json_extract(payload,'$.classification.evidence')=${title} AND json_extract(payload,'$.classification.primary') IN (${LABELS.map(l=>quote(l.id)).join(',')}),0)`;
export const FEATURES_PENDING_SQL=`NOT coalesce(json_extract(payload,'$.analysisFeatures.version')=${quote(MATCH_VERSION)} AND json_extract(payload,'$.analysisFeatures.evidence')=${title} AND json_type(payload,'$.analysisFeatures.subjects')='array' AND json_type(payload,'$.analysisFeatures.terms')='array',0)`;
export const ANALYSIS_PENDING_SQL=`(${LABEL_PENDING_SQL} OR ${FEATURES_PENDING_SQL})`;
export const ANALYSIS_BATCH_SIZE=500;
// Only the authenticated admin POST route calls this bounded mutation.
export async function analysePending(db,region='all'){
 if(!db)return {status:503,data:{error:'Datenbank fehlt.'}};
 const started=new Date().toISOString(),id=crypto.randomUUID(),lease=String(Date.now()+600000);
 const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? RETURNING value").bind(lease,Date.now()).first();
 if(!lock)return {status:409,data:{error:'Ein Import oder eine Analyse läuft bereits. Bitte später erneut starten.'}};
 let processed=0;
 const where=`json_extract(payload,'$.identity.mergedInto') IS NULL AND ${ANALYSIS_PENDING_SQL}`+(region==='all'?'':' AND region_id=?'),args=region==='all'?[]:[region];
 try{
  await db.prepare('INSERT INTO import_runs(id,started_at,status,details) VALUES(?,?,?,?)').bind(id,started,'running',JSON.stringify({mode:'analysis',region,trigger:'manual'})).run();
  const rows=await db.prepare(`SELECT id,json_extract(payload,'$.title') AS title,json_extract(payload,'$.officialTitle') AS officialTitle,json_extract(payload,'$.sourceUrl') AS sourceUrl,json_extract(payload,'$.classification') AS savedClassification FROM topics WHERE ${where} ORDER BY id LIMIT ?`).bind(...args,ANALYSIS_BATCH_SIZE).all();
  for(let i=0;i<rows.results.length;i+=50){
   const group=rows.results.slice(i,i+50),statements=[];
   for(const row of group){const t={...row,classification:row.savedClassification?JSON.parse(row.savedClassification):undefined};
    const inputHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sourceTitle(t))))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const rule={...(hasCurrentLabel(t)?t.classification:{...classifyTopic(t),classifiedAt:started}),inputHash};
    statements.push(db.prepare(`UPDATE topics SET payload=json_set(payload,'$.classification',json(?),'$.labelAssessments.rule',json(?),'$.analysisFeatures',json(?),'$.metadata.version','article-record-v1','$.metadata.lastProcessedAt',?) WHERE id=? AND ${title}=? AND json_extract(payload,'$.identity.mergedInto') IS NULL`).bind(JSON.stringify(rule),JSON.stringify(rule),JSON.stringify({...features(t),version:MATCH_VERSION,evidence:sourceTitle(t),analysedAt:started}),started,t.id,sourceTitle(t)));
   }
   // One history insertion per batch keeps the 500-article action below the D1 query limit.
   statements.push(db.prepare(`INSERT OR IGNORE INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) SELECT ?||':'||id,id,'rule-label',json_extract(payload,'$.classification.method'),json_extract(payload,'$.classification.inputHash'),?,json_extract(payload,'$.classification') FROM topics WHERE id IN (${group.map(()=>'?').join(',')}) AND json_extract(payload,'$.metadata.lastProcessedAt')=?`).bind(id,started,...group.map(t=>t.id),started));
   const results=await db.batch(statements);processed+=results.slice(0,-1).reduce((n,r)=>n+Number(r.meta?.changes||0),0);
  }
  const remaining=Number((await db.prepare(`SELECT count(*) count FROM topics WHERE ${where}`).bind(...args).first()).count);
  await db.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(),'completed',JSON.stringify({processed,remaining}),id).run();
  return {status:200,data:{processed,remaining,limit:ANALYSIS_BATCH_SIZE}};
 }catch{
  await db.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(),'failed',JSON.stringify({processed}),id).run();
  return {status:503,data:{error:'Analyse nicht vollständig abgeschlossen. Bereits gespeicherte Ergebnisse bleiben erhalten; ein erneuter Start setzt bei ausstehenden Artikeln fort.',processed}};
 }finally{invalidateReads();await db.prepare("DELETE FROM system_state WHERE key='import-lock' AND value=?").bind(lease).run();}
}
