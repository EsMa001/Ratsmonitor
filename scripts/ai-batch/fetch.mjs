// Lädt die Quellen eines KI-Auftrags einmal in den Cache (Prototyp).
// node scripts/ai-batch/fetch.mjs <auftrag.json> [--all | --sample N | --ids a,b] [--workers 16] [--delay 1000]
// Gelesen werden nur Inhaltsquellen (Vorlage, Anlage, Niederschrift, Sammeldokument) und Seiten der Tagesordnungspunkte;
// Sitzungs- und Einladungsseiten nicht (den Stand liefert der Auftrag). Je Plattform höchstens ein Abruf zur Zeit mit
// Pause danach; Plattformen laufen parallel. Fortsetzbar: geladene Adressen werden übersprungen.
// - HTTP-Fehler und unlesbare Dateien kommen als Fehler in den Cache (bis zu drei Läufe lang erneut versucht).
// - Netzfehler (Verbindung, Zeitüberschreitung) bleiben offen und werden im nächsten Lauf neu versucht.
// - Fünf Netzfehler oder Sperrantworten (403/429/503) einer Plattform in Folge: Plattform für diesen Lauf pausiert,
//   damit eine Sperre des Anbieters nicht weiter angefacht wird und keine Adresse fälschlich als Fehler endet.
// Letzte Zeile „fertig: …“ (ASCII) für den Wächter; Zwischenstand in <Laufordner>/fetch-status.json.
import fs from 'node:fs';
import path from 'node:path';
import {loadJob,runDir,cached,fetchSource,storeSource,platformOf,CONTENT_ROLES,writeJson} from './lib.mjs';

const args=process.argv.slice(2),opt=n=>{const i=args.indexOf('--'+n);return i<0?null:args[i+1]??true;};
const job=loadJob(args[0]),dir=runDir(job);
const workers=Number(opt('workers')||16),delay=Number(opt('delay')||1000),BREAK=5;

// Nur ein Lauf zur Zeit (Wächter und Hand dürfen sich nicht überschneiden).
const lock=path.join(dir,'fetch.lock');
try{const pid=Number(fs.readFileSync(lock,'utf8'));if(pid&&pid!==process.pid){process.kill(pid,0);console.log('läuft schon (PID '+pid+')');process.exit(2);}}catch(e){if(e.code==='EPERM'){console.log('läuft schon');process.exit(2);}}
fs.writeFileSync(lock,String(process.pid));
const unlock=()=>{try{if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock);}catch{}};
process.on('exit',unlock);

/** Auswahl: --ids, --sample (je Host einige Inhaltsartikel plus Schnellprüfungen mit TOP-Seite) oder alle. */
export function pick(job,{ids,sample}){
 if(ids)return job.articles.filter(a=>ids.includes(a.id));
 if(!sample)return job.articles;
 const byHost=new Map(),quick=[];
 for(const a of job.articles){
  const c=a.sources.find(s=>CONTENT_ROLES.has(s.role));
  if(!c){if(a.sources.some(s=>s.role==='item'))quick.push(a);continue;}
  const h=new URL(c.url).hostname;if(!byHost.has(h))byHost.set(h,[]);byHost.get(h).push(a);
 }
 const hosts=[...byHost.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0,Math.ceil(sample/3));
 const qHosts=new Map();for(const a of quick){const h=new URL(a.sources.find(s=>s.role==='item').url).hostname;if(!qHosts.has(h))qHosts.set(h,a);}
 return [...hosts.flatMap(([,list])=>list.slice(0,3)),...[...qHosts.values()].slice(0,Math.max(4,Math.round(sample/4)))];
}
/** Adressen, die gelesen werden. */
export const needed=a=>a.sources.filter(s=>CONTENT_ROLES.has(s.role)||s.role==='item').map(s=>s.url);

