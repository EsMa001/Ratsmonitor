// Alle regelbasierten Ergebnisse je Bericht in einem Durchlauf (readReport, server/integrations/report-rules.mjs; Plan:
// requirements/regel-schritt-plan.md): Art des Punkts und Thema (im Bericht: itemKind, theme), Regel-Zusammenfassung kurz und
// lang (ruleSummary) und Fakten (topic_facts). Liest nur Quellen: Titel, Dokumentliste und den Text des Hauptdokuments aus der
// PDF-Ablage, ohne Internet und ohne KI. Ersetzt summaries.mjs und facts.mjs.
// Nur Berichte, deren Eingaben sich geändert haben: Schlüssel je Bericht in report_rules (Migration 0032), gebildet aus den
// Regelfassungen, Titel, Hauptdokument, Sitzungsunterlage ja/nein und Stand der Textfassung. --all verwirft alle Schlüssel.
// KI-Felder (shortSummary, longSummary, generatedBy, labelAssessments, contentAnalysis, article_analyses) bleiben unberührt.
// Ohne Regel-Zusammenfassung fällt eine alte weg (Sitzungsunterlage, kein Hauptdokument, Regeln liefern nichts); sie bleibt nur,
// wenn der Text fehlt oder nicht lesbar ist (dann kann sie aus dem Import stammen).
// Danach die Wortliste nachführen (node scripts/refresh-search-words.mjs, nach --all mit --full).
//
//   node scripts/pdf-store/read-reports.mjs [--dry-run] [--all] [--limit N]
//        lokale Datenbank (DATABASE_FILE oder .wrangler/), Ablage RM_PDF_STORE
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {readReport,mainDocument,readKey,READ_VERSION} from '../../server/integrations/report-rules.mjs';
import {FACTS_VERSION} from '../../shared/topic-facts.mjs';
import {stepSummary} from './state.mjs';
import {pdfUses} from './store-lib.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const dry=flag('dry-run'),all=flag('all'),limit=Number(opt('limit',0));
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local);db.exec('PRAGMA busy_timeout=60000');
const has=t=>{try{db.prepare(`SELECT 1 FROM ${t} LIMIT 0`).all();return true;}catch{return false;}};
// Probelauf auch ohne Migration 0032 (dann gilt jeder Bericht als neu)
for(const [table,mig] of [['report_rules','0032'],['topic_facts','0025']])
 if(!has(table)&&!(dry&&table==='report_rules')){console.error(`Tabelle ${table} fehlt: erst Migration ${mig} einspielen (scripts/node-migrate.mjs).`);process.exit(1);}

// Ein Durchlauf: Schlüssel je Bericht ohne den Text zu lesen (Hauptdokument, Sitzungsunterlage, Stand der Textfassung)
const t0=Date.now(),uses=pdfUses(db),U=u=>uses.get(u)||0,hasText=u=>!!store.textMark(u);
const keys=all||!has('report_rules')?new Map():new Map(db.prepare('SELECT topic_id,key FROM report_rules').all().map(r=>[r.topic_id,r.key]));
const todo=[];let total=0;
for(const r of db.prepare(`SELECT id,coalesce(json_extract(payload,'$.officialTitle'),json_extract(payload,'$.title'),'') AS title,
  json_extract(payload,'$.documents') AS docs FROM topics WHERE active=1`).iterate()){
 total++;let docs=[];try{docs=JSON.parse(r.docs||'[]');}catch{/* ohne Dokumente */}
 const {doc,session}=mainDocument(docs,{uses:U,hasText});
 const textSha=doc&&!session?store.textMark(doc.url)||'':'';
 const key=readKey({title:r.title,mainUrl:doc?.url,session,textSha});
 if(keys.get(r.id)!==key)todo.push([r.id,doc&&!session&&textSha?doc.url:null,textSha]);
}
keys.clear();
console.log(`${total} Berichte, ${todo.length} zu lesen (${READ_VERSION}, ${((Date.now()-t0)/1000).toFixed(0)} s)`);

