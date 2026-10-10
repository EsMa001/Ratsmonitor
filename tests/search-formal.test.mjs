// Paket 1 der Code-Analyse (requirements/code-analyse-2026-10-10.md): Spalte formal, eigener Datenstand der Suche,
// Sperre der Wortliste, voller Aufbau bei fehlenden vorberechneten Zahlen, Abdeckung je Gebiet (drizzle/0017).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {searchMonitor,searchCoverage,cachedSearch,cachedCoverage,FORMAL,NOT_FORMAL} from '../server/integrations/monitor-search.mjs';
import {refreshSearchWords,SEARCH_REVISION_SQL} from '../server/integrations/search-words.mjs';

const MIGRATION=fs.readFileSync(new URL('../drizzle/0017_search_formal_revision.sql',import.meta.url),'utf8');
const catalog=[{id:'billerbeck',kind:'city',name:'Billerbeck',ags:'05558008'},{id:'coesfeld',kind:'district',name:'Kreis Coesfeld',ags:'05558'},{id:'other',kind:'city',name:'Anderer Ort',ags:'05558012'}];
/** Schema aus drizzle/, wahlweise ohne 0017 (Datenbank vor der Migration) */
function fixture({withoutFormal=false}={}){
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()){
  if(withoutFormal&&file.startsWith('0017'))continue;
  sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 }
 const put=(id,title,region='billerbeck')=>{const t={title,officialTitle:title,shortSummary:'Öffentliche Beratung',committee:'Rat',classification:{method:'title-rules-v2',version:'labels-v2',primary:'bildung',evidence:title}};sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run(id,'city','2026-09-20','2026-09-20','consulting',JSON.stringify(t),region);};
 const retitle=(id,title)=>sql.prepare("UPDATE topics SET payload=json_set(payload,'$.title',?,'$.officialTitle',?) WHERE id=?").run(title,title,id);
 const revision=id=>sql.prepare('SELECT revision FROM data_revisions WHERE id=?').get(id)?.revision;
 return {sql,db:sqliteAdapter(sql),put,retitle,revision};
}
/* Titel, an denen die Muster greifen oder knapp nicht greifen (Großschreibung, Umlaute, Ausnahmen) */
const TITLES=['Einwohnerfragestunde','Verschiedenes','Anfragen der Fraktionen','Bauvoranfragen Riedstraße 15','Mitteilungen der Verwaltung',
 'Mitteilungen; Beschaffung von Feuerwehrfahrzeugen','Widerspruch der Hauptverwaltungsbeamtin gegen den Beschluss des Stadtrates',
 'Eröffnung der Sitzung','ERÖFFNUNG DER SITZUNG','Genehmigung der Tagesordnung','Niederschrift über die 3. Sitzung','NIEDERSCHRIFT',
 'Bericht des Oberbürgermeisters','Bericht des Bürgermeisters zur Lage','Verpflichtung eines Ratsmitglieds','Anträge der Fraktionen',
 'Bekanntgabe von Beschlüssen','Schulbau in Dülmen','Haushalt 2027','Fragestunde für Einwohner'];
/** Bisherige Bedingung der Suche (LIKE-Muster auf dem Titel), als Vergleich */
const oldFormal=(sql,title)=>!sql.prepare(`SELECT (NOT (${FORMAL.map(()=>'lower(?) LIKE ?').join(' OR ')}) OR ${NOT_FORMAL.map(()=>'lower(?) LIKE ?').join(' OR ')}) keep`).get(...FORMAL.flatMap(p=>[title,p]),...NOT_FORMAL.flatMap(p=>[title,p])).keep;
const patterns=text=>[...text.matchAll(/LIKE '([^']*)'/g)].map(m=>m[1]);

test('Migration 0017 nutzt genau die Muster der Suche, im Trigger und beim Nachfüllen',()=>{
 const trigger=MIGRATION.slice(MIGRATION.indexOf('CREATE TRIGGER `trg_search_cards_formal`'),MIGRATION.indexOf('BEGIN',MIGRATION.indexOf('trg_search_cards_formal')));
 const fill=MIGRATION.slice(MIGRATION.indexOf('UPDATE search_cards SET formal=1'),MIGRATION.indexOf('CREATE INDEX `idx_search_cards_noformal`'));
 for(const part of [trigger,fill]){
  const [formal,exceptions]=part.split('AND NOT (');
  assert.deepEqual(patterns(formal),FORMAL);
  assert.deepEqual(patterns(exceptions),NOT_FORMAL);
 }
});

