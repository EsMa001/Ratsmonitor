import { useEffect, useState, useSyncExternalStore } from "react";

/* Kennzahl für das Kopfband der plenara.X-Seiten: die erste große Zahl der Seite (Kennzahlen) erscheint auch im Kopf */
type Figure = { value: string; label: string; week?: number | null; scope?: string; period?: string } | null;
let current: Figure = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function publishBandFigure(f: Figure) {
  if (current?.value === f?.value && current?.label === f?.label && current?.week === f?.week && current?.scope === f?.scope && current?.period === f?.period) return;
  current = f;
  emit();
}
export function useBandFigure(): Figure {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => current, () => null);
}

/** Zahl kurz hochzählen (0,7 s); bei „Bewegung reduzieren“ sofort der Endwert. Gibt den Text im deutschen Format zurück. */
export function useCountUp(text: string): string {
  const target = Number(text.replace(/\./g, "").replace(",", "."));
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!Number.isFinite(target) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => { /* Der Zeitstempel des ersten Bilds kann vor t0 liegen: nie unter 0, sonst kurz eine negative Zahl */ const p = Math.max(0, Math.min(1, (t - t0) / 700)); setShown(Math.round(target * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); else setShown(null); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown === null || !Number.isInteger(target) ? text : shown.toLocaleString("de-DE");
}
