/** Zuletzt bestätigte Suchen, nur in diesem Browser (höchstens 5, neueste zuerst) */
const KEY = "ratsmonitor:recent:v1";
const MAX = 5;

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function addRecent(q: string) {
  const t = q.trim();
  if (!t) return;
  const next = [t, ...readRecent().filter((x) => x !== t)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
