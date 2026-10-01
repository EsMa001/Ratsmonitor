import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isCovered } from "../../lib/constants";
import { MapEngine } from "../../lib/geo/mapEngine";
import { plural } from "../../lib/text";
import { useData } from "../../state/data";
import { useSearch, useSearchResults } from "../../state/search";
import { IconMinus, IconPlus, IconRadius, IconReset, IconX } from "../icons";
import { Legend } from "./Legend";
import { RadiusPanel } from "./RadiusPanel";

/** Karte aller Gemeinden mit Zoom, Legende, Popup und Umkreis */
export function MapPanel({ active }: { active: boolean }) {
  const { geo, geoError } = useData();
  const search = useSearch();
  const { state, popup, mapRef } = search;
  const { areaCounts, coverage } = useSearchResults();
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
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
        if (s.radius) return act.setPopup(ags);
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
    engine?.update(areaCounts, state.area, state.radius, coverage.map(c=>c.ags),state.level);
  }, [engine, areaCounts, state.area, state.radius, coverage,state.level]);

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

  const countText = (ags: string) => {
    const c = areaCounts[ags] || 0;
    return isCovered(ags,coverage) ? `${c} ${plural(c, "passender Eintrag", "passende Einträge")}` : "nicht erfasst";
  };
  const tipInfo = geo && tip && !popup ? geo.info(tip.ags) : null;
  const popInfo = geo && popup ? geo.info(popup) : null;

  const btnPrimary =
    "flex min-h-9 items-center justify-center gap-2 rounded-lg border border-teal-600 bg-teal-600 px-2.5 text-[13.5px] font-medium text-white hover:border-teal-700 hover:bg-teal-700";
  const btnSecondary = "min-h-9 rounded-lg border border-teal-200 bg-white px-2.5 text-[13.5px] font-medium text-teal-700 hover:bg-teal-50";

  return (
    <section aria-label="Karte der Gemeinden und Kreise" className="relative h-[460px] overflow-hidden border-b border-slate-200 bg-map-ground sm:h-[520px]">
      <div ref={stageRef} className="absolute inset-0 cursor-grab touch-none select-none">
        <canvas ref={baseRef} aria-hidden="true" className="absolute left-0 top-0 block h-full w-full" />
        <canvas
          ref={overRef}
          role="img"
          aria-label="Karte der Gemeinden. Die Auswahl eines Gebiets ist auch über den Gebietsfilter in der Kopfzeile möglich."
          className="absolute left-0 top-0 block h-full w-full"
        />
        {!geo && <div className="absolute inset-0 grid place-items-center text-[13px] text-slate-500">{geoError ? "Kartendaten konnten nicht geladen werden." : "Karte wird aufgebaut …"}</div>}
        <div
          ref={tipRef}
          className={`pointer-events-none absolute z-[6] max-w-[260px] rounded-lg bg-slate-900 px-2.5 py-[7px] text-[12.5px] leading-[1.35] text-white shadow-pop transition-opacity duration-75 ${
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
          className={`pointer-events-none absolute left-1/2 top-4 z-[6] -translate-x-1/2 rounded-full bg-slate-900/90 px-3 py-1.5 text-[12.5px] text-white transition-opacity duration-200 ${
            hint ? "opacity-100" : "opacity-0"
          }`}
        >
          Zum Zoomen Strg (Mac: ⌘) gedrückt halten und scrollen
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
            <b className="block pr-7 text-[14.5px] leading-[1.3]">{popInfo.name}</b>
            <span className="block text-[12.5px] text-slate-500">{popInfo.meta}</span>
            <div className="mt-1 text-slate-600">{countText(popup)}</div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {!state.radius && (
                <>
                  <button type="button" className={btnPrimary} onClick={() => search.startRadius(popup)}>
                    <IconRadius />
                    Alle im Umkreis auswählen
                  </button>
                  {state.area === popup && (
                    <button type="button" className={btnSecondary} onClick={() => search.setArea("", "ui")}>
                      Auswahl aufheben
                    </button>
                  )}
                </>
              )}
              {state.radius && state.radius.ags === popup && (
                <button type="button" className={btnSecondary} onClick={search.clearRadius}>
                  Umkreis aufheben
                </button>
              )}
              {state.radius && state.radius.ags !== popup && (
                <>
                  <button type="button" className={btnPrimary} onClick={() => search.startRadius(popup)}>
                    <IconRadius />
                    Umkreis hierher verlegen
                  </button>
                  <button type="button" className={btnSecondary} onClick={() => search.setArea(popup, "ui", { clearRadius: true })}>
                    Nur dieses Gebiet anzeigen
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[5]">
        <div className="relative mx-auto h-full max-w-page">
          <div className="pointer-events-auto absolute right-3 top-3 flex flex-col overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-xs sm:right-6 sm:top-4">
            {[
              { label: "Hineinzoomen", icon: <IconPlus />, run: () => engine?.zoomBy(1.8) },
              { label: "Herauszoomen", icon: <IconMinus />, run: () => engine?.zoomBy(1 / 1.8) },
              { label: "Suche und Filter zurücksetzen, Deutschland anzeigen", icon: <IconReset />, run: search.resetAll },
            ].map((b, i) => (
              <button
                key={b.label}
                type="button"
                aria-label={b.label}
                title={i === 2 ? "Suche und Filter zurücksetzen" : undefined}
                onClick={b.run}
                className="grid h-8 w-8 place-items-center border-b border-slate-200 bg-white text-slate-600 last:border-b-0 hover:bg-slate-100 hover:text-slate-900 sm:h-9 sm:w-9"
              >
                {b.icon}
              </button>
            ))}
          </div>
          <Legend />
          {state.radius && geo && <RadiusPanel />}
          <span className="absolute bottom-2 right-6 hidden rounded bg-map-ground/85 px-[5px] py-px text-[10.5px] text-slate-500 sm:block">© GeoBasis-DE / BKG 2019</span>
        </div>
      </div>
      {/* Nur für Screenreader: Hinweis auf die Auswahl über den Gebietsfilter */}
      <span className="sr-only">{popInfo ? `${popInfo.name} ausgewählt` : ""}</span>
    </section>
  );
}
