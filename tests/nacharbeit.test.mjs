// Job „nacharbeit“ (scripts/nacharbeit.mjs): fällige Einträge je Schritt bündeln, ausführen, Ausgang auswerten
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {memoryDb} from './helpers/d1.mjs';
import {nacharbeit,planBatches,commandFor,STEP_ORDER,stepShare,runBrief} from '../scripts/nacharbeit.mjs';
import {DatabaseSync} from 'node:sqlite';
import {recordFailure,clearFailure} from '../server/integrations/work-failures.mjs';
import {JOBS,dueNow,nextRun,settingOf,inWindow} from '../server/integrations/schedules.mjs';

const T0=Date.parse('2026-10-15T08:00:00Z'),H=3600000;

test('planBatches keeps the step order: import, pdf, text, ocr, rules',()=>{
 const plan=planBatches([{step:'rules',key:'r'},{step:'pdf',key:'p'},{step:'import',key:'i'},{step:'ocr',key:'o'}]);
 assert.deepEqual([...plan.keys()],['import','pdf','ocr','rules']);
 assert.deepEqual(STEP_ORDER.slice(0,2),['import','pdf']);
});

test('commandFor builds the command of each step from the key file',()=>{
 const file=process.env.TEMP?process.env.TEMP+'/nacharbeit-keys.txt':'/tmp/nacharbeit-keys.txt';
 fs.writeFileSync(file,'billerbeck\ncoesfeld');
 assert.deepEqual(commandFor('import',file,{minutes:12.7})[1].slice(0,3),['--direct','--regions','billerbeck,coesfeld']);
 assert.deepEqual(commandFor('pdf',file,{minutes:5})[1].slice(0,2),['--urls',file]);
 assert.ok(commandFor('ocr-fetch',file,{minutes:5})[1].includes('--include-slow'));
 assert.deepEqual(commandFor('rules',file,{minutes:5}),['scripts/pdf-store/read-reports.mjs',['--ids',file]]);
 assert.equal(commandFor('unbekannt',file,{minutes:5}),null);
});

test('a run executes due steps; success clears, failure moves on, untouched entries wait an hour',async()=>{
 const {sql,db}=memoryDb();
 await recordFailure(db,{step:'pdf',key:'https://a.de/1.pdf',host:'a.de',error:'timeout',eventDate:'2026-10-14'},T0-2*H);
 await recordFailure(db,{step:'pdf',key:'https://a.de/2.pdf',host:'a.de',error:'timeout',eventDate:'2026-10-13'},T0-2*H);
 await recordFailure(db,{step:'pdf',key:'https://a.de/3.pdf',host:'a.de',error:'timeout',eventDate:'2026-10-12'},T0-2*H);
 await recordFailure(db,{step:'rules',key:'topic-9',cls:'internal',error:'TypeError',release:'old'},T0-2*H);
 await recordFailure(db,{step:'import',key:'billerbeck',error:'fetch failed'},T0-2*H);
 const calls=[];let clock=T0;
 // pdf: 1 gelingt, 2 scheitert erneut, 3 wird nicht angefasst; rules: gelingt
 const exec=async(script)=>{
  calls.push(script);
  if(script.endsWith('fetch.mjs')){clock+=60000;await clearFailure(db,{step:'pdf',key:'https://a.de/1.pdf'});await recordFailure(db,{step:'pdf',key:'https://a.de/2.pdf',host:'a.de',http:404},clock);}
  if(script.endsWith('read-reports.mjs'))await clearFailure(db,{step:'rules',key:'topic-9'});
  return 0;
 };
 const r=await nacharbeit({db,sql,exec,now:()=>clock,log:()=>{},hasImporter:false});
 assert.deepEqual(calls,['scripts/pdf-store/fetch.mjs','scripts/pdf-store/read-reports.mjs'],'import ohne gebauten Importprozess ausgelassen');
 const pdf=r.steps.find(s=>s.step==='pdf');
 assert.deepEqual([pdf.ok,pdf.final,pdf.untouched],[1,1,1]);
 assert.equal(r.steps.find(s=>s.step==='import').skipped,'kein Importprozess');
 assert.equal(r.totals.ok,2);
 const left=sql.prepare("SELECT next_try_at FROM work_failures WHERE key='https://a.de/3.pdf'").get();
 assert.equal(left.next_try_at,new Date(clock+H).toISOString(),'nicht versucht: eine Stunde weiter');
 sql.close();
});

