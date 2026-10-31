// Dokumentsuche (server/integrations/doc-search.mjs): Suchsprache → FTS5, Filter vor dem Rang, Fundstellen, Antwortform,
// Stand und Fehler; Route nur für Pro (gated mit feature fulltext). Index aus einer Testablage (server/node/doc-index.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore} from '../server/node/pdf-store.mjs';
import {indexDocuments,openDocReader} from '../server/node/doc-index.mjs';
import {toMatch,parseDocSearch,searchDocuments,snippetOf,DocSearchError,CAND_MAX,SNIPPETS} from '../server/integrations/doc-search.mjs';
import {FEATURES,TIERS} from '../shared/plans.mjs';
import {memoryDb} from './helpers/d1.mjs';

const P=o=>new URLSearchParams(o);
const CATALOG=[
 {id:'r1',ags:'05515008',name:'Billerbeck',kind:'city'},
 {id:'r2',ags:'05315000',name:'Köln',kind:'city'},
 {id:'r3',ags:'05515',name:'Kreis Coesfeld',kind:'district'},
];

test('search language becomes FTS5 syntax',()=>{
 const m=q=>toMatch(q).match;
 assert.equal(m('wärmeplanung förderung'),'(("warmeplanung" OR "waermeplanung") AND ("forderung" OR "foerderung"))');
 assert.equal(m('kita oder kindergarten'),'("kita") OR ("kindergarten")');
 assert.equal(m('"kommunale Wärmeplanung"'),'("kommunale warmeplanung" OR "kommunale waermeplanung")');
 assert.equal(m('„kommunale Planung“'),'"kommunale planung"','deutsche Anführungszeichen');
 assert.deepEqual([m('radweg -anlage'),toMatch('radweg -anlage').exclude],['"radweg"','"anlage"'],'Ausschluss als eigener Ausdruck');
 assert.equal(toMatch('radweg NICHT anlage oder brücke -plan').exclude,'"anlage" OR "plan"','gilt für die ganze Suche');
 assert.equal(m('wind*'),'"wind"*');
 assert.equal(m('wi*'),'"wi"','Präfix erst ab 3 Zeichen');
 assert.equal(m('wärme NAHE förderung'),'NEAR("warme" "forderung", 10)');
 assert.equal(m('Kita-Gebühren'),'("kita gebuhren" OR "kita gebuehren")','Bindestrich: Phrase');
 assert.equal(m('V/0486/2026'),'"v 0486 2026"');
 assert.equal(m('Straße und Weg'),'("strasse" AND "weg")','Füllwörter fallen weg');
 assert.equal(m('die'),'"die"','nur Füllwörter: bleiben');
 assert.equal(m('Hebesatz ODER Grundsteuer'),'("hebesatz") OR ("grundsteuer")');
});

test('hostile or empty input gives a 400, never an SQLite error',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE VIRTUAL TABLE f USING fts5(text,content='',contentless_delete=1,tokenize='unicode61 remove_diacritics 2');INSERT INTO f(rowid,text) VALUES(1,'eins zwei')");
 const inputs=['"','((','OR OR','-nur','NOT','NAHE x','x NAHE','"unclosed phrase','a" OR "b','x'.repeat(201),'a b c d e f g h i j k l m',
  'col:wert','^start','*','a AND OR b','"" "" ""','-a -b','NEAR(a b)','\'; DROP TABLE f; --','ä*','{a b}','a+b','x OR -y'];
 for(let i=0;i<300;i++)inputs.push(Array.from({length:1+i%12},(_,k)=>'"(*)-:^+ aäß OR NOT NAHE'.split('')[(i*7+k*13)%26]||'w').join(''));
 for(const q of inputs){
  let built=null;
  try{built=toMatch(q);}catch(e){assert.ok(e instanceof DocSearchError,`${q}: ${e.message}`);assert.equal(e.status,400);continue;}
  for(const e of [built.match,built.exclude].filter(Boolean))assert.doesNotThrow(()=>db.prepare('SELECT rowid FROM f WHERE f MATCH ?').all(e),`${JSON.stringify(q)} → ${e}`);
 }
});

test('parameters are checked',()=>{
 assert.throws(()=>parseDocSearch(P({})),{status:400});
 assert.throws(()=>parseDocSearch(P({q:'x',art:'foto'})),/Dokumentart/);
 assert.throws(()=>parseDocSearch(P({q:'x',page:'51'})),{status:400});
 assert.throws(()=>parseDocSearch(P({q:'x',from:'2026-1-1'})),{status:400});
 assert.throws(()=>parseDocSearch(P({q:'x',sort:'asc'})),{status:400});
 assert.throws(()=>parseDocSearch(P({q:'x',revision:'abc'})),{status:400});
 const f=parseDocSearch(P({q:'Radweg',art:'vorlage,anlage',area:'05515008',scope:'only'}));
 assert.deepEqual(f.types,['paper','attachment']);assert.equal(f.size,20);assert.equal(f.sort,'relevance');
});

