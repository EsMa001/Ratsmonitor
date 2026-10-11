// „Viel oder wenig“ für einen Ort: Spanne, Einordnung, Vergleichsgruppe (server/integrations/analytics-radar-norms.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import {wilson,classify,quantile,typeOf,peerGroup,windowOf} from '../server/integrations/analytics-radar-norms.mjs';

test('wilson interval and cautious classification',()=>{
 const [lo,hi]=wilson(11,580);
 assert.ok(lo>0.009&&lo<0.011&&hi>0.033&&hi<0.035,`${lo} ${hi}`);
 assert.equal(classify(4,100,0.001,0.002),null,'unter 5 Vorgängen keine Einordnung');
 assert.equal(classify(11,580,0.007,0.016),'ueblich');
 assert.equal(classify(40,580,0.007,0.016),'mehr');
 assert.equal(classify(5,2000,0.02,0.04),'weniger');
 assert.equal(quantile([1,2,3,4],0.5),2.5);
});

test('peer group: same type and size, first in the same land',()=>{
 const mk=(i,land,pop,extra={})=>({id:'r'+i,ags:land+'000'+String(i).padStart(3,'0'),name:'Stadt X'+i,kind:'city',...extra,pop});
 const regions=[...Array.from({length:20},(_,i)=>mk(i,'05',15000)),...Array.from({length:20},(_,i)=>mk(100+i,'09',15000)),mk(999,'05',15000,{independent:true})];
 const POP=Object.fromEntries(regions.map(r=>[r.id,r.pop]));
 const nrw=peerGroup(regions[0],regions,()=>true,POP);
 assert.equal(nrw.regions.length,19);assert.ok(nrw.regions.every(r=>r.ags.startsWith('05')));
 assert.equal(nrw.label,'kreisangehörigen Gemeinden in Nordrhein-Westfalen, 10.000 bis 20.000 Einwohner');
 const few=peerGroup(regions[0],regions,id=>!/^r1\d$/.test(id)&&!/^r[2-9]$/.test(id)||id.length>3,POP);
 assert.match(few.label,/bundesweit/);
 assert.equal(typeOf({kind:'district'}).id,'kreis');
 assert.equal(typeOf({kind:'city',members:[{}]}).id,'verband');
 assert.equal(typeOf({kind:'city',independent:true}).id,'kreisfrei');
 assert.equal(typeOf({kind:'city',name:'Stadt Billerbeck'}).id,'gemeinde');
 assert.deepEqual(windowOf(new Date('2026-10-11T12:00:00Z')),{from:'2025-10-11',to:'2026-10-11'});
});
