// Fehlerspeicher und Serverstufe (server/integrations/work-failures.mjs, Migration 0040)
import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryDb} from './helpers/d1.mjs';
import {classify,nextTry,recordFailure,clearFailure,dueEntries,hostStates,hostWaiting,hostDue,hostRow,failureCounts,reopen,releaseHost,hasFailureStore,SAMPLE} from '../server/integrations/work-failures.mjs';

const H=3600000,D=24*H,T0=Date.parse('2026-10-15T08:00:00Z');
const at=ms=>new Date(T0+ms).toISOString();

test('classify maps causes to classes',()=>{
 assert.equal(classify({http:429}),'blocked');
 assert.equal(classify({refused:true}),'blocked');
 assert.equal(classify({http:503}),'blocked');
 assert.equal(classify({http:403}),'denied');
 assert.equal(classify({http:404}),'gone');
 assert.equal(classify({status:'unsupported'}),'gone');
 assert.equal(classify({error:'Dokument zu groß'}),'gone');
 assert.equal(classify({changed:true}),'gone');
 assert.equal(classify({error:'The operation was aborted due to timeout'}),'transient');
 assert.equal(classify({http:502}),'transient');
 assert.equal(classify({error:'getaddrinfo ENOTFOUND x'}),'transient');
 assert.equal(classify({slow:true}),'slow');
 assert.equal(classify({http:409}),'busy');
 assert.equal(classify({error:'database is locked'}),'busy');
 assert.equal(classify({internal:true,error:'TypeError: x is undefined'}),'internal');
});

test('nextTry follows the ladder per class and ends',()=>{
 assert.equal(nextTry('transient',1,{now:T0}),at(H));
 assert.equal(nextTry('transient',2,{now:T0}),at(6*H));
 assert.equal(nextTry('transient',4,{now:T0}),at(3*D));
 assert.equal(nextTry('transient',5,{now:T0}),at(7*D),'danach wöchentlich, nie endgültig');
 assert.equal(nextTry('transient',9,{now:T0}),at(7*D));
 assert.equal(nextTry('denied',1,{now:T0}),at(7*D));
 assert.equal(nextTry('denied',3,{now:T0}),at(30*D),'danach monatlich');
 assert.equal(nextTry('gone',1,{now:T0}),null);
 assert.equal(nextTry('internal',1,{now:T0}),null);
 assert.equal(nextTry('slow',1,{now:T0}),at(0));
 assert.equal(nextTry('slow',2,{now:T0}),null);
 assert.equal(nextTry('busy',3,{now:T0}),at(10*60000));
 assert.equal(nextTry('blocked',1,{now:T0,hostNext:at(4*H)}),at(4*H));
});

test('a server goes to bremsen after three transient failures, 429 at once, and success resets it',async()=>{
 const {sql,db}=memoryDb();
 assert.equal(await hasFailureStore(db),true);
 for(let i=0;i<2;i++)await recordFailure(db,{step:'pdf',key:'u'+i,host:'a.de',http:500},T0);
 assert.equal((await hostRow(db,'a.de')).state,'ok');
 await recordFailure(db,{step:'pdf',key:'u2',host:'a.de',http:500},T0);
 let h=await hostRow(db,'a.de');
 assert.equal(h.state,'bremsen');assert.equal(h.next_try_at,at(H));
 assert.equal(hostWaiting(h,T0+30*60000),true);assert.equal(hostDue(h,T0+H),true);
 // further failures in the same wait only count
 await recordFailure(db,{step:'pdf',key:'u3',host:'a.de',http:500},T0+60000);
 assert.equal((await hostRow(db,'a.de')).next_try_at,at(H));
 // 429 puts a fresh server to bremsen at once, Retry-After wins when longer
 const r=await recordFailure(db,{step:'import',key:'gebiet',host:'b.de',http:429,retryAfterMs:2*H},T0);
 assert.equal(r.class,'blocked');assert.equal(r.next_try_at,at(2*H));
 // sample after the wait: SAMPLE failures put it one level up
 await recordFailure(db,{step:'pdf',key:'u4',host:'a.de',http:500},T0+H);
 await recordFailure(db,{step:'pdf',key:'u5',host:'a.de',http:500},T0+H);
 assert.equal((await hostRow(db,'a.de')).next_try_at,at(H),'two sample failures do not escalate yet');
 await recordFailure(db,{step:'pdf',key:'u6',host:'a.de',http:500},T0+H);
 assert.equal((await hostRow(db,'a.de')).next_try_at,at(H+4*H));
 await clearFailure(db,{step:'pdf',key:'u4',host:'a.de'},T0+6*H);
 h=await hostRow(db,'a.de');assert.equal(h.state,'ok');assert.equal(h.fails,0);assert.equal(h.level,0);
 sql.close();
});

