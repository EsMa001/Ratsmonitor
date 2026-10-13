// Gibt eine Dokument-Stichprobe zum Einordnen aus, ohne die Wahl der Regeln: Nr | Berichtstitel, darunter a, b, … je PDF
// mit Titel, Zahl der Berichte derselben Sitzung mit diesem PDF und Textanfang.   node scripts/doc-study/list.mjs --set=doc-dev [--from=0 --to=75]
import fs from 'node:fs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const ref=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/'+arg('set','doc-dev')+'.json',import.meta.url),'utf8'));
const from=+arg('from',0);
ref.rows.slice(from,+arg('to',1e9)).forEach((r,k)=>{console.log(`${k+from}| ${r.title.replace(/\s+/g,' ').slice(0,120)}`);
 r.docs.forEach((d,j)=>console.log(`   ${'abcdefghijkl'[j]} ${d.title.replace(/\s+/g,' ').slice(0,80)}${d.uses>1?` [${d.uses}]`:''}${d.head?' ¦ '+d.head.slice(0,150):' ¦ (kein Text)'}`));if(r.more)console.log(`   (+${r.more})`);});
