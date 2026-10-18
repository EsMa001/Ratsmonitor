import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

/** Blatt von unten (Handy): Hintergrund und Escape schließen, Seitenwechsel schließt ebenfalls. Höhe nach Inhalt, höchstens 80 % des Bildschirms. */
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
    ref.current?.focus();
    return () => document.removeEventListener("keydown", key);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1200] print:hidden">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        className="rm-fade-in absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-2 outline-none">
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
