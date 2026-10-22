// Alle regelbasierten Ergebnisse je Bericht in einem Durchlauf (readReport, server/integrations/report-rules.mjs; Plan:
// requirements/regel-schritt-plan.md): Art des Punkts, Thema und „Was geschieht“ (im Bericht: itemKind, theme, stage), Regel-Zusammenfassung kurz und
// lang (ruleSummary) und Fakten (topic_facts). Liest nur Quellen: Titel, Dokumentliste und den Text des Hauptdokuments aus der
// PDF-Ablage (für einzelne Fakten auch passender Anlagen, factAttachments), ohne Internet und ohne KI. Ersetzt die früheren Skripte summaries.mjs und facts.mjs (entfernt 20.10.2026).
// Nur Berichte, deren Eingaben sich geändert haben: Schlüssel je Bericht in report_rules (Migration 0032), gebildet aus den
// Regelfassungen, Titel, Hauptdokument, Sitzungsunterlage ja/nein und Stand der Textfassung. --all verwirft alle Schlüssel.
// KI-Felder (shortSummary, longSummary, generatedBy, labelAssessments, contentAnalysis, article_analyses) bleiben unberührt.
// Ohne Regel-Zusammenfassung fällt eine alte weg (Sitzungsunterlage, kein Hauptdokument, Regeln liefern nichts); sie bleibt nur,
// wenn der Text fehlt oder nicht lesbar ist (dann kann sie aus dem Import stammen).
// Danach die Wortliste nachführen (node scripts/refresh-search-words.mjs, nach --all mit --full).
//
//   node scripts/pdf-store/read-reports.mjs [--dry-run] [--all] [--limit N] [--ids datei]
//        --ids: nur diese Berichte (eine ID je Zeile), immer neu gelesen (Job „nacharbeit“)
// Stürzt eine Regel bei einem Bericht ab, geht er als 'rules' mit Klasse internal in den Fehlerspeicher (Migration 0040) und der
// Lauf geht weiter; ein Erfolg löscht einen solchen Eintrag.
//        lokale Datenbank (DATABASE_FILE oder .wrangler/), Ablage RM_PDF_STORE
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {readReport,mainDocument,factAttachments,readKey,READ_VERSION} from '../../server/integrations/report-rules.mjs';
import {FACTS_VERSION,titleKey} from '../../shared/topic-facts.mjs';
import {stepSummary} from './state.mjs';
import {pdfUses} from './store-lib.mjs';
import {readFileSync} from 'node:fs';
import {openFailures} from './failures.mjs';
import {readSummaryModel} from '../../server/model/model-files.mjs';

const args=process.argv.slice(2),flag=n=>args.includes('--'+n),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const dry=flag('dry-run'),all=flag('all'),limit=Number(opt('limit',0));
const onlyIds=opt('ids')?new Set(readFileSync(opt('ids'),'utf8').split(/\s+/).map(x=>x.trim()).filter(Boolean)):null;
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local);db.exec('PRAGMA busy_timeout=60000');
const has=t=>{try{db.prepare(`SELECT 1 FROM ${t} LIMIT 0`).all();return true;}catch{return false;}};
// Probelauf auch ohne Migration 0032 (dann gilt jeder Bericht als neu)
const hasCases=has('report_rules')&&db.prepare("SELECT 1 FROM pragma_table_info('report_rules') WHERE name='case_key'").get();
for(const [table,mig] of [['report_rules','0032'],['topic_facts','0025']])
 if(!has(table)&&!(dry&&table==='report_rules')){console.error(`Tabelle ${table} fehlt: erst Migration ${mig} einspielen (scripts/node-migrate.mjs).`);process.exit(1);}

