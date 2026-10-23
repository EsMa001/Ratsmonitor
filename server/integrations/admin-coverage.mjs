// Abdeckung für die Übersicht der Administration: wie viele Gebiete und Einwohner angebunden sind und Berichte haben,
// heute und im Verlauf, dazu Analysen des Bestands. Angebunden = Katalogeintrag mit Quelle (Verlauf aus
// coverage-history.json, Stand je Commit des Katalogs; scripts/coverage-history.mjs). Mit Berichten = gespeicherte
// Vorgänge je Gebiet, nach dem Tag ihrer ersten Speicherung (admin-timeline.mjs, Zeitbezug "import"; vorher
// gespeicherte Berichte ohne Datum zählen ab dem ersten Tag). Reichweite und Aktualität je Gebiet nach erstem
// Tagesordnungstag und jüngstem Sitzungstag der Berichte (area-figures.mjs), Berichte je Sitzungsmonat aus dem
// Verlaufsdatensatz mit Zeitbezug "event". Nur lesend; die Verlaufsdatensätze bleiben bis zur nächsten Änderung des
// Bestands gehalten (revision-cache.mjs). Aktiv = Abruf in den letzten 7 Tagen gelungen (activeCoverage, import_runs).
import history from './coverage-history.json' with {type:'json'};
import {CATALOG,POPULATION,landOf} from '../../shared/catalog.mjs';
import {ALL_LANDS} from '../../shared/lands.mjs';
import {VG_GROUPS} from '../../shared/vg-groups.mjs';
import {NRW_SOURCES} from './source-catalog.mjs';
import {SOURCES} from './regions.mjs';
import {coverageOf,dataCoverageSeries,tally,reachBucket,freshBucket,sizeClassOf,monthlyReports,REACH_BUCKETS,FRESH_BUCKETS,SIZE_CLASSES} from '../../shared/coverage.mjs';
import {adminTimeline} from './admin-timeline.mjs';
import {areaFigures} from './area-figures.mjs';
// The first seven sources stand in regions.mjs, every other one in the catalog files.
const CORE=['muenster','billerbeck','coesfeld','steinfurt','borken','warendorf','recklinghausen'];
/** Länge des Fensters der realen Abdeckung in Tagen und wie weit die Reihe zurückreicht (import_runs bleiben 30 Tage). */
export const ACTIVE_DAYS=7,ACTIVE_SPAN=30;
/**
 * Reale Abdeckung: Gebiete, deren Abruf in den letzten ACTIVE_DAYS Tagen mindestens einmal gelungen ist (Lauf „metadata“ mit
 * Status completed oder partial in import_runs, mindestens eine Anfrage beantwortet; ein Abruf ohne neue Sitzung zählt mit, ein
 * gescheiterter nicht, auch keiner, dessen Anfragen alle abgelehnt wurden: so laufen gesperrte Server als „partial“ mit 403). Heute und
 * als Tagesreihe, je Tag das Fenster bis zu seinem Ende, erst ab dem ersten Tag mit vollem Fenster. Nur lesend.
 * @param {any} db @param {Date} now
 */
