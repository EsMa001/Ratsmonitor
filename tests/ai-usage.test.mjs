import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../server/integrations/ai-summary.mjs';
import { summarizeUsage } from '../shared/ai-usage.mjs';

const source = 'Der Rat beschließt die Satzung über Kostenerstattungsbeträge für Ausgleichsmaßnahmen im Stadtgebiet. Die Kosten betragen 120 Euro je Quadratmeter.';
const topic = { sourceUrl: 'https://x/y', public: true, officialTitle: 'Satzung', status: 'consulting', events: [], sourceText: source, hasDocumentText: true };
const good = { title: 'Satzung zur Kostenerstattung', shortSummary: 'Der Rat berät eine Satzung.', longSummary: ['Absatz eins.', 'Absatz zwei.'], evidence: [source.slice(0, 60), source.slice(60, 120)] };
const reply = (content, usage) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }], usage }) });
const run = async (answers) => { const real = globalThis.fetch; let i = 0; globalThis.fetch = async () => answers[i++]; try { return await summarize(topic, { apiKey: 'k', model: 'm1' }); } finally { globalThis.fetch = real; } };

test('Token beider Aufrufe werden erfasst', async () => {
  const t = await run([reply(good, { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 40 } }), reply({ passed: true, issues: [] }, { prompt_tokens: 150, completion_tokens: 5 })]);
  assert.equal(t.aiUsage.model, 'm1');
  assert.deepEqual(t.aiUsage.summary, { prompt: 100, completion: 20, cached: 40 });
  assert.deepEqual(t.aiUsage.check, { prompt: 150, completion: 5, cached: 0 });
  assert.equal(t.aiUsage.total, 275);
  assert.equal(t.aiUsage.outcome, 'ok');
  assert.deepEqual([t.aiUsage.words, t.aiUsage.sources, t.aiUsage.attachments], [18, 1, 0]);
});

test('fehlgeschlagene Prüfung wird trotzdem erfasst', async () => {
  const t = await run([reply(good, { prompt_tokens: 100, completion_tokens: 20 }), reply({ passed: false, issues: ['x'] }, { prompt_tokens: 150, completion_tokens: 5 })]);
  assert.equal(t.summaryIssue, 'Sachprüfung fehlgeschlagen');
  assert.equal(t.aiUsage.total, 275);
  assert.equal(t.aiUsage.outcome, 'Sachprüfung fehlgeschlagen');
});

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
