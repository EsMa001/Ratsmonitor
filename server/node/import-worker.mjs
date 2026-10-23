/**
 * Importprozess neben dem Webserver (Code-Analyse A14): arbeitet den gespeicherten Abrufauftrag der Administration ab,
 * ohne dass ein Browser offen sein muss und ohne die Website anzuhalten. Gebaut von scripts/build-node.mjs nach
 * dist/standalone/worker/import-worker.mjs (build/worker-build.mjs); gestartet von systemd
 * (deploy/node/ratsmonitor-import*.service und .timer) mit derselben Umgebung wie der Dienst.
 *
 *   node dist/standalone/worker/import-worker.mjs --run                      offenen Auftrag abarbeiten, sonst Ende
 *   node dist/standalone/worker/import-worker.mjs --create sources --window 1w   Auftrag anlegen (wenn keiner offen ist) und abarbeiten
 *   RM_PDF_STORE=<Ordner>: Dokumente zuerst aus der lokalen PDF-Ablage lesen (scripts/pdf-store/fetch.mjs)
 *   node dist/standalone/worker/import-worker.mjs --direct --regions id,id [--window 1w] [--origin daily|backlog]
 *        genau diese Gebiete abrufen, ohne gespeicherten Auftrag (Job „nacharbeit“); Ausgänge in den Fehlerspeicher
 *   --weekly-window 1m [--weekly-day 0]: mit --create am Wochentag (0 = Sonntag, deutsche Zeit) ein weiteres Fenster, damit
 *        Nachträge zu älteren Sitzungen (später veröffentlichte Niederschriften, Beschlüsse) nicht dauerhaft fehlen
 *   Weitere Schalter: --lanes 24, --max-minutes 240, --no-catch-up, --regions id,id (mit --create)
 *
 * Die Datenbank kommt wie im Dienst über DATABASE_FILE (server/node/cloudflare-workers.mjs). Der Prozess wartet länger
 * auf Schreibsperren des Webprozesses als dieser: IMPORT_BUSY_TIMEOUT_MS (Standard 30 s) gilt hier statt
 * DATABASE_BUSY_TIMEOUT_MS aus der Umgebungsdatei. Auftrag, Sperren und Fortschritt liegen in der Datenbank; die
 * Admin-Seite zeigt den Lauf wie einen aus dem Browser.
 * Exit 0: fertig, nichts zu tun oder Zeitgrenze (der Auftrag bleibt, der nächste Lauf macht weiter); 1: Abbruch;
 * 2: --create konnte keinen Auftrag anlegen, weil ein frischer offener Auftrag die Datenbank belegt.
 */
process.env.DATABASE_BUSY_TIMEOUT_MS=process.env.IMPORT_BUSY_TIMEOUT_MS||'30000';
import {env} from 'cloudflare:workers';
import {runSync} from '@/server/services/sync';
import {analysePending} from '@/server/integrations/manual-analysis.mjs';
import {useDocumentStore} from '@/server/integrations/documents.mjs';
import {pacedFetch} from '@/server/integrations/request-budget.mjs';
import {serverOf} from '@/server/integrations/source-servers.mjs';
import {backfillNight} from '@/server/integrations/backfill.mjs';
import {workJob,ensureJob,currentJob,openJob,nightlyBusy,catchUp,parseArgs,importRunner,runDirect,windowForTonight} from '@/server/integrations/pipeline-worker.mjs';

