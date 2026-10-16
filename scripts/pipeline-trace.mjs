// Wege der Berichte durch die Tagespipeline zählen (Debug-Seite im Admin, vorübergehend; Betriebsplan 15.10.2026). Für die
// Berichte, die in den letzten 24 Stunden bzw. 7 Tagen geschrieben wurden (topics.updated_at, nur kanonische): wie viele haben ein
// PDF, ein Hauptdokument (oder nur eine Sitzungsunterlage), liegt es in der Ablage (geladen, nur Text, Fehler, nicht versucht),
// gibt es eine Textfassung, warten Seiten auf OCR, wurden die Regeln gelesen (report_rules), gibt es eine Regel-Zusammenfassung,
// eine Titelregel-Einordnung, eine KI-Fassung; dazu die Einträge im Fehlerspeicher je Schritt. Ergebnis in system_state
// 'pipeline-trace'; die Seite liest nur das. Läuft am Ende von „Themen & Texte“ (rule-texts.mjs) und auf Knopfdruck nicht
// (die Zählung liest alle in der Zeit geschriebenen Berichte, einige Sekunden bis Minuten).
//
//   node scripts/pipeline-trace.mjs [--dry-run]     Umgebung: DATABASE_FILE, RM_PDF_STORE
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../server/node/pdf-store.mjs';
import {mainDocument} from '../server/integrations/report-rules.mjs';
import {databaseFile,writeState,stepSummary} from './pdf-store/state.mjs';
import {pdfUses} from './pdf-store/store-lib.mjs';
import {LABEL_VERSION} from '../shared/labels.mjs';

export const TRACE_KEY='pipeline-trace';
const dry=process.argv.includes('--dry-run'),t0=Date.now();
const file=databaseFile();
if(!file){console.error('Keine Datenbank (DATABASE_FILE oder .wrangler/).');process.exit(1);}
const db=new DatabaseSync(file,{readOnly:true});db.exec('PRAGMA busy_timeout=30000');
let store=null;try{store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);}catch{/* ohne Ablage: nur Bericht und Regeln */}
const has=t=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name=?").get(t);
const now=Date.now(),windows=[['24h',24],['7d',24*7]];
const since=Object.fromEntries(windows.map(([k,h])=>[k,new Date(now-h*3600000).toISOString()]));
const oldest=since['7d'];

const uses=pdfUses(db),U=u=>uses.get(u)||0,hasText=u=>!!store?.textMark(u);
const rules=has('report_rules')?db.prepare('SELECT read_at,summary_issue FROM report_rules WHERE topic_id=?'):null;
const ai=has('ai_work_items')?db.prepare('SELECT state FROM ai_work_items WHERE topic_id=?'):null;
const failPdf=has('work_failures')?db.prepare("SELECT class FROM work_failures WHERE step='pdf' AND key=?"):null;
const textRow=store?store.db.prepare('SELECT t.status,t.ocr_needed AS need,t.ocr_pages AS ocr,t.method FROM pdfs p JOIN texts t ON t.sha256=p.sha256 WHERE p.url=?'):null;

/* Zähler je Fenster: eine Stufe je Feld, damit die Seite den Weg als Kette zeigen kann */
const empty=()=>({written:0,withPdf:0,noPdf:0,main:0,session:0,noMain:0,
 pdf:{ok:0,'text-only':0,error:0,unsupported:0,none:0},failures:{},
 text:{ok:0,missing:0,error:0},ocr:{none:0,waiting:0,done:0},
 rules:{read:0,stale:0,never:0},summary:{yes:0,no:0},label:{yes:0,no:0},ai:{completed:0,other:0,none:0}});
const c=Object.fromEntries(windows.map(([k])=>[k,empty()]));
const add=(k,f)=>{for(const [w] of windows)if(k>=since[w])f(c[w]);};

const q=db.prepare(`SELECT id,updated_at AS at,json_extract(payload,'$.documents') AS docs,json_extract(payload,'$.classification.version') AS label
 FROM topics INDEXED BY idx_topics_canonical_updated WHERE active=1 AND updated_at>=?`);
let n=0;
for(const r of q.iterate(oldest)){
 n++;
 let docs=[];try{docs=JSON.parse(r.docs||'[]');}catch{/* ohne Dokumente */}
 const pdfs=docs.filter(d=>d?.kind==='application/pdf'&&d.url);
 const {doc,session}=pdfs.length?mainDocument(docs,{uses:U,hasText}):{doc:null,session:false};
 const entry=doc&&!session&&store?store.entry(doc.url):null;
 const status=doc&&!session?entry?.status||'none':null;
 const fail=doc&&!session&&failPdf?failPdf.get(doc.url)?.class:null;
 const t=doc&&!session&&textRow?textRow.get(doc.url):null;
 const rr=rules?.get(r.id),aw=ai?.get(r.id);
 add(r.at,x=>{
  x.written++;
  if(!pdfs.length){x.noPdf++;}
  else{x.withPdf++;
   if(!doc)x.noMain++;else if(session)x.session++;
   else{x.main++;x.pdf[status]=(x.pdf[status]||0)+1;if(fail)x.failures[fail]=(x.failures[fail]||0)+1;
    if(status==='ok'||status==='text-only'){
     if(!t)x.text.missing++;else if(t.status!=='ok')x.text.error++;else{x.text.ok++;
      if(t.need>0)x.ocr.waiting++;else if(t.ocr>0)x.ocr.done++;else x.ocr.none++;}
    }}}
  if(!rr)x.rules.never++;else if(rr.read_at>=r.at)x.rules.read++;else x.rules.stale++;
  if(rr&&rr.summary_issue==null)x.summary.yes++;else x.summary.no++;
  if(r.label===LABEL_VERSION)x.label.yes++;else x.label.no++;
  if(!aw)x.ai.none++;else if(aw.state==='completed')x.ai.completed++;else x.ai.other++;
 });
}
/* Fehlerspeicher je Schritt, Klasse und Herkunft (alle Einträge, nicht nur die Fenster) */
const failures=has('work_failures')?db.prepare('SELECT step,class,origin,count(*) n,sum(next_try_at IS NULL) final FROM work_failures GROUP BY 1,2,3').all():[];
/* Importe der Fenster (import_runs: je Gebiet und Teilabruf eine Zeile) */
const imports=Object.fromEntries(windows.map(([w])=>[w,Object.fromEntries(db.prepare('SELECT status,count(*) n FROM import_runs WHERE started_at>=? GROUP BY status').all(since[w]).map(x=>[x.status,x.n]))]));
const result={at:new Date().toISOString(),seconds:Math.round((Date.now()-t0)/1000),reports:n,windows:Object.fromEntries(windows.map(([w,h])=>[w,{since:since[w],hours:h,...c[w],imports:imports[w]}])),failures};
console.log(`${n} Berichte der letzten 7 Tage gezählt (${result.seconds} s): 24 h ${c['24h'].written}, 7 Tage ${c['7d'].written}`);
if(!dry)writeState(TRACE_KEY,result);
stepSummary({reports:n,day:c['24h'].written,week:c['7d'].written});
store?.close();db.close();
