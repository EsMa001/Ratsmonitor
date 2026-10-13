// plenara.X – Fraktionsprofil und Förderradar über topic_facts (drizzle/0025).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {factions} from '../server/integrations/analytics-factions.mjs';

const catalog=[{id:'a',kind:'city',name:'Alt',ags:'05558008'},{id:'b',kind:'city',name:'Bett',ags:'03155012'}];
function setup(){
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 let n=0;
 const put=(region,status,label,facts,same)=>{n++;const title=same||'Vorlage '+n,t={title,officialTitle:title,shortSummary:'x',committee:'Rat',classification:{method:'title-rules-v2',version:'labels-v2',primary:label,evidence:title},events:[{date:'2026-09-20',committee:'Rat',status}]};
  sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run('t'+n,'city','2026-09-20','2026-09-20',status,JSON.stringify(t),region);
  for(const [kind,value,detail] of facts)sql.prepare('INSERT INTO topic_facts VALUES(?,?,?,?,?)').run('t'+n,kind,value,detail,'facts-v2:text');};
 return {db:sqliteAdapter(sql),sql,put};
}
const q=s=>new URLSearchParams('to=2999-01-01&'+s);

test('faction profile counts motions and questions, success rate and topic index',async()=>{
 const {db,put}=setup();
 for(let i=0;i<8;i++)put('a','approved','umwelt',[['faction','Grüne','antrag']]);
 for(let i=0;i<2;i++)put('a','rejected','umwelt',[['faction','Grüne','antrag']]);
 put('a','consulting','bildung',[['faction','Grüne','anfrage']]);
 for(let i=0;i<10;i++)put('b','approved','bildung',[['faction','SPD','antrag']]);
 put('b','approved','bildung',[['faction','SPD','antrag'],['faction','CDU/CSU','antrag']]);
 put('b','approved','bildung',[]);
 const r=await factions(db,catalog,q(''));
 assert.equal(r.totals.withFaction,22);
 const g=r.parties.find(p=>p.name==='Grüne'),s=r.parties.find(p=>p.name==='SPD');
 assert.deepEqual([g.n,g.antrag,g.anfrage,g.decided,g.approved,g.rejected,g.rate],[11,10,1,10,8,2,80]);
 assert.deepEqual([s.n,s.rate],[11,100]);
 assert.equal(g.top[0].name,'Umwelt, Klima & Energie','Klima ist bei den Grünen überdurchschnittlich');
 assert.ok(g.profile.find(x=>x.id==='umwelt').index>100&&s.profile.find(x=>x.id==='bildung').index>100);
 assert.deepEqual(r.small,[{name:'CDU/CSU',n:1}],'unter 10 Einträgen nicht einzeln');
 // Filter wie in der Suche: nur Gebiet b
 const only=await factions(db,catalog,q('area=03155012'));
 assert.deepEqual(only.parties.map(p=>p.name),['SPD']);
});
