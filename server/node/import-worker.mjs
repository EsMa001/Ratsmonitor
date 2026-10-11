/**
 * Importprozess neben dem Webserver (Code-Analyse A14): arbeitet den gespeicherten Abrufauftrag der Administration ab,
 * ohne dass ein Browser offen sein muss und ohne die Website anzuhalten. Gebaut von scripts/build-node.mjs nach
 * dist/standalone/worker/import-worker.mjs (build/worker-build.mjs); gestartet von systemd
 * (deploy/node/ratsmonitor-import.service und .timer) mit derselben Umgebung wie der Dienst.
 *
 *   node dist/standalone/worker/import-worker.mjs --run                      offenen Auftrag abarbeiten, sonst Ende
 *   node dist/standalone/worker/import-worker.mjs --create sources --window 1w   Auftrag anlegen (wenn keiner offen ist) und abarbeiten
 *   Weitere Schalter: --lanes 24, --max-minutes 240, --no-catch-up, --regions id,id (mit --create)
 *
 * Die Datenbank kommt wie im Dienst über DATABASE_FILE (server/node/cloudflare-workers.mjs); der Prozess wartet länger
 * auf Schreibsperren des Webprozesses (DATABASE_BUSY_TIMEOUT_MS, Standard hier 30 s). Auftrag, Sperren und Fortschritt
 * liegen in der Datenbank; die Admin-Seite zeigt den Lauf wie einen aus dem Browser.
 */
process.env.DATABASE_BUSY_TIMEOUT_MS ||= '30000';
import {env} from 'cloudflare:workers';
import {runSync} from '@/server/services/sync';
import {analysePending} from '@/server/integrations/manual-analysis.mjs';
import {workJob,ensureJob,currentJob,openJob,catchUp} from '@/server/integrations/pipeline-worker.mjs';

const args=process.argv.slice(2);
const flag=name=>args.includes('--'+name);
const value=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0&&args[i+1]&&!args[i+1].startsWith('--')?args[i+1]:fallback;};
const log=(...parts)=>console.log(new Date().toISOString(),'[import-worker]',...parts);
const counts=job=>{const c={};for(const i of job.items)c[i.status]=(c[i.status]||0)+1;return JSON.stringify(c);};

const create=value('create',flag('create')?'sources':null),windowId=value('window','1w'),lanes=Number(value('lanes','24'))||24;
const maxMinutes=Number(value('max-minutes','0'))||0,regionsArg=value('regions',null);
const db=env.DB;
if(!db){log('keine Datenbank (DATABASE_FILE)');process.exit(1);}
// Imports as the route passes them (app/api/admin/pipeline/route.ts): rule labelling behind its cursor, imports with their window.
const run=(stage,region,lookback,cursor)=>stage==='analysis'?analysePending(db,region,{after:cursor||''}):runSync('metadata',region,'manual',{window:lookback});
const started=Date.now();
const stop=()=>maxMinutes>0&&Date.now()-started>maxMinutes*60000;
let exitCode=0;
try{
 let job=await currentJob(db);
 if(create){
  const made=await ensureJob(db,{regions:regionsArg?regionsArg.split(',').map(s=>s.trim()).filter(Boolean):create,window:windowId});
  job=made.job;
  log(made.created?`Auftrag angelegt: ${job.id}, ${job.items.length} Gebiete, Fenster ${windowId}`:`offener Auftrag ${job.id} wird fortgesetzt`);
 }
 if(!openJob(job)){log(job?`kein offener Auftrag (Stand ${job.status})`:'kein Auftrag');}
 else if(job.paused){log(`Auftrag ${job.id} ist pausiert; nichts zu tun`);}
 else{
  log(`Auftrag ${job.id}: ${counts(job)}, ${lanes} Bahnen${maxMinutes?`, höchstens ${maxMinutes} min`:''}`);
  const result=await workJob(db,run,{lanes,stop,log:latest=>log('Stand',latest.status,counts(latest),'nach',Math.round((Date.now()-started)/60000),'min')});
  log(`Ende: ${result.state}, ${counts(result.job)}, ${((Date.now()-started)/60000).toFixed(1)} min`);
  if(result.state==='stopped')exitCode=0;
 }
 if(!flag('no-catch-up')){const steps=await catchUp(db);log(`Kennzahlen der Administration nachgerechnet: ${steps} Schritte`);}
}catch(e){
 log('Abbruch:',e?.stack||e);exitCode=1;
}finally{
 try{db.close?.();}catch{/* schon zu */}
}
process.exit(exitCode);
