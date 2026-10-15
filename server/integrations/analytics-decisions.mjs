import {LABELS} from '../../shared/labels.mjs';
import {ALL_LANDS} from '../../shared/lands.mjs';
import {parseMonitorSearch} from './monitor-search.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {offsetOf,LIST_SIZE} from './analytics-lists.mjs';
import {where as placeOf} from './member-place.mjs';
import {source,xState} from './plenara-x-query.mjs';
import {atRevisionStale,paramsKey} from './revision-cache.mjs';

/*
 * Plenara.X – Status und Beschlüsse: Wie stehen die Vorgänge, wie fallen Beschlüsse aus, wie einig sind die Gremien?
 * Exakt (alle passenden Einträge, search_cards): Stand der Vorgänge, Verlauf je Monat, Aufteilung nach Themenfeld, Gremienebene und Land.
 * Aus einer gleichmäßigen Stichprobe beschlossener Vorgänge (Stationen in topics.payload): Abstimmungsverhalten (einstimmig oder
 * mehrheitlich), Änderungen am Beschlussvorschlag und Durchlaufzeit. Die Beschlussquote ist der Anteil „beschlossen“ an allen
 * Vorgängen mit Entscheidung (beschlossen, abgelehnt, vertagt). Die meisten Einträge haben keinen bekannten Status; das wird mit ausgewiesen.
 * Gezählt werden Vorgänge wie überall in plenara.X: Auswahl über die Suche (source), Vorgänge aus x_cases (ohne Formalien);
 * ausgewertet werden alle Karten eines Vorgangs (Ausschuss und Rat), je Vorgang und Status einmal (cardsOf). Ausschüsse empfehlen meist nur,
 * deshalb keine Beschlussquote für sie. Je Themenfeld und Land steht dabei, ob die Quote vom Gesamtwert deutlich abweicht
 * (Wilson-Spanne 95 % schließt ihn aus); sonst gilt sie als üblich.
 */
const SAMPLE=4000,MIN_TOPIC=20,MIN_LAND=60,MIN_VOTE=8;
const DECIDED=['approved','rejected','postponed'];
const STATUSES=['announced','consulting','recommended','approved','rejected','postponed','info','unknown'];
/** Gremienebene aus dem Namen (SQL und JS gleich) */
const KIND_SQL="CASE WHEN lower(gremium) LIKE 'ortsgemeinderat%' THEN 'ortsgemeinde' WHEN lower(gremium) LIKE '%ortsbeirat%' OR lower(gremium) LIKE '%ortsrat%' OR lower(gremium) LIKE '%bezirksvertretung%' OR lower(gremium) LIKE '%bezirksbeirat%' OR lower(gremium) LIKE '%stadtbezirk%' OR lower(gremium) LIKE '%ortschaftsrat%' THEN 'ortsebene' WHEN lower(gremium) LIKE '%ausschuss%' OR lower(gremium) LIKE '%kommission%' OR lower(gremium) LIKE '%beirat%' THEN 'ausschuss' WHEN lower(gremium) LIKE '%rat%' OR lower(gremium) LIKE '%kreistag%' OR lower(gremium) LIKE '%stadtverordneten%' OR lower(gremium) LIKE '%gemeindevertretung%' THEN 'rat' ELSE 'sonstige' END";
export const KINDS=[['rat','Rat und Kreistag'],['ortsgemeinde','Ortsgemeinderäte (in Verbandsgemeinden)'],['ausschuss','Ausschüsse und Beiräte'],['ortsebene','Orts- und Bezirksebene'],['sonstige','Sonstige']];
const labelName=id=>LABELS.find(l=>l.id===id)?.name||id;

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
/** Ausgang einer Station aus dem Ergebnistext */
export function readResult(text){
 const t=String(text||'').toLowerCase();
 const vote=/einstimmig/.test(t)?'unanimous':/mehrheit|gegen\s+\d|\d+\s*gegen|stimmen|enthalt/.test(t)?'majority':null;
 const change=/ungeändert|unverändert|ohne änderung/.test(t)?'unchanged':/geändert|änderung|ergänz|mit maßgabe/.test(t)?'changed':null;
 return {vote,change};
}

