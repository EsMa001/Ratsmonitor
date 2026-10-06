// The Germany-wide estimate (admin-estimate.mjs) reads every report twice and draws its ranges: about two minutes at
// 950,000 reports. It is computed only on request and kept in system_state; the page shows the stored result at once
// and says whether the stock has changed since (content revision of data_revisions, as revision-cache.mjs reads it).
// The result is 1.2 MB of JSON at 1,700 examples and grows with the stock; a D1 row holds at most 2 MB, so it is
// stored gzip-compressed (CompressionStream, available in Workers and Node), about a quarter of the size.
import {adminEstimate} from './admin-estimate.mjs';
const KEY='admin-estimate';
const readJson=text=>{try{return JSON.parse(text||'null');}catch{return null;}};
const contentRevision=async db=>Number((await db.prepare("SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) AS revision").first())?.revision||0);
export async function gzipText(text){
 const bytes=new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);
}
export async function gunzipText(base64){
 const bin=atob(base64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
/** The stored estimate with its age and whether the stock changed since, or {computed:false} if none was computed yet. */
export async function storedEstimate(db){
 const [row,currentRevision]=await Promise.all([db.prepare('SELECT value FROM system_state WHERE key=?').bind(KEY).first(),contentRevision(db)]);
 const kept=row?readJson(row.value):null;
 const estimate=kept?.gz?readJson(await gunzipText(kept.gz)):kept?.estimate||null;
 if(!estimate)return {computed:false,currentRevision};
 return {...estimate,computed:true,computedAt:kept.computedAt,revision:kept.revision,currentRevision,stale:kept.revision!==currentRevision};
}
/** Computes the estimate and stores it. The revision is read before the scans: a change during them shows as stale. */
export async function computeEstimate(db,{now=new Date(),replicates}={}){
 const revision=await contentRevision(db);
 const estimate=await adminEstimate(db,replicates===undefined?{now}:{now,replicates});
 const computedAt=now.toISOString();
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(KEY,JSON.stringify({computedAt,revision,gz:await gzipText(JSON.stringify(estimate))})).run();
 return {...estimate,computed:true,computedAt,revision,currentRevision:revision,stale:false};
}
