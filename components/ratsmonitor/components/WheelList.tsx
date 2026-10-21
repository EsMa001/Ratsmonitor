"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

const WHEEL_ROW = 68;

/**
 * Handy: Walze zum Wischen. Genau drei gleich hohe Zeilen sichtbar (nie eine angeschnittene), die Zeilen rasten oben ein; ganz oben
 * steht ohne Leerraum die erste Zeile, ganz unten endet das Wischen mit der letzten Zeile. Ohne Markierung der Zeilen.
 * Hinweis auf das Wischen: drei Punkte am unteren Rand des Fensters (ohne eigene Höhe), nur solange man noch nicht gewischt hat.
 */
export function WheelList({ items }: { items: ReactNode[]; resetKey?: string }) {
  const ref = useRef<HTMLOListElement>(null);
  const [more, setMore] = useState(items.length > 3);
  const measure = () => {
    const el = ref.current;
    /* Punkte nur am Anfang: sobald man wischt, verschwinden sie */
    if (el) setMore(el.scrollTop < 2 && el.scrollHeight > el.clientHeight + 2);
  };
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });
  return (
    <div className="relative rounded-xl" style={{ height: WHEEL_ROW * 3 }}>
      <ol ref={ref} onScroll={measure} className="relative m-0 h-full list-none snap-y snap-mandatory overflow-y-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ overscrollBehavior: "contain" }}>
        {items.map((it, i) => (
          <li key={i} className="snap-start overflow-hidden" style={{ height: WHEEL_ROW, scrollSnapStop: "always" }}>{it}</li>
        ))}
      </ol>
      {more && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-1 flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((d) => <span key={d} className="h-1 w-1 rounded-full bg-teal-600/60" />)}
        </div>
      )}
    </div>
  );
}