const get=db.prepare('SELECT payload FROM topics WHERE id=?');
const update=db.prepare('UPDATE topics SET payload=? WHERE id=?');
const dropFacts=db.prepare("DELETE FROM topic_facts WHERE topic_id=? AND method LIKE 'facts-%'");
const addFact=db.prepare('INSERT OR REPLACE INTO topic_facts(topic_id,kind,value,detail,method) VALUES(?,?,?,?,?)');
const setKey=dry?null:db.prepare(`INSERT INTO report_rules(topic_id,key,version,summary_issue,read_at) VALUES(?,?,?,?,?)
 ON CONFLICT(topic_id) DO UPDATE SET key=excluded.key,version=excluded.version,summary_issue=excluded.summary_issue,read_at=excluded.read_at`);
// Kurze Schreibvorgänge (je 500 Berichte), damit die laufende App zwischendurch lesen kann; erst rechnen, dann schreiben.
// IMMEDIATE wartet (busy_timeout) auf andere Schreiber, statt sofort mit „database is locked“ zu scheitern.
const pending=[];
const flush=()=>{if(!pending.length||dry){pending.length=0;return;}db.exec('BEGIN IMMEDIATE');try{for(const fn of pending)fn();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}pending.length=0;};
const write=fn=>{pending.push(fn);if(pending.length>=500)flush();};
// Gründe ohne Zusammenfassung, bei denen eine vorhandene bleibt: Text fehlt oder ist nicht lesbar
const KEEP=new Set(['no-text','too-long','unreadable']);
const at=new Date().toISOString(),c={read:0,withText:0,changed:0,summary:0,dropped:0,facts:0,issues:{},kinds:{},themes:{}};
for(const [id,url,textSha] of todo){
 if(limit&&c.read>=limit)break;
 const row=get.get(id);if(!row)continue;
 const old=JSON.parse(row.payload);
 const pages=url?store.getText(url)?.pages||null:null;
 const r=readReport(old,{uses:U,hasText,pages,textSha:pages?textSha:'',at});
 c.read++;if(pages)c.withText++;
 c.kinds[r.itemKind]=(c.kinds[r.itemKind]||0)+1;c.themes[r.theme.id]=(c.themes[r.theme.id]||0)+1;
 if(r.summaryIssue)c.issues[r.summaryIssue]=(c.issues[r.summaryIssue]||0)+1;else c.summary++;
 const next={...old,itemKind:r.itemKind,theme:r.theme};delete next.ruleSummaryTried;
 if(r.ruleSummary)next.ruleSummary=r.ruleSummary;
 else if(next.ruleSummary&&!KEEP.has(r.summaryIssue)){delete next.ruleSummary;c.dropped++;}
 const json=JSON.stringify(next),changed=json!==row.payload;if(changed)c.changed++;
 c.facts+=r.facts.length;
 const method=`${FACTS_VERSION}:${pages?'text':'title'}`;
 write(()=>{
  if(changed)update.run(json,id);
  dropFacts.run(id);for(const f of r.facts)addFact.run(id,f.kind,f.value,f.detail,method);
  setKey.run(id,r.key,r.version,r.summaryIssue,at);
 });
 if(c.read%20000===0)console.log(`${c.read}/${todo.length}, ${((Date.now()-t0)/1000).toFixed(0)} s`);
}
flush();
// Analysen lesen neu (Zwischenspeicher hängen am Datenstand), nur wenn sich etwas geändert hat
if(!dry&&c.read)db.prepare("UPDATE data_revisions SET revision=revision+1 WHERE id='content'").run();
console.log(JSON.stringify({berichte:total,...c,sekunden:Math.round((Date.now()-t0)/1000),geschrieben:!dry},null,1));
if(!dry)stepSummary({all,read:c.read,withText:c.withText,summaries:c.summary,dropped:c.dropped,unchanged:total-todo.length,issues:c.issues});
store.close();