test('denied servers lock for 7 and 30 days, then wait for a check',async()=>{
 const {sql,db}=memoryDb();
 for(let i=0;i<3;i++)await recordFailure(db,{step:'pdf',key:'d'+i,host:'c.de',http:403},T0);
 let h=await hostRow(db,'c.de');assert.equal(h.state,'gesperrt');assert.equal(h.next_try_at,at(7*D));
 for(let i=0;i<3;i++)await recordFailure(db,{step:'pdf',key:'d'+i,host:'c.de',http:403},T0+7*D);
 h=await hostRow(db,'c.de');assert.equal(h.next_try_at,at(7*D+30*D));
 for(let i=0;i<3;i++)await recordFailure(db,{step:'pdf',key:'d'+i,host:'c.de',http:403},T0+37*D);
 h=await hostRow(db,'c.de');assert.equal(h.state,'pruefen');assert.equal(h.next_try_at,at(37*D+30*D),'prüfen: trotzdem alle 30 Tage eine Stichprobe');
 assert.equal(hostWaiting(h,T0+40*D),true);assert.equal(hostDue(h,T0+70*D),true);
 await releaseHost(db,'c.de',T0+38*D);
 assert.equal(hostDue(await hostRow(db,'c.de'),T0+38*D),true);
 sql.close();
});

test('entries count tries, keep first_at and daily origin, and end',async()=>{
 const {sql,db}=memoryDb();
 const f={step:'pdf',key:'https://x.de/1.pdf',host:'x.de',error:'timeout',eventDate:'2026-10-14',origin:'backlog'};
 await recordFailure(db,f,T0);
 await recordFailure(db,{...f,origin:'daily'},T0+H);
 await recordFailure(db,{...f,origin:'backlog'},T0+2*H);
 let row=sql.prepare('SELECT * FROM work_failures').get();
 assert.equal(row.tries,3);assert.equal(row.first_at,at(0));assert.equal(row.origin,'daily');assert.equal(row.next_try_at,at(2*H+D));
 await recordFailure(db,{...f,http:404,error:'HTTP 404'},T0+3*H);
 row=sql.prepare('SELECT * FROM work_failures').get();
 assert.equal(row.class,'gone');assert.equal(row.next_try_at,null);
 await clearFailure(db,{step:'pdf',key:f.key});
 assert.equal(sql.prepare('SELECT count(*) n FROM work_failures').get().n,0);
 sql.close();
});

test('dueEntries: frische Einträge vor chronischen (wenigste Versuche zuerst) bei gleichem Sitzungstag',async()=>{
 const {sql,db}=memoryDb();
 for(let i=0;i<3;i++)await recordFailure(db,{step:'pdf',key:'chronisch',host:'x.de',error:'timeout',eventDate:'2026-10-14'},T0-i*H);
 await recordFailure(db,{step:'pdf',key:'frisch',host:'y.de',error:'timeout',eventDate:'2026-10-14'},T0);
 const due=await dueEntries(db,{now:T0+2*D,range:'all'});
 assert.deepEqual(due.map(r=>r.key),['frisch','chronisch']);
 sql.close();
});

test('dueEntries (range all): newest first, waiting servers skipped, sample cap, internal after a new release',async()=>{
 const {sql,db}=memoryDb();
 await recordFailure(db,{step:'pdf',key:'old',host:'ok.de',error:'timeout',eventDate:'2026-01-01'},T0);
 await recordFailure(db,{step:'pdf',key:'new',host:'ok.de',error:'timeout',eventDate:'2026-10-01'},T0);
 await recordFailure(db,{step:'pdf',key:'bl',host:'ok2.de',error:'timeout',eventDate:'2026-10-10',origin:'backlog'},T0);
 for(let i=0;i<6;i++)await recordFailure(db,{step:'pdf',key:'w'+i,host:'wait.de',http:500,eventDate:'2026-10-0'+(i+1)},T0);
 await recordFailure(db,{step:'rules',key:'topic-1',cls:'internal',error:'TypeError',release:'aaa'},T0);
 await recordFailure(db,{step:'ocr',key:'sha1',cls:'slow'},T0);
 // after one hour: wait.de is due for a sample, its entries are due too
 const due=await dueEntries(db,{now:T0+H+1,release:'aaa',range:'all'});
 assert.deepEqual(due.map(r=>r.key).filter(k=>!k.startsWith('w')),['bl','new','old']);
 assert.equal(due.filter(r=>r.host==='wait.de').length,SAMPLE);
 assert.equal(due.some(r=>r.key==='topic-1'),false,'internal waits for a new release');
 assert.equal(due.some(r=>r.key==='sha1'),false,'slow only in the backlog window');
 const later=await dueEntries(db,{now:T0+H+1,release:'bbb',includeSlow:true,steps:['rules','ocr'],range:'all'});
 assert.deepEqual(later.map(r=>r.key).sort(),['sha1','topic-1']);
 // within the wait the server is skipped entirely
 assert.equal((await dueEntries(db,{now:T0+30*60000,release:'aaa',range:'all'})).length,0);
 assert.equal((await hostStates(db)).has('wait.de'),true);
 const c=await failureCounts(db,T0+H+1);assert.ok(c.rows.length>0);assert.equal(c.hosts.bremsen,1);
 assert.equal(await reopen(db,{step:'rules'},T0),1);
 sql.close();
});

