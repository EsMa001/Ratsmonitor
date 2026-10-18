// Nacharbeit (Job „nacharbeit“, requirements/betriebsplan-konzept.md, Abschnitt 4): fällige Einträge des Fehlerspeichers
// (work_failures, Migration 0040) erneut versuchen. Automatisch nur der Tagesbereich (Sitzungen der letzten 7 Tage, frühestens
// 12.10.2026; dailyBoundary in work-failures.mjs): alle 30 Minuten zwischen 09:00 und 23:00 Uhr, höchstens --minutes (20) je Lauf,
// höchstens 500 Einträge, je Server 20 (ein fälliger Server erst eine Stichprobe von 3). Den Altbestand bearbeitet dieselbe
// Funktion mit range 'backlog', aber nur auf Knopfdruck (scripts/altbestand.mjs, Seite „Altbestand“).
//
// Drei Stufen, in dieser Reihenfolge (Begriffe: shared/pipeline-terms.mjs), je Schritt dieselbe Funktion wie in der Tagespipeline:
//   Abruf        import     → import-worker.mjs --direct --regions … (Fenster nach dem ersten Fehlschlag, mindestens 1 Woche)
//   Extraktion   pdf        → fetch.mjs --urls …
//                text       → text.mjs --shas …
//                ocr, ocr-fetch → text.mjs --ocr --shas …
//   Verarbeitung rules      → read-reports.mjs --ids …
// Folgekette: Gelingt ein Abruf, laufen für die Berichte, die er geschrieben hat, gleich Extraktion (PDF laden, Anlagen laden, Text
// lesen, OCR) und Verarbeitung (Regeln anwenden). Gelingt eine Extraktion, laufen die Regeln für die betroffenen Berichte. Die KI
// startet nicht von selbst (keine automatische Modell-API, CLAUDE.md); das Protokoll nennt, wie viele Berichte für sie bereitstehen.
// Jeder Schritt vermerkt Erfolg (Eintrag weg) und Fehler (Klasse, tries+1, next_try_at) selbst. Einträge, die der Schritt nicht
// anfassen konnte (Server wartet, Adresse ohne Bericht, Zeitgrenze), rücken eine Stunde weiter. Ergebnis in system_state
// 'nacharbeit-last' bzw. 'altbestand-rework-last'. Die Bahn „Laden“ der PDF-Ablage wird belegt (nightly.lock); hält sie ein
// Bestandsauftrag oder die Nachtkette, lässt der Lauf aus.
//
//   node scripts/nacharbeit.mjs [--range daily|backlog] [--minutes 20] [--limit 500] [--per-host 20] [--steps pdf,text] [--include-slow] [--dry-run]
// Umgebung: DATABASE_FILE, RM_PDF_STORE.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from './ai-job.mjs';
import {databaseFile,writeState} from './pdf-store/state.mjs';
import {DEFAULT_PDF_STORE} from '../server/node/pdf-store.mjs';
import {LANE_LOCKS} from '../server/integrations/pdf-store-admin.mjs';
import {dueEntries,hasFailureStore,phaseOf,hostStates,hostWaiting} from '../server/integrations/work-failures.mjs';
import {stepName} from '../shared/pipeline-terms.mjs';

export const NACHARBEIT_KEY='nacharbeit-last',BACKLOG_REWORK_KEY='altbestand-rework-last';
/** Verlauf der Läufe (Tagesbereich), neueste zuerst, für Nachtbericht und Debug-Seite: Wirkung über den Tag statt nur der letzte Lauf */
export const NACHARBEIT_LOG_KEY='nacharbeit-log',NACHARBEIT_LOG_MAX=96;
/** Kurzfassung eines Laufs für den Verlauf */
export const runBrief=r=>({at:r.startedAt,due:r.due,result:r.result,
 steps:r.steps.map(s=>({step:s.step,entries:s.entries,ok:s.ok||0,again:s.again||0,final:s.final||0,untouched:s.untouched||0,...(s.skipped?{skipped:s.skipped}:{})}))});
/**
 * Zeitanteil eines Schritts: die verbleibende Zeit gleichmäßig auf die noch offenen Schritte, mindestens 3 Minuten. Vorher nahm
 * der erste Schritt alles (18.10.2026: 500 Abrufe füllten den ganzen Lauf, PDF und OCR kamen erst eine halbe Stunde später).
 */
