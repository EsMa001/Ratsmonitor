import {LABELS} from '../../shared/labels.mjs';
import {POPULATION} from '../../shared/catalog.mjs';
import {searchFilters} from './monitor-search.mjs';
import {parseDecisions} from './analytics-decisions.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {factsReady} from './analytics-factions.mjs';
import {where} from './analytics-radar-extra.mjs';
import {listPage,offsetOf} from './analytics-lists.mjs';

/*
 * Plenara.X – Förderradar: Welche Förderprogramme werden wo genannt, beantragt oder bewilligt?
 * Grundlage: topic_facts (kind 'funding', drizzle/0025, shared/topic-facts.mjs) zu den Einträgen der Suche (dieselben Filter).
 * Gezählt werden Vorgänge und, wo genannt, Förderbeträge (kind 'funding_euro': nur Beträge, die unmittelbar an einem Förderwort
 * stehen, nicht Gesamtkosten oder Eigenanteil). Beträge zählen nur bei bewilligter oder beantragter Förderung, je Gebiet derselbe
 * Betrag zum selben Programm einmal (Antrag und Bescheid nennen ihn mehrfach); ein einzelner Betrag über MAX_PER_CAPITA Euro je
 * Einwohner gilt als Lesefehler (Tausender statt Euro, Landesprogramm statt Anteil der Kommune). Die Summen sind eine Untergrenze:
 * die meisten Vorgänge nennen keinen Betrag. Je Gebiet: Vorgänge mit beantragter oder bewilligter Förderung je 10.000 Einwohner
 * und Euro je Einwohner, nur Gebiete mit genügend Einträgen im Zeitraum (sonst misst die Zahl die Datenlage, nicht die Förderung).
 * Alle Zahlen zählen Vorgänge: derselbe Titel je Gebiet (mehrere Gremien) einmal, mit dem weitesten Stand. Abgelehnte Vorgänge
 * zählen nicht. Gemeindeverbände: Vorgänge ihrer Mitgliedsgemeinden (Ortsgemeinderat, Titel „Gemeinde X“) stehen mit dem Namen der
 * Gemeinde in den Listen; in die Rangliste je Einwohner geht der Verband nur mit seinen eigenen Gremien ein.
 */
const MIN_CARDS=100,MIN_POP=20000,MIN_TOPICS=5,MIN_AMOUNTS=3,TOP=25,MAX_PER_CAPITA=1000,LARGEST=15;
const labelName=id=>LABELS.find(l=>l.id===id)?.name||id;
const share=(a,b)=>b?Math.round((a/b)*1000)/10:null;
export const OTHER='Sonstige Förderung';

