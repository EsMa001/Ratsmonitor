import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {refreshSearchWords,precomputedTotal,precomputedFacets,candidateCards,knownWords,GONE_MAX,TOO_COMMON} from '../server/integrations/search-words.mjs';
/* The real schema with its triggers (drizzle/0006 … 0015): search_cards is written from topics, replaced or deleted cards
   are logged in search_cards_gone. */
function fixture(){
 const raw=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())raw.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const put=raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 const add=(id,title,region='r1',status='consulting')=>put.run(id,region,'city','2026-09-17','2026-10-01T00:00:00Z',status,JSON.stringify({id,regionId:region,title,shortSummary:'',committee:'Rat',events:[{date:'2026-09-17'}]}));
 const retitle=(id,title)=>raw.prepare("UPDATE topics SET payload=json_set(payload,'$.title',?) WHERE id=?").run(title,id);
 const remove=id=>raw.prepare('DELETE FROM topics WHERE id=?').run(id);
 return {raw,db:sqliteAdapter(raw),add,retitle,remove};
}
const KINDS=new Map([['r1','city'],['r2','city'],['k1','district']]);
const OPTIONS={kinds:KINDS,postingMax:2};
const rows=list=>list.map(r=>({...r}));                                                       // node:sqlite rows have no prototype
const snap=raw=>({
 words:rows(raw.prepare('SELECT word,cards,hits_city,hits_district FROM search_words ORDER BY word').all()),
 postings:rows(raw.prepare('SELECT word,card_id FROM search_postings ORDER BY word,card_id').all()),
 areas:rows(raw.prepare('SELECT word,region_id,n FROM search_word_areas ORDER BY word,region_id').all()),
 facets:rows(raw.prepare('SELECT word,kind,label,status,n FROM search_word_facets ORDER BY word,kind,label,status').all()),
});
const state=raw=>JSON.parse(raw.prepare("SELECT value FROM system_state WHERE key='search-words'").get().value);
const gone=raw=>rows(raw.prepare('SELECT card_rowid,id,search FROM search_cards_gone ORDER BY rowid').all());
const cards=raw=>raw.prepare('SELECT count(*) n FROM search_cards').get().n;
/* The incremental run must leave exactly what a full rebuild of the same cards produces. */
async function sameAsFull(t,{raw,db}){
 const r=await refreshSearchWords(db,OPTIONS);assert.equal(r.reachedEnd,true,t);
 const after=snap(raw),s=state(raw);
 assert.equal(s.hasHits,true,t+': precomputed numbers kept');assert.equal(s.counted,cards(raw),t+': counted');assert.deepEqual(gone(raw),[],t+': log emptied');
 await refreshSearchWords(db,{...OPTIONS,full:true});
 assert.deepEqual(after,snap(raw),t);
 return after;
}
test('the triggers log the old search text of a replaced or deleted card with the rowid it had',()=>{
 const {raw,add,retitle,remove}=fixture();
 add('a','Haushalt Plan Kormoran');assert.deepEqual(gone(raw),[]);
 const rowid=raw.prepare("SELECT rowid FROM search_cards WHERE id='a'").get().rowid;
 retitle('a','Nur noch Plan');
 assert.deepEqual(gone(raw),[{card_rowid:rowid,id:'a',search:'haushalt plan kormoran  rat  '}]);
 assert.equal(raw.prepare("SELECT search FROM search_cards WHERE id='a'").get().search,'nur noch plan  rat  ');
 remove('a');assert.equal(gone(raw).length,2);assert.equal(gone(raw)[1].search,'nur noch plan  rat  ');assert.equal(cards(raw),0);
 /* an update that does not touch the search text (updated_at only) logs nothing */
 add('b','Biber am Damm');raw.prepare("UPDATE topics SET updated_at='2026-10-02T00:00:00Z' WHERE id='b'").run();assert.equal(gone(raw).length,2);
});
test('replaced, deleted and new cards keep the precomputed numbers of the frequent words exact',async()=>{
 const f=fixture(),{raw,db,add,retitle,remove}=f;
 add('a','Haushalt Plan Kormoran');add('b','Haushalt Beratung Biber');add('c','Haushaltsplan Kita');add('d','Haushalt Kreisel','r2');add('e','Haushalt Kreis','k1');
 await refreshSearchWords(db,{...OPTIONS,full:true});
 const total=(term,level='city')=>precomputedTotal(db,term,{level,levelIds:level==='city'?['r1','r2']:['k1']});
 assert.equal(raw.prepare("SELECT cards FROM search_words WHERE word='haushalt'").get().cards,TOO_COMMON);
 assert.equal(await total('haushalt'),4);assert.equal(await total('haushalt','district'),1);
 /* a drops the frequent word, c keeps it, b vanishes, f and g are new (no rare word crosses the threshold) */
 retitle('a','Nur noch Plan Kormoran');retitle('c','Haushaltsplan Kita Neubau');remove('b');add('f','Haushalt Schule','r2');add('g','Kita Neubau Turnhalle');
 assert.equal(gone(raw).length,3);
 const after=await sameAsFull('replace, delete, add',f);
 assert.equal(after.words.find(w=>w.word==='haushalt').hits_city,3);                       // c, d, f
 assert.equal((await total('haushalt')),3);assert.equal(await total('haushalt','district'),1);
 const facets=await precomputedFacets(db,'haushalt',{level:'city',levelIds:['r1','r2']});
 assert.deepEqual([...facets.regions].sort(),[['r1',1],['r2',2]]);assert.deepEqual(facets.facets,[{label:'unklar',status:'consulting',n:3}]);
 /* the old card's ids are gone from the rare words, the new ones there; a word without cards left the list */
 assert.deepEqual(after.postings.filter(p=>p.word==='kormoran'),[{word:'kormoran',card_id:'a'}]);
 assert.deepEqual(after.postings.filter(p=>p.word==='kita').map(p=>p.card_id),['c','g']);
 assert.equal(after.words.some(w=>w.word==='biber'),false);assert.equal(after.words.some(w=>w.word==='beratung'),false);
 assert.equal(await knownWords(db,[['biber']],{plain:true}),'no');assert.deepEqual((await candidateCards(db,[['turnhalle']])).sort(),['g']);
});
test('a replaced top card keeps its rowid, freed rowids are handed out again: both are read anew',async()=>{
 const f=fixture(),{raw,db,add,retitle,remove}=f;
 for(const [id,title,region] of [['a','Haushalt Plan','r1'],['b','Haushalt Beratung','r1'],['c','Haushalt Kita','r2'],['d','Haushalt Kreis','k1']])add(id,title,region);
 await refreshSearchWords(db,{...OPTIONS,full:true});
 const top=()=>raw.prepare('SELECT rowid,id FROM search_cards ORDER BY rowid DESC LIMIT 1').get();
 /* the top card is replaced: SQLite gives the new row the freed top rowid again */
 const before=top();retitle('d','Haushalt Kreis Neu');assert.deepEqual(top(),before);
 await sameAsFull('top card replaced in place',f);
 assert.deepEqual(state(raw).topId,'d');
 /* the two top cards are deleted and two new ones take their rowids */
 remove('d');remove('c');add('x','Haushalt Xanten','r2');add('y','Haushalt Yacht','k1');
 assert.equal(top().id,'y');
 await sameAsFull('freed rowids reused',f);
 assert.deepEqual((await candidateCards(db,[['xanten']])),['x']);assert.equal(await precomputedTotal(db,'haushalt',{level:'district',levelIds:['k1']}),1);
 assert.deepEqual(state(raw).topId,'y');
});
test('a gap without a log entry or too many entries drop the precomputed numbers, as before',async()=>{
 const f=fixture(),{raw,db,add}=f;
 for(const id of ['a','b','c'])add(id,'Haushalt Plan '+id);
 await refreshSearchWords(db,{...OPTIONS,full:true});assert.equal(state(raw).hasHits,true);
 raw.prepare("DELETE FROM search_cards WHERE id='b'").run();                                 // past the triggers: no entry
 await refreshSearchWords(db,OPTIONS);
 assert.equal(state(raw).hasHits,false);assert.equal(raw.prepare('SELECT count(*) n FROM search_word_areas').get().n,0);
 assert.equal(raw.prepare("SELECT hits_city FROM search_words WHERE word='haushalt'").get().hits_city,null);
 await refreshSearchWords(db,{...OPTIONS,full:true});assert.equal(state(raw).hasHits,true);
 const many=raw.prepare("INSERT INTO search_cards_gone(card_rowid,id,region_id,label,status,search) VALUES(1,'a','r1','unklar','consulting','haushalt plan a')");
 for(let i=0;i<=GONE_MAX;i++)many.run();
 await refreshSearchWords(db,OPTIONS);
 assert.equal(state(raw).hasHits,false);assert.deepEqual(gone(raw),[]);
});
