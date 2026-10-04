import {CATALOG as regions,POPULATION as population,LANDS,landOf} from '../../shared/catalog.mjs';
import frame from '../../shared/germany-population.json' with {type:'json'};
import sample from '../../shared/estimate-samples.json' with {type:'json'};
import size from '../../shared/document-size-sample.json' with {type:'json'};
import {estimateGermany,sampleQuality,areaClass,profile,capture,seasonality,stateFactor,annualize,SIZE_CLASSES,LEVELS,SAMPLE_RULES} from '../../shared/estimate.mjs';
import {estimateVolume,SIZE_RULES} from '../../shared/estimate-size.mjs';
import {rangeStart} from '../../shared/timeline.mjs';
import {adminTimeline} from './admin-timeline.mjs';
import {canImport} from './pipeline-jobs.mjs';
// Classes with fewer complete examples of the connected states than this get suggestions for a twelve-month import.
const WANTED_SAMPLES=8;
// Level in the population frame: Lower Saxon Samtgemeinden are associations, their members belong to them.
const levelOf=r=>r.kind==='district'?'district':r.members?'association':'municipality';
const readJson=text=>{try{return JSON.parse(text||'{}');}catch{return {};}};
const canonical="json_extract(payload,'$.identity.mergedInto') IS NULL";
// Per area and for the period: reports with at least one PDF, linked PDFs, and how often reports return to an agenda.
const DETAILS_SQL=`SELECT area,sum(pdfs>0) AS withDocuments,sum(pdfs) AS links,sum(days>1) AS followUps,sum(days) AS consultations FROM (SELECT region_id AS area,substr((SELECT min(json_extract(value,'$.date')) FROM json_each(payload,'$.events')),1,10) AS day,(SELECT count(*) FROM json_each(payload,'$.documents') WHERE json_extract(value,'$.kind') IN ('application/pdf','pdf')) AS pdfs,(SELECT count(DISTINCT substr(json_extract(value,'$.date'),1,10)) FROM json_each(payload,'$.events')) AS days FROM topics WHERE ${canonical}) WHERE day>=? AND day<=? GROUP BY area`;
const ratio=(list,a,b)=>{const total=list.reduce((n,x)=>n+(x[b]||0),0);return total?list.reduce((n,x)=>n+(x[a]||0),0)/total:null;};
/**
 * Germany-wide estimate of new reports per year and day, and of the documents behind them. Read-only.
 * Examples are the stored areas of the connected states with a complete year (read from the database on every call)
 * and the measured random sample (shared/estimate-samples.json, built by scripts/estimate). A report counts on the day
 * it first appeared on an agenda; the period is the last twelve months.
 */
