// Titel-Stichprobe aus den Serverdaten, nur lesend: per ssh über die Standardeingabe, JSON auf die Standardausgabe.
//   ssh ratsmonitor 'nice -n 19 node --input-type=module - <salt> <n>' < scripts/item-study/sample-server.mjs > tests/fixtures/item-dev.json
// Auswahl: Zeilen-Nummern aus SHA-256(Salz+i) über den Bereich der rowids, nur aktive Berichte.
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const [salt='item',n='400']=process.argv.slice(2);
const db=new DatabaseSync('/srv/ratsmonitor/data/ratsmonitor.sqlite',{readOnly:true});
const max=db.prepare('SELECT max(rowid) m FROM topics').get().m;
const get=db.prepare("SELECT id,json_extract(payload,'$.title') title FROM topics WHERE rowid=? AND active=1");
const rows=[],seen=new Set();
for(let i=0;rows.length<+n&&i<+n*20;i++){
 const r=Number(BigInt('0x'+createHash('sha256').update(salt+i).digest('hex').slice(0,12))%BigInt(max))+1;
 if(seen.has(r))continue;seen.add(r);const t=get.get(r);if(t)rows.push({id:t.id,title:t.title||'',gold:null});
}
process.stdout.write(JSON.stringify({version:'item-'+salt,note:`${rows.length} aktive Berichte, Serverdaten (nur lesend) ${new Date().toISOString().slice(0,10)}, rowid aus SHA-256('${salt}'+i); gold von Hand (Claude): f Sitzungsablauf, s Sammelpunkt, r Routine, t Sachpunkt`,rows},null,1));
