import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {adminKeywords} from '../server/integrations/admin-keywords.mjs';
import {classifyTopic} from '../shared/labels.mjs';
import {features} from '../shared/similarity.mjs';
const now=new Date('2026-10-02T12:00:00Z');
function sqlite(topics){
 const raw=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())raw.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const put=raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 topics.forEach((t,i)=>put.run('t'+i,'billerbeck','city','2026-09-01','2026-10-01T00:00:00Z','unknown',JSON.stringify({id:'t'+i,title:'T',identity:{},...t})));
 return sqliteAdapter(raw);
}
const label=(primary,reason)=>({classification:{primary,reason}});
const words=(primary,...found)=>label(primary,'Erkannte Sachbegriffe: '+found.join(', '));
const profile=(items,extra={})=>({weightedKeywords:{status:'completed',items:items.map(([term,weight])=>({term,weight})),...extra}});
test('keyword overview counts the words the label rules stored, once per report and spelling-insensitive',async()=>{
 const d=await adminKeywords(sqlite([
  words('bildung','Schul','Ganztag'),words('bildung','Schul'),words('bildung','schul','Schul'),words('bauen','Bebauungsplan'),
  label('unklar','Titel benennt kein ausreichend eindeutiges Sachthema.'),label('unklar','Mehrere mögliche Sachgebiete; Zuordnung offen.'),
  label('sitzung','Formaler Sitzungs- oder Gremienpunkt; kein eigenes politisches Sachgebiet.'),label('allgemein','Allgemeiner Tagesordnungspunkt ohne benanntes Sachthema. Inhalt wird nicht aus dem Gremium abgeleitet.'),
  label('mobilitaet','Konkrete Maßnahme an Verkehrsflächen oder öffentlicher Beleuchtung.'),
  {},
  // A report merged into another one is not an article of its own.
  {...words('bauen','Bebauungsplan','Wohnraum'),identity:{mergedInto:'t3'}},
 ]),{now});
 assert.equal(d.asOf,now.toISOString());assert.equal(d.articles,10);
 assert.deepEqual(d.rule.words,[{term:'Schul',articles:3,label:'bildung'},{term:'Bebauungsplan',articles:1,label:'bauen'},{term:'Ganztag',articles:1,label:'bildung'}]);
 const {words:_,...figures}=d.rule;assert.deepEqual(figures,{labelled:9,withWords:4,formal:1,general:1,several:1,none:1,other:1,distinct:3});
});
test('keyword overview reads the reason exactly as the label rule writes it',async()=>{
 // The overview depends on the wording of the rule's reason; this fails if that wording changes.
 const stored=[{title:'Erweiterung der Grundschule und Ganztagsbetreuung'},{title:'Bebauungsplan Nr. 12 "Am Bahnhof"'},{title:'Mitteilungen'},{title:'Erneuerung der Fahrbahn Hauptweg'}].map(t=>({...t,classification:classifyTopic(t),analysisFeatures:features(t)}));
 const d=await adminKeywords(sqlite(stored),{now});
 assert.deepEqual(d.rule.words.map(w=>[w.term,w.label,w.articles]).sort(),[['Bebauungsplan','bauen',1],['Ganztag','bildung',1],['schul','bildung',1]]);
 assert.equal(d.rule.withWords,2);assert.equal(d.rule.general,1);assert.equal(d.rule.other,1);
 assert.equal(d.titleTerms.analysed,4);assert.ok(d.titleTerms.terms.some(t=>t.term==='bebauungsplan'&&t.articles===1));assert.deepEqual(d.titleTerms.subjects,[{term:'Ganztagsbetreuung',articles:1}]);
});
test('keyword overview ranks title terms and tells how many there are beyond the delivered list',async()=>{
 const terms=(...list)=>({analysisFeatures:{terms:list,subjects:list.includes('radweg')?['Radverkehr']:[]}});
 const db=sqlite([terms('radweg','sanierung'),terms('radweg','haushalt'),terms('radweg'),terms('sanierung'),{analysisFeatures:{terms:[],subjects:[]}},{}]);
 const d=await adminKeywords(db,{now});
 assert.deepEqual(d.titleTerms,{analysed:5,distinct:3,once:1,terms:[{term:'radweg',articles:3},{term:'sanierung',articles:2},{term:'haushalt',articles:1}],subjects:[{term:'Radverkehr',articles:3}]});
 const short=await adminKeywords(db,{now,limit:2});
 assert.equal(short.listLimit,2);assert.deepEqual(short.titleTerms.terms.map(t=>t.term),['radweg','sanierung']);assert.equal(short.titleTerms.distinct,3);assert.equal(short.titleTerms.once,1);
});
test('keyword overview adds up AI keywords with their weights and keeps content profiles apart from the title test',async()=>{
 const d=await adminKeywords(sqlite([
  profile([['Ganztag',60],['Schulhof',40]],{inputBasis:'content',method:'ai-agent-content-v1'}),
  profile([['ganztag',100]],{method:'codex-title-keywords-v1'}),
  profile([[' Ganztag ',30],['Haushalt',70]],{inputBasis:'content'}),
  // The title changed after this profile was written: it no longer describes the report.
  {weightedKeywords:{status:'stale',items:[{term:'Altlast',weight:100}]}},
  {...profile([['Verborgen',100]]),identity:{mergedInto:'t0'}},
  {},
 ]),{now});
 assert.deepEqual(d.ai.items,[
  {term:'Ganztag',articles:3,weight:190,contentArticles:2,contentWeight:90},
  {term:'Haushalt',articles:1,weight:70,contentArticles:1,contentWeight:70},
  {term:'Schulhof',articles:1,weight:40,contentArticles:1,contentWeight:40}]);
 const {items:_,...figures}=d.ai;assert.deepEqual(figures,{profiles:3,content:2,stale:1,distinct:3,once:2,cut:false});
 // An empty database is an empty overview, not an error.
 const empty=await adminKeywords(sqlite([]),{now});
 assert.equal(empty.articles,0);assert.deepEqual(empty.rule.words,[]);assert.deepEqual(empty.titleTerms.terms,[]);assert.deepEqual(empty.ai.items,[]);assert.equal(empty.ai.distinct,0);assert.equal(empty.titleTerms.distinct,0);
});
