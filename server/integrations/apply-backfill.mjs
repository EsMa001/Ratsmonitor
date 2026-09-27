import {mergeImport} from './merge-import.mjs';
import {importHealth} from './import-health.mjs';
import {preserveAnalysis} from '../../shared/analysis-state.mjs';
/** Merge an offline backfill into the current database, never replace its snapshot. */
export async function applyBackfill(db,bundle){
 const key='history-backfill-'+bundle.revision;
 if(await db.prepare('SELECT value FROM system_state WHERE key=?').bind(key).first())return;
 const lease=String(Date.now()+600000);
 const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('history-backfill-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? RETURNING value").bind(lease,Date.now()).first();
 if(!lock)throw Error('Historische Nachladung wird bereits eingespielt');
 try{
  for await(const fresh of bundle.results){
   const region=fresh.coverage.regionId;
   const rows=await db.prepare('SELECT id,payload FROM topics WHERE region_id=?').bind(region).all();
   const old=new Map(rows.results.map(r=>[r.id,JSON.parse(r.payload)]));
   rows.results.length=0;
   const c=await db.prepare('SELECT payload FROM source_coverage WHERE region_id=?').bind(region).first();
   const previous=c?JSON.parse(c.payload):{};
   const combined=mergeImport({topics:[...old.values()],coverage:previous},fresh);
   const groups=new Map();
   for(const incoming of fresh.topics.length?combined.topics:[]){
    const prior=old.get(incoming.id);
    const fields=['status','officialTitle','sourceUrl','events','documents','identity','identityLinks','identityRecords'];
    if(prior&&fields.every(k=>JSON.stringify(prior[k])===JSON.stringify(incoming[k]))){if(incoming.metadata)await db.prepare("UPDATE topics SET payload=json_set(payload,'$.metadata',json(?)) WHERE id=?").bind(JSON.stringify(incoming.metadata),incoming.id).run();continue;}
    const t={...preserveAnalysis(incoming,prior),regionId:region};
    const group=t.identity?.mergedInto||t.id,statements=groups.get(group)||[];
    if(prior)statements.push(db.prepare('INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES(?,?,?,?)').bind(crypto.randomUUID(),t.id,bundle.revision,JSON.stringify(prior)));
    statements.push(db.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET event_date=excluded.event_date,updated_at=excluded.updated_at,status=excluded.status,payload=excluded.payload').bind(t.id,region,t.source,t.eventDate,t.updatedAt,t.status,JSON.stringify(t)));
    groups.set(group,statements);
   }
   // Batch independent identity groups while keeping every group atomic.
   let pending=[];
   for(const statements of groups.values()){
    if(pending.length&&pending.length+statements.length>80){await db.batch(pending);pending=[];}
    pending.push(...statements);
   }
   if(pending.length)await db.batch(pending);
   const at=fresh.coverage.lastAttemptAt||bundle.revision;
   if(at>=(previous.lastAttemptAt||previous.importedAt||'')){
    const health=importHealth(previous,{at,count:fresh.topics.length,complete:fresh.coverage.complete});
    const coverage={...previous,...combined.coverage,...health,regionId:region,requestedFrom:fresh.coverage.requestedFrom,importedAt:health.lastSuccessAt};
    await db.prepare('INSERT INTO source_coverage(region_id,payload) VALUES(?,?) ON CONFLICT(region_id) DO UPDATE SET payload=excluded.payload').bind(region,JSON.stringify(coverage)).run();
   }
  }
  await db.prepare('INSERT OR IGNORE INTO system_state(key,value) VALUES(?,?)').bind(key,new Date().toISOString()).run();
 }finally{await db.prepare("DELETE FROM system_state WHERE key='history-backfill-lock' AND value=?").bind(lease).run();}
}
