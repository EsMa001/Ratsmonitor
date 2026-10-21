// Kunden-MCP über HTTP (server/mcp/http.mjs): Anmeldung mit Schlüssel oder OAuth-Token, nur die Gebiete aus der
// Kundendatei, Beschreibungen für OAuth-Clients, Grenzen. Ohne Netz: der Handler bekommt Request-Objekte.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openD1} from '../server/node/d1-sqlite.mjs';
import {createMcpHttpHandler} from '../server/mcp/http.mjs';
import {customerStore,keyHash,parseCustomers} from '../server/mcp/customers.mjs';
import {signAccessToken,verifyAccessToken} from '../server/mcp/tokens.mjs';
import {startMcpHttp} from '../server/node/mcp-http-server.mjs';

const ISSUER='https://plenara.test',SECRET='mcp-test-secret-0123456789abcdef0123456789';
const KEY='plk_'+'a'.repeat(43),OTHER_KEY='plk_'+'b'.repeat(43);
const USER='u_kundeAkonto01';

function fixture(t,{rpm=60}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rm-mcp-http-')),file=path.join(dir,'data.sqlite'),raw=new DatabaseSync(file);
 for(const name of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())raw.exec(fs.readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 const put=raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 for(const [id,region,title] of [['b-1','billerbeck','Radweg an der Bahnhofstraße'],['m-1','muenster','Radweg am Aasee']])
  put.run(id,region,'city','2026-09-12','2026-09-13T12:00:00Z','approved',JSON.stringify({id,regionId:region,title,officialTitle:title,status:'approved',eventDate:'2026-09-12',
   shortSummary:'Ein Radweg wird gebaut.',longSummary:['Der Rat beschließt den Radweg.'],sourceUrl:'https://example.org/'+id,documents:[],events:[]}));
 const customersFile=path.join(dir,'customers.json');
 const write=customers=>fs.writeFileSync(customersFile,JSON.stringify({version:1,customers}));
 const base={identity:'kunde-a',name:'Kunde A',allowedRegionIds:['billerbeck'],requestsPerMinute:rpm,accounts:[USER],keys:[{id:'k_abcdef12',sha256:keyHash(KEY),created:'2026-10-21'}],disabled:false};
 write([base]);
 const db=openD1(file,{readOnly:true});
 const audit=[];
 const handle=createMcpHttpHandler({db,customers:customerStore(customersFile),secret:SECRET,issuer:ISSUER,audit:e=>audit.push(e)});
 t.after(()=>{db.close();raw.close();fs.rmSync(dir,{recursive:true,force:true});});
 return {handle,write,base,audit,dir,file,customersFile};
}
let ip=0;
function post(f,body,{token,headers={},method='POST'}={}){
 return f.handle(new Request(ISSUER+'/mcp',{method,headers:{'content-type':'application/json',accept:'application/json, text/event-stream','mcp-protocol-version':'2025-06-18',
  'x-forwarded-for':'198.51.100.'+(++ip%200),...(token?{authorization:'Bearer '+token}:{}),...headers},body:method==='POST'?JSON.stringify(body):undefined}));
}
const call=(name,args={},id=1)=>({jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:args}});

test('Beschreibungen für OAuth-Clients: geschützte Ressource und Anmeldedienst, mit CORS',async t=>{
 const f=fixture(t);
 for(const p of ['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp']){
  const r=await f.handle(new Request(ISSUER+p));
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.resource,ISSUER+'/mcp');assert.deepEqual(body.authorization_servers,[ISSUER]);
  assert.equal(r.headers.get('access-control-allow-origin'),'*');
 }
 const as=await (await f.handle(new Request(ISSUER+'/.well-known/oauth-authorization-server'))).json();
 assert.equal(as.issuer,ISSUER);assert.equal(as.token_endpoint,ISSUER+'/oauth/token');assert.equal(as.registration_endpoint,ISSUER+'/oauth/register');
 assert.deepEqual(as.code_challenge_methods_supported,['S256']);
 assert.equal((await f.handle(new Request(ISSUER+'/mcp',{method:'OPTIONS'}))).status,204);
 assert.equal((await f.handle(new Request(ISSUER+'/admin'))).status,404);
});

