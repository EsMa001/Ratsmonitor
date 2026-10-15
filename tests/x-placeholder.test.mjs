import test from 'node:test';
import assert from 'node:assert/strict';
import {PLACEHOLDER} from '../server/integrations/plenara-x-query.mjs';

test('Platzhalter-Gremium: eine Regel, echte Namen bleiben',()=>{
 for(const g of ['Gremium','Gremium laut Originalquelle','gremium laut originalquelle','Gremium laut Originalquelle, Gremium laut Originalquelle'])assert.ok(PLACEHOLDER.test(g),g);
 for(const g of ['Gremium für Verkehrsfragen','Rat','Ausschuss laut Originalquelle'])assert.ok(!PLACEHOLDER.test(g),g);
});
