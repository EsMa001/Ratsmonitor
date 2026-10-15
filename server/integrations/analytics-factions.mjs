import {LABELS} from '../../shared/labels.mjs';
import {searchFilters} from './monitor-search.mjs';
import {parseDecisions} from './analytics-decisions.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {source,xState} from './plenara-x-query.mjs';
import {listPage,offsetOf} from './analytics-lists.mjs';

/*
 * Plenara.X – Fraktionsprofil: Welche Fraktionen stellen Anträge und Anfragen, zu welchen Themen, und was wird aus ihren Anträgen?
 * Grundlage: topic_facts (kind 'faction', drizzle/0025, shared/topic-facts.mjs) zu den Einträgen der Suche (dieselben Filter).
 * Erkannt wird die Fraktion aus der Antragswendung in Titel oder Textanfang („Antrag der SPD-Fraktion“); Sammelpunkte wie
 * „Beantwortung von Anfragen“ zählen nicht. Gemeinsame Anträge zählen bei jeder beteiligten Fraktion.
 * Themenprofil: Anteil eines Themenfelds an den Anträgen einer Fraktion gegenüber dem Anteil an allen Fraktionsanträgen
 * (Index 100 = wie alle). „Angenommen“: Anteil der Anträge, deren Beschlussvorschlag beschlossen wurde, an den Anträgen mit
 * Entscheidung (beschlossen, abgelehnt, vertagt). Empfiehlt der Beschlussvorschlag, dem Antrag nicht zu folgen (kind
 * 'faction_advice'), zählt „beschlossen“ als abgelehnt. Gezählt wird je Vorgang (x_cases: Ausschuss und Rat einmal, mit
 * seinem Stand) über dieselbe Auswahl wie alle plenara.X-Seiten; Formalien, Besetzungen und private Bauanträge zählen nicht.
 */
const MIN_PARTY=10,MIN_CELL=5,DECIDED=['approved','rejected','postponed'];
/* Restkategorien der Themeneinordnung sind keine Sachthemen: nicht im Themenprofil */
const NO_TOPIC=new Set(['unklar']);
const labelName=id=>LABELS.find(l=>l.id===id)?.name||id;
const share=(a,b)=>b?Math.round((a/b)*1000)/10:null;

/** Tabelle topic_facts vorhanden? Ohne Migration 0025 gibt es nichts auszuwerten. */
export async function factsReady(db){
 // Nur „Tabelle fehlt“ heißt fehlende Migration; andere Fehler (Datenbank gerade gesperrt) gehen weiter an die Route
 try{await db.prepare('SELECT 1 FROM topic_facts LIMIT 0').all();return true;}catch(e){if(/no such table/i.test(String(e?.message||e)))return false;throw e;}
}

/* Alle Fraktionsvorgänge der Suche, wie überall in plenara.X: Auswahl über source() (Sachvorgänge in x_cases, ohne private
   Bauanträge), Fraktion aus den Fakten aller Karten des Vorgangs (report_rules.case_key); Status und Datum des Vorgangs.
   status: „beschlossen“ mit Empfehlung „nicht folgen“ zählt als abgelehnt */
async function load(db,catalog,params){
 const copy=new URLSearchParams(params);for(const k of ['by','value','offset','outcome'])copy.delete(k);
 const f=parseDecisions(copy);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 if(!(await xState(db)))throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut. Bitte später erneut versuchen.',503);
 const src=await source(db,catalog,f,{noPrivate:true,facts:['faction']});
 const {results}=await db.prepare(`SELECT x.case_key ck,x.card_id id,x.region_id region,x.label label,x.status status,x.date date,fa.value party,max(fa.detail) kind,
  EXISTS(SELECT 1 FROM report_rules ra JOIN topic_facts a ON a.topic_id=ra.topic_id AND a.kind='faction_advice' WHERE ra.case_key=x.case_key) advice
  FROM ${src.from} JOIN report_rules rr ON rr.case_key=x.case_key JOIN topic_facts fa ON fa.topic_id=rr.topic_id AND fa.kind='faction'
  GROUP BY x.case_key,fa.value`).bind(...src.args).all();
 return {f,raw:results.map(r=>({...r,status:r.status==='approved'&&r.advice?'rejected':r.status}))};
}

