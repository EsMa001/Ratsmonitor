// Führt die Einordnung der Kernsätze zusammen (paket-N.out.json): Übereinstimmung der Doppel (Kurzfassung gleich, Überlappung der
// Langfassung, beide „keine“), fehlende oder ungültige Einträge werden gezählt; mit --write= die Einordnung als gold in die Stichprobe.
//   node scripts/model-study/merge-saetze.mjs tests/fixtures/kern-saetze.json <dir> [--write=tests/fixtures/kern-saetze.json]
import fs from 'node:fs';
import {candidates} from '../../server/model/sentences.mjs';
const [file,dir]=process.argv.slice(2),write=process.argv.find(a=>a.startsWith('--write='))?.slice(8);
const data=JSON.parse(fs.readFileSync(file,'utf8')),got=new Map(),dup=new Map();let packs=0,bad=0,invalid=0;
for(const f of fs.readdirSync(dir).filter(f=>/^paket-\d+\.out\.json$/.test(f))){
 let arr;try{arr=JSON.parse(fs.readFileSync(dir+'/'+f,'utf8'));}catch{bad++;continue;}packs++;
 for(const o of arr)(String(o.k).endsWith('d')?dup:got).set(String(o.k).replace(/d$/,''),o);}
const n=k=>candidates(data.rows[+k.slice(1)].text).length;
const valid=(o,k)=>{const m=n(k),ok=a=>Array.isArray(a)&&a.every(i=>Number.isInteger(i)&&i>=0&&i<m);return ok(o.short)&&ok(o.long)&&(o.none?!o.short.length&&!o.long.length:o.short.length>=1&&o.short.length<=2&&o.long.length>=1);};
let same=0,both=0,jac=0,cmp=0,noneAgree=0;
for(const [k,b] of dup){const a=got.get(k);if(!a)continue;cmp++;
 if(!!a.none===!!b.none)noneAgree++;
 if(!a.none&&!b.none){both++;if(a.short.some(i=>b.short.includes(i)))same++;const A=new Set(a.long),B=new Set(b.long),I=[...A].filter(x=>B.has(x)).length;jac+=I/Math.max(1,new Set([...A,...B]).size);}}
const pc=(a,b)=>b?Math.round(100*a/b)+' %':'–';
console.log(`${packs} Pakete gelesen (${bad} unlesbar), ${got.size} von ${data.rows.length} Berichten eingeordnet`);
console.log(`Doppel ${cmp}: „keine“ gleich ${pc(noneAgree,cmp)} · Kurzfassung mit gemeinsamem Satz ${pc(same,both)} · Langfassung Überlappung Ø ${pc(jac,both)}`);
if(write){
 for(const [k,o] of got){const r=data.rows[+k.slice(1)];if(!valid(o,k)){invalid++;continue;}r.gold={short:[...o.short].sort((x,y)=>x-y),long:[...new Set([...o.long,...o.short])].sort((x,y)=>x-y),none:!!o.none};}
 fs.writeFileSync(write,JSON.stringify(data));console.log('geschrieben',write,`(${invalid} ungültig)`);
}
