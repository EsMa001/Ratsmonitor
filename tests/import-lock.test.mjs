import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {acquireImport,lockedUntil,IMPORT_LEASE_MS} from '../server/integrations/import-lock.mjs';
function fixture(){const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));return {sql,db:sqliteAdapter(sql)};}
const keys=sql=>sql.prepare("SELECT key FROM system_state WHERE key LIKE 'import-%' ORDER BY key").all().map(r=>r.key);
// The way AI results, rule labelling and summaries take the stock for themselves (unchanged callers).
const exclusive=(db,now=Date.now())=>db.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER)<? RETURNING value").bind(String(now+600000),now).first();
test('imports of different areas share the lock; the same area is refused; the lock goes with the last import',async()=>{
 const {sql,db}=fixture();
 const a=await acquireImport(db,'billerbeck'),b=await acquireImport(db,'coesfeld');
 assert.equal(a.ok,true);assert.equal(b.ok,true);assert.deepEqual(keys(sql),['import-lock','import-run:billerbeck','import-run:coesfeld']);
 assert.deepEqual(await acquireImport(db,'billerbeck'),{ok:false,reason:'area'},'one import per area');
 const value=sql.prepare("SELECT value FROM system_state WHERE key='import-lock'").get().value;assert.match(value,/^[0-9]+ shared$/);assert.ok(lockedUntil(value)>Date.now());
 // Everything else sees a held lock and waits.
 assert.equal(await exclusive(db),null);
 await a.release();assert.deepEqual(keys(sql),['import-lock','import-run:coesfeld'],'the lock stays while another import runs');assert.equal(await exclusive(db),null);
 const again=await acquireImport(db,'billerbeck');assert.equal(again.ok,true);
 await b.release();await again.release();assert.deepEqual(keys(sql),[]);
 assert.ok(await exclusive(db),'free again for the others');sql.close();
});
test('an import waits while the stock is taken exclusively, and an exclusive holder is never displaced',async()=>{
 const {sql,db}=fixture();
 assert.ok(await exclusive(db));
 assert.deepEqual(await acquireImport(db,'billerbeck'),{ok:false,reason:'stock'});assert.deepEqual(keys(sql),['import-lock'],'the refused import leaves no marker');
 assert.deepEqual(await acquireImport(db,'billerbeck',{shared:false}),{ok:false,reason:'stock'});
 sql.prepare("DELETE FROM system_state WHERE key='import-lock'").run();
 // Summaries run alone: no second holder of either kind.
 const alone=await acquireImport(db,'billerbeck',{shared:false});assert.equal(alone.ok,true);
 assert.deepEqual(await acquireImport(db,'coesfeld'),{ok:false,reason:'stock'});assert.equal(await exclusive(db),null);
 await alone.release();assert.deepEqual(keys(sql),[]);sql.close();
});
test('markers and locks of a crashed import expire',async()=>{
 const {sql,db}=fixture(),past=Date.now()-IMPORT_LEASE_MS-60000;
 const crashed=await acquireImport(db,'billerbeck',{now:past});assert.equal(crashed.ok,true);
 // After the lease (five minutes) the same area can be imported again.
 const next=await acquireImport(db,'billerbeck');assert.equal(next.ok,true);await next.release();assert.deepEqual(keys(sql),[]);
 // An expired shared lock no longer keeps an exclusive holder out.
 await acquireImport(db,'coesfeld',{now:past});assert.ok(await exclusive(db));
 // A live import next to an expired marker: releasing it still frees the lock.
 sql.prepare("DELETE FROM system_state WHERE key='import-lock'").run();
 const live=await acquireImport(db,'borken');await live.release();assert.deepEqual(keys(sql),['import-run:coesfeld'],'only the expired marker is left; the next import of that area replaces it');
 assert.equal(lockedUntil(undefined),0);assert.equal(lockedUntil('1790000000000'),1790000000000);assert.equal(lockedUntil('1790000000000 shared'),1790000000000);sql.close();
});
test('a running import renews its marker and the shared lock; it never takes the stock back from an exclusive holder',async()=>{
 const {sql,db}=fixture(),value=key=>sql.prepare('SELECT value FROM system_state WHERE key=?').get(key)?.value,start=Date.now()-240000;
 const a=await acquireImport(db,'billerbeck',{now:start});assert.equal(a.ok,true);assert.equal(lockedUntil(value('import-run:billerbeck')),start+IMPORT_LEASE_MS);
 // Four minutes in, collecting is done: both expiries move five minutes ahead of now, so storing is covered.
 await a.renew();assert.ok(lockedUntil(value('import-run:billerbeck'))>Date.now()+IMPORT_LEASE_MS-5000);assert.match(value('import-lock'),/ shared$/);assert.ok(lockedUntil(value('import-lock'))>Date.now()+IMPORT_LEASE_MS-5000);
 assert.deepEqual(await acquireImport(db,'billerbeck'),{ok:false,reason:'area'},'the renewed marker still holds the area');
 // Release after a renewal removes the renewed marker and the lock.
 await a.release();assert.deepEqual(keys(sql),[]);
 // An import whose shared lock expired and was taken by an exclusive holder does not get it back by renewing.
 const b=await acquireImport(db,'coesfeld',{now:Date.now()-IMPORT_LEASE_MS-1000});assert.ok(await exclusive(db));const held=value('import-lock');
 await b.renew();assert.equal(value('import-lock'),held,'the exclusive holder keeps the stock');
 // A shared lock set later by another import is never moved back by a renewal.
 sql.prepare("DELETE FROM system_state WHERE key LIKE 'import-%'").run();
 const c=await acquireImport(db,'borken',{now:Date.now()-60000}),d=await acquireImport(db,'coesfeld',{now:Date.now()+600000});
 const later=value('import-lock');await c.renew(Date.now()-120000);assert.equal(value('import-lock'),later);
 await c.release();await d.release();sql.close();
});
