// Abdeckung für die Übersicht der Administration: wie viele Gebiete und Einwohner angebunden sind und Berichte haben,
// heute und im Verlauf, dazu Analysen des Bestands. Angebunden = Katalogeintrag mit Quelle (Verlauf aus
// coverage-history.json, Stand je Commit des Katalogs; scripts/coverage-history.mjs). Mit Berichten = gespeicherte
// Vorgänge je Gebiet, nach dem Tag ihrer ersten Speicherung (admin-timeline.mjs, Zeitbezug "import"; vorher
// gespeicherte Berichte ohne Datum zählen ab dem ersten Tag). Reichweite und Aktualität je Gebiet nach erstem
// Tagesordnungstag und jüngstem Sitzungstag der Berichte (area-figures.mjs), Berichte je Sitzungsmonat aus dem
// Verlaufsdatensatz mit Zeitbezug "event". Nur lesend; die Verlaufsdatensätze bleiben bis zur nächsten Änderung des
// Bestands gehalten (revision-cache.mjs).
import history from './coverage-history.json' with {type:'json'};
import {CATALOG,POPULATION,landOf} from '../../shared/catalog.mjs';
import {ALL_LANDS} from '../../shared/lands.mjs';
import {NRW_SOURCES} from './source-catalog.mjs';
import {SOURCES} from './regions.mjs';
import {coverageOf,dataCoverageSeries,tally,reachBucket,freshBucket,sizeClassOf,monthlyReports,REACH_BUCKETS,FRESH_BUCKETS,SIZE_CLASSES} from '../../shared/coverage.mjs';
import {adminTimeline} from './admin-timeline.mjs';
import {areaFigures} from './area-figures.mjs';
// The first seven sources stand in regions.mjs, every other one in the catalog files.
const CORE=['muenster','billerbeck','coesfeld','steinfurt','borken','warendorf','recklinghausen'];
/** Areas with a connected source today, by id. */
export const connectedIds=()=>new Set([...CORE,...SOURCES.map(s=>s.id),...NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>s.id)]);
export async function adminCoverage(db,{now=new Date()}={}){
 const all=new Set(CATALOG.map(r=>r.id)),connectedSet=connectedIds(),today=now.toISOString().slice(0,10);
 const total=coverageOf(CATALOG,POPULATION,all,landOf),connected=coverageOf(CATALOG,POPULATION,connectedSet,landOf);
 // Einwohner erreicht inklusive Kreise: ein Ort gilt als erreicht, wenn er selbst oder sein Landkreis angebunden ist.
 const withDistricts=coverageOf(CATALOG,POPULATION,new Set(CATALOG.filter(r=>r.kind==='city'&&(connectedSet.has(r.id)||(r.district&&connectedSet.has(r.district)))).map(r=>r.id)),landOf);
 const [dataset,events,figures]=await Promise.all([adminTimeline(db,{basis:'import',now}),adminTimeline(db,{basis:'event',now}),areaFigures(db,{now})]);
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
  total,connected,withDistricts,
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
