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
//   node scripts/pdf-store/fetch.mjs --months 240 --budget-gb 80 [--start-month 2025-11]
//        feste Grenze mit Tausch (keeper in store-lib.mjs): lädt weiter, auch wenn die Ablage voll ist; jede neue Datei wird
//        sofort bewertet und verdrängt die schlechteste, wenn sie besser ist, sonst fliegt sie selbst raus (Text bleibt immer)
//   node scripts/pdf-store/fetch.mjs --others --months 240 --budget-gb 80
//        statt der Hauptdokumente die übrigen PDFs der Berichte (Anlagen, Pläne …; nicht, was irgendwo Hauptdokument ist):
//        eigener Lauf (Auftrag „Übrige PDFs laden“ im Admin-Reiter), gleiche Grenze mit Tausch (role 'other' in der Ablage);
//        was nicht in die Grenze passt, bleibt nur als Text. OCR für beide Arten: Auftrag „OCR starten“ (text.mjs --ocr)
//   node scripts/pdf-store/fetch.mjs --stats                       Stand der Ablage
//   node scripts/pdf-store/fetch.mjs --errors [--csv datei.csv]    fehlgeschlagene Abrufe: je Dokument Fehler, HTTP-Code, Tag
// Fehlerspeicher (Migration 0040, scripts/pdf-store/failures.mjs): Jeder Fehlschlag wird mit Klasse in work_failures vermerkt,
// ein Erfolg löscht den Eintrag. Fehlgeschlagene Adressen lädt dieser Lauf nicht erneut; das macht der Job „nacharbeit“ mit
// --urls <Datei> (eine Adresse je Zeile), wenn der Eintrag fällig ist. Server, die warten (source_hosts), werden ausgelassen;
// ein fälliger Server bekommt zuerst eine Stichprobe (SAMPLE Adressen), der Rest folgt nach dem ersten Erfolg. Beim ersten Lauf
// werden die alten Fehler der Ablage übertragen (seedFromStore).
//   --since-updated <ISO>  nur Berichte, die seitdem geschrieben wurden (Tagespipeline pdf-daily); dazu --event-from <JJJJ-MM-TT>:
//                          auch alle Berichte mit Sitzung ab diesem Tag (Tagesbereich), falls updated_at älter ist (OParl)
//   --origin daily|backlog Herkunft der Einträge im Fehlerspeicher (Standard: nach Sitzungstag, letzte 14 Tage = daily)
// Ohne Migration 0040 wie früher: Fehler nur mit --retry-days N erneut; Server mit mindestens 10 Abrufen und 90 % Fehlern
// werden ausgelassen (nicht mit --retry-days und nicht mit --all-hosts).
// Ablage: RM_PDF_STORE (Standard tmp/pdf-store). Datenbank: DATABASE_FILE, sonst die Miniflare-Datei unter .wrangler/.
// Jede Minute: Fortschritt nach system_state (Admin-Reiter) und Prüfung, ob der Lauf angehalten wurde (state.mjs); angehalten
// wird wie bei Strg+C (laufende Abrufe zu Ende, dann Schluss).
import {existsSync,readdirSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {primaryPdf,reportTypes} from '../../shared/document-type.mjs';
import {MAX_BYTES} from '../../shared/pdf-rank.mjs';
import {keeper as makeKeeper,usedBytes,errorReason,downloader,pdfUses,BLOCK_MIN,BLOCK_SHARE} from './store-lib.mjs';
import {progress,onStop,stepSummary,lane} from './state.mjs';
import {openFailures,seedFromStore,originOf,SAMPLE} from './failures.mjs';
import {readFileSync} from 'node:fs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const o={regions:opt('regions')?.split(',').filter(Boolean),since:opt('since'),limit:Number(opt('limit',0)),maxMinutes:Number(opt('max-minutes',0)),
 concurrency:Number(opt('concurrency',32)),perHost:Number(opt('per-host',3)),gapMs:Number(opt('gap-ms',200)),timeoutMs:Number(opt('timeout-ms',10000)),months:Number(opt('months',0)),maxGb:Number(opt('max-gb',0)),budgetGb:Number(opt('budget-gb',0)),reportMb:Number(opt('report-mb',500)),retryDays:Number(opt('retry-days',Infinity))};