/* Je Datenstand, Tag und Filter einmal gerechnet (lokal 10 bis 15 s je Aufruf); gehalten wird der zuletzt gefragte Filter */
export async function decisions(db,catalog,params){
 const f=parseDecisions(params);
 return atRevisionStale(db,paramsKey('decisions',params),()=>computeDecisions(db,catalog,f));
}
/* Karten der ausgewählten Vorgänge (alle Sitzungen bis zur letzten; ungelesene Vorgänge nur mit ihrer Karte) als CTE „cards“ */
async function cardsOf(db,catalog,f){
 if(!(await xState(db)))throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut. Bitte später erneut versuchen.',503);
 const src=await source(db,catalog,f),cols='x.case_key ck,c.id,c.date,c.label,c.status,c.gremium,c.region_id,c.title';
 return {sql:`WITH cards AS MATERIALIZED (SELECT ${cols} FROM ${src.from} JOIN report_rules r ON r.case_key=x.case_key JOIN search_cards c ON c.id=r.topic_id WHERE c.date<>'' AND c.date<=x.date
  UNION ALL SELECT ${cols} FROM ${src.from} JOIN search_cards c ON c.id=x.card_id WHERE x.unread=1)`,args:[...src.args,...src.args]};
}
async function computeDecisions(db,catalog,f){
 const C=await cardsOf(db,catalog,f);
 /* Eine Abfrage für Stand, Monat, Themenfeld und Gremienebene */
 const {results:cube}=await db.prepare(`${C.sql} SELECT substr(date,1,7) m,label,${KIND_SQL} kind,status,count(DISTINCT ck) n FROM cards GROUP BY 1,2,3,4`).bind(...C.args).all();
 const {results:perRegion}=await db.prepare(`${C.sql} SELECT region_id,status,count(DISTINCT ck) n FROM cards WHERE status IN ('approved','rejected','postponed') GROUP BY 1,2`).bind(...C.args).all();
 const status=blank(),months=new Map(),topics=new Map(),kinds=new Map();
 for(const r of cube){
  status[r.status]=(status[r.status]||0)+r.n;
  if(DECIDED.includes(r.status)){
   if(!months.has(r.m))months.set(r.m,blank());months.get(r.m)[r.status]+=r.n;
  }
  if(!topics.has(r.label))topics.set(r.label,blank());topics.get(r.label)[r.status]+=r.n;
  if(!kinds.has(r.kind))kinds.set(r.kind,blank());kinds.get(r.kind)[r.status]+=r.n;
 }
 const total=Object.values(status).reduce((a,b)=>a+b,0),known=total-status.unknown;
 const decided=DECIDED.reduce((a,k)=>a+status[k],0);
 const overall=rate(status);
 /* Weicht die Quote deutlich vom Gesamtwert ab? (Wilson-Spanne 95 %) */
 const differs=c=>{const d=c.approved+c.rejected+c.postponed;if(!d||overall===null)return false;const p=c.approved/d,z=1.96,den=1+z*z/d,mid=(p+z*z/(2*d))/den,h=z*Math.sqrt(p*(1-p)/d+z*z/(4*d*d))/den;return overall/100<mid-h||overall/100>mid+h;};
 const row=(id,name,c)=>({id,name,decided:c.approved+c.rejected+c.postponed,approved:c.approved,rejected:c.rejected,postponed:c.postponed,recommended:c.recommended,
  rate:id==='ausschuss'?null:rate(c),differs:id==='ausschuss'?false:differs(c),open:c.announced+c.consulting+c.recommended});
 /* Länder aus den Gebieten */
 const byId=new Map(catalog.map(r=>[r.id,r])),lands=new Map();
 for(const r of perRegion){const reg=byId.get(r.region_id);if(!reg)continue;const id=reg.ags.slice(0,2);if(!lands.has(id))lands.set(id,blank());lands.get(id)[r.status]+=r.n;}
 /* Stichprobe beschlossener Vorgänge: Stationen aus topics.payload (nur die nötigen Felder) */
 // Zahl für die Stichprobe aus dem Würfel (Vorgänge mit Entscheidung), ohne die Karten ein weiteres Mal zu lesen
 const decidedCount=cube.filter(r=>DECIDED.includes(r.status)).reduce((a,r)=>a+r.n,0);
 const k=Math.max(1,Math.ceil(decidedCount/SAMPLE));
 const {results:events}=decidedCount?await db.prepare(`${C.sql} SELECT c.id id,c.label label,c.kind kind,c.status final,json_extract(e.value,'$.status') st,json_extract(e.value,'$.result') res,substr(json_extract(e.value,'$.date'),1,10) d FROM (SELECT id,label,status,kind FROM (SELECT id,label,status,${KIND_SQL} kind,row_number() OVER (ORDER BY id) rn FROM cards WHERE status IN ('approved','rejected','postponed'))${k>1?' WHERE rn % ? = 0':''}) c JOIN topics t ON t.id=c.id, json_each(t.payload,'$.events') e`).bind(...C.args,...(k>1?[k]:[])).all():{results:[]};
 const cards=new Map();
 for(const e of events){if(!cards.has(e.id))cards.set(e.id,{label:e.label,kind:e.kind,final:e.final,ev:[]});cards.get(e.id).ev.push(e);}
 const tally=()=>({n:0,vote:0,unanimous:0,change:0,changed:0});
 const all=tally(),byTopic=new Map(),byKind=new Map(),spans=[],spanTopic=new Map();
 const add=(m,key,fn)=>{if(!m.has(key))m.set(key,tally());fn(m.get(key));};
 for(const c of cards.values()){
  const dated=c.ev.filter(e=>e.d).sort((a,b)=>a.d.localeCompare(b.d));
  /* Beschluss = letzte Station mit Entscheidung */
  const dec=[...dated].reverse().find(e=>DECIDED.includes(e.st))||[...c.ev].reverse().find(e=>DECIDED.includes(e.st));
  if(dec){
   const r=readResult(dec.res);
   const apply=t=>{t.n++;if(r.vote){t.vote++;if(r.vote==='unanimous')t.unanimous++;}if(r.change){t.change++;if(r.change==='changed')t.changed++;}};
   apply(all);add(byTopic,c.label,apply);add(byKind,c.kind,apply);
   if(dated.length>=2&&dec.d&&dated[0].d&&dec.d>=dated[0].d){const days=Math.round((Date.parse(dec.d)-Date.parse(dated[0].d))/86400000);spans.push(days);if(!spanTopic.has(c.label))spanTopic.set(c.label,[]);spanTopic.get(c.label).push(days);}
  }
 }
 spans.sort((a,b)=>a-b);
 const share=(a,b)=>b?Math.round((a/b)*1000)/10:null;
 const vrow=(id,name,t)=>({id,name,n:t.n,vote:t.vote,unanimous:share(t.unanimous,t.vote),changeN:t.change,changed:share(t.changed,t.change)});
 return {
  q:f.q,
  totals:{all:total,known,decided,knownShare:share(known,total)},
  status:STATUSES.map(id=>({id,n:status[id]||0})),
  rates:{approval:rate(status),rejection:decided?Math.round((status.rejected/decided)*1000)/10:null,postponement:decided?Math.round((status.postponed/decided)*1000)/10:null,open:status.announced+status.consulting+status.recommended},
  months:[...months].sort((a,b)=>a[0].localeCompare(b[0])).map(([m,c])=>({m,...c,rate:rate(c)})),
  topics:[...topics].filter(([id])=>id!=='unklar').map(([id,c])=>row(id,labelName(id),c)).filter(r=>r.decided>=MIN_TOPIC).sort((a,b)=>b.decided-a.decided),
  unclassified:{decided:topics.has('unklar')?topics.get('unklar').approved+topics.get('unklar').rejected+topics.get('unklar').postponed:0},
  kinds:KINDS.map(([id,name])=>row(id,name,kinds.get(id)||blank())).filter(r=>r.decided>0),
  lands:[...lands].map(([id,c])=>row(id,ALL_LANDS.find(l=>l.id===id)?.name||id,c)).filter(r=>r.decided>=MIN_LAND).sort((a,b)=>b.decided-a.decided),
  votes:{
   sampled:cards.size,of:decidedCount,capped:k>1,
   all:vrow('all','Alle',all),
   topics:[...byTopic].filter(([id,t])=>id!=='unklar'&&t.vote>=MIN_VOTE).map(([id,t])=>vrow(id,labelName(id),t)).sort((a,b)=>a.unanimous-b.unanimous),
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
 const C=await cardsOf(db,catalog,f),offset=offsetOf(params);
 const ids=by==='land'?catalog.filter(r=>r.ags?.startsWith(value)).map(r=>r.id):[];
 const cond={label:'label=?',kind:`${KIND_SQL}=?`,land:`region_id IN (SELECT value FROM json_each(?))`}[by];
 const sts=outcome?[outcome]:DECIDED,w=`status IN (${sts.map(()=>'?').join(',')}) AND ${cond}`,wa=[...sts,by==='land'?JSON.stringify(ids):value];
 // Je Vorgang eine Zeile (jüngste passende Karte), wie die Zahl
 const [{results},count]=await Promise.all([
  db.prepare(`${C.sql} SELECT id,region_id region,title,gremium,max(date) date,status,count(*) times FROM cards WHERE ${w} GROUP BY ck ORDER BY date DESC LIMIT ? OFFSET ?`).bind(...C.args,...wa,LIST_SIZE,offset).all(),
  db.prepare(`${C.sql} SELECT count(DISTINCT ck) n FROM cards WHERE ${w}`).bind(...C.args,...wa).first(),
 ]);
 const byId=new Map(catalog.map(r=>[r.id,r])),name=r=>byId.get(r)?.name||r;
 return {offset,size:LIST_SIZE,total:Number(count?.n||0),
  items:results.map(r=>({id:r.id,title:r.title,region:placeOf(name(r.region),r.title,r.gremium,byId.get(r.region)?.members).label,date:String(r.date).slice(0,10),status:r.status,times:r.times}))};
}
