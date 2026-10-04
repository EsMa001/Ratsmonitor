import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { STATUS, THEMEN } from "../lib/constants";
import { filterChips } from "../lib/savedSearch";
import { useData } from "../state/data";
import { useSearch, useSearchResults } from "../state/search";
import { AreaBar } from "./AreaBar";
import { DateRangeFilter } from "./DateRangeFilter";
import { FilterSelect } from "./FilterSelect";
import { IconCalendar } from "./icons";
import { setFiltersOpen } from "../lib/filtersOpen";


/** Milchglas-Filterfenster, oben links mit dem Filter-Knopf (toggle) verankert:
 *  Umkreis um den gesuchten Ort (dezent), Zeitraum, Thema, Status */
export function FilterPanel({ toggle }: { toggle: ReactNode }) {
  const { geo } = useData();
  const search = useSearch();
  const { state } = search;
  const res = useSearchResults();
  const active = filterChips(res.snapshot, geo).length > 0;
  /* Reicht der Platz rechts nicht (schmale Karte), öffnet das Fenster nach links; der Knopf sitzt dann oben rechts */
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.closest("section")?.getBoundingClientRect();
    if (el && box) setFlip(el.getBoundingClientRect().right > box.right - 12);
  }, []);
  const full = "min-w-0 [&_button]:!w-full [&_button]:!min-w-0 [&_button]:!max-w-none";
  return (
    <div ref={ref} id="filter-body" className={`rm-glass absolute top-0 z-20 flex w-[300px] max-w-[calc(100vw-32px)] flex-col gap-2 rounded-[22px] pb-3.5 ${flip ? "right-0" : "left-0"}`}>
      <div className={`flex items-center gap-2 ${flip ? "flex-row-reverse" : ""}`}>
        {toggle}
        <span className="text-[16px] font-semibold text-slate-900">Filter</span>
        {active && (
          <button type="button" onClick={() => { search.resetAll(); setFiltersOpen(false); }} className={`text-[14px] text-teal-600 hover:underline ${flip ? "mr-auto ml-4" : "ml-auto mr-4"}`}>
            Zurücksetzen
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2.5 px-4">
        {state.area.length >= 5 && geo && <AreaBar compact />}
        <div className="flex items-center gap-2">
          <IconCalendar size={18} className="flex-none text-slate-500" />
          <div className="min-w-0 flex-1">
            <DateRangeFilter />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect id="f-thema" label="Thema" allLabel="Alle Themen" value={state.thema} options={THEMEN.map((t) => ({ value: t, label: t }))} counts={active ? res.themaCounts : undefined} onChange={search.setThema} className={full} />
          <FilterSelect id="f-status" label="Status" allLabel="Alle Stände" value={state.status} options={STATUS.map((s) => ({ value: s.id, label: s.label }))} counts={active ? res.statusCounts : undefined} onChange={(v) => search.setStatus(v as typeof state.status)} className={full} />
        </div>
      </div>
    </div>
  );
}