test('without migration 0040 everything is a no-op',async()=>{
 const {sql,db}=memoryDb({skip:f=>f.startsWith('0040')});
 assert.equal(await recordFailure(db,{step:'pdf',key:'k',http:500}),null);
 assert.deepEqual(await dueEntries(db),[]);
 assert.deepEqual(await failureCounts(db),{missing:'0040'});
 sql.close();
});

test('pipeline debug page only reads, never the reports; actions release and reopen',async()=>{
 const {pipelineDebug,pipelineDebugAction}=await import('../server/integrations/pipeline-debug.mjs');
 const {sql,db}=memoryDb();
 await recordFailure(db,{step:'pdf',key:'https://z.de/1.pdf',host:'z.de',http:429},T0);
 await recordFailure(db,{step:'rules',key:'t1',cls:'internal',error:'TypeError',release:'r1'},T0);
 sql.prepare("INSERT INTO system_state(key,value) VALUES('schedule-log',?)").run(JSON.stringify([{job:'backup',start:at(0),end:at(60000),seconds:60,result:'ok',exit:0,trigger:'plan'}]));
 const asked=[],readOnly={prepare(q){asked.push(q);if(/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q))throw Error('write from a page: '+q.slice(0,60));return db.prepare(q);}};
 const d=await pipelineDebug(readOnly,T0+H);
 assert.equal(d.log.length,1);assert.equal(d.hosts[0].host,'z.de');assert.equal(d.hosts[0].entries,1);assert.equal(d.internal[0].key,'t1');
 assert.ok(!asked.some(q=>/FROM topics\b/.test(q)),'never reads the reports');
 await pipelineDebugAction(db,{action:'release',host:'z.de'},T0+2*H);
 assert.equal((await hostRow(db,'z.de')).next_try_at,at(2*H));
 assert.equal((await pipelineDebugAction(db,{action:'reopen',cls:'internal'},T0+2*H)).reopened,1);
 await assert.rejects(pipelineDebugAction(db,{action:'reopen'}),/angeben/);
 sql.close();
});

test('Tagesbereich und Altbestand: Grenze 12.10.2026 bzw. 7 Tage, Altfehler und Herkunft backlog nie im Tagesbereich',async()=>{
 const {dailyBoundary,inDailyRange,DAILY_SINCE}=await import('../server/integrations/work-failures.mjs');
 assert.equal(DAILY_SINCE,'2026-10-12');
 assert.equal(dailyBoundary(Date.parse('2026-10-15T08:00:00Z')),'2026-10-12','vor dem 19.10. gilt der Stichtag');
 assert.equal(dailyBoundary(Date.parse('2026-10-30T08:00:00Z')),'2026-10-23','danach 7 Tage zurück');
 const now=Date.parse('2026-10-15T08:00:00Z');
 assert.equal(inDailyRange('2026-10-13','2026-10-14T00:00:00Z',now),true);
 assert.equal(inDailyRange('2026-10-20','2026-10-14T00:00:00Z',now),true,'künftige Sitzung');
 assert.equal(inDailyRange('2026-10-05','2026-10-14T00:00:00Z',now),false,'Sitzung älter als der Tagesbereich');
 assert.equal(inDailyRange('2026-10-14','2026-10-11T00:00:00Z',now),false,'Fehler von vor dem 12.10.');
 const {sql,db}=memoryDb();
 await recordFailure(db,{step:'pdf',key:'neu',host:'a.de',error:'timeout',eventDate:'2026-10-14'},now);
 await recordFailure(db,{step:'pdf',key:'alt',host:'a.de',error:'timeout',eventDate:'2026-09-01'},now);
 await recordFailure(db,{step:'pdf',key:'bestand',host:'b.de',error:'timeout',eventDate:'2026-10-14',origin:'backlog'},now);
 await recordFailure(db,{step:'import',key:'gebiet',host:'c.de',error:'fetch failed'},now);
 const later=now+2*H;
 assert.deepEqual((await dueEntries(db,{now:later})).map(r=>r.key).sort(),['gebiet','neu'],'automatisch nur der Tagesbereich');
 assert.deepEqual((await dueEntries(db,{now:later,range:'backlog'})).map(r=>r.key).sort(),['alt','bestand']);
 assert.equal((await dueEntries(db,{now:later}))[0].step,'import','Abruf vor Extraktion');
 const c=await failureCounts(db,later);
 assert.equal(c.boundary,'2026-10-12');
 assert.deepEqual(c.rows.filter(r=>r.range==='daily').map(r=>r.phase).sort(),['abruf','extraktion']);
 await recordFailure(db,{step:'pdf',key:'weg',host:'d.de',http:404,eventDate:'2026-09-01'},now);
 assert.equal(await reopen(db,{range:'backlog',phase:'extraktion',cls:'gone'},later),1);
 assert.equal(await reopen(db,{range:'daily',phase:'verarbeitung'},later),0);
 sql.close();
});
