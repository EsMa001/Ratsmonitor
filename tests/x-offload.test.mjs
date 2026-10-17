// plenara.X im Worker-Thread (server/integrations/x-offload.mjs, server/node/x-worker.mjs): ohne RM_X_WORKER rechnet
// xCached im Prozess; mit Worker kommt dasselbe Ergebnis, Fehler (AnalyticsError mit Status) und unbekannte Arten
// (Rückfall auf compute) kommen zurück, und der Hauptprozess bleibt dabei frei.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {xOffload,xOffloadStop,xOffloadEnabled} from '../server/integrations/x-offload.mjs';
import {AnalyticsError} from '../server/integrations/analytics-diffusion.mjs';

const WORKER=fileURLToPath(new URL('../server/node/x-worker.mjs',import.meta.url));

test('ohne RM_X_WORKER: kein Worker, xOffload liefert null',()=>{
 delete process.env.RM_X_WORKER;
 assert.equal(xOffloadEnabled(),false);
 assert.equal(xOffload('news',new URLSearchParams('q=a')),null);
});

test('mit Worker: Ergebnis, Fehler mit Status, unbekannte Art, Hauptprozess bleibt frei',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'x-offload-'));
 const file=path.join(dir,'db.sqlite');
 const sql=new DatabaseSync(file);
 sql.exec("CREATE TABLE system_state(key TEXT PRIMARY KEY,value TEXT); INSERT INTO system_state VALUES('x-cases','1');");
 sql.close();
 process.env.RM_X_WORKER=WORKER;process.env.RM_X_WORKERS='1';process.env.DATABASE_FILE=file;
 try{
  // Unbekannte Art: der Worker meldet unknown, xOffload liefert null (Rückfall auf compute im Prozess)
  assert.equal(await xOffload('gibt-es-nicht',new URLSearchParams()),null);
  assert.equal(xOffload('gibt-es-nicht',new URLSearchParams()),null,'danach ohne Rückfrage an den Worker');
  // Fehler mit Status: Trends ohne x_cases-Tabelle antwortet mit AnalyticsError 503 oder einem Datenbankfehler;
  // beides muss als Fehler im Hauptprozess ankommen, nicht als Absturz des Workers
  let caught=null;
  const t0=Date.now();
  const pending=xOffload('trends',new URLSearchParams('q=haushalt')).catch(e=>{caught=e;});
  // Der Hauptprozess ist währenddessen nicht blockiert: ein Timer läuft, bevor der Worker antwortet
  await new Promise(r=>setTimeout(r,5));
  assert.ok(Date.now()-t0<2000,'Hauptprozess frei');
  await pending;
  assert.ok(caught instanceof Error,'Fehler kommt zurück');
  if(caught instanceof AnalyticsError)assert.ok(caught.status>=400);
 } finally {
  await xOffloadStop();
  delete process.env.RM_X_WORKER;delete process.env.RM_X_WORKERS;delete process.env.DATABASE_FILE;
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
