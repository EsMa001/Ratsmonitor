"use client";
import { tick } from "../lib/haptic";
import { useEffect, useRef } from "react";
import { ChevronsUpDown } from "lucide-react";
import type { RailItem } from "./ChipRail";

const ROW = 32;
/* oben ein Stück der leeren Vorzeile abschneiden: weniger Abstand zur Kopfzeile, wenn der erste Eintrag gewählt ist */
const TRIM = 18;

/** Handy: Walze wie ein Drehrad. Die mittlere Zeile ist gewählt; geladen wird erst, wenn die Walze eingerastet ist (kurze Ruhe nach dem letzten Scrollen). Ein Tipp auf eine Zeile dreht sie in die Mitte. Nur unter 640 px sichtbar. */
export function WheelPicker({ label, items, value, onPick, className = "" }: { label: string; items: RailItem[]; value: string; onPick: (id: string) => void; className?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idx = Math.max(0, items.findIndex((i) => i.id === value));
  /* Von außen geänderte Auswahl (Zurück, Link) dreht die Walze mit */
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
    <div role="group" aria-label={label} className={`relative rounded-xl bg-white sm:hidden print:hidden ${className}`} style={{ height: ROW * 3, marginTop: -TRIM, clipPath: `inset(${TRIM}px -4px 0 -4px)` }}>
      {/* Markierung der gewählten Zeile */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 rounded-xl bg-teal-50 ring-1 ring-teal-600/30" style={{ top: ROW, height: ROW }}>
        {/* Hinweis „drehbar“: Pfeile oben und unten, hüpfen beim Erscheinen dreimal */}
        <ChevronsUpDown size={20} strokeWidth={1.6} className="absolute right-3 top-1/2 -mt-2.5 animate-[bounce_.7s_ease-in-out_3] text-teal-700 motion-reduce:animate-none" />
      </div>
      <ul ref={ref} onScroll={onScroll} className="relative m-0 h-full list-none snap-y snap-mandatory overflow-y-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ overscrollBehavior: "contain" }}>
        <li aria-hidden="true" style={{ height: ROW }} />
        {items.map((it, i) => {
          const on = i === idx;
          return (
            <li key={it.id || "alle"} className="snap-center" style={{ height: ROW, scrollSnapStop: "always" }}>
              <button type="button" aria-pressed={on} onClick={() => ref.current?.scrollTo({ top: i * ROW, behavior: "smooth" })}
                className={`flex w-full items-center justify-center gap-2 text-[14px] ${on ? "font-semibold text-teal-800" : "text-slate-500"}`} style={{ height: ROW }}>
                <span className={on ? "[&_svg]:!text-teal-700" : ""}>{it.icon}</span><span>{it.label}</span>
              </button>
            </li>
          );
        })}
        <li aria-hidden="true" style={{ height: ROW }} />
      </ul>
    </div>
  );
}
