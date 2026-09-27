import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchText,missingAgendaIssue} from '../server/integrations/sessionnet.mjs';
import {collectRegionalOparl} from '../server/integrations/oparl-regional.mjs';
import {mergeImport} from '../server/integrations/merge-import.mjs';
import {activeTopics,resolveTopic} from '../shared/topic-identity.mjs';
const source={base:'https://fixture.example/bi/',id:'test',name:'Teststadt',kind:'city'};
test('portal redirects remain within the approved HTTPS path and stop at loops, limits or access barriers',async()=>{
 const calls=[];const html=await fetchText(source.base+'agenda',source,5000,async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');return calls.length===1?new Response(null,{status:302,headers:{location:'info'}}):new Response('Öffentliche Informationen');});
 assert.equal(html,'Öffentliche Informationen');assert.deepEqual(calls,[source.base+'agenda',source.base+'info']);
 for(const location of ['https://foreign.example/bi/','http://fixture.example/bi/','/private/','https://user:secret@fixture.example/bi/']){
  let count=0;await assert.rejects(()=>fetchText(source.base,source,5000,async()=>{count++;return new Response(null,{status:302,headers:{location}})}),/Nicht freigegebene/);assert.equal(count,1);
 }
 let count=0;await assert.rejects(()=>fetchText(source.base,source,5000,async()=>new Response(null,{status:302,headers:{location:String(++count)}})),/Weiterleitungslimit/);assert.equal(count,4);
 await assert.rejects(()=>fetchText(source.base,source,5000,async()=>new Response(null,{status:302,headers:{location:source.base}})),/Wiederholte/);
 await assert.rejects(()=>fetchText(source.base,source,5000,async()=>new Response(null,{status:403})),/HTTP 403/);
});
test('unreleased session details remain an explicit data gap, not an empty successful agenda',()=>{
 assert.match(missingAgendaIssue('<p>Zu dieser Sitzung wurden noch keine Detailinformationen freigegeben.</p>',source.base),/^Sitzungsdetails noch nicht öffentlich freigegeben:/);
 assert.match(missingAgendaIssue('<p>Informationen</p>',source.base),/^Keine lesbare öffentliche Tagesordnung:/);
});
test('failed paper lookup preserves a public agenda item and later merges it without breaking its link',async()=>{
 const origin='https://fixture.example',s={...source,system:origin+'/body'};
 const fixture=async(url,resolved)=>{
  if(url===s.system)return {id:s.system,name:s.name,type:'https://schema.oparl.org/1.1/Body',meeting:origin+'/meetings'};
  if(url===origin+'/meetings')return {data:[{id:origin+'/meeting/1',start:'2026-09-20T18:00:00Z',agendaItem:[{id:origin+'/agendaItem/1',public:true,name:'Neubau einer Schule',consultation:origin+'/consultation/1'},{id:origin+'/agendaItem/private',public:false,name:'Nichtöffentlich'}]}],links:{}};
  if(url===origin+'/consultation/1')return {paper:origin+'/paper/1'};
  if(url===origin+'/paper/1'&&resolved)return {id:url,name:'Neubau einer Schule',reference:'V-1'};
  throw Error('Zeitüberschreitung');
 };
 const first=await collectRegionalOparl(s,{now:new Date('2026-09-27T10:00:00Z'),getJson:u=>fixture(u,false)});
 assert.equal(first.topics.length,1);assert.equal(first.topics[0].sourceUrl,origin+'/agendaItem/1');assert.equal(first.topics[0].status,'unknown');assert.equal(first.coverage.complete,false);
 const second=await collectRegionalOparl(s,{now:new Date('2026-09-27T11:00:00Z'),getJson:u=>fixture(u,true)});
 const merged=mergeImport(first,second);assert.equal(activeTopics(merged.topics).length,1);assert.equal(resolveTopic(merged.topics,first.topics[0].id).sourceUrl,origin+'/paper/1');assert.equal(resolveTopic(merged.topics,second.topics[0].id).id,first.topics[0].id);
});
