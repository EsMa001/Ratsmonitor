"use client";
import { useEffect, useRef, type ReactNode } from "react";

export interface RailItem { id: string; label: string; icon?: ReactNode; iconOn?: ReactNode }

/** Handy: eine Reihe Icon-Chips zum seitlichen Wischen (ein Tipp wählt). Das gewählte Chip rückt in die Mitte, der Rand läuft weich aus. Nur unter 640 px sichtbar. */
export function ChipRail({ label, items, value, onPick, className = "" }: { label: string; items: RailItem[]; value: string; onPick: (id: string) => void; className?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const on = ref.current?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (on) on.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [value]);
  return (
    <nav aria-label={label} className={`-mx-[max(1vw,16px)] sm:hidden print:hidden ${className}`}>
      <ul ref={ref} className="m-0 flex list-none gap-2 overflow-x-auto px-[max(1vw,16px)] py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ WebkitMaskImage: "linear-gradient(to right,#000 calc(100% - 28px),transparent)", maskImage: "linear-gradient(to right,#000 calc(100% - 28px),transparent)" }}>
        {items.map((it) => {
          const on = it.id === value;
          return (
            <li key={it.id || "alle"} className="shrink-0">
              <button type="button" aria-pressed={on} onClick={() => onPick(it.id)}
                className={`flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[14px] ${on ? "bg-teal-700 font-semibold text-white" : "bg-slate-100 text-slate-700"}`}>
                {on ? (it.iconOn ?? it.icon) : it.icon}
                <span>{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Handy: lange Namen mit „und“ auf den ersten Teil kürzen („Sport und Bäder“ → „Sport“), damit sie in die kleinen Kacheln passen */
export const kurz = (s: string) => (s.length > 12 && s.includes(" und ") ? s.split(" und ")[0] : s);
