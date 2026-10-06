import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {adminAccess,claimAdmin,requireAdminAccess,requireSameOrigin} from '../server/integrations/admin-access.mjs';
import {loadAdminData,adminReview,D1_MAX_PARAMETERS} from '../server/integrations/admin-data.mjs';
import {processingStatus} from '../server/integrations/processing-status.mjs';
import {filterAdminSources,sourcesCsv} from '../shared/admin.mjs';

const root=path.resolve(import.meta.dirname,'..'),sqlite=new DatabaseSync(':memory:');
for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){sqlite.prepare(sql).run(...args);return {success:true};}};},async batch(statements){return Promise.all(statements.map(s=>s.all()));}};
const owner={userId:'trusted-site-sub',email:'owner@example.org'},other={userId:'other-site-sub',email:owner.email};
const code='fixture-activation-code',hash=createHash('sha256').update(code).digest('hex');
const reset=()=>{for(const t of ['topics','source_coverage','import_runs','article_versions','system_state','push_subscriptions'])sqlite.exec('DELETE FROM '+t);};
const errorStatus=n=>e=>e.status===n;
const insert=(id,extra={})=>{const t={id,regionId:'billerbeck',status:'consulting',title:'Schulbau '+id,updatedAt:'2026-09-26T12:00:00Z',generatedBy:'Quellenüberblick',classification:{primary:'bildung'},documents:[],...extra};sqlite.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(id,t.regionId,'city','2026-09-20',t.updatedAt,t.status,JSON.stringify(t));};

