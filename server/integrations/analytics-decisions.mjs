import {labelName} from '../../shared/labels.mjs';
import {readResult} from '../../shared/vote-result.mjs';
import {ALL_LANDS} from '../../shared/lands.mjs';
import {parseMonitorSearch} from './monitor-search.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {listPage,offsetOf} from './analytics-lists.mjs';
import {parseSteps} from './x-cases.mjs';
import {source,xState} from './plenara-x-query.mjs';

/*
 * Plenara.X – Status und Beschlüsse: Wie stehen die Vorgänge, wie fallen Beschlüsse aus, wie einig sind die Gremien?
 * Vollständig (alle passenden Vorgänge, x_cases): Stand der Vorgänge, Verlauf je Monat, Aufteilung nach Themenfeld, Gremienebene und Land.
 * Aus allen entschiedenen Vorgängen (Spalten vote, changed, days in x_cases): Abstimmungsverhalten (einstimmig oder
 * mehrheitlich), Änderungen am Beschlussvorschlag und Durchlaufzeit. Die Beschlussquote ist der Anteil „beschlossen“ an allen
 * Vorgängen mit Entscheidung (beschlossen, abgelehnt, vertagt). Die meisten Einträge haben keinen bekannten Status; das wird mit ausgewiesen.
 * Gezählt werden Vorgänge wie überall in plenara.X: Auswahl über die Suche (source), Vorgänge aus x_cases (ohne Formalien), vollständig,
 * ohne Stichprobe. Stand, Quote, Themen, Länder: Endstand des Vorgangs; Gremienebene: jede Station (x_cases.steps, Ausschuss empfiehlt,
 * Rat beschließt), je Vorgang, Ebene und Status einmal; Abstimmung, Änderung und Dauer: Spalten vote, changed, days (Bau, Migration 0041). Ausschüsse empfehlen meist nur,
 * deshalb keine Beschlussquote für sie. Je Themenfeld und Land steht dabei, ob die Quote vom Gesamtwert deutlich abweicht
 * (Wilson-Spanne 95 % schließt ihn aus); sonst gilt sie als üblich.
 */
const MIN_TOPIC=20,MIN_LAND=60,MIN_VOTE=8;
const DECIDED=['approved','rejected','postponed'];
const STATUSES=['announced','consulting','recommended','approved','rejected','postponed','info','unknown'];
/** Gremienebene aus dem Namen (Stationen aus x_cases.steps) */
export function kindOf(gremium){
 const g=String(gremium||'').toLowerCase();
 if(g.startsWith('ortsgemeinderat'))return 'ortsgemeinde';
 if(/ortsbeirat|ortsrat|bezirksvertretung|bezirksbeirat|stadtbezirk|ortschaftsrat/.test(g))return 'ortsebene';
 if(/ausschuss|kommission|beirat/.test(g))return 'ausschuss';
 if(/rat|kreistag|stadtverordneten|gemeindevertretung/.test(g))return 'rat';
 return 'sonstige';
}
/* Gremienebene je Name einmal (dieselben Gremien kommen in hunderttausenden Stationen vor) */
const kinds1=new Map();
const kindOfCached=g=>{let k=kinds1.get(g);if(k===undefined){k=kindOf(g);if(kinds1.size<50000)kinds1.set(g,k);}return k;};
export const KINDS=[['rat','Rat und Kreistag'],['ortsgemeinde','Ortsgemeinderäte (in Verbandsgemeinden)'],['ausschuss','Ausschüsse und Beiräte'],['ortsebene','Orts- und Bezirksebene'],['sonstige','Sonstige']];

export function parseDecisions(params){
 const copy=new URLSearchParams(params);
 if(!copy.has('to'))copy.set('to',new Date().toISOString().slice(0,10));
 let f;
 try{f=parseMonitorSearch(copy);}catch(e){throw new AnalyticsError(e.message,e.status||400);}
 if(f.groups.flat().some(w=>w.length<3))throw new AnalyticsError('Jedes Suchwort braucht mindestens 3 Buchstaben.');
 return f;
}