export async function funding(db,catalog,params){
 const f=parseDecisions(params);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 const {page}=await searchFilters(db,catalog,f);
 /* Nur Karten mit Förderangabe prüfen (Primärschlüssel); die Einträge je Gebiet zählt die zweite Abfrage */
 const cards=`(SELECT id,region_id,label,date,title,gremium FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind='funding') AND ${page.where} AND date<>'' AND status<>'rejected')`;
 const [{results:raw},{results:perRegion}]=await Promise.all([
  db.prepare(`SELECT c.id id,c.title title,c.gremium gremium,x.value program,x.detail status,c.region_id region,c.label label,c.date date FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind='funding'`).bind(...page.args).all(),
  db.prepare(`SELECT region_id region,count(DISTINCT lower(title)) n FROM search_cards WHERE ${page.where} AND date<>'' GROUP BY 1`).bind(...page.args).all(),
 ]);
 const byId=new Map(catalog.map(r=>[r.id,r])),nameOf=id=>byId.get(id)?.name||id;
 /* Je Gebiet, Titel und Programm ein Vorgang mit dem weitesten Stand und der jüngsten Sitzung */
 const RANKS={granted:3,applied:2,mentioned:1},one=new Map();
 for(const r of raw){const k=r.region+'|'+r.title.trim().toLowerCase()+'|'+r.program,o=one.get(k);if(!o||RANKS[r.status]>RANKS[o.status]||RANKS[r.status]===RANKS[o.status]&&r.date>o.date)one.set(k,r);}
 const cube=[...one.values()].map(r=>({...r,m:r.date.slice(0,7),n:1,member:!!where(nameOf(r.region),r.title,r.gremium,byId.get(r.region)?.members).key}));
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
 /* Ein Vorgang mit mehreren Programmen zählt je Programm; die Summen unten zählen Vorgänge je Gebiet genau einmal (gleicher Titel
    in mehreren Gremien eines Gebiets: einmal). Vorgänge von Mitgliedsgemeinden zählen nicht in der Rangliste des Verbands. */
 const dist=new Map();
 for(const r of cube){const k=r.region+'|'+r.title.trim().toLowerCase(),o=dist.get(k);if(!o||RANKS[r.status]>o.s)dist.set(k,{region:r.region,s:RANKS[r.status],member:r.member});}
 const topicsByRegion=new Map(),regionsAll=new Set();let topics=0,topicsGranted=0,topicsApplied=0;
 for(const r of dist.values()){topics++;if(r.s===3)topicsGranted++;if(r.s===2)topicsApplied++;if(r.s>=2){regionsAll.add(r.region);if(r.member)continue;const e=topicsByRegion.get(r.region)||{granted:0,applied:0};e[r.s===3?'granted':'applied']++;topicsByRegion.set(r.region,e);}}
 const cardsIn=new Map(perRegion.map(r=>[r.region,r.n]));
 const ranking=[...topicsByRegion].map(([id,e])=>{const pop=POPULATION[id],reg=byId.get(id);return {id,name:reg?.name||id,ags:reg?.ags||'',pop:pop||null,cards:cardsIn.get(id)||0,granted:e.granted,applied:e.applied,
  per10k:pop?Math.round(((e.granted+e.applied)/pop)*100000)/10:null,grantedPer10k:pop?Math.round((e.granted/pop)*100000)/10:null,
  programs:[...(regions.get(id)?.programs||[])].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name,n])=>({name,n}))};})
  .filter(r=>r.pop>=MIN_POP&&r.cards>=MIN_CARDS&&r.granted+r.applied>=MIN_TOPICS).sort((a,b)=>b.per10k-a.per10k||b.granted-a.granted);
 /* Förderbeträge: je Gebiet, Programm und Betrag einmal, mit dem weitesten Stand */
 const {results:amountRows}=await db.prepare(`SELECT c.id id,c.region_id region,c.title title,c.gremium gremium,c.date date,x.value program,CAST(x.detail AS INTEGER) euro,f.detail status FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind='funding_euro' JOIN topic_facts f ON f.topic_id=c.id AND f.kind='funding' AND f.value=x.value WHERE f.detail IN ('granted','applied')`).bind(...page.args).all().catch(()=>({results:[]}));
 const amounts=new Map();let implausible=0;
 for(const a of amountRows){
  const pop=POPULATION[a.region];if(pop&&a.euro/pop>MAX_PER_CAPITA){implausible++;continue;}
  const key=a.region+'|'+a.program+'|'+a.euro,old=amounts.get(key);
  if(!old||(old.status!=='granted'&&a.status==='granted')||(old.status===a.status&&a.date>old.date))amounts.set(key,a);
 }
 const euro={granted:0,applied:0},euroByProgram=new Map(),euroByRegion=new Map();
 for(const a of amounts.values()){
  euro[a.status]+=a.euro;
  const p=euroByProgram.get(a.program)||{granted:0,applied:0,n:0};p[a.status]+=a.euro;p.n++;euroByProgram.set(a.program,p);
  if(where(nameOf(a.region),a.title,a.gremium,byId.get(a.region)?.members).key)continue;
  const g=euroByRegion.get(a.region)||{granted:0,applied:0,n:0};g[a.status]+=a.euro;g.n++;euroByRegion.set(a.region,g);
 }
 const euroRanking=[...euroByRegion].map(([id,e])=>{const pop=POPULATION[id],reg=byId.get(id);return {id,name:reg?.name||id,pop:pop||null,cards:cardsIn.get(id)||0,amounts:e.n,granted:e.granted,applied:e.applied,
  perCapita:pop?Math.round(((e.granted+e.applied)/pop)*10)/10:null,grantedPerCapita:pop?Math.round((e.granted/pop)*10)/10:null};})
  .filter(r=>r.pop>=MIN_POP&&r.cards>=MIN_CARDS&&r.amounts>=MIN_AMOUNTS).sort((a,b)=>b.perCapita-a.perCapita);
 const largest=[...amounts.values()].sort((a,b)=>b.euro-a.euro).slice(0,LARGEST).map(a=>({id:a.id,title:a.title,region:where(nameOf(a.region),a.title,a.gremium,byId.get(a.region)?.members).label,date:a.date,program:a.program,euro:a.euro,status:a.status}));
 const labelSum=[...labels].reduce((a,[,n])=>a+n,0);
 return {
  q:f.q,
  totals:{topics,granted:topicsGranted,applied:topicsApplied,regions:regionsAll.size,ranked:ranking.length,cards:perRegion.reduce((a,r)=>a+r.n,0)},
  euro:{granted:euro.granted,applied:euro.applied,amounts:amounts.size,implausible,ranked:euroRanking.length},
  programs:[...programs].map(([name,p])=>{const e=euroByProgram.get(name);return {name,other:name===OTHER,granted:p.granted,applied:p.applied,mentioned:p.mentioned,n:p.granted+p.applied+p.mentioned,regions:p.regions.size,
   euroGranted:e?.granted||0,euroApplied:e?.applied||0,amounts:e?.n||0};}).sort((a,b)=>(a.other-b.other)||b.n-a.n),
  months:[...months].sort((a,b)=>a[0].localeCompare(b[0])).map(([m,c])=>({m,...c})),
  labels:[...labels].filter(([id])=>id!=='unklar').map(([id,n])=>({id,name:labelName(id),n,share:share(n,labelSum)})).sort((a,b)=>b.n-a.n),
  ranking:ranking.slice(0,TOP),
  euroRanking:euroRanking.slice(0,TOP),
  largest,
  rule:{minCards:MIN_CARDS,minPop:MIN_POP,minTopics:MIN_TOPICS,minAmounts:MIN_AMOUNTS,maxPerCapita:MAX_PER_CAPITA},
 };
}

