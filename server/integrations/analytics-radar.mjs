import {RADARS} from '../../shared/radars.mjs';
import {searchFilters} from './monitor-search.mjs';
import {parseDecisions} from './analytics-decisions.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {factsReady} from './analytics-factions.mjs';
import {radarExtra} from './analytics-radar-extra.mjs';
import {placeNorms,shareRanking,windowOf} from './analytics-radar-norms.mjs';

/*
 * Plenara.X – Themenradare (Versorgung, Verkehr, Vereine und Soziales, Vergabe, Klima und Energie, Haushalt und Steuern, Beteiligung):
 * eine Auswertung für alle, beschrieben in shared/radars.mjs. Grundlage: topic_facts (kind 'radar:<id>', value Unterthema,
 * detail Signal) zu den Einträgen der Suche (dieselben Filter). Je Unterthema: Vorgänge, Gebiete und was aus ihnen wird
 * (Beschlussquote wie in „Beschlüsse“: Anteil beschlossen an beschlossen, vertagt, abgelehnt); dazu Signale, Verlauf je Monat,
 * Gebiete je 10.000 Einwohner (gleiche Titel je Gebiet einmal) und die jüngsten Vorgänge.
 */
const DECIDED=['approved','rejected','postponed'],MIN_TOPICS=5,TOP=20,RECENT=40;
const share=(a,b)=>b?Math.round((a/b)*1000)/10:null;
// Derselbe Titel in mehreren Gremien eines Gebiets (Ausschuss, Rat, Ortschaftsräte) ist für den Vergleich ein Vorgang
const titleKey=t=>String(t||'').toLowerCase().replace(/[^a-z0-9äöüß]+/g,' ').trim();

/* Filter wie die Suche; mit Ort nur dessen eigener Rat (ohne Kreis bzw. ohne Gemeinden des Kreises): Ein Kreisjugendamt
   ist nicht die Jugendarbeit der Gemeinde, und der Vergleich zählt nur den eigenen Rat */
async function radarFilters(db,catalog,params){
 const copy=new URLSearchParams(params);for(const k of ['radar','by','value','offset'])copy.delete(k);
 if(copy.get('area'))copy.set('scope','only');
 const f=parseDecisions(copy);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 const {page,scopedIds,places}=await searchFilters(db,catalog,f);
 return {f,page,scopedIds,places};
}

export async function radar(db,catalog,params){
 const id=params.get('radar')||'';
 const def=RADARS[id];
 if(!def)throw new AnalyticsError('Unbekanntes Radar.',404);
 const {f,page,scopedIds,places}=await radarFilters(db,catalog,params);
 const kind='radar:'+id;
 const cards=`(SELECT id,region_id,date,title,status FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind=?) AND ${page.where} AND date<>'')`;
 const {results:rows}=await db.prepare(`SELECT c.id id,c.region_id region,c.date date,c.title title,c.status status,x.value topic,x.detail signal FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind=?`).bind(kind,...page.args,kind).all();
 const byId=new Map(catalog.map(r=>[r.id,r])),name=r=>byId.get(r)?.name||r;
 const blank=()=>({n:0,approved:0,rejected:0,postponed:0,open:0,regions:new Set(),signals:new Map()});
 const topics=new Map([...def.topics.map(([n])=>n),...(def.fallback?[def.fallback]:[])].map(n=>[n,blank()])),signals=new Map(),months=new Map(),items=new Map();
 /* Ein Vorgang je Gebiet und Titel: derselbe Titel in Ausschuss, Rat und Ortschaftsräten zählt einmal, mit seiner jüngsten
    Sitzung (Status, Monat). So passen Themenzahlen, Listen und der Vergleich zusammen. */
 rows.sort((a,b)=>b.date.localeCompare(a.date));
 const seen=new Set();
 for(const r of rows){
  const key=r.region+'|'+titleKey(r.title);
  if(!items.has(key))items.set(key,{...r,topics:[]});
  const it=items.get(key);
  if(seen.has(key+'|'+r.topic))continue;seen.add(key+'|'+r.topic);
  it.topics.push(r.topic);
  const t=topics.get(r.topic)||blank();topics.set(r.topic,t);
  t.n++;t.regions.add(r.region);t.signals.set(it.signal,(t.signals.get(it.signal)||0)+1);
  if(DECIDED.includes(it.status))t[it.status]++;else if(['announced','consulting','recommended'].includes(it.status))t.open++;
  const m=it.date.slice(0,7);if(!months.has(m))months.set(m,new Map());months.get(m).set(r.topic,(months.get(m).get(r.topic)||0)+1);
 }
 for(const it of items.values())signals.set(it.signal,(signals.get(it.signal)||0)+1);
 const list=[...items.values()];
 const extra=await radarExtra(db,id,page,name,r=>byId.get(r)?.ags?.slice(0,2)||'');
 /* Genau ein Gebiet gewählt: Einordnung gegenüber vergleichbaren Gebieten */
 const one=places.length===1&&scopedIds.size===1?[...scopedIds][0]:null;
 const norms=one?await placeNorms(db,catalog,one,kind,[...topics.keys()]):null;
 /* Rangliste: Anteil des Radars an allen Sachvorgängen des Rats (letzte 12 Monate), nicht Vorgänge je Einwohner: Verbände mit
    vielen Ortsgemeinderäten hätten sonst immer vorn gelegen (Bewertung 11.10.2026) */
 const ranking=one?[]:await shareRanking(db,catalog,kind,{level:f.level==='district'?'district':'city',top:TOP});
 const regionsOf=new Map();for(const i of list){const g=regionsOf.get(i.region)||new Map();for(const t of i.topics)g.set(t,(g.get(t)||0)+1);regionsOf.set(i.region,g);}
 const decided=list.filter(i=>DECIDED.includes(i.status)),approved=decided.filter(i=>i.status==='approved').length;
 return {
  q:f.q,radar:id,name:def.name,
  totals:{topics:list.length,regions:regionsOf.size,decided:decided.length,rate:share(approved,decided.length)},
  topics:[...topics].map(([n,t])=>{const d=t.approved+t.rejected+t.postponed;return {name:n,n:t.n,regions:t.regions.size,decided:d,approved:t.approved,rejected:t.rejected,postponed:t.postponed,open:t.open,rate:share(t.approved,d),
   signals:[...t.signals].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([s,k])=>({name:s,n:k}))};}),
  signals:[...signals].map(([s,n])=>({name:s,n})).sort((a,b)=>b.n-a.n),
  months:[...months].sort((a,b)=>a[0].localeCompare(b[0])).map(([m,c])=>({m,total:[...c.values()].reduce((a,b)=>a+b,0),byTopic:Object.fromEntries(c)})),
  regions:ranking.map(r=>({...r,topics:[...(regionsOf.get(r.id)||new Map())].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n])=>n)})),
  recent:list.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,RECENT).map(i=>({id:i.id,title:i.title,region:name(i.region),date:i.date,status:i.status,signal:i.signal,topics:i.topics})),
  rule:{minTopics:MIN_TOPICS,window:windowOf()},
  extra,norms,place:one?name(one):null,
 };
}

