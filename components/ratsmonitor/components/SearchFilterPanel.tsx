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
import { IconHeart, IconFilter, IconViewCompact, IconViewFull, IconX } from "./icons";
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
  const [open, setOpen] = useState(false);
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
      <div role="search" className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1"><SearchBox /></div>
        <button type="button" aria-expanded={open} aria-controls="filter-body" title={open ? "Filter einklappen" : "Filter anzeigen"} onClick={() => {
            if (!open && !allowFeature("filters")) return;
            setOpen((o) => !o);
          }} className={`relative grid h-11 w-9 flex-none place-items-center rounded-xl transition-colors ${open || filterCount ? "text-teal-700 hover:bg-slate-100" : "text-slate-600 hover:bg-slate-100"}`}>
          <IconFilter size={20} />
          {filterCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-teal-600 px-1 text-[12px] font-semibold text-white">{filterCount}</span>}
        </button>
        <button type="button" disabled={!active && !savedHit} onClick={toggleSave} aria-pressed={!!savedHit} title={savedHit ? "Gespeicherte Suche entfernen" : active ? "Suche speichern" : "Erst suchen oder filtern, dann speichern"} aria-label={savedHit ? "Gespeicherte Suche entfernen" : "Suche speichern"} className={`grid h-11 w-9 flex-none place-items-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${savedHit ? "text-teal-600 hover:bg-slate-100" : "text-slate-600 hover:bg-slate-100 hover:text-teal-600"}`}>
          <IconHeart size={20} filled={!!savedHit} />
        </button>
      </div>
      {/* Alles zum Ort in einer Zeile: Umfang und Umkreis (nur um Kreis oder Gemeinde) */}
      {state.area.length >= 5 && geo && <AreaBar />}
      {open && (
        <div id="filter-body" className="flex flex-col gap-4 border-t border-slate-200 pt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Gebiet</span>
          <GeoFilter />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Zeitraum</span>
          <DateRangeFilter />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Thema</span>
          <FilterSelect id="f-thema" label="Thema" allLabel="Alle Themen" value={state.thema} options={THEMEN.map((t) => ({ value: t, label: t }))} counts={active ? res.themaCounts : undefined} onChange={search.setThema} className="[&_select]:!w-full [&_select]:!max-w-none" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Ebene</span>
          <div role="group" aria-label="Verwaltungsebene" className="flex h-11 items-center gap-4">
            {([
              ["city", "Städte & Gemeinden"],
              ["district", "Kreise"],
            ] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={state.level === v} onClick={() => search.setLevel(v)} className={`whitespace-nowrap py-1.5 text-[14px] ${state.level === v ? "border-b-2 border-teal-600 text-teal-600" : "border-b-2 border-transparent text-slate-500 hover:text-slate-900"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <FilterSelect id="f-status" label="Status" allLabel="Alle Stände" value={state.status} options={STATUS.map((s) => ({ value: s.id, label: s.label }))} counts={active ? res.statusCounts : undefined} onChange={(v) => search.setStatus(v as typeof state.status)} className="[&_select]:!w-full [&_select]:!max-w-none" />
        </div>
      </div>
        </div>
      )}

      {/* Trefferzahl, aktive Filter und Sortierung: immer sichtbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-3">
          <span aria-live="polite" className="mr-1.5 text-[14px] text-slate-600">
            {res.loading ? "…" : res.total.toLocaleString("de-DE")} Treffer
            {res.updatedAt && (
              <span className="text-slate-500">
                {" · Datenstand "}
                {new Date(res.updatedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} Uhr
              </span>
            )}
          </span>
          {chips.map((c) => (
            <button
              key={c.key + (c.term ?? "")}
              type="button"
              aria-label={`Filter ${c.label} entfernen`}
              onClick={() => clearChip(c.key, c.term)}
              className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 pl-2.5 pr-1.5 text-[12px] font-medium text-teal-700"
            >
              <span className="font-normal text-slate-500">{c.label}:</span>
              {c.value}
              <IconX size={14} className="opacity-70 group-hover:opacity-100" />
            </button>
          ))}
          {chips.length > 1 && (
            <button type="button" onClick={search.resetAll} className="px-1.5 py-1 text-[12px] text-slate-500 underline underline-offset-2 hover:text-slate-900">
              Alle zurücksetzen
            </button>
          )}
          <FilterSelect
            id="f-sort"
            label="Sortierung"
            allLabel=""
            value={state.sort}
            options={[
              { value: "desc", label: "Neueste zuerst" },
              { value: "asc", label: "Älteste zuerst" },
            ]}
            onChange={(v) => search.setSort(v as "asc" | "desc")}
            size="sm"
            highlight={false}
            className="ml-auto [&>svg]:!right-[9px] [&_select]:!border-transparent [&_select]:!bg-transparent [&_select]:!font-normal [&_select]:!text-slate-500 [&_select]:!shadow-none [&_select:hover]:!bg-slate-100 [&_select:hover]:!text-slate-900"
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
