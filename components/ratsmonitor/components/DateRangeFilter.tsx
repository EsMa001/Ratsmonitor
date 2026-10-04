import { de } from "date-fns/locale";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { rangeLabel } from "../lib/savedSearch";
import { useSearch } from "../state/search";
import { IconChevronDown } from "./icons";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 864e5));
const fromIso = (s: string) => (s ? new Date(s + "T00:00:00") : undefined);
const PRESETS = [
  { days: 7, label: "Letzte 7 Tage" },
  { days: 30, label: "Letzte 30 Tage" },
  { days: 91, label: "Letzte 3 Monate" },
  { days: 365, label: "Letzte 12 Monate" },
];

/** Zeitraum in einem Feld: Schnellauswahl oder Von–Bis direkt im Kalender */
export function DateRangeFilter() {
  const search = useSearch();
  const { von, bis } = search.state;
  const [open, setOpen] = useState(false);
  const preset = PRESETS.find((p) => von === daysAgo(p.days) && bis === daysAgo(0));
  const label = preset ? preset.label : von || bis ? rangeLabel(von, bis) : "Gesamter Zeitraum";
  const range: DateRange | undefined = von || bis ? { from: fromIso(von), to: fromIso(bis) } : undefined;
  const item = (on: boolean) =>
    `rounded-lg px-3 py-2 text-left text-[14px] font-medium ${on ? "bg-teal-50 text-teal-700" : "text-slate-700 hover:bg-slate-100"}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Zeitraum: ${label}`}
          className={`select-base relative flex w-full items-center text-left ${von || bis ? "!border-teal-200 !bg-teal-50 !text-teal-700" : ""}`}
        >
          <span className="truncate">{label}</span>
          <IconChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="rm-glass rm-glass-pop w-auto rounded-2xl p-2 text-slate-900 [--primary:#0d9488] [--primary-foreground:#fff] [--accent:#f0fdfa] [--accent-foreground:#0d9488]">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-row flex-wrap gap-1 sm:w-[150px] sm:flex-col">
            <button type="button" className={item(!von && !bis)} onClick={() => (search.setZeitraum("", ""), setOpen(false))}>
              Gesamter Zeitraum
            </button>
            {PRESETS.map((p) => (
              <button key={p.days} type="button" className={item(preset === p)} onClick={() => (search.setZeitraum(daysAgo(p.days), daysAgo(0)), setOpen(false))}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="border-slate-200 sm:border-l sm:pl-2">
            <Calendar
              mode="range"
              locale={de}
              selected={range}
              defaultMonth={range?.from}
              onSelect={(r) => search.setZeitraum(r?.from ? iso(r.from) : "", r?.to ? iso(r.to) : "")}
              className="[--cell-size:2.1rem]"
            />
            <p className="px-2 pb-1 text-[12px] text-slate-500">Ersten und letzten Tag anklicken.</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