test('ohne oder mit falschem Schlüssel: 401 mit Verweis auf die Ressourcenbeschreibung; zu viele Fehlversuche: 429',async t=>{
 const f=fixture(t);
 const none=await post(f,call('reports_regions'));
 assert.equal(none.status,401);
 assert.match(none.headers.get('www-authenticate'),/^Bearer resource_metadata="https:\/\/plenara\.test\/\.well-known\/oauth-protected-resource\/mcp"$/);
 const wrong=await post(f,call('reports_regions'),{token:OTHER_KEY});
 assert.equal(wrong.status,401);assert.match(wrong.headers.get('www-authenticate'),/error="invalid_token"/);
 let last;
 for(let i=0;i<31;i++)last=await post(f,call('reports_regions'),{token:'plk_falsch',headers:{'x-forwarded-for':'192.0.2.9'}});
 assert.equal(last.status,429);
 assert.ok(!JSON.stringify(f.audit).includes('plk_'),'kein Schlüssel im Protokoll');
});

test('Schlüssel des Betreibers: vier lesende Werkzeuge, nur die Gebiete des Kunden',async t=>{
 const f=fixture(t);
 const list=await post(f,{jsonrpc:'2.0',id:1,method:'tools/list',params:{}},{token:KEY});
 assert.equal(list.status,200);
 const tools=(await list.json()).result.tools.map(x=>x.name).sort();
 assert.deepEqual(tools,['reports_aggregate','reports_get','reports_regions','reports_search']);
 const regions=(await (await post(f,call('reports_regions'),{token:KEY})).json()).result.structuredContent;
 assert.deepEqual(regions.regions.map(r=>r.id),['billerbeck']);
 const found=(await (await post(f,call('reports_search',{query:'Radweg',from:'2026-01-01',to:'2026-12-31'}),{token:KEY})).json()).result.structuredContent;
 assert.ok(found.reports.length>=1);assert.ok(found.reports.every(r=>r.region.id==='billerbeck'),'Münster bleibt draußen');
 // Fremde Gebiete fallen still aus der Auswahl: keine Treffer, kein Hinweis auf ihre Daten
 const other=(await (await post(f,call('reports_search',{regionIds:['muenster'],query:'Radweg'}),{token:KEY})).json()).result.structuredContent;
 assert.deepEqual(other.reports,[]);
 assert.ok(f.audit.some(e=>e.tool==='reports_search'&&e.identity==='kunde-a'&&e.via==='key'));
});

test('OAuth-Zugangstoken: gilt nur für diese Adresse, nur bis zum Ablauf und nur solange das Konto beim Kunden steht',async t=>{
 const f=fixture(t);
 const now=Date.now();
 const {token}=await signAccessToken({secret:SECRET,userId:USER,customer:'kunde-a',clientId:'oc_x',audience:ISSUER+'/mcp',now});
 assert.ok(await verifyAccessToken(token,{secret:SECRET,audience:ISSUER+'/mcp',now}));
 assert.equal(await verifyAccessToken(token,{secret:SECRET,audience:'https://andere.test/mcp',now}),null);
 assert.equal(await verifyAccessToken(token,{secret:SECRET.replace('m','n'),audience:ISSUER+'/mcp',now}),null);
 assert.equal(await verifyAccessToken(token.slice(0,-2)+'00',{secret:SECRET,audience:ISSUER+'/mcp',now}),null);
 assert.equal((await post(f,call('reports_regions'),{token})).status,200);
 const wrongAud=(await signAccessToken({secret:SECRET,userId:USER,customer:'kunde-a',clientId:'oc_x',audience:'https://andere.test/mcp',now})).token;
 assert.equal((await post(f,call('reports_regions'),{token:wrongAud})).status,401);
 const expired=(await signAccessToken({secret:SECRET,userId:USER,customer:'kunde-a',clientId:'oc_x',audience:ISSUER+'/mcp',now:now-3600_000})).token;
 assert.equal((await post(f,call('reports_regions'),{token:expired})).status,401);
 // Betreiber nimmt das Konto heraus: sofort wirksam (Datei neu gelesen), auch für das noch gültige Token
 await new Promise(r=>setTimeout(r,20));
 f.write([{...f.base,accounts:[]}]);
 assert.equal((await post(f,call('reports_regions'),{token})).status,401);
});

