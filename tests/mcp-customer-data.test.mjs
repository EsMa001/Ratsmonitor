import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openD1} from '../server/node/d1-sqlite.mjs';
import {createCustomerData} from '../server/integrations/mcp-customer-data.mjs';

const WINDOW={from:'2026-01-01',to:'2026-12-31'};
const topic = (overrides={}) => ({id:'report',regionId:'billerbeck',source:'city',title:'Radverkehr und Haushalt',officialTitle:'Radverkehr und Haushalt',
  status:'approved',eventDate:'2026-09-12',updatedAt:'2026-09-13T12:00:00Z',shortSummary:'Eine neue Radverbindung wird geplant.',committee:'Rat',
  longSummary:['Die Verwaltung plant den Bau eines Radweges.'],sourceUrl:'https://example.org/report',documents:[],events:[],
  classification:{primary:'mobilitaet',secondary:[],version:'labels-v2',method:'title-rules-v3',evidence:'Radverkehr und Haushalt'},...overrides});

function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rm-mcp-customer-')),file=path.join(dir,'data.sqlite'),raw=new DatabaseSync(file);
  for (const name of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort()) raw.exec(fs.readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
  const db=openD1(file,{readOnly:true});
  t.after(()=>{db.close();raw.close();fs.rmSync(dir,{recursive:true,force:true});});
  const put=raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
  const add=value=>put.run(value.id,value.regionId,value.source,value.eventDate,value.updatedAt,value.status,JSON.stringify(value));
  const service=(options={})=>createCustomerData(db,{customerId:'customer-a',allowedRegionIds:['billerbeck'],...options});
  return {raw,db,add,service};
}

test('customer configuration fails closed and captures an immutable explicit allowlist',async t=>{
  const f=fixture(t);
  for (const options of [{allowedRegionIds:[]},{allowedRegionIds:['invented']},{customerId:''},{allowSourceText:true}]) assert.throws(()=>f.service(options));
  const ids=['billerbeck'],service=f.service({allowedRegionIds:ids});ids.push('muenster');
  assert.deepEqual((await service.listRegions()).regions.map(r=>r.id),['billerbeck']);
  await assert.rejects(service.listRegions({customerId:'other'}));
});

test('search, get and aggregate intersect requested regions with grants and hide inactive reports',async t=>{
  const f=fixture(t);f.add(topic());f.add(topic({id:'outside',regionId:'muenster'}));
  f.add(topic({id:'merged',identity:{mergedInto:'report'}}));
  f.add(topic({id:'old',eventDate:'2020-01-01'}));
  const service=f.service(),search=await service.searchReports({...WINDOW,regionIds:['billerbeck','muenster']});
  assert.deepEqual(search.reports.map(r=>r.id),['report']);
  assert.deepEqual(search.scope.regionIds,['billerbeck']);
  assert.equal(search.reports[0].shortSummaryKind,'source_overview');
  assert.equal((await service.aggregateReports({...WINDOW,groupBy:'region'})).totalMatched,1);
  assert.deepEqual((await service.searchReports({...WINDOW,regionIds:['muenster']})).reports,[]);
  assert.deepEqual((await service.searchReports({...WINDOW,regionIds:[]})).reports,[]);
  const messages=[];
  for (const id of ['outside','merged','missing']) {
    try { await service.getReport({id});assert.fail('Must not expose inaccessible report'); } catch(error) { messages.push([error.code,error.message]); }
  }
  assert.deepEqual(messages,[['NOT_FOUND','Report not found.'],['NOT_FOUND','Report not found.'],['NOT_FOUND','Report not found.']]);
  assert.equal((await service.getReport({id:'old'})).id,'old','ID detail is not constrained to the search date window');
});

test('unknown or mismatched region rows cannot bypass the allowlist via an index row',async t=>{
  const f=fixture(t);f.add(topic({id:'unknown',regionId:'not-in-catalog'}));f.add(topic({id:'outside',regionId:'muenster'}));
  f.raw.prepare("UPDATE search_cards SET region_id='billerbeck' WHERE id='outside'").run();
  const service=f.service();
  assert.deepEqual((await service.searchReports(WINDOW)).reports,[]);
  assert.equal((await service.aggregateReports({...WINDOW,groupBy:'region'})).totalMatched,0);
  await assert.rejects(service.getReport({id:'outside'}),{code:'NOT_FOUND'});
});

