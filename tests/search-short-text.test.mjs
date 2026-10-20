import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/sqlite-adapter.mjs';
import {refreshSearchWords} from '../server/integrations/search-words.mjs';
/* drizzle/0019: a card shows and searches only what the result list shows: title, short text and committee. The short
   text follows the article page (DetailPage.tsx): KI short summary, else the short rule summary, else the automatic
   source overview. Long texts and KI keywords are not searched. */
const dir=new URL('../drizzle/',import.meta.url);
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
const migrate=(raw,keep)=>{for(const f of files.filter(keep))raw.exec(fs.readFileSync(new URL(f,dir),'utf8'));};
const OPTIONS={kinds:new Map([['r1','city']]),postingMax:2};
const rule=(short,long)=>({version:1,generatedBy:'Regelbasierte Zusammenfassung',generatedAt:'2026-10-01',score:1,short:{sentences:short,words:5,score:1},long:{sentences:long,words:9,score:1}});
const OVERVIEW='Sanierung Turnhalle. Ein Beschluss ist dokumentiert. Die Details stehen in den verlinkten Originalunterlagen.';
const STOCK={
 ai:{title:'Sportplatz am Ring',generatedBy:'KI-Zusammenfassung',shortSummary:'Der Sportverein bekommt einen Kunstrasen.',longSummary:['Die Zuschauertribüne folgt später.'],contentAnalysis:{status:'completed'},ruleSummary:rule(['Regeltext Flutlicht.'],['Regeltext Umkleide.'])},
 rule:{title:'Sanierung Turnhalle',generatedBy:'Automatischer Quellenüberblick',shortSummary:OVERVIEW,longSummary:['Das Thema wird behandelt.'],ruleSummary:rule(['Die Stadt saniert das Hallendach.'],['Fördermittel des Landes sind beantragt.'])},
 plain:{title:'Bolzplatz Nord',generatedBy:'Automatischer Quellenüberblick',shortSummary:'Bolzplatz Nord. Neue Tore werden aufgestellt.',longSummary:['Langer Überblick Ballfangzaun.']},
 kw:{title:'Haushalt',shortSummary:'Haushalt.',weightedKeywords:{status:'completed',items:[{term:'Kostenkalkulation',weight:100}]},aiAttempts:{keywords:{retry:false},summary:{retry:true}}},
};
function fixture(keep){
 const raw=new DatabaseSync(':memory:');migrate(raw,keep);
 const put=raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 const add=(id,p)=>put.run(id,'r1','city','2026-09-17','2026-10-01T00:00:00Z','consulting',JSON.stringify({id,regionId:'r1',committee:'Sportausschuss',events:[{date:'2026-09-17'}],...p}));
 const card=id=>({...raw.prepare('SELECT teaser,search,search_exact FROM search_cards WHERE id=?').get(id)});
 return {raw,db:sqliteAdapter(raw),add,card};
}
test('a new card takes the short text of the article page and searches only title, short text and committee',()=>{
 const {raw,add,card}=fixture(()=>true);
 for(const [id,p] of Object.entries(STOCK))add(id,p);
 assert.equal(card('ai').teaser,'Der Sportverein bekommt einen Kunstrasen.');
 assert.match(card('ai').search,/sportverein/);assert.match(card('ai').search,/sportausschuss/);
 assert.doesNotMatch(card('ai').search,/zuschauertribune|regeltext/,'neither the long KI text nor the rule summary of a KI report');
 assert.equal(card('rule').teaser,'Die Stadt saniert das Hallendach.');
 assert.match(card('rule').search,/hallendach/);assert.match(card('rule').search,/turnhalle/);
 assert.doesNotMatch(card('rule').search,/originalunterlagen|fordermittel/,'neither the overview nor the long rule text');
 assert.equal(card('plain').teaser,'Bolzplatz Nord. Neue Tore werden aufgestellt.');assert.doesNotMatch(card('plain').search,/ballfangzaun/);
 assert.doesNotMatch(card('kw').search,/kostenkalkulation/);
 assert.match(card('rule').search_exact,/hallendach/);
 /* Changes that decide the short text rewrite the card */
 raw.prepare("UPDATE topics SET payload=json_set(payload,'$.ruleSummary.short.sentences',json('[\"Das Dach wird gedämmt.\"]')) WHERE id='rule'").run();
 assert.equal(card('rule').teaser,'Das Dach wird gedämmt.');assert.match(card('rule').search,/gedammt/);assert.match(card('rule').search_exact,/gedämmt/);
 raw.prepare("UPDATE topics SET payload=json_set(payload,'$.contentAnalysis',json('{\"status\":\"completed\"}'),'$.shortSummary','KI-Text Photovoltaik.') WHERE id='rule'").run();
 assert.equal(card('rule').teaser,'KI-Text Photovoltaik.');assert.doesNotMatch(card('rule').search,/gedammt/);
 raw.close();
});
test('0019 rewrites the existing cards like the new triggers and leaves the word list to a full rebuild',async()=>{
 const {raw,db,add,card}=fixture(f=>f<'0019');
 for(const [id,p] of Object.entries(STOCK))add(id,p);
 assert.match(card('kw').search,/kostenkalkulation/);assert.match(card('ai').search,/zuschauertribune/);
 await refreshSearchWords(db,{...OPTIONS,full:true});
 raw.prepare("UPDATE topics SET payload=json_set(payload,'$.title','Haushaltsplan') WHERE id='kw'").run();   // a pending log entry
 const revision=()=>raw.prepare("SELECT revision FROM data_revisions WHERE id='search'").get().revision,before=revision();
 migrate(raw,f=>f>='0019');
 const payload=JSON.parse(raw.prepare("SELECT payload FROM topics WHERE id='kw'").get().payload);
 assert.equal(payload.weightedKeywords,undefined);assert.equal(payload.aiAttempts.keywords,undefined);assert.deepEqual(payload.aiAttempts.summary,{retry:true});
 assert.ok(revision()>before,'search revision raised');
 assert.equal(raw.prepare('SELECT count(*) n FROM search_cards_gone').get().n,0);
 assert.equal(raw.prepare("SELECT value FROM system_state WHERE key='search-words'").get(),undefined);
 /* The rewrite gives exactly what the triggers write for the same reports */
 const migrated=Object.fromEntries(Object.keys(STOCK).map(id=>[id,card(id)]));
 const rows=raw.prepare('SELECT * FROM topics').all();raw.exec('DELETE FROM topics');
 const put=raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 for(const r of rows)put.run(r.id,r.region_id,r.source,r.event_date,r.updated_at,r.status,r.payload);
 assert.deepEqual(Object.fromEntries(Object.keys(STOCK).map(id=>[id,card(id)])),migrated);
 assert.equal(migrated.rule.teaser,'Die Stadt saniert das Hallendach.');assert.doesNotMatch(migrated.kw.search,/kostenkalkulation/);
 /* Without a stand the next run builds the word list in full */
 raw.exec('DELETE FROM search_cards_gone');
 const r=await refreshSearchWords(db,OPTIONS);assert.equal(r.full,true);
 const words=raw.prepare('SELECT word FROM search_words').all().map(w=>w.word);
 for(const w of ['kostenkalkulation','zuschauertribune','originalunterlagen','fordermittel'])assert.ok(!words.includes(w),w);
 assert.ok(words.includes('hallendach'));
 raw.close();
});
