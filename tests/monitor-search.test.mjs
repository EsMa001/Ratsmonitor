import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {parseMonitorSearch,searchMonitor} from '../server/integrations/monitor-search.mjs';

const catalog=[{id:'billerbeck',kind:'city',name:'Billerbeck',ags:'05558008'},{id:'coesfeld',kind:'district',name:'Kreis Coesfeld',ags:'05558'},{id:'other',kind:'city',name:'Anderer Ort',ags:'05558012'}];
function fixture(){const sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));const put=(id,region='billerbeck',extra={})=>{const t={title:'Schulbau in Dülmen',officialTitle:'Schulbau in Dülmen',shortSummary:'Öffentliche Beratung',committee:'Rat',classification:{method:'title-rules-v2',version:'labels-v2',primary:'bildung',evidence:'Schulbau in Dülmen'},sourceText:'private raw text',documentText:'never expose',...extra};sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run(id,'city','2026-09-20','2026-09-20','consulting',JSON.stringify(t),region);};return {sql,db:sqliteAdapter(sql),put};}
test('monitor search rejects malformed filters and preserves empty radius selections',()=>{
 for(const query of ['area=abc','area=123','page=-1','page=1.5','status=approved%27','level=all','month=2026-13','within=abc','revision=x','page=251','q='+('a'.repeat(201))])assert.throws(()=>parseMonitorSearch(new URLSearchParams(query)));
 assert.deepEqual(parseMonitorSearch(new URLSearchParams('within=')).within,[]);
});
test('real SQL search pages canonicals, separates levels, excludes raw text and rejects stale revisions',async()=>{
 const {sql,db,put}=fixture();try{
 for(let i=0;i<35;i++)put('a'+String(i).padStart(2,'0'));
 put('alias','billerbeck',{identity:{mergedInto:'a00'}});put('county','coesfeld');put('elsewhere','other');
 const before=sql.prepare("SELECT revision FROM data_revisions WHERE id='content'").get().revision;
 const first=await searchMonitor(db,catalog,new URLSearchParams('area=05558008&scope=only&q=dulmen'));
 /* Mit Gebiet werden Gemeinde- und Kreisebene gemeinsam betrachtet: drei Regionen in der Abdeckung */
 assert.equal(first.total,35);assert.equal(first.articles.length,20);assert.equal(first.areaCounts['05558'],37);assert.equal(first.statusCounts.consulting,35);assert.equal(first.themaCounts['Bildung & Betreuung'],35);assert.equal(first.coverage.length,3);
 assert.ok(!JSON.stringify(first).includes('private raw text'));assert.ok(!JSON.stringify(first).includes('documentText'));
 const second=await searchMonitor(db,catalog,new URLSearchParams('area=05558008&scope=only&page=2&revision='+first.revision));assert.equal(second.articles.length,15);assert.equal(new Set([...first.articles,...second.articles].map(a=>a.id)).size,35);
 const county=await searchMonitor(db,catalog,new URLSearchParams('level=district'));assert.equal(county.total,1);assert.equal(county.areaCounts['05558'],1);assert.equal(county.areaCounts[''],1);
 assert.equal((await searchMonitor(db,catalog,new URLSearchParams('within='))).total,0);
 assert.equal((await searchMonitor(db,catalog,new URLSearchParams('within=05558008'))).total,35);
 assert.equal((await searchMonitor(db,catalog,new URLSearchParams('q=%25'))).total,0);
 assert.equal(sql.prepare("SELECT revision FROM data_revisions WHERE id='content'").get().revision,before);
 put('new');await assert.rejects(searchMonitor(db,catalog,new URLSearchParams('revision='+first.revision)),e=>e.status===409);
 }finally{sql.close();}
});
test('several places, alternatives and filler words combine as expected',async()=>{
 const {sql,db,put}=fixture();try{
 for(let i=0;i<3;i++)put('b'+i);put('county','coesfeld');put('elsewhere','other');
 const total=q=>searchMonitor(db,catalog,new URLSearchParams(q)).then(r=>r.total);
 assert.equal(await total('area=05558008&scope=only&q=dulmen'),3);
 /* Gemeinde inklusive ihres Kreises */
 assert.equal(await total('area=05558008&scope=with&q=dulmen'),4);
 /* Weiterer Ort aus der Suche: ODER zwischen den Orten */
 assert.equal(await total('area=05558008&scope=only&more=05558012:only&q=dulmen'),4);
 assert.equal(await total('area=05558008&scope=only&more=05558012:only,05558:only'),5);
 /* Füllwörter werden ignoriert, "oder" trennt Alternativen wie ein Komma */
 assert.equal(await total('area=05558008&scope=only&q=und%20dulmen'),3);
 assert.equal(await total('q=gibtsnicht%20oder%20dulmen'),4);
 assert.equal(await total('q=gibtsnicht%2C%20dulmen'),4);
 assert.equal(await total('q=gibtsnicht%20dulmen'),0);
 for(const bad of ['more=abc:only','more='+Array(9).fill('05558008:only').join(',')])assert.throws(()=>parseMonitorSearch(new URLSearchParams(bad)));
 }finally{sql.close();}
});
test('search finds KI keywords and the long KI summary, not the automatic long text',async()=>{
 const {sql,db,put}=fixture();try{
 const total=q=>searchMonitor(db,catalog,new URLSearchParams(q)).then(r=>r.total);
 put('auto','billerbeck',{generatedBy:'Automatischer Quellenüberblick',longSummary:['Das Thema wird in Billerbeck behandelt. Zuschauertribüne']});
 put('ai','billerbeck',{generatedBy:'KI-Zusammenfassung',longSummary:['Der Zuschuss wurde ausgezahlt.','Die Einweihung plant der Sportverein.']});
 assert.equal(await total('q=sportverein'),1);assert.equal(await total('q=zuschauertribune'),0);
 /* Stichwörter zählen erst mit status completed und werden bei Änderung nachgezogen */
 const kw=status=>JSON.stringify({status,items:[{term:'Sportzentrum Helker Berg',weight:60},{term:'Kostenkalkulation',weight:40}]});
 sql.prepare("UPDATE topics SET payload=json_set(payload,'$.weightedKeywords',json(?)) WHERE id='auto'").run(kw('stale'));
 assert.equal(await total('q=kostenkalkulation'),0);
 sql.prepare("UPDATE topics SET payload=json_set(payload,'$.weightedKeywords',json(?)) WHERE id='auto'").run(kw('completed'));
 assert.equal(await total('q=kostenkalkulation'),1);assert.equal(await total('q=helker%20berg'),1);
 /* Neu gelieferte KI-Langfassung wird ebenfalls nachgezogen */
 sql.prepare("UPDATE topics SET payload=json_set(payload,'$.generatedBy','KI-Zusammenfassung','$.longSummary',json('[\"Neue Fußgängerbrücke\"]')) WHERE id='auto'").run();
 assert.equal(await total('q=fussgangerbrucke'),1);
 }finally{sql.close();}
});
