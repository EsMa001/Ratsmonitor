// Altbestand (Job „altbestand“, Seite „Altbestand“ im Admin, Betriebsplan 15.10.2026): führt nur aus, was auf der Seite angefordert
// ist (system_state 'altbestand-requests'); ohne Anforderung endet er sofort. Zwischen 10:00 und 22:00 Uhr, alle 10 Minuten geprüft.
//   rework  Alte Fehler erneut versuchen: fällige Einträge des Fehlerspeichers im Altbestand (älter als der Tagesbereich, übertragene
//           Altfehler), in den drei Stufen Abruf → Extraktion → Verarbeitung, mit Folgekette (scripts/nacharbeit.mjs, range
//           'backlog'). Fertig, wenn nichts mehr fällig ist.
//   import  Rückwirkend abrufen: Gebiete mit einem Zeitraum (1 bis 24 Monate), je 8 Gebiete über import-worker --direct; für die
//           Berichte, die ein gelungener Abruf geschrieben hat, gleich PDF laden, Anlagen laden, Text lesen, OCR, Regeln anwenden
//           (followUp). Fortsetzbar über Läufe und Tage (done/failed in der Anforderung).
//   ocr     OCR des Altbestands: führt der Job „ocr“ aus (nach dem Tagesbereich), nicht dieser.
// Die KI startet nicht von selbst (keine automatische Modell-API); das Protokoll nennt, wie viele Berichte bereitstehen.
// Vorrang hat die Nacharbeit des Tagesbereichs: hat sie fällige Einträge und lief sie seit 25 Minuten nicht, lässt dieser Lauf aus.
// Ergebnis: 'altbestand-last' (Lauf), 'altbestand-rework-last' (alte Fehler), Fortschritt in 'altbestand-requests'.
//
//   node scripts/altbestand.mjs [--minutes 120] [--until 22:00] [--chunk 8] [--dry-run]
// Umgebung: DATABASE_FILE, RM_PDF_STORE.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from './ai-job.mjs';
import {databaseFile,readState,writeState} from './pdf-store/state.mjs';
import {DEFAULT_PDF_STORE} from '../server/node/pdf-store.mjs';
import {hasFailureStore,dueEntries} from '../server/integrations/work-failures.mjs';
import {slotAt,SCHEDULE_RUNS_KEY} from '../server/integrations/schedules.mjs';
import {nacharbeit,followUp,takeLane,BACKLOG_REWORK_KEY} from './nacharbeit.mjs';

export const REQUESTS_KEY='altbestand-requests',LAST_KEY='altbestand-last';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

/** Anforderung ändern (lesen, ändern, schreiben; die Seite schreibt nur Wünsche, dieser Job nur Fortschritt) */
export const updateRequests=(read,write,fn)=>{const cur=read(REQUESTS_KEY)||{};const next=fn(cur);if(next)write(REQUESTS_KEY,next);return next||cur;};
/** Gebiete, die beim rückwirkenden Abruf noch offen sind */
export const openRegions=imp=>imp?(imp.regions||[]).filter(r=>!(imp.done||[]).includes(r)&&!(imp.failed||[]).includes(r)):[];

/**
 * Ein Lauf. exec(script,args): Schritt starten (Kindprozess); now: Uhr. Rückgabe: Protokoll.
 */
