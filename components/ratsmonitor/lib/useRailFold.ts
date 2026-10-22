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
