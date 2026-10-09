import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {refreshRegionFacts} from '../server/integrations/region-facts.mjs';
import {loadAdminData,adminReview} from '../server/integrations/admin-data.mjs';
import {adminCoverage} from '../server/integrations/admin-coverage.mjs';
import {adminAtlas} from '../server/integrations/admin-atlas.mjs';
import {adminTimeline} from '../server/integrations/admin-timeline.mjs';
import {refreshStatus} from '../server/integrations/admin-refresh.mjs';

// Rule R1 of requirements/admin-performance-konzept.md: what a page asks for only reads, and never reads into the stored
// reports beyond one area. Computing happens in region-facts.mjs (after imports and in catch-up steps).
const root=path.resolve(import.meta.dirname,'..');
const canonical="json_extract(payload,'$.identity.mergedInto') IS NULL";
// A query into the reports is allowed if it is limited to some areas, walks an index with a limit, or only counts on
// the partial index of canonical reports.
const allowed=q=>/region_id IN \(SELECT value FROM json_each\(\?\)\)|region_id IN \(\?|region_id=\?|INDEXED BY idx_topics_canonical_updated/.test(q)||!q.split(canonical).join('').includes('payload');

test('admin pages only read and never read every stored report',async()=>{
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
 const base=sqliteAdapter(sql),now=new Date('2026-10-08T12:00:00Z');
 for(let i=0;i<30;i++){const area=['billerbeck','muenster','de-02000000'][i%3];sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run('t'+i,area,'city','2026-09-20','2026-10-01T00:00:00Z',i%4?'consulting':'unknown',JSON.stringify({id:'t'+i,regionId:area,title:'T'+i,events:[{date:'2026-09-20'}],documents:[],classification:{primary:i%2?'unklar':'bildung'},metadata:{firstImportedAt:'2026-10-01T00:00:00Z'}}));}
 await refreshRegionFacts(base,{budgetMs:1e9,now});
 /* One area changed after the computation: pages must not compute it */
 sql.prepare("UPDATE topics SET status='approved' WHERE id='t0'").run();
 const asked=[];
 const readOnly={prepare(q){asked.push(q);if(/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q))throw Error('write from a page: '+q.slice(0,80));return base.prepare(q);},batch:s=>base.batch(s)};
 const overview=await loadAdminData(readOnly,{now});
 assert.equal(overview.statsPending,1,'the changed area is reported as pending, not computed');
 await adminCoverage(readOnly,{now});await adminAtlas(readOnly,{now});
 for(const basis of ['event','import'])await adminTimeline(readOnly,{basis,now});
 for(const issue of ['labels','status','identity','summaries'])await adminReview(readOnly,issue,'all');
 await adminReview(readOnly,'labels','billerbeck');
 await refreshStatus(readOnly,{now});
 const intoReports=asked.filter(q=>/FROM topics\b/.test(q));
 assert.ok(intoReports.length>0);
 const unbounded=intoReports.filter(q=>!allowed(q));
 assert.deepEqual(unbounded,[],'queries over all reports');
});
