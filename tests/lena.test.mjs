import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {parseQuestion,parseTime,findPlaces} from '../shared/lena/parse.mjs';
import {lookupGlossary} from '../shared/lena/glossary.mjs';
import {answer} from '../server/integrations/lena.mjs';
import {CATALOG} from '../shared/catalog.mjs';

const catalog=[{id:'billerbeck',kind:'city',name:'Stadt Billerbeck',shortName:'Billerbeck',ags:'05558008'},{id:'coesfeld',kind:'district',name:'Kreis Coesfeld',shortName:'Kreis Coesfeld',ags:'05558'},{id:'coesfeld-stadt',kind:'city',name:'Stadt Coesfeld',shortName:'Coesfeld',ags:'05558012'},{id:'wesel',kind:'city',name:'Stadt Wesel',shortName:'Wesel',ags:'05170048'},{id:'senden',kind:'city',name:'Gemeinde Senden',shortName:'Senden',ags:'05558036'},{id:'senden-by',kind:'city',name:'Stadt Senden',shortName:'Senden',ags:'09775150'}];
const now=Date.parse('2026-10-10T12:00:00Z');
function fixture(){
 const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const put=(id,region,title,status,date,extra={})=>{const t={id,regionId:region,title,officialTitle:title,shortSummary:'',committee:'Rat',status,sourceUrl:'https://example.org/'+id,events:[{date,status,committee:'Rat'}],classification:{method:'title-rules-v4',version:'labels-v2',primary:'klima',evidence:title},...extra};sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,region,'city',date,date,status,JSON.stringify(t));};
 put('p1','billerbeck','Photovoltaik auf dem Rathausdach','approved','2026-09-20');
 put('p2','billerbeck','Freiflächen-Photovoltaik Gemarkung Nord','consulting','2026-10-01');
 put('w1','coesfeld-stadt','Windkraft Konzentrationszone','postponed','2026-08-15');
 sql.prepare("INSERT INTO source_coverage(region_id,payload) VALUES('billerbeck',?)").run(JSON.stringify({regionId:'billerbeck',complete:true,importedAt:'2026-10-09T06:00:00Z'}));
 return {sql,db:sqliteAdapter(sql)};
}

test('lena understands intent, place, time and status with rules and never guesses an intent',()=>{
 const p=parseQuestion('Wurde Photovoltaik in Billerbeck in den letzten 30 Tagen beschlossen?',catalog,now);
 assert.equal(p.intent,'stand');assert.equal(p.place.regions[0].id,'billerbeck');assert.equal(p.status,'approved');assert.equal(p.time.from,'2026-09-10');assert.equal(p.topic,'photovoltaik');assert.deepEqual(p.labels,['klima']);
 assert.equal(parseQuestion('xyz',catalog,now).intent,'suche');
 assert.equal(parseQuestion('',catalog,now).intent,'');
 assert.equal(parseQuestion('Vergleiche Billerbeck und Wesel',catalog,now).places.length,2);
 assert.equal(parseQuestion('Vergleiche Billerbeck',catalog,now).needsPlace,true);
 assert.equal(parseTime('seit Juli',now).from,'2026-07-01');assert.equal(parseTime('im Jahr 2025',now).to,'2025-12-31');assert.equal(parseTime('am 03.05.2026',now),null);
});
test('lena asks instead of guessing when a place name is ambiguous, prefers the city over the district of the same name and the district on "Kreis"',()=>{
 assert.equal(findPlaces('Windkraft in Senden',catalog)[0].ambiguous,true);
 assert.equal(findPlaces('Windkraft in Coesfeld',catalog)[0].regions[0].id,'coesfeld-stadt');
 assert.equal(findPlaces('Windkraft im Kreis Coesfeld',catalog)[0].regions[0].id,'coesfeld');
 assert.equal(findPlaces('Windkraft in der Stadt Coesfeld',catalog)[0].regions[0].id,'coesfeld-stadt');
 assert.equal(findPlaces('Stand der Daten',catalog).length,0);
 /* Mit dem echten Katalog: Ortsteil fällt auf die Stadt zurück, Füllwörter treffen keinen Ort */
 assert.equal(findPlaces('Köln-Esch Spielplatz',CATALOG)[0].regions[0].name,'Stadt Köln');
 assert.equal(findPlaces('Was gibt es Neues?',CATALOG).length,0);
});
test('lena answers only from the data: hits with sources, ask-back, coverage, glossary; no answer without a source',async()=>{
 const {sql,db}=fixture();try{
 const a=await answer(db,catalog,'Was gibt es zu Photovoltaik in Billerbeck?',{now});
 assert.equal(a.intent,'suche');assert.equal(a.sources.length,2);assert.match(a.text,/2 Vorgänge/);assert.ok(a.sources.every(s=>s.link.startsWith('/beschluss/')));assert.ok(a.links.some(l=>l.link==='/?q=photovoltaik'));
 const s=await answer(db,catalog,'Wurde Photovoltaik in Billerbeck beschlossen?',{now});
 assert.equal(s.intent,'stand');assert.match(s.text,/Rathausdach/);assert.match(s.text,/Stand Beschlossen/);assert.ok(s.sources.length);
 const miss=await answer(db,catalog,'Wurde Photovoltaik in Billerbeck abgelehnt?',{now});
 assert.match(miss.text,/Stand „Abgelehnt“ habe ich dazu nicht gefunden/);
 const none=await answer(db,catalog,'Was gibt es zu Kläranlage in Wesel?',{now});
 assert.equal(none.sources.length,0);assert.match(none.text,/keine Vorgänge gefunden/);
 const ask=await answer(db,catalog,'Sag mir Bescheid bei Windkraft in Senden',{now});
 assert.ok(ask.ask);assert.deepEqual(ask.ask.options.map(o=>o.text).sort(),['Gemeinde Senden','Stadt Senden']);assert.match(ask.ask.options[0].question,/Senden/);
 const alarm=await answer(db,catalog,'Sag mir Bescheid bei Windkraft in der Stadt Coesfeld',{now});
 assert.equal(alarm.intent,'alarm');assert.ok(alarm.links[0].link.startsWith('/?q=windkraft'));
 const cov=await answer(db,catalog,'Ist Billerbeck dabei?',{now});
 assert.match(cov.text,/Stadt Billerbeck ist dabei: 2 Vorgänge/);assert.match(cov.text,/vollständig/);assert.match(cov.text,/Datenstand 09\.10\.2026/);
 const no=await answer(db,catalog,'Ist Wesel dabei?',{now});assert.match(no.text,/noch nicht dabei/);
 const help=await answer(db,catalog,'Was bedeutet Vertagung?',{now});assert.equal(help.text,lookupGlossary('Vertagung').text);
 const unknown=await answer(db,catalog,'???',{now});assert.equal(unknown.intent,'');assert.match(unknown.text,/nicht verstanden/);
 const cmp=await answer(db,catalog,'Vergleiche Billerbeck und Wesel bei Photovoltaik',{now});assert.match(cmp.links[0].link,/^\/analytics\/compare\?/);assert.match(cmp.links[0].link,/area=05558008/);
 const trend=await answer(db,catalog,'Wie entwickelt sich Photovoltaik?',{now});assert.equal(trend.intent,'entwicklung');assert.match(trend.text,/letzten 90 Tagen/);
 /* Nichts außer Titeln, Daten und Links verlässt die Antwort: kein Rohtext, keine Zusammenfassung */
 assert.ok(!JSON.stringify(a).includes('sourceText'));
 }finally{sql.close();}
});
