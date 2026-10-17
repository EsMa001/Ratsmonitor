// Stichprobe von Fakten vom Server (nur lesend): je Faktart N Berichte mit Fakt (Titel, Wert, Detail, passende Sätze) zum Prüfen von Hand.
//   npx esbuild scripts/facts-study/sample-server.mjs --bundle --platform=node --format=esm > tmp/fakten/s.mjs
//   ssh ratsmonitor 'nice -n 19 node --input-type=module - <saat> <n> <art,art,…>' < tmp/fakten/s.mjs > tmp/fakten/<saat>.json
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {primaryPdf,sessionDocument} from '../../shared/document-type.mjs';
const [salt='f1',n='20',kinds='']=process.argv.slice(2);
const root='/srv/ratsmonitor/data/';
const db=new DatabaseSync(root+'ratsmonitor.sqlite',{readOnly:true}),idx=new DatabaseSync(root+'pdf-store/index.sqlite',{readOnly:true});
const shaOf=idx.prepare("SELECT t.sha256 sha FROM pdfs p JOIN texts t ON t.sha256=p.sha256 AND t.status='ok' WHERE p.url=?");
const text=sha=>{try{return fs.readFileSync(`${root}pdf-store/files/${sha.slice(0,2)}/${sha}.txt`,'utf8').split('\f').join('\n').replace(/\s+/g,' ');}catch{return '';}};
const cols=db.prepare('PRAGMA table_info(topic_facts)').all().map(c=>c.name);
const h=s=>createHash('sha256').update(salt+s).digest('hex');
const out={cols};
for(const kind of kinds.split(',').filter(Boolean)){
 const total=db.prepare('SELECT count(*) c,count(DISTINCT topic_id) t FROM topic_facts WHERE kind=?').get(kind);
 const rows=db.prepare('SELECT * FROM topic_facts WHERE kind=?').all(kind).sort((a,b)=>h(a.topic_id).localeCompare(h(b.topic_id))).slice(0,+n);
 out[kind]={total,items:rows.map(r=>{
  const t=db.prepare("SELECT json_extract(payload,'$.title') title,json_extract(payload,'$.documents') docs FROM topics WHERE id=?").get(r.topic_id)||{};
  let docs=[];try{docs=JSON.parse(t.docs||'[]');}catch{}
  const p=primaryPdf(docs),s=p&&shaOf.get(p.url),tx=s?text(s.sha):'';
  const v=String(r.value??'').replace(/\D/g,'').slice(0,3)||String(r.value??'').slice(0,12);
  const keys=[String(r.detail||'').replace('.',','),String(r.detail||''),String(r.value||'').split(' ')[0]].filter(k=>k&&k.length>1);let i=-1;if(tx){const d=String(r.detail||'').replace('.',',');const re={plan_area:d&&new RegExp(d.replace(/,/,'[.,]')+'\\s*(ha|Hektar)'),wind_count:/Windenergie|Windkraft|Windpark|WEA/}[kind];if(re){const m=re.exec(tx);if(m)i=m.index;}if(i<0)for(const k of keys){i=tx.indexOf(k);if(i>=0)break;}}
  const ctx=i>=0?tx.slice(Math.max(0,i-160),i+160):'';
  const {topic_id,kind:_,...rest}=r;
  return {id:topic_id,title:(t.title||'').slice(0,140),...rest,ctx};
 })};
}
console.log(JSON.stringify(out));
