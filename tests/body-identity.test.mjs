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
