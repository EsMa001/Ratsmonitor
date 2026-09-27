import test from 'node:test';
import assert from 'node:assert/strict';
import {studyInput,labelMessages,validPrediction,comparisonMetrics} from '../shared/label-study.mjs';
test('AI receives original evidence but neither rule labels nor generated summaries',()=>{
 const input=studyInput({officialTitle:'Neubau Schule',sourceText:'Schule für 400 Kinder',longSummary:['erfundene Zusammenfassung'],classification:{primary:'bauen'}});
 const prompt=JSON.stringify(labelMessages(input));assert.ok(!prompt.includes('erfundene'));assert.ok(!prompt.includes('classification'));assert.ok(prompt.includes('400 Kinder'));
 assert.equal(studyInput({officialTitle:'Schule',sourceText:'mehr'},'title').text,'Schule');
 assert.equal(validPrediction({primary:'bildung',reason:'Schule',evidence:['Schule']},input),true);
 assert.equal(validPrediction({primary:'bildung',reason:'Schule',evidence:['Universität']},input),false);
});
test('agreement can be perfect while both classifiers are wrong; pending is not an abstention',()=>{
 const rows=[{id:'1',inputHash:'hash',rule:{primary:'bauen'},ai:{status:'done',primary:'bauen'}},{id:'2',inputHash:'hash2',rule:{primary:'unklar'},ai:{status:'pending'}}];
 const refs=[{id:'1',inputHash:'hash',primary:'bildung',status:'adjudicated'}];
 const m=comparisonMetrics(rows,refs);assert.equal(m.agreement,1);assert.equal(m.rulePaired.accuracy,0);assert.equal(m.aiPaired.accuracy,0);assert.equal(m.aiPending,1);assert.equal(m.aiOpen,0);assert.equal(m.pairedReferenceCount,1);
 assert.equal(comparisonMetrics(rows,[{...refs[0],inputHash:'stale'}]).aiPaired.accuracy,null);
});
