import {readNrwSnapshot} from '../scripts/nrw-snapshot-file.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sources from '../server/integrations/nearby-sources.json' with {type:'json'};
import catalog from '../shared/nrw-regions.json' with {type:'json'};
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
import {DEFAULT_REGIONS} from '../scripts/run-imports.mjs';
import {activeTopics} from '../shared/topic-identity.mjs';
import {classifyTopic,CLASSIFIER_VERSION} from '../shared/labels.mjs';
import {buildAnalytics} from '../shared/analytics.mjs';
const seed=readNrwSnapshot();
test('ten new nearby municipalities remain distinct from their districts and are scheduled for subsequent imports',()=>{
 assert.equal(sources.length,10);assert.equal(new Set(sources.map(s=>s.id)).size,10);
 for(const s of sources){const r=catalog.find(r=>r.id===s.id);assert.equal(r.kind,'city');assert.equal(r.name,s.name);assert.ok(NRW_SOURCES.some(x=>x.id===s.id));assert.ok(DEFAULT_REGIONS.includes(s.id));assert.notEqual(s.id,r.district);assert.ok(s.verifiedSource.startsWith('https://'));}
 assert.equal(new Set(NRW_SOURCES.map(s=>s.id)).size,NRW_SOURCES.length);
});
test('each nearby municipality has public, labelled, source-linked articles and honest twelve-month coverage',()=>{
 for(const s of sources){const topics=activeTopics(seed.topics.filter(t=>t.regionId===s.id));assert.ok(topics.length>0,s.name);assert.equal(new Set(topics.map(t=>t.id)).size,topics.length);
  const coverage=seed.coverage.find(c=>c.regionId===s.id);assert.equal(coverage.method,'scraper');assert.equal(coverage.from,'2025-09-27');assert.equal(coverage.to,'2026-09-27');assert.ok(coverage.apiCheck);assert.equal(coverage.complete,coverage.issues.length===0);
  for(const t of topics){assert.equal(t.source,'city');assert.equal(t.public,true);assert.ok(t.id.startsWith(s.id+'-'));assert.ok(t.sourceUrl.startsWith(s.base));assert.ok(t.events.length);assert.equal(t.classification.method,CLASSIFIER_VERSION);assert.equal(t.classification.primary,classifyTopic(t).primary);assert.ok(t.events.every(e=>e.date>=coverage.from));}
  const analysis=buildAnalytics(topics,[coverage],catalog,{region:s.id,from:'2025-09-27',to:'2026-09-27',level:'city',label:'all'});
  assert.ok(analysis.total>0,s.name+' has no historical analysis');assert.equal(analysis.geography.filter(p=>p.total>0).length,1);assert.ok(Math.abs(analysis.distribution.reduce((n,l)=>n+(l.share||0),0)-100)<0.001);
 }
});
