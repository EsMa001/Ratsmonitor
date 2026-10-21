import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeUsage } from '../shared/ai-usage.mjs';

test('Auswertung: Summe, Durchschnitt, Kosten nur mit Preistabelle, unbekannt separat', () => {
  const row = (model, total, outcome = 'ok', words = 1000) => ({ method: 'x', agent: 'a', model, outcome, total_tokens: total, input_tokens: total - 10, output_tokens: 10, cached_tokens: 0, word_count: words, source_count: 2, attachment_count: 1 });
  const unknown = { method: 'x', agent: 'a', model: 'm1', outcome: 'completed', total_tokens: null, word_count: 500, source_count: 1, attachment_count: 0 };
  const r = summarizeUsage([row('m1', 1000), row('m1', 3000, 'Sachprüfung fehlgeschlagen'), unknown, row('m2', 500)], 7, { m1: { currency: 'USD', input: 1, output: 2 } });
  const m1 = r.models.find((m) => m.model === 'm1');
  assert.equal(m1.totalTokens, 4000);
  assert.equal(m1.avgTotalPerArticle, 2000);
  assert.equal([m1.incomplete, m1.withTokens, m1.withoutTokens].join(), '1,2,1');
  assert.equal(m1.avgWords, 833);
  assert.equal(m1.tokensPer1000Words, 2000);
  assert.equal(m1.cost, (3980 * 1 + 20 * 2) / 1e6);
  assert.equal(r.models.find((m) => m.model === 'm2').cost, null);
  assert.equal(r.unknownArticles, 7);
});

test('Auswertung: nur Gesamtwert bekannt ergibt eine Kostenspanne statt 0', () => {
  const rows = [{ method: 'x', agent: 'a', model: 'm1', outcome: 'completed', total_tokens: 1e6, input_tokens: null, output_tokens: null, cached_tokens: null }];
  const m = summarizeUsage(rows, 0, { m1: { currency: 'USD', input: 2, output: 10 } }).models[0];
  assert.equal(m.cost, null);
  assert.deepEqual(m.costRange, [2, 10]);
});
