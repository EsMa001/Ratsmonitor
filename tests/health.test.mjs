// GET /api/health (server/integrations/health.mjs): antwortet ohne Konto, schreibt nichts, nennt weder Personen noch Pfade;
// 503 ohne Datenbank. Vorbild für die Schreibsperre: tests/admin-readonly.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {memoryDb} from './helpers/d1.mjs';
import {setup} from './helpers/accounts.mjs';
import {healthReport,age,HEALTH_HEADERS} from '../server/integrations/health.mjs';
import {accessDecision} from '../server/accounts/access.mjs';

const NOW=Date.parse('2026-10-22T07:30:00Z');
/** Zugriff, der jede schreibende Abfrage abweist und alle Abfragen mitschreibt */
function readOnly(db,asked=[]){
 return {prepare(q){asked.push(q);if(/^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i.test(q))throw Error('write from /api/health: '+q.slice(0,80));return db.prepare(q);},batch(){throw Error('batch from /api/health');}};
}
const put=(sql,key,value)=>sql.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));

test('answers 200 with database, revisions and ages; reads only; no persons, no paths',async()=>{
 const {sql,db}=memoryDb();
 // die Stände entstehen über Trigger beim ersten Schreiben; hier wie nach einem Import
 sql.prepare("INSERT INTO data_revisions(id,revision) VALUES('content',5),('search',3) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision").run();
 put(sql,'schedule-runs',{backup:{lastStart:'2026-10-22T00:30:00Z',lastEnd:'2026-10-22T00:41:00Z',result:'ok'},'import-nightly':{lastEnd:'2026-10-22T02:30:00Z',result:'ok'},import:{lastEnd:'2026-10-22T05:00:00Z',result:'failed'}});
 put(sql,'server-disk',{at:'2026-10-22T06:00:00Z',disk:{total:1,used:1},backups:{dir:'/srv/ratsmonitor/backups',list:[{name:'ratsmonitor-2026-10-21-0030.sqlite.zst',kind:'Datenbank',at:'2026-10-21T00:40:00Z',bytes:1},{name:'x.tar.zst',kind:'Sonstiges',at:'2026-10-22T07:00:00Z',bytes:1}]},database:{files:[{name:'ratsmonitor.sqlite'}]}});
 const asked=[];
 const {status,body}=await healthReport(readOnly(db,asked),{now:NOW});
 assert.equal(status,200);
 assert.equal(body.ok,true);assert.equal(body.database,true);
 assert.equal(body.revisions.content,5,'Datenstand aus data_revisions');assert.equal(body.revisions.search,3);
 assert.deepEqual(body.backup,{at:'2026-10-22T00:41:00.000Z',ageHours:6.8},'Ende des Jobs „Sichern“ ist jünger als die gemessene Sicherung');
 assert.deepEqual(body.import,{at:'2026-10-22T02:30:00.000Z',ageHours:5},'nur erfolgreiche Läufe zählen');
 assert.ok(asked.length>=3&&asked.length<=4,'wenige, billige Abfragen: '+asked.length);
 const text=JSON.stringify(body);
 assert.ok(!/\/srv|\\\\|sqlite|@/.test(text),'keine Pfade, Dateinamen oder Adressen: '+text);
 assert.equal(HEALTH_HEADERS['Cache-Control'],'no-store');
});

test('without the optional tables the answer is still 200; a dead database gives 503',async()=>{
 const {db}=memoryDb({skip:f=>!f.startsWith('0000')&&!f.startsWith('0001')});
 const r=await healthReport(db,{now:NOW});
 assert.equal(r.status,200);assert.equal(r.body.database,true);
 assert.equal(r.body.backup,null);assert.equal(r.body.import,null);
 const dead={prepare(){throw Error('SQLITE_BUSY');}};
 const d=await healthReport(dead,{now:NOW});
 assert.equal(d.status,503);assert.deepEqual(d.body,{ok:false,at:new Date(NOW).toISOString(),database:false});
 assert.equal((await healthReport(undefined)).status,503,'ohne Bindung');
 const broken={prepare(){return {async first(){return {ok:0};}};}};
 assert.equal((await healthReport(broken)).status,503,'Antwort ohne 1 zählt als tot');
});

test('age: hours with one decimal, never negative, null without a time',()=>{
 assert.deepEqual(age('2026-10-22T06:30:00Z',NOW),{at:'2026-10-22T06:30:00.000Z',ageHours:1});
 assert.equal(age('2026-10-22T08:30:00Z',NOW).ageHours,0);
 assert.equal(age(null,NOW),null);assert.equal(age('kaputt',NOW),null);
});

test('the route is free in invite mode (no session) and listed as open with a reason',async()=>{
 const h=setup({access:'invite'});
 const decision=await accessDecision(new Request('https://plenara.test/api/health'),h.env,{cfg:h.cfg});
 assert.deepEqual(decision,{allow:true});
 const other=await accessDecision(new Request('https://plenara.test/api/healthz'),h.env,{cfg:h.cfg});
 assert.deepEqual(other,{status:401},'nur genau dieser Pfad');
 const route=fs.readFileSync(path.resolve(import.meta.dirname,'../app/api/health/route.ts'),'utf8');
 assert.ok(!/gated\(|guard\(|requireAdmin|accountRoute/.test(route),'kein Konto, keine Stufe');
 assert.match(route,/healthReport\(env\.DB\)/);
 assert.ok(!/export (async )?function (POST|PUT|DELETE|PATCH)/.test(route),'nur GET');
});