test('admin identity is claimed once, checks trusted ID rather than email and fails closed',async()=>{
 reset();assert.equal((await adminAccess(db,null)).kind,'anonymous');
 await assert.rejects(requireAdminAccess(db,null),errorStatus(401));
 await assert.rejects(claimAdmin(db,owner,'wrong',hash),errorStatus(403));
 assert.equal((await adminAccess(db,owner)).kind,'setup');
 const claims=await Promise.allSettled([claimAdmin(db,owner,code,hash),claimAdmin(db,other,code,hash)]);
 assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);
 const winner=claims[0].status==='fulfilled'?owner:other,loser=winner===owner?other:owner;
 assert.equal((await adminAccess(db,winner)).kind,'owner');
 assert.equal((await adminAccess(db,loser)).kind,'denied');
 await assert.rejects(requireAdminAccess(db,loser),errorStatus(403));
 await assert.rejects(claimAdmin(db,owner,code,hash),errorStatus(409));
 await assert.rejects(adminAccess(null,owner),errorStatus(503));
 const saved=sqlite.prepare('SELECT value FROM system_state').get().value;
 assert.ok(!saved.includes(code)&&!saved.includes(hash)&&!saved.includes(owner.email));
});
test('admin mutations reject missing or cross-site origin and non-JSON requests',()=>{
 const request=headers=>new Request('https://site.example/api/admin/import',{method:'POST',headers});
 for(const headers of [{},{origin:'https://evil.example','content-type':'application/json'},{origin:'https://site.example','content-type':'application/json','sec-fetch-site':'cross-site'}])assert.throws(()=>requireSameOrigin(request(headers)),errorStatus(403));
 assert.throws(()=>requireSameOrigin(request({origin:'https://site.example','content-type':'text/plain'})),errorStatus(415));
 assert.doesNotThrow(()=>requireSameOrigin(request({origin:'https://site.example','content-type':'application/json'})));
});
test('real admin SQL counts canonical articles, separate quality states and source coverage without disclosing secrets',async()=>{
 reset();insert('a',{generatedBy:'KI-Zusammenfassung',quality:{passed:true},documents:[{kind:'application/pdf'}]});
 insert('b',{regionId:'muenster',classification:{primary:'unklar'},status:'unknown',summaryIssue:'Unbelegte Zahl',identity:{conflict:true}});
 insert('alias',{identity:{mergedInto:'a'},classification:{primary:'unklar'}});
 sqlite.prepare('INSERT INTO source_coverage VALUES(?,?)').run('billerbeck',JSON.stringify({method:'scraper',complete:false,importedAt:'2026-09-10T00:00:00Z',issues:['Teilabruf']}));
 sqlite.prepare('INSERT INTO source_coverage VALUES(?,?)').run('muenster',JSON.stringify({method:'oparl',complete:true,importedAt:'2026-09-27T00:00:00Z',issues:[]}));
 sqlite.prepare('INSERT INTO push_subscriptions(id,endpoint,auth,p256dh,created_at) VALUES(?,?,?,?,?)').run('1','https://private-push.example/secret','private-auth','private-key','2026-09-27');
 sqlite.prepare('INSERT INTO system_state VALUES(?,?)').run('admin-owner-v1',JSON.stringify({userId:'secret-owner'}));
 sqlite.prepare('INSERT INTO import_runs VALUES(?,?,?,?,?)').run('run','2026-09-27T00:00:00Z',null,'running',JSON.stringify({region:'billerbeck',trigger:'scheduled',issues:['private-diagnostics']}));
 const result=await loadAdminData(db,{now:new Date('2026-09-27T12:00:00Z')});
 assert.equal(result.counts.online,2);assert.equal(result.counts.aliases,1);assert.equal(result.counts.unlabelled,1);
 for(const key of ['aiSummaries','qualityPassed','pdfArticles','conflicts','textIssues','pushSubscriptions'])assert.equal(result.counts[key],1,key);
 assert.equal(result.counts.updated7d,2);assert.equal(result.sources.length,427+440+4457);assert.equal(result.sources.filter(s=>s.land==='03').length,440);assert.equal(new Set(result.sources.map(s=>s.land)).size,16);
 assert.equal(result.sources.find(s=>s.id==='billerbeck').count,1);
 assert.equal(result.sources.find(s=>s.id==='billerbeck').stale,true);
 assert.equal(result.sources.find(s=>s.id==='borken').configured,true);
 assert.equal(filterAdminSources(result.sources,'partial').length,1);
 assert.equal(filterAdminSources(result.sources,'data','Münster').length,1);
 // Access of programs (shared/source-access.mjs): every area has a status; robots.txt never labels an interface.
 const muenster=result.sources.find(s=>s.id==='muenster'),hamburg=result.sources.find(s=>s.id==='de-02000000');
 assert.deepEqual([muenster.access,muenster.accessLabel],['oparl','OParl verfügbar']);
 assert.deepEqual([hamburg.access,hamburg.accessLabel,hamburg.channel],['api','API verfügbar','CKAN']);
 assert.ok(result.sources.every(s=>s.access&&s.accessLabel),'a status for every area');
 assert.ok(filterAdminSources(result.sources,'robots').every(s=>s.access==='robots'));
 assert.ok(filterAdminSources(result.sources,'closed').length>0);
 assert.ok(filterAdminSources(result.sources,'closed').every(s=>['blocked','none'].includes(s.access)&&!s.canImport),'no automated access only where no source is connected');
 assert.equal(result.runs[0].abandoned,true);assert.equal(result.lastScheduledAt,'2026-09-27T00:00:00Z');
 assert.equal(result.labels.reduce((n,l)=>n+l.count,0),2);
 assert.equal(result.review.total,1);
 const json=JSON.stringify(result);for(const secret of ['secret-owner','private-auth','private-key','private-push','private-diagnostics'])assert.ok(!json.includes(secret));
});
test('the overview reads the stored reports once; its figures per area equal the separate processing status',async()=>{
 reset();const at=new Date('2026-09-27T12:00:00Z');
 insert('a');insert('b',{regionId:'muenster',classification:{primary:'unklar'},metadata:{lastFetchedAt:'2026-09-26T10:00:00Z'}});
 insert('c',{regionId:'muenster',classification:{primary:'bauen'},contentAnalysis:{status:'stale'},metadata:{lastFetchedAt:'2026-09-27T10:00:00Z',lastProcessedAt:'2026-09-27T11:00:00Z'}});
 insert('d',{regionId:'muenster',classification:{primary:'unklar'},contentAnalysis:{status:'insufficient_source'}});insert('alias',{identity:{mergedInto:'a'},classification:{primary:'unklar'}});
 // Statements that read into the stored reports, beyond the indexed columns.
 const asked=[],watched={prepare(sql){asked.push(sql);return db.prepare(sql);},batch:statements=>db.batch(statements)},scans=()=>asked.filter(q=>/FROM topics WHERE/.test(q)&&q.includes("'$.classification.primary'")).length;
 const full=await loadAdminData(watched,{now:at});assert.equal(scans(),2,'one scan for all figures, one for the review list');
 // Unchanged reports are not read a second time (revision-cache.mjs).
 asked.length=0;const light=await loadAdminData(watched,{now:at,review:false});assert.equal(scans(),0);assert.ok(!asked.some(q=>q.includes('LIMIT 25')));
 assert.deepEqual(light.review,{issue:'labels',total:2,articles:[]});assert.deepEqual({...light,review:0},{...full,review:0});
 assert.equal(full.review.total,2);assert.deepEqual(full.review.articles.map(a=>a.id).sort(),['b','d']);
 assert.equal(full.counts.online,4);assert.equal(full.counts.aliases,1);assert.equal(full.counts.unlabelled,2);assert.equal(full.counts.summaryStale,1);assert.equal(full.counts.summaryInsufficient,1);
 assert.deepEqual(full.labels.filter(l=>l.count).map(l=>[l.id,l.count]),[['bildung',1],['bauen',1],['unklar',2]]);
 const status=await processingStatus(db);assert.equal(status.regions.length,2);
 for(const area of status.regions){const shown=full.sources.find(s=>s.id===area.region_id);assert.equal(shown.count,area.total);assert.deepEqual(shown.processing,{...area},area.region_id);assert.equal(shown.pendingAnalysis,area.total-area.rules);}
 // A changed report is read again, only its area; "updated in the last seven days" moves with the clock without a scan.
 asked.length=0;insert('e');const changed=await loadAdminData(watched,{now:at,review:false});assert.equal(scans(),1);assert.equal(changed.counts.online,5);
 assert.ok(asked.some(q=>/region_id IN \(\?\)/.test(q)),'only the changed area is read');
 asked.length=0;const later=await loadAdminData(watched,{now:new Date('2026-10-30T13:00:00Z'),review:false});assert.equal(scans(),0);
 assert.equal(later.counts.updated7d,0);assert.equal(later.counts.online,5);assert.equal(changed.counts.updated7d,5);
 const muenster=full.sources.find(s=>s.id==='muenster').processing;assert.equal(muenster.total,3);assert.equal(muenster.stale,1);assert.equal(muenster.insufficient,1);assert.equal(muenster.fetchedAt,'2026-09-27T10:00:00Z');assert.equal(muenster.processedAt,'2026-09-27T11:00:00Z');
 assert.deepEqual(full.sources.find(s=>s.id==='borken').processing,{total:0,rules:0,summary:0,aiLabel:0,keywords:0,insufficient:0,stale:0,blocked_summary:0,blocked_aiLabel:0,blocked_keywords:0,fetchedAt:null,processedAt:null});
});
test('figures per area are computed step by step within a budget and fall back to one scan without the tables',async()=>{
 reset();const at=new Date('2026-09-27T12:00:00Z');
 insert('a',{events:[{date:'2026-08-01'},{date:'2026-09-20'}]});insert('b',{regionId:'muenster'});insert('c',{regionId:'coesfeld',classification:{primary:'unklar'}});
 /* Kein Budget: nichts wird gelesen, alle drei Gebiete stehen aus; die Zahl der Berichte stimmt trotzdem */
 const first=await loadAdminData(db,{now:at,review:false,statsBudgetMs:0});
 assert.equal(first.statsPending,3);assert.equal(first.counts.online,3);
 const second=await loadAdminData(db,{now:at,review:false});
 assert.equal(second.statsPending,undefined);assert.equal(second.counts.unlabelled,1);assert.equal(second.sources.find(s=>s.id==='coesfeld').count,1);
 /* Erster Tagesordnungstag und jüngster Sitzungstag je Gebiet; ohne Tagesordnung nur der Sitzungstag der Spalte */
 const bb=second.sources.find(s=>s.id==='billerbeck');assert.equal(bb.firstEventAt,'2026-08-01');assert.equal(bb.lastEventAt,'2026-09-20');
 assert.equal(second.sources.find(s=>s.id==='muenster').firstEventAt,null);assert.equal(second.sources.find(s=>s.id==='muenster').lastEventAt,'2026-09-20');
 /* Kennzahlen einer älteren Fassung gelten als veraltet und werden neu gezählt */
 sqlite.prepare("UPDATE region_stats SET stats=json_remove(stats,'$.v','$.firstEvent') WHERE region_id='billerbeck'").run();
 assert.equal((await loadAdminData(db,{now:at,review:false,statsBudgetMs:0})).statsPending,1);
 assert.equal((await loadAdminData(db,{now:at,review:false})).sources.find(s=>s.id==='billerbeck').firstEventAt,'2026-08-01');
 /* Ohne Migration 0011: der frühere Lauf über alle Berichte */
 const legacy={prepare(sql){if(/region_revisions|region_stats/.test(sql))return {bind(){return this;},async all(){throw Error('D1_ERROR: no such table: region_revisions');}};return db.prepare(sql);},batch:statements=>Promise.all(statements.map(s=>s.all()))};
 const old=await loadAdminData(legacy,{now:new Date('2026-09-28T12:00:00Z'),review:false});
 assert.equal(old.counts.online,3);assert.equal(old.counts.unlabelled,1);assert.equal(old.statsPending,undefined);
 assert.equal(old.sources.find(s=>s.id==='billerbeck').firstEventAt,'2026-08-01','the single scan carries the days too');
});

