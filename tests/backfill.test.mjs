// Lückenabruf (server/integrations/backfill.mjs): reihum über 12 Monate, Grenzen je Nacht und Anbieter, Runde für Runde
import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryDb} from './helpers/d1.mjs';
import {backfillNight,pickTonight,currentRound,roundOrder,backfillView,partialFirst} from '../server/integrations/backfill.mjs';
import {PROVIDER_AREAS} from '../server/integrations/pipeline-jobs.mjs';
import {parseArgs} from '../server/integrations/pipeline-worker.mjs';

const ok={status:200,data:{topics:1,coverage:{complete:true,issues:[]}}};
// sechs Gebiete eines großen Anbieters und vier einzelne
const many=PROVIDER_AREAS().get('ris-portal.de').slice(0,6),single=['billerbeck','coesfeld','nrw-05334002','nrw-05554004'];
const ids=[...many,...single];

test('Reihenfolge: wenige Berichte je Einwohner zuerst, ohne Zahl ganz vorn',()=>{
 const counts=new Map([['billerbeck',5000],['coesfeld',10]]);
 const order=roundOrder(['billerbeck','coesfeld','nrw-05334002'],counts);
 assert.deepEqual(order,['nrw-05334002','coesfeld','billerbeck']);
});

test('Nacht: höchstens so viele Gebiete und je Anbieter, Grenze der Anfragen, fortsetzbare bleiben, neue Runde am Ende',async()=>{
 const {sql,db}=memoryDb();
 const first=await pickTonight(db,{areas:6,perProvider:2,ids});
 assert.equal(first.picked.length,6);
 assert.equal(first.picked.filter(id=>many.includes(id)).length,2,'je Anbieter höchstens 2');
 assert.equal((await currentRound(db,{ids})).remaining.length,10,'Wählen allein erledigt nichts');
 // Nacht 1: Anfragegrenze für ris-portal.de schon erreicht, ein Gebiet endet fortsetzbar
 const counts=new Map([['ris-portal.de',3000]]),resumed=single[0];
 const calls=[];
 const night=await backfillNight(db,async(stage,region,window)=>{calls.push([region,window]);return region===resumed?{status:200,data:{...ok.data,resume:true}}:ok;},{areas:6,perProvider:2,requestCap:3000,counts,ids});
 assert.ok(calls.every(([r,w])=>w==='12m'&&!many.includes(r)),'12 Monate, gesperrter Anbieter nicht gefragt');
 assert.equal(night.done,3);assert.equal(night.kept,3,'zwei über der Grenze, eins fortsetzbar');assert.equal(night.remaining,7);
 const view=await backfillView(db);assert.equal(view.round,1);assert.equal(view.remaining,7);assert.equal(view.last.done,3);
 // weitere Nächte ohne Grenze, bis die Runde leer ist; dann beginnt Runde 2
 for(let i=0;i<6&&(await backfillView(db)).remaining>0;i++)await backfillNight(db,async()=>ok,{areas:6,perProvider:2,ids});
 assert.equal((await backfillView(db)).remaining,0);
 const next=await pickTonight(db,{areas:3,perProvider:2,ids});
 assert.equal(next.state.round,2);assert.equal(next.picked.length,3);
 sql.close();
});

test('Wartende Anbieter bleiben in der Runde; sind nur noch sie übrig, kommen sie in der nächsten Runde vorn',async()=>{
 const {sql,db}=memoryDb();
 const future=new Date(Date.now()+864e5).toISOString();
 sql.prepare("INSERT INTO source_hosts(host,state,fails,level,next_try_at,updated_at) VALUES('ris-portal.de','gesperrt',0,1,?,?)").run(future,future);
 const a=await backfillNight(db,async()=>ok,{areas:20,perProvider:10,ids});
 assert.equal(a.picked,4,'nur die einzelnen');assert.equal(a.remaining,6);
 const b=await pickTonight(db,{areas:20,perProvider:10,ids});
 assert.equal(b.state.round,2,'nur Wartende übrig: neue Runde');assert.deepEqual(b.state.remaining.slice(0,6).sort(),[...many].sort());
 assert.equal(b.picked.length,4);
 sql.close();
});

test('Schalter des Lückenabrufs',()=>{
 const o=parseArgs(['--create','sources','--window','1d','--backfill','300','--backfill-minutes','90']);
 assert.equal(o.backfill,300);assert.equal(o.backfillMinutes,90);assert.equal(o.backfillPerProvider,25);assert.equal(o.backfillCap,3000);
 assert.equal(parseArgs(['--create','sources']).backfill,0,'ohne Schalter kein Lückenabruf');
 assert.throws(()=>parseArgs(['--backfill','-1']),/--backfill/);
});

test('Teilstand zuerst: Gebiete, deren Zeitraum nie vollständig gelesen wurde, kommen in der laufenden Runde vorn',async()=>{
 assert.deepEqual(partialFirst(['a','b','c','d'],new Set(['c','a'])),['a','c','b','d']);
 const {sql,db}=memoryDb();
 const first=await currentRound(db,{ids:single});
 const last=first.remaining.at(-1),failed=first.remaining.at(-2);
 const put=(id,p)=>sql.prepare('INSERT INTO source_coverage(region_id,payload) VALUES(?,?)').run(id,JSON.stringify(p));
 put(last,{complete:false,attemptStatus:'completed',importedAt:'2026-10-23T23:00:00Z'});
 put(failed,{complete:false,attemptStatus:'failed',importedAt:'2026-10-23T23:00:00Z'});
 put(first.remaining[0],{complete:true,attemptStatus:'completed',importedAt:'2026-10-23T23:00:00Z'});
 const again=await currentRound(db,{ids:single});
 assert.equal(again.remaining[0],last,'Teilstand vorn');
 assert.equal(again.remaining.length,single.length);
 assert.equal(again.remaining.indexOf(failed),first.remaining.indexOf(failed)+1,'gescheiterte nicht vorgezogen');
 sql.close();
});
