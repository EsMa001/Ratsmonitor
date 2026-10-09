/* Vergleicht die Prüfung „Derselbe Vorgang unter mehreren Gebieten“ (dupSharedSystem) über den ganzen Bestand mit der
   Fassung in Schritten je Host der Quelladresse (server/integrations/quality-check.mjs) auf der lokalen
   D1-Datei, nur lesend: node scripts/check-dup-shared.mjs
   Beide müssen gleich sein: eine Gruppe hat eine Adresse und damit einen Host. */
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readdirSync} from 'node:fs';
import {sqliteAdapter} from './ai-job.mjs';
import {runQualityCheck,sharedByHosts} from '../server/integrations/quality-check.mjs';
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const file=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
if(!file){console.log('Keine lokale Datenbank gefunden.');process.exit(0);}
const sql=new DatabaseSync(dir+file,{readOnly:true});sql.exec('PRAGMA busy_timeout=60000');
const base=sqliteAdapter(sql);
// Nur lesend: das Speichern der Ergebnisse wird verworfen.
const db={prepare(q){if(/^\s*(INSERT|UPDATE|DELETE)/i.test(q))return {bind(){return this;},async run(){return {meta:{changes:0}};},async all(){return {results:[]};},async first(){return null;},execute(){return {meta:{changes:0}};}};return base.prepare(q);},batch:s=>base.batch(s)};
let t=Date.now();
const whole=await runQualityCheck(db,'dupSharedSystem');
console.log(`ganzer Bestand: ${whole.count} zu viel in ${whole.groups} Gruppen (${Math.round((Date.now()-t)/1000)} s)`);
t=Date.now();
const steps=await sharedByHosts(db);
console.log(`je Host (${steps.units} Einheiten): ${steps.count} zu viel in ${steps.groups} Gruppen (${Math.round((Date.now()-t)/1000)} s)`);
const key=s=>s.url+'|'+String(s.title).toLowerCase();
const a=whole.samples.map(key),b=steps.samples.map(key);
const same=whole.count===steps.count&&whole.groups===steps.groups&&a.length===b.length&&a.every((k,i)=>k===b[i]);
console.log(same?'Gleich: Zahl, Gruppen und die ersten 20 Beispiele stimmen überein.':'ABWEICHUNG: '+JSON.stringify({ganz:{count:whole.count,groups:whole.groups},jeHost:{count:steps.count,groups:steps.groups},nurGanz:a.filter(k=>!b.includes(k)).slice(0,5),nurJeHost:b.filter(k=>!a.includes(k)).slice(0,5)}));
process.exit(same?0:2);
