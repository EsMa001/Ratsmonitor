import {LABELS} from './labels.mjs';

export const MAP_VIEWS=[
 {id:'share',name:'Themenanteil',question:'Wie stark ist das Thema vertreten?',description:'Blau zeigt den Anteil passender Vorgänge an allen erfassten Vorgängen eines Gebiets.',scope:'subject'},
 {id:'count',name:'Anzahl der Vorgänge',question:'Wo gibt es viele passende Vorgänge?',description:'Violett zeigt absolute Trefferzahlen. Die festen Größenklassen machen auch kleinere Bestände sichtbar.',scope:'subject'},
 {id:'change',name:'Veränderung im Zeitraum',question:'Wo wächst oder sinkt der Themenanteil?',description:'Blau bedeutet Zunahme, Orange Abnahme. Verglichen werden die Anteile in zwei gleich langen Abschnitten.',scope:'subject'},
 {id:'dominant',name:'Häufigstes Sachgebiet',question:'Welches Sachgebiet kommt am häufigsten vor?',description:'Jede Farbe steht für ein Sachgebiet. Allgemeine, formale und offene Einordnungen können nicht gewinnen.',scope:'all'},
 {id:'unlabelled',name:'Anteil offener Labels',question:'Wo fehlen noch thematische Einordnungen?',description:'Je dunkler der Orangeton, desto mehr Vorgänge haben noch kein eindeutiges Hauptlabel.',scope:'all'},
 {id:'coverage',name:'Datenabdeckung',question:'Wo ist der Vergleich nur eingeschränkt möglich?',description:'Die Farben unterscheiden Teilstände und Zeiträume ohne gemeldete Quellenlücke.',scope:'all'}
];
const DAY=86400000;
export const MIN_MAP_SAMPLE=10;
export function mapPeriods(from,to){
 const start=Date.parse(from+'T00:00:00Z'),end=Date.parse(to+'T00:00:00Z');
 const days=Math.round((end-start)/DAY)+1,length=Math.floor(days/2),date=n=>new Date(n).toISOString().slice(0,10);
 if(!Number.isFinite(days)||length<1)return null;
 return {days:length,first:{from,to:date(start+(length-1)*DAY)},second:{from:date(end-(length-1)*DAY),to},omittedDay:days%2?date(start+length*DAY):null};
}
/** All inputs are canonical, date-filtered articles; repeat hearings count once per section. */
export function mapFacts(items,matchedIds,periods){
 const counts=new Map();for(const t of items)counts.set(t.classification.primary,(counts.get(t.classification.primary)||0)+1);
 const subjects=LABELS.filter(l=>!l.kind&&l.id!=='unklar').map(l=>({...l,count:counts.get(l.id)||0}));
 const max=Math.max(0,...subjects.map(l=>l.count)),leaders=subjects.filter(l=>max>0&&l.count===max).map(l=>({id:l.id,name:l.name,color:l.color}));
 const part=range=>{
  const rows=items.filter(t=>t.analysisDays.some(d=>d>=range.from&&d<=range.to)),count=rows.filter(t=>matchedIds.has(t.id)).length;
  return {count,total:rows.length,share:rows.length?100*count/rows.length:null};
 };
 const first=periods?part(periods.first):null,second=periods?part(periods.second):null;
 return {unlabelled:counts.get('unklar')||0,dominant:{leaders,count:max,share:items.length?100*max/items.length:null},comparison:{first,second,delta:first&&second&&first.share!==null&&second.share!==null?second.share-first.share:null}};
}
const shareColors=['#ffffff','#dbe7fb','#98b7e8','#537dc4','#183d80'];
const openColors=['#ffffff','#fff1ce','#f2ce78','#cc8836','#855017'];
const countColors=['#ffffff','#ece5f7','#c3acd9','#8c69b0','#57367c'];
const pctBucket=v=>v===0?0:v<=10?1:v<=25?2:v<=50?3:4;
const number=v=>v.toLocaleString('de-DE',{maximumFractionDigits:1});
export const mapPercent=v=>v===null?'—':number(v)+' %';
export const mapDelta=v=>v===null?'—':(v>0?'+':'')+number(v)+' Prozentpunkte';
export function mapReading(p,mode,{completeOnly=false}={}){
 const missing=(kind,text,detail)=>({kind,text,detail,value:null,color:kind==='pending'?'#e7e7e7':'#f4f4f4'});
 if(!p)return missing('no-data','Keine Daten','Kein Gebiet ausgewählt.');
 if(!p.total)return p.coverage?.method==='pending'||!p.coverage?missing('pending','Nicht angebunden','Für dieses Gebiet liegt noch kein angebundener Quellenbestand vor.'):missing('no-data','Keine Daten im Zeitraum','Ein fehlender Bestand ist kein Nachweis für null politische Aktivität.');
 if(mode==='coverage')return {kind:'value',value:p.partial?0:1,text:p.partial?'Teilstand':'Ohne gemeldete Lücke',color:p.partial?'#e3aa54':'#327f86',detail:p.partial?'Der Quellenstand deckt den gewählten Zeitraum nicht lückenlos ab.':'Die Quelle meldet keine technische oder zeitliche Lücke. Das ist keine Vollständigkeitsgarantie.'};
 if(completeOnly&&p.partial)return missing('excluded','Teilstand ausgeblendet','Der Quellenbestand deckt den gewählten Zeitraum nicht lückenlos ab.');
 const small=p.total<MIN_MAP_SAMPLE?' Kleine Datenbasis: weniger als 10 Vorgänge.':'';
 if(p.comparisonPending&&['share','count','change'].includes(mode))return missing('analysis-pending','Analyse ausstehend','Für den Vergleich fehlen gespeicherte Themenmerkmale. Neue Artikel werden nur auf ausdrückliche Anforderung analysiert.');
 if(mode==='count')return {kind:'value',value:p.count,text:number(p.count)+' Vorgänge',color:countColors[p.count===0?0:p.count<10?1:p.count<50?2:p.count<200?3:4],detail:`${p.count} passende von ${p.total} erfassten Vorgängen. Keine Einwohnerquote.`};
 if(mode==='unlabelled')return {kind:'value',value:100*p.unlabelled/p.total,text:mapPercent(100*p.unlabelled/p.total),color:openColors[pctBucket(100*p.unlabelled/p.total)],detail:`${p.unlabelled} von ${p.total} Vorgängen sind noch nicht eingeordnet. Eine niedrige Quote belegt keine hohe Genauigkeit.`+small};
 if(mode==='change'){
  const {first,second,delta}=p.comparison;
  if(!first||!second)return missing('insufficient','Zeitraum zu kurz','Für den Vergleich sind mindestens zwei Kalendertage nötig.');
  if(first.total<MIN_MAP_SAMPLE||second.total<MIN_MAP_SAMPLE)return missing('insufficient','Zu wenige Vergleichsdaten',`Mindestens 10 Vorgänge je Abschnitt nötig. Vorhanden: ${first.total} im ersten, ${second.total} im zweiten Abschnitt.`);
  return {kind:'value',value:delta,text:mapDelta(delta),color:delta < -10?'#b35806':delta < -2?'#efc28e':delta<=2?'#f5f5f5':delta<=10?'#a5cbe2':'#2166ac',detail:`${first.count} / ${first.total} (${mapPercent(first.share)}) → ${second.count} / ${second.total} (${mapPercent(second.share)}). Differenz der erfassten Anteile, kein gesicherter politischer Trend.`};
 }
 if(mode==='dominant'){
  if(p.total<MIN_MAP_SAMPLE)return missing('insufficient','Kleine Datenbasis',`Mindestens 10 Vorgänge nötig. Erfasst: ${p.total}.`);
  const d=p.dominant;
  if(!d.leaders.length)return missing('no-subject','Kein Sachgebiet zugeordnet','Es liegen nur allgemeine, formale oder offene Einordnungen vor.');
  return {kind:d.leaders.length>1?'tie':'value',value:d.share,text:d.leaders.length>1?'Mehrere Sachgebiete gleichauf':d.leaders[0].name,color:d.leaders.length>1?'#a6a6a6':d.leaders[0].color,detail:d.leaders.map(l=>l.name).join(' · ')+`: ${d.leaders.length>1?'jeweils ':''}${d.count} von ${p.total} Vorgängen (${mapPercent(d.share)}). Häufigkeit belegt keine politische Priorität.`};
 }
 return {kind:'value',value:p.share,text:mapPercent(p.share),color:shareColors[pctBucket(p.share)],detail:`${p.count} passende von ${p.total} erfassten Vorgängen.`+small};
}
export function mapLegend(mode,places=[]){
 if(mode==='dominant'){
  const used=new Set(places.filter(p=>p.total>=MIN_MAP_SAMPLE&&p.dominant?.leaders.length===1).flatMap(p=>p.dominant.leaders.map(l=>l.id)));
  return [...LABELS.filter(l=>used.has(l.id)).map(l=>({color:l.color,label:l.name})),{color:'#a6a6a6',label:'Mehrere Sachgebiete gleichauf'}];
 }
 if(mode==='coverage')return [{color:'#327f86',label:'Ohne gemeldete Lücke'},{color:'#e3aa54',label:'Teilstand im gewählten Zeitraum'}];
 if(mode==='change')return ['Unter −10 Prozentpunkte','−10 bis unter −2 Prozentpunkte','−2 bis +2 Prozentpunkte','Über +2 bis +10 Prozentpunkte','Über +10 Prozentpunkte'].map((label,i)=>({label,color:['#b35806','#efc28e','#f5f5f5','#a5cbe2','#2166ac'][i]}));
 if(mode==='count')return ['0 Vorgänge','1–9 Vorgänge','10–49 Vorgänge','50–199 Vorgänge','Ab 200 Vorgängen'].map((label,i)=>({label,color:countColors[i]}));
 return ['0 %','Über 0 bis 10 %','Über 10 bis 25 %','Über 25 bis 50 %','Über 50 %'].map((label,i)=>({label,color:(mode==='unlabelled'?openColors:shareColors)[i]}));
}
