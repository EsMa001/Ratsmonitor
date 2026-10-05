import type { ReactNode } from "react";
import { filterChips, splitTerms } from "../lib/savedSearch";
import { regionsIn, removePhrase } from "../lib/place";
import { useData } from "../state/data";
import { useSearch, useSearchResults } from "../state/search";
import { IconCalendar, IconPin, IconSearch, IconX } from "./icons";

/* Symbol statt Wort je Filterart */
const RADIUS = (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" strokeDasharray="3 2.6" />
    <path d="M12 12h9" />
  </svg>
);
const TAG = (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12V4h8l10 10-8 8z" />
    <circle cx="7.5" cy="8.5" r="1.2" />
  </svg>
);
const STATUS_ICON = (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

/** Aktive Suche und Filter unter der Suchleiste, als Milchglas-Chips mit Symbol; × entfernt den Filter */
export function ActiveFilters() {
  const { geo } = useData();
  const search = useSearch();
  const { state } = search;
  const res = useSearchResults();
  const all = filterChips(res.snapshot, geo);
  /* Regionen (z. B. Münsterland) als ein Chip statt je Kreis */
  const placeAgs = [state.area, ...(res.snapshot.more ?? []).map((m) => m.ags)].filter(Boolean);
  const regions = regionsIn(placeAgs);
  const inRegion = new Set(regions.flatMap((r) => r.ags));
  const chips = all.filter((c) => !((c.key === "area" && inRegion.has(state.area)) || (c.key === "more" && c.term && inRegion.has(c.term))));
  /* Eingeschaltete Schalter als Chips wie die übrigen Filter; × schaltet sie wieder aus */
  const toggles: { key: string; label: string; off: () => void }[] = [
    ...(state.future ? [{ key: "future", label: "inkl. Zukunft", off: () => search.setFuture(false) }] : []),
    ...(state.noformal ? [{ key: "noformal", label: "ohne Formalien", off: () => search.setNoformal(false) }] : []),
  ];
  if (!all.length && !toggles.length) return null;

  const clearChip = (key: (typeof chips)[number]["key"], term?: string) => {
    if (key === "q" && term && splitTerms(res.text).length > 1) return search.applySearch(removePhrase(state.q, term));
    if (key === "q") return search.applySearch(res.liveHits.map((h) => h.phraseRaw).join(", "));
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
  const icon = (key: string): ReactNode =>
    key === "area" || key === "more" ? <IconPin size={14} /> : key === "radius" ? RADIUS : key === "thema" ? TAG : key === "monat" || key === "zeitraum" ? <IconCalendar size={14} /> : key === "status" ? STATUS_ICON : <IconSearch size={14} />;

  return (
    <div className="pointer-events-auto flex w-full max-w-[720px] flex-wrap justify-start gap-1.5 pl-[52px] pr-[52px]">
      {regions.map((r) => (
        <button
          key={"region" + r.name}
          type="button"
          aria-label={`Region ${r.name} entfernen`}
          onClick={() => {
            /* Alle Orte der Region entfernen; übrige Orte und Filter bleiben */
            const rest = placeAgs.filter((a) => !r.ags.includes(a));
            for (const a of placeAgs.slice(1)) if (r.ags.includes(a)) search.removeMorePlace(a);
            if (r.ags.includes(state.area)) search.clearArea();
            if (!rest.length && res.placeActive) search.applySearch(removePhrase(state.q, res.pq.phraseRaw));
          }}
          className="group relative inline-flex h-7 items-center gap-1.5 rounded-full before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] border border-teal-100 bg-teal-50/85 pl-2.5 pr-1.5 text-[14px] text-teal-700 backdrop-blur-sm hover:bg-teal-100/90"
        >
          <span className="text-teal-600/80"><IconPin size={14} /></span>
          {r.name}
          <IconX size={14} className="text-teal-600/60 group-hover:text-teal-700" />
        </button>
      ))}
      {chips.map((c) => (
        <button
          key={c.key + (c.term ?? "")}
          type="button"
          aria-label={`Filter ${c.label} ${c.value} entfernen`}
          title={c.label}
          onClick={() => clearChip(c.key, c.term)}
          className="group relative inline-flex h-7 items-center gap-1.5 rounded-full before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] border border-teal-100 bg-teal-50/85 pl-2.5 pr-1.5 text-[14px] text-teal-700 backdrop-blur-sm hover:bg-teal-100/90"
        >
          <span className="text-teal-600/80">{icon(c.key)}</span>
          {c.value}
          <IconX size={14} className="text-teal-600/60 group-hover:text-teal-700" />
        </button>
      ))}
      {toggles.map((d) => (
        <button key={d.key} type="button" aria-label={`Filter ${d.label} entfernen`} onClick={d.off} className="group relative inline-flex h-7 items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50/85 pl-2.5 pr-1.5 text-[14px] text-teal-700 backdrop-blur-sm before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] hover:bg-teal-100/90">
          {d.label}
          <IconX size={14} className="text-teal-600/60 group-hover:text-teal-700" />
        </button>
      ))}
      {chips.length + regions.length + toggles.length > 1 && (
        <button type="button" title="Alle entfernen (Umschalt+Esc)" onClick={search.resetAll} className="inline-flex h-7 items-center px-1.5 text-[14px] text-teal-600 hover:underline">
          Alle entfernen
        </button>
      )}
    </div>
  );
}