test('Kundendatei: Sperre und neue Gebiete gelten ohne Neustart; kaputte Datei sperrt alles',async t=>{
 const f=fixture(t);
 assert.equal((await post(f,call('reports_regions'),{token:KEY})).status,200);
 await new Promise(r=>setTimeout(r,20));
 f.write([{...f.base,allowedRegionIds:['billerbeck','muenster']}]);
 const regions=(await (await post(f,call('reports_regions'),{token:KEY})).json()).result.structuredContent.regions.map(r=>r.id).sort();
 assert.deepEqual(regions,['billerbeck','muenster']);
 await new Promise(r=>setTimeout(r,20));
 f.write([{...f.base,disabled:true}]);
 assert.equal((await post(f,call('reports_regions'),{token:KEY})).status,401);
 await new Promise(r=>setTimeout(r,20));
 fs.writeFileSync(f.customersFile,'{kaputt');
 assert.equal((await post(f,call('reports_regions'),{token:KEY})).status,401);
 const health=await (await f.handle(new Request(ISSUER+'/health'))).json();
 assert.equal(health.ok,false);
});

test('Kundendatei wird streng geprüft: unbekannte Gebiete, doppelte Kennungen und Schlüssel, Adressen statt IDs',()=>{
 const one=(over={})=>({identity:'kunde-a',name:'A',allowedRegionIds:['billerbeck'],...over});
 assert.doesNotThrow(()=>parseCustomers({version:1,customers:[one()]}));
 for(const bad of [[one({allowedRegionIds:['erfunden']})],[one(),one()],[one({accounts:['max@example.org']})],[one({identity:'A B'})],[one({extra:1})],
  [one({keys:[{id:'k_abcdef12',sha256:'a'.repeat(64),created:'x'}]}),one({identity:'kunde-b',keys:[{id:'k_abcdef13',sha256:'a'.repeat(64),created:'x'}]})]])
  assert.throws(()=>parseCustomers({version:1,customers:bad}));
});

test('nur POST, Körper begrenzt, Mengengrenze gilt über Anfragen hinweg',async t=>{
 const f=fixture(t,{rpm:2});
 assert.equal((await post(f,null,{token:KEY,method:'GET'})).status,405);
 assert.equal((await post(f,{jsonrpc:'2.0',id:1,method:'tools/list',params:{pad:'x'.repeat(1_100_000)}},{token:KEY})).status,413);
 await post(f,call('reports_regions'),{token:KEY});await post(f,call('reports_regions'),{token:KEY});
 const third=(await (await post(f,call('reports_regions'),{token:KEY})).json()).result.structuredContent;
 assert.equal(third.error.code,'RATE_LIMITED');
});

test('Prozess: startet nur mit vollständiger Umgebung, antwortet über HTTP und liest nie die Kontendatei',async t=>{
 const f=fixture(t);
 await assert.rejects(()=>startMcpHttp({MCP_DATABASE_FILE:f.file,MCP_CUSTOMERS_FILE:f.customersFile,MCP_ISSUER:ISSUER,MCP_TOKEN_SECRET:'kurz'},{log:()=>{}}),/MCP_TOKEN_SECRET/);
 const {close,port}=await startMcpHttp({MCP_DATABASE_FILE:f.file,MCP_CUSTOMERS_FILE:f.customersFile,MCP_ISSUER:ISSUER,MCP_TOKEN_SECRET:SECRET,MCP_PORT:'0'},{log:()=>{}});
 const r=await fetch(`http://127.0.0.1:${port}/mcp`,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+KEY},body:JSON.stringify(call('reports_regions'))});
 assert.equal(r.status,200);
 assert.deepEqual((await r.json()).result.structuredContent.regions.map(x=>x.id),['billerbeck']);
 await close();
 for(const file of ['server/node/mcp-http-server.mjs','server/mcp/http.mjs','server/mcp/customers.mjs','server/mcp/tokens.mjs','scripts/mcp-http.mjs'])
  assert.ok(!fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').includes('ACCOUNTS'),file);
});
