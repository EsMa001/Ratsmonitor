import test from 'node:test';
import {analysed} from './helpers/analysed.mjs';
import assert from 'node:assert/strict';
import {buildAnalytics} from '../shared/analytics.mjs';
import {buildAnalysisExamples,concreteTopicExamples,labelShortcuts} from '../shared/analysis-examples.mjs';
const topic=(id,regionId,title,date)=>analysed({id,regionId,title,events:[{date}]});
const regions=[{id:'billerbeck',kind:'city'},{id:'muenster',kind:'city'},{id:'coesfeld',kind:'district'}];
const query={region:'billerbeck',from:'2026-07-01',to:'2026-09-26',label:'klima',level:'all',now:new Date('2026-09-26T12:00:00Z')};
const topics=[topic('a','billerbeck','Kommunale Wärmeplanung','2026-07-03'),topic('b','billerbeck','Mitteilungen','2026-09-03'),topic('c','billerbeck','Unbekanntes Projekt','2026-09-05'),topic('d','muenster','Kommunale Wärmeplanung','2026-07-04'),topic('e','coesfeld','Kommunale Wärmeplanung','2026-09-05'),topic('f','billerbeck','Kindertagesbetreuung','2026-10-01')];
test('example links preserve place, period and level; clear stale article focus',()=>{
 const d=buildAnalytics(topics,[],regions,{...query,topicId:'a'}),examples=buildAnalysisExamples(d);
 for(const e of examples.filter(e=>e.href)){
  const u=new URL(e.href,'https://example.org');assert.equal(u.searchParams.get('region'),query.region);assert.equal(u.searchParams.get('from'),query.from);assert.equal(u.searchParams.get('to'),query.to);assert.equal(u.searchParams.get('level'),'all');
  assert.equal(u.searchParams.get('topic'),e.id==='aehnlichkeit'?'a':null);
 }
});
test('subject leaders exclude structural headings and the unknown bucket; quality reconciles all counts',()=>{
 const d=buildAnalytics([...topics,topic('g','billerbeck','Anfragen','2026-09-02')],[],regions,query),examples=buildAnalysisExamples(d);
 assert.equal(examples[0].metric,'Klima & Energie');assert.match(examples[0].answer,/1 von 4/);
 assert.match(examples[4].answer,/1 ein fachliches Hauptlabel/);assert.match(examples[4].answer,/2 sind allgemeine/);assert.match(examples[4].answer,/1 bleiben offen/);
});
test('empty months do not become zero; comparison separates municipalities and districts',()=>{
 const examples=buildAnalysisExamples(buildAnalytics(topics,[],regions,query));
 assert.match(examples[1].answer,/07.2026: 1 von 1/);assert.match(examples[1].answer,/09.2026: 0 von 2/);assert.doesNotMatch(examples[1].answer,/08.2026/);
 assert.match(examples[2].answer,/1 anderen Kommunen und 1 anderen Kreisen/);
});
test('empty selection has no invented percentages, trend, or example article',()=>{
 const examples=buildAnalysisExamples(buildAnalytics([],[],regions,query));
 assert.equal(examples[0].metric,'Noch keine Sachthemen');assert.match(examples[1].answer,/reicht dafür nicht/);assert.equal(examples[3].href,null);assert.equal(examples[4].metric,'Kein auswertbarer Bestand');
});

test('concrete examples only use original-title subjects in this place and period',()=>{
 const items=[...topics,analysed({...topic('x','billerbeck','Kurzer Anzeigetitel','2026-09-01'),officialTitle:'Radverkehrskonzept'}),topic('old','billerbeck','Elternbeiträge Kita','2026-06-01')];
 const d=buildAnalytics(items,[],regions,query),examples=concreteTopicExamples(d);
 assert.deepEqual(examples.map(e=>e.subject).sort(),['Radverkehr','Wärmeplanung']);
 assert.equal(examples.find(e=>e.subject==='Radverkehr').chosen.id,'x');
 assert.equal(examples.find(e=>e.subject==='Wärmeplanung').count,1);
 const u=new URL(examples.find(e=>e.subject==='Radverkehr').href,'https://example.org');
 assert.equal(u.searchParams.get('topic'),'x');assert.equal(u.searchParams.get('region'),'billerbeck');assert.equal(u.searchParams.get('from'),query.from);
});
test('a chosen concrete article is retained, and repeated dates do not inflate local subject counts',()=>{
 const extra={...topic('z','billerbeck','Kommunale Wärmeplanung zweite Vorlage','2026-09-06'),events:[{date:'2026-09-06'},{date:'2026-09-07'}]};
 const d=buildAnalytics([...topics,extra],[],regions,{...query,topicId:'z'}),example=concreteTopicExamples(d)[0];
 assert.equal(example.count,2);assert.equal(example.chosen.id,'z');assert.equal(example.active,true);
 assert.match(buildAnalysisExamples(d)[3].description,/zweite Vorlage/);
 assert.equal(new URL(buildAnalysisExamples(d)[3].href,'https://example.org').searchParams.get('topic'),'z');
});
test('subject shortcuts have real local counts and clear the previous article comparison',()=>{
 const d=buildAnalytics(topics,[],regions,{...query,topicId:'a'}),shortcuts=labelShortcuts(d,'entwicklung');
 assert.equal(shortcuts.length,1);assert.equal(shortcuts[0].count,1);
 const u=new URL(shortcuts[0].href,'https://example.org');assert.equal(u.searchParams.get('example'),'entwicklung');assert.equal(u.searchParams.get('topic'),null);
});
