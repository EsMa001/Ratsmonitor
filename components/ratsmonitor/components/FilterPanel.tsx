import { ListChecks, Map as MapIcon } from "lucide-react";
import { usePathname } from "next/navigation";
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
      {/* Erklärung für Bildschirmleser (aria-description lesen die meisten nicht vor) */}
      {hint && <span id={`t-${label.replace(/\W+/g, "-")}-hint`} className="sr-only">{hint}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`t-${label.replace(/\W+/g, "-")}`}
        aria-describedby={hint ? `${`t-${label.replace(/\W+/g, "-")}`}-hint` : undefined}
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
export function FilterPanel({ toggle, up = false, maxH, extra, trail = 0, x: xProp = false }: { /** plenara.X: ohne Thema (die Seiten haben dafür die Themenkacheln), ohne Künftige und Formalien (plenara.X zählt nur Sachpunkte bis heute) */ x?: boolean; /** Handy: Breite der Knöpfe rechts vom Filter-Knopf (Herz): das Fenster reicht bis dorthin, der Filter-Knopf bleibt beim Aufklappen an seiner Stelle */ trail?: number; toggle: ReactNode; /** Handy: Zusatzfelder der Seite (z. B. Zeitraum, Folgen) oben im Blatt */ extra?: ReactNode; up?: boolean; /** höchstens so hoch (px), sonst scrollt das Fenster */ maxH?: number }) {
  const { geo } = useData();
  const search = useSearch();
  const { state } = search;
  const res = useSearchResults();
  /* Auf allen plenara.X-Seiten derselbe Filter, auch wo die Suchleiste der Karte ihn öffnet */
  const path = usePathname() ?? "";
  const x = xProp || path.startsWith("/analytics/");
  /* auch aus dem Live-Zustand: auf dem Handy bleibt res.snapshot bis zum Schließen auf dem Stand beim Öffnen */
  const liveActive = !!(state.status || state.von || state.bis || state.monat || state.allterms || state.exact || state.radius || (!x && (state.thema || !state.noformal || state.future)));
  const chipList = filterChips(res.snapshot, geo);
  const active = chipList.length > 0 || liveActive;
  /* Reicht der Platz rechts nicht (schmale Karte), öffnet das Fenster nach links; der Knopf sitzt dann oben rechts */
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  /* Mit Knöpfen rechts vom Filter-Knopf (trail): Fenster so breit wie die Suchleiste, rechts bündig mit ihr; gemessen, nicht geraten */
  const [fit, setFit] = useState<{ right: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    /* Grenze: der umgebende Abschnitt (Karte), höchstens der Bildschirm (Analyseseiten: Knopf rechts neben der Suche) */
    const box0 = el?.closest("section")?.getBoundingClientRect();
    const box = box0 && box0.width ? box0 : undefined; /* ohne eigenes Kästchen (display:contents) zählt nur der Bildschirm */
    const edge = Math.min(box?.right ?? Infinity, document.documentElement.clientWidth);
    const bar = trail > 0 ? el?.closest<HTMLElement>('[role="search"]') : null, wrap = el?.parentElement;
    if (bar && wrap) { const b = bar.getBoundingClientRect(), w = wrap.getBoundingClientRect(); setFit({ right: -(b.right - w.right), width: b.width }); }
    if (el) setFlip(trail > 0 || el.getBoundingClientRect().right > edge - 12);
    /* Fokus ins geöffnete Fenster (Tastatur, Bildschirmleser); Esc bringt ihn zurück auf den Filter-Knopf */
    el?.focus({ preventScroll: true });
  }, [trail]);
  const phone = usePhone();
  const full = "min-w-0 [&_button]:w-full [&_button]:min-w-0 [&_button]:max-w-none";
  return (
    <div
      ref={ref}
      id="filter-body"
      role="dialog"
      aria-label="Filter"
      tabIndex={-1}
      onKeyDown={(e) => {
        /* Esc schließt das Filterfenster; der Fokus geht zurück auf den Filter-Knopf */
        if (e.key !== "Escape" || e.defaultPrevented) return;
        e.preventDefault();
        setFiltersOpen(false);
        requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-controls="filter-body"]')?.focus());
      }}
      className={`rm-glass rm-fpop absolute z-20 flex ${x ? "w-[248px]" : "w-[300px]"} outline-none max-sm:w-[calc(100vw-88px)] max-w-[calc(100vw-32px)] gap-2 max-sm:gap-0.5 rounded-[22px] ${up ? "bottom-0 flex-col-reverse pt-3.5 max-sm:pt-2 sm:pt-2.5" : "top-0 flex-col pb-3.5 max-sm:pb-2 sm:pb-2.5"} ${flip ? "right-0" : "left-0"} overflow-y-auto overscroll-contain`} style={{ ...(maxH ? { maxHeight: maxH } : null), ...(fit ? { right: fit.right, width: fit.width } : null) }}>
      <div className={`flex items-center gap-2 max-sm:pl-4 ${flip ? "flex-row-reverse" : ""}`} style={fit ? { paddingRight: -fit.right } : undefined}>
        {toggle}
        {phone && (
          <div className="min-w-0 flex-1">
            <DateRangeSelect withIcon={false} />
          </div>
        )}
        <span className="text-[16px] font-semibold text-slate-900 max-sm:hidden">Filter</span>
        {active && !phone && (
          <button type="button" onClick={() => { search.resetAll(); setFiltersOpen(false); }} className={`text-[14px] text-teal-700 hover:underline ${flip ? "mr-auto ml-4" : "ml-auto mr-4"}`}>
            Zurücksetzen
          </button>
        )}
      </div>
      {/* Ein Satz: was gerade gefiltert ist */}
      {chipList.length > 0 && <p className="m-0 px-4 text-[12px] leading-snug text-slate-600 max-sm:hidden">{chipList.map((c) => c.value).join(" · ")}</p>}
      <div className="flex flex-col gap-2.5 px-4 max-sm:gap-[3px] sm:gap-1.5">
        {phone && extra}
        {state.area.length >= 5 && geo && <AreaBar compact />}
        {!x && (phone ? <DateRangeFields /> : <DateRangeFilter />)}
        {/* Schalter wie am iPhone */}
        {!x && <Toggle label="Künftige Sitzungen zeigen" hint="Auch Termine, die noch anstehen" on={!!state.future} set={search.setFuture} />}
        {!x && <Toggle label="Formalien ausblenden" hint="Ohne Niederschriften, Mitteilungen und Anfragen" on={!!state.noformal} set={search.setNoformal} />}
        <Toggle label="Exakter Begriff" hint="Nur ganze Wörter, keine Wortteile (Groß-/Kleinschreibung egal)" on={!!state.exact} set={search.setExact} />
        <Toggle label="Begriffe kombinieren" hint="Alle Suchbegriffe müssen vorkommen; sonst genügt einer" on={!!state.allterms} set={search.setAllterms} />
        {/* plenara.X: Zeitraum unter den Schaltern */}
        {x && (phone ? <DateRangeFields /> : <DateRangeFilter />)}
        {/* Bundesland: setzt das Gebiet (2-stelliger Schlüssel), wie die Eingabe des Namens in der Suche; bei gewähltem Ort entfällt es */}
        {geo && state.area.length < 5 && geo.lands.length > 0 && (
          <div className="flex items-center gap-2">{x && <MapIcon size={18} strokeWidth={1.5} aria-hidden="true" className="flex-none text-slate-500" />}
          <FilterSelect id="f-land" label="Bundesland" allLabel="Alle Bundesländer" value={state.area.length === 2 ? state.area : ""} options={geo.lands.map((l) => ({ value: l.ags, label: l.name }))}
            onChange={(v) => { if (v) search.setArea(v, "ui", { zoom: true }); else search.clearArea(); }} className={`${full} flex-1`} />
          </div>
        )}
        <div className={x ? "" : "grid grid-cols-2 gap-2"}>
          {!x && <FilterSelect id="f-thema" label="Thema" allLabel="Alle Themen" value={state.thema} options={THEMEN.map((t) => ({ value: t, label: t }))} counts={active ? res.themaCounts : undefined} onChange={search.setThema} className={full} />}
          <div className="flex items-center gap-2">{x && <ListChecks size={18} strokeWidth={1.5} aria-hidden="true" className="flex-none text-slate-500" />}
          <FilterSelect id="f-status" label="Status" allLabel="Alle Stände" value={state.status} options={STATUS.map((s) => ({ value: s.id, label: s.label }))} counts={active ? res.statusCounts : undefined} onChange={(v) => search.setStatus(v as typeof state.status)} className={`${full} flex-1`} />
          </div>
        </div>
        {/* Handy: „Zurücksetzen“ nicht in der Kopfzeile (dort sitzt die Zeitraum-Auswahl), sondern unten */}
        {phone && active && (
          <button type="button" onClick={() => { search.resetAll(); setFiltersOpen(false); }} className="self-end text-[14px] text-teal-700 hover:underline">
            Zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}
