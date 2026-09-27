import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {currentClassification} from '../shared/analytics.mjs';
import {classifyTopic} from '../shared/labels.mjs';
import {analysisControlsData,mapPlaces,analysisListPage} from '../shared/analysis-payload.mjs';
import {cachedRead,rememberRead,invalidateReads} from '../server/services/read-cache.mjs';

test('stored classifications are reused only for the same title, method and catalog',()=>{
 const t={title:'Schulbau',officialTitle:'Bau einer Grundschule'},classification=classifyTopic(t);
 assert.equal(currentClassification({...t,classification}),classification);
 for(const c of [{...classification,method:'old'},{...classification,version:'old'},{...classification,evidence:'Anderer Titel'},{...classification,primary:'invented'}])assert.equal(currentClassification({...t,classification:c}).method,'pending');
});
test('client props omit full match lists, article bodies and unrelated statistics',()=>{
 const d={region:'billerbeck',topicId:'',label:'bildung',level:'all',from:'2026-09-01',to:'2026-09-27',today:'2026-09-27',topicOptions:[{id:'a',title:'Schulbau'}],regionAvailability:{},geography:[{id:'billerbeck',count:1,total:10,share:10,coverage:{method:'oparl',issues:['long diagnostics']},matches:[{id:'a',title:'long article'}],comparison:{delta:1}}],articles:[{id:'a'}]};
 const controls=analysisControlsData(d),map=mapPlaces(d);
 assert.equal('geography' in controls,false);assert.equal('articles' in controls,false);assert.equal('matches' in map[0],false);assert.deepEqual(map[0].coverage,{method:'oparl'});assert.equal(map[0].count,1);
});
test('lazy article pages retain every source, cap transfer at 30 and reject changed membership',()=>{
 const items=Array.from({length:65},(_,i)=>({id:'id-'+String(i).padStart(3,'0'),title:'Schulbau '+i,sourceUrl:'https://example.org/'+i}));
 const d={articles:items,geography:[{id:'billerbeck',matches:items}],storageAvailable:true};
 const a=analysisListPage(d,'matches','billerbeck',0),b=analysisListPage(d,'matches','billerbeck',a.nextOffset,a.revision),c=analysisListPage(d,'matches','billerbeck',b.nextOffset,b.revision);
 assert.deepEqual([a.items.length,b.items.length,c.items.length],[30,30,5]);assert.equal(c.nextOffset,null);assert.deepEqual([...a.items,...b.items,...c.items],items);
 assert.equal(analysisListPage({...d,geography:[{id:'billerbeck',matches:items.slice(1)}]},'matches','billerbeck',30,a.revision).changed,true);
 assert.equal(analysisListPage(d,'local','',0).total,65);
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
