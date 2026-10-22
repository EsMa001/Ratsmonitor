// plenara.X Signale (server/integrations/plenara-x-signals.mjs, Abfragen in model-signals.mjs): Vorgänge je Signal aus den
// Antworten des Modells (model_labels, Begriffsbuch Abschnitt 8), Stand, Filter, „erstmals hier“.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {xSignals} from '../server/integrations/plenara-x-signals.mjs';
import {buildXCases} from '../server/integrations/x-cases.mjs';
import {THEMES_VERSION} from '../shared/themes.mjs';

const catalog=[{id:'billerbeck',kind:'city',name:'Billerbeck',ags:'05558008'},{id:'other',kind:'city',name:'Anderer Ort',ags:'05558012'}];
function fixture(extra=[]){
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 // m: Antworten des Modells (Unterthemen, Unter-Unterthemen, Vorgangsart, Schritt, Leistungsart); null = nicht eingeordnet
 const put=(id,region,title,date,m)=>{
  const t={id,regionId:region,title,officialTitle:title,status:'consulting',eventDate:date,updatedAt:date,committee:'Rat',shortSummary:'',
   events:[{date,committee:'Rat',status:'consulting'}],theme:{id:'bauen',subs:[],source:'title',version:THEMES_VERSION,evidence:title}};
  sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,region,'city',date,date,t.status,JSON.stringify(t));
  sql.prepare('INSERT INTO report_rules(topic_id,key,version,read_at,case_key,item_kind,theme,subs,stage) VALUES(?,?,?,?,?,?,?,?,?)').run(id,'k','v',date,region+'|'+title.toLowerCase(),'subject','bauen',(m?.subs||[]).join(','),m?.process||'other');
  if(m)sql.prepare(`INSERT INTO model_labels(topic_id,model,key,kind,kind_p,status,status_p,themes,subs,subsubs,process,process_p,project,step,service,at)
   VALUES(?,'test','k','subject',0.99,'consulting',0.9,'["bauen"]',?,?,?,0.9,1,?,?,?)`).run(id,JSON.stringify(m.subs),JSON.stringify(m.subsubs||[]),m.process,m.step||null,m.service||null,date);
 };
 put('a','billerbeck','Bebauungsplan Nr. 5 Am Hang','2026-05-01',{subs:['bauen.plan'],subsubs:['bauen.plan.wohnen'],process:'planning',step:'beschluss'});
 put('b','other','Bebauungsplan Gewerbegebiet Nord','2026-06-01',{subs:['bauen.plan'],subsubs:['bauen.plan.gewerbe'],process:'planning',step:'start'});
 put('c','other','Windpark Ost Einvernehmen','2026-07-01',{subs:['umwelt.ee'],subsubs:['umwelt.ee.wind'],process:'permit'});
 put('d','billerbeck','Einführung Bürgerbus','2026-08-01',{subs:['mobilitaet.oepnv'],subsubs:['mobilitaet.oepnv.buergerbus'],process:'planning'});
 put('e','billerbeck','Freies WLAN in der Innenstadt','2026-08-02',{subs:['verwaltung.breit'],subsubs:['verwaltung.breit.wlan'],process:'political'});
 for(const e of extra)put(...e);
 buildXCases(sql,{today:'2026-12-31'});
 return {sql,db:sqliteAdapter(sql)};
}
const q=s=>new URLSearchParams(s+'&to=2026-12-31');

