// Vorgänge, deren ID sich nicht öffnen lässt (Detailseite, Merken, Folgen), je Gebiet und Quelle (nur lesend).
// Seit dem 29.10.2026 schreibt jeder Import nur noch zulässige IDs (withSafeTopicIds in shared/topic-identity.mjs); was dieses
// Skript findet, stammt aus früheren Importen und liegt unerreichbar im Bestand.
//
//   node scripts/check-topic-ids.mjs [--db <sqlite>] [--examples 3]
// Auf dem Server (braucht nur Node, kein Deploy):
//   ssh ratsmonitor 'node --input-type=module - --examples 3' < scripts/check-topic-ids.mjs
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';

// Wie TOPIC_ID in shared/topic-identity.mjs; hier abgeschrieben, damit das Skript ohne Repo über die Standardeingabe läuft.
const TOPIC_ID=/^[A-Za-z0-9_.:-]{1,200}$/;
const args=process.argv.slice(2).filter(a=>a!=='-');
const opt=(name,def)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:def;};
const envDb=()=>{try{return fs.readFileSync('/srv/ratsmonitor/ratsmonitor.env','utf8').match(/^DATABASE_FILE="?([^"\n]+)"?/m)?.[1];}catch{return null;}};
const file=opt('db',process.env.DATABASE_FILE||envDb()||'/srv/ratsmonitor/data/ratsmonitor.sqlite');
const examples=Number(opt('examples',3));
const db=new DatabaseSync(file,{readOnly:true});db.exec('PRAGMA busy_timeout=20000');

let total=0;const bad=new Map();
for(const r of db.prepare('SELECT id,region_id,source FROM topics').iterate()){
 total++;if(TOPIC_ID.test(r.id))continue;
 const key=r.region_id+' '+r.source,g=bad.get(key)||{count:0,examples:[]};
 g.count++;if(g.examples.length<examples)g.examples.push(r.id.length>120?r.id.slice(0,120)+'… ('+r.id.length+' Zeichen)':r.id);
 bad.set(key,g);
}
const n=[...bad.values()].reduce((a,g)=>a+g.count,0);
console.log(`${total} Vorgänge, davon ${n} mit unzulässiger ID in ${bad.size} Gebieten.`);
for(const [key,g] of [...bad].sort((a,b)=>b[1].count-a[1].count))console.log(`${String(g.count).padStart(7)}  ${key}  ${g.examples.join('  |  ')}`);
