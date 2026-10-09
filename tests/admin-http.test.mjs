import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {etagMatches,fnv,readResponse} from '../server/services/admin-etag.mjs';
import {adminStand,derivedStand,storedStand} from '../server/integrations/admin-stand.mjs';
import {refreshRegionFacts} from '../server/integrations/region-facts.mjs';

const root=path.resolve(import.meta.dirname,'..');
const fresh=()=>{const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));return sql;};
const put=(sql,id,status='consulting')=>sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload').run(id,'billerbeck','city','2026-09-20','2026-10-01T00:00:00Z',status,JSON.stringify({id,status,events:[{date:'2026-09-20'}],documents:[]}));

test('ETags compare weakly, in lists and with "*"; the hash is stable',()=>{
 assert.ok(etagMatches('W/"abc"','W/"abc"'));assert.ok(etagMatches('"abc"','W/"abc"'));
 assert.ok(etagMatches('W/"x", W/"abc"','W/"abc"'));assert.ok(etagMatches('*','W/"abc"'));
 assert.ok(!etagMatches(null,'W/"abc"'));assert.ok(!etagMatches('W/"abd"','W/"abc"'));
 assert.equal(fnv(['t1','a',1]),fnv(['t1','a',1]));assert.notEqual(fnv(['t1','a',1]),fnv(['t1','a',2]));
 assert.match(fnv(['x']),/^[0-9a-f]+$/);
});

test('a matching If-None-Match answers 304 without building the answer',async()=>{
 let built=0;const headers={'Cache-Control':'private, no-cache',Vary:'Cookie'};
 const build=async()=>{built++;return {a:1};},tag=async()=>'tag1';
 const first=await readResponse(new Request('https://x/api'),tag,build,headers);
 assert.equal(first.status,200);assert.equal(built,1);assert.deepEqual(await first.json(),{a:1});
 const etag=first.headers.get('ETag');assert.equal(etag,'W/"tag1"');
 const again=await readResponse(new Request('https://x/api',{headers:{'If-None-Match':etag}}),tag,build,headers);
 assert.equal(again.status,304);assert.equal(built,1,'not built again');
 assert.equal(again.headers.get('ETag'),etag);assert.equal(again.headers.get('Cache-Control'),'private, no-cache');assert.equal(again.headers.get('Vary'),'Cookie');
 /* Ready JSON text is passed through unparsed */
 const text=await readResponse(new Request('https://x/api'),tag,async()=>'{"b":2}',headers);
 assert.equal(await text.text(),'{"b":2}');assert.match(text.headers.get('Content-Type'),/application\/json/);
});

test('the stand changes with reports, with source states only in content, and with a new build at the same revision',async()=>{
 const sql=fresh(),db=sqliteAdapter(sql);put(sql,'a');await refreshRegionFacts(db,{budgetMs:1e9,now:new Date('2026-10-08T10:00:00Z')});
 const first=await adminStand(db);
 assert.equal(first.pending,0);assert.equal(first.unbuilt,0);assert.equal(first.total,1);assert.equal(first.seriesComputedAt,'2026-10-08T10:00:00.000Z');
 /* A source state changes content only */
 sql.prepare('INSERT INTO source_coverage VALUES(?,?)').run('billerbeck','{}');
 const coverage=await adminStand(db);
 assert.notEqual(coverage.content,first.content);assert.equal(coverage.stockSum,first.stockSum);assert.equal(coverage.seriesStamp,first.seriesStamp);
 /* A changed report raises stockSum and leaves its area pending */
 put(sql,'a','approved');
 const changed=await adminStand(db);
 assert.ok(changed.stockSum>first.stockSum);assert.equal(changed.pending,1);
 assert.deepEqual(derivedStand(changed),{computedAt:'2026-10-08T10:00:00.000Z',stale:true,changes:1,pending:1,unbuilt:0,total:1});
 /* A new build at the same revision changes the stamp */
 await refreshRegionFacts(db,{budgetMs:1e9,now:new Date('2026-10-08T11:00:00Z')});
 const rebuilt=await adminStand(db);sql.exec('UPDATE region_series SET v=0');
 await refreshRegionFacts(db,{budgetMs:1e9,now:new Date('2026-10-08T12:00:00Z')});
 assert.notEqual((await adminStand(db)).seriesStamp,rebuilt.seriesStamp);
 /* Stored evaluations: changes since their stockSum; without one they count as stale */
 const now=await adminStand(db);
 assert.deepEqual(storedStand(now,{computedAt:'2026-10-08T09:00:00Z',stockSum:now.stockSum-3}),{computedAt:'2026-10-08T09:00:00Z',stale:true,changes:3,pending:0,unbuilt:0,total:0});
 assert.equal(storedStand(now,{computedAt:'2026-10-08T09:00:00Z',stockSum:now.stockSum}).stale,false);
 assert.deepEqual(storedStand(now,{computedAt:'2026-10-08T09:00:00Z'}),{computedAt:'2026-10-08T09:00:00Z',stale:true,changes:null,pending:0,unbuilt:0,total:0});
 assert.deepEqual(storedStand(now,null),{computedAt:null,stale:false,changes:null,pending:0,unbuilt:0,total:0});
});

test('without migration 0016 the stand says so',async()=>{
 const sql=fresh();sql.exec('DROP TABLE region_series');const s=await adminStand(sqliteAdapter(sql));
 assert.equal(s.missing,'0016');assert.equal(derivedStand(s).missing,'0016');
});
