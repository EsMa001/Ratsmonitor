import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

/** Blatt von unten (Handy), endet über der unteren Leiste (die bleibt sichtbar und bedienbar): Hintergrund und Escape schließen, Seitenwechsel schließt ebenfalls. Höhe nach Inhalt, höchstens 80 % des Bildschirms. */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const path = usePathname();
  const first = useRef(path);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (first.current !== path) { first.current = path; onClose(); }
  }, [path, onClose]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    ref.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", key);
  }, [open, onClose]);
  /* Weiches Ein- und Ausfahren: das Blatt bleibt nach dem Schließen kurz eingehängt, damit es auch hinausgleiten kann */
  const [prevOpen, setPrevOpen] = useState(open);
  const [exiting, setExiting] = useState(false);
  if (prevOpen !== open) { setPrevOpen(open); setExiting(!open); }
  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => setExiting(false), 260);
    return () => clearTimeout(t);
  }, [exiting]);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setShown(true), 30);
    return () => { clearTimeout(t); setShown(false); };
  }, [open]);
  const mounted = open || exiting;
  /* Wischen nach unten schließt das Blatt: es folgt dem Finger, ab 80 px oder schnellem Zug gleitet es hinaus (nur wenn der Inhalt ganz oben steht) */
  const drag = useRef<{ y: number; t: number; on: boolean } | null>(null);
  const dragStart = (e: React.TouchEvent) => { const el = ref.current; drag.current = { y: e.touches[0].clientY, t: Date.now(), on: !!el && el.scrollTop <= 0 }; };
  const dragMove = (e: React.TouchEvent) => {
    const d = drag.current, el = ref.current; if (!d || !d.on || !el) return;
    const dy = e.touches[0].clientY - d.y;
    if (dy <= 0) { el.style.transition = ""; el.style.translate = ""; return; }
    el.style.transition = "none";
    el.style.translate = `0 ${dy}px`;
  };
  const dragEnd = (e: React.TouchEvent) => {
    const d = drag.current, el = ref.current; drag.current = null;
    if (!d || !d.on || !el) return;
    const dy = e.changedTouches[0].clientY - d.y, fast = dy > 30 && Date.now() - d.t < 250;
    if (dy > 80 || fast) {
      /* Von der aktuellen Stelle aus hinausgleiten (nicht erst zurückspringen): Verschiebung bleibt, Ziel ist ganz unten */
      el.style.transition = "translate 260ms cubic-bezier(.32,.72,0,1)";
      el.style.translate = "0 100%";
      onClose();
    } else {
      el.style.transition = "translate 200ms cubic-bezier(.32,.72,0,1)";
      el.style.translate = "";
    }
  };
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-x-0 top-0 bottom-[var(--rm-tabbar,0px)] z-[1200] overflow-hidden print:hidden">
      <div className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-[260ms] motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`} onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onTouchStart={dragStart} onTouchMove={dragMove} onTouchEnd={dragEnd} onTouchCancel={dragEnd}
        className={`absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white px-4 pb-4 pt-2 outline-none transition-transform duration-[260ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none ${shown ? "translate-y-0" : "translate-y-full"}`}>
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-200" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Zeile in einem Blatt: Linie statt Kasten, mindestens 48 px hoch */
export const SHEET_ROW = "flex min-h-[48px] items-center gap-3 border-b border-slate-100 text-[16px] text-slate-900 no-underline";
export const SHEET_HEAD = "m-0 pb-1 pt-4 text-[14px] font-semibold text-slate-700";
