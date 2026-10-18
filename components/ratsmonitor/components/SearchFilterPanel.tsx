import { setListView, useListView } from "../lib/listView";
import { useSearch, useSearchResults } from "../state/search";
import { useToast } from "../state/toast";
import { useEntitlements } from "../lib/entitlements";
import { FilterSelect } from "./FilterSelect";
import { CountDots } from "./CountDots";
import { IconViewCompact, IconViewFull } from "./icons";
import { setSheetStage, toggleSheetStage, useSheetStage } from "../lib/sheetStage";
import { useVerticalSwipe } from "../lib/useSwipe";

/** Zeile über der Trefferliste: Trefferzahl und Stand, Sortierung, Export, Ansicht.
 *  Suche, Filter und aktive Filter liegen auf der Karte (SearchOverlay, FilterPanel, ActiveFilters). */
export function SearchFilterPanel() {
  const search = useSearch();
  const { state } = search;
  const res = useSearchResults();
  const listView = useListView();
  const toast = useToast();
  const { allowFeature } = useEntitlements();
  /* Handy: der Griff oben zieht das Ergebnisblatt hoch (Liste) oder runter (Karte); Tippen wechselt */
  const stage = useSheetStage();
  const drag = useVerticalSwipe((dir) => setSheetStage(dir < 0 ? "voll" : "klein"));

  return (
    <section aria-label="Suche und Filter" className="card-shell relative z-[3] flex flex-col gap-3 p-[12px] max-sm:px-4 max-sm:py-1">
      <button type="button" aria-label={stage === "klein" ? "Trefferliste öffnen" : "Karte zeigen"} aria-expanded={stage === "voll"} onClick={toggleSheetStage} {...drag}
        className="-mx-4 -mb-1 flex h-7 flex-none items-center justify-center border-0 bg-transparent p-0 sm:hidden">
        <span className="h-1 w-9 rounded-full bg-slate-300" />
      </button>
      {/* Trefferzahl, Datenstand und Sortierung; aktive Filter und Filter selbst liegen auf der Karte */}
      <div className="flex items-center gap-1 max-sm:flex-wrap sm:flex-wrap sm:gap-1.5">
          <span aria-live="polite" className="mr-1 whitespace-nowrap max-sm:whitespace-normal max-sm:min-w-0 max-sm:flex-[1_1_0%] text-[14px] text-slate-600 sm:mr-1.5">
            {res.loading ? "…" : res.totalPending ? (res.showDots ? <CountDots /> : "…") : res.total.toLocaleString("de-DE")} Treffer
            {res.updatedAt && (
              <span className="text-slate-500 max-sm:hidden">
                {" · Stand "}
                {new Date(res.updatedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })} Uhr
              </span>
            )}
          </span>
          <FilterSelect
            id="f-sort"
            label="Sortierung"
            allLabel=""
            value={state.sort}
            options={[
              { value: "desc", label: "Neueste zuerst", short: "Neueste" },
              { value: "relevance", label: "Nach Relevanz", short: "Relevanz" },
              { value: "asc", label: "Älteste zuerst", short: "Älteste" },
            ]}
            onChange={(v) => search.setSort(v as "asc" | "desc" | "relevance")}
            size="sm"
            highlight={false}
            className="ml-auto [&_button]:!w-auto [&_button]:!min-w-0 [&_button]:!border-transparent [&_button]:!bg-transparent [&_button]:!font-normal [&_button]:!text-slate-500 [&_button]:!shadow-none [&_button:hover]:!text-slate-900"
          />
          {/* Ein Umschalter rechts neben der Sortierung: Icon und Bezeichnung der Ansicht, zu der gewechselt wird */}
          <button
            type="button"
            aria-pressed={listView === "compact"}
            title={listView === "compact" ? "Zur ausführlichen Ansicht wechseln" : "Zur kompakten Ansicht wechseln"}
            onClick={() => setListView(listView === "compact" ? "full" : "compact")}
            aria-label={listView === "compact" ? "Ausführliche Ansicht" : "Kompakte Ansicht"}
            className="grid h-9 w-9 max-sm:h-11 max-sm:w-11 max-sm:shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {listView === "compact" ? <IconViewCompact size={20} /> : <IconViewFull size={20} />}
          </button>
      </div>
    </section>
  );
}
