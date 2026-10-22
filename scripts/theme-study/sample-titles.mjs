// Zieht Sachpunkte (itemKind 'subject') aus der lokalen Datenbank zum Einordnen für das gelernte Themenmodell (model.mjs): nur
// Titel, gleiche Titel einmal, ohne Titel aus vorhandenen Messsätzen (tests/fixtures/theme-*.json). Auswahl per SHA-256(id + Salz).
//   node scripts/theme-study/sample-titles.mjs --name=theme-train-a --salt=train-a-2026-10-21 --n=1000 [--skip=theme-check-a]
import {readdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {itemKind} from '../../shared/item-kind.mjs';

const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const name=arg('name','theme-train-a'),salt=arg('salt','train-a'),n=+arg('n',1000);
const fx=new URL('../../tests/fixtures/',import.meta.url);
const key=t=>String(t||'').toLowerCase().replace(/\s+/g,' ').trim();
const seen=new Set();
for(const f of readdirSync(fx).filter(f=>/^theme-.*\.json$/.test(f)&&f!==name+'.json'))for(const r of JSON.parse(readFileSync(new URL(f,fx),'utf8')).rows)seen.add(key(r.title));
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'),{readOnly:true});
const ids=[];
for(const r of db.prepare('SELECT id FROM topics WHERE active=1').iterate())ids.push([createHash('sha256').update(r.id+salt).digest('hex'),r.id]);
ids.sort((a,b)=>a[0]<b[0]?-1:1);
const get=db.prepare("SELECT json_extract(payload,'$.title') title FROM topics WHERE id=?");
const rows=[];
for(const [,id] of ids){
 if(rows.length>=n)break;
 const title=get.get(id)?.title||'',k=key(title);
 if(!k||seen.has(k)||itemKind(title)!=='subject')continue;
 seen.add(k);rows.push({id,title,gold:null});
}
const out=new URL(name+'.json',fx);
if(existsSync(out)&&!process.argv.includes('--force'))throw new Error(name+'.json gibt es schon (--force)');
writeFileSync(out,JSON.stringify({version:name,note:`${rows.length} Sachpunkte (itemKind subject), gleiche Titel einmal, ohne Titel anderer theme-Messsätze, SHA-256(id+'${salt}'), lokale DB ${new Date().toISOString().slice(0,10)}; gold von Hand (Claude) nach Themen und Unterthemen in shared/themes.mjs, ohne Regel und Wortlisten`,rows},null,1));
console.log(rows.length,'Titel →',name+'.json');
