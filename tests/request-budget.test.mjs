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

import {pacedFetch} from '../server/integrations/request-budget.mjs';
test('pacedFetch: Mindestabstand je Anbieter, andere Anbieter und lokale Adressen ungebremst',async()=>{
 const seen=[],t0=Date.now(),since=()=>Date.now()-t0;
 const f=pacedFetch(async url=>{seen.push([new URL(url).hostname,since()]);return 'ok';},url=>new URL(url).hostname.split('.').slice(-2).join('.'),60);
 await Promise.all([f('https://a.ris-portal.de/x'),f('https://b.ris-portal.de/y'),f('https://c.ris-portal.de/z'),f('https://www.stadt-muenster.de/')]);
 const at=host=>seen.find(s=>s[0]===host)[1];
 assert.ok(at('b.ris-portal.de')>=55&&at('c.ris-portal.de')>=115,'derselbe Anbieter: Abstand');
 assert.ok(at('www.stadt-muenster.de')<40,'anderer Anbieter sofort');
 const t1=Date.now();await f('http://localhost:3000/api');await f('http://localhost:3000/api');assert.ok(Date.now()-t1<40,'lokal nie');
});
