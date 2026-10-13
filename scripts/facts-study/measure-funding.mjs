// Förderbeträge (fundingEuroOf) gegen von Hand eingeordnete Berichte messen. Je Bericht zählt der größte erkannte Betrag;
// richtig, wenn er auf 1 % zum erwarteten passt (euro 0 = kein Förderbetrag für die Kommune). Braucht die lokale Datenbank
// und die PDF-Ablage (RM_PDF_STORE).
//   node scripts/facts-study/measure-funding.mjs [--set=<datei>] [--fehler]
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {primaryPdf} from '../../shared/document-type.mjs';
import {mergePages} from '../../server/integrations/documents.mjs';
import {fundingEuroOf} from '../../shared/topic-facts.mjs';

const arg=k=>process.argv.find(a=>a.startsWith(`--${k}=`))?.split('=')[1];
const sets=(arg('set')||'tests/fixtures/facts-funding-reference.json').split(',');
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local,{readOnly:true});
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const get=db.prepare("SELECT json_extract(payload,'$.documents') docs FROM topics WHERE id=?");
const c={tp:0,fp:0,fn:0,tn:0,wrong:0,missing:0},errors=[];
for(const set of sets)for(const r of JSON.parse(readFileSync(set,'utf8'))){
 const row=get.get(r.id),p=row&&primaryPdf(JSON.parse(row.docs||'[]')),t=p&&store.getText(p.url);
 if(!t){c.missing++;continue;}
 const got=Math.max(0,...fundingEuroOf(mergePages(t.pages)).map(x=>x.euro));
 const same=got&&r.euro&&Math.abs(got-r.euro)<=r.euro*0.01;
 if(same)c.tp++;else if(!got&&!r.euro)c.tn++;
 else{if(got&&r.euro)c.wrong++;else if(got)c.fp++;else c.fn++;errors.push(`erwartet ${r.euro}, erkannt ${got}  ${r.id}  ${r.title}`);}
}
const found=c.tp+c.fp+c.wrong,expected=c.tp+c.fn+c.wrong;
console.log(`Genauigkeit ${(100*c.tp/(found||1)).toFixed(0)} % (${c.tp}/${found} gefundene Beträge richtig), Abdeckung ${(100*c.tp/(expected||1)).toFixed(0)} % (${c.tp}/${expected}), richtig ohne Betrag ${c.tn}, ohne Text ${c.missing}`);
if(process.argv.includes('--fehler'))console.log(errors.join('\n'));
store.close();
