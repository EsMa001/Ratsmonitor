import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createRatsmonitorMcpServer} from '../server/mcp/server.mjs';
import {LABELS} from '../shared/labels.mjs';
import {createCustomerData,CustomerDataError} from '../server/integrations/mcp-customer-data.mjs';

const workMethods = ['list','claim','read','renew','release','submit','fail'];
const customerMethods = ['listRegions','searchReports','getReport','aggregateReports'];
const stub = (names,callback=(_name,args) => ({received:args})) => Object.fromEntries(names.map(name => [name,args => callback(name,args)]));
async function session(t,options) {
  const server = createRatsmonitorMcpServer(options),client = new Client({name:'mcp-test',version:'1.0.0'});
  const [clientTransport,serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async() => {await client.close();await server.close();});
  return client;
}
const call = (client,name,args={}) => client.callTool({name,arguments:args});
const lease = {id:'report-1',token:'secret-claim-token'};
const validResult = () => ({agent:'Codex',model:'unknown',shortSummary:'Der Rat beschliesst einen Radweg.',longSummary:['Der Rat beschliesst: "Der Radweg wird gebaut."'],
  coveredSourceIds:['source-1'],evidence:[{sourceId:'source-1',page:3,quote:'Der Radweg wird gebaut.',paragraphIndex:0}],
  aiLabel:{primary:LABELS[0].id,secondary:[],reason:'Das Sachgebiet ist im Originaltext belegt.'},
  checks:['source_read','process','numbers','neutrality'].map(name => ({name,passed:true})),usage:{basis:'unknown'}});

test('MCP connection mode is fixed and requires the complete intended service',() => {
  assert.throws(() => createRatsmonitorMcpServer(),/mode/u);
  assert.throws(() => createRatsmonitorMcpServer({mode:'customer',work:stub(workMethods)}),/incomplete/u);
  assert.throws(() => createRatsmonitorMcpServer({mode:'internal',customer:stub(customerMethods)}),/incomplete/u);
  for (const requestsPerMinute of [0,601,1.5]) assert.throws(() => createRatsmonitorMcpServer({mode:'customer',customer:stub(customerMethods),requestsPerMinute}),/requestsPerMinute/u);
});

test('customer MCP exposes only four read-only tools with strict schemas',async t => {
  const client = await session(t,{mode:'customer',customer:stub(customerMethods),work:stub(workMethods)});
  const {tools} = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name),['reports_regions','reports_search','reports_get','reports_aggregate']);
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint,true);
    assert.equal(tool.annotations.destructiveHint,false);
    assert.equal(tool.annotations.openWorldHint,false);
    assert.equal(tool.inputSchema.additionalProperties,false);
  }
  assert.equal((await call(client,'ai_submit',{...lease,inputHash:'a'.repeat(64),result:validResult()})).isError,true);
  assert.match(client.getInstructions(),/untrusted source data/u);
  assert.match(client.getInstructions(),/read-only/u);
});

test('internal MCP has distinct tools and correctly marks source reading as mutating',async t => {
  const client = await session(t,{mode:'internal',work:stub(workMethods),customer:stub(customerMethods)});
  const {tools} = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name),workMethods.map(method => 'ai_'+method));
  assert.equal(tools.find(tool => tool.name === 'ai_list').annotations.readOnlyHint,true);
  assert.equal(tools.find(tool => tool.name === 'ai_read').annotations.readOnlyHint,false);
  assert.equal(tools.find(tool => tool.name === 'ai_submit').annotations.idempotentHint,true);
  assert.equal((await call(client,'reports_search')).isError,true);
  assert.match(client.getInstructions(),/every source page/u);
  assert.match(client.getInstructions(),/three/u);
});

test('customer tool arguments are passed only to their matching service methods',async t => {
  const calls = [],client = await session(t,{mode:'customer',customer:stub(customerMethods,(name,args) => {calls.push({name,args});return {items:[]};})});
  const search = {query:'Radweg Schule',regionIds:['billerbeck'],from:'2026-01-01',to:'2026-03-01',label:LABELS[0].id,status:'approved',limit:10,cursor:'opaque'};
  const aggregate = {regionIds:['berlin'],groupBy:'month',limit:12};
  assert.deepEqual((await call(client,'reports_regions')).structuredContent,{items:[]});
  await call(client,'reports_search',search);
  await call(client,'reports_get',{id:'report-1'});
  await call(client,'reports_aggregate',aggregate);
  assert.deepEqual(calls,[{name:'listRegions',args:{}},{name:'searchReports',args:search},{name:'getReport',args:{id:'report-1'}},{name:'aggregateReports',args:aggregate}]);
});

