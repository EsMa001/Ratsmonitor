// Tor für Zahlenfakten (17.10.2026): Qualität ab 90 % und mindestens 10 % der Gemeinden.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP_FACTS} from '../shared/map-facts.mjs';
import {X_FACT_GATE} from '../server/integrations/plenara-x-query.mjs';

test('auf der Karte stehen nur Hebesatz, Wassergebühr und Jahresergebnis', () => {
  const on = MAP_FACTS.filter(([, , o]) => o).map(([k]) => k).sort();
  assert.deepEqual(on, ['annual_result', 'fee_rate', 'hebesatz']);
});

test('Atlas-Tor: Zuschüsse und Gewerbegrundstücke zu, Hebesatz, Wassergebühr und Jahresergebnis offen', () => {
  assert.equal(X_FACT_GATE.grant, false);
  assert.equal(X_FACT_GATE.land_price, false);
  for (const k of ['hebesatz', 'fee_rate', 'annual_result']) assert.equal(X_FACT_GATE[k], true, k);
});
