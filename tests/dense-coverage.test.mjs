import test from 'node:test';
import assert from 'node:assert/strict';
import {denseCoverageSeries,DENSE_PER_1000} from '../shared/coverage.mjs';

test('genug Berichte je Einwohner: Mittel über das Fenster nach Sitzungstag, Einwohner nur bei Gemeinden',()=>{
 assert.equal(DENSE_PER_1000,0.1);
 const events={days:['2026-10-01','2026-10-20','2026-08-01'],areas:{a:[[0,1],[1,1]],b:[[1,40]],c:[[1,1]]}};
 const catalog=[{id:'a',kind:'city'},{id:'b',kind:'district'},{id:'c',kind:'city'}],population={a:10000,b:300000,c:1000000};
 // 30 Tage: a 2 Berichte/10.000 = 0,2 je 1.000 → ja; b 40/300.000 = 0,13 → ja (Kreis, ohne Einwohner); c 0,001 → nein
 assert.deepEqual(denseCoverageSeries(events,catalog,population,{window:30,span:1,today:'2026-10-24'}),[{day:'2026-10-24',areas:2,population:10000}]);
 // 90 Tage: dieselben Berichte auf drei Monate verteilt: a 0,067 und b 0,044 je Monat → nein
 assert.deepEqual(denseCoverageSeries(events,catalog,population,{window:90,span:1,today:'2026-10-24'}),[{day:'2026-10-24',areas:0,population:0}]);
 // ein Tag vor der Sitzung vom 20.10. zählt sie noch nicht
 assert.equal(denseCoverageSeries(events,catalog,population,{window:30,span:6,today:'2026-10-24'})[0].areas,0);
});
