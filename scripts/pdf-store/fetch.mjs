// Lokale PDF-Ablage füllen (server/node/pdf-store.mjs): je Bericht das Hauptdokument (primaryPdf, dasselbe, das der
// Import liest) einmal laden und unter tmp/pdf-store ablegen. Neueste Sitzungen zuerst; fortsetzbar (Geladenes wird
// übersprungen, Fehler nur mit --retry-days erneut versucht). Auf Menge ausgelegt, nicht auf Vollständigkeit: wer nicht
// binnen --timeout-ms (Standard 10 s) liefert, wird übersprungen; ein Server mit 429/503 oder 3 Fehlern in Folge fällt für
// diesen Lauf heraus. Höflich bleibt es über wenige Abrufe je Server und eine kurze Pause. Schreibt nichts in die Datenbank.
//
//   node scripts/pdf-store/fetch.mjs --dry-run                     nur zählen (gesamt, schon da, offen, größte Server)
//   node scripts/pdf-store/fetch.mjs [--regions a,b] [--since 2025-01-01] [--limit N] [--max-minutes M]
//        [--concurrency 32] [--per-host 3] [--gap-ms 200] [--timeout-ms 10000] [--retry-days N]
//   node scripts/pdf-store/fetch.mjs --months 120 --max-gb 10   Monat für Monat ab heute zurück, bis die Ablage 10 GB hat
//        (je --report-mb 500 eine Zeile MEILENSTEIN, am Ziel ZIEL ERREICHT)
//   node scripts/pdf-store/fetch.mjs --months 240 --budget-gb 100 [--ocr-workers 2]
//        feste Grenze mit Tausch (keeper in store-lib.mjs): lädt weiter, auch wenn die Ablage voll ist; jede neue Datei wird
//        sofort bewertet und verdrängt die schlechteste, wenn sie besser ist, sonst fliegt sie selbst raus (Text bleibt immer)
//   node scripts/pdf-store/fetch.mjs --stats                       Stand der Ablage
//   node scripts/pdf-store/fetch.mjs --errors [--csv datei.csv]    fehlgeschlagene Abrufe: je Dokument Fehler, HTTP-Code, Tag
// Fehlgeschlagene Abrufe werden nicht erneut versucht (nur mit --retry-days N), sie stehen in der Fehlerliste.
// Ablage: RM_PDF_STORE (Standard tmp/pdf-store). Datenbank: DATABASE_FILE, sonst die Miniflare-Datei unter .wrangler/.
import {existsSync,readdirSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {fetchDocument} from '../../server/integrations/document-proxy.mjs';
import {bodyBytes} from '../../server/integrations/body-bytes.mjs';
import {SOURCE_USER_AGENT} from '../../server/integrations/no-redirect.mjs';
import {primaryPdf,documentType} from '../../shared/document-type.mjs';
import {keeper as makeKeeper,usedBytes,errorReason} from './store-lib.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const o={regions:opt('regions')?.split(',').filter(Boolean),since:opt('since'),limit:Number(opt('limit',0)),maxMinutes:Number(opt('max-minutes',0)),
 concurrency:Number(opt('concurrency',32)),perHost:Number(opt('per-host',3)),gapMs:Number(opt('gap-ms',200)),timeoutMs:Number(opt('timeout-ms',10000)),months:Number(opt('months',0)),maxGb:Number(opt('max-gb',0)),budgetGb:Number(opt('budget-gb',0)),ocrWorkers:Number(opt('ocr-workers',2)),reportMb:Number(opt('report-mb',500)),retryDays:Number(opt('retry-days',Infinity))};
