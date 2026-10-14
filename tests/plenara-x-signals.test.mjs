// plenara.X Signale (server/integrations/plenara-x-signals.mjs): Vorgänge je Signal über Fakten, Stand, Kennzahlen, Filter.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {xSignals} from '../server/integrations/plenara-x-signals.mjs';
import {buildXCases} from '../server/integrations/x-cases.mjs';
import {THEMES_VERSION} from '../shared/themes.mjs';

const catalog=[{id:'billerbeck',kind:'city',name:'Billerbeck',ags:'05558008'},{id:'other',kind:'city',name:'Anderer Ort',ags:'05558012'}];
function fixture(){
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const put=(id,region,title,date,stage,facts)=>{
  const t={id,regionId:region,title,officialTitle:title,status:'consulting',eventDate:date,updatedAt:date,committee:'Rat',shortSummary:'',
   events:[{date,committee:'Rat',status:'consulting'}],theme:{id:'bauen',subs:[],source:'title',version:THEMES_VERSION,evidence:title}};
  sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,region,'city',date,date,t.status,JSON.stringify(t));
  sql.prepare('INSERT INTO report_rules(topic_id,key,version,read_at,case_key,item_kind,theme,subs,stage) VALUES(?,?,?,?,?,?,?,?,?)').run(id,'k','v',date,region+'|'+title.toLowerCase(),'subject','bauen','',stage);
  for(const [kind,value,detail] of facts)sql.prepare('INSERT INTO topic_facts(topic_id,kind,value,detail,method) VALUES(?,?,?,?,?)').run(id,kind,value,detail,'facts-v26:text');
 };
 put('a','billerbeck','Bebauungsplan Nr. 5 Am Hang','2026-05-01','planung',[['plan','Satzungsbeschluss','Bebauungsplan|nr. 5'],['plan_use','Wohnen',''],['plan_area','5 bis 20 ha','6.4'],['housing','Wohneinheiten','40']]);
 put('b','other','Bebauungsplan Gewerbegebiet Nord','2026-06-01','planung',[['plan','Aufstellung','Bebauungsplan|nord'],['plan_use','Gewerbe','']]);
 put('c','other','Windpark Ost Einvernehmen','2026-07-01','bauantrag',[['wind_count','2 bis 4 Anlagen','3']]);
 put('d','billerbeck','Einführung Bürgerbus','2026-08-01','planung',[['project','Bürgerbus oder Rufbus','']]);
 put('e','billerbeck','Freies WLAN in der Innenstadt','2026-08-02','antrag',[['project','Öffentliches WLAN','']]);
 buildXCases(sql,{today:'2026-12-31'});
 return {sql,db:sqliteAdapter(sql)};
}
const q=s=>new URLSearchParams(s+'&to=2026-12-31');

test('Signale: Zahl je Signal, Stand aus dem Plan, Kennzahlen',async()=>{
 const {sql,db}=fixture();try{
  const r=await xSignals(db,catalog,q('signal=wohnbau'));
  assert.deepEqual(Object.fromEntries(r.signals.map(s=>[s.id,s.count])),{vergaben:0,wohnbau:1,gewerbe:1,wind:1,solar:0,waerme:0,schulen:0,pflege:0,handel:0,mobil:1});
  assert.equal(r.total,1);assert.equal(r.items[0].phase,'Satzungsbeschluss');assert.equal(r.items[0].region,'Billerbeck');
  assert.deepEqual(r.items[0].facts.map(f=>f.text),['6,4 ha','40 Wohneinheiten']);
  const w=await xSignals(db,catalog,q('signal=wind'));
  assert.equal(w.items[0].phase,'Ohne Angabe');assert.deepEqual(w.items[0].facts.map(f=>f.text),['3 Anlagen']);
 }finally{sql.close();}
});
test('Signale: Filter nach Stand und Gebiet, unbekanntes Signal',async()=>{
 const {sql,db}=fixture();try{
  assert.equal((await xSignals(db,catalog,q('signal=gewerbe&phase=Satzungsbeschluss'))).total,0);
  assert.equal((await xSignals(db,catalog,q('signal=gewerbe&phase=Aufstellung'))).total,1);
  assert.equal((await xSignals(db,catalog,q('signal=mobil&area=05558012'))).total,0);
  await assert.rejects(xSignals(db,catalog,q('signal=foo')),/Unbekanntes Signal/);
  const g=await xSignals(db,catalog,q('signal=gewerbe'));assert.deepEqual(g.arts,[{key:'Gewerbe',name:'Gewerbe',count:1}]);
  assert.equal((await xSignals(db,catalog,q('signal=gewerbe&art=Industrie'))).total,0);
  assert.equal((await xSignals(db,catalog,q('signal=gewerbe&art=Gewerbe&phase=Aufstellung'))).total,1);
 }finally{sql.close();}
});

test('Signale: vorberechnete Tabelle x_signals ergibt dasselbe wie die Abfrage über die Fakten',async()=>{
 const {sql,db}=fixture();
 const cases=['signal=wohnbau','signal=gewerbe&phase=Aufstellung','signal=gewerbe&art=Gewerbe','signal=mobil','signal=wind','signal=wohnbau&area=05558012'];
 assert.ok(sql.prepare('SELECT count(*) n FROM x_signals').get().n>0);
 const fast=[];for(const c of cases)fast.push(await xSignals(db,catalog,q(c)));
 sql.exec('DROP TABLE x_signals');
 for(const [i,c] of cases.entries())assert.deepEqual(await xSignals(db,catalog,q(c)),fast[i],c);
});
