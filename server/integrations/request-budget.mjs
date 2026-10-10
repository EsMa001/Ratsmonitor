export const BUDGET_REACHED = 'Zeitbudget der Quelle erreicht';
/** A server that answers a burst of requests with a rejection page (sent with HTTP 200) refused this request for now. */
export const REFUSED = 'Quelle antwortet mit HTTP 429: Abruf vom Server vorübergehend abgewiesen';
/**
 * Rejection pages of web application firewalls in front of council systems, e.g. "… mit Angabe der folgenden
 * Fehler-Nummer: 7571357861314030815" or "Your support ID is: 123…". Only short pages count.
 */
export const isRejectionPage = (html) => html.length < 8000 && /(?:Fehler-Nummer|support ID(?: is)?)\D{0,40}\d{10,}/i.test(html);
/**
 * After a rejection the source is asked more slowly for the rest of the import: at least `spacingMs` between two
 * requests, whatever the number of parallel workers. The rejection itself is passed on.
 */
export function paced(get, { spacingMs = 600 } = {}) {
 let spacing = 0, next = 0;
 return async (...args) => {
  if (spacing) {
   const at = Math.max(Date.now(), next);
   next = at + spacing;
   if (at > Date.now()) await sleep(at - Date.now());
  }
  try {
   return await get(...args);
  } catch (e) {
   const message = String(e?.message || e);
   if (message.includes(REFUSED)) spacing = spacingMs;
   // Nothing goes out any more (the budget is used up, or refusalGate ended the import): no more waiting either.
   else if (message === BUDGET_REACHED) spacing = 0;
   throw e;
  }
 };
}
/* Vorübergehende Fehler: eigene Zeitüberschreitung oder Serverfehler der Quelle. Nicht 429 und keine Abweisungsseite:
   Wer „zu viele Anfragen“ meldet, wird nicht gleich erneut gefragt (robots-policy.mjs); refusalGate beendet den Schritt. */
const TRANSIENT = /aborted|timeout|timed out|HTTP (502|503|504)\b/i;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** A refusal of the source: HTTP 429, or a rejection page (REFUSED names HTTP 429 as well). */
export const isRefusal = (e) => /HTTP 429\b/.test(String(e?.message || e));
/** Retry-After of an answer (seconds, or an HTTP date) in milliseconds from now; null without a usable value. */
export function retryAfterMs(value, now = Date.now()) {
 const text = String(value ?? '').trim();
 if (!text) return null;
 if (/^\d+$/.test(text)) return Number(text) * 1000;
 const at = Date.parse(text);
 return Number.isFinite(at) ? Math.max(0, at - now) : null;
}
/** Error for an answer that is not ok: prefix plus status; a 429 or 503 carries its Retry-After as retryAfterMs. */
export const statusError = (prefix, response) => Object.assign(Error(prefix + response.status), response.status === 429 || response.status === 503 ? { retryAfterMs: retryAfterMs(response.headers?.get?.('retry-after')) } : {});
/**
 * Ends an import's requests to its source at the first refusal (HTTP 429 or a rejection page). The refused request
 * fails as before; every later one fails at once with BUDGET_REACHED, so the readers stop as at the end of their time
 * budget and the import counts as resumable. gate.refused ({retryAfterMs}) tells the caller; the job then pauses that
 * server (pipeline-jobs.mjs) instead of asking it again at once.
 */
export function refusalGate() {
 let refused = null;
 return {
  get refused() { return refused; },
  wrap: (fn) => async (...args) => {
   if (refused) throw Error(BUDGET_REACHED);
   try {
    return await fn(...args);
   } catch (e) {
    if (!refused && isRefusal(e)) refused = { retryAfterMs: Number.isFinite(e?.retryAfterMs) ? e.retryAfterMs : null };
    throw e;
   }
  },
 };
}

/**
 * Bound subsequent requests and each real network operation to one source budget.
 * - Ein Abruf, den erst das Ende des Budgets abschneidet, meldet "Zeitbudget" statt eines Fehlers:
 *   der Abruf gilt dann als fortsetzbar, nicht als gescheitert.
 * - Vorübergehende Fehler werden einmal wiederholt (mit Pause und Streuung), wenn das Restbudget reicht.
 */
export function budgeted(get, maxDurationMs, timeoutArgument = 1, { retries = 1, pauseMs = 1500 } = {}) {
 const deadline = Date.now() + maxDurationMs;
 const limit = timeoutArgument === 2 ? 20000 : 55000;
 const run = async (args) => {
  for (let attempt = 0; ; attempt++) {
   const remaining = deadline - Date.now();
   if (remaining <= 0) throw Error(BUDGET_REACHED);
   const cut = remaining < limit;
   args[timeoutArgument] = Math.min(limit, remaining);
   try {
    return await get(...args);
   } catch (e) {
    const message = String(e?.message || e);
    if (cut && /aborted|timeout/i.test(message) && Date.now() >= deadline - 250) throw Error(BUDGET_REACHED);
    const pause = pauseMs * (attempt + 1) * (0.75 + Math.random() * 0.5);
    /* Wiederholen nur, wenn danach noch ein voller Abruf ins Budget passt */
    if (attempt < retries && TRANSIENT.test(message) && deadline - Date.now() - pause > Math.min(limit, 10000)) {
     await sleep(pause);
     continue;
    }
    throw e;
   }
  }
 };
 /* Abgelaufenes Budget sofort melden (synchron), damit kein neuer Abruf mehr beginnt */
 return (...args) => {
  if (deadline - Date.now() <= 0) throw Error(BUDGET_REACHED);
  return run(args);
 };
}
