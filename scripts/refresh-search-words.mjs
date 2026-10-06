/* Wortliste der Suche in der lokalen D1-Datei nachführen: node scripts/refresh-search-words.mjs [--full]
   Ohne --full nur Neues seit dem letzten Lauf. Gleiche Logik wie im Worker (server/integrations/search-words.mjs). */
import {DatabaseSync} from 'node:sqlite';
import {readdirSync} from 'node:fs';
import {refreshSearchWords} from '../server/integrations/search-words.mjs';
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/',file=readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite');
const db=new DatabaseSync(dir+file);db.exec('PRAGMA busy_timeout=60000');
/* Minimale D1-Hülle um node:sqlite */
const d1={
 prepare(sql){const st=db.prepare(sql);let args=[];const o={bind(...a){args=a;return o;},async first(){return st.get(...args)??null;},async all(){return {results:st.all(...args)};},async run(){st.run(...args);return {};}};return o;},
 async batch(list){db.exec('BEGIN');try{for(const s of list)await s.run();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return list.map(()=>({}));},
};
const t0=Date.now(),result=await refreshSearchWords(d1,{full:process.argv.includes('--full')});
console.log(JSON.stringify({...result,seconds:Math.round((Date.now()-t0)/100)/10}));
