import { useEffect, useRef } from "react";

const KEY = "rm-search-split";
/* Breite der Trefferliste: mindestens 420 px, die Karte behält mindestens 360 px */
const MIN = 420, MAP_MIN = 360;

/**
 * Suche, Desktop ab 1100 px: Griff zwischen Karte (links) und Trefferliste (rechts). Ziehen ändert die Breite der Liste
 * (--rm-list am Raster .rm-flat, app/styles/search.css), gemerkt im Browser; Pfeiltasten in kleinen Schritten, Doppelklick stellt zurück.
 */
export function SearchSplit() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const grid = () => ref.current?.closest(".rm-flat") as HTMLElement | null;
  const clamp = (box: HTMLElement, w: number) => Math.round(Math.min(box.getBoundingClientRect().width - MAP_MIN, Math.max(MIN, w)));
  const width = (box: HTMLElement) => (box.querySelector(":scope>main") as HTMLElement | null)?.getBoundingClientRect().width ?? 0;
  const apply = (w: number | null) => {
    const box = grid();
    if (!box) return;
    if (w === null) box.style.removeProperty("--rm-list");
    else box.style.setProperty("--rm-list", `${clamp(box, w)}px`);
    /* Kartenfläche neu messen lassen (MapPanel hört auf Größenänderungen des Fensters) */
    window.dispatchEvent(new Event("resize"));
  };
  const save = (w: number | null) => { try { if (w === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(Math.round(w))); } catch { /* ohne Speicher */ } };
  useEffect(() => {
    try { const v = parseFloat(localStorage.getItem(KEY) || ""); if (v >= MIN) apply(v); } catch { /* egal */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const at = (e: React.PointerEvent) => { const box = grid(); return box ? box.getBoundingClientRect().right - e.clientX : null; };
  return (
    <div ref={ref} role="separator" aria-orientation="vertical" aria-label="Breite von Karte und Trefferliste ändern (Pfeiltasten, Doppelklick: zurücksetzen)" tabIndex={0}
      className="rm-searchsplit"
      onPointerDown={(e) => { drag.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* zieht trotzdem */ } e.currentTarget.dataset.drag = "1"; }}
      onPointerMove={(e) => { if (!drag.current) return; const w = at(e); if (w !== null) apply(w); }}
      onPointerUp={(e) => { drag.current = false; delete e.currentTarget.dataset.drag; const w = at(e); if (w !== null) save(w); }}
      onDoubleClick={() => { apply(null); save(null); }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const box = grid();
        if (!box) return;
        const w = clamp(box, width(box) + (e.key === "ArrowLeft" ? 24 : -24));
        apply(w); save(w);
      }} />
  );
}
