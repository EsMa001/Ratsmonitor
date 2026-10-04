// Gemeinsamer Gebietskatalog aller Bundesländer. Die Länder bleiben in eigenen Dateien
// (scripts/build-nrw.py, scripts/build-nds.mjs, scripts/build-de.mjs); alle Programme lesen die Gebiete nur über dieses Modul.
// Außerhalb von NRW stehen die Gebiete auf Verwaltungsebene: Gemeindeverbände (Samtgemeinde, Amt, Verbandsgemeinde,
// Verwaltungsgemeinschaft) sind Gebiete der Gemeindeebene mit 9-stelligem Regionalschlüssel in ags und ihren
// Mitgliedsgemeinden in members.
import nrw from './nrw-regions.json' with {type:'json'};
import nds from './nds-regions.json' with {type:'json'};
import de from './de-regions.json' with {type:'json'};
import nrwPopulation from './nrw-population.json' with {type:'json'};
import ndsPopulation from './nds-population.json' with {type:'json'};
import dePopulation from './de-population.json' with {type:'json'};

export {LANDS,ALL_LANDS,landName} from './lands.mjs';
/**
 * Die 14 übrigen Länder stehen als kompakte Zeilen in de-regions.json, weil der Katalog auch im Browser-Paket der
 * öffentlichen Seiten liegt: Kreise [Schlüssel, Art, Name], Gebiete der Gemeindeebene [Schlüssel, Art, Name, Mitglieder],
 * Mitglieder [letzte drei Stellen des Gemeindeschlüssels, Name]. Kennung ist „de-“ plus Schlüssel.
 */
export function expandRegions({types,districts,areas}){
 const kreise=new Set(districts.map(d=>d[0]));
 return [
  ...districts.map(([ags,type,gen])=>({id:'de-'+ags,name:(types[type]+' '+gen).trim(),shortName:gen,kind:'district',district:'de-'+ags,ags})),
  ...areas.map(([ags,type,gen,members])=>{
   const district=kreise.has(ags.slice(0,5))?'de-'+ags.slice(0,5):null;
   return {id:'de-'+ags,name:types[type]+' '+gen,shortName:gen,kind:'city',district,ags,municipalityType:types[type],independent:district===null,...(members?{members:members.map(([key,name])=>({ags:ags.slice(0,5)+key,name}))}:{})};
  }),
 ];
}
export const CATALOG=[...nrw,...nds,...expandRegions(de)];
export const POPULATION={...nrwPopulation,...ndsPopulation,...dePopulation};
export const landOf=region=>region.ags.slice(0,2);
