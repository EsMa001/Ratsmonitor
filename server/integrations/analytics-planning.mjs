import {POPULATION} from '../../shared/catalog.mjs';
import {STAGES} from '../../shared/topic-facts.mjs';
import {searchFilters} from './monitor-search.mjs';
import {parseDecisions} from './analytics-decisions.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {factsReady} from './analytics-factions.mjs';
import {where} from './analytics-radar-extra.mjs';

/*
 * Plenara.X – Bauleitplanung: Welche Bebauungs- und Flächennutzungspläne sind in welchem Verfahrensschritt, wo wird viel
 * geplant, und wie viele Wohnungen sollen entstehen? Grundlage: topic_facts (kind 'plan' mit Schritt und Plan, 'housing' mit
 * Wohneinheiten; shared/topic-facts.mjs) zu den Einträgen der Suche (dieselben Filter).
 * Ein Plan läuft über mehrere Sitzungen und Gremien; er wird je Gebiet über seine Bezeichnung (Nummer oder Name) einmal gezählt,
 * mit dem weitesten erreichten Schritt. Wohneinheiten: die größte für einen Plan genannte Zahl. Sie stehen nur bei einem kleinen
 * Teil der Pläne im Hauptdokument (oft erst in der Begründung, einer Anlage) und sind deshalb eine Untergrenze.
 * Art des Plangebiets (kind 'plan_use': Gewerbe, Industrie, Logistik, Einzelhandel, Energie, Rechenzentrum, Mischgebiet, Wohnen)
 * je Plan aus allen seinen Vorgängen; mit Gemeindeschlüssel für die Karte (bei Gemeindeverbänden die im Titel genannte Gemeinde).
 * Mit Ort zählt nur dessen eigener Rat (wie in den Themenradaren).
 */
const ORDER=[...STAGES.map(([n])=>n),'Aufhebung','Sonstiger Schritt'];
const RANK=new Map(ORDER.map((n,i)=>[n,i]));
const MIN_POP=20000,MIN_PLANS=5,TOP=20;

/* Pläne je Gebiet und Bezeichnung aus den Einträgen der Suche */
async function collect(db,catalog,params){
 const copy=new URLSearchParams(params);for(const k of ['by','value','offset'])copy.delete(k);
 if(copy.get('area'))copy.set('scope','only');
 const f=parseDecisions(copy);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 const {page}=await searchFilters(db,catalog,f);
 const cards=`(SELECT id,region_id,date,title,status FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind='plan') AND ${page.where} AND date<>'')`;
 const {results:rows}=await db.prepare(`SELECT c.id id,c.region_id region,c.date date,c.title title,c.status status,x.value stage,x.detail detail,
  (SELECT CAST(h.detail AS INTEGER) FROM topic_facts h WHERE h.topic_id=c.id AND h.kind='housing') we,
  (SELECT group_concat(u.value,'|') FROM topic_facts u WHERE u.topic_id=c.id AND u.kind='plan_use') uses,
  (SELECT max(u.detail) FROM topic_facts u WHERE u.topic_id=c.id AND u.kind='plan_use') inter
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
  const p=plans.get(key)||{key,region:r.region,type,stage:r.stage,date:r.date,id:r.id,title:r.title,status:r.status,we:0,topics:0,uses:new Set(),inter:false};
  p.topics++;if(r.we>p.we)p.we=r.we;
  for(const u of String(r.uses||'').split('|').filter(Boolean))p.uses.add(u);if(r.inter)p.inter=true;
  if(r.stage!=='Sonstiger Schritt'&&(p.stage==='Sonstiger Schritt'||RANK.get(r.stage)>RANK.get(p.stage)))p.stage=r.stage;
  if(r.date>p.date){p.date=r.date;p.id=r.id;p.title=r.title;p.status=r.status;}
  plans.set(key,p);
 }
 return {f,rows,steps,types,months,plans};
}

export async function planning(db,catalog,params){
 const {f,rows,steps,types,months,plans}=await collect(db,catalog,params);
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
 /* Gemeindeschlüssel für die Karte: Gemeinde, bei Gemeindeverbänden die im Titel genannte Mitgliedsgemeinde, sonst alle */
 const agsOf=p=>{const r=byId.get(p.region);if(!r||r.kind==='district')return [];if(!r.members)return [r.ags];
  const m=where(r.name,p.title).key.toLowerCase(),hit=m&&r.members.find(x=>x.name.toLowerCase().includes(m));return hit?[hit.ags]:r.members.map(x=>x.ags);};
 const withUse=planList.filter(p=>p.uses.size);
 const useNames=[...new Set(withUse.flatMap(p=>[...p.uses]))];
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
  uses:useNames.map(u=>{const l=withUse.filter(p=>p.uses.has(u));return {name:u,plans:l.length,adopted:l.filter(p=>p.stage==='Satzungsbeschluss').length,regions:new Set(l.map(p=>p.region)).size,inter:l.filter(p=>p.inter).length};}).sort((a,b)=>b.plans-a.plans),
  usePlans:withUse.sort((a,b)=>b.date.localeCompare(a.date)).map(p=>({id:p.id,title:p.title,region:where(byId.get(p.region)?.name||p.region,p.title).label,date:p.date,stage:p.stage,status:p.status,uses:[...p.uses],inter:p.inter,ags:agsOf(p)})),
  rule:{minPop:MIN_POP,minPlans:MIN_PLANS},
 };
}

/* Pläne hinter einer Zahl: Verfahrensschritt (by=stage, weitester Schritt je Plan), Gebiet (region), Art (use); je Abruf 50 */
const LIST_SIZE=50;
export async function planList(db,catalog,params){
 const by=params.get('by')||'',value=params.get('value')||'',offset=Math.max(0,Number(params.get('offset'))||0);
 if(!['stage','region','use','type'].includes(by)||!value)throw new AnalyticsError('Unbekannte Liste.',400);
 const {plans}=await collect(db,catalog,params);
 const byId=new Map(catalog.map(r=>[r.id,r]));
 const list=[...plans.values()].filter(p=>by==='stage'?p.stage===value:by==='region'?p.region===value:by==='type'?p.type===value:p.uses.has(value)).sort((a,b)=>b.date.localeCompare(a.date));
 return {by,value,offset,size:LIST_SIZE,total:list.length,items:list.slice(offset,offset+LIST_SIZE).map(p=>({id:p.id,title:p.title,region:where(byId.get(p.region)?.name||p.region,p.title).label,date:p.date,status:p.status,times:p.topics,signal:p.stage,topics:[...p.uses]}))};
}
