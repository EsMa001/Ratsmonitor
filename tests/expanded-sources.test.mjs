import {readNrwSnapshot} from '../scripts/nrw-snapshot-file.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sources from '../server/integrations/expanded-sources.json' with {type:'json'};
import nearby from '../server/integrations/nearby-sources.json' with {type:'json'};
import catalog from '../shared/nrw-regions.json' with {type:'json'};
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
import {DEFAULT_REGIONS} from '../scripts/run-imports.mjs';
import {activeTopics} from '../shared/topic-identity.mjs';
import {classifyTopic,CLASSIFIER_VERSION} from '../shared/labels.mjs';
import {buildAnalytics} from '../shared/analytics.mjs';
const seed=readNrwSnapshot();
test('twenty additional municipalities are distinct, source-verified and retained in follow-up imports',()=>{
 assert.equal(sources.length,20);assert.equal(new Set(sources.map(s=>s.id)).size,20);
 assert.equal(DEFAULT_REGIONS.length,43);assert.equal(new Set(DEFAULT_REGIONS).size,43);
 for(const s of sources){const r=catalog.find(r=>r.id===s.id);assert.equal(r.kind,'city');assert.equal(r.name,s.name);assert.ok(!nearby.some(n=>n.id===s.id));assert.ok(NRW_SOURCES.some(x=>x.id===s.id));assert.ok(DEFAULT_REGIONS.includes(s.id));assert.notEqual(s.id,r.district);assert.ok(s.verifiedSource.startsWith('https://'));}
 assert.deepEqual(['oparl','official-api','scraper'].map(m=>sources.filter(s=>s.method===m).length),[1,7,12]);
});
test('every new municipality contributes public, source-linked, rule-labelled articles and historical analyses',()=>{
 for(const s of sources){const topics=activeTopics(seed.topics.filter(t=>t.regionId===s.id)),coverage=seed.coverage.find(c=>c.regionId===s.id);
  assert.ok(topics.length>0,s.name);assert.equal(new Set(topics.map(t=>t.id)).size,topics.length);
  assert.equal(coverage.method,s.method);assert.equal(coverage.from,'2025-09-27');assert.equal(coverage.to,'2026-09-27');assert.equal(coverage.complete,coverage.issues.length===0);
  for(const t of topics){assert.equal(t.source,'city');assert.equal(t.public,true);assert.ok(t.id.startsWith(s.id+'-'));assert.equal(new URL(t.sourceUrl).origin,new URL(s.base||s.system).origin);assert.ok(t.events.length);assert.equal(t.classification.method,CLASSIFIER_VERSION);assert.equal(t.classification.primary,classifyTopic(t).primary);assert.ok(t.events.every(e=>e.date>=coverage.from));}
  const analysis=buildAnalytics(topics,[coverage],catalog,{region:s.id,from:coverage.from,to:coverage.to,level:'city',label:'all'});
  assert.ok(analysis.total>0,s.name);assert.equal(analysis.geography.filter(p=>p.total>0).length,1);assert.ok(Math.abs(analysis.distribution.reduce((n,l)=>n+(l.share||0),0)-100)<0.001);
 }
});
