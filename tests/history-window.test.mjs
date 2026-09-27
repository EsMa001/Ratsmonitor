import test from 'node:test';
import assert from 'node:assert/strict';
import {historyStart,HISTORY_MONTHS} from '../server/integrations/history-window.mjs';
import {collectSessionNet} from '../server/integrations/sessionnet.mjs';
test('twelve-month calendar window clamps leap day and preserves month ends',()=>{
 assert.equal(HISTORY_MONTHS,12);
 assert.equal(historyStart(new Date('2026-09-27T12:00:00Z')).toISOString(),'2025-09-27T12:00:00.000Z');
 assert.equal(historyStart(new Date('2024-02-29T12:00:00Z')).toISOString(),'2023-02-28T12:00:00.000Z');
});
test('SessionNet requests thirteen overlapping calendar months plus next month',async()=>{
 const calls=[];const result=await collectSessionNet({id:'test',name:'Test',kind:'city',extension:'asp',base:'https://example.test/'},{now:new Date('2026-09-27T12:00:00Z'),get:async url=>{calls.push(url);return 'sessionnet';}});
 assert.equal(calls.length,14);assert.ok(calls.some(u=>u.includes('__cjahr=2025&__cmonat=9')));assert.equal(result.coverage.from,'2025-09-27');assert.equal(result.coverage.complete,false);
});
