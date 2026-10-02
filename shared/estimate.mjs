/**
 * Estimate of the number of new reports per year and day for all of Germany.
 * Pure functions, shared by server, page, scripts and tests. Every figure can be traced on the admin page.
 *
 * How the estimate is built
 * 1. Examples: units whose stock covers a complete year (stored NRW areas and the measured random sample
 *    outside NRW). For each: inhabitants and reports per year.
 * 2. Model per level (municipality, district, municipal association, city borough):
 *        reports = level of the federal state × inhabitants ^ slope
 *    The slope is common to all states and is measured from the differences between units of the same state.
 *    Every state with examples has its own level; it is pulled towards the typical level the fewer examples the
 *    state has. A state without examples uses the typical level.
 * 3. Sum: the model is applied to every single unit of Germany (their inhabitants are known) and added up —
 *    by size class and by federal state.
 * 4. Range: the examples are drawn again at random many times, state by state (bootstrap); every draw gives
 *    another total. States without examples take the level of a randomly chosen measured state in each draw.
 *    The range holds 8 of 10 draws.
 * 5. Check: every example is predicted from all the others, and every state from the other states.
 */
export const SIZE_CLASSES=Object.freeze([
 Object.freeze({id:'tiny',name:'Kleinstgemeinde',range:'unter 5.000 Einwohner',min:0,max:5000}),
 Object.freeze({id:'small',name:'Kleine Stadt oder Gemeinde',range:'5.000 bis unter 20.000 Einwohner',min:5000,max:20000}),
 Object.freeze({id:'medium',name:'Mittlere Stadt',range:'20.000 bis unter 100.000 Einwohner',min:20000,max:100000}),
 Object.freeze({id:'large',name:'Große Stadt',range:'100.000 bis unter 500.000 Einwohner',min:100000,max:500000}),
 Object.freeze({id:'xlarge',name:'Sehr große Stadt',range:'ab 500.000 Einwohner',min:500000,max:Infinity}),
 Object.freeze({id:'district',name:'Kreis',range:'Landkreise, ohne kreisfreie Städte'}),
 Object.freeze({id:'association',name:'Gemeindeverband',range:'Verbandsgemeinde, Amt, Samtgemeinde, Verwaltungsgemeinschaft – mit allen Mitgliedsgemeinden'}),
 Object.freeze({id:'borough',name:'Stadtbezirk der Stadtstaaten',range:'Bezirke von Berlin und Hamburg'}),
]);
/** Levels of local government that hold their own council meetings. */
export const LEVELS=Object.freeze({municipality:'Städte und Gemeinden',district:'Kreise',association:'Gemeindeverbände',borough:'Bezirke von Berlin und Hamburg'});
/** Federal states by the first two digits of the official municipality key. */
export const FEDERAL_STATES=Object.freeze({'01':'Schleswig-Holstein','02':'Hamburg','03':'Niedersachsen','04':'Bremen','05':'Nordrhein-Westfalen','06':'Hessen','07':'Rheinland-Pfalz','08':'Baden-Württemberg','09':'Bayern','10':'Saarland','11':'Berlin','12':'Brandenburg','13':'Mecklenburg-Vorpommern','14':'Sachsen','15':'Sachsen-Anhalt','16':'Thüringen'});
/** Requirements for an example area, and the fixed choices of the model. */
export const SAMPLE_RULES=Object.freeze({minMonths:9,startSlackDays:45,endSlackDays:60,gapFactor:4,maxUnreadableMeetings:.15,workdaysPerYear:250,minForModel:6,shrink:4,minShrink:1,maxShrink:20,replicates:300,rangeLow:.1,rangeHigh:.9,seed:20261002});
// Notes that say the list of meetings itself was cut short. A single meeting or paper that could not be read
// (time budget, request budget) does not disqualify a year of stock.
const TRUNCATED=/Listenlimit|Begrenzter Abruf|Sitzungslimit|Seitenlimit|Größenlimit/;
const DAY=86400000;
const time=day=>Date.parse(day+'T00:00:00Z');
const german=day=>day.split('-').reverse().join('.');
export function sizeClass(kind,population){
 if(kind==='district')return 'district';
 return SIZE_CLASSES.find(c=>c.min!==undefined&&population>=c.min&&population<c.max)?.id||'tiny';
}
/** Class shown for an area: the level for everything but municipalities, the size class for those. */
export const areaClass=area=>area.level&&area.level!=='municipality'?area.level:sizeClass('city',area.population);
/**
 * Does the stock of one area cover the complete period? Returns the reason if it does not.
 * measured: the whole twelve-month list was read in one measuring run. Then only an implausibly long gap at the
 * start or the end counts as a break: longer than four times the average distance between two meeting days.
 * Stored stock can consist of several partial imports and must also touch nine of twelve months.
 */
