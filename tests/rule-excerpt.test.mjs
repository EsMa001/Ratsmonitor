import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {excerptPending,excerptShort,EXCERPT_FETCHES} from '../server/integrations/rule-excerpt.mjs';
import {preserveArticleContent} from '../shared/article-record.mjs';
import {AUSZUG_LABEL,AUSZUG_NOTICE,AUSZUG_METHOD} from '../shared/ris-auszug.mjs';
const sqlite=new DatabaseSync(':memory:');
for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
const db={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};},async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const q of statements)out.push(await q.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const TEXT=`Beschlussvorlage
Beschlussvorschlag:
Der Rat beschließt, die Kindertageseinrichtung am Wiegandweg mit 5 Gruppen zu errichten. Die Kosten betragen insgesamt 4,2 Mio. € und werden aus dem Haushalt gedeckt.
Die Trägerschaft wird nach Prüfung der Konzepte an den Verein vergeben, der das Konzept für den Stadtteil vorgelegt hat.`;
const pdf=id=>({title:'Vorlage',kind:'application/pdf',url:`https://example.org/${id}.pdf`});
const topic=(id,extra={})=>({id,regionId:'billerbeck',title:'Kita '+id,officialTitle:'Kita '+id,sourceUrl:'https://example.org/'+id,events:[{date:'2026-09-20'}],documents:[pdf(id)],generatedBy:'Automatischer Quellenüberblick',shortSummary:'alt kurz',longSummary:['alt lang'],...extra});
const insert=t=>sqlite.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(t.id,t.regionId,'city','2026-09-20','2026-09-20','consulting',JSON.stringify(t));
const reset=()=>{for(const name of ['topics','import_runs','system_state','article_analyses'])sqlite.exec('DELETE FROM '+name);};
const payload=id=>JSON.parse(sqlite.prepare('SELECT payload FROM topics WHERE id=?').get(id).payload);
const reader=urls=>async url=>{urls.push(url);if(url.includes('kaputt'))throw Error('Dokument HTTP 500');if(url.includes('leer'))return 'zu kurz';return TEXT;};

test('legt Originalsätze ab, kennzeichnet sie und lässt KI-Zusammenfassungen unberührt',async()=>{
 reset();const urls=[];
 insert(topic('a'));insert(topic('ki',{generatedBy:'KI-Zusammenfassung',shortSummary:'KI kurz'}));insert(topic('ca',{contentAnalysis:{status:'completed'}}));insert(topic('ohne',{documents:[]}));insert(topic('andere',{regionId:'muenster'}));
 const r=await excerptPending(db,'billerbeck',{reader:reader(urls)});
 assert.equal(r.status,200);assert.equal(r.data.completed,1);assert.equal(r.data.more,false);
 assert.deepEqual(urls,['https://example.org/a.pdf']);
 const a=payload('a');assert.equal(a.generatedBy,AUSZUG_LABEL);assert.equal(a.summaryMethod,AUSZUG_METHOD);
 assert.match(a.shortSummary,/^Der Rat beschließt/);assert.equal(a.longSummary.at(-1),AUSZUG_NOTICE);assert.ok(a.longSummary.length>=3);
 assert.equal(a.ruleExcerpt.status,'completed');assert.ok(a.ruleExcerpt.sentences.every(s=>s.regel&&TEXT.replace(/\s+/g,' ').includes(s.satz)));
 assert.equal(JSON.stringify(a).includes('Beschlussvorlage Beschlussvorschlag'),false,'kein Volltext gespeichert');
 assert.equal(payload('ki').shortSummary,'KI kurz');assert.equal(payload('ca').generatedBy,'Automatischer Quellenüberblick');assert.equal(payload('andere').ruleExcerpt,undefined);
 const h=sqlite.prepare("SELECT payload FROM article_analyses WHERE kind='rule-excerpt'").all();assert.equal(h.length,1);assert.equal(JSON.parse(h[0].payload).replaced.shortSummary,'alt kurz');
 assert.equal(sqlite.prepare("SELECT count(*) n FROM system_state WHERE key='import-lock'").get().n,0);
});
test('ein zweiter Lauf liest nichts erneut; Fehler und leere Dokumente werden vermerkt und nicht sofort wiederholt',async()=>{
 reset();const urls=[];insert(topic('a'));insert(topic('kaputt'));insert(topic('leer'));
 const first=await excerptPending(db,'billerbeck',{reader:reader(urls)});
 assert.deepEqual([first.data.completed,first.data.failed,first.data.noText],[1,1,1]);
 assert.equal(payload('kaputt').generatedBy,'Automatischer Quellenüberblick');assert.equal(payload('kaputt').ruleExcerpt.status,'failed');assert.equal(payload('leer').ruleExcerpt.status,'no_text');
 urls.length=0;const second=await excerptPending(db,'billerbeck',{reader:reader(urls)});
 assert.deepEqual(urls,[]);assert.equal(second.data.completed,0);
 // nach 24 Stunden wird der Fehlversuch wiederholt
 urls.length=0;await excerptPending(db,'billerbeck',{reader:reader(urls),now:()=>Date.now()+25*3600*1000});assert.deepEqual(urls,['https://example.org/kaputt.pdf']);
});
test('ein Paket liest höchstens ein paar Dokumente und setzt über den Cursor fort',async()=>{
 reset();const urls=[];for(let i=0;i<EXCERPT_FETCHES+3;i++)insert(topic('p'+String(i).padStart(2,'0')));
 const r1=await excerptPending(db,'billerbeck',{reader:reader(urls)});
 assert.equal(r1.data.completed,EXCERPT_FETCHES);assert.equal(r1.data.more,true);
 const r2=await excerptPending(db,'billerbeck',{after:r1.data.cursor,reader:reader(urls)});
 assert.equal(r2.data.completed,3);assert.equal(r2.data.more,false);assert.equal(new Set(urls).size,EXCERPT_FETCHES+3);
});
test('eine laufende Analyse sperrt den Auftrag',async()=>{
 reset();insert(topic('a'));sqlite.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?)").run(String(Date.now()+60000));
 const r=await excerptPending(db,'billerbeck',{reader:reader([])});assert.equal(r.status,409);assert.equal(payload('a').ruleExcerpt,undefined);
});
test('ein Import überschreibt den Auszug nicht, ändert sich das Dokument, wird er neu gebildet',async()=>{
 reset();insert(topic('a'));await excerptPending(db,'billerbeck',{reader:reader([])});
 const old=payload('a'),incoming=topic('a');
 const kept=preserveArticleContent(old,incoming);
 assert.equal(kept.generatedBy,AUSZUG_LABEL);assert.deepEqual(kept.longSummary,old.longSummary);assert.ok(kept.ruleExcerpt);
 const changed=preserveArticleContent(old,topic('a',{documents:[{...pdf('neu')}]}));
 assert.equal(changed.generatedBy,'Automatischer Quellenüberblick');assert.equal(changed.ruleExcerpt,undefined);
});
test('Kurzfassung hat höchstens 65 Wörter',()=>{assert.ok(excerptShort(Array(100).fill('wort').join(' ')).split(' ').length<=66);assert.equal(excerptShort('Kurz.'),'Kurz.');});
