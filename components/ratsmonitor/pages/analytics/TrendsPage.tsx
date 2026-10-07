import Link from "next/link";
import { PageBand } from "./PageBand";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DiffusionSearch } from "./DiffusionSearch";
import { Spark, TrendMap, type Trend, type TrendKind } from "./TrendViews";
import { useAnalyticsQuery } from "./useAnalyticsQuery";

interface Topic { id: string; name: string; recent: number; prev: number; change: number; n: number }
interface Result {
  q: string;
  window: number;
  ranges: { prevStart: string; start: string; end: string };
  weeks: number;
  totals: { recent: number; prev: number; sampledRecent: number; sampledPrev: number; capped: boolean; regions: number };
  rising: Trend[];
  emerging: Trend[];
  falling: Trend[];
  topics: Topic[];
  all: Trend[];
}

const WINDOWS = [[30, "30 Tage"], [90, "90 Tage"], [180, "180 Tage"]] as const;
const EXAMPLES = ["Wärmeplanung", "Photovoltaik", "Radverkehr", "Schule", "Digitalisierung"];
const TABS: { id: "rising" | "emerging" | "falling"; label: string; hint: string }[] = [
  { id: "rising", label: "Aufsteigend", hint: "Deutlich häufiger als im Zeitraum davor" },
  { id: "emerging", label: "Neu aufgekommen", hint: "Davor kaum vorhanden, jetzt in mehreren Gebieten" },
  { id: "falling", label: "Absteigend", hint: "Deutlich seltener als im Zeitraum davor" },
];
const n = (v: number) => v.toLocaleString("de-DE");
const d = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}`;
const fmtRatio = (t: Trend) => (t.np === 0 ? "neu" : t.ratio >= 1 ? `×${t.ratio.toLocaleString("de-DE", { maximumFractionDigits: 1 })}` : `÷${(1 / t.ratio).toLocaleString("de-DE", { maximumFractionDigits: 1 })}`);

export function TrendsPage() {
  const params = useSearchParams();
  const { query, hasTerm, search } = useAnalyticsQuery();
  const [days, setDays] = useState<number>(90);
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const given = useRef(params.get("thema"));
  const [want, setWant] = useState(!given.current);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"rising" | "emerging" | "falling">("rising");
  const [picked, setPicked] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!given.current) return;
    search.applySearch(given.current);
    given.current = null;
    setWant(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Ohne Begriff gilt die ganze Auswahl; mit Begriff nur dessen Einträge. Bei einem Beispiel wartet der Start auf den Begriff. */
  const key = `${query}&window=${days}`;
  useEffect(() => {
    if (!want) return;
    setWant(false);
    setError("");
    setLoading(true);
    setPicked("");
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    fetch(`/api/analytics/trends?${key}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(body.error || "Die Analyse konnte nicht berechnet werden.");
        return body as unknown as Result;
      })
      .then((r) => { setRes(r); setRanKey(key); setLoading(false); setTab(r.rising.length ? "rising" : r.emerging.length ? "emerging" : "falling"); })
      .catch((e) => { if (ctrl.signal.aborted) return; setError(e.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const stale = !!res && ranKey !== key && !loading;
  const onPlay = () => { if (!loading) setWant(true); };
  const pickDays = (v: number) => { setDays(v); setWant(true); };

  const items = useMemo(() => {
    if (!res) return [] as (Trend & { kind: TrendKind })[];
    const kinds = new Map<string, TrendKind>();
    for (const t of res.rising) kinds.set(t.term, "rising");
    for (const t of res.emerging) kinds.set(t.term, "emerging");
    for (const t of res.falling) kinds.set(t.term, "falling");
    const seen = new Map<string, Trend & { kind: TrendKind }>();
    for (const t of [...res.all, ...res.rising, ...res.emerging, ...res.falling]) if (!seen.has(t.term)) seen.set(t.term, { ...t, kind: kinds.get(t.term) ?? "steady" });
    return [...seen.values()].filter((t) => t.nr >= 5);
  }, [res]);
  const list = res ? res[tab] : [];
  const delta = res && res.totals.prev ? Math.round(((res.totals.recent - res.totals.prev) / res.totals.prev) * 100) : null;
  const maxTopic = res ? Math.max(0.01, ...res.topics.map((t) => Math.abs(t.change))) : 1;

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
      <p className="text-[14px] text-slate-500"><Link href="/analytics/ueber" className="text-teal-600">Plenara.X</Link> / Trends und Frühindikatoren</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Trends und Frühindikatoren</h1>
      <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Zeigt, welche Begriffe in den Räten gerade aufkommen, zunehmen oder verschwinden. Verglichen wird der aktuelle Zeitraum mit dem gleich langen davor.</p>
      </PageBand>

      <div><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={onPlay} onSubmit={() => setWant(true)} startLabel="Trends berechnen" /></div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
        <span className="text-slate-500">Zeitraum:</span>
        <div role="radiogroup" aria-label="Zeitraum" className="flex gap-1">
          {WINDOWS.map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={days === v} onClick={() => pickDays(v)} className={`h-8 rounded-full border px-3.5 ${days === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{l}</button>
          ))}
        </div>
        {!hasTerm && !res && <span className="text-slate-500">Beispiele:</span>}
        {!res && EXAMPLES.map((x) => <button key={x} type="button" onClick={() => { search.applySearch(x); setWant(true); }} className="text-teal-600">{x}</button>)}
      </div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu berechnen.</p>}
      {loading && !res && <p className="mt-8 text-[16px] text-slate-500">Trends werden berechnet …</p>}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
            {[
              ["Aktueller Zeitraum", `${d(res.ranges.start)} bis ${d(res.ranges.end)}`],
              ["Einträge jetzt", n(res.totals.recent)],
              ["Einträge davor", n(res.totals.prev)],
              ["Veränderung", delta === null ? "–" : `${delta > 0 ? "+" : ""}${delta} %`],
            ].map(([k, v], i) => (
              <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
            ))}
          </dl>

          {res.totals.recent === 0 ? <p className="mt-10 text-[16px]">Keine Einträge für diese Suche im Zeitraum.</p> : (
            <>
              <section className="mt-12">
                <h2 className="text-[22px] font-semibold">Trendkarte</h2>
                <p className="mb-4 mt-1 text-[14px] text-slate-500">Jeder Punkt ist ein Begriff: rechts häufiger, oben stärker gewachsen. Die Größe zeigt, in wie vielen Gebieten er vorkommt. Oben links liegen Frühindikatoren: wenig, aber schnell wachsend.</p>
                <TrendMap items={items} selected={picked} onSelect={setPicked} />
                <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-700">
                  {([["#0d9488", "aufsteigend"], ["#0f766e", "neu"], ["#94a3b8", "absteigend"], ["#cbd5e1", "unauffällig"]] as const).map(([c, l]) => <li key={l} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-full" style={{ background: c }} />{l}</li>)}
                </ul>
              </section>

              <section className="mt-12">
                <div role="tablist" aria-label="Trendart" className="flex gap-6 border-b border-slate-200">
                  {TABS.map((t) => (
                    <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`-mb-px border-b-2 pb-3 text-[16px] ${tab === t.id ? "border-teal-600 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
                      {t.label} <span className="text-[14px] font-normal text-slate-500">{res[t.id].length}</span>
                    </button>
                  ))}
                </div>
                <p className="mb-3 mt-3 text-[14px] text-slate-500">{TABS.find((t) => t.id === tab)!.hint}. Die Kurve zeigt den wöchentlichen Anteil (links der Zeitraum davor, rechts der aktuelle).</p>
                {list.length === 0 ? <p className="py-6 text-[16px] text-slate-500">Keine auffälligen Begriffe in dieser Auswahl.</p> : (
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {list.map((t, i) => (
                      <li key={t.term} className={`border-b border-slate-200 ${picked === t.term ? "bg-slate-50" : ""}`}>
                        <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3 max-sm:grid-cols-[24px_1fr] sm:grid-cols-[28px_1fr_130px_250px]">
                          <span className="text-[14px] tabular-nums text-slate-500">{i + 1}</span>
                          <button type="button" onClick={() => setPicked(picked === t.term ? "" : t.term)} className="min-w-0 text-left">
                            <span className="block truncate text-[16px] text-slate-900">{t.term}</span>
                            <span className="block text-[12px] text-slate-500">{n(t.np)} → {n(t.nr)} Einträge · {n(t.regions)} {t.regions === 1 ? "Gebiet" : "Gebiete"}{t.regionsPrev ? ` (vorher ${n(t.regionsPrev)})` : ""}</span>
                          </button>
                          <span className="max-sm:hidden"><Spark series={t.series} kind={tab} /></span>
                          <span className="flex items-baseline justify-between gap-3 text-right max-sm:col-span-2 max-sm:pl-9">
                            <b className="text-[16px] font-semibold tabular-nums">{fmtRatio(t)}</b>
                            <span className="flex gap-3 text-[14px]"><Link href={`/analytics/diffusion?thema=${encodeURIComponent(t.term)}`} className="text-teal-600">Ausbreitung</Link><Link href={`/analytics/graph?thema=${encodeURIComponent(t.term)}`} className="text-teal-600">Netz</Link></span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="mt-12">
                <h2 className="text-[22px] font-semibold">Themenfelder</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Veränderung des Anteils der Einträge je Themenfeld in Prozentpunkten.</p>
                <ol className="m-0 list-none border-t border-slate-200 p-0">
                  {res.topics.map((t) => (
                    <li key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-200 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[16px] text-slate-900">{t.name}</span>
                        <span className="mt-1.5 flex h-[3px] items-center rounded-full bg-slate-100"><span className="relative block h-full w-full"><span className={`absolute top-0 block h-full rounded-full ${t.change >= 0 ? "bg-teal-600" : "bg-slate-400"}`} style={{ width: `${Math.max(2, (Math.abs(t.change) / maxTopic) * 50)}%`, ...(t.change >= 0 ? { left: "50%" } : { right: "50%" }) }} /></span></span>
                      </span>
                      <span className="text-right text-[14px] tabular-nums"><b className="font-semibold text-slate-900">{t.change > 0 ? "+" : ""}{t.change.toLocaleString("de-DE", { maximumFractionDigits: 2 })} PP</b><span className="block text-slate-500">{t.prev.toLocaleString("de-DE")} % → {t.recent.toLocaleString("de-DE")} %</span></span>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
          <p className="mt-10 text-[12px] text-slate-500">Verglichen werden zwei gleich lange Zeiträume ({d(res.ranges.prevStart)} bis {d(res.ranges.start)} und {d(res.ranges.start)} bis {d(res.ranges.end)}). {res.totals.capped ? `Bei großen Auswahlen werden je Zeitraum gleichmäßig rund ${n(res.totals.sampledRecent)} Einträge ausgewertet; ` : ""}Verglichen werden Anteile an allen Einträgen, nicht Rohzahlen. „Aufsteigend“ verlangt mindestens ×1,4 und einen deutlichen Unterschied (z-Wert ab 2,5); „neu“ heißt: davor kaum vorhanden, jetzt in mehreren Gebieten. Begriffe stammen aus den Titeln; Formalien und Füllwörter bleiben außen vor. Ein Trend ist ein Hinweis, keine Entscheidung. <Link href="/analytics/ueber" className="text-teal-600">Methode →</Link></p>
        </div>
      )}
    </main>
  );
}
