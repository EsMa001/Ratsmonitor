import { useEffect, useRef } from "react";

const KEY = "rm-xsplit";
const MIN = 0.3, MAX = 0.74;

/**
 * Desktop: Griff zwischen Karte (links) und Auswertung (rechts) zum Ziehen. Die Breite der Karte bleibt für alle plenara.X-Seiten
 * gemerkt (localStorage); Pfeiltasten ändern sie in kleinen Schritten, Doppelklick stellt sie zurück. Wirkt nur ab 1100 px (CSS).
 */
export function SplitHandle() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const current = (main: HTMLElement) => {
    const col = main.firstElementChild ? parseFloat(getComputedStyle(main).gridTemplateColumns.split(" ")[0]) : 0;
    return col / main.getBoundingClientRect().width;
  };
  const apply = (main: HTMLElement | null, left: number | null) => {
    if (!main) return;
    if (left === null) main.style.removeProperty("--xl");
    else main.style.setProperty("--xl", `${(left / (1 - left)).toFixed(4)}fr`);
    /* Wert für Bildschirmleser (Rolle separator): Anteil der Karte in Prozent */
    requestAnimationFrame(() => ref.current?.setAttribute("aria-valuenow", String(Math.round(current(main) * 100))));
  };
  const save = (left: number | null) => { try { if (left === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(left)); } catch { /* ohne Speicher */ } };
  useEffect(() => {
    const main = ref.current?.closest("main") as HTMLElement | null;
    try { const v = parseFloat(localStorage.getItem(KEY) || ""); if (v > MIN && v < MAX) apply(main, v); } catch { /* egal */ }
    return () => apply(main, null);
  }, []);
  const at = (e: React.PointerEvent) => {
    const main = ref.current?.closest("main") as HTMLElement | null;
    if (!main) return null;
    const r = main.getBoundingClientRect();
    return { main, left: Math.min(MAX, Math.max(MIN, (e.clientX - r.left) / r.width)) };
  };
  return (
    <div ref={ref} role="separator" aria-orientation="vertical" aria-valuemin={Math.round(MIN * 100)} aria-valuemax={Math.round(MAX * 100)} aria-valuenow={50} aria-label="Breite von Karte und Auswertung ändern (Pfeiltasten, Doppelklick stellt zurück)" tabIndex={0}
      className="rm-xhandle"
      onPointerDown={(e) => { drag.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ohne Erfassung zieht es trotzdem */ } e.currentTarget.dataset.drag = "1"; }}
      onPointerMove={(e) => { if (!drag.current) return; const p = at(e); if (p) apply(p.main, p.left); }}
      onPointerUp={(e) => { drag.current = false; delete e.currentTarget.dataset.drag; const p = at(e); if (p) save(p.left); }}
      onDoubleClick={() => { const main = ref.current?.closest("main") as HTMLElement | null; apply(main, null); save(null); }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const main = ref.current?.closest("main") as HTMLElement | null;
        if (!main) return;
        const left = Math.min(MAX, Math.max(MIN, current(main) + (e.key === "ArrowLeft" ? -0.02 : 0.02)));
        apply(main, left); save(left);
      }} />
  );
}
