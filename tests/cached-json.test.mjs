// Antworten gemerkter Ergebnisse (server/services/cached-json.mjs): Text und ETag je Ergebnis einmal, 304 bei gleichem Stand.
import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedJson} from '../server/services/cached-json.mjs';

const get=(etag)=>new Request('http://localhost/api/x',etag?{headers:{'If-None-Match':etag}}:{});

test('gleiches Ergebnis: derselbe Text und dasselbe schwache ETag, ohne erneutes JSON.stringify',async()=>{
 const value={rows:[{a:1},{a:2}],total:3};
 const first=cachedJson(get(),value,{'Cache-Control':'public, max-age=300'});
 assert.equal(first.status,200);assert.match(first.headers.get('ETag'),/^W\/"[0-9a-f]+"$/);
 assert.equal(first.headers.get('Content-Type'),'application/json');assert.equal(first.headers.get('Cache-Control'),'public, max-age=300');
 assert.deepEqual(await first.json(),value);
 const stringify=JSON.stringify;let calls=0;JSON.stringify=(...a)=>{calls++;return stringify(...a);};
 try{const again=cachedJson(get(),value);assert.equal(again.headers.get('ETag'),first.headers.get('ETag'));assert.equal(calls,0);}
 finally{JSON.stringify=stringify;}
});

test('If-None-Match mit dem ETag: 304 ohne Körper, mit den Kopfzeilen; anderer Stand: 200',async()=>{
 const value={n:1},etag=cachedJson(get(),value).headers.get('ETag');
 const same=cachedJson(get(etag),value,{'Cache-Control':'private, max-age=300'});
 assert.equal(same.status,304);assert.equal(await same.text(),'');assert.equal(same.headers.get('ETag'),etag);assert.equal(same.headers.get('Cache-Control'),'private, max-age=300');
 const other=cachedJson(get(etag),{n:2});
 assert.equal(other.status,200);assert.notEqual(other.headers.get('ETag'),etag);
 assert.equal(cachedJson(get(),null).status,200);
});
