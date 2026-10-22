import { useEffect, useRef } from "react";

/**
 * Verweilen statt sofort: ein Wert (etwa der Ort unter der Maus in einer Liste) wird erst gesetzt, wenn er so lange (ms) bleibt;
 * der leere Wert (Maus weg) gilt sofort. So zoomt die Karte nicht bei jedem Überfahren der Liste.
 */
export function useDwell<T>(set: (v: T) => void, empty: NoInfer<T>, ms = 500) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef(set);
  useEffect(() => { ref.current = set; });
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  return (v: T) => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
    if (v === empty) { ref.current(v); return; }
    t.current = setTimeout(() => ref.current(v), ms);
  };
}
