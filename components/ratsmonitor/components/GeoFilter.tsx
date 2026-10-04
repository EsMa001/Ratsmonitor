import { useEffect, useRef, useState } from "react";
import { isCovered } from "../lib/constants";
import type { HierEntry } from "../lib/geo/geoModel";
import { norm } from "../lib/text";
import { useData } from "../state/data";
import { useAppNav } from "../state/nav";
import { useSearch, useSearchResults } from "../state/search";
import { IconCheck, IconChevronDown, IconChevronRight, IconPin } from "./icons";

const STEPS = ["Bundesland", "Kreis", "Kommune"];

/** Hierarchischer Gebietsfilter: Bundesland > Kreis > Kommune */
export function GeoFilter() {
  const { geo } = useData();
  const search = useSearch();
  const { state } = search;
  const { areaCounts,coverage } = useSearchResults();
  const { view, goOverview } = useAppNav();
  const [open, setOpen] = useState(false);
  const [nav, setNav] = useState("");
  const [find, setFind] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<HTMLInputElement>(null);

  const lvl = nav === "" ? 0 : nav.length === 2 ? 1 : 2;

  const startNav = (area: string) => {
    if (!area || area.length === 2 || !geo) return "";
    if (area.length === 5) return area.slice(0, 2);
    return geo.get(area.slice(0, 5))?.kreisfrei ? area.slice(0, 2) : area.slice(0, 5);
  };

  const openPanel = () => {
    setNav(startNav(state.area));
    setFind("");
    setOpen(true);
  };
  const close = (focusBtn = false) => {
    setOpen(false);
    if (focusBtn) btnRef.current?.focus();
  };
  const go = (ags: string) => {
    setNav(ags);
    setFind("");
    findRef.current?.focus();
  };
  const select = (ags: string) => {
    close(true);
    search.setArea(ags, "ui", { zoom: true, clearRadius: true });
    if (view !== "overview") goOverview();
  };

  /* Beim Öffnen die aktuelle Auswahl oder das Suchfeld fokussieren */
  useEffect(() => {
    if (!open) return;
    const cur = panelRef.current?.querySelector<HTMLElement>("[data-sel='true']");
    (cur ?? findRef.current)?.focus();
    cur?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>("[data-geo-item]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const target = e.target as HTMLInputElement;
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      (items[i + 1] ?? items[0])?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (i <= 0) findRef.current?.focus();
      else items[i - 1].focus();
    } else if ((e.key === "ArrowLeft" || (e.key === "Backspace" && target === findRef.current && !target.value)) && nav) {
      e.preventDefault();
      go(nav.length === 5 ? nav.slice(0, 2) : "");
    } else if (e.key === "ArrowRight") {
      const d = (document.activeElement as HTMLElement | null)?.dataset.drill;
      if (d) {
        e.preventDefault();
        go(d);
      }
    }
  };

  const label = !geo
    ? "Alle Gebiete"
    : state.radius
      ? `Umkreis ${state.radius.km} km · ${geo.info(state.radius.ags).name}`
      : state.area
        ? geo.info(state.area).name
        : "Alle Gebiete";
  const activeFilter = !!state.area || !!state.radius;
  const nf = norm(find.trim());
  const kids: HierEntry[] = geo ? geo.children(nav).filter((e) => !nf || norm(e.sort).includes(nf)) : [];
  const allSel = state.area === nav && !state.radius;
  const allLabel = !geo || lvl === 0 ? "Alle Gebiete in Deutschland" : lvl === 1 ? `Ganz ${geo.get(nav)?.name}` : `Ganzer ${geo.get(nav)?.name}`;
  const badge = (ags: string) => (isCovered(ags,coverage) ? <span className="count-pill">{areaCounts[ags] || 0}</span> : <span />);
  const ph = lvl === 0 ? "Bundesland suchen" : lvl === 1 ? "Kreis oder kreisfreie Stadt suchen" : "Kommune suchen";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="geo-panel"
        title={state.radius ? "Umkreisfilter aktiv" : state.area && geo ? geo.pathText(state.area) : "Gebiet wählen: Bundesland, Kreis, Kommune"}
        onClick={() => (open ? close() : openPanel())}
        className={`flex h-11 w-full items-center gap-2 rounded-[10px] border px-3 text-left text-[14px] font-normal transition-[border-color,box-shadow,background-color] desk:w-full ${
          open ? "border-teal-600 shadow-focus" : activeFilter ? "border-teal-200" : "border-slate-200 hover:border-slate-300"
        } ${activeFilter ? "bg-teal-50 text-teal-700" : "bg-white text-slate-900"}`}
      >
        <IconPin className={activeFilter ? "shrink-0 text-teal-700" : "shrink-0 text-slate-500"} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <IconChevronDown size={14} className="shrink-0 text-slate-500" />
      </button>

      {open && geo && (
        <div
          ref={panelRef}
          id="geo-panel"
          role="dialog"
          aria-label="Gebiet auswählen: Bundesland, Kreis, Kommune"
          onKeyDown={onKeyDown}
          className="popover absolute left-0 top-[calc(100%+8px)] z-[1200] flex max-h-[min(520px,calc(100vh-110px))] w-[360px] max-w-[calc(100vw-32px)] flex-col"
        >
          <div className="flex gap-1 px-2.5 pt-2.5">
            {STEPS.map((s, i) => {
              const done = i < lvl;
              const cur = i === lvl;
              const inner = (
                <>
                  <b
                    className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-full text-[11px] font-semibold ${
                      cur ? "bg-teal-600 text-white" : done ? "bg-teal-100 text-teal-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {i + 1}
                  </b>
                  {s}
                </>
              );
              const cls = `flex flex-1 items-center gap-1.5 rounded-[7px] px-2 py-1.5 text-left text-[12px] ${
                cur ? "bg-teal-50 font-semibold text-teal-700" : done ? "bg-slate-50 text-slate-600" : "bg-slate-50 text-slate-500"
              }`;
              return done ? (
                <button key={s} type="button" className={cls + " hover:bg-slate-100"} onClick={() => go(i === 0 ? "" : nav.slice(0, 2))}>
                  {inner}
                </button>
              ) : (
                <span key={s} className={cls} aria-current={cur ? "step" : undefined}>
                  {inner}
                </span>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-0.5 px-3 pt-2.5 text-[12px] text-slate-500">
            {lvl === 0 ? (
              <span className="px-1 py-0.5 font-semibold text-slate-900">Deutschland</span>
            ) : (
              <button type="button" className="rounded-[5px] px-1 py-0.5 text-teal-600 hover:bg-teal-50" onClick={() => go("")}>
                Deutschland
              </button>
            )}
            {lvl >= 1 && (
              <>
                <span aria-hidden="true">›</span>
                {lvl === 1 ? (
                  <span className="px-1 py-0.5 font-semibold text-slate-900">{geo.get(nav.slice(0, 2))?.name}</span>
                ) : (
                  <button type="button" className="rounded-[5px] px-1 py-0.5 text-teal-600 hover:bg-teal-50" onClick={() => go(nav.slice(0, 2))}>
                    {geo.get(nav.slice(0, 2))?.name}
                  </button>
                )}
              </>
            )}
            {lvl === 2 && (
              <>
                <span aria-hidden="true">›</span>
                <span className="px-1 py-0.5 font-semibold text-slate-900">{geo.get(nav)?.name}</span>
              </>
            )}
          </div>
          <div className="border-b border-slate-200 px-2.5 pb-2 pt-2.5">
            <label htmlFor="geo-find" className="sr-only">
              {ph}
            </label>
            <input
              ref={findRef}
              id="geo-find"
              type="search"
              autoComplete="off"
              placeholder={ph + " …"}
              value={find}
              onChange={(e) => setFind(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] outline-none focus:border-teal-600 focus:shadow-[0_0_0_3px_rgba(13,148,136,.2)]"
            />
          </div>
          <ul role="list" className="scroll-thin m-0 min-h-0 flex-1 list-none overflow-y-auto p-1.5">
            <li>
              <button
                type="button"
                data-geo-item
                aria-pressed={allSel}
                onClick={() => select(nav)}
                className={`mb-1 grid min-h-10 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-left hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none ${
                  allSel ? "bg-teal-50" : ""
                }`}
              >
                <span className={`truncate text-[14px] font-medium ${allSel ? "text-teal-700" : ""}`}>{allLabel}</span>
                {nav ? badge(nav) : <span />}
                {allSel ? <IconCheck className="text-teal-700" /> : <span />}
              </button>
            </li>
            {kids.length === 0 && <li className="p-3 text-[13px] text-slate-500">Kein Gebiet gefunden</li>}
            {kids.map((e) => {
              const sel = state.area === e.ags || (state.area.startsWith(e.ags) && e.ags.length < state.area.length);
              let meta: string;
              let drill: boolean;
              if (lvl === 0) {
                meta = e.kids.length === 1 ? "Stadtstaat" : `${e.kids.length} Kreise und kreisfreie Städte`;
                drill = true;
              } else if (lvl === 1) {
                drill = !e.kreisfrei;
                meta = e.kreisfrei ? e.type ?? "" : `${e.type} · ${e.kids.filter((g) => g.bez !== 2).length} Kommunen`;
              } else {
                drill = false;
                meta = e.type ?? "";
              }
              return (
                <li key={e.ags}>
                  <button
                    type="button"
                    data-geo-item
                    data-drill={drill ? e.ags : undefined}
                    data-sel={sel ? "true" : undefined}
                    aria-label={drill ? `${e.name}, untergeordnete Gebiete anzeigen` : undefined}
                    aria-pressed={drill ? undefined : state.area === e.ags}
                    onClick={() => (drill ? go(e.ags) : select(e.ags))}
                    className={`grid min-h-10 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none ${
                      sel ? "bg-teal-50" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block truncate text-[14px] ${sel ? "font-semibold text-teal-700" : ""}`}>{e.name}</span>
                      <span className="block text-[12px] text-slate-500">{meta}</span>
                    </span>
                    {badge(e.ags)}
                    {drill ? <IconChevronRight className="text-slate-500" /> : state.area === e.ags ? <IconCheck className="text-teal-700" /> : <span />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
