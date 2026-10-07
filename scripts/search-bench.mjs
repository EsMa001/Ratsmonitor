/* Messung der Suchanfragen: node scripts/search-bench.mjs <label> [basis-url]
   Hängt eine Zeile je Suchwort und Lauf an docs/search-bench/results.csv (für Diagramme).
   kalt = Cache-Umgehung über einen Zufallsparameter, warm = identischer zweiter Aufruf. */
import {appendFileSync,existsSync,mkdirSync} from 'node:fs';
const label=process.argv[2]||'unlabeled',base=process.argv[3]||'http://127.0.0.1:5173';
const WORDS=['Windpark','Bebauungsplan','Kita','Haushalt','Radweg','Schule','Photovoltaik','Feuerwehr','Windkraft oder Solar','Gewerbegebiet'];
const file='docs/search-bench/results.csv';
mkdirSync('docs/search-bench',{recursive:true});
if(!existsSync(file))appendFileSync(file,'timestamp,label,term,part,cold_ms,warm_ms,bytes,total,articles\n');
const get=async url=>{const t=performance.now(),r=await fetch(url),body=await r.text();return {ms:performance.now()-t,body,ok:r.ok};};
const stamp=new Date().toISOString();
/* part: full = Antwort ohne part (alter Stand), page = nur Ergebnisseite, facets = nur Zähler */
for(const w of WORDS)for(const part of ['full','page','facets']){
 const q='/api/search?q='+encodeURIComponent(w)+'&level=city&sort=desc&size=20'+(part==='full'?'':'&part='+part);
 const rnd=()=>'&_b='+Math.random().toString(36).slice(2);
 const cold=await get(base+q+rnd());
 const fixed=rnd();await get(base+q+fixed);const warm=await get(base+q+fixed);
 let total='',articles='';try{const d=JSON.parse(cold.body);total=d.total;articles=d.articles?.length;}catch{}
 const row=[stamp,label,JSON.stringify(w),part,cold.ms.toFixed(0),warm.ms.toFixed(0),cold.body.length,total,articles].join(',');
 appendFileSync(file,row+'\n');console.log(row);
}