export function sampleQuality(area,{from,to}){
 if(area.error)return {complete:false,reason:'Abruf fehlgeschlagen: '+String(area.error).slice(0,80)};
 if(!area.reports)return {complete:false,reason:'keine Berichte im Zeitraum'};
 const usual=area.measured&&area.meetingDays>0?SAMPLE_RULES.gapFactor*365/area.meetingDays:0;
 if(time(area.firstDay)>time(from)+Math.max(SAMPLE_RULES.startSlackDays,usual)*DAY)return {complete:false,reason:'Bestand beginnt erst am '+german(area.firstDay)};
 if(time(area.lastDay)<time(to)-Math.max(SAMPLE_RULES.endSlackDays,usual)*DAY)return {complete:false,reason:'Bestand endet am '+german(area.lastDay)};
 if(!area.measured&&area.months<SAMPLE_RULES.minMonths)return {complete:false,reason:`nur ${area.months} von 12 Monaten mit Berichten`};
 const limit=(area.notes||[]).find(note=>TRUNCATED.test(String(note)));
 if(limit)return {complete:false,reason:'letzter Abruf war begrenzt: '+String(limit).slice(0,80)};
 if(area.meetings>0&&area.unreadableMeetings/area.meetings>SAMPLE_RULES.maxUnreadableMeetings)return {complete:false,reason:`${area.unreadableMeetings} von ${area.meetings} Sitzungen ohne lesbare Tagesordnung`};
 return {complete:true,reason:''};
}
/** Distribution of the reports of one area over the year: per week of the period, per weekday (Monday first), per calendar month. */
export function profile(days,from){
 const weeks=Array(53).fill(0),weekdays=Array(7).fill(0),monthly=Array(12).fill(0);
 for(const [day,count] of days){const t=time(day),week=Math.floor((t-time(from))/(7*DAY));if(week<0||week>52)continue;weeks[week]+=count;weekdays[(new Date(t).getUTCDay()+6)%7]+=count;monthly[Number(day.slice(5,7))-1]+=count;}
 return {weeks,weekdays,monthly};
}
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
export const quantile=(values,q)=>{const s=[...values].sort((a,b)=>a-b);if(!s.length)return 0;const at=(s.length-1)*q,low=Math.floor(at),high=Math.ceil(at);return s[low]+(s[high]-s[low])*(at-low);};
/** Deterministic random numbers, so the same data always give the same range. */
export function random(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const groupByState=samples=>{const groups=new Map();for(const s of samples)groups.set(s.state,[...(groups.get(s.state)||[]),s]);return groups;};
/**
 * Model of one level: log(reports) = level of the state + slope · log(inhabitants).
 * - slope: from the differences between units of the same state, limited to 0…1 (0: size does not matter,
 *   1: reports grow in proportion to inhabitants). With fewer than six examples the slope is not measured but set:
 *   fallbackSlope (1 for municipalities: reports per inhabitant; 0 otherwise: reports per unit).
 * - level of a state: its mean distance from the common slope, pulled towards the typical level with the weight
 *   n / (n + k). k compares the scatter within states with the scatter between them (method of moments).
 * - typical level: mean of the state levels with those same weights, so that a state with many examples
 *   does not dominate the level assumed for states without examples.
 * - smear: mean of exp(residual), the correction for transforming back from logarithms.
 */
export function fitLevel(samples,fallbackSlope=0){
 const usable=samples.filter(s=>s.population>0&&s.reports>0);
 if(!usable.length)return null;
 const x=s=>Math.log(s.population),y=s=>Math.log(s.reports),groups=groupByState(usable);
 let sxx=0,sxy=0;
 for(const group of groups.values()){const mx=mean(group.map(x)),my=mean(group.map(y));for(const s of group){sxx+=(x(s)-mx)**2;sxy+=(x(s)-mx)*(y(s)-my);}}
 const measured=usable.length>=SAMPLE_RULES.minForModel&&sxx>1e-9,slope=measured?clamp(sxy/sxx,0,1):fallbackSlope;
 const raw=new Map([...groups].map(([state,group])=>[state,{n:group.length,level:mean(group.map(s=>y(s)-slope*x(s)))}]));
 // Scatter within states and between them decide how far a state with few examples is trusted.
 const within=[...groups].flatMap(([state,group])=>group.map(s=>y(s)-slope*x(s)-raw.get(state).level)),degrees=usable.length-groups.size;
 const varianceWithin=degrees>0?within.reduce((a,r)=>a+r*r,0)/degrees:0,plain=mean([...raw.values()].map(r=>r.level));
 const varianceBetween=groups.size>1?Math.max(0,[...raw.values()].reduce((a,r)=>a+(r.level-plain)**2,0)/(groups.size-1)-varianceWithin*mean([...raw.values()].map(r=>1/r.n))):0;
 const shrink=!measured||groups.size<3?SAMPLE_RULES.shrink:varianceBetween>0?clamp(varianceWithin/varianceBetween,SAMPLE_RULES.minShrink,SAMPLE_RULES.maxShrink):SAMPLE_RULES.maxShrink;
 const weight=n=>n/(n+shrink),weights=[...raw.values()].reduce((a,r)=>a+weight(r.n),0),typical=[...raw.values()].reduce((a,r)=>a+weight(r.n)*r.level,0)/weights;
 const states=Object.fromEntries([...raw].map(([state,r])=>[state,{n:r.n,raw:r.level,level:typical+weight(r.n)*(r.level-typical)}]));
 const smear=mean(usable.map(s=>Math.exp(y(s)-states[s.state].level-slope*x(s))));
 return {n:usable.length,measured,slope,typical,states,shrink,smear,scatter:Math.sqrt(varianceWithin)};
}
/** Expected reports per year of one unit. level overrides the level of the state (used for states without examples). */
export function predict(model,population,state,level){
 if(!model||!(population>0))return 0;
 return Math.exp((level??model.states[state]?.level??model.typical)+model.slope*Math.log(population))*model.smear;
}
/** How far a state lies above or below the typical level: 1.2 means 20 % more reports at the same size. */
export const stateFactor=(model,state)=>model?.states[state]?Math.exp(model.states[state].level-model.typical):1;
const FALLBACK_SLOPE={municipality:1,district:0,association:0,borough:0};
const sumOf=(populations,fn)=>{let total=0;for(const p of populations)total+=fn(p);return total;};
const FRAME_KEY={district:'districts',association:'associations',borough:'boroughs'};
/**
 * One complete calculation: a model per level and the sum over every unit of the frame.
 * frame: {municipalities:{state:[inhabitants…]}, districts:{…}, associations:{…}, boroughs:{…}}
 * pick(model): level for a state without examples; undefined means the typical level.
 * Returns reports per year by cell: cells[state][class].
 */
function calculate(samples,frame,pick=()=>undefined){
 const models=Object.fromEntries(Object.keys(LEVELS).map(level=>[level,fitLevel(samples.filter(s=>s.level===level),FALLBACK_SLOPE[level])]));
 // A level without any example of its own is described by the municipal model at its size. That is an assumption.
 const used={...models};for(const level of ['association','borough'])if(!used[level])used[level]=models.municipality;
 const cells={};
 for(const state of Object.keys(FEDERAL_STATES)){
  const cell=cells[state]={},levelOf=model=>model&&!model.states[state]?pick(model):undefined;
  for(const c of SIZE_CLASSES)cell[c.id]=0;
  const municipal=levelOf(models.municipality);
  for(const p of frame.municipalities[state]||[])cell[sizeClass('city',p)]+=predict(models.municipality,p,state,municipal);
  for(const [id,key] of Object.entries(FRAME_KEY)){const own=levelOf(used[id]);cell[id]=sumOf(frame[key][state]||[],p=>predict(used[id],p,state,own));}
 }
 return {models,cells};
}
const totalOf=(cells,filter=()=>true)=>{let total=0;for(const [state,cell] of Object.entries(cells))for(const [id,value] of Object.entries(cell))if(filter(state,id))total+=value;return total;};
/**
 * Two checks of the model against examples it has not seen.
 * - single: every example is left out once and predicted from all the others (its state keeps its other examples).
 * - states: every state with at least three examples of a level is left out as a whole and predicted with the
 *   typical level of the remaining states. This is the situation of the states without any example.
 */
export function validate(samples){
 const rows=[],states=[];
 for(const level of Object.keys(LEVELS)){
  const own=samples.filter(s=>s.level===level&&s.population>0&&s.reports>0);
  if(own.length<SAMPLE_RULES.minForModel+1)continue;
  for(const s of own){const model=fitLevel(own.filter(o=>o!==s),FALLBACK_SLOPE[level]);rows.push({id:s.id,name:s.name,level,state:s.state,population:s.population,actual:s.reports,predicted:predict(model,s.population,s.state)});}
  for(const [state,group] of groupByState(own)){
   const others=own.filter(o=>o.state!==state);if(group.length<3||others.length<SAMPLE_RULES.minForModel)continue;
   const model=fitLevel(others,FALLBACK_SLOPE[level]),actual=group.reduce((n,s)=>n+s.reports,0),predicted=group.reduce((n,s)=>n+predict(model,s.population,state),0);
   states.push({level,state,name:FEDERAL_STATES[state],examples:group.length,actual,predicted,error:predicted/actual-1});
  }
 }
 if(!rows.length)return {n:0,medianError:null,bias:null,within50:null,rows,states};
 const errors=rows.map(r=>Math.abs(r.predicted-r.actual)/r.actual);
 return {n:rows.length,medianError:quantile(errors,.5),bias:rows.reduce((a,r)=>a+r.predicted,0)/rows.reduce((a,r)=>a+r.actual,0)-1,within50:errors.filter(e=>e<=.5).length/errors.length,rows,states};
}
/**
 * samples: complete-year examples {id,name,level,state,population,reports}
 * frame:   inhabitants of every unit of Germany by level and state (shared/germany-population.json)
 */
export function estimateGermany({samples,frame,replicates=SAMPLE_RULES.replicates,seed=SAMPLE_RULES.seed}){
 const point=calculate(samples,frame),rng=random(seed),runs=[];
 // Bootstrap: draw the examples again with replacement, separately for every level and state, and recalculate.
 const strata=[...new Map(samples.map(s=>[s.level+'|'+s.state,null])).keys()].map(key=>samples.filter(s=>s.level+'|'+s.state===key));
 for(let i=0;i<replicates;i++){
  const draw=strata.flatMap(own=>own.map(()=>own[Math.floor(rng()*own.length)]));
  // A state without examples takes the level of a randomly chosen measured state in this draw.
  runs.push(calculate(draw,frame,model=>{const levels=Object.values(model.states);return levels[Math.floor(rng()*levels.length)].level;}).cells);
 }
 const figure=filter=>{
  const perYear=totalOf(point.cells,filter),values=runs.map(cells=>totalOf(cells,filter));
  return {perYear,lowPerYear:values.length?Math.min(perYear,quantile(values,SAMPLE_RULES.rangeLow)):perYear,highPerYear:values.length?Math.max(perYear,quantile(values,SAMPLE_RULES.rangeHigh)):perYear};
 };
 const classes=SIZE_CLASSES.map(c=>{
  const municipal=c.min!==undefined,lists=municipal?null:frame[FRAME_KEY[c.id]],populations=lists?Object.values(lists).flat():Object.values(frame.municipalities).flat().filter(p=>sizeClass('city',p)===c.id);
  const level=municipal?'municipality':c.id,own=samples.filter(s=>areaClass(s)===c.id),model=point.models[level];
  // measured: examples of this class carry the figure. thin: one or two. model: the model reaches into a class without
  // examples of its own. assumed: the level has no example at all and borrows the municipal model.
  const basis=!model?(municipal?'none':'assumed'):!model.measured?'thin':own.length>=3?'measured':own.length?'thin':'model';
  return {id:c.id,name:c.name,range:c.range,level,basis,samples:own.length,germany:{count:populations.length,population:populations.reduce((a,b)=>a+b,0)},...figure((state,id)=>id===c.id)};
 });
 const municipalIds=new Set(SIZE_CLASSES.filter(c=>c.min!==undefined).map(c=>c.id));
 const states=Object.entries(FEDERAL_STATES).map(([id,name])=>{
  const population=sumOf(frame.municipalities[id]||[],p=>p)+sumOf(frame.associations[id]||[],p=>p)+(frame.cityStates?.[id]||0),f=figure(state=>state===id);
  return {id,name,municipalities:(frame.municipalities[id]||[]).length,districts:(frame.districts[id]||[]).length,associations:(frame.associations[id]||[]).length,boroughs:(frame.boroughs[id]||[]).length,population,samples:samples.filter(s=>s.state===id).length,
   factors:Object.fromEntries(Object.keys(LEVELS).map(level=>[level,point.models[level]?.states[id]?{examples:point.models[level].states[id].n,factor:stateFactor(point.models[level],id)}:null])),...f,perDay:f.perYear/365,per1000:population?1000*f.perYear/population:0};
 }).sort((a,b)=>b.perYear-a.perYear);
 const levels=Object.entries(LEVELS).map(([id,name])=>({id,name,samples:samples.filter(s=>s.level===id).length,model:point.models[id],assumed:!point.models[id],...figure((state,cls)=>id==='municipality'?municipalIds.has(cls):cls===id)}));
 const total=figure();
 return {classes,states,levels,cells:point.cells,replicates:runs,validation:validate(samples),sampleCount:samples.length,
  total:{...total,perDay:total.perYear/365,lowPerDay:total.lowPerYear/365,highPerDay:total.highPerYear/365,perWorkday:total.perYear/SAMPLE_RULES.workdaysPerYear}};
}
/**
 * How much of the estimated volume can be read today?
 * units: the random sample outside NRW with the outcome of the source search (connected, unreadable, link, none)
 * known: areas whose state is known exactly (NRW catalog): {level,state,population,connected}
 * Shares are weighted by the expected reports of each unit, so a large city counts more than a village.
 */
export function capture({units,known,models,cells,knownState='05'}){
 const expected=u=>predict(models[u.level]||models.municipality,u.population,u.state)||1;
 const classes=SIZE_CLASSES.map(c=>{
  const own=units.filter(u=>areaClass(u)===c.id),weight=own.reduce((n,u)=>n+expected(u),0),share=outcomes=>weight?own.filter(u=>outcomes.includes(u.outcome)).reduce((n,u)=>n+expected(u),0)/weight:null;
  const elsewhere=Object.entries(cells).reduce((n,[state,cell])=>n+(state===knownState?0:cell[c.id]||0),0),mine=known.filter(a=>areaClass(a)===c.id),knownTotal=cells[knownState]?.[c.id]||0;
  const knownWeight=mine.reduce((n,a)=>n+expected(a),0),knownConnected=knownWeight?knownTotal*mine.filter(a=>a.connected).reduce((n,a)=>n+expected(a),0)/knownWeight:0;
  const connected=share(['connected']),unreadable=share(['unreadable']);
  return {id:c.id,name:c.name,units:own.length,counts:{connected:own.filter(u=>u.outcome==='connected').length,unreadable:own.filter(u=>u.outcome==='unreadable').length,unknown:own.filter(u=>u.outcome==='link'||u.outcome==='none').length},connected,unreadable,
   known:{areas:mine.length,connected:mine.filter(a=>a.connected).length},
   // unreadable and unknown describe the sample outside the known state; there the reason is not broken down.
   perYear:{connected:(connected||0)*elsewhere+knownConnected,unreadable:(unreadable||0)*elsewhere,unknown:(1-(connected||0)-(unreadable||0))*elsewhere,knownOpen:knownTotal-knownConnected,total:elsewhere+knownTotal}};
 });
 const keys=['connected','unreadable','unknown','knownOpen','total'],total=Object.fromEntries(keys.map(key=>[key,classes.reduce((n,c)=>n+c.perYear[key],0)]));
 return {classes,total:{...total,connectedShare:total.total?total.connected/total.total:0}};
}
/**
 * Distribution over the year, pooled over the examples: share per calendar month and weekday, the strongest
 * weeks, and how often a report returns to an agenda.
 * examples: {reports,weeks[53],weekdays[7],monthly[12],followUps,consultations}
 */
export function seasonality(examples){
 const add=key=>examples.reduce((sum,e)=>sum.map((v,i)=>v+(e[key]?.[i]||0)),Array(key==='weeks'?53:key==='weekdays'?7:12).fill(0));
 const weeks=add('weeks').slice(0,52),weekdays=add('weekdays'),monthly=add('monthly'),total=weeks.reduce((a,b)=>a+b,0),share=list=>{const sum=list.reduce((a,b)=>a+b,0);return list.map(v=>sum?v/sum:0);};
 const reports=examples.reduce((n,e)=>n+e.reports,0),average=total/52;
 return {weeks:weeks.map(v=>average?v/average:0),weekdays:share(weekdays),monthly:share(monthly),
  // A strong week: only one week in twenty is stronger. The strongest weekday of such a week is the planning peak.
  strongWeek:average?quantile(weeks,.95)/average:1,quietWeeks:weeks.filter(v=>v<average/4).length,peakWeekday:Math.max(...share(weekdays)),
  followUpShare:reports?examples.reduce((n,e)=>n+(e.followUps||0),0)/reports:0,consultationsPerReport:reports?examples.reduce((n,e)=>n+(e.consultations||e.reports),0)/reports:1};
}
