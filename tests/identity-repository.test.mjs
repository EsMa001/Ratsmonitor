import test from 'node:test';
import {analysed} from './helpers/analysed.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let failBatch=false;
globalThis.identityFixture={env:{DB:{prepare(sql){let args=[];return {bind(...v){args=v;return this;},async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;},async run(){db.prepare(sql).run(...args);return {success:true};}};},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements){r.push(await s.all());if(failBatch)throw Error('simulated failure');}db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}},fresh:null};
const stubs={
 'server-only':'export {};',
 'cloudflare:workers':'export const env=globalThis.identityFixture.env;',
 '@/server/repositories/seed':'export async function ensureData(){}',
 './seed':'export async function ensureData(){}',
 '@/server/integrations/collect-region.mjs':'export async function collectRegion(){if(globalThis.identityFixture.error)throw Error("upstream unavailable");return globalThis.identityFixture.fresh;}',
 '@/server/integrations/documents.mjs':'export async function enrichDocument(t){return t;}',
 '@/server/integrations/ai-summary.mjs':'export async function summarize(t){return t;}',
 '@/server/services/push':'export async function dispatchDecisionPush(){}'
};
const cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);let code=fs.readFileSync(file,'utf8');if(file.endsWith('.json'))return uri('export default '+code+';');
 if(file.endsWith('.mjs'))return pathToFileURL(file).href;
 code=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 code=code.replace(/((?:from\s*|import\s*)['"])([^'"]+)(['"])/g,(m,pre,spec,post)=>{if(stubs[spec])return pre+uri(stubs[spec])+post;const base=spec.startsWith('@/')?path.join(root,spec.slice(2)):spec.startsWith('.')?path.resolve(path.dirname(file),spec):null;if(!base)return m;const found=[base,base+'.ts',base+'.tsx'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());return pre+load(found)+post;});
 const result=uri(code);cache.set(file,result);return result;
}
const topics=await import(load(path.join(root,'server/repositories/topics.ts')));
const regions=await import(load(path.join(root,'server/repositories/regions.ts')));
const analytics=await import(load(path.join(root,'server/repositories/analytics.ts')));
const sync=await import(load(path.join(root,'server/services/sync.ts')));
const url='https://fixture.example';
const make=(id,regionId='billerbeck',source='city')=>({id,regionId,source,sourceUrl:url+'/agendaitem/'+id,officialTitle:'Wärmeplanung',title:'Wärmeplanung',shortSummary:'Quelle',longSummary:['Quelle'],generatedBy:'Quellenüberblick',reference:'',status:'consulting',eventDate:'2026-09-20',updatedAt:'2026-09-20',events:[{url:url+'/meeting/1',date:'2026-09-20',committee:'Rat',status:'consulting',description:'Beratung'}],documents:[],sourceText:'Wärmeplanung'});
function insert(t){db.prepare('INSERT OR REPLACE INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(t.id,t.regionId,t.source,t.eventDate,t.updatedAt,t.status,JSON.stringify(t));}
function reset(){for(const table of ['topics','article_versions','source_coverage','import_runs','system_state'])db.exec('DELETE FROM '+table);failBatch=false;globalThis.identityFixture.error=false;}
test('real repository SQL preserves old detail links, excludes aliases from feed, analytics and coverage, and archives on sync',async()=>{
 reset();const a=make('old-a'),b=make('old-b');insert(a);insert(b);
 globalThis.identityFixture.fresh={topics:[{...make('paper'),sourceUrl:url+'/paper/1',identityLinks:[a.sourceUrl,b.sourceUrl],updatedAt:'2026-09-26'}],coverage:{regionId:'billerbeck',importedAt:'2026-09-26',from:'2026-07-01',to:'2026-09-26',complete:true,issues:[]}};
 assert.equal((await sync.runSync('metadata','billerbeck')).status,200);
 const page=await topics.getFeedPage();assert.equal(page.storageAvailable,true);assert.equal(page.total,1);assert.equal(page.topics.length,1);
 for(const id of ['old-a','old-b','paper'])assert.equal((await topics.getTopic(id)).id,'old-a');
 assert.equal((await regions.getRegionCoverage()).find(r=>r.regionId==='billerbeck').articleCount,1);
 const result=await analytics.getAnalytics(new URLSearchParams({region:'billerbeck',from:'2026-09-01',to:'2026-09-26',topic:'old-b'}));assert.equal(result.storageAvailable,true);assert.equal(result.total,1);assert.equal(result.focus.id,'old-a');
 assert.equal(db.prepare('SELECT count(*) AS n FROM article_versions').get().n,2);
 await sync.runSync('metadata','billerbeck');assert.equal(db.prepare('SELECT count(*) AS n FROM article_versions').get().n,2);
 assert.equal((await topics.getSourceStats()).total,1);
});
test('failed canonical/alias batch rolls back both changes and preserves original records',async()=>{
 reset();const a=make('a'),b=make('b');insert(a);insert(b);
 globalThis.identityFixture.fresh={topics:[{...make('paper'),sourceUrl:url+'/paper/1',identityLinks:[a.sourceUrl,b.sourceUrl],updatedAt:'2026-09-26'}],coverage:{issues:[],complete:true}};
 failBatch=true;assert.equal((await sync.runSync('metadata','billerbeck')).status,502);failBatch=false;
 assert.equal(db.prepare('SELECT count(*) AS n FROM article_versions').get().n,0);
 assert.equal(db.prepare('SELECT count(*) AS n FROM topics').get().n,2);
 assert.equal((await topics.getTopic('b')).id,'b');
});
test('repository caller excludes own district for a district origin as well as its municipality',async()=>{
 reset();const own=analysed(make('own','coesfeld','district')),other=analysed(make('other','steinfurt','district'));insert(own);insert(other);
 assert.deepEqual((await regions.getRelated({...own,id:'origin'})).totalDistricts,['steinfurt']);
 assert.deepEqual((await regions.getRelated(analysed(make('origin')))).totalDistricts,['steinfurt']);
});

test('failed and empty follow-up imports preserve successful coverage and articles, record context and respect cooldown',async()=>{
 reset();insert(make('kept'));
 const original={importedAt:'2026-09-20T12:00:00Z',complete:true,issues:[],method:'scraper',meetings:2};
 db.prepare('INSERT INTO source_coverage VALUES(?,?)').run('billerbeck',JSON.stringify(original));
 globalThis.identityFixture.error=true;
 assert.equal((await sync.runSync('metadata','billerbeck','scheduled')).status,502);
 let c=JSON.parse(db.prepare('SELECT payload FROM source_coverage').get().payload);
 assert.equal(c.importedAt,original.importedAt);assert.equal(c.lastSuccessAt,original.importedAt);assert.equal(c.attemptStatus,'failed');assert.equal(c.failureCount,1);
 assert.equal(db.prepare('SELECT count(*) AS n FROM topics').get().n,1);
 const run=JSON.parse(db.prepare('SELECT details FROM import_runs').get().details);assert.equal(run.region,'billerbeck');assert.equal(run.trigger,'scheduled');
 assert.equal((await sync.runSync('metadata','billerbeck','scheduled')).data.skipped,true);
 globalThis.identityFixture.error=false;
 globalThis.identityFixture.fresh={topics:[],coverage:{importedAt:new Date().toISOString(),complete:false,issues:['empty']}};
 assert.equal((await sync.runSync('metadata','billerbeck')).status,200);
 c=JSON.parse(db.prepare('SELECT payload FROM source_coverage').get().payload);assert.equal(c.importedAt,original.importedAt);assert.equal(c.attemptStatus,'empty');assert.equal(c.failureCount,2);
 globalThis.identityFixture.fresh={topics:[make('kept')],coverage:{importedAt:new Date().toISOString(),complete:true,issues:[]}};
 await sync.runSync('metadata','billerbeck');c=JSON.parse(db.prepare('SELECT payload FROM source_coverage').get().payload);
 assert.equal(c.failureCount,0);assert.equal(c.nextRetryAt,null);assert.ok(c.lastCompleteAt);const versions=db.prepare('SELECT count(*) AS n FROM article_versions').get().n;await sync.runSync('metadata','billerbeck');assert.equal(db.prepare('SELECT count(*) AS n FROM article_versions').get().n,versions);
});
test('active import lock rejects competing calls without new run or writes',async()=>{
 reset();db.prepare('INSERT INTO system_state VALUES(?,?)').run('import-lock',String(Date.now()+60000));
 assert.equal((await sync.runSync('metadata','billerbeck')).status,409);
 assert.equal(db.prepare('SELECT count(*) AS n FROM import_runs').get().n,0);
});

test('upcoming-session SQL returns only two distinct dated meetings without transferring every event',async()=>{
 reset();const today=new Date().toISOString().slice(0,10);
 const event=(date,committee,status='announced')=>({date,committee,status});
 insert({...make('a'),events:[event(today,'Rat'),event(today,'Rat'),event('2099-01-01','Ausschuss'),event('2099-02-01','Rat')]});
 insert({...make('b'),events:[event(today,'Rat'),event('2099-01-01','Ausschuss')]});
 insert({...make('alias'),identity:{mergedInto:'a'},events:[event(today,'Alias-Gremium')]});
 insert({...make('past'),events:[event('2020-01-01','Vergangen')]});
 const sessions=await topics.getUpcomingSessions('billerbeck');
 assert.equal(sessions.length,2);assert.deepEqual(sessions.map(s=>[s.date,s.committee]),[[today,'Rat'],['2099-01-01','Ausschuss']]);
});

test('historical bundle preserves current records, adds older topics, records failed coverage and is idempotent',async()=>{
 const {applyBackfill}=await import('../server/integrations/apply-backfill.mjs');
 reset();const current=make('current');insert(current);
 const older={...make('historical'),eventDate:'2025-11-20',updatedAt:'2025-11-20',events:[{...make('historical').events[0],date:'2025-11-20'}]};
 const bundle={revision:'2026-09-27T00:00:00Z',results:[{topics:[older],coverage:{regionId:'billerbeck',from:'2025-09-27',to:'2026-09-27',importedAt:'2026-09-27T00:00:00Z',requestedFrom:'2025-09-27',complete:false,issues:['partial']}}]};
 await applyBackfill(globalThis.identityFixture.env.DB,bundle);
 assert.equal(db.prepare('SELECT count(*) AS n FROM topics').get().n,2);
 const n=db.prepare('SELECT count(*) AS n FROM article_versions').get().n;
 await applyBackfill(globalThis.identityFixture.env.DB,bundle);
 assert.equal(db.prepare('SELECT count(*) AS n FROM article_versions').get().n,n);
 assert.equal(JSON.parse(db.prepare('SELECT payload FROM source_coverage').get().payload).requestedFrom,'2025-09-27');
});

test('public reads never initialise storage or label new articles, and imports do not classify',async()=>{
 reset();insert(make('unanalysed'));
 const before=db.prepare('SELECT * FROM topics ORDER BY id').all();
 await topics.getFeedPage();await topics.getTopic('unanalysed');await topics.getUpcomingSessions();await regions.getRegionCoverage();
 await analytics.getAnalytics(new URLSearchParams({region:'billerbeck',from:'2026-09-02',to:'2026-09-26'}));
 assert.deepEqual(db.prepare('SELECT * FROM topics ORDER BY id').all(),before);
 assert.equal(db.prepare('SELECT count(*) n FROM system_state').get().n,0);
 for(const trigger of ['manual','scheduled']){
  reset();globalThis.identityFixture.fresh={topics:[make('new')],coverage:{issues:[],complete:true}};
  assert.equal((await sync.runSync('metadata','billerbeck',trigger)).status,200);
  assert.equal(JSON.parse(db.prepare('SELECT payload FROM topics').get().payload).classification,undefined);
 }
 const runs=db.prepare('SELECT count(*) n FROM import_runs').get().n;
 assert.equal((await sync.runSync('summaries','billerbeck','scheduled')).status,403);
 assert.equal(db.prepare('SELECT count(*) n FROM import_runs').get().n,runs);
});
