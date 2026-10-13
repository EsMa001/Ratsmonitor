// Gibt eine Stichprobe zum Einordnen von Hand aus (ohne Ergebnis der Regeln): Nr | Titel | Betreff/Beschluss
//   node scripts/theme-study/list.mjs --set=theme-dev [--from=0 --to=150]
import fs from 'node:fs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const ref=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/'+arg('set','theme-dev')+'.json',import.meta.url),'utf8'));
ref.rows.slice(+arg('from',0),+arg('to',1e9)).forEach((r,k)=>{const i=k+ +arg('from',0);
 console.log(i+'|'+r.title.replace(/\s+/g,' ').slice(0,170)+(r.subject?' ¦ '+r.subject.slice(0,200):''));});
