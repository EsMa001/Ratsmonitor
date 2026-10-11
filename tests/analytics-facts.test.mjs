// plenara.X – Fraktionsprofil und Förderradar über topic_facts (drizzle/0025).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {factions} from '../server/integrations/analytics-factions.mjs';
import {funding} from '../server/integrations/analytics-funding.mjs';

const catalog=[{id:'a',kind:'city',name:'Alt',ags:'05558008'},{id:'b',kind:'city',name:'Bett',ags:'03155012'}];
function setup(){
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 let n=0;
 const put=(region,status,label,facts)=>{n++;const title='Vorlage '+n,t={title,officialTitle:title,shortSummary:'x',committee:'Rat',classification:{method:'title-rules-v2',version:'labels-v2',primary:label,evidence:title},events:[{date:'2026-09-20',committee:'Rat',status}]};
  sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run('t'+n,'city','2026-09-20','2026-09-20',status,JSON.stringify(t),region);
  for(const [kind,value,detail] of facts)sql.prepare('INSERT INTO topic_facts VALUES(?,?,?,?,?)').run('t'+n,kind,value,detail,'facts-v2:text');};
 return {db:sqliteAdapter(sql),sql,put};
}
const q=s=>new URLSearchParams('to=2999-01-01&'+s);

test('faction profile counts motions and questions, success rate and topic index',async()=>{
 const {db,put}=setup();
 for(let i=0;i<8;i++)put('a','approved','klima',[['faction','Grüne','antrag']]);
 for(let i=0;i<2;i++)put('a','rejected','klima',[['faction','Grüne','antrag']]);
 put('a','consulting','bildung',[['faction','Grüne','anfrage']]);
 for(let i=0;i<10;i++)put('b','approved','bildung',[['faction','SPD','antrag']]);
 put('b','approved','bildung',[['faction','SPD','antrag'],['faction','CDU/CSU','antrag']]);
 put('b','approved','bildung',[]);
 const r=await factions(db,catalog,q(''));
 assert.equal(r.totals.withFaction,22);
 const g=r.parties.find(p=>p.name==='Grüne'),s=r.parties.find(p=>p.name==='SPD');
 assert.deepEqual([g.n,g.antrag,g.anfrage,g.decided,g.approved,g.rejected,g.rate],[11,10,1,10,8,2,80]);
 assert.deepEqual([s.n,s.rate],[11,100]);
 assert.equal(g.top[0].name,'Klima & Energie','Klima ist bei den Grünen überdurchschnittlich');
 assert.ok(g.profile.find(x=>x.id==='klima').index>100&&s.profile.find(x=>x.id==='bildung').index>100);
 assert.deepEqual(r.small,[{name:'CDU/CSU',n:1}],'unter 10 Einträgen nicht einzeln');
 // Filter wie in der Suche: nur Gebiet b
 const only=await factions(db,catalog,q('area=03155012'));
 assert.deepEqual(only.parties.map(p=>p.name),['SPD']);
});

test('funding radar counts programs by status and ranks no area below the thresholds',async()=>{
 const {db,put}=setup();
 put('a','approved','bildung',[['funding','Ganztagsausbau','granted'],['funding','Sonstige Förderung','applied']]);
 put('a','approved','bauen',[['funding','Städtebauförderung','applied']]);
 put('b','approved','bauen',[['funding','Städtebauförderung','mentioned']]);
 const r=await funding(db,catalog,q(''));
 assert.deepEqual(r.totals,{topics:3,granted:1,applied:1,regions:1,ranked:0,cards:3});
 const st=r.programs.find(p=>p.name==='Städtebauförderung');
 assert.deepEqual([st.n,st.applied,st.mentioned,st.regions],[2,1,1,2]);
 assert.equal(r.programs.at(-1).name,'Sonstige Förderung','Sonstige zuletzt');
 assert.equal(r.ranking.length,0,'zu kleine Gebiete und zu wenige Einträge');
});

