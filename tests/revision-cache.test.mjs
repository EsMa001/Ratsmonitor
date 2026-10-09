import test from 'node:test';
import assert from 'node:assert/strict';
import {atRevision} from '../server/integrations/revision-cache.mjs';

const db={prepare(){return {async first(){return {revision:1};}};}};
test('timeline results of both bases are kept side by side; other kinds replace their predecessor',async()=>{
 const runs={};const compute=key=>async()=>{runs[key]=(runs[key]||0)+1;return key;};
 await atRevision(db,'timeline|import',compute('import'));await atRevision(db,'timeline|event',compute('event'));
 await atRevision(db,'timeline|import',compute('import'));await atRevision(db,'timeline|event',compute('event'));
 assert.deepEqual(runs,{import:1,event:1});
 await atRevision(db,'estimate|c|d',compute('cd'));await atRevision(db,'estimate|a|b',compute('ab'));await atRevision(db,'estimate|c|d',compute('cd'));
 assert.equal(runs.cd,2,'the older estimate was replaced');
});
