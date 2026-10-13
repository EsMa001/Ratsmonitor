import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadAtlasInputs,atlasEvidence,applyConsentEvidence} from '../scripts/source-discovery/atlas-inputs.mjs';

const ATLAS='server/integrations/source-atlas.json';
const WORK='tmp/source-discovery-de/open.json';
const REPORT='requirements/de-sources-report.md';
const area={id:'de-09999001',name:'Gemeinde Alpha',kind:'city',ags:'09999001'};
const reason='Sitzungsunterlagen nur auf der Gemeinde-Website (Recherche 10.10.2026)';
const url='https://alpha.example/bekanntmachungen/';
const sha=text=>createHash('sha256').update(text).digest('hex');
const savedAtlas=(extra={})=>({builtAt:'2026-10-09',reportDate:'06.10.2026',texts:[reason],areas:{[area.id]:{c:'website',z:'scraping',r:0,u:url}},...extra});

function fixture(t,{catalog=[area],atlas=savedAtlas(),catalogSources=[],coreSources=[]}={}){
 const temporary=path.resolve(os.tmpdir()),root=fs.mkdtempSync(path.join(temporary,'vorort-atlas-inputs-'));
 // Delete only this freshly created fixture, never the system temporary root.
 t.after(()=>{
  assert.equal(path.dirname(path.resolve(root)),temporary);
  assert.match(path.basename(root),/^vorort-atlas-inputs-/);
  fs.rmSync(root,{recursive:true,force:true});
 });
 const write=(name,text)=>{const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);};
 const json=(name,value)=>write(name,JSON.stringify(value,null,2)+'\n');
 json(ATLAS,atlas);
 const load=()=>loadAtlasInputs({root,catalog,catalogSources,coreSources});
 const report=(rows,heading='13.10.2026',name=REPORT)=>write(name,
  `# Quellen\n\nStand: ${heading}.\n\n## Nicht angebundene Gebiete\n\n| Gebiet | Grund | Gefundene Adresse |\n|---|---|---|\n`+
  rows.map(r=>`| ${r.name||area.name} | ${r.reason} | ${r.url||''} |`).join('\n')+'\n');
 const persist=(inputs,extra={})=>{
  const texts=[],areas={};
  for(const [id,resolution] of inputs.resolutions){
   const selected=resolution.selected;if(!selected)continue;
   areas[id]={c:selected.category,z:selected.access,r:texts.length};texts.push(selected.reason);
   if(selected.url)areas[id].u=selected.url;
  }
  const value={builtAt:'2026-10-13',reportDate:inputs.reportDate,texts,areas,evidenceVersion:1,evidence:atlasEvidence(inputs.resolutions),...extra};
  json(ATLAS,value);return value;
 };
 return {root,write,json,load,report,persist,read:()=>JSON.parse(fs.readFileSync(path.join(root,ATLAS),'utf8')),
  remove:name=>fs.unlinkSync(path.join(root,name)),fileHash:name=>sha(fs.readFileSync(path.join(root,name)))};
}

test('older work and report rows remain comparison evidence without category downgrade',t=>{
 const f=fixture(t);
 f.json(WORK,[{id:area.id,reason:'Kein unterstütztes Ratsinformationssystem erkannt (Recherche 05.10.2026)',link:'https://alpha.example/rat/'}]);
 f.report([{reason:'Auf der offiziellen Website kein Link gefunden (Recherche 04.10.2026)'}]);
 const inputs=f.load(),resolution=inputs.resolutions.get(area.id);
 assert.equal(resolution.selected.category,'website');assert.equal(resolution.selected.checkedAt,'2026-10-10');
 assert.equal(resolution.selected.origin.kind,'atlas');assert.equal(resolution.conflict,false);
 assert.equal(resolution.decision,'keep-current');
 assert.deepEqual(resolution.alternatives.map(e=>e.origin.kind).sort(),['report','work']);
 assert.deepEqual(resolution.alternatives.map(e=>e.checkedAt).sort(),['2026-10-04','2026-10-05']);
 assert.equal(resolution.selected.origin.sha256,f.fileHash(ATLAS));
 assert.ok(resolution.selected.dateIssues.includes('check-after-documentBuiltAt'));
});

test('undated work and report rows do not inherit creation or report-header dates',t=>{
 const f=fixture(t);
 f.json(WORK,[{id:area.id,reason:'Kein unterstütztes Ratsinformationssystem erkannt',link:'https://alpha.example/rat/',builtAt:'2026-10-14'}]);
 f.report([{reason:'Auf der offiziellen Website kein Link gefunden'}],'14.10.2026');
 const inputs=f.load(),resolution=inputs.resolutions.get(area.id);
 assert.equal(inputs.reportDate,'14.10.2026');
 assert.equal(resolution.selected.category,'website');assert.equal(resolution.conflict,true);
 for(const alternative of resolution.alternatives){
  assert.equal(alternative.checkedAt,null);assert.equal(alternative.dateBasis,'unknown');
  assert.ok(alternative.dateIssues.includes('unknown-check-date'));
 }
 assert.equal(resolution.alternatives.find(e=>e.origin.kind==='report').origin.documentReportDate,'14.10.2026');
});