test('schedules: nacharbeit and ocr only run inside their window',()=>{
 const job=JOBS.find(j=>j.id==='nacharbeit'),ocr=JOBS.find(j=>j.id==='ocr');
 assert.deepEqual(job.window,['09:00','23:00']);assert.equal(job.every,30);
 const s=settingOf(job,{});
 const at=(h,m=0)=>Date.parse(`2026-10-15T${String(h-2).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`);// MESZ = UTC+2
 assert.equal(inWindow(job,at(8,50)),false);assert.equal(inWindow(job,at(9,0)),true);assert.equal(inWindow(job,at(23,0)),false);
 assert.equal(dueNow(job,s,null,at(8,50)).due,false);
 assert.equal(dueNow(job,s,null,at(12)).due,true);
 assert.equal(dueNow(job,s,{lastStart:new Date(at(12)).toISOString()},at(12,20)).due,false);
 assert.equal(new Date(nextRun(job,s,null,at(23,30))).toISOString(),new Date(at(9)+864e5).toISOString(),'nach dem Fenster: morgen 09:00');
 assert.deepEqual(ocr.window,['07:00','23:00']);assert.equal(inWindow(ocr,at(6,50)),false);assert.equal(inWindow(ocr,at(22,59)),true);
});

test('Folgekette: gelingt ein Abruf, laufen für seine Gebiete gleich Extraktion und Regeln',async()=>{
 const {sql,db}=memoryDb();
 const now0=Date.parse('2026-10-15T08:00:00Z');
 sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run('t-neu','billerbeck','test','2026-10-14','2026-10-15T10:30:00Z','consulting',JSON.stringify({id:'t-neu',title:'Neu',documents:[],events:[],longSummary:[],sourceText:''}));
 await recordFailure(db,{step:'import',key:'billerbeck',error:'fetch failed'},now0);
 const calls=[];let clock=now0+2*H;
 const exec=async(script,args)=>{calls.push([script.split('/').pop(),args.slice(0,2).join(' ')]);if(script.endsWith('import-worker.mjs'))await clearFailure(db,{step:'import',key:'billerbeck'});return 0;};
 const r=await nacharbeit({db,sql,exec,now:()=>clock,log:()=>{},hasImporter:true,store:null});
 assert.deepEqual(calls.map(c=>c[0]),['import-worker.mjs','fetch.mjs','fetch.mjs','text.mjs','apply.mjs','read-reports.mjs']);
 assert.equal(calls[2][1],'--others --regions','Anlagen der abgerufenen Gebiete');
 assert.equal(r.readyForAi,1,'der geschriebene Bericht steht für die KI bereit');
 assert.deepEqual(r.followUp.map(f=>f.step),['PDF laden','Anlagen laden','Text lesen','Modell anwenden','Zusammenfassung und Fakten']);
 sql.close();
});

test('Altbestand: alte Fehler erst, dann rückwirkender Abruf in Paketen, fortsetzbar und anhaltbar',async()=>{
 const {altbestand,openRegions,REQUESTS_KEY}=await import('../scripts/altbestand.mjs');
 const {sql,db}=memoryDb();
 const state=new Map(),read=k=>state.get(k)??null,write=(k,v)=>state.set(k,v);
 const now0=Date.parse('2026-10-15T10:00:00Z');let clock=now0;
 await recordFailure(db,{step:'rules',key:'alt-1',cls:'transient',error:'x',eventDate:'2025-05-01'},now0-3*24*H);
 state.set(REQUESTS_KEY,{rework:{requestedAt:'x'},import:{regions:['a1','a2','a3'],window:'12m',requestedAt:'r1',done:[],failed:[]}});
 const calls=[];
 const exec=async(script,args)=>{calls.push(script.split('/').pop());clock+=60000;
  if(script.endsWith('read-reports.mjs'))await clearFailure(db,{step:'rules',key:'alt-1'});
  if(script.endsWith('import-worker.mjs')){const regions=args[args.indexOf('--regions')+1].split(',');if(regions.includes('a2'))await recordFailure(db,{step:'import',key:'a2',error:'fetch failed',origin:'backlog'},clock);}
  return 0;};
 const r=await altbestand({db,sql,exec,minutes:60,chunk:2,now:()=>clock,log:()=>{},read,write});
 assert.equal(r.rework.totals.ok,1,'alter Fehler erledigt');
 assert.ok(state.get(REQUESTS_KEY).rework.finishedAt,'nichts mehr fällig: fertig');
 const imp=state.get(REQUESTS_KEY).import;
 assert.deepEqual([...imp.done].sort(),['a1','a3']);assert.deepEqual(imp.failed,['a2']);assert.ok(imp.finishedAt);
 assert.equal(r.import.length,2,'zwei Pakete zu je 2 Gebieten');
 assert.deepEqual(openRegions({regions:['x','y'],done:['x'],failed:[]}),['y']);
 state.set(REQUESTS_KEY,{import:{regions:['b1'],window:'1m',requestedAt:'r2',done:[],failed:[],stoppedAt:'jetzt'}});
 const before=calls.length;await altbestand({db,sql,exec,minutes:60,now:()=>clock,log:()=>{},read,write});
 assert.equal(calls.length,before,'angehalten: nichts mehr');
 sql.close();
});

