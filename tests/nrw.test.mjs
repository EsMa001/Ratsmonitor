import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../shared/nrw-regions.json' with {type:'json'};
import map from '../public/geo/germany.json' with {type:'json'};
import {collectRegionalOparl} from '../server/integrations/oparl-regional.mjs';
import {buildAnalytics} from '../shared/analytics.mjs';
test('NRW contains all 396 municipalities and 31 districts, with unique official keys and valid parents',()=>{
 assert.equal(catalog.filter(r=>r.kind==='city').length,396);assert.equal(catalog.filter(r=>r.kind==='district').length,31);
 assert.equal(new Set(catalog.map(r=>r.ags)).size,427);assert.equal(new Set(catalog.map(r=>r.id)).size,427);
 for(const r of catalog){assert.ok(map.regions.some(g=>g.id===r.id&&g.kind===r.kind));if(r.district)assert.ok(catalog.some(d=>d.id===r.district&&d.kind==='district'))}
 assert.equal(catalog.find(r=>r.id==='billerbeck').district,'coesfeld');assert.equal(catalog.find(r=>r.id==='muenster').district,null);
});
test('unconnected NRW municipalities have null shares rather than zero activity',()=>{
 const d=buildAnalytics([],[],catalog,{region:'billerbeck',from:'2026-08-01',to:'2026-09-26',now:new Date('2026-09-26')});
 assert.equal(d.geography.length,427);assert.ok(d.geography.every(r=>r.share===null&&r.count===null&&r.partial));
});
test('generic OParl follows public agenda, groups papers and rejects private items and foreign hosts',async()=>{
 const origin='https://fixture.example',body={name:'Teststadt',id:origin+'/body',type:'https://schema.oparl.org/1.1/Body',meeting:origin+'/meetings'};
 const agenda=[{id:origin+'/a',public:true,name:'Schulbau',consultation:{paper:{id:origin+'/paper',name:'Schulbau'}}},{id:origin+'/private',public:false,name:'Privat'}];
 const getJson=async url=>{if(url===body.id)return body;if(url===body.meeting)return {data:[{id:origin+'/m',start:'2026-09-20T10:00:00Z',agendaItem:agenda}],links:{}};throw Error('unexpected URL '+url)};
 const r=await collectRegionalOparl({system:body.id,id:'test',name:'Teststadt',kind:'city'},{getJson,now:new Date('2026-09-26')});assert.equal(r.topics.length,1);assert.equal(r.topics[0].status,'unknown');assert.equal(r.topics[0].regionId,'test');
 const blocked=await collectRegionalOparl({system:body.id,id:'test',name:'Teststadt'}, {getJson:async()=>({...body,meeting:'https://other.example/list'})});assert.equal(blocked.topics.length,0);assert.equal(blocked.coverage.complete,false);assert.match(blocked.coverage.issues.join(' '),/außerhalb/);
});
test('explicit HTTP-to-HTTPS compatibility remains restricted to the verified source host',async()=>{
 const seen=[];const source={id:'test',system:'https://fixture.example/system',name:'Test',kind:'city',upgradeHttpLinks:true};
 const getJson=async url=>{seen.push(url);if(url.endsWith('/system'))return {name:'Test',type:'https://schema.oparl.org/1.1/Body',id:source.system,meeting:'http://fixture.example/meetings'};return {data:[],links:{}}};
 await collectRegionalOparl(source,{getJson});assert.ok(seen.some(u=>u.startsWith('https://fixture.example/meetings')),'the http list address is requested over https');assert.ok(seen.every(u=>u.startsWith('https://fixture.example/')));
 const blocked=await collectRegionalOparl(source,{getJson:async()=>({name:'Test',type:'https://schema.oparl.org/1.1/Body',meeting:'http://foreign.example/meetings'})});assert.match(blocked.coverage.issues.join(' '),/außerhalb/);
});
test('newest-first meeting lists are read from the start and end at the first page before the window',async()=>{
 // ALLRIS lists future meetings first; its last page holds meetings that are decades old.
 const now=new Date('2026-09-27T12:00:00Z'),root='https://fixture.example/';
 const meeting=(n,start)=>({id:root+'meeting/'+n,start:start+'T18:00:00+02:00',name:'Rat',agendaItem:[{id:root+'item/'+n,name:'Thema '+n,public:true,number:'Ö 1'}]});
 const pages={1:[meeting(1,'2027-03-01'),meeting(2,'2026-10-05'),meeting(3,'2026-09-20')],2:[meeting(4,'2026-09-10'),meeting(5,'2026-07-01'),meeting(6,'2026-06-01')],3:[meeting(7,'2026-05-01'),meeting(8,'2026-04-01')],4:[meeting(9,'2004-01-01')]};
 const seen=[];const getJson=async url=>{seen.push(url);
  if(url===root+'body')return {id:root+'body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:root+'meetings?page=1'};
  const page=Number(new URL(url).searchParams.get('page'));if(!pages[page])throw Error('unexpected '+url);
  return {data:pages[page],links:{self:url,last:root+'meetings?page=4',...(pages[page+1]?{next:root+'meetings?page='+(page+1)}:{}),...(page>1?{prev:root+'meetings?page='+(page-1)}:{})}};};
 const result=await collectRegionalOparl({system:root+'body',id:'test',name:'Teststadt',kind:'city'},{getJson,now,window:'1m'});
 // Pages 1 and 2 cover the month; page 2 still starts inside the window, page 3 lies before it and ends the scan.
 // One request tests the filter; this server ignores it, so the plain list is read.
 assert.deepEqual(seen.filter(u=>u.includes('meetings')&&!u.includes('modified_since')).map(u=>Number(new URL(u).searchParams.get('page'))),[1,2,3]);assert.equal(seen.filter(u=>u.includes('modified_since')).length,1);assert.equal(result.coverage.listStrategy,'forward');
 assert.equal(result.coverage.meetings,3);assert.deepEqual(result.topics.map(t=>t.title).sort(),['Thema 2','Thema 3','Thema 4']);
 assert.ok(!result.coverage.issues.some(i=>/Listenlimit|Ende der Sitzungsliste/.test(i)),result.coverage.issues.join(' | '));
});
test('oldest-first meeting lists are still read from their end',async()=>{
 const now=new Date('2026-09-27T12:00:00Z'),root='https://fixture.example/';
 const meeting=(n,start)=>({id:root+'meeting/'+n,start:start+'T18:00:00+02:00',name:'Rat',agendaItem:[{id:root+'item/'+n,name:'Thema '+n,public:true,number:'Ö 1'}]});
 const pages={1:[meeting(1,'2004-01-01'),meeting(2,'2005-01-01')],2:[meeting(3,'2026-09-10'),meeting(4,'2026-09-20')]};const seen=[];
 const getJson=async url=>{seen.push(url);if(url===root+'body')return {id:root+'body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:root+'meetings?page=1'};
  const page=Number(new URL(url).searchParams.get('page'));return {data:pages[page],links:{self:url,last:root+'meetings?page=2',...(page===1?{next:root+'meetings?page=2'}:{prev:root+'meetings?page=1'})}};};
 const result=await collectRegionalOparl({system:root+'body',id:'test',name:'Teststadt',kind:'city'},{getJson,now,window:'1m'});
 assert.equal(result.coverage.meetings,2);assert.deepEqual(seen.filter(u=>u.includes('meetings')&&!u.includes('modified_since')).map(u=>Number(new URL(u).searchParams.get('page'))),[1,2]);assert.equal(result.coverage.listStrategy,'end');
 // Both pages were read, so nothing of the list was skipped and no limitation is reported.
 assert.deepEqual(result.coverage.issues,[]);
});
test('a date-sorted list read from its end is followed until the window is covered; unsorted lists keep the page limit',async()=>{
 const now=new Date('2026-09-27T12:00:00Z'),root='https://fixture.example/';
 const meeting=(n,start)=>({id:root+'meeting/'+n,start:start+'T18:00:00+02:00',name:'Rat',agendaItem:[{id:root+'item/'+n,name:'Thema '+n,public:true,number:'Ö 1'}]});
 const run=async(pages,options={})=>{const seen=[];const last=Object.keys(pages).length;
  const getJson=async url=>{seen.push(url);if(url===root+'body')return {id:root+'body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:root+'meetings?page=1'};
   const page=Number(new URL(url).searchParams.get('page'));if(!pages[page])throw Error('unexpected '+url);
   return {data:pages[page],links:{self:url,last:root+'meetings?page='+last,...(page<last?{next:root+'meetings?page='+(page+1)}:{}),...(page>1?{prev:root+'meetings?page='+(page-1)}:{})}};};
  const result=await collectRegionalOparl({system:root+'body',id:'test',name:'Teststadt',kind:'city'},{getJson,now,window:'1m',...options});
  return {result,pages:seen.filter(u=>u.includes('meetings')&&!u.includes('modified_since')).map(u=>Number(new URL(u).searchParams.get('page')))};};
 // Ten pages, sorted by date. Future placeholder meetings fill the last eight pages: a fixed limit of two pages would never reach September.
 const sorted={1:[meeting(1,'2001-01-01'),meeting(2,'2001-02-01')],2:[meeting(3,'2026-09-05'),meeting(4,'2026-09-20')]};
 for(let p=3;p<=10;p++)sorted[p]=[meeting(p*10,'2027-0'+(p-2)+'-01'),meeting(p*10+1,'2027-0'+(p-2)+'-15')];
 let {result,pages}=await run(sorted,{maxPages:2});
 assert.deepEqual(pages,[1,10,9,8,7,6,5,4,3,2]);assert.equal(result.coverage.meetings,2);
 // Walking back arrived at the first page again: the whole list was read, so no limitation is reported.
 assert.deepEqual(result.coverage.issues,[]);
 // With one more old page before the window the scan ends there and the limitation note is withdrawn.
 const covered={1:[meeting(1,'2001-01-01'),meeting(2,'2001-02-01')],2:[meeting(3,'2026-03-01'),meeting(4,'2026-04-01')],3:[meeting(5,'2026-09-05'),meeting(6,'2026-09-20')],4:[meeting(7,'2026-10-01'),meeting(8,'2027-01-01')]};
 ({result,pages}=await run(covered,{maxPages:2}));
 assert.deepEqual(pages,[1,4,3,2]);assert.equal(result.coverage.meetings,3);assert.deepEqual(result.coverage.issues,[]);assert.equal(result.coverage.complete,true);
 // Not sorted by date: no early stop, the fixed page limit and both notes stay.
 const unsorted={1:[meeting(1,'2001-01-01'),meeting(2,'2001-02-01')],2:[meeting(3,'2026-09-05'),meeting(4,'2026-03-01')],3:[meeting(5,'2026-09-20'),meeting(6,'2026-01-01')],4:[meeting(7,'2026-02-01'),meeting(8,'2026-09-10')]};
 ({result,pages}=await run(unsorted,{maxPages:3}));
 assert.deepEqual(pages,[1,4,3]);assert.ok(result.coverage.issues.some(i=>/Ende der Sitzungsliste/.test(i)));assert.ok(result.coverage.issues.some(i=>/Listenlimit/.test(i)));
});
test('a server that honours the OParl filter modified_since is asked only for recently changed meetings',async()=>{
 // SD.NET orders its list by record number and fills the last pages with next year's planned meetings.
 // Reading from the end would miss the meetings of last week; the filter returns exactly the changed ones.
 const now=new Date('2026-09-27T12:00:00Z'),root='https://fixture.example/';
 const meeting=(n,start,modified)=>({id:root+'meeting/'+n,start:start+'T18:00:00+02:00',modified,name:'Rat',agendaItem:[{id:root+'item/'+n,name:'Thema '+n,public:true,number:'Ö 1'}]});
 const all=[meeting(1,'2008-01-08','2008-02-01T10:00:00+01:00'),meeting(2,'2026-09-22','2026-09-23T10:00:00+02:00'),meeting(3,'2027-03-01','2025-11-01T10:00:00+01:00'),meeting(4,'2027-06-01','2025-11-01T10:00:00+01:00'),meeting(5,'2026-09-24','2026-09-10T10:00:00+02:00'),meeting(6,'2026-10-06','2026-09-25T10:00:00+02:00')];
 const seen=[];const getJson=async url=>{seen.push(url);
  if(url===root+'body')return {id:root+'body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:root+'meetings'};
  const u=new URL(url),since=u.searchParams.get('modified_since'),page=Number(u.searchParams.get('page')||1);
  const rows=since?all.filter(m=>Date.parse(m.modified)>=Date.parse(since)):all,size=2,pages=Math.max(1,Math.ceil(rows.length/size));
  const link=n=>root+'meetings?page='+n+(since?'&modified_since='+encodeURIComponent(since):'');
  if(!rows.length)return [];
  return {data:rows.slice((page-1)*size,page*size),links:{self:link(page),last:link(pages),...(page<pages?{next:link(page+1)}:{}),...(page>1?{prev:link(page-1)}:{})}};};
 const result=await collectRegionalOparl({system:root+'body',id:'test',name:'Teststadt',kind:'city'},{getJson,now,window:'1w',maxPages:1});
 const requests=seen.filter(u=>u.includes('meetings'));
 assert.equal(requests.length,3);assert.ok(requests.every(u=>u.includes('modified_since')),'the plain list is never requested');
 assert.match(requests[0],/modified_since=2100-01-01/);assert.match(requests[1],/modified_since=2026-08-20T12%3A00%3A00%2B00%3A00$/);
 // Changed since 20 August: meetings 2, 5 and 6. The window (one week back, next month ahead) keeps 2, 5 and 6.
 assert.deepEqual(result.topics.map(t=>t.title).sort(),['Thema 2','Thema 5','Thema 6']);assert.deepEqual(result.coverage.issues,[]);assert.equal(result.coverage.complete,true);assert.equal(result.coverage.listStrategy,'filter');
 // No change since the margin: a quiet period, not a failure.
 const quiet=await collectRegionalOparl({system:root+'body',id:'test',name:'Teststadt',kind:'city'},{now:new Date('2028-06-01T12:00:00Z'),window:'1w',getJson});
 assert.equal(quiet.coverage.quiet,true);assert.equal(quiet.topics.length,0);
 // The catalog can fix the verified method: forward or end reading never asks for the filter …
 for(const meetingScan of ['forward','end']){seen.length=0;const fixed=await collectRegionalOparl({system:root+'body',id:'test',name:'Teststadt',kind:'city',meetingScan},{getJson,now,window:'1w'});assert.ok(seen.every(u=>!u.includes('modified_since')),meetingScan);assert.equal(fixed.coverage.listStrategy,meetingScan);}
 // … and a fixed filter skips the test request.
 seen.length=0;const pinned=await collectRegionalOparl({system:root+'body',id:'test',name:'Teststadt',kind:'city',meetingScan:'filter'},{getJson,now,window:'1w'});
 assert.ok(seen.filter(u=>u.includes('meetings')).every(u=>/modified_since=2026/.test(u)));assert.deepEqual(pinned.topics.map(t=>t.title).sort(),['Thema 2','Thema 5','Thema 6']);
});
test('a server that refuses the filter request is read through its plain list',async()=>{
 const now=new Date('2026-09-27T12:00:00Z'),root='https://fixture.example/';
 const getJson=async url=>{if(url===root+'body')return {id:root+'body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:root+'meetings'};
  if(url.includes('modified_since'))throw Error('OParl HTTP 400');
  return {data:[{id:root+'meeting/1',start:'2026-09-22T18:00:00+02:00',name:'Rat',agendaItem:[{id:root+'item/1',name:'Thema 1',public:true,number:'Ö 1'}]}],links:{self:url}};};
 const result=await collectRegionalOparl({system:root+'body',id:'test',name:'Teststadt',kind:'city'},{getJson,now,window:'1w'});
 assert.deepEqual(result.topics.map(t=>t.title),['Thema 1']);assert.deepEqual(result.coverage.issues,[]);
});
test('a filter that fails or is too slow falls back to the plain list; a fixed filter reports the failure instead',async()=>{
 const now=new Date('2026-09-27T12:00:00Z'),root='https://fixture.example/';
 const plain={data:[{id:root+'meeting/1',start:'2026-09-22T18:00:00+02:00',name:'Rat',agendaItem:[{id:root+'item/1',name:'Thema 1',public:true,number:'Ö 1'}]}],links:{self:root+'meetings'}};
 const getJson=async url=>{if(url===root+'body')return {id:root+'body',type:'https://schema.oparl.org/1.1/Body',name:'Teststadt',meeting:root+'meetings'};
  if(url.includes('modified_since=2100'))return [];
  if(url.includes('modified_since'))throw Error('The operation was aborted due to timeout');
  return plain;};
 const auto=await collectRegionalOparl({system:root+'body',id:'test',name:'Teststadt',kind:'city'},{getJson,now,window:'1w'});
 assert.deepEqual(auto.topics.map(t=>t.title),['Thema 1']);assert.equal(auto.coverage.listStrategy,'end');assert.deepEqual(auto.coverage.issues,[]);
 const pinned=await collectRegionalOparl({system:root+'body',id:'test',name:'Teststadt',kind:'city',meetingScan:'filter'},{getJson,now,window:'1w'});
 assert.equal(pinned.topics.length,0);assert.equal(pinned.coverage.listStrategy,'filter');assert.match(pinned.coverage.issues.join(' '),/timeout/);assert.equal(pinned.coverage.quiet,false);
});
