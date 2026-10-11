// Auftrag aus dem Admin-Reiter „PDF-Ablage“ ausführen (server/integrations/pdf-store-admin.mjs, system_state 'pdf-store-job'):
// 'run' startet die Kette wie nachts (nightly.mjs), 'retry' dazu mit erneutem Versuch der fehlgeschlagenen Abrufe.
// Auf dem Server alle 10 Minuten per Timer (deploy/node/ratsmonitor-pdf-job.*); ohne wartenden Auftrag endet er sofort.
// Läuft gerade die nächtliche Kette (Sperre nightly.lock), bleibt der Auftrag liegen und kommt beim nächsten Mal dran.
//
//   node scripts/pdf-store/job.mjs [--budget-gb 100] [--minutes 180] [--dry-run]   (--dry-run: Kette nur als Probe)
// Datenbank: DATABASE_FILE, sonst die Miniflare-Datei unter .wrangler/; Ablage: RM_PDF_STORE.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {JOB_KEY} from '../../server/integrations/pdf-store-admin.mjs';

const args=process.argv.slice(2),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=fs.existsSync(dir)?fs.readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const file=process.env.DATABASE_FILE||(local?dir+local:null);
if(!file){console.error('Keine Datenbank (DATABASE_FILE oder .wrangler/).');process.exit(1);}

const db=new DatabaseSync(file);
const read=()=>{const r=db.prepare('SELECT value FROM system_state WHERE key=?').get(JOB_KEY);try{return r?JSON.parse(r.value):null;}catch{return null;}};
const save=job=>db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(JOB_KEY,JSON.stringify({...job,updatedAt:new Date().toISOString()}));
const job=read();
if(job?.state!=='waiting'){db.close();process.exit(0);}

// Kette läuft schon (nächtlicher Lauf): Auftrag bleibt liegen
const lock=path.join(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE,'nightly.lock');
const pid=fs.existsSync(lock)?Number(fs.readFileSync(lock,'utf8')):0;
const alive=p=>{try{process.kill(p,0);return true;}catch(e){return e.code==='EPERM';}};
if(pid&&alive(pid)){console.log(`Kette läuft schon (Prozess ${pid}), Auftrag wartet`);db.close();process.exit(0);}

save({...job,state:'running',startedAt:new Date().toISOString()});
console.log(`Auftrag ${job.kind} vom ${job.requestedAt} startet`);
const r=spawnSync(process.execPath,['--no-warnings','scripts/pdf-store/nightly.mjs','--minutes',opt('minutes','180'),'--budget-gb',opt('budget-gb','100'),
 ...(job.kind==='retry'?['--retry-errors']:[]),...(args.includes('--dry-run')?['--dry-run']:[])],{cwd:root,stdio:'inherit',env:process.env});
save({...read(),state:r.status===0?'done':'failed',finishedAt:new Date().toISOString(),exit:r.status??String(r.signal)});
console.log(`Auftrag ${job.kind} ${r.status===0?'fertig':'mit Fehlern beendet'}`);
db.close();
