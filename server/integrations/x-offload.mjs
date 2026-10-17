/* plenara.X im Worker-Thread (Befund 7, docs/qualitaet/frontend-effizienz-2026-10-17.md): Der Node-Server liest SQLite
 * synchron (DatabaseSync); eine Rechnung von 2 s (Newsradar, Trends) hielt bis dahin jede andere Anfrage an, auch die
 * Suche. Hier geht die Rechnung an einen von RM_X_WORKERS Threads (Standard 2, Datei RM_X_WORKER, gesetzt von
 * serve.mjs), jeder mit eigener Nur-Lese-Verbindung; der Hauptprozess bleibt frei. Ohne RM_X_WORKER (Dev-Server,
 * Cloudflare) liefert xOffload null, und xCached rechnet wie bisher im Prozess. Kein neues Datenmodell, nichts
 * vorgerechnet: dieselben Funktionen (x-registry.mjs), derselbe Zwischenspeicher (revision-cache.mjs). */
import {AnalyticsError} from './analytics-diffusion.mjs';

const STATE=Symbol.for('ratsmonitor.x-offload');
const state=(globalThis[STATE]??={workers:[],queue:[],seq:0,unknown:new Set(),Worker:null});

export function xOffloadEnabled(){return Boolean(process.env.RM_X_WORKER);}

/** Rechnet `kind` mit `params` im Worker; null, wenn kein Worker eingerichtet ist oder die Art dort unbekannt ist. */
export function xOffload(kind,params){
 if(!xOffloadEnabled()||state.unknown.has(kind))return null;
 return new Promise((resolve,reject)=>{
  state.queue.push({id:++state.seq,kind,params:new URLSearchParams(params).toString(),resolve,reject});
  pump().catch(reject);
 });
}

async function pump(){
 if(!state.Worker){const m=await import(/* @vite-ignore */ 'node:'+'worker_threads');state.Worker=m.Worker;}
 const size=Math.max(1,Number(process.env.RM_X_WORKERS||2));
 while(state.workers.length<size)state.workers.push(spawn());
 for(const w of state.workers){
  if(w.task||!state.queue.length)continue;
  w.task=state.queue.shift();
  w.worker.postMessage({id:w.task.id,kind:w.task.kind,params:w.task.params});
 }
}

function spawn(){
 const worker=new state.Worker(process.env.RM_X_WORKER,{env:process.env});
 const slot={worker,task:null};
 worker.unref();
 worker.on('message',msg=>{
  const task=slot.task;if(!task||msg.id!==task.id)return;
  slot.task=null;
  if(msg.ok)task.resolve(msg.value);
  else if(msg.unknown){state.unknown.add(task.kind);task.resolve(null);}
  else task.reject(msg.analytics?new AnalyticsError(msg.message,msg.status):new Error(msg.message));
  pump().catch(()=>{});
 });
 const gone=err=>{
  const i=state.workers.indexOf(slot);if(i>=0)state.workers.splice(i,1);
  if(slot.task){slot.task.reject(err instanceof Error?err:new Error('plenara.X-Worker beendet'));slot.task=null;}
  if(state.queue.length)pump().catch(()=>{});
 };
 worker.on('error',gone);worker.on('exit',code=>{if(code!==0||slot.task)gone(new Error(`plenara.X-Worker beendet (${code})`));});
 return slot;
}

/** Für Tests: alle Worker beenden. */
export async function xOffloadStop(){
 const all=state.workers.splice(0);
 await Promise.all(all.map(w=>w.worker.terminate()));
}
