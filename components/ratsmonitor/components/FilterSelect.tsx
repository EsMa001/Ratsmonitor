import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconChevronDown } from "./icons";

interface Option {
  value: string;
  label: string;
  /** Kurzform für den schmalen Auswahlknopf auf dem Handy */
  short?: string;
}

interface Props {
  id: string;
  label: string;
  allLabel: string;
  value: string;
  options: Option[];
  counts?: Record<string, number>;
  onChange: (v: string) => void;
  size?: "md" | "sm";
  className?: string;
  /** aktive Auswahl farbig hervorheben (für Filter ja, für die Sortierung nein) */
  highlight?: boolean;
  /** "text": ohne Feldrahmen, grau wie Text (Sortierung über Listen); ohne select-base, damit Feld-, Glas- und Dunkelregeln nicht greifen */
  look?: "field" | "text";
}

/** Eigene Auswahlliste (kein Browser-Dropdown); aktive Auswahl in Teal, Zähler rechts */
export function FilterSelect({ id, label, allLabel, value, options, counts, onChange, size = "md", className = "", highlight = true, look = "field" }: Props) {
  const sm = size === "sm";
  const [open, setOpen] = useState(false);
  /* Im Filterfenster: die Liste zeigt möglichst alle Werte; sie öffnet nach unten, wenn sie dort ganz in den Bildschirm passt, sonst
     nach oben, wenn sie dort passt, sonst zur größeren Seite und scrollt */
  const [place, setPlace] = useState<{ side: "bottom" | "top"; maxH?: number }>({ side: "bottom" });
  const measure = () => {
    const t = document.getElementById(id);
    if (!t || !t.closest("#filter-body")) return setPlace({ side: "bottom" });
    const tr = t.getBoundingClientRect();
    const need = Math.min(320, (options.length + 1) * 36 + 12);
    const below = window.innerHeight - tr.bottom - 12;
    const above = tr.top - 12;
    const side = below >= need || below >= above ? "bottom" : "top";
    setPlace({ side, maxH: Math.max(96, Math.floor(side === "bottom" ? below : above)) });
  };
  const toggle = (o: boolean) => {
    if (o) measure();
    setOpen(o);
  };
  const all = allLabel ? [{ value: "", label: allLabel }, ...options] : options;
  const current = all.find((o) => o.value === value)?.label ?? allLabel;
  return (
    <div className={`relative ${className}`}>
      <Popover open={open} onOpenChange={toggle}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-label={`${label}: ${current}`}
            aria-haspopup="listbox"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                toggle(true);
              }
            }}
            className={`${look === "text" ? "cursor-pointer appearance-none border border-transparent bg-transparent font-normal text-slate-500 outline-none hover:text-slate-900 focus-visible:shadow-focus" : "select-base"} relative flex w-full items-center text-left ${sm ? "h-9 max-sm:h-11 rounded-lg pl-3 pr-8 text-[14px]" : "desk:w-auto desk:min-w-[150px] desk:max-w-[200px]"} ${value && highlight ? "select-active" : ""}`}
          >
            {(() => {
              const short = all.find((o) => o.value === value)?.short;
              return short ? <><span className="truncate sm:hidden">{short}</span><span className="truncate max-sm:hidden">{current}</span></> : <span className="truncate">{current}</span>;
            })()}
            <IconChevronDown size={14} className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side={place.side}
          style={place.maxH ? { maxHeight: place.maxH } : undefined}
          /* Tastatur: beim Öffnen steht der Fokus auf der aktuellen Auswahl */
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const el = e.currentTarget as HTMLElement;
            (el.querySelector<HTMLElement>('[aria-selected="true"]') ?? el.querySelector<HTMLElement>('[role="option"]'))?.focus();
          }}
          className="max-h-[320px] w-[--radix-popover-trigger-width] min-w-[200px] overflow-y-auto overscroll-contain rm-glass rm-glass-pop rounded-2xl p-1.5 text-slate-900">
          <ul
            role="listbox"
            aria-label={label}
            className="m-0 list-none p-0"
            onKeyDown={(e) => {
              /* Pfeiltasten, Pos1 und Ende bewegen den Fokus durch die Optionen */
              const opts = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')];
              const i = opts.indexOf(document.activeElement as HTMLElement);
              const go = (n: number) => (e.preventDefault(), opts[(n + opts.length) % opts.length]?.focus());
              if (e.key === "ArrowDown") go(i + 1);
              else if (e.key === "ArrowUp") go(i - 1);
              else if (e.key === "Home") go(0);
              else if (e.key === "End") go(opts.length - 1);
            }}
          >
            {all.map((o) => {
              const on = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => (onChange(o.value), setOpen(false))}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] ${on ? "bg-teal-50 text-teal-700" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {counts && o.value && <span className="flex-none text-[12px] tabular-nums text-slate-500">{counts[o.value] || 0}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
