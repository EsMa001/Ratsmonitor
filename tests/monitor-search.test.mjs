import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {parseMonitorSearch,searchMonitor,searchCoverage,cachedSearch} from '../server/integrations/monitor-search.mjs';
import {refreshSearchWords,candidateCards} from '../server/integrations/search-words.mjs';

const catalog=[{id:'billerbeck',kind:'city',name:'Billerbeck',ags:'05558008'},{id:'coesfeld',kind:'district',name:'Kreis Coesfeld',ags:'05558'},{id:'other',kind:'city',name:'Anderer Ort',ags:'05558012'}];
function fixture(){const sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));const put=(id,region='billerbeck',extra={})=>{const t={title:'Schulbau in Dülmen',officialTitle:'Schulbau in Dülmen',shortSummary:'Öffentliche Beratung',committee:'Rat',classification:{method:'title-rules-v2',version:'labels-v2',primary:'bildung',evidence:'Schulbau in Dülmen'},sourceText:'private raw text',documentText:'never expose',...extra};sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run(id,'city','2026-09-20','2026-09-20','consulting',JSON.stringify(t),region);};return {sql,db:sqliteAdapter(sql),put};}
test('monitor search rejects malformed filters and preserves empty radius selections',()=>{
 for(const query of ['area=abc','area=123','page=-1','page=1.5','status=approved%27','level=all','month=2026-13','within=abc','revision=x','page=251','q='+('a'.repeat(201))])assert.throws(()=>parseMonitorSearch(new URLSearchParams(query)));
 assert.deepEqual(parseMonitorSearch(new URLSearchParams('within=')).within,[]);
});
test('real SQL search pages canonicals, separates levels, excludes raw text and rejects stale revisions',async()=>{
 const {sql,db,put}=fixture();try{
 for(let i=0;i<35;i++)put('a'+String(i).padStart(2,'0'));
 put('alias','billerbeck',{identity:{mergedInto:'a00'}});put('county','coesfeld');put('elsewhere','other');
 const before=sql.prepare("SELECT revision FROM data_revisions WHERE id='content'").get().revision;
 const first=await searchMonitor(db,catalog,new URLSearchParams('area=05558008&scope=only&q=dulmen'));
 /* Mit Gebiet werden Gemeinde- und Kreisebene gemeinsam betrachtet: drei Regionen in der Abdeckung */
 assert.equal(first.total,35);assert.equal(first.articles.length,20);assert.equal(first.areaCounts['05558'],37);assert.equal(first.statusCounts.consulting,35);assert.equal(first.themaCounts['Bildung & Betreuung'],35);
 /* Die Abdeckung kommt nicht mehr mit jeder Suche, sondern je Ebene aus searchCoverage */
 assert.equal(first.coverage,undefined);
 const cities=await searchCoverage(db,catalog,'city');assert.deepEqual(cities.coverage.map(c=>[c.ags,c.count]).sort(),[['05558008',35],['05558012',1]]);assert.equal(cities.level,'city');
 assert.deepEqual((await searchCoverage(db,catalog,'district')).coverage.map(c=>c.ags),['05558']);
 await assert.rejects(searchCoverage(db,catalog,'all'),/Ungültige Ebene/);
 assert.ok(!JSON.stringify(first).includes('private raw text'));assert.ok(!JSON.stringify(first).includes('documentText'));
 const second=await searchMonitor(db,catalog,new URLSearchParams('area=05558008&scope=only&page=2&revision='+first.revision));assert.equal(second.articles.length,15);assert.equal(new Set([...first.articles,...second.articles].map(a=>a.id)).size,35);
 const county=await searchMonitor(db,catalog,new URLSearchParams('level=district'));assert.equal(county.total,1);assert.equal(county.areaCounts['05558'],1);assert.equal(county.areaCounts[''],1);
 assert.equal((await searchMonitor(db,catalog,new URLSearchParams('within='))).total,0);
 assert.equal((await searchMonitor(db,catalog,new URLSearchParams('within=05558008'))).total,35);
 assert.equal((await searchMonitor(db,catalog,new URLSearchParams('q=%25'))).total,0);
 assert.equal(sql.prepare("SELECT revision FROM data_revisions WHERE id='content'").get().revision,before);
 put('new');await assert.rejects(searchMonitor(db,catalog,new URLSearchParams('revision='+first.revision)),e=>e.status===409);
 }finally{sql.close();}
});
test('several places, alternatives and filler words combine as expected',async()=>{
 const {sql,db,put}=fixture();try{
 for(let i=0;i<3;i++)put('b'+i);put('county','coesfeld');put('elsewhere','other');
 const total=q=>searchMonitor(db,catalog,new URLSearchParams(q)).then(r=>r.total);
 assert.equal(await total('area=05558008&scope=only&q=dulmen'),3);
 /* Gemeinde inklusive ihres Kreises */
 assert.equal(await total('area=05558008&scope=with&q=dulmen'),4);
 /* Weiterer Ort aus der Suche: ODER zwischen den Orten */
 assert.equal(await total('area=05558008&scope=only&more=05558012:only&q=dulmen'),4);
 assert.equal(await total('area=05558008&scope=only&more=05558012:only,05558:only'),5);
 /* Füllwörter werden ignoriert, "oder" trennt Alternativen wie ein Komma */
 assert.equal(await total('area=05558008&scope=only&q=und%20dulmen'),3);
 assert.equal(await total('q=gibtsnicht%20oder%20dulmen'),4);
 assert.equal(await total('q=gibtsnicht%2C%20dulmen'),4);
 assert.equal(await total('q=gibtsnicht%20dulmen'),0);
 for(const bad of ['more=abc:only','more='+Array(9).fill('05558008:only').join(',')])assert.throws(()=>parseMonitorSearch(new URLSearchParams(bad)));
 }finally{sql.close();}
});
test('search finds KI keywords and the long KI summary, not the automatic long text',async()=>{
 const {sql,db,put}=fixture();try{
 const total=q=>searchMonitor(db,catalog,new URLSearchParams(q)).then(r=>r.total);
 put('auto','billerbeck',{generatedBy:'Automatischer Quellenüberblick',longSummary:['Das Thema wird in Billerbeck behandelt. Zuschauertribüne']});
 put('ai','billerbeck',{generatedBy:'KI-Zusammenfassung',longSummary:['Der Zuschuss wurde ausgezahlt.','Die Einweihung plant der Sportverein.']});
 assert.equal(await total('q=sportverein'),1);assert.equal(await total('q=zuschauertribune'),0);
 /* Stichwörter zählen erst mit status completed und werden bei Änderung nachgezogen */
 const kw=status=>JSON.stringify({status,items:[{term:'Sportzentrum Helker Berg',weight:60},{term:'Kostenkalkulation',weight:40}]});
 sql.prepare("UPDATE topics SET payload=json_set(payload,'$.weightedKeywords',json(?)) WHERE id='auto'").run(kw('stale'));
 assert.equal(await total('q=kostenkalkulation'),0);
 sql.prepare("UPDATE topics SET payload=json_set(payload,'$.weightedKeywords',json(?)) WHERE id='auto'").run(kw('completed'));
 assert.equal(await total('q=kostenkalkulation'),1);assert.equal(await total('q=helker%20berg'),1);
 /* Neu gelieferte KI-Langfassung wird ebenfalls nachgezogen */
 sql.prepare("UPDATE topics SET payload=json_set(payload,'$.generatedBy','KI-Zusammenfassung','$.longSummary',json('[\"Neue Fußgängerbrücke\"]')) WHERE id='auto'").run();
 assert.equal(await total('q=fussgangerbrucke'),1);
 }finally{sql.close();}
});
test('every facet counts with all filters but its own, from one grouping',async()=>{
 const {sql,db,put}=fixture();try{
 const bau={classification:{method:'title-rules-v2',version:'labels-v2',primary:'bauen',evidence:'Neubau Feuerwehrhaus'},title:'Neubau Feuerwehrhaus',officialTitle:'Neubau Feuerwehrhaus'};
 for(let i=0;i<4;i++)put('s'+i);for(let i=0;i<3;i++)put('b'+i,'billerbeck',bau);put('o1','other');put('o2','other',bau);
 sql.prepare("UPDATE topics SET status='approved' WHERE id IN ('s0','b0','o2')").run();
 const run=q=>searchMonitor(db,catalog,new URLSearchParams(q));
 const all=await run('');
 assert.equal(all.total,9);assert.deepEqual(all.statusCounts,{approved:3,consulting:6});assert.deepEqual(all.themaCounts,{'Bildung & Betreuung':5,'Bauen & Wohnen':4});
 assert.equal(all.areaCounts['05558008'],7);assert.equal(all.areaCounts['05558012'],2);assert.equal(all.areaCounts[''],9);
 /* Thema gewählt: Gesamtzahl, Status und Gebiete mit Thema; die Themenzähler zeigen alle Themen (ohne den Themenfilter) */
 const bauen=await run('label=Bauen%20%26%20Wohnen');
 assert.equal(bauen.total,4);assert.deepEqual(bauen.statusCounts,{approved:2,consulting:2});assert.deepEqual(bauen.themaCounts,{'Bildung & Betreuung':5,'Bauen & Wohnen':4});assert.equal(bauen.areaCounts['05558008'],3);
 /* Status gewählt: die Statuszähler zeigen alle Status */
 const approved=await run('status=approved');
 assert.equal(approved.total,3);assert.deepEqual(approved.statusCounts,{approved:3,consulting:6});assert.deepEqual(approved.themaCounts,{'Bildung & Betreuung':1,'Bauen & Wohnen':2});
 /* Gebiet gewählt: die Gebietszähler zeigen alle Gebiete, die übrigen Zähler nur das Gebiet */
 const one=await run('area=05558012&scope=only');
 assert.equal(one.total,2);assert.equal(one.areaCounts['05558008'],7);assert.deepEqual(one.statusCounts,{approved:1,consulting:1});
 assert.deepEqual(one.articles.map(a=>a.id).sort(),['o1','o2']);
 /* Ergebnisseite mit großer Auswahl (Ausschluss der Kreise) und mit kleiner (Einschluss) liefert dieselben Treffer */
 assert.deepEqual(all.articles.map(a=>a.id).sort(),['b0','b1','b2','o1','o2','s0','s1','s2','s3']);
 }finally{sql.close();}
});
test('search results are kept while the data revision stays the same',async()=>{
 const {sql,db,put}=fixture();try{
 for(let i=0;i<3;i++)put('k'+i);
 let calls=0;const counted={...db,prepare:(...a)=>{calls++;return db.prepare(...a);},batch:(...a)=>db.batch(...a)};
 const params=new URLSearchParams('q=dulmen&level=city');
 const first=await cachedSearch(counted,catalog,params);const afterFirst=calls;
 const second=await cachedSearch(counted,catalog,new URLSearchParams('level=city&q=dulmen'));
 assert.equal(second,first);assert.equal(calls-afterFirst,1);
 put('k9');
 const third=await cachedSearch(counted,catalog,params);
 assert.notEqual(third,first);assert.equal(third.total,4);
 }finally{sql.close();}
});