export const stepShare=(left,stepsLeft)=>stepsLeft<=1?left:Math.min(left,Math.max(3,left/stepsLeft));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
/** Reihenfolge der Schritte: Abruf, dann Extraktion, dann Verarbeitung */
export const STEP_ORDER=['import','pdf','text','ocr-fetch','ocr','rules'];

/** Fällige Einträge nach Schritt bündeln: Map step → [Einträge] in STEP_ORDER */
export function planBatches(entries){
 const by=new Map(STEP_ORDER.map(s=>[s,[]]));
 for(const e of entries)(by.get(e.step)||by.set(e.step,[]).get(e.step)).push(e);
 return new Map([...by].filter(([,list])=>list.length));
}

/** Abruffenster für einen erneuten Abruf: seit dem ersten Fehlschlag, mindestens eine Woche */
export function windowSince(firstAt,now=Date.now()){
 const days=(now-Date.parse(firstAt||new Date(now).toISOString()))/864e5;
 return days<=6?'1w':days<=30?'1m':days<=90?'3m':days<=365?'12m':'24m';
}
const WIDTH={'1w':0,'1m':1,'3m':2,'12m':3,'24m':4};

/** Befehl je Schritt: [script, args] mit der Liste der Schlüssel in `file` */
export function commandFor(step,file,{minutes,budgetGb=80,window='1w',origin='daily'}){
 const m=String(Math.max(1,Math.floor(minutes)));
 if(step==='import')return ['dist/standalone/worker/import-worker.mjs',['--direct','--regions',fs.readFileSync(file,'utf8').split(/\s+/).filter(Boolean).join(','),'--window',window,'--origin',origin,'--no-catch-up','--max-minutes',m]];
 if(step==='pdf')return ['scripts/pdf-store/fetch.mjs',['--urls',file,'--origin',origin,'--budget-gb',String(budgetGb),'--max-minutes',m]];
 if(step==='text')return ['scripts/pdf-store/text.mjs',['--shas',file,'--origin',origin,'--max-minutes',m]];
 // zu langsame Dateien (slow) bekommen hier ihren zweiten Versuch mit 15 Minuten je Datei
 if(step==='ocr'||step==='ocr-fetch')return ['scripts/pdf-store/text.mjs',['--ocr','--include-slow','--shas',file,'--origin',origin,'--workers','2','--file-minutes','15','--max-minutes',m]];
 if(step==='rules')return ['scripts/pdf-store/read-reports.mjs',['--ids',file]];
 return null;
}

/* Kindprozess mit derselben Umgebung; Rückgabe Exit-Code */
function runNode(script,args){
 return new Promise(resolve=>{
  const child=spawn(process.execPath,['--no-warnings','--max-old-space-size=4096',path.join(root,script),...args],{cwd:root,stdio:'inherit',env:process.env});
  child.on('error',()=>resolve(127));child.on('exit',(c,s)=>resolve(c??s));
 });
}

/**
 * Folgekette für Berichte: Extraktion (PDF laden, Anlagen laden, Text lesen, OCR der neuen Dateien) und Verarbeitung (Regeln
 * anwenden). Entweder für Gebiete (regions) und alles, was seit `since` geschrieben wurde (nach einem gelungenen Abruf), oder für
 * Berichte (topicIds, nach einer gelungenen Extraktion; dann nur Regeln). Rückgabe: Liste {step, code}.
 */
