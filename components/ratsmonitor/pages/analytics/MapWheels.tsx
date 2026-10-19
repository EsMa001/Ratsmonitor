import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { tick } from "../../lib/haptic";
import type { RailItem } from "../../components/ChipRail";

const ROW = 48; /* so hoch wie die Suchleiste darunter */

/** Eine Zeile als Walze: wischen blättert durch die Einträge, ein Tipp öffnet die ganze Liste */
function RowWheel({ label, items, value, onPick, onOpen }: { label: string; items: RailItem[]; value: string; onPick: (id: string) => void; onOpen: () => void }) {
  const ref = useRef<HTMLUListElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idx = Math.max(0, items.findIndex((i) => i.id === value));
  /* Von außen geänderte Auswahl (Zurück, Link, Tipp) dreht die Walze mit */
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ROW) !== idx) el.scrollTo({ top: idx * ROW, behavior: "smooth" });
  }, [idx]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
      if (items[i].id !== value) { tick(); onPick(items[i].id); }
    }, 160);
  };
  return (
    <div role="group" aria-label={label} className="relative min-w-0 flex-1 overflow-hidden" style={{ height: ROW }}>
      <ul ref={ref} onScroll={onScroll} className="m-0 list-none snap-y snap-mandatory overflow-y-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ height: ROW, overscrollBehavior: "contain" }}>
        {items.map((it, i) => (
          <li key={it.id || "alle"} className="snap-center" style={{ height: ROW, scrollSnapStop: "always" }}>
            <button type="button" aria-haspopup="listbox" aria-label={`${label}: ${it.label}, Liste öffnen`} onClick={onOpen}
              className={`flex w-full items-center gap-2 pl-4 pr-7 text-left text-[14px] ${i === 0 && !value ? "font-semibold text-slate-900" : "text-slate-800"}`} style={{ height: ROW }}>
              <span className="flex-none text-slate-500">{it.icon}</span><span className="min-w-0 truncate font-medium">{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <ChevronsUpDown size={16} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -mt-2 text-slate-400" />
    </div>
  );
}

/**
 * Handy: Thema und Unterthema als eine ruhige Glas-Zeile oben auf der Karte, die zugleich zwei Walzen sind: hoch- oder runterwischen
 * blättert durch die Themen, ein Tipp öffnet die ganze Liste (links Themen, rechts Unterthemen); rechts daneben steht von Anfang an „Alle Unterthemen“ (blass, solange kein Thema gewählt ist) und wird mit einem Thema zur
 * Walze seiner Unterthemen („Alle Unterthemen“ hebt die Eingrenzung auf).
 */
export function MapWheels({ label, items, value, onPick, subs, subValue = "", onSub, single = false, inline = false, subAll = "Alle Unterthemen", subLabel = "Unterthema" }: { label: string; items: RailItem[]; value: string; onPick: (id: string) => void; subs?: RailItem[]; subValue?: string; onSub?: (id: string) => void; /** nur eine Walze (Seiten ohne Unterauswahl) */ single?: boolean; /** im Fluss der Seite statt auf der Karte */ inline?: boolean; /** Text des ersten Eintrags der zweiten Walze und ihr Name */ subAll?: string; subLabel?: string }) {
  const hasSub = !!subs && subs.length > 0;
  /* Welche Liste gerade offen ist: die der Themen (links) oder die der Unterthemen (rechts) */
  const [list, setList] = useState<"theme" | "sub" | null>(null);
  const subItems: RailItem[] = [{ id: "", label: subAll }, ...(subs ?? [])];
  const shown = list === "sub" ? subItems : items;
  const cur = list === "sub" ? subValue : value;
  return (
    <div className={`pointer-events-none sm:hidden print:hidden ${inline ? "relative z-30 mb-3" : "absolute left-[calc(8px-max(1vw,16px))] right-[calc(8px-max(1vw,16px))] top-2 z-30"}`}>
      {list && <div aria-hidden="true" className="pointer-events-auto fixed inset-0 z-[-1]" onClick={() => setList(null)} />}
      <div className="rm-legend pointer-events-auto flex items-center overflow-hidden rounded-full">
        <RowWheel label={label} items={items} value={value} onPick={onPick} onOpen={() => setList(list === "theme" ? null : "theme")} />
        {!single && <span aria-hidden="true" className="flex-none text-slate-300">›</span>}
        {single ? null : hasSub
          ? <RowWheel label={subLabel} items={subItems} value={subValue} onPick={(id) => onSub?.(id)} onOpen={() => setList(list === "sub" ? null : "sub")} />
          /* Noch kein Thema: die zweite Walze steht schon da (blass), damit man sieht, dass es zwei Walzen sind */
          : <div aria-disabled="true" className="flex min-w-0 flex-1 items-center gap-2 pl-4 pr-7 text-[14px] text-slate-400" style={{ height: ROW }}><span className="min-w-0 truncate font-medium">{subAll}</span><ChevronsUpDown size={16} aria-hidden="true" className="ml-auto flex-none text-slate-300" /></div>}
      </div>
      {list && (
        <ul role="listbox" aria-label={list === "sub" ? subLabel : label} className={`rm-wheel-list pointer-events-auto absolute top-full mt-2 m-0 max-h-[46vh] list-none overflow-y-auto rounded-[22px] p-1 ${list === "sub" ? "right-0 w-[62%]" : "left-0 w-[62%]"}`}>
          {shown.map((it) => {
            const on = it.id === cur;
            return (
              <li key={it.id || "alle"} role="option" aria-selected={on}>
                <button type="button" onClick={() => { if (list === "sub") onSub?.(it.id); else onPick(it.id); setList(null); }}
                  className={`flex h-9 w-full items-center gap-2 rounded-2xl px-2.5 text-left text-[13.5px] ${on ? "bg-white/80 font-semibold text-slate-900 shadow-sm" : "text-slate-700"}`}>
                  <span className="flex-none text-slate-500">{it.icon}</span><span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {on && <Check size={15} strokeWidth={2} aria-hidden="true" className="flex-none text-teal-700" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Handy: eine einzelne Auswahl als kleine Glas-Pille oben rechts auf der Karte (z. B. der Schritt bei Projekten); ein Tipp öffnet die Liste
 * darunter, dieselbe wie bei den Walzen.
 */
export function MapPill({ label, items, value, onPick }: { label: string; items: { id: string; label: string; count?: string }[]; value: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = items.find((i) => i.id === value) ?? items[0];
  return (
    <div className="pointer-events-none absolute right-[calc(8px-max(1vw,16px))] top-[66px] z-30 sm:hidden print:hidden">
      {open && <div aria-hidden="true" className="pointer-events-auto fixed inset-0 z-[-1]" onClick={() => setOpen(false)} />}
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className="rm-legend pointer-events-auto ml-auto flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] text-slate-800">
        <span className="text-slate-500">{label}:</span><span className="max-w-[130px] truncate font-semibold">{cur.label}</span>
        <ChevronsUpDown size={14} aria-hidden="true" className="flex-none text-slate-400" />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="rm-wheel-list pointer-events-auto absolute right-0 top-full m-0 mt-2 max-h-[46vh] w-[250px] list-none overflow-y-auto rounded-[22px] p-1">
          {items.map((it) => {
            const on = it.id === value;
            return (
              <li key={it.id || "alle"} role="option" aria-selected={on}>
                <button type="button" onClick={() => { onPick(it.id); setOpen(false); }} className={`flex h-9 w-full items-center gap-2 rounded-2xl px-2.5 text-left text-[13.5px] ${on ? "bg-white/80 font-semibold text-slate-900 shadow-sm" : "text-slate-700"}`}>
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.count && <span className="flex-none tabular-nums text-slate-500">{it.count}</span>}
                  {on && <Check size={15} strokeWidth={2} aria-hidden="true" className="flex-none text-teal-700" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
