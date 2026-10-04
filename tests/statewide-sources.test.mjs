import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sources from '../server/integrations/statewide-sources.json' with {type:'json'};
import discovered from '../server/integrations/nrw-sources.json' with {type:'json'};
import nearby from '../server/integrations/nearby-sources.json' with {type:'json'};
import expanded from '../server/integrations/expanded-sources.json' with {type:'json'};
import overrides from '../server/integrations/source-overrides.json' with {type:'json'};
import regions from '../shared/nrw-regions.json' with {type:'json'};
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
import {SOURCES} from '../server/integrations/regions.mjs';
import {canImport} from '../server/integrations/pipeline-jobs.mjs';
import {READERS} from '../server/integrations/readers.mjs';
import {collectRegion} from '../server/integrations/collect-region.mjs';
const https=value=>typeof value==='string'&&value.startsWith('https://');
test('every statewide source belongs to exactly one catalogued area and is addressed over https',()=>{
 assert.ok(sources.length>100,'the discovery run connected more than a hundred areas');
 assert.equal(new Set(sources.map(s=>s.id)).size,sources.length);
 const elsewhere=new Set(['muenster',...SOURCES.map(s=>s.id),...discovered.map(s=>s.id),...nearby.map(s=>s.id),...expanded.map(s=>s.id)]);
 for(const s of sources){
  const region=regions.find(r=>r.id===s.id);assert.ok(region,s.id);assert.equal(region.name,s.name);assert.equal(region.kind,s.kind);
  assert.ok(!elsewhere.has(s.id),s.name+' is already configured in another catalog file');
  assert.match(s.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);assert.match(s.verifiedSource,/^https?:\/\//);
  if(s.method==='oparl'){assert.ok(https(s.system),s.name);if(s.body)assert.ok(https(s.body)&&new URL(s.body).origin===new URL(s.system).origin,s.name);}
  else if(s.method==='official-api'){assert.equal(s.adapter,'more-rubin');assert.ok(https(s.base)&&s.base.endsWith('/'),s.name);}
  else {assert.equal(s.method,'scraper');assert.ok(https(s.base)&&s.base.endsWith('/'),s.name);
   // Page scrapers name their adapter (SD.NET, ALLRIS and the readers of readers.mjs), SessionNet sources their page extension.
   if(s.adapter){assert.ok(['sdnet','allris',...Object.keys(READERS)].includes(s.adapter),s.name);assert.equal(s.extension,undefined,s.name);if(s.adapter==='sdnet')assert.equal(new URL(s.base).pathname,'/',s.name);}
   else assert.match(s.extension,/^(asp|php)$/);}
 }
 assert.ok(sources.filter(s=>s.adapter==='sdnet').length>40,'the SD.NET sources are part of the catalog');
 assert.ok(sources.filter(s=>s.adapter==='allris').length>=10,'the ALLRIS sources are part of the catalog');
});
test('an SD.NET source is read through its own collector and only while the vendor OParl endpoint is switched off',async()=>{
 const sd=sources.find(s=>s.adapter==='sdnet'&&!s.oparlFallback);const original=globalThis.fetch;const calls=[];
 const reply=(body,status=200,type='text/html; charset=utf-8')=>new Response(body,{status,headers:{'content-type':type}});
 try{
  // OParl switched off (HTTP 400): the public pages are read. The page markup here carries no meeting, so the period is quiet.
  globalThis.fetch=async url=>{calls.push(String(url));return String(url).endsWith('webservice/oparl/v1.1/system')?reply('{"error":"Webservice \\"OParl\\" ist nicht aktiviert!"}',400,'application/json'):String(url).endsWith('/vorlagen')?reply('<table><tr><td class="column-betreff">x</td><td class="column-termin"></td></tr></table>'):reply('<html></html>');};
  const d=await collectRegion(sd.id,{window:'1w'});
  assert.equal(d.coverage.method,'scraper');assert.equal(d.coverage.quiet,true);assert.match(d.coverage.apiCheck,/nicht aktiviert/);
  assert.deepEqual(calls.slice(0,2),[sd.base+'webservice/oparl/v1.1/system',sd.base+'vorlagen']);assert.ok(calls.every(u=>u.startsWith(sd.base)));
  // OParl answers: the official interface has priority, the pages are not read.
  calls.length=0;globalThis.fetch=async url=>{calls.push(String(url));return reply('{"type":"https://schema.oparl.org/1.1/System"}',200,'application/json');};
  await assert.rejects(collectRegion(sd.id,{window:'1w'}),/Adapterfreigabe/);assert.equal(calls.length,1);
 }finally{globalThis.fetch=original;}
});
test('one address serves one area; a shared system needs an explicitly assigned body',()=>{
 const seen=new Map();
 for(const s of NRW_SOURCES.filter(s=>s.method!=='pending')){const key=(s.system||s.base)+'|'+(s.body||'');assert.ok(!seen.has(key),s.name+' shares '+key+' with '+seen.get(key));seen.set(key,s.name);}
 const systems=new Map();for(const s of NRW_SOURCES.filter(s=>s.method==='oparl'))systems.set(s.system,[...(systems.get(s.system)||[]),s]);
 for(const [system,list] of systems)if(list.length>1)for(const s of list)assert.ok(s.body,s.name+' shares '+system+' without an assigned body');
});
test('catalog corrections are applied and unreachable sources are not offered for import',async()=>{
 for(const [id,override] of Object.entries(overrides)){const source=discovered.find(s=>s.id===id);assert.ok(source,id);for(const [key,value] of Object.entries(override))assert.deepEqual(source[key],value,id+'.'+key+': run node scripts/apply-source-overrides.mjs');}
 const unreachable=NRW_SOURCES.filter(s=>s.method==='pending');assert.ok(unreachable.length>0);
 for(const s of unreachable){assert.equal(canImport(s.id),false);assert.ok(s.note);
  // No request is made for a source that is switched off.
  const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('unexpected request');};
  try{const d=await collectRegion(s.id,{window:'1w'});assert.equal(d.coverage.method,'pending');assert.equal(d.topics.length,0);}finally{globalThis.fetch=original;}
 }
 assert.equal(canImport('nrw-05111000'),true);assert.equal(canImport(sources[0].id),true);
});
test('the discovery report names every area that is still not connected',()=>{
 const report=fs.readFileSync(new URL('../requirements/statewide-sources-report.md',import.meta.url),'utf8');
 const open=regions.filter(r=>!canImport(r.id));
 for(const r of open)assert.ok(report.includes('| '+r.name+' |'),r.name+' missing in the report');
 assert.ok(report.includes(`Von ${regions.length} auswählbaren Gebieten sind ${regions.length-open.length} angebunden`));
});
test('a scraper next to an answering OParl interface needs a recorded reason and then runs without the gate',async()=>{
 // Order of sources: OParl where it works, otherwise the public pages. The catalog records why OParl is not used.
 const fallbacks=NRW_SOURCES.filter(s=>s.oparlFallback);assert.ok(fallbacks.length>0);
 for(const s of fallbacks){assert.equal(s.method,'scraper',s.name);assert.ok(https(s.oparlFallback.system),s.name);assert.ok(s.oparlFallback.reason.length>5,s.name);assert.match(s.oparlFallback.checkedAt,/^\d{4}-\d{2}-\d{2}$/);}
 assert.ok(NRW_SOURCES.filter(s=>s.method==='oparl').every(s=>!s.oparlFallback));
 const sd=fallbacks.find(s=>s.adapter==='sdnet');const original=globalThis.fetch;const calls=[];
 try{
  globalThis.fetch=async url=>{calls.push(String(url));return new Response(String(url).endsWith('/vorlagen')?'<table><tr><td class="column-betreff">x</td><td class="column-termin"></td></tr></table>':'<html></html>',{status:200,headers:{'content-type':'text/html; charset=utf-8'}});};
  const d=await collectRegion(sd.id,{window:'1w'});
  assert.ok(calls.every(u=>!u.includes('oparl')),'the checked OParl address is not asked again on every import');assert.equal(calls[0],sd.base+'vorlagen');
  assert.match(d.coverage.apiCheck,/OParl geprüft am \d{4}-\d{2}-\d{2}, nicht nutzbar/);
 }finally{globalThis.fetch=original;}
});
