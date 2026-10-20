import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/sqlite-adapter.mjs';
import {refreshRegionFacts} from '../server/integrations/region-facts.mjs';
import {loadAdminData,adminReview} from '../server/integrations/admin-data.mjs';
import {adminCoverage} from '../server/integrations/admin-coverage.mjs';
import {adminAtlas} from '../server/integrations/admin-atlas.mjs';
import {adminTimeline} from '../server/integrations/admin-timeline.mjs';
import {refreshStatus} from '../server/integrations/admin-refresh.mjs';
import {runQualityCheck} from '../server/integrations/quality-check.mjs';

// Wächter für die Spalte active (drizzle/0020): sie ist VIRTUAL, also json_extract über die ganze Nutzlast. Nimmt der Planer
// für eine Abfrage mit active=1 einen Index ohne diese Bedingung, liest er für jede Zeile das JSON (Server 12.10.2026: 70 bis
// 100 s, Webdienst blockiert). Der Test gibt der Datenbank die Planerstatistik des Servers (sqlite_stat1) und prüft für jede
// Abfrage der Adminseiten, der Vorberechnung und der Qualitätsprüfungen, dass sie auf topics nur einen Teilindex auf active,
// den Primärschlüssel oder (bei ausdrücklich gewollten Läufen über alles) die ganze Tabelle nimmt, nie einen anderen Index.
const root=path.resolve(import.meta.dirname,'..');
// Planerstatistik von topics auf dem Server (sqlite_stat1, 12.10.2026); bei neuen Indizes auf topics hier ergänzen
const SERVER_STATS=[
 ['idx_topics_canonical_region_updated','1324680 667 82'],
 ['idx_topics_canonical_updated','1508379 4'],
 ['idx_topics_canonical_region_status','1738503 667 130'],
 ['idx_topics_region_updated','1285200 667 82'],
 ['idx_topics_event_date','1586485 39'],
 ['sqlite_autoindex_topics_1','1585980 1'],
 ['idx_topics_inactive','15000 1'],
 // New partial indexes: canonical row count and existing date/region selectivity, until production ANALYZE supplies measured values.
 ['idx_topics_ai_local_date','1508379 39 1'],
 ['idx_topics_ai_local_region_date','1508379 667 39 1'],
];

/** Indizes auf topics ohne Teilbedingung auf active: mit active=1 in der Abfrage verboten */
function plainIndexes(sql){
 return sql.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='topics'").all()
  .filter(r=>!/WHERE\s+`?active`?\s*=/.test(r.sql||'')&&!r.name.startsWith('sqlite_autoindex')).map(r=>r.name);
}

test('Abfragen mit active=1 nehmen auf topics nie einen Index ohne active (Planerstatistik wie auf dem Server)',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
 const base=sqliteAdapter(sql),now=new Date('2026-10-08T12:00:00Z');
 for(let i=0;i<30;i++){const area=['billerbeck','muenster','de-02000000'][i%3];
  sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)')
   .run('t'+i,area,'city','2026-10-0'+(1+i%7),'2026-10-0'+(1+i%7)+'T10:00:00Z',i%2?'approved':'announced',JSON.stringify({id:'t'+i,title:'Vorgang '+i,regionId:area,documents:[]}));}
 sql.exec('ANALYZE');
 const known=new Set(sql.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='topics'").all().map(r=>r.name));
 const missing=[...known].filter(n=>!SERVER_STATS.some(([i])=>i===n));
 assert.deepEqual(missing,[],'neuer Index auf topics: Statistik in SERVER_STATS ergänzen');
 sql.exec("DELETE FROM sqlite_stat1 WHERE tbl='topics'");
 for(const [idx,stat] of SERVER_STATS)sql.prepare("INSERT INTO sqlite_stat1(tbl,idx,stat) VALUES('topics',?,?)").run(idx,stat);
 sql.exec('ANALYZE sqlite_schema');
 const asked=new Set();
 const spy={prepare(q){asked.add(q);return base.prepare(q);},batch:s=>base.batch(s)};
 await refreshRegionFacts(spy,{budgetMs:1e9,now});
 await loadAdminData(spy,{now});
 await adminCoverage(spy,{now});await adminAtlas(spy,{now});
 for(const basis of ['event','import'])await adminTimeline(spy,{basis,now});
 for(const issue of ['labels','status','identity','summaries'])await adminReview(spy,issue,'all');
 await adminReview(spy,'labels','billerbeck');
 await refreshStatus(spy,{now});
 for(const id of ['truncatedTitle','mergeTargetMissing','mergeChain','conflicts'])await runQualityCheck(spy,id).catch(()=>{});
 const plain=plainIndexes(sql),bad=[];
 let checked=0;
 for(const q of asked){
  if(!/\btopics\b/.test(q)||!/\bactive\s*=\s*1\b/.test(q))continue;
  let plan;try{plan=sql.prepare('EXPLAIN QUERY PLAN '+q).all().map(r=>r.detail);}catch{continue;}
  checked++;
  const wrong=plan.filter(d=>/\btopics\b/.test(d)&&plain.some(n=>d.includes(n)));
  if(wrong.length)bad.push(`${q.replace(/\s+/g,' ').slice(0,160)}\n   → ${wrong.join('; ')}`);
 }
 assert.ok(checked>5,`zu wenige Abfragen geprüft (${checked})`);
 assert.deepEqual(bad,[],'Abfragen mit active=1 über einen Index ohne active (liest das JSON jeder Zeile)');
});
