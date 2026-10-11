// Admin-Reiter „PDF-Ablage“: Stand lesen, Auftrag anlegen (server/integrations/pdf-store-admin.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {pdfStoreState,requestPdfJob,active,STATS_KEY,JOB_KEY} from '../server/integrations/pdf-store-admin.mjs';

test('Auftrag: einer zur Zeit, unbekannte Arten abgelehnt, alter laufender gilt als abgebrochen',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE system_state(key TEXT PRIMARY KEY,value TEXT)');
 const db=sqliteAdapter(sql);
 assert.deepEqual(await pdfStoreState(db),{stats:null,job:null});
 sql.prepare('INSERT INTO system_state VALUES(?,?)').run(STATS_KEY,JSON.stringify({linked:10,loaded:4}));
 const a=await requestPdfJob(db,'retry');assert.equal(a.created,true);assert.equal(a.job.state,'waiting');
 const b=await requestPdfJob(db,'run');assert.equal(b.created,false);assert.equal(b.job.kind,'retry');
 await assert.rejects(requestPdfJob(db,'delete'));
 const s=await pdfStoreState(db);assert.equal(s.stats.linked,10);assert.equal(s.job.kind,'retry');
 // Seit fünf Stunden „läuft“ ohne Rückmeldung: abgebrochen, ein neuer Auftrag ist möglich
 const old=new Date(Date.now()-5*3600000).toISOString();
 sql.prepare('UPDATE system_state SET value=? WHERE key=?').run(JSON.stringify({kind:'run',state:'running',requestedAt:old,updatedAt:old}),JOB_KEY);
 assert.equal(active((await pdfStoreState(db)).job),false);
 assert.equal((await requestPdfJob(db,'run')).created,true);
});