test('searching through the word list gives exactly the result of searching all cards',async()=>{
 const {sql,db,put}=fixture();try{
  const titles=['Windpark Planung','Windpark Bürgerbeteiligung','Kita Neubau','Kita Sanierung Turnhalle','Radweg Brücke','Bürgerwindpark Erweiterung','Planung Radweg','Schulbau Planung Kita','Parkplatz am Rathaus','Windkraft Radweg','Anderer Weg'];
  titles.forEach((t,i)=>put('c'+i,['billerbeck','other','coesfeld'][i%3],{title:t,officialTitle:t}));
  const queries=['q=anderer','q=anderer+oder+kita','q=windpark&exact=1','q=windpark&level=district','q=windpark&level=district&exact=1','q=park&exact=1','q=windpark+planung&exact=1','q=anderer&exact=1','q=planung&exact=1&level=district','q=anderer&sort=asc','q=windpark','q=park','q=windpark+planung','q=windpark+oder+kita','q=radweg&sort=asc','q=planung&sort=relevance','q=kita&noformal=1','q=windpark&area=05558008&scope=only','q=radweg&area=05558&scope=with','q=planung&level=district','q=kita&status=consulting','q=windpark&month=2026-09','q=windpark&size=15&page=1','q=kalorien','q=bau+planung','q=windpark,radweg'];
  const run=async q=>{const r=await searchMonitor(db,catalog,new URLSearchParams(q));return {ids:r.articles.map(a=>a.id),total:r.total,area:r.areaCounts,thema:r.themaCounts,status:r.statusCounts,badge:r.badgeCounts};};
  const before=[];for(const q of queries)before.push(await run(q));
  await refreshSearchWords(db,{full:true});
  assert.ok(await candidateCards(db,[['windpark']]),'the list is used for rare words');
  const named=await candidateCards(db,[['anderer']],{nameIds:t=>t==='anderer'?['other']:[]});
  assert.ok(named&&named.length>=before[0].total,'rare word inside a region name: cards of that region are candidates too');
  for(const [i,q] of queries.entries())assert.deepEqual(await run(q),before[i],q);
  const at=q=>before[queries.indexOf(q)];
  assert.ok(at('q=windpark').total>0&&at('q=windpark+oder+kita').total>0&&at('q=anderer').total>0,'the queries find something');
  assert.ok(at('q=windpark&exact=1').total>0&&at('q=windpark&level=district&exact=1').total<at('q=windpark&level=district').total,'exact matches only whole words (not Bürgerwindpark)');
  assert.equal(at('q=park&exact=1').total,0,'park is no whole word here');
  /* Strom und Seite liefern über die Liste dieselben Treffer wie über alle Karten */
  const streamed=[];for await(const part of (await searchMonitor(db,catalog,new URLSearchParams('q=windpark&part=stream'))).stream)streamed.push(...(part.articles??[]));
  assert.deepEqual(streamed.map(a=>a.id),at('q=windpark').ids);
 }finally{sql.close();}
});

