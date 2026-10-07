import { filterChips } from "../../lib/savedSearch";
import { setFiltersOpen, useFiltersOpen } from "../../lib/filtersOpen";
import { useEntitlements } from "../../lib/entitlements";
import { useData } from "../../state/data";
import { useSearch, useSearchResults } from "../../state/search";
import { IconFilter } from "../../components/icons";
import { SearchBox } from "../../components/SearchBox";
import { FilterPanel } from "../../components/FilterPanel";
import { ActiveFilters } from "../../components/ActiveFilters";

/** idle: Start; loading: Ladering; playing: Pause; paused: weiter */
export type PlayState = "idle" | "loading" | "playing" | "paused";

/** Suchleiste wie auf der Startseite (gleiche Suche, gleiche Filter), rechts der Start-Knopf der Analyse */
export function DiffusionSearch({ play, onPlay, onSubmit, startLabel = "Analyse starten" }: { play: PlayState; onPlay: () => void; startLabel?: string; /** Enter oder Vorschlag gewählt */ onSubmit: () => void }) {
  const { geo } = useData();
  const search = useSearch();
  const res = useSearchResults();
  const { allowFeature } = useEntitlements();
  const open = useFiltersOpen();
  const chips = filterChips(res.snapshot, geo);
  const filterCount = chips.filter((c) => !["q", "area", "more"].includes(c.key)).length + (search.state.future ? 1 : 0) + (search.state.noformal ? 1 : 0) + (search.state.allterms ? 1 : 0) + (search.state.exact ? 1 : 0);
  const round = "relative grid border border-slate-200 bg-white hover:bg-slate-50 h-11 w-11 flex-none place-items-center rounded-full max-sm:h-12 max-sm:w-12 transition-colors";
  const filterBtn = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="filter-body"
      title={open ? "Filter einklappen" : "Filter anzeigen"}
      aria-label={open ? "Filter einklappen" : "Filter anzeigen"}
      onClick={() => {
        if (!open && !allowFeature("filters")) return;
        setFiltersOpen(!open);
      }}
      className={`${open ? "relative grid h-11 w-11 flex-none place-items-center rounded-full max-sm:h-12 max-sm:w-12" : round} ${open || filterCount ? "text-teal-600" : "text-slate-700 hover:text-teal-600"}`}
    >
      <IconFilter size={20} />
      {filterCount > 0 && !open && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-teal-600 px-1 text-[12px] font-semibold leading-none text-white">{filterCount}</span>}
    </button>
  );
  const label = play === "loading" ? "Wird berechnet" : play === "playing" ? "Pause" : startLabel;
  return (
    <div className="relative z-20">
      <div role="search" className="flex w-full items-center gap-2">
        <div className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white [&_input]:rounded-full">
          <SearchBox stay onSubmit={onSubmit} />
        </div>
        <div className="relative z-10 h-11 w-11 flex-none max-sm:h-12 max-sm:w-12">{open ? <FilterPanel toggle={filterBtn} /> : filterBtn}</div>
        <button type="button" onClick={onPlay} disabled={play === "loading"} title={label} aria-label={label} className={`${round} text-teal-600 disabled:cursor-default`}>
          {play === "loading" ? (
            <span role="status" aria-label="Wird berechnet" className="rm-spinner" />
          ) : play === "playing" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.2" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" /></svg>
          )}
        </button>
      </div>
      {/* Chips flach statt Milchglas und ohne Scrollbalken: die Zeile bricht um */}
      <div className="mt-2 flex [&>div]:!my-0 [&>div]:!max-h-none [&>div]:!flex-wrap [&>div]:!overflow-visible [&>div]:!px-0 [&>div]:!py-0 [&_.rm-chip]:!border-slate-200 [&_.rm-chip]:!bg-white [&_.rm-chip]:!shadow-none [&_.rm-chip]:![backdrop-filter:none] [&_.rm-chip:hover]:!bg-slate-50">
        <ActiveFilters />
      </div>
    </div>
  );
}
