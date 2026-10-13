import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildConnectionWorklist,createConnectionBaseline,renderConnectionWorklist} from '../scripts/source-discovery/connection-worklist.mjs';
import {configuredAtlasSources,atlasCategory} from '../server/integrations/atlas-sources.mjs';
import {loadAtlasInputs} from '../scripts/source-discovery/atlas-inputs.mjs';
import {CATALOG} from '../shared/catalog.mjs';

const region=(id,extra={})=>({id,name:'Gemeinde '+id,kind:'city',ags:'09175001',...extra});
const evidence=(id,extra={})=>({id,category:'website',access:'none',reason:'Sitzungsunterlagen nur auf der Gemeinde-Website',url:'https://gemeinde.example/unterlagen',checkedAt:null,dateBasis:'unknown',dateCandidates:[],origin:{kind:'atlas',path:'source-atlas.json',pointer:'/areas/'+id,sha256:'a'.repeat(64),documentBuiltAt:'2026-10-09',documentReportDate:'06.10.2026'},dateIssues:[],...extra});
function fixture(catalog,edits={}){
 const currentEvidence=new Map(catalog.map(r=>[r.id,evidence(r.id)]));
 return {atlas:{builtAt:'2026-10-09',reportDate:'06.10.2026',areas:Object.fromEntries(catalog.map(r=>[r.id,{c:'website',u:'https://gemeinde.example/atlas'}]))},sources:configuredAtlasSources([],[]),currentEvidence,resolutions:new Map(),manifest:[{path:'source-atlas.json',sha256:'a'.repeat(64),present:true,role:'atlas'}],diagnostics:[],reportDate:'06.10.2026',...edits};
}

test('selection uses the current admin category, keeps pending sources off and excludes active, ready and non-website areas',()=>{
 const catalog=['active','ready','pending','blocked','stale','website'].map(id=>region(id));
 const inputs=fixture(catalog);
 inputs.sources=configuredAtlasSources([{id:'active',method:'scraper'},{id:'ready',method:'oparl',checkPending:'Prüfung offen'},{id:'pending',method:'pending'}],[{id:'pending',method:'scraper'}]);
 inputs.atlas.areas.blocked.c='blocked';inputs.atlas.areas.stale.c='ok';
 const result=buildConnectionWorklist(inputs,{catalog});
 assert.deepEqual(result.records.map(r=>r.id),['pending','website']);
 assert.equal(result.totals.configured,2);
 assert.ok(result.records.every(r=>r.connectionState==='not-configured'));
});

test('original current reasons, addresses and unknown check dates survive newer comparison evidence',()=>{
 const catalog=[region('a')],inputs=fixture(catalog),stored=evidence('a',{reason:'Scan-PDF ohne Textebene; öffentliche Abschnitte ungeklärt'});
 inputs.currentEvidence.set('a',stored);
 inputs.resolutions.set('a',{selected:evidence('a',{category:'blocked',reason:'Neuerer anderer Grund',checkedAt:'2026-10-12'}),alternatives:[stored],conflict:true,decision:'newer-evidence'});
 const result=buildConnectionWorklist(inputs,{catalog}),record=result.records[0];
 assert.deepEqual(record.evidence,stored);
 assert.equal(record.evidence.checkedAt,null);
 assert.equal(record.atlasUrl,'https://gemeinde.example/atlas');
 assert.equal(record.evidence.url,'https://gemeinde.example/unterlagen');
 assert.equal(record.problem.primary,'05');
 assert.equal(record.comparison.selected.reason,'Neuerer anderer Grund');
 assert.equal(record.comparison.conflict,true);
 assert.match(renderConnectionWorklist(result),/unbekannt/);
 assert.deepEqual(inputs.currentEvidence.get('a'),stored,'building does not mutate the source evidence');
});

