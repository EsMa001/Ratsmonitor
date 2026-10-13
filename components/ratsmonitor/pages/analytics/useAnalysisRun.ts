import { useCallback, useEffect, useRef, useState } from "react";
import { errorText, fetchJson } from "../../lib/fetchJson";

const FAILED = "Die Auswertung konnte nicht berechnet werden.";

/**
 * Eine Auswertung auf Knopfdruck (plenara.X): Ergebnis, Stand (ranKey), Laden und Fehler.
 * - run(): mit der Abfrage nach diesem Klick rechnen (Knopf „Auswerten“, auch zusammen mit applySearch im selben Klick).
 * - runAfterChange(): erst rechnen, wenn sich die Abfrage geändert hat (Klicks, die erst Ort oder Filter setzen und deren
 *   neue Abfrage später kommt, etwa „Ort auswerten“). Ändert sie sich nicht, passiert nichts.
 * Jeder Wunsch bekommt eine Nummer; Laden heißt: der letzte Wunsch ist noch nicht beantwortet. So wird im Effekt kein
 * Zustand gesetzt, nur in den Antworten des Abrufs.
 * key: woran das Ergebnis hängt (für „veraltet“), url: was abgerufen wird.
 */
export function useAnalysisRun<T>({ key, url, initial, fallback = FAILED, onDone }: { key: string; url: string; initial: boolean; fallback?: string; onDone?: (r: T) => void }) {
  const [ask, setAsk] = useState<{ n: number; after: string | null }>({ n: initial ? 1 : 0, after: null });
  const [done, setDone] = useState<{ n: number; res: T | null; ranKey: string; error: string }>({ n: 0, res: null, ranKey: "", error: "" });
  const abortRef = useRef<AbortController | null>(null);
  /* Jeder Wunsch startet höchstens einen Abruf, auch wenn die Abfrage danach weiter wechselt */
  const startedRef = useRef(0);
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
