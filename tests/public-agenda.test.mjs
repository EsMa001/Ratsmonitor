import test from 'node:test';
import assert from 'node:assert/strict';
import {publicAgenda} from '../server/integrations/public-agenda.mjs';
test('public sections establish evidence, private sections and explicit false stop inheritance',()=>{
 const r=publicAgenda([{id:'unknown',name:'Bauprojekt'},{id:'pub',number:'I.',name:'Öffentliche Sitzung'},{id:'a',name:'Schulbau'},{id:'private',public:false,name:'Personal'},{id:'b',name:'Vergabe'},{id:'yes',public:true,name:'Ausdrücklich öffentlich'},{id:'non',name:'Nichtöffentliche Sitzung'},{id:'c',name:'Vertraulich'}]);
 assert.deepEqual(r.items.map(a=>a.id),['a','yes']);assert.equal(r.items[0].publicEvidence.source,'pub');assert.equal(r.unclear,3);
});
test('unrecognized section boundaries and deleted points do not leak into the feed',()=>{
 const r=publicAgenda([{id:'h',name:'Öffentlicher Teil'},{id:'gone',deleted:true,name:'Gelöscht'},{id:'x',number:'II.',name:'Weitere Angelegenheiten'},{id:'n',name:'Unklar'}]);assert.equal(r.items.length,0);
});
import {mergeImport} from '../server/integrations/merge-import.mjs';
test('failed imports preserve successful coverage and bounded imports retain older events',()=>{
 const previous={topics:[{id:'a',events:[{url:'old',date:'2026-07-01',committee:'Rat',status:'consulting'}],documents:[{url:'doc1'}]}],coverage:{importedAt:'2026-09-01',complete:true,issues:[]}};
 const failed=mergeImport(previous,{topics:[],coverage:{importedAt:null,lastAttemptAt:'2026-09-26',complete:false,issues:['Timeout']}});
 assert.equal(failed.topics.length,1);assert.equal(failed.coverage.importedAt,'2026-09-01');assert.equal(failed.coverage.lastAttemptAt,'2026-09-26');assert.equal(failed.coverage.complete,false);
 const next=mergeImport(previous,{topics:[{id:'a',events:[{url:'new',date:'2026-09-20',committee:'Rat',status:'approved'}],documents:[{url:'doc2'}]}],coverage:{importedAt:'2026-09-26'}});
 assert.equal(next.topics[0].events.length,2);assert.equal(next.topics[0].documents.length,2);
});
test('a deleted public heading cannot establish publicity',()=>{assert.equal(publicAgenda([{id:'gone',deleted:true,name:'Öffentliche Sitzung'},{id:'x',name:'Unklar'}]).items.length,0)});
test('an older snapshot cannot roll back a newer article or coverage',()=>{
 const latest={topics:[{id:'a',title:'New',updatedAt:'2026-09-26'}],coverage:{importedAt:'2026-09-26'}};
 const merged=mergeImport(latest,{topics:[{id:'a',title:'Old',updatedAt:'2026-09-20'}],coverage:{importedAt:'2026-09-20'}});
 assert.equal(merged.topics[0].title,'New');assert.equal(merged.coverage.importedAt,'2026-09-26');
});
test('provider wordings of the public heading are recognised; a private or unknown heading still ends the section',()=>{
 // SD.NET exports no public flag at all; the section heading is the only evidence.
 for(const heading of ['Öffentlich','öffentlich','- Öffentlicher Teil -','Öffentlicher Teil','Öffentliche Sitzung']){
  const r=publicAgenda([{id:'h',number:'I.',name:heading},{id:'a',number:'1.',name:'Schulbau'},{id:'b',number:'2.',name:'Radweg'}]);
  assert.deepEqual(r.items.map(i=>i.id),['a','b'],heading);assert.equal(r.items[0].publicEvidence.method,'public-section');
 }
 for(const closing of ['nichtöffentlich','Nicht öffentlich','- Nichtöffentlicher Teil -','Nicht-öffentliche Sitzung']){
  const r=publicAgenda([{id:'h',number:'A',name:'- Öffentlicher Teil -'},{id:'a',number:'1',name:'Schulbau'},{id:'n',number:'B',name:closing},{id:'c',number:'9',name:'Grundstück'}]);
  assert.deepEqual(r.items.map(i=>i.id),['a'],closing);assert.equal(r.unclear,1);
 }
 // A lettered or Roman heading with any other name ends the public part as well.
 assert.deepEqual(publicAgenda([{id:'h',number:'A',name:'Öffentlich'},{id:'a',number:'1',name:'Schulbau'},{id:'x',number:'B',name:'Vertrauliches'},{id:'c',number:'9',name:'Grundstück'}]).items.map(i=>i.id),['a']);
 // A normal item that merely starts with the word is no heading.
 const r=publicAgenda([{id:'x',number:'1',name:'Öffentliche Bekanntmachung der Satzung'},{id:'y',number:'2',name:'Öffentlichkeitsarbeit'}]);assert.equal(r.items.length,0);assert.equal(r.unclear,2);
});