const log=(...parts)=>console.log(new Date().toISOString(),'[import-worker]',...parts);
const warn=(...parts)=>console.error(new Date().toISOString(),'[import-worker]',...parts);
const counts=job=>{const c={};for(const i of job.items)c[i.status]=(c[i.status]||0)+1;return JSON.stringify(c);};
let options;
try{options=parseArgs(process.argv.slice(2));}catch(e){warn('Aufruf:',e.message);process.exit(1);}
const db=env.DB;
if(!db){warn('keine Datenbank (DATABASE_FILE)');process.exit(1);}
// Lokale PDF-Ablage (server/node/pdf-store.mjs): Dokumente zuerst von der Platte lesen, neu geladene dort ablegen.
if(process.env.RM_PDF_STORE){const {openPdfStore}=await import('@/server/node/pdf-store.mjs');useDocumentStore(openPdfStore(process.env.RM_PDF_STORE));log('PDF-Ablage',process.env.RM_PDF_STORE);}
// Mindestabstand je Anbieter für alle Anfragen dieses Prozesses (request-budget.mjs, SOURCE_SPACING_MS)
const paced=pacedFetch(globalThis.fetch.bind(globalThis),serverOf);
globalThis.fetch=paced;
const run=importRunner(db,{runSync,analysePending});
const started=Date.now();
const stop=()=>options.maxMinutes>0&&Date.now()-started>options.maxMinutes*60000;
let exitCode=0;
// --direct --regions a,b: genau diese Gebiete abrufen, ohne gespeicherten Auftrag (Job „nacharbeit“); Ausgänge in den Fehlerspeicher
if(options.direct){
 try{
  const out=await runDirect(db,run,options.regions,{window:options.window,lanes:Math.min(options.lanes,8),origin:options.origin,stop});
  const ok=out.filter(r=>r.status===200&&!r.refused).length;
  log(`Direktabruf: ${out.length} Gebiete, ${ok} gelungen, ${out.length-ok} wieder im Fehlerspeicher`);
  for(const r of out)if(!(r.status===200&&!r.refused))log(`  ${r.region}: ${r.refused?'Pause erbeten':r.error||'Status '+r.status}`);
  console.log('DIRECT '+JSON.stringify({regions:out.length,ok}));
 }catch(e){warn('Abbruch:',e?.stack||e);exitCode=1;}
 try{db.close?.();}catch{/* schon zu */}
 process.exit(exitCode);
}
try{
 let job=await currentJob(db);
 if(options.create){
  const window=windowForTonight(options);
  const made=await ensureJob(db,{regions:options.regions||options.create,window,owner:'nightly'});
  job=made.job;
  log(made.created?`Auftrag angelegt: ${job.id}, ${job.items.length} Gebiete, Fenster ${window}${made.deferred?`, ${made.deferred} zurückgestellt (Fehlerspeicher)`:''}${made.replaced?' (ein pausierter oder liegen gebliebener Auftrag wurde beendet)':''}`:`offener Auftrag ${job.id} (${counts(job)}) wird fortgesetzt; kein neuer angelegt`);
 }
 // The job may be replaced by the page while this process works it: then the new one is taken up, a few times.
 for(let round=0;round<5;round++){
  if(!openJob(job)){log(job?`kein offener Auftrag (Stand ${job.status})`:'kein Auftrag');break;}
  if(job.paused){log(`Auftrag ${job.id} ist pausiert; nichts zu tun`);if(options.create)exitCode=2;break;}
  if(!options.create&&nightlyBusy(job)){log(`Auftrag ${job.id} gehört dem Nachtlauf und bewegt sich; nichts zu tun`);break;}
  log(`Auftrag ${job.id}: ${counts(job)}, ${options.lanes} Bahnen${options.maxMinutes?`, höchstens ${options.maxMinutes} min`:''}`);
  const result=await workJob(db,run,{lanes:options.lanes,stop,warn,log:latest=>log('Stand',latest.status,counts(latest),'nach',Math.round((Date.now()-started)/60000),'min')});
  log(`Ende: ${result.state}, ${result.job?counts(result.job):'-'}, ${((Date.now()-started)/60000).toFixed(1)} min${result.failures?`, ${result.failures} Fehler in Bahnen`:''}`);
  if(result.state!=='replaced')break;
  job=result.job;log('Der Auftrag wurde ersetzt; der neue wird übernommen');
 }
 // Lückenabruf: ein Teil der Gebiete über 12 Monate, reihum (backfill.mjs); nur nach einem Auftrag, der zu Ende kam, und mit Restzeit
 if(options.backfill>0&&!stop()&&!openJob(await currentJob(db))){
  const from=Date.now(),own=()=>stop()||Date.now()-from>options.backfillMinutes*60000;
  const night=await backfillNight(db,run,{areas:options.backfill,perProvider:options.backfillPerProvider,requestCap:options.backfillCap,counts:paced.counts,stop:own});
  log(`Lückenabruf: Runde ${night.round}, ${night.picked} Gebiete gewählt, ${night.done} erledigt, ${night.kept} bleiben, ${night.failed} gescheitert; noch ${night.remaining} von ${night.total} in der Runde, ${night.minutes} min`);
 }
 if(options.catchUp){const steps=await catchUp(db);log(`Kennzahlen der Administration nachgerechnet: ${steps} Schritte`);}
}catch(e){
 warn('Abbruch:',e?.stack||e);exitCode=1;
}finally{
 try{db.close?.();}catch{/* schon zu */}
}
process.exit(exitCode);
