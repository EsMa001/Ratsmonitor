import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {createTrace,summarize,requestKind,saveDebug,readDebug,debugKey} from '../server/integrations/import-trace.mjs';
import {collectOparl,requestJson,OPARL,BODY} from '../server/integrations/oparl.mjs';
import {collectSessionNet} from '../server/integrations/sessionnet.mjs';
test('a trace records every request with duration and outcome and leaves results and errors untouched',async()=>{
 let clock=1000;const trace=createTrace('billerbeck',{window:'1m',now:()=>clock});
 const get=trace.wrap(async(url,extra)=>{clock+=120;if(url.includes('vo0050'))throw Error('Quelle antwortet mit HTTP 500');return 'x'.repeat(40)+extra;});
 assert.equal(await get('https://ris.example.org/bi/si0057.asp?__ksinr=1','!'),'x'.repeat(40)+'!');
 clock+=30;await assert.rejects(get('https://ris.example.org/bi/vo0050.asp?__kvonr=7'),/HTTP 500/);
 const json=trace.wrap(async()=>{clock+=50;return {data:[]};});assert.deepEqual(await json('https://oparl.stadt-muenster.de/bodies/0001/meetings?limit=1000'),{data:[]});
 clock+=500;const record=trace.finish({status:'partial',reports:3});
 assert.equal(record.region,'billerbeck');assert.equal(record.window,'1m');assert.equal(record.durationMs,820);assert.equal(record.status,'partial');assert.equal(record.reports,3);assert.equal(record.startedAt,new Date(1000).toISOString());
 assert.deepEqual(record.requests,[
  {t:0,ms:120,kind:'si0057',url:'https://ris.example.org/bi/si0057.asp?__ksinr=1',ok:true,size:41},
  {t:150,ms:120,kind:'vo0050',url:'https://ris.example.org/bi/vo0050.asp?__kvonr=7',ok:false,error:'Quelle antwortet mit HTTP 500'},
  {t:270,ms:50,kind:'oparl',url:'https://oparl.stadt-muenster.de/bodies/0001/meetings?limit=1000',ok:true},
 ]);
 assert.deepEqual(record.summary,{requests:3,failed:1,networkMs:290,kinds:{si0057:{requests:1,failed:0,ms:120},vo0050:{requests:1,failed:1,ms:120},oparl:{requests:1,failed:0,ms:50}},errors:{'Quelle antwortet mit HTTP 500':1},slowest:[{url:record.requests[0].url,ms:120,ok:true},{url:record.requests[1].url,ms:120,ok:false},{url:record.requests[2].url,ms:50,ok:true}]});
 assert.deepEqual(summarize([]),{requests:0,failed:0,networkMs:0,kinds:{},errors:{},slowest:[]});
});
test('request kinds are read from the address; long runs and long addresses stay bounded',async()=>{
 assert.equal(requestKind('https://x.example/bi/to0045.php?__ksinr=3'),'to0045');assert.equal(requestKind('https://x.example/webservice/oparl/v1.1/body/1/meeting'),'oparl');
 assert.equal(requestKind('https://stadt.gremien.info/api.php?json=true&id=calendar'),'api calendar');assert.equal(requestKind('https://stadt.example/sdnetrim/vorgang/?__=abc123'),'vorgang');assert.equal(requestKind('kaputt'),'unbekannt');
 // ALLRIS 4 pages carry no file extension; the follow-up request of a calendar page counts as the calendar.
 assert.equal(requestKind('https://x.example/public/to010?SILFDNR=1000587'),'to010');assert.equal(requestKind('https://x.example/public/si010?0-1.0-&MM=9&YY=2026'),'si010');assert.equal(requestKind('https://x.example/public/oparl/system'),'oparl');
 const trace=createTrace('x'),get=trace.wrap(async()=>'ok');for(let i=0;i<1503;i++)await get('https://x.example/bi/si0057.asp?__ksinr='+i+'&pad='+'p'.repeat(i===0?400:0));
 const record=trace.finish();assert.equal(record.requests.length,1500);assert.equal(record.droppedRequests,3);assert.equal(record.requests[0].url.length,220);assert.equal(record.summary.requests,1500);assert.equal(record.window,null);
});
function fixture(){const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));return {sql,db:sqliteAdapter(sql)};}
test('the record of the last import of an area replaces the one before; recent runs come with their figures',async()=>{
 const {sql,db}=fixture(),first=createTrace('billerbeck',{window:'1w'}).finish({status:'failed',error:'Network connection lost.'}),second=createTrace('billerbeck',{window:'12m'}).finish({status:'completed',reports:12});
 assert.deepEqual(await readDebug(db,'billerbeck'),{region:'billerbeck',last:null,runs:[]});
 await saveDebug(db,first);await saveDebug(db,second);await saveDebug(db,createTrace('coesfeld').finish({status:'completed'}));
 assert.equal(sql.prepare("SELECT count(*) n FROM system_state WHERE key LIKE 'import-debug:%'").get().n,2);assert.equal(debugKey('billerbeck'),'import-debug:billerbeck');
 const run=sql.prepare('INSERT INTO import_runs(id,started_at,finished_at,status,details) VALUES(?,?,?,?,?)');
 run.run('r1','2026-10-02T09:00:00Z','2026-10-02T09:00:03Z','failed',JSON.stringify({mode:'metadata',region:'billerbeck',window:'1w',error:'Network connection lost.',debug:{requests:3,failed:1,networkMs:900,durationMs:3000}}));
 run.run('r2','2026-10-02T10:00:00Z','2026-10-02T10:00:20Z','completed',JSON.stringify({mode:'metadata',region:'billerbeck',window:'12m',count:12,unchangedMeetings:4,issues:[],warnings:['Vorlage nicht öffentlich (HTTP 401): x']}));
 run.run('r3','2026-10-02T10:30:00Z',null,'completed',JSON.stringify({mode:'metadata',region:'coesfeld'}));
 const debug=await readDebug(db,'billerbeck');
 assert.equal(debug.last.status,'completed');assert.equal(debug.last.reports,12);assert.equal(debug.last.window,'12m');
 assert.deepEqual(debug.runs.map(r=>r.id),['r2','r1']);assert.deepEqual(debug.runs[0].warnings,['Vorlage nicht öffentlich (HTTP 401): x']);assert.equal(debug.runs[0].unchangedMeetings,4);assert.equal(debug.runs[0].debug,null);
 assert.equal(debug.runs[1].error,'Network connection lost.');assert.deepEqual(debug.runs[1].debug,{requests:3,failed:1,networkMs:900,durationMs:3000});sql.close();
});
const H='https://oparl.stadt-muenster.de',now=new Date('2026-10-02T10:00:00Z');
// A minimal Münster: one meeting with two public items whose papers are not in the paper list and are fetched one by one.
const muenster=paper=>async url=>{
 const u=String(url);
 if(u===OPARL)return {body:H+'/bodies'};
 if(u===H+'/bodies')return {data:[{id:BODY,meeting:H+'/meetings',paper:H+'/papers',organization:H+'/organizations'}],links:{}};
 if(u.startsWith(H+'/meetings?'))return {data:[{id:H+'/meetings/1',start:'2026-09-22T17:00:00+02:00',organization:[H+'/org/1'],agendaItem:[{id:H+'/ai/1',public:true,name:'Thema A',consultation:H+'/consultations/1'},{id:H+'/ai/2',public:true,name:'Thema B',consultation:H+'/consultations/2'}]}],links:{}};
 if(u.startsWith(H+'/papers?'))return {data:[],links:{}};
 if(u.startsWith(H+'/organizations?'))return {data:[{id:H+'/org/1',name:'Rat'}],links:{}};
 if(u.startsWith(H+'/consultations/'))return {id:u,paper:H+'/bodies/0001/papers/vo/'+u.split('/').pop(),agendaItem:H+'/ai/'+u.split('/').pop()};
 if(u.includes('/papers/vo/'))return paper(u);
 throw Error('unerwartete Adresse '+u);
};
test('a paper the source does not publish is a warning; an unreachable one remains a gap',async()=>{
 const open=u=>({id:u,name:'Vorlage '+u.split('/').pop(),reference:'V/'+u.split('/').pop(),date:'2026-09-01'});
 const restricted=await collectOparl({now,window:'1m',getJson:muenster(u=>{if(u.endsWith('/1'))throw Error('OParl HTTP 401');return open(u);})});
 assert.deepEqual(restricted.coverage.warnings,[`Vorlage nicht öffentlich (HTTP 401): ${H}/bodies/0001/papers/vo/1`]);assert.deepEqual(restricted.coverage.issues,[]);assert.equal(restricted.coverage.complete,true);assert.equal(restricted.topics.length,2);
 const forbidden=await collectOparl({now,window:'1m',getJson:muenster(u=>{if(u.endsWith('/2'))throw Error('OParl HTTP 403');return open(u);})});
 assert.match(forbidden.coverage.warnings[0],/HTTP 403/);assert.equal(forbidden.coverage.complete,true);
 const broken=await collectOparl({now,window:'1m',getJson:muenster(u=>{if(u.endsWith('/1'))throw Error('OParl HTTP 500');return open(u);})});
 assert.deepEqual(broken.coverage.issues,[`Vorlage nicht erreichbar: ${H}/bodies/0001/papers/vo/1`]);assert.equal(broken.coverage.complete,false);assert.equal(broken.coverage.warnings,undefined);
 const fine=await collectOparl({now,window:'1m',getJson:muenster(open)});assert.equal(fine.coverage.warnings,undefined);assert.equal(fine.coverage.complete,true);
});
test('a lost connection gets one more attempt; an answer of the source is not repeated',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{if(++calls===1)throw TypeError('Network connection lost.');return Response.json({ok:true});};
  assert.deepEqual(await requestJson(H+'/system'),{ok:true});assert.equal(calls,2);
  calls=0;globalThis.fetch=async()=>{calls++;throw TypeError('Network connection lost.');};
  await assert.rejects(requestJson(H+'/system'),/Network connection lost/);assert.equal(calls,2,'not more than one repetition');
  calls=0;globalThis.fetch=async()=>{calls++;return new Response('nein',{status:401});};
  await assert.rejects(requestJson(H+'/system'),/OParl HTTP 401/);assert.equal(calls,1);
  calls=0;globalThis.fetch=async()=>{calls++;throw Object.assign(Error('The operation was aborted due to timeout'),{name:'TimeoutError'});};
  await assert.rejects(requestJson(H+'/system'),/timeout/);assert.equal(calls,1,'a timeout is not waited for twice');
  calls=0;globalThis.fetch=async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://example.org/'}});};
  await assert.rejects(requestJson(H+'/system'),/Weiterleitung/);assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
test('a page collector records its requests through the trace it is given',async()=>{
 const source={id:'teststadt',name:'Stadt Test',kind:'city',base:'https://ris.example.org/bi/',extension:'asp'},trace=createTrace('teststadt',{window:'1w'});
 const pages=async url=>{const file=new URL(url).pathname.split('/').pop();
  if(file==='si0040.asp')return '<html><meta name="sessionnet" content="V:050500"/>SessionNet '+(url.includes('__cmonat=9')?'<a href="si0057.asp?__ksinr=1" title="Details anzeigen: Rat 29.09.2026">Sitzung</a>':'')+'</html>';
  if(file==='si0057.asp')return '<table><tr><td class="tofnum">Ö 1</td><td class="tobetr"><div class="smc-card-header-title">Thema</div><a href="vo0050.asp?__kvonr=5">V/5</a></td></tr></table>';
  throw Error('Quelle antwortet mit HTTP 500');};
 const result=await collectSessionNet(source,{now,window:'1w',get:trace.wrap(pages)}),record=trace.finish({reports:result.topics.length});
 assert.equal(result.topics.length,1);assert.deepEqual(record.summary.kinds.si0057,{requests:1,failed:0,ms:record.summary.kinds.si0057.ms});assert.equal(record.summary.kinds.vo0050.failed,1);
 assert.equal(record.summary.failed,1);assert.deepEqual(record.summary.errors,{'Quelle antwortet mit HTTP 500':1});assert.equal(record.summary.requests,record.requests.length);assert.ok(record.summary.kinds.si0040.requests>=2);
});
