import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/sqlite-adapter.mjs';
import {searchMonitor} from '../server/integrations/monitor-search.mjs';
/* drizzle/0023: the full text index follows the cards through every write, and the search gives the same result with
   and without it (the index only narrows, instr still checks). */
const catalog=[{id:'billerbeck',kind:'city',name:'Billerbeck',ags:'05558008'},{id:'nottuln',kind:'city',name:'Nottuln',ags:'05558036'},{id:'coesfeld',kind:'district',name:'Kreis Coesfeld',ags:'05558'}];
function fixture(){
 const raw=new DatabaseSync(':memory:');
 for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())raw.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const put=raw.prepare('INSERT OR REPLACE INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 const add=(id,title,{region='billerbeck',status='approved',date='2026-09-17',short=''}={})=>put.run(id,region,'city',date,'2026-10-01T00:00:00Z',status,JSON.stringify({id,title,shortSummary:short,committee:'Rat',events:[{date}]}));
 return {raw,db:sqliteAdapter(raw),add};
}
/* integrity-check with rank 1 compares the index with the content table */
const intact=raw=>{raw.prepare("INSERT INTO search_fts(search_fts,rank) VALUES('integrity-check',1)").run();return true;};
test('the index follows insert, replace, change and delete of a card',()=>{
 const {raw,add}=fixture();
 add('a','Neubau Turnhalle');add('b','Sanierung Schwimmbad');
 const hits=q=>raw.prepare('SELECT count(*) n FROM search_fts WHERE search LIKE ?').get('%'+q+'%').n;
 assert.equal(hits('turnhalle'),1);assert.ok(intact(raw));
 raw.prepare("UPDATE topics SET payload=json_set(payload,'$.title','Neubau Sporthalle') WHERE id='a'").run();
 assert.equal(hits('turnhalle'),0);assert.equal(hits('sporthalle'),1);assert.ok(intact(raw));
 add('b','Sanierung Hallenbad');                                                // INSERT OR REPLACE on topics: the card is replaced
 assert.equal(hits('schwimmbad'),0);assert.equal(hits('hallenbad'),1);assert.ok(intact(raw));
 raw.prepare("UPDATE topics SET payload=json_set(payload,'$.identity.mergedInto','a') WHERE id='b'").run();   // merged: card goes
 assert.equal(hits('hallenbad'),0);assert.ok(intact(raw));
 raw.prepare("DELETE FROM topics WHERE id='a'").run();
 assert.equal(raw.prepare('SELECT count(*) n FROM search_fts').get().n,0);assert.ok(intact(raw));
 raw.close();
});
test('search results are the same with and without the index',async()=>{
 const {raw,db,add}=fixture();
 const words=['turnhalle','schwimmbad','haushalt','radweg','kita','feuerwehr','spielplatz','nottuln','billerbeck'];
 let n=0;
 for(const a of words)for(const b of words){n++;add('t'+n,`${a[0].toUpperCase()+a.slice(1)} und ${b}`,{region:n%3?'billerbeck':'nottuln',status:n%2?'approved':'consulting',date:`2026-0${1+n%9}-1${n%9}`,short:n%4?'Kurztext '+b:''});}
 const queries=['q=turnhalle','q=halle','q=bad','q=kita','q=haushalt%20radweg','q=turnhalle,schwimmbad','q=nottuln','q=billerbeck','q=feuer&status=approved','q=spiel&exact=1','q=kita&noformal=1','q=ka'];
 const run=async(d,q)=>JSON.parse(JSON.stringify(await searchMonitor(d,catalog,new URLSearchParams(q+'&level=city'))));
 const seen=[],spy=Object.create(db);spy.prepare=q=>{seen.push(q);return db.prepare(q);};
 const withIndex=[];for(const q of queries)withIndex.push(await run(spy,q));
 assert.ok(seen.some(q=>q.includes('search_fts')),'the first run used the index');
 raw.exec('DROP TABLE search_fts');
 const plain=sqliteAdapter(raw);                                                  // new connection: no remembered index
 for(const [i,q] of queries.entries())assert.deepEqual(await run(plain,q),withIndex[i],q);
 assert.ok(withIndex.filter(r=>JSON.stringify(r).includes('"id":"t')).length>=8,'most queries find reports');
 raw.close();
});