test('Verarbeitung: 08:50 ist nur der Rückfall; nach einem Lauf am selben Tag (von der Nachtkette angestoßen) nicht noch einmal',()=>{
 const job=JOBS.find(j=>j.id==='rule-texts'),s=settingOf(job,{});
 assert.equal(job.fallback,true);
 const at=(h,m=0)=>Date.parse('2026-10-17T00:00:00+02:00')+h*3600000+m*60000;// MESZ
 assert.equal(dueNow(job,s,{lastStart:new Date(at(6,34)).toISOString()},at(8,50)).due,false,'heute 06:34 gelaufen');
 assert.equal(dueNow(job,s,{lastStart:new Date(at(6,34)-864e5).toISOString()},at(8,50)).due,true,'gestern gelaufen, heute noch nicht');
 assert.equal(dueNow(job,s,null,at(8,50)).due,true);
 assert.equal(dueNow(job,s,{lastStart:new Date(at(8,50)).toISOString()},at(9,0)).due,false);
 const backup=JOBS.find(j=>j.id==='backup'),b=settingOf(backup,{});
 assert.equal(dueNow(backup,b,{lastStart:new Date(at(0,10)).toISOString()},at(0,30)).due,true,'ohne fallback wie bisher: Lauf vor der Uhrzeit zählt nicht');
});

test('Zeitanteil je Schritt: verbleibende Zeit gleichmäßig auf die offenen Schritte, mindestens 3 Minuten, der letzte bekommt den Rest',()=>{
 assert.equal(stepShare(20,3),20/3);
 assert.equal(stepShare(20,1),20);
 assert.equal(stepShare(5,4),3,'mindestens 3 Minuten');
 assert.equal(stepShare(2,4),2,'nie mehr als übrig');
});

test('Nacharbeit: der erste Schritt bekommt nur seinen Anteil; OCR auf wartenden Servern ruht bis zum Server; Kurzfassung für den Verlauf',async()=>{
 const {sql,db}=memoryDb();
 await recordFailure(db,{step:'import',key:'billerbeck',error:'fetch failed'},T0-2*H);
 await recordFailure(db,{step:'pdf',key:'https://a.de/1.pdf',host:'a.de',error:'timeout',eventDate:'2026-10-14'},T0-2*H);
 await recordFailure(db,{step:'ocr',key:'sha-wartet',cls:'slow',error:'Zeitgrenze je Seite (90 s)'},T0-2*H);
 const later=new Date(T0+3*86400000).toISOString();
 sql.prepare("INSERT INTO source_hosts(host,state,fails,level,next_try_at,updated_at) VALUES('b.de','bremsen',3,4,?,?)").run(later,new Date(T0).toISOString());
 const store=new DatabaseSync(':memory:');
 store.exec("CREATE TABLE pdfs(url TEXT,sha256 TEXT,status TEXT,topic_id TEXT);CREATE TABLE texts(sha256 TEXT,ocr_needed INTEGER)");
 store.prepare("INSERT INTO pdfs VALUES('https://b.de/x.pdf','sha-wartet','text-only',NULL)").run();
 let clock=T0;const minutes=[];
 const exec=async(script,args)=>{const i=args.indexOf('--max-minutes');if(i>=0)minutes.push([script.split('/').pop(),Number(args[i+1])]);clock+=60000;return 0;};
 const r=await nacharbeit({db,sql,store,exec,now:()=>clock,log:()=>{},hasImporter:true,minutes:21,includeSlow:true});
 assert.deepEqual(minutes.map(m=>m[0]),['import-worker.mjs','fetch.mjs','text.mjs']);
 assert.ok(minutes[0][1]<=7,`Abruf bekommt ein Drittel, nicht alles: ${minutes[0][1]}`);
 const ocr=sql.prepare("SELECT next_try_at FROM work_failures WHERE key='sha-wartet'").get();
 assert.equal(ocr.next_try_at,later,'ruht bis der Server wieder darf, nicht eine Stunde');
 assert.equal(r.steps.find(s=>s.step==='ocr').parked,1);
 const brief=runBrief(r);
 assert.equal(brief.steps.length,3);assert.deepEqual(Object.keys(brief.steps[0]).sort(),['again','entries','final','ok','step','untouched']);
 sql.close();store.close();
});
