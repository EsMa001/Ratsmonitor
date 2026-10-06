/* Wortliste der Suche in der lokalen D1-Datei aufbauen bzw. nachführen: node scripts/refresh-search-words.mjs [--full] [--quiet]
   Ohne --full wird nur Neues seit dem letzten Lauf gelesen (fehlt die Liste noch, wird sie gebaut). Gleiche Logik wie im
   Worker (server/integrations/search-words.mjs). Wird beim Start des Dev-Servers im Hintergrund aufgerufen (run-framework.mjs). */
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readdirSync} from 'node:fs';
import {refreshSearchWords} from '../server/integrations/search-words.mjs';
import {sqliteAdapter} from './ai-job.mjs';
const quiet=process.argv.includes('--quiet'),say=(...a)=>{if(!quiet)console.log(...a);};
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const file=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
if(!file){say('Keine lokale Datenbank gefunden, nichts zu tun.');process.exit(0);}
const db=new DatabaseSync(dir+file);db.exec('PRAGMA busy_timeout=60000');
/* Ohne Gebietsarten gibt es keine vorberechneten Zahlen, Wörter und Karten-IDs funktionieren trotzdem (z. B. ältere Node-Version ohne .ts-Import) */
let kinds=null,names=null;
try{const {REGIONS}=await import('../shared/regions.ts');kinds=new Map(REGIONS.map(r=>[r.id,r.kind]));names=new Map(REGIONS.map(r=>[r.id,r.name]));}catch{say('Gebietsarten nicht ladbar: keine vorberechneten Zahlen.');}
try{
 const t0=Date.now(),result=await refreshSearchWords(sqliteAdapter(db),{full:process.argv.includes('--full'),kinds,names});
 say(JSON.stringify({...result,seconds:Math.round((Date.now()-t0)/100)/10}));
}catch(e){say('Wortliste nicht aufgebaut:',e instanceof Error?e.message:e);process.exit(0);}
