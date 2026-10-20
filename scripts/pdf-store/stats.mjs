// Stand der PDF-Ablage für den Admin-Reiter „PDF-Import“ (server/integrations/pdf-store-admin.mjs): wie viele PDF-Dokumente
// die Berichte verlinken (Hauptdokument je Bericht, wie fetch.mjs es lädt, und die übrigen PDFs), wie viele davon geladen,
// nur als Text, fehlgeschlagen oder noch offen sind, je Sitzungsmonat, Fehlergründe, Server, die nicht liefern, Platz und
// Schwelle der Grenze, Qualität der Ablage (storeQuality), Festplatte, Zusammenfassungen. Schreibt das Ergebnis nach system_state ('pdf-store-stats') und die
// Fehlerliste je Dokument als gepacktes CSV ('pdf-store-errors-csv:N'); läuft am Ende jedes Laufs (nightly.mjs) und auf
// Wunsch („Stand neu zählen“, job.mjs), braucht etwa eine Minute.
//
//   node scripts/pdf-store/stats.mjs [--budget-gb 80] [--print]
// Ablage: RM_PDF_STORE (Standard tmp/pdf-store). Datenbank: DATABASE_FILE, sonst die Miniflare-Datei unter .wrangler/.
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {primaryPdf} from '../../shared/document-type.mjs';
import {textBytes,errorReason,rankedFiles,rankedTextOnly,storeQuality,pdfUses,BLOCK_MIN,BLOCK_SHARE} from './store-lib.mjs';
import {databaseFile} from './state.mjs';
import {BUDGET_GB} from '../../shared/pdf-rank.mjs';
import {STATS_KEY,ERRORS_KEY} from '../../server/integrations/pdf-store-admin.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const file=databaseFile();
if(!file){console.error('Keine Datenbank (DATABASE_FILE oder .wrangler/).');process.exit(1);}
const t0=Date.now(),db=new DatabaseSync(file),store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
db.exec('PRAGMA busy_timeout=30000');
const budgetGb=Number(opt('budget-gb',BUDGET_GB));
const hostOf=u=>{try{return new URL(u).host;}catch{return '';}};

/* 1. Ablage: Stand je Adresse; je Server Abrufe, Fehler, Gründe, letzter Erfolg */
const at=new Map(),hosts=new Map();
const hostRow=h=>{let x=hosts.get(h);if(!x)hosts.set(h,x={n:0,bad:0,reasons:new Map(),lastOk:'',open:0});return x;};
for(const r of store.db.prepare("SELECT p.url,p.status,p.http,p.error,p.fetched_at AS fetchedAt,t.status AS textStatus,t.ocr_needed AS ocrNeeded,t.pages FROM pdfs p LEFT JOIN texts t ON t.sha256=p.sha256").iterate()){
 at.set(r.url,r);
 const x=hostRow(hostOf(r.url));x.n++;
 if(r.status==='error'||r.status==='unsupported'){x.bad++;const k=errorReason(r);x.reasons.set(k,(x.reasons.get(k)||0)+1);}
 else if(r.fetchedAt>x.lastOk)x.lastOk=r.fetchedAt;
}

/* 2. Berichte: verlinkte PDFs mit frühestem Sitzungstag; Hauptdokument je Bericht (wie fetch.mjs); Zusammenfassungen */
const linked=new Map(),primary=new Set(),uses=pdfUses(db);let sumText=0,sumDone=0;
for(const r of db.prepare("SELECT event_date AS date,active,json_extract(payload,'$.documents') AS docs,json_extract(payload,'$.ruleSummary') IS NOT NULL AS sum FROM topics WHERE payload LIKE '%application/pdf%'").iterate()){
 let docs;try{docs=JSON.parse(r.docs||'[]');}catch{continue;}
 const d=String(r.date||'').slice(0,10);
 for(const x of docs)if(x?.url&&x.kind==='application/pdf'){const o=linked.get(x.url);if(o===undefined||d&&(!o||d<o))linked.set(x.url,d);}
 const p=primaryPdf(docs,{uses:u=>uses.get(u)||0});if(!p?.url)continue;
 primary.add(p.url);
 // Berichte mit Text im Hauptdokument und davon mit Regel-Zusammenfassung (nur aktive)
 if(r.active===1&&at.get(p.url)?.textStatus==='ok'){sumText++;if(r.sum)sumDone++;}
}

/* 3. Je Dokument einordnen: Hauptdokument oder übriges PDF, Monat, Stand; offen bei ausgelassenen Servern (fetch.mjs) getrennt.
   Ausgelassen ist mit Fehlerspeicher (Migration 0040) ein Server, der laut source_hosts gerade wartet; ohne ihn die alte Regel
   (mindestens BLOCK_MIN Abrufe, BLOCK_SHARE Fehler). */
const waiting=new Map(),nowIso=new Date().toISOString();
if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='source_hosts'").get())
 for(const r of db.prepare("SELECT host,state,next_try_at FROM source_hosts WHERE state<>'ok'").all())if(!r.next_try_at||r.next_try_at>nowIso)waiting.set(r.host,r);
