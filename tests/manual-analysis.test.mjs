import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {analysePending,ANALYSIS_BATCH_SIZE} from '../server/integrations/manual-analysis.mjs';
import {loadAnalyticsTopics} from '../server/repositories/analytics-input.mjs';
import {hasCurrentLabel,storedClassification,preserveAnalysis} from '../shared/analysis-state.mjs';
import {storedFeatures,matchStoredTopics} from '../shared/similarity.mjs';
import {buildAnalytics} from '../shared/analytics.mjs';
import {mapReading} from '../shared/map-metrics.mjs';
import {analysed} from './helpers/analysed.mjs';
const sqlite=new DatabaseSync(':memory:');
for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
const db={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};},async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const q of statements)out.push(await q.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const topic=(id,extra={})=>({id,regionId:'billerbeck',title:'Schulbau',officialTitle:'Schulbau',sourceUrl:'https://example.org/'+id,events:[{date:'2026-09-20'}],...extra});
const insert=t=>sqlite.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(t.id,t.regionId,'city','2026-09-20','2026-09-20','consulting',JSON.stringify(t));
const reset=()=>{for(const name of ['topics','import_runs','system_state'])sqlite.exec('DELETE FROM '+name);};
test('reads keep new and stale articles pending, preserve labels and do not extract comparison features',async()=>{
 reset();const raw=topic('new'),saved=analysed(topic('saved')),unclear=analysed(topic('unclear',{officialTitle:'Verschiedene mögliche Bereiche ohne Kontext'}));
 for(const t of [raw,saved,unclear])insert(t);
 const before=sqlite.prepare('SELECT * FROM topics ORDER BY id').all();
 const rows=await loadAnalyticsTopics(db),d=buildAnalytics(rows,[],[{id:'billerbeck',kind:'city'}],{region:'billerbeck',from:'2026-09-01',to:'2026-09-27',topicId:'new'});
 assert.equal(d.pendingLabels,1);assert.equal(d.distribution.find(l=>l.id==='bildung').count,1);assert.equal(d.distribution.find(l=>l.id==='unklar').count,2);
 assert.equal(d.focusPending,true);assert.equal(d.matchingTopics,0);assert.equal(mapReading(d.geography[0],'count').kind,'analysis-pending');
 assert.equal(storedClassification(raw).method,'pending');assert.equal(storedFeatures(raw),null);assert.equal(matchStoredTopics(raw,saved),null);
 const changed=preserveAnalysis({...raw,officialTitle:'Sportförderung'},saved);assert.equal(storedClassification(changed).method,'pending');assert.equal(storedFeatures(changed),null);
 assert.deepEqual(sqlite.prepare('SELECT * FROM topics ORDER BY id').all(),before);assert.equal(sqlite.prepare('SELECT count(*) n FROM import_runs').get().n,0);
});
test('one explicit run is bounded, skips aliases, isolates region, saves results and resumes only on the next call',async()=>{
 reset();for(let i=0;i<ANALYSIS_BATCH_SIZE+3;i++)insert(topic('a'+String(i).padStart(4,'0')));
 insert(topic('alias',{identity:{mergedInto:'a0000'}}));insert(topic('other',{regionId:'muenster'}));
 const first=await analysePending(db,'billerbeck');assert.equal(first.status,200);assert.equal(first.data.processed,500);assert.equal(first.data.remaining,3);assert.equal(first.data.more,true);assert.equal(first.data.cursor,'a0499');
 assert.equal(sqlite.prepare("SELECT count(*) n FROM topics WHERE json_extract(payload,'$.analysisFeatures.version') IS NOT NULL").get().n,500);
 // The next package continues behind the cursor and does not read the labelled reports again; a package that is not full ends the run.
 const second=await analysePending(db,'billerbeck',{after:first.data.cursor});assert.equal(second.data.processed,3);assert.equal(second.data.remaining,0);assert.equal(second.data.more,false);assert.equal(second.data.cursor,'a0502');
 assert.equal((await analysePending(db,'billerbeck')).data.processed,0);
 // The whole stock is not counted: remaining stays unknown while a package is full, 0 when it is not; a cursor behind everything reads nothing.
 const whole=await analysePending(db,'all');assert.equal(whole.data.processed,1);assert.equal(whole.data.remaining,0);assert.equal(whole.data.more,false);
 assert.deepEqual((await analysePending(db,'all',{after:'zzz'})).data.processed,0);
 const t=JSON.parse(sqlite.prepare("SELECT payload FROM topics WHERE id='a0000'").get().payload);assert.equal(hasCurrentLabel(t),true);assert.ok(storedFeatures(t));
 assert.equal(JSON.parse(sqlite.prepare("SELECT details FROM import_runs ORDER BY started_at LIMIT 1").get().details).trigger,'manual');
 assert.equal(sqlite.prepare("SELECT count(*) n FROM system_state WHERE key='import-lock'").get().n,0);
 sqlite.prepare("UPDATE topics SET payload=json_set(payload,'$.officialTitle','Sportförderung') WHERE id='a0000'").run();
 assert.equal((await analysePending(db,'all')).data.processed,1);
 assert.equal(JSON.parse(sqlite.prepare("SELECT payload FROM topics WHERE id='a0000'").get().payload).classification.primary,'sport');
});
test('an active import or analysis rejects a second trigger before recording or modifying anything',async()=>{
 reset();insert(topic('one'));sqlite.prepare('INSERT INTO system_state VALUES(?,?)').run('import-lock',String(Date.now()+60000));
 assert.equal((await analysePending(db)).status,409);assert.equal(sqlite.prepare('SELECT count(*) n FROM import_runs').get().n,0);assert.equal(hasCurrentLabel(JSON.parse(sqlite.prepare('SELECT payload FROM topics').get().payload)),false);
});
