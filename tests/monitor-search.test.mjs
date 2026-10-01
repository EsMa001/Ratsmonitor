import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {parseMonitorSearch,searchMonitor} from '../server/integrations/monitor-search.mjs';

const catalog=[{id:'billerbeck',kind:'city',name:'Billerbeck',ags:'05558008'},{id:'coesfeld',kind:'district',name:'Kreis Coesfeld',ags:'05558'},{id:'other',kind:'city',name:'Anderer Ort',ags:'05558012'}];
function fixture(){const sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));const put=(id,region='billerbeck',extra={})=>{const t={title:'Schulbau in Dülmen',officialTitle:'Schulbau in Dülmen',shortSummary:'Öffentliche Beratung',committee:'Rat',classification:{method:'title-rules-v2',version:'labels-v2',primary:'bildung',evidence:'Schulbau in Dülmen'},sourceText:'private raw text',documentText:'never expose',...extra};sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run(id,'city','2026-09-20','2026-09-20','consulting',JSON.stringify(t),region);};return {sql,db:sqliteAdapter(sql),put};}
test('monitor search rejects malformed filters and preserves empty radius selections',()=>{
 for(const query of ['area=abc','area=123','page=-1','page=1.5','status=approved%27','level=all','month=2026-13','within=abc','revision=x','q='+('a'.repeat(201))])assert.throws(()=>parseMonitorSearch(new URLSearchParams(query)));
 assert.deepEqual(parseMonitorSearch(new URLSearchParams('within=')).within,[]);
});
test('real SQL search pages canonicals, separates levels, excludes raw text and rejects stale revisions',async()=>{
 const {sql,db,put}=fixture();try{
 for(let i=0;i<35;i++)put('a'+String(i).padStart(2,'0'));
 put('alias','billerbeck',{identity:{mergedInto:'a00'}});put('county','coesfeld');put('elsewhere','other');
 const before=sql.prepare("SELECT revision FROM data_revisions WHERE id='content'").get().revision;
 const first=await searchMonitor(db,catalog,new URLSearchParams('area=05558008&q=dulmen'));
 assert.equal(first.total,35);assert.equal(first.articles.length,30);assert.equal(first.areaCounts['05558'],36);assert.equal(first.statusCounts.consulting,35);assert.equal(first.themaCounts['Bildung & Betreuung'],35);assert.equal(first.coverage.length,2);
 assert.ok(!JSON.stringify(first).includes('private raw text'));assert.ok(!JSON.stringify(first).includes('documentText'));
 const second=await searchMonitor(db,catalog,new URLSearchParams('area=05558008&page=2&revision='+first.revision));assert.equal(second.articles.length,5);assert.equal(new Set([...first.articles,...second.articles].map(a=>a.id)).size,35);
 const county=await searchMonitor(db,catalog,new URLSearchParams('level=district'));assert.equal(county.total,1);assert.equal(county.areaCounts['05558'],1);assert.equal(county.areaCounts[''],1);
 assert.equal((await searchMonitor(db,catalog,new URLSearchParams('within='))).total,0);
 assert.equal((await searchMonitor(db,catalog,new URLSearchParams('within=05558008'))).total,35);
 assert.equal((await searchMonitor(db,catalog,new URLSearchParams('q=%25'))).total,0);
 assert.equal(sql.prepare("SELECT revision FROM data_revisions WHERE id='content'").get().revision,before);
 put('new');await assert.rejects(searchMonitor(db,catalog,new URLSearchParams('revision='+first.revision)),e=>e.status===409);
 }finally{sql.close();}
});
