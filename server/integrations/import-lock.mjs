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
const BUSY=Object.freeze({ok:false});
/** Returns {ok:true, release} or {ok:false} if this area is being imported or the stock is locked by something else. */
export async function acquireImport(db,region,{shared=true,now=Date.now()}={}){
 const expiry=String(now+LEASE_MS);
 if(!shared){
  const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? RETURNING value").bind(expiry,now).first();
  return lock?{ok:true,release:()=>db.prepare("DELETE FROM system_state WHERE key='import-lock' AND value=?").bind(expiry).run()}:BUSY;
 }
 const marker='import-run:'+region;
 const own=await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? RETURNING value').bind(marker,expiry,now).first();
 if(!own)return BUSY;
 const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? OR system_state.value LIKE '% shared' RETURNING value").bind(expiry+' shared',now).first();
 if(!lock){await db.prepare('DELETE FROM system_state WHERE key=? AND value=?').bind(marker,expiry).run();return BUSY;}
 // One statement, so marker and lock go together: the own marker always, the shared lock only if no other import is left.
 return {ok:true,release:()=>db.prepare("DELETE FROM system_state WHERE (key=? AND value=?) OR (key='import-lock' AND value LIKE '% shared' AND NOT EXISTS (SELECT 1 FROM system_state other WHERE other.key LIKE 'import-run:%' AND other.key<>? AND CAST(other.value AS INTEGER) > ?))").bind(marker,expiry,marker,Date.now()).run()};
}
/** Time until which the stock is locked, read from the stored value of either kind; 0 if it is free. */
export const lockedUntil=value=>Number.parseInt(String(value||'0'),10)||0;