test('stored reasons map to actionable groups without treating every unknown case as a missing reader',()=>{
 const catalog=['scan','public','unreadable','period','generic','unknown','shared','zero'].map(id=>region(id)),inputs=fixture(catalog);
 const reasons={scan:'Scan-PDF ohne Textebene',public:'Tagesordnung ohne erkennbaren Öffentlichkeitsnachweis',unreadable:'Dokumente nicht lesbar',period:'keine Sitzungsseite oder keine Sitzungsunterlagen im Zeitraum',generic:'Sitzungstermine oder Unterlagen stehen nur als Webseite oder PDF auf der Gemeinde-Website, kein Ratsinformationssystem',unknown:'Seite nennt ein Ratsinformationssystem, bei der Prüfung aber kein lesbares System erkannt',shared:'Gemeinsame Veröffentlichung; Dokumente nicht lesbar',zero:'Bekanntmachungen gefunden, aber keine öffentlichen Tagesordnungspunkte lesbar (0 ohne erkennbaren öffentlichen Teil, 1 nicht lesbar)'};
 for(const [id,reason] of Object.entries(reasons))inputs.currentEvidence.set(id,evidence(id,{reason}));
 const result=buildConnectionWorklist(inputs,{catalog}),by=new Map(result.records.map(r=>[r.id,r.problem]));
 assert.deepEqual(Object.fromEntries([...by].map(([id,p])=>[id,p.primary])),{generic:'02',period:'08',public:'06',scan:'05',shared:'04',unknown:'08',unreadable:'04',zero:'08'});
 assert.deepEqual(by.get('shared').additional,['07']);
 assert.ok([...by.values()].every(p=>p.nextStep&&p.basis==='stored-reason'));
});

test('records distinguish municipality, association and district; snapshots are canonically hashed and sorted',()=>{
 const catalog=[region('z'),region('a',{members:[{name:'Mitglied',ags:'09175002'}],ags:'091755001'}),region('k',{kind:'district',ags:'09175'})],inputs=fixture(catalog);
 inputs.manifest.push({role:'catalog',present:true,sha256:'b'.repeat(64),path:'catalog.json'});
 const first=buildConnectionWorklist(inputs,{catalog});
 const reversed={...inputs,manifest:[...inputs.manifest].reverse(),currentEvidence:new Map([...inputs.currentEvidence].reverse())};
 const second=buildConnectionWorklist(reversed,{catalog:[...catalog].reverse()});
 assert.deepEqual(first,second);
 assert.deepEqual(first.records.map(r=>[r.id,r.level]),[['a','association'],['k','district'],['z','municipality']]);
 assert.match(first.snapshotId,/^[a-f0-9]{64}$/);
 const changed={...inputs,manifest:inputs.manifest.map(m=>({...m,sha256:'c'.repeat(64)}))};
 assert.notEqual(buildConnectionWorklist(changed,{catalog}).snapshotId,first.snapshotId);
});

test('baseline differences explain connected, recategorized and catalog removals, additions and changed evidence',()=>{
 const original=['connected','recategorized','removed','kept'].map(id=>region(id)),before=fixture(original);
 const baseline=createConnectionBaseline(buildConnectionWorklist(before,{catalog:original}));
 const catalog=['connected','recategorized','kept','added'].map(id=>region(id)),inputs=fixture(catalog);
 inputs.sources=configuredAtlasSources([{id:'connected',method:'scraper'}],[]);
 inputs.atlas.areas.recategorized.c='blocked';
 inputs.currentEvidence.set('kept',evidence('kept',{reason:'Scan-PDF ohne Textebene'}));
 const after=buildConnectionWorklist(inputs,{catalog,baseline}),d=after.baselineDiff;
 assert.deepEqual(d.added,[{id:'added',name:'Gemeinde added',explanation:'entered-website-category'}]);
 assert.deepEqual(d.removed.map(r=>[r.id,r.explanation]),[['connected','connected'],['recategorized','recategorized'],['removed','removed-from-catalog']]);
 assert.deepEqual(d.changedEvidence.map(r=>r.id),['kept']);
 assert.equal(baseline.initialIds.length,4);
 assert.equal(d.baselineId,baseline.baselineId);
 assert.deepEqual(after,buildConnectionWorklist(inputs,{catalog,baseline}));
});

test('missing current evidence fails visibly instead of inventing a reason or check date',()=>{
 const catalog=[region('a')],inputs=fixture(catalog);inputs.currentEvidence.delete('a');
 assert.throws(()=>buildConnectionWorklist(inputs,{catalog}),/Aktueller Atlasbeleg fehlt: a/);
});

test('missing publication addresses have a concrete first step without replacing the original reason group',()=>{
 const catalog=[region('missing'),region('known')],inputs=fixture(catalog);
 inputs.atlas.areas.missing.u='';inputs.currentEvidence.set('missing',evidence('missing',{url:''}));
 const snapshot=buildConnectionWorklist(inputs,{catalog}),record=snapshot.records.find(row=>row.id==='missing');
 assert.equal(record.problem.primary,'02');
 assert.equal(record.problem.addressMissing,true);
 assert.match(record.problem.nextStep,/Amtliche Website und konkrete Veröffentlichungsseite zuerst belegen/);
 assert.equal(snapshot.records.find(row=>row.id==='known').problem.addressMissing,false);
 assert.equal(snapshot.totals.addressMissing,1);
 assert.match(renderConnectionWorklist(snapshot),/1 Gebiete ohne gespeicherte Veröffentlichungsadresse/);
});