const rate=(c)=>{const d=c.approved+c.rejected+c.postponed;return d?Math.round((c.approved/d)*1000)/10:null;};
const blank=()=>({approved:0,rejected:0,postponed:0,announced:0,consulting:0,recommended:0,info:0,unknown:0});
const quant=(sorted,p)=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(p*sorted.length))]:null;
// Ausgang einer Station aus dem Ergebnistext: eine Regel mit Newsradar und Social Media (shared/vote-result.mjs)
export {readResult};

/* Zwischenspeicher je Bau: in der Route (xCached), wie alle plenara.X-Routen */
export async function decisions(db,catalog,params){
 return computeDecisions(db,catalog,parseDecisions(params));
}
async function computeDecisions(db,catalog,f){
 if(!(await xState(db)))throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut. Bitte später erneut versuchen.',503);
 const src=await source(db,catalog,f,{steps:true});
 const {results:rows}=await db.prepare(`SELECT x.region_id g,x.month m,x.label l,x.status st,x.steps s,x.vote v,x.changed c,x.days d FROM ${src.from}`).bind(...src.args).all();
 const status=blank(),months=new Map(),topics=new Map(),kinds=new Map(),lands=new Map();
 const byId=new Map(catalog.map(r=>[r.id,r]));
 const bump=(m,key,st)=>{if(!m.has(key))m.set(key,blank());m.get(key)[st]=(m.get(key)[st]||0)+1;};
 const tally=()=>({n:0,vote:0,unanimous:0,change:0,changed:0});
 const all=tally(),byTopic=new Map(),byKind=new Map(),spans=[],spanTopic=new Map();
 const add=(m,key,fn)=>{if(!m.has(key))m.set(key,tally());fn(m.get(key));};
 let decidedN=0;
 for(const r of rows){
  const st=STATUSES.includes(r.st)?r.st:'unknown';
  status[st]++;bump(topics,r.l,st);
  if(DECIDED.includes(st)){bump(months,r.m,st);const reg=byId.get(r.g);if(reg)bump(lands,reg.ags.slice(0,2),st);}
  // Gremienebene: jede Station, je Vorgang, Ebene und Status einmal
  const steps=parseSteps(r.s),seen=new Set();
  for(const e of steps){if(!STATUSES.includes(e.st))continue;const kind=kindOfCached(e.g),k=kind+'|'+e.st;if(seen.has(k))continue;seen.add(k);bump(kinds,kind,e.st);}
  if(!DECIDED.includes(st))continue;
  decidedN++;
  const dec=steps.findLast(e=>DECIDED.includes(e.st)),kind=kindOfCached(dec?.g);
  const apply=t=>{t.n++;if(r.v){t.vote++;if(r.v==='unanimous')t.unanimous++;}if(r.c){t.change++;if(r.c==='changed')t.changed++;}};
  apply(all);add(byTopic,r.l,apply);add(byKind,kind,apply);
  if(r.d!==null&&r.d!==undefined){spans.push(r.d);if(!spanTopic.has(r.l))spanTopic.set(r.l,[]);spanTopic.get(r.l).push(r.d);}
 }
 const total=rows.length,known=total-status.unknown;
 const decided=DECIDED.reduce((a,k)=>a+status[k],0);
 const overall=rate(status);
 /* Weicht die Quote deutlich vom Gesamtwert ab? (Wilson-Spanne 95 %) */
 const differs=c=>{const d=c.approved+c.rejected+c.postponed;if(!d||overall===null)return false;const p=c.approved/d,z=1.96,den=1+z*z/d,mid=(p+z*z/(2*d))/den,h=z*Math.sqrt(p*(1-p)/d+z*z/(4*d*d))/den;return overall/100<mid-h||overall/100>mid+h;};
 const row=(id,name,c)=>({id,name,decided:c.approved+c.rejected+c.postponed,approved:c.approved,rejected:c.rejected,postponed:c.postponed,recommended:c.recommended,
  rate:id==='ausschuss'?null:rate(c),differs:id==='ausschuss'?false:differs(c),open:c.announced+c.consulting+c.recommended});
 const cards={size:decidedN},k=1,decidedCount=decidedN;
 spans.sort((a,b)=>a-b);
 const share=(a,b)=>b?Math.round((a/b)*1000)/10:null;
 const vrow=(id,name,t)=>({id,name,n:t.n,vote:t.vote,unanimous:share(t.unanimous,t.vote),changeN:t.change,changed:share(t.changed,t.change)});
 return {
  q:f.q,
  totals:{all:total,known,decided,knownShare:share(known,total)},
  status:STATUSES.map(id=>({id,n:status[id]||0})),
  rates:{approval:rate(status),rejection:decided?Math.round((status.rejected/decided)*1000)/10:null,postponement:decided?Math.round((status.postponed/decided)*1000)/10:null,open:status.announced+status.consulting+status.recommended},
  months:[...months].sort((a,b)=>a[0].localeCompare(b[0])).map(([m,c])=>({m,...c,rate:rate(c)})),
  topics:[...topics].filter(([id])=>id!=='unklar').map(([id,c])=>row(id,labelName(id),c)).filter(r=>r.decided>=MIN_TOPIC).sort((a,b)=>b.decided-a.decided||a.id.localeCompare(b.id)),
  unclassified:{decided:topics.has('unklar')?topics.get('unklar').approved+topics.get('unklar').rejected+topics.get('unklar').postponed:0},
  kinds:KINDS.map(([id,name])=>row(id,name,kinds.get(id)||blank())).filter(r=>r.decided>0),
  lands:[...lands].map(([id,c])=>row(id,ALL_LANDS.find(l=>l.id===id)?.name||id,c)).filter(r=>r.decided>=MIN_LAND).sort((a,b)=>b.decided-a.decided||a.id.localeCompare(b.id)),
  votes:{
   sampled:cards.size,of:decidedCount,capped:k>1,
   all:vrow('all','Alle',all),
   topics:[...byTopic].filter(([id,t])=>id!=='unklar'&&t.vote>=MIN_VOTE).map(([id,t])=>vrow(id,labelName(id),t)).sort((a,b)=>a.unanimous-b.unanimous||a.id.localeCompare(b.id)),
   kinds:KINDS.map(([id,name])=>vrow(id,name,byKind.get(id)||tally())).filter(r=>r.n>0),
  },
  duration:{n:spans.length,median:quant(spans,.5),p25:quant(spans,.25),p75:quant(spans,.75),p90:quant(spans,.9),
   topics:[...spanTopic].filter(([id,s])=>id!=='unklar'&&s.length>=12).map(([id,s])=>{s.sort((a,b)=>a-b);return {id,name:labelName(id),n:s.length,median:quant(s,.5),p90:quant(s,.9)};}).sort((a,b)=>b.median-a.median)},
 };
}

