// Qualität der PDF-Ablage (storeQuality in scripts/pdf-store/store-lib.mjs): Mittel je Datei und nach Größe, Arten, Stufen
import test from 'node:test';
import assert from 'node:assert/strict';
import {storeQuality} from '../scripts/pdf-store/store-lib.mjs';

test('store quality: mean per file, weighted by bytes, types, bands, text-only',()=>{
 const f=(type,value,bytes,extra={})=>({type,value,bytes,other:0,minFormal:0,scan:false,...extra});
 const q=storeQuality([f('paper',1,100),f('paper',1.2,300),f('invitation',0.1,100,{minFormal:1}),f('attachment',0.4,500,{other:1,scan:true})],[f('attachment',0.4,9e6)]);
 assert.equal(q.files,4);assert.equal(q.bytes,1000);
 assert.equal(q.avg,0.68);
 assert.equal(q.byBytes,Math.round((100+360+10+200)/1000*100)/100);
 assert.equal(q.primary.files,3);assert.equal(q.others.avg,0.4);
 assert.equal(q.formal,1);assert.equal(q.scans,1);
 assert.deepEqual(q.types.map(t=>[t.type,t.files]),[['paper',2],['attachment',1],['invitation',1]]);
 assert.deepEqual(q.bands.map(b=>b.files),[2,0,1,1]);
 assert.deepEqual(q.textOnly,{files:1,avg:0.4});
 assert.equal(storeQuality([]).avg,null);
});