test('figures per area bind at most 100 parameters per statement, as D1 allows',async()=>{
 reset();const at=new Date('2026-09-27T12:00:00Z');
 for(let i=0;i<150;i++)insert('t'+i,{regionId:'area-'+String(i).padStart(3,'0')});
 // D1 refuses a statement with more than 100 bound parameters ("too many SQL variables"); node:sqlite allows 32766.
 const counted=[],strict={prepare(sql){const s=db.prepare(sql),bind=s.bind;s.bind=(...v)=>{counted.push(v.length);if(v.length>D1_MAX_PARAMETERS)throw Error('D1_ERROR: too many SQL variables');return bind.apply(s,v);};return s;},batch:statements=>db.batch(statements)};
 const data=await loadAdminData(strict,{now:at,review:false});
 assert.equal(data.statsPending,undefined);assert.equal(data.counts.online,150);
 assert.ok(Math.max(...counted)<=D1_MAX_PARAMETERS&&counted.some(n=>n===D1_MAX_PARAMETERS),'the chunks fill the limit and stay within it');
});
test('review filters stay parameterized, exclude aliases, constrain region and cap result rows',async()=>{
 reset();for(let i=0;i<30;i++)insert('open-'+i,{classification:{primary:'unklar'}});
 insert('elsewhere',{regionId:'muenster',classification:{primary:'unklar'},status:'unknown'});
 insert('alias',{classification:{primary:'unklar'},identity:{mergedInto:'open-1'}});
 const result=await adminReview(db,'labels','billerbeck');assert.equal(result.total,30);assert.equal(result.articles.length,25);assert.ok(result.articles.every(t=>t.regionId==='billerbeck'));
 assert.equal((await adminReview(db,'status')).total,1);
 // A total the caller already knows is taken as given; the list is still read.
 const known=await adminReview(db,'labels','all',{total:31});assert.equal(known.total,31);assert.equal(known.articles.length,25);
 await assert.rejects(adminReview(db,'labels',"' OR 1=1 --"));
});

