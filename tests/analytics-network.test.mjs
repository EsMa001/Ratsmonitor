import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {network,gremiumType} from '../server/integrations/analytics-network.mjs';

const catalog=[{id:'a',kind:'city',name:'Alt',ags:'05558008'},{id:'b',kind:'city',name:'Bett',ags:'03155012'}];
test('committee names are grouped by kind',()=>{
 const t=gremiumType;
 assert.equal(t('Rat der Stadt Münster'),'Rat und Kreistag');assert.equal(t('Gemeinderat'),'Rat und Kreistag');assert.equal(t('Stadtverordnetenversammlung'),'Rat und Kreistag');
 assert.equal(t('Hauptausschuss'),'Haupt- und Verwaltungsausschuss');assert.equal(t('Ausschuss für Stadtentwicklung und regionale Zusammenarbeit'),'Bau-, Planungs- und Stadtentwicklungsausschuss');
 assert.equal(t('Finanzausschuss'),'Finanz- und Rechnungsprüfungsausschuss');assert.equal(t('Bezirksvertretung Hombruch'),'Orts- und Bezirksgremium');assert.equal(t('Ortsbeirat Genshagen'),'Orts- und Bezirksgremium');
 assert.equal(t('Umweltausschuss'),'Umwelt-, Klima- und Energieausschuss');assert.equal(t('Seniorenbeirat'),'Sozial- und Gesundheitsausschuss');assert.equal(t('Gremium laut Originalquelle'),'Sonstige Gremien');
});
test('network counts hand-overs between consecutive committees and names the roles',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 const db=sqliteAdapter(sql);let n=0;
 const put=(region,status,events)=>{n++;const t={title:'Vorlage '+n,officialTitle:'Vorlage '+n,shortSummary:'x',committee:'Rat',classification:{method:'title-rules-v2',version:'labels-v2',primary:'bauen',evidence:'x'},events};sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run('t'+n,'city','2026-09-20','2026-09-20',status,JSON.stringify(t),region);};
 const ev=(date,committee)=>({date,committee,status:'consulting',result:''});
 /* Bauausschuss -> Hauptausschuss -> Rat (5x), Bauausschuss -> Rat (2x), nur eine Station (zählt nicht) */
 for(let i=0;i<5;i++)put('a','approved',[ev('2026-09-01','Ausschuss für Bau und Planung'),ev('2026-09-08','Hauptausschuss'),ev('2026-09-15','Gemeinderat')]);
 for(let i=0;i<2;i++)put('b','approved',[ev('2026-09-01','Bauausschuss'),ev('2026-09-05','Stadtrat')]);
 put('a','approved',[ev('2026-09-01','Gemeinderat')]);
 /* Zweimal dasselbe Gremium hintereinander wird zusammengefasst */
 put('a','recommended',[ev('2026-09-01','Hauptausschuss'),ev('2026-09-02','Hauptausschuss')]);
 try{
  const r=await network(db,catalog,new URLSearchParams('to=2999-01-01'));
  assert.equal(r.mode,'types');assert.equal(r.paths,7);
  const edge=(a,b)=>r.edges.find(e=>e.a===a&&e.b===b);
  assert.equal(edge('Bau-, Planungs- und Stadtentwicklungsausschuss','Haupt- und Verwaltungsausschuss').n,5);
  assert.equal(edge('Bau-, Planungs- und Stadtentwicklungsausschuss','Haupt- und Verwaltungsausschuss').days,7);
  assert.equal(edge('Haupt- und Verwaltungsausschuss','Rat und Kreistag').n,5);
  assert.equal(edge('Bau-, Planungs- und Stadtentwicklungsausschuss','Rat und Kreistag').n,2);
  const role=id=>r.nodes.find(x=>x.id===id).role;
  assert.equal(role('Bau-, Planungs- und Stadtentwicklungsausschuss'),'start');assert.equal(role('Rat und Kreistag'),'end');assert.equal(role('Haupt- und Verwaltungsausschuss'),'bridge');
  assert.deepEqual(r.routes[0],{path:['Bau-, Planungs- und Stadtentwicklungsausschuss','Haupt- und Verwaltungsausschuss','Rat und Kreistag'],n:5});
  /* Ein Ort: echte Namen */
  const one=await network(db,catalog,new URLSearchParams('area=05558008&scope=only&to=2999-01-01'));
  assert.equal(one.mode,'names');assert.ok(one.nodes.some(x=>x.id==='Ausschuss für Bau und Planung'));
 }finally{sql.close();}
});
