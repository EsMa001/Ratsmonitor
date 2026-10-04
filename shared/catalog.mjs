// Gemeinsamer Gebietskatalog aller angebundenen Bundesländer. Die Länder bleiben in eigenen Dateien
// (scripts/build-nrw.py, scripts/build-nds.mjs); alle Programme lesen die Gebiete nur über dieses Modul.
// Niedersachsen wird auf Verwaltungsebene geführt: Samtgemeinden sind Gebiete der Gemeindeebene mit
// 9-stelligem Regionalschlüssel in ags und ihren Mitgliedsgemeinden in members.
import nrw from './nrw-regions.json' with {type:'json'};
import nds from './nds-regions.json' with {type:'json'};
import nrwPopulation from './nrw-population.json' with {type:'json'};
import ndsPopulation from './nds-population.json' with {type:'json'};

export {LANDS,landName} from './lands.mjs';
export const CATALOG=[...nrw,...nds];
export const POPULATION={...nrwPopulation,...ndsPopulation};
export const landOf=region=>region.ags.slice(0,2);
