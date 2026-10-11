// Stand der PDF-Ablage für den Admin-Reiter „PDF-Ablage“ (server/integrations/pdf-store-admin.mjs): wie viele PDF-Dokumente
// die Berichte verlinken (Hauptdokument je Bericht, wie fetch.mjs es lädt, und alle PDF-Dokumente), wie viele davon geladen,
// nur als Text, fehlgeschlagen oder noch offen sind, Fehlergründe, Platz. Schreibt das Ergebnis nach system_state
// ('pdf-store-stats'); läuft am Ende jedes Laufs (nightly.mjs) und braucht rund eine Minute.
//
//   node scripts/pdf-store/stats.mjs [--budget-gb 100] [--print]
// Ablage: RM_PDF_STORE (Standard tmp/pdf-store). Datenbank: DATABASE_FILE, sonst die Miniflare-Datei unter .wrangler/.
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {primaryPdf} from '../../shared/document-type.mjs';
import {textBytes,errorReason} from './store-lib.mjs';
import {STATS_KEY} from '../../server/integrations/pdf-store-admin.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const file=process.env.DATABASE_FILE||(local?dir+local:null);
if(!file){console.error('Keine Datenbank (DATABASE_FILE oder .wrangler/).');process.exit(1);}
const t0=Date.now(),db=new DatabaseSync(file),store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);

/* Verlinkte PDFs: je Bericht das Hauptdokument (wie fetch.mjs), dazu alle PDF-Dokumente; jede Adresse einmal */
// primary: Adresse → frühester Sitzungstag (für „ältestes Dokument“)
const primary=new Map(),all=new Set();
for(const r of db.prepare("SELECT event_date AS date,json_extract(payload,'$.documents') AS docs FROM topics WHERE payload LIKE '%application/pdf%'").iterate()){
 let docs;try{docs=JSON.parse(r.docs||'[]');}catch{continue;}
 for(const d of docs)if(d?.url&&d.kind==='application/pdf')all.add(d.url);
 const p=primaryPdf(docs),d=String(r.date||'').slice(0,10);if(p?.url&&(!primary.has(p.url)||d&&d<primary.get(p.url)))primary.set(p.url,d);
}
/* Stand je Adresse aus der Ablage, nur für verlinkte Hauptdokumente */
const c={ok:0,'text-only':0,error:0,unsupported:0},reasons=new Map();let withText=0,textComplete=0,oldestLoaded='',oldestTried='';
for(const r of store.db.prepare("SELECT p.url,p.status,p.http,p.error,t.status AS textStatus,t.ocr_needed AS ocrNeeded FROM pdfs p LEFT JOIN texts t ON t.sha256=p.sha256").iterate()){
 if(!primary.has(r.url))continue;
 c[r.status]=(c[r.status]||0)+1;
 /* Wie weit der Lauf zurück ist: ältestes geladene Dokument und ältestes überhaupt versuchte */
 const d=primary.get(r.url);
 if(d){if(!oldestTried||d<oldestTried)oldestTried=d;if((r.status==='ok'||r.status==='text-only')&&(!oldestLoaded||d<oldestLoaded))oldestLoaded=d;}
 // Text vorhanden; vollständig heißt: keine Seite wartet mehr auf OCR
 if(r.textStatus==='ok'){withText++;if(!(r.ocrNeeded>0))textComplete++;}
 if(r.status==='error'||r.status==='unsupported'){const k=errorReason(r);reasons.set(k,(reasons.get(k)||0)+1);}
}
const tx=store.db.prepare("SELECT COUNT(*) AS files,SUM(ocr_needed>0) AS waiting FROM texts WHERE status='ok'").get();
const pdfBytes=store.size(),text=textBytes(store);
const stats={
 at:new Date().toISOString(),seconds:Math.round((Date.now()-t0)/1000),
 linked:primary.size,allPdfs:all.size,
 oldest:{loaded:oldestLoaded||null,tried:oldestTried||null,linked:[...primary.values()].filter(Boolean).sort()[0]||null},
 loaded:c.ok,textOnly:c['text-only'],failed:c.error+c.unsupported,open:Math.max(0,primary.size-c.ok-c['text-only']-c.error-c.unsupported),
 reasons:[...reasons].sort((a,b)=>b[1]-a[1]).map(([reason,n])=>({reason,n})),
 bytes:{pdf:pdfBytes,text:Math.round(text),used:Math.round(pdfBytes+text)},budgetGb:Number(opt('budget-gb',100)),
 texts:{files:Number(tx.files||0),ocrWaiting:Number(tx.waiting||0),linked:withText,complete:textComplete},
};
db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(STATS_KEY,JSON.stringify(stats));
db.close();store.close();
if(flag('print'))console.log(JSON.stringify(stats,null,1));
else console.log(`${stats.linked} Hauptdokumente verlinkt (${stats.allPdfs} PDF-Dokumente), ${stats.loaded} geladen, ${stats.textOnly} nur Text, ${stats.failed} fehlgeschlagen, ${stats.open} offen, ${withText} mit Text (${textComplete} vollständig) (${stats.seconds} s)`);
