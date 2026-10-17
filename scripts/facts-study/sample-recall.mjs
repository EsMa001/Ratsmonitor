// Trefferquote eines Signals: Berichte, deren Titel Stichwörter nennt, mit Kennzeichen, ob das Signal sie erfasst (nur lesend).
//   npx esbuild scripts/facts-study/sample-recall.mjs --bundle --platform=node --format=esm > tmp/fakten/r.mjs
//   ssh ratsmonitor 'nice -n 19 node --input-type=module - <saat> <n> <like1|like2> <fakt:wert,…>' < tmp/fakten/r.mjs > tmp/fakten/r-<saat>.json
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const [salt='r1',n='60',likes='%wohn%',facts='']=process.argv.slice(2);
const db=new DatabaseSync('/srv/ratsmonitor/data/ratsmonitor.sqlite',{readOnly:true});
const h=s=>createHash('sha256').update(salt+s).digest('hex');
const cond=likes.split('|').map(()=>"lower(json_extract(payload,'$.title')) LIKE ?").join(' OR ');
const rows=db.prepare(`SELECT id,json_extract(payload,'$.title') title FROM topics WHERE active=1 AND event_date>='2026-03-01' AND (${cond})`).all(...likes.split('|').map(x=>x.toLowerCase()));
const seen=new Set(),out=[];
for(const r of rows.sort((a,b)=>h(a.id).localeCompare(h(b.id)))){
 if(out.length>=+n)break;if(seen.has(r.title))continue;seen.add(r.title);
 const f=db.prepare('SELECT kind,value FROM topic_facts WHERE topic_id=?').all(r.id).filter(x=>!facts||facts.split(',').some(k=>k===x.kind||k===x.kind+':'+x.value)).map(x=>x.kind+':'+x.value);
 out.push({id:r.id,title:(r.title||'').slice(0,130),flag:f});
}
console.log(JSON.stringify({total:rows.length,out}));
