import { useCallback, useEffect, useRef, useState } from "react";
import { filterChips } from "../../lib/savedSearch";
import { useData } from "../../state/data";
import { overviewScroll, useAppNav } from "../../state/nav";
import { useSearch, useSearchResults } from "../../state/search";
import type { Article } from "../../types";
import { IconArrowUp, IconEmptySearch } from "../icons";
import { ArticleCard } from "./ArticleCard";
import { useEntitlements } from "../../lib/entitlements";

export function ResultsPanel() {
  const { geo } = useData();
  const search = useSearch();
  const { state, mapRef } = search;
  const res = useSearchResults();
  const articlesReady=!res.loading;
  const { push } = useAppNav();
  const { allowFeature, limits } = useEntitlements();
  const pages = Math.max(1, Math.ceil(res.total / 20));
  /* Gäste sehen nur die erste Seite; Blättern öffnet den Hinweis zur Anmeldung */
  const goPage = (p: number) => {
    if (p > 1 && !allowFeature("results", res.total)) return;
    res.setPage(p);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const onGemeinde = useCallback(
    (a: Article) => (state.area === a.ags ? search.setArea("", "ui") : search.setArea(a.ags, "ui", { zoom: true })),
    [search, state.area],
  );
  const onThema = useCallback((a: Article) => search.setThema(state.thema === a.thema ? "" : a.thema), [search, state.thema]);
  const onHover = useCallback((ags: string) => mapRef.current?.setExternalHover(ags), [mapRef]);

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
          className={`flex flex-col gap-[0.3vw] p-[0.3vw] outline-none transition-opacity ${articlesReady?"":"opacity-50"}`}
        >
          {!articlesReady && res.results.length===0 && <div className="p-8 text-center text-[13px] text-slate-500">Einträge werden geladen …</div>}
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
      {/* Paginierung mittig: „Zurück“ erst ab Seite 2, „Weiter“ nur wenn es weitere Treffer gibt */}
      <nav aria-label="Ergebnisseiten" className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 p-2">
        {res.page > 1 && (
          <button className="btn-secondary" disabled={res.loading} onClick={() => goPage(res.page - 1)}>
            Zurück
          </button>
        )}
        <span className="text-sm text-slate-500">
          {active ? `${res.total.toLocaleString("de-DE")} Treffer · Seite ${res.page} von ${pages}` : `Seite ${res.page}`}
        </span>
        {res.page < pages && (
          <button className="btn-secondary" disabled={res.loading} onClick={() => goPage(res.page + 1)}>
            Weiter
          </button>
        )}
      </nav>
    </section>
  );
}