/** Liste hinter einer Zahl: by=program (value Programm, optional outcome=granted|applied|mentioned) oder by=region (value Gebiet:
    Vorgänge mit bewilligter oder beantragter Förderung aus den eigenen Gremien, wie in der Rangliste) */
export async function fundingList(db,catalog,params){
 const by=params.get('by'),value=params.get('value')||'',outcome=params.get('outcome')||'';
 if(!['program','region'].includes(by)||!value||outcome&&!['granted','applied','mentioned'].includes(outcome))throw new AnalyticsError('Unbekannte Liste.',400);
 const copy=new URLSearchParams(params);for(const k of ['by','value','offset','outcome'])copy.delete(k);
 const f=parseDecisions(copy);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 const {page}=await searchFilters(db,catalog,f);
 const cond=by==='program'?`x.value=?${outcome?' AND x.detail=?':''}`:`c.region_id=? AND x.detail IN ('granted','applied')`;
 const {results}=await db.prepare(`SELECT c.id id,c.region_id region,c.title title,c.gremium gremium,c.date date,c.status status,max(CASE x.detail WHEN 'granted' THEN 3 WHEN 'applied' THEN 2 ELSE 1 END) s
  FROM (SELECT id,region_id,title,gremium,date,status FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind='funding') AND ${page.where} AND date<>'' AND status<>'rejected') c
  JOIN topic_facts x ON x.topic_id=c.id AND x.kind='funding' WHERE ${cond} GROUP BY c.id`)
  .bind(...page.args,value,...(by==='program'&&outcome?[outcome]:[])).all();
 const byId=new Map(catalog.map(r=>[r.id,r]));
 const rows=by==='region'?results.filter(r=>!where(byId.get(r.region)?.name||'',r.title,r.gremium,byId.get(r.region)?.members).key):results;
 const word={3:'bewilligt',2:'beantragt',1:'genannt'};
 return listPage(rows,catalog,offsetOf(params),r=>({signal:word[r.s]}));
}