// Abruf wie /api/dokument (nur öffentliche https-Adressen, jede Weiterleitung geprüft), aber mit der Projektkennung.
// Die Zeitgrenze gilt je Abruf für Kopf und Inhalt zusammen (das Signal bricht auch das Lesen des Inhalts ab).
const request=(url,init)=>fetch(url,{...init,signal:AbortSignal.any([init.signal,AbortSignal.timeout(o.timeoutMs)]),headers:{'User-Agent':SOURCE_USER_AGENT}});
async function download(url){
 const {response:r}=await fetchDocument(url,{request});
 if(!r.ok){await r.body?.cancel().catch(()=>{});throw Object.assign(Error('HTTP '+r.status),{http:r.status});}
 return bodyBytes(r,30*1048576,{message:'Dokument zu groß'});
}
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const mb=b=>(b/1048576).toFixed(0)+' MB';
if(flag('stats')){for(const r of store.stats())console.log(r.status.padEnd(12),String(r.n).padStart(8),r.bytes?mb(r.bytes):'');process.exit(0);}
if(flag('errors')){
 const rows=store.db.prepare("SELECT url,topic_id AS topic,region_id AS region,status,http,error,fetched_at AS at FROM pdfs WHERE status IN ('error','unsupported') ORDER BY fetched_at DESC").all();
 const csv=opt('csv');
 if(csv){const q=v=>`"${String(v??'').replaceAll('"','""')}"`;writeFileSync(csv,'\ufeffurl;bericht;gebiet;grund;http;fehler;tag\n'+rows.map(r=>[r.url,r.topic,r.region,errorReason(r),r.http,r.error,r.at?.slice(0,10)].map(q).join(';')).join('\n')+'\n');console.log(`${rows.length} Fehler nach ${csv}`);}
 else{const by=new Map();for(const r of rows){const k=errorReason(r);by.set(k,(by.get(k)||0)+1);}
  console.log(`${rows.length} fehlgeschlagene Abrufe`);for(const [k,n] of [...by].sort((a,b)=>b[1]-a[1]).slice(0,20))console.log(String(n).padStart(8),k);}
 process.exit(0);
}

const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const file=process.env.DATABASE_FILE||(local?dir+local:null);
if(!file){console.error('Keine Datenbank (DATABASE_FILE oder .wrangler/).');process.exit(1);}
const db=new DatabaseSync(file,{readOnly:true});

// Formalie wie in der Suche (search_cards.formal, drizzle/0017); ohne Spalte unbekannt.
const formalSql=db.prepare("SELECT 1 FROM pragma_table_info('search_cards') WHERE name='formal'").get()?'(SELECT formal FROM search_cards c WHERE c.id=topics.id)':'NULL';
// Aufträge eines Zeitraums sammeln: eine Adresse je Bericht, jede Adresse einmal, nach Server gruppiert (neueste zuerst).
function collect(from,to){
 const where=["payload LIKE '%application/pdf%'"],params=[];
 if(o.regions){where.push(`region_id IN (${o.regions.map(()=>'?').join(',')})`);params.push(...o.regions);}
 if(from){where.push('event_date>=?');params.push(from);}
 if(to){where.push('event_date<?');params.push(to);}
 const seen=new Set(),hosts=new Map();let total=0,have=0,open=0;
 for(const r of db.prepare(`SELECT id,region_id AS region,event_date AS date,json_extract(payload,'$.documents') AS docs,${formalSql} AS formal FROM topics WHERE ${where.join(' AND ')} ORDER BY event_date DESC`).iterate(...params)){
  let d;try{d=primaryPdf(JSON.parse(r.docs||'[]'));}catch{continue;}
  if(!d?.url||seen.has(d.url))continue;
  seen.add(d.url);total++;
  if(!store.wants(d.url,{retryDays:o.retryDays})){have++;continue;}
  if(o.limit&&open>=o.limit)continue;
  let host;try{host=new URL(d.url).host;}catch{continue;}
  if(!hosts.has(host))hosts.set(host,{queue:[],busy:0,next:0,fails:0});
  hosts.get(host).queue.push({url:d.url,region:r.region,topic:r.id,meta:{docType:documentType(d.title),formal:r.formal,eventDate:r.date}});open++;
 }
 return {hosts,total,have,open};
}

