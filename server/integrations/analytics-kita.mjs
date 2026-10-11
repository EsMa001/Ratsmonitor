import {POPULATION} from '../../shared/catalog.mjs';
import {searchFilters} from './monitor-search.mjs';
import {parseDecisions} from './analytics-decisions.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {factsReady} from './analytics-factions.mjs';
import {radarMap,windowOf} from './analytics-radar-norms.mjs';

/*
 * Plenara.X – Kita-Radar: Wo wird über Elternbeiträge entschieden und in welche Richtung (Erhöhung, Senkung, Beitragsfreiheit,
 * Verpflegung, sonstige Neufassung der Satzung), und wo entstehen neue Kita-Plätze? Grundlage: topic_facts (kind 'kita_fee',
 * 'kita_places'; shared/topic-facts.mjs) zu den Einträgen der Suche (dieselben Filter).
 * Die Höhe der Beiträge wird nicht verglichen: Beträge stehen je Monat, Einkommensstufe, Alter und Betreuungszeit verschieden da.
 * Neue Plätze: die größte in einem Vorgang genannte Zahl; ein Projekt in mehreren Sitzungen zählt je Gebiet einmal (gleicher Titel).
 */
const DIRECTIONS=['Erhöhung','Senkung','Beitragsfreiheit','Verpflegung','Neufassung'];
const TOP=25;

/* Filter wie die Suche; mit Ort nur dessen eigener Rat (Kita-Bedarfsplanung liegt oft beim Kreis, das soll nicht mitzählen) */
async function kitaFilters(db,catalog,params){
 const copy=new URLSearchParams(params);for(const k of ['by','value','offset'])copy.delete(k);
 if(copy.get('area'))copy.set('scope','only');
 const f=parseDecisions(copy);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 const {page}=await searchFilters(db,catalog,f);
 return {f,page};
}

export async function kita(db,catalog,params){
 const {f,page}=await kitaFilters(db,catalog,params);
 const cards=kind=>`(SELECT id,region_id,date,title,status FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind='${kind}') AND ${page.where} AND date<>'')`;
 const [{results:fees},{results:places}]=await Promise.all([
  db.prepare(`SELECT c.id id,c.region_id region,c.date date,c.title title,c.status status,x.value direction,x.detail euro FROM ${cards('kita_fee')} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind='kita_fee'`).bind(...page.args).all(),
  db.prepare(`SELECT c.id id,c.region_id region,c.date date,c.title title,CAST(x.detail AS INTEGER) n FROM ${cards('kita_places')} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind='kita_places'`).bind(...page.args).all(),
 ]);
 const byId=new Map(catalog.map(r=>[r.id,r])),name=id=>byId.get(id)?.name||id;
 const dir=new Map(DIRECTIONS.map(d=>[d,0])),months=new Map(),feeRegions=new Map();
 for(const r of fees){
  dir.set(r.direction,(dir.get(r.direction)||0)+1);
  const m=r.date.slice(0,7);if(!months.has(m))months.set(m,{m,...Object.fromEntries(DIRECTIONS.map(d=>[d,0]))});months.get(m)[r.direction]++;
  const g=feeRegions.get(r.region)||Object.fromEntries(DIRECTIONS.map(d=>[d,0]));g[r.direction]++;feeRegions.set(r.region,g);
 }
 /* Ein Projekt je Gebiet und Titel einmal (mit der größten genannten Zahl) */
 const projects=new Map();
 for(const r of places){const key=r.region+'|'+r.title.toLowerCase();const p=projects.get(key);if(!p||r.n>p.n||(r.n===p.n&&r.date>p.date))projects.set(key,r);}
 const placeRegions=new Map();
 for(const p of projects.values()){const g=placeRegions.get(p.region)||{places:0,projects:0};g.places+=p.n;g.projects++;placeRegions.set(p.region,g);}
 const pop=id=>POPULATION[id]||null;
 return {
  q:f.q,
  totals:{fees:fees.length,feeRegions:feeRegions.size,projects:projects.size,places:[...projects.values()].reduce((a,p)=>a+p.n,0),placeRegions:placeRegions.size},
  directions:DIRECTIONS.map(d=>({name:d,n:dir.get(d)||0})),
  months:[...months.values()].sort((a,b)=>a.m.localeCompare(b.m)),
  decisions:fees.filter(r=>r.direction!=='Neufassung').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,TOP).map(r=>({id:r.id,title:r.title,region:name(r.region),date:r.date,direction:r.direction,euro:r.euro||null,status:r.status})),
  feeRegions:[...feeRegions].map(([id,g])=>({id,name:name(id),...g,n:DIRECTIONS.reduce((a,d)=>a+g[d],0)})).sort((a,b)=>b.n-a.n).slice(0,TOP),
  placeRegions:[...placeRegions].map(([id,g])=>({id,name:name(id),pop:pop(id),...g,per1k:pop(id)?Math.round((g.places/pop(id))*10000)/10:null})).sort((a,b)=>b.places-a.places).slice(0,TOP),
  projects:[...projects.values()].sort((a,b)=>b.n-a.n).slice(0,TOP).map(p=>({id:p.id,title:p.title,region:name(p.region),date:p.date,places:p.n})),
 };
}

