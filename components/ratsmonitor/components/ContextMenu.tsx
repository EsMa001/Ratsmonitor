import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { tick } from "../lib/haptic";

export type MenuItem = { label: string; icon?: ReactNode; danger?: boolean; onSelect: () => void };

/** Kleines Menü an der Fingerposition (Handy, langer Druck): Tipp daneben, Scrollen oder Zurück schließen es */
export function ContextMenu({ pos, items, onClose, label }: { pos: { x: number; y: number }; items: MenuItem[]; onClose: () => void; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tick();
    const close = () => onClose();
    window.addEventListener("scroll", close, { passive: true, once: true });
    return () => window.removeEventListener("scroll", close);
  }, [onClose]);
  const W = 232, H = items.length * 46 + 8;
  const left = Math.max(12, Math.min(pos.x - W / 2, window.innerWidth - W - 12));
  const top = pos.y + 16 + H > window.innerHeight - 70 ? Math.max(12, pos.y - H - 16) : pos.y + 16;
  return createPortal(
    <div className="fixed inset-0 z-[1300]" onClick={onClose} onContextMenu={(e) => e.preventDefault()} role="presentation">
      <div className="absolute inset-0 bg-slate-900/25" />
      <div ref={box} role="menu" aria-label={label} onClick={(e) => e.stopPropagation()}
        className="absolute animate-cardIn overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-lg" style={{ left, top, width: W }}>
        {items.map((it) => (
          <button key={it.label} type="button" role="menuitem" onClick={() => { onClose(); it.onSelect(); }}
            className={`flex h-[46px] w-full items-center gap-3 rounded-xl px-3 text-left text-[16px] ${it.danger ? "text-amber-800" : "text-slate-900"}`}>
            <span className="grid w-5 place-items-center text-teal-700">{it.icon}</span>{it.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
