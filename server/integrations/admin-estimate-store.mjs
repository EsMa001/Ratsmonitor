// The Germany-wide estimate (admin-estimate.mjs) reads the values per area (region_series) and draws its ranges. It is
// computed only on request and stored (admin-stored.mjs, name 'estimate'); the page shows the stored result at once and
// says how much the stock has changed since. Estimates of the former version stand under the key 'admin-estimate'
// (one row, gzip); they are read until a new one is computed.
import {adminEstimate} from './admin-estimate.mjs';
import {pendingRegions} from './region-series.mjs';
import {AdminError} from './admin-access.mjs';
import {readStored,writeStored,stockRevisions,gzipText,gunzipText} from './admin-stored.mjs';
export {gzipText,gunzipText};
const LEGACY='admin-estimate',NAME='estimate';
const readJson=text=>{try{return JSON.parse(text||'null');}catch{return null;}};
const contentRevision=async db=>Number((await db.prepare("SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) AS revision").first())?.revision||0);
/** The estimate of the former version, if one is stored: {meta:{computedAt,content},estimate}. */
async function legacyEstimate(db){
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(LEGACY).first();
 const kept=row?readJson(row.value):null;
 const estimate=kept?.gz?readJson(await gunzipText(kept.gz)):kept?.estimate||null;
 return estimate?{meta:{computedAt:kept.computedAt,content:kept.revision},estimate}:null;
}
/** Head of the stored estimate for the ETag: {computedAt,stockSum?,content} or null. */
export async function estimateHead(db){
 const row=await db.prepare("SELECT key,json_extract(value,'$.computedAt') computedAt,json_extract(value,'$.stockSum') stockSum,json_extract(value,'$.content') content,json_extract(value,'$.revision') revision FROM system_state WHERE key IN ('admin-stored:estimate',?) ORDER BY key='admin-stored:estimate' DESC LIMIT 1").bind(LEGACY).first();
 if(!row?.computedAt)return null;
 return row.key===LEGACY?{computedAt:row.computedAt,content:Number(row.revision||0)}:{computedAt:row.computedAt,stockSum:Number(row.stockSum),content:Number(row.content||0)};
}
/**
 * The stored estimate as JSON text for the page, with its stand in front, or null if none was computed yet. The text of
 * the estimate is passed on unparsed.
 * @param {any} db
 * @param {unknown} stand
 */
export async function storedEstimateText(db,stand){
 const [stored,currentRevision]=await Promise.all([readStored(db,NAME),contentRevision(db)]);
 if(stored&&stored.text.startsWith('{')&&stored.text.length>2){
  const {meta,text}=stored;
  return '{"stand":'+JSON.stringify(stand)+',"computed":true,"computedAt":'+JSON.stringify(meta.computedAt)+',"revision":'+JSON.stringify(meta.content)+',"currentRevision":'+JSON.stringify(currentRevision)+',"stale":'+String(!!stand?.stale)+','+text.slice(1);
 }
 const legacy=await legacyEstimate(db);
 if(legacy)return JSON.stringify({...legacy.estimate,stand,computed:true,computedAt:legacy.meta.computedAt,revision:legacy.meta.content,currentRevision,stale:legacy.meta.content!==currentRevision});
 return null;
}
/** The stored estimate with its age and whether the stock changed since, or {computed:false} if none was computed yet. */
export async function storedEstimate(db){
 const [stored,currentRevision]=await Promise.all([readStored(db,NAME),contentRevision(db)]);
 if(stored){const estimate=readJson(stored.text);if(estimate)return {...estimate,computed:true,computedAt:stored.meta.computedAt,revision:stored.meta.content,currentRevision,stale:stored.meta.content!==currentRevision};}
 const legacy=await legacyEstimate(db);
 if(!legacy)return {computed:false,currentRevision};
 return {...legacy.estimate,computed:true,computedAt:legacy.meta.computedAt,revision:legacy.meta.content,currentRevision,stale:legacy.meta.content!==currentRevision};
}
/** Computes the estimate and stores it. The revisions are read before: a change during the computation shows as a change since. */
export async function computeEstimate(db,{now=new Date(),replicates}={}){
 // The estimate reads the values per area (region_series); while they are being built for the first time it would count
 // only part of the areas.
 const left=await pendingRegions(db);
 if(left.missing||left.unbuilt>0)throw new AdminError(409,'Erst nach der Vorberechnung möglich: Die Werte je Gebiet werden noch berechnet.');
 const began=Date.now(),{stockSum,content}=await stockRevisions(db);
 const estimate=await adminEstimate(db,replicates===undefined?{now}:{now,replicates});
 const computedAt=now.toISOString();
 await writeStored(db,NAME,estimate,{stockSum,content,ms:Date.now()-began,computedAt});
 return {...estimate,computed:true,computedAt,revision:content,currentRevision:content,stale:false};
}
