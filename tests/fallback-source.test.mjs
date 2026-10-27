import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryDb} from './helpers/d1.mjs';
import {fallbackOf,fallbackActive,fallbackPlan,primaryServer,fallbackServer,keepFallbackTopics,keepPrimaryTopics,fallbackState,meetingDays} from '../server/integrations/fallback-source.mjs';
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
import {collectRegion} from '../server/integrations/collect-region.mjs';
import {deferredRegions} from '../server/integrations/pipeline-worker.mjs';
import {noteImport,provider} from '../server/integrations/pipeline-jobs.mjs';
import {recordFailure} from '../server/integrations/work-failures.mjs';

// Ausweichquelle (fallback-source.mjs, 26.10.2026): Website der Kommune, solange der Anbieter des Ratsinformationssystems wartet.
const source={id:'de-x',name:'Stadt X',kind:'city',method:'scraper',adapter:'sdnet-rim4',base:'https://rim.ekom21.de/x/',
 fallback:{base:'https://www.x-stadt.de/',pages:['https://www.x-stadt.de/rathaus/bekanntmachungen/'],verifiedAt:'2026-10-26'}};
const waiting=host=>({host,state:'bremsen',level:6,next_try_at:'2099-01-01T00:00:00.000Z'});
const hosts=(...waits)=>new Map(waits.map(h=>[h,waiting(h)]));
const day=d=>({id:'t-'+d+Math.random(),eventDate:d,events:[{date:d,committee:'Rat',status:'scheduled',description:'',url:''}]});

test('fallbackOf: Quelle der Website mit Gebiet und Leser; ohne Seiten keine',()=>{
 const f=fallbackOf(source);
 assert.equal(f.id,'de-x');assert.equal(f.adapter,'website');assert.equal(f.method,'scraper');assert.deepEqual(f.pages,source.fallback.pages);
 assert.equal(fallbackOf({...source,fallback:{base:'https://www.x-stadt.de/',pages:[]}}),null);
 assert.equal(fallbackOf({...source,fallback:undefined}),null);
 assert.notEqual(primaryServer(source),fallbackServer(source));
});

test('fallbackActive: nur wenn der Anbieter wartet und die Website nicht',()=>{
 const p=primaryServer(source),w=fallbackServer(source);
 assert.equal(fallbackActive(source,hosts(p)),true);
 assert.equal(fallbackActive(source,hosts()),false,'Anbieter erreichbar: das System gilt');
 assert.equal(fallbackActive(source,hosts(p,w)),false,'Website wartet auch');
 assert.equal(fallbackActive({...source,fallback:undefined},hosts(p)),false,'ohne Ausweichquelle');
 const due={host:p,state:'bremsen',level:6,next_try_at:'2000-01-01T00:00:00.000Z'};
 assert.equal(fallbackActive(source,new Map([[p,due]])),false,'Stichprobe fällig: das System wird gefragt');
});

test('fallbackPlan: Beginn am Tag des letzten Erfolgs, erster Abruf reicht bis dahin, danach bis zum letzten Abruf',()=>{
 const now=new Date('2026-10-27T01:00:00Z'),h=hosts(primaryServer(source));
 const first=fallbackPlan(source,{hosts:h,coverage:{lastSuccessAt:'2026-10-10T00:14:00Z'},window:'1d',now});
 assert.equal(first.since,'2026-10-10');assert.equal(first.window,'1m');assert.equal(first.server,fallbackServer(source));
 const state=fallbackState(undefined,first,'2026-10-26T01:00:00Z');
 const next=fallbackPlan(source,{hosts:h,coverage:{lastSuccessAt:'2026-10-26T01:00:00Z',fallback:state},window:'1d',now});
 assert.equal(next.since,'2026-10-10','Beginn bleibt');assert.equal(next.window,'1w');
 assert.equal(fallbackPlan(source,{hosts:hosts(),coverage:{},window:'1d',now}),null);
 assert.equal(fallbackPlan(source,{hosts:h,coverage:{lastSuccessAt:'2025-01-01T00:00:00Z'},window:'1d',now}).window,'12m','höchstens 12 Monate');
});

test('ein Sitzungstag, eine Quelle: Ausweichquelle ab since und nicht an Tagen des Systems, danach umgekehrt',()=>{
 const ris=[day('2026-10-08'),day('2026-10-14')],old=new Map(ris.map(t=>[t.id,t]));
 const site=[day('2026-10-02'),day('2026-10-14'),day('2026-10-20')];
 const kept=keepFallbackTopics(site,old,'2026-10-10');
 assert.deepEqual(kept.map(t=>t.eventDate),['2026-10-20'],'vor since und am Tag des Systems nicht');
 assert.equal(kept[0].viaFallback,true);
 const stored=new Map([...old,...kept.map(t=>[t.id,t])]);
 assert.equal(keepFallbackTopics([{...kept[0],title:'neu'}],stored,'2026-10-10').length,1,'gespeicherter Bericht wird aktualisiert');
 // das System antwortet wieder: kein neuer Bericht an einem Tag der Ausweichquelle, alles andere und Aktualisierungen schon
 const back=keepPrimaryTopics([day('2026-10-20'),day('2026-10-28'),{...ris[0],title:'geändert'}],stored);
 assert.deepEqual(back.map(t=>t.eventDate),['2026-10-28','2026-10-08']);
 assert.deepEqual(keepPrimaryTopics(site,old),site,'ohne Ausweichzeit unverändert');
 assert.deepEqual(meetingDays({eventDate:'2026-10-01',events:[{date:'2026-09-01T18:00'}]}),['2026-10-01','2026-09-01']);
});

