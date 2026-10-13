// plenara.X – eine Abfrage (server/integrations/plenara-x-query.mjs): Vorgänge statt Karten, Formalien nie, Thema wie im
// Themenfilter der Suche, Unterthemen und „Was geschieht“ aus report_rules, Anteil und Liste.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {xQuery} from '../server/integrations/plenara-x-query.mjs';
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
test('Ungültige Auswahl wird abgewiesen',async()=>{
 const {sql,db}=fixture();try{
  for(const s of ['theme=erfunden','sub=erfunden','theme=finanzen&sub=mobilitaet.rad','stage=x','by=fraktion'])
   await assert.rejects(xQuery(db,catalog,q(s)),AnalyticsError,s);
 }finally{sql.close();}
});
