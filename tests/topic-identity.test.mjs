import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileTopics,activeTopics,resolveTopic,identityState,recordUrl} from '../shared/topic-identity.mjs';
import {mergeImport} from '../server/integrations/merge-import.mjs';
import {buildAnalytics} from '../shared/analytics.mjs';
import {relatedTopics,comparisonDistrict} from '../shared/similarity.mjs';
import {collectRegionalOparl} from '../server/integrations/oparl-regional.mjs';
const root='https://council.example';
const event=(date,url=root+'/meeting/1')=>({date,url,committee:'Rat',status:'consulting',description:'Beratung'});
const topic=(id,sourceUrl,extra={})=>({id,sourceUrl,regionId:'city',source:'city',title:'Wärmeplanung',officialTitle:'Wärmeplanung',updatedAt:'2026-09-20',eventDate:'2026-09-20',status:'consulting',events:[event('2026-09-20')],documents:[],...extra});
test('district origin is excluded even without a parent; independent city has none',()=>{
 const regions=[{id:'district',kind:'district'},{id:'city',kind:'city',district:'district'},{id:'independent',kind:'city',district:null}];
 for(const id of ['district','city'])assert.equal(comparisonDistrict({regionId:id},regions),'district');
 assert.equal(comparisonDistrict({regionId:'independent'},regions),undefined);
 const original=topic('origin',root+'/paper/1',{regionId:'district',source:'district'});
 const own=topic('other-own',root+'/paper/2',{regionId:'district',source:'district'});
 const other=topic('other',root+'/paper/3',{regionId:'neighbour',source:'district'});
 assert.deepEqual(relatedTopics(original,[own,other],{now:new Date('2026-09-26')}).totalDistricts,['neighbour']);
});
test('official paper-to-agenda relations unite earlier entries, keep all links and count once',()=>{
 const a=topic('old-a',root+'/agendaitem/a',{events:[event('2026-08-01')],documents:[{url:root+'/old.pdf'}]});
 const b=topic('old-b',root+'/agendaitem/b');
 const paper=topic('new-paper',root+'/paper/1',{identityLinks:[a.sourceUrl,b.sourceUrl],events:[event('2026-09-20'),event('2026-09-25')],documents:[{url:root+'/new.pdf'}]});
 const merged=reconcileTopics([a,b],[paper]);const canonical=activeTopics(merged);
 assert.equal(canonical.length,1);assert.equal(canonical[0].id,'old-a');assert.equal(canonical[0].events.length,3);assert.equal(canonical[0].documents.length,2);
 for(const id of ['old-a','old-b','new-paper'])assert.equal(resolveTopic(merged,id).id,'old-a');
 assert.equal(identityState(canonical[0]),'paper');
 const data=buildAnalytics(merged,[],[{id:'city',kind:'city'}],{region:'city',from:'2026-08-01',to:'2026-09-26',now:new Date('2026-09-26')});
 assert.equal(data.total,1);assert.deepEqual(data.months.map(m=>m.total),[1,1]);
 assert.deepEqual(reconcileTopics(merged,[paper]),merged);
});
test('same title, document or meeting never establishes identity; distinct papers stay distinct',()=>{
 const meeting=root+'/si0057.asp?__ksinr=2';assert.equal(recordUrl(meeting),null);
 const a=topic('a',meeting,{documents:[{url:root+'/same.pdf'}]});
 const b=topic('b',meeting,{documents:[{url:root+'/same.pdf'}]});
 assert.equal(activeTopics(reconcileTopics([a],[b])).length,2);
 assert.equal(activeTopics(reconcileTopics([topic('a',root+'/paper/1')],[topic('b',root+'/paper/2')])).length,2);
 const conflicting=reconcileTopics([topic('a',root+'/paper/1',{identityLinks:[root+'/agendaitem/1']})],[topic('b',root+'/paper/2',{identityLinks:[root+'/agendaitem/1']})]);
 assert.equal(activeTopics(conflicting).length,2);assert.equal(identityState(conflicting.find(t=>t.id==='b')),'conflict');
 assert.equal(identityState(a),'unlinked');
});
test('identity is scoped to region and a partial or older import preserves recorded history',()=>{
 const a=topic('a',root+'/paper/1',{eventDate:'2026-09-25',status:'approved',events:[event('2026-09-25')],updatedAt:'2026-09-26'});
 assert.equal(activeTopics(reconcileTopics([a],[topic('b',a.sourceUrl,{regionId:'other'})])).length,2);
 const oldSlice=topic('a',a.sourceUrl,{updatedAt:'2026-09-27'});
 const merged=mergeImport({topics:[a],coverage:{importedAt:'2026-09-26'}},{topics:[oldSlice],coverage:{importedAt:'2026-09-27',issues:[]}});
 assert.equal(merged.topics[0].events.length,2);assert.equal(merged.topics[0].status,'approved');assert.equal(merged.topics[0].eventDate,'2026-09-25');
 assert.deepEqual(reconcileTopics([a],[{...oldSlice,updatedAt:'2026-09-01'}]),[a]);
});
test('OParl collector records explicit agenda links across multiple meetings for one paper',async()=>{
 const body={id:root+'/body',name:'Test',type:'https://schema.oparl.org/1.1/Body',meeting:root+'/meetings'};
 const paper={id:root+'/paper/1',name:'Wärmeplanung'};
 const getJson=async url=>url===body.id?body:{data:['a','b'].map((id,i)=>({id:root+'/meeting/'+id,start:`2026-09-${20+i}T10:00:00Z`,agendaItem:[{id:root+'/agendaitem/'+id,name:'Wärmeplanung',public:true,consultation:{paper}}]})),links:{}};
 const result=await collectRegionalOparl({id:'city',name:'Test',kind:'city',system:body.id},{getJson,now:new Date('2026-09-26')});
 assert.equal(result.topics.length,1);assert.equal(result.topics[0].events.length,2);
 assert.ok(result.topics[0].identityLinks.includes(root+'/agendaitem/a'));assert.ok(result.topics[0].identityLinks.includes(root+'/agendaitem/b'));
});
test('More-Rubin numeric official IDs link an old agenda entry to its paper without using the meeting URL',()=>{
 const a=topic('city-top-12',root+'/meeting/1');
 const b=topic('city-vo-34',root+'/meeting/2',{identityRecords:[{authority:root,kind:'agenda',id:'12'},{authority:root,kind:'paper',id:'34'}]});
 const result=reconcileTopics([a],[b]);assert.equal(activeTopics(result).length,1);assert.equal(identityState(resolveTopic(result,a.id)),'paper');
 assert.equal(resolveTopic(result,b.id).events.length,1);
 assert.equal(activeTopics(reconcileTopics([],result)).length,1);
});
