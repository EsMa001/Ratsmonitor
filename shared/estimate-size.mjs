/**
 * Size of the documents behind the reports: how many documents, pages, bytes and tokens have to be processed.
 * Pure functions. The measurement itself is scripts/estimate/measure-size.mjs; it stores figures only, no text.
 *
 * How the size estimate is built
 * 1. Sample: from every area with a year of stock a fixed number of reports with documents, chosen by a hash of
 *    their id. Each of their documents was downloaded once and measured.
 * 2. Per report, four reading variants are added up (see VARIANTS). A document linked by several reports of an
 *    area (an invitation, the minutes of a meeting) counts with its share 1/n where every document is read once.
 * 3. Per area the mean per report; per class the mean of its areas, weighted by their reports with documents.
 *    A class with fewer than three measured areas uses the mean over all areas.
 * 4. Germany: reports per year of the class × share of reports with documents × mean per report.
 * 5. Range: areas are drawn again at random together with the examples of the count (bootstrap).
 */
import {quantile,random,SIZE_CLASSES,FEDERAL_STATES,SAMPLE_RULES} from './estimate.mjs';
export const SIZE_RULES=Object.freeze({capTokens:20000,primaryChars:65000,primaryPages:150,maxBytes:12e6,scanShare:.5,scanPageChars:50,defaultCharsPerToken:2.8,minAreas:3});
export const PAGE_BINS=Object.freeze([{id:'1-5',label:'1 bis 5 Seiten',max:5},{id:'6-20',label:'6 bis 20 Seiten',max:20},{id:'21-100',label:'21 bis 100 Seiten',max:100},{id:'100+',label:'über 100 Seiten',max:Infinity}]);
/** Reading variants: which text of a report goes to the language model. */
export const VARIANTS=Object.freeze([
 {id:'primary',field:'tokensPrimary',name:'Wie heute',detail:'eine Unterlage je Bericht (die Vorlage, sonst das erste PDF), höchstens 65.000 Zeichen und 150 Seiten'},
 {id:'core',field:'tokensCore',name:'Vorlage und Beschlusstext',detail:'alle Vorlagen, Anträge, Anfragen und Beschlusstexte vollständig; keine Anlagen, Niederschriften und Einladungen'},
 {id:'capped',field:'tokensCapped',name:'Alles, gedeckelt',detail:'alle verlinkten Dokumente des Berichts, aber höchstens 20.000 Tokens je Bericht'},
 {id:'once',field:'tokensOnce',name:'Alles, jedes Dokument einmal',detail:'alle Dokumente vollständig; ein Dokument, das an mehreren Berichten hängt, wird nur einmal gelesen'},
 {id:'all',field:'tokensAll',name:'Alles, je Bericht',detail:'jeder Bericht liest alle seine Dokumente vollständig, auch die mit anderen Berichten geteilten'},
]);
/** Columns of one measured report in the stored sample (shared/document-size-sample.json). */
export const SIZE_FIELDS=Object.freeze(['area','linked','bytesAll','pagesAll','tokensAll','bytesOnce','pagesOnce','tokensOnce','documentsOnce','tokensCore','tokensPrimary','scanPagesOnce']);
const round=(value,digits=0)=>{const p=10**digits;return Math.round(value*p)/p;};
const stats=values=>values.length?{median:quantile(values,.5),mean:values.reduce((a,b)=>a+b,0)/values.length,p90:quantile(values,.9),max:Math.max(...values)}:null;
/** Condense the raw measurement (one row per document) into the stored sample (one row per report, plus document statistics). */
export function summarizeSize(measured){
 const index=new Map(measured.areas.map((a,i)=>[a.id,i]));
 let chars=0,counted=0,countedOther=0;
 for(const r of measured.reports)for(const d of r.documents)if(d.format==='pdf'&&d.tokens!=null){chars+=d.chars;counted+=d.tokens;countedOther+=d.tokensOther||0;}
 const charsPerToken=counted?chars/counted:SIZE_RULES.defaultCharsPerToken,tokensOf=d=>d.tokens??Math.round(d.chars/charsPerToken);
 const documents={tried:0,failed:0,read:0,large:0,largeBytes:0,notPdf:0,scans:0,pages:0,scanPages:0,bytes:0,tokens:0},per={pages:[],tokens:[],bytes:[]},types={};
 const bins=PAGE_BINS.map(b=>({id:b.id,label:b.label,documents:0,pages:0,tokens:0,bytes:0})),reports=[];
 for(const r of measured.reports){
  const usable=r.documents.filter(d=>!d.error);documents.tried+=r.documents.length;documents.failed+=r.documents.length-usable.length;
  if(!usable.length)continue;
  // Documents that were not tried (more than the limit per report) or failed are assumed to be like the measured ones.
  const scale=r.linked/usable.length,sum={bytesAll:0,pagesAll:0,tokensAll:0,bytesOnce:0,pagesOnce:0,tokensOnce:0,documentsOnce:0,tokensCore:0,scanPagesOnce:0};let primary=null;
  for(const d of usable){
   const once=1/d.share,pdf=d.format==='pdf',tokens=pdf?tokensOf(d):0,pages=pdf?d.pages:0;
   sum.bytesAll+=d.bytes;sum.pagesAll+=pages;sum.tokensAll+=tokens;sum.bytesOnce+=d.bytes*once;sum.pagesOnce+=pages*once;sum.tokensOnce+=tokens*once;sum.documentsOnce+=once;
   if(d.type==='paper'||d.type==='decision')sum.tokensCore+=tokens*once;
   if(d.primary)primary=pdf&&d.pages<=SIZE_RULES.primaryPages?tokens*Math.min(1,SIZE_RULES.primaryChars/Math.max(1,d.chars)):0;
   if(d.large){documents.large+=once;documents.largeBytes+=d.bytes*once;continue;}
   if(!pdf){documents.notPdf+=once;continue;}
   sum.scanPagesOnce+=d.scanPages*once;
   documents.read+=once;documents.pages+=pages*once;documents.scanPages+=d.scanPages*once;documents.bytes+=d.bytes*once;documents.tokens+=tokens*once;if(pages&&d.scanPages/pages>SIZE_RULES.scanShare)documents.scans+=once;
   const bin=bins[PAGE_BINS.findIndex(b=>pages<=b.max)],type=types[d.type]=types[d.type]||{documents:0,pages:0,tokens:0,bytes:0};
   for(const target of [bin,type]){target.documents+=once;target.pages+=pages*once;target.tokens+=tokens*once;target.bytes+=d.bytes*once;}
   per.pages.push(pages);per.tokens.push(tokens);per.bytes.push(d.bytes);
  }
  // The primary document could not be read: an average document of the report stands in for it.
  if(primary===null)primary=sum.tokensAll/usable.length;
  reports.push([index.get(r.area),r.linked,round(sum.bytesAll*scale),round(sum.pagesAll*scale),round(sum.tokensAll*scale),round(sum.bytesOnce*scale),round(sum.pagesOnce*scale,1),round(sum.tokensOnce*scale),round(sum.documentsOnce*scale,2),round(sum.tokensCore*scale),round(primary),round(sum.scanPagesOnce*scale,1)]);
 }
 const tidy=object=>Object.fromEntries(Object.entries(object).map(([k,v])=>[k,typeof v==='number'?round(v,1):v]));
 return {measuredAt:measured.measuredAt,from:measured.from,to:measured.to,tokenizer:measured.tokenizer,charsPerToken:round(charsPerToken,3),charsPerTokenOther:countedOther?round(chars/countedOther,3):null,perArea:measured.perArea,
  areas:measured.areas.map(a=>({id:a.id,name:a.name,level:a.level,state:a.state,class:a.class,external:a.external,reports:a.reports,withDocuments:a.withDocuments,links:a.links,distinct:a.distinct})),
  reports,documents:{...tidy(documents),perDocument:{pages:stats(per.pages),tokens:stats(per.tokens),bytes:stats(per.bytes)},bins:bins.map(tidy),types:Object.fromEntries(Object.entries(types).map(([k,v])=>[k,tidy(v)]))}};
}
const METRICS=['bytesOnce','pagesOnce','documentsOnce','scanPagesOnce','tokensPrimary','tokensCore','tokensCapped','tokensOnce','tokensAll'];
/** Mean per report with documents, for every area of the sample. */
export function areaMeans(size){
 const rows=size.areas.map(()=>[]);
 for(const r of size.reports){const row=Object.fromEntries(SIZE_FIELDS.map((field,i)=>[field,r[i]]));row.tokensCapped=Math.min(row.tokensAll,SIZE_RULES.capTokens);rows[row.area].push(row);}
 return size.areas.map((a,i)=>rows[i].length?{...a,sampled:rows[i].length,rows:rows[i],means:Object.fromEntries(METRICS.map(m=>[m,rows[i].reduce((n,r)=>n+r[m],0)/rows[i].length]))}:null).filter(Boolean);
}
const weighted=(areas,metric)=>{const weight=areas.reduce((n,a)=>n+a.withDocuments,0);return weight?areas.reduce((n,a)=>n+a.withDocuments*a.means[metric],0)/weight:0;};
/** Mean per report by class; a class with too few measured areas uses all areas. */
function classMeans(areas){
 const all=Object.fromEntries(METRICS.map(m=>[m,weighted(areas,m)])),result={};
 for(const c of SIZE_CLASSES){const own=areas.filter(a=>a.class===c.id),pooled=own.length<SIZE_RULES.minAreas;result[c.id]={areas:own.length,reports:own.reduce((n,a)=>n+a.sampled,0),pooled,means:pooled?all:Object.fromEntries(METRICS.map(m=>[m,weighted(own,m)]))};}
 return {all,classes:result};
}
const weightedQuantile=(pairs,q)=>{const sorted=[...pairs].sort((a,b)=>a[0]-b[0]),total=sorted.reduce((n,p)=>n+p[1],0);let run=0;for(const [value,weight] of sorted){run+=weight;if(run>=q*total)return value;}return sorted.at(-1)?.[0]||0;};
/**
 * size:      stored sample (summarizeSize)
 * cells:     reports per year by state and class (estimateGermany().cells)
 * runs:      the same for every bootstrap draw (estimateGermany().replicates)
 * share:     share of reports with documents by class, {all, classes:{id:share}}
 */
