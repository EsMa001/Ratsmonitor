import { useCallback, useEffect, useRef, useState } from "react";
import { errorText, fetchJson } from "../../lib/fetchJson";

const FAILED = "Die Auswertung konnte nicht berechnet werden.";

/* Letzte Ergebnisse je Adresse (10 Minuten, höchstens 30): Wer zwischen Reitern oder Seiten wechselt und zurückkommt,
   sieht das Ergebnis sofort, statt neu zu rechnen. Nur im Browser, nur für diese Sitzung. */
const KEEP_MS = 10 * 60_000;
const recent = new Map<string, { at: number; res: unknown; key: string }>();
const remembered = (url: string) => {
  const r = recent.get(url);
  return r && Date.now() - r.at < KEEP_MS ? r : null;
};
const remember = (url: string, key: string, res: unknown) => {
  recent.delete(url);
  recent.set(url, { at: Date.now(), res, key });
  if (recent.size > 30) recent.delete(recent.keys().next().value!);
};

/**
 * Eine Auswertung auf Knopfdruck (plenara.X): Ergebnis, Stand (ranKey), Laden und Fehler.
 * - run(): mit der Abfrage nach diesem Klick rechnen (Knopf „Auswerten“, auch zusammen mit applySearch im selben Klick).
 * - runAfterChange(): erst rechnen, wenn sich die Abfrage geändert hat (Klicks, die erst Ort oder Filter setzen und deren
 *   neue Abfrage später kommt, etwa „Ort auswerten“). Ändert sie sich nicht, passiert nichts.
 * Jeder Wunsch bekommt eine Nummer; Laden heißt: der letzte Wunsch ist noch nicht beantwortet. So wird im Effekt kein
 * Zustand gesetzt, nur in den Antworten des Abrufs.
 * key: woran das Ergebnis hängt (für „veraltet“), url: was abgerufen wird.
 */
export function useAnalysisRun<T>({ key, url, initial, fallback = FAILED, onDone, keep = true }: { key: string; url: string; initial: boolean; fallback?: string; onDone?: (r: T) => void; /** false: kein Ergebnis aus recent (onDone braucht das Ergebnis) */ keep?: boolean }) {
  /* Schon berechnet (siehe recent): gleich als erledigter Wunsch übernehmen, kein Abruf */
  const [hit] = useState(() => (initial && keep ? remembered(url) : null));
  const [ask, setAsk] = useState<{ n: number; after: string | null }>({ n: initial ? 1 : 0, after: null });
  const [done, setDone] = useState<{ n: number; res: T | null; ranKey: string; error: string }>(() => (hit ? { n: 1, res: hit.res as T, ranKey: hit.key, error: "" } : { n: 0, res: null, ranKey: "", error: "" }));
  const abortRef = useRef<AbortController | null>(null);
  /* Jeder Wunsch startet höchstens einen Abruf, auch wenn die Abfrage danach weiter wechselt */
  const startedRef = useRef(hit ? 1 : 0);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  const waiting = ask.after !== null && ask.after === key;

  useEffect(() => {
    if (!ask.n || waiting || startedRef.current === ask.n) return;
    startedRef.current = ask.n;
    const n = ask.n, ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    fetchJson<T>(url, { signal: ctrl.signal }, fallback)
      .then((r) => {
        setDone({ n, res: r, ranKey: key, error: "" });
        remember(url, key, r);
        onDoneRef.current?.(r);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setDone((d) => ({ ...d, n, error: errorText(e, fallback) }));
      });
    /* Nur auf einen neuen Wunsch hin oder wenn ein wartender Wunsch seine geänderte Abfrage bekommt; url gehört zu key */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask, waiting]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(() => setAsk((a) => ({ n: a.n + 1, after: null })), []);
  const runAfterChange = useCallback(() => setAsk((a) => ({ n: a.n + 1, after: key })), [key]);
  const loading = done.n < ask.n && !waiting;
  const error = done.n === ask.n ? done.error : "";
  const stale = !!done.res && done.ranKey !== key && !loading;
  return { res: done.res, ranKey: done.ranKey, loading, error, stale, run, runAfterChange };
}