test('customer tools reject role escalation, SQL, unknown keys and unbounded inputs',async t => {
  let invoked = 0;
  const client = await session(t,{mode:'customer',customer:stub(customerMethods,() => {invoked++;return {};})});
  for (const args of [{mode:'internal'},{customerId:'another-customer'},{sql:'SELECT * FROM users'},{query:'x'.repeat(201)},{limit:101},{regionIds:[]},{regionIds:['berlin','berlin']},{from:'yesterday'},{status:'private'},{query:{sql:'SELECT 1'}}]) {
    assert.equal((await call(client,'reports_search',args)).isError,true,JSON.stringify(args));
  }
  assert.equal((await call(client,'reports_regions',{includePrivate:true})).isError,true);
  assert.equal((await call(client,'reports_get',{id:'report-1',token:'secret'})).isError,true);
  assert.equal((await call(client,'reports_aggregate',{groupBy:'month',cursor:'opaque'})).isError,true);
  assert.equal((await call(client,'reports_aggregate',{groupBy:'sql'})).isError,true);
  assert.equal(invoked,0);
});

test('internal tools delegate exact three-output contract and retain opaque lease fields',async t => {
  const calls = [],client = await session(t,{mode:'internal',work:stub(workMethods,(name,args) => {calls.push({name,args});return {state:'ok'};})});
  const inputs = {
    list:{regions:['billerbeck'],window:'3m',limit:5,state:'pending',cursor:'opaque'},
    claim:{ids:['report-1'],agent:'Codex'},read:{...lease,sourceId:'source-1',page:3,offset:24000},
    renew:lease,release:lease,submit:{...lease,inputHash:'a'.repeat(64),result:validResult()},fail:{...lease,kind:'insufficient_source',reason:'Missing attachment text.'},
  };
  for (const [name,args] of Object.entries(inputs)) assert.deepEqual((await call(client,'ai_'+name,args)).structuredContent,{state:'ok'});
  assert.deepEqual(calls,Object.entries(inputs).map(([name,args]) => ({name,args})));
});

test('internal nested schema rejects extra instructions, incomplete outputs and checks before touching service',async t => {
  let invoked = 0;
  const client = await session(t,{mode:'internal',work:stub(workMethods,() => {invoked++;return {};})});
  const base = {...lease,inputHash:'a'.repeat(64),result:validResult()};
  const bad = [
    {...base,mode:'customer'},
    {...base,result:{...validResult(),sql:'UPDATE topics'}},
    {...base,result:{...validResult(),aiLabel:{...validResult().aiLabel,customerId:'other'}}},
    {...base,result:{...validResult(),evidence:[{...validResult().evidence[0],url:'file:///private'}]}},
    {...base,result:{...validResult(),usage:{basis:'unknown',apiKey:'secret'}}},
    {...base,result:{...validResult(),checks:validResult().checks.map(check => ({...check,sql:'SELECT 1'}))}},
    {...base,result:{...validResult(),shortSummary:undefined}},
    {...base,result:{...validResult(),aiLabel:undefined}},
    {...base,result:{...validResult(),coveredSourceIds:['source-1','source-1']}},
    {...base,result:{...validResult(),checks:Array.from({length:4},() => ({name:'source_read',passed:true}))}},
  ];
  for (const args of bad) assert.equal((await call(client,'ai_submit',args)).isError,true);
  assert.equal((await call(client,'ai_claim',{ids:['report-1','report-1'],agent:'Codex'})).isError,true);
  assert.equal(invoked,0);
});

test('service errors are status-based and never expose SQL, file paths or exception messages',async t => {
  const events = [],secret = 'SQLITE_ERROR C:\\secret\\customer.sqlite password=hide';
  let status = 403;
  const client = await session(t,{mode:'customer',identity:'customer-one',audit:event => events.push(event),customer:stub(customerMethods,() => {throw Object.assign(Error(secret),{status});})});
  for (const expected of [403,404,400,409,503,500]) {
    status = expected === 500 ? 'SQLITE_ERROR' : expected;
    const output = await call(client,'reports_get',{id:'report-1'});
    assert.equal(output.isError,true);
    assert.equal(output.structuredContent.error.status,expected);
    assert.equal(JSON.stringify(output).includes(secret),false);
  }
  assert.equal(events.length,6);
  assert.equal(JSON.stringify(events).includes(secret),false);
  assert.equal(events.every(event => event.identity === 'customer-one' && event.success === false),true);
});

