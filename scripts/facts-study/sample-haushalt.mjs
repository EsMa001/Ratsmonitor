// Haushaltssatzungen: wie viele Berichte, wie viele haben den Fakt hebesatz, wie viele den Text in der Ablage (nur lesend).
//   npx esbuild scripts/facts-study/sample-haushalt.mjs --bundle --platform=node --format=esm > tmp/fakten/hs.mjs
//   ssh ratsmonitor 'nice -n 19 node --input-type=module -' < tmp/fakten/hs.mjs
import {DatabaseSync} from 'node:sqlite';
import {primaryPdf} from '../../shared/document-type.mjs';
const root='/srv/ratsmonitor/data/';
const db=new DatabaseSync(root+'ratsmonitor.sqlite',{readOnly:true}),idx=new DatabaseSync(root+'pdf-store/index.sqlite',{readOnly:true});
const shaOf=idx.prepare("SELECT t.sha256 sha FROM pdfs p JOIN texts t ON t.sha256=p.sha256 AND t.status='ok' WHERE p.url=?");
const has=new Set(db.prepare("SELECT DISTINCT topic_id id FROM topic_facts WHERE kind='hebesatz'").all().map(r=>r.id));
const rows=db.prepare("SELECT id,region_id,json_extract(payload,'$.title') title,json_extract(payload,'$.documents') docs FROM topics WHERE active=1 AND event_date>='2025-10-01' AND lower(json_extract(payload,'$.title')) LIKE '%haushaltssatzung%'").all();
let withText=0,withFact=0,textNoFact=0;const regions=new Set(),regionsFact=new Set(),regionsText=new Set();
for(const r of rows){let d=[];try{d=JSON.parse(r.docs||'[]');}catch{}
 const p=primaryPdf(d),t=p&&shaOf.get(p.url);regions.add(r.region_id);
 if(has.has(r.id)){withFact++;regionsFact.add(r.region_id);}
 if(t){withText++;regionsText.add(r.region_id);if(!has.has(r.id))textNoFact++;}}
console.log(JSON.stringify({berichte:rows.length,gebiete:regions.size,mitText:withText,gebieteMitText:regionsText.size,mitFakt:withFact,gebieteMitFakt:regionsFact.size,textOhneFakt:textNoFact}));
