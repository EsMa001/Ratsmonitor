import {ALL_LANDS} from '../../shared/lands.mjs';
import {parseMonitorSearch,searchFilters} from './monitor-search.mjs';

/*
 * Plenara.X – Diffusionsanalyse: Wie breitet sich ein Thema über die Gebiete aus?
 * Grundlage ist allein die Datenbank (search_cards), nichts ist vorberechnet: Je Gebiet zählt das Datum der ersten Karte,
 * die den Begriff enthält. Änderungen am Datenbestand wirken so bei der nächsten Abfrage.
 */
export class AnalyticsError extends Error { constructor(message,status=400){super(message);this.status=status;} }
/* Ohne Angabe zählt nur bis heute: angesetzte Sitzungen in der Zukunft sind noch keine Ausbreitung */

/** Gleiche Filter wie die Suche (q, area, scope, more, within, without, label, status, from, to, month, noformal, exact);
 *  ohne Angabe `to` zählt nur bis heute (mit leerem `to` auch Künftiges) */
export function parseDiffusion(params){
 const copy=new URLSearchParams(params);
 if(!copy.has('to'))copy.set('to',new Date().toISOString().slice(0,10));
 let f;
 try{f=parseMonitorSearch(copy);}catch(e){throw new AnalyticsError(e.message,e.status||400);}
 if(!f.groups.length)throw new AnalyticsError('Bitte einen Begriff eingeben.');
 if(f.groups.flat().some(w=>w.length<3))throw new AnalyticsError('Jedes Suchwort braucht mindestens 3 Buchstaben.');
 return f;
}

const quantile=(sorted,p)=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(p*sorted.length))]:null;

/**
 * @returns Gemeinde-Schlüssel (8 Stellen) mit erster und letzter Erwähnung und Kartenzahl, Verlauf je Monat, Länder und Kennzahlen
 */
export async function diffusion(db,catalog,params){
 const f=parseDiffusion(params);
 const byId=new Map(catalog.filter(r=>r.kind==='city').map(r=>[r.id,r]));
 /* Filter und Begriff wie in der Suche: dieselben Karten, danach je Gebiet das früheste Datum */
 const {page}=await searchFilters(db,catalog,f);
 const {results}=await db.prepare('SELECT region_id,min(date) first,max(date) last,count(*) n FROM search_cards WHERE '+page.where+" AND date<>'' GROUP BY region_id").bind(...page.args).all();
 /* Nur Gebiete der Gemeindeebene; eine Samtgemeinde steht bei jeder Mitgliedsgemeinde */
 const regions=[];
 for(const r of results){
  const region=byId.get(r.region_id);if(!region)continue;
  const first=r.first.slice(0,10),last=r.last.slice(0,10);
  for(const m of region.members?.length?region.members:[{ags:region.ags,name:region.name}])regions.push({ags:m.ags,name:region.members?.length?`${m.name} (${region.name})`:m.name,first,last,n:r.n});
 }
 /* Gleiches Datum: mehr Einträge zuerst (häufige Beschäftigung mit dem Thema), dann nach Schlüssel */
 regions.sort((a,b)=>a.first.localeCompare(b.first)||b.n-a.n||a.ags.localeCompare(b.ags));
 /* Verlauf: neu erreichte Gebiete je Monat und die Summe */
 const perMonth=new Map();
 for(const r of regions){const m=r.first.slice(0,7);perMonth.set(m,(perMonth.get(m)||0)+1);}
 let sum=0;const series=[...perMonth].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,added])=>({month,added,total:sum+=added}));
 /* Länder: erreichte Gebiete und frühestes Datum */
 const lands=new Map();
 for(const r of regions){const id=r.ags.slice(0,2),l=lands.get(id)||{id,name:ALL_LANDS.find(x=>x.id===id)?.name||id,regions:0,first:r.first};l.regions++;lands.set(id,l);}
 const dates=regions.map(r=>r.first);
 return {
  q:f.q,from:f.from,to:f.to,
  regions,series,
  lands:[...lands.values()].sort((a,b)=>a.first.localeCompare(b.first)||b.regions-a.regions),
  stats:{regions:regions.length,cards:results.reduce((s,r)=>s+r.n,0),first:dates[0]||null,last:dates.at(-1)||null,p10:quantile(dates,.1),median:quantile(dates,.5),p90:quantile(dates,.9)},
 };
}
