import { useRef } from "react";

/** Langer Druck (Handy) oder Rechtsklick (Desktop): nach 0,5 s ohne Wischen ruft cb mit der Fingerposition; danach zählt das Loslassen nicht als Tipp. */
export function useLongPress(cb: (pos: { x: number; y: number }) => void, ms = 500) {
  const t = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const stop = () => { clearTimeout(t.current); start.current = null; };
  return {
    /** Wahr (einmal), wenn der Druck gerade das Menü geöffnet hat: der folgende Tipp soll nichts öffnen */
    consume: () => { const f = fired.current; fired.current = false; return f; },
    handlers: {
      onTouchStart: (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return stop();
        const p = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        start.current = p; fired.current = false;
        clearTimeout(t.current);
        t.current = window.setTimeout(() => { fired.current = true; cb(p); }, ms);
      },
      onTouchMove: (e: React.TouchEvent) => {
        const s = start.current; if (!s) return;
        if (Math.hypot(e.touches[0].clientX - s.x, e.touches[0].clientY - s.y) > 8) stop();
      },
      onTouchEnd: stop,
      onTouchCancel: stop,
      /* iOS öffnet bei langem Druck auf einen Link eine eigene Vorschau: hier ersetzt durch unser Menü */
      /* Maus (Desktop): Rechtsklick öffnet dasselbe Menü an der Mauszeiger-Position */
      onContextMenu: (e: React.MouseEvent) => { if (fired.current || start.current) { e.preventDefault(); return; } e.preventDefault(); cb({ x: e.clientX, y: e.clientY }); },
    },
  };
}
