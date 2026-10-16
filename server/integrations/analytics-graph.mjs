import {LABELS} from '../../shared/labels.mjs';
import {ALL_LANDS} from '../../shared/lands.mjs';
import {parseMonitorSearch} from './monitor-search.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {source,xState,PLACEHOLDER} from './plenara-x-query.mjs';
import {parseSteps} from './x-cases.mjs';
import {tokens,norm} from './x-terms.mjs';
export {tokens};
import {listPage,offsetOf} from './analytics-lists.mjs';

/*
 * Plenara.X – Themennetz: Welche Begriffe, Themen, Gremien und Länder hängen mit einem Suchbegriff zusammen?
 * Grundlage sind allein die Karten der Datenbank, die zur Suche passen (dieselben Filter wie die Suche, die jüngsten zuerst).
 * Kanten entstehen, wenn zwei Dinge in derselben Karte vorkommen (Ko-Okkurrenz); ihr Gewicht ist der Jaccard-Index.
 * Begriffe werden nach Häufigkeit in der Auswahl gegenüber der Häufigkeit im ganzen Bestand gewichtet (wie tf-idf), damit
 * nicht Füllwörter („Antrag“, „Sitzung“) das Bild bestimmen.
 */
/* Detailstufe „Detail“: so viele Begriffe und Themen; die Seite blendet für „Überblick“ und „Normal“ die vorderen aus
   (Reihenfolge der Knoten = Rang), Kanten je Knoten begrenzt sie ebenfalls selbst */
const TERMS=45,PER_KIND=8,MIN_DF=3;
/* Wörter des Sitzungsbetriebs, die über den ganzen Bestand ständig vorkommen und kein Thema sind (auch mit Begriff) */
export const FORMAL_ALL=new Set('beschlussfähigkeit ordnungsgemäßen ordnungsgemäße ladung vorstellung öffentlicher öffentliche sachstand bürgermeisters bürgermeister begrüßung bestätigung wahl bestellung protokolls anwesenheit geschäftsordnung einladung fraktion fraktionen anregungen beschwerden verwaltung eröffnung feststellung genehmigung mitglieder mitglied beantwortung unterrichtung verpflichtung verabschiedung beschlussfassung ergänzung bekanntgabe entgegennahme sitzungsniederschrift gremium gremien ausschuss ausschusses rates gemeinderates stadtrates ortsgemeinderates verbandsgemeinde stadt gemeinde kreis ortsbeirat ortsbeirates niederschrift vorlage vorlagen beschluss beschlüsse bericht berichte aktuelle aktueller informationen information verschiedenes tagesordnungspunkte wortmeldungen einwohnerfragestunde einwohnerfrage teils letzten gefassten angelegenheiten sonstiges annahme nichtöffentlicher nichtöffentlichen sachstandsbericht ordnungsmäßigkeit änderungsanträge einwohner'.split(' ').map(w=>w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('ß','ss')));
/* Gremien eines Vorgangs aus seinen Stationen (x_cases.steps), ohne Platzhalter, je Gremium einmal */
const gremienOf=steps=>[...new Set(parseSteps(steps).map(e=>e.g).filter(g=>g&&!PLACEHOLDER.test(g)).map(gremiumKey))];
const gremiumKey=g=>String(g||'').replace(/\s+/g,' ').trim();
const jaccard=(c,a,b)=>c/(a+b-c);

/** Gleiche Filter wie die Suche; ohne Begriff der Gesamtgraph über alle Vorgänge der Auswahl */
export function parseGraph(params){
 let f;const copy=new URLSearchParams(params);for(const k of ['by','value','offset'])copy.delete(k);params=copy;
 try{f=parseMonitorSearch(params);}catch(e){throw new AnalyticsError(e.message,e.status||400);}
 if(f.groups.flat().some(w=>w.length<3))throw new AnalyticsError('Jedes Suchwort braucht mindestens 3 Buchstaben.');
 return f;
}