test('precomputed facets of common words equal the grouping over all cards, per level and with a cut-off date',async()=>{
 const {sql,db,put}=fixture();try{
  const titles=['Windpark Planung','Windpark Bürgerbeteiligung','Kita Neubau','Kita Sanierung Turnhalle','Radweg Brücke','Bürgerwindpark Erweiterung','Planung Radweg','Schulbau Planung Kita','Parkplatz am Rathaus','Windkraft Radweg','Parkplatz Nord','Platz','Anderer Weg Kita','Anderer Weg'];
  titles.forEach((t,i)=>put('c'+i,['billerbeck','other','coesfeld'][i%3],{title:t,officialTitle:t}));
  const queries=['q=windpark','q=kita','q=radweg','q=planung','q=park','q=platz','q=parkplatz','q=kita&level=district','q=planung&level=district','q=windpark&to=2026-09-10','q=kita&to=2026-09-30','q=radweg&sort=asc','q=anderer','q=anderer&to=2026-09-10','q=anderer&level=district','q=ander'];
  const run=async q=>{const r=await searchMonitor(db,catalog,new URLSearchParams(q));return {ids:r.articles.map(a=>a.id),total:r.total,area:r.areaCounts,thema:r.themaCounts,status:r.statusCounts,badge:r.badgeCounts};};
  const before=[];for(const q of queries)before.push(await run(q));
  const kinds=new Map(catalog.map(r=>[r.id,r.kind]));
  await refreshSearchWords(db,{full:true,kinds,postingMax:1,blockedMin:1});   // alle Wörter mit mehr als einer Karte gelten als häufig
  const common=sql.prepare('SELECT count(*) n FROM search_words WHERE cards>200').get().n;
  assert.ok(common>0&&sql.prepare('SELECT count(*) n FROM search_word_areas').get().n>0,'there are common words with precomputed numbers');
  /* „platz“ ist selten (1 Karte), steckt aber im häufigen „parkplatz“: die Karten-IDs greifen dort nicht, also auch vorberechnet; Standard: erst ab 6 Karten */
  const blocked=sql.prepare("SELECT cards,hits_city FROM search_words WHERE word='platz'").get();
  assert.ok(blocked.cards<=200&&blocked.hits_city!==null,'rare word inside a common word is precomputed');
  await refreshSearchWords(db,{full:true,kinds,postingMax:1});
  assert.equal(sql.prepare("SELECT count(*) n FROM search_words WHERE cards<=200 AND hits_city IS NOT NULL").get().n,0,'rare words with fewer than 6 cards are not precomputed');
  await refreshSearchWords(db,{full:true,kinds,postingMax:1,blockedMin:1});
  for(const [i,q] of queries.entries())assert.deepEqual(await run(q),before[i],q);
  /* neue Karte (nur eingefügt): die Zahlen werden fortgeschrieben und stimmen weiter */
  put('new1','billerbeck',{title:'Kita Windpark Radweg',officialTitle:'Kita Windpark Radweg'});
  await refreshSearchWords(db,{kinds,postingMax:1});
  const expected=[];for(const q of ['q=kita','q=windpark','q=radweg'])expected.push(await run(q));
  sql.exec("DELETE FROM search_word_areas;DELETE FROM search_word_facets;UPDATE search_words SET hits_city=NULL,hits_district=NULL");
  let k=0;for(const q of ['q=kita','q=windpark','q=radweg'])assert.deepEqual(await run(q),expected[k++],q+' (nach Fortschreibung)');
 }finally{sql.close();}
});
