// Trägt Einordnungen von Hand ein: je Zeile „<Nr> <Art>[/<Art>…]“ mit f Sitzungsablauf, s Sammelpunkt, r Routine, t Sachpunkt.
//   node scripts/item-study/gold.mjs --set=item-dev < labels.txt
import fs from 'node:fs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const file=new URL('../../tests/fixtures/'+arg('set','item-dev')+'.json',import.meta.url);
const ref=JSON.parse(fs.readFileSync(file,'utf8'));let n=0;
for(const line of fs.readFileSync(0,'utf8').split('\n')){
 const m=line.trim().match(/^(\d+)\s+([fsrt](?:\/[fsrt])*)$/);if(!m){if(line.trim())throw new Error('Zeile? '+line);continue;}
 ref.rows[+m[1]].gold=m[2].split('/');n++;
}
fs.writeFileSync(file,JSON.stringify(ref,null,1));
console.log(n,'eingetragen,',ref.rows.filter(r=>!r.gold).length,'offen');