export async function adminEstimate(db,{now=new Date(),replicates=SAMPLE_RULES.replicates}={}){
 const timeline=await adminTimeline(db,{basis:'event',now}),to=timeline.today,from=rangeStart('12m',to,new Map());
 const coverage=new Map((await db.prepare('SELECT region_id,payload FROM source_coverage').all()).results.map(r=>[r.region_id,readJson(r.payload)]));
 const details=new Map((await db.prepare(DETAILS_SQL).bind(from,to).all()).results.map(r=>[r.area,r]));
 // --- candidates: stored areas of the connected states and the units of the sample ---
 const stored=[];
 for(const region of regions){
  const days=(timeline.areas[region.id]||[]).map(([index,count])=>[timeline.days[index],count]).filter(([day])=>day>=from&&day<=to);
  if(!days.length)continue;
  const sorted=days.map(([day])=>day).sort(),d=details.get(region.id)||{};
  stored.push({id:region.id,name:region.name,origin:'stored',level:levelOf(region),state:landOf(region),population:population[region.id]||0,reports:days.reduce((n,[,count])=>n+count,0),months:new Set(sorted.map(day=>day.slice(0,7))).size,meetingDays:sorted.length,firstDay:sorted[0],lastDay:sorted.at(-1),
   withDocuments:Number(d.withDocuments||0),links:Number(d.links||0),followUps:Number(d.followUps||0),consultations:Number(d.consultations||0),notes:Array.isArray(coverage.get(region.id)?.issues)?coverage.get(region.id).issues.map(String):[],...profile(days,from)});
 }
 // The sample was counted for its own period; its figures are a year as well and are used as they are.
 // A sample unit that is stored as well counts once, with the stored figures.
 const storedIds=new Set(stored.map(a=>a.id));
 const counted=sample.units.filter(u=>(u.reports!==undefined||u.error)&&!storedIds.has(u.id.replace(/^de-/,'nds-'))).map(u=>({...u,origin:'sample',measured:true}));
 const judged=[...stored.map(a=>({...a,...sampleQuality(a,{from,to})})),...counted.map(u=>({...u,...sampleQuality(u,sample)}))];
 const examples=judged.filter(a=>a.complete&&a.population>0),excluded=judged.filter(a=>!a.complete);
 // --- count ---
 const estimate=estimateGermany({samples:examples,frame,replicates}),models=Object.fromEntries(estimate.levels.map(l=>[l.id,l.model]));
 const known=regions.map(r=>({level:levelOf(r),state:landOf(r),population:population[r.id]||0,connected:canImport(r.id)}));
 const captured=capture({units:sample.units,known,models,cells:estimate.cells,knownStates:LANDS.map(l=>l.id)});
 // --- documents and their size ---
 const share={all:ratio(examples,'withDocuments','reports')||0,classes:{}};
 for(const c of SIZE_CLASSES){const own=examples.filter(a=>areaClass(a)===c.id);if(own.length>=SIZE_RULES.minAreas)share.classes[c.id]=ratio(own,'withDocuments','reports');}
 const volume=size.reports.length?estimateVolume({size,cells:estimate.cells,runs:estimate.replicates,share}):null;
 // --- distribution over the year ---
 const season=seasonality(examples),peakDay=estimate.total.perYear/52*season.strongWeek*season.peakWeekday;
 // Connected areas of a thinly covered class that could become examples: up to eight, spread over the range of sizes.
 const candidates={};
 for(const c of SIZE_CLASSES){
  const have=new Set(examples.filter(a=>a.origin==='stored'&&areaClass(a)===c.id).map(a=>a.id));
  const open=have.size>=WANTED_SAMPLES?[]:regions.filter(r=>population[r.id]&&areaClass({level:levelOf(r),population:population[r.id]})===c.id&&canImport(r.id)&&!have.has(r.id)).sort((a,b)=>population[b.id]-population[a.id]);
  const step=Math.max(1,open.length/WANTED_SAMPLES);
  candidates[c.id]=Array.from({length:Math.min(WANTED_SAMPLES,open.length)},(_,i)=>open[Math.floor(i*step)]).map(r=>({id:r.id,name:r.name,population:population[r.id]}));
 }
 const brief=a=>({id:a.id,name:a.name,origin:a.origin,level:a.level,class:areaClass(a),state:a.state,population:a.population,reports:a.reports,method:a.method||null});
 // Areas with reports but without a complete year: shown in the charts with a projected yearly figure, never used in the calculation.
 const provisional=excluded.map(a=>{const projected=a.population>0?annualize(a,a.origin==='sample'?sample:{from,to},season.weeks):null;return projected?{...brief(a),reason:a.reason,annual:projected.annual,weeks:projected.weeks,connected:a.origin==='stored'&&canImport(a.id)}:null;}).filter(Boolean);
 const strata=SIZE_CLASSES.map(c=>{const drawn=sample.units.filter(u=>areaClass(u)===c.id),own=examples.filter(a=>areaClass(a)===c.id);return {id:c.id,name:c.name,drawn:drawn.length,connected:drawn.filter(u=>u.outcome==='connected').length,sampleExamples:own.filter(a=>a.origin==='sample').length,storedWithData:stored.filter(a=>areaClass(a)===c.id).length,storedExamples:own.filter(a=>a.origin==='stored').length,candidates:candidates[c.id]};});
 // The draws and the cells stay on the server; the page gets the condensed figures.
 const result={...estimate};delete result.cells;delete result.replicates;
 return {asOf:timeline.asOf,from,to,
  frame:{source:frame.source,populationYear:frame.populationYear,...frame.totals,units:Object.fromEntries(Object.entries({municipality:'municipalities',district:'districts',association:'associations',borough:'boroughs'}).map(([level,key])=>[level,Object.values(frame[key]).reduce((n,list)=>n+list.length,0)]))},
  sample:{builtAt:sample.builtAt,from:sample.from,to:sample.to,design:sample.design,units:sample.units.length,connected:sample.units.filter(u=>u.outcome==='connected').length,counted:counted.length,storedWithData:stored.length,strata},
  examples:examples.map(brief),excluded:excluded.map(a=>({...brief(a),reason:a.reason})),provisional,
  ...result,
  levels:result.levels.map(l=>({...l,model:l.model&&{n:l.model.n,measured:l.model.measured,slope:l.model.slope,typical:l.model.typical,smear:l.model.smear,shrink:l.model.shrink,scatter:l.model.scatter,states:Object.fromEntries(Object.entries(l.model.states).map(([state,s])=>[state,{n:s.n,raw:Math.exp(s.raw-l.model.typical),factor:stateFactor(l.model,state)}]))}})),
  capture:captured,
  documents:{share:share.all,byClass:share.classes,linksPerReport:ratio(examples.filter(a=>a.withDocuments),'links','withDocuments')},
  volume,
  size:size.reports.length?{measuredAt:size.measuredAt,from:size.from,to:size.to,tokenizer:size.tokenizer,charsPerToken:size.charsPerToken,charsPerTokenOther:size.charsPerTokenOther,perArea:size.perArea,areas:size.areas.length,reports:size.reports.length,documents:size.documents}:null,
  season:{...season,peakDay,followUpsPerYear:estimate.total.perYear*(season.consultationsPerReport-1)},
  rules:{...SAMPLE_RULES,capTokens:SIZE_RULES.capTokens,primaryChars:SIZE_RULES.primaryChars,primaryPages:SIZE_RULES.primaryPages,maxBytes:SIZE_RULES.maxBytes,levels:LEVELS}};
}
