// Stichprobe je Unterthema der Themenradare (topic_facts kind 'radar:*') zum Prüfen von Hand: je Unterthema N Vorgänge,
// fest gewählt über SHA-256 (seed). Ausgabe JSON: [{radar, topic, id, title, signal}]
//   node scripts/facts-study/sample-radar.mjs [--n=5] [--seed=C] > datei.json
import {readdirSync,existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
const arg=k=>process.argv.find(a=>a.startsWith(`--${k}=`))?.split('=')[1];
const n=Number(arg('n')||5),seed=arg('seed')||'C';
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local,{readOnly:true});
const h=id=>createHash('sha256').update(seed+id).digest('hex');
const groups=new Map();
for(const r of db.prepare("SELECT f.kind,f.value,f.detail,f.topic_id id,json_extract(t.payload,'$.title') title FROM topic_facts f JOIN topics t ON t.id=f.topic_id WHERE f.kind LIKE 'radar:%' AND t.active=1").iterate()){
 const k=r.kind+'|'+r.value;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);
}
const out=[];
for(const [k,rows] of [...groups].sort((a,b)=>a[0].localeCompare(b[0]))){
 const [kind,topic]=k.split('|');
 for(const r of rows.sort((a,b)=>h(a.id).localeCompare(h(b.id))).slice(0,n))out.push({radar:kind.slice(6),topic,count:rows.length,id:r.id,title:r.title,signal:r.detail});
}
console.log(JSON.stringify(out,null,1));