test('a snippet shows the first hit with words around it, cut at word boundaries',()=>{
 const t=[{words:['warmeplanung'],prefix:false}];
 const s=snippetOf('x '.repeat(100)+'Die kommunale Wärmeplanung ist bis 2028 vorzulegen. '+'y '.repeat(100),t);
 assert.equal(s.hit,'Wärmeplanung');
 assert.match(s.before,/^… .*Die kommunale $/);assert.match(s.after,/^ ist bis 2028 vorzulegen\..* …$/);
 assert.ok((s.before+s.hit+s.after).length<=175);
 assert.ok(!/\S…|…\S/.test(s.before.slice(0,3)+s.after.slice(-3)),'Schnitt an Wortgrenzen');
 assert.equal(snippetOf('Bebauungs-\nplan Nr. 5',[{words:['bebauungsplan'],prefix:false}]).hit,'Bebauungsplan','Trennstrich am Zeilenende');
 assert.equal(snippetOf('Die Straße am Markt',[{words:['strasse'],prefix:false}]).hit,'Straße','Original mit ß');
 assert.equal(snippetOf('Neue Windenergieanlagen geplant',[{words:['windenergie'],prefix:true}]).hit,'Windenergieanlagen','Präfix');
 assert.equal(snippetOf('Die kommunale Planung der Wärme',[{words:['kommunale','planung'],prefix:false}]).hit,'kommunale Planung','Phrase');
 assert.equal(snippetOf('Ohne Treffer auf dieser Seite',[{words:['radweg'],prefix:false}]).hit,'','ohne Treffer der Seitenanfang');
});

/* Testablage mit Index und Hauptdatenbank (topics mit Unterlagen) */
async function fixture(){
 const store=openPdfStore(fs.mkdtempSync(path.join(os.tmpdir(),'doc-search-')));
 const {sql,db}=memoryDb();
 const add=(url,pages,{topic,region='r1',date='2026-09-01',type='paper',title='Beschlussvorlage',committee='Rat'}={})=>{
  store.put(url,new TextEncoder().encode('%PDF-1.4 '+url),{topicId:topic,regionId:region,eventDate:date,docType:type});
  store.putText(store.entry(url).sha256,pages,{method:'text',version:1});
  sql.prepare("INSERT OR IGNORE INTO topics(id,source,event_date,updated_at,status,payload,region_id) VALUES(?,?,?,?,?,?,?)").run(topic,'test',date,date,'info',
   JSON.stringify({title:`Vorgang ${topic}`,committee,documents:[{url:'https://x.example/einladung.pdf',title:'Einladung'},{url,title}]}),region);
 };
 add('https://a.example/1.pdf',['Die kommunale Wärmeplanung der Gemeinde ist bis 2028 vorzulegen.','Seite zwei ohne den Begriff, aber mit genug Text.','Die Förderung der Wärmeplanung kommt vom Land; die Wärmeplanung wird öffentlich.'],{topic:'t1',title:'Beschlussvorlage 12/2026'});
 add('https://a.example/2.pdf',['Kita-Gebühren steigen ab dem nächsten Jahr deutlich an.'],{topic:'t2',region:'r2',date:'2026-10-01',type:'minutes'});
 add('https://a.example/3.pdf',['Die Waermeplanung im Altbestand wird ohne Umlaute geschrieben.'],{topic:'t3',date:'2026-08-01'});
 await indexDocuments({dir:store.dir});
 return {store,sql,db,reader:openDocReader(store.dir,{recheckMs:0}),add};
}

test('documents with page snippets, title and link data from the report',async()=>{
 const {store,db,reader}=await fixture();
 const r=await searchDocuments(db,reader,CATALOG,P({q:'Wärmeplanung'}));
 assert.equal(r.total,2,'mit Umlaut und als ae');assert.equal(r.capped,false);assert.equal(r.page,1);assert.match(r.revision,/^\d+$/);
 const d=r.documents.find(x=>x.topicId==='t1');
 assert.equal(d.title,'Beschlussvorlage 12/2026');assert.equal(d.topicTitle,'Vorgang t1');assert.equal(d.docIndex,1,'Nummer der Unterlage für /api/dokument');
 assert.equal(d.gemeinde,'Billerbeck');assert.equal(d.ags,'05515008');assert.equal(d.gremium,'Rat');assert.equal(d.date,'2026-09-01');assert.equal(d.art,'vorlage');
 assert.equal(d.hits,2);assert.deepEqual(d.snippets.map(x=>x.page),[1,3],'Seiten in Folge, ohne die Seite ohne Treffer');
 assert.ok(d.snippets.every(x=>/wärmeplanung/i.test(x.hit)));assert.ok(d.snippets.length<=SNIPPETS);
 assert.equal(r.documents.find(x=>x.topicId==='t3').snippets[0].hit,'Waermeplanung');
 assert.deepEqual(Object.keys(d).sort(),['ags','art','date','docIndex','gemeinde','gremium','hits','id','pages','regionId','sha256','snippets','title','topicId','topicTitle','url'].sort());
 reader.close();store.close();
});