const list=pick(job,{ids:opt('ids')?.split(','),sample:opt('sample')?Number(opt('sample')):null});
if(opt('sample')||opt('ids'))writeJson(path.join(dir,'selection.json'),list.map(a=>a.id));
const urls=[...new Set(list.flatMap(needed))];
const skip=new Set((opt('skip')||'').split(',').filter(Boolean));
const queues=new Map();let skipped=0;
for(const u of urls){
 const c=cached(dir,u,{text:false});
 if(c&&(c.status!=='error'||(c.attempts||1)>=3)){skipped++;continue;}
 const p=platformOf(u);if(skip.has(p)){skipped++;continue;}if(!queues.has(p))queues.set(p,[]);queues.get(p).push({url:u,attempts:c?.attempts||0});
}
const open=[...queues.values()].reduce((n,q)=>n+q.length,0);
console.log(`${list.length} Artikel, ${urls.length} Adressen, im Cache ${skipped}, offen ${open} auf ${queues.size} Plattformen`);

const started=Date.now(),stat={loaded:0,httpErrors:0,netErrors:0,unsupported:0,paused:[]};
const left=new Map([...queues].map(([p,q])=>[p,q.length]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let lastStatus=0;
function status(final=false){
 if(!final&&Date.now()-lastStatus<15000)return;lastStatus=Date.now();
 const done=stat.loaded+stat.httpErrors+stat.unsupported,sec=(Date.now()-started)/1000;
 const slowest=[...left.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
 writeJson(path.join(dir,'fetch-status.json'),{at:new Date().toISOString(),open,done,...stat,seconds:Math.round(sec),perMinute:Math.round(done/sec*60),largestRemaining:Object.fromEntries(slowest),final});
 console.log(`${done}/${open} (${stat.httpErrors} HTTP-Fehler, ${stat.netErrors} Netzfehler, ${stat.paused.length} Plattformen pausiert), ${Math.round(sec/60)} min`);
}
async function platform([p,q]){
 let streak=0;
 for(const {url,attempts} of q){
  let entry=null,net=false,block=false;
  try{entry=await fetchSource(url);}
  catch(e){
   net=e.http===undefined&&!e.unsupported&&/fetch failed|terminated|timeout|aborted|ECONN|ETIMEDOUT|ENOTFOUND|socket|TLS/i.test(String(e.message)+' '+String(e.cause?.code||'')+' '+String(e.name));
   block=[403,429,503].includes(e.http);
   if(!net)entry={url,status:e.unsupported?'unsupported':'error',fetchedAt:new Date().toISOString(),error:String(e.message||e).slice(0,300),http:e.http??null,attempts:e.unsupported?3:attempts+1};
  }
  if(entry){storeSource(dir,entry);if(entry.status==='ok')stat.loaded++;else if(entry.status==='unsupported')stat.unsupported++;else stat.httpErrors++;}
  else stat.netErrors++;
  left.set(p,left.get(p)-1);
  streak=net||block?streak+1:0;
  if(streak>=BREAK){stat.paused.push(p);console.log(`Plattform ${p} pausiert nach ${BREAK} Netzfehlern oder Sperrantworten in Folge; ${left.get(p)} Adressen bleiben offen`);break;}
  status();
  await sleep(delay);
 }
}
// Größte Plattformen zuerst, damit sie die Laufzeit nicht am Ende allein bestimmen.
const pending=[...queues.entries()].sort((a,b)=>b[1].length-a[1].length);
await Promise.all(Array.from({length:workers},async()=>{while(pending.length)await platform(pending.shift());}));
status(true);
const rest=[...left.values()].reduce((n,x)=>n+x,0);
console.log(`fertig: ${stat.loaded} geladen, ${stat.httpErrors} HTTP-Fehler, ${stat.unsupported} ohne Adapter, ${stat.netErrors} Netzfehler, offen ${rest}, pausiert ${stat.paused.join(' ')||'-'}, ${Math.round((Date.now()-started)/60000)} min`);
