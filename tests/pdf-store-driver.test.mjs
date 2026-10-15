import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const fixture=fileURLToPath(new URL('./fixtures/pdf-store-driver.mjs',import.meta.url));
function run(options){
 const child=spawnSync(process.execPath,['--experimental-test-module-mocks',fixture,JSON.stringify(options)],{
  encoding:'utf8',timeout:15000,maxBuffer:1024*1024,
 });
 assert.ifError(child.error);
 assert.equal(child.status,0,child.stderr||child.stdout);
 return JSON.parse(child.stdout);
}
const option=(args,name)=>args[args.indexOf('--'+name)+1];

test('OCR driver forwards its default 25-file batch and 2500 MiB RSS limit',()=>{
 const result=run({mode:'driver'});
 assert.equal(result.children.length,3);
 for(const child of result.children){
  assert.equal(option(child.args,'limit'),'25');
  assert.equal(option(child.args,'rss-mb'),'2500');
  assert.ok(child.args.includes('--child'));
  assert.equal(child.noProgress,'1');
 }
});

test('OCR driver forwards a custom RSS limit and batch size to every child',()=>{
 const result=run({mode:'driver',args:['--recycle','7','--rss-mb','1024','--workers','2']});
 for(const child of result.children){
  assert.equal(option(child.args,'limit'),'7');
  assert.equal(option(child.args,'rss-mb'),'1024');
  assert.equal(option(child.args,'workers'),'2');
 }
});

test('OCR driver continues after a partial batch and aggregates child summaries',()=>{
 const result=run({mode:'driver'});
 assert.equal(result.children.length,3,'two productive batches, followed by the empty queue check');
 assert.deepEqual(result.summary,{
  files:3,primary:1,pages:6,failed:0,changed:0,fetched:1,skipped:0,dropped:1,slow:0,killed:0,
  open:0,seconds:0,stopped:false,
 });
 assert.deepEqual(result.remaining,[]);
 assert.equal(result.closed,1);
 assert.equal(result.lockReleased,true);
});

test('OCR child stops starting files after RSS threshold and preserves the remaining queue',()=>{
 const result=run({mode:'child',rssAfterFile:3000});
 assert.deepEqual(result.read,['first']);
 assert.deepEqual(result.remaining,['second','third']);
 assert.equal(result.summary.files,1);
 assert.equal(result.summary.pages,2);
 assert.equal(result.summary.open,2);
 assert.equal(result.summary.stopped,false,'RSS recycling is not a user cancellation');
 assert.equal(result.schedulers,1);
 assert.equal(result.terminated,1);
 assert.match(result.logs.join('\n'),/Speicher.*2500 MB/);
 assert.doesNotMatch(result.logs.join('\n'),/Zeitgrenze erreicht \(0 min\)/);
});

test('OCR child uses the custom RSS threshold and terminates before an oversized first file',()=>{
 const result=run({mode:'child',args:['--rss-mb','1000'],rssBeforeFile:1200});
 assert.deepEqual(result.read,[]);
 assert.deepEqual(result.remaining,['first','second','third']);
 assert.equal(result.summary.files,0);
 assert.equal(result.summary.open,3);
 assert.equal(result.terminated,1);
 assert.match(result.logs.join('\n'),/Speicher.*1000 MB/);
});

test('OCR child completes the batch when RSS stays below its limit',()=>{
 const result=run({mode:'child',rssAfterFile:800});
 assert.deepEqual(result.read,['first','second','third']);
 assert.deepEqual(result.remaining,[]);
 assert.equal(result.summary.files,3);
 assert.equal(result.summary.pages,6);
 assert.equal(result.summary.open,0);
 assert.equal(result.terminated,1);
 assert.equal(result.closed,1);
});
