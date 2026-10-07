import {ALL_LANDS} from '../../shared/lands.mjs';
import {candidateCards} from './search-words.mjs';

/*
 * Plenara Analytics – Diffusionsanalyse: Wie breitet sich ein Thema über die Gebiete aus?
 * Grundlage ist allein die Datenbank (search_cards), nichts ist vorberechnet: Je Gebiet zählt das Datum der ersten Karte,
 * die den Begriff enthält. Änderungen am Datenbestand wirken so bei der nächsten Abfrage.
 */
export class AnalyticsError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replaceAll('ß','ss');
const FILLER=new Set(['und','oder','der','die','das','den','dem','des','ein','eine','einer','in','im','am','an','zu','zum','zur','von','vom','fur','mit','bei','auf','aus','nach']);
/* Ohne Angabe zählt nur bis heute: angesetzte Sitzungen in der Zukunft sind noch keine Ausbreitung */
const DATE=/^\d{4}-\d{2}-\d{2}$/;

/** Begriff wie in der Suche: Komma, Semikolon, | und „oder“ trennen Alternativen, Wörter innerhalb müssen alle vorkommen */
export function parseDiffusion(params){
 const q=(params.get('q')||'').trim(),from=params.get('from')||'',to=params.get('to')||new Date().toISOString().slice(0,10);
 if(!q)throw new AnalyticsError('Bitte einen Begriff eingeben.');
 if(q.length>200||(from&&!DATE.test(from))||(to&&!DATE.test(to)))throw new AnalyticsError('Ungültige Eingabe.');
 const groups=q.split(/[,;|]|\s+oder\s+/i).map(g=>norm(g).split(/\s+/).filter(w=>w&&!FILLER.has(w))).filter(g=>g.length).slice(0,8).map(g=>g.slice(0,12));
 if(!groups.length||groups.flat().length>12)throw new AnalyticsError('Bitte 1 bis 12 Suchwörter verwenden.');
 if(groups.flat().some(w=>w.length<3))throw new AnalyticsError('Jedes Suchwort braucht mindestens 3 Buchstaben.');
 return {q,groups,from,to};
}

const quantile=(sorted,p)=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(p*sorted.length))]:null;

/**
 * @returns Gemeinde-Schlüssel (8 Stellen) mit erster und letzter Erwähnung und Kartenzahl, Verlauf je Monat, Länder und Kennzahlen
 */
export async function diffusion(db,catalog,params){
 const f=parseDiffusion(params);
 const byId=new Map(catalog.filter(r=>r.kind==='city').map(r=>[r.id,r]));
 /* Seltene Wörter: die Wortliste nennt die Karten; sonst wird die Suchspalte gelesen (gleiche Treffer, nur langsamer) */
 const cand=await candidateCards(db,f.groups);
 const where=[],args=[];
 if(cand){where.push('id IN (SELECT value FROM json_each(?))');args.push(JSON.stringify(cand));}
 where.push('('+f.groups.map(g=>'('+g.map(()=>'instr(search,?)>0').join(' AND ')+')').join(' OR ')+')');
 args.push(...f.groups.flat());
 if(f.from){where.push('date>=?');args.push(f.from);}
 if(f.to){where.push('date<=?');args.push(f.to);}
 const {results}=await db.prepare('SELECT region_id,min(date) first,max(date) last,count(*) n FROM search_cards WHERE '+where.join(' AND ')+" AND date<>'' GROUP BY region_id").bind(...args).all();
 /* Nur Gebiete der Gemeindeebene; eine Samtgemeinde steht bei jeder Mitgliedsgemeinde */
 const regions=[];
 for(const r of results){
  const region=byId.get(r.region_id);if(!region)continue;
  const first=r.first.slice(0,10),last=r.last.slice(0,10);
  for(const m of region.members?.length?region.members:[{ags:region.ags,name:region.name}])regions.push({ags:m.ags,name:region.members?.length?`${m.name} (${region.name})`:m.name,first,last,n:r.n});
 }
 regions.sort((a,b)=>a.first.localeCompare(b.first)||a.ags.localeCompare(b.ags));
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
