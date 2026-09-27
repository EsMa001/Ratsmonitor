import {labelName} from './labels.mjs';
const pct=n=>n.toLocaleString('de-DE',{maximumFractionDigits:1})+' %';
const month=s=>s.slice(5)+'.'+s.slice(0,4);
export const analysisHref=(d,example,changes={})=>'/analysen?'+new URLSearchParams({region:d.region,from:d.from,to:d.to,label:d.label,level:d.level,...changes,example})+'#analysebeispiele';
/** Concrete examples only use articles already filtered to this place and period. */
export function concreteTopicExamples(d){
 const groups=new Map();
 for(const t of d.articles){
  if(['allgemein','sitzung'].includes(t.label))continue;
  // The API supplies subjects from the original title, even when the display title differs.
  for(const subject of t.subjects??[]){
   if(!groups.has(subject))groups.set(subject,new Map());
   groups.get(subject).set(t.id,t);
  }
 }
 return [...groups].map(([subject,items])=>{
  const articles=[...items.values()].sort((a,b)=>a.id.localeCompare(b.id));
  const chosen=articles.find(t=>t.id===d.topicId)||articles[0];
  return {subject,count:articles.length,chosen,active:articles.some(t=>t.id===d.topicId),href:analysisHref(d,'aehnlichkeit',{topic:chosen.id,label:chosen.label})};
 }).sort((a,b)=>Number(b.active)-Number(a.active)||b.count-a.count||a.subject.localeCompare(b.subject,'de'));
}
export function labelShortcuts(d,example){
 return d.distribution.filter(l=>!l.kind&&l.id!=='unklar'&&l.count>0).map(l=>({...l,href:analysisHref(d,example,{label:l.id})}));
}
/** Examples are calculated from the same filtered result as charts, never a second snapshot. */
export function buildAnalysisExamples(d){
 const subjects=d.distribution.filter(l=>!l.kind&&l.id!=='unklar'&&l.count>0);
 const top=subjects[0],leaders=subjects.filter(l=>l.count===top?.count);
 const link=(id,changes={})=>analysisHref(d,id,changes);
 const concrete=concreteTopicExamples(d);
 const candidate=d.articles.find(t=>t.id===d.topicId)||(concrete.find(e=>e.subject==='Wärmeplanung')||concrete[0])?.chosen;
 const selected=d.distribution.find(l=>l.id===d.label);
 const populated=d.months.filter(m=>m.total>0&&m.share!==null),first=populated[0],last=populated.at(-1);
 const delta=first&&last?last.share-first.share:0;
 const matching=d.places.filter(p=>p.count>0),cities=matching.filter(p=>p.kind==='city').length,districts=matching.filter(p=>p.kind==='district').length;
 const count=id=>d.distribution.find(l=>l.id===id)?.count||0;
 const unknown=count('unklar'),structural=count('allgemein')+count('sitzung');
 return [
  {id:'schwerpunkte',number:'01',title:'Welche Sachthemen überwiegen?',description:'Die häufigsten fachlichen Labels im gewählten Ort.',href:link('schwerpunkte',{label:top?.id||d.label}),metric:top?leaders.length>1?'Mehrere Sachgebiete gleichauf':top.name:'Noch keine Sachthemen',answer:top?`${leaders.map(l=>l.name).join(' und ')} ${leaders.length>1?'liegen mit jeweils':'liegt mit'} ${top.count} von ${d.total} Vorgängen (${pct(top.share)}) vorne.`:'Für die Auswahl sind noch keine fachlich eingeordneten Vorgänge vorhanden.',note:'Anteil an allen erfassten Vorgängen, einschließlich allgemeiner und offener Einordnungen. Häufigkeit zeigt weder Budget noch politische Bedeutung.',target:'themenverteilung',action:'Verteilung ansehen'},
  {id:'entwicklung',number:'02',title:'Verändern sich die Themenanteile?',description:'Zum Beispiel Mobilität, Bildung oder Bauen über die Monate.',href:link('entwicklung'),metric:labelName(d.label),answer:populated.length>=2?`${month(first.month)}: ${first.count} von ${first.total} (${pct(first.share)}). ${month(last.month)}: ${last.count} von ${last.total} (${pct(last.share)}). Differenz: ${delta>0?'+':''}${delta.toLocaleString('de-DE',{maximumFractionDigits:1})} Prozentpunkte.`:'Für einen Vergleich braucht es mindestens zwei Monate mit erfassten Vorgängen. Die aktuelle Auswahl reicht dafür nicht aus.',note:'Verglichen werden erster und letzter Monat mit Daten. Fehlende Monate sind keine Nullwerte. Teilmonate, Quellenlücken und kleine Bestände können den Unterschied erklären; daraus folgt kein gesicherter politischer Trend.',target:'zeitverlauf',action:'Monatswerte ansehen'},
  {id:'orte',number:'03',title:'Wo taucht das Themenfeld auf?',description:'Vorgänge und Anteile in anderen angebundenen Kommunen und Kreisen.',href:link('orte'),metric:labelName(d.label),answer:d.focus?'Die Karte zeigt gerade Ähnlichkeiten zu einem einzelnen Artikel. Wähle dieses Beispiel, um wieder das gesamte Themenfeld zu vergleichen.':`${labelName(d.label)}: ${d.matchingTopics} Vorgänge in ${cities} anderen Kommunen und ${districts} anderen Kreisen. Im gewählten Ort: ${selected?.count||0} von ${d.total}${d.total?' ('+pct(selected?.share||0)+')':''}.`,note:'Es gelten Zeitraum und Gebietsebene deiner Auswahl. Kommunen und Kreise werden getrennt gezählt. Die Standardansicht der Karte zeigt Anteile im erfassten Bestand. Über „Einfärbung der Karte“ sind auch Anzahl, Veränderung und Datenlage wählbar; dies ist kein NRW-Ranking.',target:'ortsvergleich',action:'Karte und Orte ansehen'},
  {id:'aehnlichkeit',number:'04',title:'Gibt es ähnliche konkrete Vorhaben?',description:d.focus?`Ausgewählter Vergleichsartikel: ${d.focus.title}`:candidate?`Beispiel aus diesem Ort: ${candidate.title}`:'In der Auswahl fehlt ein geeigneter Artikel mit konkretem Sachthema.',href:candidate?link('aehnlichkeit',{topic:candidate.id,label:candidate.label}):null,metric:d.focus?`${d.matchingTopics} ähnliche Vorgänge`:'Ein Vorhaben vergleichen',answer:d.focus?`Zu „${d.focus.title}“ wurden ${d.matchingTopics} ähnliche Vorgänge in ${d.matchingPlaces} anderen erfassten Gebieten gefunden.`:'Öffne das Beispiel für einen Artikelvergleich mit begründeten Treffern und Originalquellen.',note:'Ähnlichkeit beruht auf gemeinsamen Sachthemen oder prägenden Titelbegriffen. Sie belegt weder identische Maßnahmen noch gleiche Beschlüsse.',target:'ortsvergleich',action:'Ähnliche Vorgänge ansehen'},
  {id:'datenlage',number:'05',title:'Wie belastbar ist die Verteilung?',description:'Sachgebiete, allgemeine Punkte und offene Einordnungen auseinanderhalten.',href:link('datenlage'),metric:d.total?pct(unknown/d.total*100)+' noch offen':'Kein auswertbarer Bestand',answer:`Von ${d.total} Vorgängen haben ${d.total-unknown-structural} ein fachliches Hauptlabel. ${structural} sind allgemeine oder formale Punkte; ${unknown} bleiben offen.`,note:'Alle drei Gruppen bleiben im Nenner der Themenanteile. Eine niedrige offene Quote ist kein Qualitätsnachweis. Die Quellenvollständigkeit ist gesondert zu prüfen.',target:'datengrundlage',action:'Methode und Quellen ansehen'}
 ];
}
