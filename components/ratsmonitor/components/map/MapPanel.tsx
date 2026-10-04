import { useEffect, useMemo, useRef, useState } from "react";
import { MapEngine } from "../../lib/geo/mapEngine";
import { hasFilters, hasScope } from "../../lib/savedSearch";
import { useData } from "../../state/data";
import { useSearch, useSearchResults } from "../../state/search";
import { SearchOverlay } from "../SearchOverlay";
import { ActiveFilters } from "../ActiveFilters";

/** Trefferstufe: 0 keine, 1 wenige, 2 mittel, 3 viele (ohne Suche nur 0 oder 3) */
function hitLevel(c: number, t: [number, number], graded: boolean) {
  if (!c) return 0;
  if (!graded) return 3;
  return c <= t[0] ? 1 : c <= t[1] ? 2 : 3;
}

/** Karte rein suchgesteuert: keine Bedienung durch Nutzer (kein Klicken, Ziehen oder Zoomen).
 *  Sie zeigt Deutschland, solange nichts gesucht ist, und zentriert sich sonst auf die Treffer bzw. das gesuchte Gebiet.
 *  Darauf liegt die Milchglas-Suchleiste: mittig, nach Enter am unteren Kartenrand. */
export function MapPanel({ active }: { active: boolean }) {
  const { geo, geoError } = useData();
  const search = useSearch();
  const { state, mapRef } = search;
  const { areaCounts, coverage, snapshot, loading } = useSearchResults();
  const filtered = hasFilters(snapshot);
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const [mapH, setMapH] = useState(520);

  const engine = useMemo(
    () =>
      geo
        ? new MapEngine(geo, { onSelect: () => {}, onHover: () => {}, onViewChange: () => {}, onWheelHint: () => {} })
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
    const ro = new ResizeObserver(() => setMapH(el.clientHeight));
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
    const levels = Object.fromEntries(coverage.map((c) => [c.ags, set.has(c.ags) ? hitLevel(areaCounts[c.ags] || 0, [t1, t2], filtered) : 0]));
    /* „inkl. Kreis“ bei einer Gemeinde: den ganzen Kreis einfärben (Kreisebene), sonst die gewählte Ebene */
    const level = state.area.length === 8 && state.scope === "with" && !state.radius ? "district" : state.level;
    engine?.update(levels, state.area, state.radius, coverage.map((c) => c.ags), level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, areaCounts, t1, t2, filtered, state.area, state.radius, coverage, state.level, inScope]);

  /* Suchgesteuertes Zentrieren: Umkreis → Kreis; Ort → Ort bzw. Kreis bei „inkl. Kreis“; sonst alle Treffer; ohne Suche Deutschland */
  const hitsKey = hits.join(",");
  const moreKey = (snapshot.more ?? []).map((m) => m.ags).join(",");
  useEffect(() => {
    if (!engine || loading) return;
    if (state.radius) return engine.fitCircle(state.radius);
    /* Mehrere Orte: auf alle gesuchten Orte zentrieren */
    if (state.area && snapshot.more?.length) return engine.focusMany([state.area, ...snapshot.more.map((m) => m.ags)]);
    if (state.area) {
      const target = state.area.length === 8 && state.scope === "with" && hasScope(state.area, geo) ? state.area.slice(0, 5) : state.area;
      return engine.focusArea(target);
    }
    if (filtered && hits.length) return engine.focusMany(hits);
    engine.focusArea("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, loading, hitsKey, state.area, state.scope, state.radius, moreKey, filtered]);

  /* Platz für Vorschläge und Filter innerhalb der Karte (unterhalb der mittigen Suchleiste) */
  const below = Math.round(mapH / 2) - 22 - 16;

  return (
    <section ref={sectionRef} aria-label="Karte der Treffer" className="relative mx-auto mt-[12px] h-[460px] max-w-page sm:h-[520px]">
      {/* Nur Anzeige: die Karte reagiert nicht auf Maus oder Touch */}
      <div ref={stageRef} className="pointer-events-none absolute inset-0 select-none overflow-hidden rounded-2xl bg-map-ground">
        <canvas ref={baseRef} aria-hidden="true" className="absolute left-0 top-0 block h-full w-full" />
        <canvas ref={overRef} role="img" aria-label="Karte der Gemeinden mit Treffern zur aktuellen Suche" className="absolute left-0 top-0 block h-full w-full" />
        {!geo && <div className="absolute inset-0 grid place-items-center text-[14px] text-slate-500">{geoError ? "Kartendaten konnten nicht geladen werden." : "Karte wird aufgebaut …"}</div>}
      </div>

      {/* Suchleiste bleibt mittig; darunter die aktiven Filter und, wenn geöffnet, die Filter selbst (alles Milchglas) */}
      <div className="pointer-events-none absolute inset-x-0 z-[6] flex flex-col items-center gap-2 px-4" style={{ top: "calc(50% - 22px)" }}>
        <SearchOverlay listMax={below} />
        <ActiveFilters />
      </div>

      <span className="pointer-events-auto absolute bottom-1 right-2 z-[5] text-[12px] text-slate-500">© GeoBasis-DE / BKG 2019, <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener noreferrer" className="underline">dl-de/by-2-0</a></span>
    </section>
  );
}
