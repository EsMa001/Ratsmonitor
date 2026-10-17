import {parseMonitorSearch} from './monitor-search.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {listPage,offsetOf} from './analytics-lists.mjs';
import {source,xState,PLACEHOLDER} from './plenara-x-query.mjs';
import {parseSteps} from './x-cases.mjs';

/*
 * Plenara.X – Beratungswege: Welchen Weg nehmen Vorgänge durch die Gremien? Knoten sind Gremien, gerichtete Kanten zählen die Vorgänge, die von
 * einem Gremium zum nächsten gelaufen sind (aufeinanderfolgende Stationen eines Vorgangs, nach Datum geordnet). Ohne einzelnen Ort werden
 * die Gremien nach ihrer Art zusammengefasst (Rat, Hauptausschuss, Bauausschuss ...), weil jeder Ort seine eigenen Namen hat; mit genau einem
 * Ort gelten die echten Namen. Grundlage ist wie überall in plenara.X die Auswahl über die Suche (source) und je Vorgang (x_cases, ohne
 * Formalien) die Stationen seiner jüngsten Karte; alle Vorgänge mit Beratung oder Entscheidung, Stationen aus x_cases.steps; nur Vorgänge mit mindestens
 * zwei Stationen in verschiedenen Gremien tragen zum Netz bei.
 */
const MAX_NODES=18,MAX_EDGES=60,ROUTES=10,MIN_EDGE=2;
const STATUSES="('consulting','recommended','approved','rejected','postponed')";

/** Gremienart aus dem Namen; null = nicht erkennbar (dann „Sonstige“) */
export function gremiumType(name){
 const t=String(name||'').toLowerCase();
 if(/ortsbeirat|ortsrat|bezirksvertretung|bezirksbeirat|ortschaftsrat|stadtbezirk|ortsteilbeirat/.test(t))return 'Orts- und Bezirksgremium';
 if(/haupt(?:- und \w+)?ausschuss|verwaltungsausschuss|hauptausschuß|ältestenrat|ältestenausschuss/.test(t))return 'Haupt- und Verwaltungsausschuss';
 if(/finanz|haushalt|rechnungsprüf|wirtschaftsausschuss und finanz/.test(t))return 'Finanz- und Rechnungsprüfungsausschuss';
 if(/betriebsausschuss|werkausschuss|eigenbetrieb/.test(t))return 'Betriebs- und Werkausschuss';
 if(/bau|planung|stadtentwicklung|stadtplanung|bauleit/.test(t)&&/ausschuss|kommission/.test(t))return 'Bau-, Planungs- und Stadtentwicklungsausschuss';
 if(/umwelt|klima|energie|natur|landwirtschaft|forst/.test(t)&&/ausschuss|kommission/.test(t))return 'Umwelt-, Klima- und Energieausschuss';
 if(/verkehr|mobilität|straßen|tiefbau/.test(t)&&/ausschuss|kommission/.test(t))return 'Verkehrs- und Mobilitätsausschuss';
 if(/schul|bildung|jugend|kita|kinder|sport|kultur|familie|bürgerschaftlich/.test(t)&&/ausschuss|kommission/.test(t))return 'Bildungs-, Jugend-, Kultur- und Sportausschuss';
 if(/sozial|gesundheit|senior|integration|inklusion|pflege/.test(t)&&/ausschuss|kommission|beirat/.test(t))return 'Sozial- und Gesundheitsausschuss';
 if(/wirtschaft|tourismus|digital|arbeit|marketing/.test(t)&&/ausschuss|kommission/.test(t))return 'Wirtschafts- und Digitalausschuss';
 if(/^ortsgemeinderat|^gemeinderat der ortsgemeinde/.test(t))return 'Ortsgemeinderat';
 if(/verbandsgemeinderat|samtgemeinderat|amtsausschuss/.test(t))return 'Verbandsgemeinde-, Samtgemeinderat, Amtsausschuss';
 if(/beirat/.test(t))return 'Beiräte';
 if(/ausschuss|kommission/.test(t))return 'Sonstige Ausschüsse';
 if(/gemeinderat|stadtrat|kreistag|stadtverordneten|gemeindevertretung|^rat\b|\brat der\b|bezirkstag|stadtbürgerschaft|bürgerschaft|gemeindeversammlung/.test(t))return 'Rat und Kreistag';
 return 'Sonstige Gremien';
}

export function parseNetwork(params){
 const copy=new URLSearchParams(params);for(const k of ['by','value','offset'])copy.delete(k);
 if(!copy.has('to'))copy.set('to',new Date().toISOString().slice(0,10));
 // Mit Ort gelten die Wege seines eigenen Rats (ohne Kreisgremien), wie in der Oberfläche
 if(copy.get('area'))copy.set('scope','only');
 let f;
 try{f=parseMonitorSearch(copy);}catch(e){throw new AnalyticsError(e.message,e.status||400);}
 if(f.groups.flat().some(w=>w.length<3))throw new AnalyticsError('Jedes Suchwort braucht mindestens 3 Buchstaben.');
 return f;
}
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};

