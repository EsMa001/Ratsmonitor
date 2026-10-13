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
// Dazu Berichte, deren Zusammenfassung aus einem anderen Dokument stammt als dem heutigen Hauptdokument (ruleSummary.source).
// Auch Berichte mit KI-Zusammenfassung (Entscheidung 12.10.2026): Sie bekommen die Regel-Zusammenfassung zusätzlich, kurz und lang
// im Feld ruleSummary, nur wenn sie noch keine haben. Bei ihnen wird nur ruleSummary bzw. ruleSummaryTried geschrieben: KI-Text (shortSummary, longSummary,
// generatedBy), summaryMethod, summaryIssue, contentAnalysis und ihre Einträge in article_analyses bleiben unberührt (der Weg über
// compactSummaryAttempt würde sie überschreiben und gescheiterte Einträge löschen, auch KI-Einträge ohne Status 'completed').
// Danach die Wortliste neu aufbauen: node scripts/refresh-search-words.mjs --full
//
//   node scripts/pdf-store/summaries.mjs --dry-run [--limit 300]   nur zählen und Beispiele zeigen, nichts schreiben
//   node scripts/pdf-store/summaries.mjs [--limit N]
//   node scripts/pdf-store/summaries.mjs --all   alle neu erstellen (Knopf „Alle neu erstellen“ im Reiter Themen & Texte): jeder
//        Bericht mit Hauptdokument, auch mit vorhandener Regel-Zusammenfassung und ohne Rücksicht auf frühere Versuche. Liefern
//        die heutigen Regeln nichts (auch Sitzungsunterlagen), fällt eine alte Regel-Zusammenfassung weg; ohne Text in der
//        Ablage bleibt sie. KI-Text bleibt wie immer unberührt.
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {useDocumentStore,enrichDocument} from '../../server/integrations/documents.mjs';
import {compactSummaryAttempt,withRuleSummary} from '../../server/integrations/compact-summary.mjs';
import {primaryPdf,sessionDocument} from '../../shared/document-type.mjs';
import {stepSummary} from './state.mjs';
import {pdfUses} from './store-lib.mjs';
import {RULE_SUMMARY_VERSION} from '../../server/integrations/rule-summary.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const dry=flag('dry-run'),limit=Number(opt('limit',0)),all=flag('all');
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
// Nur Texte der Ablage: ohne Text kein Abruf aus dem Internet (der Bericht wird übersprungen), nichts wird abgelegt
useDocumentStore({getText:url=>store.getText(url),get:()=>{throw Error('kein Text in der Ablage');},put(){}});
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local);db.exec('PRAGMA busy_timeout=60000');

// Ein Durchlauf über alle Berichte: wie oft hängt ein PDF an Berichten (Sitzungsunterlagen), und welche Berichte sind
// Kandidaten (ohne ruleSummary, auch mit KI-Zusammenfassung) mit Hauptdokument und letztem Versuch (rund eine Minute)
const uses=pdfUses(db),cands=[],hasText=u=>!!store.textMark(u);
// Kandidat ist auch ein Bericht, dessen Zusammenfassung aus einem anderen Dokument stammt als dem heutigen Hauptdokument
// (neue Regeln für primaryPdf, 12.10.2026); scheitert der neue Versuch, bleibt die alte Zusammenfassung (ruleSummaryTried)
let stale=0;
for(const r of db.prepare(`SELECT id,json_extract(payload,'$.documents') AS d,json_extract(payload,'$.ruleSummary.source.url') AS src,
  json_extract(payload,'$.ruleSummary') IS NULL AS missing,coalesce(json_extract(payload,'$.generatedBy'),'') LIKE 'KI-Zusammenfassung%' AS ai,
  json_extract(payload,'$.ruleSummaryTried') AS tried FROM topics WHERE active=1 AND payload LIKE '%application/pdf%'`).iterate()){
 let docs;try{docs=JSON.parse(r.d||'[]');}catch{continue;}
 const p=primaryPdf(docs,{uses:u=>uses.get(u)||0,hasText});
 if(all){if(p)cands.push([r.id,p,null,!!r.ai,!r.missing]);}
 else if(r.missing)cands.push([r.id,p,r.tried,!!r.ai]);
 // Mit KI-Zusammenfassung nur, wenn noch keine Regel-Zusammenfassung da ist (keine Neufassung aus einem anderen Dokument)
 else if(!r.ai&&p&&r.src&&r.src!==p.url){stale++;cands.push([r.id,p,r.tried,false]);}
}
const ids=cands;
const get=db.prepare('SELECT region_id AS region,payload FROM topics WHERE id=?');
const insert=db.prepare('INSERT INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,?,?,?,?)');
const update=db.prepare('UPDATE topics SET payload=? WHERE id=?');
const dropFailed=db.prepare("DELETE FROM article_analyses WHERE topic_id=? AND kind='summary' AND coalesce(json_extract(payload,'$.status'),'')<>'completed'");
const started=new Date().toISOString(),t0=Date.now(),c={candidates:ids.length,stale,session:0,unchanged:0,withText:0,summary:0,noSummary:0,unreadable:0,ocr:0,ocrSummary:0,ai:0,aiSummary:0,dropped:0},examples=[];
console.log(all?`Alle neu: ${ids.length} Berichte mit Hauptdokument`:`${ids.length-stale} Berichte ohne Regel-Zusammenfassung, ${stale} mit Zusammenfassung aus einem anderen als dem Hauptdokument`);
/* Schreiben gesammelt: erst rechnen, dann je 200 Berichte in einer kurzen Transaktion (früher blieb sie offen, solange gerechnet
   wurde; so lange scheiterten andere Leser, etwa die Adminseiten des Dev-Servers, der nicht auf Sperren wartet) */
