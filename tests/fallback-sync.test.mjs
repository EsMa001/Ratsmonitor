// runSync mit Ausweichquelle (fallback-source.mjs): Gerüst wie identity-repository.test.mjs, collectRegion als Attrappe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
import {fallbackOf,primaryServer,fallbackServer} from '../server/integrations/fallback-source.mjs';
import {windowStart} from '../server/integrations/history-window.mjs';
const root=path.resolve(import.meta.dirname,'..');
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
globalThis.fallbackFixture={env:{DB:{prepare(sql){let args=[];return {bind(...v){args=v;return this;},async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;},async run(){db.prepare(sql).run(...args);return {success:true};}};},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.all());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}},fresh:null,options:null};
const stubs={
 'server-only':'export {};',
 'cloudflare:workers':'export const env=globalThis.fallbackFixture.env;',
 '@/server/repositories/seed':'export async function ensureData(){}',
 './seed':'export async function ensureData(){}',
 '@/server/integrations/collect-region.mjs':'export async function collectRegion(id,options){globalThis.fallbackFixture.options=options;return globalThis.fallbackFixture.fresh;}'
};
const cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);let code=fs.readFileSync(file,'utf8');if(file.endsWith('.json'))return uri('export default '+code+';');
 if(file.endsWith('.mjs'))return pathToFileURL(file).href;
 code=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 code=code.replace(/((?:from\s*|import\s*)['"])([^'"]+)(['"])/g,(m,pre,spec,post)=>{if(stubs[spec])return pre+uri(stubs[spec])+post;const base=spec.startsWith('@/')?path.join(root,spec.slice(2)):spec.startsWith('.')?path.resolve(path.dirname(file),spec):null;if(!base)return m;const found=[base,base+'.ts',base+'.tsx'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());return pre+load(found)+post;});
 const result=uri(code);cache.set(file,result);return result;
}
const sync=await import(load(path.join(root,'server/services/sync.ts')));
// Ein Gebiet, dessen Website in einer anderen Servergruppe liegt als das System (der Test setzt die Wartestufe der Gruppe).
const area=NRW_SOURCES.find(s=>fallbackOf(s)&&!String(fallbackServer(s)).startsWith('host:')),region=area.id;
const topic=(id,eventDate,extra={})=>({id,regionId:region,source:'city',sourceUrl:'https://x.example/'+id,officialTitle:'Punkt '+id,title:'Punkt '+id,shortSummary:'Quelle',longSummary:['Quelle'],generatedBy:'Quellenüberblick',reference:'',status:'scheduled',eventDate,updatedAt:eventDate,events:[{date:eventDate,committee:'Gemeindevertretung',status:'scheduled',description:'',url:'https://x.example/s/'+eventDate}],documents:[],sourceText:'',...extra});
const coverage=(extra={})=>({regionId:region,importedAt:new Date().toISOString(),from:'2026-10-01',to:'2026-10-27',complete:true,issues:[],...extra});
const stored=()=>new Map(db.prepare('SELECT id,payload FROM topics WHERE region_id=?').all(region).map(r=>[r.id,JSON.parse(r.payload)]));
const savedCoverage=()=>JSON.parse(db.prepare('SELECT payload FROM source_coverage WHERE region_id=?').get(region).payload);

test('runSync: Ausweichzeit beginnt, wenn der Anbieter wartet, trennt Sitzungstage und endet mit dem nächsten Abruf des Systems',async()=>{
 // Bestand des Ratsinformationssystems bis zum letzten Erfolg am 10.10.
 const ris=topic('ris-1','2026-10-14');
 db.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run(ris.id,region,ris.source,ris.eventDate,ris.updatedAt,ris.status,JSON.stringify(ris));
 db.prepare('INSERT INTO source_coverage(region_id,payload) VALUES(?,?)').run(region,JSON.stringify(coverage({lastSuccessAt:'2026-10-10T00:14:00.000Z',importedAt:'2026-10-10T00:14:00.000Z'})));
 // ohne wartenden Anbieter: das System wird gefragt, wie bisher (und scheitert; der letzte Erfolg bleibt am 10.10.)
 globalThis.fallbackFixture.fresh={topics:[],coverage:coverage({complete:false,issues:['Sitzungskalender: fetch failed']})};
 await sync.runSync('metadata',region,'manual',{window:'1d'});
 assert.equal(globalThis.fallbackFixture.options.fallback,undefined);
 // der Anbieter wartet: die Website wird gelesen, Zeitraum reicht bis zum letzten Erfolg zurück
 db.prepare("INSERT INTO source_hosts(host,state,fails,level,next_try_at,updated_at) VALUES(?,'bremsen',0,6,'2099-01-01T00:00:00.000Z',?)").run(primaryServer(area),new Date().toISOString());
 globalThis.fallbackFixture.fresh={topics:[topic('web-1','2026-10-14'),topic('web-2','2026-10-21'),topic('web-0','2026-10-02')],coverage:coverage({method:'scraper',fallback:{server:fallbackServer(area),primary:primaryServer(area)}})};
 const r=await sync.runSync('metadata',region,'manual',{window:'1d'});
 assert.equal(r.status,200);
 const o=globalThis.fallbackFixture.options;
 assert.deepEqual(o.fallback.since,'2026-10-10');assert.equal(o.window,'1m');assert.equal(o.marks.list,undefined,'keine Sitzungsliste des Systems');
 assert.deepEqual(r.data.fallback,{server:fallbackServer(area)});
 let s=stored();
 assert.ok(s.has('web-2')&&s.get('web-2').viaFallback,'neuer Sitzungstag aus der Website');
 assert.ok(!s.has('web-1'),'Tag des Systems nicht doppelt');assert.ok(!s.has('web-0'),'vor dem letzten Erfolg nicht');
 assert.equal(savedCoverage().fallback.active,true);assert.equal(savedCoverage().fallback.since,'2026-10-10');
 // Stichprobe beim Anbieter scheitert (nichts gelesen): die Ausweichzeit läuft weiter, ihr Beginn bleibt
 db.prepare('DELETE FROM source_hosts').run();
 globalThis.fallbackFixture.fresh={topics:[],coverage:coverage({complete:false,issues:['Sitzungskalender: fetch failed']})};
 await sync.runSync('metadata',region,'manual',{window:'1d'});
 assert.equal(savedCoverage().fallback.active,true);assert.equal(savedCoverage().fallback.since,'2026-10-10');
 // der Anbieter antwortet wieder: das System gilt, ohne neue Berichte an Tagen der Website
 globalThis.fallbackFixture.fresh={topics:[topic('ris-2','2026-10-21'),topic('ris-3','2026-10-28')],coverage:coverage()};
 const back=await sync.runSync('metadata',region,'manual',{window:'1d'});
 assert.equal(back.data.fallback,undefined);assert.equal(globalThis.fallbackFixture.options.fallback,undefined);
 s=stored();
 assert.ok(s.has('ris-3')&&!s.has('ris-2'),'Tag der Website bleibt bei ihr');assert.ok(s.has('web-2'),'nichts gelöscht');
 assert.equal(savedCoverage().fallback.active,false);assert.ok(savedCoverage().fallback.endedAt);
});

