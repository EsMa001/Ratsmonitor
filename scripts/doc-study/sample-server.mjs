// Stichprobe für Dokumentart, Hauptdokument und Sitzungsunterlage aus den Serverdaten, nur lesend: läuft per ssh über die
// Standardeingabe auf dem Server und schreibt JSON auf die Standardausgabe, legt dort nichts ab.
//   ssh ratsmonitor 'nice -n 19 node --input-type=module - <salt> <n>' < scripts/doc-study/sample-server.mjs > tests/fixtures/doc-dev.json
// Auswahl: Berichte mit mindestens einem übrigen PDF (role 'other') in der Ablage, per SHA-256(id+Salz). Je PDF: Titel,
// Textanfang (400 Zeichen, falls Text vorhanden), Zahl der Berichte derselben Sitzung (gleiches Gebiet und Datum) mit diesem PDF.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const [salt='doc',n='150']=process.argv.slice(2);
const root='/srv/ratsmonitor/data/';
const idx=new DatabaseSync(root+'pdf-store/index.sqlite',{readOnly:true});
const db=new DatabaseSync(root+'ratsmonitor.sqlite',{readOnly:true});
const ids=idx.prepare("SELECT DISTINCT topic_id id FROM pdfs WHERE role='other' AND status IN ('ok','text-only') AND topic_id IS NOT NULL").all().map(r=>r.id);
ids.sort((a,b)=>{const x=createHash('sha256').update(a+salt).digest('hex'),y=createHash('sha256').update(b+salt).digest('hex');return x<y?-1:1;});
const topic=db.prepare("SELECT id,region_id,event_date,active,json_extract(payload,'$.title') title,json_extract(payload,'$.documents') docs FROM topics WHERE id=?");
const sameSession=db.prepare("SELECT json_extract(payload,'$.documents') docs FROM topics WHERE region_id=? AND event_date=? AND active=1");
const shaOf=idx.prepare('SELECT sha256 FROM pdfs WHERE url=?');
const head=sha=>{try{return fs.readFileSync(`${root}pdf-store/files/${sha.slice(0,2)}/${sha}.txt`,'utf8').replace(/\s+/g,' ').slice(0,400);}catch{return '';}};
const rows=[];
for(const id of ids){
 if(rows.length>=+n)break;
 const t=topic.get(id);if(!t||!t.active)continue;
 let docs=[];try{docs=JSON.parse(t.docs||'[]').filter(d=>d.kind==='application/pdf');}catch{}
 if(docs.length<2)continue;
 const uses=new Map();
 for(const r of sameSession.iterate(t.region_id,t.event_date)){let d=[];try{d=JSON.parse(r.docs||'[]');}catch{}for(const x of d)if(x.kind==='application/pdf')uses.set(x.url,(uses.get(x.url)||0)+1);}
 rows.push({id,title:t.title||'',docs:docs.slice(0,12).map(d=>{const s=shaOf.get(d.url)?.sha256;return {title:d.title||'',url:d.url,uses:uses.get(d.url)||1,head:s?head(s):''};}),more:Math.max(0,docs.length-12),gold:null});
}
process.stdout.write(JSON.stringify({version:'doc-'+salt,note:`${rows.length} aktive Berichte mit mindestens 2 PDFs, davon mindestens ein übriges PDF in der Ablage, Serverdaten (nur lesend) ${new Date().toISOString().slice(0,10)}, SHA-256(id+'${salt}'); uses = Berichte derselben Sitzung mit diesem PDF; gold von Hand (Claude) vor dem Messen`,rows},null,1));
