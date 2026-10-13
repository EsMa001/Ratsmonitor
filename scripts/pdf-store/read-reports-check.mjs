// Gleichheitsprüfung für den Umbau auf read-reports.mjs (Plan: requirements/regel-schritt-plan.md, Prüfung 1): Für eine feste
// Stichprobe aktiver Berichte (per SHA-256 der ID gewählt) rechnet sie Regel-Zusammenfassung und Fakten auf dem bisherigen Weg
// (enrichDocument wie summaries.mjs, factsOf wie facts.mjs) und mit readReport und zählt Abweichungen. Prüft nur, dass der
// Umbau nichts ungewollt verändert, nicht ob die Zusammenfassungen gut sind. Schreibt nichts.
// Gewollte Abweichung: Punkte, die kein Sachpunkt sind (itemKind), haben nur noch Fraktionsfakten.
//   node scripts/pdf-store/read-reports-check.mjs [--n 2000] [--zeigen 5] [--mit-text]   --mit-text: nur Berichte, deren Hauptdokument Text hat
import {existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {useDocumentStore,enrichDocument,mergePages} from '../../server/integrations/documents.mjs';
import {readReport} from '../../server/integrations/report-rules.mjs';
import {primaryPdf,sessionDocument} from '../../shared/document-type.mjs';
import {factsOf} from '../../shared/topic-facts.mjs';
import {pdfUses} from './store-lib.mjs';

const args=process.argv.slice(2),opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?Number(args[i+1]):d;};
const N=opt('n',2000),SHOW=opt('zeigen',5),withText=args.includes('--mit-text');
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
useDocumentStore({getText:url=>store.getText(url),get:()=>{throw Error('kein Text in der Ablage');},put(){}});
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local,{readOnly:true});

const uses=pdfUses(db),U=u=>uses.get(u)||0,hasText=u=>!!store.textMark(u);
// Stichprobe: Berichte mit PDF, die kleinsten SHA-256-Werte der ID (fest, unabhängig von der Reihenfolge der Tabelle)
const sha=s=>createHash('sha256').update(s).digest('hex');
const ids=db.prepare("SELECT id,json_extract(payload,'$.documents') AS d FROM topics WHERE active=1 AND payload LIKE '%application/pdf%'").all()
 .filter(r=>{if(!withText)return true;const p=primaryPdf(JSON.parse(r.d||'[]'),{uses:U,hasText});return p&&hasText(p.url)&&!sessionDocument(p,U(p.url));})
 .map(r=>[sha(r.id),r.id]).sort((a,b)=>a[0]<b[0]?-1:1).slice(0,N).map(x=>x[1]);
const get=db.prepare('SELECT payload FROM topics WHERE id=?');
const strip=s=>s?JSON.stringify({...s,generatedAt:undefined}):null;
const sortFacts=f=>JSON.stringify(f.map(x=>[x.kind,x.value,x.detail??null]).sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:1));
const c={berichte:0,mitText:0,mainUrl:0,summaryGleich:0,summaryAnders:0,nurAlt:0,nurNeu:0,faktenGleich:0,faktenNurSachpunkt:0,faktenAnders:0},shown=[];
for(const id of ids){
 const old=JSON.parse(get.get(id).payload);c.berichte++;
 const title=old.officialTitle||old.title||'';
 // Bisher: Hauptdokument wie summaries.mjs/facts.mjs
 const p=primaryPdf(old.documents,{uses:U,hasText});
 const session=!!p&&sessionDocument(p,U(p.url));
 const text=p&&!session?store.getText(p.url):null;if(text)c.mitText++;
 const {ruleSummary,...input}=old;
 let t;try{t=await enrichDocument(input,undefined,{uses:U,hasText});}catch(e){t={...input,documentIssue:e.message};}
 const before=strip(t.ruleSummary);
 const factsBefore=factsOf(title,text?mergePages(text.pages):'');
 // Neu
 const r=readReport(old,{uses:U,hasText,pages:text?.pages||null,textSha:text?store.textMark(p.url):''});
 if((r.mainUrl||null)!==(p?.url||null))c.mainUrl++;
 const after=strip(r.ruleSummary);
 if(before===after)c.summaryGleich++;else{
  if(before&&!after)c.nurAlt++;else if(!before&&after)c.nurNeu++;else c.summaryAnders++;
  if(shown.length<SHOW)shown.push({id,title,issue:r.summaryIssue,alt:t.ruleSummary?.short?.sentences?.join(' ').slice(0,200)||null,neu:r.ruleSummary?.short?.sentences?.join(' ').slice(0,200)||null});
 }
 const fa=sortFacts(factsBefore),fb=sortFacts(r.facts);
 if(fa===fb)c.faktenGleich++;
 else if(r.itemKind!=='subject'&&fb===sortFacts(factsBefore.filter(f=>f.kind==='faction'||f.kind==='faction_advice')))c.faktenNurSachpunkt++;
 else{c.faktenAnders++;if(shown.length<SHOW*2)shown.push({id,title,fakten:{alt:JSON.parse(fa),neu:JSON.parse(fb)}});}
}
console.log(JSON.stringify(c,null,1));
for(const s of shown)console.log(JSON.stringify(s));
store.close();
