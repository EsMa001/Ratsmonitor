import {readNrwSnapshot,writeNrwSnapshot} from '../scripts/nrw-snapshot-file.mjs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nrwImports,nrwSnapshot,fallbackNrwTopics} from '../server/integrations/nrw-snapshot.mjs';
import {activeTopics} from '../shared/topic-identity.mjs';
test('split snapshot keeps legacy exports readable and rejects damaged or misplaced parts',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nrw-snapshot-')),file=path.join(folder,'nrw-seed.json');
 try{
  const original={revision:'fixture',coverage:[],topics:Array.from({length:101},(_,i)=>({id:'article-'+i,regionId:'nrw-05566068',title:'Öffentliche Beratung '+i}))};
  fs.writeFileSync(file,JSON.stringify(original));assert.deepEqual(readNrwSnapshot(file),original);
  writeNrwSnapshot(original,file);assert.deepEqual(readNrwSnapshot(file),original);
  const manifest=JSON.parse(fs.readFileSync(file));assert.equal(manifest.parts.length,2);
  fs.appendFileSync(path.join(folder,manifest.parts[0].file),' ');assert.throws(()=>readNrwSnapshot(file),/Prüfsumme/);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('compressed import preserves all articles, coverage and alias-aware counts without loading every region into runtime at once',async()=>{
 const raw=readNrwSnapshot();
 assert.equal(nrwSnapshot.revision,raw.revision);assert.deepEqual(nrwSnapshot.coverage,raw.coverage);
 let count=0;
 for await(const part of nrwImports(undefined)){
  const expected=raw.topics.filter(t=>t.regionId===part.coverage.regionId);assert.deepEqual(part.topics,expected);assert.equal(nrwSnapshot.counts[part.coverage.regionId],activeTopics(part.topics).length);count+=part.topics.length;
 }
 assert.equal(count,raw.topics.length);
 const selected=await fallbackNrwTopics('nrw-05558032');assert.ok(selected.length);assert.ok(selected.every(t=>t.regionId==='nrw-05558032'));
 assert.deepEqual(await fallbackNrwTopics('unknown'),[]);
});
