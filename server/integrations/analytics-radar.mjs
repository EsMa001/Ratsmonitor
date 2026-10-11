import {POPULATION} from '../../shared/catalog.mjs';
import {RADARS} from '../../shared/radars.mjs';
import {searchFilters} from './monitor-search.mjs';
import {parseDecisions} from './analytics-decisions.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {factsReady} from './analytics-factions.mjs';

/*
 * Plenara.X – Themenradare (Versorgung, Verkehr, Vereine und Soziales, Vergabe, Klima und Energie, Finanzlage, Beteiligung):
 * eine Auswertung für alle, beschrieben in shared/radars.mjs. Grundlage: topic_facts (kind 'radar:<id>', value Unterthema,
 * detail Signal) zu den Einträgen der Suche (dieselben Filter). Je Unterthema: Vorgänge, Gebiete und was aus ihnen wird
 * (Beschlussquote wie in „Beschlüsse“: Anteil beschlossen an beschlossen, vertagt, abgelehnt); dazu Signale, Verlauf je Monat,
 * Gebiete je 10.000 Einwohner (gleiche Titel je Gebiet einmal) und die jüngsten Vorgänge.
 */
const DECIDED=['approved','rejected','postponed'],MIN_POP=20000,MIN_TOPICS=5,TOP=20,RECENT=40;
const share=(a,b)=>b?Math.round((a/b)*1000)/10:null;
// Derselbe Titel in mehreren Gremien eines Gebiets (Ausschuss, Rat, Ortschaftsräte) ist für den Vergleich ein Vorgang
const titleKey=t=>String(t||'').toLowerCase().replace(/[^a-z0-9äöüß]+/g,' ').trim();

export async function radar(db,catalog,params){
 const id=params.get('radar')||'';
 const def=RADARS[id];
 if(!def)throw new AnalyticsError('Unbekanntes Radar.',404);
 const copy=new URLSearchParams(params);copy.delete('radar');
 const f=parseDecisions(copy);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 const {page}=await searchFilters(db,catalog,f);
 const kind='radar:'+id;
 const cards=`(SELECT id,region_id,date,title,status FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind=?) AND ${page.where} AND date<>'')`;
 const {results:rows}=await db.prepare(`SELECT c.id id,c.region_id region,c.date date,c.title title,c.status status,x.value topic,x.detail signal FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind=?`).bind(kind,...page.args,kind).all();
 const byId=new Map(catalog.map(r=>[r.id,r])),name=r=>byId.get(r)?.name||r;
 const blank=()=>({n:0,approved:0,rejected:0,postponed:0,open:0,regions:new Set(),signals:new Map()});
 const topics=new Map([...def.topics.map(([n])=>n),...(def.fallback?[def.fallback]:[])].map(n=>[n,blank()])),signals=new Map(),months=new Map(),regions=new Map(),items=new Map();
 for(const r of rows){
  const t=topics.get(r.topic)||blank();topics.set(r.topic,t);
  t.n++;t.regions.add(r.region);t.signals.set(r.signal,(t.signals.get(r.signal)||0)+1);
  if(DECIDED.includes(r.status))t[r.status]++;else if(['announced','consulting','recommended'].includes(r.status))t.open++;
  signals.set(r.signal,(signals.get(r.signal)||0)+1);
  const m=r.date.slice(0,7);if(!months.has(m))months.set(m,new Map());months.get(m).set(r.topic,(months.get(m).get(r.topic)||0)+1);
  // Vorgänge je Gebiet einmal (auch mit mehreren Unterthemen)
  if(!items.has(r.id)){items.set(r.id,{...r,topics:[r.topic]});const g=regions.get(r.region)||{titles:new Set(),topics:new Map()};g.titles.add(titleKey(r.title));regions.set(r.region,g);}
  else items.get(r.id).topics.push(r.topic);
  const g=regions.get(r.region);g.topics.set(r.topic,(g.topics.get(r.topic)||0)+1);
 }
 const list=[...items.values()];
 const decided=list.filter(i=>DECIDED.includes(i.status)),approved=decided.filter(i=>i.status==='approved').length;
 return {
  q:f.q,radar:id,name:def.name,
  totals:{topics:list.length,regions:regions.size,decided:decided.length,rate:share(approved,decided.length)},
  topics:[...topics].map(([n,t])=>{const d=t.approved+t.rejected+t.postponed;return {name:n,n:t.n,regions:t.regions.size,decided:d,approved:t.approved,rejected:t.rejected,postponed:t.postponed,open:t.open,rate:share(t.approved,d),
   signals:[...t.signals].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([s,k])=>({name:s,n:k}))};}),
  signals:[...signals].map(([s,n])=>({name:s,n})).sort((a,b)=>b.n-a.n),
  months:[...months].sort((a,b)=>a[0].localeCompare(b[0])).map(([m,c])=>({m,total:[...c.values()].reduce((a,b)=>a+b,0),byTopic:Object.fromEntries(c)})),
  regions:[...regions].map(([r,g])=>{const pop=POPULATION[r],n=g.titles.size;return {id:r,name:name(r),pop:pop||null,n,per10k:pop?Math.round((n/pop)*100000)/10:null,topics:[...g.topics].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n])=>n)};})
   .filter(r=>r.pop>=MIN_POP&&r.n>=MIN_TOPICS).sort((a,b)=>b.per10k-a.per10k).slice(0,TOP),
  recent:list.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,RECENT).map(i=>({id:i.id,title:i.title,region:name(i.region),date:i.date,status:i.status,signal:i.signal,topics:i.topics})),
  rule:{minPop:MIN_POP,minTopics:MIN_TOPICS},
 };
}