export function estimateVolume({size,cells,runs=[],share,seed=SAMPLE_RULES.seed+1}){
 const areas=areaMeans(size),point=classMeans(areas),shareOf=id=>share.classes[id]??share.all;
 const perClass=id=>Object.values(cells).reduce((n,cell)=>n+(cell[id]||0),0);
 const figures=(reports,means)=>Object.fromEntries(METRICS.map(m=>[m,reports*means[m]]));
 const add=(a,b)=>Object.fromEntries(METRICS.map(m=>[m,(a[m]||0)+b[m]]));
 const classes=SIZE_CLASSES.map(c=>{const reports=perClass(c.id),withDocuments=reports*shareOf(c.id),info=point.classes[c.id];return {id:c.id,name:c.name,reportsPerYear:reports,documentShare:shareOf(c.id),withDocumentsPerYear:withDocuments,areas:info.areas,sampled:info.reports,pooled:info.pooled,means:info.means,perYear:figures(withDocuments,info.means)};});
 const states=Object.entries(FEDERAL_STATES).map(([id,name])=>{let perYear={},withDocuments=0,reports=0;for(const c of SIZE_CLASSES){const r=cells[id]?.[c.id]||0;reports+=r;withDocuments+=r*shareOf(c.id);perYear=add(perYear,figures(r*shareOf(c.id),point.classes[c.id].means));}return {id,name,reportsPerYear:reports,withDocumentsPerYear:withDocuments,perYear};}).sort((a,b)=>b.perYear.tokensOnce-a.perYear.tokensOnce);
 const total=classes.reduce((sum,c)=>add(sum,c.perYear),{}),withDocuments=classes.reduce((n,c)=>n+c.withDocumentsPerYear,0);
 // Bootstrap: for every draw of the count, draw the measured areas again, class by class.
 const rng=random(seed),draws=runs.map(run=>{
  const drawn=[];for(const c of SIZE_CLASSES){const own=areas.filter(a=>a.class===c.id);for(let k=0;k<own.length;k++)drawn.push(own[Math.floor(rng()*own.length)]);}
  const means=classMeans(drawn);let sum={};
  for(const c of SIZE_CLASSES){const reports=Object.values(run).reduce((n,cell)=>n+(cell[c.id]||0),0);sum=add(sum,figures(reports*shareOf(c.id),means.classes[c.id].means));}
  return sum;
 });
 const range=metric=>draws.length?{low:Math.min(total[metric],quantile(draws.map(d=>d[metric]),SAMPLE_RULES.rangeLow)),high:Math.max(total[metric],quantile(draws.map(d=>d[metric]),SAMPLE_RULES.rangeHigh))}:{low:total[metric],high:total[metric]};
 // Distribution over reports: every sampled report stands for (reports with documents of its area) / (sampled reports of its area).
 const pairs=metric=>areas.flatMap(a=>a.rows.map(r=>[r[metric],a.withDocuments/a.sampled]));
 const distribution=metric=>{const p=pairs(metric),weight=p.reduce((n,x)=>n+x[1],0),sum=p.reduce((n,x)=>n+x[0]*x[1],0),p90=weightedQuantile(p,.9);return {median:weightedQuantile(p,.5),mean:weight?sum/weight:0,p90,top10Share:sum?p.filter(x=>x[0]>=p90).reduce((n,x)=>n+x[0]*x[1],0)/sum:0};};
 return {classes,states,withDocumentsPerYear:withDocuments,total:Object.fromEntries(METRICS.map(m=>[m,{perYear:total[m],perDay:total[m]/365,...(({low,high})=>({lowPerYear:low,highPerYear:high}))(range(m))}])),
  variants:VARIANTS.map(v=>({...v,perYear:total[v.field],perDay:total[v.field]/365,lowPerDay:range(v.field).low/365,highPerDay:range(v.field).high/365,perReport:withDocuments?total[v.field]/withDocuments:0})),
  perReport:{pages:distribution('pagesOnce'),tokens:distribution('tokensAll'),documents:distribution('documentsOnce')},sample:{areas:areas.length,reports:size.reports.length}};
}
