// Trägt Einordnungen von Hand ein. Je Zeile: <Nr> <Hauptdokument> <Arten>
//   Hauptdokument: zulässige Buchstaben (z. B. "a" oder "abc"), "-" = kein eigenes Dokument (nur Sitzungsunterlagen)
//   Arten je PDF in Reihenfolge: p Vorlage/Antrag/Anfrage/Mitteilung, d Beschlusstext/Auszug, a Anlage, m Niederschrift,
//   i Einladung/Bekanntmachung/Tagesordnung, o Sonstiges; GROSS = Unterlage der ganzen Sitzung
//   node scripts/doc-study/gold.mjs --set=doc-dev < labels.txt
import fs from 'node:fs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const file=new URL('../../tests/fixtures/'+arg('set','doc-dev')+'.json',import.meta.url);
const ref=JSON.parse(fs.readFileSync(file,'utf8'));let n=0;
for(const line of fs.readFileSync(0,'utf8').split('\n')){
 const m=line.trim().match(/^(\d+)\s+(-|[a-l]+)\s+([pdamioPDAMIO]+)$/);if(!m){if(line.trim())throw new Error('Zeile? '+line);continue;}
 const r=ref.rows[+m[1]];
 if(m[3].length!==r.docs.length)throw new Error(`Nr ${m[1]}: ${m[3].length} Arten, ${r.docs.length} PDFs`);
 r.gold={main:m[2]==='-'?[]:[...m[2]].map(c=>c.charCodeAt(0)-97),types:[...m[3]].map(c=>c.toLowerCase()),session:[...m[3]].map(c=>c!==c.toLowerCase())};n++;
}
fs.writeFileSync(file,JSON.stringify(ref,null,1));
console.log(n,'eingetragen,',ref.rows.filter(r=>!r.gold).length,'offen');
