import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {QUALITY_CHECKS} from '../shared/quality-checks.mjs';
import {runQualityCheck,storedQualityChecks} from '../server/integrations/quality-check.mjs';
import {startBuild,stepBuild} from '../server/integrations/admin-builds.mjs';
import {provider} from '../server/integrations/pipeline-jobs.mjs';
import {CATALOG} from '../shared/catalog.mjs';

// The quality checks run in steps over chunks of areas (admin-builds.mjs) and give what the check over the whole stock
// gave: counts, groups and examples.
const root=path.resolve(import.meta.dirname,'..');
const TITLE='Bebauungsplan Nr. 7 „Am Mühlenweg“, Satzungsbeschluss';
// Two areas on one server (a unit of "same address under several areas") and areas on servers of their own.
const shared=(()=>{const by=new Map();for(const r of CATALOG){const p=provider(r.id);if(p.startsWith('area:'))continue;if(!by.has(p))by.set(p,[]);by.get(p).push(r.id);}return [...by.values()].find(l=>l.length>=2).slice(0,2);})();
const AREAS=[...shared,'billerbeck','coesfeld','muenster','warendorf'];
function stock(){
 const raw=new DatabaseSync(':memory:');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())raw.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
 const put=raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 const insert=(id,extra={},{region='billerbeck',date='2026-09-17',column}={})=>{const t={id,regionId:region,source:'city',title:TITLE,officialTitle:TITLE,eventDate:date,events:[{date,committee:'Rat'}],documents:[{title:'Vorlage',url:'https://example.org/v.pdf',kind:'pdf'}],identity:{version:'official-records-v1'},...extra};put.run(id,region,'city',column??date,'2026-10-01T00:00:00Z','unknown',JSON.stringify(t));};
 let k=0;
 for(const [i,region] of AREAS.entries()){
  for(let j=0;j<4;j++)insert('clean-'+region+'-'+j,{title:'Haushaltssatzung '+j+' für das Jahr 2027 der Gemeinde',officialTitle:'Haushaltssatzung '+j+' für das Jahr 2027 der Gemeinde'},{region,date:'2026-09-'+String(10+j).padStart(2,'0')});
  insert('empty-'+i,{title:'',officialTitle:''},{region});
  insert('cut-'+i,{title:'Vollzug des Baugesetzbuches (BauGB);',officialTitle:'Vollzug des Baugesetzbuches (BauGB);'},{region,date:'2026-08-0'+(1+i)});
  insert('noev-'+i,{events:[]},{region});
  insert('mismatch-'+i,{eventDate:'2026-09-30'},{region});
  insert('nourl-'+i,{documents:[{title:'Anlage',kind:'pdf'}]},{region});
  insert('conflict-'+i,{identity:{conflict:true}},{region});
  if(i%2){insert('alias-missing-'+i,{identity:{mergedInto:'nowhere-'+i}},{region});insert('alias-chain-'+i,{identity:{mergedInto:'alias-missing-'+i}},{region});}
  for(let j=0;j<i%3+2;j++)insert('meeting-'+i+'-'+j,{title:'Bestellung der Schiedsperson für den Bezirk Mitte',officialTitle:'Bestellung der Schiedsperson für den Bezirk Mitte'},{region,date:'2026-07-15'});
  k++;
 }
 // Bad meeting date only in the last area (a chunk without it counts nothing).
 insert('baddate',{},{region:'warendorf',column:'2026-13-45'});
 // The same source address with the same title in the two areas of one server.
 for(const [i,region] of shared.entries())for(let j=0;j<=i;j++)insert('shared-'+i+'-'+j,{sourceUrl:'https://ris.example.org/vo?1'},{region});
 // The same address under two areas on different servers (found per host, as over the whole stock).
 insert('cross-a',{sourceUrl:'https://cross.example.org/vo?9'},{region:'muenster'});insert('cross-b',{sourceUrl:'https://cross.example.org/vo?9'},{region:'billerbeck'});
 raw.prepare('INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES(?,?,?,?)').run('v1','gone','2026-10-01','{}');
 return {raw,db:sqliteAdapter(raw)};
}
const bySample=s=>JSON.stringify([s.regionId??'',s.date??'',s.url??'',s.id??'',(s.ids||[]).slice().sort()]);
const normal=r=>({count:r.count,groups:r.groups,samples:(r.samples||[]).map(s=>({...s,ids:s.ids?.slice().sort(),regions:s.regions?.slice().sort()})).sort((a,b)=>bySample(a)<bySample(b)?-1:1)});

test('every check run in chunks of one or two areas equals the check over the whole stock',async()=>{
 const {db}=stock();
 const whole={};for(const c of QUALITY_CHECKS)whole[c.id]=normal(await runQualityCheck(db,c.id));
 assert.ok(Object.values(whole).filter(r=>r.count>0).length>=10,'the fixture finds something in most checks');
 await startBuild(db,'quality:all');
 let r,steps=0;do{r=await stepBuild(db,'quality:all',{budgetMs:0,chunkRows:12});steps++;}while(r.state==='running');
 assert.equal(r.state,'done');assert.ok(steps>AREAS.length/2,'steps: '+steps);
 const stored=await storedQualityChecks(db);
 for(const c of QUALITY_CHECKS){
  const got=stored.checks[c.id];assert.ok(got,c.id);
  assert.deepEqual(normal(got),whole[c.id],c.id);
  assert.equal(got.stale,false,c.id);assert.equal(typeof got.stockSum,'number');
 }
});

test('a single check runs as its own build; a chunk without the defect counts nothing',async()=>{
 const {db}=stock();
 await startBuild(db,'quality:badEventDate');
 const first=await stepBuild(db,'quality:badEventDate',{budgetMs:0,chunkRows:12});
 assert.equal(first.state,'running');
 const {checks:none}=await storedQualityChecks(db);assert.equal(none.badEventDate,undefined,'not stored before the build is done');
 let r;do{r=await stepBuild(db,'quality:badEventDate',{budgetMs:0,chunkRows:12});}while(r.state==='running');
 const {checks}=await storedQualityChecks(db);
 assert.equal(checks.badEventDate.count,1);assert.deepEqual(checks.badEventDate.samples.map(s=>s.id),['baddate']);
});

test('a stored result without stockSum (former version) or from before a change counts as stale',async()=>{
 const {raw,db}=stock();
 await runQualityCheck(db,'emptyTitle');
 assert.equal((await storedQualityChecks(db)).checks.emptyTitle.stale,false);
 raw.prepare("UPDATE system_state SET value=json_remove(value,'$.checks.emptyTitle.stockSum') WHERE key='admin-quality-check'").run();
 assert.equal((await storedQualityChecks(db)).checks.emptyTitle.stale,true);
 await runQualityCheck(db,'emptyTitle');
 raw.prepare("UPDATE topics SET status='approved' WHERE id='empty-0'").run();
 assert.equal((await storedQualityChecks(db)).checks.emptyTitle.stale,true);
});
