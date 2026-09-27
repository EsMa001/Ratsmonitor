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
 await collectRegionalOparl(source,{getJson});assert.ok(seen.includes('https://fixture.example/meetings'));assert.ok(seen.every(u=>u.startsWith('https://fixture.example/')));
 const blocked=await collectRegionalOparl(source,{getJson:async()=>({name:'Test',type:'https://schema.oparl.org/1.1/Body',meeting:'http://foreign.example/meetings'})});assert.match(blocked.coverage.issues.join(' '),/außerhalb/);
});
