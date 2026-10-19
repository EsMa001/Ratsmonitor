import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";

export interface DropItem { id: string; label: string; count?: string; icon?: ReactNode; dot?: string }

/**
 * Auswahlliste für den Desktop (am Handy übernehmen Blätter und Räder): ein Knopf mit Name und gewähltem Wert, darunter die Liste mit Zahlen.
 * Ersetzt lange Reihen von Pillen (Schritt, Art, „Alle Seiten“); Pfeiltasten und Esc funktionieren, Klick daneben schließt.
 */
export function Dropdown({ label, items, value, onPick, noCurrent = false, className = "" }: { label: string; items: DropItem[]; value: string; onPick: (id: string) => void; /** keinen Wert im Knopf zeigen (Seitenwahl) */ noCurrent?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const cur = items.find((i) => i.id === value) ?? items[0];
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div ref={box} className={`relative max-sm:hidden print:hidden ${className}`}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}
        className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[14px] ${value && !noCurrent ? "border-teal-700 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}>
        <span className="text-slate-500">{label}{noCurrent ? "" : ":"}</span>
        {!noCurrent && <span className="font-medium">{cur.label}{cur.count ? <span className="ml-1.5 font-normal tabular-nums text-slate-500">{cur.count}</span> : null}</span>}
        <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="absolute left-0 top-full z-40 mt-1 max-h-[360px] min-w-[260px] list-none overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {items.map((i) => {
            const on = !noCurrent && i.id === value;
            return (
              <li key={i.id || "alle"} role="option" aria-selected={on}>
                <button type="button" onClick={() => { onPick(i.id); setOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] ${on ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}>
                  {i.icon ?? (i.dot ? <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${i.dot}`} /> : <span className="w-2" />)}
                  <span className="min-w-0 flex-1 truncate">{i.label}</span>
                  {i.count && <span className="tabular-nums text-slate-500">{i.count}</span>}
                  {on && <Check size={14} strokeWidth={2} aria-hidden="true" className="text-teal-700" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Aktive Filter als Chips mit Kreuz (Desktop): zeigt, was gilt, und löst jeden einzeln; mehr als einer: „Zurücksetzen“ */
export function AktiveFilter({ chips, onReset }: { chips: { key: string; label: string; onClear: () => void }[]; onReset?: () => void }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 max-sm:hidden print:hidden" role="group" aria-label="Aktive Filter">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex h-8 items-center gap-1 rounded-xl bg-slate-100 pl-3 pr-1 text-[14px] text-slate-800">
          {c.label}
          <button type="button" onClick={c.onClear} aria-label={`${c.label} entfernen`} className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900"><X size={14} strokeWidth={1.8} aria-hidden="true" /></button>
        </span>
      ))}
      {chips.length > 1 && onReset && <button type="button" onClick={onReset} className="h-8 px-2 text-[14px] font-medium text-teal-700 hover:underline">Zurücksetzen</button>}
    </div>
  );
}
