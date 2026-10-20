/* Gemeinsame Teile der Auswertungsseiten: Ladezustand und Hero-Rahmen */

/** Fläche des Ergebnisses beim Neuladen: gedämpft und für Hilfstechnik als „beschäftigt“ markiert */
export const busyProps = (loading: boolean) => ({ className: loading ? "opacity-60 transition-opacity" : "transition-opacity", "aria-busy": loading });

/** Pulsierender Schleier über einer Bühne, solange die neue Antwort noch aussteht (alter Stand bleibt sichtbar) */
export function PendingVeil() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] animate-pulse bg-slate-100/70" />;
}

/** Seiten mit Hero-Bühne statt Karte (Beschlusslage, Fraktionen, Nachrichten) */
export const HERO_MAIN = "rm-xwide rm-xhero rm-noplay w-full px-[max(1vw,16px)] pb-10 text-slate-900";
export const HERO_PANEL = "rm-xsplit-map rm-xhero-panel rm-netstage";
