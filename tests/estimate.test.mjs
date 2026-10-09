import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {SIZE_CLASSES,LEVELS,SAMPLE_RULES,FEDERAL_STATES,MIN_PROJECTED_WEEKS,annualize,sizeClass,areaClass,sampleQuality,profile,fitLevel,predict,stateFactor,validate,estimateGermany,capture,seasonality,quantile,random} from '../shared/estimate.mjs';
import {summarizeSize,areaMeans,estimateVolume,SIZE_FIELDS,SIZE_RULES,VARIANTS,PAGE_BINS} from '../shared/estimate-size.mjs';
import {documentType,primaryDocument,DOCUMENT_TYPES} from '../shared/document-type.mjs';
import {adminEstimate} from '../server/integrations/admin-estimate.mjs';
import {storedEstimate,computeEstimate} from '../server/integrations/admin-estimate-store.mjs';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {refreshRegionFacts} from '../server/integrations/region-facts.mjs';
import frame from '../shared/germany-population.json' with {type:'json'};
import population from '../shared/nrw-population.json' with {type:'json'};
import regions from '../shared/nrw-regions.json' with {type:'json'};
import sample from '../shared/estimate-samples.json' with {type:'json'};
import sizeSample from '../shared/document-size-sample.json' with {type:'json'};
const period={from:'2025-10-03',to:'2026-10-02'};
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,a+' ≠ '+b);
test('size classes cover every municipality; the other levels are their own class',()=>{
 assert.deepEqual(SIZE_CLASSES.map(c=>c.id),['tiny','small','medium','large','xlarge','district','association','borough']);
 assert.deepEqual(Object.keys(LEVELS),['municipality','district','association','borough']);
 assert.equal(sizeClass('city',4999),'tiny');assert.equal(sizeClass('city',5000),'small');assert.equal(sizeClass('city',20000),'medium');assert.equal(sizeClass('city',100000),'large');assert.equal(sizeClass('city',500000),'xlarge');assert.equal(sizeClass('district',90000),'district');
 assert.equal(areaClass({level:'municipality',population:12000}),'small');assert.equal(areaClass({level:'association',population:12000}),'association');assert.equal(areaClass({level:'borough',population:300000}),'borough');assert.equal(areaClass({population:700000}),'xlarge');
});
test('the population frame holds every unit of Germany exactly once',()=>{
 for(const r of regions)assert.ok(population[r.id]>1000,r.name);
 const count=lists=>Object.values(lists).reduce((n,l)=>n+l.length,0),sum=lists=>Object.values(lists).flat().reduce((a,b)=>a+b,0);
 assert.deepEqual(Object.keys(frame.municipalities).sort(),Object.keys(FEDERAL_STATES).sort());
 // Municipalities outside an association, the members inside associations, and the two city states add up to all municipalities.
 assert.equal(count(frame.municipalities)+frame.totals.memberMunicipalities+2,frame.totals.municipalities);
 assert.equal(sum(frame.municipalities)+sum(frame.associations)+frame.cityStates['11']+frame.cityStates['02'],frame.totals.population);
 assert.equal(count(frame.districts),294);assert.equal(count(frame.associations),frame.totals.associations);
 assert.equal(frame.boroughs['11'].length,12);assert.equal(frame.boroughs['02'].length,7);assert.equal(frame.municipalities['11'].length,0);
 // NRW has no associations; Rhineland-Palatinate consists almost only of them; in Baden-Württemberg members stay independent.
 assert.equal(frame.municipalities['05'].length,396);assert.equal(frame.associations['05'].length,0);assert.equal(frame.districts['05'].length,31);
 assert.ok(frame.associations['07'].length>120&&frame.municipalities['07'].length<60);assert.equal(frame.associations['08'].length,0);assert.ok(frame.municipalities['08'].length>1000);
 assert.ok(frame.totals.population>82e6&&frame.totals.population<85e6);assert.ok(frame.totals.municipalities>10500&&frame.totals.municipalities<11200);
});
const area=(id,pop,reports,extra={})=>({id,name:id,level:'municipality',state:'05',population:pop,reports,months:11,meetingDays:40,firstDay:'2025-10-08',lastDay:'2026-09-29',notes:[],...extra});
test('an example area must cover the whole year; the reason for an exclusion is named',()=>{
 assert.deepEqual(sampleQuality(area('a',12000,400),period),{complete:true,reason:''});
 assert.match(sampleQuality(area('a',12000,0),period).reason,/keine Berichte/);
 assert.match(sampleQuality(area('a',12000,400,{firstDay:'2025-12-09'}),period).reason,/beginnt erst am 09\.12\.2025/);
 assert.equal(sampleQuality(area('a',12000,400,{firstDay:'2025-11-17'}),period).complete,true,'45 days of slack at the start');
 assert.match(sampleQuality(area('a',12000,400,{lastDay:'2026-07-15'}),period).reason,/endet am 15\.07\.2026/);
 assert.match(sampleQuality(area('a',12000,400,{months:8}),period).reason,/nur 8 von 12 Monaten/);
 assert.match(sampleQuality(area('a',12000,400,{notes:['Listenlimit erreicht; Quelle noch nicht vollständig eingelesen.']}),period).reason,/Abruf war begrenzt/);
 assert.equal(sampleQuality(area('a',12000,400,{notes:['https://x/si0057.asp?__ksinr=1: Zeitbudget der Quelle erreicht']}),period).complete,true,'one unread meeting does not disqualify the year');
 assert.match(sampleQuality(area('a',12000,400,{error:'fetch failed'}),period).reason,/Abruf fehlgeschlagen/);
 assert.match(sampleQuality(area('a',12000,400,{meetings:100,unreadableMeetings:16}),period).reason,/16 von 100 Sitzungen ohne lesbare Tagesordnung/);
 assert.equal(sampleQuality(area('a',12000,400,{meetings:100,unreadableMeetings:15}),period).complete,true);
});
test('a measured run of a council that meets rarely may leave long gaps, but not implausible ones',()=>{
 // Four meeting days a year: on average 91 days apart, so a gap of up to 365 days (four times) is no break.
 const village=area('v',300,60,{measured:true,meetingDays:4,months:4,firstDay:'2025-11-27',lastDay:'2026-06-20'});
 assert.equal(sampleQuality(village,period).complete,true);
 assert.match(sampleQuality({...village,measured:false},period).reason,/beginnt erst am 27\.11\.2025/,'stored stock keeps the strict rules');
 // Six meeting days within three months of a large city: the list was cut, 270 days are more than 4 × 61.
 assert.match(sampleQuality(area('c',160000,287,{measured:true,meetingDays:6,months:3,firstDay:'2026-06-30'}),period).reason,/beginnt erst am 30\.06\.2026/);
 // Many meeting days: the usual slack applies, and months are not required of a measured run.
 assert.equal(sampleQuality(area('d',240000,170,{measured:true,meetingDays:20,months:6,firstDay:'2025-11-04'}),period).complete,true);
 assert.match(sampleQuality(area('e',22000,250,{measured:true,meetingDays:14,months:5,lastDay:'2026-02-10'}),period).reason,/endet am 10\.02\.2026/);
});
test('the profile sorts the days of a year into weeks, weekdays and calendar months',()=>{
 const p=profile([['2025-10-03',2],['2025-10-06',5],['2025-10-10',1],['2026-10-02',4],['2025-10-02',9],['2026-03-18',3]],'2025-10-03');
 assert.equal(p.weeks.length,53);assert.equal(p.weeks[0],2+5);assert.equal(p.weeks[1],1);assert.equal(p.weeks[52],4);assert.equal(p.weeks.reduce((a,b)=>a+b,0),15,'the day before the period is ignored');
 assert.deepEqual(p.weekdays,[5,0,3,0,2+1+4,0,0]);assert.equal(p.monthly[9],12);assert.equal(p.monthly[2],3);
});
test('a partial stock is projected to a year by the share its weeks usually carry',()=>{
 const even=Array(52).fill(1),stock={reports:40,firstDay:'2025-10-03',lastDay:'2025-10-30'};
 // Four of 52 even weeks hold 40 reports: 520 a year.
 assert.deepEqual(annualize(stock,period,even),{annual:520,weeks:4});
 // The same four weeks are twice as strong as an average week: the year is only half as large.
 const strong=[...even];for(let i=0;i<4;i++)strong[i]=2;near(annualize(stock,period,strong).annual,260);
 // Weeks before the period and after its last week do not count; too few weeks give no figure.
 assert.equal(annualize({reports:40,firstDay:'2025-09-01',lastDay:'2025-10-20'},period,even).weeks,3);
 assert.equal(annualize({reports:40,firstDay:'2025-10-03',lastDay:'2025-10-12'},period,even),null);assert.equal(MIN_PROJECTED_WEEKS,3);
 assert.equal(annualize({reports:0,firstDay:'2025-10-03',lastDay:'2026-01-30'},period,even),null);assert.equal(annualize({reports:5},period,even),null);
 assert.equal(annualize(stock,period,Array(52).fill(0)),null,'no usual share, no projection');
});
test('the model recovers slope and state levels from exact data',()=>{
 // Two states on the same slope 0.6; the second state lies at twice the level.
 const sizes=[1000,5000,20000,80000,300000,1000000],a=sizes.map((p,i)=>area('a'+i,p,2*p**.6,{state:'05'})),b=sizes.map((p,i)=>area('b'+i,p,4*p**.6,{state:'09'}));
 const model=fitLevel([...a,...b],1);
 assert.equal(model.measured,true);near(model.slope,.6,1e-9);assert.equal(model.n,12);near(model.scatter,0,1e-9);
 // No scatter within states: the states are trusted as far as the rules allow (two states are too few to compare the scatter, so the fixed weight applies).
 assert.equal(model.shrink,SAMPLE_RULES.shrink);assert.ok(model.smear>1&&model.smear<1.02,'the remaining pull towards the typical level is corrected by the smearing factor');
 near(stateFactor(model,'09')/stateFactor(model,'05'),2**(6/(6+SAMPLE_RULES.shrink)),1e-6);
 // A state without examples gets the typical level, between the two.
 const unknown=predict(model,50000,'07');assert.ok(unknown>predict(model,50000,'05')&&unknown<predict(model,50000,'09'));near(unknown,Math.sqrt(2*4)*50000**.6*model.smear,1e-3);
 assert.equal(stateFactor(model,'07'),1);assert.equal(predict(model,0,'05'),0);assert.equal(predict(null,5000,'05'),0);
 near(predict(model,50000,'07',Math.log(10)),10*50000**.6*model.smear,1e-6,'an explicit level overrides the state');
});
test('with few examples the slope is set, not measured; implausible slopes are limited',()=>{
 // Fewer than six examples: municipalities fall back to reports per inhabitant, other levels to reports per unit.
 const few=[area('a',10000,300),area('b',30000,500)],rate=fitLevel(few,1),unit=fitLevel(few,0);
 assert.equal(rate.measured,false);assert.equal(rate.slope,1);assert.equal(unit.slope,0);
 near(predict(unit,123456,'05'),Math.sqrt(300*500)*unit.smear,1e-6);near(predict(unit,10000,'05')+predict(unit,30000,'05'),2*Math.sqrt(300*500)*unit.smear,1e-6);
 assert.equal(fitLevel([],1),null);assert.equal(fitLevel([area('z',0,10)],1),null);
 // Districts: more inhabitants, fewer reports in the data — the slope is limited to 0, the model is the mean per unit.
 const falling=[[60000,270],[90000,240],[130000,250],[130000,540],[190000,245],[260000,136],[350000,236]].map(([p,r],i)=>area('d'+i,p,r,{level:'district'})),flat=fitLevel(falling,0);
 assert.equal(flat.measured,true);assert.equal(flat.slope,0);near(predict(flat,100000,'05'),falling.reduce((n,s)=>n+s.reports,0)/falling.length,1e-6,'the smearing factor turns the geometric mean into the mean');
 // A slope above 1 is limited to 1.
 const steep=[1000,2000,4000,8000,16000,32000].map((p,i)=>area('s'+i,p,p**1.4/100));assert.equal(fitLevel(steep,1).slope,1);
 // All examples of one size: no slope can be measured.
 assert.equal(fitLevel([1,2,3,4,5,6].map(i=>area('e'+i,10000,100*i)),1).measured,false);
});
test('a state with few examples is pulled towards the typical level',()=>{
 const sizes=[2000,6000,15000,40000,90000,250000],noise=[1.3,.8,1.1,.7,1.25,.9];
 const many=[...sizes,...sizes].map((p,i)=>area('n'+i,p,3*p**.5*noise[i%6]*(i<6?1:1.1),{state:'05'})),other=sizes.map((p,i)=>area('o'+i,p,3*p**.5*noise[(i+2)%6],{state:'03'})),third=sizes.map((p,i)=>area('t'+i,p,3.6*p**.5*noise[(i+4)%6],{state:'07'}));
 const one=area('x',30000,3*3*30000**.5,{state:'09'}),model=fitLevel([...many,...other,...third,one],1);
 assert.equal(model.states['09'].n,1);const raw=Math.exp(model.states['09'].raw-model.typical),factor=stateFactor(model,'09');
 assert.ok(raw>2.2,'the single example lies far above the others');assert.ok(factor>1&&factor<raw,'its state is trusted only in part: '+factor);
 near(Math.log(factor)/Math.log(raw),1/(1+model.shrink),1e-9);assert.ok(model.shrink>=SAMPLE_RULES.minShrink&&model.shrink<=SAMPLE_RULES.maxShrink);
});
const emptyLists=()=>Object.fromEntries(Object.keys(FEDERAL_STATES).map(s=>[s,[]]));
const smallFrame={municipalities:{...emptyLists(),'05':[600000,50000,10000],'09':[40000,3000,3000],'07':[8000]},districts:{...emptyLists(),'05':[300000],'09':[100000,100000]},associations:{...emptyLists(),'07':[20000,10000]},boroughs:{...emptyLists(),'11':[300000]},cityStates:{'11':3600000,'02':1900000}};
test('the estimate sums the model over every unit of the frame, by class, level and federal state',()=>{
 const samples=[...[1000,5000,20000,80000,300000,1000000].map((p,i)=>area('n'+i,p,2*p**.6)),area('k1',250000,400,{level:'district'}),area('k2',400000,500,{level:'district'})];
 const e=estimateGermany({samples,frame:smallFrame,replicates:50}),curve=p=>2*p**.6,by=Object.fromEntries(e.classes.map(c=>[c.id,c]));
 near(by.xlarge.perYear,curve(600000),1e-3);near(by.medium.perYear,curve(50000)+curve(40000),1e-3);near(by.small.perYear,curve(10000)+curve(8000),1e-3);near(by.tiny.perYear,2*curve(3000),1e-3);
 assert.deepEqual([by.xlarge.germany.count,by.medium.germany.count,by.small.germany.count,by.tiny.germany.count],[1,2,2,2]);assert.equal(by.medium.germany.population,90000);
 // Districts: two examples are too few to measure a slope, so reports per unit (geometric mean, corrected to the mean).
 const perDistrict=predict(e.levels.find(l=>l.id==='district').model,1,'05');near(perDistrict,450,1e-6);near(by.district.perYear,3*450,1e-6);assert.equal(by.district.basis,'thin');
 // Associations and boroughs have no example: they borrow the municipal model at their size, marked as assumed.
 assert.equal(by.association.basis,'assumed');near(by.association.perYear,curve(20000)+curve(10000),1e-3);assert.equal(by.borough.basis,'assumed');near(by.borough.perYear,curve(300000),1e-3);
 assert.equal(by.xlarge.basis,'thin');assert.equal(by.medium.basis,'thin');assert.equal(by.tiny.basis,'thin');
 const total=e.classes.reduce((n,c)=>n+c.perYear,0);near(e.total.perYear,total,1e-6);near(e.total.perDay,total/365,1e-6);near(e.total.perWorkday,total/250,1e-6);
 near(e.states.reduce((n,s)=>n+s.perYear,0),total,1e-6);near(e.levels.reduce((n,l)=>n+l.perYear,0),total,1e-6);
 near(Object.values(e.cells).reduce((n,cell)=>n+Object.values(cell).reduce((a,b)=>a+b,0),0),total,1e-6);assert.equal(e.replicates.length,50);
 const nrw=e.states.find(s=>s.id==='05'),berlin=e.states.find(s=>s.id==='11'),rlp=e.states.find(s=>s.id==='07');
 near(nrw.perYear,curve(600000)+curve(50000)+curve(10000)+450,1e-3);assert.deepEqual(nrw.factors.municipality,{examples:6,factor:1});assert.equal(nrw.factors.association,null);
 near(berlin.perYear,curve(300000),1e-3);assert.equal(berlin.boroughs,1);assert.equal(berlin.population,3600000);
 // What the figures rest on: NRW on its own examples, the other states on the typical level or on a borrowed model.
 near(e.basis.own,nrw.perYear,1e-6);near(e.basis.borrowed,by.association.perYear+by.borough.perYear,1e-6);near(e.basis.own+e.basis.typical+e.basis.borrowed,total,1e-6);near(nrw.ownShare,1);assert.equal(berlin.ownShare,0);assert.equal(rlp.ownShare,0);
 near(rlp.perYear,curve(8000)+curve(20000)+curve(10000),1e-3);assert.equal(rlp.associations,2);assert.equal(rlp.factors.municipality,null);assert.equal(rlp.population,38000);
 assert.deepEqual(e.states.map(s=>s.perYear),[...e.states.map(s=>s.perYear)].sort((a,b)=>b-a),'sorted by volume');
 // Range: every figure lies inside its range; exact data leave no range for the municipal classes.
 for(const c of e.classes)assert.ok(c.lowPerYear<=c.perYear+1e-9&&c.highPerYear>=c.perYear-1e-9,c.id);
 assert.ok(e.total.lowPerYear<=e.total.perYear&&e.total.highPerYear>=e.total.perYear);assert.ok((by.xlarge.highPerYear-by.xlarge.lowPerYear)/by.xlarge.perYear<.01);
 assert.ok(by.district.highPerYear>by.district.lowPerYear,'two unequal examples give a range');
 // The same data and seed always give the same range.
 assert.deepEqual(estimateGermany({samples,frame:smallFrame,replicates:50}).total,e.total);
 // Without any example nothing is invented.
 const empty=estimateGermany({samples:[],frame:smallFrame,replicates:5});assert.equal(empty.total.perYear,0);assert.ok(empty.classes.every(c=>c.perYear===0));assert.equal(empty.validation.n,0);assert.equal(empty.classes[0].basis,'none');
});
test('a state without examples widens the range by the differences between the measured states',()=>{
 const sizes=[1000,5000,20000,80000,300000,1000000],samples=[...sizes.map((p,i)=>area('a'+i,p,2*p**.6,{state:'05'})),...sizes.map((p,i)=>area('b'+i,p,6*p**.6,{state:'09'}))];
 const e=estimateGermany({samples,frame:smallFrame,replicates:200}),rlp=e.states.find(s=>s.id==='07'),nrw=e.states.find(s=>s.id==='05');
 // Rhineland-Palatinate has no example: in each draw it takes the level of NRW or of Bavaria.
 assert.ok(rlp.highPerYear/rlp.lowPerYear>1.5,'range '+rlp.lowPerYear+' – '+rlp.highPerYear);
 assert.ok(nrw.highPerYear/nrw.lowPerYear<1.05,'a measured state with exact data has almost no range');
});
test('validation predicts every example from the others and every state from the other states',()=>{
 const sizes=[1000,5000,20000,80000,300000,1000000,2000,40000],exact=sizes.map((p,i)=>area('x'+i,p,2*p**.6));
 const perfect=validate(exact);assert.equal(perfect.n,8);near(perfect.medianError,0,1e-9);near(perfect.bias,0,1e-9);assert.equal(perfect.within50,1);assert.deepEqual(perfect.states,[]);
 // One area with three times the expected volume is predicted too low by the others.
 const outlier=validate([...exact,area('out',10000,3*2*10000**.6)]),row=outlier.rows.find(r=>r.id==='out');
 assert.ok(row.predicted<row.actual*.6);assert.ok(outlier.medianError>0);assert.equal(outlier.n,9);
 // A second state at 1.5 times the level: left out as a whole, it is predicted from the first state alone — 33 % too low.
 const two=validate([...exact,...sizes.map((p,i)=>area('y'+i,p,3*p**.6,{state:'09'}))]),bavaria=two.states.find(s=>s.state==='09'),nrw=two.states.find(s=>s.state==='05');
 near(bavaria.error,-1/3,1e-6);near(nrw.error,.5,1e-6);assert.equal(bavaria.examples,8);assert.equal(bavaria.name,'Bayern');assert.equal(bavaria.level,'municipality');
 // Too few examples of a level: no check is claimed.
 assert.equal(validate(exact.slice(0,5)).n,0);
});
test('capturability weights the outcomes of the source search by the expected reports',()=>{
 const samples=[1000,5000,20000,80000,300000,1000000].map((p,i)=>area('n'+i,p,p/100)),e=estimateGermany({samples,frame:smallFrame,replicates:0}),models=Object.fromEntries(e.levels.map(l=>[l.id,l.model]));
 const unit=(population,outcome,level='municipality',state='09')=>({level,state,population,outcome});
 const c=capture({units:[unit(30000,'connected'),unit(60000,'unreadable'),unit(30000,'none'),unit(3000,'link'),unit(200000,'unreadable','borough','11')],known:[{level:'municipality',state:'05',population:600000,connected:true},{level:'municipality',state:'05',population:50000,connected:false},{level:'municipality',state:'05',population:25000,connected:true},{level:'district',state:'05',population:300000,connected:false}],models,cells:e.cells});
 const by=Object.fromEntries(c.classes.map(x=>[x.id,x]));
 // Medium towns of the sample: 30,000 of 120,000 expected reports are readable, 60,000 unreadable.
 near(by.medium.connected,.25);near(by.medium.unreadable,.5);assert.deepEqual(by.medium.counts,{connected:1,unreadable:1,unknown:1});assert.equal(by.medium.units,3);
 // Outside NRW there is one medium town in the frame (40,000 → 400 reports); in NRW one of 50,000 with two known areas.
 near(by.medium.perYear.connected,.25*400+500*25000/75000);near(by.medium.perYear.unreadable,.5*400);near(by.medium.perYear.unknown,.25*400);near(by.medium.perYear.knownOpen,500*50000/75000);near(by.medium.perYear.total,900);
 assert.deepEqual(by.medium.known,{areas:2,connected:1});near(by.xlarge.perYear.connected,6000);assert.equal(by.xlarge.connected,null,'no unit of the sample in this class');
 near(by.tiny.perYear.unknown,60);near(by.borough.unreadable,1);near(by.district.perYear.knownOpen,e.cells['05'].district);
 near(c.total.total,e.total.perYear,1e-6);near(c.total.connected+c.total.unreadable+c.total.unknown+c.total.knownOpen,c.total.total,1e-6);near(c.total.connectedShare,c.total.connected/c.total.total);
});
test('seasonality pools the examples: strongest weeks, weekdays, returning reports',()=>{
 const weeks=Array(53).fill(10);for(const i of [5,6,20,21])weeks[i]=40;weeks[30]=0;weeks[31]=0;weeks[52]=3;
 const s=seasonality([{reports:520,weeks,weekdays:[100,150,150,100,20,0,0],monthly:Array(12).fill(40),followUps:130,consultations:700},{reports:0,weeks:Array(53).fill(0),weekdays:Array(7).fill(0),monthly:Array(12).fill(0)}]);
 assert.equal(s.weeks.length,52,'the incomplete last week is left out');near(s.weeks.reduce((a,b)=>a+b,0),52);
 near(s.weekdays[1],150/520);near(s.peakWeekday,150/520);near(s.monthly.reduce((a,b)=>a+b,0),1);assert.equal(s.quietWeeks,2);
 near(s.followUpShare,.25);near(s.consultationsPerReport,700/520);near(s.strongWeek,40/(620/52));
 const none=seasonality([]);assert.equal(none.strongWeek,1);assert.equal(none.consultationsPerReport,1);
});
test('document types are read from titles; the pipeline reads the paper first',()=>{
 const expect={'Beschlussvorlage 12/2026':'paper','Antrag der Fraktion':'paper','Mitteilungsvorlage':'paper','Beschlussempfehlung SBR':'paper','Anlage 1 Lageplan':'attachment','Vorlage (Anlage 2)':'attachment','Stellungnahme':'attachment','Niederschrift öffentlich':'minutes','Öffentliches Beschlussprotokoll':'minutes','Beschluss von 12.03.':'decision','Beschlusstext (Beratung)':'decision','Beschlussausfertigung SBR':'decision','Auszug von':'decision','Einladung Rat':'invitation','Bekanntmachung (Hauptausschuss)':'invitation','Sammeldokument öffentlich':'invitation','12/2026':'other','':'other'};
 for(const [title,type] of Object.entries(expect))assert.equal(documentType(title),type,title);
 assert.deepEqual(Object.keys(DOCUMENT_TYPES).sort(),[...new Set(Object.values(expect))].sort());assert.equal(documentType(null),'other');
 const docs=[{title:'Anlage 1'},{title:'Beschlussvorlage'},{title:'Bericht'}];assert.equal(primaryDocument(docs),docs[1]);assert.equal(primaryDocument([docs[0],docs[2]]),docs[2]);assert.equal(primaryDocument([docs[0]]),docs[0]);assert.equal(primaryDocument([]),null);
});
const pdf=(type,share,pages,tokens,extra={})=>({type,share,primary:false,format:'pdf',bytes:pages*50000,pages,chars:tokens*3,scanPages:0,tokens,tokensOther:Math.round(tokens*.7),...extra});
const measured={from:period.from,to:period.to,measuredAt:'2026-10-02',tokenizer:'test',perArea:2,areas:[{id:'a',name:'A',level:'municipality',state:'05',population:30000,class:'medium',external:false,reports:100,withDocuments:60,links:200,distinct:120},{id:'b',name:'B',level:'district',state:'09',population:200000,class:'district',external:true,reports:50,withDocuments:20,links:30,distinct:30}],reports:[
 // paper (own) + attachment (own) + minutes shared by 10 reports
 {area:'a',linked:3,documents:[pdf('paper',1,4,2000,{primary:true}),pdf('attachment',1,30,15000),pdf('minutes',10,50,40000)]},
 // one readable paper, one failed download: the report is scaled by 2
 {area:'a',linked:2,documents:[pdf('paper',1,2,1000,{primary:true}),{type:'attachment',share:1,primary:false,error:'HTTP 500'}]},
 // a long scanned paper of 200 pages without text, a file above the limit and a text file that is not a PDF
 {area:'b',linked:3,documents:[pdf('paper',1,200,300,{primary:true,scanPages:190}),{type:'attachment',share:1,primary:false,bytes:30e6,large:true},{type:'other',share:2,primary:false,bytes:4000,format:'html'}]},
 // every download failed: the report cannot be used
 {area:'b',linked:1,documents:[{type:'paper',share:1,primary:true,error:'timeout'}]},
]};
test('the measurement is condensed to one row per report; shared documents count with their share',()=>{
 const s=summarizeSize(measured),rows=s.reports.map(r=>Object.fromEntries(SIZE_FIELDS.map((f,i)=>[f,r[i]])));
 assert.equal(rows.length,3);near(s.charsPerToken,3);near(s.charsPerTokenOther,3/.7,1e-2);assert.equal(s.areas.length,2);assert.equal(s.areas[0].withDocuments,60);
 const [first,second,third]=rows;
 assert.equal(first.tokensAll,57000);assert.equal(first.tokensOnce,2000+15000+4000);assert.equal(first.tokensCore,2000);assert.equal(first.tokensPrimary,2000);assert.equal(first.pagesAll,84);near(first.pagesOnce,4+30+5);near(first.documentsOnce,2.1);assert.equal(first.bytesOnce,(4+30+5)*50000);
 assert.equal(second.tokensAll,2000,'one of two documents failed: the measured one stands for both');assert.equal(second.tokensPrimary,1000);assert.equal(second.documentsOnce,2);
 assert.equal(third.tokensPrimary,0,'the pipeline skips documents of more than 150 pages');assert.equal(third.tokensAll,300);near(third.scanPagesOnce,190);assert.equal(third.bytesAll,200*50000+30e6+4000);assert.equal(third.bytesOnce,200*50000+30e6+2000);
 const d=s.documents;assert.equal(d.tried,9);assert.equal(d.failed,2);near(d.read,4.1);assert.equal(d.large,1);assert.equal(d.largeBytes,30e6);near(d.notPdf,.5);assert.equal(d.scans,1);near(d.pages,4+30+5+2+200);assert.equal(d.scanPages,190);
 assert.deepEqual(d.bins.map(b=>b.id),PAGE_BINS.map(b=>b.id));near(d.bins[0].documents,2);near(d.bins[2].documents,1.1);near(d.bins[2].tokens,15000+4000);near(d.bins[3].pages,200);
 near(d.types.paper.documents,3);near(d.types.minutes.documents,.1);near(d.types.minutes.tokens,4000);assert.equal(d.perDocument.pages.median,30);assert.equal(d.perDocument.pages.max,200);
 // A truncated primary document: 65,000 characters of 130,000.
 const long=summarizeSize({...measured,reports:[{area:'a',linked:1,documents:[pdf('paper',1,40,50000,{primary:true,chars:130000})]}]});assert.equal(long.reports[0][SIZE_FIELDS.indexOf('tokensPrimary')],25000);
});
test('the volume multiplies reports, share with documents and mean size per class',()=>{
 const size=summarizeSize(measured),means=areaMeans(size);
 assert.equal(means.length,2);assert.equal(means[0].sampled,2);near(means[0].means.tokensAll,(57000+2000)/2);near(means[0].means.tokensCapped,(SIZE_RULES.capTokens+2000)/2);near(means[1].means.tokensAll,300);
 const cells={'05':{medium:1000,district:100},'09':{medium:500,district:300,tiny:50}};
 const v=estimateVolume({size,cells,runs:[cells,cells],share:{all:.5,classes:{medium:.6}}}),by=Object.fromEntries(v.classes.map(c=>[c.id,c]));
 // Fewer than three measured areas per class: every class uses the mean over all areas, weighted by reports with documents.
 assert.ok(v.classes.every(c=>c.pooled));const pooled=(60*29500+20*300)/80;near(by.medium.means.tokensAll,pooled);
 near(by.medium.withDocumentsPerYear,1500*.6);near(by.district.withDocumentsPerYear,400*.5);near(by.tiny.documentShare,.5);
 near(by.medium.perYear.tokensAll,900*pooled);near(v.withDocumentsPerYear,900+200+25);near(v.total.tokensAll.perYear,1125*pooled);near(v.total.tokensAll.perDay,1125*pooled/365);
 near(v.total.tokensAll.lowPerYear,v.total.tokensAll.perYear,1e-3*v.total.tokensAll.perYear+1e9,'a range exists');assert.ok(v.total.tokensAll.lowPerYear<=v.total.tokensAll.perYear&&v.total.tokensAll.highPerYear>=v.total.tokensAll.perYear);
 assert.deepEqual(v.variants.map(x=>x.id),VARIANTS.map(x=>x.id));const variant=Object.fromEntries(v.variants.map(x=>[x.id,x]));
 assert.ok(variant.primary.perYear<variant.capped.perYear&&variant.capped.perYear<variant.all.perYear&&variant.once.perYear<variant.all.perYear&&variant.core.perYear<=variant.once.perYear);near(variant.all.perReport,pooled);
 const nrw=v.states.find(s=>s.id==='05'),bavaria=v.states.find(s=>s.id==='09');near(nrw.withDocumentsPerYear,600+50);near(bavaria.withDocumentsPerYear,300+150+25);near(nrw.perYear.tokensAll+bavaria.perYear.tokensAll,v.total.tokensAll.perYear,1e-3);
 // Distribution over reports: area A's two reports stand for 30 reports each, area B's one for 20.
 near(v.perReport.tokens.mean,pooled);assert.equal(v.perReport.tokens.median,2000);assert.equal(v.perReport.tokens.p90,57000);near(v.perReport.tokens.top10Share,30*57000/(30*59000+20*300));
 assert.deepEqual(v.sample,{areas:2,reports:3});
});
function sqlite(){
 const raw=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())raw.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 return {raw,db:sqliteAdapter(raw)};
}
test('the admin estimate combines stored NRW areas with the measured sample and explains itself',async()=>{
 const {raw,db}=sqlite(),put=raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)'),insert={run:(id,area,payload,updated)=>put.run(id,area,'city',JSON.parse(payload).events.at(-1).date,updated,'unknown',payload)};
 // Billerbeck: a complete year, 30 reports a month on two meeting days; every second report has a PDF, every fourth returns once.
 let k=0;for(let month=0;month<12;month++)for(let i=0;i<30;i++){const d=new Date(Date.UTC(2025,9+month,7+(i%2)*14)),day=d.toISOString().slice(0,10),again=new Date(d.getTime()+14*86400000).toISOString().slice(0,10);
  insert.run('t'+k,'billerbeck',JSON.stringify({id:'t'+k,title:'T',events:i%4===0?[{date:day},{date:again}]:[{date:day}],documents:i%2?[{kind:'application/pdf',url:'https://x/'+k,title:'Vorlage'}]:[{kind:'html',url:'https://x/h'+k}],identity:{}}),'2026-10-01T00:00:00Z');k++;}
 // Warendorf: only the last two months are stored.
 for(let i=0;i<40;i++)insert.run('w'+i,'warendorf',JSON.stringify({id:'w'+i,title:'W',events:[{date:i%2?'2026-08-20':'2026-09-17'}],documents:[],identity:{}}),'2026-10-01T00:00:00Z');
 await refreshRegionFacts(db,{budgetMs:1e9});
 const e=await adminEstimate(db,{now:new Date('2026-10-02T12:00:00Z'),replicates:40});
 assert.equal(e.from,'2025-10-03');assert.equal(e.to,'2026-10-02');
 const billerbeck=e.examples.find(a=>a.id==='billerbeck');assert.equal(billerbeck.origin,'stored');assert.equal(billerbeck.reports,360);assert.equal(billerbeck.class,'small');assert.equal(billerbeck.state,'05');assert.equal(billerbeck.population,population.billerbeck);
 assert.match(e.excluded.find(a=>a.id==='warendorf').reason,/beginnt erst am 20\.08\.2026/);assert.equal(e.sample.storedWithData,2);
 // The partial stock appears as a provisional point: projected to a year, named with its reason, not an example.
 const open=e.provisional.find(a=>a.id==='warendorf');assert.equal(open.reports,40);assert.equal(open.weeks,5);assert.ok(open.annual>40*52/5/3&&open.annual<40*52/5*3,'projected '+open.annual);assert.equal(open.level,'district');assert.match(open.reason,/beginnt erst/);assert.equal(open.connected,true);
 assert.ok(!e.examples.some(a=>a.id==='warendorf'));assert.ok(!e.provisional.some(a=>a.id==='billerbeck'));
 // The measured sample is part of every estimate.
 const fromSample=e.examples.filter(a=>a.origin==='sample');assert.ok(fromSample.length>=30,'examples of the sample: '+fromSample.length);assert.ok(new Set(fromSample.map(a=>a.state)).size>=5);
 assert.equal(e.sample.units,sample.units.length);assert.equal(e.sample.strata.length,SIZE_CLASSES.length);assert.equal(e.sample.strata.reduce((n,s)=>n+s.drawn,0),sample.units.length);
 assert.equal(e.sampleCount,e.examples.length);assert.ok(e.total.perYear>0&&e.total.lowPerYear<=e.total.perYear&&e.total.highPerYear>=e.total.perYear);
 for(const level of e.levels)if(level.model)assert.ok(level.model.slope>=0&&level.model.slope<=1&&level.model.smear>0);
 assert.equal(e.levels.find(l=>l.id==='municipality').model.states['05'].n,1);
 near(e.classes.reduce((n,c)=>n+c.perYear,0),e.total.perYear,1e-6);near(e.states.reduce((n,s)=>n+s.perYear,0),e.total.perYear,1e-6);
 assert.equal(e.cells,undefined);assert.equal(e.replicates,undefined,'the draws stay on the server');
 // Capturability, size and seasonality are derived from the same examples.
 near(e.capture.total.total,e.total.perYear,1e-6);near(e.basis.own+e.basis.typical+e.basis.borrowed,e.total.perYear,1e-6);assert.ok(e.basis.typical>0);assert.ok(e.states.every(s=>s.ownShare>=0&&s.ownShare<=1+1e-9));assert.ok(e.capture.total.connectedShare>0&&e.capture.total.connectedShare<1);
 assert.ok(e.documents.share>0&&e.documents.share<1);assert.equal(e.frame.districts,294);assert.equal(e.frame.units.district,294);
 assert.ok(e.volume.total.tokensOnce.perYear>0);assert.equal(e.volume.variants.length,VARIANTS.length);assert.equal(e.size.reports,sizeSample.reports.length);assert.ok(e.size.charsPerToken>1.5&&e.size.charsPerToken<5);
 assert.ok(e.season.peakDay>e.total.perDay);assert.ok(e.season.consultationsPerReport>=1);near(e.season.monthly.reduce((a,b)=>a+b,0),1);
 // Suggestions name connected NRW areas of thinly covered classes, never areas that already are examples.
 const medium=e.sample.strata.find(s=>s.id==='small');assert.ok(medium.candidates.length>0&&medium.candidates.length<=8);assert.ok(!medium.candidates.some(c=>c.id==='billerbeck'));assert.equal(medium.storedExamples,1);
 // Gemeindeverbände: angebundene niedersächsische Samtgemeinden sind Kandidaten; NRW hat keine.
 const associations=e.sample.strata.find(s=>s.id==='association').candidates;assert.ok(associations.length>0&&associations.length<=8);assert.ok(associations.every(c=>/^(nds|de)-\d{9}$/.test(c.id)&&/^(Samtgemeinde|Verbandsgemeinde|Amt|Verwaltungsgemeinschaft|Verwaltungsverband|Erfüllende Gemeinde) /.test(c.name)));
 // An empty database still gives the estimate of the sample.
 const empty=await adminEstimate(sqlite().db,{now:new Date('2026-10-02T12:00:00Z'),replicates:10});assert.equal(empty.sample.storedWithData,0);assert.ok(empty.total.perYear>0);
});
test('the estimate is stored on request and the page learns whether the stock changed since',async()=>{
 const {raw,db}=sqlite();
 assert.equal((await storedEstimate(db)).computed,false);
 const first=await computeEstimate(db,{now:new Date('2026-10-02T12:00:00Z'),replicates:10});
 assert.equal(first.computed,true);assert.equal(first.stale,false);assert.equal(first.computedAt,'2026-10-02T12:00:00.000Z');assert.ok(first.total.perYear>0);
 const kept=await storedEstimate(db);assert.equal(kept.stale,false);assert.equal(kept.total.perYear,first.total.perYear);assert.equal(kept.computedAt,first.computedAt);
 // Stored compressed: the row stays far below the 2 MB a D1 row may hold, however many examples the stock gains.
 const stored=raw.prepare("SELECT length(value) AS n FROM system_state WHERE key='admin-estimate'").get();assert.ok(stored.n<JSON.stringify(kept).length/2,`stored ${stored.n} bytes for ${JSON.stringify(kept).length} bytes of JSON`);
 // A stored report raises the content revision: the stored estimate stays, marked as stale, until it is computed again.
 raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run('x','billerbeck','city','2026-09-17','2026-10-01T00:00:00Z','unknown',JSON.stringify({id:'x',title:'X',events:[{date:'2026-09-17'}],documents:[],identity:{}}));
 const later=await storedEstimate(db);assert.equal(later.stale,true);assert.equal(later.computedAt,first.computedAt);assert.ok(later.currentRevision>later.revision);
 /* Until the values per area of the new area are computed, the estimate is refused (it would miss the area) */
 await assert.rejects(computeEstimate(db,{replicates:10}),e=>e.status===409);
 await refreshRegionFacts(db,{budgetMs:1e9});
 const again=await computeEstimate(db,{now:new Date('2026-10-03T12:00:00Z'),replicates:10});assert.equal(again.stale,false);assert.equal((await storedEstimate(db)).stale,false);
});
test('quantile and the seeded random numbers behave as the range calculation expects',()=>{
 near(quantile([1,2,3,4],.25),1.75);near(quantile([4,1,3,2],.5),2.5);assert.equal(quantile([],.5),0);assert.equal(quantile([7],.9),7);
 const a=random(1),b=random(1),c=random(2),first=[a(),a(),a()];assert.deepEqual(first,[b(),b(),b()]);assert.notDeepEqual(first,[c(),c(),c()]);assert.ok(first.every(v=>v>=0&&v<1));
});