test('review totals come from the figures per area; changed areas are counted exactly; no full scan over all areas',async()=>{
 reset();for(const t of ['region_stats','region_revisions'])sqlite.exec('DELETE FROM '+t);
 for(let i=0;i<4;i++)insert('lab-'+i,{classification:{primary:'unklar'}});
 insert('done',{classification:{primary:'bildung'}});insert('ms',{regionId:'muenster',classification:{primary:'unklar'}});
 const asked=[],watched={prepare(sql){asked.push(sql);return db.prepare(sql);},batch:statements=>db.batch(statements)};
 const scans=()=>asked.filter(q=>/FROM topics WHERE/.test(q)&&!/region_id IN|region_id=\?/.test(q)&&!/INDEXED BY/.test(q));
 /* Noch keine Kennzahlen: beide Gebiete werden einzeln gezählt, die Summe stimmt */
 assert.equal((await adminReview(watched,'labels','all')).total,5);
 await loadAdminData(db,{now:new Date('2026-09-27T12:00:00Z'),review:false});
 asked.length=0;
 const fresh=await adminReview(watched,'labels','all');
 assert.equal(fresh.total,5);assert.equal(fresh.articles.length,5);assert.deepEqual(scans(),[],'no scan of all reports');
 /* Ein Gebiet ändert sich nach der Berechnung: es wird exakt nachgezählt */
 insert('lab-new',{classification:{primary:'unklar'}});
 assert.equal((await adminReview(watched,'labels','all')).total,6);
 /* Kein Treffer: keine Listenabfrage */
 asked.length=0;
 assert.deepEqual(await adminReview(watched,'identity','all'),{issue:'identity',total:0,articles:[]});
 assert.ok(!asked.some(q=>/ORDER BY updated_at/.test(q)));
 /* Häufiger Grund über alle Gebiete: vom neuesten Vorgang an über den Index; seltener Grund: nur in seinen Gebieten */
 insert('open-status',{status:'unknown'});
 asked.length=0;assert.equal((await adminReview(watched,'status','all')).total,1);
 assert.ok(asked.some(q=>/INDEXED BY idx_topics_canonical_updated/.test(q)&&/ORDER BY updated_at DESC/.test(q)));
 asked.length=0;await adminReview(watched,'labels','all');
 assert.ok(asked.some(q=>/region_id IN \(\?,\?\)/.test(q)&&/ORDER BY updated_at DESC/.test(q)),'5 matches in two areas: read there');
});
test('CSV export neutralizes spreadsheet formulas and escapes delimiters and quotes',()=>{
 const csv=sourcesCsv([{name:'=HYPERLINK("x")',ags:'055',kind:'city',count:1,state:'Teilstand',issues:['note; "quoted"']}]);
 assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));assert.ok(csv.includes('note; ""quoted""'));assert.equal(csv.split('\r\n').length,2);
 // The access of programs is a column of its own.
 assert.ok(csv.split('\r\n')[0].includes('"Zugang"'));assert.ok(sourcesCsv([{name:'X',ags:'1',kind:'city',count:0,state:'Nicht angebunden',accessLabel:'robots.txt sperrt HTML-Zugriff',issues:[]}]).includes('"robots.txt sperrt HTML-Zugriff"'));
});

