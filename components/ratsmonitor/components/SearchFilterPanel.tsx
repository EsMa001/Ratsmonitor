import { STATUS, THEMEN } from "../lib/constants";
import { filterChips, hasScope, splitTerms, suggestName } from "../lib/savedSearch";
import { useAccount, useSavedStats } from "../state/account";
import { useToast } from "../state/toast";
import { useData } from "../state/data";
import { useAppNav } from "../state/nav";
import { useSearch, useSearchResults } from "../state/search";
import { useUi } from "../state/ui";
import { FilterSelect } from "./FilterSelect";
import { GeoFilter } from "./GeoFilter";
import { IconHeart, IconFilter, IconX } from "./icons";
import { useEffect, useState } from "react";
import { useEntitlements } from "../lib/entitlements";
import { SearchBox } from "./SearchBox";
import { removePhrase } from "../lib/place";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 864e5));
const PRESETS = [
  { value: "7", label: "Letzte 7 Tage" },
  { value: "30", label: "Letzte 30 Tage" },
  { value: "91", label: "Letzte 3 Monate" },
  { value: "365", label: "Letzte 12 Monate" },
];

/** Suche und alle Filter als eigene Kachel zwischen Karte und Ergebnisliste */
export function SearchFilterPanel() {
  const { geo } = useData();
  const search = useSearch();
  const { state } = search;
  const res = useSearchResults();
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
  const preset = PRESETS.find((p) => state.von === daysAgo(Number(p.value)) && state.bis === daysAgo(0))?.value ?? (state.von || state.bis ? "custom" : "");

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

  const dateInput = "h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none hover:border-slate-300 focus:border-teal-600 focus:shadow-focus";

  return (
    <section aria-label="Suche und Filter" className="card-shell relative z-[3] flex flex-col gap-3 p-[0.3vw]">
      <div role="search" className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1"><SearchBox /></div>
        <button type="button" aria-expanded={open} aria-controls="filter-body" title={open ? "Filter einklappen" : "Filter anzeigen"} onClick={() => {
            if (!open && !allowFeature("filters")) return;
            setOpen((o) => !o);
          }} className={`relative grid h-11 w-11 flex-none place-items-center rounded-[10px] border transition-colors ${open || filterCount ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
          <IconFilter size={20} />
          {filterCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-teal-600 px-1 text-[11px] font-semibold text-white">{filterCount}</span>}
        </button>
        <button type="button" disabled={!active && !savedHit} onClick={toggleSave} aria-pressed={!!savedHit} title={savedHit ? "Gespeicherte Suche entfernen" : active ? "Suche speichern" : "Erst suchen oder filtern, dann speichern"} aria-label={savedHit ? "Gespeicherte Suche entfernen" : "Suche speichern"} className={`grid h-11 w-11 flex-none place-items-center rounded-[10px] border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${savedHit ? "border-rose-200 bg-rose-50 text-rose-500" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-rose-500"}`}>
          <IconHeart size={20} filled={!!savedHit} />
        </button>
      </div>
      {state.area && hasScope(state.area, geo) && geo && (
        <div role="group" aria-label="Gebietsumfang" className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-slate-500">Suchen in</span>
          <div className="flex gap-0.5 rounded-[10px] bg-slate-100 p-[3px]">
            {([
              ["only", geo.info(state.area).name],
              ["with", state.area.length === 5 ? `${geo.info(state.area).name} & Gemeinden` : `${geo.info(state.area).name} & ${geo.info(state.area.slice(0, 5)).name}`],
            ] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={state.scope === v} onClick={() => search.setScope(v)} className={`h-[30px] whitespace-nowrap rounded-[7px] px-[11px] font-medium ${state.scope === v ? "bg-white text-slate-900 shadow-seg" : "text-slate-600 hover:text-slate-900"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {open && (
        <div id="filter-body" className="flex flex-col gap-4 border-t border-slate-200 pt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Gebiet</span>
          <GeoFilter />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Ebene</span>
          <select aria-label="Verwaltungsebene" className="select-base w-full" value={state.level} onChange={(e) => search.setLevel(e.target.value as "city" | "district")}>
            <option value="city">Städte & Gemeinden</option>
            <option value="district">Kreise</option>
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Thema</span>
          <FilterSelect id="f-thema" label="Thema" allLabel="Alle Themen" value={state.thema} options={THEMEN.map((t) => ({ value: t, label: t }))} counts={active ? res.themaCounts : undefined} onChange={search.setThema} className="[&_select]:!w-full [&_select]:!max-w-none" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Zeitraum</span>
          <FilterSelect id="f-zeitraum" label="Zeitraum" allLabel={preset === "custom" ? "Eigener Zeitraum" : "Gesamter Zeitraum"} value={preset === "custom" ? "" : preset} options={PRESETS} onChange={(v) => search.setZeitraum(v ? daysAgo(Number(v)) : "", v ? daysAgo(0) : "")} className="[&_select]:!w-full [&_select]:!max-w-none" />
        </div>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Von</span>
          <input type="date" className={dateInput + " w-full"} value={state.von} max={state.bis || undefined} onChange={(e) => search.setZeitraum(e.target.value, state.bis)} />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Bis</span>
          <input type="date" className={dateInput + " w-full"} value={state.bis} min={state.von || undefined} onChange={(e) => search.setZeitraum(state.von, e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1 sm:max-w-[calc((100%-24px)/3)]">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <FilterSelect id="f-status" label="Status" allLabel="Alle Stände" value={state.status} options={STATUS.map((s) => ({ value: s.id, label: s.label }))} counts={active ? res.statusCounts : undefined} onChange={(v) => search.setStatus(v as typeof state.status)} className="[&_select]:!w-full [&_select]:!max-w-none" />
        </div>
        <div className="ml-auto flex items-center gap-2">
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
          />
        </div>
      </div>
        </div>
      )}

      {active && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-3">
          <span aria-live="polite" className="mr-1.5 text-[14px] text-slate-600">
            <strong className="font-semibold text-slate-900">{res.loading ? "…" : res.total.toLocaleString("de-DE")}</strong> Treffer
          </span>
          {chips.map((c) => (
            <button
              key={c.key + (c.term ?? "")}
              type="button"
              aria-label={`Filter ${c.label} entfernen`}
              onClick={() => clearChip(c.key, c.term)}
              className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 pl-2.5 pr-1.5 text-[12.5px] font-medium text-teal-700"
            >
              <span className="font-normal text-slate-500">{c.label}:</span>
              {c.value}
              <IconX size={14} className="opacity-70 group-hover:opacity-100" />
            </button>
          ))}
          {chips.length > 1 && (
            <button type="button" onClick={search.resetAll} className="px-1.5 py-1 text-[12.5px] text-slate-500 underline underline-offset-2 hover:text-slate-900">
              Alle zurücksetzen
            </button>
          )}
        </div>
      )}
    </section>
  );
}