/* Liste der Vorgänge hinter einer Zahl: Thema (by=topic), Signal (signal), Monat (month), Gebiet (region, gleiche Titel einmal),
   Zweck eines Zuschusses (purpose, kind 'grant'). Dieselben Filter wie das Radar; je Abruf LIST_SIZE Einträge ab offset. */
const LIST_SIZE=50;
export async function radarList(db,catalog,params){
 const id=params.get('radar')||'';
 if(!RADARS[id])throw new AnalyticsError('Unbekanntes Radar.',404);
 const by=params.get('by')||'',value=params.get('value')||'',offset=Math.max(0,Number(params.get('offset'))||0);
 if(!['topic','signal','month','region','purpose'].includes(by)||!value)throw new AnalyticsError('Unbekannte Liste.',400);
 const {page}=await radarFilters(db,catalog,params);
 const kind=by==='purpose'?'grant':'radar:'+id;
 const cond={topic:'x.value=?',signal:'x.detail=?',month:'substr(c.date,1,7)=?',region:'c.region_id=?',purpose:'x.value=?'}[by];
 const cards=`(SELECT id,region_id,date,title,status FROM search_cards WHERE id IN (SELECT topic_id FROM topic_facts WHERE kind=?) AND ${page.where} AND date<>'')`;
 const from=`FROM ${cards} c JOIN topic_facts x ON x.topic_id=c.id AND x.kind=? WHERE ${cond}`,args=[kind,...page.args,kind,value];
 const byId=new Map(catalog.map(r=>[r.id,r])),name=r=>byId.get(r)?.name||r;
 // Gleiche Titel (mehrere Gremien) je Gebiet einmal, wie in den Zahlen der Seite
 const group="c.region_id||'|'||lower(c.title)";
 const [{results:rows},count]=await Promise.all([
  db.prepare(`SELECT c.id id,c.region_id region,max(c.date) date,c.title title,c.status status,group_concat(x.value,'|') topics,max(x.detail) detail,count(DISTINCT c.id) times ${from} GROUP BY ${group} ORDER BY date DESC LIMIT ? OFFSET ?`).bind(...args,LIST_SIZE,offset).all(),
  db.prepare(`SELECT count(DISTINCT ${group}) n ${from}`).bind(...args).first(),
 ]);
 return {by,value,offset,size:LIST_SIZE,total:Number(count?.n||0),
  items:rows.map(r=>({id:r.id,title:r.title,region:name(r.region),date:r.date,status:r.status,times:r.times,
   ...(by==='purpose'?{euro:Number(r.detail)||0}:{signal:r.detail,topics:[...new Set(String(r.topics||'').split('|'))]})}))};
}
