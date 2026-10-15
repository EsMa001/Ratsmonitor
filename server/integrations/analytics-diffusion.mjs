import {ALL_LANDS} from '../../shared/lands.mjs';
import {parseMonitorSearch} from './monitor-search.mjs';
import {atRevision} from './revision-cache.mjs';
import {where} from './member-place.mjs';
import {listPage,offsetOf} from './analytics-lists.mjs';
import {source,xState,FIRST_DATE} from './plenara-x-query.mjs';

/*
 * Plenara.X – Ausbreitung: Wie breitet sich ein Thema über die Gebiete aus?
 * Wie überall in plenara.X: Auswahl über die Suche (source), gezählt werden Vorgänge (x_cases, ohne Formalien, gleiche Titel je
 * Gebiet einmal). Je Gebiet zählt die erste Sitzung des frühesten Vorgangs mit dem Begriff (FIRST_DATE).
 * Gemeindeverbände (Amt, Samtgemeinde, Verbandsgemeinde): Ein Bericht gehört zu der Mitgliedsgemeinde, deren Rat berät oder die
 * der Titel nennt (where() wie in den Radaren); sonst zählt der Verband als ein Gebiet (auf der Karte bei allen Mitgliedern).
 * Je Gebiet steht dabei, wann sein Bestand beginnt: Ein Thema, das in den ersten 14 Tagen des Bestands schon da ist, war
 * „von Anfang an“ dabei; als Vorreiter gilt das nicht.
 */
export class AnalyticsError extends Error { constructor(message,status=400){super(message);this.status=status;} }
/* Ohne Angabe zählt nur bis heute: angesetzte Sitzungen in der Zukunft sind noch keine Ausbreitung */

/** Gleiche Filter wie die Suche (q, area, scope, more, within, without, label, status, from, to, month, noformal, exact);
 *  ohne Angabe `to` zählt nur bis heute (mit leerem `to` auch Künftiges) */
export function parseDiffusion(params){
 const copy=new URLSearchParams(params);for(const k of ['by','value','offset'])copy.delete(k);
 if(!copy.has('to'))copy.set('to',new Date().toISOString().slice(0,10));
 let f;
 try{f=parseMonitorSearch(copy);}catch(e){throw new AnalyticsError(e.message,e.status||400);}
 if(!f.groups.length)throw new AnalyticsError('Bitte einen Begriff eingeben.');
 if(f.groups.flat().some(w=>w.length<3))throw new AnalyticsError('Jedes Suchwort braucht mindestens 3 Buchstaben.');
 return f;
}

/* Beginn des Bestands je Gebiet (erste Sitzung), je Datenstand einmal gerechnet */
const dataStarts=db=>atRevision(db,'diffusion-starts',async()=>{
 const {results}=await db.prepare("SELECT region_id r,min(date) d FROM search_cards WHERE date<>'' GROUP BY region_id").all();
 return new Map(results.map(x=>[x.r,x.d]));
});
/** Mitgliedsgemeinde eines Verbands, die Gremium oder Titel nennen ({ags,name}), sonst null */
const memberOf=(union,title,gremium)=>{const k=where(union.name,title,gremium,union.members).key.toLowerCase();
 return k?union.members.find(x=>x.name.toLowerCase()===k)||union.members.find(x=>x.name.toLowerCase().startsWith(k+' ')||x.name.toLowerCase().startsWith(k+'-'))||null:null;};
const quantile=(sorted,p)=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(p*sorted.length))]:null;

/**
 * @returns Gemeinde-Schlüssel (8 Stellen) mit erster und letzter Erwähnung und Kartenzahl, Verlauf je Monat, Länder und Kennzahlen
 */
