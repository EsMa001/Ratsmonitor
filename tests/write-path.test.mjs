import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {metadataChanged,stableJson} from '../shared/article-record.mjs';
import {batches} from '../server/integrations/batches.mjs';

test('a new fetch time alone is no reason to rewrite a stored topic',()=>{
 const prior={version:'article-record-v1',firstImportedAt:'2026-01-01',sourceModifiedAt:'2026-02-01',lastFetchedAt:'2026-09-01'};
 assert.equal(metadataChanged(prior,{...prior,lastFetchedAt:'2026-10-03'}),false);
 assert.equal(metadataChanged(prior,{...prior,sourceModifiedAt:'2026-03-01'}),true);
 assert.equal(metadataChanged(undefined,{lastFetchedAt:'2026-10-03'}),true);
});

test('fetch and check times inside events and records are no change of a topic (no new version)',()=>{
 const event=at=>({date:'2026-09-15',committee:'Stadtrat',status:'approved',result:'einstimmig',url:'https://ratsinfo.example/si0057?k=1',attendance:{status:'not_collected',sourceUrl:'https://ratsinfo.example/si0057?k=1',fetchedAt:at,people:[]}});
 const records=at=>({fetchedAt:at,records:[{kind:'agenda',url:'https://ratsinfo.example/to0040?k=1',fields:{number:'3',title:'Haushalt'}}]});
 assert.equal(stableJson([event('2026-10-01T10:00:00Z')]),stableJson([event('2026-10-05T12:00:00Z')]));
 assert.equal(stableJson(records('2026-10-01')),stableJson(records('2026-10-05')));
 assert.equal(stableJson({passed:true,checkedAt:'a'}),stableJson({passed:true,checkedAt:'b'}));
 // A real change still counts: result, date, people.
 assert.notEqual(stableJson([event('x')]),stableJson([{...event('x'),result:'abgelehnt'}]));
 assert.notEqual(stableJson([event('x')]),stableJson([{...event('x'),date:'2026-09-16'}]));
 assert.notEqual(stableJson([event('x')]),stableJson([{...event('x'),attendance:{...event('x').attendance,people:[{name:'A'}]}}]));
 // Both import paths compare with it.
 assert.match(fs.readFileSync(new URL('../server/services/sync.ts',import.meta.url),'utf8'),/stableJson\(p\.events\)===stableJson\(t\.events\)/);
 assert.match(fs.readFileSync(new URL('../server/integrations/apply-backfill.mjs',import.meta.url),'utf8'),/stableJson\(prior\[k\]\)===stableJson\(incoming\[k\]\)/);
});

test('statement groups are bundled into batches without splitting a group',()=>{
 const g=n=>Array.from({length:n},(_,i)=>i);
 const out=batches([g(30),g(30),g(30),[],g(5)],80);
 assert.deepEqual(out.map(b=>b.length),[60,35]);
 /* Eine Gruppe größer als das Limit bleibt trotzdem zusammen */
 assert.deepEqual(batches([g(100),g(1)],80).map(b=>b.length),[100,1]);
 assert.deepEqual(batches([]),[]);
});

test('search cards are rewritten only when searchable fields change',()=>{
 const sql=new DatabaseSync(':memory:');
 try{
  for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const t={title:'Schulbau',officialTitle:'Schulbau',shortSummary:'Kurz',committee:'Rat',metadata:{lastFetchedAt:'2026-09-01'}};
  sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run('a','city','2026-09-20','2026-09-20','consulting',JSON.stringify(t),'billerbeck');
  const rowid=()=>sql.prepare("SELECT rowid r,title FROM search_cards WHERE id='a'").get();
  const before=rowid();
  /* Reines Metadaten-Update: Karte bleibt unangetastet (gleiche rowid) */
  sql.prepare("UPDATE topics SET payload=json_set(payload,'$.metadata.lastFetchedAt','2026-10-03') WHERE id='a'").run();
  assert.equal(rowid().r,before.r);
  /* Titeländerung: Karte wird neu geschrieben und trägt den neuen Titel */
  sql.prepare("UPDATE topics SET payload=json_set(payload,'$.title','Neubau Grundschule') WHERE id='a'").run();
  assert.equal(rowid().title,'Neubau Grundschule');
  /* Zusammenführung entfernt die Karte */
  sql.prepare("UPDATE topics SET payload=json_set(payload,'$.identity',json('{\"mergedInto\":\"b\"}')) WHERE id='a'").run();
  assert.equal(rowid(),undefined);
 }finally{sql.close();}
});
