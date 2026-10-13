// Zieht eine Stichprobe aktiver Berichte aus der lokalen Datenbank für die Themenregeln (shared/themes.mjs).
// Auswahl per SHA-256(id + Salz), damit sie wiederholbar und unabhängig von den Regeln ist. Je Bericht: Titel, Anfang des
// Beschlussvorschlags aus der Textfassung (PDF-Ablage, ohne Sitzungsunterlagen) und Regel-Kurzfassung, falls vorhanden.
//   node scripts/theme-study/sample.mjs --name=theme-dev --salt=dev-2026-10-13 --n=300
import {existsSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {primaryPdf,sessionDocument} from '../../shared/document-type.mjs';
import {mergePages} from '../../server/integrations/documents.mjs';
import {subjectOf} from '../../shared/themes.mjs';

const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const name=arg('name','theme-dev'),salt=arg('salt','dev'),n=+arg('n',300);
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'),{readOnly:true});
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const ids=[];
for(const r of db.prepare('SELECT id FROM topics WHERE active=1').iterate())ids.push([createHash('sha256').update(r.id+salt).digest('hex'),r.id]);
ids.sort((a,b)=>a[0]<b[0]?-1:1);
const get=db.prepare("SELECT json_extract(payload,'$.title') title,json_extract(payload,'$.documents') docs,json_extract(payload,'$.ruleSummary.short.sentences') rs FROM topics WHERE id=?");
const uses=new Map();
for(const r of db.prepare("SELECT json_extract(payload,'$.documents') docs FROM topics WHERE active=1").iterate()){let d=[];try{d=JSON.parse(r.docs||'[]');}catch{}for(const x of d)if(x.kind==='application/pdf')uses.set(x.url,(uses.get(x.url)||0)+1);}
const rows=[];
for(const [,id] of ids.slice(0,n)){
 const r=get.get(id);let docs=[];try{docs=JSON.parse(r.docs||'[]');}catch{}
 const p=primaryPdf(docs);let text='';
 if(p&&!sessionDocument(p,uses.get(p.url)||0)){const t=store.getText(p.url);if(t)text=mergePages(t.pages);}
 let summary='';try{summary=(JSON.parse(r.rs||'[]')||[]).map(s=>s.text||s).join(' ');}catch{}
 rows.push({id,title:r.title||'',subject:text?subjectOf(text):'',summary:summary.slice(0,300),hasText:!!text,gold:null});
}
writeFileSync(new URL('../../tests/fixtures/'+name+'.json',import.meta.url),JSON.stringify({version:name,note:`${n} aktive Berichte, SHA-256(id+'${salt}'), lokale DB ${new Date().toISOString().slice(0,10)}; gold von Hand (Claude) nach den Themendefinitionen in shared/themes.mjs, vor dem Messen`,rows},null,1));
console.log(rows.length,'Zeilen, mit Text',rows.filter(r=>r.hasText).length,', mit Kurzfassung',rows.filter(r=>r.summary).length);
store.close();