export async function knowledgeGraph(db,catalog,params){
 const f=parseGraph(params);
 /* Wie überall in plenara.X: Auswahl über die Suche, gezählt werden Vorgänge (x_cases: ohne Formalien, gleiche Titel je Gebiet
    einmal); Titel und Gremium aus der Karte des Vorgangs */
 if(!(await xState(db)))throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut. Bitte später erneut versuchen.',503);
 const src=await source(db,catalog,f,{steps:true,terms:true,noPrivate:true});
 /* Alle Vorgänge der Auswahl, keine Stichprobe */
 const {results:rows}=await db.prepare(`SELECT x.region_id,x.label,x.steps,x.terms FROM ${src.from}`).bind(...src.args).all();
 const capped=false,limit=rows.length;
 const total=rows.length;
 const byId=new Map(catalog.map(r=>[r.id,r]));
 const exclude=new Set(f.groups.flat()),parts=[...exclude].map(norm);
 /* Ein Durchgang über die Vorgänge: Wortteil-Hinweise, Begriffe je Vorgang (als schlanke Liste, keine Map je Vorgang: bei
    600.000 Vorgängen sonst Sekunden für Aufbau und Speicherbereinigung), Häufigkeit der Begriffe. Gleiche Reihenfolge wie vorher.
    Wörter, in denen der Begriff nur als Teil steckt: Hinweis auf „genaues Wort“. Wortteil-Treffer („vereinbarung“ bei „Verein“,
    „saarbrücken“ bei „Brücke“) sind kein eigener Begriff. */
 const partial=new Map(),df=new Map(),shown=new Map(),docs=new Array(rows.length);
 for(let i=0;i<rows.length;i++){
  const r=rows[i],region=byId.get(r.region_id),keys=[];
  if(r.terms)for(const line of String(r.terms).split('\n')){
   const tab=line.indexOf('\t'),k=tab<0?line:line.slice(0,tab),w=tab<0?undefined:line.slice(tab+1);
   if(exclude.has(k))continue;
   const inPart=parts.length?parts.some(p=>k.includes(p)):false;
   if(!f.exact&&inPart&&parts.some(p=>k.includes(p)&&!k.startsWith(p+'s')&&k!==p))partial.set(w,(partial.get(w)||0)+1);
   if(FORMAL_ALL.has(k)||inPart)continue;
   keys.push(k);df.set(k,(df.get(k)||0)+1);if(!shown.has(k))shown.set(k,w);
  }
  docs[i]={keys,label:r.label,gremien:gremienOf(r.steps),land:region?region.ags.slice(0,2):null};
 }
 /* Häufigkeit der Begriffe in der Auswahl; Gewichtung gegen den ganzen Bestand (search_words) */
 const cand=[...df].filter(([,n])=>n>=Math.min(MIN_DF,Math.max(2,Math.floor(total*0.02)))).sort((a,b)=>b[1]-a[1]).slice(0,120);
 let global=new Map(),all=0;
 if(cand.length){
  try{
   const {results:g}=await db.prepare('SELECT word,cards FROM search_words WHERE word IN (SELECT value FROM json_each(?))').bind(JSON.stringify(cand.map(([k])=>k))).all();
   global=new Map(g.map(x=>[x.word,x.cards]));
   all=(await db.prepare('SELECT max(rowid) n FROM search_cards').first())?.n||0;
  }catch{global=new Map();}
 }
 const idf=k=>global.size&&all?Math.log(1+all/Math.max(1,global.get(k)||df.get(k))):1;
 const chosen=cand.map(([k,n])=>({k,n,score:n*idf(k)})).sort((a,b)=>b.score-a.score).slice(0,TERMS);
 const termSet=new Set(chosen.map(c=>c.k));
 /* Themen, Gremien, Länder: je Art die häufigsten */
 const countAll=pick=>{const m=new Map();for(const d of docs)for(const v of pick(d))m.set(v,(m.get(v)||0)+1);return [...m].sort((a,b)=>b[1]-a[1]).slice(0,PER_KIND);};
 const count=pick=>{const m=new Map();for(const d of docs){const v=pick(d);if(v)m.set(v,(m.get(v)||0)+1);}return [...m].sort((a,b)=>b[1]-a[1]).slice(0,PER_KIND);};
 const labelName=id=>LABELS.find(l=>l.id===id)?.name||null;
 const topics=count(d=>labelName(d.label)&&d.label!=='unklar'?d.label:null),committees=countAll(d=>d.gremien.filter(g=>g.length>=4)),lands=count(d=>d.land);
 const nodes=[{id:'q',type:'center',label:f.q||'Gesamter Datenbestand',count:total}];
 for(const c of chosen)nodes.push({id:'t:'+c.k,type:'term',label:shown.get(c.k),count:c.n});
 for(const [id,n] of topics)nodes.push({id:'k:'+id,type:'topic',label:labelName(id),count:n});
 for(const [g,n] of committees)nodes.push({id:'g:'+g,type:'committee',label:g.length>46?g.slice(0,44)+'…':g,count:n});
 for(const [id,n] of lands)nodes.push({id:'l:'+id,type:'land',label:ALL_LANDS.find(l=>l.id===id)?.name||id,count:n});
 const size=new Map(nodes.map(n=>[n.id,n.count]));
 /* Ko-Okkurrenz zählen */
 const co=new Map();
 const bump=(a,b)=>{if(a===b)return;const key=a<b?a+'|'+b:b+'|'+a;co.set(key,(co.get(key)||0)+1);};
 for(const d of docs){
  const ids=[];for(const k of d.keys)if(termSet.has(k))ids.push('t:'+k);
  if(size.has('k:'+d.label))ids.push('k:'+d.label);
  for(const g of d.gremien)if(size.has('g:'+g))ids.push('g:'+g);
  if(size.has('l:'+d.land))ids.push('l:'+d.land);
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)bump(ids[i],ids[j]);
 }
 const edges=[];
 for(const [key,n] of co){
  const [a,b]=key.split('|');
  const w=jaccard(n,size.get(a),size.get(b));
  /* Themen, Gremien und Länder verbinden sich nur mit Begriffen; sonst ist jeder mit jedem verbunden */
  const kinds=a[0]+b[0];
  if(kinds!=='tt'&&!kinds.includes('t'))continue;
  if(n>=2&&w>=0.04)edges.push({a,b,w:Math.round(w*1000)/1000,n});
 }
 /* Alle tragfähigen Kanten; wie viele je Knoten gezeigt werden, entscheidet die Detailstufe der Seite */
 const links=edges.sort((x,y)=>y.w-x.w);
 /* Jeder Knoten hängt am Zentrum (Stärke: Anteil der Auswahl) */
 for(const n of nodes.slice(1))links.push({a:'q',b:n.id,w:Math.round((n.count/Math.max(1,total))*1000)/1000,n:n.count,center:true});
 return {q:f.q,total,capped,sample:limit,partial:[...partial].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w,n])=>({word:w,n})),nodes,edges:links,stats:{terms:chosen.length,topics:topics.length,committees:committees.length,lands:lands.length,links:links.length-nodes.length+1}};
}

/** Liste hinter einem Knoten: by=node&value=„t:Begriff“, „k:Thema“, „g:Gremium“ oder „l:Land“; alle Vorgänge der Auswahl */
export async function graphList(db,catalog,params){
 const value=params.get('value')||'',kind=value[1]===':'?value[0]:'',id=value.slice(2);
 if(params.get('by')!=='node'||!'tkgl'.includes(kind)||!kind||!id)throw new AnalyticsError('Unbekannte Liste.',400);
 const f=parseGraph(params);
 const src=await source(db,catalog,f,{steps:true,noPrivate:true});
 const {results}=await db.prepare(`SELECT c.id,x.region_id region,x.label,c.gremium,c.title,x.date,x.status,x.steps FROM ${src.from} JOIN search_cards c ON c.id=x.card_id ORDER BY x.date DESC`).bind(...src.args).all();
 const land=new Map(catalog.map(r=>[r.id,r.ags?.slice(0,2)]));
 const hit={t:r=>tokens(r.title).has(id),k:r=>r.label===id,g:r=>gremienOf(r.steps).includes(id),l:r=>land.get(r.region)===id}[kind];
 return listPage(results.filter(hit),catalog,offsetOf(params));
}
