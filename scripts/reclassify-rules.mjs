/* Regel-Labels lokal neu einordnen (Titelregeln, shared/labels.mjs), ohne Admin-Anmeldung:
     node scripts/reclassify-rules.mjs
   Ruft dieselbe Funktion wie die Adminseite auf (analysePending, manual-analysis.mjs) für alle Gebiete, in Paketen zu 500,
   jedes Paket in einer eigenen Transaktion. Verarbeitet nur Vorgänge mit veralteter oder fehlender Einordnung, ist also
   jederzeit abbrechbar (Strg+C) und fortsetzbar. Setzt eine Sperre (system_state 'import-lock', 10 Minuten).
   Der Dev-Server hält dieselbe Datei offen: busy_timeout. Nach einer Änderung von CLASSIFIER_VERSION nötig, bis alle durch sind. */
import {DatabaseSync} from 'node:sqlite';
import {readdirSync} from 'node:fs';
import {sqliteAdapter} from './ai-job.mjs';
import {analysePending} from '../server/integrations/manual-analysis.mjs';
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const file=dir+readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite');
const sql=new DatabaseSync(file);sql.exec('PRAGMA busy_timeout=60000');
const db=sqliteAdapter(sql);const t0=Date.now();
let after='',batches=0,total=0;
for(;;){
 const r=await analysePending(db,'all',{after});
 if(r.status!==200){console.log('Status',r.status,JSON.stringify(r.data).slice(0,200));if(r.status===409){await new Promise(x=>setTimeout(x,5000));continue}break}
 batches++;total+=r.data.processed||0;after=r.data.after||r.data.next||'';
 console.log(JSON.stringify({batches,total,after:String(after).slice(0,24),more:r.data.more,s:Math.round((Date.now()-t0)/1000)}));
 if(!r.data.more)break;
}
console.log('FERTIG',total,'Sekunden',Math.round((Date.now()-t0)/1000));