test('Signale: Zahl je Signal, Stand aus Schritt oder Vorgangsart',async()=>{
 const {sql,db}=fixture();try{
  const r=await xSignals(db,catalog,q('signal=wohnbau'));
  assert.deepEqual(Object.fromEntries(r.signals.map(s=>[s.id,s.count])),{vergaben:0,wohnbau:1,gewerbe:1,wind:1,solar:0,waerme:0,schulen:0,strasse:0,wasser:0,breitband:1,mobil:1});
  assert.equal(r.total,1);assert.equal(r.items[0].phase,'Beschluss');assert.equal(r.items[0].region,'Billerbeck');
  assert.deepEqual(r.items[0].arts,['Bauleitplanung']);
  const w=await xSignals(db,catalog,q('signal=wind'));
  assert.equal(w.items[0].phase,'Genehmigung für Dritte');
  const b=await xSignals(db,catalog,q('signal=breitband'));
  assert.deepEqual(b.items[0].arts,['öffentliches WLAN']);
  // Alle Projekte: jeder Vorgang einmal, ohne Ausschreibungen, Filter ist die Kategorie
  const a=await xSignals(db,catalog,q('signal=alle'));
  assert.equal(a.signal.art,'Kategorie');assert.equal(a.total,new Set(a.items.map(i=>i.id)).size);assert.ok(a.total>=4);
  assert.ok(a.arts.some(x=>x.key==='Windenergie'));assert.ok(!a.arts.some(x=>x.key==='Ausschreibungen und Vergaben'));
  assert.equal((await xSignals(db,catalog,q('signal=alle&art=Windenergie'))).total,1);
 }finally{sql.close();}
});
test('Signale: Filter nach Stand und Gebiet, unbekanntes Signal',async()=>{
 const {sql,db}=fixture();try{
  assert.equal((await xSignals(db,catalog,q('signal=gewerbe&phase=Beschluss'))).total,0);
  assert.equal((await xSignals(db,catalog,q('signal=gewerbe&phase=Start'))).total,1);
  assert.equal((await xSignals(db,catalog,q('signal=mobil&area=05558012'))).total,0);
  await assert.rejects(xSignals(db,catalog,q('signal=foo')),/Unbekanntes Signal/);
  const g=await xSignals(db,catalog,q('signal=gewerbe'));assert.deepEqual(g.arts,[{key:'Gewerbe',name:'Gewerbe',count:1}]);
  assert.equal((await xSignals(db,catalog,q('signal=gewerbe&art=Industrie'))).total,0);
  assert.equal((await xSignals(db,catalog,q('signal=gewerbe&art=Gewerbe&phase=Start'))).total,1);
  // Unterthema (sub) als Filter der gemeinsamen Suche: gilt für alle plenara.X-Auswertungen über source()
  assert.equal((await xSignals(db,catalog,q('signal=alle&sub=bauen.plan'))).total,2);
  assert.equal((await xSignals(db,catalog,q('signal=alle&sub=umwelt.ee'))).total,1);
  await assert.rejects(xSignals(db,catalog,q('signal=alle&sub=foo')),/Unterthema|Suchfilter/);
  // group: Stand grob nach dem Status (alle Vorgänge der Probe sind in Beratung, also offen)
  assert.equal((await xSignals(db,catalog,q('signal=alle&group=offen'))).total,5);
  assert.equal((await xSignals(db,catalog,q('signal=alle&group=entschieden'))).total,0);
  await assert.rejects(xSignals(db,catalog,q('signal=alle&group=foo')),/Unbekannter Stand/);
  // subs=1: Treffer je Unterthema ohne das gewählte Unterthema
  const sb=await xSignals(db,catalog,q('signal=alle&sub=umwelt.ee&subs=1'));
  assert.equal(sb.total,1);assert.deepEqual(sb.subs.find(x=>x.key==='bauen.plan'),{key:'bauen.plan',name:sb.subs.find(x=>x.key==='bauen.plan').name,count:2});
 }finally{sql.close();}
});

test('Signale: vorberechnete Tabelle x_signals ergibt dasselbe wie die Abfrage über die Antworten des Modells',async()=>{
 const {sql,db}=fixture();
 const cases=['signal=alle&group=offen','signal=wohnbau','signal=gewerbe&phase=Start','signal=gewerbe&art=Gewerbe','signal=mobil','signal=wind','signal=wohnbau&area=05558012','signal=alle','signal=alle&art=Windenergie'];
 assert.ok(sql.prepare('SELECT count(*) n FROM x_signals').get().n>0);
 // firstCount (Filter „erstmals hier“) gibt es nur auf dem schnellen Weg
 const fast=[];for(const c of cases){const r=await xSignals(db,catalog,q(c));delete r.firstCount;fast.push(r);}
 sql.exec('DROP TABLE x_signals');
 for(const [i,c] of cases.entries())assert.deepEqual(await xSignals(db,catalog,q(c)),fast[i],c);
});

test('Signale: „erstmals hier“ nur beim ersten Vorgang des Signals im Gebiet und mit Bestand ab einem Jahr davor',async()=>{
 const {sql,db}=fixture([
  ['old','billerbeck','Friedhofssatzung','2024-01-10',null],
  ['d2','billerbeck','Bürgerbus Fahrplan','2026-09-01',{subs:['mobilitaet.oepnv'],subsubs:['mobilitaet.oepnv.buergerbus'],process:'planning'}],
  ['n','other','Rufbus Einführung','2026-09-05',{subs:['mobilitaet.oepnv'],subsubs:['mobilitaet.oepnv.buergerbus'],process:'planning'}],
 ]);try{
  const r=await xSignals(db,catalog,q('signal=mobil'));
  const by=Object.fromEntries(r.items.map(i=>[i.id,i.firstHere]));
  assert.equal(by.d,true,'erster Bürgerbus in Billerbeck');
  assert.equal(by.d2,false,'zweiter Vorgang im selben Ort');
  assert.equal(by.n,false,'Bestand des anderen Orts beginnt erst 2026');
  assert.equal(r.items.find(i=>i.id==='d').place,'billerbeck');
  assert.equal(r.firstCount,1);
  const only=await xSignals(db,catalog,q('signal=mobil&first=1'));
  assert.deepEqual(only.items.map(i=>i.id),['d']);assert.equal(only.total,1);
  /* Mit Zeitraum bleibt „erstmals“ auf den ganzen Bestand bezogen: d2 ist auch ab August nicht der erste */
  const later=await xSignals(db,catalog,new URLSearchParams('signal=mobil&from=2026-08-15&to=2026-12-31'));
  assert.equal(later.items.find(i=>i.id==='d2').firstHere,false);
 }finally{sql.close();}
});
