import test from 'node:test';
import assert from 'node:assert/strict';
import {withoutPrivateNames,withoutPrivateNamesDeep} from '../shared/private-names.mjs';

test('names of private persons leave every text of a report, addresses and ids stay, an office after the salutation is no name',()=>{
 const t={id:'x-Herr-Meier',title:'Bauantrag der Familie Meier',officialTitle:'Bauantrag der Familie Meier',url:'https://a.test/Herr Meier',events:[{description:'Herr Müller\nerläutert',url:'https://a.test/b'}],identityLinks:['https://a.test/Frau Schulz'],publicity:undefined};
 const d=withoutPrivateNamesDeep(t);
 assert.equal(d.title,'Bauantrag der Familie …');assert.equal(d.events[0].description,'Herr …\nerläutert');
 assert.equal(d.id,t.id);assert.equal(d.url,t.url);assert.deepEqual(d.identityLinks,t.identityLinks);
 assert.equal(withoutPrivateNames('Bericht von Frau Bürgermeisterin Schulz'),'Bericht von Frau Bürgermeisterin Schulz');
 assert.equal(withoutPrivateNames('Anfrage Herr Landrat'),'Anfrage Herr Landrat');
});
