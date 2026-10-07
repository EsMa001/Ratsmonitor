import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {knowledgeGraph,parseGraph} from '../server/integrations/analytics-graph.mjs';

const catalog=[{id:'a',kind:'city',name:'Alt',ags:'05558008'},{id:'b',kind:'city',name:'Bett',ags:'03155012'}];
test('graph needs a term of at least three letters',()=>{
 for(const q of ['q=','q=ab'])assert.throws(()=>parseGraph(new URLSearchParams(q)));
});
test('graph links terms, topics, committees and lands by co-occurrence and leaves out the query and formalities',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 const db=sqliteAdapter(sql);
 let n=0;
 const put=(region,label,gremium,title)=>{n++;sql.prepare("INSERT INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search) VALUES (?,?,'2025-05-01','info',?,?, '', ?, ?)").run('c'+n,region,label,title,gremium,title.toLowerCase());};
 for(let i=0;i<6;i++)put('a','klima','Bauausschuss','Windenergie Flächennutzungsplan Änderung Sitzung');
 for(let i=0;i<4;i++)put('b','klima','Gemeinderat','Windenergie Artenschutz Gutachten');
 put('b','unklar','Gemeinderat','Windenergie Sonstiges Thema');
 try{
  const g=await knowledgeGraph(db,catalog,new URLSearchParams('q=Windenergie&to=2999-01-01'));
  assert.equal(g.total,11);assert.equal(g.nodes[0].type,'center');
  const labels=g.nodes.map(x=>x.label);
  assert.ok(labels.includes('flächennutzungsplan'));assert.ok(labels.includes('artenschutz'));
  assert.ok(!labels.some(l=>/^windenergie$/i.test(l)&&l!==g.q),'query is not a term');
  assert.ok(!labels.includes('sitzung'),'formalities are left out');
  assert.ok(labels.includes('Klima & Energie'));assert.ok(!labels.includes('Noch nicht eingeordnet'));
  assert.ok(labels.includes('Bauausschuss'));assert.ok(labels.includes('Nordrhein-Westfalen')&&labels.includes('Niedersachsen'));
  const id=l=>g.nodes.find(x=>x.label===l).id;
  const edge=(a,b)=>g.edges.find(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
  assert.ok(edge(id('flächennutzungsplan'),id('Bauausschuss')));
  assert.ok(!edge(id('flächennutzungsplan'),id('artenschutz')),'never together in one card');
  assert.ok(g.edges.filter(e=>e.center).length===g.nodes.length-1);
  assert.equal((await knowledgeGraph(db,catalog,new URLSearchParams('q=nichtda&to=2999-01-01'))).total,0);
 }finally{sql.close();}
});
