/** Zuletzt bestätigte Suchen, nur in diesem Browser (höchstens 5, neueste zuerst) */
import { canonicalQuery } from "./savedSearch";

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
  /* Gleiche Suchen in anderer Schreibweise (Groß-/Kleinschreibung, Reihenfolge der Wörter) zählen nur einmal */
  const same = canonicalQuery(t);
  const next = [t, ...readRecent().filter((x) => x !== t && canonicalQuery(x) !== same)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
