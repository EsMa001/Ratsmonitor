import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapEngine, type MapStyle } from "../../lib/geo/mapEngine";
import { hasFilters, hasScope } from "../../lib/savedSearch";
import { useData } from "../../state/data";
import { useSearch, useSearchResults } from "../../state/search";
import { useFiltersOpen } from "../../lib/filtersOpen";
import { SearchOverlay } from "../SearchOverlay";
import { ActiveFilters } from "../ActiveFilters";
import { useDarkMode } from "../../lib/useDarkMode";
import { IconCenter, IconMinus, IconPlus, IconReset } from "../icons";

/** Trefferstufe: 0 keine, 1 wenige, 2 mittel, 3 viele (ohne Suche nur 0 oder 3) */
function hitLevel(c: number, t: [number, number], graded: boolean) {
  if (!c) return 0;
  if (!graded) return 3;
  return c <= t[0] ? 1 : c <= t[1] ? 2 : 3;
}

/** Karte suchgesteuert: Sie zeigt Deutschland, solange nichts gesucht ist, und zentriert sich sonst auf die Treffer.
 *  Normal ist sie nur Anzeige mit mittiger Suchleiste. Ein Klick darauf startet den Kartenmodus: Suchleiste unten,
 *  Ziehen und Zoomen frei, Trefferzahlen unter den Gemeindenamen, rechts Zoom, Zentrieren und Neu laden
 *  (Neu laden setzt alle Filter zurück und beendet den Kartenmodus). */
/* Handy: rechte Spalte auf der Achse des Filter-Knopfs, von unten nach oben: Filter-Knopf (48), Abstand, Darstellungs-Knopf, Abstand, Zoom-Leiste.
 * Maße in px vom unteren Kartenrand: Leiste liegt 20 px über dem Rand, der Filter-Knopf ist 48 hoch. */
const PHONE_GAP = 12;
const PHONE_LAYERS_H = 46;
const PHONE_STACK_LAYERS = 20 + 48 + PHONE_GAP;

