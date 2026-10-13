import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchAiLocal,AI_LOCAL_BODY_LIMIT} from '../server/integrations/ai-local-http.mjs';
import {isLocalAiRequest} from '../build/ai-local-dev-plugin.mjs';

const base='http://127.0.0.1:5173';
const request=body=>new Request(base+'/api/admin/ai-local',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(body)});
test('HTTP list is read-only, bounded and retains cursor/state/scope',async()=>{
 let args;
 const result=await dispatchAiLocal(new Request(base+'/api/admin/ai-local?regions=billerbeck,berlin&limit=10&state=waiting_text&cursor=abc'),{list:input=>{args=input;return {items:[]};}});
 assert.deepEqual(args,{regions:['billerbeck','berlin'],window:'all',limit:10,state:'waiting_text',cursor:'abc'});
 assert.deepEqual(result,{items:[]});
 for(const limit of ['0','101','a','1.2'])await assert.rejects(dispatchAiLocal(new Request(base+'/api/admin/ai-local?limit='+limit),{}),{status:400});
});
test('HTTP mutations dispatch only known actions and require same-origin JSON',async()=>{
 const body={action:'read',id:'article',token:'secret'};
 assert.deepEqual(await dispatchAiLocal(request(body),{read:input=>input}),body);
 await assert.rejects(dispatchAiLocal(request({action:'constructor'}),{}),{status:400});
 await assert.rejects(dispatchAiLocal(request(null),{}),{status:400});
 await assert.rejects(dispatchAiLocal(new Request(base,{method:'DELETE'}),{}),{status:405});
 await assert.rejects(dispatchAiLocal(new Request(base,{method:'POST',headers:{origin:'https://foreign.example','content-type':'application/json'},body:'{}'}),{}),{status:403});
 await assert.rejects(dispatchAiLocal(new Request(base,{method:'POST',headers:{origin:base,'content-type':'text/plain'},body:'{}'}),{}),{status:415});
 await assert.rejects(dispatchAiLocal(request({action:'submit',padding:'x'.repeat(AI_LOCAL_BODY_LIMIT)}),{}),{status:413});
});
test('local development bridge rejects LAN, cross-site and DNS rebinding',()=>{
 const req=(remoteAddress,host,extra={})=>({socket:{remoteAddress},headers:{host,...extra}});
 assert.equal(isLocalAiRequest(req('127.0.0.1','127.0.0.1:5173')),true);
 assert.equal(isLocalAiRequest(req('::1','localhost:5173')),true);
 assert.equal(isLocalAiRequest(req('::1','[::1]:5173')),true);
 assert.equal(isLocalAiRequest(req('192.168.1.2','localhost:5173')),false);
 assert.equal(isLocalAiRequest(req('127.0.0.1','evil.example:5173')),false);
 assert.equal(isLocalAiRequest(req('127.0.0.1','localhost:5173',{origin:'https://evil.example'})),false);
 assert.equal(isLocalAiRequest(req('127.0.0.1','localhost:5173',{'sec-fetch-site':'cross-site'})),false);
});
