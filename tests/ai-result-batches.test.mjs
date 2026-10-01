import test from 'node:test';
import assert from 'node:assert/strict';
import {splitAiResultBatches} from '../shared/ai-result-batches.mjs';
test('result files split by article count and UTF-8 size without losing articles',()=>{
 const output={format:'ratsmonitor-ai-results-v1',jobId:'job',articles:Array.from({length:205},(_,i)=>({id:String(i),text:'ü'}))};
 const batches=splitAiResultBatches(output);assert.deepEqual(batches.map(b=>b.articles.length),[100,100,5]);
 assert.deepEqual(batches.flatMap(b=>b.articles),output.articles);assert.ok(batches.every(b=>b.jobId==='job'));
 const large={...output,articles:Array.from({length:3},(_,i)=>({id:String(i),text:'ü'.repeat(600000)}))};
 const pages=splitAiResultBatches(large);assert.equal(pages.length,2);
 for(const page of pages)assert.ok(new TextEncoder().encode(JSON.stringify({action:'apply',result:page})).byteLength<=2900000);
 assert.throws(()=>splitAiResultBatches({...output,articles:[{id:'x',text:'ü'.repeat(1500000)}]}),/einzelnes Artikelergebnis/);
 assert.throws(()=>splitAiResultBatches({...output,articles:[{id:'x'},{id:'x'}]}),/doppelte/);
});
