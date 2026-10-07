import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {compare,parseCompare} from '../server/integrations/analytics-compare.mjs';

const catalog=[{id:'a',kind:'city',name:'Alt',ags:'05558008'},{id:'b',kind:'city',name:'Bett',ags:'05558012'},{id:'c',kind:'city',name:'Cent',ags:'03155012'}];
test('compare needs two to four places',()=>{
 for(const q of ['','area=05558008&scope=only','area=05558008&scope=only&more=05558012:only,03155012:only,05558001:only,05558002:only'])assert.throws(()=>parseCompare(new URLSearchParams(q)));
 assert.equal(parseCompare(new URLSearchParams('area=05558008&scope=only&more=05558012:only')).places.length,2);
});
test('compare gives each place its own profile against all areas and finds typical and common terms',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 const db=sqliteAdapter(sql);let n=0;
 const put=(region,date,label,status,gremium,title)=>{n++;sql.prepare("INSERT INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search) VALUES (?,?,?,?,?,?, '', ?, ?)").run('c'+n,region,date,status,label,title,gremium,title.toLowerCase());};
 /* a: Verkehr und Radweg, Gemeinsames Klimaschutz; b: Bildung und Schulbau; c dient als weitere Vergleichsbasis */
 for(let i=0;i<14;i++)put('a','2026-03-1'+(i%9),'mobilitaet',i%2?'approved':'consulting','Bauausschuss','Radweg Ausbau Klimaschutz '+i);
 for(let i=0;i<12;i++)put('b','2026-04-1'+(i%9),'bildung','approved','Schulausschuss','Schulbau Erweiterung Klimaschutz '+i);
 for(let i=0;i<30;i++)put('c','2026-04-0'+(1+i%9),i%2?'bauen':'bildung','info','Gemeinderat','Gewerbegebiet Planung Klimaschutz '+i);
 try{
  const r=await compare(db,catalog,new URLSearchParams('area=05558008&scope=only&more=05558012:only&to=2999-01-01'));
  assert.equal(r.places.length,2);
  const [a,b]=r.places;
  assert.equal(a.total,14);assert.equal(b.total,12);
  assert.equal(a.topics.list.find(x=>x.id==='mobilitaet').share,100);assert.equal(b.topics.list.find(x=>x.id==='bildung').share,100);
  assert.equal(a.status.list.find(x=>x.id==='approved').n,7);
  assert.deepEqual(a.committees.map(x=>x.name),['Bauausschuss']);
  assert.deepEqual(a.months,[{m:'2026-03',n:14}]);assert.deepEqual(r.months,['2026-03','2026-04']);
  assert.ok(a.typical.some(t=>t.term==='radweg'),'radweg is typical for a');
  assert.ok(!a.typical.some(t=>t.term==='klimaschutz'),'shared term is not typical');
  assert.ok(r.common.some(t=>t.term==='klimaschutz'),'klimaschutz is common');
  assert.ok(!r.common.some(t=>t.term==='radweg'));
  assert.equal(r.base.total,56);
 }finally{sql.close();}
});
