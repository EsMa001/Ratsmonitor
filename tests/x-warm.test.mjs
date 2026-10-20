// Warmhalten von plenara.X: serve.mjs (wird allein kopiert) liest dieselben Abfragen wie X_WARM_SQL, und alle laufen auf dem Schema.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {X_WARM_SQL,warmX} from '../server/integrations/x-cases.mjs';

test('serve.mjs wärmt mit denselben Abfragen wie X_WARM_SQL, und alle laufen auf dem Schema',()=>{
 const serve=fs.readFileSync(new URL('../server/node/serve.mjs',import.meta.url),'utf8');
 const block=serve.slice(serve.indexOf('const X_WARM_SQL'),serve.indexOf('];',serve.indexOf('const X_WARM_SQL')));
 assert.deepEqual([...block.matchAll(/"([^"]+)"/g)].map(m=>m[1]),X_WARM_SQL);
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 for(const q of X_WARM_SQL)sql.prepare(q).get();
 assert.ok(warmX(sql)>=0);
});

test('der plenara.X-Worker wärmt auf Nachricht warm (serve.mjs, eigener Thread statt Hauptprozess)',async()=>{
 const os=await import('node:os'),path=await import('node:path'),{Worker}=await import('node:worker_threads');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'x-warm-')),file=path.join(dir,'db.sqlite');
 const sql=new DatabaseSync(file);
 for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 sql.close();
 const worker=new Worker(new URL('../server/node/x-worker.mjs',import.meta.url),{env:{...process.env,DATABASE_FILE:file}});
 try{
  const answer=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:7,warm:true});});
  assert.equal(answer.id,7);assert.equal(answer.ok,true);assert.ok(answer.value>=0);
 }finally{await worker.terminate();fs.rmSync(dir,{recursive:true,force:true});}
});
