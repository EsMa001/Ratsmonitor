import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {wordsOf,refreshSearchWords,knownWords,candidateCards,POSTING_MAX,TOO_COMMON} from '../server/integrations/search-words.mjs';

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
const postings=(db,word)=>db.raw.prepare('SELECT card_id FROM search_postings WHERE word=? ORDER BY card_id').all(word).map(r=>r.card_id);
const cardsOf=(db,word)=>db.raw.prepare('SELECT cards FROM search_words WHERE word=?').get(word)?.cards;

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

test('rare words keep the ids of their cards, words above 200 cards only a count',async()=>{
 const db=d1();
 for(let i=0;i<=POSTING_MAX;i++)add(db,'h'+String(i).padStart(3,'0'),'haushalt plan');   // 201 Karten
 add(db,'h000','haushalt plan');add(db,'x','selten kormoran');add(db,'y','kormoran im haushalt');
 await refreshSearchWords(db,{full:true});
 assert.equal(cardsOf(db,'haushalt'),TOO_COMMON);assert.deepEqual(postings(db,'haushalt'),[]);
 assert.equal(cardsOf(db,'kormoran'),2);assert.deepEqual(postings(db,'kormoran'),['x','y']);
});

test('later runs add ids, a word that grows past 200 cards loses its ids',async()=>{
 const db=d1();
 for(let i=0;i<199;i++)add(db,'a'+String(i).padStart(3,'0'),'wort gemeinsam');
 await refreshSearchWords(db,{full:true});
 assert.equal(cardsOf(db,'gemeinsam'),199);
 add(db,'b1','gemeinsam neu');bump(db);await refreshSearchWords(db);
 assert.equal(cardsOf(db,'gemeinsam'),200);assert.equal(postings(db,'gemeinsam').length,200);assert.deepEqual(postings(db,'neu'),['b1']);
 add(db,'b2','gemeinsam');bump(db);await refreshSearchWords(db);
 assert.equal(cardsOf(db,'gemeinsam'),TOO_COMMON);assert.deepEqual(postings(db,'gemeinsam'),[]);
 /* eine geänderte Karte wird nicht doppelt gezählt */
 add(db,'b1','gemeinsam neu');bump(db);await refreshSearchWords(db);
 assert.equal(cardsOf(db,'neu'),1);
});

test('candidateCards: union over matching words, smallest term of an AND group, union over alternatives',async()=>{
 const db=d1();add(db,'a','windpark planung');add(db,'b','windparks bau');add(db,'c','bürgerwindpark');add(db,'d','planung stadt');
 for(let i=0;i<=POSTING_MAX;i++)add(db,'z'+i,'stadt rat');
 await refreshSearchWords(db,{full:true});
 assert.deepEqual((await candidateCards(db,[['windpark']])).sort(),['a','b','c']);               // alle Wörter mit windpark darin (auch Teil von Bürgerwindpark)
 assert.deepEqual((await candidateCards(db,[['park']])).sort(),['a','b','c']);                   // Teilwort
 assert.deepEqual((await candidateCards(db,[['windpark','planung']])).sort(),['a','d']);         // kleinste Menge genügt (Obermenge), die Suche prüft nach
 assert.deepEqual((await candidateCards(db,[['windpark'],['planung']])).sort(),['a','b','c','d']); // Alternativen
 assert.deepEqual(await candidateCards(db,[['kalorien']]),[]);                                   // kein Wort: keine Karten
 assert.equal(await candidateCards(db,[['stadt']]),null);                                        // zu häufig
 assert.deepEqual((await candidateCards(db,[['stadt','planung']])).sort(),['a','d']);            // seltener Begriff der Gruppe genügt
 assert.equal(await candidateCards(db,[['kalorien'],['stadt']]),null);                           // eine Alternative ohne Liste
 assert.equal(await candidateCards(db,[['windpark']],{nameHit:()=>true}),null);                  // Gebietsname: Karten unbekannt
 assert.equal(await candidateCards(db,[['s-bahn']]),null);
 bump(db);                                                                                       // Liste nicht mehr aktuell
 assert.equal(await candidateCards(db,[['windpark']]),null);
});