export async function followUp({sql,store,exec=runNode,tmp,regions=null,since=null,topicIds=null,left,origin='daily',budgetGb=80,log=()=>{}}){
 const out=[],m=()=>String(Math.max(1,Math.floor(left())));
 let ids=topicIds?[...new Set(topicIds)]:[];
 if(regions?.length&&since){
  const t0=new Date().toISOString();
  const rf=path.join(tmp,'follow-regions.txt');fs.writeFileSync(rf,regions.join(','));
  for(const [id,extra] of [['pdf',[]],['others',['--others']]]){
   if(left()<1)break;
   out.push({step:stepName(id),code:await exec('scripts/pdf-store/fetch.mjs',[...extra,'--regions',regions.join(','),'--since-updated',since,'--origin',origin,'--budget-gb',String(budgetGb),'--max-minutes',m()])});
  }
  if(left()>=1)out.push({step:stepName('text'),code:await exec('scripts/pdf-store/text.mjs',['--origin',origin,'--max-minutes',m()])});
  if(store&&left()>=1){
   const shas=store.prepare("SELECT DISTINCT t.sha256 AS sha FROM texts t JOIN pdfs p ON p.sha256=t.sha256 WHERE t.ocr_needed>0 AND t.made_at>=? AND p.region_id IN (SELECT value FROM json_each(?))").all(t0,JSON.stringify(regions)).map(r=>r.sha);
   if(shas.length){const sf=path.join(tmp,'follow-shas.txt');fs.writeFileSync(sf,shas.join('\n'));out.push({step:stepName('ocr'),code:await exec('scripts/pdf-store/text.mjs',['--ocr','--shas',sf,'--origin',origin,'--workers','2','--file-minutes','5','--max-minutes',m()])});}
  }
  ids=[...ids,...sql.prepare('SELECT id FROM topics WHERE region_id IN (SELECT value FROM json_each(?)) AND updated_at>=? AND active=1').all(JSON.stringify(regions),since).map(r=>r.id)];
 }
 if(ids.length&&left()>=0.5){
  const idf=path.join(tmp,'follow-ids.txt');fs.writeFileSync(idf,[...new Set(ids)].join('\n'));
  out.push({step:stepName('rules'),reports:new Set(ids).size,code:await exec('scripts/pdf-store/read-reports.mjs',['--ids',idf])});
 }
 log(`Folgeschritte: ${out.map(s=>`${s.step} (${s.code})`).join(', ')||'keine'}`);
 return {steps:out,reports:new Set(ids).size};
}

/**
 * Ein Lauf. db: D1-artig (sqliteAdapter), sql: node:sqlite derselben Datei. exec(script,args) startet einen Schritt (Standard:
 * Kindprozess); store: Index der Ablage (Folgeschritte), optional. range: 'daily' (automatisch) oder 'backlog' (Altbestand).
 * Rückgabe: Protokoll des Laufs.
 */
