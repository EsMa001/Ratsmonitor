import { useCallback, useEffect, useRef, useState } from "react";
import { STATUS } from "../../lib/constants";
import { filterChips } from "../../lib/savedSearch";
import { plural } from "../../lib/text";
import { useSavedStats } from "../../state/account";
import { useData } from "../../state/data";
import { overviewScroll, useAppNav } from "../../state/nav";
import { useSearch, useSearchResults } from "../../state/search";
import { useUi } from "../../state/ui";
import type { Article } from "../../types";
import { FilterSelect } from "../FilterSelect";
import { IconArrowUp, IconBookmark, IconEmptySearch, IconX } from "../icons";
import { ArticleCard } from "./ArticleCard";

export function ResultsPanel() {
  const { geo } = useData();
  const search = useSearch();
  const { state, mapRef } = search;
  const res = useSearchResults();
  const articlesReady=!res.loading;
  const { signatures } = useSavedStats();
  const { push, openKonto } = useAppNav();
  const { openSaveDialog, setFlashSaved } = useUi();
  const listRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false, toTop: false });

  const updateFades = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const st = el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;
    setFade({ top: st > 4, bottom: st < max - 4, toTop: st >= 240 });
  }, []);

  useEffect(() => {
    overviewScroll.listEl = listRef.current;
    updateFades();
    window.addEventListener("resize", updateFades);
    return () => window.removeEventListener("resize", updateFades);
  }, [updateFades]);

  /* Neue Trefferliste: nach oben scrollen */
  const listKey = res.results.map((a) => a.id).join(",") + "|" + res.terms.join(" ");
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(updateFades);
  }, [listKey, updateFades]);

  const onOpen = useCallback((a: Article) => push(`/beschluss/${a.id}`, a.id), [push]);
  const onGemeinde = useCallback(
    (a: Article) => (state.area === a.ags ? search.setArea("", "ui") : search.setArea(a.ags, "ui", { zoom: true })),
    [search, state.area],
  );
  const onThema = useCallback((a: Article) => search.setThema(state.thema === a.thema ? "" : a.thema), [search, state.thema]);
  const onHover = useCallback((ags: string) => mapRef.current?.setExternalHover(ags), [mapRef]);

  const chips = filterChips(res.snapshot, geo);
  const savedHit = signatures.get(res.signature);
  const n = res.total;
  const name = (ags: string) => geo?.info(ags).name ?? ags;
  const emptyWhere = state.radius ? ` im Umkreis von ${state.radius.km} km um ${name(state.radius.ags)}` : state.area ? ` für ${name(state.area)}` : "";

  const clearChip = (key: (typeof chips)[number]["key"]) => {
    if (key === "q") return search.applySearch(res.placeActive ? res.pq.phraseRaw : "");
    if (key === "area") return search.setArea("", "ui");
    if (key === "radius") return search.clearRadius();
    if (key === "thema") return search.setThema("");
    if (key === "monat") return search.setMonat("");
    if (key === "status") return search.setStatus("");
  };

  return (
    <section aria-labelledby="results-title" className="card-shell flex flex-col">
      <h2 id="results-title" className="sr-only">
        Ratsbeschlüsse und Artikel
      </h2>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="m-0 flex items-center gap-2.5 text-[15px] text-slate-600">
            <span>
              <strong className="font-semibold text-slate-900">{res.loading?'…':n.toLocaleString('de-DE')}</strong> {plural(n, "Eintrag", "Einträge")} gefunden
            </span>
            <span title="Gespeicherte öffentliche Ratsinformationen; keine Vollerhebung" className="rounded-full border border-dashed border-slate-300 px-2 py-px text-[11.5px] font-medium text-slate-500">
              Öffentliche Quellen
            </span>
          </p>
          <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
            <div role="group" aria-label="Nach Status filtern" className="flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-slate-100 p-[3px] [scrollbar-width:none] sm:flex-wrap">
              {[{ id: "" as const, label: "Alle", n: res.statusTotal, dot: "" }, ...STATUS.map((s) => ({ id: s.id, label: s.label, n: res.statusCounts[s.id] || 0, dot: s.dot }))].map(
                (s) => {
                  const on = state.status === s.id;
                  return (
                    <button
                      key={s.id || "all"}
                      type="button"
                      aria-pressed={on}
                      onClick={() => search.setStatus(s.id)}
                      className={`inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[7px] px-[11px] text-[13px] font-medium ${
                        on ? "bg-white text-slate-900 shadow-seg" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {s.dot && <span className={`h-[7px] w-[7px] rounded-full ${s.dot}`} />}
                      {s.label} <span className="text-[11.5px] font-medium text-slate-500">{s.n}</span>
                    </button>
                  );
                },
              )}
            </div>
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
            {savedHit ? (
              <button
                type="button"
                title={`Gespeichert als „${savedHit.name}“, öffnet die gespeicherten Suchen`}
                onClick={() => {
                  setFlashSaved(savedHit.id);
                  openKonto("suchen");
                }}
                className="inline-flex h-9 items-center gap-[7px] whitespace-nowrap rounded-lg border border-teal-200 bg-teal-50 px-3 text-[13px] font-medium text-teal-700"
              >
                <IconBookmark filled className="text-teal-600" />
                Gespeichert
              </button>
            ) : (
              <button
                type="button"
                title="Aktuelle Suche mit allen Filtern speichern"
                onClick={openSaveDialog}
                className="inline-flex h-9 items-center gap-[7px] whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-900 hover:bg-slate-50"
              >
                <IconBookmark className="text-slate-500" />
                Suche speichern
              </button>
            )}
          </div>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={`Filter ${c.label} entfernen`}
                onClick={() => clearChip(c.key)}
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
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3 text-sm"><label>Verwaltungsebene <select aria-label="Verwaltungsebene" className="select-base ml-2" value={state.level} onChange={e=>search.setLevel(e.target.value as 'city'|'district')}><option value="city">Städte & Gemeinden</option><option value="district">Kreise</option></select></label><span className="text-slate-500">{res.coverage.length} Gebiete mit Bestand · {res.coverage.filter(c=>!c.complete).length} Teilstände</span><a href="/quellen" className="link-btn">Quellenabdeckung</a></div>
      {res.error&&<div role="alert" className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-4">{res.error} <button className="link-btn" onClick={res.retry}>Erneut laden</button></div>}
      <div className="relative">
        <div className={`pointer-events-none absolute left-0 right-3 top-0 z-[2] h-7 bg-gradient-to-b from-white to-white/0 transition-opacity ${fade.top ? "opacity-100" : "opacity-0"}`} />
        <div className={`pointer-events-none absolute bottom-0 left-0 right-3 z-[2] h-7 bg-gradient-to-t from-white to-white/0 transition-opacity ${fade.bottom ? "opacity-100" : "opacity-0"}`} />
        <div
          ref={listRef}
          aria-label="Ergebnisliste"
          onScroll={updateFades}
          onMouseLeave={() => onHover("")}
          className="scroll-thin flex max-h-[clamp(380px,72vh,720px)] flex-col gap-3 overflow-y-auto overscroll-contain scroll-smooth py-3 pl-3 pr-1.5 outline-none [scrollbar-gutter:stable] sm:max-h-[clamp(420px,66vh,820px)] sm:py-4 sm:pl-5 sm:pr-2"
        >
          {!articlesReady && <div className="p-8 text-center text-[13px] text-slate-500">Einträge werden geladen …</div>}
          {res.results.map((a, i) => (
            <ArticleCard
              key={a.id}
              article={a}
              index={i}
              terms={res.terms}
              gemeindeActive={state.area === a.ags}
              themaActive={state.thema === a.thema}
              onOpen={onOpen}
              onGemeinde={onGemeinde}
              onThema={onThema}
              onHover={onHover}
            />
          ))}
          {articlesReady && !res.error && n === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-slate-600">
              <div className="mb-1.5 grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
                <IconEmptySearch size={22} />
              </div>
              <h3 className="m-0 text-base text-slate-900">Keine Vorgänge gefunden{emptyWhere}</h3>
              <p className="m-0 text-sm">Für diese Kombination aus Gebiet, Suchbegriff und Filtern gibt es keine Einträge.</p>
              <button type="button" onClick={search.resetAll} className="btn-primary mt-2.5">
                Alle Filter zurücksetzen
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Zum Anfang der Liste"
          tabIndex={-1}
          onClick={() => listRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className={`absolute bottom-4 right-6 z-[3] grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-card transition-[opacity,transform] hover:bg-slate-50 hover:text-slate-900 ${
            fade.toTop ? "opacity-100" : "pointer-events-none translate-y-1.5 opacity-0"
          }`}
        >
          <IconArrowUp size={18} />
        </button>
      </div>
      <nav aria-label="Ergebnisseiten" className="flex items-center justify-between gap-3 border-t border-slate-200 p-4"><button className="btn-secondary" disabled={res.loading||res.page<=1} onClick={()=>res.setPage(res.page-1)}>Zurück</button><span className="text-sm text-slate-500">Seite {res.page} von {Math.max(1,Math.ceil(res.total/30))}</span><button className="btn-secondary" disabled={res.loading||res.page*30>=res.total} onClick={()=>res.setPage(res.page+1)}>Weiter</button></nav>
    </section>
  );
}