export function MapPanel({ active }: { active: boolean }) {
  /* Offene Filter liegen über den Karten-Knöpfen (Darstellung, Zoom), nicht dahinter */
  const filtersOpen = useFiltersOpen();
  const { geo, geoError } = useData();
  const search = useSearch();
  const { state, mapRef } = search;
  const { areaCounts, badgeCounts, coverage, snapshot, loading, pending } = useSearchResults();
  const filtered = hasFilters(snapshot);
  /* Kartenmodus (Suchleiste unten) erst, wenn die Suche bestätigt ist (Enter, Vorschlag gewählt oder Feld verlassen); während des Tippens bleibt sie stehen */
  const [typing, setTyping] = useState(false);
  const [settled, setSettled] = useState(filtered);
  useEffect(() => {
    const on = (e: FocusEvent) => setTyping((e.target as HTMLElement | null)?.id === "q");
    const off = () => setTyping(false);
    const input = (e: Event) => (e.target as HTMLElement | null)?.id === "q" && setTyping(true);
    document.addEventListener("focusin", on);
    document.addEventListener("focusout", off);
    document.addEventListener("input", input);
    window.addEventListener("rm:search-confirmed", off);
    return () => {
      document.removeEventListener("focusin", on);
      document.removeEventListener("focusout", off);
      document.removeEventListener("input", input);
      window.removeEventListener("rm:search-confirmed", off);
    };
  }, []);
  useEffect(() => {
    if (!typing) setSettled(filtered);
  }, [typing, filtered]);
  const sectionRef = useRef<HTMLElement>(null);
  /* Ist die Karte oben unter der angehefteten Kopfzeile verschwunden, rücken die Schalter oben mit nach unten */
  const [hidden, setHidden] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const head = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      setHidden(Math.max(0, Math.round(head - el.getBoundingClientRect().top)));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    /* Handy: Safari schiebt die Seite beim Tippen über die Tastatur und scrollt danach nicht zurück.
       Nach dem Bestätigen der Suche die Karte wieder ganz unter die Kopfzeile holen. */
    let t = 0;
    const back = (e: Event) => {
      if (e.type === "focusout" && (e.target as HTMLElement | null)?.id !== "q") return;
      if (window.innerWidth >= 768) return;
      clearTimeout(t);
      t = window.setTimeout(() => {
        const el = sectionRef.current;
        if (!el) return;
        const head = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
        const off = el.getBoundingClientRect().top - head;
        if (off < -1) window.scrollBy({ top: off, behavior: "smooth" });
      }, 350);
    };
    window.addEventListener("rm:search-confirmed", back);
    document.addEventListener("focusout", back);
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      window.removeEventListener("rm:search-confirmed", back);
      document.removeEventListener("focusout", back);
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, []);
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const [mapH, setMapH] = useState(520);
  /* Startwert wie auf dem Server (1200); die echte Breite setzt der Effekt unten über die Elementbreite. */
  const [mapW, setMapW] = useState(1200);
  const [explore, setExplore] = useState(false);
  /* Darstellung im Kartenmodus (oben links wählbar) */
  const [style, setStyle] = useState<MapStyle>("flaechen");
  const dark = useDarkMode()[0];
  const [styleOpen, setStyleOpen] = useState(false);
  /* Klick im Kartenmodus auf eine Gemeinde mit Treffern: diese Stadt (ohne Kreis) als Ort in die Suche übernehmen */
  const selectRef = useRef<(ags: string) => void>(() => {});
  selectRef.current = (ags: string) => {
    if (!ags) return;
    search.setScope("only");
    search.setArea(ags, "map");
  };
  const [barH, setBarH] = useState(44);
  const overlayRef = useRef<HTMLDivElement>(null);
  /* Höhe von Suchleiste + Chips, damit die Leiste im Kartenmodus genau am unteren Rand landet */
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const engine = useMemo(
    () =>
      geo
        ? new MapEngine(geo, { onSelect: (ags) => selectRef.current(ags), onHover: () => {}, onViewChange: () => {}, onWheelHint: () => {}, onUnlock: () => setExplore(true) })
        : null,
    [geo],
  );

  useEffect(() => {
    if (!engine) return;
    mapRef.current = engine;
    const detach = engine.attach(stageRef.current!, baseRef.current!, overRef.current!);
    return () => {
      detach();
      if (mapRef.current === engine) mapRef.current = null;
    };
  }, [engine, mapRef]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setMapH(el.clientHeight);
      setMapW(el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Ortssuche wirkt wie ein Filter: eingefärbt werden nur Gebiete im gesuchten Ort (bzw. Kreis) oder im Umkreis */
  const inScope = useMemo(() => {
    const within = state.radius && geo ? geo.within(state.radius).set : null;
    const places = state.radius ? [] : [...(state.area ? [{ ags: state.area, scope: state.scope }] : []), ...(snapshot.more ?? [])];
    return (ags: string) => {
      if (within) return within.has(ags);
      if (!places.length) return true;
      /* Kreisfreie Stadt (Kreisschlüssel ohne Umfangwahl): Stadt und Kreis sind dasselbe Gebiet */
      return places.some(({ ags: p, scope }) =>
        p.length === 2 ? ags.startsWith(p) : scope === "with" || (p.length === 5 && !hasScope(p, geo)) ? (p.length === 5 ? ags.startsWith(p) : ags === p || ags === p.slice(0, 5)) : ags === p,
      );
    };
  }, [geo, state.radius, state.area, state.scope, snapshot.more]);

  const hits = coverage.map((c) => c.ags).filter((a) => areaCounts[a] && inScope(a));
  const counts = hits.map((a) => areaCounts[a]).sort((a, b) => a - b);
  const maxHits = counts.at(-1) ?? 0;
  const t1 = Math.max(1, Math.round(maxHits / 3)), t2 = Math.max(t1, Math.round((2 * maxHits) / 3));

  useEffect(() => {
    const set = new Set(hits);
    /* Startseite (Kartenmodus noch nicht gestartet): Gemeinden unverändert eingefärbt, erst nach bestätigter Suche (Enter) nur die mit Treffern */
    const levels = Object.fromEntries(coverage.map((c) => [c.ags, !explore ? 3 : set.has(c.ags) ? hitLevel(areaCounts[c.ags] || 0, [t1, t2], filtered) : 0]));
    /* „inkl. Kreis“ bei einer Gemeinde: den ganzen Kreis einfärben (Kreisebene), sonst die gewählte Ebene */
    const level = state.area.length === 8 && state.scope === "with" && !state.radius ? "district" : state.level;
    engine?.update(levels, state.area, state.radius, coverage.map((c) => c.ags), level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, areaCounts, t1, t2, filtered, state.area, state.radius, coverage, state.level, inScope, explore]);

  /* Kartenmodus, sobald eine Suche oder ein Filter bestätigt ist; sind alle entfernt, wieder der normale Modus */
  useEffect(() => {
    setExplore(settled && filtered);
  }, [settled, filtered]);

  /* Normaler Modus: Karte gesperrt. Tippen, Zwei-Finger-Zoom oder Mausrad (nur mit Suche/Filter) starten den Kartenmodus */
  useEffect(() => {
    engine?.setLocked(!explore);
    if (!explore) {
      setStyle("flaechen");
      setStyleOpen(false);
    }
  }, [engine, explore]);
  useEffect(() => {
    engine?.setDark(dark);
  }, [engine, dark]);
  useEffect(() => {
    engine?.setStyle(style);
  }, [engine, style]);

  /* Kartenmodus: Abzeichen mit der Trefferzahl. Jede Karte zählt genau einmal (badgeCounts), damit die Zahlen auf der Karte
     zusammen die Trefferzahl ergeben; die Färbung nutzt weiter areaCounts, dort steht ein Samtgemeinde-Bericht bei jeder Mitgliedsgemeinde. */
  useEffect(() => {
    engine?.setExplore(explore, explore ? { ...badgeCounts } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, explore, badgeCounts]);

  /* Suchgesteuertes Zentrieren: Umkreis → Kreis; Ort → Ort bzw. Kreis bei „inkl. Kreis“; sonst alle Treffer; ohne Suche Deutschland */
  const hitsKey = hits.join(",");
  /* Textalternative der Karte für Bildschirmleser: wie viele Gebiete, die stärksten zuerst */
  const mapLabel = !hits.length
    ? "Karte von Deutschland, keine Gebiete mit Treffern"
    : `Karte: Treffer in ${hits.length} ${hits.length === 1 ? "Gebiet" : "Gebieten"}, am meisten in ${[...hits]
        .sort((a, b) => (areaCounts[b] || 0) - (areaCounts[a] || 0))
        .slice(0, 3)
        .map((a) => `${geo?.info(a).name ?? a} (${areaCounts[a]})`)
        .join(", ")}`;
  /* Im Kartenmodus liegt die Suchleiste unten (20 px Abstand): beim Zentrieren bleibt dieser Streifen frei, die Gemeinden mit Treffern liegen darüber */
  if (engine) engine.bottomInset = explore ? barH + 20 : 0;
  const moreKey = (snapshot.more ?? []).map((m) => m.ags).join(",");
  const center = (toHits = false) => {
    if (!engine) return;
    if (state.radius) return engine.fitCircle(state.radius);
    /* Mehrere Orte: auf alle gesuchten Orte zentrieren */
    if (state.area && snapshot.more?.length) return engine.focusMany([state.area, ...snapshot.more.map((m) => m.ags)]);
    if (state.area) {
      const target = state.area.length === 8 && state.scope === "with" && hasScope(state.area, geo) ? state.area.slice(0, 5) : state.area;
      return engine.focusArea(target);
    }
    if ((filtered || toHits) && hits.length) return engine.focusMany(hits);
    engine.focusArea("");
  };
  useEffect(() => {
    /* Erst nach Enter (Kartenmodus) auf die Treffer zentrieren; ohne Suche und Filter zurück auf Deutschland */
    if (!loading && !pending && (explore || !filtered)) center();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, loading, pending, hitsKey, state.area, state.scope, state.radius, moreKey, filtered, explore]);

  /* Platz für Vorschläge und Filter innerhalb der Karte (unterhalb der mittigen Suchleiste, im Kartenmodus oberhalb) */
  /* Suchleiste unten: im Kartenmodus und auf dem Handy, sobald gesucht oder gefiltert wurde */
  const low = explore;
  /* Handy: Schalter unten links (Darstellung, klappt nach oben auf) und unten rechts (Zoom usw.) über der Suchleiste */
  const mobile = mapW < 768;
  /* Nicht weiter als bis kurz über die Suchleiste rücken */
  const topShift = Math.min(hidden, Math.max(0, mapH - barH - 230));
  const below = low ? mapH - 44 - 32 : Math.round(mapH / 2) - 22 - 16;
  /* Neu laden: wie eine frische Karte, alle Filter weg und zurück in den normalen Modus */
  const refresh = () => {
    search.resetAll();
    setExplore(false);
    engine?.focusArea("");
  };
  const ctl = "grid h-11 w-11 place-items-center rounded-full text-slate-600 hover:bg-white/60 hover:text-slate-900";
  const ctlSm = "grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-white/60 hover:text-slate-900";
  const STYLES: { id: MapStyle; label: string; icon: ReactNode }[] = [
    { id: "flaechen", label: "Flächen", icon: <path d="m4 7 5-3 6 3 5-3v13l-5 3-6-3-5 3zM9 4v13M15 7v13" /> },
    { id: "heat", label: "Heatmap", icon: <path d="M12 21c-3.9 0-7-2.8-7-6.6 0-3.4 2.6-5.3 3.6-8.4 2 1.1 2.7 3 2.7 4.4C13 9 13.9 6.4 13.4 3c3.5 2 5.6 6.4 5.6 10.8 0 4-3.1 7.2-7 7.2z" /> },
    { id: "punkte", label: "Punkte", icon: <><circle cx="7" cy="8" r="1.4" /><circle cx="13" cy="6" r="1.4" /><circle cx="17" cy="12" r="1.4" /><circle cx="10" cy="13" r="1.4" /><circle cx="6" cy="17" r="1.4" /><circle cx="14" cy="18" r="1.4" /></> },
  ];
  const si = STYLES.findIndex((x) => x.id === style);

  return (
    <section ref={sectionRef} aria-label="Karte der Treffer" className={`${dark ? "rm-dark " : ""}relative h-[460px] sm:h-[520px]`}>
      {/* Normal nur Anzeige; im Kartenmodus reagiert die Karte auf Ziehen, Zoomen und Mausrad */}
      <div ref={stageRef} className={`absolute inset-0 select-none overflow-hidden ${dark ? "bg-[#0e1523]" : "bg-map-ground"} ${explore ? "touch-none" : filtered ? "cursor-pointer touch-pan-y" : "pointer-events-none"}`}>
        <canvas ref={baseRef} aria-hidden="true" className="absolute left-0 top-0 block h-full w-full" />
        <canvas ref={overRef} role="img" aria-label={mapLabel} className="absolute left-0 top-0 block h-full w-full" />
        {!geo && <div className="absolute inset-0 grid place-items-center text-[14px] text-slate-500">{geoError ? "Kartendaten konnten nicht geladen werden." : "Karte wird aufgebaut …"}</div>}
      </div>


      {/* Suchleiste mittig, im Kartenmodus und auf dem Handy am unteren Rand (Filter-Chips dann darüber); dazu die aktiven Filter und, wenn geöffnet, die Filter selbst (alles Milchglas) */}
      <div
        ref={overlayRef}
        className={`pointer-events-none absolute inset-x-0 ${filtersOpen ? "z-[8]" : "z-[6]"} flex items-center gap-2 px-4 transition-[top] duration-500 ease-in-out motion-reduce:transition-none ${low ? "flex-col-reverse" : "flex-col"}`}
        style={{ top: low ? mapH - 20 - barH : mapH / 2 - 22 }}
      >
        <SearchOverlay listMax={below} listUp={low} />
        <ActiveFilters />
      </div>

      {explore && (
        <div className={`rm-glass absolute z-[6] flex flex-col overflow-hidden rounded-full ${mobile ? "right-[17px]" : "right-4"}`} style={mobile ? { bottom: PHONE_STACK_LAYERS + PHONE_LAYERS_H + PHONE_GAP } : { top: 16 + topShift }}>
          {/* Handy: kein Plus/Minus, gezoomt wird mit zwei Fingern; die zwei übrigen Knöpfe so breit wie die Knöpfe daneben */}
          {!mobile && <button type="button" title="Vergrößern" aria-label="Vergrößern" onClick={() => engine?.zoomBy(1.6)} className={ctlSm}><IconPlus size={16} /></button>}
          {!mobile && <button type="button" title="Verkleinern" aria-label="Verkleinern" onClick={() => engine?.zoomBy(1 / 1.6)} className={ctlSm}><IconMinus size={16} /></button>}
          <button type="button" title="Auf Treffer zentrieren" aria-label="Auf Treffer zentrieren" onClick={() => center(true)} className={mobile ? ctl : ctlSm}><IconCenter size={mobile ? 18 : 16} /></button>
          <button type="button" title="Karte neu laden" aria-label="Karte neu laden" onClick={refresh} className={mobile ? ctl : ctlSm}><IconReset size={mobile ? 18 : 16} /></button>
        </div>
      )}
      {/* Darstellung oben links (rückt unter der Kopfzeile mit), klappt nach unten auf; Handy: rechts direkt über dem Filter-Knopf der Suchleiste, darüber die Zoom-Leiste (alle drei auf einer Achse), klappt nach oben auf; eine weiße Kugel gleitet zur gewählten Darstellung */}
      {explore && (
        <div className={`rm-glass absolute z-[7] flex rounded-full ${mobile ? "right-[17px] flex-col-reverse" : "left-4 flex-col"}`} style={mobile ? { bottom: PHONE_STACK_LAYERS } : { top: 16 + topShift }}>
          <button type="button" title="Darstellung" aria-label="Darstellung der Karte" aria-expanded={styleOpen} onClick={() => setStyleOpen((o) => !o)} className={`${ctl} ${styleOpen ? "!text-slate-900" : ""}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>
          </button>
          {styleOpen && (
            <div role="radiogroup" aria-label="Darstellung" className="relative flex flex-col">
              <span aria-hidden="true" className="absolute left-1 h-9 w-9 rounded-full bg-white shadow transition-[top] duration-300 ease-out" style={{ top: si * 44 + 4 }} />
              {STYLES.map((o) => (
                <button key={o.id} type="button" role="radio" title={o.label} aria-label={o.label} aria-checked={style === o.id} onClick={() => setStyle(o.id)} className={`relative grid h-11 w-11 place-items-center rounded-full ${style === o.id ? "text-teal-700" : "text-slate-600 hover:text-slate-900"}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{o.icon}</svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <span className="pointer-events-auto absolute bottom-1 right-2 z-[5] text-[12px] text-slate-500">© GeoBasis-DE / BKG 2019, <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener noreferrer" className="relative underline max-sm:after:absolute max-sm:after:-inset-x-2 max-sm:after:-inset-y-4 max-sm:after:content-['']">dl-de/by-2-0</a></span>
    </section>
  );
}