test('funding radar sums amounts once per area, program and amount, only granted or applied',async()=>{
 const {db,put}=setup();
 put('a','approved','bauen',[['funding','Städtebauförderung','applied'],['funding_euro','Städtebauförderung','500000']]);
 put('a','approved','bauen',[['funding','Städtebauförderung','granted'],['funding_euro','Städtebauförderung','500000']]);
 put('a','approved','bauen',[['funding','Radverkehr','mentioned'],['funding_euro','Radverkehr','90000']]);
 put('b','approved','bauen',[['funding','Radverkehr','granted'],['funding_euro','Radverkehr','90000']]);
 const r=await funding(db,catalog,q(''));
 assert.deepEqual([r.euro.granted,r.euro.applied,r.euro.amounts],[590000,0,2],'Antrag und Bescheid über denselben Betrag zählen einmal, als bewilligt; nur erwähnt zählt nicht');
 assert.equal(r.programs.find(p=>p.name==='Städtebauförderung').euroGranted,500000);
 assert.equal(r.largest[0].euro,500000);
});

test('planning counts each plan once with its furthest step and the housing it names',async()=>{
 const {planning}=await import('../server/integrations/analytics-planning.mjs');
 const {db,put}=setup();
 put('a','consulting','bauen',[['plan','Aufstellung','Bebauungsplan|nr. 1']]);
 put('a','approved','bauen',[['plan','Satzungsbeschluss','Bebauungsplan|nr. 1'],['housing','Wohneinheiten','120']]);
 put('a','approved','bauen',[['plan','Offenlage','Bebauungsplan|nr. 2']]);
 put('b','approved','bauen',[['plan','Satzungsbeschluss','Flächennutzungsplan|nr. 9']]);
 const r=await planning(db,catalog,q(''));
 assert.deepEqual(r.totals,{topics:4,plans:3,adopted:2,regions:2,we:120,weKnown:1});
 assert.equal(r.plansByStage.find(s=>s.name==='Satzungsbeschluss').n,2);
 assert.equal(r.plansByStage.find(s=>s.name==='Aufstellung').n,0,'Plan 1 zählt mit seinem weitesten Schritt');
 assert.equal(r.housingPlans[0].we,120);
 assert.equal(r.regions.length,0,'Gebiete unter den Schwellen fehlen im Vergleich');
});

test('kita counts fee decisions by direction and new places once per project',async()=>{
 const {kita}=await import('../server/integrations/analytics-kita.mjs');
 const {db,put}=setup();
 put('a','approved','bildung',[['kita_fee','Erhöhung','150']]);
 put('a','approved','bildung',[['kita_fee','Neufassung','']]);
 put('b','approved','bildung',[['kita_fee','Beitragsfreiheit',''],['kita_places','Plätze','75']]);
 const r=await kita(db,catalog,q(''));
 assert.deepEqual(r.totals,{fees:3,feeRegions:2,projects:1,places:75,placeRegions:1});
 assert.deepEqual(r.directions.filter(d=>d.n).map(d=>[d.name,d.n]),[['Erhöhung',1],['Beitragsfreiheit',1],['Neufassung',1]]);
 assert.equal(r.decisions.length,2,'ohne sonstige Neufassungen');
 assert.equal(r.decisions.find(d=>d.direction==='Erhöhung').euro,'150');
});

test('theme radar counts topics, decisions, signals and recent items per radar',async()=>{
 const {radar}=await import('../server/integrations/analytics-radar.mjs');
 const {db,put}=setup();
 put('a','approved','umwelt',[['radar:versorgung','Abwasser','Gebühren und Entgelte']]);
 put('a','rejected','umwelt',[['radar:versorgung','Abwasser','Bau und Sanierung'],['radar:versorgung','Trinkwasser','Bau und Sanierung']]);
 put('b','consulting','umwelt',[['radar:versorgung','Wärme','Planung und Konzept'],['radar:verkehr','Radverkehr','Bau und Sanierung']]);
 const r=await radar(db,catalog,q('radar=versorgung'));
 assert.deepEqual(r.totals,{topics:3,regions:2,decided:2,rate:50});
 const abw=r.topics.find(t=>t.name==='Abwasser');
 assert.deepEqual([abw.n,abw.decided,abw.approved,abw.rate,abw.regions],[2,2,1,50,1]);
 assert.equal(r.topics.find(t=>t.name==='Strom und Gas').n,0,'alle Themen des Radars, auch ohne Vorgang');
 assert.equal(r.signals.find(s=>s.name==='Bau und Sanierung').n,2);
 assert.deepEqual(r.recent.find(x=>x.topics.length===2).topics.sort(),['Abwasser','Trinkwasser']);
 await assert.rejects(radar(db,catalog,q('radar=unbekannt')),/Unbekanntes Radar/);
});
