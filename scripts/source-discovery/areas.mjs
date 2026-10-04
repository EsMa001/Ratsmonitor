// Area list of a run of the source search.
// - AREAS names a file with areas (e.g. the random sample of the estimate, or shared/nds-regions.json).
// - Otherwise LAND selects areas of the catalog: a state key ("09"), several ("01,13"), or "de" for the 14 states
//   of shared/de-regions.json. Without both: NRW.
import fs from 'node:fs';
import {CATALOG} from '../../shared/catalog.mjs';
/** State keys of the run, e.g. for one Wikidata query per state. */
export function lands(){
 const value=process.env.LAND||'05';
 return value==='de'?[...new Set(CATALOG.filter(r=>r.id.startsWith('de-')).map(r=>r.ags.slice(0,2)))].sort():value.split(',').map(s=>s.trim()).filter(Boolean);
}
export function loadAreas(){
 if(process.env.AREAS)return JSON.parse(fs.readFileSync(process.env.AREAS,'utf8'));
 const wanted=new Set(lands());
 return CATALOG.filter(r=>wanted.has(r.ags.slice(0,2)));
}