test('search terms are literal AND substrings over short indexed text, with bounded strict dates and inputs',async t=>{
  const f=fixture(t);f.add(topic({longSummary:['Geheimlangtext wird nicht indexiert.']}));const service=f.service();
  assert.equal((await service.searchReports({...WINDOW,query:'RAD Haushalt'})).reports.length,1);
  for (const query of ['Geheimlangtext',"' OR 1=1 --",'%','_']) assert.equal((await service.searchReports({...WINDOW,query})).reports.length,0);
  for (const input of [{query:'x'.repeat(201)},{query:Array(13).fill('a').join(' ')},{limit:101},{limit:1.5},{from:'2026-02-30'},
    {from:'2025-01-01',to:'2026-12-31'},{from:'2026-12-31',to:'2026-01-01'},{to:'now'},{regionIds:'billerbeck'},
    {label:'unknown'},{status:'invented'},{sql:'SELECT * FROM topics'},{allowSourceText:true},{customerId:'other'}]) {
    await assert.rejects(service.searchReports({...WINDOW,...input}),{code:'INVALID_INPUT'});
  }
  const defaults=(await service.searchReports()).scope;
  assert.equal(defaults.to,new Date().toISOString().slice(0,10));
  assert.ok((Date.parse(defaults.to)-Date.parse(defaults.from))/86400000 < 366);
});

test('keyset cursors preserve ordering, bind scope and reject tampering and reuse by another service',async t=>{
  const f=fixture(t);for (const [id,eventDate] of [['a','2026-09-12'],['b','2026-09-12'],['c','2026-09-11']]) f.add(topic({id,eventDate}));
  const service=f.service(),first=await service.searchReports({...WINDOW,limit:1});
  assert.equal(first.reports[0].id,'a');assert.ok(first.nextCursor);
  const second=await service.searchReports({...WINDOW,limit:1,cursor:first.nextCursor});assert.equal(second.reports[0].id,'b');
  const last=await service.searchReports({...WINDOW,limit:1,cursor:second.nextCursor});assert.equal(last.reports[0].id,'c');assert.equal(last.nextCursor,null);
  await assert.rejects(service.searchReports({...WINDOW,cursor:first.nextCursor,query:'rad'}),{code:'INVALID_INPUT'});
  await assert.rejects(service.searchReports({...WINDOW,cursor:first.nextCursor.slice(0,-3)+'aaa'}),{code:'INVALID_INPUT'});
  await assert.rejects(f.service().searchReports({...WINDOW,cursor:first.nextCursor}),{code:'INVALID_INPUT'});
});

test('details strictly project public fields, distinguish AI and rule summaries and remove unsafe URLs',async t=>{
  const f=fixture(t),secret='INTERNAL_SECRET';
  f.add(topic({generatedBy:'KI-Zusammenfassung',shortSummary:'KI-Kurzfassung.',longSummary:['KI-Langfassung.'],sourceText:secret,documentText:secret,
    metadata:{token:secret},aiAttempts:{summary:{prompt:secret}},internalFilename:'C:\\private\\'+secret,
    contentAnalysis:{status:'completed',agent:secret,inputHash:secret,sourceDocuments:[{path:secret}],generatedAt:'2026-09-13T12:00:00Z',
      coverage:{total:2,available:1,missing:1,partial:0,complete:false,secret},reviewStatus:'not_independently_reviewed',
      evidence:[{quote:'Originalzitat.',url:'https://example.org/paper.pdf',page:3,paragraphIndex:0,token:secret},
        {quote:'Ohne oeffentlichen Link.',url:'file:///C:/private.pdf',page:4}]},
    ruleSummary:{short:{sentences:['Regel-Kurzfassung.']},long:{sentences:['Regel-Langfassung.']},generatedAt:'2026-09-12T12:00:00Z',token:secret},
    documents:[{title:'Vorlage',url:'https://example.org/paper.pdf',kind:'application/pdf',localPath:secret},
      {url:'javascript:alert(1)'},{url:'http://localhost/doc'},{url:'http://127.0.0.1/doc'},{url:'https://user:pass@example.org/doc'},
      {url:'https://example.org/doc?access_token='+secret},{url:'file:///C:/private.pdf'}],
    events:[{date:'2026-09-12',committee:'Rat',status:'approved',url:'https://example.org/meeting',attendance:{people:[{name:secret}]},secret}]}));
  const result=await f.service().getReport({id:'report'}),serialized=JSON.stringify(result);
  assert.equal(result.summaries.ai.short,'KI-Kurzfassung.');assert.equal(result.shortSummaryKind,'ai');
  assert.deepEqual(result.summaries.rule.short,['Regel-Kurzfassung.']);assert.equal(result.summaries.ai.coverage.complete,false);
  assert.equal(result.summaries.ai.evidence[0].page,3);assert.equal(result.summaries.ai.evidence[1].url,null);
  assert.equal(result.documents.length,1);assert.equal(result.rawSourceTextAvailable,false);
  assert.ok(!serialized.includes(secret));assert.ok(!serialized.includes('file:'));assert.ok(!serialized.includes('javascript:'));
  for (const key of ['contentAnalysis','metadata','aiAttempts','sourceText','documentText']) assert.equal(Object.hasOwn(result,key),false);
});

