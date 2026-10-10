// E1 of the code analysis: answers of sources are read with a limit, never buffered whole first.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyBytes,bodyText,bodyJson,TOO_LARGE} from '../server/integrations/body-bytes.mjs';
import {fetchText} from '../server/integrations/sessionnet.mjs';
import {requestJson} from '../server/integrations/oparl.mjs';

// A body that streams `chunks` pieces of `size` bytes; `read` counts how many were handed out.
function streaming(chunks,size,headers={}){
 let read=0;
 const body=new ReadableStream({pull(controller){if(read>=chunks){controller.close();return;}read++;controller.enqueue(new Uint8Array(size).fill(97));}});
 return {response:new Response(body,{status:200,headers}),handed:()=>read};
}

test('a declared length above the limit is refused before anything is read',async()=>{
 const {response,handed}=streaming(10,1000,{'content-length':'10000'});
 await assert.rejects(bodyBytes(response,5000),e=>e.message===TOO_LARGE);assert.equal(handed(),0);
});

test('a body without length stops at the limit instead of being read to the end',async()=>{
 const {response,handed}=streaming(1000,1000);
 await assert.rejects(bodyBytes(response,5000),e=>e.message===TOO_LARGE);
 assert.ok(handed()<=7,'read only up to the limit, not all 1000 pieces: '+handed());
 const own=streaming(1000,1000);await assert.rejects(bodyBytes(own.response,5000,{message:'eigene Meldung'}),/eigene Meldung/);
});

test('a body within the limit is returned whole, as bytes, text or JSON',async()=>{
 const {response}=streaming(3,1000);
 const bytes=await bodyBytes(response,5000);assert.equal(bytes.byteLength,3000);assert.equal(bytes[2999],97);
 assert.equal(await bodyText(new Response('Bär'),100),'Bär');
 assert.deepEqual(await bodyJson(new Response('{"a":[1]}'),100),{a:[1]});
 await assert.rejects(bodyJson(new Response('{"a":'+'1'.repeat(200)+'}'),100),e=>e.message===TOO_LARGE);
});

test('the page reader and the OParl reader stop at their limits',async()=>{
 const page=streaming(100,100000,{'content-type':'text/html'});
 await assert.rejects(fetchText('https://source.example/si010.asp',{base:'https://source.example/'},20000,async()=>page.response),/zu groß/);
 assert.ok(page.handed()<=45,'read only up to 4 MB: '+page.handed());
 // The OParl reader fetches on its own: the global fetch is replaced for this one call.
 // The OParl reader fetches on its own and asks a second time after a failure: a fresh stream per request.
 const real=globalThis.fetch,handed=[];
 globalThis.fetch=async()=>{const json=streaming(200,100000,{'content-type':'application/json'});handed.push(json.handed);return json.response;};
 try{await assert.rejects(requestJson('https://oparl.stadt-muenster.de/bodies',1000),/Größenlimit/);}finally{globalThis.fetch=real;}
 assert.ok(handed.length>=1&&handed.every(h=>h()<=85),'read only up to 8 MB: '+handed.map(h=>h()));
});
