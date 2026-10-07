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
/**
 * One package of rule labelling: up to ANALYSIS_BATCH_SIZE pending reports of the region ('all': of every region) in
 * id order, each group of 50 stored at once. Only the authenticated admin POST route calls this bounded mutation.
 * after: the id the previous package ended with (cursor); the package continues behind it, so a run over the whole
 * stock never scans the reports it has already labelled again. Answer: processed; more (a full package: further reports
 * may wait); cursor (the last id read); remaining, counted only for one region (cheap through its index) or 0 when the
 * package was not full. A report whose title changed between reading and writing is skipped and left for the next run.
 */
export async function analysePending(db,region='all',{after=''}={}){
 if(!db)return {status:503,data:{error:'Datenbank fehlt.'}};
 const started=new Date().toISOString(),id=crypto.randomUUID(),lease=String(Date.now()+600000);
 const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? RETURNING value").bind(lease,Date.now()).first();
 if(!lock)return {status:409,data:{error:'Ein Import oder eine Analyse läuft bereits. Bitte später erneut starten.'}};
 let processed=0;
 const where=`json_extract(payload,'$.identity.mergedInto') IS NULL AND ${ANALYSIS_PENDING_SQL}`+(region==='all'?'':' AND region_id=?'),args=region==='all'?[]:[region];
 const cursor=typeof after==='string'&&after?after:'';
 try{
  await db.prepare('INSERT INTO import_runs(id,started_at,status,details) VALUES(?,?,?,?)').bind(id,started,'running',JSON.stringify({mode:'analysis',region,trigger:'manual',...(cursor?{after:cursor}:{})})).run();
  const rows=await db.prepare(`SELECT id,json_extract(payload,'$.title') AS title,json_extract(payload,'$.officialTitle') AS officialTitle,json_extract(payload,'$.sourceUrl') AS sourceUrl,json_extract(payload,'$.classification') AS savedClassification FROM topics WHERE ${where}${cursor?' AND id>?':''} ORDER BY id LIMIT ?`).bind(...args,...(cursor?[cursor]:[]),ANALYSIS_BATCH_SIZE).all();
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
  const more=rows.results.length>=ANALYSIS_BATCH_SIZE,last=rows.results.at(-1)?.id||cursor;
  // Counting the whole stock (over a million reports, three JSON reads each) would cost more than the package itself:
  // for 'all' the answer says only whether more may follow. One region is counted through its index.
  const remaining=!more?0:region==='all'?null:Number((await db.prepare(`SELECT count(*) count FROM topics WHERE ${where} AND id>?`).bind(...args,last).first()).count);
  await db.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(),'completed',JSON.stringify({processed,remaining,more,...(last?{cursor:last}:{})}),id).run();
  return {status:200,data:{processed,remaining,more,...(last?{cursor:last}:{}),limit:ANALYSIS_BATCH_SIZE}};
 }catch{
  await db.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date().toISOString(),'failed',JSON.stringify({processed}),id).run();
  return {status:503,data:{error:'Analyse nicht vollständig abgeschlossen. Bereits gespeicherte Ergebnisse bleiben erhalten; ein erneuter Start setzt bei ausstehenden Artikeln fort.',processed}};
 }finally{invalidateReads();await db.prepare("DELETE FROM system_state WHERE key='import-lock' AND value=?").bind(lease).run();}
}
