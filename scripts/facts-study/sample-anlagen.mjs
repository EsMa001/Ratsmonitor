// Anlagen: Berichte mit passendem Titel und Text, aber ohne Fakt; liest ALLE Dokumente mit Text und fragt die echte Regel (nur lesend).
//   npx esbuild scripts/facts-study/sample-anlagen.mjs --bundle --platform=node --format=esm > tmp/fakten/an.mjs
//   ssh ratsmonitor 'nice -n 19 node --input-type=module - <saat> <n> <art> "<titel-like|…>"' < tmp/fakten/an.mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import * as F from '../../shared/topic-facts.mjs';
const [salt='a1',n='40',kind='hebesatz',likes='%haushaltssatzung%']=process.argv.slice(2);
const fn={hebesatz:F.hebesatzOf,fee_rate:F.feeRateOf,dog_tax:F.dogTaxOf}[kind];
const root='/srv/ratsmonitor/data/';
const db=new DatabaseSync(root+'ratsmonitor.sqlite',{readOnly:true}),idx=new DatabaseSync(root+'pdf-store/index.sqlite',{readOnly:true});
const shaOf=idx.prepare("SELECT t.sha256 sha FROM pdfs p JOIN texts t ON t.sha256=p.sha256 AND t.status='ok' WHERE p.url=?");
const text=sha=>{try{return fs.readFileSync(`${root}pdf-store/files/${sha.slice(0,2)}/${sha}.txt`,'utf8').split('\f').join('\n').replace(/[^\S\n]+/g,' ');}catch{return '';}};
const h=s=>createHash('sha256').update(salt+s).digest('hex');
const has=new Set(db.prepare('SELECT DISTINCT topic_id id FROM topic_facts WHERE kind=?').all(kind).map(r=>r.id));
const cond=likes.split('|').map(()=>"lower(json_extract(payload,'$.title')) LIKE ?").join(' OR ');
const rows=db.prepare(`SELECT id,json_extract(payload,'$.title') title,json_extract(payload,'$.documents') docs FROM topics WHERE active=1 AND event_date>='2025-10-01' AND (${cond})`).all(...likes.split('|').map(x=>x.toLowerCase())).filter(r=>!has.has(r.id)).sort((a,b)=>h(a.id).localeCompare(h(b.id)));
let tested=0,found=0,noText=0;const out=[];
for(const r of rows){if(tested>=+n)break;
 let docs=[];try{docs=JSON.parse(r.docs||'[]');}catch{}
 const texts=docs.filter(d=>d.kind==='application/pdf').slice(0,15).map(d=>{const s=shaOf.get(d.url);return s?{title:d.title,t:text(s.sha)}:null;}).filter(Boolean);
 if(!texts.length){noText++;continue;}
 tested++;let hit=null;
 for(const x of texts){let v=null;try{v=fn(r.title,x.t);}catch{}if(v&&(Array.isArray(v)?v.length:true)){hit={doc:(x.title||'').slice(0,60),v:JSON.stringify(v).slice(0,120)};break;}}
 if(hit){found++;if(out.length<12)out.push({title:r.title.slice(0,80),docs:texts.length,hit});}
}
console.log(JSON.stringify({candidates:rows.length,geprueft:tested,ohneText:noText,mitWertInAnlage:found,beispiele:out}));