test('an explicitly newer checked work row replaces a dated saved finding',t=>{
 const f=fixture(t);
 f.json(WORK,[{id:area.id,reason:'Zugriffsschutz (HTTP 403)',link:'https://alpha.example/ris/',checkedAt:'2026-10-11'}]);
 const inputs=f.load(),resolution=inputs.resolutions.get(area.id);
 assert.equal(resolution.selected.category,'blocked');assert.equal(resolution.selected.access,'blocked');
 assert.equal(resolution.selected.checkedAt,'2026-10-11');assert.equal(resolution.selected.dateBasis,'checkedAt');
 assert.equal(resolution.selected.origin.kind,'work');assert.equal(resolution.selected.origin.sha256,f.fileHash(WORK));
 assert.equal(resolution.decision,'newer-evidence');assert.equal(resolution.conflict,false);
 assert.equal(resolution.alternatives[0].origin.kind,'atlas');
});

test('contradictory explicit and reason check dates cannot overwrite current',t=>{
 const f=fixture(t);
 f.json(WORK,[{id:area.id,reason:'Zugriffsschutz (Recherche 12.10.2026)',link:'https://alpha.example/ris/',checkedAt:'2026-10-11'}]);
 const resolution=f.load().resolutions.get(area.id),alternative=resolution.alternatives[0];
 assert.equal(resolution.selected.category,'website');assert.equal(resolution.conflict,true);
 assert.equal(alternative.checkedAt,null);assert.equal(alternative.dateBasis,'unknown');
 assert.deepEqual(alternative.dateCandidates,['2026-10-11','2026-10-12']);
 assert.ok(alternative.dateIssues.includes('conflicting-check-dates'));
});

test('invalid explicit date is diagnosed rather than used for freshness',t=>{
 const f=fixture(t);
 f.json(WORK,[{id:area.id,reason:'Zugriffsschutz',checkedAt:'2026-02-30'}]);
 const resolution=f.load().resolutions.get(area.id),alternative=resolution.alternatives[0];
 assert.equal(resolution.selected.category,'website');assert.equal(resolution.conflict,true);
 assert.equal(alternative.checkedAt,null);assert.ok(alternative.dateIssues.includes('invalid-checkedAt'));
});

test('ambiguous report names never assign a finding to an arbitrary municipality',t=>{
 const twin={...area,id:'de-09999002',ags:'09999002'};
 const f=fixture(t,{catalog:[area,twin]});
 f.report([{reason:'Zugriffsschutz (Recherche 12.10.2026)'}]);
 const inputs=f.load();
 const issue=inputs.diagnostics.find(d=>d.kind==='ambiguous-report-match');
 assert.deepEqual(issue.ids,[area.id,twin.id]);assert.equal(issue.name,area.name);
 assert.equal(inputs.resolutions.get(area.id).alternatives.length,0);
 assert.equal(inputs.resolutions.get(twin.id).selected,null);
});

test('injected active sources take precedence and pending suppresses a core fallback',t=>{
 const active={...area,id:'de-09999003',ags:'09999003',name:'Gemeinde Beta'};
 const f=fixture(t,{catalog:[area,active],catalogSources:[
  {id:area.id,method:'pending',note:'Zugriffsschutz (Recherche 09.10.2026)'},
  {id:active.id,method:'scraper',adapter:'website',base:'https://beta.example/'},
 ],coreSources:[{id:area.id,method:'oparl',system:'https://alpha.example/oparl/'}]});
 const inputs=f.load();
 assert.equal(inputs.sources.has(area.id),false);assert.equal(inputs.sources.has(active.id),true);
 assert.equal(inputs.resolutions.has(active.id),false);
 assert.ok(inputs.resolutions.get(area.id).alternatives.some(e=>e.origin.kind==='pending'));
 assert.ok(inputs.manifest.some(m=>m.path==='resolved:catalogSources'&&m.sha256===sha(JSON.stringify([
  {id:area.id,method:'pending',note:'Zugriffsschutz (Recherche 09.10.2026)'},
  {id:active.id,method:'scraper',adapter:'website',base:'https://beta.example/'},
 ]))));
});

