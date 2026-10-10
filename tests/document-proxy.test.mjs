// E4 of the code analysis: /api/dokument never leads the server into its own network, and transfers end on their own.
import test from 'node:test';
import assert from 'node:assert/strict';
import {privateAddress,blockedTarget,fetchDocument,idleLimited,documentName,MAX_HOPS} from '../server/integrations/document-proxy.mjs';

test('private, loopback, link-local and mapped addresses are recognised; public ones are not',()=>{
 for(const ip of ['127.0.0.1','127.5.5.5','10.1.2.3','172.16.0.1','172.31.255.255','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','255.255.255.255','192.0.0.8','198.18.0.1',
  '::1','::','fc00::1','fd12:3456::1','fe80::1','fec0::1','ff02::1','::ffff:127.0.0.1','::ffff:10.0.0.1','::ffff:7f00:1','64:ff9b::10.0.0.1','[::1]','fe80::1%eth0'])assert.equal(privateAddress(ip),true,ip);
 for(const ip of ['8.8.8.8','93.90.195.235','172.32.0.1','172.15.0.1','192.169.0.1','100.63.0.1','100.128.0.1','198.20.0.1','2a01:4f8::1','2606:4700::1','::ffff:93.90.195.235'])assert.equal(privateAddress(ip),false,ip);
});

test('only https addresses of public names are fetched',()=>{
 assert.equal(blockedTarget('https://ratsinfo.example.de/vo020.asp?VOLFDNR=1'),null);
 assert.equal(blockedTarget('https://93.90.195.235/x.pdf'),null);
 assert.match(blockedTarget('http://ratsinfo.example.de/x.pdf'),/https/);
 assert.match(blockedTarget('https://user:pw@ratsinfo.example.de/x.pdf'),/Zugangsdaten/);
 for(const url of ['https://localhost/x','https://intranet/x','https://ris.local/x','https://db.internal/x','https://printer.home.arpa/x','https://foo.localhost/x'])assert.match(blockedTarget(url),/interner Name/,url);
 for(const url of ['https://127.0.0.1/x','https://[::1]/x','https://169.254.169.254/latest/meta-data','https://10.0.0.1:8080/x','https://[fe80::1]/x'])assert.match(blockedTarget(url),/interne Adresse/,url);
 assert.match(blockedTarget('ftp://x.example/x'),/https/);assert.match(blockedTarget('nicht-eine-adresse'),/ungültig/);
});

const redirect=(location,status=302)=>new Response(null,{status,headers:{location}});
const pdf=()=>new Response('%PDF',{status:200,headers:{'content-type':'application/pdf'}});
const publicNames=async()=>['93.90.195.235'];

test('redirects are followed by hand, every target checked, at most three hops',async()=>{
 const asked=[];
 const request=async(url,init)=>{asked.push(url);assert.equal(init.redirect,'manual');assert.match(init.headers['User-Agent'],/Plenara/);
  if(url==='https://a.example/1')return redirect('/2');if(url==='https://a.example/2')return redirect('https://b.example/3',301);return pdf();};
 const {response,url}=await fetchDocument('https://a.example/1',{request,lookup:publicNames});
 assert.equal(response.status,200);assert.equal(url,'https://b.example/3');assert.deepEqual(asked,['https://a.example/1','https://a.example/2','https://b.example/3']);
 // A redirect into the own network, to http, or to a name that resolves internally is refused.
 for(const target of ['http://a.example/x','https://127.0.0.1/x','https://169.254.169.254/x','https://[::ffff:10.0.0.1]/x'])
  await assert.rejects(fetchDocument('https://a.example/r',{request:async()=>redirect(target),lookup:publicNames}),/nicht erlaubt/,target);
 await assert.rejects(fetchDocument('https://a.example/r',{request:async()=>redirect('https://inside.example/x'),lookup:async host=>host==='inside.example'?['10.0.0.5']:['93.90.195.235']}),/interne Adresse/);
 await assert.rejects(fetchDocument('https://a.example/r',{request:async()=>redirect('https://none.example/x'),lookup:async host=>host==='none.example'?[]:['93.90.195.235']}),/interne Adresse/);
 // Too many hops, a loop, a redirect without target.
 let hops=0;await assert.rejects(fetchDocument('https://a.example/0',{request:async()=>redirect('/'+(++hops)),lookup:publicNames}),/Zu viele Weiterleitungen/);assert.equal(hops,MAX_HOPS+1);
 await assert.rejects(fetchDocument('https://a.example/loop',{request:async()=>redirect('/loop'),lookup:publicNames}),/schleife/);
 await assert.rejects(fetchDocument('https://a.example/x',{request:async()=>new Response(null,{status:302}),lookup:publicNames}),/ohne Ziel/);
 // The first address is checked as well; a literal public address needs no lookup.
 await assert.rejects(fetchDocument('https://localhost/x',{request:pdf,lookup:publicNames}),/interner Name/);
 await assert.rejects(fetchDocument('https://a.example/x',{request:pdf,lookup:async()=>['127.0.0.1']}),/interne Adresse/);
 let looked=0;await fetchDocument('https://93.90.195.235/x',{request:pdf,lookup:async()=>{looked++;return [];}});assert.equal(looked,0);
 // Where the runtime cannot resolve names (lookup answers null) the name checks still apply.
 assert.equal((await fetchDocument('https://a.example/x',{request:pdf,lookup:async()=>null})).response.status,200);
});

test('a transfer that stalls is cut off; a steady one passes whole',async()=>{
 let aborted=null;const abort=reason=>{aborted=reason;};
 const steady=new ReadableStream({start(c){for(let i=0;i<5;i++)c.enqueue(new Uint8Array([i]));c.close();}});
 assert.equal((await new Response(idleLimited(steady,abort,50)).arrayBuffer()).byteLength,5);assert.equal(aborted,null);
 const stalled=new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));/* and then nothing */}});
 const reader=idleLimited(stalled,abort,40).getReader();
 assert.deepEqual((await reader.read()).value,new Uint8Array([1]));
 await new Promise(done=>setTimeout(done,120));
 assert.match(String(aborted?.message),/keine Daten/);
});

test('the file name survives a broken escape',()=>{
 assert.equal(documentName("inline; filename*=UTF-8''Vorlage%20%C3%A4.pdf"),'Vorlage ä.pdf');
 assert.equal(documentName("attachment; filename=\"alt.pdf\"; filename*=UTF-8''%E4"),'alt.pdf');
 assert.equal(documentName('attachment; filename="alt.pdf"'),'alt.pdf');assert.equal(documentName(''),'');
});
