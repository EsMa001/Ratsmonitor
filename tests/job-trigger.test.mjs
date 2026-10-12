// Sofortstart der Server-Jobs: Auslöser-Datei (server/integrations/job-trigger.mjs) und offene Wünsche (pendingWork)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {triggerJob,triggerDir,TRIGGER_JOBS} from '../server/integrations/job-trigger.mjs';
import {JOBS,pendingWork} from '../server/integrations/schedules.mjs';

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
  for(const id of TRIGGER_JOBS)assert.ok(fs.existsSync(`deploy/node/ratsmonitor-${id}.path`)&&fs.existsSync(`deploy/node/ratsmonitor-${id}.service`),id);
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
 assert.equal(pendingWork('backup',state({'pdf-store-count':{requestedAt:'x'}})),false);
});