// Abruf wie /api/dokument mit der Projektkennung (downloader in store-lib.mjs). Anhalten bricht laufende Abrufe ab (halt);
// sie gelten nicht als Fehler und bleiben offen für den nächsten Lauf.
const halt=new AbortController();
const download=downloader({timeoutMs:o.timeoutMs,signal:halt.signal});
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

// Fehlerspeicher (schreibende Verbindung, nur wenn Migration 0040 da ist); beim ersten Mal die alten Fehler übertragen
const F=flag('dry-run')?null:await openFailures({file});
if(F){const s=await seedFromStore(store,F);if(s)console.log(`Fehlerspeicher angelegt: ${s.pdf} Abruffehler, ${s.ocrFetch} OCR-Nachladefehler, ${s.slow} zu langsame OCR, ${s.hosts} Server gebremst oder gesperrt`);}
// Mit Fehlerspeicher lädt der normale Lauf keine fehlgeschlagene Adresse erneut (das macht die Nacharbeit)
if(F&&!args.includes('--retry-days'))o.retryDays=Infinity;
const urlList=opt('urls')?new Set(readFileSync(opt('urls'),'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)):null;
const sinceUpdated=opt('since-updated'),eventFrom=opt('event-from'),originOpt=opt('origin');
const failKey=F?F.known('pdf'):new Set();
const originFor=date=>originOpt==='daily'||originOpt==='backlog'?originOpt:originOf(date);

// Formalie wie in der Suche (search_cards.formal, drizzle/0017); ohne Spalte unbekannt.
const formalSql=db.prepare("SELECT 1 FROM pragma_table_info('search_cards') WHERE name='formal'").get()?'(SELECT formal FROM search_cards c WHERE c.id=topics.id)':'NULL';
// Server, die nicht liefern: mit Fehlerspeicher die Serverstufe (source_hosts), sonst aus der Ablage (alle bisherigen Abrufe je Server)
const blocked=new Set();
if(F){const n=[...F.hosts.values()].filter(h=>F.waiting(h.host)).length;if(n)console.log(`${n} Server warten laut Fehlerspeicher und werden ausgelassen; ${[...F.hosts.keys()].filter(h=>F.due(h)).length} sind fällig für eine Stichprobe`);}
else if(!flag('all-hosts')&&!Number.isFinite(o.retryDays)){
 const by=new Map();
 for(const r of store.db.prepare('SELECT url,status FROM pdfs').iterate()){let h;try{h=new URL(r.url).host;}catch{continue;}const x=by.get(h)||{n:0,bad:0};x.n++;if(r.status==='error'||r.status==='unsupported')x.bad++;by.set(h,x);}
 for(const [h,x] of by)if(x.n>=BLOCK_MIN&&x.bad/x.n>=BLOCK_SHARE)blocked.add(h);
 if(blocked.size)console.log(`${blocked.size} Server ausgelassen (mindestens ${BLOCK_MIN} Abrufe, davon mindestens ${BLOCK_SHARE*100} % fehlgeschlagen); ihre Dokumente bleiben offen`);
}
let skipped=0;
// --others: Adressen, die in irgendeinem Bericht Hauptdokument sind, lädt der normale Lauf (mit OCR)
// Hauptdokument wie in Zusammenfassung und Fakten: nie ein PDF, das an vielen Berichten hängt (Unterlage der ganzen Sitzung)
const uses=pdfUses(db),usesOf=u=>uses.get(u)||0;
const others=flag('others'),primaryUrls=new Set();
if(others){
 const t0=Date.now();
 for(const r of db.prepare("SELECT json_extract(payload,'$.documents') AS docs FROM topics WHERE payload LIKE '%application/pdf%'").iterate()){
  try{const d=primaryPdf(JSON.parse(r.docs||'[]'),{uses:usesOf});if(d?.url)primaryUrls.add(d.url);}catch{/* kaputte Angabe */}
 }
 console.log(`Übrige PDFs: ${primaryUrls.size} Hauptdokumente ausgenommen (${((Date.now()-t0)/1000).toFixed(0)} s)`);
}
const what=others?'übrige PDFs':'Hauptdokumente';
// Hauptdokumente, die nur noch als Text vorliegen (verdrängt, nicht zu groß), wieder laden, solange übrige PDFs als PDF
// liegen: die stehen in der Grenze immer darunter und weichen zuerst. Ohne solche nicht, sonst flögen sie gleich wieder raus.
const refetch=!others&&o.budgetGb>0&&!!store.db.prepare("SELECT 1 FROM pdfs WHERE status='ok' AND role='other' LIMIT 1").get();
const textOnlyBelow=refetch?MAX_BYTES:0;
if(refetch){const n=store.db.prepare("SELECT COUNT(*) AS n FROM pdfs WHERE status='text-only' AND COALESCE(role,'')<>'other' AND bytes<=?").get(MAX_BYTES).n;if(n)console.log(`${n} Hauptdokumente nur als Text werden wieder geladen (übrige PDFs weichen)`);}
// --urls: die Berichte zu den Adressen aus der Ablage (topic_id des Eintrags); Adressen ohne Eintrag werden gemeldet
function urlTopics(){
 const ids=new Set(),missing=[];
 for(const u of urlList){const t=store.db.prepare('SELECT topic_id FROM pdfs WHERE url=?').get(u)?.topic_id;if(t)ids.add(t);else missing.push(u);}
 if(missing.length&&!urlTopics.told){urlTopics.told=true;console.log(`${missing.length} Adressen ohne Bericht in der Ablage, übersprungen`);}
 return [...ids];
}
// Aufträge eines Zeitraums sammeln: eine Adresse je Bericht (mit --others die übrigen PDFs), jede Adresse einmal, nach Server
// gruppiert (neueste zuerst).
function collect(from,to){
 const base=["payload LIKE '%application/pdf%'"],baseParams=[];
 if(o.regions){base.push(`region_id IN (${o.regions.map(()=>'?').join(',')})`);baseParams.push(...o.regions);}
 if(urlList){base.push('id IN (SELECT value FROM json_each(?))');baseParams.push(JSON.stringify(urlTopics()));}
 // Tagespipeline (--since-updated, --event-from): zwei Abfragen, jede über einen Index: seit dem letzten Lauf geschriebene Berichte
 // (idx_topics_canonical_updated braucht die Bedingung für kanonische Berichte) und alle Berichte mit Sitzung im Tagesbereich
 // (idx_topics_event_date; updated_at ist bei OParl das Änderungsdatum der Quelle, nicht der Import). Sonst der Zeitraum.
 const variants=[];
 if(sinceUpdated){
  variants.push([[...base,'updated_at>=?',`json_extract("topics"."payload",'$.identity.mergedInto') IS NULL`],[...baseParams,sinceUpdated]]);
  if(eventFrom)variants.push([[...base,'event_date>=?'],[...baseParams,eventFrom]]);
 }else{
  const where=[...base],params=[...baseParams];
  if(from){where.push('event_date>=?');params.push(from);}
  if(to){where.push('event_date<?');params.push(to);}
  variants.push([where,params]);
 }
 const seen=new Set(),hosts=new Map();let total=0,have=0,open=0;
 for(const [where,params] of variants)for(const r of db.prepare(`SELECT id,region_id AS region,event_date AS date,json_extract(payload,'$.documents') AS docs,${formalSql} AS formal FROM topics WHERE ${where.join(' AND ')} ORDER BY event_date DESC`).iterate(...params)){
  let docs;try{docs=JSON.parse(r.docs||'[]');}catch{continue;}
  const p=primaryPdf(docs,{uses:usesOf}),types=reportTypes(docs);
  // --urls (Nacharbeit): alle PDFs des Berichts, die Adresse entscheidet; auch Anlagen (ihre Fehlschläge stehen unter demselben
  // Schritt 'pdf' wie Hauptdokumente), sonst kämen Anlagen nie wieder dran. Rolle wie beim ersten Abruf, sonst nach Stellung im Bericht.
  const pdfs=docs.filter(x=>x?.kind==='application/pdf'&&x.url);
  for(const d of urlList?pdfs.filter(x=>urlList.has(x.url)):others?pdfs.filter(x=>x.url!==p?.url&&!primaryUrls.has(x.url)):[p]){
   if(!d?.url||seen.has(d.url))continue;
   const role=others?'other':urlList?(store.entry(d.url)?.role||(d.url!==p?.url?'other':null)):null;
   seen.add(d.url);total++;
   if(!urlList&&!store.wants(d.url,{retryDays:o.retryDays,textOnlyBelow})){
    // Ältere Fehler übriger PDFs ohne Rolle (vor dem 14.10.2026) einmal nachtragen
    if(others){const e=store.entry(d.url);if(e&&!e.role&&(e.status==='error'||e.status==='unsupported'))store.setMeta(d.url,{role:'other'});}
    have++;continue;
   }
   if(o.limit&&open>=o.limit)continue;
   let host;try{host=new URL(d.url).host;}catch{continue;}
   if(blocked.has(host)||F?.waiting(host)){skipped++;continue;}
   if(!hosts.has(host))hosts.set(host,{queue:[],held:[],busy:0,next:0,fails:0,sample:!!F?.due(host)});
   const h=hosts.get(host),job={url:d.url,region:r.region,topic:r.id,meta:{docType:types.get(d.url)||'other',formal:r.formal,eventDate:r.date,...(role?{role}:{})}};
   // Fälliger Server: erst SAMPLE Adressen, der Rest wartet auf den ersten Erfolg
   (h.sample&&h.queue.length>=SAMPLE?h.held:h.queue).push(job);open++;
  }
 }
 return {hosts,total,have,open};
}

// Abrufen: höchstens `concurrency` gleichzeitig, je Server `perHost` und `gapMs` Abstand.
const started=Date.now(),c={ok:0,unsupported:0,error:0,bytes:0};let stopping=false,done=0;
const maxBytes=o.maxGb*1073741824,stepBytes=o.reportMb*1048576;let size=store.size(),nextStep=(Math.floor(size/stepBytes)+1)*stepBytes;
const report=label=>{const s=(Date.now()-started)/1000;console.log(`${new Date().toISOString().slice(11,19)} ${label||''}${done} geladen: ${c.ok} ok, ${c.unsupported} kein PDF, ${c.error} Fehler, Ablage ${mb(size)}, ${(done/s).toFixed(1)}/s`);};
// Fortschritt für den Admin-Reiter; ohne nightly.mjs (von Hand) als eigener Lauf
const myLane=lane('chain'),live=!flag('dry-run');
let monthOpen=0,halted=false;
// Anhalten (Admin-Reiter alle 2 s, Signal von nightly.mjs oder systemctl stop, Strg+C): keine neuen Abrufe, laufende abbrechen,
// nichts mehr verdrängen; was schon geladen ist, bleibt
onStop(live?myLane:null,Date.now(),why=>{stopping=halted=true;halt.abort();console.log(`Angehalten (${why==='admin'?'Admin-Reiter':why}): laufende Abrufe abgebrochen, sie bleiben offen.`);});
const tell=()=>{if(!live)return;const s=(Date.now()-started)/1000;
 progress(myLane,{...(process.env.RM_PROGRESS_BASE?{}:{kind:others?'others':'fetch',startedAt:new Date(started).toISOString()}),step:'Laden',
  fetch:{what:others?'others':'primary',month,monthOpen,done,ok:c.ok,unsupported:c.unsupported,error:c.error,rate:Math.round(done/Math.max(1,s)*10)/10,bytes:Math.round(size)}});};
const timer=setInterval(()=>{report();tell();},60000);
// Feste Grenze mit Tausch: PDFs und Texte zusammen höchstens --budget-gb
const keeper=o.budgetGb&&!flag('dry-run')?makeKeeper(store,o.budgetGb*1073741824,{halt:()=>halted}):null;
if(keeper)console.log(`Grenze ${o.budgetGb} GB (PDFs und Texte), belegt ${mb(usedBytes(store))}`);
async function one(h,job){
 const host=(()=>{try{return new URL(job.url).host;}catch{return null;}})();
 const origin=originFor(job.meta?.eventDate);
 try{
  const bytes=await download(job.url);
  const status=store.put(job.url,bytes,{regionId:job.region,topicId:job.topic,...job.meta});c[status]++;h.fails=0;
  // Server liefert: Stufe ok, zurückgehaltene Adressen der Stichprobe freigeben
  if(F&&host&&F.hosts.has(host))await F.hostOk(host);
  if(h.held?.length){h.queue.push(...h.held);h.held.length=0;h.sample=false;}
  if(F){if(status==='unsupported')await F.fail({step:'pdf',key:job.url,host,status,error:'kein PDF',eventDate:job.meta?.eventDate,origin});
   else if(failKey.has(job.url)){await F.ok({step:'pdf',key:job.url});failKey.delete(job.url);}}
  if(status==='ok'){c.bytes+=bytes.byteLength;size+=bytes.byteLength;if(keeper){await keeper.admit(store.entry(job.url).sha256);size=keeper.used();}}
  if(stepBytes&&size>=nextStep){console.log(`MEILENSTEIN ${mb(size)} in der Ablage (${c.ok} PDFs in diesem Lauf, aktueller Monat ${month})`);while(nextStep<=size)nextStep+=stepBytes;}
  if(maxBytes&&size>=maxBytes)stopping=true;
 }catch(e){
  if(halted)return;
  c.error++;h.fails++;store.fail(job.url,e.message,{http:e.http??null,regionId:job.region,topicId:job.topic,role:job.meta?.role||null});
  if(F){await F.fail({step:'pdf',key:job.url,host,http:e.http??null,error:e.message,eventDate:job.meta?.eventDate,origin,retryAfterMs:e.retryAfterMs??null});failKey.add(job.url);}
  // Server bremst oder ist gestört: für diesen Lauf aufgeben (die Adressen bleiben offen; mit Fehlerspeicher wartet er dort).
  if(e.http===429||e.http===503||h.fails>=3||F?.waiting(host)){h.queue.length=0;if(h.held)h.held.length=0;}
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
  if(!running&&(stopping||[...hosts.values()].every(h=>!h.queue.length))){
   // Stichproben ohne Erfolg: zurückgehaltene Adressen bleiben offen (der Server wartet im Fehlerspeicher)
   for(const h of hosts.values())if(h.held?.length){skipped+=h.held.length;h.held.length=0;}
   clearInterval(loop);resolve();}
 },50);
});

