import { setListView, useListView } from "../lib/listView";
import { EXPORT_MAX, exportResults, type ExportFormat } from "../lib/exportResults";
import { useSearch, useSearchResults } from "../state/search";
import { useToast } from "../state/toast";
import { ExportMenu } from "./ExportMenu";
import { FilterSelect } from "./FilterSelect";
import { IconViewCompact, IconViewFull } from "./icons";

/** Zeile über der Trefferliste: Trefferzahl und Stand, Sortierung, Export, Ansicht.
 *  Suche, Filter und aktive Filter liegen auf der Karte (SearchOverlay, FilterPanel, ActiveFilters). */
export function SearchFilterPanel() {
  const search = useSearch();
  const { state } = search;
  const res = useSearchResults();
  const listView = useListView();
  const toast = useToast();

  return (
    <section aria-label="Suche und Filter" className="card-shell relative z-[3] flex flex-col gap-3 p-[12px]">
      {/* Trefferzahl, Datenstand und Sortierung; aktive Filter und Filter selbst liegen auf der Karte */}
      <div className="flex flex-wrap items-center gap-1.5">
          <span aria-live="polite" className="mr-1.5 text-[14px] text-slate-600">
            {res.loading ? "…" : res.total.toLocaleString("de-DE")} Treffer
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
              { value: "desc", label: "Neueste zuerst" },
              { value: "relevance", label: "Nach Relevanz" },
              { value: "asc", label: "Älteste zuerst" },
            ]}
            onChange={(v) => search.setSort(v as "asc" | "desc" | "relevance")}
            size="sm"
            highlight={false}
            className="ml-auto [&_button]:!w-auto [&_button]:!min-w-0 [&_button]:!border-transparent [&_button]:!bg-transparent [&_button]:!font-normal [&_button]:!text-slate-500 [&_button]:!shadow-none [&_button:hover]:!text-slate-900"
          />
          {/* Export der Trefferliste: Format wählen, Hinweis auf die Höchstzahl */}
          <ExportMenu
            title="Exportieren"
            disabled={!res.total}
            options={[
              { id: "xlsx", label: "Excel (.xlsx)", desc: "Tabelle mit Spalten, direkt in Excel oder Numbers" },
              { id: "csv", label: "CSV (.csv)", desc: "Für andere Programme, z. B. CRM oder Datenbank" },
            ]}
            note={res.total > EXPORT_MAX ? `Exportiert werden die ersten ${EXPORT_MAX} von ${res.total.toLocaleString("de-DE")} Treffern. Grenzen Sie die Suche ein, um alle zu erhalten.` : `Exportiert werden alle ${res.total.toLocaleString("de-DE")} Treffer (höchstens ${EXPORT_MAX}).`}
            onExport={async (f) => {
              try {
                const within = res.around?.set ? [...res.around.set] : null;
                const n = await exportResults(res.key, within, res.total, f as ExportFormat);
                toast(`${n.toLocaleString("de-DE")} Treffer exportiert.`);
              } catch {
                toast("Der Export ist gerade nicht möglich.");
              }
            }}
          />
          {/* Ein Umschalter rechts neben der Sortierung: Icon und Bezeichnung der Ansicht, zu der gewechselt wird */}
          <button
            type="button"
            aria-pressed={listView === "compact"}
            title={listView === "compact" ? "Zur ausführlichen Ansicht wechseln" : "Zur kompakten Ansicht wechseln"}
            onClick={() => setListView(listView === "compact" ? "full" : "compact")}
            aria-label={listView === "compact" ? "Ausführliche Ansicht" : "Kompakte Ansicht"}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {listView === "compact" ? <IconViewCompact size={20} /> : <IconViewFull size={20} />}
          </button>
      </div>
    </section>
  );
}
