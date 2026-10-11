import {POPULATION} from '../../shared/catalog.mjs';
import {STAGES} from '../../shared/topic-facts.mjs';
import {searchFilters} from './monitor-search.mjs';
import {parseDecisions} from './analytics-decisions.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {factsReady} from './analytics-factions.mjs';

/*
 * Plenara.X – Bauleitplanung: Welche Bebauungs- und Flächennutzungspläne sind in welchem Verfahrensschritt, wo wird viel
 * geplant, und wie viele Wohnungen sollen entstehen? Grundlage: topic_facts (kind 'plan' mit Schritt und Plan, 'housing' mit
 * Wohneinheiten; shared/topic-facts.mjs) zu den Einträgen der Suche (dieselben Filter).
 * Ein Plan läuft über mehrere Sitzungen und Gremien; er wird je Gebiet über seine Bezeichnung (Nummer oder Name) einmal gezählt,
 * mit dem weitesten erreichten Schritt. Wohneinheiten: die größte für einen Plan genannte Zahl. Sie stehen nur bei einem kleinen
 * Teil der Pläne im Hauptdokument (oft erst in der Begründung, einer Anlage) und sind deshalb eine Untergrenze.
 */
const ORDER=[...STAGES.map(([n])=>n),'Aufhebung','Sonstiger Schritt'];
const RANK=new Map(ORDER.map((n,i)=>[n,i]));
const MIN_POP=20000,MIN_PLANS=5,TOP=20;

export async function planning(db,catalog,params){
 const f=parseDecisions(params);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 const {page}=await searchFilters(db,catalog,f);
 const cards=`(SELECT id,region_id,date,title FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind='plan') AND ${page.where} AND date<>'')`;
 const {results:rows}=await db.prepare(`SELECT c.id id,c.region_id region,c.date date,c.title title,x.value stage,x.detail detail,
  (SELECT CAST(h.detail AS INTEGER) FROM topic_facts h WHERE h.topic_id=c.id AND h.kind='housing') we
  FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind='plan'`).bind(...page.args).all();
 const steps=new Map(ORDER.map(n=>[n,0])),types=new Map(),months=new Map(),plans=new Map();
 const byName=new Map(catalog.map(r=>[r.id,(r.name||'').toLowerCase()]));
 /* Plan einer anderen, im Titel genannten Gemeinde („Bauleitplanung Stadt Stein“ in Zirndorf): nicht der eigene */
 const foreign=r=>{const m=r.title.match(/(?:Bauleitplanung|Bebauungsplan|Flächennutzungsplan)\S*\s+(?:der\s+|des\s+)?(?:Stadt|Gemeinde|Markt|Ortsgemeinde|Verbandsgemeinde)\s+([A-ZÄÖÜ][\wäöüß-]+)/);return !!m&&!(byName.get(r.region)||'').includes(m[1].toLowerCase());};
 for(const r of rows){
  if(foreign(r))continue;
  steps.set(r.stage,(steps.get(r.stage)||0)+1);
  const [type,name]=String(r.detail).split('|');types.set(type,(types.get(type)||0)+1);
  const m=r.date.slice(0,7);if(!months.has(m))months.set(m,{m,Aufstellung:0,Offenlage:0,Satzungsbeschluss:0});if(['Aufstellung','Offenlage','Satzungsbeschluss'].includes(r.stage))months.get(m)[r.stage]++;
  // Ein Plan je Gebiet und Bezeichnung: weitester Schritt, jüngste Sitzung, größte Zahl an Wohneinheiten
  const key=r.region+'|'+type+'|'+name;
  const p=plans.get(key)||{region:r.region,type,stage:r.stage,date:r.date,id:r.id,title:r.title,we:0,topics:0};
  p.topics++;if(r.we>p.we)p.we=r.we;
  if(r.stage!=='Sonstiger Schritt'&&(p.stage==='Sonstiger Schritt'||RANK.get(r.stage)>RANK.get(p.stage)))p.stage=r.stage;
  if(r.date>p.date){p.date=r.date;p.id=r.id;p.title=r.title;}
  plans.set(key,p);
 }
 const byId=new Map(catalog.map(r=>[r.id,r])),regions=new Map();
 for(const p of plans.values()){
  const g=regions.get(p.region)||{plans:0,adopted:0,started:0,we:0,weKnown:0};
  g.plans++;if(p.stage==='Satzungsbeschluss')g.adopted++;if(p.stage==='Aufstellung')g.started++;if(p.we){g.we+=p.we;g.weKnown++;}
  regions.set(p.region,g);
 }
 const row=(id,g)=>{const pop=POPULATION[id];return {id,name:byId.get(id)?.name||id,pop:pop||null,...g,plansPer10k:pop?Math.round((g.plans/pop)*100000)/10:null,wePer1k:pop&&g.we?Math.round((g.we/pop)*10000)/10:null};};
 const all=[...regions].map(([id,g])=>row(id,g));
 const named=p=>({id:p.id,title:p.title,region:byId.get(p.region)?.name||p.region,date:p.date,stage:p.stage,type:p.type,we:p.we||null});
 const planList=[...plans.values()];
 return {
  q:f.q,
  totals:{topics:rows.length,plans:plans.size,adopted:planList.filter(p=>p.stage==='Satzungsbeschluss').length,regions:regions.size,
   we:planList.reduce((a,p)=>a+p.we,0),weKnown:planList.filter(p=>p.we).length},
  steps:ORDER.map(n=>({name:n,n:steps.get(n)||0})),
  plansByStage:ORDER.map(n=>({name:n,n:planList.filter(p=>p.stage===n).length})),
  types:[...types].map(([name,n])=>({name,n})).sort((a,b)=>b.n-a.n),
  months:[...months.values()].sort((a,b)=>a.m.localeCompare(b.m)),
  regions:all.filter(r=>r.pop>=MIN_POP&&r.plans>=MIN_PLANS).sort((a,b)=>b.plansPer10k-a.plansPer10k).slice(0,TOP),
  housingRegions:all.filter(r=>r.we>0).sort((a,b)=>b.we-a.we).slice(0,TOP),
  housingPlans:planList.filter(p=>p.we).sort((a,b)=>b.we-a.we).slice(0,TOP).map(named),
  adopted:planList.filter(p=>p.stage==='Satzungsbeschluss').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,TOP).map(named),
  rule:{minPop:MIN_POP,minPlans:MIN_PLANS},
 };
}
