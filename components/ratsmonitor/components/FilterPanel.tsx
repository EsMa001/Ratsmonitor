import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { STATUS, THEMEN } from "../lib/constants";
import { filterChips } from "../lib/savedSearch";
import { useData } from "../state/data";
import { useSearch, useSearchResults } from "../state/search";
import { AreaBar } from "./AreaBar";
import { DateRangeFields, DateRangeFilter, DateRangeSelect } from "./DateRangeFilter";
import { usePhone } from "../lib/usePhone";
import { FilterSelect } from "./FilterSelect";
import { setFiltersOpen } from "../lib/filtersOpen";


function Toggle({ label, hint, on, set }: { label: string; hint: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5 text-[14px] text-slate-900 max-sm:min-h-8 max-sm:py-0 sm:py-0" title={hint}>
      <span id={`t-${label.replace(/\W+/g, "-")}`}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`t-${label.replace(/\W+/g, "-")}`}
        aria-description={hint}
        onClick={() => set(!on)}
        className={`relative h-6 w-10 flex-none rounded-full transition-colors max-sm:after:absolute max-sm:after:-inset-x-2.5 max-sm:after:-inset-y-2.5 max-sm:after:content-[''] ${on ? "bg-teal-600" : "bg-slate-300/80"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

/** Milchglas-Filterfenster, oben links mit dem Filter-Knopf (toggle) verankert:
 *  Umkreis um den gesuchten Ort (dezent), Zeitraum, Thema, Status */
/** up: Suchleiste steht unten (Kartenmodus) – das Fenster klappt nach oben auf, der Filter-Knopf bleibt an seiner Stelle */
export function FilterPanel({ toggle, up = false, maxH }: { toggle: ReactNode; up?: boolean; /** höchstens so hoch (px), sonst scrollt das Fenster */ maxH?: number }) {
  const { geo } = useData();
  const search = useSearch();
  const { state } = search;
  const res = useSearchResults();
  /* auch aus dem Live-Zustand: auf dem Handy bleibt res.snapshot bis zum Schließen auf dem Stand beim Öffnen */
  const liveActive = !!(state.thema || state.status || state.von || state.bis || state.monat || state.noformal || state.allterms || state.future || state.radius);
  const active = filterChips(res.snapshot, geo).length > 0 || liveActive;
  /* Reicht der Platz rechts nicht (schmale Karte), öffnet das Fenster nach links; der Knopf sitzt dann oben rechts */
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.closest("section")?.getBoundingClientRect();
    if (el && box) setFlip(el.getBoundingClientRect().right > box.right - 12);
  }, []);
  const phone = usePhone();
  const full = "min-w-0 [&_button]:!w-full [&_button]:!min-w-0 [&_button]:!max-w-none";
  return (
    <div
      ref={ref}
      id="filter-body"
      role="dialog"
      aria-label="Filter"
      onKeyDown={(e) => {
        /* Esc schließt das Filterfenster; der Fokus geht zurück auf den Filter-Knopf */
        if (e.key !== "Escape" || e.defaultPrevented) return;
        e.preventDefault();
        setFiltersOpen(false);
        requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-controls="filter-body"]')?.focus());
      }}
      className={`rm-glass absolute z-20 flex w-[300px] max-sm:w-[calc(100vw-88px)] max-w-[calc(100vw-32px)] gap-2 max-sm:gap-0.5 rounded-[22px] ${up ? "bottom-0 flex-col-reverse pt-3.5 max-sm:pt-2 sm:pt-2.5" : "top-0 flex-col pb-3.5 max-sm:pb-2 sm:pb-2.5"} ${flip ? "right-0" : "left-0"} overflow-y-auto overscroll-contain`} style={maxH ? { maxHeight: maxH } : undefined}>
      <div className={`flex items-center gap-2 max-sm:pl-4 ${flip ? "flex-row-reverse" : ""}`}>
        {toggle}
        {phone && (
          <div className="min-w-0 flex-1">
            <DateRangeSelect withIcon={false} />
          </div>
        )}
        <span className="text-[16px] font-semibold text-slate-900 max-sm:hidden">Filter</span>
        {active && !phone && (
          <button type="button" onClick={() => { search.resetAll(); setFiltersOpen(false); }} className={`text-[14px] text-teal-600 hover:underline ${flip ? "mr-auto ml-4" : "ml-auto mr-4"}`}>
            Zurücksetzen
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2.5 px-4 max-sm:gap-[3px] sm:gap-1.5">
        {state.area.length >= 5 && geo && <AreaBar compact />}
        {phone ? <DateRangeFields /> : <DateRangeFilter />}
        {/* Schalter wie am iPhone */}
        <Toggle label="Künftige Sitzungen zeigen" hint="Auch Termine, die noch anstehen" on={!!state.future} set={search.setFuture} />
        <Toggle label="Formalien ausblenden" hint="Ohne Niederschriften, Mitteilungen und Anfragen" on={!!state.noformal} set={search.setNoformal} />
        <Toggle label="Begriffe kombinieren" hint="Alle Suchbegriffe müssen vorkommen; sonst genügt einer" on={!!state.allterms} set={search.setAllterms} />
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect id="f-thema" label="Thema" allLabel="Alle Themen" value={state.thema} options={THEMEN.map((t) => ({ value: t, label: t }))} counts={active ? res.themaCounts : undefined} onChange={search.setThema} className={full} />
          <FilterSelect id="f-status" label="Status" allLabel="Alle Stände" value={state.status} options={STATUS.map((s) => ({ value: s.id, label: s.label }))} counts={active ? res.statusCounts : undefined} onChange={(v) => search.setStatus(v as typeof state.status)} className={full} />
        </div>
        {/* Handy: „Zurücksetzen“ nicht in der Kopfzeile (dort sitzt die Zeitraum-Auswahl), sondern unten */}
        {phone && active && (
          <button type="button" onClick={() => { search.resetAll(); setFiltersOpen(false); }} className="self-end text-[14px] text-teal-600 hover:underline">
            Zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}
