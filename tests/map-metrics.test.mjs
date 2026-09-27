import test from 'node:test';
import {analysed} from './helpers/analysed.mjs';
import assert from 'node:assert/strict';
import {buildAnalytics} from '../shared/analytics.mjs';
import {mapPeriods,mapReading,mapLegend} from '../shared/map-metrics.mjs';
const region={id:'billerbeck',kind:'city',name:'Billerbeck'};
const coverage=[{regionId:region.id,method:'scraper',from:'2026-01-01',to:'2026-09-27',complete:true}];
const q={region:region.id,from:'2026-09-01',to:'2026-09-20',label:'bildung',now:new Date('2026-09-27T12:00:00Z')};
const topic=(id,title,days)=>analysed({id,regionId:region.id,title,officialTitle:title,sourceUrl:'https://example.org/'+id,events:days.map(date=>analysed({date}))});
const data=items=>buildAnalytics(items,coverage,[region],q);

test('map change uses equal calendar-day periods, including odd lengths, leap years and one-day selection',()=>{
 assert.deepEqual(mapPeriods('2026-09-01','2026-09-20'),{days:10,first:{from:'2026-09-01',to:'2026-09-10'},second:{from:'2026-09-11',to:'2026-09-20'},omittedDay:null});
 const odd=mapPeriods('2026-09-01','2026-09-21');assert.equal(odd.omittedDay,'2026-09-11');assert.equal(odd.second.from,'2026-09-12');
 assert.equal(mapPeriods('2024-02-01','2024-02-29').days,14);
 assert.equal(mapPeriods('2026-09-01','2026-09-01'),null);
});
test('map change deduplicates hearings within each period, excludes aliases and future dates and subtracts percentage points',()=>{
 const items=[];
 for(let i=0;i<10;i++)items.push(topic('first'+i,i<2?'Schulbau':'Kulturförderung',['2026-09-01','2026-09-05']));
 for(let i=0;i<10;i++)items.push(topic('second'+i,i<5?'Schulbau':'Kulturförderung',['2026-09-15','2026-09-19']));
 items.push({...topic('alias','Schulbau',['2026-09-01']),identity:{mergedInto:'first0'}},topic('future','Schulbau',['2026-10-01']));
 const p=data(items).geography[0];assert.equal(p.total,20);assert.equal(p.count,7);
 assert.deepEqual(p.comparison.first,{count:2,total:10,share:20});assert.deepEqual(p.comparison.second,{count:5,total:10,share:50});
 assert.equal(p.comparison.delta,30);assert.equal(mapReading(p,'change').text,'+30 Prozentpunkte');
 const repeated=data([topic('both','Schulbau',['2026-09-01','2026-09-15'])]).geography[0];assert.equal(repeated.total,1);assert.equal(repeated.comparison.first.total,1);assert.equal(repeated.comparison.second.total,1);
 assert.equal(mapReading(repeated,'change').kind,'insufficient');
});
test('missing periods never turn into a zero change; day omitted from comparison remains in overall counts',()=>{
 const items=Array.from({length:12},(_,i)=>topic('x'+i,'Schulbau',['2026-09-02']));
 const p=data(items).geography[0];assert.equal(p.comparison.second.share,null);assert.equal(p.comparison.delta,null);assert.equal(mapReading(p,'change').kind,'insufficient');
 const d=buildAnalytics([topic('middle','Schulbau',['2026-09-11'])],coverage,[region],{...q,to:'2026-09-21'});
 assert.equal(d.total,1);assert.equal(d.geography[0].comparison.first.total,0);assert.equal(d.geography[0].comparison.second.total,0);
});
test('dominant subject handles ties and structural/open labels without inventing a winner',()=>{
 const items=[...Array.from({length:4},(_,i)=>topic('b'+i,'Schulbau',['2026-09-02'])),...Array.from({length:4},(_,i)=>topic('k'+i,'Kulturförderung',['2026-09-02'])),...Array.from({length:4},(_,i)=>topic('m'+i,'Mitteilungen',['2026-09-02'])),topic('unknown','Projekt XYZ',['2026-09-02'])];
 const p=data(items).geography[0];assert.equal(p.dominant.leaders.length,2);assert.equal(mapReading(p,'dominant').kind,'tie');assert.equal(p.unlabelled,1);
 assert.ok(Math.abs(p.dominant.share-400/13)<1e-10);assert.equal(mapReading(p,'unlabelled').value,100/13);
 const structural=data(items.filter(t=>t.title==='Mitteilungen').concat(Array.from({length:7},(_,i)=>topic('g'+i,'Mitteilungen',['2026-09-02'])))).geography[0];
 assert.equal(mapReading(structural,'dominant').kind,'no-subject');assert.equal(mapReading({...p,total:9},'dominant').kind,'insufficient');
});
test('zero matches, missing data, pending sources and deliberately hidden partial records remain distinct',()=>{
 const p=data([topic('k','Kulturförderung',['2026-09-02'])]).geography[0];
 assert.equal(mapReading(p,'share').value,0);assert.equal(mapReading(p,'share').color,'#ffffff');
 const empty=data([]).geography[0];assert.equal(mapReading(empty,'share').kind,'no-data');assert.equal(mapReading({...empty,coverage:{method:'pending'}},'share').kind,'pending');
 assert.equal(mapReading({...p,partial:true},'share',{completeOnly:true}).kind,'excluded');
 assert.equal(mapReading({...p,partial:true},'coverage',{completeOnly:true}).text,'Teilstand');
 for(const mode of ['share','count','change','dominant','unlabelled','coverage'])assert.equal(mapReading(empty,mode).value,null);
});
test('fixed scales agree with their legend boundaries and stay stable between places',()=>{
 const p=data([topic('x','Schulbau',['2026-09-02'])]).geography[0];
 for(const [value,index] of [[0,0],[.1,1],[10,1],[10.1,2],[25,2],[25.1,3],[50,3],[50.1,4],[100,4]])assert.equal(mapReading({...p,share:value},'share').color,mapLegend('share')[index].color);
 for(const [value,index] of [[0,0],[1,1],[9,1],[10,2],[49,2],[50,3],[199,3],[200,4]])assert.equal(mapReading({...p,count:value},'count').color,mapLegend('count')[index].color);
 for(const [delta,index] of [[-11,0],[-10,1],[-2.1,1],[-2,2],[0,2],[2,2],[2.1,3],[10,3],[11,4]])assert.equal(mapReading({...p,comparison:{first:{total:10,count:1,share:10},second:{total:10,count:2,share:20},delta}},'change').color,mapLegend('change')[index].color);
});
test('concrete similarity is used consistently for both time sections; source quality remains separate',()=>{
 const items=[topic('origin','Elternbeiträge Kita',['2026-08-01']),...Array.from({length:10},(_,i)=>topic('a'+i,i===0?'Elternbeiträge Kindertagesbetreuung':'Schulbau',['2026-09-02'])),...Array.from({length:10},(_,i)=>topic('b'+i,i<3?'Elternbeiträge Kindertagesbetreuung':'Schulbau',['2026-09-12']))];
 const d=buildAnalytics(items,coverage,[region],{...q,topicId:'origin'}),p=d.geography[0];
 assert.equal(p.count,4);assert.equal(p.comparison.delta,20);assert.equal(p.dominant.leaders[0].id,'bildung');assert.equal(mapReading(p,'coverage').text,'Ohne gemeldete Lücke');
});
