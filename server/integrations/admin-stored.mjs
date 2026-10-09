// Stored evaluations of the administration (class C: keywords, estimate). They are computed only on request or by a
// build, and pages read the stored text as it is. A row of D1 holds at most 2 MB and a bound value about 100 KB, so the
// JSON is stored gzip-compressed (CompressionStream, available in Workers and Node) as base64 in parts of PART_CHARS
// characters under 'admin-stored:<name>#000', '#001', …, with a head 'admin-stored:<name>' saying when, at which stock
// and how many parts. Head and parts are written in one batch, so readers see the old or the new evaluation, never a mix.
export const PART_CHARS=90000;
const MAX_GZ_CHARS=1500000;
const HEAD='admin-stored:';
export async function gzipText(text){
 const bytes=new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);
}
export async function gunzipText(base64){
 const bin=atob(base64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
const readJson=text=>{try{return JSON.parse(text||'null');}catch{return null;}};
const partKey=(name,i)=>`${HEAD}${name}#${String(i).padStart(3,'0')}`;
/** Head only: {computedAt,stockSum,content,ms,rawBytes,parts} or null. */
export async function storedMeta(db,name){
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(HEAD+name).first();
 const meta=row?readJson(row.value):null;
 return meta&&typeof meta==='object'?meta:null;
}
/** Head and text (unparsed): {meta,text} or null if none is stored or its parts are incomplete. */
export async function readStored(db,name){
 const [head,parts]=await db.batch([
  db.prepare('SELECT value FROM system_state WHERE key=?').bind(HEAD+name),
  db.prepare('SELECT key,value FROM system_state WHERE key>=? AND key<? ORDER BY key').bind(HEAD+name+'#',HEAD+name+'#~'),
 ]);
 const meta=head.results[0]?readJson(head.results[0].value):null;
 if(!meta||parts.results.length!==meta.parts)return null;
 return {meta,text:await gunzipText(parts.results.map(r=>r.value).join(''))};
}
/**
 * Stores data (an object or ready JSON text) under name, replacing what was stored, in one batch.
 * @param {any} db
 * @param {string} name
 * @param {unknown} data
 * @param {{stockSum:number,content:number,ms:number,computedAt?:string}} meta
 */
export async function writeStored(db,name,data,{stockSum,content,ms,computedAt=new Date().toISOString()}){
 const text=typeof data==='string'?data:JSON.stringify(data),gz=await gzipText(text);
 if(gz.length>MAX_GZ_CHARS)throw Error(`Gespeicherter Stand ${name} zu groß (${gz.length} Zeichen gepackt).`);
 const parts=[];for(let i=0;i<gz.length;i+=PART_CHARS)parts.push(gz.slice(i,i+PART_CHARS));
 const meta={computedAt,stockSum,content,ms,rawBytes:text.length,parts:parts.length};
 await db.batch([
  db.prepare('DELETE FROM system_state WHERE key>=? AND key<?').bind(HEAD+name+'#',HEAD+name+'#~'),
  ...parts.map((part,i)=>db.prepare('INSERT INTO system_state(key,value) VALUES(?,?)').bind(partKey(name,i),part)),
  db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(HEAD+name,JSON.stringify(meta)),
 ]);
 return meta;
}
/** Revisions the stand of a stored evaluation is measured against: changes of reports (stockSum) and content. */
export async function stockRevisions(db){
 const [stock,content]=await db.batch([
  db.prepare('SELECT total(revision) s FROM region_revisions'),
  db.prepare("SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) AS revision"),
 ]);
 return {stockSum:Number(stock.results[0]?.s||0),content:Number(content.results[0]?.revision||0)};
}
