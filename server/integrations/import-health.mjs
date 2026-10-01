/** A successful transfer may be partial; it is never proof of complete coverage. */
export function importHealth(previous = {}, {at, count = 0, complete = false, failed = false, quiet = false}) {
 // A short look-back window without meetings: the attempt succeeded, the stored stock is unchanged.
 if (quiet && !failed) return {
  lastAttemptAt: at,
  lastSuccessAt: previous.lastSuccessAt || previous.importedAt || null,
  lastCompleteAt: previous.lastCompleteAt || null,
  attemptStatus: 'unchanged',
  failureCount: 0,
  nextRetryAt: null,
 };
 const accepted = !failed && (count > 0 || complete);
 const failureCount = accepted ? 0 : (previous.failureCount || 0) + 1;
 return {
  lastAttemptAt: at,
  lastSuccessAt: accepted ? at : previous.lastSuccessAt || previous.importedAt || null,
  lastCompleteAt: accepted && complete ? at : previous.lastCompleteAt || null,
  attemptStatus: failed ? 'failed' : complete ? 'completed' : count ? 'partial' : 'empty',
  failureCount,
  nextRetryAt: failureCount ? new Date(Date.parse(at) + Math.min(24, 2 ** Math.min(failureCount, 5)) * 3600000).toISOString() : null,
 };
}