export async function nacharbeit({db,sql,exec=runNode,store=null,minutes=20,limit=500,perHost=20,steps=null,includeSlow=false,range='daily',now=Date.now,dry=false,log=console.log,
 hasImporter=fs.existsSync(path.join(root,'dist/standalone/worker/import-worker.mjs')),chain=true}={}){
 const t0=now(),deadline=t0+minutes*60000,left=()=>(deadline-now())/60000;
 const origin=range==='backlog'?'backlog':'daily';
 const due=await dueEntries(db,{now:t0,limit,perHost,steps,includeSlow,range});
 const plan=planBatches(due),report={range,startedAt:new Date(t0).toISOString(),due:due.length,steps:[],followUp:[],result:'done'};
 log(`${range==='backlog'?'Altbestand':'Tagesbereich'}: ${due.length} fällige Einträge: ${[...plan].map(([s,l])=>`${stepName(s)} ${l.length}`).join(', ')||'keine'}`);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'nacharbeit-'));
 const look=sql.prepare('SELECT last_at,next_try_at FROM work_failures WHERE step=? AND key=?');
 // OCR-Einträge, deren Dateien nur auf wartenden Servern liegen (verdrängt, müssten nachgeladen werden): nicht jede Stunde
 // „nicht versucht“, sondern bis der erste Server wieder darf
 const hosts=store?await hostStates(db):new Map();
 const waitUntil=e=>{
  if(!store||(e.step!=='ocr'&&e.step!=='ocr-fetch'))return null;
  const rows=store.prepare("SELECT url,status FROM pdfs WHERE sha256=? AND status IN ('ok','text-only')").all(e.key);
  if(!rows.length||rows.some(r=>r.status==='ok'))return null;
  const states=rows.map(r=>{try{return hosts.get(new URL(r.url).host);}catch{return null;}});
  if(!states.every(h=>hostWaiting(h,t0)))return null;
  const next=states.map(h=>h.next_try_at).filter(Boolean).sort()[0];
  return next||null;
 };
 const batches=[...plan];
 try{
  for(const [i,[step,list]] of batches.entries()){
   const name=stepName(step),phase=phaseOf(step);
   const share=stepShare(left(),batches.length-i),stepEnd=now()+share*60000,stepLeft=()=>Math.min(left(),(stepEnd-now())/60000);
   if(left()<1){log(`${name}: keine Zeit mehr, im nächsten Lauf`);report.steps.push({step,name,phase,entries:list.length,skipped:'Zeit'});continue;}
   if(step==='import'&&!hasImporter){log(`${name}: Importprozess nicht gebaut (node scripts/build-node.mjs), ausgelassen`);report.steps.push({step,name,phase,entries:list.length,skipped:'kein Importprozess'});continue;}
   const file=path.join(tmp,step+'.txt');fs.writeFileSync(file,list.map(e=>e.key).join('\n'));
   // Ein Abruf holt so weit zurück, wie der älteste Fehlschlag der Gruppe liegt
   const window=step==='import'?list.map(e=>windowSince(e.first_at,t0)).sort((a,b)=>WIDTH[b]-WIDTH[a])[0]:'1w';
   const cmd=commandFor(step,file,{minutes:stepLeft(),window,origin});
   if(!cmd)continue;
   const began=now(),beganIso=new Date(began).toISOString();
   log(`${name}: ${list.length} Einträge …`);
   const code=dry?0:await exec(cmd[0],cmd[1]);
   // Ausgang je Eintrag: weg (gelungen), verschoben (neuer Fehler), unberührt (nicht versucht → eine Stunde weiter)
   const out={step,name,phase,entries:list.length,exit:code,seconds:Math.round((now()-began)/1000),ok:0,again:0,final:0,untouched:0};
   const later=new Date(now()+3600000).toISOString(),okKeys=[];
   for(const e of list){
    const r=look.get(e.step,e.key);
    if(!r){out.ok++;okKeys.push(e.key);}
    else if(r.last_at!==e.last_at){if(r.next_try_at)out.again++;else out.final++;}
    else{
     out.untouched++;
     const until=waitUntil(e);if(until)out.parked=(out.parked||0)+1;
     if(!dry)sql.prepare('UPDATE work_failures SET next_try_at=? WHERE step=? AND key=? AND last_at=?').run(until&&until>later?until:later,e.step,e.key,e.last_at);
    }
   }
   log(`${name}: ${out.ok} gelungen, ${out.again} wieder verschoben, ${out.final} endgültig, ${out.untouched} nicht versucht (eine Stunde weiter${out.parked?`; ${out.parked} davon bis ihr Server wieder darf`:''})`);
   report.steps.push(out);
   if(code!==0&&code!==1)report.result='failed';
   // Folgekette: nach gelungenem Abruf Extraktion und Verarbeitung der geschriebenen Berichte; nach gelungener Extraktion Regeln
   if(chain&&!dry&&okKeys.length&&left()>=1){
    let f=null;
    if(step==='import')f=await followUp({sql,store,exec,tmp,regions:okKeys,since:beganIso,left,origin,log});
    else if(step!=='rules'&&store){
     const q=step==='pdf'?"SELECT DISTINCT topic_id AS id FROM pdfs WHERE url=? AND topic_id IS NOT NULL":"SELECT DISTINCT topic_id AS id FROM pdfs WHERE sha256=? AND topic_id IS NOT NULL";
     const ids=okKeys.flatMap(k=>store.prepare(q).all(k).map(r=>r.id));
     // nach „PDF laden“ zuerst Text lesen und OCR der geladenen Dateien
     if(step==='pdf'){
      const shas=[...new Set(okKeys.map(k=>store.prepare("SELECT sha256 FROM pdfs WHERE url=? AND status IN ('ok','text-only')").get(k)?.sha256).filter(Boolean))];
      if(shas.length){
       const sf=path.join(tmp,'pdf-shas.txt');fs.writeFileSync(sf,shas.join('\n'));
       report.followUp.push({after:name,step:stepName('text'),code:await exec(...commandFor('text',sf,{minutes:left(),origin}))});
       const ocr=shas.filter(s=>store.prepare('SELECT 1 FROM texts WHERE sha256=? AND ocr_needed>0').get(s));
       if(ocr.length&&left()>=1){fs.writeFileSync(sf,ocr.join('\n'));report.followUp.push({after:name,step:stepName('ocr'),code:await exec(...commandFor('ocr',sf,{minutes:left(),origin}))});}
      }
     }
     if(ids.length)f=await followUp({sql,store,exec,tmp,topicIds:ids,left,origin,log});
    }
    if(f){for(const s of f.steps)report.followUp.push({after:name,...s});report.readyForAi=(report.readyForAi||0)+f.reports;}
   }
  }
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 report.finishedAt=new Date(now()).toISOString();
 report.totals=report.steps.reduce((a,s)=>({ok:a.ok+(s.ok||0),again:a.again+(s.again||0),final:a.final+(s.final||0),untouched:a.untouched+(s.untouched||0)}),{ok:0,again:0,final:0,untouched:0});
 return report;
}

