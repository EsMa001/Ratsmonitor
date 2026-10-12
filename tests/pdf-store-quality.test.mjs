// Qualität der PDF-Ablage (storeQuality in scripts/pdf-store/store-lib.mjs): Mittel des Scores je Datei, Arten, Stufen
import test from 'node:test';
import assert from 'node:assert/strict';
import {storeQuality} from '../scripts/pdf-store/store-lib.mjs';

test('store quality: mean score per file, types, bands, text-only',()=>{
 const f=(type,score,bytes,extra={})=>({type,score,bytes,other:0,minFormal:0,scan:false,...extra});
 const q=storeQuality([f('paper',1,100),f('paper',0.6,300),f('invitation',0.1,100,{minFormal:1}),f('attachment',0.3,500,{other:1,scan:true})],[f('attachment',0.2,9e6)]);
 assert.equal(q.files,4);assert.equal(q.bytes,1000);
 assert.equal(q.avg,0.5);
 assert.equal(q.primary.files,3);assert.equal(q.primary.avg,0.567);assert.equal(q.others.avg,0.3);
 assert.equal(q.formal,1);assert.equal(q.scans,1);
 assert.deepEqual(q.types.map(t=>[t.type,t.files]),[['paper',2],['attachment',1],['invitation',1]]);
 assert.deepEqual(q.bands.map(b=>b.files),[1,1,1,1]);
 assert.deepEqual(q.textOnly,{files:1,avg:0.2});
 assert.equal(storeQuality([]).avg,null);
});
