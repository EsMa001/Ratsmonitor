import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {wordsOf,refreshSearchWords,knownWords} from '../server/integrations/search-words.mjs';

/* Kleine D1-Hülle um node:sqlite: genug für prepare/bind/first/all/run und batch */
function d1(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE search_cards(id TEXT PRIMARY KEY NOT NULL,search TEXT NOT NULL);CREATE TABLE data_revisions(id TEXT PRIMARY KEY,revision INTEGER);INSERT INTO data_revisions VALUES('content',1);CREATE TABLE system_state(key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL)");
 return {raw:db,
  prepare(sql){const st=db.prepare(sql);let args=[];const o={bind(...a){args=a;return o;},async first(){return st.get(...args)??null;},async all(){return {results:st.all(...args)};},async run(){st.run(...args);return {};}};return o;},
  async batch(list){for(const s of list)await s.run();return list.map(()=>({}));}};
}
const add=(db,id,text)=>db.raw.prepare('INSERT OR REPLACE INTO search_cards(id,search) VALUES(?,?)').run(id,text);
const bump=db=>db.raw.exec("UPDATE data_revisions SET revision=revision+1 WHERE id='content'");
const words=db=>db.raw.prepare('SELECT word FROM search_words ORDER BY word').all().map(r=>r.word);

test('wordsOf keeps words of three letters and more, once per card, without pure numbers',()=>{
 assert.deepEqual([...wordsOf('haushalt 2027 - budgets des haushalts, haushalt s-bahn a1 bau abc12')].sort(),['abc12','bahn','bau','budgets','des','haushalt','haushalts']);
});

test('refresh builds the list, later runs add only what is new or changed',async()=>{
 const db=d1();add(db,'a','kormoran am see');add(db,'b','biberdamm und kormoran');
 let r=await refreshSearchWords(db);
 assert.deepEqual(words(db),['biberdamm','kormoran','see','und']);
 assert.equal(r.cards,2);
 add(db,'c','bienenhotel am marktplatz');bump(db);
 r=await refreshSearchWords(db);
 assert.equal(r.cards,1);assert.ok(words(db).includes('bienenhotel')&&words(db).includes('marktplatz'));
 /* eine geänderte Karte bekommt eine neue rowid und wird erneut gelesen */
 add(db,'a','kormoran im schilf');bump(db);
 r=await refreshSearchWords(db);assert.equal(r.cards,1);assert.ok(words(db).includes('schilf'));
});

test('refresh starts over when the top rowids were freed and handed out again',async()=>{
 const db=d1();add(db,'a','erstes');add(db,'b','zweites');await refreshSearchWords(db);
 db.raw.exec("DELETE FROM search_cards WHERE id='b'");add(db,'c','drittes');bump(db);
 await refreshSearchWords(db);
 assert.ok(words(db).includes('drittes'));
});

test('knownWords says yes only for a plain single term that is in the list',async()=>{
 const db=d1();add(db,'a','windparkplanung am stadtrand');await refreshSearchWords(db);
 assert.equal(await knownWords(db,[['windpark']],{plain:true}),'yes');        // Wortanfang
 assert.equal(await knownWords(db,[['parkplanung']],{plain:true}),'yes');     // Teilwort
 assert.equal(await knownWords(db,[['windpark']],{plain:false}),'unknown');   // mit Filter nicht sicher
 assert.equal(await knownWords(db,[['windpark','stadtrand']],{plain:true}),'unknown'); // zwei Wörter: nicht gesichert zusammen
});

test('knownWords says no when no word contains the term, but only while the list is current',async()=>{
 const db=d1();add(db,'a','windpark am stadtrand');await refreshSearchWords(db);
 assert.equal(await knownWords(db,[['kalorien']],{plain:false}),'no');
 assert.equal(await knownWords(db,[['kalorien'],['windpark']],{}),'unknown');  // eine Alternative kann Treffer haben
 assert.equal(await knownWords(db,[['windpark','kalorien']],{}),'no');         // alle Wörter einer Gruppe müssen vorkommen
 assert.equal(await knownWords(db,[['kalorien']],{nameHit:t=>t==='kalorien'}),'unknown'); // Gemeindename zählt als Treffer
 bump(db);                                                                    // neue Daten, Liste noch nicht nachgeführt
 assert.equal(await knownWords(db,[['kalorien']],{}),'unknown');
 await refreshSearchWords(db);
 assert.equal(await knownWords(db,[['kalorien']],{}),'no');
});

test('knownWords stays unknown for terms the list could not contain',async()=>{
 const db=d1();add(db,'a','s-bahn haltestelle');await refreshSearchWords(db);
 for(const t of ['s-bahn','ab','1234','søren','haupt.'])assert.equal(await knownWords(db,[[t]],{plain:true}),'unknown',t);
 assert.equal(await knownWords(db,[],{plain:true}),'unknown');
 const empty=d1();                                                            // Tabelle gibt es noch nicht
 assert.equal(await knownWords(empty,[['kalorien']],{}),'unknown');
});