/** Bahn „Laden“ der PDF-Ablage belegen (Nachtkette und Bestandsaufträge laden in dieselbe Ablage); false, wenn belegt */
export function takeLane(dir){
 fs.mkdirSync(dir,{recursive:true});
 const lock=path.join(dir,LANE_LOCKS.chain),alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};
 try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}
 catch{const pid=Number(fs.readFileSync(lock,'utf8'));if(pid&&alive(pid))return false;fs.writeFileSync(lock,String(process.pid));}
 process.on('exit',()=>{try{if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock);}catch{/* schon weg */}});
 return true;
}

/* Aufruf als Skript */
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const args=process.argv.slice(2),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;},flag=n=>args.includes('--'+n);
 const file=databaseFile();
 if(!file){console.error('Keine Datenbank (DATABASE_FILE oder .wrangler/).');process.exit(1);}
 const sql=new DatabaseSync(file);sql.exec('PRAGMA busy_timeout=30000');
 const db=sqliteAdapter(sql);
 if(!await hasFailureStore(db)){console.log('Fehlerspeicher fehlt (Migration 0040), nichts zu tun');process.exit(0);}
 const dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE;
 if(!takeLane(dir)){console.log('Bahn Laden belegt (Nachtkette oder Bestandsauftrag), Nacharbeit lässt aus');process.exit(0);}
 let child=null;for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child?.kill('SIGTERM');}catch{/* weg */}process.exit(3);});
 let store=null;try{store=new DatabaseSync(path.join(dir,'index.sqlite'),{readOnly:true});}catch{/* ohne Ablage keine Folgeschritte */}
 const say=(...a)=>console.log(new Date().toISOString().slice(0,19).replace('T',' '),...a);
 const range=opt('range','daily')==='backlog'?'backlog':'daily';
 const report=await nacharbeit({db,sql,store,range,minutes:Number(opt('minutes',20)),limit:Number(opt('limit',500)),perHost:Number(opt('per-host',20)),
  steps:opt('steps')?opt('steps').split(','):null,includeSlow:true,dry:flag('dry-run'),log:say,
  exec:(script,a)=>new Promise(resolve=>{child=spawn(process.execPath,['--no-warnings','--max-old-space-size=4096',path.join(root,script),...a],{cwd:root,stdio:'inherit',env:process.env});child.on('error',()=>resolve(127));child.on('exit',(c,s)=>{child=null;resolve(c??s);});})});
 if(!flag('dry-run')){
  writeState(range==='backlog'?BACKLOG_REWORK_KEY:NACHARBEIT_KEY,report);
  if(range==='daily'&&report.due){
   const row=sql.prepare('SELECT value FROM system_state WHERE key=?').get(NACHARBEIT_LOG_KEY);
   let list=[];try{list=row?JSON.parse(row.value):[];}catch{/* neu anfangen */}
   writeState(NACHARBEIT_LOG_KEY,[runBrief(report),...(Array.isArray(list)?list:[])].slice(0,NACHARBEIT_LOG_MAX));
  }
 }
 say(`Ende: ${JSON.stringify(report.totals)}`);
 store?.close();sql.close();
 process.exit(report.result==='failed'?1:0);
}
