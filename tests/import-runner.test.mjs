import test from 'node:test';
import assert from 'node:assert/strict';
import {runImports} from '../scripts/run-imports.mjs';
import {budgeted} from '../server/integrations/request-budget.mjs';
const base={siteUrl:'https://example.test',token:'private-secret-fixture',log:()=>{},sleep:async()=>{}};
test('runner retries transient errors sequentially, continues and never logs tokens',async()=>{
 const calls=[],logs=[],waits=[];let n=0;
 const results=await runImports({...base,regions:['billerbeck','muenster'],log:v=>logs.push(v),sleep:async ms=>waits.push(ms),fetcher:async(url,options)=>{calls.push(url.searchParams.get('region'));assert.equal(options.redirect,'error');return new Response(JSON.stringify({topics:2}),{status:++n<3?503:200});}});
 assert.deepEqual(calls,['billerbeck','billerbeck','billerbeck','muenster']);assert.deepEqual(waits,[5000,10000]);assert.equal(results.length,2);assert.ok(!logs.join('').includes(base.token));
});
test('authorization failure stops all regions without retry',async()=>{
 let n=0;await assert.rejects(runImports({...base,regions:['billerbeck','muenster'],fetcher:async()=>{n++;return new Response('',{status:401});}}),/abgelehnt/);assert.equal(n,1);
});
test('invalid transport is rejected; persistent errors are bounded and next region proceeds',async()=>{
 await assert.rejects(runImports({...base,siteUrl:'http://example.test'}),/HTTPS/);
 let n=0;const result=await runImports({...base,regions:['billerbeck','muenster'],fetcher:async()=>{n++;throw Error('network');}});assert.equal(n,6);assert.equal(result[1].status,'network-error');
});
test('request budget stops new requests after expiry',()=>{
 let called=false;assert.throws(()=>budgeted(()=>{called=true;},-1)('https://example.test'),/Zeitbudget/);assert.equal(called,false);
});

import {refreshAdminValues} from '../scripts/run-imports.mjs';
test('after the imports the runner brings the values per area up to date in steps and never fails the run',async()=>{
 const asked=[],states=['running','running','busy','done'];
 const fetcher=async(url,init)=>{asked.push([String(url),init.headers.authorization,JSON.parse(init.body)]);return new Response(JSON.stringify({state:states.shift()}),{status:200});};
 const logs=[];const steps=await refreshAdminValues({siteUrl:'https://site.example',token:'secret',fetcher,sleep:async()=>{},log:m=>logs.push(m)});
 assert.equal(steps,4);assert.equal(asked.length,4);
 assert.ok(asked.every(([u,a,b])=>u==='https://site.example/api/internal/admin-refresh'&&a==='Bearer secret'&&b.target==='regions'));
 assert.ok(!logs.join('').includes('secret'));
 assert.equal(await refreshAdminValues({siteUrl:'https://site.example',token:'x',fetcher:async()=>{throw Error('network');},log:()=>{}}),0);
 assert.equal(await refreshAdminValues({siteUrl:'https://site.example',token:'x',fetcher:async()=>new Response('{}',{status:401}),log:()=>{}}),0);
});
