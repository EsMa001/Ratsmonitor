import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

// 0030: no processing duration per report in ai_usage. 0031: no keyword rests (stored count of the former admin page,
// partial sums of its build, old AI keyword analyses); everything else stays.
const dir=path.resolve(import.meta.dirname,'..','drizzle');
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
const migrate=(sql,keep)=>{for(const f of files.filter(keep))sql.exec(fs.readFileSync(path.join(dir,f),'utf8'));};

test('after all migrations ai_usage has no duration column; the usage rows stay',()=>{
 const sql=new DatabaseSync(':memory:');
 migrate(sql,f=>f<'0030');
 sql.prepare("INSERT INTO ai_usage(id,topic_id,region_id,method,agent,model,kinds,created_at,outcome,token_basis,duration_ms) VALUES('u1','t1','billerbeck','m','a','x','summary','2026-10-13','completed','unknown',NULL)").run();
 migrate(sql,f=>f>='0030');
 assert.equal(sql.prepare("SELECT count(*) n FROM pragma_table_info('ai_usage') WHERE name='duration_ms'").get().n,0);
 assert.equal(sql.prepare('SELECT count(*) n FROM ai_usage').get().n,1);
});

test('0031 removes the stored keyword count, its partial sums and the AI keyword analyses, nothing else',()=>{
 const sql=new DatabaseSync(':memory:');
 migrate(sql,f=>f<'0031');
 const state=sql.prepare('INSERT INTO system_state(key,value) VALUES(?,?)');
 state.run('admin-stored:keywords','{"parts":1}');state.run('admin-stored:keywords#000','abc');
 state.run('admin-build:keywords','{"id":"k1"}');state.run('admin-build:quality:all','{"id":"q1"}');state.run('admin-stored:estimate','{"parts":1}');
 const agg=sql.prepare("INSERT INTO admin_agg(build,list,g,k,n) VALUES(?,?,'','x',1)");
 agg.run('k1','terms');agg.run('q1','host');
 const analysis=sql.prepare("INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,'m','h','2026-10-01','{}')");
 analysis.run('a1','t1','keywords');analysis.run('a2','t1','summary');analysis.run('a3','t2','keywords');
 migrate(sql,f=>f>='0031');
 assert.deepEqual(sql.prepare('SELECT key FROM system_state WHERE key GLOB ? ORDER BY key').all('admin-*').map(r=>r.key),['admin-build:quality:all','admin-stored:estimate']);
 assert.deepEqual(sql.prepare('SELECT build FROM admin_agg').all().map(r=>r.build),['q1']);
 assert.deepEqual(sql.prepare('SELECT id FROM article_analyses ORDER BY id').all().map(r=>r.id),['a2']);
});
