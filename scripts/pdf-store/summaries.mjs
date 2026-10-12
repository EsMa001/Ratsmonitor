// Regelbasierte Zusammenfassungen aus der PDF-Ablage (server/node/pdf-store.mjs): für alle Berichte ohne ruleSummary, deren
// Hauptdokument (primaryPdf) als Text in der Ablage liegt, auch per OCR gelesen. Derselbe Weg wie der Import
// (refreshSummaries in server/services/sync.ts: enrichDocument, compactSummaryAttempt), nur ohne Internet und ohne KI;
// anders als dort auch Berichte, deren früherer Versuch am unlesbaren PDF scheiterte (summaryAttemptedAt).
// Schreibt in die lokale Datenbank (Bericht und article_analyses); Suchkarten und Kurztext führen die Trigger nach.
// Übersprungen werden Sitzungsunterlagen (sessionDocument, wie im Import): Niederschrift oder Einladung als Hauptdokument, oder
// ein Dokument an vielen Berichten (manche Systeme hängen Niederschrift oder Sitzungsmappe an jeden Tagesordnungspunkt; die Regel fasste dann die
// ganze Sitzung zusammen statt der Vorlage, Probelauf 11.10.2026).
// Je Bericht höchstens ein gescheiterter Versuch: Ein Versuch ohne Zusammenfassung merkt sich Regelfassung und Prüfsumme des
// Texts (ruleSummaryTried) und wird erst wieder gerechnet, wenn sich eins davon ändert; ein neuer Versuch ersetzt den alten
// Eintrag in article_analyses, statt einen weiteren anzulegen (früher bis zu 5 Zeilen je Bericht, 12.10.2026).
// Danach die Wortliste neu aufbauen: node scripts/refresh-search-words.mjs --full
//
//   node scripts/pdf-store/summaries.mjs --dry-run [--limit 300]   nur zählen und Beispiele zeigen, nichts schreiben
//   node scripts/pdf-store/summaries.mjs [--limit N]
import {existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {useDocumentStore,enrichDocument} from '../../server/integrations/documents.mjs';
import {compactSummaryAttempt} from '../../server/integrations/compact-summary.mjs';
import {primaryPdf,sessionDocument} from '../../shared/document-type.mjs';
import {stepSummary} from './state.mjs';
import {RULE_SUMMARY_VERSION} from '../../server/integrations/rule-summary.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const dry=flag('dry-run'),limit=Number(opt('limit',0));
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
// Nur Texte der Ablage: ohne Text kein Abruf aus dem Internet (der Bericht wird übersprungen), nichts wird abgelegt
useDocumentStore({getText:url=>store.getText(url),get:()=>{throw Error('kein Text in der Ablage');},put(){}});
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local);db.exec('PRAGMA busy_timeout=60000');

// Wie oft hängt ein PDF an Berichten? Einmal über alle Berichte zählen (rund eine Minute)
const uses=new Map();
for(const r of db.prepare("SELECT json_extract(payload,'$.documents') AS d FROM topics WHERE active=1 AND payload LIKE '%application/pdf%'").iterate()){
 let docs;try{docs=JSON.parse(r.d||'[]');}catch{continue;}
 for(const x of docs)if(x.kind==='application/pdf')uses.set(x.url,(uses.get(x.url)||0)+1);
}
const ids=db.prepare(`SELECT id FROM topics WHERE active=1 AND payload LIKE '%application/pdf%' AND json_extract(payload,'$.ruleSummary') IS NULL
 AND coalesce(json_extract(payload,'$.generatedBy'),'') NOT LIKE 'KI-Zusammenfassung%'`).all().map(r=>r.id);
const get=db.prepare('SELECT region_id AS region,payload FROM topics WHERE id=?');
const insert=db.prepare('INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,?,?,?,?)');
const update=db.prepare('UPDATE topics SET payload=? WHERE id=?');
const dropFailed=db.prepare("DELETE FROM article_analyses WHERE topic_id=? AND kind='summary' AND coalesce(json_extract(payload,'$.status'),'')<>'completed'");
const started=new Date().toISOString(),t0=Date.now(),c={candidates:ids.length,session:0,unchanged:0,withText:0,summary:0,noSummary:0,unreadable:0,ocr:0,ocrSummary:0},examples=[];
console.log(`${ids.length} Berichte ohne Regel-Zusammenfassung`);
let open=0;const flush=()=>{if(open){db.exec('COMMIT');open=0;}};
for(const id of ids){
 if(limit&&c.withText>=limit)break;
 const row=get.get(id);if(!row)continue;
 const old=JSON.parse(row.payload),d=primaryPdf(old.documents);
 if(d&&sessionDocument(d,uses.get(d.url)||0)){c.session++;continue;}
 const text=d&&store.getText(d.url);if(!text)continue;
 const tried=`${RULE_SUMMARY_VERSION}:${createHash('sha256').update(text.pages.join('\f')).digest('hex').slice(0,16)}`;
 if(old.ruleSummaryTried===tried){c.unchanged++;continue;}
 c.withText++;const ocr=text.method!=='text';if(ocr)c.ocr++;
 let t;try{t=await enrichDocument(old);}catch(e){t={...old,documentIssue:e.message};}
 if(t.ruleSummary){c.summary++;if(ocr)c.ocrSummary++;if(examples.length<5&&(ocr||examples.length<3))examples.push({titel:old.title,ocr,kurz:t.ruleSummary.short.sentences.join(' ').slice(0,300),güte:t.ruleSummary.score});}
 else if(t.documentIssue)c.unreadable++;else c.noSummary++;
 if(!dry){
  const compact=await compactSummaryAttempt(old,t,started);
  if(t.ruleSummary)delete compact.topic.ruleSummaryTried;else compact.topic.ruleSummaryTried=tried;
  if(!open){db.exec('BEGIN');}
  dropFailed.run(old.id);
  insert.run(compact.analysis.id,old.id,'summary',compact.analysis.method,compact.analysis.inputHash,started,JSON.stringify(compact.analysis));
  update.run(JSON.stringify(compact.topic),old.id);
  if(++open>=200)flush();
 }
 if(c.withText%5000===0)console.log(`${c.withText} mit Text: ${c.summary} Zusammenfassungen, ${((Date.now()-t0)/1000).toFixed(0)} s`);
}
flush();
console.log(JSON.stringify({...c,sekunden:Math.round((Date.now()-t0)/1000),geschrieben:!dry},null,1));
if(!dry)stepSummary({summaries:c.summary,withText:c.withText,unchanged:c.unchanged,noSummary:c.noSummary,unreadable:c.unreadable,session:c.session});
for(const e of examples)console.log(`\n# ${e.titel}${e.ocr?' (OCR)':''}, Güte ${e.güte}\n${e.kurz}`);
store.close();