test('fallbackState: aktiv mit Plan, beendet nach einem Abruf des Systems',()=>{
 const plan={since:'2026-10-10',server:'x-stadt.de',primary:'rim.ekom21.de'};
 const a=fallbackState(undefined,plan,'2026-10-26T01:00:00Z');
 assert.deepEqual({...a},{active:true,since:'2026-10-10',server:'x-stadt.de',primary:'rim.ekom21.de',lastRunAt:'2026-10-26T01:00:00Z',startedAt:'2026-10-26T01:00:00Z'});
 assert.equal(fallbackState(a,plan,'2026-10-27T01:00:00Z').startedAt,'2026-10-26T01:00:00Z');
 assert.equal(fallbackState(a,null,'2026-10-28T01:00:00Z',false),a,'gescheiterte Stichprobe beim Anbieter beendet nichts');
 const ended=fallbackState(a,null,'2026-11-02T01:00:00Z');
 assert.equal(ended.active,false);assert.equal(ended.endedAt,'2026-11-02T01:00:00Z');assert.equal(ended.since,'2026-10-10');
 assert.equal(fallbackState(ended,null,'2026-11-03T01:00:00Z').endedAt,'2026-11-02T01:00:00Z','bleibt als Vermerk');
 assert.equal(fallbackState(undefined,null,'x'),undefined);
});

// Gebiet des Katalogs mit Ausweichquelle (ekom21, 26.10.2026). Nicht der erste Eintrag mit dem Feld, sondern einer, dessen Website in
// einer anderen Servergruppe liegt als das System; nur so eine wird je aktiv (fallbackActive).
const area=NRW_SOURCES.find(s=>fallbackOf(s)&&primaryServer(s)!==fallbackServer(s));

test('Katalog: jede Ausweichquelle ist gültig und liegt in einer anderen Servergruppe als das System',()=>{
 const entries=NRW_SOURCES.filter(s=>s.fallback);
 assert.ok(entries.length>0,'Katalog hat Ausweichquellen');
 assert.deepEqual(entries.filter(s=>!fallbackOf(s)).map(s=>s.id),[],'Ausweichquelle ohne base oder pages');
 // Dieselbe Servergruppe (Domain oder IP, source-servers.mjs): wartet das System, wartet auch die Website; fallbackActive wäre nie wahr.
 assert.deepEqual(entries.filter(s=>primaryServer(s)===fallbackServer(s)).map(s=>`${s.id} (${primaryServer(s)})`),[],'Website in der Servergruppe des Systems: die Ausweichquelle würde nie aktiv');
});

test('collectRegion mit fallback liest nur die Website, nie das System',async()=>{
 assert.ok(area,'Katalog hat ein Gebiet mit Ausweichquelle');
 const asked=[];
 const get=async url=>{asked.push(String(url));return '<html><body><h1>Bekanntmachungen</h1></body></html>';};
 const trace={wrap:()=>get};
 const d=await collectRegion(area.id,{window:'1d',trace,fallback:{server:fallbackServer(area),primary:primaryServer(area)}});
 assert.ok(asked.length>0);
 const site=new URL(area.fallback.base).hostname.replace(/^www\./,'');
 assert.ok(asked.every(u=>!u.includes(new URL(area.base||area.system).hostname)),'keine Anfrage an das System');
 assert.ok(asked.some(u=>new URL(u).hostname.endsWith(site)));
 assert.deepEqual(d.coverage.fallback,{server:fallbackServer(area),primary:primaryServer(area)});
 assert.equal(d.coverage.regionId,area.id);
});

test('Nachtauftrag und Fehlerspeicher: wartet nur der Anbieter, ruft der Abruf die Website ab und vermerkt sie bei ihr',async()=>{
 const {sql,db}=memoryDb();
 const id=area.id,primary=provider(id),site=fallbackServer(area);
 // der Anbieter war nicht erreichbar: Gebiet und Servergruppe warten
 for(let i=0;i<3;i++)await recordFailure(db,{step:'import',key:id,host:primary,cls:'transient',error:'fetch failed',provider:true});
 assert.equal(sql.prepare('SELECT state FROM source_hosts WHERE host=?').get(primary).state,'bremsen');
 assert.deepEqual(Object.keys(await deferredRegions(db,[id])),[],'nicht zurückgestellt: die Website ist erreichbar');
 // Erfolg über die Ausweichquelle: Eintrag weg, der Anbieter wartet weiter
 await noteImport(db,id,{result:{status:200,data:{topics:4,coverage:{complete:true,issues:[]},requests:{sent:3,failed:0},fallback:{server:site}}}});
 assert.equal(sql.prepare('SELECT count(*) n FROM work_failures WHERE key=?').get(id).n,0);
 assert.equal(sql.prepare('SELECT state FROM source_hosts WHERE host=?').get(primary).state,'bremsen');
 // Fehler der Website: vermerkt bei ihr; mit eigenem Termin wird das Gebiet zurückgestellt
 await noteImport(db,id,{result:{status:502,data:{error:'Import fehlgeschlagen',cause:'HTTP 500',fallback:{server:site}}}});
 assert.equal(sql.prepare('SELECT host FROM work_failures WHERE key=?').get(id).host,site);
 assert.deepEqual(Object.keys(await deferredRegions(db,[id])),[id]);
 // wartet auch die Website, gilt die Rückstellung des Anbieters wie bisher
 sql.prepare('DELETE FROM work_failures').run();
 for(let i=0;i<3;i++)await recordFailure(db,{step:'import',key:'probe-'+i,host:site,cls:'transient',error:'fetch failed',provider:true});
 assert.deepEqual(Object.keys(await deferredRegions(db,[id])),[id]);
 sql.close();
});