test('baseline hashes separate changed findings from full evidence provenance revisions',()=>{
 const catalog=[region('a')],inputs=fixture(catalog),original=buildConnectionWorklist(inputs,{catalog});
 const baseline=createConnectionBaseline(original),changed=fixture(catalog);
 changed.currentEvidence.set('a',evidence('a',{origin:{...evidence('a').origin,sha256:'b'.repeat(64)}}));
 const provenance=buildConnectionWorklist(changed,{catalog,baseline});
 assert.deepEqual(provenance.baselineDiff.changedEvidence,[]);
 assert.deepEqual(provenance.baselineDiff.changedProvenance.map(row=>row.id),['a']);
 assert.equal(createConnectionBaseline(provenance).evidenceBasisHash,baseline.evidenceBasisHash);
 assert.notEqual(createConnectionBaseline(provenance).provenanceBasisHash,baseline.provenanceBasisHash);
 changed.currentEvidence.set('a',evidence('a',{reason:'Scan-PDF ohne Textebene'}));
 assert.deepEqual(buildConnectionWorklist(changed,{catalog,baseline}).baselineDiff.changedEvidence.map(row=>row.id),['a']);
 for(const [field,value] of [['url','https://new.example/'],['access','html'],['category','noreader'],['checkedAt','2026-10-12'],['dateBasis','checkedAt'],['dateCandidates',['2026-10-12']]]){
  changed.currentEvidence.set('a',evidence('a',{[field]:value}));
  assert.deepEqual(buildConnectionWorklist(changed,{catalog,baseline}).baselineDiff.changedEvidence.map(row=>row.id),['a'],field);
 }
});

test('Markdown source links preserve existing percent escapes and encode unsafe URL characters once',()=>{
 const catalog=[region('a')],inputs=fixture(catalog);
 inputs.atlas.areas.a.u='https://example.org/Einladung%20Rat.pdf?x=a b|c\\d<>#teil';
 const markdown=renderConnectionWorklist(buildConnectionWorklist(inputs,{catalog}));
 assert.ok(markdown.includes('[Quelle](<https://example.org/Einladung%20Rat.pdf?x=a%20b%7Cc%5Cd%3C%3E#teil>)'));
 assert.ok(!markdown.includes('%2520'));
});

test('the real work list follows the current admin categories without freezing the initial case count',()=>{
 const inputs=loadAtlasInputs(),snapshot=buildConnectionWorklist(inputs,{catalog:CATALOG});
 const expected=CATALOG.filter(region=>atlasCategory(region.id,inputs.atlas.areas[region.id],inputs.sources)==='website').map(region=>region.id).sort();
 assert.deepEqual(snapshot.records.map(r=>r.id),expected);
 assert.equal(new Set(snapshot.records.map(r=>r.id)).size,expected.length);
 assert.equal(snapshot.totals.configured,CATALOG.filter(region=>['ok','ready'].includes(atlasCategory(region.id,inputs.atlas.areas[region.id],inputs.sources))).length);
 for(const record of snapshot.records)assert.deepEqual(record.evidence,inputs.currentEvidence.get(record.id));
});

test('CLI repeats byte-identically and --init-baseline never replaces an existing baseline',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-connection-worklist-'));
 try{
  const cli=path.resolve('scripts/source-discovery/connection-worklist.mjs');
  const run=()=>{const r=spawnSync(process.execPath,[cli,'--out',dir,'--init-baseline'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);};
  run();
  const names=['website-arbeitsliste.json','website-arbeitsliste.md','baseline-website.json'];
  const first=names.map(name=>fs.readFileSync(path.join(dir,name),'utf8'));
  const oldTime=new Date('2020-01-01T00:00:00Z');fs.utimesSync(path.join(dir,'baseline-website.json'),oldTime,oldTime);
  const baselineTime=fs.statSync(path.join(dir,'baseline-website.json')).mtimeMs;
  run();
  assert.deepEqual(names.map(name=>fs.readFileSync(path.join(dir,name),'utf8')),first);
  assert.equal(fs.statSync(path.join(dir,'baseline-website.json')).mtimeMs,baselineTime);
  assert.deepEqual(JSON.parse(first[2]).initialIds,JSON.parse(first[0]).records.map(record=>record.id));
  assert.match(first[1],/Vollständige Arbeitsliste/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
