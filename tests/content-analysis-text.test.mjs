import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
/* drizzle/0021: the KI summary text leaves contentAnalysis (it stays in shortSummary/longSummary and in article_analyses);
   everything else about the analysis stays, and the search card is not rewritten. */
const dir=new URL('../drizzle/',import.meta.url);
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
const migrate=(raw,keep)=>{for(const f of files.filter(keep))raw.exec(fs.readFileSync(new URL(f,dir),'utf8'));};
test('0021 removes the duplicate summary text from contentAnalysis and keeps the rest',()=>{
 const raw=new DatabaseSync(':memory:');migrate(raw,f=>f<'0021');
 const put=raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 const analysis={status:'completed',method:'ai-agent-content-v1',model:'m',evidence:[{url:'u',quote:'q'}]};
 put.run('a','r1','city','2026-09-17','2026-10-01T00:00:00Z','approved',JSON.stringify({id:'a',title:'Schulhof',generatedBy:'KI-Zusammenfassung',shortSummary:'Kurz.',longSummary:['Lang.'],committee:'Rat',contentAnalysis:{...analysis,shortSummary:'Kurz.',longSummary:['Lang.']}}));
 put.run('b','r1','city','2026-09-17','2026-10-01T00:00:00Z','approved',JSON.stringify({id:'b',title:'Spielplatz',shortSummary:'Ohne Analyse.',committee:'Rat'}));
 const card=id=>({...raw.prepare('SELECT rowid,teaser,search FROM search_cards WHERE id=?').get(id)});
 const before={a:card('a'),b:card('b')},payloadB=raw.prepare("SELECT payload FROM topics WHERE id='b'").get().payload;
 migrate(raw,f=>f>='0021');
 const a=JSON.parse(raw.prepare("SELECT payload FROM topics WHERE id='a'").get().payload);
 assert.deepEqual(a.contentAnalysis,analysis);assert.equal(a.shortSummary,'Kurz.');assert.deepEqual(a.longSummary,['Lang.']);
 assert.equal(raw.prepare("SELECT payload FROM topics WHERE id='b'").get().payload,payloadB,'reports without the duplicate stay untouched');
 assert.deepEqual({a:card('a'),b:card('b')},before,'search cards are not rewritten');
 assert.equal(raw.prepare('SELECT count(*) n FROM search_cards_gone').get().n,0);
 raw.close();
});