export async function activeCoverage(db,now){
 const DAY=864e5,today=now.toISOString().slice(0,10),since=new Date(now.getTime()-(ACTIVE_SPAN+ACTIVE_DAYS)*DAY).toISOString();
 const rows=(await db.prepare("SELECT json_extract(details,'$.region') region,substr(started_at,1,10) day FROM import_runs WHERE started_at>=? AND status IN ('completed','partial') AND json_extract(details,'$.mode')='metadata' AND NOT (coalesce(json_extract(details,'$.debug.requests'),0)>0 AND json_extract(details,'$.debug.failed')>=json_extract(details,'$.debug.requests')) GROUP BY 1,2").bind(since).all()).results||[];
 const byDay=new Map();for(const r of rows){if(!r.region)continue;let set=byDay.get(r.day);if(!set)byDay.set(r.day,set=new Set());set.add(r.region);}
 const shift=(day,k)=>new Date(Date.parse(day+'T12:00:00Z')+k*DAY).toISOString().slice(0,10);
 const windowOf=end=>{const ids=new Set();for(let k=0;k<ACTIVE_DAYS;k++)for(const id of byDay.get(shift(end,-k))||[])ids.add(id);return ids;};
 const first=[...byDay.keys()].sort()[0];
 const series=[];
 if(first)for(let k=ACTIVE_SPAN-1;k>=0;k--){const day=shift(today,-k);if(day<shift(first,ACTIVE_DAYS-1))continue;const c=coverageOf(CATALOG,POPULATION,windowOf(day),landOf);series.push({day,areas:c.areas,population:c.population});}
 const now7=coverageOf(CATALOG,POPULATION,windowOf(today),landOf);
 return {days:ACTIVE_DAYS,areas:now7.areas,population:now7.population,since:first||null,series};
}
/** Areas with a connected source today, by id. */
export const connectedIds=()=>new Set([...CORE,...SOURCES.map(s=>s.id),...NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>s.id)]);
export async function adminCoverage(db,{now=new Date()}={}){
 const all=new Set(CATALOG.map(r=>r.id)),connectedSet=connectedIds(),today=now.toISOString().slice(0,10);
 const total=coverageOf(CATALOG,POPULATION,all,landOf),connected=coverageOf(CATALOG,POPULATION,connectedSet,landOf);
 // Einwohner erreicht inklusive VG: ein Ort gilt zusätzlich als erreicht, wenn ein von Hand geprüftes anderes
 // Gebiet derselben Samtgemeinde/Verbandsgemeinde/Amt/Verwaltungsgemeinschaft angebunden ist (shared/vg-groups.mjs).
 const vgOf=new Map();for(const g of VG_GROUPS)for(const id of g)vgOf.set(id,g);
 const vgReached=id=>connectedSet.has(id)||(vgOf.get(id)||[]).some(x=>connectedSet.has(x));
 const withVg=coverageOf(CATALOG,POPULATION,new Set(CATALOG.filter(r=>r.kind==='city'&&vgReached(r.id)).map(r=>r.id)),landOf);
 // Einwohner erreicht inklusive Kreise: ein Ort gilt als erreicht, wenn er selbst (oder über die VG-Gruppe) oder
 // sein Landkreis angebunden ist.
 const withDistricts=coverageOf(CATALOG,POPULATION,new Set(CATALOG.filter(r=>r.kind==='city'&&(vgReached(r.id)||(r.district&&connectedSet.has(r.district)))).map(r=>r.id)),landOf);
 const [dataset,events,figures,active]=await Promise.all([adminTimeline(db,{basis:'import',now}),adminTimeline(db,{basis:'event',now}),areaFigures(db,{now}),activeCoverage(db,now)]);
 const withData=new Set([...Object.keys(dataset.areas||{}),...Object.keys(dataset.undated||{})].filter(id=>all.has(id)));
 const data=coverageOf(CATALOG,POPULATION,withData,landOf);
 // Reach and freshness over the connected areas: "none" are connected areas without reports.
 const pool=CATALOG.filter(r=>connectedSet.has(r.id)),figure=r=>figures.rows.get(r.id);
 const reach=tally(pool,POPULATION,r=>reachBucket(figure(r)?.first,today)),fresh=tally(pool,POPULATION,r=>freshBucket(figure(r)?.last,today));
 const sizeOf=r=>sizeClassOf(r,POPULATION);
 const sizes={total:tally(CATALOG,POPULATION,sizeOf),connected:tally(pool,POPULATION,sizeOf),data:tally(CATALOG.filter(r=>withData.has(r.id)),POPULATION,sizeOf)};
 return {
  asOf:now.toISOString(),
  lands:Object.fromEntries(ALL_LANDS.map(l=>[l.id,{name:l.name,short:l.short}])),
  total,connected,withVg,withDistricts,active,
  data:{...data,series:dataCoverageSeries(dataset,CATALOG,POPULATION),reports:dataset.total,undatedAreas:Object.keys(dataset.undated||{}).filter(id=>all.has(id)&&!dataset.areas?.[id]?.length).length},
  history:{builtAt:history.builtAt,points:history.points.map(p=>({at:p.at,commit:p.commit,areas:p.areas,population:p.population}))},
  analysis:{
   statsPending:figures.pending,
   reach:{buckets:REACH_BUCKETS.map(b=>({id:b.id,label:b.label,color:b.color,areas:reach[b.id]?.[0]||0,population:reach[b.id]?.[1]||0}))},
   fresh:{buckets:FRESH_BUCKETS.map(b=>({id:b.id,label:b.label,color:b.color,areas:fresh[b.id]?.[0]||0,population:fresh[b.id]?.[1]||0}))},
   sizes:SIZE_CLASSES.map(c=>({id:c.id,label:c.label,total:sizes.total[c.id]||[0,0],connected:sizes.connected[c.id]||[0,0],data:sizes.data[c.id]||[0,0]})),
   ...monthlyReports(events,all),
  },
 };
}
