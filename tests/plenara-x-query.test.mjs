// plenara.X – eine Abfrage (server/integrations/plenara-x-query.mjs): Vorgänge statt Karten, Formalien nie, Thema wie im
// Themenfilter der Suche, Unterthemen und „Was geschieht“ aus report_rules, Anteil und Liste.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {xQuery} from '../server/integrations/plenara-x-query.mjs';
import {buildXCases} from '../server/integrations/x-cases.mjs';
import {THEMES_VERSION} from '../shared/themes.mjs';
import {AnalyticsError} from '../server/integrations/analytics-diffusion.mjs';

const catalog=[{id:'billerbeck',kind:'city',name:'Billerbeck',ags:'05558008'},{id:'other',kind:'city',name:'Anderer Ort',ags:'05558012'}];
function fixture(){
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const put=(id,region,title,theme,rules)=>{
  const t={id,regionId:region,title,officialTitle:title,status:'consulting',eventDate:'2026-05-01',updatedAt:'2026-05-02',committee:'Rat',shortSummary:'',
   events:[{date:'2026-05-01',committee:'Rat',status:'consulting'}],theme:{id:theme,subs:[],source:'title',version:THEMES_VERSION,evidence:title}};
  sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,region,'city',t.eventDate,t.updatedAt,t.status,JSON.stringify(t));
  if(rules)sql.prepare('INSERT INTO report_rules(topic_id,key,version,read_at,case_key,item_kind,theme,subs,stage) VALUES(?,?,?,?,?,?,?,?,?)')
   .run(id,'k','v','2026-05-02',region+'|'+title.toLowerCase(),rules.kind||'subject',theme,rules.subs||'',rules.stage??null);
 };
 put('a1','billerbeck','Radweg Hauptstraße','mobilitaet',{subs:'mobilitaet.rad',stage:'bau'});
 put('a2','billerbeck','Radweg Hauptstraße','mobilitaet',{subs:'mobilitaet.rad',stage:'bau'});
 put('b','other','Radweg Nebenstraße','mobilitaet',{subs:'mobilitaet.rad,mobilitaet.plan',stage:'planung'});
 put('c','billerbeck','Haushalt 2026','finanzen',{subs:'finanzen.hh',stage:'haushalt'});
 put('d','billerbeck','Genehmigung der Niederschrift','offen',{kind:'formal'});
 put('e','billerbeck','Kita Neubau','bildung',null);
 buildXCases(sql,{today:'2026-12-31'});
 return {sql,db:sqliteAdapter(sql)};
}
const q=s=>new URLSearchParams(s+'&to=2026-12-31');
const rows=r=>Object.fromEntries(r.rows.map(x=>[x.key,x.count]));

