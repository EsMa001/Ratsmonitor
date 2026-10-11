// Datum der Suchkarte „Stand heute“ (drizzle/0024, server/integrations/search-card-dates.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {PAST_SQL,NEXT_SQL,rollCardDates} from '../server/integrations/search-card-dates.mjs';
import {sqliteAdapter} from '../scripts/ai-job.mjs';

const MIGRATION=fs.readFileSync(new URL('../drizzle/0024_search_cards_next_date.sql',import.meta.url),'utf8');
const day=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE topics(id TEXT PRIMARY KEY,event_date TEXT,payload TEXT);
  CREATE TABLE search_cards(id TEXT PRIMARY KEY,date TEXT);
  CREATE TABLE data_revisions(id TEXT PRIMARY KEY,revision INTEGER);INSERT INTO data_revisions VALUES('search',1),('content',1);
  CREATE TRIGGER cards AFTER INSERT ON topics BEGIN INSERT OR REPLACE INTO search_cards(id,date) VALUES(NEW.id,substr(NEW.event_date,1,10)); END;`);
 const topic=(id,dates)=>db.prepare('INSERT OR REPLACE INTO topics VALUES(?,?,?)').run(id,[...dates].sort().at(-1),JSON.stringify({events:dates.map(d=>({date:d+'T18:00:00'}))}));
 const card=id=>({...db.prepare('SELECT date,next_date FROM search_cards WHERE id=?').get(id)});
 return {db,topic,card};
}
const migrate=db=>{for(const s of MIGRATION.split('--> statement-breakpoint'))db.exec(s);};

test('the migration and the roll use the same date expressions',()=>{
 assert.ok(MIGRATION.includes(PAST_SQL)&&MIGRATION.includes(NEXT_SQL),'Nachfüllen wie PAST_SQL/NEXT_SQL');
 assert.ok(MIGRATION.includes(PAST_SQL.replace('search_cards.id','NEW.id').slice(1,-1))&&MIGRATION.includes(NEXT_SQL.replace('search_cards.id','NEW.id').slice(1,-1)),'Trigger wie PAST_SQL/NEXT_SQL');
});

test('a report discussed before and scheduled again carries its last session up to today',()=>{
 const {db,topic,card}=setup();
 topic('alt',[day(-40),day(9)]);topic('vorbei',[day(-40),day(-3)]);topic('kuenftig',[day(5),day(20)]);
 migrate(db);
 assert.deepEqual(card('alt'),{date:day(-40),next_date:day(9)});
 assert.deepEqual(card('vorbei'),{date:day(-3),next_date:null});
 assert.deepEqual(card('kuenftig'),{date:day(20),next_date:day(5)},'nur künftige Sitzungen: Datum bleibt');
 // Neue und geänderte Vorgänge nach der Migration über den Trigger
 topic('neu',[day(-2),day(12),day(30)]);topic('alt',[day(-40),day(-1),day(9)]);
 assert.deepEqual(card('neu'),{date:day(-2),next_date:day(12)});
 assert.deepEqual(card('alt'),{date:day(-1),next_date:day(9)});
 assert.equal(db.prepare("SELECT revision FROM data_revisions WHERE id='search'").get().revision,2);
});

test('rollCardDates moves a card to the session it reached and leaves the rest alone',async()=>{
 const {db,topic,card}=setup();
 migrate(db);
 topic('a',[day(-40),day(-1),day(10)]);topic('b',[day(-5),day(3)]);
 // Stand von gestern: die Sitzung von gestern lag da noch in der Zukunft
 db.prepare('UPDATE search_cards SET date=?,next_date=? WHERE id=?').run(day(-40),day(-1),'a');
 assert.equal(await rollCardDates(sqliteAdapter(db)),1);
 assert.deepEqual(card('a'),{date:day(-1),next_date:day(10)});
 assert.deepEqual(card('b'),{date:day(-5),next_date:day(3)});
 assert.equal(db.prepare("SELECT revision FROM data_revisions WHERE id='search'").get().revision,3);
 assert.equal(await rollCardDates(sqliteAdapter(db)),0);
});

test('without migration 0024 rollCardDates does nothing',async()=>{
 const {db}=setup();
 assert.equal(await rollCardDates(sqliteAdapter(db)),null);
});
