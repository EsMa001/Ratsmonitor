import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import catalog from '../shared/nds-regions.json' with {type:'json'};
import population from '../shared/nds-population.json' with {type:'json'};
import map from '../public/geo/germany.json' with {type:'json'};
import {CATALOG,LANDS} from '../shared/catalog.mjs';
import {matchesBody} from '../server/integrations/body-identity.mjs';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {searchMonitor} from '../server/integrations/monitor-search.mjs';

test('Niedersachsen: 403 administrative units and 37 districts with unique keys, parents, geometry and population',()=>{
 const cities=catalog.filter(r=>r.kind==='city'),districts=catalog.filter(r=>r.kind==='district');
 assert.equal(cities.length,403);assert.equal(districts.length,37);assert.equal(cities.filter(r=>r.members).length,114);assert.equal(cities.filter(r=>r.independent).length,8);
 assert.equal(new Set(catalog.map(r=>r.ags)).size,440);assert.equal(new Set(catalog.map(r=>r.id)).size,440);
 for(const r of catalog){
  assert.match(r.id,/^nds-03\d{3}(\d{3,4})?$/);assert.ok(map.regions.some(g=>g.id===r.id&&g.kind===r.kind),r.id);assert.ok(population[r.id]>0,r.id);
  if(r.district&&r.kind==='city')assert.ok(catalog.some(d=>d.id===r.district&&d.kind==='district'),r.id);
  if(r.members){assert.equal(r.ags.length,9);assert.ok(r.members.length>=2);assert.ok(r.members.every(m=>/^\d{8}$/.test(m.ags)&&m.ags.startsWith(r.ags.slice(0,5))));}else assert.equal(r.ags.length,r.kind==='city'?8:5);
 }
 /* Region Hannover ist ein Kreis, die Stadt Hannover gehört dazu */
 assert.equal(catalog.find(r=>r.ags==='03241').name,'Region Hannover');assert.equal(catalog.find(r=>r.ags==='03241001').district,'nds-03241');
 /* Jede Gemeinde gehört zu höchstens einem Gebiet */
 const members=cities.flatMap(r=>r.members?r.members.map(m=>m.ags):[r.ags]);assert.equal(new Set(members).size,members.length);
 assert.deepEqual(LANDS.map(l=>l.id),['05','03']);assert.equal(new Set(CATALOG.map(r=>r.id)).size,CATALOG.length);
});
test('OParl bodies of Samtgemeinden and Einheitsgemeinden are matched by their regional key',()=>{
 const sg=catalog.find(r=>r.id==='nds-033585401'),town=catalog.find(r=>r.id==='nds-03101000');
 assert.ok(matchesBody({name:'Samtgemeinde Ahlden',ags:'033585401000'},sg));
 assert.ok(matchesBody({name:'Ahlden',ags:'33585401000'},sg),'12-digit key without the leading zero');
 assert.ok(!matchesBody({name:'Gemeinde Hodenhagen',ags:'033585401014'},sg),'a member council is not the Samtgemeinde');
 assert.ok(!matchesBody({name:'Samtgemeinde Ahlden',ags:'033585402000'},sg));
 assert.ok(matchesBody({name:'Stadt Braunschweig',ags:'031010000000'},town));
 assert.ok(matchesBody({name:'Samtgemeinde Ahlden'},sg),'without key the name decides');
});
test('a member municipality finds the reports of its Samtgemeinde, and the map shows them on every member',async()=>{
 const sql=new DatabaseSync(':memory:');try{
  for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const put=(id,region)=>sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run(id,'city','2026-09-20','2026-09-20','consulting',JSON.stringify({title:'Schulbau',shortSummary:'',committee:'Rat'}),region);
  put('a','nds-033585401');put('b','nds-033585401');put('c','nds-03101000');
  const db=sqliteAdapter(sql),total=q=>searchMonitor(db,CATALOG,new URLSearchParams(q));
  /* Hodenhagen (03358014) ist Mitglied der Samtgemeinde Ahlden */
  assert.equal((await total('area=03358014&scope=only')).total,2);
  assert.equal((await total('area=03358&scope=with')).total,2);
  assert.equal((await total('area=03&scope=with')).total,3);
  assert.equal((await total('within=03358014,03101000')).total,3);
  const all=await total('level=city');assert.equal(all.areaCounts['03358014'],2);assert.equal(all.areaCounts['03358'],2);assert.equal(all.areaCounts['03'],3);
  assert.ok(all.coverage.some(c=>c.ags==='03358014'&&c.count===2&&/Samtgemeinde Ahlden/.test(c.name)));
  /* Langelsheim (seit 2021 mit Hahausen, Lutter, Wallmoden) steht auf der Karte noch unter den früheren Schlüsseln */
  put('d','nds-03153019');
  assert.equal((await total('area=03153009&scope=only')).total,1);
  const merged=await total('level=city');assert.equal(merged.areaCounts['03153007'],1);assert.ok(merged.coverage.some(c=>c.ags==='03153014'));
 }finally{sql.close();}
});
test('every Lower Saxon source belongs to exactly one catalog area and is verified',async()=>{
 const {default:sources}=await import('../server/integrations/nds-sources.json',{with:{type:'json'}});
 assert.ok(sources.length>=200);
 const addresses=new Set();
 for(const s of sources){
  const r=catalog.find(x=>x.id===s.id);assert.ok(r,s.id);assert.equal(s.name,r.name);assert.equal(s.kind,r.kind);
  assert.ok(['oparl','scraper','official-api'].includes(s.method),s.id);assert.match(s.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);
  const key=(s.system||s.base)+'|'+(s.body||'');assert.ok(!addresses.has(key),'address used twice: '+key);addresses.add(key);
 }
});