test('Vorgänge einmal, Formalien nie, ungelesene Sachpunkte zählen mit',async()=>{
 const {sql,db}=fixture();try{
  const t=await xQuery(db,catalog,q('by=theme'));
  assert.deepEqual(rows(t),{mobilitaet:2,finanzen:1,bildung:1});assert.equal(t.total,4);assert.equal(t.unread,1);
  const r=await xQuery(db,catalog,q('by=region&theme=mobilitaet'));
  assert.deepEqual(rows(r),{billerbeck:1,other:1});
  const b=r.rows.find(x=>x.key==='billerbeck');assert.equal(b.base,3);assert.equal(b.share,33.3);assert.equal(b.ags,'05558008');
 }finally{sql.close();}
});
test('Unterthemen innerhalb ihres Themas, „Was geschieht“ als Gliederung, Suchbegriff wie in der Suche',async()=>{
 const {sql,db}=fixture();try{
  assert.deepEqual(rows(await xQuery(db,catalog,q('by=stage&sub=mobilitaet.rad'))),{bau:1,planung:1});
  const s=await xQuery(db,catalog,q('by=sub&theme=mobilitaet'));
  assert.deepEqual(rows(s),{'mobilitaet.rad':2,'mobilitaet.plan':1});assert.equal(s.rows[0].base,2);assert.equal(s.rows[0].name,'Radverkehr');
  assert.equal((await xQuery(db,catalog,q('by=region&q=radweg'))).total,2);
  assert.equal((await xQuery(db,catalog,q('by=region&stage=haushalt'))).total,1);
 }finally{sql.close();}
});
test('Liste hinter einer Zahl: je Vorgang einmal mit Anzahl der Karten',async()=>{
 const {sql,db}=fixture();try{
  const l=await xQuery(db,catalog,q('list=1&by=region&value=billerbeck&theme=mobilitaet'));
  assert.equal(l.total,1);assert.equal(l.items[0].times,2);assert.equal(l.items[0].stage,'bau');assert.deepEqual(l.items[0].subs,['mobilitaet.rad']);
 }finally{sql.close();}
});
test('Ohne gebaute Zahlen: 503 statt über alle Karten zu zählen',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 try{await assert.rejects(xQuery(sqliteAdapter(sql),catalog,q('by=theme')),e=>e instanceof AnalyticsError&&e.status===503);}finally{sql.close();}
});
test('Ungültige Auswahl wird abgewiesen',async()=>{
 const {sql,db}=fixture();try{
  for(const s of ['theme=erfunden','sub=erfunden','theme=finanzen&sub=mobilitaet.rad','stage=x','by=fraktion'])
   await assert.rejects(xQuery(db,catalog,q(s)),AnalyticsError,s);
 }finally{sql.close();}
});
test('Sammelansicht für den Atlas: dieselben Zahlen wie die einzelnen Abfragen',async()=>{
 const {sql,db}=fixture();try{
  const a=await xQuery(db,catalog,q('view=atlas&theme=mobilitaet'));
  assert.equal(a.total,2);assert.deepEqual(Object.fromEntries(a.parts.map(x=>[x.key,x.count])),{'mobilitaet.rad':2,'mobilitaet.plan':1});
  assert.deepEqual(Object.fromEntries(a.stages.map(x=>[x.key,x.count])),{bau:1,planung:1});
  assert.deepEqual(a.months.map(x=>[x.key,x.count]),[['2026-05',2]]);assert.equal(a.regions.length,2);assert.equal(a.recent.length,2);
  const all=await xQuery(db,catalog,q('view=atlas'));
  assert.deepEqual(Object.fromEntries(all.parts.map(x=>[x.key,x.count])),{mobilitaet:2,finanzen:1,bildung:1});
 }finally{sql.close();}
});
test('Ort im Vergleich: Anteil je Unterthema gegen die Viertel der Vergleichsgruppe',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const db=sqliteAdapter(sql),regions=[],pop={};
 const ins=sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 const rr=sql.prepare('INSERT INTO report_rules(topic_id,key,version,read_at,case_key,item_kind,theme,subs,stage) VALUES(?,?,?,?,?,?,?,?,?)');
 sql.exec('BEGIN');
 for(let g=0;g<20;g++){
  const id='g'+g;regions.push({id,kind:'city',name:'Ort '+g,ags:'0555'+String(8000+g)});pop[id]=15000;
  for(let i=0;i<120;i++){
   const date=`2026-${String(1+(i%12)).padStart(2,'0')}-10`,title=`Vorgang ${g}-${i}`,rad=g===0?i<36:i<3;
   const theme=rad?'mobilitaet':'verwaltung',t={id:`${id}-${i}`,regionId:id,title,officialTitle:title,status:'consulting',eventDate:date,updatedAt:date,committee:'Rat',
    events:[{date,committee:'Rat',status:'consulting'}],theme:{id:theme,subs:[],source:'title',version:THEMES_VERSION,evidence:title}};
   ins.run(t.id,id,'city',date,date,'consulting',JSON.stringify(t));
   rr.run(t.id,'k','v',date,id+'|'+title.toLowerCase(),'subject',theme,rad?'mobilitaet.rad':'',null);
  }
 }
 sql.exec('COMMIT');buildXCases(sql,{today:'2026-12-31'});
 try{
  const p=new URLSearchParams('view=atlas&theme=mobilitaet&area=05558000&to=2026-12-31&today=2026-12-31');
  const c=(await xQuery(db,regions,p,{pop})).compare;
  assert.equal(c.region,'Ort 0');assert.equal(c.group.n,19);assert.equal(c.n,120);
  const rad=c.rows.find(r=>r.key==='mobilitaet.rad');
  assert.equal(rad.k,36);assert.equal(rad.share,30);assert.equal(rad.median,2.5);assert.equal(rad.class,'mehr');
  assert.equal(c.rows.find(r=>r.key==='mobilitaet.park').class,null,'unter 5 Vorgängen keine Einordnung');
  assert.equal((await xQuery(db,regions,new URLSearchParams('view=atlas&theme=mobilitaet&to=2026-12-31'),{pop})).compare,null,'ohne Ort kein Vergleich');
  /* Kreisfreie Stadt mit dem 5-stelligen Schlüssel der Suche */
  regions.push({id:'ks',kind:'city',name:'Kreisfreie Stadt',ags:'05999000'});pop.ks=150000;
  assert.equal((await xQuery(db,regions,new URLSearchParams('view=atlas&theme=mobilitaet&area=05999&to=2026-12-31&today=2026-12-31'),{pop})).compare?.region,'Kreisfreie Stadt','5-stelliger Schlüssel einer kreisfreien Stadt');
 }finally{sql.close();}
});
test('Werte aus den Unterlagen: Gliederung je Wert, Summe je Vorgang einmal, Liste',async()=>{
 const {sql,db}=fixture();try{
  const f=sql.prepare('INSERT INTO topic_facts(topic_id,kind,value,detail,method) VALUES(?,?,?,?,?)');
  f.run('a1','funding','Städtebauförderung','approved','facts-v15:text');f.run('a1','funding_euro','Städtebauförderung','100000','facts-v15:text');
  f.run('a2','funding','Städtebauförderung','approved','facts-v15:text');f.run('a2','funding_euro','Städtebauförderung','50000','facts-v15:text');
  f.run('b','funding','Städtebauförderung','applied','facts-v15:text');f.run('b','funding_euro','Städtebauförderung','20000','facts-v15:text');
  f.run('c','faction','SPD','antrag','facts-v15:title');
  const r=await xQuery(db,catalog,q('by=fact:funding&sum=funding_euro'));
  assert.deepEqual(r.rows.map(x=>[x.key,x.count,x.sum]),[['Städtebauförderung',2,120000]]);assert.equal(r.sum.name,'Förderbeträge in Euro');
  assert.deepEqual(rows(await xQuery(db,catalog,q('by=fact:faction'))),{SPD:1});
  const l=await xQuery(db,catalog,q('list=1&by=fact:funding&value=Städtebauförderung'));assert.equal(l.total,2);
  for(const s of ['by=fact:erfunden','by=region&sum=erfunden'])await assert.rejects(xQuery(db,catalog,q(s)),AnalyticsError,s);
 }finally{sql.close();}
});
test('Atlas zeigt Werte aus den Unterlagen nur über dem Qualitätstor',async()=>{
 const {sql,db}=fixture();try{
  const f=sql.prepare('INSERT INTO topic_facts(topic_id,kind,value,detail,method) VALUES(?,?,?,?,?)');
  f.run('c','hebesatz','Grundsteuer B','550|500','facts-v15:text');f.run('e','kita_fee','Erhöhung','','facts-v15:text');
  const fin=await xQuery(db,catalog,q('view=atlas&theme=finanzen'));
  assert.deepEqual(fin.facts.map(x=>[x.kind,x.rows.map(r=>[r.key,r.count])]),[['hebesatz',[['Grundsteuer B',1]]]]);
  assert.deepEqual((await xQuery(db,catalog,q('view=atlas&theme=bildung'))).facts,[],'Kita-Beiträge unter dem Tor');
 }finally{sql.close();}
});
