import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {refreshSearchWords} from '../server/integrations/search-words.mjs';
import {syncSuggestIndex,suggestWord,suggestQuery,editDistance,trigrams,displayForm,MIN_CARDS} from '../server/integrations/search-suggest.mjs';

/* Kleine D1-Hülle um node:sqlite wie in search-words.test.mjs; search_cards mit den Spalten, aus denen die Schreibweise kommt */
function d1(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE search_cards(id TEXT PRIMARY KEY NOT NULL,region_id TEXT NOT NULL DEFAULT 'r1',date TEXT NOT NULL DEFAULT '2026-09-01',label TEXT NOT NULL DEFAULT 'bildung',status TEXT NOT NULL DEFAULT 'consulting',title TEXT NOT NULL DEFAULT '',teaser TEXT NOT NULL DEFAULT '',gremium TEXT NOT NULL DEFAULT '',search TEXT NOT NULL);CREATE INDEX idx_search_cards_date ON search_cards(date);CREATE TABLE data_revisions(id TEXT PRIMARY KEY,revision INTEGER);INSERT INTO data_revisions VALUES('content',1);CREATE TABLE system_state(key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL)");
 return {raw:db,
  prepare(sql){const st=db.prepare(sql);let args=[];const o={bind(...a){args=a;return o;},async first(){return st.get(...args)??null;},async all(){return {results:st.all(...args)};},async run(){st.run(...args);return {};}};return o;},
  async batch(list){for(const s of list)await s.run();return list.map(()=>({}));}};
}
const fold=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replaceAll('ß','ss');
let n=0;
const add=(db,title,times=1)=>{for(let i=0;i<times;i++)db.raw.prepare('INSERT INTO search_cards(id,title,search) VALUES(?,?,?)').run('c'+(++n),title,fold(title));};
const bump=db=>db.raw.exec("UPDATE data_revisions SET revision=revision+1 WHERE id='content'");

async function filled(){
 const db=d1();
 add(db,'Kommunale Wärmeplanung: Sachstand',5);add(db,'Bebauungsplan Nr. 12 „Am Hang“',4);add(db,'Spielplatz Lindenstraße',3);
 add(db,'Grundsteuer B: Hebesatz 2027',3);add(db,'Grundstück An der Schule',6);add(db,'Wärmepumpe im Rathaus',2);
 add(db,'Radweg nach Borken',3);add(db,'Einzelfall Tippfehlr',1);
 await refreshSearchWords(db);
 const r=await syncSuggestIndex(db);
 return {db,r};
}

test('trigrams and edit distance',()=>{
 assert.deepEqual(trigrams('abcd'),['abc','bcd']);
 assert.equal(editDistance('wrmeplsnung','warmeplanung',3),2,'a eingefügt, s durch a ersetzt');
 assert.equal(editDistance('radwge','radweg',2),1);
 assert.equal(editDistance('abc','xyz',1),2,'bricht über der Grenze ab');
});

test('the register is built from the word list and skips words with fewer than MIN_CARDS cards',async()=>{
 const {db,r}=await filled();
 assert.equal(r.done,true);assert.ok(r.added>0);
 const words=db.raw.prepare('SELECT word FROM search_suggest_words ORDER BY word').all().map(x=>x.word);
 assert.ok(words.includes('warmeplanung'));
 assert.ok(!words.includes('tippfehlr'),'Einzelfall nicht im Register');
 assert.ok(MIN_CARDS>1);
 /* zweiter Lauf: nichts Neues, kein Doppel im Index */
 const again=await syncSuggestIndex(db);
 assert.equal(again.added,0);
 assert.equal(db.raw.prepare('SELECT count(*) n FROM search_suggest_trg').get().n,words.length);
});

test('the register grows with the word list, in chunks and across calls',async()=>{
 const {db}=await filled();
 add(db,'Friedhofssatzung Änderung',2);bump(db);await refreshSearchWords(db);
 let r=await syncSuggestIndex(db,{chunk:3,deadline:0});
 assert.equal(r.done,false,'hört nach dem ersten Stück auf');
 while(!r.done)r=await syncSuggestIndex(db,{chunk:3});
 assert.ok(db.raw.prepare('SELECT word FROM search_suggest_words WHERE word=?').get('friedhofssatzung'));
});

test('suggestWord finds the closest word, preferring frequent ones at equal distance',async()=>{
 const {db}=await filled();
 assert.equal((await suggestWord(db,'wrmeplsnung'))?.word,'warmeplanung');
 assert.equal((await suggestWord(db,'grundsteur'))?.word,'grundsteuer');
 assert.equal((await suggestWord(db,'radwge'))?.word,'radweg');
 assert.equal(await suggestWord(db,'warmeplanung'),null,'vorhandenes Wort: kein Vorschlag');
 assert.equal(await suggestWord(db,'xqzvjk'),null,'nichts in der Nähe');
 assert.equal(await suggestWord(db,'abc'),null,'zu kurz');
 assert.equal(await suggestWord(db,'tippfehlr'),null,'Einzelfall nicht im Register');
});

test('displayForm restores umlauts and capitals from a card',async()=>{
 const {db}=await filled();
 assert.equal(await displayForm(db,'warmeplanung'),'Wärmeplanung');
 assert.equal(await displayForm(db,'bebauungsplan'),'Bebauungsplan');
 assert.equal(await displayForm(db,'unbekannt'),'Unbekannt');
});

test('suggestQuery replaces only unknown words and keeps what the user typed as from',async()=>{
 const {db}=await filled();
 assert.deepEqual((await suggestQuery(db,'Wrmeplsnung Borken')).map(s=>[s.from,s.to]),[['Wrmeplsnung','Wärmeplanung']]);
 assert.deepEqual((await suggestQuery(db,'spielplaz, grundsteur')).map(s=>[s.from,s.to]),[['spielplaz','Spielplatz'],['grundsteur','Grundsteuer']]);
 assert.deepEqual(await suggestQuery(db,'Wärmeplanung'),[]);
 assert.deepEqual(await suggestQuery(db,'und oder'),[]);
});

test('without the word list or the register there are no suggestions and no errors',async()=>{
 const db=d1();
 assert.deepEqual(await syncSuggestIndex(db),{skipped:true,reason:'keine Wortliste'});
 assert.deepEqual(await suggestQuery(db,'wrmeplsnung'),[]);
 add(db,'Wärmeplanung',3);await refreshSearchWords(db);
 assert.deepEqual(await suggestQuery(db,'wrmeplsnung'),[],'Wortliste ohne Register');
});
