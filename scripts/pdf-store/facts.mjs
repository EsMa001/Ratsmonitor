// Fakten für plenara.X (shared/topic-facts.mjs, Tabelle topic_facts aus drizzle/0025) für alle aktiven Berichte neu
// schreiben: Fraktion aus dem Titel, mit Text in der PDF-Ablage auch aus dem Textanfang, Förderprogramme aus dem Text.
// Unterlagen der ganzen Sitzung (sessionDocument) zählen nicht: eine Niederschrift nennt Förderungen anderer Punkte.
//   node scripts/pdf-store/facts.mjs            lokale Datenbank (DATABASE_FILE oder .wrangler/), Ablage RM_PDF_STORE
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {primaryPdf,sessionDocument} from '../../shared/document-type.mjs';
import {factsOf,FACTS_VERSION} from '../../shared/topic-facts.mjs';
import {mergePages} from '../../server/integrations/documents.mjs';

const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local);db.exec('PRAGMA busy_timeout=60000');
try{db.prepare('SELECT 1 FROM topic_facts LIMIT 0').all();}catch{console.error('Tabelle topic_facts fehlt: erst Migration 0025 einspielen (scripts/node-migrate.mjs).');process.exit(1);}

const t0=Date.now(),list=[],uses=new Map();
for(const r of db.prepare("SELECT id,json_extract(payload,'$.title') AS title,json_extract(payload,'$.documents') AS docs FROM topics WHERE active=1").iterate()){
 let docs=[];try{docs=JSON.parse(r.docs||'[]');}catch{/* ohne Dokumente */}
 for(const d of docs)if(d.kind==='application/pdf')uses.set(d.url,(uses.get(d.url)||0)+1);
 const p=primaryPdf(docs);list.push([r.id,r.title||'',p?.url||null,p?.title||'']);
}
console.log(`${list.length} Berichte gelesen (${((Date.now()-t0)/1000).toFixed(0)} s)`);
const deleteTopic=db.prepare("DELETE FROM topic_facts WHERE topic_id=? AND method LIKE 'facts-%'");
const insert=db.prepare('INSERT OR REPLACE INTO topic_facts(topic_id,kind,value,detail,method) VALUES(?,?,?,?,?)');
// Kurze Schreibvorgänge (je 5.000 Berichte), damit die laufende App zwischendurch lesen kann
db.exec('BEGIN');
const c={withText:0,topicsFaction:0,topicsFunding:0};let n=0;
for(const [id,title,url,docTitle] of list){
 const text=url&&!sessionDocument({title:docTitle},uses.get(url)||0)?store.getText(url):null;
 const body=text?mergePages(text.pages):'';if(text)c.withText++;
 const rows=factsOf(title,body);
 deleteTopic.run(id);
 const method=`${FACTS_VERSION}:${text?'text':'title'}`;
 for(const r of rows){insert.run(id,r.kind,r.value,r.detail,method);c[r.kind]=(c[r.kind]||0)+1;}
 if(rows.some(r=>r.kind==='faction'))c.topicsFaction++;if(rows.some(r=>r.kind==='funding'))c.topicsFunding++;
 if(++n%5000===0){db.exec('COMMIT;BEGIN');if(n%100000===0)console.log(`${n}/${list.length}`);}
}
db.exec('COMMIT');
// Analysen lesen neu (Zwischenspeicher hängen am Datenstand)
db.prepare("UPDATE data_revisions SET revision=revision+1 WHERE id='content'").run();
console.log(JSON.stringify({...c,berichte:list.length,sekunden:Math.round((Date.now()-t0)/1000)}));
store.close();
