import test from 'node:test';
import assert from 'node:assert/strict';
import {versionPayload,restoreVersions} from '../shared/article-version.mjs';

test('Änderung statt Kopie: nur geänderte Felder, rückwärts wieder voll', () => {
 const v1={id:'a',title:'Alt',status:'open',events:[1],metadata:{x:1}};
 const v2={id:'a',title:'Neu',status:'open',events:[1,2],summary:'s',metadata:{x:2}};
 const cur={id:'a',title:'Neu',status:'approved',events:[1,2],summary:'s',metadata:{x:3}};
 const d1=JSON.parse(versionPayload(v1,v2)),d2=JSON.parse(versionPayload(v2,cur));
 assert.deepEqual(d1.changed,{title:'Alt',events:{$list:1,at:{}}});assert.deepEqual(d1.added,['summary']);
 assert.deepEqual(d2.changed,{status:'open'});
 const [r2,r1]=restoreVersions(cur,[d2,d1]);
 const bare=({metadata,...r})=>r;
 assert.deepEqual(bare(r2),bare(v2));assert.deepEqual(bare(r1),bare(v1));
});

test('alte volle Kopien bleiben lesbar', () => {
 const full={id:'a',title:'Kopie'};
 assert.deepEqual(restoreVersions({id:'a',title:'jetzt'},[full]),[full]);
});

test('Listen und Objekte: nur geänderte Einträge', () => {
 const v1={id:'a',events:[{d:1},{d:2}],src:{a:1,b:{x:1}}};
 const cur={id:'a',events:[{d:1},{d:3},{d:4}],src:{a:1,b:{x:2},c:5}};
 const d=JSON.parse(versionPayload(v1,cur));
 assert.deepEqual(d.changed.events,{$list:2,at:{1:{$obj:{d:2}}}});
 assert.deepEqual(d.changed.src,{$obj:{b:{$obj:{x:1}}},added:['c']});
 assert.deepEqual(restoreVersions(cur,[d])[0],v1);
});

test('tief verschachtelt: geänderter Eintrag in einem Termin', () => {
 const v1={id:'a',events:[{d:1,r:{s:'offen',n:[1,2]}}]},cur={id:'a',events:[{d:1,r:{s:'beschlossen',n:[1,2,3]}}]};
 const d=JSON.parse(versionPayload(v1,cur));
 assert.deepEqual(restoreVersions(cur,[d])[0],v1);
});
