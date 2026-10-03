// Token usage per AI processing attempt and its evaluation per model.
// Prices are never guessed: cost is only computed for models listed in the price table
// (USD or EUR per 1 million tokens). Unknown tokens (NULL) are never estimated.
const COLUMNS = 'id,topic_id,region_id,method,agent,model,kinds,created_at,outcome,token_basis,source_count,attachment_count,word_count,input_tokens,output_tokens,cached_tokens,total_tokens,summary_prompt_tokens,summary_completion_tokens,summary_cached_tokens,check_prompt_tokens,check_completion_tokens,check_cached_tokens';
const n = (v) => (Number.isFinite(v) ? v : null);

/** Statement that stores one attempt. r.summary/r.check are the per-call usages of the OpenAI path ({prompt,completion,cached}). */
export function insertUsage(db, r) {
  const s = r.summary, c = r.check;
  const values = [crypto.randomUUID(), r.topicId, r.regionId, r.method, r.agent, r.model, r.kinds, r.at, r.outcome, r.basis,
    n(r.sources), n(r.attachments), n(r.words), n(r.input), n(r.output), n(r.cached), n(r.total),
    n(s?.prompt), n(s?.completion), n(s?.cached), n(c?.prompt), n(c?.completion), n(c?.cached)];
  return db.prepare(`INSERT INTO ai_usage(${COLUMNS}) VALUES(${values.map(() => '?').join(',')})`).bind(...values);
}

/** Normalizes the tokens an agent reported for an article; basis 'unknown' (or nothing reported) keeps the tokens NULL. */
export function agentUsage(usage) {
  if (!usage || usage.basis === 'unknown') return { basis: 'unknown', input: null, output: null, cached: null, total: null };
  const ok = (v) => Number.isInteger(v) && v >= 0;
  // Only a total known (e.g. subagent report without input/output split): store it, leave the split NULL.
  if (usage.totalTokens !== undefined && usage.inputTokens === undefined && usage.outputTokens === undefined) {
    if (!['measured', 'estimated'].includes(usage.basis) || !ok(usage.totalTokens)) throw Error('usage: basis und ganzzahliges totalTokens erforderlich.');
    return { basis: usage.basis, input: null, output: null, cached: null, total: usage.totalTokens };
  }
  if (!['measured', 'estimated'].includes(usage.basis) || !ok(usage.inputTokens) || !ok(usage.outputTokens) || (usage.cachedTokens !== undefined && !ok(usage.cachedTokens)))
    throw Error('usage: basis (measured|estimated|unknown) sowie ganzzahlige inputTokens und outputTokens erforderlich.');
  return { basis: usage.basis, input: usage.inputTokens, output: usage.outputTokens, cached: usage.cachedTokens ?? 0, total: usage.inputTokens + usage.outputTokens };
}

const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
const avg = (rows, k) => { const v = rows.filter((r) => r[k] != null); return v.length ? Math.round(sum(v, k) / v.length) : null; };

/** rows: ai_usage rows; unknownCount: AI-processed articles without any usage row; prices: {model:{currency,input,cachedInput?,output}} */
export function summarizeUsage(rows, unknownCount = 0, prices = {}) {
  const groups = new Map();
  for (const r of rows) { const key = `${r.method}\u0000${r.model}`; (groups.get(key) ?? groups.set(key, []).get(key)).push(r); }
  const models = [...groups.values()].map((list) => {
    const known = list.filter((r) => r.total_tokens != null);
    const input = sum(known, 'input_tokens'), cached = sum(known, 'cached_tokens'), output = sum(known, 'output_tokens');
    const p = prices[list[0].model];
    // Cached input tokens are billed at the cached rate when one is configured, otherwise at the input rate.
    const split = known.filter((r) => r.input_tokens != null), onlyTotal = known.filter((r) => r.input_tokens == null);
    const cost = p && split.length ? (sum(split, 'input_tokens') - sum(split, 'cached_tokens')) * p.input / 1e6 + sum(split, 'cached_tokens') * (p.cachedInput ?? p.input) / 1e6 + sum(split, 'output_tokens') * p.output / 1e6 : (p && onlyTotal.length ? 0 : null);
    // Tokens without an input/output split: only a range is known (all input .. all output), added to the exact part.
    const rest = sum(onlyTotal, 'total_tokens');
    const costRange = p && onlyTotal.length ? [cost + rest * p.input / 1e6, cost + rest * p.output / 1e6] : null;
    const words = list.filter((r) => r.word_count > 0 && r.total_tokens != null);
    return {
      method: list[0].method, agent: list[0].agent, model: list[0].model,
      attempts: list.length, incomplete: list.filter((r) => r.outcome !== 'ok' && r.outcome !== 'completed').length,
      withTokens: known.length, withoutTokens: list.length - known.length,
      inputTokens: input, cachedTokens: cached, outputTokens: output, totalTokens: sum(known, 'total_tokens'),
      avgTotalPerArticle: avg(known, 'total_tokens'),
      avgWords: avg(list, 'word_count'), avgSources: avg(list, 'source_count'), avgAttachments: avg(list, 'attachment_count'),
      tokensPer1000Words: words.length ? Math.round(sum(words, 'total_tokens') / sum(words, 'word_count') * 1000) : null,
      cost: costRange ? null : cost, costRange, tokensWithoutSplit: sum(onlyTotal, 'total_tokens'), currency: p?.currency ?? null,
    };
  });
  return { models, unknownArticles: unknownCount };
}
