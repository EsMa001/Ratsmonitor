import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {storedClassification,hasCurrentLabel,hasCurrentAiLabel} from '../shared/analysis-state.mjs';
import {analysisSignature} from '../shared/article-record.mjs';
import {LABEL_VERSION,CLASSIFIER_VERSION} from '../shared/labels.mjs';
import {AI_LOCAL_METHOD} from '../shared/ai-local-content.mjs';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {refreshSearchWords,precomputedFacets} from '../server/integrations/search-words.mjs';

const topic=overrides=>({id:'report',regionId:'r1',title:'Haushalt Spielplatz',officialTitle:'Haushalt Spielplatz',status:'consulting',
 eventDate:'2026-09-17',updatedAt:'2026-10-12T08:00:00Z',sourceUrl:'https://example.test/report',shortSummary:'Die Verwaltung plant einen Spielplatz.',committee:'Rat',
 events:[{date:'2026-09-17',committee:'Rat',status:'consulting',result:''}],documents:[{url:'https://example.test/paper.pdf',kind:'application/pdf',title:'Vorlage'}],
 classification:{primary:'finanzen',secondary:[],version:LABEL_VERSION,method:CLASSIFIER_VERSION,evidence:'Haushalt Spielplatz',reason:'Titelregel'},...overrides});
const ai=t=>({primary:'sport',secondary:[],reason:'Inhalt der Vorlage',status:'completed',version:LABEL_VERSION,method:AI_LOCAL_METHOD,
 sourceSignature:analysisSignature(t),classifiedAt:'2026-10-12T08:00:00Z',evidence:[{url:t.sourceUrl,quote:'Originalbeleg'}]});
const review=()=>({primary:'bildung',reviewer:'Max',reviewedAt:'2026-10-12T08:00:00Z',reason:'Fachlich geprueft'});

function fixture(t,{beforeEffective=false}={}){
 const raw=new DatabaseSync(':memory:');t.after(()=>raw.close());
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort()){
  if(beforeEffective&&file>='0027')continue;
  raw.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 }
 const put=raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
 const add=value=>put.run(value.id,value.regionId,'city',value.eventDate,value.updatedAt,value.status,JSON.stringify(value));
 const update=value=>raw.prepare('UPDATE topics SET payload=? WHERE id=?').run(JSON.stringify(value),value.id);
 const label=id=>raw.prepare('SELECT label FROM search_cards WHERE id=?').get(id)?.label;
 return {raw,db:sqliteAdapter(raw),add,update,label};
}

test('effective classification uses reviewed content, then current local AI, then the stored rule',()=>{
 const value=topic();assert.equal(storedClassification(value).primary,'finanzen');
 value.labelAssessments={ai:ai(value)};
 assert.equal(storedClassification(value).primary,'sport');assert.equal(storedClassification(value).evidence,value.officialTitle);
 assert.equal(hasCurrentLabel(value),true,'Displaying AI does not hide current title rules from the rule refresh');
 value.labelAssessments.review=review();assert.equal(storedClassification(value).primary,'bildung');
 assert.equal(storedClassification(value).method,'manual-review');
 value.labelAssessments.review.reviewer='';assert.equal(storedClassification(value).primary,'sport');
 value.labelAssessments.ai.status='stale';assert.equal(storedClassification(value).primary,'finanzen');
});

test('old, failed, mismatched and unknown AI labels cannot become the displayed category',()=>{
 for(const change of [{status:'failed'},{status:'stale'},{method:'ai-agent-content-v1'},{version:'labels-old'},
  {primary:'invented'},{sourceSignature:'not-json'}]){
  const value=topic();value.labelAssessments={ai:{...ai(value),...change}};
  assert.equal(hasCurrentAiLabel(value),false);assert.equal(storedClassification(value).primary,'finanzen');
 }
 const value=topic();value.labelAssessments={ai:ai(value)};value.status='approved';
 assert.equal(storedClassification(value).primary,'finanzen');
});

test('SQLite insert projection and JavaScript classification have the same precedence and metadata freshness',t=>{
 const f=fixture(t);let n=0;
 const check=value=>{value.id='case-'+n++;f.add(value);assert.equal(f.label(value.id),storedClassification(value).primary,JSON.stringify(value));};
 check(topic());
 check(topic({classification:{...topic().classification,method:'title-rules-v3'}}));
 const local=topic();local.labelAssessments={ai:ai(local)};check(local);
 check({...local,labelAssessments:{...local.labelAssessments,review:review()}});
 for(const change of [{status:'failed'},{status:'stale'},{method:'ai-agent-content-v1'},{version:'labels-old'},
  {primary:'invented'},{sourceSignature:'not-json'}])check({...local,labelAssessments:{ai:{...local.labelAssessments.ai,...change}}});
 for(const change of [{status:'approved'},{officialTitle:'Neuer Titel'},
  {events:[{date:'2026-09-18',committee:'Rat',status:'consulting'}]},
  {documents:[{url:'https://example.test/new.pdf',kind:'application/pdf'}]}])check({...local,...change});
 for(const changedReview of [{primary:'invented'},{reviewer:'   '},{reviewedAt:'invalid'},
  {status:'stale'},{sourceSignature:'old'}])check({...local,labelAssessments:{...local.labelAssessments,review:{...review(),...changedReview}}});
 const sparse=topic({events:[{date:'2026-09-17'}],documents:[]});delete sparse.status;
 sparse.labelAssessments={ai:ai(sparse)};
 sparse.status='consulting';sparse.labelAssessments.ai.sourceSignature=analysisSignature(sparse);
 check(sparse);
});