/* Stationsfolgen je Vorgang: nach Datum (bei Gleichstand wie in der Quelle), gleiche Gremien hintereinander einmal */
async function sequences(db,catalog,f){
 if(!(await xState(db)))throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut. Bitte später erneut versuchen.',503);
 const src=await source(db,catalog,f,{steps:true}),where='x.status IN '+STATUSES;
 // Alle Vorgänge der Auswahl mit ihren Stationen (x_cases.steps, beim Bau ausgepackt), keine Stichprobe
 const {results:all}=await db.prepare(`SELECT x.card_id id,x.steps FROM ${src.from} WHERE ${where}`).bind(...src.args).all();
 const pool=all.length,k=1;
 const results=all.flatMap(r=>parseSteps(r.steps).map((e,i)=>({id:r.id,g:e.g,d:e.d,k:i})));
 /* Genau ein Ort: echte Namen; sonst nach Art zusammenfassen */
 const single=!!f.area&&f.more.length===0&&!f.within&&!f.without;
 const label=g=>single?String(g).replace(/\s+/g,' ').trim():gremiumType(g);
 const byCard=new Map();
 for(const r of results){if(!r.g||(single&&PLACEHOLDER.test(String(r.g).trim())))continue;if(!byCard.has(r.id))byCard.set(r.id,[]);byCard.get(r.id).push({g:label(r.g),d:r.d,k:r.k});}
 const seqs=new Map();
 for(const [id,ev] of byCard){
  ev.sort((a,b)=>(a.d||'').localeCompare(b.d||'')||a.k-b.k);
  const seq=[];for(const e of ev)if(!seq.length||seq.at(-1).g!==e.g)seq.push(e);
  if(seq.length>=2)seqs.set(id,seq);
 }
 return {seqs,pool,k,single};
}

/** Liste hinter einer Kante: by=edge&value=„Von|Nach“ (Vorgänge, die direkt von einem Gremium zum nächsten liefen) */
export async function networkList(db,catalog,params){
 const [from,to]=(params.get('value')||'').split('|');
 if(params.get('by')!=='edge'||!from||!to)throw new AnalyticsError('Unbekannte Liste.',400);
 const {seqs}=await sequences(db,catalog,parseNetwork(params));
 const ids=[...seqs].filter(([,q])=>q.some((e,i)=>i&&q[i-1].g===from&&e.g===to)).map(([id])=>id);
 const rows=[];
 for(let i=0;i<ids.length;i+=200){const part=ids.slice(i,i+200);const {results}=await db.prepare(`SELECT id,region_id region,title,gremium,date,status FROM search_cards WHERE id IN (${part.map(()=>'?').join(',')})`).bind(...part).all();rows.push(...results);}
 return listPage(rows,catalog,offsetOf(params));
}

export async function network(db,catalog,params){
 const f=parseNetwork(params);
 const {seqs,pool,k,single}=await sequences(db,catalog,f);
 const nodes=new Map(),edges=new Map(),routes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,in:0,out:0,starts:0,ends:0,stage:0,stageN:0});return nodes.get(id);};
 let paths=0;
 for(const seq of seqs.values()){
  paths++;
  node(seq[0].g).starts++;node(seq.at(-1).g).ends++;
  seq.forEach((e,i)=>{const nd=node(e.g);nd.stage+=i/(seq.length-1);nd.stageN++;});
  for(let i=0;i<seq.length-1;i++){
   const a=seq[i],b=seq[i+1],key=a.g+'\u0001'+b.g;
   node(a.g).out++;node(b.g).in++;
   if(!edges.has(key))edges.set(key,{a:a.g,b:b.g,n:0,days:[]});
   const e=edges.get(key);e.n++;
   if(a.d&&b.d){const days=Math.round((Date.parse(b.d)-Date.parse(a.d))/86400000);if(days>=0&&days<=730)e.days.push(days);}
  }
  const route=seq.slice(0,4).map(e=>e.g).join('\u0001');routes.set(route,(routes.get(route)||0)+1);
 }
 /* Wichtigste Knoten (nach Durchsatz) und Kanten zwischen ihnen */
 const ranked=[...nodes.values()].sort((a,b)=>(b.in+b.out)-(a.in+a.out)||a.id.localeCompare(b.id)).slice(0,MAX_NODES);
 const keep=new Set(ranked.map(n=>n.id));
 const outNodes=ranked.map(n=>{
  const flow=n.in+n.out,share=flow?n.out/flow:0.5;
  return {id:n.id,name:n.id,in:n.in,out:n.out,starts:n.starts,ends:n.ends,stage:n.stageN?Math.round((n.stage/n.stageN)*100)/100:0.5,
   /* Einstieg: überwiegend ausgehend; Entscheidung: überwiegend eingehend; sonst Durchgang */
   role:share>=0.65?'start':share<=0.35?'end':'bridge',broker:Math.min(n.in,n.out)};
 });
 const outEdges=[...edges.values()].filter(e=>keep.has(e.a)&&keep.has(e.b)&&e.n>=MIN_EDGE).sort((a,b)=>b.n-a.n||a.a.localeCompare(b.a)||a.b.localeCompare(b.b)).slice(0,MAX_EDGES).map(e=>({a:e.a,b:e.b,n:e.n,days:median(e.days)}));
 const outRoutes=[...routes].filter(([,n])=>n>=MIN_EDGE).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,ROUTES).map(([r,n])=>({path:r.split('\u0001'),n}));
 return {q:f.q,mode:single?'names':'types',pool,examined:pool,capped:false,paths,nodes:outNodes,edges:outEdges,routes:outRoutes};
}
