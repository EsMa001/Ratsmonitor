import {activeTopics} from './topic-identity.mjs';
import {compareMonthlyMix} from './monthly-mix.mjs';
import {mapPeriods,mapFacts} from './map-metrics.mjs';
import {LABELS,LABEL_VERSION} from './labels.mjs';
import {matchStoredTopics,MATCH_VERSION,storedFeatures} from './similarity.mjs';
export const berlinToday=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(now);
export function monthRange(from,to){const out=[];let m=from.slice(0,7);while(m<=to.slice(0,7)&&out.length<120){out.push(m);const [y,n]=m.split('-').map(Number);m=`${n===12?y+1:y}-${String(n===12?1:n+1).padStart(2,'0')}`;}return out;}
/** @param {any} t */
export function eventDays(t){return [...new Set((t.events||[]).map(e=>e.date?.slice(0,10)).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')))];}
export {storedClassification as currentClassification} from './analysis-state.mjs';
import {storedClassification as currentClassification,hasCurrentLabel} from './analysis-state.mjs';
/** @param {any[]} topics @param {any[]} coverage @param {any[]} regions @param {any} q */
export function buildAnalytics(topics,coverage,regions,q){
 const {region,from,to,label='bildung',topicId='',level='all',now=new Date()}=q;
 const today=berlinToday(now),end=to<today?to:today;
 const enriched=activeTopics(topics).map(t=>({...t,regionId:t.regionId||'muenster',classification:currentClassification(t),analysisDays:eventDays(t)}));
 const active=t=>t.analysisDays.some(d=>d>=from&&d<=end);
 const comparisonPeriods=mapPeriods(from,end);
 const local=enriched.filter(t=>t.regionId===region),selected=local.filter(active);
 const distribution=LABELS.map(l=>({...l,count:selected.filter(t=>t.classification.primary===l.id).length,share:selected.length?selected.filter(t=>t.classification.primary===l.id).length/selected.length*100:null})).sort((a,b)=>b.count-a.count);
 const source=coverage.find(c=>c.regionId===region);
 const months=monthRange(from,end).map(month=>{
  const monthStart=month+'-01';const monthEnd=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
  const start=from>monthStart?from:monthStart,finish=end<monthEnd?end:monthEnd;
  const items=local.filter(t=>t.analysisDays.some(d=>d>=start&&d<=finish)),count=items.filter(t=>t.classification.primary===label).length;
  const distribution=LABELS.map(l=>{const count=items.filter(t=>t.classification.primary===l.id).length;return {...l,count,share:items.length?count/items.length*100:null};});
  return {month,from:start,to:finish,distribution,total:items.length,count,share:items.length?count/items.length*100:null,partial:!source?.complete||!source?.from||!source?.to||start!==monthStart||finish!==monthEnd||source.from>start||source.to<finish};
 });
 const focus=topicId?enriched.find(t=>t.id===topicId):null;
 const grouped=new Map();for(const t of enriched){if(!active(t))continue;if(!grouped.has(t.regionId))grouped.set(t.regionId,[]);grouped.get(t.regionId).push(t);}
 const eligible=regions.filter(r=>level==='all'||r.kind===level);
 const geography=eligible.map(r=>{
  const all=(grouped.get(r.id)||[]),c=coverage.find(c=>c.regionId===r.id);
  const matches=all.flatMap(t=>{const m=focus?matchStoredTopics(focus,t):(t.classification.primary===label?{score:1,reason:'Hauptlabel: '+LABELS.find(l=>l.id===label)?.name}:null);return m?[{id:t.id,title:t.title,sourceUrl:t.sourceUrl,eventDate:t.eventDate,reason:m.reason}]:[]});
  const comparisonPending=!!focus&&(!storedFeatures(focus)||all.some(t=>!storedFeatures(t)));
  return {comparisonPending,id:r.id,name:r.name,kind:r.kind,count:all.length?matches.length:null,total:all.length,share:all.length?matches.length/all.length*100:null,partial:!c?.complete||!c?.from||!c?.to||c.from>from||c.to<end,coverage:c||null,matches,...mapFacts(all,new Set(matches.map(t=>t.id)),comparisonPeriods)};
 });
 const places=geography.filter(p=>p.id!==region);
 return {pendingLabels:selected.filter(t=>!hasCurrentLabel(t)).length,pendingSimilarity:enriched.filter(t=>active(t)&&!storedFeatures(t)).length,focusPending:!!focus&&!storedFeatures(focus),geography,comparisonPeriods,region,from,to:end,label,topicId,level,today,version:LABEL_VERSION,matchVersion:MATCH_VERSION,total:selected.length,distribution,months,monthlyComparison:compareMonthlyMix(months),places,focus:focus?{id:focus.id,title:focus.title}:null,matchingPlaces:places.filter(p=>(p.count||0)>0).length,matchingTopics:places.reduce((n,p)=>n+(p.count||0),0),coverage:source||null,undated:local.filter(t=>!t.analysisDays.length).length,future:local.filter(t=>t.analysisDays.some(d=>d>today)).length,topicOptions:local.map(t=>({id:t.id,title:t.title})),articles:selected.map(t=>({id:t.id,title:t.title,label:t.classification.primary,analysisPending:!hasCurrentLabel(t),subjects:storedFeatures(t)?.subjects||[]}))};
}
