// Admin-Reiter „PDF-Import“, „Jobs & Zeitpläne“, „Speicher & Sicherungen“: Wünsche ablegen und lesen
// (server/integrations/pdf-store-admin.mjs, schedules.mjs, server-storage.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {pdfStoreState,requestPdfJob,removePdfJob,requestStop,requestCount,errorsCsv,normalizeJobs,STATS_KEY,JOB_KEY,HEARTBEAT_KEY,PROGRESS_KEYS,ERRORS_KEY,QUEUE_MAX} from '../server/integrations/pdf-store-admin.mjs';
import {JOBS,settingOf,dueNow,nextRun,slotAt,setSchedule,runScheduleNow,schedulesState} from '../server/integrations/schedules.mjs';
import {diskDue,storageState,requestDiskCount} from '../server/integrations/server-storage.mjs';

const fresh=()=>{const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE system_state(key TEXT PRIMARY KEY,value TEXT)');return {sql,db:sqliteAdapter(sql)};};

test('Aufträge: Reihe, gleiche Art nicht doppelt hintereinander, Entfernen, Obergrenze, unbekannte Arten abgelehnt',async()=>{
 const {sql,db}=fresh();
 const s0=await pdfStoreState(db);
 assert.deepEqual(s0.jobs,{queue:[],current:null,recent:[]});assert.equal(s0.worker,false);
 sql.prepare('INSERT INTO system_state VALUES(?,?)').run(STATS_KEY,JSON.stringify({linked:10,loaded:4}));
 const a=await requestPdfJob(db,'retry');assert.equal(a.created,true);
 const b=await requestPdfJob(db,'retry');assert.equal(b.created,false);assert.equal(b.jobs.queue.length,1);
 const c=await requestPdfJob(db,'others');assert.equal(c.created,true);assert.deepEqual(c.jobs.queue.map(j=>j.kind),['retry','others']);
 await assert.rejects(requestPdfJob(db,'delete'),/Unbekannter Auftrag/);
 const r=await removePdfJob(db,c.jobs.queue[0].id);assert.deepEqual(r.jobs.queue.map(j=>j.kind),['others']);
 for(const k of ['run','retry','run','retry'])await requestPdfJob(db,k);
 await assert.rejects(requestPdfJob(db,'others'),new RegExp(`${QUEUE_MAX} Aufträge`));
 await removePdfJob(db,(await pdfStoreState(db)).jobs.queue.at(-1).id);
 assert.equal((await requestPdfJob(db,'texts')).jobs.queue.at(-1).kind,'texts','Auftrag „Texte erstellen“');
 await removePdfJob(db,(await pdfStoreState(db)).jobs.queue.at(-1).id);
 assert.equal((await requestPdfJob(db,'ocr')).jobs.queue.at(-1).kind,'ocr','Auftrag „OCR starten“');
 assert.equal((await pdfStoreState(db)).stats.linked,10);
});

test('Aufträge: frühere Form wird übernommen, verwaister laufender Auftrag gilt als veraltet',async()=>{
 assert.deepEqual(normalizeJobs({kind:'others',state:'waiting',requestedAt:'x'}).queue.map(j=>j.kind),['others']);
 assert.equal(normalizeJobs({kind:'run',state:'done',requestedAt:'x'}).recent.length,1);
 const {sql,db}=fresh(),old=new Date(Date.now()-3600000).toISOString();
 sql.prepare('INSERT INTO system_state VALUES(?,?)').run(JOB_KEY,JSON.stringify({queue:[],current:{id:'a',kind:'run',state:'running',startedAt:old,updatedAt:old},recent:[]}));
 assert.equal((await pdfStoreState(db)).jobs.current.state,'stale');
});

test('Anhalten, neu zählen, Fortschritt und Lebenszeichen nur frisch, Fehlerliste aus Stücken',async()=>{
 const {sql,db}=fresh(),now=Date.now(),iso=t=>new Date(t).toISOString();
 await assert.rejects(requestStop(db,'alles'));
 assert.ok((await requestStop(db,'chain')).stop.chain.requestedAt);
 assert.ok((await requestCount(db)).count.requestedAt);
 sql.prepare('INSERT INTO system_state VALUES(?,?)').run(PROGRESS_KEYS.chain,JSON.stringify({step:'Laden',at:iso(now-60000)}));
 sql.prepare('INSERT INTO system_state VALUES(?,?)').run(PROGRESS_KEYS.ocr,JSON.stringify({step:'OCR',at:iso(now-10*60000)}));
 sql.prepare('INSERT INTO system_state VALUES(?,?)').run(HEARTBEAT_KEY,JSON.stringify({at:iso(now-5*60000)}));
 const s=await pdfStoreState(db,now);
 assert.equal(s.progress.chain.step,'Laden');assert.equal(s.progress.ocr,null);assert.equal(s.worker,true);assert.ok(s.stop.chain);assert.ok(s.count);
 assert.equal(await errorsCsv(db),null);
 const b64=gzipSync('url;grund\na;b\n').toString('base64');
 sql.prepare('INSERT INTO system_state VALUES(?,?)').run(ERRORS_KEY+':1',b64.slice(10));
 sql.prepare('INSERT INTO system_state VALUES(?,?)').run(ERRORS_KEY+':0',b64.slice(0,10));
 assert.equal(await errorsCsv(db),'url;grund\na;b\n');
});

test('Zeitplan: deutsche Uhrzeit, fällig einmal je Tag, nachgeholt bis 3 Stunden, Abstand bei laufenden Jobs',()=>{
 const t=Date.parse('2026-10-12T08:00:00Z');
 assert.equal(new Date(slotAt(t,'05:30')).toISOString(),'2026-10-12T03:30:00.000Z');
 assert.equal(new Date(slotAt(Date.parse('2026-12-01T12:00:00Z'),'01:00')).toISOString(),'2026-12-01T00:00:00.000Z');
 const pdf=JOBS.find(j=>j.id==='pdf-nightly'),s=settingOf(pdf,{});
 assert.deepEqual(s,{enabled:true,time:'05:30'});
 assert.equal(dueNow(pdf,s,{lastStart:'2026-10-11T03:30:00Z'},Date.parse('2026-10-12T03:30:30Z')).due,true);
 assert.equal(dueNow(pdf,s,{lastStart:'2026-10-12T03:30:30Z'},Date.parse('2026-10-12T03:40:00Z')).due,false);
 assert.equal(dueNow(pdf,s,{lastStart:'2026-10-11T03:30:00Z'},Date.parse('2026-10-12T07:00:00Z')).due,false,'mehr als 3 Stunden zu spät');
 assert.equal(dueNow(pdf,s,{},Date.parse('2026-10-12T03:20:00Z')).due,false,'noch nicht Zeit');
 assert.equal(new Date(nextRun(pdf,s,{lastStart:'2026-10-12T03:30:30Z'},Date.parse('2026-10-12T04:00:00Z'))).toISOString(),'2026-10-13T03:30:00.000Z');
 assert.equal(nextRun(pdf,{...s,enabled:false},{},Date.now()),null);
 const imp=JOBS.find(j=>j.id==='import'),si=settingOf(imp,{import:{every:30}});
 assert.equal(dueNow(imp,si,{lastStart:new Date(Date.now()-20*60000).toISOString()}).due,false);
 assert.equal(dueNow(imp,si,{lastStart:new Date(Date.now()-30*60000).toISOString()}).due,true);
 // Ungültige gespeicherte Werte fallen auf den Standard zurück
 assert.deepEqual(settingOf(pdf,{'pdf-nightly':{time:'5 Uhr',enabled:false}}),{enabled:false,time:'05:30'});
});

test('Zeitplan: Einstellung ändern nur gültig, jetzt ausführen, Zustand ohne Befehle',async()=>{
 const {db}=fresh();
 await assert.rejects(setSchedule(db,'pdf-nightly',{time:'05:35'}),/10-Minuten/);
 await assert.rejects(setSchedule(db,'import',{time:'05:30'}));
 await assert.rejects(setSchedule(db,'pdf-nightly',{every:10}));
 await assert.rejects(setSchedule(db,'gibtsnicht',{enabled:false}));
 assert.deepEqual((await setSchedule(db,'pdf-nightly',{time:'06:10'})).setting,{enabled:true,time:'06:10'});
 assert.deepEqual((await setSchedule(db,'pdf-nightly',{enabled:false})).setting,{enabled:false,time:'06:10'});
 assert.ok((await runScheduleNow(db,'backup')).requestedAt);
 const s=await schedulesState(db);
 const p=s.jobs.find(j=>j.id==='pdf-nightly');assert.equal(p.setting.time,'06:10');assert.equal(p.next,null);assert.equal(p.cmd,undefined,'Befehle gehen nicht an die Seite');
 assert.ok(s.jobs.find(j=>j.id==='backup').now);assert.equal(s.managed,false);
});

test('Speicher: messen stündlich, Tabellen täglich oder auf Wunsch',async()=>{
 const now=Date.parse('2026-10-12T12:00:00Z'),iso=t=>new Date(t).toISOString();
 assert.deepEqual(diskDue(null,null,now),{run:true,tables:true,asked:false});
 const disk={at:iso(now-30*60000),tables:{at:iso(now-3600000)}};
 assert.deepEqual(diskDue(disk,null,now),{run:false,tables:false,asked:false});
 assert.deepEqual(diskDue({...disk,at:iso(now-2*3600000)},null,now),{run:true,tables:false,asked:false});
 assert.deepEqual(diskDue(disk,{requestedAt:iso(now),tables:true},now),{run:true,tables:true,asked:true});
 assert.deepEqual(diskDue(disk,{requestedAt:iso(now),tables:true,startedAt:iso(now)},now),{run:false,tables:false,asked:false});
 const {db}=fresh();
 await requestDiskCount(db,true);
 const s=await storageState(db);assert.equal(s.count.tables,true);assert.equal(s.disk,null);assert.equal(s.worker,false);
});
