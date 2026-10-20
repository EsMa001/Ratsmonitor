import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {currentClassification} from '../shared/analytics.mjs';
import {classifyTopic} from '../shared/labels.mjs';
import {cachedRead,rememberRead,invalidateReads} from '../server/services/read-cache.mjs';

test('stored classifications are reused only for the same title, method and catalog',()=>{
 const t={title:'Schulbau',officialTitle:'Bau einer Grundschule'},classification=classifyTopic(t);
 assert.equal(currentClassification({...t,classification}),classification);
 for(const c of [{...classification,method:'old'},{...classification,version:'old'},{...classification,evidence:'Anderer Titel'},{...classification,primary:'invented'}])assert.equal(currentClassification({...t,classification:c}).method,'pending');
});
test('completed-result cache expires, evicts, invalidates and refuses shared promises',()=>{
 invalidateReads();assert.throws(()=>rememberRead('unsafe',Promise.resolve(1)));
 rememberRead('a',{count:2},1000);assert.equal(cachedRead('a',30999).count,2);assert.equal(cachedRead('a',31000),null);
 for(let i=0;i<4;i++)rememberRead(String(i),{i},1000);assert.equal(cachedRead('0',1000),null);assert.equal(cachedRead('3',1000).i,3);
 invalidateReads();assert.equal(cachedRead('3',1000),null);
});
test('a hung initialization check cannot make the next request await its I/O promise',async()=>{
 const file=new URL('../server/repositories/seed.ts',import.meta.url),uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
 let calls=0;
 globalThis.seedIsolation={DB:{prepare(){let keys=[];return {bind(...v){keys=v;return this;},all(){calls++;return calls===1?new Promise(()=>{}):Promise.resolve({results:keys.map(key=>({key}))});}};}}};
 const stubs={
  'server-only':'export {};',
  'cloudflare:workers':'export const env=globalThis.seedIsolation;',
  '@/data/history-backfill-gzip.json':'export default {revision:"fixture"};',
  '@/data/topics.json':'export default {topics:[],coverage:{}};',
  '@/data/regions.json':'export default {topics:[],coverage:[]};',
  '../integrations/nrw-snapshot.mjs':'export const nrwSnapshot={revision:"fixture"};export function nrwImports(){}',
  '../integrations/load-backfill.mjs':'export function loadBackfill(){}',
  '../integrations/apply-backfill.mjs':'export function applyBackfill(){}'
 };
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/((?:from\s+|import\s+)['"])([^'"]+)(['"])/g,(m,pre,spec,post)=>pre+(stubs[spec]?uri(stubs[spec]):new URL('../'+spec.slice(2),import.meta.url).href)+post);
 const {ensureData}=await import(uri(code));
 void ensureData();
 let timer;try{await Promise.race([ensureData(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Second request hung behind first')),200);})]);}finally{clearTimeout(timer);}
 assert.equal(calls,2);await ensureData();assert.equal(calls,2);
});