/** Liste hinter einer Zahl: by=party&value=Fraktion, optional outcome=approved|rejected|postponed|decided|antrag|anfrage */
export async function factionList(db,catalog,params){
 if(params.get('by')!=='party'||!params.get('value'))throw new AnalyticsError('Unbekannte Liste.',400);
 const {raw}=await load(db,catalog,params),party=params.get('value'),outcome=params.get('outcome')||'';
 /* Wie die Zahlen: je Vorgang einmal, mit seinem Stand */
 const latest=raw.filter(r=>r.party===party).sort((a,b)=>b.date.localeCompare(a.date));
 const rows=latest.filter(r=>(!outcome||(outcome==='anfrage'?r.kind==='anfrage':outcome==='antrag'?r.kind!=='anfrage':outcome==='decided'?r.kind!=='anfrage'&&DECIDED.includes(r.status):r.kind!=='anfrage'&&r.status===outcome)));
 /* Titel und Gremium zur Anzeige aus der Karte des Vorgangs */
 const cards=new Map();
 for(let i=0;i<rows.length;i+=5000){const {results}=await db.prepare('SELECT id,title,gremium FROM search_cards WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(rows.slice(i,i+5000).map(r=>r.id))).all();for(const c of results)cards.set(c.id,c);}
 return listPage(rows.map(r=>({...r,title:cards.get(r.id)?.title||'',gremium:cards.get(r.id)?.gremium||''})),catalog,offsetOf(params));
}

export async function factions(db,catalog,params){
 const {f,raw}=await load(db,catalog,params);
 /* Je Vorgang und Fraktion ein Antrag (load gruppiert schon) */
 const ids=new Set(),cube=[];
 for(const r of raw){
  ids.add(r.ck);
  cube.push({party:r.party,kind:r.kind,label:r.label,status:r.status,m:r.date.slice(0,7),n:1});
 }
 const total={withFaction:ids.size};
 const parties=new Map(),labelsAll=new Map(),months=new Map();let facts=0;
 const party=name=>{if(!parties.has(name))parties.set(name,{name,n:0,antrag:0,anfrage:0,approved:0,rejected:0,postponed:0,open:0,labels:new Map(),months:new Map()});return parties.get(name);};
 for(const r of cube){
  const p=party(r.party);facts+=r.n;
  p.n+=r.n;p[r.kind==='anfrage'?'anfrage':'antrag']+=r.n;
  // Erfolgsquote nur für Anträge: eine Anfrage wird beantwortet, nicht beschlossen
  if(r.kind!=='anfrage'){if(DECIDED.includes(r.status))p[r.status]+=r.n;else if(['announced','consulting','recommended'].includes(r.status))p.open+=r.n;}
  p.labels.set(r.label,(p.labels.get(r.label)||0)+r.n);labelsAll.set(r.label,(labelsAll.get(r.label)||0)+r.n);
  p.months.set(r.m,(p.months.get(r.m)||0)+r.n);months.set(r.m,(months.get(r.m)||0)+r.n);
 }
 /* Themenprofil: nur eingeordnete Themenfelder (ohne „unklar“) */
 const sorted=[...labelsAll].filter(([id])=>!NO_TOPIC.has(id)),allN=sorted.reduce((a,[,n])=>a+n,0);
 const rows=[...parties.values()].filter(p=>p.n>=MIN_PARTY).sort((a,b)=>b.n-a.n).map(p=>{
  const pN=[...p.labels].filter(([id])=>!NO_TOPIC.has(id)).reduce((a,[,n])=>a+n,0);
  const profile=sorted.map(([id,n])=>{const k=p.labels.get(id)||0;return {id,name:labelName(id),n:k,share:share(k,pN),index:pN&&allN&&n?Math.round(((k/pN)/(n/allN))*100):null};}).sort((a,b)=>b.n-a.n);
  const decided=p.approved+p.rejected+p.postponed;
  return {name:p.name,n:p.n,antrag:p.antrag,anfrage:p.anfrage,decided,approved:p.approved,rejected:p.rejected,postponed:p.postponed,open:p.open,rate:share(p.approved,decided),
   top:profile.filter(x=>x.n>=MIN_CELL&&x.index>=120).sort((a,b)=>b.index-a.index).slice(0,3),profile,
   months:[...p.months].sort((a,b)=>a[0].localeCompare(b[0])).map(([m,n])=>({m,n}))};
 });
 return {
  q:f.q,
  totals:{withFaction:total?.withFaction||0,facts},
  labels:sorted.sort((a,b)=>b[1]-a[1]).map(([id,n])=>({id,name:labelName(id),n,share:share(n,allN)})),
  months:[...months].sort((a,b)=>a[0].localeCompare(b[0])).map(([m,n])=>({m,n})),
  parties:rows,
  small:[...parties.values()].filter(p=>p.n<MIN_PARTY).map(p=>({name:p.name,n:p.n})),
 };
}
