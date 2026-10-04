// Official websites of municipalities, districts and municipal associations by official key from Wikidata.
// LAND selects the state (default 05 = NRW; 03 = Niedersachsen), DIR the working folder, AREAS the area list.
// Lower Saxon Samtgemeinden carry their 9-digit regional key: Wikidata P1388 holds it with 12 digits ("…000").
import fs from 'node:fs';
const land=process.env.LAND||'05',dir=process.env.DIR||'tmp/source-discovery/';
fs.mkdirSync(dir,{recursive:true});
const q=`SELECT ?ags ?kind ?itemLabel ?website WHERE {
 { ?item wdt:P439 ?ags. BIND("city" AS ?kind) } UNION { ?item wdt:P440 ?ags. BIND("district" AS ?kind) } UNION { ?item wdt:P1388 ?ars. BIND(IF(STRLEN(?ars)=12&&STRENDS(?ars,"000"),SUBSTR(?ars,1,9),?ars) AS ?ags) BIND("city" AS ?kind) }
 FILTER(STRSTARTS(?ags,"${land}"))
 OPTIONAL { ?item wdt:P856 ?website }
 SERVICE wikibase:label { bd:serviceParam wikibase:language "de" }
}`;
const r=await fetch('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q),{headers:{'User-Agent':'Ratsmonitor-SourceCatalog/1.0 (public council information; contact via github.com/EsMa001/Ratsmonitor)',Accept:'application/sparql-results+json'}});
if(!r.ok)throw Error('Wikidata HTTP '+r.status);
const rows=(await r.json()).results.bindings.map(b=>({ags:b.ags.value,kind:b.kind.value,label:b.itemLabel.value,website:b.website?.value||null}));
fs.writeFileSync(dir+'wikidata.json',JSON.stringify(rows,null,1));
const regions=JSON.parse(fs.readFileSync(process.env.AREAS||'shared/nrw-regions.json','utf8'));
const by=new Map();for(const row of rows){const key=row.kind+':'+row.ags;by.set(key,[...(by.get(key)||[]),row]);}
let hit=0,miss=[];for(const reg of regions){const rs=by.get(reg.kind+':'+reg.ags)||[];if(rs.some(x=>x.website))hit++;else miss.push(reg.name+' '+reg.ags);}
console.log('Wikidata rows',rows.length,'Regionen mit Website',hit,'/',regions.length,'ohne:',miss.slice(0,40).join('; '));
