import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {refreshStep,refreshStatus,withRefreshLease} from '../server/integrations/admin-refresh.mjs';

const root=path.resolve(import.meta.dirname,'..');
const fresh=()=>{const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));return sql;};
const put=(sql,id,region)=>sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,region,'city','2026-09-20','2026-10-01T00:00:00Z','consulting',JSON.stringify({id,regionId:region,events:[{date:'2026-09-20'}],documents:[]}));
const lease=sql=>sql.prepare("SELECT value FROM system_state WHERE key='admin-refresh-lease'").get();

test('two steps at once: exactly one runs, the other is told the database is busy',async()=>{
 const sql=fresh(),db=sqliteAdapter(sql);put(sql,'a','billerbeck');put(sql,'b','muenster');
 const results=await Promise.all([refreshStep(db,{budgetMs:1000}),refreshStep(db,{budgetMs:1000})]);
 assert.deepEqual(results.map(r=>r.state).sort(),['busy','done']);
 assert.ok(results.find(r=>r.state==='busy').until);
 assert.equal(lease(sql),undefined,'the lease is released after the step');
 const status=await refreshStatus(db);
 assert.deepEqual(status.regions,{pending:0,unbuilt:0,total:2});assert.equal(status.jobRunning,false);assert.equal(status.busy,undefined);
});

test('an expired lease is taken over; a lease is released when the step fails',async()=>{
 const sql=fresh(),db=sqliteAdapter(sql);
 sql.prepare("INSERT INTO system_state(key,value) VALUES('admin-refresh-lease',?)").run(String(Date.now()-1));
 assert.equal(await withRefreshLease(db,1000,async()=>'ran'),'ran');
 await assert.rejects(withRefreshLease(db,1000,async()=>{throw Error('boom');}),/boom/);
 assert.equal(lease(sql),undefined);
 sql.prepare("INSERT INTO system_state(key,value) VALUES('admin-refresh-lease',?)").run(String(Date.now()+60000));
 assert.equal((await withRefreshLease(db,1000,async()=>'ran')).busy,true);
 assert.ok((await refreshStatus(db)).busy.until);
});

test('steps report progress until every area is computed; unknown targets are refused',async()=>{
 const sql=fresh(),db=sqliteAdapter(sql);for(let i=0;i<5;i++)put(sql,'t'+i,'area-'+i);
 const states=[];let r;
 do{r=await refreshStep(db,{budgetMs:0});states.push(r.state);}while(r.state==='running');
 assert.deepEqual(states,['done'],'five small areas fit into one chunk');
 assert.equal(r.total,5);assert.equal(r.pending,0);assert.equal(r.done,5);assert.equal(typeof r.ms,'number');
 await assert.rejects(refreshStep(db,{target:'everything'}),e=>e.status===400);
 await assert.rejects(refreshStep(db,{action:'drop'}),e=>e.status===400);
});

test('a driven import job and the import lock are reported, so pages do not catch up meanwhile',async()=>{
 const sql=fresh(),db=sqliteAdapter(sql),now=new Date('2026-10-08T12:00:00Z');
 sql.prepare("INSERT INTO system_state(key,value) VALUES('admin-pipeline-job',?)").run(JSON.stringify({status:'running',updatedAt:'2026-10-08T11:59:00Z',items:[]}));
 sql.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?)").run(String(now.getTime()+60000)+' shared');
 const status=await refreshStatus(db,{now});
 assert.equal(status.jobRunning,true);assert.equal(status.importBusyUntil,new Date(now.getTime()+60000).toISOString());
 /* A job nobody drives for five minutes does not block */
 assert.equal((await refreshStatus(db,{now:new Date('2026-10-08T12:10:00Z')})).jobRunning,false);
});
