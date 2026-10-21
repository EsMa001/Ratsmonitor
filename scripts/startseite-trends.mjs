/* Echte Daten für Karte und Trends der Startseite (components/ratsmonitor/info/StartseitePage.tsx): je Begriff und Kreis die erste
   Beratung (Gemeinde, Datum) und je Monat die neu hinzugekommenen Gebiete, mit derselben Rechnung wie /api/analytics/diffusion.
   Die Auswertung dauert je Begriff bis zu einer Minute; deshalb rechnet dieser Job sie vorab (Zeitplaner, Job „startseite-trends“,
   täglich) und legt sie in system_state 'startseite-trends' ab. Die Startseite liest sie über /api/startseite-trends; fehlt der
   Eintrag, nimmt sie public/data/startseite-trends.json (mitgelieferter Stand).
   Aufruf: node scripts/startseite-trends.mjs [--file]   --file schreibt zusätzlich public/data/startseite-trends.json */
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {diffusion} from '../server/integrations/analytics-diffusion.mjs';
import {sqliteAdapter} from './sqlite-adapter.mjs';
const {REGIONS}=await import('../shared/regions.ts');
const KEY='startseite-trends';
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
// Auf dem eigenen Server nennt DATABASE_FILE die Datei; lokal die Miniflare-Datei unter .wrangler/.
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const file=process.env.DATABASE_FILE||(local?dir+local:null);
if(!file){console.log('Keine Datenbank gefunden, nichts zu tun.');process.exit(0);}
const sql=new DatabaseSync(file);sql.exec('PRAGMA busy_timeout=60000');
const db=sqliteAdapter(sql);
const topics=JSON.parse(readFileSync(new URL('../components/ratsmonitor/info/startseite-topics.json',import.meta.url),'utf8'));
const out={stand:new Date().toISOString().slice(0,10),topics:{}};
for(const topic of topics){
 const t0=Date.now();
 const d=await diffusion(db,REGIONS,new URLSearchParams({q:topic,level:'city'}));
 /* Je Kreis die früheste Gemeinde (die Karte zeigt Kreise) */
 const byKreis=new Map();
 for(const g of d.regions??[]){
  if(!/^\d{4}-\d{2}-\d{2}/.test(g.first??'')||(g.ags??'').length<5)continue;
  const k=g.ags.slice(0,5),day=g.first.slice(0,10);
  if(!byKreis.has(k)||day<byKreis.get(k)[2])byKreis.set(k,[k,g.name,day]);
 }
 out.topics[topic]={f:[...byKreis.values()].sort((a,b)=>a[2].localeCompare(b[2])),series:d.series??[]};
 console.log(`${topic}: ${byKreis.size} Kreise, ${(d.regions??[]).length} Gebiete, ${Math.round((Date.now()-t0)/1000)} s`);
}
const json=JSON.stringify(out);
sql.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(KEY,json);
if(process.argv.includes('--file'))writeFileSync(new URL('../public/data/startseite-trends.json',import.meta.url),json);
console.log(`Gespeichert (${Math.round(json.length/1024)} KB).`);
