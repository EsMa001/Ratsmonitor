import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseBody,matchesBody} from '../server/integrations/body-identity.mjs';
const source={id:'nrw-05114000',name:'Stadt Krefeld',kind:'city'};
test('official key wins over a misleading matching name',()=>{
 assert.equal(matchesBody({name:'Stadt Krefeld',ags:'05315000'},source),false);
 assert.equal(matchesBody({name:'Krefeld',ags:'051140000'},source),true);
});
test('body selection rejects unknown, deleted and ambiguous bodies',()=>{
 const right={name:'Stadt Krefeld',meeting:'https://example.org/meetings'};
 assert.equal(chooseBody([{name:'Köln'},right],source),right);
 assert.throws(()=>chooseBody([{name:'Andere Stadt',meeting:'x'}],source),/nicht eindeutig/);
 assert.throws(()=>chooseBody([right,{...right}],source),/nicht eindeutig/);
 assert.throws(()=>chooseBody([{...right,deleted:true}],source),/nicht eindeutig/);
});
test('municipal titles normalize without confusing city and district',()=>{
 assert.equal(matchesBody({name:'Kreis Coesfeld'},{name:'Stadt Coesfeld',kind:'city'}),false);
 assert.equal(matchesBody({name:'Hansestadt Herford'},{name:'Stadt Herford'}),true);
 assert.equal(matchesBody({name:'Kreis Coesfeld',ags:'05558000'},{id:'nrw-05558',name:'Kreis Coesfeld',kind:'district'}),true);
 assert.equal(matchesBody({name:'Stadt Coesfeld',ags:'05558012'},{id:'nrw-05558',name:'Kreis Coesfeld',kind:'district'}),false);
});
test('official keys stored as numbers match despite the dropped leading zero',()=>{
 // SD.NET reports "5358016" for 05358016; every source of that provider was rejected because of it.
 const huertgenwald={id:'nrw-05358016',name:'Gemeinde Hürtgenwald',kind:'city'};
 assert.equal(matchesBody({name:'Gemeinde Hürtgenwald',ags:'5358016'},huertgenwald),true);
 assert.equal(matchesBody({name:'Gemeinde Hürtgenwald',ags:5358016},huertgenwald),true);
 assert.equal(matchesBody({name:'Gemeinde Hürtgenwald',ags:'5358020'},huertgenwald),false);
 assert.equal(matchesBody({name:'Krefeld',ags:'51140000'},source),true);
 const district={id:'nrw-05366',name:'Kreis Euskirchen',kind:'district'};
 assert.equal(matchesBody({name:'Kreis Euskirchen',ags:'5366'},district),true);
 assert.equal(matchesBody({name:'Kreis Euskirchen',ags:'5366000'},district),true);
 assert.equal(matchesBody({name:'Kreis Euskirchen',ags:'5370'},district),false);
});
test('a district administration is the district, never the city of the same name',()=>{
 assert.equal(matchesBody({name:'Kreisverwaltung Euskirchen'},{id:'nrw-05366',name:'Kreis Euskirchen',kind:'district'}),true);
 assert.equal(matchesBody({name:'Kreisverwaltung Euskirchen'},{id:'nrw-05366016',name:'Stadt Euskirchen',kind:'city'}),false);
});
test('transliterated umlauts match; an explicit body address overrides every name rule',()=>{
 const duesseldorf={id:'nrw-05111000',name:'Stadt Düsseldorf',kind:'city'};
 assert.equal(matchesBody({name:'Stadt Duesseldorf'},duesseldorf),true);
 assert.equal(matchesBody({name:'Universitätsstadt Siegen'},{name:'Stadt Siegen',kind:'city'}),true);
 assert.equal(matchesBody({name:'Stadt Neuss'},duesseldorf),false);
 // Shared system: the catalog names the verified body, http/https spelling of the provider is irrelevant.
 const district={id:'nrw-05162',name:'Kreis Rhein-Kreis Neuss',kind:'district',body:'https://ris.example/Oparl/bodies/0019'};
 const bodies=[{id:'http://ris.example/Oparl/bodies/0009',name:'Stadt Neuss',meeting:'m'},{id:'http://ris.example/Oparl/bodies/0019',name:'Rheinkreis Neuss',meeting:'m'}];
 assert.equal(chooseBody(bodies,district),bodies[1]);
 assert.throws(()=>chooseBody([bodies[0]],district),/nicht eindeutig/);
 assert.equal(matchesBody({name:'Kreis Rhein-Kreis Neuss'},district),false);
});