test('formal steht beim Einfügen fest und folgt dem Titel, wenn eine Karte ersetzt wird',()=>{
 const {sql,put,retitle}=fixture();try{
  TITLES.forEach((t,i)=>put('t'+i,t));
  for(const [i,t] of TITLES.entries())assert.equal(sql.prepare('SELECT formal FROM search_cards WHERE id=?').get('t'+i).formal,oldFormal(sql,t)?1:0,t);
  assert.ok(sql.prepare('SELECT count(*) n FROM search_cards WHERE formal=1').get().n>=10);
  retitle('t0','Bebauungsplan Nr. 7');retitle('t17','Niederschrift der Sitzung vom 3. März');
  assert.equal(sql.prepare("SELECT formal FROM search_cards WHERE id='t0'").get().formal,0);
  assert.equal(sql.prepare("SELECT formal FROM search_cards WHERE id='t17'").get().formal,1);
 }finally{sql.close();}
});

test('Suche ohne Formalien: gleiches Ergebnis mit Spalte und ohne Migration (Rückfall auf die Muster)',async()=>{
 const migrated=fixture(),old=fixture({withoutFormal:true});try{
  for(const f of [migrated,old])TITLES.forEach((t,i)=>{f.put('t'+i,t,i%3?'billerbeck':'other');});
  for(const query of ['noformal=1','noformal=1&scope=only&area=05558008','noformal=1&q=sitzung','noformal=1&level=district','scope=only&area=05558012']){
   const a=await searchMonitor(migrated.db,catalog,new URLSearchParams(query)),b=await searchMonitor(old.db,catalog,new URLSearchParams(query));
   assert.equal(a.total,b.total,query);
   assert.deepEqual(a.articles.map(x=>x.id),b.articles.map(x=>x.id),query);
   assert.deepEqual(a.areaCounts,b.areaCounts,query);assert.deepEqual(a.themaCounts,b.themaCounts,query);assert.deepEqual(a.statusCounts,b.statusCounts,query);
  }
 }finally{migrated.sql.close();old.sql.close();}
});

test('Zählung ohne Formalien liest nur den Teilindex',()=>{
 const {sql}=fixture();try{
  const plan=sql.prepare("EXPLAIN QUERY PLAN SELECT region_id,label,status,count(*) n FROM search_cards WHERE region_id NOT IN (SELECT value FROM json_each(?)) AND date<=? AND formal=0 GROUP BY region_id,label,status").all('[]','2026-12-31').map(r=>r.detail).join(' | ');
  assert.match(plan,/COVERING INDEX idx_search_cards_noformal/);
 }finally{sql.close();}
});

test('Datenstand der Suche: steigt mit Vorgängen, nicht mit Abdeckung, Versionen oder Analysen',async()=>{
 const {sql,db,put,retitle,revision}=fixture();try{
  put('a','Schulbau in Dülmen');
  const start=revision('search'),content=revision('content');
  assert.ok(start>0);
  sql.prepare("INSERT INTO source_coverage(region_id,payload) VALUES('billerbeck','{}') ON CONFLICT(region_id) DO UPDATE SET payload=excluded.payload").run();
  sql.prepare("INSERT INTO article_versions(id,topic_id,captured_at,payload) VALUES('v1','a','2026-10-01','{}')").run();
  sql.prepare("INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES('x','a','rule-label','m','h','2026','{}')").run();
  assert.equal(revision('search'),start);
  assert.ok(revision('content')>content,'der allgemeine Datenstand steigt weiter');
  retitle('a','Schulbau in Coesfeld');assert.ok(revision('search')>start);
  const afterUpdate=revision('search');put('b','Haushalt');assert.ok(revision('search')>afterUpdate);
  const afterInsert=revision('search');sql.prepare("DELETE FROM topics WHERE id='b'").run();assert.ok(revision('search')>afterInsert);
  assert.equal(String((await db.prepare(SEARCH_REVISION_SQL).first()).revision),String(revision('search')));
 }finally{sql.close();}
});

test('Datenstand der Suche ohne Migration: der allgemeine Datenstand',async()=>{
 const {sql,db,revision}=fixture({withoutFormal:true});try{
  sql.prepare("INSERT INTO data_revisions(id,revision) VALUES('content',41) ON CONFLICT(id) DO UPDATE SET revision=41").run();
  assert.equal(revision('search'),undefined);
  assert.equal((await db.prepare(SEARCH_REVISION_SQL).first()).revision,41);
 }finally{sql.close();}
});