test('runSync: System seit 7 Tagen ohne Erfolg, Servergruppe nicht wartend: der Versuch wird vermerkt, dann liest die Website 12 Monate',async()=>{
 const area2=NRW_SOURCES.find(s=>s.id!==region&&fallbackOf(s)&&!String(fallbackServer(s)).startsWith('host:')),r2=area2.id;
 const topic2=(id,d)=>({...topic(id,d),regionId:r2}),cov2=()=>JSON.parse(db.prepare('SELECT payload FROM source_coverage WHERE region_id=?').get(r2).payload);
 const stored2=()=>new Map(db.prepare('SELECT id,payload FROM topics WHERE region_id=?').all(r2).map(r=>[r.id,JSON.parse(r.payload)]));
 db.prepare('DELETE FROM source_hosts').run();
 // 1. Nie geliefert, kein Vermerk: das System wird gefragt und liefert nichts (Netzfehler nur als Hinweis)
 globalThis.fallbackFixture.fresh={topics:[],coverage:{...coverage({complete:false,issues:['Kalender 11/2026: fetch failed']}),regionId:r2}};
 await sync.runSync('metadata',r2,'manual',{window:'1d'});
 assert.equal(globalThis.fallbackFixture.options.fallback,undefined,'zuerst das System');
 assert.ok(cov2().fallback?.probedAt,'Versuch vermerkt');assert.notEqual(cov2().fallback?.active,true);
 // 2. Nächster Abruf: die Website gilt, 12 Monate zurück; Ältere Sitzungen bleiben weg
 const since=windowStart(new Date(),'12m').toISOString().slice(0,10);
 globalThis.fallbackFixture.fresh={topics:[topic2('web-9','2026-06-01'),topic2('web-old','2020-01-01')],coverage:{...coverage({method:'scraper',fallback:{server:fallbackServer(area2),primary:primaryServer(area2)}}),regionId:r2}};
 const r=await sync.runSync('metadata',r2,'manual',{window:'1d'});
 assert.equal(r.status,200);
 const o=globalThis.fallbackFixture.options;
 assert.equal(o.fallback.since,since,'nie geliefert: 12 Monate zurück');assert.equal(o.window,'12m');
 let s=stored2();
 assert.ok(s.has('web-9')&&s.get('web-9').viaFallback);assert.ok(!s.has('web-old'),'vor since nicht');
 assert.equal(cov2().fallback.active,true);assert.equal(cov2().fallback.since,since);assert.ok(cov2().fallback.probedAt,'Vermerk bleibt');
 // 3. Der Vermerk ist älter als 7 Tage: das System wird wieder gefragt; liefert es, endet die Ausweichzeit und der Vermerk geht
 const old=cov2();old.fallback.probedAt='2026-01-01T00:00:00.000Z';
 db.prepare('UPDATE source_coverage SET payload=? WHERE region_id=?').run(JSON.stringify(old),r2);
 globalThis.fallbackFixture.fresh={topics:[topic2('ris-9','2026-10-20')],coverage:{...coverage(),regionId:r2}};
 const back=await sync.runSync('metadata',r2,'manual',{window:'1d'});
 assert.equal(back.status,200);assert.equal(globalThis.fallbackFixture.options.fallback,undefined,'Stichprobe beim System');
 s=stored2();assert.ok(s.has('ris-9'));assert.ok(s.has('web-9'),'nichts gelöscht');
 assert.equal(cov2().fallback.active,false);assert.ok(cov2().fallback.endedAt);assert.equal(cov2().fallback.probedAt,undefined);
});
