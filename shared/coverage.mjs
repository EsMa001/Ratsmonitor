// Abdeckung: angebundene Gebiete und Einwohner, gesamt und je Land. Gemeinsam für das Verlaufsskript
// (scripts/coverage-history.mjs), die Administration (server/integrations/admin-coverage.mjs) und die Tests.
/**
 * Zählt die Gebiete einer Menge gegen den Katalog. Einwohner zählen nur auf der Gemeindeebene (kind "city"): ein Kreis
 * umfasst seine Gemeinden und würde sie doppelt zählen.
 * @param {{id:string,kind:string,ags?:string}[]} catalog
 * @param {Record<string,number>} population
 * @param {Set<string>} ids
 * @param {(region:{ags?:string})=>string} landOf
 * @returns {{areas:number,population:number,lands:Record<string,[number,number]>}} je Land: [Gebiete, Einwohner]
 */
export function coverageOf(catalog,population,ids,landOf){
 let areas=0,people=0;const lands={};
 for(const r of catalog){
  if(!ids.has(r.id))continue;
  const land=landOf(r),row=lands[land]||(lands[land]=[0,0]);
  areas++;row[0]++;
  if(r.kind==='city'){const p=population[r.id]||0;people+=p;row[1]+=p;}
 }
 return {areas,population:people,lands};
}
/**
 * Gebiete und Einwohner mit gespeicherten Berichten je Tag, aus dem Verlaufsdatensatz der Administration
 * (admin-timeline.mjs, Zeitbezug "import": Tag der ersten Speicherung). Ein Gebiet zählt ab dem ersten Tag mit einem
 * Bericht; Gebiete, deren Berichte nur ohne Datum vorliegen (vor Beginn der Erfassung gespeichert), zählen ab dem
 * ersten Tag der Reihe. Rückgabe: Tage mit dem Stand am Ende des Tages, nur Tage mit Veränderung.
 * @param {{days:string[],areas:Record<string,[number,number][]>,undated?:Record<string,number>}} dataset
 * @param {{id:string,kind:string}[]} catalog
 * @param {Record<string,number>} population
 * @returns {{day:string,areas:number,population:number}[]}
 */
export function dataCoverageSeries(dataset,catalog,population){
 const kind=new Map(catalog.map(r=>[r.id,r.kind]));
 const firstDay=new Map();
 for(const [id,pairs] of Object.entries(dataset.areas||{})){if(!kind.has(id))continue;const first=pairs.map(p=>dataset.days[p[0]]).filter(Boolean).sort()[0];if(first)firstDay.set(id,first);}
 const earliest=dataset.days.length?[...dataset.days].sort()[0]:null;
 for(const id of Object.keys(dataset.undated||{}))if(kind.has(id)&&!firstDay.has(id)&&earliest)firstDay.set(id,earliest);
 const byDay=new Map();
 for(const [id,day] of firstDay){const row=byDay.get(day)||{areas:0,population:0};row.areas++;if(kind.get(id)==='city')row.population+=population[id]||0;byDay.set(day,row);}
 let areas=0,people=0;const out=[];
 for(const day of [...byDay.keys()].sort()){const row=byDay.get(day);areas+=row.areas;people+=row.population;out.push({day,areas,population:people});}
 return out;
}
