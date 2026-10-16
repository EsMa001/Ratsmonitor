// Sofortstart der Server-Jobs: Auslöser-Datei (server/integrations/job-trigger.mjs) und offene Wünsche (pendingWork)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {triggerJob,triggerStop,triggerDir,TRIGGER_JOBS} from '../server/integrations/job-trigger.mjs';
import {JOBS,pendingWork,requestScheduleStop,schedulesState,unitNames,unitsWarning} from '../server/integrations/schedules.mjs';
import {memoryDb} from './helpers/d1.mjs';

test('trigger file next to the database, one per job; none without a place',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trigger-'));
 try{
  const env={DATABASE_FILE:path.join(dir,'ratsmonitor.sqlite')};
  assert.equal(triggerDir(env),path.join(dir,'trigger'));
  assert.equal(await triggerJob('pdf-job',env),true);
  assert.ok(fs.readFileSync(path.join(dir,'trigger','pdf-job'),'utf8').startsWith('20'));
  assert.equal(await triggerJob('../etc',env),false,'nur bekannte Jobs');
  assert.equal(await triggerJob('pdf-job',{}),false,'ohne Datenbankpfad kein Auslöser');
  assert.equal(triggerDir({RM_TRIGGER_DIR:'/x/y'}),'/x/y');
  assert.deepEqual([...TRIGGER_JOBS].sort(),JOBS.map(j=>j.id).sort(),'jeder Job hat einen Auslöser');
  for(const id of TRIGGER_JOBS)assert.ok(fs.existsSync(`deploy/node/ratsmonitor-${id}.path`)&&fs.existsSync(`deploy/node/ratsmonitor-${id}.service`)&&fs.existsSync(`deploy/node/ratsmonitor-stop-${id}.path`),id);
  assert.equal(await triggerStop('import',env),true);
  assert.ok(fs.existsSync(path.join(dir,'trigger','stop-import')),'Anhalten über stop-<job>');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('pending work of the PDF job runs it even when switched off',()=>{
 const state=v=>k=>v[k]??null;
 assert.equal(pendingWork('pdf-job',state({})),false);
 assert.equal(pendingWork('pdf-job',state({'pdf-store-count':{requestedAt:'x'}})),true);
 assert.equal(pendingWork('pdf-job',state({'pdf-store-count':{requestedAt:'x',startedAt:'y'}})),false,'schon begonnen');
 assert.equal(pendingWork('pdf-job',state({'server-disk-count':{requestedAt:'x'}})),true);
 assert.equal(pendingWork('pdf-job',state({'pdf-store-job':{queue:[{id:'a'}],current:null,recent:[]}})),true);
 assert.equal(pendingWork('pdf-job',state({'pdf-store-job':{queue:[],current:null,recent:[]}})),false);
 assert.equal(pendingWork('pdf-job',state({'pdf-store-job':{queue:[],current:{id:'a',kind:'texts',state:'running'},recent:[]}})),true,'als laufend vermerkt: aufräumen, falls abgebrochen');
 assert.equal(pendingWork('pdf-job',state({'pdf-store-job':{queue:[],running:{chain:null,ocr:{id:'o',kind:'ocr',state:'running'}},recent:[]}})),true,'ebenso in der Bahn OCR');
 assert.equal(pendingWork('pdf-job',state({'pdf-store-job':{queue:[],running:{chain:null,ocr:null},recent:[]}})),false);
 assert.equal(pendingWork('backup',state({'pdf-store-count':{requestedAt:'x'}})),false);
});

test('stop request per job is recorded and shown',async()=>{
 const {db}=memoryDb();
 await assert.rejects(requestScheduleStop(db,'rm-rf'),/Unbekannter Job/);
 const r=await requestScheduleStop(db,'backup',new Date('2026-10-12T10:00:00Z'));
 assert.equal(r.requestedAt,'2026-10-12T10:00:00.000Z');
 const s=await schedulesState(db);
 assert.equal(s.jobs.find(j=>j.id==='backup').stop,'2026-10-12T10:00:00.000Z');
 assert.equal(s.jobs.find(j=>j.id==='import').stop,null);
});

test('Auslöser-Wache: inaktive Timer und Pfade werden gemeldet, ein alter Stand gilt als Ausfall des Zeitplaners',()=>{
 const names=unitNames([{id:'ocr'},{id:'backup'}]);
 assert.deepEqual(names,['ratsmonitor-ocr.timer','ratsmonitor-ocr.path','ratsmonitor-stop-ocr.path','ratsmonitor-backup.timer','ratsmonitor-backup.path','ratsmonitor-stop-backup.path']);
 const now=Date.parse('2026-10-16T14:00:00Z');
 assert.equal(unitsWarning(null,now),null);
 const fresh={at:'2026-10-16T13:55:00Z',units:{'ratsmonitor-ocr.timer':'inactive','ratsmonitor-ocr.path':'active','ratsmonitor-backup.timer':'active'}};
 assert.deepEqual(unitsWarning(fresh,now),{at:fresh.at,inactive:['ratsmonitor-ocr.timer'],stale:false});
 const old={at:'2026-10-16T13:00:00Z',units:{'ratsmonitor-ocr.timer':'active'}};
 assert.deepEqual(unitsWarning(old,now),{at:old.at,inactive:[],stale:true});
});