// Zeiträume: mit --months Monat für Monat ab dem laufenden zurück (der erste schließt künftige Sitzungen ein), sonst einer.
// --start-month JJJJ-MM: erst ab diesem Monat zurück (etwa wenn die jüngeren schon abgearbeitet sind)
const ym=d=>d.toISOString().slice(0,7)+'-01',back=(d,n)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-n,1));
const startMonth=opt('start-month');
if(startMonth&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)){console.error('--start-month als JJJJ-MM angeben');process.exit(1);}
const first=startMonth?new Date(startMonth+'-01T00:00:00Z'):new Date();
const windows=o.months?Array.from({length:o.months},(_,i)=>[ym(back(first,i)),i||startMonth?ym(back(first,i-1)):null]):[[o.since,null]];
let month='';
for(const [from,to] of windows){
 if(stopping)break;
 month=(from||'alles').slice(0,7);
 const t0=Date.now(),{hosts,total,have,open}=collect(from,to);
 monthOpen=open;tell();
 console.log(`${month}: ${total} ${what}, ${have} schon in der Ablage, ${open} zu laden von ${hosts.size} Servern (${((Date.now()-t0)/1000).toFixed(0)} s)`);
 if(flag('dry-run')){for(const [h,q] of [...hosts].sort((a,b)=>b[1].queue.length-a[1].queue.length).slice(0,15))console.log(String(q.queue.length).padStart(8),h);continue;}
 await work(hosts);
 report(month+' fertig: ');
}
db.close();clearInterval(timer);
if(keeper){await keeper.close();const k=keeper.stats();console.log(`Grenze: ${k.kept} behalten, ${k.swapped} schlechtere verdrängt, ${k.rejected} nicht besser, ${k.tooBig} zu groß (nur Text); belegt ${mb(usedBytes(store))}`);}
if(maxBytes&&size>=maxBytes)console.log(`ZIEL ERREICHT: ${mb(size)} in der Ablage`);
if(skipped)console.log(`${skipped} Dokumente von ausgelassenen Servern übersprungen`);
for(const r of store.stats())console.log('Ablage:',r.status,r.n,r.bytes?mb(r.bytes):'');
stepSummary({what:others?'others':'primary',ok:c.ok,unsupported:c.unsupported,error:c.error,bytes:c.bytes,skipped,lastMonth:month,stopped:halted,
 keeper:keeper?.stats()||null,used:Math.round(usedBytes(store)),...(F?{failures:{...F.counts}}:{})});
F?.close();
if(live&&!process.env.RM_PROGRESS_BASE)progress(myLane,null);
store.close();
