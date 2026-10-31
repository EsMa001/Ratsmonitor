/* Wortliste der Suche in der lokalen D1-Datei aufbauen bzw. nachführen: node scripts/refresh-search-words.mjs [--full] [--quiet]
   Ohne --full wird nur Neues seit dem letzten Lauf gelesen (fehlt die Liste noch, wird sie gebaut). Fehlen die vorberechneten
   Zahlen der häufigen Begriffe (Stand hasHits:false), baut das Skript alles neu auf: Nachführen kann sie nicht wiederherstellen.
   Gleiche Logik wie im Server (server/integrations/search-words.mjs), unter derselben Sperre wie die Nachführung nach Importen.
   Wird beim Start des Dev-Servers im Hintergrund aufgerufen (run-framework.mjs), auf dem eigenen Server nachts (Cron,
   docs/betrieb/node-server.md). Rückt vorher die Suchkarten nach, deren nächste Sitzung erreicht ist (rollCardDates). */
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readdirSync} from 'node:fs';
import {refreshSearchWords} from '../server/integrations/search-words.mjs';
import {syncSuggestIndex} from '../server/integrations/search-suggest.mjs';
import {rollCardDates} from '../server/integrations/search-card-dates.mjs';
import {sqliteAdapter} from './sqlite-adapter.mjs';
const quiet=process.argv.includes('--quiet'),say=(...a)=>{if(!quiet)console.log(...a);};
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
// Auf dem eigenen Server (Node-Betrieb) nennt DATABASE_FILE die Datei; lokal die Miniflare-Datei unter .wrangler/.
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const file=process.env.DATABASE_FILE||(local?dir+local:null);
if(!file){say('Keine lokale Datenbank gefunden, nichts zu tun.');process.exit(0);}
const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=60000');
/* Ohne Gebietsarten gibt es keine vorberechneten Zahlen, Wörter und Karten-IDs funktionieren trotzdem (z. B. ältere Node-Version ohne .ts-Import) */
let kinds=null,names=null;
try{const {REGIONS}=await import('../shared/regions.ts');kinds=new Map(REGIONS.map(r=>[r.id,r.kind]));names=new Map(REGIONS.map(r=>[r.id,r.name]));}catch{say('Gebietsarten nicht ladbar: keine vorberechneten Zahlen.');}
/* Zuerst die Suchkarten nachrücken, deren nächste Sitzung erreicht ist (drizzle/0024) */
try{const rolled=await rollCardDates(sqliteAdapter(db));if(rolled)say(`${rolled} Suchkarten auf die erreichte Sitzung nachgerückt`);}catch{/* ohne Migration 0024 nichts zu tun */}
try{
 const t0=Date.now(),result=await refreshSearchWords(sqliteAdapter(db),{full:process.argv.includes('--full'),fullIfNoHits:true,kinds,names});
 if(result?.busy){say(result.lost?'Sperre abgelaufen und von einem anderen Lauf übernommen: abgebrochen, der nächste Lauf holt nach.':'Eine andere Nachführung läuft gerade (Import oder Skript), nichts zu tun.');process.exit(0);}
 say(JSON.stringify({...result,seconds:Math.round((Date.now()-t0)/100)/10}));
}catch(e){say('Wortliste nicht aufgebaut:',e instanceof Error?e.message:e);process.exit(0);}
/* Register der Tippfehler-Vorschläge nachführen (search-suggest.mjs); neue Wörter der Liste kommen so nachts dazu */
try{
 const t0=Date.now();let r,added=0;
 do{r=await syncSuggestIndex(sqliteAdapter(db));added+=r.added??0;}while(r&&!r.done&&!r.skipped);
 say(r?.skipped?'Tippfehler-Register: '+(r.busy?'ein anderer Lauf füllt es gerade':r.reason):JSON.stringify({suggest:{added,seconds:Math.round((Date.now()-t0)/100)/10}}));
}catch(e){say('Tippfehler-Register nicht nachgeführt:',e instanceof Error?e.message:e);}