const pending=[];
const flush=()=>{if(!pending.length)return;db.exec('BEGIN');try{for(const fn of pending)fn();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}pending.length=0;};
const write=fn=>{pending.push(fn);if(pending.length>=200)flush();};
const drop=db.prepare("UPDATE topics SET payload=json_remove(payload,'$.ruleSummary') WHERE id=?");
for(const [id,d,lastTried,ai,had] of ids){
 if(limit&&c.withText>=limit)break;
 if(d&&sessionDocument(d,uses.get(d.url)||0)){c.session++;if(had&&!dry){write(()=>drop.run(id));c.dropped++;}continue;}
 // Prüfsumme des Texts aus der Ablage (je Textfassung einmal gerechnet): Unveränderte ohne Lesen von Bericht und Datei
 const hash=d&&store.textHash(d.url);if(!hash)continue;
 const tried=`${RULE_SUMMARY_VERSION}:${hash.slice(0,16)}`;
 if(lastTried===tried){c.unchanged++;continue;}
 const row=get.get(id);if(!row)continue;
 const old=JSON.parse(row.payload);
 const text=store.getText(d.url);if(!text)continue;
 c.withText++;const ocr=text.method!=='text';if(ocr)c.ocr++;if(ai)c.ai++;
 // Alle neu: ohne die alte Regel-Zusammenfassung rechnen (sonst käme sie unverändert zurück)
 const input=all&&had?(({ruleSummary,...rest})=>rest)(old):old;
 let t;try{t=await enrichDocument(input,undefined,{uses:u=>uses.get(u)||0,hasText});}catch(e){t={...input,documentIssue:e.message};}
 // Liefern die heutigen Regeln nichts, gilt die alte nicht mehr; nur bei unlesbarem Text bleibt sie
 if(all&&had&&!t.ruleSummary&&!t.documentIssue){delete old.ruleSummary;c.dropped++;}
 if(t.ruleSummary){c.summary++;if(ocr)c.ocrSummary++;if(ai)c.aiSummary++;if(examples.length<5&&(ocr||examples.length<3))examples.push({titel:old.title,ocr,kurz:t.ruleSummary.short.sentences.join(' ').slice(0,300),güte:t.ruleSummary.score});}
 else if(t.documentIssue)c.unreadable++;else c.noSummary++;
 if(!dry&&ai){
  // KI-Zusammenfassung: nur die Regel-Zusammenfassung dazu (oder den Versuch merken), sonst nichts anfassen
  const json=JSON.stringify(withRuleSummary(old,t,tried));
  write(()=>update.run(json,old.id));
 }else if(!dry){
  const compact=await compactSummaryAttempt(old,t,started);
  if(t.ruleSummary)delete compact.topic.ruleSummaryTried;else compact.topic.ruleSummaryTried=tried;
  write(()=>{
   dropFailed.run(old.id);
   insert.run(compact.analysis.id,old.id,'summary',compact.analysis.method,compact.analysis.inputHash,started,JSON.stringify(compact.analysis));
   update.run(JSON.stringify(compact.topic),old.id);
  });
 }
 if(c.withText%5000===0)console.log(`${c.withText} mit Text: ${c.summary} Zusammenfassungen, ${((Date.now()-t0)/1000).toFixed(0)} s`);
}
flush();
console.log(JSON.stringify({...c,sekunden:Math.round((Date.now()-t0)/1000),geschrieben:!dry},null,1));
if(!dry)stepSummary({all,dropped:c.dropped,summaries:c.summary,ai:c.aiSummary,withText:c.withText,unchanged:c.unchanged,noSummary:c.noSummary,unreadable:c.unreadable,session:c.session});
for(const e of examples)console.log(`\n# ${e.titel}${e.ocr?' (OCR)':''}, Güte ${e.güte}\n${e.kurz}`);
store.close();
