import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {loadAdminData} from '../server/integrations/admin-data.mjs';
import {refreshRegionFacts} from '../server/integrations/region-facts.mjs';
import {staticAreas,buildAreas,areaNotes,AREA_FIELDS} from '../server/integrations/admin-areas.mjs';
import {toSources} from '../shared/admin-areas.mjs';
import {CATALOG} from '../shared/catalog.mjs';

// The parts (static + areas + adapter) give what the former overview gave as `sources`, except for the notes.
const root=path.resolve(import.meta.dirname,'..');
const now=new Date('2026-10-08T12:00:00Z');
function stock(){
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
 const put=(id,region,extra={})=>sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,region,'city','2026-09-20','2026-10-07T00:00:00Z','consulting',JSON.stringify({id,regionId:region,title:'T',events:[{date:'2026-09-20'}],documents:[],classification:{primary:'unklar'},...extra}));
 put('a','billerbeck');put('b','billerbeck',{contentAnalysis:{status:'stale'},metadata:{lastFetchedAt:'2026-10-06T10:00:00Z',lastProcessedAt:'2026-10-07T11:00:00Z'}});put('c','muenster');put('d','de-02000000',{generatedBy:'KI-Zusammenfassung'});
 const cov=(id,v)=>sql.prepare('INSERT INTO source_coverage VALUES(?,?)').run(id,JSON.stringify(v));
 cov('billerbeck',{method:'scraper',complete:false,importedAt:'2026-10-01T00:00:00Z',issues:['Teilabruf','zweiter Hinweis'],warnings:['Warnung']});
 cov('muenster',{method:'oparl',complete:true,lastSuccessAt:'2026-10-07T00:00:00Z',attemptStatus:'failed',issues:[],sourceUrl:'https://oparl.example/system'});
 cov('de-02000000',{method:'ckan',complete:true,importedAt:'2026-10-08T00:00:00Z'});
 return sqliteAdapter(sql);
}
// sourceUrl of the coverage notes is read with the notes of an area; the list carries only the configured address.
const without=({issues,warnings,issueCount,warningCount,sourceUrl,...rest})=>rest;
const norm=x=>JSON.parse(JSON.stringify(x));

test('static list and rows give the former `sources`, without the notes',async()=>{
 const db=stock();await refreshRegionFacts(db,{budgetMs:1e9,now});
 const old=await loadAdminData(db,{now,review:false});
 const parts=toSources(norm(staticAreas()),norm(await buildAreas(db,{now})));
 assert.equal(parts.length,CATALOG.length);
 assert.deepEqual(norm(parts.map(without)),norm(old.sources.map(without)));
 const cb=parts.find(s=>s.id==='billerbeck');assert.equal(cb.issueCount,2);assert.equal(cb.warningCount,1);
 assert.equal(old.sources.find(s=>s.id==='billerbeck').issues.length,2);
});

test('notes of one area come from its row; the address of an unconnected area stays empty',async()=>{
 const db=stock();
 const bb=await areaNotes(db,'billerbeck');
 assert.deepEqual([bb.issues,bb.warnings],[['Teilabruf','zweiter Hinweis'],['Warnung']]);
 assert.equal((await areaNotes(db,'muenster')).sourceUrl,'https://oparl.example/system','the note of the coverage wins over the configured address');
 const borken=await areaNotes(db,'borken');
 assert.deepEqual([borken.issues,borken.warnings],[[],[]]);
});

test('the static part is the same for the same deploy and small; rows carry every field',async()=>{
 const a=staticAreas(),b=staticAreas();assert.equal(a.v,b.v);assert.match(a.v,/^[0-9a-f]+$/);
 const db=stock();const areas=await buildAreas(db,{now});
 assert.deepEqual(areas.fields,AREA_FIELDS);assert.equal(areas.rows.length,CATALOG.length);assert.ok(areas.rows.every(r=>r.length===AREA_FIELDS.length));
 assert.equal(areas.staticVersion,a.v);
 assert.ok(JSON.stringify(areas.rows).length<1500000,'rows stay compact: '+JSON.stringify(areas.rows).length);
 assert.ok(JSON.stringify(a).length<2500000,'static part: '+JSON.stringify(a).length);
});

test('the summary leaves out the list of areas and does not read the coverage notes',async()=>{
 const db=stock();const asked=[];
 const watched={prepare(q){asked.push(q);return db.prepare(q);},batch:s=>db.batch(s)};
 const summary=await loadAdminData(watched,{now,review:false,sources:false});
 assert.deepEqual(summary.sources,[]);assert.ok(summary.counts.online>0);
 assert.ok(!asked.some(q=>/FROM source_coverage$/.test(q.trim())),'no read of all notes');
});
