import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/* Beim Zurückgehen (Zurück-Taste, Wischen) an die Stelle der Seite zurückkehren, an der man war.
   Gemerkt wird je Seite und Auswahl (Pfad plus Adresse) die Scrollhöhe in der Sitzung; wiederhergestellt wird nur, wenn die Seite durch
   „zurück“ geöffnet wurde, nicht bei einem frischen Aufruf. Die Seite lädt ihre Daten nach, deshalb wird gewartet, bis sie hoch genug ist. */
let lastPop = 0;
if (typeof window !== "undefined") window.addEventListener("popstate", () => { lastPop = Date.now(); });

/* Seite wurde per Zurück als neues Dokument geladen (kein Einzelseiten-Wechsel): nur beim ersten Aufruf zählt das */
let firstUse = true;
const loadedByBack = () => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type === "back_forward";

const MAX_AGE = 30 * 60 * 1000;
const read = (key: string): number | null => {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) || "null") as { y: number; at: number } | null;
    return v && Date.now() - v.at < MAX_AGE ? v.y : null;
  } catch { return null; }
};

export function useScrollMemory() {
  const path = usePathname(), params = useSearchParams().toString();
  const key = `rm-scroll:${path}?${params}`;
  useEffect(() => {
    let timer = 0, stop = false;
    const save = () => {
      timer = 0;
      try { sessionStorage.setItem(key, JSON.stringify({ y: Math.round(window.scrollY), at: Date.now() })); } catch { /* Speicher gesperrt */ }
    };
    const onScroll = () => { if (!timer) timer = window.setTimeout(save, 200); };
    /* Zurück geöffnet: gemerkte Höhe ansteuern, sobald die Seite so hoch ist (höchstens 4 s warten) */
    const hardBack = firstUse && loadedByBack();
    firstUse = false;
    const saved = hardBack || Date.now() - lastPop < 1500 ? read(key) : null;
    if (saved && saved > 40) {
      const t0 = Date.now();
      const tick = () => {
        if (stop) return;
        const need = saved + window.innerHeight;
        if (document.documentElement.scrollHeight >= need || Date.now() - t0 > 4000) { window.scrollTo(0, saved); window.addEventListener("scroll", onScroll, { passive: true }); return; }
        requestAnimationFrame(tick);
      };
      tick();
    } else window.addEventListener("scroll", onScroll, { passive: true });
    return () => { stop = true; window.removeEventListener("scroll", onScroll); if (timer) window.clearTimeout(timer); };
  }, [key]);
}