export async function altbestand({db,sql,store=null,exec,minutes=120,chunk=8,now=Date.now,log=console.log,read=readState,write=writeState,hasImporter=true}={}){
 const t0=now(),deadline=t0+minutes*60000,left=()=>(deadline-now())/60000;
 const report={startedAt:new Date(t0).toISOString(),rework:null,import:[],result:'done'};
 let req=read(REQUESTS_KEY)||{};
 // 1. Alte Fehler erneut versuchen
 if(req.rework&&!req.rework.finishedAt){
  const runs=[];
  while(left()>=2){
   const due=await dueEntries(db,{range:'backlog',includeSlow:true,limit:1,now:now()});
   if(!due.length){updateRequests(read,write,r=>r.rework?{...r,rework:{...r.rework,finishedAt:new Date(now()).toISOString()}}:null);log('Alte Fehler: nichts mehr fällig');break;}
   const r=await nacharbeit({db,sql,store,exec,range:'backlog',includeSlow:true,minutes:Math.min(30,left()),now,log,hasImporter});
   runs.push(r);
   if(!r.due||r.totals.ok+r.totals.again+r.totals.final===0)break;
  }
  if(runs.length){
   report.rework={runs:runs.length,due:runs.reduce((a,r)=>a+r.due,0),totals:runs.reduce((a,r)=>({ok:a.ok+r.totals.ok,again:a.again+r.totals.again,final:a.final+r.totals.final,untouched:a.untouched+r.totals.untouched}),{ok:0,again:0,final:0,untouched:0}),readyForAi:runs.reduce((a,r)=>a+(r.readyForAi||0),0)};
   write(BACKLOG_REWORK_KEY,{...runs.at(-1),runs:runs.length,sum:report.rework});
  }
 }
 // 2. Rückwirkend abrufen
 req=read(REQUESTS_KEY)||{};
 const imp=req.import;
 if(imp&&!imp.finishedAt&&!imp.stoppedAt){
  if(!hasImporter){log('Rückwirkender Abruf: Importprozess nicht gebaut (node scripts/build-node.mjs)');report.import.push({skipped:'kein Importprozess'});}
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'altbestand-'));
  try{
   while(hasImporter&&left()>=3){
    const cur=read(REQUESTS_KEY)?.import;
    if(!cur||cur.stoppedAt||cur.requestedAt!==imp.requestedAt){log('Rückwirkender Abruf angehalten oder ersetzt');break;}
    const open=openRegions(cur).slice(0,chunk);
    if(!open.length){updateRequests(read,write,r=>({...r,import:{...r.import,finishedAt:new Date(now()).toISOString()}}));log('Rückwirkender Abruf fertig');break;}
    const began=new Date(now()).toISOString();
    log(`Abruf ${cur.window}: ${open.join(', ')}`);
    const code=await exec('dist/standalone/worker/import-worker.mjs',['--direct','--regions',open.join(','),'--window',cur.window,'--origin','backlog','--no-catch-up','--max-minutes',String(Math.max(1,Math.floor(left())))]);
    // Gelungen ist ein Gebiet, wenn danach kein Eintrag im Fehlerspeicher steht, der in diesem Lauf geschrieben wurde
    const failedNow=new Set(sql.prepare("SELECT key FROM work_failures WHERE step='import' AND last_at>=?").all(began).map(r=>r.key));
    const ok=open.filter(r=>!failedNow.has(r)),bad=open.filter(r=>failedNow.has(r));
    const chunkReport={at:began,regions:open,ok:ok.length,failed:bad.length,exit:code,followUp:[]};
    if(ok.length&&left()>=1){const f=await followUp({sql,store,exec,tmp,regions:ok,since:began,left,origin:'backlog',log});chunkReport.followUp=f.steps;chunkReport.reports=f.reports;}
    report.import.push(chunkReport);
    updateRequests(read,write,r=>r.import?.requestedAt===imp.requestedAt?{...r,import:{...r.import,done:[...(r.import.done||[]),...ok],failed:[...(r.import.failed||[]),...bad],lastAt:new Date(now()).toISOString()}}:null);
   }
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 }
 report.finishedAt=new Date(now()).toISOString();
 report.readyForAi=(report.rework?.readyForAi||0)+report.import.reduce((a,c)=>a+(c.reports||0),0);
 return report;
}

/* Aufruf als Skript */
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const args=process.argv.slice(2),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;},flag=n=>args.includes('--'+n);
 const say=(...a)=>console.log(new Date().toISOString().slice(0,19).replace('T',' '),...a);
 const file=databaseFile();
 if(!file){console.error('Keine Datenbank (DATABASE_FILE oder .wrangler/).');process.exit(1);}
 const req=readState(REQUESTS_KEY)||{};
 const work=req.import&&!req.import.finishedAt&&!req.import.stoppedAt||req.rework&&!req.rework.finishedAt;
 if(!work){process.exit(0);}
 // Fenster: spätestens --until enden
 const t=Date.now(),until=opt('until')?slotAt(t,opt('until')):0;
 let minutes=Number(opt('minutes',120));if(until)minutes=Math.min(minutes,Math.floor((until-t)/60000)-2);
 if(minutes<5){say('Fenster fast zu Ende, nichts begonnen');process.exit(0);}
 const sql=new DatabaseSync(file);sql.exec('PRAGMA busy_timeout=30000');
 const db=sqliteAdapter(sql);
 if(!await hasFailureStore(db)){say('Fehlerspeicher fehlt (Migration 0040)');process.exit(0);}
 // Vorrang der Nacharbeit: fällige Einträge im Tagesbereich und kein Lauf seit 25 Minuten → auslassen
 const due=await dueEntries(db,{range:'daily',limit:1});
 const last=Date.parse((readState(SCHEDULE_RUNS_KEY)||{}).nacharbeit?.lastStart||0);
 if(due.length&&Date.now()-last>25*60000){say('Nacharbeit hat Vorrang (fällige Einträge im Tagesbereich), dieser Lauf lässt aus');process.exit(0);}
 const dir=process.env.RM_PDF_STORE||DEFAULT_PDF_STORE;
 if(!takeLane(dir)){say('Bahn Laden belegt (Nachtkette, Nacharbeit oder PDF-Auftrag), lässt aus');process.exit(0);}
 let child=null;for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child?.kill('SIGTERM');}catch{/* weg */}process.exit(3);});
 let store=null;try{store=new DatabaseSync(path.join(dir,'index.sqlite'),{readOnly:true});}catch{/* ohne Ablage */}
 const exec=(script,a)=>flag('dry-run')?(say('[Probe]',script,a.join(' ')),Promise.resolve(0)):new Promise(resolve=>{child=spawn(process.execPath,['--no-warnings','--max-old-space-size=4096',path.join(root,script),...a],{cwd:root,stdio:'inherit',env:process.env});child.on('error',()=>resolve(127));child.on('exit',(c,s)=>{child=null;resolve(c??s);});});
 const report=await altbestand({db,sql,store,exec,minutes,chunk:Number(opt('chunk',8)),log:say,hasImporter:fs.existsSync(path.join(root,'dist/standalone/worker/import-worker.mjs')),
  write:flag('dry-run')?()=>{}:writeState});
 if(!flag('dry-run'))writeState(LAST_KEY,report);
 say(`Ende: alte Fehler ${JSON.stringify(report.rework?.totals||{})}, Abruf ${report.import.length} Pakete, ${report.readyForAi} Berichte bereit für die KI`);
 store?.close();sql.close();
 process.exit(0);
}
