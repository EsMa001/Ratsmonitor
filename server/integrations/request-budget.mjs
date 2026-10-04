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
   if (String(e?.message || e).includes(REFUSED)) spacing = spacingMs;
   throw e;
  }
 };
}
/* Vorübergehende Fehler: eigene Zeitüberschreitung, Überlastung oder Serverfehler der Quelle */
const TRANSIENT = /aborted|timeout|timed out|HTTP (429|502|503|504)\b/i;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