/* Vorgänge hinter einer Zahl: Richtung der Elternbeiträge (by=direction) oder Gebiet (region); je Abruf 50 */
const LIST_SIZE=50;
export async function kitaList(db,catalog,params){
 const by=params.get('by')||'',value=params.get('value')||'',offset=Math.max(0,Number(params.get('offset'))||0);
 if(!['direction','region'].includes(by)||!value)throw new AnalyticsError('Unbekannte Liste.',400);
 const {page}=await kitaFilters(db,catalog,params);
 const cards=`(SELECT id,region_id,date,title,status FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind='kita_fee') AND ${page.where} AND date<>'')`;
 const from=`FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind='kita_fee' WHERE ${by==='direction'?'x.value=?':'c.region_id=?'}`;
 const byId=new Map(catalog.map(r=>[r.id,r])),name=id=>byId.get(id)?.name||id;
 const [{results:rows},count]=await Promise.all([
  db.prepare(`SELECT c.id id,c.region_id region,c.date date,c.title title,c.status status,x.value direction,x.detail euro ${from} ORDER BY c.date DESC LIMIT ? OFFSET ?`).bind(...page.args,value,LIST_SIZE,offset).all(),
  db.prepare(`SELECT count(*) n ${from}`).bind(...page.args,value).first(),
 ]);
 return {by,value,offset,size:LIST_SIZE,total:Number(count?.n||0),items:rows.map(r=>({id:r.id,title:r.title,region:name(r.region),date:r.date,status:r.status,times:1,signal:r.direction,topics:[]}))};
}

/* Karte (map=1): Anteil der Vorgänge zu Kita-Elternbeiträgen (oder einer Richtung) am Ratsgeschehen, wie in den Themenradaren */
export async function kitaMap(db,catalog,params){
 const topic=params.get('topic')||'',level=params.get('level')==='district'?'district':'city';
 if(topic&&!DIRECTIONS.includes(topic))throw new AnalyticsError('Unbekannte Richtung.',400);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 const q=(params.get('q')||'').trim();let term=null;
 if(q){
  const w=windowOf(),p=new URLSearchParams({q,from:w.from,to:w.to,level,noformal:'1',...(params.get('exact')==='1'?{exact:'1'}:{})});
  const {page}=await searchFilters(db,catalog,parseDecisions(p));
  term={key:q.toLowerCase()+(params.get('exact')==='1'?'|exact':''),where:page.where,args:page.args};
 }
 return radarMap(db,catalog,'kita_fee',{topic,level,term});
}
