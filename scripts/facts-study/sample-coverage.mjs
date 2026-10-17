// Abdeckung einer Faktart: Berichte mit passendem Titel, aber ohne Fakt, mit den Sätzen des Hauptdokuments, die einen Wert zeigen könnten (nur lesend).
//   npx esbuild scripts/facts-study/sample-coverage.mjs --bundle --platform=node --format=esm > tmp/fakten/c.mjs
//   ssh ratsmonitor 'nice -n 19 node --input-type=module - <saat> <n> <art> "<titel-like|…>" "<satz-regex>"' < tmp/fakten/c.mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {primaryPdf} from '../../shared/document-type.mjs';
const [salt='c1',n='30',kind='fee_rate',likes='%gebühr%',hint='\\d+,\\d+\\s*(€|Euro)']=process.argv.slice(2);
const root='/srv/ratsmonitor/data/';
const db=new DatabaseSync(root+'ratsmonitor.sqlite',{readOnly:true}),idx=new DatabaseSync(root+'pdf-store/index.sqlite',{readOnly:true});
const shaOf=idx.prepare("SELECT t.sha256 sha FROM pdfs p JOIN texts t ON t.sha256=p.sha256 AND t.status='ok' WHERE p.url=?");
const text=sha=>{try{return fs.readFileSync(`${root}pdf-store/files/${sha.slice(0,2)}/${sha}.txt`,'utf8').split('\f').join('\n').replace(/\s+/g,' ');}catch{return '';}};
const h=s=>createHash('sha256').update(salt+s).digest('hex');
const has=new Set(db.prepare('SELECT DISTINCT topic_id id FROM topic_facts WHERE kind=?').all(kind).map(r=>r.id));
const cond=likes.split('|').map(()=>"lower(json_extract(payload,'$.title')) LIKE ?").join(' OR ');
const rows=db.prepare(`SELECT id,json_extract(payload,'$.title') title,json_extract(payload,'$.documents') docs FROM topics WHERE active=1 AND event_date>='2026-03-01' AND (${cond})`).all(...likes.split('|').map(x=>x.toLowerCase())).filter(r=>!has.has(r.id)).sort((a,b)=>h(a.id).localeCompare(h(b.id)));
const re=new RegExp(hint,'i'),out=[],seen=new Set();
for(const r of rows){
 if(out.length>=+n)break;if(seen.has(r.title))continue;seen.add(r.title);
 let docs=[];try{docs=JSON.parse(r.docs||'[]');}catch{}
 const p=primaryPdf(docs),s=p&&shaOf.get(p.url),tx=s?text(s.sha):'';
 if(!tx)continue;
 const sents=tx.split(/(?<=[^0-9][.;!?])\s+/).filter(x=>re.test(x)&&x.length<500).slice(0,3).map(x=>x.slice(0,260));
 out.push({id:r.id,title:(r.title||'').slice(0,120),sents});
}
console.log(JSON.stringify({candidates:rows.length,out}));
