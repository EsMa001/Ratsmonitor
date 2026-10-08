/* Schnappschuss für die Mini-Ausschnitte der Plenara.X-Analysen auf den Branchenseiten:
   node scripts/build-branchen-ausschnitte.mjs [Basis-URL, Standard http://localhost:5173]
   Fragt je Branche und Analyse die Plenara.X-API zum Suchbegriff ab (Dev-Server muss laufen) und schreibt eine kleine
   statische Datei (public/data/branchen-ausschnitte.json). Die Branchenseiten lesen nur diese Datei, nicht die API.
   Neu erzeugen nach Datenimporten oder geänderten Branchenbegriffen. */
import {writeFileSync} from 'node:fs';
import {BRANCHEN} from '../components/ratsmonitor/info/content.ts';
import {ENTERPRISE} from '../components/ratsmonitor/info/branchen-enterprise.ts';
const base=process.argv[2]||'http://localhost:5173';
const API={beschluesse:'decisions',trends:'trends',diffusion:'diffusion',gremien:'network',graph:'graph'};
const round=v=>Math.round(v*1e4)/1e4;
function shrink(id,d){
 if(id==='beschluesse')return d.totals?.decided?{decided:d.totals.decided,approval:d.rates.approval,postponement:d.rates.postponement,months:(d.months||[]).slice(-12).map(m=>[m.approved,m.postponed,m.rejected])}:null;
 if(id==='trends'){const r=[...(d.rising||[]),...(d.emerging||[])].slice(0,3).map(t=>({term:t.term,ratio:t.ratio,series:t.series.map(round)}));return r.length?{rows:r}:null;}
 if(id==='diffusion'){
  const f=(d.regions||[]).map(r=>r.first).filter(Boolean).sort();if(f.length<3)return null;
  const t0=Date.parse(f[0]),span=Math.max(Date.parse(f[f.length-1])-t0,1),pts=[];
  for(let i=0;i<=24;i++){const t=t0+span*i/24;pts.push(f.filter(x=>Date.parse(x)<=t).length);}
  return {count:f.length,first:f[0],pts};
 }
 if(id==='gremien'){const e=[...(d.edges||[])].sort((a,b)=>b.n-a.n).slice(0,4).map(x=>[x.a,x.b,x.n]);return e.length?{edges:e}:null;}
 if(id==='graph'){const n=(d.nodes||[]).filter(x=>x.type==='term').slice(0,5).map(x=>[x.label,x.count]);return n.length?{terms:n}:null;}
 return null;
}
const out={generated:new Date().toISOString().slice(0,10),items:{}};
for(const b of BRANCHEN){
 const e=ENTERPRISE[b.slug];if(!e)continue;
 for(const [i,[id]] of e.analysen.slice(0,2).entries()){
  const api=API[id],term=b.keywords[i]??b.keywords[0];
  if(!api){console.log('übersprungen (kein Ausschnitt):',b.slug,id);continue;}
  const key=`${id}|${term}`;if(key in out.items)continue;
  try{
   const r=await fetch(`${base}/api/analytics/${api}?${new URLSearchParams({q:term,level:'city'})}`);
   if(!r.ok)throw new Error(r.status);
   out.items[key]=shrink(id,await r.json());
   console.log(key,out.items[key]?'ok':'leer');
  }catch(err){console.log(key,'Fehler',err.message);}
 }
}
writeFileSync(new URL('../public/data/branchen-ausschnitte.json',import.meta.url),JSON.stringify(out));
console.log('geschrieben:',Object.keys(out.items).length,'Einträge');
