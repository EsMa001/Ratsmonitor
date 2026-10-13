// Stichprobe für den Rückgriff auf den Text: aktive Berichte, deren Titel weder Thema noch Formalie ist (themeOf → source
// 'none') und die eine Regel-Zusammenfassung mit langer Fassung haben. Je Bericht Titel, Betreff/Beschlussvorschlag (falls
// Text in der Ablage), kurze und lange Fassung.
//   node scripts/theme-study/sample-summary.mjs --name=theme-summary --salt=lang-2026-10-13 --n=200
import {readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {primaryPdf,sessionDocument} from '../../shared/document-type.mjs';
import {mergePages} from '../../server/integrations/documents.mjs';
import {themeOf,subjectOf} from '../../shared/themes.mjs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const name=arg('name','theme-summary'),salt=arg('salt','lang'),n=+arg('n',200);
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'),{readOnly:true});
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const cand=[];
for(const r of db.prepare("SELECT id,json_extract(payload,'$.title') title,json_extract(payload,'$.ruleSummary.short.sentences') s,json_extract(payload,'$.ruleSummary.long.sentences') l,json_extract(payload,'$.documents') docs FROM topics WHERE active=1 AND json_type(payload,'$.ruleSummary.long.sentences')='array'").iterate()){
 if(themeOf({title:r.title||''}).source!=='none')continue;
 cand.push([createHash('sha256').update(r.id+salt).digest('hex'),r]);
}
cand.sort((a,b)=>a[0]<b[0]?-1:1);
const rows=cand.slice(0,n).map(([,r])=>{
 let docs=[];try{docs=JSON.parse(r.docs||'[]');}catch{}
 const p=primaryPdf(docs);let subject='';
 if(p&&!sessionDocument(p,0)){const t=store.getText(p.url);if(t)subject=subjectOf(mergePages(t.pages));}
 const j=x=>{try{return (JSON.parse(x||'[]')||[]).join(' ');}catch{return '';}};
 return {id:r.id,title:r.title||'',subject,summary:j(r.s),long:j(r.l),gold:null};
});
writeFileSync(new URL('../../tests/fixtures/'+name+'.json',import.meta.url),JSON.stringify({version:name,note:`${n} aktive Berichte mit langer Regel-Zusammenfassung, Titel ohne Thema und ohne Formalie (themes-v1), SHA-256(id+'${salt}'), lokale DB ${new Date().toISOString().slice(0,10)}, von ${cand.length} Kandidaten; gold von Hand (Claude) aus Titel, Betreff und langer Fassung, vor dem Messen`,rows},null,1));
console.log(cand.length,'Kandidaten,',rows.length,'gezogen, mit Betreff/Beschluss',rows.filter(r=>r.subject).length);
store.close();