test('persisted conflicts, original source hashes and origins survive two atlas builds without work files',t=>{
 const f=fixture(t);
 f.json(WORK,[{id:area.id,reason:'Kein unterstütztes Ratsinformationssystem erkannt',link:'https://alpha.example/rat/'}]);
 f.report([{reason:'Kein Link gefunden (Recherche 05.10.2026)'}]);
 const first=f.load(),original=JSON.parse(JSON.stringify(first.resolutions.get(area.id)));
 assert.equal(original.conflict,true);
 const workHash=f.fileHash(WORK),reportHash=f.fileHash(REPORT),atlasHash=f.fileHash(ATLAS);
 f.persist(first);f.remove(WORK);f.remove(REPORT);
 const second=f.load(),secondResolution=second.resolutions.get(area.id);
 assert.deepEqual(secondResolution.selected,original.selected);
 assert.deepEqual(secondResolution.alternatives,original.alternatives);assert.equal(secondResolution.conflict,true);
 assert.equal(secondResolution.selected.origin.sha256,atlasHash);
 assert.equal(secondResolution.alternatives.find(e=>e.origin.kind==='work').origin.sha256,workHash);
 assert.equal(secondResolution.alternatives.find(e=>e.origin.kind==='report').origin.sha256,reportHash);
 assert.notEqual(second.manifest.find(m=>m.path===ATLAS).sha256,atlasHash);
 assert.equal(second.manifest.find(m=>m.path===WORK).present,false);
 assert.equal(second.diagnostics.some(d=>d.kind==='saved-evidence-mismatch'),false);
 f.persist(second,{builtAt:'2026-10-14'});
 const third=f.load(),thirdResolution=third.resolutions.get(area.id);
 assert.deepEqual(thirdResolution.selected,original.selected);
 assert.deepEqual(thirdResolution.alternatives,original.alternatives);assert.equal(thirdResolution.conflict,true);
});

test('selected work provenance remains work after persistence, removal and reload',t=>{
 const f=fixture(t);
 f.json(WORK,[{id:area.id,reason:'HTTP 403',link:'https://alpha.example/ris/',checkedAt:'2026-10-12'}]);
 const first=f.load(),original=JSON.parse(JSON.stringify(first.resolutions.get(area.id).selected));
 f.persist(first);f.remove(WORK);
 const second=f.load(),resolution=second.resolutions.get(area.id);
 assert.deepEqual(resolution.selected,original);assert.equal(resolution.selected.origin.kind,'work');
 assert.equal(resolution.selected.checkedAt,'2026-10-12');assert.equal(resolution.conflict,false);
 assert.ok(resolution.alternatives.some(e=>e.origin.kind==='atlas'&&e.checkedAt==='2026-10-10'));
});

test('manual changes to a flat category, URL or reason invalidate saved selection provenance',t=>{
 for(const field of ['category','url','reason']){
  const f=fixture(t);
  f.json(WORK,[{id:area.id,reason:'HTTP 403',link:'https://alpha.example/ris/',checkedAt:'2026-10-12'}]);
  const first=f.load(),oldOrigin=first.resolutions.get(area.id).selected.origin;
  const stored=f.persist(first);f.remove(WORK);
  if(field==='category')stored.areas[area.id].c='shared';
  if(field==='url')stored.areas[area.id].u='https://alpha.example/andere-quelle/';
  if(field==='reason')stored.texts[stored.areas[area.id].r]='System ohne passenden Leser (Recherche 13.10.2026)';
  f.json(ATLAS,stored);
  const inputs=f.load(),resolution=inputs.resolutions.get(area.id);
  assert.equal(resolution.selected.origin.kind,'atlas',field);
  assert.equal(resolution.selected.origin.sha256,f.fileHash(ATLAS),field);
  assert.notDeepEqual(resolution.selected.origin,oldOrigin,field);
  assert.ok(inputs.diagnostics.some(d=>d.kind==='saved-evidence-mismatch'&&d.id===area.id),field);
  if(field==='category')assert.equal(resolution.selected.category,'shared');
  if(field==='url')assert.equal(resolution.selected.url,stored.areas[area.id].u);
  if(field==='reason')assert.equal(resolution.selected.reason,stored.texts[stored.areas[area.id].r]);
 }
});