test('a label-only AI save updates filters, keeps date/formal/text/FTS, and logs the previously indexed label',t=>{
 const f=fixture(t),value=topic();f.add(value);
 const before={...f.raw.prepare('SELECT * FROM search_cards WHERE id=?').get(value.id)};
 value.labelAssessments={ai:ai(value)};f.update(value);
 assert.equal(f.label(value.id),'sport');
 const after={...f.raw.prepare('SELECT * FROM search_cards WHERE id=?').get(value.id)};
 assert.deepEqual({...after,label:before.label},before);
 assert.equal(f.raw.prepare("SELECT count(*) n FROM search_cards WHERE label='sport' AND formal=0").get().n,1);
 assert.equal(f.raw.prepare("SELECT count(*) n FROM search_fts WHERE search_fts MATCH 'spielplatz'").get().n,1);
 assert.deepEqual(f.raw.prepare('SELECT label FROM search_cards_gone').all().map(row=>row.label),['finanzen']);
 value.labelAssessments.review=review();f.update(value);assert.equal(f.label(value.id),'bildung');
 assert.deepEqual(f.raw.prepare('SELECT label FROM search_cards_gone').all().map(row=>row.label),['finanzen','sport']);
});

test('events and document membership changes invalidate the AI filter category while fetch timestamps do not',t=>{
 const f=fixture(t),value=topic();value.labelAssessments={ai:ai(value)};f.add(value);
 value.metadata={lastFetchedAt:'2026-10-13T08:00:00Z'};value.events[0].attendance={fetchedAt:'2026-10-13T08:00:00Z'};
 f.update(value);assert.equal(f.label(value.id),'sport');assert.equal(f.raw.prepare('SELECT count(*) n FROM search_cards_gone').get().n,0);
 value.events[0].result='Beschluss gefasst';f.update(value);assert.equal(f.label(value.id),'finanzen');
 value.labelAssessments.ai=ai(value);f.update(value);assert.equal(f.label(value.id),'sport');
 value.documents.push({url:'https://example.test/attachment.pdf',kind:'application/pdf'});f.update(value);assert.equal(f.label(value.id),'finanzen');
});

test('inactive reports never gain search cards when AI or manual classifications change',t=>{
 const f=fixture(t),value=topic({identity:{mergedInto:'target'}});value.labelAssessments={ai:ai(value),review:review()};
 f.add(value);assert.equal(f.label(value.id),undefined);
 value.labelAssessments.review.primary='sport';f.update(value);assert.equal(f.label(value.id),undefined);
 assert.equal(f.raw.prepare('SELECT active FROM topics WHERE id=?').get(value.id).active,0);
});

test('migration reprojects existing AI labels and invalidates the old word-facet cache',t=>{
 const f=fixture(t,{beforeEffective:true}),value=topic();value.labelAssessments={ai:ai(value)};f.add(value);
 assert.equal(f.label(value.id),'finanzen');
 f.raw.prepare("INSERT OR REPLACE INTO system_state(key,value) VALUES('search-words','{}')").run();
 f.raw.exec(fs.readFileSync(new URL('../drizzle/0027_search_effective_labels.sql',import.meta.url),'utf8'));
 assert.equal(f.label(value.id),'sport');assert.equal(f.raw.prepare("SELECT value FROM system_state WHERE key='search-words'").get(),undefined);
});

test('label changes leave incremental word facets equivalent to a full rebuild',async t=>{
 const f=fixture(t),options={kinds:new Map([['r1','city']]),postingMax:2};
 const a=topic({id:'a'}),b=topic({id:'b'}),c=topic({id:'c'});f.add(a);f.add(b);f.add(c);
 await refreshSearchWords(f.db,{...options,full:true});
 a.labelAssessments={ai:ai(a)};f.update(a);
 await refreshSearchWords(f.db,options);
 const facets=await precomputedFacets(f.db,'haushalt',{level:'city',levelIds:['r1']});
 assert.deepEqual(facets.facets.sort((a,b)=>a.label.localeCompare(b.label)),[
  {label:'finanzen',status:'consulting',n:2},{label:'sport',status:'consulting',n:1}]);
 const snapshot=f.raw.prepare('SELECT * FROM search_word_facets ORDER BY word,kind,label,status').all();
 await refreshSearchWords(f.db,{...options,full:true});
 assert.deepEqual(f.raw.prepare('SELECT * FROM search_word_facets ORDER BY word,kind,label,status').all(),snapshot);
});
