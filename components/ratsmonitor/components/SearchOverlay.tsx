import { filterChips, suggestName } from "../lib/savedSearch";
import { setFiltersOpen, useFiltersOpen } from "../lib/filtersOpen";
import { useEntitlements } from "../lib/entitlements";
import { useAccount, useSavedStats } from "../state/account";
import { useData } from "../state/data";
import { useSearch, useSearchResults } from "../state/search";
import { useToast } from "../state/toast";
import { IconFilter, IconHeart } from "./icons";
import { SearchBox } from "./SearchBox";
import { FilterPanel } from "./FilterPanel";

/** Suchleiste auf der Karte: Herz (Suche speichern) links, Milchglas-Suchfeld, Filter rechts.
 *  listMax/listUp begrenzen die Vorschläge auf die Kartenfläche; onSubmit meldet Enter. */
export function SearchOverlay({ listMax, listUp, onSubmit }: { listMax?: number; listUp?: boolean; onSubmit?: () => void }) {
  const { geo } = useData();
  const search = useSearch();
  const res = useSearchResults();
  const { signatures } = useSavedStats();
  const { saved, addSaved, removeSaved } = useAccount();
  const toast = useToast();
  const { allow, allowFeature } = useEntitlements();
  const open = useFiltersOpen();
  const chips = filterChips(res.snapshot, geo);
  const active = chips.length > 0;
  const savedHit = signatures.get(res.signature);
  /* Zähler am Filter-Knopf: nur was im Filterfenster einstellbar ist (Orte stehen als Chips unter der Leiste) */
  const filterCount = chips.filter((c) => !["q", "area", "more"].includes(c.key)).length + (search.state.future ? 1 : 0) + (search.state.noformal ? 1 : 0) + (search.state.allterms ? 1 : 0);

  /* Ein Klick speichert die Suche unter einem automatisch erzeugten Namen; erneuter Klick entfernt sie */
  const toggleSave = () => {
    try {
      if (savedHit) {
        removeSaved(savedHit.id);
        return toast("Gespeicherte Suche entfernt.");
      }
      if (!allow("searches")) return;
      const base = suggestName(res.snapshot, geo);
      let name = base;
      for (let i = 2; saved.some((x) => x.name === name); i++) name = `${base} (${i})`;
      addSaved(res.snapshot, name);
      toast(`Gespeichert: ${name}`);
    } catch {
      toast("Der Browser erlaubt derzeit keine dauerhafte Speicherung.");
    }
  };

  const round = "rm-glass relative grid h-11 w-11 flex-none place-items-center rounded-full max-sm:h-12 max-sm:w-12 transition-colors disabled:cursor-default disabled:opacity-50";
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
  return (
    <div role="search" className="pointer-events-auto flex w-full max-w-[720px] items-center gap-2">
      <button
        type="button"
        disabled={!active && !savedHit}
        onClick={toggleSave}
        aria-pressed={!!savedHit}
        title={savedHit ? "Gespeicherte Suche entfernen" : active ? "Suche speichern" : "Erst suchen oder filtern, dann speichern"}
        aria-label={savedHit ? "Gespeicherte Suche entfernen" : "Suche speichern"}
        className={`${round} ${savedHit ? "text-teal-600" : "text-slate-700 hover:text-teal-600"}`}
      >
        <IconHeart size={20} filled={!!savedHit} />
      </button>
      <div className="min-w-0 flex-1">
        <SearchBox glass listMax={listMax} listUp={listUp} onSubmit={onSubmit} />
      </div>
      <div className="relative z-10 h-11 w-11 flex-none max-sm:h-12 max-sm:w-12">
        {open ? <FilterPanel toggle={filterBtn} up={listUp} maxH={listUp && listMax ? listMax + 44 : undefined} /> : filterBtn}
      </div>
    </div>
  );
}