// Modell (Migration 0046, scripts/model/apply.mjs läuft davor): Hauptdokument, Art, Thema, Unterthemen und Vorgangsart kommen von
// dort. Berichte ohne Antwort des Modells werden nicht gelesen (die Regeln dafür gelten nicht mehr) und gezählt (ohneModell).
const hasModel=has('model_labels');
const mlGet=hasModel?db.prepare('SELECT model,key,kind,kind_p,themes,theme_p,subs,subsubs,process,process_p,step,service,applicants,doctypes,main_url FROM model_labels WHERE topic_id=?'):null;
const modelOf=id=>{const m=mlGet?.get(id);if(!m)return null;return {key:m.model+'|'+m.key,kind:m.kind,kindP:m.kind_p,themeP:m.theme_p,processP:m.process_p,service:m.service||null,doctypes:JSON.parse(m.doctypes||'[]'),themes:JSON.parse(m.themes||'[]'),subs:JSON.parse(m.subs||'[]'),subsubs:JSON.parse(m.subsubs||'[]'),step:m.step||null,process:m.process,applicants:JSON.parse(m.applicants||'[]'),mainUrl:m.main_url||null};};
// Satzkopf der Zusammenfassung (RM_MODEL_DIR/summary/summary.json): wählt die Kernsätze; fehlt die Datei, gilt die Regel
const summaryModel=hasModel?readSummaryModel():null;
let noModel=0;
// Ein Durchlauf: Schlüssel je Bericht ohne den Text zu lesen (Hauptdokument, Sitzungsunterlage, Stand der Textfassung)
// --ids (Nacharbeit, Folgekette nach der OCR): nur diese Berichte lesen, Nutzung je Adresse nur aus ihren Gebieten, keine
// Schlüssel laden. Vorher lief das über alle 1,5 Mio. Berichte: 8 bis 16 Minuten je Lauf für ein bis sechs Berichte (Server,
// 20./21.10.2026). Ein Dokument, das Berichte mehrerer Gebiete teilen, zählt der nächtliche volle Lauf nach (Schlüssel ändert sich).
const idList=onlyIds?JSON.stringify([...onlyIds]):null;
const idRegions=onlyIds?db.prepare('SELECT DISTINCT region_id FROM topics WHERE id IN (SELECT value FROM json_each(?))').all(idList).map(r=>r.region_id):null;
const t0=Date.now(),uses=pdfUses(db,{regions:idRegions}),U=u=>uses.get(u)||0,hasText=u=>!!store.textMark(u);
const keys=all||onlyIds||!has('report_rules')?new Map():new Map(db.prepare('SELECT topic_id,key FROM report_rules').all().map(r=>[r.topic_id,r.key]));
const todo=[];let total=0;
for(const r of db.prepare(`SELECT id,region_id,coalesce(json_extract(payload,'$.officialTitle'),json_extract(payload,'$.title'),'') AS title,
  json_extract(payload,'$.documents') AS docs FROM topics WHERE active=1${onlyIds?' AND id IN (SELECT value FROM json_each(?))':''}`).iterate(...(onlyIds?[idList]:[]))){
 total++;let docs=[];try{docs=JSON.parse(r.docs||'[]');}catch{/* ohne Dokumente */}
 const model=hasModel?modelOf(r.id):null;if(hasModel&&!model){noModel++;continue;}
 const {doc,session}=mainDocument(docs,model?{uses:U,hasText,mainUrl:model.mainUrl}:{uses:U,hasText});
 const textSha=doc&&!session?store.textMark(doc.url)||'':'';
 const att=factAttachments(docs,doc?.url,{uses:U,hasText}).map(a=>({...a,textSha:store.textMark(a.url)||''}));
 const key=readKey({title:r.title,mainUrl:doc?.url,session,textSha,attSha:att.map(a=>a.textSha).join(','),modelKey:(model?.key||'')+(summaryModel?'|'+summaryModel.version:'')});
 if(onlyIds||keys.get(r.id)!==key)todo.push([r.id,doc&&!session&&textSha?doc.url:null,textSha,r.region_id+'|'+titleKey(r.title),att.length?att:null,model]);
}
keys.clear();
console.log(`${total} Berichte, ${todo.length} zu lesen${hasModel?`, ${noModel} noch ohne Modell`:''} (${READ_VERSION}, ${((Date.now()-t0)/1000).toFixed(0)} s)`);

const get=db.prepare('SELECT payload FROM topics WHERE id=?');
const update=db.prepare('UPDATE topics SET payload=? WHERE id=?');
const dropFacts=db.prepare("DELETE FROM topic_facts WHERE topic_id=? AND method LIKE 'facts-%'");
const addFact=db.prepare('INSERT OR REPLACE INTO topic_facts(topic_id,kind,value,detail,method) VALUES(?,?,?,?,?)');
// Mit Migration 0035 auch die Ergebnisse als Spalten (Grundlage für plenara.X)
const setKey=dry?null:hasCases?db.prepare(`INSERT INTO report_rules(topic_id,key,version,summary_issue,read_at,case_key,item_kind,theme,subs,stage) VALUES(?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(topic_id) DO UPDATE SET key=excluded.key,version=excluded.version,summary_issue=excluded.summary_issue,read_at=excluded.read_at,
 case_key=excluded.case_key,item_kind=excluded.item_kind,theme=excluded.theme,subs=excluded.subs,stage=excluded.stage`)
 :db.prepare(`INSERT INTO report_rules(topic_id,key,version,summary_issue,read_at) VALUES(?,?,?,?,?)
 ON CONFLICT(topic_id) DO UPDATE SET key=excluded.key,version=excluded.version,summary_issue=excluded.summary_issue,read_at=excluded.read_at`);