// Abrufen: höchstens `concurrency` gleichzeitig, je Server `perHost` und `gapMs` Abstand.
const started=Date.now(),c={ok:0,unsupported:0,error:0,bytes:0};let stopping=false,done=0;
const maxBytes=o.maxGb*1073741824,stepBytes=o.reportMb*1048576;let size=store.size(),nextStep=(Math.floor(size/stepBytes)+1)*stepBytes;
process.on('SIGINT',()=>{if(stopping)process.exit(130);stopping=true;console.log('\nAbbruch: laufende Abrufe werden beendet (noch einmal Strg+C zum sofortigen Ende).');});
const report=label=>{const s=(Date.now()-started)/1000;console.log(`${new Date().toISOString().slice(11,19)} ${label||''}${done} geladen: ${c.ok} ok, ${c.unsupported} kein PDF, ${c.error} Fehler, Ablage ${mb(size)}, ${(done/s).toFixed(1)}/s`);};
const timer=setInterval(()=>report(),60000);
// Feste Grenze mit Tausch: PDFs und Texte zusammen höchstens --budget-gb
const keeper=o.budgetGb&&!flag('dry-run')?makeKeeper(store,o.budgetGb*1073741824,{ocrWorkers:o.ocrWorkers,log:x=>console.log(x)}):null;
if(keeper)console.log(`Grenze ${o.budgetGb} GB (PDFs und Texte), belegt ${mb(usedBytes(store))}`);
async function one(h,job){
 try{
  const bytes=await download(job.url);
  const status=store.put(job.url,bytes,{regionId:job.region,topicId:job.topic,...job.meta});c[status]++;h.fails=0;
  if(status==='ok'){c.bytes+=bytes.byteLength;size+=bytes.byteLength;if(keeper){await keeper.admit(store.entry(job.url).sha256);size=store.size();}}
  if(stepBytes&&size>=nextStep){console.log(`MEILENSTEIN ${mb(size)} in der Ablage (${c.ok} PDFs in diesem Lauf, aktueller Monat ${month})`);while(nextStep<=size)nextStep+=stepBytes;}
  if(maxBytes&&size>=maxBytes)stopping=true;
 }catch(e){
  c.error++;h.fails++;store.fail(job.url,e.message,{http:e.http??null,regionId:job.region,topicId:job.topic});
  // Server bremst oder ist gestört: für diesen Zeitraum aufgeben (die Adressen bleiben offen für den nächsten Lauf).
  if(e.http===429||e.http===503||h.fails>=3)h.queue.length=0;
 }
}
const work=hosts=>new Promise(resolve=>{
 let running=0;
 const loop=setInterval(()=>{
  if(o.maxMinutes&&Date.now()-started>o.maxMinutes*60000)stopping=true;
  const now=Date.now();
  if(!stopping)for(const h of hosts.values()){
   if(running>=o.concurrency)break;
   if(!h.queue.length||h.busy>=o.perHost||h.next>now)continue;
   const job=h.queue.shift();h.busy++;running++;h.next=now+o.gapMs;
   one(h,job).finally(()=>{h.busy--;running--;done++;});
  }
  if(!running&&(stopping||[...hosts.values()].every(h=>!h.queue.length))){clearInterval(loop);resolve();}
 },50);
});

// Zeiträume: mit --months Monat für Monat ab dem laufenden zurück (der erste schließt künftige Sitzungen ein), sonst einer.
const ym=d=>d.toISOString().slice(0,7)+'-01',back=(d,n)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-n,1));
const windows=o.months?Array.from({length:o.months},(_,i)=>[ym(back(new Date(),i)),i?ym(back(new Date(),i-1)):null]):[[o.since,null]];
let month='';
for(const [from,to] of windows){
 if(stopping)break;
 month=(from||'alles').slice(0,7);
 const t0=Date.now(),{hosts,total,have,open}=collect(from,to);
 console.log(`${month}: ${total} Hauptdokumente, ${have} schon in der Ablage, ${open} zu laden von ${hosts.size} Servern (${((Date.now()-t0)/1000).toFixed(0)} s)`);
 if(flag('dry-run')){for(const [h,q] of [...hosts].sort((a,b)=>b[1].queue.length-a[1].queue.length).slice(0,15))console.log(String(q.queue.length).padStart(8),h);continue;}
 await work(hosts);
 report(month+' fertig: ');
}
db.close();clearInterval(timer);
if(keeper){await keeper.close();const k=keeper.stats();console.log(`Grenze: ${k.kept} behalten, ${k.swapped} schlechtere verdrängt, ${k.rejected} nicht besser, ${k.tooBig} zu groß (nur Text), ${k.ocrPages} Seiten vor dem Löschen per OCR${k.stuck?`, ${k.stuck} Scans ohne OCR-Werkzeuge liegen geblieben`:''}; belegt ${mb(usedBytes(store))}`);}
if(maxBytes&&size>=maxBytes)console.log(`ZIEL ERREICHT: ${mb(size)} in der Ablage`);
for(const r of store.stats())console.log('Ablage:',r.status,r.n,r.bytes?mb(r.bytes):'');
store.close();