export async function diffusion(db,catalog,params){
 const f=parseDiffusion(params);
 const byId=new Map(catalog.filter(r=>r.kind==='city').map(r=>[r.id,r]));
 /* Auswahl wie in der Suche, gezählt je Vorgang; danach je Gebiet die früheste erste Sitzung */
 if(!(await xState(db)))throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut. Bitte später erneut versuchen.',503);
 const src=await source(db,catalog,f);
 const unions=[...byId.values()].filter(r=>r.members?.length).map(r=>r.id);
 // Verbände als ein JSON-Array (D1 erlaubt nur 100 gebundene Werte)
 const list=JSON.stringify(unions);
 const [{results},{results:cards},starts]=await Promise.all([
  db.prepare(`SELECT x.region_id,min(${FIRST_DATE}) first,max(x.date) last,count(*) n FROM ${src.from} WHERE x.region_id NOT IN (SELECT value FROM json_each(?)) GROUP BY x.region_id`).bind(...src.args,list).all(),
  db.prepare(`SELECT x.region_id,${FIRST_DATE} date,c.title,c.gremium FROM ${src.from} JOIN search_cards c ON c.id=x.card_id WHERE x.region_id IN (SELECT value FROM json_each(?))`).bind(...src.args,list).all(),
  dataStarts(db),
 ]);
 /* Nur Gebiete der Gemeindeebene */
 const regions=[],start=r=>(starts.get(r)||'').slice(0,10)||null;
 for(const r of results){
  const region=byId.get(r.region_id);if(!region)continue;
  regions.push({ags:region.ags,name:region.name,first:r.first.slice(0,10),last:r.last.slice(0,10),n:r.n,start:start(r.region_id)});
 }
 /* Verbände: je Mitgliedsgemeinde (aus Gremium oder Titel), sonst der Verband als ein Gebiet */
 const per=new Map();
 for(const c of cards){
  const region=byId.get(c.region_id);if(!region)continue;
  const m=memberOf(region,c.title,c.gremium);
  const key=m?m.ags:region.ags;
  const o=per.get(key)||{ags:key,name:m?`${m.name} (${region.name})`:region.name,first:c.date,last:c.date,n:0,start:start(c.region_id),...(m?{}:{members:region.members.map(x=>x.ags)})};
  if(c.date<o.first)o.first=c.date;if(c.date>o.last)o.last=c.date;o.n++;per.set(key,o);
 }
 for(const o of per.values())regions.push({...o,first:o.first.slice(0,10),last:o.last.slice(0,10)});
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
 /* Von Anfang an: das Thema stand schon in den ersten 14 Tagen des Bestands dieses Gebiets */
 const atStart=r=>!!r.start&&Date.parse(r.first)-Date.parse(r.start)<=14*864e5;
 for(const r of regions)r.atStart=atStart(r);
 return {
  q:f.q,from:f.from,to:f.to,
  regions,series,
  lands:[...lands.values()].sort((a,b)=>a.first.localeCompare(b.first)||b.regions-a.regions),
  stats:{regions:regions.length,cards:results.reduce((s,r)=>s+r.n,0)+cards.length,atStart:regions.filter(r=>r.atStart).length,dataStart:[...starts.values()].sort()[0]?.slice(0,10)||null,first:dates[0]||null,last:dates.at(-1)||null,p10:quantile(dates,.1),median:quantile(dates,.5),p90:quantile(dates,.9)},
 };
}

/** Liste hinter einem Gebiet der Karte: by=region&value=Schlüssel (Gemeinde oder Verband ohne erkennbare Mitgliedsgemeinde) */
export async function diffusionList(db,catalog,params){
 const ags=params.get('value')||'';
 if(params.get('by')!=='region'||!/^\d{8,9}$/.test(ags))throw new AnalyticsError('Unbekannte Liste.',400);
 const f=parseDiffusion(params);
 const cities=catalog.filter(r=>r.kind==='city');
 const own=cities.find(r=>r.ags===ags),union=own?.members?.length?own:cities.find(r=>r.members?.some(m=>m.ags===ags));
 const region=own||union;if(!region)return listPage([],catalog,0);
 const src=await source(db,catalog,f);
 const {results}=await db.prepare(`SELECT c.id,x.region_id region,c.title,c.gremium,x.date,x.status FROM ${src.from} JOIN search_cards c ON c.id=x.card_id WHERE x.region_id=? ORDER BY x.date DESC`).bind(...src.args,region.id).all();
 /* Im Verband: nur die Vorgänge dieser Mitgliedsgemeinde bzw. (Verband selbst) die ohne erkennbare Mitgliedsgemeinde */
 const member=union&&!own?union.members.find(m=>m.ags===ags):null;
 const rows=!union?results:results.filter(r=>{const m=memberOf(union,r.title,r.gremium);return member?m?.ags===member.ags:!m;});
 return listPage(rows,catalog,offsetOf(params));
}