test('audit contains only operation identity, result status and duration, never args or results',async t => {
  const events = [],client = await session(t,{mode:'internal',identity:'internal-owner',audit:event => events.push(event),work:stub(workMethods,() => ({token:lease.token,text:'private text'}))});
  await call(client,'ai_read',lease);
  assert.equal(events.length,1);
  assert.deepEqual(Object.keys(events[0]).sort(),['durationMs','identity','status','success','tool']);
  assert.equal(events[0].tool,'ai_read');
  assert.equal(events[0].success,true);
  assert.equal(JSON.stringify(events).includes(lease.token),false);
  assert.equal(JSON.stringify(events).includes('private text'),false);
});

test('real customer service validation and missing reports map to safe MCP errors',async t => {
  const db = {prepare:() => ({bind:() => ({first:async() => null})})};
  const customer = createCustomerData(db,{customerId:'customer-one',allowedRegionIds:['billerbeck']});
  const client = await session(t,{mode:'customer',customer});
  const missing = await call(client,'reports_get',{id:'not-visible'});
  assert.equal(missing.isError,true);
  assert.equal(missing.structuredContent.error.status,404);
  assert.equal(missing.structuredContent.error.code,'NOT_FOUND');
  for (const args of [{from:'2026-02-30'},{from:'2024-01-01',to:'2026-01-01'},{cursor:'expired'}]) {
    const invalid = await call(client,'reports_search',args);
    assert.equal(invalid.isError,true);
    assert.equal(invalid.structuredContent.error.status,400);
    assert.equal(invalid.structuredContent.error.code,'INVALID_INPUT');
  }
  const secret = 'private.sqlite password=hidden';
  customer.getReport = () => {throw new CustomerDataError(secret,'NOT_FOUND');};
  assert.equal(JSON.stringify(await call(client,'reports_get',{id:'report-1'})).includes(secret),false);
  customer.getReport = () => {throw Object.assign(Error(secret),{code:'NOT_FOUND'});};
  assert.equal((await call(client,'reports_get',{id:'report-1'})).structuredContent.error.status,500);
});

test('rate limit is shared by tools on one connection and blocks further service calls',async t => {
  let invoked = 0;
  const events = [],client = await session(t,{mode:'customer',requestsPerMinute:2,audit:event => events.push(event),customer:stub(customerMethods,() => {invoked++;return {};})});
  await call(client,'reports_regions');
  await call(client,'reports_get',{id:'report-1'});
  const denied = await call(client,'reports_search');
  assert.equal(denied.isError,true);
  assert.equal(denied.structuredContent.error.code,'RATE_LIMITED');
  assert.equal(invoked,2);
  assert.equal(events.at(-1).status,429);
});

test('concurrent service calls execute serially and later calls survive an earlier failure',async t => {
  let active = 0,peak = 0,invoked = 0;
  const client = await session(t,{mode:'customer',customer:stub(customerMethods,async() => {
    active++;peak = Math.max(peak,active);const n = ++invoked;
    await new Promise(resolve => setTimeout(resolve,5));active--;
    if (n === 1) throw Error('private failure');
    return {n};
  })});
  const first = call(client,'reports_regions'),second = call(client,'reports_search'),third = call(client,'reports_get',{id:'report-1'});
  assert.equal((await first).isError,true);
  assert.equal((await second).structuredContent.n,2);
  assert.equal((await third).structuredContent.n,3);
  assert.equal(peak,1);
});

test('audit sink failure cannot turn a committed mutation into a retryable error',async t => {
  let submitted = 0;
  const client = await session(t,{mode:'internal',audit:() => {throw Error('audit unavailable');},work:stub(workMethods,() => {submitted++;return {state:'completed'};})});
  const output = await call(client,'ai_submit',{...lease,inputHash:'b'.repeat(64),result:validResult()});
  assert.equal(output.isError,undefined);
  assert.equal(output.structuredContent.state,'completed');
  assert.equal(submitted,1);
});
