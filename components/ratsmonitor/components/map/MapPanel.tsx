import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isCovered } from "../../lib/constants";
import { MapEngine } from "../../lib/geo/mapEngine";
import { plural } from "../../lib/text";
import { hasFilters } from "../../lib/savedSearch";
import { useData } from "../../state/data";
import { useSearch, useSearchResults } from "../../state/search";
import { IconCenter, IconChevronDown, IconChevronUp, IconMap, IconMinus, IconPlus, IconReset, IconX } from "../icons";
import { Legend } from "./Legend";

/** Trefferstufe: 0 keine, 1 wenige, 2 mittel, 3 viele (ohne Suche nur 0 oder 3) */
function hitLevel(c: number, t: [number, number], graded: boolean) {
  if (!c) return 0;
  if (!graded) return 3;
  return c <= t[0] ? 1 : c <= t[1] ? 2 : 3;
}

/** Karte aller Gemeinden mit Zoom, Legende, Popup und Umkreis */
export function MapPanel({ active }: { active: boolean }) {
  const { geo, geoError } = useData();
  const search = useSearch();
  const { state, popup, mapRef } = search;
  const { areaCounts, coverage, snapshot, text, loading } = useSearchResults();
  const filtered = hasFilters(snapshot);
  const hits = coverage.map((c) => areaCounts[c.ags] || 0).filter(Boolean).sort((a, b) => a - b);
  const maxHits = hits.at(-1) ?? 0;
  /* Lineare Stufen: gleich breite Drittel bis zum Höchstwert */
  const t1 = Math.max(1, Math.round(maxHits / 3)), t2 = Math.max(t1, Math.round((2 * maxHits) / 3));
  const [zoomHint, setZoomHint] = useState("Zum Zoomen in die Karte klicken oder Strg gedrückt halten");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setZoomHint("Zum Zoomen in die Karte klicken oder ⌘ (Cmd) gedrückt halten");
  }, []);
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  /* Karte einklappbar; die Wahl bleibt im Browser gespeichert */
  const [collapsed, setCollapsedState] = useState(false);
  useEffect(() => {
    try {
      setCollapsedState(localStorage.getItem("rm-map-collapsed") === "1");
    } catch {}
  }, []);
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem("rm-map-collapsed", v ? "1" : "0");
    } catch {}
  };
  const [tip, setTip] = useState<{ ags: string; x: number; y: number } | null>(null);
  const [hint, setHint] = useState(false);
  const hintTimer = useRef(0);

  /* Aktuelle Werte für die Callbacks der Karte */
  const live = useRef({ state, popup, search });
  live.current = { state, popup, search };

  const placePopup = useCallback(() => {
    const el = popRef.current;
    const engine = mapRef.current;
    const ags = live.current.popup;
    if (!el || !engine || !ags) return;
    const p = engine.project(ags);
    if (!p) {
      el.style.visibility = "hidden";
      return;
    }
    const half = el.offsetWidth / 2;
    const left = Math.min(Math.max(p.x, half + 8), p.w - half - 8);
    const below = p.y - el.offsetHeight - 20 < 8;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(p.y)}px`;
    el.style.setProperty("--ax", `${Math.round(half + p.x - left)}px`);
    el.dataset.below = below ? "true" : "false";
    el.style.visibility = p.x < 0 || p.x > p.w || p.y < 0 || p.y > p.h ? "hidden" : "visible";
  }, [mapRef]);

  const engine = useMemo(
    () =>
      geo
        ? new MapEngine(geo, {
            onSelect: () => {},
            onHover: () => {},
            onViewChange: () => {},
            onWheelHint: () => {},
          })
        : null,
    [geo],
  );

  useEffect(() => {
    if (!engine) return;
    engine.setCallbacks({
      onSelect(ags) {
        const { state: s, search: act } = live.current;
        if (!ags) return act.setPopup("");
        const deselect = s.area === ags;
        act.setArea(deselect ? "" : ags, "map");
        act.setPopup(deselect ? "" : ags);
      },
      onHover: (ags, x, y) => setTip(ags ? { ags, x, y } : null),
      onViewChange: placePopup,
      onWheelHint() {
        setHint(true);
        clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setHint(false), 1400);
      },
    });
    mapRef.current = engine;
    const detach = engine.attach(stageRef.current!, baseRef.current!, overRef.current!);
    return () => {
      detach();
      if (mapRef.current === engine) mapRef.current = null;
    };
  }, [engine, mapRef, placePopup]);

  useEffect(() => {
    const levels = Object.fromEntries(coverage.map((c) => [c.ags, hitLevel(areaCounts[c.ags] || 0, [t1, t2], filtered)]));
    engine?.update(levels, state.area, state.radius, coverage.map(c=>c.ags),state.level);
  }, [engine, areaCounts, t1, t2, filtered, state.area, state.radius, coverage,state.level]);

  useLayoutEffect(() => {
    placePopup();
  });

  /* Tooltip neben dem Mauszeiger, am Rand gespiegelt */
  useLayoutEffect(() => {
    const el = tipRef.current;
    const stage = stageRef.current;
    if (!el || !stage || !tip) return;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    let x = tip.x + 14;
    let y = tip.y + 14;
    if (x + el.offsetWidth > W - 8) x = tip.x - el.offsetWidth - 14;
    if (y + el.offsetHeight > H - 8) y = tip.y - el.offsetHeight - 14;
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${Math.max(8, y)}px`;
  }, [tip]);

  useEffect(() => {
    if (!active || !popup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        search.setPopup("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, popup, search]);

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  /* Auf alle Gebiete mit Treffern zentrieren; im Umkreis auf den ganzen Kreis */
  const centerHits = () => {
    if (!engine) return;
    if (state.radius) return engine.fitCircle(state.radius);
    engine.focusMany(coverage.map((c) => c.ags).filter((a) => areaCounts[a]));
  };

  /* Neuer Suchbegriff ohne gewähltes Gebiet: sobald die Treffer da sind, die Karte auf sie zentrieren */
  const pendingCenter = useRef(false);
  useEffect(() => {
    pendingCenter.current = !!text.trim();
  }, [text]);
  useEffect(() => {
    if (loading || !pendingCenter.current) return;
    pendingCenter.current = false;
    if (!state.area && !state.radius) centerHits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, areaCounts]);

  const countText = (ags: string) => {
    if (!isCovered(ags, coverage)) return "Keine Treffer";
    const c = areaCounts[ags] || 0;
    if (!c) return "Keine Treffer";
    return filtered ? `${c} Treffer` : "Treffer vorhanden";
  };
  const tipInfo = geo && tip && !popup ? geo.info(tip.ags) : null;
  const popInfo = geo && popup ? geo.info(popup) : null;


  return (
    <>
    {collapsed && (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-expanded={false}
        className="mx-auto mt-[12px] flex h-11 w-full max-w-page items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[14px] font-medium text-slate-700 shadow-card hover:bg-slate-50"
      >
        <IconMap size={18} className="text-teal-600" />
        Karte anzeigen
        <IconChevronDown size={16} className="ml-auto text-slate-500" />
      </button>
    )}
    <section hidden={collapsed} aria-label="Karte der Gemeinden und Kreise" className="relative mx-auto mt-[12px] h-[460px] max-w-page overflow-hidden rounded-2xl border border-slate-200 bg-map-ground shadow-card sm:h-[520px]">
      <div ref={stageRef} className="absolute inset-0 cursor-grab touch-pan-y select-none">
        <canvas ref={baseRef} aria-hidden="true" className="absolute left-0 top-0 block h-full w-full" />
        <canvas
          ref={overRef}
          role="img"
          aria-label="Karte der Gemeinden. Die Auswahl eines Gebiets ist auch über den Gebietsfilter unter der Karte möglich."
          className="absolute left-0 top-0 block h-full w-full"
        />
        {!geo && <div className="absolute inset-0 grid place-items-center text-[13px] text-slate-500">{geoError ? "Kartendaten konnten nicht geladen werden." : "Karte wird aufgebaut …"}</div>}
        <div
          ref={tipRef}
          className={`pointer-events-none absolute z-[6] max-w-[260px] rounded-lg bg-slate-900 px-2.5 py-[7px] text-[12px] leading-[1.35] text-white shadow-pop transition-opacity duration-75 ${
            tipInfo ? "opacity-100" : "opacity-0"
          }`}
        >
          {tipInfo && tip && (
            <>
              <b className="block text-[13px] font-semibold">{tipInfo.name}</b>
              <span className="block text-slate-300">{tipInfo.meta}</span>
              <span className="mt-0.5 block">{countText(tip.ags)}</span>
            </>
          )}
        </div>
        <div
          className={`pointer-events-none absolute left-1/2 top-4 z-[6] -translate-x-1/2 rounded-full bg-slate-900/90 px-3 py-1.5 text-[12px] text-white transition-opacity duration-200 ${
            hint ? "opacity-100" : "opacity-0"
          }`}
        >
          {zoomHint}
        </div>
        {popInfo && (
          <div
            ref={popRef}
            role="dialog"
            aria-label={popInfo.name}
            className="group absolute left-0 top-0 z-[7] w-[230px] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border border-slate-200 bg-white py-3 pl-3.5 pr-3 text-[13px] shadow-pop data-[below=true]:translate-y-3.5 sm:w-[260px]"
          >
            <span
              aria-hidden="true"
              className="absolute bottom-[-7px] left-[var(--ax,50%)] h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white group-data-[below=true]:bottom-auto group-data-[below=true]:top-[-7px] group-data-[below=true]:-rotate-[135deg]"
            />
            <button
              type="button"
              aria-label="Schließen"
              onClick={() => search.setPopup("")}
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-[7px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <IconX />
            </button>
            <b className="block pr-7 text-[14px] leading-[1.3]">{popInfo.name}</b>
            <span className="block text-[12px] text-slate-500">{popInfo.meta}</span>
            <div className="mt-1 text-slate-600">{countText(popup)}</div>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[5]">
        <div className="relative mx-auto h-full max-w-page">
          <div className="pointer-events-auto absolute right-3 top-3 flex flex-col overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-xs">
            {[
              { label: "Hineinzoomen", icon: <IconPlus />, run: () => engine?.zoomBy(1.8) },
              { label: "Herauszoomen", icon: <IconMinus />, run: () => engine?.zoomBy(1 / 1.8) },
              { label: "Karte auf alle Treffer zentrieren", icon: <IconCenter />, run: centerHits },
              { label: "Suche und Filter zurücksetzen, Deutschland anzeigen", icon: <IconReset />, run: search.resetAll },
            ].map((b, i) => (
              <button
                key={b.label}
                type="button"
                aria-label={b.label}
                title={i === 2 ? "Auf alle Treffer zentrieren" : i === 3 ? "Suche und Filter zurücksetzen" : undefined}
                onClick={b.run}
                className="grid h-8 w-8 place-items-center border-b border-slate-200 bg-white text-slate-600 last:border-b-0 hover:bg-slate-100 hover:text-slate-900 sm:h-9 sm:w-9"
              >
                {b.icon}
              </button>
            ))}
          </div>
          {/* Dezent mittig am unteren Rand */}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="pointer-events-auto absolute bottom-3 left-1/2 hidden h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 shadow-xs hover:text-slate-900 sm:inline-flex"
          >
            <IconChevronUp size={14} />
            Karte einklappen
          </button>
          <button
            type="button"
            aria-label="Karte einklappen"
            onClick={() => setCollapsed(true)}
            className="pointer-events-auto absolute bottom-3 left-1/2 grid h-8 w-11 -translate-x-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xs sm:hidden"
          >
            <IconChevronUp size={16} />
          </button>
          <Legend graded={filtered} max={maxHits} t1={t1} t2={t2} />
          <span className="pointer-events-auto absolute left-2 top-2 rounded sm:left-auto sm:top-auto bg-map-ground/85 px-[5px] py-px text-[11px] text-slate-500 sm:bottom-3 sm:right-3">© GeoBasis-DE / BKG 2019, <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener noreferrer" className="underline">dl-de/by-2-0</a>, vereinfacht</span>
        </div>
      </div>
      {/* Nur für Screenreader: Hinweis auf die Auswahl über den Gebietsfilter */}
      <span className="sr-only">{popInfo ? `${popInfo.name} ausgewählt` : ""}</span>
    </section>
    </>
  );
}
