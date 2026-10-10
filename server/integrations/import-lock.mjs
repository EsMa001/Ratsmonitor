/**
 * Lock around imports. Two kinds of holders share the key 'import-lock' in system_state:
 *
 * - Imports of official data (shared). Imports of different areas may run side by side. Each holds a marker of its
 *   own, 'import-run:<area>', and together they hold 'import-lock' with the value '<expiry> shared'.
 * - Everything that needs the stock for itself (AI results, rule labelling, summaries) holds 'import-lock' with
 *   the plain value '<expiry>', as before. Those callers only ever compare the leading number, so a shared lock
 *   looks held to them and they wait.
 *
 * Order matters. An import sets its own marker first and takes the shared lock second; on release it removes its
 * marker and the shared lock in one statement, and the lock only if no other marker is left. So the lock is
 * never missing while an import runs.
 */
const LEASE_MS=600000;
/**
 * Imports hold their marker and the shared lock for IMPORT_LEASE_MS and renew both once collecting is done (renew).
 * Collecting is limited to about two minutes (plus a probe), so the lease outlasts it with room to spare; an
 * interrupted import blocks its area and holders of the whole stock only this long, a minute longer than the job
 * takes to give up on it (STALE_MS in pipeline-jobs.mjs), so a replaced job never meets a marker that is still live.
 */
export const IMPORT_LEASE_MS=360000;
// reason: 'area' (this area is being imported) or 'stock' (something else holds the whole stock).
const BUSY_AREA=Object.freeze({ok:false,reason:'area'}),BUSY_STOCK=Object.freeze({ok:false,reason:'stock'});
/** Returns {ok:true, release, renew} or {ok:false, reason} if this area is being imported or the stock is locked by something else. */
export async function acquireImport(db,region,{shared=true,now=Date.now()}={}){
 if(!shared){
  const expiry=String(now+LEASE_MS);
  const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? RETURNING value").bind(expiry,now).first();
  return lock?{ok:true,release:()=>db.prepare("DELETE FROM system_state WHERE key='import-lock' AND value=?").bind(expiry).run(),renew:async()=>{}}:BUSY_STOCK;
 }
 let expiry=String(now+IMPORT_LEASE_MS);
 const marker='import-run:'+region;
 const own=await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? RETURNING value').bind(marker,expiry,now).first();
 if(!own)return BUSY_AREA;
 const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? OR system_state.value LIKE '% shared' RETURNING value").bind(expiry+' shared',now).first();
 if(!lock){await db.prepare('DELETE FROM system_state WHERE key=? AND value=?').bind(marker,expiry).run();return BUSY_STOCK;}
 return {ok:true,
  // One statement, so marker and lock go together: the own marker always, the shared lock only if no other import is
  // left. "Other" is any live marker but this one (key and expiry): a successor of the same area, taken after this
  // marker expired, keeps the lock.
  release:()=>db.prepare("DELETE FROM system_state WHERE (key=? AND value=?) OR (key='import-lock' AND value LIKE '% shared' AND NOT EXISTS (SELECT 1 FROM system_state other WHERE other.key LIKE 'import-run:%' AND NOT (other.key=? AND other.value=?) AND CAST(other.value AS INTEGER) > ?))").bind(marker,expiry,marker,expiry,Date.now()).run(),
  // Moves both expiries IMPORT_LEASE_MS ahead. The shared lock is only ever moved later, and never taken back from a
  // holder of the whole stock; the marker only while it is still this import's.
  renew:async(at=Date.now())=>{
   const next=String(at+IMPORT_LEASE_MS);
   const [mine]=await db.batch([
    db.prepare('UPDATE system_state SET value=? WHERE key=? AND value=? RETURNING value').bind(next,marker,expiry),
    db.prepare("UPDATE system_state SET value=? WHERE key='import-lock' AND value LIKE '% shared' AND CAST(value AS INTEGER) < ?").bind(next+' shared',Number(next)),
   ]);
   if(mine.results?.length)expiry=next;
  }};
}
/** Time until which the stock is locked, read from the stored value of either kind; 0 if it is free. */
export const lockedUntil=value=>Number.parseInt(String(value||'0'),10)||0;
