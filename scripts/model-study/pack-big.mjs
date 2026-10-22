// Teilt die große Stichprobe (sample-big.mjs) in Pakete für die Einordnung: je Paket etwa --size Berichte, gemischt aus allen
// Anteilen, dazu 10 % der Berichte ein zweites Mal in einem anderen Paket (Schlüssel mit „d“) für die Übereinstimmung.
//   node scripts/model-study/pack-big.mjs <kern-big.json> <Ordner> [--size=55]
import fs from 'node:fs';
const [file,dir]=process.argv.slice(2),size=+(process.argv.find(a=>a.startsWith('--size='))?.slice(7)||55);
const rows=JSON.parse(fs.readFileSync(file,'utf8')).rows.map((r,i)=>({k:'b'+i,title:r.title,committee:r.committee,paperType:r.paperType,eventDate:r.eventDate,events:r.events,pdfs:r.pdfs.map(p=>({i:p.i,name:p.name,bytes:p.bytes,pages:p.pages,first:p.first,decision:p.decision}))}));
const B=Math.ceil(rows.length/size),packs=[...Array(B)].map(()=>[]);
rows.forEach((r,i)=>packs[i%B].push(r));
rows.filter((_,i)=>i%10===7).forEach((r,j)=>{const home=rows.indexOf(r)%B;packs[(home+1+j%(B-1))%B].push({...r,k:r.k+'d'});});
fs.mkdirSync(dir,{recursive:true});
packs.forEach((p,i)=>fs.writeFileSync(`${dir}/paket-${i+1}.json`,JSON.stringify(p)));
console.log(rows.length,'Berichte in',B,'Paketen, je',Math.min(...packs.map(p=>p.length)),'bis',Math.max(...packs.map(p=>p.length)));
