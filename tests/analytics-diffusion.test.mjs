import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/sqlite-adapter.mjs';
import {diffusion,parseDiffusion} from '../server/integrations/analytics-diffusion.mjs';
import {buildXCases} from '../server/integrations/x-cases.mjs';

const catalog=[{id:'a',kind:'city',name:'Alt',ags:'05558008'},{id:'b',kind:'city',name:'Bett',ags:'05558012'},{id:'sg',kind:'city',name:'Samtgemeinde Sg',ags:'031550001',members:[{ags:'03155001',name:'Eins'},{ags:'03155002',name:'Zwei'}]},{id:'k',kind:'district',name:'Kreis',ags:'05558'}];
test('parse rejects empty, short and malformed input',()=>{
 for(const q of ['q=','q=ab','from=x&q=wärme','q='+'a'.repeat(201)])assert.throws(()=>parseDiffusion(new URLSearchParams(q)));
 assert.deepEqual(parseDiffusion(new URLSearchParams('q=Wärmeplanung oder Solar')).groups,[['warmeplanung'],['solar']]);
});
test('diffusion ignores future dates by default',async()=>{
 const sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 sql.prepare("INSERT INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search) VALUES ('f','a','2999-01-01','info','x','t','','','warmeplanung')").run();
 buildXCases(sql,{today:'2026-10-15'});
 try{assert.equal((await diffusion(sqliteAdapter(sql),catalog,new URLSearchParams('q=Wärmeplanung'))).regions.length,0);}finally{sql.close();}
});
test('diffusion reports first mention per area, assigns Samtgemeinde reports to members and builds the series',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 const db=sqliteAdapter(sql);
 const put=(id,region,date,search,gremium='')=>sql.prepare("INSERT INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search) VALUES (?,?,?,'info','x',?,'',?,?)").run(id,region,date,'Titel '+id,gremium,search);
 put('1','a','2025-03-10','kommunale warmeplanung');put('2','a','2025-01-05','warmeplanung start');put('3','b','2025-03-20','warmeplanung');put('4','sg','2025-06-01','warmeplanung');put('5','k','2025-02-01','warmeplanung');put('6','b','2025-01-01','radweg');put('7','sg','2025-07-01','warmeplanung','Gemeinderat Zwei');
 buildXCases(sql,{today:'2026-10-15'});
 try{
  const r=await diffusion(db,catalog,new URLSearchParams('q=Wärmeplanung'));
  /* Samtgemeinde ohne erkennbare Mitgliedsgemeinde: ein Gebiet (Karte bei allen Mitgliedern); mit Gemeinderat Zwei: die Gemeinde */
  assert.deepEqual(r.regions.map(x=>[x.ags,x.first,x.n]),[['05558008','2025-01-05',2],['05558012','2025-03-20',1],['031550001','2025-06-01',1],['03155002','2025-07-01',1]]);
  assert.deepEqual(r.regions[2].members,['03155001','03155002']);
  assert.deepEqual(r.series,[{month:'2025-01',added:1,total:1},{month:'2025-03',added:1,total:2},{month:'2025-06',added:1,total:3},{month:'2025-07',added:1,total:4}]);
  assert.equal(r.stats.regions,4);assert.equal(r.stats.first,'2025-01-05');
  assert.equal((await diffusion(db,catalog,new URLSearchParams('q=Wärmeplanung&from=2025-03-01'))).stats.regions,4);
  assert.equal((await diffusion(db,catalog,new URLSearchParams('q=nichtda'))).regions.length,0);
  /* gleiche Filter wie die Suche: Gebiet, Status, Zeitraum */
  assert.deepEqual((await diffusion(db,catalog,new URLSearchParams('q=Wärmeplanung&area=05558012&scope=only'))).regions.map(x=>x.ags),['05558012']);
  assert.equal((await diffusion(db,catalog,new URLSearchParams('q=Wärmeplanung&status=approved'))).regions.length,0);
  assert.deepEqual((await diffusion(db,catalog,new URLSearchParams('q=Wärmeplanung&from=2025-03-01&to=2025-03-31'))).regions.map(x=>x.ags),['05558008','05558012']);
 }finally{sql.close();}
});
