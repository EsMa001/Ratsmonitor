// Abdeckung für die Übersicht der Administration: wie viele Gebiete und Einwohner angebunden sind und Berichte haben,
// heute und im Verlauf. Angebunden = Katalogeintrag mit Quelle (verlauf aus coverage-history.json, Stand je Commit des
// Katalogs; scripts/coverage-history.mjs). Mit Berichten = gespeicherte Vorgänge je Gebiet, nach dem Tag ihrer ersten
// Speicherung (admin-timeline.mjs, Zeitbezug "import"; vorher gespeicherte Berichte ohne Datum zählen ab dem ersten Tag).
// Nur lesend; der Verlaufsdatensatz bleibt bis zur nächsten Änderung des Bestands gehalten (revision-cache.mjs).
import history from './coverage-history.json' with {type:'json'};
import {CATALOG,POPULATION,landOf} from '../../shared/catalog.mjs';
import {ALL_LANDS} from '../../shared/lands.mjs';
import {NRW_SOURCES} from './source-catalog.mjs';
import {SOURCES} from './regions.mjs';
import {coverageOf,dataCoverageSeries} from '../../shared/coverage.mjs';
import {adminTimeline} from './admin-timeline.mjs';
// The first seven sources stand in regions.mjs, every other one in the catalog files.
const CORE=['muenster','billerbeck','coesfeld','steinfurt','borken','warendorf','recklinghausen'];
/** Areas with a connected source today, by id. */
export const connectedIds=()=>new Set([...CORE,...SOURCES.map(s=>s.id),...NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>s.id)]);
export async function adminCoverage(db,{now=new Date()}={}){
 const all=new Set(CATALOG.map(r=>r.id));
 const total=coverageOf(CATALOG,POPULATION,all,landOf),connected=coverageOf(CATALOG,POPULATION,connectedIds(),landOf);
 const dataset=await adminTimeline(db,{basis:'import',now});
 const withData=new Set([...Object.keys(dataset.areas||{}),...Object.keys(dataset.undated||{})].filter(id=>all.has(id)));
 const data=coverageOf(CATALOG,POPULATION,withData,landOf);
 return {
  asOf:now.toISOString(),
  lands:Object.fromEntries(ALL_LANDS.map(l=>[l.id,{name:l.name,short:l.short}])),
  total,connected,
  data:{...data,series:dataCoverageSeries(dataset,CATALOG,POPULATION),reports:dataset.total,undatedAreas:Object.keys(dataset.undated||{}).filter(id=>all.has(id)&&!dataset.areas?.[id]?.length).length},
  history:{builtAt:history.builtAt,points:history.points.map(p=>({at:p.at,commit:p.commit,areas:p.areas,population:p.population}))},
 };
}
