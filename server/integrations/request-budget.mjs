export const BUDGET_REACHED = 'Zeitbudget der Quelle erreicht';
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