test('phrase, prefix, or and minus narrow or widen as expected',async()=>{
 const {store,db,reader}=await fixture();
 const total=async q=>(await searchDocuments(db,reader,CATALOG,P({q}))).total;
 assert.equal(await total('"kommunale wärmeplanung"'),1);
 assert.equal(await total('kommunale wärmeplanung'),1);
 assert.equal(await total('wärmeplanung -kommunale'),1,'Ausschluss für das ganze Dokument, nicht je Seite');
 assert.equal(await total('wärmeplanung -altbestand -kommunale'),0);
 assert.equal(await total('kita oder wärmeplanung'),3);
 assert.equal(await total('gebüh*'),1);
 assert.equal(await total('förderung NAHE land'),1);
 assert.equal(await total('förderung NAHE gemeinde'),0,'NAHE: zu weit auseinander bzw. andere Seite');
 assert.equal(await total('radweg'),0);
 reader.close();store.close();
});

test('filters by place, period and document type',async()=>{
 const {store,db,reader}=await fixture();
 const ids=async o=>(await searchDocuments(db,reader,CATALOG,P(o))).documents.map(d=>d.topicId).sort();
 assert.deepEqual(await ids({q:'wärmeplanung oder kita',area:'05315000',scope:'only'}),['t2']);
 assert.deepEqual(await ids({q:'wärmeplanung oder kita',area:'05515',scope:'with'}),['t1','t3'],'Kreis mit Gemeinden');
 assert.deepEqual(await ids({q:'wärmeplanung oder kita',from:'2026-08-15'}),['t1','t2']);
 assert.deepEqual(await ids({q:'wärmeplanung oder kita',to:'2026-08-31'}),['t3']);
 assert.deepEqual(await ids({q:'wärmeplanung oder kita',art:'niederschrift'}),['t2']);
 assert.deepEqual((await searchDocuments(db,reader,CATALOG,P({q:'wärmeplanung oder kita',sort:'desc'}))).documents.map(d=>d.date),['2026-10-01','2026-09-01','2026-08-01'],'nach Datum');
 reader.close();store.close();
});

test('filters apply before the cap: a frequent word still finds a small place',async()=>{
 const {store,db,reader,add}=await fixture();
 /* Ein großes Dokument mit mehr Seiten als CAND_MAX, alle mit „Antrag“ (Köln), dazu eines in Billerbeck */
 add('https://a.example/big.pdf',Array.from({length:CAND_MAX+50},(_,i)=>`Antrag Antrag Antrag Nummer ${i} der Fraktion`),{topic:'big',region:'r2'});
 add('https://a.example/small.pdf',['Ein einzelner Antrag in einem langen Text über viele andere Dinge der Gemeinde Billerbeck und mehr.'],{topic:'small',region:'r1'});
 await indexDocuments({dir:store.dir});
 const all=await searchDocuments(db,reader,CATALOG,P({q:'antrag'}));
 assert.equal(all.capped,true);assert.equal(all.pagesFound,CAND_MAX);
 const here=await searchDocuments(db,reader,CATALOG,P({q:'antrag',area:'05515008',scope:'only'}));
 assert.deepEqual(here.documents.map(d=>d.topicId),['small']);assert.equal(here.capped,false);
 reader.close();store.close();
});

test('pages, revision and errors',async()=>{
 const {store,db,reader,add}=await fixture();
 const p1=await searchDocuments(db,reader,CATALOG,P({q:'wärmeplanung oder kita',size:'10'}));
 assert.equal(p1.documents.length,3);
 assert.deepEqual((await searchDocuments(db,reader,CATALOG,P({q:'wärmeplanung oder kita',page:'2',revision:p1.revision}))).documents,[]);
 add('https://a.example/4.pdf',['Noch eine Seite zur Kita in einer anderen Gemeinde.'],{topic:'t4',region:'r2'});
 await new Promise(r=>setTimeout(r,5));
 await indexDocuments({dir:store.dir});
 await assert.rejects(searchDocuments(db,reader,CATALOG,P({q:'kita',revision:p1.revision})),{status:409});
 assert.equal((await searchDocuments(db,reader,CATALOG,P({q:'kita'}))).total,2,'neuer Stand, neue Kandidaten');
 await assert.rejects(searchDocuments(db,openDocReader(fs.mkdtempSync(path.join(os.tmpdir(),'no-index-'))),CATALOG,P({q:'kita'})),{status:503});
 await assert.rejects(searchDocuments(db,undefined,CATALOG,P({q:'kita'})),{status:503},'ohne Index (Cloudflare, Dev-Server)');
 reader.close();store.close();
});

test('only Pro and Enterprise have the document search; the route is gated on it',()=>{
 assert.deepEqual(TIERS.filter(t=>FEATURES[t].fulltext),['pro','enterprise']);
 const route=fs.readFileSync(new URL('../app/api/dokumente/route.ts',import.meta.url),'utf8');
 assert.match(route,/export const GET=gated\(\w+,\{feature:'fulltext'\}\)/);
});
