// Trägt Einordnungen von Hand in eine Stichprobe ein. Eingabe (Standardeingabe), je Zeile:
//   <Nr> <thema>[/<thema>…] [<unterthema>,…]     thema: bauen … wirtschaft oder o (offen); Unterthema ohne Themenpräfix
//   node scripts/theme-study/gold.mjs --set=theme-dev < labels.txt
import fs from 'node:fs';
import {THEMES,SUBTOPICS} from '../../shared/themes.mjs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const file=new URL('../../tests/fixtures/'+arg('set','theme-dev')+'.json',import.meta.url);
const ref=JSON.parse(fs.readFileSync(file,'utf8'));
const ids=new Set(THEMES.map(t=>t.id)),subs=new Set(SUBTOPICS.map(s=>s.id.split('.')[1]));
let n=0;
for(const line of fs.readFileSync(0,'utf8').split('\n')){
 const m=line.trim().match(/^(\d+)\s+(\S+)(?:\s+(\S+))?$/);if(!m)continue;
 const themes=m[2].split('/').map(t=>t==='o'?'offen':t);
 for(const t of themes)if(t!=='offen'&&!ids.has(t))throw new Error('Thema? '+line);
 const s=(m[3]||'').split(',').filter(Boolean);for(const x of s)if(!subs.has(x))throw new Error('Unterthema? '+line);
 ref.rows[+m[1]].gold={themes,subs:s};n++;
}
fs.writeFileSync(file,JSON.stringify(ref,null,1));
console.log(n,'eingetragen,',ref.rows.filter(r=>!r.gold).length,'offen');
