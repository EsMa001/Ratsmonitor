import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fetchNoRedirect} from '../server/integrations/no-redirect.mjs';
import {mergeImport} from '../server/integrations/merge-import.mjs';
import {pipelineAction} from '../server/integrations/pipeline-jobs.mjs';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {DatabaseSync} from 'node:sqlite';
test('fetchNoRedirect asks for manual redirects and refuses every redirect itself',async()=>{
 const calls=[];const fake=status=>async(url,init)=>{calls.push(init);return new Response(status===200?'{}':null,{status,headers:status===200?{}:{location:'https://elsewhere.example/'}});};
 const ok=await fetchNoRedirect('https://source.example/system',{headers:{Accept:'application/json'}},fake(200));
 assert.equal(ok.status,200);assert.equal(calls[0].redirect,'manual');assert.equal(calls[0].headers.Accept,'application/json');
 for(const status of [301,302,303,307,308])await assert.rejects(fetchNoRedirect('https://source.example/system',{},fake(status)),/Weiterleitung/);
 // The caller cannot switch the refusal off.
 await fetchNoRedirect('https://source.example/system',{redirect:'follow'},fake(200));assert.equal(calls.at(-1).redirect,'manual');
});
test("code that runs in the Workers runtime never passes redirect:'error' to fetch",()=>{
 // Cloudflare Workers reject the value with "Invalid redirect value"; every OParl import failed because of it.
 const offenders=[];const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(mjs|ts|tsx)$/.test(entry.name)&&/redirect\s*:\s*['"]error['"]/.test(fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g,'')))offenders.push(file);}};
 for(const dir of ['server','app','shared','components'])walk(new URL('../'+dir,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
 assert.deepEqual(offenders,[]);
});
test('a successful quiet attempt removes the notes of an earlier failed attempt',()=>{
 const topic={id:'billerbeck-top-1',regionId:'billerbeck',source:'city',sourceUrl:'https://fixture.example/agendaitem/1',officialTitle:'Thema',title:'Thema',status:'consulting',eventDate:'2026-03-01',updatedAt:'2026-03-01T10:00:00.000Z',events:[{url:'https://fixture.example/meeting/1',date:'2026-03-01',committee:'Rat',status:'consulting',description:'Beratung'}],documents:[]};
 const previous={topics:[topic],coverage:{from:'2025-09-27',complete:false,window:'12m',importedAt:'2026-09-27T10:00:00.000Z',issues:['Listenlimit erreicht','Abruf fehlgeschlagen; letzter übernommener Bestand bleibt erhalten.','Fehlerursache: Invalid redirect value']}};
 const merged=mergeImport(previous,{topics:[],coverage:{from:'2026-09-21',complete:false,window:'1w',quiet:true,importedAt:'2026-09-28T10:00:00.000Z',issues:[]}});
 assert.equal(merged.quiet,true);assert.deepEqual(merged.coverage.issues,['Listenlimit erreicht']);
});
test('a failed job item names the cause reported by the import',async()=>{
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));const db=sqliteAdapter(sql);
 let job=await pipelineAction(db,{action:'create',stage:'metadata',regions:['billerbeck'],window:'1w'},async()=>({}));
 job=await pipelineAction(db,{action:'step',id:job.id},async()=>({status:502,data:{error:'Import fehlgeschlagen',cause:'OParl HTTP 404'}}));
 assert.equal(job.items[0].status,'failed');assert.equal(job.items[0].message,'Import fehlgeschlagen Ursache: OParl HTTP 404');sql.close();
});
test('every source request names the project: OParl, SessionNet pages and documents',async()=>{
 // The Workers runtime adds no User-Agent; providers such as ratsinfomanagement.net answer such requests with HTTP 403.
 const {SOURCE_USER_AGENT}=await import('../server/integrations/no-redirect.mjs');
 const {collectRegionalOparl}=await import('../server/integrations/oparl-regional.mjs');
 const {requestJson}=await import('../server/integrations/oparl.mjs');
 const {fetchText}=await import('../server/integrations/sessionnet.mjs');
 assert.match(SOURCE_USER_AGENT,/^VorOrt-PoliticalTopics\//);
 const original=globalThis.fetch;const seen=[];
 try{
  globalThis.fetch=async(url,init)=>{seen.push([String(url),new Headers(init?.headers).get('user-agent')]);
   if(String(url).endsWith('/body'))return Response.json({id:'https://fixture.example/body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:'https://fixture.example/meetings'});
   if(String(url).includes('oparl.stadt-muenster.de'))return Response.json({ok:true});
   if(String(url).includes('/bi/'))return new Response('<html>sessionnet</html>',{headers:{'content-type':'text/html'}});
   return Response.json([]);};
  await collectRegionalOparl({system:'https://fixture.example/body',id:'test',name:'Teststadt',kind:'city'},{window:'1w'});
  await requestJson('https://oparl.stadt-muenster.de/system');
  await fetchText('https://pages.example/bi/si0040.asp',{base:'https://pages.example/bi/'});
  assert.ok(seen.length>=4);for(const [url,agent] of seen)assert.equal(agent,SOURCE_USER_AGENT,url);
 }finally{globalThis.fetch=original;}
});
