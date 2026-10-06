import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {coverageOf,dataCoverageSeries} from '../shared/coverage.mjs';
import {adminCoverage,connectedIds} from '../server/integrations/admin-coverage.mjs';
import {adminAtlas} from '../server/integrations/admin-atlas.mjs';
import {CATALOG,POPULATION} from '../shared/catalog.mjs';
import history from '../server/integrations/coverage-history.json' with {type:'json'};
import atlas from '../server/integrations/source-atlas.json' with {type:'json'};
import {ATLAS_CATEGORY_BY_ID} from '../shared/atlas-categories.mjs';
import {ACCESS_BY_ID} from '../shared/source-access.mjs';

// Coverage by areas and population (shared/coverage.mjs), the overview (admin-coverage.mjs) and the gap atlas of the
// administration (admin-atlas.mjs), on an in-memory database with the real migrations.
const root=path.resolve(import.meta.dirname,'..'),sqlite=new DatabaseSync(':memory:');
for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){sqlite.prepare(sql).run(...args);return {success:true};}};},async batch(list){const out=[];for(const s of list)out.push(await s.all());return out;}};
const insert=(id,regionId,firstImportedAt)=>sqlite.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,regionId,'city','2026-09-20','2026-10-01T10:00:00Z','consulting',JSON.stringify({id,regionId,title:'Thema '+id,status:'consulting',updatedAt:'2026-10-01T10:00:00Z',events:[{date:'2026-09-20'}],...(firstImportedAt?{metadata:{firstImportedAt}}:{})}));
const catalog=[{id:'a',kind:'city',ags:'05000001'},{id:'b',kind:'city',ags:'05000002'},{id:'k',kind:'district',ags:'05000'},{id:'c',kind:'city',ags:'09000001'}],population={a:100,b:200,k:300,c:1000};
const landOf=r=>r.ags.slice(0,2);

test('coverageOf counts areas of every kind and population of the municipal level only, per Land',()=>{
 const c=coverageOf(catalog,population,new Set(['a','k','c','x']),landOf);
 assert.deepEqual(c,{areas:3,population:1100,lands:{'05':[2,100],'09':[1,1000]}});
 assert.deepEqual(coverageOf(catalog,population,new Set(),landOf),{areas:0,population:0,lands:{}});
});
test('dataCoverageSeries: an area counts from the day of its first report; undated reports count from the first day',()=>{
 const dataset={days:['2026-10-03','2026-10-01','2026-10-05'],areas:{a:[[1,2],[0,1]],k:[[2,4]],c:[[2,1]],zz:[[0,1]]},undated:{b:3,a:1}};
 assert.deepEqual(dataCoverageSeries(dataset,catalog,population),[{day:'2026-10-01',areas:2,population:300},{day:'2026-10-05',areas:4,population:1300}]);
 assert.deepEqual(dataCoverageSeries({days:[],areas:{},undated:{}},catalog,population),[]);
});
test('the coverage history grows with the catalog and ends at today\'s state of the catalog',()=>{
 assert.ok(history.points.length>=10);
 for(let i=1;i<history.points.length;i++)assert.ok(history.points[i].at>=history.points[i-1].at,'ordered by time');
 const last=history.points.at(-1),now=coverageOf(CATALOG,POPULATION,connectedIds(),r=>r.ags.slice(0,2));
 assert.equal(last.areas,now.areas,'the last point is the current catalog');assert.equal(last.population,now.population);
 assert.equal(history.total.areas,CATALOG.length);
});
test('adminCoverage: totals from the catalog, data from the reports, history from the file',async()=>{
 sqlite.exec('DELETE FROM topics');
 const ids=CATALOG.filter(r=>r.kind==='city').slice(0,3).map(r=>r.id);
 insert('t1',ids[0],'2026-10-02T08:00:00Z');insert('t2',ids[0],'2026-10-03T08:00:00Z');insert('t3',ids[1],'2026-10-04T08:00:00Z');insert('t4',ids[2],null);
 const c=await adminCoverage(db,{now:new Date('2026-10-06T12:00:00Z')});
 assert.equal(c.total.areas,CATALOG.length);assert.equal(c.connected.areas,connectedIds().size);
 assert.equal(c.data.areas,3);assert.equal(c.data.reports,4);assert.equal(c.data.undatedAreas,1);
 assert.deepEqual(c.data.series.map(p=>[p.day,p.areas]),[['2026-10-02',2],['2026-10-04',3]],'the undated area counts from the first day');
 assert.equal(c.data.population,ids.reduce((s,id)=>s+(POPULATION[id]||0),0));
 assert.ok(c.history.points.length>=10);assert.ok(c.lands['05'].name);
});
test('adminAtlas: every area of the catalog with category and access, reports and import state from the database',async()=>{
 sqlite.exec('DELETE FROM topics;DELETE FROM source_coverage');
 const hh='de-02000000',open=Object.keys(atlas.areas).find(id=>atlas.areas[id].c==='blocked');
 insert('h1',hh,'2026-10-06T08:00:00Z');insert('h2',hh,'2026-10-06T08:00:00Z');
 sqlite.prepare('INSERT INTO source_coverage VALUES(?,?)').run(hh,JSON.stringify({method:'scraper',complete:false,importedAt:'2026-10-06T08:00:00Z',lastSuccessAt:'2026-10-06T08:05:00Z',issues:[]}));
 sqlite.prepare('INSERT INTO source_coverage VALUES(?,?)').run('muenster',JSON.stringify({method:'oparl',complete:true,importedAt:'2026-10-05T00:00:00Z',attemptStatus:'failed',issues:['HTTP 503']}));
 const a=await adminAtlas(db,{now:new Date('2026-10-06T12:00:00Z')});
 assert.equal(a.areas.length,CATALOG.length);assert.equal(a.reports,2);
 for(const row of a.areas){assert.ok(ATLAS_CATEGORY_BY_ID[row.c],row.id+' category '+row.c);assert.ok(ACCESS_BY_ID[row.z],row.id+' access '+row.z);if(row.r!==undefined)assert.equal(typeof a.texts[row.r],'string');}
 const hamburg=a.areas.find(x=>x.id===hh);
 assert.equal(hamburg.c,'ok');assert.equal(hamburg.z,'api');assert.equal(hamburg.cnt,2);assert.equal(hamburg.st,'partial');assert.equal(hamburg.last,'2026-10-06T08:05:00.000Z'.replace('.000',''));assert.ok(hamburg.v&&hamburg.rn&&hamburg.u);
 const muenster=a.areas.find(x=>x.id==='muenster');assert.equal(muenster.c,'ok');assert.equal(muenster.z,'oparl');assert.equal(muenster.st,'failed');assert.equal(muenster.cnt,undefined);
 const blocked=a.areas.find(x=>x.id===open);assert.equal(blocked.c,'blocked');assert.equal(typeof a.texts[blocked.r],'string');assert.equal(blocked.cnt,undefined);
 assert.ok(a.categories.some(c=>c.id==='ok')&&a.access.some(x=>x.id==='oparl')&&a.lands['02'].short);
});
