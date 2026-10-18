import { useRef, useState, type TouchEvent } from "react";

/** Waagerechtes Wischen auf dem Handy. Gibt Berührungs-Handler und die aktuelle Verschiebung zurück; `onSwipe(-1)` nach links, `onSwipe(1)` nach rechts.
 *  Senkrechtes Scrollen bleibt unberührt: erst wenn die Bewegung deutlich waagerecht ist, wird die Geste gezählt. */
export function useSwipe(onSwipe: (dir: -1 | 1) => void, { distance = 72, follow = false }: { distance?: number; follow?: boolean } = {}) {
  const start = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const [dx, setDx] = useState(0);
  return {
    dx,
    handlers: {
      onTouchStart: (e: TouchEvent) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, horizontal: null }; },
      onTouchMove: (e: TouchEvent) => {
        const s = start.current; if (!s) return;
        const t = e.touches[0], mx = t.clientX - s.x, my = t.clientY - s.y;
        if (s.horizontal === null && Math.hypot(mx, my) > 10) s.horizontal = Math.abs(mx) > Math.abs(my) * 1.6;
        if (s.horizontal && follow) setDx(Math.max(-120, Math.min(120, mx)));
      },
      onTouchEnd: (e: TouchEvent) => {
        const s = start.current; start.current = null;
        if (!s || !s.horizontal) { setDx(0); return; }
        const mx = e.changedTouches[0].clientX - s.x;
        setDx(0);
        if (Math.abs(mx) >= distance) onSwipe(mx < 0 ? -1 : 1);
      },
      onTouchCancel: () => { start.current = null; setDx(0); },
    },
  };
}
