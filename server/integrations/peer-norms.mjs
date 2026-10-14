import {POPULATION} from '../../shared/catalog.mjs';

/*
 * Plenara.X – „Ist das viel oder wenig?“ für einen Ort (Atlas, „Ort im Vergleich“ in plenara-x-query.mjs). Maß ist der Anteil eines Themas an allen
 * Sachvorgängen des eigenen Rats (ohne Formalien, gleiche Titel einmal, letzte 12 Monate): Mehr Ausschüsse oder vollständigere
 * Unterlagen erhöhen Zähler und Nenner zugleich. Verglichen wird mit Gebieten gleicher Art und Größenklasse, zuerst im selben
 * Land (Zuständigkeiten sind je Land verschieden); reicht die Gruppe nicht, ohne Land, dann mit Nachbarklassen.
 * Kleine Zahlen: Spanne nach Wilson (95 %), Einordnung erst ab MIN_TOPIC Vorgängen und nur bei klarem Abstand:
 * „häufiger als üblich“, wenn die Spanne ganz über dem oberen Viertel der Gruppe liegt, „seltener“ entsprechend.
 * Die Zahl sagt, wie oft ein Thema in den Ratsunterlagen vorkommt, nicht, was umgesetzt wurde.
 */
const MONTHS=12,MIN_MONTHS=9,MIN_ITEMS=100,MIN_GROUP=15,MIN_TOPIC=5;
export const NORM_RULE={minItems:MIN_ITEMS,minMonths:MIN_MONTHS,minTopic:MIN_TOPIC,minGroup:MIN_GROUP};
const SIZES=[[0,10000,'unter 10.000'],[10000,20000,'10.000 bis 20.000'],[20000,50000,'20.000 bis 50.000'],[50000,100000,'50.000 bis 100.000'],[100000,Infinity,'ab 100.000']];
export const LANDS={'01':'Schleswig-Holstein','02':'Hamburg','03':'Niedersachsen','04':'Bremen','05':'Nordrhein-Westfalen','06':'Hessen','07':'Rheinland-Pfalz','08':'Baden-Württemberg','09':'Bayern','10':'Saarland','11':'Berlin','12':'Brandenburg','13':'Mecklenburg-Vorpommern','14':'Sachsen','15':'Sachsen-Anhalt','16':'Thüringen'};
const UNION=/Samtgemeinde|Verbandsgemeinde|Amt\b|Verwaltungsgemeinschaft|Verwaltungsverband/;
/** Art eines Gebiets für die Vergleichsgruppe (name im Dativ: „verglichen mit 84 kreisangehörigen Gemeinden“) */
export function typeOf(r){
 if(r.kind==='district')return {id:'kreis',name:'Kreisen'};
 if(r.members||UNION.test(r.municipalityType||r.name))return {id:'verband',name:'Gemeindeverbänden'};
 if(r.independent)return {id:'kreisfrei',name:'kreisfreien Städten'};
 return {id:'gemeinde',name:'kreisangehörigen Gemeinden'};
}
const sizeOf=pop=>SIZES.findIndex(([lo,hi])=>pop>=lo&&pop<hi);
/** Spanne eines Anteils (Wilson, 95 %) */
export function wilson(k,n){
 if(!n)return [0,0];
 const z=1.96,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
 return [Math.max(0,c-h),Math.min(1,c+h)];
}
export function quantile(sorted,q){
 if(!sorted.length)return 0;
 const i=(sorted.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);
 return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo);
}
/** Einordnung: 'mehr', 'weniger', 'ueblich' oder null (zu wenige Vorgänge) */
export function classify(k,n,q1,q3){
 if(k<MIN_TOPIC)return null;
 const [lo,hi]=wilson(k,n);
 return lo>q3?'mehr':hi<q1?'weniger':'ueblich';
}
/** Vergleichsgruppe: gleiche Art und Größenklasse, zuerst im Land; sonst ohne Land, dann mit Nachbarklassen */
export function peerGroup(place,catalog,ok,POP=POPULATION){
 const type=typeOf(place).id,pop=POP[place.id]||0,size=sizeOf(pop),land=place.ags.slice(0,2);
 const pool=catalog.filter(r=>r.id!==place.id&&ok(r.id)&&typeOf(r).id===type&&POP[r.id]);
 const pick=(sizes,inLand)=>pool.filter(r=>sizes.includes(sizeOf(POP[r.id]))&&(!inLand||r.ags.slice(0,2)===land));
 const tries=[[[size],true],[[size],false],[[size-1,size,size+1],true],[[size-1,size,size+1],false]];
 for(const [sizes,inLand] of tries){
  const list=pick(sizes,inLand);
  if(list.length>=MIN_GROUP){
   const lo=SIZES[Math.max(0,Math.min(...sizes))][0],hi=SIZES[Math.min(SIZES.length-1,Math.max(...sizes))][1];
   const range=hi===Infinity?`ab ${lo.toLocaleString('de-DE')}`:lo===0?`unter ${hi.toLocaleString('de-DE')}`:`${lo.toLocaleString('de-DE')} bis ${hi.toLocaleString('de-DE')}`;
   return {regions:list,label:`${typeOf(place).name}${inLand?` in ${LANDS[land]||'diesem Land'}`:' bundesweit'}, ${range} Einwohner`};
  }
 }
 return null;
}

const day=d=>d.toISOString().slice(0,10);
export function windowOf(today=new Date()){
 const from=new Date(today);from.setMonth(from.getMonth()-MONTHS);
 return {from:day(from),to:day(today)};
}
