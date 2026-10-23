import test from 'node:test';
import assert from 'node:assert/strict';
import {restLast,isRest} from '../shared/rest-last.mjs';

test('Restposten stehen am Ende, auch mit den meisten Treffern; übrige Reihenfolge bleibt',()=>{
 const list=[{name:'Sonstiges',count:90},{name:'Beschluss',count:40},{name:'Sonstige Leistungen',count:30},{name:'Entwurf',count:20},{name:'andere Flächen',count:5}];
 assert.deepEqual(restLast(list).map(x=>x.name),['Beschluss','Entwurf','Sonstiges','Sonstige Leistungen','andere Flächen']);
 assert.deepEqual(restLast(['Sonstige','Grundsteuer B','Grundsteuer A'],x=>x),['Grundsteuer B','Grundsteuer A','Sonstige']);
 for(const n of ['Ohne Angabe','Noch nicht eingeordnet','Sonstiges'])assert.equal(isRest(n),true,n);
 for(const n of ['Anderes Thema','Sonnenenergie','Beschluss'])assert.equal(isRest(n),false,n);
});