// Kurze Schreibvorgänge (je 500 Berichte), damit die laufende App zwischendurch lesen kann; erst rechnen, dann schreiben.
// IMMEDIATE wartet (busy_timeout) auf andere Schreiber, statt sofort mit „database is locked“ zu scheitern.
const pending=[];
const flush=()=>{if(!pending.length||dry){pending.length=0;return;}db.exec('BEGIN IMMEDIATE');try{for(const fn of pending)fn();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}pending.length=0;};
const write=fn=>{pending.push(fn);if(pending.length>=500)flush();};
// Gründe ohne Zusammenfassung, bei denen eine vorhandene bleibt: Text fehlt oder ist nicht lesbar
const KEEP=new Set(['no-text','too-long','unreadable']);
const at=new Date().toISOString(),c={read:0,withText:0,changed:0,summary:0,dropped:0,facts:0,issues:{},kinds:{},themes:{}};
const F=dry?null:await openFailures(),failedIds=F?F.known('rules'):new Set();c.crashed=0;
for(const [id,url,textSha,caseKey,att,model] of todo){
 if(limit&&c.read>=limit)break;
 const row=get.get(id);if(!row)continue;
 let old,pages,r;
 try{
  old=JSON.parse(row.payload);
  pages=url?store.getText(url)?.pages||null:null;
  const attachments=(att||[]).map(a=>({...a,pages:store.getText(a.url)?.pages||null}));
  r=readReport(old,{uses:U,hasText,pages,textSha:pages?textSha:'',attachments,at,model,summaryModel});
 }catch(e){c.crashed++;console.error('Regeln',id,e?.message||e);await F?.fail({step:'rules',key:id,cls:'internal',error:String(e?.stack||e).slice(0,300)});continue;}
 if(failedIds.has(id)){await F.ok({step:'rules',key:id});failedIds.delete(id);}
 c.read++;if(pages)c.withText++;
 c.kinds[r.itemKind]=(c.kinds[r.itemKind]||0)+1;c.themes[r.theme.id]=(c.themes[r.theme.id]||0)+1;
 if(r.summaryIssue)c.issues[r.summaryIssue]=(c.issues[r.summaryIssue]||0)+1;else c.summary++;
 const next={...old,itemKind:r.itemKind,theme:r.theme,stage:r.stage};delete next.ruleSummaryTried;
 if(r.overview)next.overview=r.overview;else delete next.overview;
 if(r.ruleSummary)next.ruleSummary=r.ruleSummary;
 else if(next.ruleSummary&&!KEEP.has(r.summaryIssue)){delete next.ruleSummary;c.dropped++;}
 const json=JSON.stringify(next),changed=json!==row.payload;if(changed)c.changed++;
 c.facts+=r.facts.length;
 const method=`${FACTS_VERSION}:${pages?'text':'title'}`;
 write(()=>{
  if(changed)update.run(json,id);
  dropFacts.run(id);for(const f of r.facts)addFact.run(id,f.kind,f.value,f.detail,method);
  if(hasCases)setKey.run(id,r.key,r.version,r.summaryIssue,at,caseKey,r.itemKind,r.theme.id,r.theme.subs.join(','),r.stage);
  else setKey.run(id,r.key,r.version,r.summaryIssue,at);
 });
 if(c.read%20000===0)console.log(`${c.read}/${todo.length}, ${((Date.now()-t0)/1000).toFixed(0)} s`);
}
flush();
// Analysen lesen neu (Zwischenspeicher hängen am Datenstand), nur wenn sich etwas geändert hat
if(!dry&&c.read)db.prepare("UPDATE data_revisions SET revision=revision+1 WHERE id='content'").run();
console.log(JSON.stringify({berichte:total,...c,sekunden:Math.round((Date.now()-t0)/1000),geschrieben:!dry},null,1));
F?.close();
if(!dry)stepSummary({all,noModel,crashed:c.crashed,read:c.read,withText:c.withText,summaries:c.summary,dropped:c.dropped,unchanged:total-todo.length,issues:c.issues});
store.close();
