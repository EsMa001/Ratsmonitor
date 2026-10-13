// Stichprobe einer Faktart zum Prüfen von Hand: N Berichte mit Fakt (aus topic_facts) und M Berichte ohne Fakt, deren Text
// aber passende Wörter enthält (für die Abdeckung). Je Bericht Titel, Ergebnis der Regeln und die passenden Sätze.
// Fest gewählt über SHA-256 (seed); Berichte aus vorhandenen Prüflisten werden ausgelassen.
//   node scripts/facts-study/sample-facts.mjs --kind=kita_places [--n=20] [--m=10] [--seed=C] > datei.json
import {readdirSync,existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {primaryPdf,sessionDocument} from '../../shared/document-type.mjs';
import {mergePages} from '../../server/integrations/documents.mjs';
import {factsOf} from '../../shared/topic-facts.mjs';
const arg=k=>process.argv.find(a=>a.startsWith(`--${k}=`))?.split('=')[1];
const kind=arg('kind'),n=Number(arg('n')||20),m=Number(arg('m')||10),seed=arg('seed')||'C';
// Sätze, die zur Faktart passen (Anzeige und Vorauswahl der Berichte ohne Fakt)
const HINT={
 funding:/Fördermittel|Förderprogramm|Zuwendung|Förderbescheid|Förderantrag|Landesmittel|Bundesmittel/,
 funding_euro:/(Förder|Zuwendung|Zuschuss|Landesmittel|Bundesmittel)[^.]{0,80}\d[\d.,]*\s*(€|Euro|EUR|Mio)/,
 kita_places:/\d+\s*(neue\s+|zusätzliche\s+)?(Betreuungs|Kita-|Krippen|Kindergarten|U3-|Ü3-)?[Pp]lätze/,
 kita_fee:/Elternbeitr|Kostenbeitr|Benutzungsgebühr|Betreuungsgebühr|beitragsfrei/,
 hebesatz:/Hebesatz|v\.\s?H\.|vom Hundert/,
 fee_rate:/(Gebühr|Entgelt)[^.]{0,80}\d+,\d+\s*(€|Euro)[^.]{0,20}(m³|m²|cbm|qm|Kubikmeter|Quadratmeter)/,
 housing:/\d+\s*(Wohneinheiten|WE\b|Wohnungen)/,
 heat_plan:/Wärmeplan/,
 grant:/Zuschuss|Förderung|Zuwendung/,
 faction:/Antrag|Anfrage/,
 plan:/Bebauungsplan|Flächennutzungsplan/,
 plan_use:/Bebauungsplan|Flächennutzungsplan/,
};
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local,{readOnly:true});
const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const h=id=>createHash('sha256').update(seed+kind+id).digest('hex');
const SENT=/(?<=[^0-9][.;!?])\s+(?=[A-ZÄÖÜ„"])/u;
const read=id=>{
 const r=db.prepare("SELECT json_extract(payload,'$.title') title,json_extract(payload,'$.documents') docs FROM topics WHERE id=?").get(id);
 const docs=JSON.parse(r.docs||'[]'),p=primaryPdf(docs);
 const t=p&&!sessionDocument({title:p.title},1)&&store.getText(p.url);
 return {title:r.title||'',text:t?mergePages(t.pages):''};
};
const show=(id,{title,text})=>{
 const facts=factsOf(title,text).filter(x=>x.kind===kind).map(x=>[x.value,x.detail].filter(Boolean).join(' | '));
 const sents=text.replace(/\s+/g,' ').replace(/(\p{Ll})- (\p{Ll})/gu,'$1$2').split(SENT).filter(s=>HINT[kind]?.test(s)&&s.length<600).slice(0,4).map(s=>s.slice(0,300));
 return {id,title,facts,sents,hasText:!!text};
};
const hits=db.prepare('SELECT DISTINCT topic_id id FROM topic_facts WHERE kind=?').all(kind).map(r=>r.id).sort((a,b)=>h(a).localeCompare(h(b)));
const out=[];
for(const id of hits){if(out.length>=n)break;const d=read(id);if(d.text||['faction','plan','plan_use','heat_plan','grant'].includes(kind))out.push({...show(id,d),group:'treffer'});}
// Ohne Fakt: Berichte mit passendem Titelwort, deren Text die Hinweiswörter enthält
const has=new Set(hits);let miss=0;
const TITLE={funding:'%förder%',funding_euro:'%förder%',kita_places:'%kita%',kita_fee:'%beitr%',hebesatz:'%hebes%',fee_rate:'%gebühr%',housing:'%bebauungsplan%',heat_plan:'%wärme%',grant:'%zuschuss%',faction:'%antrag%',plan:'%bebauungsplan%',plan_use:'%bebauungsplan%'}[kind];
const cand=db.prepare("SELECT id FROM topics WHERE active=1 AND lower(json_extract(payload,'$.title')) LIKE ?").all(TITLE).map(r=>r.id).filter(i=>!has.has(i)).sort((a,b)=>h(a).localeCompare(h(b)));
for(const id of cand){if(miss>=m)break;const d=read(id);if(!d.text)continue;const s=show(id,d);if(!s.sents.length)continue;out.push({...s,group:'ohne'});miss++;}
console.log(JSON.stringify(out,null,1));
store.close();
