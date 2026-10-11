import {LABELS} from '../../shared/labels.mjs';
import {searchFilters} from './monitor-search.mjs';
import {parseDecisions} from './analytics-decisions.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';

/*
 * Plenara.X – Fraktionsprofil: Welche Fraktionen stellen Anträge und Anfragen, zu welchen Themen, und was wird aus ihren Anträgen?
 * Grundlage: topic_facts (kind 'faction', drizzle/0025, shared/topic-facts.mjs) zu den Einträgen der Suche (dieselben Filter).
 * Erkannt wird die Fraktion aus der Antragswendung in Titel oder Textanfang („Antrag der SPD-Fraktion“); Sammelpunkte wie
 * „Beantwortung von Anfragen“ zählen nicht. Gemeinsame Anträge zählen bei jeder beteiligten Fraktion.
 * Themenprofil: Anteil eines Themenfelds an den Anträgen einer Fraktion gegenüber dem Anteil an allen Fraktionsanträgen
 * (Index 100 = wie alle). Erfolgsquote: Anteil „beschlossen“ an den Anträgen mit Entscheidung (beschlossen, abgelehnt, vertagt).
 */
const MIN_PARTY=10,MIN_CELL=5,DECIDED=['approved','rejected','postponed'];
/* Restkategorien der Themeneinordnung sind keine Sachthemen: nicht im Themenprofil */
const NO_TOPIC=new Set(['unklar','sitzung','allgemein']);
const labelName=id=>LABELS.find(l=>l.id===id)?.name||id;
const share=(a,b)=>b?Math.round((a/b)*1000)/10:null;

/** Tabelle topic_facts vorhanden? Ohne Migration 0025 gibt es nichts auszuwerten. */
export async function factsReady(db){
 try{await db.prepare('SELECT 1 FROM topic_facts LIMIT 0').all();return true;}catch{return false;}
}

export async function factions(db,catalog,params){
 const f=parseDecisions(params);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 const {page}=await searchFilters(db,catalog,f);
 /* Nur die Karten mit Fraktion prüfen (über den Primärschlüssel), nicht alle: rund 0,5 s statt 24 s ohne Filter */
 const cards=`(SELECT id,label,status,date FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind='faction') AND ${page.where} AND date<>'')`;
 const [{results:cube},total]=await Promise.all([
  db.prepare(`SELECT x.value party,x.detail kind,c.label label,c.status status,substr(c.date,1,7) m,count(*) n FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind='faction' GROUP BY 1,2,3,4,5`).bind(...page.args).all(),
  db.prepare(`SELECT count(*) withFaction FROM ${cards}`).bind(...page.args).first(),
 ]);
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