const hasStages=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='source_hosts'").get();
const isBlocked=h=>{if(hasStages)return waiting.has(h);const x=hosts.get(h);return !!x&&x.n>=BLOCK_MIN&&x.bad/x.n>=BLOCK_SHARE;};
const blank=()=>({linked:0,ok:0,textOnly:0,failed:0,open:0,openBlocked:0});
const add=(c,s)=>{c.linked++;if(s==='ok')c.ok++;else if(s==='text-only')c.textOnly++;else if(s==='error'||s==='unsupported')c.failed++;else c.open++;};
const P={...blank(),withText:0,complete:0,reasons:new Map(),oldestLoaded:'',oldestTried:'',oldestLinked:''};
const O={...blank(),withText:0,scans:0,reasons:new Map()};
const months={primary:new Map(),others:new Map()};
for(const [url,date] of linked){
 const isP=primary.has(url),r=at.get(url),s=r?.status,C=isP?P:O,m=date?date.slice(0,7):'ohne Datum';
 add(C,s);
 const mm=isP?months.primary:months.others;if(!mm.has(m))mm.set(m,blank());add(mm.get(m),s);
 if(isP&&date&&(!P.oldestLinked||date<P.oldestLinked))P.oldestLinked=date;
 if(!r){const h=hostOf(url);hostRow(h).open++;if(isBlocked(h)){C.openBlocked++;mm.get(m).openBlocked++;}continue;}
 if(s==='error'||s==='unsupported'){const k=errorReason(r);C.reasons.set(k,(C.reasons.get(k)||0)+1);}
 if(isP){
  if(date&&(!P.oldestTried||date<P.oldestTried))P.oldestTried=date;
  if(date&&(s==='ok'||s==='text-only')&&(!P.oldestLoaded||date<P.oldestLoaded))P.oldestLoaded=date;
  // Text vorhanden; vollständig heißt: keine Seite wartet mehr auf OCR
  if(r.textStatus==='ok'){P.withText++;if(!(r.ocrNeeded>0))P.complete++;}
 }else if(r.textStatus==='ok'){
  // Nur Textebene: mit Text, wenn wenigstens eine Seite Text hat; sonst ein Scan ohne Text
  if((r.ocrNeeded||0)<r.pages)O.withText++;else O.scans++;
 }
}
const list=m=>[...m].sort((a,b)=>b[1]-a[1]).map(([reason,n])=>({reason,n}));
const monthList=m=>[...m].sort((a,b)=>b[0]<a[0]?-1:1).map(([month,c])=>({month,...c}));
/* Vollständig bis: vom laufenden Monat zurück (künftige Sitzungen zählen nicht), solange höchstens 5 % offen sind; Dokumente
   ausgelassener Server zählen nicht als offen, sie lädt nur der erneute Versuch */
const thisMonth=new Date().toISOString().slice(0,7);
const completeThrough=rows=>{let last=null;for(const r of rows){if(r.month==='ohne Datum'||r.month>thisMonth)continue;if(r.open-r.openBlocked>r.linked*0.05)break;last=r.month;}return last;};

/* 4. Platz und Schwelle der Grenze (wie keeper in store-lib.mjs) */
const files=rankedFiles(store),limit=budgetGb*1073741824,text=textBytes(store);
let pdfPrimary=0,pdfOthers=0;for(const f of files){if(f.other)pdfOthers+=f.bytes;else pdfPrimary+=f.bytes;}
const used=pdfPrimary+pdfOthers+text,kept=files.filter(f=>f.keep),worst=kept.at(-1);
// Ablage voll (über 98 %): der Score der schlechtesten behaltenen Datei bestimmt, was noch hineinkommt (neue Dateien darunter
// bleiben nur als Text); ist es ein übriges PDF, verdrängt jedes neue Hauptdokument zuerst übrige PDFs.
const threshold=used<limit*0.98||!worst?null:worst.other?{others:true}:{others:false,score:Math.round(worst.score*1000)/1000};
const PRIMARY_SQL="EXISTS(SELECT 1 FROM pdfs p WHERE p.sha256=t.sha256 AND COALESCE(p.role,'')<>'other')";
const tx=store.db.prepare(`SELECT COUNT(*) AS files,SUM(ocr_needed>0 AND ${PRIMARY_SQL}) AS waiting,SUM(CASE WHEN ocr_needed>0 AND ${PRIMARY_SQL} THEN ocr_needed ELSE 0 END) AS pages,
 SUM(ocr_needed>0) AS waitingAll,SUM(CASE WHEN ocr_needed>0 THEN ocr_needed ELSE 0 END) AS pagesAll FROM texts t WHERE status='ok'`).get();
