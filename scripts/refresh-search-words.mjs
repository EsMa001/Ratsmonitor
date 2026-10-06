/* Wortliste der Suche in der lokalen D1-Datei nachführen: node scripts/refresh-search-words.mjs [--full]
   Ohne --full nur Neues seit dem letzten Lauf. Gleiche Logik wie im Worker (server/integrations/search-words.mjs). */
import {DatabaseSync} from 'node:sqlite';
import {readdirSync} from 'node:fs';
import {refreshSearchWords} from '../server/integrations/search-words.mjs';
import {sqliteAdapter} from './ai-job.mjs';
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/',file=readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite');
const db=new DatabaseSync(dir+file);db.exec('PRAGMA busy_timeout=60000');
const d1=sqliteAdapter(db);
const t0=Date.now(),result=await refreshSearchWords(d1,{full:process.argv.includes('--full')});
console.log(JSON.stringify({...result,seconds:Math.round((Date.now()-t0)/100)/10}));
