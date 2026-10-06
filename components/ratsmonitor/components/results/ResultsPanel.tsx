import { useListView } from "../../lib/listView";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterChips } from "../../lib/savedSearch";
import { useData } from "../../state/data";
import { overviewScroll, useAppNav } from "../../state/nav";
import { useSearch, useSearchResults } from "../../state/search";
import type { Article } from "../../types";
import { IconArrowUp, IconEmptySearch, IconChevronLeft, IconChevronRight } from "../icons";
import { ArticleCard } from "./ArticleCard";
import { useEntitlements } from "../../lib/entitlements";
import { CountDots } from "../CountDots";

/** Beim Blättern: die Zeile mit der Trefferzahl (Suche und Filter) an den oberen Rand direkt unter der angehefteten Kopfzeile, darunter beginnen die Artikel */
function scrollToResultsTop() {
  const row = document.querySelector<HTMLElement>('section[aria-label="Suche und Filter"]');
  if (!row) return;
  const head = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
  window.scrollTo({ top: Math.max(0, row.getBoundingClientRect().top + window.scrollY - head), behavior: "smooth" });
}

export function ResultsPanel() {
  const { geo } = useData();
  const search = useSearch();
  const { state, mapRef } = search;
  const res = useSearchResults();
  const view = useListView();
  const articlesReady=!res.loading;
  const { push } = useAppNav();
  const { allowFeature, limits } = useEntitlements();
  const pages = Math.max(1, Math.ceil(res.total / res.pageSize));
  /* Gleiche Grenze wie der Server (MAX_PAGE in monitor-search.mjs) */
  const MAX_PAGE = 250;
  /* Gäste sehen nur die erste Seite; Blättern öffnet den Hinweis zur Anmeldung */
  const goPage = (p: number) => {
    if (p > 1 && !allowFeature("results", res.total)) return;
    res.setPage(p);
    scrollToResultsTop();
  };
  const pageNow = res.page, setPageNow = res.setPage;
  useEffect(() => {
    if (!Number.isFinite(limits.maxResults) || pageNow <= 1) return;
    setPageNow(1);
  }, [limits.maxResults, pageNow, setPageNow]);
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
  const onHover = useCallback((ags: string) => mapRef.current?.setExternalHover(ags), [mapRef]);
  /* Gleiche Begriffe = gleiches Array, damit die Artikelkarten (memo) nicht neu rendern */
  const termsKey = res.terms.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const terms = useMemo(() => res.terms, [termsKey]);

  const active = filterChips(res.snapshot, geo).length > 0;
  const n = res.total;
  const name = (ags: string) => geo?.info(ags).name ?? ags;
  const emptyWhere = state.radius ? ` im Umkreis von ${state.radius.km} km um ${name(state.radius.ags)}` : state.area ? ` für ${name(state.area)}` : "";

  return (
    <section aria-labelledby="results-title" className="card-shell flex flex-col">
      <h2 id="results-title" className="sr-only">
        Ratsbeschlüsse und Artikel
      </h2>
      {res.error&&<div role="alert" className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-4">{res.error} <button className="link-btn" onClick={res.retry}>Erneut laden</button></div>}
      <div className="relative">
        <div className={`pointer-events-none absolute left-0 right-3 top-0 z-[2] h-7 bg-gradient-to-b from-white to-white/0 transition-opacity ${fade.top ? "opacity-100" : "opacity-0"}`} />
        <div className={`pointer-events-none absolute bottom-0 left-0 right-3 z-[2] h-7 bg-gradient-to-t from-white to-white/0 transition-opacity ${fade.bottom ? "opacity-100" : "opacity-0"}`} />
        <div
          ref={listRef}
          aria-label="Ergebnisliste"
          onScroll={updateFades}
          onMouseLeave={() => onHover("")}
          className={`flex flex-col px-[12px] max-sm:px-1 py-[12px] max-sm:py-0 outline-none transition-opacity ${articlesReady?"":"opacity-50 delay-300"}`}
        >
          {!articlesReady && res.results.length===0 && <ResultsSkeleton />}
          {(Number.isFinite(limits.maxResults) ? res.results.slice(0, limits.maxResults) : res.results).map((a, i) => (
            <ArticleCard
              key={a.id}
              article={a}
              index={i}
              terms={terms}
              onOpen={onOpen}
              onHover={onHover}
              compact={view === "compact"}
            />
          ))}
          {articlesReady && !res.error && !res.totalPending && n === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-slate-600">
              <div className="mb-1.5 grid h-12 w-12 place-items-center text-slate-500">
                <IconEmptySearch size={22} />
              </div>
              <h3 className="m-0 text-[16px] text-slate-900">Keine Vorgänge gefunden{emptyWhere}</h3>
              <p className="m-0 text-[14px]">Für diese Kombination aus Gebiet, Suchbegriff und Filtern gibt es keine Einträge. Versuchen Sie:</p>
              {/* Konkrete nächste Schritte statt nur „zurücksetzen“ */}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[14px]">
                {!search.state.future && !search.state.bis && (
                  <button type="button" onClick={() => search.setFuture(true)} className="text-teal-600 hover:underline">
                    Auch künftige Termine zeigen →
                  </button>
                )}
                {search.state.allterms && (
                  <button type="button" onClick={() => search.setAllterms(false)} className="text-teal-600 hover:underline">
                    Begriffe nicht mehr kombinieren →
                  </button>
                )}
                {search.state.noformal && (
                  <button type="button" onClick={() => search.setNoformal(false)} className="text-teal-600 hover:underline">
                    Formalien wieder zeigen →
                  </button>
                )}
                {search.state.thema && (
                  <button type="button" onClick={() => search.setThema("")} className="text-teal-600 hover:underline">
                    Thema-Filter entfernen →
                  </button>
                )}
                {search.state.status && (
                  <button type="button" onClick={() => search.setStatus("")} className="text-teal-600 hover:underline">
                    Status-Filter entfernen →
                  </button>
                )}
                {search.state.area.length >= 5 && !search.state.radius && (
                  <button type="button" onClick={() => search.setRadiusKm(25)} className="text-teal-600 hover:underline">
                    Umkreis 25 km einbeziehen →
                  </button>
                )}
              </div>
              <button type="button" onClick={search.resetAll} className="mt-2.5 inline-flex h-11 items-center gap-2 rounded-full bg-slate-900 px-5 text-[14px] font-medium text-white hover:opacity-85">
                Alle Filter zurücksetzen →
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
      {/* Paginierung mittig: „Zurück“ erst ab Seite 2, „Weiter“ nur wenn es weitere Treffer gibt */}
      <nav aria-label="Ergebnisseiten" className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 p-2">
        {res.page > 1 && (
          <button type="button" aria-label="Vorherige Seite" title="Vorherige Seite" className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-teal-600 disabled:opacity-40" disabled={res.loading} onClick={() => goPage(res.page - 1)}>
            <IconChevronLeft size={20} />
          </button>
        )}
        <span className="text-[14px] text-slate-500">
          {active ? <>{res.totalPending ? (res.showDots ? <CountDots /> : "…") : res.total.toLocaleString("de-DE")} Treffer · Seite {res.page}{res.totalPending ? "" : ` von ${pages}`}</> : `Seite ${res.page}`}
        </span>
        {res.hasMore && res.page < MAX_PAGE && (
          <button type="button" aria-label="Nächste Seite" title="Nächste Seite" className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-teal-600 disabled:opacity-40" disabled={res.loading} onClick={() => goPage(res.page + 1)}>
            <IconChevronRight size={20} />
          </button>
        )}
        {res.page >= MAX_PAGE && pages > MAX_PAGE && <span className="w-full text-center text-[14px] text-slate-500">Für weitere Treffer bitte die Suche eingrenzen.</span>}
      </nav>
    </section>
  );
}

/** Graue Platzhalterzeilen in der Form der Treffer, solange die ersten Ergebnisse laden (kein Springen beim Eintreffen) */
function ResultsSkeleton() {
  const bar = "rounded bg-slate-100 motion-safe:animate-pulse";
  return (
    <div role="status" aria-live="polite" className="flex flex-col">
      <span className="sr-only">Einträge werden geladen …</span>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} aria-hidden="true" className="grid grid-cols-[44px_minmax(0,1fr)_auto] gap-2.5 border-b border-slate-200 px-3 max-sm:px-2 py-3 last:border-b-0 sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:gap-3 sm:px-3.5 sm:py-4">
          <div className="flex flex-col items-center gap-1.5 border-r border-slate-200 pr-2.5 pt-0.5 sm:pr-3">
            <span className={`${bar} h-[22px] w-7`} />
            <span className={`${bar} h-3 w-8`} />
          </div>
          <div className="min-w-0">
            <span className={`${bar} block h-4 ${i % 2 ? "w-3/5" : "w-4/5"}`} />
            <span className={`${bar} mt-2.5 block h-3 w-2/5`} />
            <span className={`${bar} mt-2 hidden h-3 w-11/12 sm:block`} />
          </div>
          <span className="w-6 sm:w-[56px]" />
        </div>
      ))}
    </div>
  );
}
