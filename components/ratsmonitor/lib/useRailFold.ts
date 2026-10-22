import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * Kachelleiste von plenara.X (nav.rm-xrail): die aufgeklappte Unterliste (.rm-rail-sub) schließt sich bei einem Klick außerhalb
 * der Leiste (Karte, Liste); ein Klick auf eine Kachel oder eine neue Auswahl (key) öffnet sie wieder. Die Leiste bekommt dann die
 * Klasse rm-rail-folded (app/styles/analytics.css). Gibt [ref der Leiste, geschlossen, wieder öffnen] zurück.
 */
export function useRailFold(key: string): [RefObject<HTMLElement | null>, boolean, () => void] {
  const ref = useRef<HTMLElement | null>(null);
  const keyRef = useRef(key);
  /* geschlossen für diese Auswahl; eine andere Auswahl ist wieder offen */
  const [foldedAt, setFoldedAt] = useState<string | null>(null);
  useEffect(() => { keyRef.current = key; }, [key]);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setFoldedAt(keyRef.current); };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, []);
  return [ref, foldedAt === key, () => setFoldedAt(null)];
}

/**
 * Verweilen auf einer Kachel der Leiste (Desktop): nach kurzer Zeit (400 ms) klappt deren Unterliste auf, ohne sie zu wählen; verlässt die
 * Maus die Leiste (samt Unterliste), schließt sie nach 250 ms wieder. Gibt die verweilte Kennung und die Ereignisse für Leiste und Kachel.
 */
export function useRailPeek() {
  const [peek, setPeek] = useState("");
  const enterT = useRef<ReturnType<typeof setTimeout> | null>(null), leaveT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = (t: { current: ReturnType<typeof setTimeout> | null }) => { if (t.current) clearTimeout(t.current); t.current = null; };
  useEffect(() => () => { clear(enterT); clear(leaveT); }, []);
  return {
    peek,
    nav: {
      onMouseEnter: () => clear(leaveT),
      onMouseLeave: () => { clear(enterT); clear(leaveT); leaveT.current = setTimeout(() => setPeek(""), 250); },
    },
    tile: (id: string) => ({
      onMouseEnter: () => { clear(enterT); enterT.current = setTimeout(() => setPeek(id), 400); },
      onMouseLeave: () => clear(enterT),
    }),
  };
}
