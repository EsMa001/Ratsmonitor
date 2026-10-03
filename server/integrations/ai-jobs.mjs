import {AdminError} from './admin-access.mjs';
import {selectedRegions} from './pipeline-jobs.mjs';
import {STAGE_SQL,CANONICAL} from './processing-status.mjs';
import {insertUsage} from '../../shared/ai-usage.mjs';
import {AI_KINDS,AI_METHOD,articleResult,patchArticle,analysisSignature,aiInstructions} from '../../shared/ai-job.mjs';
import {LABELS} from '../../shared/labels.mjs';
import {hashText} from '../../shared/database-transfer.mjs';
import {invalidateReads} from '../services/read-cache.mjs';
const KEY='admin-ai-job';
/** @param {any} db @param {{metadataOnly?:boolean,id?:string,offset?:number,limit?:number}} [options] */
export async function getAiJob(db,{metadataOnly=false,id,offset=0,limit}={}){
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(KEY).first();
 if(!row)return null;
 const job=JSON.parse(row.value);
 job.articleCount??=job.articles?.length??0;
 if(id&&id!==job.id)throw new AdminError(409,'Der KI-Auftrag wurde inzwischen geändert.');
 if(metadataOnly)return job;
 if(job.storage==='rows-v1'){
  job.articles=[];
  const end=limit===undefined?job.articleCount:Math.min(job.articleCount,offset+limit);
  for(let start=offset;start<end;start+=100){
   const rows=await db.prepare('SELECT payload FROM ai_job_articles WHERE job_id=? ORDER BY position LIMIT ? OFFSET ?').bind(job.id,Math.min(100,end-start),start).all();
   job.articles.push(...rows.results.map(r=>JSON.parse(r.payload)));
  }
 }else if(limit!==undefined)job.articles=job.articles.slice(offset,offset+limit);
 return job;
}
function manifest(job){if(job.storage!=='rows-v1')return job;const {articles,appliedIds,...value}=job;return value;}
function saveStatement(db,job){return db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(KEY,JSON.stringify(manifest(job)));}
async function save(db,job){await saveStatement(db,job).run();}
async function importLease(db){
 const lease=String(Date.now()+600000);
 const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER)<? RETURNING value").bind(lease,Date.now()).first();
 if(!lock)throw new AdminError(409,'Ein Import oder eine Analyse läuft bereits.');
 return lease;
}
async function createAiJobUnlocked(db,body,{metadataOnly=false}={}){
 const previous=await getAiJob(db,{metadataOnly:true});
 if(previous?.status==='prepared')throw new AdminError(409,'Ein KI-Auftrag ist bereits vorbereitet. Zuerst ausführen oder ausdrücklich verwerfen.');
 const regions=selectedRegions(body.regions),kinds=body.kinds,limit=body.limit??10;
 if(!Array.isArray(kinds)||!kinds.length||kinds.length>3||new Set(kinds).size!==kinds.length||kinds.some(k=>!AI_KINDS.includes(k))||(limit!=='all'&&(!Number.isInteger(limit)||limit<1||limit>100)))throw new AdminError(400,'KI-Schritte und Paketgröße (1–100 oder alle) prüfen.');
 const scope=regions.map(id=>"'"+id.replaceAll("'","''")+"'").join(',');
 const kindSQL=kinds.map(k=>"'"+k+"'").join(',');
 const lease=await importLease(db),id=crypto.randomUUID();
 let activated=false;
 try{
  // Stable order and a source snapshot while imports are locked. Dispatches survive cancellation.
  const query=`SELECT topics.id FROM topics LEFT JOIN
   (SELECT topic_id,max(exported_at) last_export FROM ai_dispatches WHERE kind IN (${kindSQL}) GROUP BY topic_id) d ON d.topic_id=topics.id
   WHERE ${CANONICAL} AND region_id IN (${scope}) AND (${kinds.map(k=>`NOT coalesce((${STAGE_SQL[k]}),0)`).join(' OR ')})
   ORDER BY coalesce(last_export,0),event_date DESC,topics.id LIMIT ?`;
  const selection=await db.prepare(query).bind(limit==='all'?-1:limit).all();
  let count=0;
  while(count<selection.results.length){
   const ids=selection.results.slice(count,count+100).map(row=>row.id);
   const rows=await db.prepare('SELECT topics.id,region_id,payload FROM topics JOIN json_each(?) s ON s.value=topics.id ORDER BY CAST(s.key AS INTEGER)').bind(JSON.stringify(ids)).all();
   if(rows.results.length!==ids.length)throw new AdminError(409,'Der Artikelbestand wurde während der Vorbereitung geändert. Bitte erneut versuchen.');
   const articles=[];
   for(const row of rows.results){
    const t=JSON.parse(row.payload);
    articles.push({id:row.id,region:row.region_id,title:t.officialTitle||t.title,status:t.status,payloadHash:await hashText(row.payload),sourceSignature:analysisSignature(t),urls:[...new Set([t.sourceUrl,...(t.documents||[]).map(d=>d.url),...(t.events||[]).map(e=>e.url)].filter(u=>typeof u==='string'&&u.startsWith('https://')))],events:(t.events||[]).map(({attendance,...e})=>e)});
   }
   // One bound JSON page rather than one database request per article.
   await db.prepare("INSERT INTO ai_job_articles(job_id,topic_id,position,payload) SELECT ?,json_extract(value,'$.id'),?+CAST(key AS INTEGER),value FROM json_each(?)").bind(id,count,JSON.stringify(articles)).run();
   count+=articles.length;
  }
  const at=Date.now(),job={format:'ratsmonitor-ai-job-v1',method:AI_METHOD,id,createdAt:new Date(at).toISOString(),status:count?'prepared':'completed',regions,kinds,storage:'rows-v1',articleCount:count,requestedLimit:limit,labelCatalog:LABELS.map(({id,name})=>({id,name})),instructions:aiInstructions,applied:0};
  // Use a monotonic timestamp even when two exports occur within one millisecond.
  const last=await db.prepare('SELECT coalesce(max(exported_at),0) at FROM ai_dispatches').first();
  await db.batch([
   db.prepare("INSERT INTO ai_dispatches(topic_id,kind,exported_at) SELECT a.topic_id,k.value,? FROM ai_job_articles a CROSS JOIN json_each(?) k WHERE a.job_id=? ON CONFLICT(topic_id,kind) DO UPDATE SET exported_at=excluded.exported_at").bind(Math.max(at,Number(last.at)+1),JSON.stringify(kinds),id),
   saveStatement(db,job),
   db.prepare('DELETE FROM ai_job_articles WHERE job_id<>?').bind(id)
  ]);
  activated=true;
  return metadataOnly?job:await getAiJob(db);
 }finally{
  try{if(!activated)await db.prepare('DELETE FROM ai_job_articles WHERE job_id=?').bind(id).run();}
  finally{await db.prepare("DELETE FROM system_state WHERE key='import-lock' AND value=?").bind(lease).run();}
 }
}
async function applyAiResultsUnlocked(db,job,output){
 if(job?.format!=='ratsmonitor-ai-job-v1'||output?.format!=='ratsmonitor-ai-results-v1'||output.jobId!==job.id||!Array.isArray(output.articles)||output.articles.length===0||output.articles.length>(job.articleCount??job.articles.length)||new Set(output.articles.map(a=>a.id)).size!==output.articles.length)throw new AdminError(400,'Ergebnisse passen nicht zum KI-Auftrag.');
 const registered=await getAiJob(db,{metadataOnly:true});if(!registered||registered.id!==job.id||registered.status==='cancelled')throw new AdminError(409,'Dieser Auftrag ist nicht mehr aktiv.');
 job=registered;const at=new Date().toISOString(),prepared=[];
 for(const result of output.articles){const frozen=job.storage==='rows-v1'?await db.prepare('SELECT payload FROM ai_job_articles WHERE job_id=? AND topic_id=?').bind(job.id,result.id).first():null;const article=job.storage==='rows-v1'?(frozen?JSON.parse(frozen.payload):null):job.articles.find(a=>a.id===result.id);if(!article)throw new AdminError(400,'Artikel außerhalb des Auftrags.');try{prepared.push({article,...await articleResult(job,article,result,at)});}catch(e){throw new AdminError(400,`${result.id}: ${e.message}`);}}
 const lease=String(Date.now()+600000),lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER)<? RETURNING value").bind(lease,Date.now()).first();
 if(!lock)throw new AdminError(409,'Ein Import oder eine Analyse läuft bereits.');
 let applied=0,skipped=0;const conflicts=[],outcomes={};
 try{
  for(const p of prepared){
   const existing=await db.prepare(`SELECT id,payload FROM article_analyses WHERE id IN (${p.analyses.map(()=>'?').join(',')})`).bind(...p.analyses.map(a=>a.payload.id)).all();
   const stable=v=>{const {generatedAt,classifiedAt,...rest}=v;return JSON.stringify(rest);};
   if(existing.results.length){
    if(existing.results.length===p.analyses.length&&existing.results.every(r=>stable(JSON.parse(r.payload))===stable(p.analyses.find(a=>a.payload.id===r.id).payload))){skipped++;if(job.storage==='rows-v1')await db.prepare('UPDATE ai_job_articles SET applied=1 WHERE job_id=? AND topic_id=?').bind(job.id,p.article.id).run();continue;}
    conflicts.push(p.article.id);continue;
   }
   const row=await db.prepare('SELECT payload FROM topics WHERE id=?').bind(p.article.id).first();
   if(!row||await hashText(row.payload)!==p.article.payloadHash){conflicts.push(p.article.id);continue;}
   const topic=patchArticle(JSON.parse(row.payload),p,at),statements=[
    db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM topics WHERE id=? AND payload=?) THEN 1 ELSE json('conflict') END").bind(p.article.id,row.payload),
    db.prepare('INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES(?,?,?,?)').bind(crypto.randomUUID(),p.article.id,at,row.payload),
    insertUsage(db,{...p.usage,topicId:p.article.id,regionId:p.article.region||'',at}),
    ...p.analyses.map(a=>db.prepare('INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,?,?,?,?)').bind(a.payload.id,p.article.id,a.kind,a.payload.method,a.payload.inputHash,at,JSON.stringify(a.payload))),
    db.prepare('UPDATE topics SET payload=? WHERE id=?').bind(JSON.stringify(topic),p.article.id),
    ...(job.storage==='rows-v1'?[db.prepare('UPDATE ai_job_articles SET applied=1 WHERE job_id=? AND topic_id=?').bind(job.id,p.article.id)]:[])
   ];
   await db.batch(statements);
   const saved=await db.prepare('SELECT payload FROM topics WHERE id=?').bind(p.article.id).first();if(saved.payload!==JSON.stringify(topic))throw Error('Gespeicherter Artikel weicht vom geprüften Ergebnis ab.');
   applied++;for(const a of p.analyses){const key=a.kind+':'+a.payload.status;outcomes[key]=(outcomes[key]||0)+1;}
  }
  // Track exact successfully applied article IDs from this job, not unrelated historical analyses.
  if(job.storage==='rows-v1'){job.applied=Number((await db.prepare('SELECT count(*) n FROM ai_job_articles WHERE job_id=? AND applied=1').bind(job.id).first()).n);}else{job.appliedIds=[...new Set([...(job.appliedIds||[]),...prepared.filter(p=>!conflicts.includes(p.article.id)).map(p=>p.article.id)])];job.applied=job.appliedIds.length;}job.status=job.applied>=(job.articleCount??job.articles.length)?'completed':'prepared';await save(db,job);
  const receipt={jobId:job.id,at,applied,skipped,conflicts,outcomes,revision:Number((await db.prepare("SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) AS revision").first()).revision)};
  await db.prepare('INSERT INTO import_runs(id,started_at,finished_at,status,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),at,new Date().toISOString(),conflicts.length?'partial':'completed',JSON.stringify({mode:job.method===AI_METHOD?'ai-agent-analysis':'claude-analysis',region:job.regions.length===1?job.regions[0]:'all',trigger:'manual',processed:applied,skipped,conflicts,outcomes})).run();
  await db.prepare("INSERT INTO system_state(key,value) VALUES('last-ai-apply',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(receipt)).run();return receipt;
 }finally{invalidateReads();await db.prepare("DELETE FROM system_state WHERE key='import-lock' AND value=?").bind(lease).run();}
}
async function cancelAiJobUnlocked(db,id){const job=await getAiJob(db,{metadataOnly:true});if(!job||job.id!==id)throw new AdminError(409,'Auftrag wurde inzwischen geändert.');job.status='cancelled';await save(db,job);return job;}

async function exclusive(db,fn){
 const lease=String(Date.now()+600000);const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('ai-job-lease',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER)<? RETURNING value").bind(lease,Date.now()).first();
 if(!lock)throw new AdminError(409,'Ein KI-Auftrag wird gerade bearbeitet.');
 try{return await fn();}finally{await db.prepare("DELETE FROM system_state WHERE key='ai-job-lease' AND value=?").bind(lease).run();}
}
export const createAiJob=(db,body,options)=>exclusive(db,()=>createAiJobUnlocked(db,body,options));
export const applyAiResults=(db,job,output)=>exclusive(db,()=>applyAiResultsUnlocked(db,job,output));
export const cancelAiJob=(db,id)=>exclusive(db,()=>cancelAiJobUnlocked(db,id));