test('projection tolerates sparse summaries and bounds large public text arrays',async t=>{
  const f=fixture(t);f.add(topic({ruleSummary:{long:{sentences:['Only a long rule summary.']}}}));
  assert.deepEqual((await f.service().getReport({id:'report'})).summaries.rule.short,[]);
  f.add(topic({id:'large',generatedBy:'KI-Zusammenfassung',longSummary:Array(25).fill('x'.repeat(8100)),documents:Array(101).fill({url:'https://example.org/doc'})}));
  const result=await f.service().getReport({id:'large'});
  assert.equal(result.summaries.ai.paragraphs.length,24);assert.equal(result.summaries.ai.paragraphs[0].length,8000);
  assert.equal(result.summaries.ai.truncated,true);assert.equal(result.documents.length,100);assert.equal(result.documentsTruncated,true);
  f.add(topic({id:'rule-large',ruleSummary:{short:{sentences:['s'.repeat(1201)]},long:{sentences:['l'.repeat(2001)]}}}));
  const rule=(await f.service().getReport({id:'rule-large'})).summaries.rule;
  assert.equal(rule.short[0].length,1200);assert.equal(rule.paragraphs[0].length,2000);assert.equal(rule.truncated,true);
});

test('aggregates count canonical records, retain the exact filtered total when groups are limited and explain coverage',async t=>{
  const f=fixture(t);f.add(topic());f.add(topic({id:'b',eventDate:'2026-08-11',status:'consulting'}));f.add(topic({id:'c',eventDate:'2026-07-11'}));
  const service=f.service(),result=await service.aggregateReports({...WINDOW,groupBy:'month',limit:1});
  assert.equal(result.totalMatched,3);assert.equal(result.groups.length,1);assert.equal(result.hasMoreGroups,true);
  assert.match(result.coverageNote,/canonical reports/u);assert.equal(result.scope.dateField,'searchDate');
  assert.equal((await service.aggregateReports({...WINDOW,groupBy:'status',status:'approved'})).totalMatched,2);
  assert.equal((await service.aggregateReports({...WINDOW,groupBy:'label',label:'mobilitaet'})).totalMatched,3);
  assert.equal((await service.aggregateReports({...WINDOW,groupBy:'month',query:'nonexistent'})).totalMatched,0);
  for (const input of [{groupBy:'payload'},{groupBy:'region',cursor:'x'},{groupBy:'region',regionIds:['muenster'],sql:'SELECT 1'}]) await assert.rejects(service.aggregateReports({...WINDOW,...input}),{code:'INVALID_INPUT'});
});

test('all customer methods operate on a genuinely read-only database and cannot change it',async t=>{
  const f=fixture(t);f.add(topic());const before=f.raw.prepare('SELECT total_changes() AS n').get().n,service=f.service();
  await service.listRegions();await service.searchReports(WINDOW);await service.getReport({id:'report'});await service.aggregateReports({...WINDOW,groupBy:'region'});
  assert.equal(f.raw.prepare('SELECT total_changes() AS n').get().n,before);
  await assert.rejects(f.db.prepare('DELETE FROM topics').run(),/readonly/u);
  assert.equal(f.raw.prepare('SELECT count(*) AS n FROM topics').get().n,1);
});

test('search materializes only the bounded page before reading payloads and aggregates use the inactive index without JSON parsing',async t=>{
  const f=fixture(t);f.add(topic());
  const queries=[],db={prepare(sql){return {bind(...args){queries.push({sql,args});return f.db.prepare(sql).bind(...args);}};}};
  const service=createCustomerData(db,{customerId:'customer-a',allowedRegionIds:['billerbeck']});
  await service.searchReports({...WINDOW,limit:1});await service.aggregateReports({...WINDOW,groupBy:'region'});
  const [search,aggregate]=queries;
  const page=search.sql.slice(0,search.sql.indexOf(') SELECT'));
  assert.match(page,/WITH page AS MATERIALIZED/u);assert.match(page,/ORDER BY sc.date DESC,sc.id ASC LIMIT \?/u);
  assert.equal(search.args.at(-1),2);
  assert.doesNotMatch(page,/payload|json_extract/iu);
  assert.match(search.sql,/\) SELECT[\s\S]+json_extract\(t.payload[\s\S]+FROM page sc JOIN topics t/u);
  assert.doesNotMatch(aggregate.sql,/payload|json_extract/iu);
  for (const query of queries) {
    const plan=f.raw.prepare('EXPLAIN QUERY PLAN '+query.sql).all(...query.args).map(row=>row.detail).join('\n');
    assert.match(plan,/SEARCH inactive USING INDEX idx_topics_inactive \(id=\?\)/u);
    assert.match(plan,/SEARCH canonical(?: EXISTS)? USING INDEX sqlite_autoindex_topics_1 \(id=\?\)/u);
    if (query === search) assert.match(plan,/MATERIALIZE page/u);
  }
});
