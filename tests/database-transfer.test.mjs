import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {SOURCES_REVISION_SQL,CONTENT_REVISION_SQL} from '../server/integrations/revision-cache.mjs';
import {exportPage,exportRequest} from '../server/integrations/database-transfer.mjs';
import {dataCompleteness} from '../server/integrations/data-completeness.mjs';
import {downloadDatabase} from '../shared/download-database.mjs';
import {restoreData} from '../scripts/database-restore.mjs';
import {INITIALIZATION_KEYS} from '../shared/database-transfer.mjs';
function fixture(){
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const db={prepare(query){let args=[];return {bind(...v){args=v;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};}};},async batch(qs){sql.exec('BEGIN');try{const r=[];for(const q of qs)r.push(await q.all());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const put=(id,payload)=>sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,'billerbeck','city','2026-09-27','2026-09-27',payload.status||'unknown',JSON.stringify(payload));return {sql,db,put};
}
const full={metadata:{lastProcessedAt:'2026-09-27'},committee:'Rat',events:[{attendance:{status:'available',sourceUrl:'https://example.org/session'}}],reference:'42/2026',status:'approved',officialTitle:'Schulneubau',shortSummary:'Ausbau beschlossen',longSummary:['Die Stadt beschließt den Schulneubau.'],sourceUrl:'https://example.org/paper',contentAnalysis:{status:'completed',evidence:[{url:'https://example.org/paper',quote:'Schulneubau'}]},labelAssessments:{rule:{primary:'bildung',method:'rules-v2'},ai:{primary:'bildung',status:'completed'}},weightedKeywords:{status:'completed',method:'codex-content-v1',inputBasis:'content',items:Array.from({length:10},(_,i)=>({term:'Begriff '+i,weight:10}))}};
test('completeness audits actual fields without writing and keeps source gaps and title keywords open',async()=>{
 const {sql,db,put}=fixture();put('a',full);put('b',{...full,weightedKeywords:{...full.weightedKeywords,inputBasis:'title'},contentAnalysis:{status:'insufficient_source'}});put('c',{officialTitle:'Nur Titel'});
 const before=sql.prepare('SELECT * FROM data_revisions').all();const audit=await dataCompleteness(db,'billerbeck');assert.equal(audit.total,3);assert.equal(audit.complete,1);assert.equal(audit.fields.find(f=>f.id==='summary').missing,2);assert.equal(audit.fields.find(f=>f.id==='keywords').missing,2);assert.deepEqual(sql.prepare('SELECT * FROM data_revisions').all(),before);
 assert.equal((await dataCompleteness(db,'muenster')).total,0);await assert.rejects(dataCompleteness(db,"x' OR 1=1"));sql.close();
});
test('every content-table mutation invalidates snapshots and sensitive tables cannot be exported',async()=>{
 const {sql,db,put}=fixture();put('a',full);const revision=sql.prepare("SELECT revision FROM data_revisions WHERE id='content'").get().revision;
 assert.equal((await exportPage(db,{table:'topics',revision})).data.rows.length,1);sql.exec("UPDATE topics SET status='approved'");assert.equal((await exportPage(db,{table:'topics',revision})).status,409);
 for(const table of ['system_state','push_subscriptions','topics;DROP TABLE topics','__proto__'])await assert.rejects(exportPage(db,{table,revision}));
 for(const [table,insert] of [['article_versions',"INSERT INTO article_versions VALUES('v','a','now','{}')"],['article_analyses',"INSERT INTO article_analyses VALUES('a','a','summary','codex','hash','now','{}')"],['source_coverage',"INSERT INTO source_coverage VALUES('billerbeck','{}')"]]){
  const before=sql.prepare(SOURCES_REVISION_SQL).get().revision,content=sql.prepare(CONTENT_REVISION_SQL).get().revision;sql.exec(insert);sql.exec(`UPDATE ${table} SET payload='{}'`);sql.exec(`DELETE FROM ${table}`);assert.equal(sql.prepare(SOURCES_REVISION_SQL).get().revision,before+3);
  // Source states count a revision of their own (0018): the content revision, and the caches on it, stay where they were.
  assert.equal(sql.prepare(CONTENT_REVISION_SQL).get().revision-content,table==='source_coverage'?0:3);
 }
 sql.close();
});
test('round trip preserves all public records, versions and local admin; malformed or truncated exports roll back',async()=>{
 const source=fixture(),target=fixture();source.put('a',full);source.put('b',{...full,identity:{mergedInto:'a'}});
 source.sql.exec("INSERT INTO article_versions VALUES('v','a','now','{\"earlier\":true}'); INSERT INTO article_analyses VALUES('ai','a','summary','codex','hash','now','{\"summary\":\"saved\"}'); INSERT INTO source_coverage VALUES('billerbeck','{}'); INSERT INTO system_state VALUES('admin-owner','online-secret');");source.sql.prepare('INSERT INTO system_state VALUES(?,?)').run(INITIALIZATION_KEYS[0],'now');
 target.sql.exec("INSERT INTO system_state VALUES('admin-owner','local-owner')");
 const request=async params=>{const r=await exportRequest(source.db,new URL('https://example.org/?'+new URLSearchParams(params)));if(r.status!==200)throw Error(r.data.error);return r.data;};
 const exported=await downloadDatabase(request),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ratsmonitor-test-')),file=path.join(dir,'snapshot.jsonl');fs.writeFileSync(file,exported.parts.join(''));
 try{
  const result=await restoreData(target.sql,file);assert.equal(result.counts.topics,2);assert.equal(target.sql.prepare("SELECT value FROM system_state WHERE key='admin-owner'").get().value,'local-owner');
  for(const {name} of exported.manifest.tables)assert.deepEqual(target.sql.prepare(`SELECT * FROM ${name} ORDER BY 1`).all(),source.sql.prepare(`SELECT * FROM ${name} ORDER BY 1`).all());
  await assert.rejects(restoreData(target.sql,file),/bereits Artikel/);
  const before=target.sql.prepare('SELECT * FROM topics').all();fs.writeFileSync(file,exported.parts.slice(0,2).join(''));await assert.rejects(restoreData(target.sql,file,{replace:true}),/unvollständig/);assert.deepEqual(target.sql.prepare('SELECT * FROM topics').all(),before);
  fs.writeFileSync(file,exported.parts.join('').replace('Schulneubau','Manipuliert'));await assert.rejects(restoreData(target.sql,file,{replace:true}),/Prüfsumme/);assert.deepEqual(target.sql.prepare('SELECT * FROM topics').all(),before);
  fs.writeFileSync(file,exported.parts.join('').replace(INITIALIZATION_KEYS[0],'admin-owner'));await assert.rejects(restoreData(target.sql,file,{replace:true}),/Initialisierungsdaten/);assert.equal(target.sql.prepare("SELECT value FROM system_state WHERE key='admin-owner'").get().value,'local-owner');
 }finally{fs.rmSync(dir,{recursive:true,force:true});source.sql.close();target.sql.close();}
});
