import test from 'node:test';
import {analysed} from './helpers/analysed.mjs';
import assert from 'node:assert/strict';
import {classifyTopic,LABELS} from '../shared/labels.mjs';
import {buildAnalytics} from '../shared/analytics.mjs';
const regions=[{id:'billerbeck',kind:'city',name:'Billerbeck'},{id:'muenster',kind:'city',name:'Münster'},{id:'coesfeld',kind:'district',name:'Coesfeld'},{id:'borken',kind:'district',name:'Borken'}];
const topic=(id,regionId,dates,title='Neubau einer Grundschule')=>analysed({id,regionId,title,officialTitle:title,events:dates.map(date=>analysed({date})),sourceUrl:'https://example.org/public',eventDate:dates.at(-1)});
const coverage=regions.map(r=>({regionId:r.id,from:'2026-06-01',to:'2026-09-26',complete:r.id!=='borken'}));
const q={region:'billerbeck',from:'2026-07-01',to:'2026-09-26',label:'bildung',now:new Date('2026-09-26T12:00:00Z')};
test('13 labels separate culture and sport and leave ambiguous titles open',()=>{
 assert.equal(LABELS.length,16);assert.equal(classifyTopic({title:'Kulturförderung'}).primary,'kultur');assert.equal(classifyTopic({title:'Sportförderung'}).primary,'sport');
 assert.equal(classifyTopic({title:'Elternbeiträge für Kindertageseinrichtungen'}).primary,'bildung');assert.equal(classifyTopic({title:'Bebauungsplan Schulzentrum'}).primary,'bauen');assert.equal(classifyTopic({title:'Schul- und Sportförderung'}).primary,'unklar');
});
test('same matter counts once per month and once over a full period; future and undated do not enter totals',()=>{
 const items=[topic('a','billerbeck',['2026-07-03','2026-07-15','2026-08-10']),topic('b','billerbeck',['2026-08-11'],'Sportförderung'),topic('c','billerbeck',['2026-10-01']),topic('d','billerbeck',[])];
 const d=buildAnalytics(items,coverage,regions,q);assert.equal(d.total,2);assert.equal(d.distribution.reduce((n,l)=>n+(l.share||0),0),100);assert.deepEqual(d.months.map(m=>m.total),[1,2,0]);assert.equal(d.months[2].share,null);assert.equal(d.future,1);assert.equal(d.undated,1);
});
test('place comparison includes cities and districts separately, excludes origin from other-place counters',()=>{
 const d=buildAnalytics([topic('a','billerbeck',['2026-09-02']),topic('b','muenster',['2026-09-03']),topic('c','coesfeld',['2026-09-03']),topic('d','coesfeld',['2026-09-04'])],coverage,regions,q);
 assert.equal(d.matchingPlaces,2);assert.equal(d.matchingTopics,3);assert.equal(d.geography.find(p=>p.id==='billerbeck').count,1);assert.equal(d.places.find(p=>p.id==='borken').count,null);
 assert.equal(buildAnalytics([topic('b','muenster',['2026-09-03'])],coverage,regions,{...q,level:'city'}).places.length,1);
});
test('concrete similarity never equates a broad label with a matching subject',()=>{
 const d=buildAnalytics([topic('a','billerbeck',['2026-09-02'],'Elternbeiträge Kita'),topic('b','muenster',['2026-09-03'],'Elternbeiträge Kindertagesbetreuung'),topic('c','coesfeld',['2026-09-03'],'Neubau einer Grundschule')],coverage,regions,{...q,topicId:'a'});
 assert.equal(d.matchingTopics,1);assert.equal(d.places.find(p=>p.id==='coesfeld').count,0);
});

test('monthly mix counts a matter once per month, reconciles all labels, and leaves missing months null',()=>{
 const items=[topic('a','billerbeck',['2026-07-03','2026-07-20','2026-09-02']),topic('b','billerbeck',['2026-09-05'],'Kulturförderung'),topic('c','billerbeck',['2026-09-06'],'Mitteilungen'),topic('d','billerbeck',['2026-09-07'],'Unbekanntes Projekt')];
 const d=buildAnalytics(items,coverage,regions,q),[july,august,september]=d.months;
 assert.equal(july.total,1);assert.equal(september.total,4);
 for(const m of [july,september]){assert.equal(m.distribution.reduce((n,l)=>n+l.count,0),m.total);assert.ok(Math.abs(m.distribution.reduce((n,l)=>n+l.share,0)-100)<1e-9);assert.equal(m.distribution.find(l=>l.id==='bildung').share,m.share);}
 assert.ok(august.distribution.every(l=>l.share===null&&l.count===0));
 const c=d.monthlyComparison;assert.equal(c.available,true);assert.equal(c.gaps,1);assert.equal(c.first.month,'2026-07');assert.equal(c.last.month,'2026-09');assert.equal(c.rows.find(l=>l.id==='bildung').delta,-75);assert.equal(c.rows.find(l=>l.id==='kultur').delta,25);
 assert.deepEqual(c.changes.map(l=>l.id),['bildung','kultur']);assert.equal(c.first.from,'2026-07-01');assert.equal(c.last.to,'2026-09-26');assert.equal(c.last.partial,true);
});
test('monthly comparison needs two populated months and honours a clipped date range',()=>{
 for(const items of [[],[topic('a','billerbeck',['2026-07-03'])]])assert.equal(buildAnalytics(items,coverage,regions,q).monthlyComparison.available,false);
 const items=[topic('a','billerbeck',['2026-07-03']),topic('b','billerbeck',['2026-07-17']),topic('c','billerbeck',['2026-09-08'])];
 const d=buildAnalytics(items,coverage,regions,{...q,from:'2026-07-15',to:'2026-09-10'});
 assert.equal(d.monthlyComparison.first.total,1);assert.equal(d.monthlyComparison.first.from,'2026-07-15');assert.equal(d.monthlyComparison.last.to,'2026-09-10');assert.equal(d.monthlyComparison.changes.length,0);
});