test('consent overlay survives reload without wrapper growth or changing the original check date',t=>{
 const f=fixture(t),first=f.load(),underlying=JSON.parse(JSON.stringify(first.resolutions.get(area.id).selected));
 const consent={date:'2026-10-13',scope:['freischaltung']};
 const origin={path:'server/integrations/source-consents.json',pointer:'/consents/0',sha256:sha('original-consent-register'),consent};
 const overlay=applyConsentEvidence(first.resolutions.get(area.id),consent,origin);
 first.resolutions.set(area.id,overlay);
 const stored=f.persist(first);
 assert.equal(stored.areas[area.id].c,'consent');
 assert.equal(stored.texts[stored.areas[area.id].r],overlay.selected.reason);
 assert.equal(overlay.selected.checkedAt,'2026-10-10');
 assert.equal(overlay.selected.dateBasis,'underlying-evidence');
 assert.deepEqual(overlay.selected.derivedFrom,underlying);
 assert.equal(overlay.selected.origin.kind,'consent');assert.equal(overlay.selected.origin.sha256,origin.sha256);
 const second=f.load(),loaded=second.resolutions.get(area.id);
 assert.equal(second.diagnostics.some(d=>d.kind==='saved-evidence-mismatch'),false);
 assert.deepEqual(loaded.selected,overlay.selected);
 const repeated=applyConsentEvidence(loaded,consent,origin);
 assert.equal(repeated.selected.reason,overlay.selected.reason);
 assert.equal((repeated.selected.reason.match(/Freigabe \(/g)||[]).length,1);
 assert.equal(repeated.selected.checkedAt,underlying.checkedAt);
 assert.deepEqual(repeated.selected.derivedFrom.origin,underlying.origin);
 second.resolutions.set(area.id,repeated);f.persist(second,{builtAt:'2026-10-14'});
 const third=f.load().resolutions.get(area.id);
 assert.deepEqual(third.selected,repeated.selected);assert.equal(third.conflict,false);
});

test('consent date does not fill a missing underlying check date',t=>{
 const f=fixture(t,{atlas:savedAtlas({texts:['Sitzungen nur als Webseite oder PDF']})});
 const resolution=f.load().resolutions.get(area.id);
 const overlay=applyConsentEvidence(resolution,{date:'2026-10-13',scope:['freischaltung']},{path:'consents.json',pointer:'/0',sha256:sha('consent')});
 assert.equal(overlay.selected.checkedAt,null);assert.equal(overlay.selected.dateBasis,'unknown');
 assert.equal(overlay.selected.derivedFrom.checkedAt,null);
});

test('unchanged underlying work evidence does not create a conflict after a consent overlay',t=>{
 const f=fixture(t);
 f.json(WORK,[{id:area.id,reason:'HTTP 403',link:'https://alpha.example/ris/',checkedAt:'2026-10-12'}]);
 const first=f.load(),resolution=first.resolutions.get(area.id);
 assert.equal(resolution.conflict,false);
 const consent={date:'2026-10-13',scope:['freischaltung']};
 first.resolutions.set(area.id,applyConsentEvidence(resolution,consent,
  {path:'server/integrations/source-consents.json',pointer:'/consents/0',sha256:sha('consent'),consent}));
 f.persist(first);
 const second=f.load(),reloaded=second.resolutions.get(area.id);
 assert.equal(reloaded.conflict,false,'the same technical finding is not contradicted by its consent wrapper');
 assert.equal(reloaded.selected.checkedAt,'2026-10-12');
});

test('a newer technical check updates consent underlying evidence while retaining saved current',t=>{
 const f=fixture(t),consent={date:'2026-10-13',scope:['freischaltung']};
 f.json(WORK,[{id:area.id,reason:'HTTP 403',link:'https://alpha.example/ris/',checkedAt:'2026-10-11'}]);
 const first=f.load();
 first.resolutions.set(area.id,applyConsentEvidence(first.resolutions.get(area.id),consent,
  {path:'server/integrations/source-consents.json',pointer:'/consents/0',sha256:sha('consent-register'),consent}));
 const stored=f.persist(first),saved=stored.evidence[area.id].selected;
 f.json(WORK,[{id:area.id,reason:'Öffentliche Dokumentablage gefunden',link:'https://alpha.example/dokumente/',checkedAt:'2026-10-12'}]);
 const second=f.load(),resolution=second.resolutions.get(area.id);
 assert.deepEqual(second.currentEvidence.get(area.id),saved,'saved display evidence remains unchanged');
 assert.equal(resolution.selected.category,'consent');assert.equal(resolution.selected.checkedAt,'2026-10-12');
 assert.equal(resolution.selected.derivedFrom.category,'website');assert.equal(resolution.selected.derivedFrom.origin.kind,'work');
 assert.equal(resolution.selected.derivedFrom.origin.sha256,f.fileHash(WORK));
 assert.equal(resolution.selected.url,'https://alpha.example/dokumente/');
 assert.equal((resolution.selected.reason.match(/Freigabe \(/g)||[]).length,1);
 assert.equal(resolution.decision,'newer-evidence');assert.equal(resolution.conflict,false);
 assert.ok(resolution.alternatives.some(e=>e.origin.kind==='work'&&e.checkedAt==='2026-10-11'));
 f.persist(second);f.remove(WORK);
 const third=f.load().resolutions.get(area.id);
 assert.deepEqual(third.selected,resolution.selected);assert.equal(third.conflict,false);
});
