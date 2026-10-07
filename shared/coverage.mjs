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
// --- Zeitliche Reichweite der Berichte je Gebiet, nach Sitzungstagen (admin-data.mjs: erster Tagesordnungstag und
// jüngster Sitzungstag der gespeicherten Berichte). Stufen mit Spielraum: ein Abruf „12 Monate rückwirkend“ liefert
// den ersten Tag knapp unter zwölf Monaten, ein Monat hat 28 bis 31 Tage. Gemeinsam für Server und Oberfläche.
const DAY=86400000;
const daysBetween=(from,to)=>Math.floor((Date.parse(String(to).slice(0,10))-Date.parse(String(from).slice(0,10)))/DAY);
/**
 * Wie weit die Berichte zurückreichen: Stufen nach dem ersten Sitzungstag, längste zuerst; „none“ ohne Berichte.
 * Eine Farbreihe, dunkel = weit zurück; Gelb bleibt „angebunden, ohne Berichte“ der Karten vorbehalten.
 */
export const REACH_BUCKETS=Object.freeze([
 Object.freeze({id:'y2',label:'2 Jahre und mehr',minDays:700,color:'#0b3d3a'}),
 Object.freeze({id:'y1',label:'1 bis 2 Jahre',minDays:330,color:'#0f766e'}),
 Object.freeze({id:'m6',label:'6 bis 12 Monate',minDays:165,color:'#14a394'}),
 Object.freeze({id:'m3',label:'3 bis 6 Monate',minDays:80,color:'#5fd3c4'}),
 Object.freeze({id:'m1',label:'1 bis 3 Monate',minDays:25,color:'#a7e8df'}),
 Object.freeze({id:'w',label:'unter 1 Monat',minDays:0,color:'#d9f3ef'}),
 Object.freeze({id:'none',label:'keine Berichte',color:'#e3e8ed'}),
]);
/** Wie aktuell die Berichte sind: Stufen nach dem jüngsten Sitzungstag; „ahead“, wenn eine Sitzung angekündigt ist. */
export const FRESH_BUCKETS=Object.freeze([
 Object.freeze({id:'ahead',label:'Sitzung angekündigt',color:'#0b3d3a'}),
 Object.freeze({id:'d30',label:'Sitzung in den letzten 30 Tagen',maxDays:30,color:'#0f766e'}),
 Object.freeze({id:'d90',label:'31 bis 90 Tage her',maxDays:90,color:'#5fd3c4'}),
 Object.freeze({id:'d180',label:'91 bis 180 Tage her',maxDays:180,color:'#e8a33d'}),
 Object.freeze({id:'old',label:'über 180 Tage her',color:'#ad392d'}),
 Object.freeze({id:'none',label:'keine Berichte',color:'#e3e8ed'}),
]);
/** @param {string|null|undefined} first erster Sitzungstag (JJJJ-MM-TT) @param {string} today */
export function reachBucket(first,today){
 if(!first)return 'none';const d=daysBetween(first,today);if(!Number.isFinite(d))return 'none';
 return (REACH_BUCKETS.find(b=>b.minDays!==undefined&&d>=b.minDays)||{id:'w'}).id;
}
/** @param {string|null|undefined} last jüngster Sitzungstag (JJJJ-MM-TT) @param {string} today */
export function freshBucket(last,today){
 if(!last)return 'none';const d=daysBetween(last,today);if(!Number.isFinite(d))return 'none';
 if(d<0)return 'ahead';
 return (FRESH_BUCKETS.find(b=>b.maxDays!==undefined&&d<=b.maxDays)||{id:'old'}).id;
}
/** Größenklassen der Gemeindeebene nach Einwohnern, größte zuerst; Kreise für sich. */
export const SIZE_CLASSES=Object.freeze([
 Object.freeze({id:'xl',label:'100.000 und mehr',min:100000}),
 Object.freeze({id:'l',label:'50.000 bis 100.000',min:50000}),
 Object.freeze({id:'m',label:'20.000 bis 50.000',min:20000}),
 Object.freeze({id:'s',label:'10.000 bis 20.000',min:10000}),
 Object.freeze({id:'xs',label:'5.000 bis 10.000',min:5000}),
 Object.freeze({id:'xxs',label:'unter 5.000',min:0}),
 Object.freeze({id:'district',label:'Kreise'}),
]);
export function sizeClassOf(region,population){
 if(region.kind==='district')return 'district';
 const p=population[region.id]||0;return (SIZE_CLASSES.find(c=>c.min!==undefined&&p>=c.min)||{id:'xxs'}).id;
}
/**
 * Gebiete und Einwohner je Stufe: {stufe:[Gebiete,Einwohner]}; Einwohner nur auf der Gemeindeebene. bucketOf liefert
 * die Stufe eines Katalogeintrags oder undefined, wenn er nicht zählt.
 * @param {{id:string,kind:string}[]} catalog @param {Record<string,number>} population @param {(r:{id:string,kind:string})=>string|undefined} bucketOf
 * @returns {Record<string,[number,number]>}
 */
export function tally(catalog,population,bucketOf){
 const out={};
 for(const r of catalog){const id=bucketOf(r);if(id===undefined)continue;const row=out[id]||(out[id]=[0,0]);row[0]++;if(r.kind==='city')row[1]+=population[r.id]||0;}
 return out;
}
/**
 * Berichte je Sitzungsmonat aus dem Verlaufsdatensatz (admin-timeline.mjs, Zeitbezug „event“: Tag, an dem ein Bericht
 * erstmals auf einer Tagesordnung stand): Monate aufsteigend mit Berichten und Gebieten, die in dem Monat eine Sitzung
 * hatten, dazu die Berichte ohne Datum. Nur Gebiete aus ids.
 * @param {{days:string[],areas:Record<string,[number,number][]>,undated?:Record<string,number>}} dataset @param {Set<string>} ids
 * @returns {{months:{month:string,reports:number,areas:number}[],undated:number}}
 */
export function monthlyReports(dataset,ids){
 const months=new Map();let undated=0;
 for(const [id,pairs] of Object.entries(dataset.areas||{})){
  if(!ids.has(id))continue;const seen=new Set();
  for(const [i,n] of pairs){const m=(dataset.days[i]||'').slice(0,7);if(!m)continue;const row=months.get(m)||{month:m,reports:0,areas:0};row.reports+=n;if(!seen.has(m)){seen.add(m);row.areas++;}months.set(m,row);}
 }
 for(const [id,n] of Object.entries(dataset.undated||{}))if(ids.has(id))undated+=n;
 return {months:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)),undated};
}
