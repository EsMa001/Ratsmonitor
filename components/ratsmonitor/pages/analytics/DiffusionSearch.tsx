import { cloneElement, isValidElement, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useMapSlot } from "../../lib/mapSlot";
import { usePhone } from "../../lib/usePhone";
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
export function DiffusionSearch({ play, onPlay, onSubmit, startLabel = "Analyse starten", keepFocus = false, noPlay = false, extra, follow, filterUp = false }: { /** Handy: das Filterfenster klappt nach oben auf (Suchleiste unten auf der Karte) */ filterUp?: boolean; /** Handy: Reihe Suchfeld, Filter, Herz (Suche speichern) */ follow?: ReactNode; /** Handy: Zusatzfelder im Filterblatt (Zeitraum, Folgen …) */ extra?: ReactNode; /** ohne Start-Knopf: der Filter steht links an seiner Stelle (plenara.X Signale rechnen von selbst) */ noPlay?: boolean; play: PlayState; onPlay: () => void; startLabel?: string; /** Enter oder Vorschlag gewählt */ onSubmit: () => void; /** Cursor bleibt nach Enter im Feld */ keepFocus?: boolean }) {
  const { geo } = useData();
  const search = useSearch();
  const res = useSearchResults();
  const { allowFeature } = useEntitlements();
  const open = useFiltersOpen();
  const slot = useMapSlot();
  const phone = usePhone();
  /* Handy: beim Tippen verschwindet der Filterknopf und „Abbrechen“ erscheint rechts (wie bei Apple) */
  const [typing, setTyping] = useState(false);
  const chips = filterChips(res.snapshot, geo);
  const filterCount = chips.filter((c) => !["q", "area", "more", "thema"].includes(c.key)).length + (search.state.future ? 1 : 0) + (search.state.noformal ? 1 : 0) + (search.state.allterms ? 1 : 0) + (search.state.exact ? 1 : 0);
  /* Form und Fläche der Knöpfe und des Felds: Klassen rm-xbtn und rm-xfield in app/styles/analytics.css (dort auch die Glas-Pille von plenara.X) */
  const round = "rm-xbtn relative grid h-11 w-11 flex-none place-items-center max-sm:h-12 max-sm:w-12 transition-colors";
  const filterBtn = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="filter-body"
      title={open ? "Filter einklappen" : "Filter anzeigen"}
      aria-label={open ? "Filter einklappen" : filterCount > 0 ? `Filter anzeigen, ${filterCount} aktiv` : "Filter anzeigen"}
      onClick={() => {
        if (!open && !allowFeature("filters")) return;
        setFiltersOpen(!open);
      }}
      className={`${open ? "relative grid h-11 w-11 flex-none place-items-center rounded-xl max-sm:h-12 max-sm:w-12" : round} ${open || filterCount ? "text-teal-700" : "text-slate-700 hover:text-teal-700"}`}
    >
      <IconFilter size={20} />
      {filterCount > 0 && !open && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-teal-700 px-1 text-[12px] font-semibold leading-none text-white">{filterCount}</span>}
    </button>
  );
  const label = play === "loading" ? "Wird berechnet" : play === "playing" ? "Pause" : startLabel;
  const chipsBlock = (
    <div className="rm-solid relative z-10">
      {/* Chips ohne Scrollbalken: die Zeile bricht um; flach (weiß, feine Linie) über .rm-solid in glass.css */}
      <div className={`mt-2 flex pl-[52px] ${phone && slot ? "max-sm:mt-0 max-sm:pl-0 max-sm:[&:has(.rm-chip)]:mt-2" : "max-sm:pl-[56px]"} [&>div]:my-0 [&>div]:max-h-none [&>div]:flex-wrap [&>div]:overflow-visible [&>div]:px-0 [&>div]:py-0`}>
        <ActiveFilters />
      </div>
    </div>
  );
  return (
    /* rm-solid: Filter und Vorschläge flach statt Milchglas (app/styles/analytics.css) */
    <>
      {(() => {
        const bar = (
          <div className="rm-solid rm-xsearch relative z-20">
      <div role="search" className="flex w-full items-center gap-2">
          {noPlay && <div className={`relative z-10 h-11 w-11 flex-none max-sm:h-12 max-sm:w-12 ${follow ? "max-sm:order-1" : ""}`}>{open ? <FilterPanel noThema toggle={filterBtn} extra={extra} trail={phone && follow ? 56 : 0} up={filterUp && phone} maxH={filterUp && phone ? 420 : undefined} /> : filterBtn}</div>}
          {!noPlay && <button type="button" onClick={onPlay} disabled={play === "loading"} title={label} aria-label={label} className={`${round} text-teal-700 disabled:cursor-default max-sm:hidden`}>
            {play === "loading" ? (
              <span role="status" aria-label="Wird berechnet" className="rm-spinner" />
            ) : play === "playing" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.2" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" /></svg>
            )}
          </button>}
          {!noPlay && <div className={`relative z-10 h-11 w-11 flex-none max-sm:h-12 max-sm:w-12 max-sm:order-1 ${typing ? "max-sm:hidden" : ""}`}>{open ? <FilterPanel noThema toggle={filterBtn} extra={extra} trail={phone && follow ? 56 : 0} up={filterUp && phone} maxH={filterUp && phone ? 420 : undefined} /> : filterBtn}</div>}
          <div className="rm-xfield min-w-0 flex-1" onFocusCapture={() => setTyping(true)} onBlurCapture={() => window.setTimeout(() => { if (!document.activeElement?.closest('[role="search"]')) setTyping(false); }, 150)}>
            <SearchBox stay keepFocus={keepFocus} onSubmit={onSubmit} listUp={filterUp && phone} listMax={filterUp && phone ? 300 : undefined} />
          </div>
          {follow && <div className={`flex-none max-sm:order-2 sm:hidden ${typing ? "max-sm:hidden" : ""}`}>{follow}</div>}
          {phone && typing && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); setTyping(false); }} className="h-12 flex-none px-1 text-[16px] font-medium text-teal-700">Abbrechen</button>}
        </div>
          </div>
        );
        return phone && slot ? createPortal(<>{bar}{chipsBlock}</>, slot) : bar;
      })()}
      {phone && slot ? null : chipsBlock}
      {/* Desktop: sichtbar sagen, was das Speichern bringt (nur mit Auswahl) */}
      {!phone && follow && isValidElement(follow) && chips.length > 0 && <div className="mt-1 pl-[52px] print:hidden">{cloneElement(follow as React.ReactElement<{ heart?: boolean; line?: boolean }>, { heart: false, line: true })}</div>}
    </>
  );
}
