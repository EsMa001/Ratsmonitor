import { STATUS, THEMEN } from "../lib/constants";
import { filterChips, splitTerms, suggestName } from "../lib/savedSearch";
import { useAccount, useSavedStats } from "../state/account";
import { useToast } from "../state/toast";
import { useData } from "../state/data";
import { useAppNav } from "../state/nav";
import { useSearch, useSearchResults } from "../state/search";
import { useUi } from "../state/ui";
import { FilterSelect } from "./FilterSelect";
import { GeoFilter } from "./GeoFilter";
import { AreaBar } from "./AreaBar";
import { DateRangeFilter } from "./DateRangeFilter";
import { setListView, useListView } from "../lib/listView";
import { setFiltersOpen, useFiltersOpen } from "../lib/filtersOpen";
import { IconHeart, IconFilter, IconViewCompact, IconViewFull, IconX } from "./icons";
import { EXPORT_MAX, exportResults, type ExportFormat } from "../lib/exportResults";
import { ExportMenu } from "./ExportMenu";
import { useEffect, useState } from "react";
import { useEntitlements } from "../lib/entitlements";
import { SearchBox } from "./SearchBox";
import { removePhrase } from "../lib/place";

/** Suche und alle Filter als eigene Kachel zwischen Karte und Ergebnisliste */
export function SearchFilterPanel() {
  const { geo } = useData();
  const search = useSearch();
  const { state } = search;
  const res = useSearchResults();
  const listView = useListView();
  const { signatures } = useSavedStats();
  const { openKonto } = useAppNav();
  const { openSaveDialog, setFlashSaved } = useUi();
  const chips = filterChips(res.snapshot, geo);
  const active = chips.length > 0;
  const savedHit = signatures.get(res.signature);
  /* Aufgeklappt über den runden Filter-Knopf auf der Karte */
  const open = useFiltersOpen();
  const setOpen = setFiltersOpen;
  const { saved, addSaved, removeSaved } = useAccount();
  const toast = useToast();
  const { allow, allowFeature, limits } = useEntitlements();
  /* Gäste haben keine Filter: Panel schließen und gesetzte Filter zurücknehmen */
  useEffect(() => {
    if (limits.filters) return;
    setOpen(false);
    if (state.thema) search.setThema("");
    if (state.status) search.setStatus("");
    if (state.monat) search.setMonat("");
    if (state.von || state.bis) search.setZeitraum("", "");
  }, [limits.filters, state.thema, state.status, state.monat, state.von, state.bis, search]);
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
  const filterCount = chips.filter((c) => c.key !== "q").length;

  const clearChip = (key: (typeof chips)[number]["key"], term?: string) => {
    /* Einzelnen Suchbegriff entfernen; Orte und andere Begriffe bleiben stehen */
    if (key === "q" && term && splitTerms(res.text).length > 1) return search.applySearch(removePhrase(state.q, term));
    if (key === "q") {
      /* Nur den Text entfernen, noch nicht übernommene Orte bleiben in der Eingabe */
      return search.applySearch(res.liveHits.map((h) => h.phraseRaw).join(", "));
    }
    /* Ort aus dem Suchtext: dort entfernen; fester Ortsfilter: direkt entfernen, ein weiterer Ort rückt nach */
    if (key === "area") return res.placeActive ? search.applySearch(removePhrase(state.q, res.pq.phraseRaw)) : search.clearArea();
    if (key === "more" && term) {
      const hit = res.liveHits.find((h) => h.place.ags === term);
      if (state.morePlaces?.some((m) => m.ags === term)) search.removeMorePlace(term);
      if (hit) search.applySearch(removePhrase(state.q, hit.phraseRaw));
      return;
    }
    if (key === "radius") return search.clearRadius();
    if (key === "thema") return search.setThema("");
    if (key === "monat") return search.setMonat("");
    if (key === "zeitraum") return search.setZeitraum("", "");
    if (key === "status") return search.setStatus("");
  };

  return (
    <section aria-label="Suche und Filter" className="card-shell relative z-[3] flex flex-col gap-3 p-[12px]">
      {/* Trefferzahl, Datenstand und Sortierung; aktive Filter und Filter selbst liegen auf der Karte */}
      <div className="flex flex-wrap items-center gap-1.5">
          <span aria-live="polite" className="mr-1.5 text-[14px] text-slate-600">
            {res.loading ? "…" : res.total.toLocaleString("de-DE")} Treffer
            {res.updatedAt && (
              <span className="text-slate-500">
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
