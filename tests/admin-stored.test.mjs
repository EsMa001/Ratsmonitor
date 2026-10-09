import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {writeStored,readStored,storedMeta,PART_CHARS,gzipText} from '../server/integrations/admin-stored.mjs';
import {storedEstimate,storedEstimateText,estimateHead,computeEstimate} from '../server/integrations/admin-estimate-store.mjs';
import {refreshRegionFacts} from '../server/integrations/region-facts.mjs';

const root=path.resolve(import.meta.dirname,'..');
const fresh=()=>{const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));return sql;};
/** Text that gzip cannot shrink much: several parts of PART_CHARS. */
const noisy=n=>{let seed=5,s='';while(s.length<n){seed=(seed*1103515245+12345)%2147483648;s+=seed.toString(36);}return s.slice(0,n);};

test('a stored evaluation round-trips through gzip parts, each row far below 2 MB, and is replaced as a whole',async()=>{
 const sql=fresh(),db=sqliteAdapter(sql),data={list:noisy(300000)};
 const meta=await writeStored(db,'probe',data,{stockSum:12,content:34,ms:5,computedAt:'2026-10-08T12:00:00Z'});
 assert.ok(meta.parts>2,'parts: '+meta.parts);
 const rows=sql.prepare("SELECT key,length(value) n FROM system_state WHERE key LIKE 'admin-stored:probe%' ORDER BY key").all();
 assert.equal(rows.length,meta.parts+1);assert.ok(rows.every(r=>r.n<=PART_CHARS&&r.n<2000000));
 assert.equal(rows[1].key,'admin-stored:probe#000');
 const read=await readStored(db,'probe');
 assert.deepEqual(JSON.parse(read.text),data);
 assert.deepEqual(await storedMeta(db,'probe'),{computedAt:'2026-10-08T12:00:00Z',stockSum:12,content:34,ms:5,rawBytes:JSON.stringify(data).length,parts:meta.parts});
 /* A smaller one replaces every part */
 await writeStored(db,'probe',{small:true},{stockSum:13,content:35,ms:1});
 assert.equal(sql.prepare("SELECT count(*) n FROM system_state WHERE key LIKE 'admin-stored:probe#%'").get().n,1);
 assert.deepEqual(JSON.parse((await readStored(db,'probe')).text),{small:true});
 /* Missing parts: the evaluation counts as missing */
 await writeStored(db,'probe',data,{stockSum:14,content:36,ms:1});sql.prepare("DELETE FROM system_state WHERE key='admin-stored:probe#001'").run();
 assert.equal(await readStored(db,'probe'),null);
});

test('the estimate of the former version is read until a new one is computed; the page text is valid JSON with its stand',async()=>{
 const sql=fresh(),db=sqliteAdapter(sql);
 assert.equal(await estimateHead(db),null);assert.equal(await storedEstimateText(db,{computedAt:null}),null);
 sql.prepare("INSERT INTO system_state(key,value) VALUES('admin-estimate',?)").run(JSON.stringify({computedAt:'2026-10-06T17:38:40.735Z',revision:7,gz:await gzipText(JSON.stringify({total:{perYear:5}}))}));
 assert.deepEqual(await estimateHead(db),{computedAt:'2026-10-06T17:38:40.735Z',content:7});
 assert.equal((await storedEstimate(db)).total.perYear,5);
 const legacy=JSON.parse(await storedEstimateText(db,{computedAt:'2026-10-06T17:38:40.735Z',stale:true}));
 assert.equal(legacy.total.perYear,5);assert.equal(legacy.computed,true);assert.equal(legacy.stand.stale,true);
 /* A new estimate: stored in parts with stockSum, read before the former one */
 sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run('a','billerbeck','city','2026-09-17','2026-10-01T00:00:00Z','unknown',JSON.stringify({id:'a',events:[{date:'2026-09-17'}],documents:[]}));
 await assert.rejects(computeEstimate(db,{replicates:5}),e=>e.status===409,'refused while areas were never computed');
 await refreshRegionFacts(db,{budgetMs:1e9});
 const computed=await computeEstimate(db,{now:new Date('2026-10-08T12:00:00Z'),replicates:5});
 const head=await estimateHead(db);
 assert.equal(head.computedAt,'2026-10-08T12:00:00.000Z');assert.equal(typeof head.stockSum,'number');
 const text=await storedEstimateText(db,{computedAt:head.computedAt,stale:false});
 const page=JSON.parse(text);
 assert.equal(page.computed,true);assert.equal(page.computedAt,head.computedAt);assert.equal(page.stale,false);assert.deepEqual(page.stand,{computedAt:head.computedAt,stale:false});
 assert.equal(page.total.perYear,computed.total.perYear);assert.equal(typeof page.currentRevision,'number');
});
