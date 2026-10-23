import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {removeRegionReports} from '../scripts/remove-region-reports.mjs';
// Lohr, 23.10.2026: the reports of the town stood with the VG Lohr a.Main; the VG is emptied, nothing of another area goes.
function db(){
 const d=new DatabaseSync(':memory:');
 d.exec(`CREATE TABLE topics(id TEXT PRIMARY KEY,region_id TEXT);CREATE TABLE report_rules(topic_id TEXT PRIMARY KEY);CREATE TABLE model_labels(topic_id TEXT PRIMARY KEY);
  CREATE TABLE article_versions(id TEXT,topic_id TEXT);CREATE TABLE source_coverage(region_id TEXT PRIMARY KEY,payload TEXT);CREATE TABLE system_state(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE ai_usage(id TEXT,topic_id TEXT);
  INSERT INTO topics VALUES('vg-1','de-096775624'),('vg-2','de-096775624'),('town-1','de-09677155');
  INSERT INTO report_rules VALUES('vg-1'),('town-1');INSERT INTO model_labels VALUES('vg-2');INSERT INTO article_versions VALUES('v1','vg-1'),('v2','town-1');
  INSERT INTO source_coverage VALUES('de-096775624','{}'),('de-09677155','{}');INSERT INTO ai_usage VALUES('u1','vg-1');
  INSERT INTO system_state VALUES('import-marks:de-096775624','{}'),('import-debug:de-096775624','{}'),('import-marks:de-09677155','{}');`);
 return d;
}
test('an area is emptied with what hangs on its reports; without --apply nothing changes; other areas and AI costs stay',()=>{
 const d=db(),count=sql=>d.prepare(sql).get().n;
 const shown=removeRegionReports(d,['de-096775624']);
 assert.deepEqual(shown,{report_rules:1,model_labels:1,article_versions:1,source_coverage:1,system_state:2,topics:2});
 assert.equal(count('SELECT count(*) n FROM topics'),3,'a look changes nothing');
 assert.deepEqual(removeRegionReports(d,['de-096775624'],{apply:true}),shown);
 assert.deepEqual(d.prepare('SELECT id FROM topics').all().map(r=>r.id),['town-1']);
 assert.equal(count('SELECT count(*) n FROM report_rules'),1);assert.equal(count('SELECT count(*) n FROM model_labels'),0);assert.equal(count("SELECT count(*) n FROM article_versions WHERE topic_id='town-1'"),1);
 assert.deepEqual(d.prepare('SELECT region_id FROM source_coverage').all().map(r=>r.region_id),['de-09677155']);
 assert.deepEqual(d.prepare('SELECT key FROM system_state').all().map(r=>r.key),['import-marks:de-09677155']);
 assert.equal(count('SELECT count(*) n FROM ai_usage'),1,'costs stay booked');
});
