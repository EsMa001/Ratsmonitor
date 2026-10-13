// Stichprobe für „Was geschieht“ (shared/stage.mjs), aus den Serverdaten (nur lesend): Sachpunkte (itemKind 'subject'), mit
// Betreff/Beschlussvorschlag des Hauptdokuments, wo es als Text vorliegt. Gebündelt mit esbuild und per ssh ausgeführt:
//   npx esbuild scripts/stage-study/sample-server.mjs --bundle --platform=node --format=esm > /tmp/s.mjs
//   ssh ratsmonitor 'nice -n 19 node --input-type=module - <salt> <n>' < /tmp/s.mjs > tests/fixtures/stage-<salt>.json
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {primaryPdf,sessionDocument} from '../../shared/document-type.mjs';
import {itemKind} from '../../shared/item-kind.mjs';
import {subjectOf} from '../../shared/themes.mjs';
const [salt='stage',n='300']=process.argv.slice(2);
const root='/srv/ratsmonitor/data/';
const db=new DatabaseSync(root+'ratsmonitor.sqlite',{readOnly:true}),idx=new DatabaseSync(root+'pdf-store/index.sqlite',{readOnly:true});
const max=db.prepare('SELECT max(rowid) m FROM topics').get().m;
const get=db.prepare("SELECT id,region_id,event_date,json_extract(payload,'$.title') title,json_extract(payload,'$.documents') docs FROM topics WHERE rowid=? AND active=1");
const same=db.prepare("SELECT json_extract(payload,'$.documents') docs FROM topics WHERE region_id=? AND event_date=? AND active=1");
const shaOf=idx.prepare("SELECT t.sha256 sha FROM pdfs p JOIN texts t ON t.sha256=p.sha256 AND t.status='ok' WHERE p.url=?");
const merged=sha=>{try{return fs.readFileSync(`${root}pdf-store/files/${sha.slice(0,2)}/${sha}.txt`,'utf8').split('\f').join('\n').replace(/[^\S\n]+/g,' ');}catch{return '';}};
const rows=[],seen=new Set(),titles=new Set();let tried=0;
for(let i=0;rows.length<+n&&i<+n*50;i++){
 const r=Number(BigInt('0x'+createHash('sha256').update(salt+i).digest('hex').slice(0,12))%BigInt(max))+1;
 if(seen.has(r))continue;seen.add(r);const t=get.get(r);if(!t)continue;tried++;
 const title=t.title||'';if(itemKind(title)!=='subject'||titles.has(title))continue;titles.add(title);
 let docs=[];try{docs=JSON.parse(t.docs||'[]');}catch{}
 let subject='';
 if(docs.some(d=>d.kind==='application/pdf')){
  const uses=new Map();for(const s of same.iterate(t.region_id,t.event_date)){let d=[];try{d=JSON.parse(s.docs||'[]');}catch{}for(const x of d)if(x.kind==='application/pdf')uses.set(x.url,(uses.get(x.url)||0)+1);}
  const u=x=>uses.get(x)||0,p=primaryPdf(docs,{uses:u,hasText:x=>!!shaOf.get(x)});
  const s=p&&!sessionDocument(p,u(p.url))?shaOf.get(p.url):null;
  if(s)subject=subjectOf(merged(s.sha));
 }
 rows.push({id:t.id,title,subject,gold:null});
}
process.stdout.write(JSON.stringify({version:'stage-'+salt,note:`${rows.length} aktive Sachpunkte (item-kind-v2), verschiedene Titel, Betreff/Beschlussvorschlag wo Text vorliegt (Serverablage, nur lesend), aus ${tried} gezogenen; gold: eine Kennung aus shared/stage.mjs oder 'sonst'`,rows},null,1));