const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
globalThis.adminFixture={user:null,env:{DB:db,ADMIN_SETUP_HASH:hash},reads:0,syncs:0,analyses:0,prepared:0};
const stubs={
 '@/server/integrations/pipeline-jobs.mjs':'export async function pipelineAction(){globalThis.adminFixture.syncs++;return {status:"queued"};}',
 '@/server/integrations/ai-jobs.mjs':'export async function getAiJob(){globalThis.adminFixture.reads++;return null;} export async function createAiJob(){globalThis.adminFixture.analyses++;return {};} export async function applyAiResults(){globalThis.adminFixture.analyses++;return {};} export async function cancelAiJob(){globalThis.adminFixture.analyses++;return {};}',

 'server-only':'export {};',
 'cloudflare:workers':'export const env=globalThis.adminFixture.env;',
 '@/app/chatgpt-auth':'export async function getChatGPTUser(){return globalThis.adminFixture.user;}',
 '@/server/repositories/admin':'export async function getAdminDashboard(){globalThis.adminFixture.reads++;return {sources:[]};} export async function getAdminReview(){globalThis.adminFixture.reads++;return {};}',
 '@/server/integrations/database-transfer.mjs':'export async function exportRequest(){globalThis.adminFixture.reads++;return {status:200,data:{format:"ratsmonitor-data-v1"}};}',
 '@/server/integrations/manual-analysis.mjs':'export async function analysePending(){globalThis.adminFixture.analyses++;return {status:200,data:{processed:1,remaining:0}};}',
 '@/server/data/billerbeck-content-v1.json':'export default {};',
 '@/server/integrations/prepared-analysis.mjs':'export async function importPreparedAnalysis(){globalThis.adminFixture.prepared++;return {status:200,data:{processed:1,remaining:0}};}',
 '@/server/services/sync':'export async function runSync(){globalThis.adminFixture.syncs++;return {status:200,data:{topics:1}};}'
};
const cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);let s=fs.readFileSync(file,'utf8');if(file.endsWith('.json'))return uri('export default '+s+';');if(file.endsWith('.mjs'))return pathToFileURL(file).href;
 s=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/((?:from\s*|import\s*)['"])([^'"]+)(['"])/g,(m,pre,spec,post)=>{if(stubs[spec])return pre+uri(stubs[spec])+post;const base=spec.startsWith('@/')?path.join(root,spec.slice(2)):spec.startsWith('.')?path.resolve(path.dirname(file),spec):null;if(!base)return m;return pre+load([base,base+'.ts'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()))+post;});
 const out=uri(s);cache.set(file,out);return out;
}
const routes=Object.fromEntries(await Promise.all(['overview','review','export','import','claim','analyse','prepared-analysis','database','pipeline','ai-job'].map(async r=>[r,await import(load(path.join(root,'app/api/admin',r,'route.ts')))])));
const req=(route,body,headers={})=>new Request('https://site.example/api/admin/'+route,{method:body===undefined?'GET':'POST',headers:{origin:'https://site.example','content-type':'application/json',...headers},...(body===undefined?{}:{body})});
test('every data endpoint denies anonymous and other signed-in users before any reads or imports',async()=>{
 reset();await claimAdmin(db,owner,code,hash);globalThis.adminFixture.reads=0;globalThis.adminFixture.syncs=0;
 for(const [user,status] of [[null,401],[other,403]]){globalThis.adminFixture.user=user;for(const route of ['overview','review','export','import','analyse','prepared-analysis','database','pipeline','ai-job']){const response=['import','analyse','prepared-analysis','pipeline','ai-job'].includes(route)?await routes[route].POST(req(route,'{"region":"billerbeck"}')):await routes[route].GET(req(route));assert.equal(response.status,status,route);assert.match(response.headers.get('cache-control'),/no-store/);assert.ok(!(await response.text()).includes('sources'));}}
 assert.equal(globalThis.adminFixture.reads,0);assert.equal(globalThis.adminFixture.syncs,0);assert.equal(globalThis.adminFixture.prepared,0);
});
test('authorized APIs validate all inputs and keep import locked to configured territory identifiers',async()=>{
 globalThis.adminFixture.user=owner;
 assert.equal((await routes.overview.GET()).status,200);
 assert.equal((await routes.database.GET(req('database'))).status,200);assert.equal(routes.database.POST,undefined);
 for(const body of ['null','[]','{','{"region":"not-configured"}'])assert.equal((await routes.import.POST(req('import',body))).status,400);
 assert.equal((await routes.import.POST(req('import','{"region":"billerbeck"}',{origin:'https://evil.example'}))).status,403);
 assert.equal((await routes.import.POST(req('import','{"region":"billerbeck"}'))).status,200);
 assert.equal(globalThis.adminFixture.syncs,1);
 assert.equal((await routes.review.GET(req('review?issue=nope'))).status,400);
 assert.equal((await routes.export.GET(req('export?filter=nope'))).status,400);
 assert.equal((await routes.claim.POST(req('claim','null'))).status,400);
 const csv=await routes.export.GET(req('export'));assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);
});

