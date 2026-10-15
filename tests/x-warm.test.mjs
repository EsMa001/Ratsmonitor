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
