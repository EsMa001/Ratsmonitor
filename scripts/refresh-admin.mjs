/* Vorberechnete Werte der Administration in der lokalen D1-Datei aufbauen bzw. nachführen (gleiche Schritte wie im Worker,
   server/integrations/admin-refresh.mjs):
     node scripts/refresh-admin.mjs [--regions] [--full] [--build <ziel>] [--quiet]
   --regions (Standard): Werte je Gebiet (region_stats, region_series) für geänderte Gebiete, Schritt für Schritt bis fertig.
   --full: alle Gebiete als veraltet markieren und neu rechnen (nach Änderungen an den Formeln oder von Hand geänderten Daten).
   --build <ziel>: einen Bauauftrag ganz durchlaufen (z. B. keywords, quality:all); ohne laufenden Bau startet er einen.
   Fortsetzbar: jeder Schritt ist für sich gültig. Wird beim Start des Dev-Servers im Hintergrund aufgerufen
   (run-framework.mjs, abschaltbar mit RM_SKIP_ADMIN_REFRESH=1). Ohne Migration 0016 passiert nichts. */
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readdirSync} from 'node:fs';
import {refreshStep} from '../server/integrations/admin-refresh.mjs';
import {sqliteAdapter} from './ai-job.mjs';
const args=process.argv.slice(2),quiet=args.includes('--quiet'),say=(...a)=>{if(!quiet)console.log(...a);};
const build=args.includes('--build')?args[args.indexOf('--build')+1]:null;
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
// Auf dem eigenen Server (Node-Betrieb) nennt DATABASE_FILE die Datei; lokal die Miniflare-Datei unter .wrangler/.
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const file=process.env.DATABASE_FILE||(local?dir+local:null);
if(!file){say('Keine lokale Datenbank gefunden, nichts zu tun.');process.exit(0);}
// Der Dev-Server hält dieselbe Datei offen: warten statt mit SQLITE_BUSY abzubrechen.
const sql=new DatabaseSync(file);sql.exec('PRAGMA busy_timeout=60000');
const db=sqliteAdapter(sql),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function drive(target,first='step'){
 const t0=Date.now();let action=first,r;
 for(;;){
  r=await refreshStep(db,{action,target,budgetMs:target==='regions'?5000:8000});action='step';
  if(r.missing){say('Migration 0016 fehlt, nichts zu tun.');return r;}
  say(JSON.stringify({target,state:r.state,done:r.done,total:r.total,pending:r.pending,ms:r.ms}));
  if(r.state==='done')break;
  if(r.state==='busy')await sleep(3000);
 }
 say(`${target}: fertig in ${Math.round((Date.now()-t0)/100)/10} s`);
 return r;
}
try{
 if(args.includes('--full')){
  sql.exec('UPDATE region_series SET v=0');
  sql.exec("UPDATE region_stats SET stats=json_set(stats,'$.v',0)");
  say('Alle Gebiete als veraltet markiert.');
 }
 if(build)await drive(build,'start');
 else await drive('regions');
}catch(e){say('Vorberechnung nicht abgeschlossen:',e instanceof Error?e.message:e);process.exit(quiet?0:1);}
