/**
 * Importprozess neben dem Webserver (Code-Analyse A14): arbeitet den gespeicherten Abrufauftrag der Administration ab,
 * ohne dass ein Browser offen sein muss und ohne die Website anzuhalten. Gebaut von scripts/build-node.mjs nach
 * dist/standalone/worker/import-worker.mjs (build/worker-build.mjs); gestartet von systemd
 * (deploy/node/ratsmonitor-import*.service und .timer) mit derselben Umgebung wie der Dienst.
 *
 *   node dist/standalone/worker/import-worker.mjs --run                      offenen Auftrag abarbeiten, sonst Ende
 *   node dist/standalone/worker/import-worker.mjs --create sources --window 1w   Auftrag anlegen (wenn keiner offen ist) und abarbeiten
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
import {workJob,ensureJob,currentJob,openJob,catchUp,parseArgs,importRunner} from '@/server/integrations/pipeline-worker.mjs';

const log=(...parts)=>console.log(new Date().toISOString(),'[import-worker]',...parts);
const warn=(...parts)=>console.error(new Date().toISOString(),'[import-worker]',...parts);
const counts=job=>{const c={};for(const i of job.items)c[i.status]=(c[i.status]||0)+1;return JSON.stringify(c);};
let options;
try{options=parseArgs(process.argv.slice(2));}catch(e){warn('Aufruf:',e.message);process.exit(1);}
const db=env.DB;
if(!db){warn('keine Datenbank (DATABASE_FILE)');process.exit(1);}
const run=importRunner(db,{runSync,analysePending});
const started=Date.now();
const stop=()=>options.maxMinutes>0&&Date.now()-started>options.maxMinutes*60000;
let exitCode=0;
try{
 let job=await currentJob(db);
 if(options.create){
  const made=await ensureJob(db,{regions:options.regions||options.create,window:options.window});
  job=made.job;
  log(made.created?`Auftrag angelegt: ${job.id}, ${job.items.length} Gebiete, Fenster ${options.window}${made.replaced?' (ein pausierter oder liegen gebliebener Auftrag wurde beendet)':''}`:`offener Auftrag ${job.id} (${counts(job)}) wird fortgesetzt; kein neuer angelegt`);
 }
 // The job may be replaced by the page while this process works it: then the new one is taken up, a few times.
 for(let round=0;round<5;round++){
  if(!openJob(job)){log(job?`kein offener Auftrag (Stand ${job.status})`:'kein Auftrag');break;}
  if(job.paused){log(`Auftrag ${job.id} ist pausiert; nichts zu tun`);if(options.create)exitCode=2;break;}
  log(`Auftrag ${job.id}: ${counts(job)}, ${options.lanes} Bahnen${options.maxMinutes?`, höchstens ${options.maxMinutes} min`:''}`);
  const result=await workJob(db,run,{lanes:options.lanes,stop,warn,log:latest=>log('Stand',latest.status,counts(latest),'nach',Math.round((Date.now()-started)/60000),'min')});
  log(`Ende: ${result.state}, ${result.job?counts(result.job):'-'}, ${((Date.now()-started)/60000).toFixed(1)} min${result.failures?`, ${result.failures} Fehler in Bahnen`:''}`);
  if(result.state!=='replaced')break;
  job=result.job;log('Der Auftrag wurde ersetzt; der neue wird übernommen');
 }
 if(options.catchUp){const steps=await catchUp(db);log(`Kennzahlen der Administration nachgerechnet: ${steps} Schritte`);}
}catch(e){
 warn('Abbruch:',e?.stack||e);exitCode=1;
}finally{
 try{db.close?.();}catch{/* schon zu */}
}
process.exit(exitCode);
