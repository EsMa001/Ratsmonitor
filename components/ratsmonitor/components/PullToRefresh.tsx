import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isStandalone } from "../lib/useInstall";

/** Ziehen zum Aktualisieren, nur in der installierten App (im Browser macht das schon der Browser selbst) und nicht auf der Suche (dort zieht der Finger die Karte).
 *  Am Seitenanfang nach unten ziehen, bei 90 px loslassen: Seite neu laden. Die Anzeige läuft ohne State direkt am Element. */
export function PullToRefresh() {
  const path = usePathname();
  const dot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isStandalone() || path === "/suche") return;
    const el = dot.current;
    let y0: number | null = null, dy = 0;
    const show = (d: number) => { if (el) { el.style.opacity = d > 8 ? "1" : "0"; el.style.transform = `translate(-50%, ${Math.min(d, 110) / 2}px) rotate(${d * 3}deg)`; el.dataset.ready = d >= 90 ? "1" : ""; } };
    const start = (e: TouchEvent) => { y0 = window.scrollY <= 0 ? e.touches[0].clientY : null; dy = 0; };
    const move = (e: TouchEvent) => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); show(dy); };
    const end = () => { const go = dy >= 90; y0 = null; show(0); if (go) window.location.reload(); };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end);
    return () => { document.removeEventListener("touchstart", start); document.removeEventListener("touchmove", move); document.removeEventListener("touchend", end); };
  }, [path]);
  return (
    <div ref={dot} aria-hidden="true" className="pointer-events-none fixed left-1/2 top-[60px] z-[1150] h-8 w-8 rounded-full border-2 border-teal-600 border-t-transparent bg-white opacity-0 shadow-pop transition-opacity data-[ready=1]:bg-teal-50 sm:hidden" />
  );
}
