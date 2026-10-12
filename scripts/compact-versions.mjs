// Bestand von article_versions in Änderungen umwandeln (shared/article-version.mjs): jede volle Kopie wird zur Änderung
// gegenüber dem folgenden Stand (nächste Fassung, sonst der aktuelle Vorgang). Schon umgewandelte Zeilen bleiben, wie sie
// sind; ein zweiter Lauf ändert nichts. Geprüft wird je Vorgang, dass restoreVersions die vollen Kopien wieder ergibt
// (ohne metadata und updatedAt); sonst bleibt der Vorgang unverändert. Die Datei wird erst nach VACUUM kleiner.
//
//   DATABASE_FILE=<sqlite> node scripts/compact-versions.mjs            nur zählen und messen
//   DATABASE_FILE=<sqlite> node scripts/compact-versions.mjs --apply    umwandeln, in Stücken zu 2.000 Vorgängen
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {versionPayload,restoreVersions,VERSION_FORMAT} from '../shared/article-version.mjs';

const apply=process.argv.includes('--apply');
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local,{readOnly:!apply});db.exec('PRAGMA busy_timeout=60000');

const ids=db.prepare('SELECT DISTINCT topic_id FROM article_versions').all().map(r=>r.topic_id);
const versionsOf=db.prepare('SELECT id,payload FROM article_versions WHERE topic_id=? ORDER BY captured_at,rowid');
const topicOf=db.prepare('SELECT payload FROM topics WHERE id=?');
const write=db.prepare('UPDATE article_versions SET payload=? WHERE id=?');
// Vergleich ohne Reihenfolge der Schlüssel (die Wiederherstellung setzt geänderte Felder ans Ende)
const sorted=v=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
const bare=t=>{const {metadata,updatedAt,...rest}=t||{};return JSON.stringify(sorted(rest));};
const t0=Date.now();let topics=0,rows=0,converted=0,before=0,after=0,mismatch=0,missing=0,open=0;
for(const id of ids){
 const cur=topicOf.get(id);if(!cur){missing++;continue;}
 const vs=versionsOf.all(id).map(v=>({id:v.id,raw:v.payload,p:JSON.parse(v.payload)}));
 rows+=vs.length;topics++;
 if(vs.every(v=>v.p?.format===VERSION_FORMAT))continue;
 const current=JSON.parse(cur.payload);
 // Volle Stände in Reihenfolge (älteste zuerst); umgewandelte Zeilen vorher aus dem Folgenden zurückrechnen
 const full=restoreVersions(current,[...vs].reverse().map(v=>v.p)).reverse();
 const out=vs.map((v,i)=>v.p?.format===VERSION_FORMAT?v.raw:versionPayload(full[i],i+1<vs.length?full[i+1]:current));
 const check=restoreVersions(current,[...out].reverse().map(x=>JSON.parse(x))).reverse();
 if(check.some((s,i)=>bare(s)!==bare(full[i]))){mismatch++;continue;}
 for(let i=0;i<vs.length;i++){
  if(out[i]===vs[i].raw)continue;
  before+=vs[i].raw.length;after+=out[i].length;converted++;
  if(apply){if(!open)db.exec('BEGIN');write.run(out[i],vs[i].id);if(++open>=2000){db.exec('COMMIT');open=0;}}
 }
 if(topics%20000===0)console.log(`${topics}/${ids.length} Vorgänge, ${converted} Fassungen, ${(before/1e9).toFixed(2)} → ${(after/1e9).toFixed(2)} GB`);
}
if(open)db.exec('COMMIT');
console.log(`Vorgänge ${topics}, Fassungen ${rows}, umgewandelt ${converted}: ${(before/1e9).toFixed(2)} GB → ${(after/1e9).toFixed(2)} GB; nicht umkehrbar (bleiben) ${mismatch}, ohne Vorgang ${missing}; ${((Date.now()-t0)/1000).toFixed(0)} s${apply?'':'. Nur gezählt, --apply wandelt um.'}`);
