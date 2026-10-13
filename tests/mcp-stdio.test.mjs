import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {applyMigrations} from '../scripts/node-migrate.mjs';
import {loadMcpConfig,openMcpRuntime} from '../server/node/mcp-runtime.mjs';

const cwd=fileURLToPath(new URL('..',import.meta.url));
const source='Die Verwaltung plant eine barrierefreie Erneuerung des Eingangsbereichs. Die bestehende Rampe wird ersetzt und der Zugang verbreitert. Der Vorschlag soll zuerst im zustaendigen Ausschuss beraten werden. Eine Entscheidung des Rates liegt noch nicht vor.';
const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');

function fixture(t) {
  const directory=mkdtempSync(join(tmpdir(),'ratsmonitor-mcp-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const file=join(directory,'reports.sqlite'),sql=new DatabaseSync(file);
  applyMigrations(sql,resolve(cwd,'drizzle'),{log:()=>{}});
  for (const [id,regionId] of [['mcp-one','billerbeck'],['mcp-other','muenster']]) {
    const topic={id,regionId,title:'Barrierefreier Zugang',officialTitle:'Barrierefreier Zugang',status:'consulting',eventDate:'2026-10-13',documentText:source,events:[],documents:[],
      sourceUrl:'https://example.test/vorlage',ruleSummary:{version:3,long:{sentences:['Vorhandener Regeltext bleibt unveraendert.']}}};
    sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)')
      .run(id,regionId,'city','2026-10-13','2026-10-13','consulting',JSON.stringify(topic));
  }
  sql.close();
  const files={};
  for (const mode of ['internal','customer']) {
    files[mode]=join(directory,mode+'.json');
    writeFileSync(files[mode],JSON.stringify({mode,identity:'test-'+mode,databaseFile:'reports.sqlite',
      ...(mode==='internal'?{sourceDirectory:'pdf-store'}:{allowedRegionIds:['billerbeck']})}));
  }
  return {directory,file,files};
}

async function connect(mode,config) {
  const transport=new StdioClientTransport({command:process.execPath,args:[resolve(cwd,`scripts/mcp-${mode}.mjs`),'--config',config],cwd,stderr:'pipe'});
  let stderr='';
  transport.stderr?.on('data',chunk=>{stderr+=chunk;});
  const client=new Client({name:'ratsmonitor-integration-test',version:'1.0.0'});
  try { await client.connect(transport); }
  catch(error) { await transport.close();throw new Error(`MCP connection failed: ${error.message}; ${stderr}`); }
  return {client,stderr:()=>stderr,close:()=>client.close(),call:async(name,args={})=>{
    const response=await client.callTool({name,arguments:args});
    return {response,data:response.structuredContent||JSON.parse(response.content[0].text)};
  }};
}

test('MCP config is explicit, role-bound, strict and relative to the config file',async t=>{
  const f=fixture(t);
  assert.equal(loadMcpConfig('customer',f.files.customer).databaseFile,f.file);
  assert.throws(()=>loadMcpConfig('customer'),/Konfiguration/);
  assert.throws(()=>loadMcpConfig('customer',f.files.internal),/passt nicht/);
  assert.throws(()=>loadMcpConfig('internal',f.files.customer),/passt nicht/);
  assert.throws(()=>loadMcpConfig('admin',f.files.customer),/Unbekannter/);
  for (const patch of [{allowedRegionIds:[]},{allowedRegionIds:['does-not-exist']},{mode:'internal'},{databaseFile:'missing.sqlite'},{sql:'SELECT 1'},{sourceDirectory:'secret'}]) {
    const file=join(f.directory,'invalid.json');
    writeFileSync(file,JSON.stringify({...JSON.parse(readFileSync(f.files.customer,'utf8')),...patch}));
    await assert.rejects(openMcpRuntime('customer',file));
  }
  assert.equal(readdirSync(f.directory).includes('missing.sqlite'),false);
});

test('MCP startup never migrates an old database or leaks its path',async t=>{
  const f=fixture(t),file=join(f.directory,'old.sqlite');
  const old=new DatabaseSync(file);old.exec('CREATE TABLE topics(id TEXT)');old.close();
  const config=join(f.directory,'old.json');
  writeFileSync(config,JSON.stringify({mode:'internal',identity:'old-test',databaseFile:'old.sqlite',sourceDirectory:'pdf-store'}));
  const before=digest(file);
  const result=spawnSync(process.execPath,['scripts/mcp-internal.mjs','--config',config],{cwd,encoding:'utf8',timeout:15000});
  assert.equal(result.status,1);assert.equal(result.stdout,'');
  assert.match(result.stderr,/migriert keine Datenbank/);assert.ok(!result.stderr.includes(f.directory));
  assert.equal(digest(file),before);
  assert.deepEqual(readdirSync(f.directory).filter(name=>name.startsWith('old.sqlite')),['old.sqlite']);
});

test('real STDIO roundtrip saves all three outputs internally and customer access remains read-only and scoped',{timeout:45000},async t=>{
  const f=fixture(t),internal=await connect('internal',f.files.internal);
  let claim;
  try {
    const tools=await internal.client.listTools();
    assert.equal(tools.tools.length,7);assert.ok(tools.tools.every(tool=>tool.name.startsWith('ai_')));
    const listing=await internal.call('ai_list',{regions:['billerbeck']});
    assert.ok(listing.data.items.some(row=>row.id==='mcp-one'));
    ({claimed:[claim]}=(await internal.call('ai_claim',{ids:['mcp-one'],agent:'MCP-Test'})).data);
    assert.ok(claim?.token);
    const args={id:claim.id,token:claim.token};
    const manifest=(await internal.call('ai_read',args)).data;
    for (const stored of manifest.sources) for (const page of stored.pages) {
      let offset=0;
      do { const read=(await internal.call('ai_read',{...args,sourceId:stored.id,page:page.number,offset})).data;offset=read.source.nextOffset; } while(offset!==null);
    }
    const result={agent:'MCP-Test',model:'unknown',shortSummary:'Die Verwaltung plant einen barrierefreien Zugang.',longSummary:[source],coveredSourceIds:manifest.sources.map(item=>item.id),
      evidence:[{sourceId:manifest.sources[0].id,page:1,quote:'Die bestehende Rampe wird ersetzt und der Zugang verbreitert.'}],
      aiLabel:{primary:manifest.labelCatalog[0].id,secondary:[],reason:'Einordnung fuer den Integrationstest.'},checks:['source_read','process','numbers','neutrality'].map(name=>({name,passed:true}))};
    const saved=await internal.call('ai_submit',{...args,inputHash:claim.inputHash,result});
    assert.equal(saved.response.isError,undefined);assert.equal(saved.data.state,'completed');
  } finally { await internal.close(); }
  assert.ok(!internal.stderr().includes(claim.token));assert.ok(!internal.stderr().includes(source));
  const before=digest(f.file),customer=await connect('customer',f.files.customer);
  try {
    const tools=await customer.client.listTools();
    assert.deepEqual(tools.tools.map(tool=>tool.name).sort(),['reports_aggregate','reports_get','reports_regions','reports_search']);
    assert.ok(tools.tools.every(tool=>tool.annotations.readOnlyHint));
    const found=await customer.call('reports_search',{from:'2026-10-01',to:'2026-10-31'});
    assert.equal(found.response.isError,undefined);assert.equal(found.data.reports.length,1);
    const detail=await customer.call('reports_get',{id:'mcp-one'});
    assert.equal(detail.response.isError,undefined);
    const serialized=JSON.stringify(detail.data);
    assert.ok(serialized.includes('Die Verwaltung plant einen barrierefreien Zugang.'));
    assert.ok(serialized.includes('Vorhandener Regeltext bleibt unveraendert.'));
    assert.ok(!serialized.includes('claim_token'));assert.ok(!serialized.includes(claim.token));
    const denied=await customer.call('reports_get',{id:'mcp-other'});
    const missing=await customer.call('reports_get',{id:'no-such-report'});
    assert.equal(denied.response.isError,true);assert.deepEqual(denied.data,missing.data);
    const attempted=await customer.client.callTool({name:'ai_claim',arguments:{ids:['mcp-one'],agent:'customer'}});
    assert.equal(attempted.isError,true);
  } finally { await customer.close(); }
  assert.equal(digest(f.file),before);
  const readonly=new DatabaseSync(f.file,{readOnly:true});
  try {
    assert.equal(readonly.prepare('SELECT count(*) n FROM article_analyses').get().n,3);
    assert.equal(readonly.prepare('SELECT count(*) n FROM article_versions').get().n,1);
  } finally { readonly.close(); }
});