/** Liste hinter einer Zahl: by=label|kind|land (value: Kennung), optional outcome=approved|rejected|postponed (sonst alle mit Entscheidung) */
export async function decisionList(db,catalog,params){
 const by=params.get('by'),value=params.get('value')||'',outcome=params.get('outcome')||'';
 if(!['label','kind','land'].includes(by)||!value||outcome&&!DECIDED.includes(outcome))throw new AnalyticsError('Unbekannte Liste.',400);
 const copy=new URLSearchParams(params);for(const k of ['by','value','offset','outcome'])copy.delete(k);
 const f=parseDecisions(copy);
 if(!(await xState(db)))throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut. Bitte später erneut versuchen.',503);
 const src=await source(db,catalog,f,{steps:true}),sts=outcome?[outcome]:DECIDED;
 const ids=by==='land'?new Set(catalog.filter(r=>r.ags?.startsWith(value)).map(r=>r.id)):null;
 // Wie die Zahl: Themen und Länder nach dem Endstand, Gremienebene nach den Stationen des Vorgangs
 const {results}=await db.prepare(`SELECT c.id,x.region_id region,c.title,c.gremium,x.date,x.status,x.label,x.steps FROM ${src.from} JOIN search_cards c ON c.id=x.card_id ORDER BY x.date DESC`).bind(...src.args).all();
 const rows=results.filter(r=>by==='kind'?parseSteps(r.steps).some(e=>kindOf(e.g)===value&&sts.includes(e.st)):sts.includes(r.status)&&(by==='label'?r.label===value:ids.has(r.region)));
 return listPage(rows,catalog,offsetOf(params));
}
