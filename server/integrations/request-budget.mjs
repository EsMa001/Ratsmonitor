/** Bound subsequent requests and each real network operation to one source budget. */
export function budgeted(get, maxDurationMs, timeoutArgument = 1) {
 const deadline = Date.now() + maxDurationMs;
 return (...args) => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw Error('Zeitbudget der Quelle erreicht');
  args[timeoutArgument] = Math.min(timeoutArgument===2?20000:55000, remaining);
  return get(...args);
 };
}
