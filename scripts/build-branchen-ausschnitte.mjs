/* Schnappschuss für die Mini-Ausschnitte der Plenara.X-Analysen auf den Branchenseiten:
   node scripts/build-branchen-ausschnitte.mjs [Basis-URL, Standard http://localhost:5173]
   Fragt je Branche und Analyse die Plenara.X-API zum Suchbegriff ab (Dev-Server muss laufen) und schreibt eine kleine
   statische Datei (public/data/branchen-ausschnitte.json). Die Branchenseiten lesen nur diese Datei, nicht die API.
   Neu erzeugen nach Datenimporten oder geänderten Branchenbegriffen. */
import {writeFileSync,readFileSync} from 'node:fs';
import {LABELS} from '../shared/labels.mjs';
import {BRANCHEN} from '../components/ratsmonitor/info/content.ts';
import {ENTERPRISE,PLENARAX_VORTEILE} from '../components/ratsmonitor/info/branchen-enterprise.ts';
/* Gemeinde-Mittelpunkte der Karte (public/data/de_map.json, Schicht gem: a = AGS, p = x,y je Gemeinde) für die Mini-Karte der Diffusion */
const MAP=JSON.parse(readFileSync(new URL('../public/data/de_map.json',import.meta.url),'utf8'));
const GEM_AGS=MAP.gem.a,GEM_P=MAP.gem.p,STEP=125;
let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
for(let i=0;i<GEM_AGS.length;i++){const x=GEM_P[2*i],y=GEM_P[2*i+1];if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}
const GEM_IDX=new Map(GEM_AGS.map((a,i)=>[a,i]));
const base=process.argv[2]||'http://localhost:5173';
const API={beschluesse:'decisions',trends:'trends',diffusion:'diffusion',gremien:'network',graph:'graph',vergleich:'compare'};
/* Gebietsvergleich: zwei feste Orte (AGS), als Vorschau für die Plenara.X-Startseite */
const CMP_PLACES=[['05315','Köln'],['05913','Dortmund']],CMP_TERM='Köln und Dortmund',SAMMEL=new Set(['allgemein','sitzung','unklar']);
/* Allgemeine Wörter, die nichts über das Thema sagen */
const STOP=new Set(['stand','bereich','ziel','mehrerer','fraktion','aktueller','deutsche','straße','grund','vorstellung','ergebnisse','erlass','sachstand','erstellung','durchführung','kommunale','kommunalen','errichtung','höhe','verfahrens','öffentlicher','öffentlichkeit','träger','behörden','belange']);
const round=v=>Math.round(v*1e4)/1e4;
function shrink(id,d){
 if(id==='beschluesse')return d.totals?.decided?{decided:d.totals.decided,approval:d.rates.approval,postponement:d.rates.postponement,rejection:d.rates.rejection,months:(d.months||[]).slice(-12).map(m=>[m.approved,m.postponed,m.rejected]),
  /* Stand aller Einträge in % (ohne „unbekannt“ nicht, damit der Balken ehrlich bleibt) */
  status:(d.status||[]).map(s=>[s.id,s.n]),median:d.duration?.median??null,p75:d.duration?.p75??null}:null;
 if(id==='trends'){/* nur Begriffe, die in mindestens 3 Gebieten vorkommen (sonst meist Ortsnamen) */
  const r=[...(d.rising||[]),...(d.emerging||[])].filter(t=>t.regions>=3&&!STOP.has(t.term)).slice(0,6).map(t=>({term:t.term,ratio:t.ratio,series:t.series.map(round)}));return r.length?{rows:r}:null;}
 if(id==='diffusion'){
  const f=(d.regions||[]).map(r=>r.first).filter(Boolean).sort();if(f.length<3)return null;
  const t0=Date.parse(f[0]),span=Math.max(Date.parse(f[f.length-1])-t0,1),pts=[];
  for(let i=0;i<=24;i++){const t=t0+span*i/24;pts.push(f.filter(x=>Date.parse(x)<=t).length);}
  /* Klasse je Gemeinde nach Alter der ersten Erwähnung (wie die Legende der Analyse): 0 bis 1 Monat, 1 bis 3, 2 bis 6, 3 länger, 4 noch nicht */
  const end=Date.parse(d.to||new Date().toISOString().slice(0,10)),cls=new Array(GEM_AGS.length).fill('4');
  for(const r of d.regions||[]){const i=GEM_IDX.get(r.ags);if(i==null||!r.first)continue;const days=(end-Date.parse(r.first))/864e5;cls[i]=days<=30?'0':days<=90?'1':days<=180?'2':'3';}
  return {count:f.length,first:f[0],pts,map:cls.join('')};
 }
 if(id==='gremien'){
  /* Mini-Fluss: die größten Gremien nach Stufe (Eingang bis Entscheidung) und ihre stärksten Wege */
  const nodes=[...(d.nodes||[])].sort((a,b)=>(b.in+b.out)-(a.in+a.out)).slice(0,6);if(nodes.length<3)return null;
  const ix=new Map(nodes.map((x,i)=>[x.id,i]));
  const edges=(d.edges||[]).filter(e=>ix.has(e.a)&&ix.has(e.b)).sort((a,b)=>b.n-a.n).slice(0,6).map(e=>[ix.get(e.a),ix.get(e.b),e.n]);
  if(!edges.length)return null;
  return {nodes:nodes.map(x=>[x.name,round(x.stage),x.in+x.out]),edges};
 }
 if(id==='vergleich'){
  /* Themenprofil beider Orte ohne Sammelposten, Anteile neu auf die übrigen Themenfelder bezogen (wie in der Analyse) */
  const pl=d.places||[];if(pl.length!==2)return null;
  const share=(t,tid)=>{const tot=t.list.filter(x=>!SAMMEL.has(x.id)).reduce((s,x)=>s+x.n,0);return tot?(t.list.find(x=>x.id===tid)?.n??0)/tot*100:0;};
  const rows=LABELS.filter(l=>!SAMMEL.has(l.id)).map(l=>[l.name,round(share(pl[0].topics,l.id)),round(share(pl[1].topics,l.id))]).filter(r=>Math.max(r[1],r[2])>=1).sort((a,b)=>Math.max(b[1],b[2])-Math.max(a[1],a[2])).slice(0,8);
  return rows.length>=3?{names:CMP_PLACES.map(x=>x[1]),counts:pl.map(p=>p.total),rows}:null;
 }
 if(id==='graph'){
  /* Mini-Netz: Suchbegriff in der Mitte, dazu wichtige Begriffe, Themen, Gremien und Länder; Kanten nur zwischen diesen */
  const nodes=d.nodes||[],center=nodes.find(x=>x.type==='center');if(!center)return null;
  const seen=new Set(),pick=[];
  const take=(type,max)=>{let c=0;for(const x of nodes.filter(n=>n.type===type&&(type!=='term'||!STOP.has(n.label))).sort((a,b)=>b.count-a.count)){if(c>=max)break;const k=x.label.slice(0,7);if(type==='term'){if(seen.has(k))continue;seen.add(k);}pick.push(x);c++;}};
  take('term',6);take('topic',3);take('committee',2);take('land',2);
  if(pick.length<4)return null;
  const ids=[center.id,...pick.map(x=>x.id)],ix=new Map(ids.map((id,i)=>[id,i]));
  const edges=(d.edges||[]).filter(e=>ix.has(e.a)&&ix.has(e.b)).sort((a,b)=>b.w-a.w).slice(0,22).map(e=>[ix.get(e.a),ix.get(e.b),round(e.w)]);
  return {nodes:[center,...pick].map(x=>[x.type,x.label,x.count]),edges};
 }
 return null;
}
/* Plenara.X-Startseite (AnalyticsAbout): alle Analysen zu einem Beispielbegriff */
const FEATURED_TERM='Photovoltaik',FEATURED=['diffusion','graph','trends','gremien','beschluesse','vergleich'];
const out={generated:new Date().toISOString().slice(0,10),items:{}};
for(const b of [{slug:'_start',keywords:[FEATURED_TERM]},...BRANCHEN]){
 const e=b.slug==='_start'?{analysen:[]}:ENTERPRISE[b.slug];if(!e)continue;
 /* Die drei festen Vorschaukarten (PLENARAX_VORTEILE) zeigen immer den ersten Begriff der Branche, die Analysekarten je Branche Begriff 1 und 2 */
 const jobs=b.slug==='_start'?FEATURED.map((id)=>[id,id==='vergleich'?CMP_TERM:FEATURED_TERM]):[...PLENARAX_VORTEILE.map(([id])=>[id,b.keywords[0]]),...e.analysen.slice(0,2).map(([id],i)=>[id,b.keywords[i]??b.keywords[0]])];
 for(const [id,term] of jobs){
  const api=API[id];
  if(id==='vergleich'&&b.slug!=='_start')continue;
  if(!api){console.log('übersprungen (kein Ausschnitt):',b.slug,id);continue;}
  const key=`${id}|${term}`;if(key in out.items)continue;
  try{
   const qs=id==='vergleich'?new URLSearchParams({q:'',area:CMP_PLACES[0][0],more:CMP_PLACES[1][0]+':with',scope:'with',level:'city',to:new Date().toISOString().slice(0,10)}):new URLSearchParams({q:term,level:'city'});
   const r=await fetch(`${base}/api/analytics/${api}?${qs}`);
   if(!r.ok)throw new Error(r.status);
   out.items[key]=shrink(id,await r.json());
   console.log(key,out.items[key]?'ok':'leer');
  }catch(err){console.log(key,'Fehler',err.message);}
 }
}
const pts=[];for(let i=0;i<GEM_AGS.length;i++)pts.push(Math.round((GEM_P[2*i]-minX)/STEP),Math.round((GEM_P[2*i+1]-minY)/STEP));
writeFileSync(new URL('../public/data/gemeinde-punkte.json',import.meta.url),JSON.stringify({w:Math.round((maxX-minX)/STEP),h:Math.round((maxY-minY)/STEP),pts}));
/* Gesamtgraph über den ganzen Bestand (Seite „Knowledge Graph“ beim Öffnen), gleichmäßige Stichprobe; braucht all=1 im Backend */
try{
 const r=await fetch(`${base}/api/analytics/graph?${new URLSearchParams({q:'',all:'1',level:'city'})}`);
 if(!r.ok)throw new Error(r.status);
 const g=await r.json();
 writeFileSync(new URL('../public/data/graph-gesamt.json',import.meta.url),JSON.stringify({generated:out.generated,...g}));
 console.log('graph-gesamt ok:',g.nodes.length,'Knoten,',g.edges.length,'Kanten, Stichprobe',g.total);
}catch(err){console.log('graph-gesamt Fehler',err.message);}
writeFileSync(new URL('../public/data/branchen-ausschnitte.json',import.meta.url),JSON.stringify(out));
console.log('geschrieben:',Object.keys(out.items).length,'Einträge');