test('Zwischenspeicher der Suche überdauert Importschritte ohne Änderung, nicht aber geänderte Vorgänge',async()=>{
 const {sql,db,put,retitle}=fixture();try{
  for(let i=0;i<3;i++)put('k'+i,'Schulbau in Dülmen');
  const params='q=dulmen&level=city';
  const first=await cachedSearch(db,catalog,new URLSearchParams(params));
  sql.prepare("INSERT INTO source_coverage(region_id,payload) VALUES('billerbeck','{\"complete\":true}') ON CONFLICT(region_id) DO UPDATE SET payload=excluded.payload").run();
  assert.equal(await cachedSearch(db,catalog,new URLSearchParams(params)),first,'Abdeckung geschrieben: derselbe Treffer');
  retitle('k1','Haushalt 2027');
  const third=await cachedSearch(db,catalog,new URLSearchParams(params));
  assert.notEqual(third,first);assert.equal(third.total,2);
  /* Blättern mit dem Stand der ersten Seite: nach einem Importschritt ohne Änderung kein 409 */
  const revisionParam=new URLSearchParams(params+'&page=1&revision='+third.revision);
  sql.prepare("UPDATE source_coverage SET payload='{}' WHERE region_id='billerbeck'").run();
  await searchMonitor(db,catalog,revisionParam);
 }finally{sql.close();}
});

test('Abdeckung: erst je Gebiet gezählt, Ergebnis wie bisher; gehalten höchstens fünf Minuten',async()=>{
 const {sql,db,put}=fixture();try{
  put('a','Schulbau','billerbeck');put('b','Haushalt','billerbeck');put('c','Kita','other');
  sql.prepare("INSERT INTO source_coverage(region_id,payload) VALUES('billerbeck','{\"complete\":true}')").run();
  const r=await searchCoverage(db,catalog,'city');
  assert.deepEqual(r.coverage.map(c=>[c.ags,c.count,c.complete]),[['05558008',2,true],['05558012',1,false]]);
  const t0=Date.parse('2026-10-10T10:00:00Z');
  const first=await cachedCoverage(db,catalog,'city',{now:t0});
  assert.equal(await cachedCoverage(db,catalog,'city',{now:t0+60000}),first);
  sql.prepare("UPDATE source_coverage SET payload='{\"complete\":false}' WHERE region_id='billerbeck'").run();
  const later=await cachedCoverage(db,catalog,'city',{now:t0+301000});
  assert.notEqual(later,first);assert.equal(later.coverage[0].complete,false);
 }finally{sql.close();}
});

test('Wortliste: zwei Nachführungen zugleich, die zweite lässt aus; danach ist die Sperre frei',async()=>{
 const {sql,db,put}=fixture();try{
  put('a','Schulbau in Dülmen');put('b','Haushalt 2027');
  await refreshSearchWords(db,{full:true});
  put('c','Kita Sonnenschein');
  const [x,y]=await Promise.all([refreshSearchWords(db),refreshSearchWords(db)]);
  assert.equal([x,y].filter(r=>r.busy).length,1);
  assert.equal(sql.prepare("SELECT count(*) n FROM system_state WHERE key='search-words-lease'").get().n,0);
  const again=await refreshSearchWords(db);assert.notEqual(again.busy,true);
  assert.ok(sql.prepare("SELECT 1 FROM search_postings WHERE word='sonnenschein'").get());
 }finally{sql.close();}
});

test('Wortliste: fehlen die vorberechneten Zahlen, baut fullIfNoHits sie neu auf; Nachführen allein nicht',async()=>{
 const {sql,db,put}=fixture();try{
  const kinds=new Map(catalog.map(r=>[r.id,r.kind]));
  for(let i=0;i<4;i++)put('s'+i,'Schulbau Nummer '+i);
  await refreshSearchWords(db,{full:true,kinds,postingMax:2});
  const state=()=>JSON.parse(sql.prepare("SELECT value FROM system_state WHERE key='search-words'").get().value);
  const facets=()=>sql.prepare('SELECT count(*) n FROM search_word_facets').get().n;
  assert.equal(state().hasHits,true);const before=facets();assert.ok(before>0);
  /* Zustand wie auf dem Server: Zahlen verloren, hasHits false */
  sql.prepare("UPDATE system_state SET value=json_set(value,'$.hasHits',json('false')) WHERE key='search-words'").run();
  sql.prepare('DELETE FROM search_word_facets').run();
  await refreshSearchWords(db,{kinds,postingMax:2});
  assert.equal(state().hasHits,false);assert.equal(facets(),0);
  await refreshSearchWords(db,{kinds,postingMax:2,fullIfNoHits:true});
  assert.equal(state().hasHits,true);assert.equal(facets(),before);
 }finally{sql.close();}
});
