import packedHistory from '@/data/history-backfill-gzip.json';
import {loadBackfill} from '../integrations/load-backfill.mjs';
import {applyBackfill} from '../integrations/apply-backfill.mjs';
import 'server-only';
import {env} from 'cloudflare:workers';
import seed from '@/data/topics.json';
import regional from '@/data/regions.json';
import {nrwSnapshot as nrw,nrwImports} from '../integrations/nrw-snapshot.mjs';
import type {StoredTopic} from '../types';
// Only settled readiness is shared. Never retain request-owned D1 promises across requests.
let initialized=false;
export async function ensureData(){
 if(!env.DB||initialized)return;
 const keys=['regional-v5-2026-09-26','nrw-'+nrw.revision,'history-backfill-'+packedHistory.revision];
 const markers=await env.DB.prepare('SELECT key FROM system_state WHERE key IN (?,?,?)').bind(...keys).all<{key:string}>();
 if(keys.every(key=>markers.results.some(row=>row.key===key))){initialized=true;return;}
 const lease=String(Date.now()+600000);
 const locked=await env.DB.prepare("INSERT INTO system_state(key,value) VALUES('seed-init-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? RETURNING value").bind(lease,Date.now()).first();
 if(!locked)throw Error('Initialimport läuft bereits; gespeicherter Ersatzstand bleibt verfügbar.');
 try{await initializeData();initialized=true;}finally{await env.DB.prepare("DELETE FROM system_state WHERE key='seed-init-lock' AND value=?").bind(lease).run();}
}
async function initializeData(){
  const version='regional-v5-2026-09-26';
  const found=await env.DB!.prepare('SELECT value FROM system_state WHERE key=?').bind(version).first();if(!found){
  const topics=[...seed.topics.map(t=>({...t,regionId:'muenster'})),...regional.topics] as unknown as StoredTopic[];
  for(let i=0;i<topics.length;i+=10){const payload=topics.slice(i,i+10);await env.DB!.prepare("INSERT OR IGNORE INTO topics(id,region_id,source,event_date,updated_at,status,payload) SELECT json_extract(value,'$.id'),coalesce(json_extract(value,'$.regionId'),'muenster'),json_extract(value,'$.source'),json_extract(value,'$.eventDate'),json_extract(value,'$.updatedAt'),json_extract(value,'$.status'),value FROM json_each(?)").bind(JSON.stringify(payload)).run();}
  for(const c of [{...seed.coverage,regionId:'muenster',method:'oparl',sourceUrl:'https://oparl.stadt-muenster.de/system'},...regional.coverage])await env.DB!.prepare('INSERT OR IGNORE INTO source_coverage(region_id,payload) VALUES(?,?)').bind(c.regionId,JSON.stringify(c)).run();
  await env.DB!.prepare('INSERT OR IGNORE INTO system_state(key,value) VALUES(?,?)').bind(version,new Date().toISOString()).run();
  }
  const nrwVersion='nrw-'+nrw.revision;
  if(!await env.DB!.prepare('SELECT value FROM system_state WHERE key=?').bind(nrwVersion).first()){
   for await(const result of nrwImports(undefined)){
   const topics=result.topics as StoredTopic[];
   for(let i=0;i<topics.length;i+=50){
    const payload=JSON.stringify(topics.slice(i,i+50));
    await env.DB!.batch([
     env.DB!.prepare("INSERT INTO article_versions(id,topic_id,captured_at,payload) SELECT lower(hex(randomblob(16))),topics.id,?,topics.payload FROM topics JOIN json_each(?) incoming ON topics.id=json_extract(incoming.value,'$.id') WHERE json_extract(incoming.value,'$.updatedAt')>topics.updated_at").bind(new Date().toISOString(),payload),
     env.DB!.prepare("INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) SELECT json_extract(value,'$.id'),json_extract(value,'$.regionId'),json_extract(value,'$.source'),json_extract(value,'$.eventDate'),json_extract(value,'$.updatedAt'),json_extract(value,'$.status'),value FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET event_date=excluded.event_date,updated_at=excluded.updated_at,status=excluded.status,payload=excluded.payload WHERE excluded.updated_at>topics.updated_at").bind(payload)
    ]);
   }
   }
   await env.DB!.prepare("INSERT INTO source_coverage(region_id,payload) SELECT json_extract(value,'$.regionId'),value FROM json_each(?) WHERE 1 ON CONFLICT(region_id) DO UPDATE SET payload=excluded.payload WHERE coalesce(json_extract(excluded.payload,'$.lastAttemptAt'),json_extract(excluded.payload,'$.importedAt'),'') > coalesce(json_extract(source_coverage.payload,'$.lastAttemptAt'),json_extract(source_coverage.payload,'$.importedAt'),'')").bind(JSON.stringify(nrw.coverage)).run();
   await env.DB!.prepare('INSERT OR IGNORE INTO system_state(key,value) VALUES(?,?)').bind(nrwVersion,new Date().toISOString()).run();
  }
  // Recover only the observed lease of v18's memory-aborted request; never another active lease.
  await env.DB!.prepare("DELETE FROM system_state WHERE key='history-backfill-lock' AND value=?").bind('1790462922047').run();
  if(!await env.DB!.prepare('SELECT value FROM system_state WHERE key=?').bind('history-backfill-'+packedHistory.revision).first())await applyBackfill(env.DB!,await loadBackfill(packedHistory));
}
