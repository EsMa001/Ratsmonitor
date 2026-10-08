import { useId, useMemo, useState } from "react";
import { useData } from "../../state/data";
import type { PlaceEntry } from "../../lib/place";

/** Eingabefeld im Stil der Seite */
export const FIELD = "h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-[16px] text-slate-900 outline-none placeholder:text-slate-500 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

/**
 * Ortsfeld für den Gebietsvergleich: ab drei Buchstaben erscheinen Vorschläge, ein Klick (oder Enter) wählt den Ort.
 * Der gewählte Ort steht dann als Kapsel im Feld und lässt sich mit dem Kreuz entfernen.
 */
export function PlaceField({ label, color, value, onChange, onEnter }: { label: string; color: string; value: PlaceEntry | null; onChange: (p: PlaceEntry | null) => void; onEnter?: () => void }) {
  const { geo, place } = useData();
  const uid = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const items = useMemo(() => (open && place && text.trim().length >= 3 ? place.suggest(text).items : []), [open, place, text]);
  const pick = (p: PlaceEntry) => { onChange(p); setText(""); setOpen(false); setActive(0); };

  return (
    <div className="relative min-w-0">
      <label htmlFor={uid} className="mb-1.5 flex items-center gap-2 text-[14px] font-medium text-slate-700"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</label>
      {value ? (
        <div className="flex h-11 items-center justify-between gap-2 rounded-full border border-slate-200 bg-slate-50 pl-4 pr-1.5">
          <span className="min-w-0 truncate text-[16px] font-medium text-slate-900">{value.name}</span>
          <button type="button" onClick={() => onChange(null)} aria-label={`${value.name} entfernen`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-900">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
      ) : (
        <>
          <input
            id={uid}
            type="search"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={uid + "-liste"}
            aria-autocomplete="list"
            autoComplete="off"
            value={text}
            placeholder="Stadt oder Gemeinde"
            className={FIELD}
            onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && items.length) { e.preventDefault(); setActive((i) => (i + 1) % items.length); }
              else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); setActive((i) => (i - 1 + items.length) % items.length); }
              else if (e.key === "Enter") { e.preventDefault(); if (items.length) pick(items[active]); else onEnter?.(); }
              else if (e.key === "Escape") setOpen(false);
            }}
          />
          {items.length > 0 && (
            <ul id={uid + "-liste"} role="listbox" className="absolute inset-x-0 top-full z-20 m-0 mt-1 list-none overflow-hidden rounded-[16px] border border-slate-200 bg-white p-1 shadow-lg">
              {items.map((p, i) => (
                <li key={p.ags} role="option" aria-selected={i === active}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)} onMouseEnter={() => setActive(i)} className={`block w-full rounded-[12px] px-3 py-2 text-left ${i === active ? "bg-slate-100" : ""}`}>
                    <span className="block truncate text-[16px] text-slate-900">{p.name}</span>
                    <span className="block truncate text-[12px] text-slate-500">{geo?.info(p.ags).meta ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
