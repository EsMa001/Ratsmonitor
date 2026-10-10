import test from 'node:test';
import assert from 'node:assert/strict';
import {allowed,fetchText} from '../server/integrations/sessionnet.mjs';

const http={base:'http://buergerinfo-x.de/',allowHttp:true};
test('http ist ohne allowHttp verboten',()=>{
  assert.throws(()=>allowed('http://buergerinfo-x.de/info.php',{base:'http://buergerinfo-x.de/'}));
  assert.throws(()=>allowed('http://buergerinfo-x.de/info.php',{base:'http://buergerinfo-x.de/',allowHttp:'true'}));
  assert.equal(allowed('https://a.de/x',{base:'https://a.de/'}),'https://a.de/x');
});
test('allowHttp gilt nur für den eingetragenen Host',()=>{
  assert.equal(allowed('http://buergerinfo-x.de/info.php',http),'http://buergerinfo-x.de/info.php');
  assert.throws(()=>allowed('http://anders.de/info.php',http));
  assert.throws(()=>allowed('http://buergerinfo-x.de:8080/info.php',http));
  assert.throws(()=>allowed('https://buergerinfo-x.de/info.php',http));
});
test('allowHttp bei https-Basis erlaubt kein http',()=>{
  assert.throws(()=>allowed('http://a.de/x',{base:'https://a.de/',allowHttp:true}));
});
test('Weiterleitung auf anderen Host wird abgelehnt',async()=>{
  const req=async()=>new Response(null,{status:302,headers:{location:'http://fremd.de/info.php'}});
  await assert.rejects(fetchText('http://buergerinfo-x.de/info.php',http,5000,req),/Nicht freigegeben/);
});
test('Weiterleitung innerhalb des Hosts per http wird gelesen',async()=>{
  let n=0;const req=async()=>++n===1?new Response(null,{status:302,headers:{location:'/neu.php'}}):new Response('<html>ok</html>',{status:200});
  assert.match(await fetchText('http://buergerinfo-x.de/info.php',http,5000,req),/ok/);
});
