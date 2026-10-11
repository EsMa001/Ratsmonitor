import {LABELS} from '../../shared/labels.mjs';
import {POPULATION} from '../../shared/catalog.mjs';
import {searchFilters} from './monitor-search.mjs';
import {parseDecisions} from './analytics-decisions.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {factsReady} from './analytics-factions.mjs';

/*
 * Plenara.X – Förderradar: Welche Förderprogramme werden wo genannt, beantragt oder bewilligt?
 * Grundlage: topic_facts (kind 'funding', drizzle/0025, shared/topic-facts.mjs) zu den Einträgen der Suche (dieselben Filter).
 * Gezählt werden Vorgänge, nicht Euro: Beträge stehen in den Unterlagen in verschiedenen Rollen (Förderbetrag, Gesamtkosten,
 * Eigenanteil) und oft mehrfach; als Summe wären sie irreführend. Je Gebiet: Vorgänge mit beantragter oder bewilligter Förderung
 * je 10.000 Einwohner, nur Gebiete mit genügend Einträgen im Zeitraum (sonst misst die Zahl die Datenlage, nicht die Förderung).
 */
const MIN_CARDS=100,MIN_POP=20000,MIN_TOPICS=5,TOP=25;
const labelName=id=>LABELS.find(l=>l.id===id)?.name||id;
const share=(a,b)=>b?Math.round((a/b)*1000)/10:null;
export const OTHER='Sonstige Förderung';

export async function funding(db,catalog,params){
 const f=parseDecisions(params);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 const {page}=await searchFilters(db,catalog,f);
 /* Nur Karten mit Förderangabe prüfen (Primärschlüssel); die Einträge je Gebiet zählt die zweite Abfrage */
 const cards=`(SELECT id,region_id,label,date FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind='funding') AND ${page.where} AND date<>'')`;
 const [{results:cube},{results:perRegion}]=await Promise.all([
  db.prepare(`SELECT x.value program,x.detail status,c.region_id region,c.label label,substr(c.date,1,7) m,count(*) n FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind='funding' GROUP BY 1,2,3,4,5`).bind(...page.args).all(),
  db.prepare(`SELECT region_id region,count(*) n FROM search_cards WHERE ${page.where} AND date<>'' GROUP BY 1`).bind(...page.args).all(),
 ]);
 const blank=()=>({granted:0,applied:0,mentioned:0});
 const programs=new Map(),regions=new Map(),months=new Map(),labels=new Map();
 for(const r of cube){
  if(!programs.has(r.program))programs.set(r.program,{...blank(),regions:new Set()});
  const p=programs.get(r.program);p[r.status]+=r.n;p.regions.add(r.region);
  if(!regions.has(r.region))regions.set(r.region,{...blank(),programs:new Map()});
  const g=regions.get(r.region);g[r.status]+=r.n;if(r.status!=='mentioned')g.programs.set(r.program,(g.programs.get(r.program)||0)+r.n);
  if(!months.has(r.m))months.set(r.m,blank());months.get(r.m)[r.status]+=r.n;
  if(r.status!=='mentioned')labels.set(r.label,(labels.get(r.label)||0)+r.n);
 }
 /* Ein Vorgang mit mehreren Programmen zählt je Programm; die Summen unten zählen Vorgänge je Gebiet genau einmal */
 const {results:distinct}=await db.prepare(`SELECT c.region_id region,max(CASE x.detail WHEN 'granted' THEN 3 WHEN 'applied' THEN 2 ELSE 1 END) s,count(DISTINCT c.id) n FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind='funding' GROUP BY c.region_id,c.id`).bind(...page.args).all().catch(()=>({results:[]}));
 const topicsByRegion=new Map();let topics=0,topicsGranted=0,topicsApplied=0;
 for(const r of distinct){topics++;if(r.s===3)topicsGranted++;if(r.s===2)topicsApplied++;if(r.s>=2){const e=topicsByRegion.get(r.region)||{granted:0,applied:0};e[r.s===3?'granted':'applied']++;topicsByRegion.set(r.region,e);}}
 const cardsIn=new Map(perRegion.map(r=>[r.region,r.n])),byId=new Map(catalog.map(r=>[r.id,r]));
 const ranking=[...topicsByRegion].map(([id,e])=>{const pop=POPULATION[id],reg=byId.get(id);return {id,name:reg?.name||id,ags:reg?.ags||'',pop:pop||null,cards:cardsIn.get(id)||0,granted:e.granted,applied:e.applied,
  per10k:pop?Math.round(((e.granted+e.applied)/pop)*100000)/10:null,grantedPer10k:pop?Math.round((e.granted/pop)*100000)/10:null,
  programs:[...(regions.get(id)?.programs||[])].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name,n])=>({name,n}))};})
  .filter(r=>r.pop>=MIN_POP&&r.cards>=MIN_CARDS&&r.granted+r.applied>=MIN_TOPICS).sort((a,b)=>b.per10k-a.per10k||b.granted-a.granted);
 const labelSum=[...labels].reduce((a,[,n])=>a+n,0);
 return {
  q:f.q,
  totals:{topics,granted:topicsGranted,applied:topicsApplied,regions:topicsByRegion.size,ranked:ranking.length,cards:perRegion.reduce((a,r)=>a+r.n,0)},
  programs:[...programs].map(([name,p])=>({name,other:name===OTHER,granted:p.granted,applied:p.applied,mentioned:p.mentioned,n:p.granted+p.applied+p.mentioned,regions:p.regions.size})).sort((a,b)=>(a.other-b.other)||b.n-a.n),
  months:[...months].sort((a,b)=>a[0].localeCompare(b[0])).map(([m,c])=>({m,...c})),
  labels:[...labels].filter(([id])=>id!=='unklar').map(([id,n])=>({id,name:labelName(id),n,share:share(n,labelSum)})).sort((a,b)=>b.n-a.n),
  ranking:ranking.slice(0,TOP),
  rule:{minCards:MIN_CARDS,minPop:MIN_POP,minTopics:MIN_TOPICS},
 };
}
