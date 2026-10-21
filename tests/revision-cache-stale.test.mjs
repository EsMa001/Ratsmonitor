import test from 'node:test';
import assert from 'node:assert/strict';
import {atRevisionStale} from '../server/integrations/revision-cache.mjs';

const fakeDb=()=>{const db={revision:1,prepare:()=>({first:async()=>({revision:db.revision})})};return db;};

test('gleicher Datenstand: kein neues Rechnen', async()=>{
 const db=fakeDb();let runs=0;
 assert.equal(await atRevisionStale(db,'k|a',async()=>++runs),1);
 assert.equal(await atRevisionStale(db,'k|a',async()=>++runs),1);
 assert.equal(runs,1);
});

test('neuer Datenstand: erst der letzte Stand, die neue Rechnung im Hintergrund', async()=>{
 const db=fakeDb();let runs=0;
 await atRevisionStale(db,'k|a',async()=>++runs);
 db.revision=2;
 assert.equal(await atRevisionStale(db,'k|a',async()=>++runs),1);
 await new Promise(r=>setTimeout(r,10));
 assert.equal(await atRevisionStale(db,'k|a',async()=>++runs),2);
 assert.equal(runs,2);
});

test('höchstens 20 Filter je Art, andere Arten bleiben', async()=>{
 const db=fakeDb();let runs=0;
 await atRevisionStale(db,'other|x',async()=>'o');
 for(let i=0;i<21;i++)await atRevisionStale(db,'k|'+i,async()=>++runs);
 await atRevisionStale(db,'k|0',async()=>++runs);
 assert.equal(runs,22);
 assert.equal(await atRevisionStale(db,'other|x',async()=>'neu'),'o');
});

test('gleichzeitige gleiche Anfragen rechnen einmal; ein Fehler wird nicht gehalten', async()=>{
 const db=fakeDb();let runs=0,release;
 const slow=()=>{runs++;return new Promise(r=>{release=r;});};
 const a=atRevisionStale(db,'k|a',slow),b=atRevisionStale(db,'k|a',slow);
 await new Promise(r=>setTimeout(r,5));
 assert.equal(runs,1,'eine Rechnung');
 release('wert');
 assert.equal(await a,'wert');assert.equal(await b,'wert');
 /* anderer Schlüssel: eigene Rechnung */
 assert.equal(await atRevisionStale(db,'k|b',async()=>'b'),'b');
 /* Fehler: beide Wartenden sehen ihn, der nächste Aufruf rechnet neu */
 let fails=0;const broken=async()=>{fails++;throw Error('kaputt');};
 const [x,y]=await Promise.allSettled([atRevisionStale(db,'k|c',broken),atRevisionStale(db,'k|c',broken)]);
 assert.equal(x.status,'rejected');assert.equal(y.status,'rejected');assert.equal(fails,1);
 assert.equal(await atRevisionStale(db,'k|c',async()=>'heil'),'heil');
});
