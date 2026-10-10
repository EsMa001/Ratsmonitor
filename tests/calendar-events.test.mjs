// E3 and E7 of the code analysis: the calendar checks its period, narrows its scan, and escapes iCalendar text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {validDay,validSpan,parseAgs,eventsSql,icsEscape,MAX_AREAS} from '../server/integrations/calendar-events.mjs';

test('only real days in order and within the span pass',()=>{
 for(const day of ['2026-10-10','2024-02-29'])assert.equal(validDay(day),true,day);
 for(const day of ['0000-00-00','9999-99-99','2026-02-30','2026-13-01','2026-1-1','2026-10-10T00:00','',null])assert.equal(validDay(day),false,String(day));
 assert.equal(validSpan('2026-10-01','2026-10-31'),true);assert.equal(validSpan('2026-10-01','2026-10-01'),true);
 assert.equal(validSpan('0000-00-00','9999-99-99'),false,'the former check let this through');
 assert.equal(validSpan('2026-10-31','2026-10-01'),false);assert.equal(validSpan('2026-01-01','2026-06-01'),false,'more than 100 days');
 assert.equal(validSpan('2026-01-01','2026-04-11'),true);assert.equal(validSpan('2026-01-01','2026-04-12'),false);
});

test('areas are read without repeats and at most MAX_AREAS of them',()=>{
 assert.deepEqual(parseAgs('05558012,05558,x,05558012,1'),['05558012','05558']);
 assert.equal(parseAgs(Array.from({length:600},(_,i)=>String(100000+i)).join(',')).length,MAX_AREAS);assert.deepEqual(parseAgs(null),[]);
});

test('iCalendar text escapes backslash, semicolon, comma and line breaks',()=>{
 assert.equal(icsEscape('Ausschuss; Bau, Planung\\Umwelt\nZeile'),'Ausschuss\\; Bau\\, Planung\\\\Umwelt\\nZeile');
});

test('the query finds the meetings between two days and skips reports whose meetings all lie before',()=>{
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const put=(id,region,events,extra={})=>sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,region,'municipal',events.at(-1).date,'2026-10-01T00:00:00Z','open',JSON.stringify({id,title:'Vorgang '+id,events,...extra}));
 put('a','billerbeck',[{date:'2026-09-01',committee:'Rat'},{date:'2026-10-05',committee:'Rat'}]);
 put('b','billerbeck',[{date:'2026-10-05',committee:'Rat'},{date:'2026-10-20',committee:'Bauausschuss'}]);
 put('c','billerbeck',[{date:'2026-08-01',committee:'Rat'}]);
 put('d','coesfeld',[{date:'2026-10-05',committee:'Rat'}]);
 put('e','billerbeck',[{date:'2026-10-06',committee:'Rat'}],{identity:{mergedInto:'b'}});
 const rows=sql.prepare(eventsSql(100)).all(JSON.stringify(['billerbeck']),'2026-10-01','2026-10-01','2026-10-31');
 assert.deepEqual(rows.map(r=>[r.d,r.c,r.n,JSON.parse(r.items).map(i=>i.id).sort()]),[['2026-10-05','Rat',2,['a','b']],['2026-10-20','Bauausschuss',1,['b']]]);
 // The reports are found over an index (of the area or of event_date), never by reading the whole table.
 const plan=sql.prepare('EXPLAIN QUERY PLAN '+eventsSql(100)).all(JSON.stringify(['billerbeck']),'2026-10-01','2026-10-01','2026-10-31').map(r=>r.detail).join(' | ');
 assert.match(plan,/SEARCH t USING (?:COVERING )?INDEX/);assert.doesNotMatch(plan,/SCAN t\b/);
 // Münster's reader keeps the last decided meeting as event_date: its later meetings are still found.
 put('m','muenster',[{date:'2026-10-25',committee:'Rat'},{date:'2026-09-17',committee:'Rat',status:'approved'}]);
 sql.prepare("UPDATE topics SET event_date='2026-09-17' WHERE id='m'").run();
 assert.deepEqual(sql.prepare(eventsSql(100)).all(JSON.stringify(['muenster']),'2026-10-20','2026-10-20','2026-10-31').map(r=>r.d),['2026-10-25']);
 sql.close();
});