const missing=store.db.prepare("SELECT COUNT(DISTINCT p.sha256) AS n FROM pdfs p LEFT JOIN texts t ON t.sha256=p.sha256 WHERE p.status='ok' AND t.sha256 IS NULL").get();
let disk=null;try{const s=fs.statfsSync(store.dir);disk={free:s.bavail*s.bsize,total:s.blocks*s.bsize};}catch{/* nicht ermittelbar */}

/* 5. Server, die nicht liefern: mit mindestens einem Fehler, nach offenen Dokumenten */
const hostList=[...hosts].filter(([h,x])=>h&&x.bad>0).map(([host,x])=>({host,n:x.n,bad:x.bad,open:x.open,lastOk:x.lastOk.slice(0,10)||null,
 reason:list(x.reasons)[0]?.reason||null,blocked:isBlocked(host),...(waiting.has(host)?{state:waiting.get(host).state,next:waiting.get(host).next_try_at}:{})}))
 .sort((a,b)=>b.open-a.open||b.bad-a.bad);

const pm=monthList(months.primary),om=monthList(months.others);
const stats={
 at:new Date().toISOString(),seconds:0,
 linked:P.linked,allPdfs:linked.size,
 oldest:{loaded:P.oldestLoaded||null,tried:P.oldestTried||null,linked:P.oldestLinked||null},completeThrough:completeThrough(pm),
 loaded:P.ok,textOnly:P.textOnly,failed:P.failed,open:P.open,openBlocked:P.openBlocked,reasons:list(P.reasons),
 quality:storeQuality(files,rankedTextOnly(store)),
 bytes:{pdf:pdfPrimary+pdfOthers,pdfPrimary,pdfOthers,text:Math.round(text),used:Math.round(used)},budgetGb,threshold,disk,
 // OCR (Auftrag „OCR starten“): alle Dateien; ocrWaiting/ocrPages nur Hauptdokumente
 texts:{files:Number(tx.files||0),ocrWaiting:Number(tx.waiting||0),ocrPages:Number(tx.pages||0),ocrWaitingAll:Number(tx.waitingAll||0),ocrPagesAll:Number(tx.pagesAll||0),missing:Number(missing.n||0),linked:P.withText,complete:P.complete},
 summaries:{withText:sumText,done:sumDone},
 others:{linked:O.linked,loaded:O.ok,textOnly:O.textOnly,failed:O.failed,open:O.open,openBlocked:O.openBlocked,withText:O.withText,scans:O.scans,reasons:list(O.reasons),completeThrough:completeThrough(om)},
 months:{primary:pm,others:om},
 hosts:{total:hostList.length,blocked:hostList.filter(h=>h.blocked).length,stages:!!hasStages,top:hostList.slice(0,100)},
};

/* 6. Fehlerliste je Dokument als CSV, gepackt, in Stücken (die Route setzt sie wieder zusammen) */
const q=v=>`"${String(v??'').replaceAll('"','""')}"`;
const csv='﻿url;art;bericht;gebiet;grund;http;fehler;tag\n'+store.db.prepare("SELECT url,topic_id AS topic,region_id AS region,status,http,error,fetched_at AS at FROM pdfs WHERE status IN ('error','unsupported') ORDER BY fetched_at DESC").all()
 .map(r=>[r.url,primary.has(r.url)?'Hauptdokument':'übriges PDF',r.topic,r.region,errorReason(r),r.http,r.error,r.at?.slice(0,10)].map(q).join(';')).join('\n')+'\n';
const b64=gzipSync(csv).toString('base64'),CHUNK=900000,parts=[];for(let i=0;i<b64.length;i+=CHUNK)parts.push(b64.slice(i,i+CHUNK));
stats.seconds=Math.round((Date.now()-t0)/1000);
stats.errorsCsv={rows:P.failed+O.failed,bytes:b64.length};
const put=db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
db.exec('BEGIN IMMEDIATE');
try{
 db.prepare('DELETE FROM system_state WHERE key LIKE ?').run(ERRORS_KEY+':%');
 parts.forEach((p,i)=>put.run(`${ERRORS_KEY}:${i}`,p));
 put.run(STATS_KEY,JSON.stringify(stats));
 db.exec('COMMIT');
}catch(e){db.exec('ROLLBACK');throw e;}
db.close();store.close();
if(flag('print'))console.log(JSON.stringify({...stats,months:{primary:pm.slice(0,3),others:om.slice(0,3)},hosts:{...stats.hosts,top:stats.hosts.top.slice(0,3)}},null,1));
else console.log(`${stats.linked} Hauptdokumente verlinkt (${stats.allPdfs} PDF-Dokumente), ${stats.loaded} geladen, ${stats.textOnly} nur Text, ${stats.failed} fehlgeschlagen, ${stats.open} offen, ${P.withText} mit Text (${P.complete} vollständig); übrige PDFs: ${O.linked} verlinkt, ${O.ok+O.textOnly} geladen, ${O.withText} mit Text, ${O.failed} fehlgeschlagen; ${hostList.length} Server mit Fehlern; Fehlerliste ${parts.length} Teile (${stats.seconds} s)`);