test('manual analysis requires the owner and valid input; no GET and no automatic follow-up',async()=>{
 globalThis.adminFixture.user=owner;globalThis.adminFixture.analyses=0;
 assert.equal(routes.analyse.GET,undefined);
 for(const body of ['null','[]','{','{"region":"unknown","mode":"analysis"}','{"region":"all","mode":"summaries"}','{"region":"all","mode":"wrong"}'])assert.equal((await routes.analyse.POST(req('analyse',body))).status,400);
 assert.equal((await routes.analyse.POST(req('analyse','{"region":"all","mode":"analysis"}',{origin:'https://other.example'}))).status,403);
 assert.equal((await routes.analyse.POST(req('analyse','{"region":"muenster","mode":"summaries"}'))).status,409);
 assert.equal(globalThis.adminFixture.analyses,0);
 const result=await routes.analyse.POST(req('analyse','{"region":"all","mode":"analysis"}'));assert.equal(result.status,200);assert.equal(globalThis.adminFixture.analyses,1);
 assert.match(result.headers.get('cache-control'),/no-store/);
});
test('prepared content import requires a deliberate owner POST from the same origin',async()=>{
 globalThis.adminFixture.user=owner;globalThis.adminFixture.prepared=0;
 assert.equal(routes['prepared-analysis'].GET,undefined);
 assert.equal((await routes['prepared-analysis'].POST(req('prepared-analysis','{}',{origin:'https://evil.example'}))).status,403);
 assert.equal(globalThis.adminFixture.prepared,0);
 assert.equal((await routes['prepared-analysis'].POST(req('prepared-analysis','{}'))).status,200);
 assert.equal(globalThis.adminFixture.prepared,1);
});

test('pipeline and AI mutations require same origin, owner and JSON; GET does not process data',async()=>{
 globalThis.adminFixture.user=owner;
 assert.equal(routes.pipeline.GET,undefined);
 for(const route of ['pipeline','ai-job']){assert.equal((await routes[route].POST(req(route,'{}',{origin:'https://evil.example'}))).status,403);assert.equal((await routes[route].POST(req(route,'null'))).status,400);}
 const before=globalThis.adminFixture.analyses;assert.equal((await routes['ai-job'].GET(req('ai-job'))).status,200);assert.equal(globalThis.adminFixture.analyses,before);
 for(const offset of ['-1','1.5','abc'])assert.equal((await routes['ai-job'].GET(req('ai-job?offset='+offset))).status,400);
 assert.equal((await routes['ai-job'].POST(req('ai-job',JSON.stringify({action:'apply',result:{articles:Array(101).fill({id:'x'})}})))).status,400);
});
