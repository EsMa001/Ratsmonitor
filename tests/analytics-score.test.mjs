// plenara.X Score (server/integrations/analytics-score.mjs): Ebene, leere Datenbank, Regeln
import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryDb} from './helpers/d1.mjs';
import {scoreMap,SCORE_RULE,SCORE_THEMES} from '../server/integrations/analytics-score.mjs';
import {CATALOG} from '../shared/catalog.mjs';

test('score: unknown level is rejected, empty data gives no items',async()=>{
 const {db}=memoryDb();
 await assert.rejects(scoreMap(db,CATALOG,{level:'land'}),/Ebene/);
 const r=await scoreMap(db,CATALOG,{level:'city',today:new Date('2026-10-12T12:00:00Z')});
 assert.equal(r.items.length,0);
 assert.deepEqual(r.counts,[0,0,0,0,0]);
 assert.equal(r.themes.length,SCORE_THEMES.length);
 assert.equal(SCORE_RULE.themeWeight+SCORE_RULE.workWeight,1);
});
