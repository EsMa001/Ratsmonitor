import test from 'node:test';
import assert from 'node:assert/strict';
import {budgeted,BUDGET_REACHED} from '../server/integrations/request-budget.mjs';

test('a request cut off by the end of the budget reports the budget, not a fault',async()=>{
 const get=budgeted(async(url,timeout)=>{await new Promise(r=>setTimeout(r,timeout));throw Error('The operation was aborted due to timeout');},120,1);
 await assert.rejects(get('x'),e=>e.message===BUDGET_REACHED);
});

test('a transient failure is retried once when enough budget remains',async()=>{
 let calls=0;
 const get=budgeted(async()=>{calls++;if(calls===1)throw Error('Quelle antwortet mit HTTP 503');return 'ok';},60000,1,{pauseMs:5});
 assert.equal(await get('x'),'ok');
 assert.equal(calls,2);
});

test('permanent errors are not retried and an exhausted budget is reported',async()=>{
 let calls=0;
 const get=budgeted(async()=>{calls++;throw Error('Quelle antwortet mit HTTP 404');},60000,1,{pauseMs:5});
 await assert.rejects(get('x'),/HTTP 404/);
 assert.equal(calls,1);
 assert.throws(()=>budgeted(async()=>'ok',-1,1)('x'),e=>e.message===BUDGET_REACHED);
});

test('the timeout handed to a request never exceeds the remaining budget',async()=>{
 let seen;
 const get=budgeted(async(url,source,timeout)=>{seen=timeout;return 'ok';},5000,2);
 await get('x',{});
 assert.ok(seen<=5000&&seen>4000,'timeout '+seen);
});
