import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { Befund, zuThema } from "./Befund";
import { Reveal } from "./Reveal";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";

interface Program { name: string; other: boolean; granted: number; applied: number; mentioned: number; n: number; regions: number }
interface Region { id: string; name: string; pop: number; cards: number; granted: number; applied: number; per10k: number; grantedPer10k: number; programs: { name: string; n: number }[] }
interface Result {
  q: string;
  totals: { topics: number; granted: number; applied: number; regions: number; ranked: number; cards: number };
  programs: Program[];
  months: { m: string; granted: number; applied: number; mentioned: number }[];
  labels: { id: string; name: string; n: number; share: number | null }[];
  ranking: Region[];
  rule: { minCards: number; minPop: number; minTopics: number };
}

const n = (v: number) => v.toLocaleString("de-DE");
const C = { granted: "#0d9488", applied: "#5eead4", mentioned: "#e2e8f0" };
const MONTH = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });

/** plenara.X – Förderradar: Förderprogramme in den Ratsunterlagen, beantragt und bewilligt, je Gebiet und Monat */
export function FoerderradarPage() {
  const { query } = useAnalyticsQuery();
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [want, setWant] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!want) return;
    setWant(false);
    setError("");
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    fetch(`/api/analytics/foerderung?${query}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(body.error || "Die Auswertung konnte nicht berechnet werden.");
        return body as unknown as Result;
      })
      .then((r) => { setRes(r); setRanKey(query); setLoading(false); })
      .catch((e) => { if (ctrl.signal.aborted) return; setError(e.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);
  useEffect(() => () => abortRef.current?.abort(), []);
  const stale = !!res && ranKey !== query && !loading;

  const programs = res?.programs ?? [];
  const named = programs.filter((p) => !p.other);
  const maxP = Math.max(1, ...programs.map((p) => p.n));
  const maxM = Math.max(1, ...(res?.months ?? []).map((m) => m.granted + m.applied));
  const maxR = Math.max(1, ...(res?.ranking ?? []).map((r) => r.per10k));
  const legend = (
    <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-700">
      {([["bewilligt", C.granted], ["beantragt", C.applied], ["nur erwähnt", C.mentioned]] as const).map(([l, c]) => <li key={l} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />{l}</li>)}
    </ul>
  );

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
        <p className="text-[14px] text-slate-500"><Link href="/analytics/radar" className="text-teal-600">plenara.X Radar</Link> / Förderradar</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Förderradar</h1>
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Welche Förderprogramme in den Ratsunterlagen auftauchen, wo sie beantragt und wo bewilligt werden.</p>
      </PageBand>

      <div className="print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && setWant(true)} onSubmit={() => setWant(true)} startLabel="Auswerten" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu auswerten.</p>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {res.totals.topics === 0 ? <p className="mt-10 text-[16px]">Für diese Suche ist keine Förderung in den Unterlagen erkannt.</p> : (
            <>
              <Befund>{`${zuThema(res.q)[0].toUpperCase()}${zuThema(res.q).slice(1)} nennen ${n(res.totals.topics)} Vorgänge Fördergeld, ${n(res.totals.granted)} davon bewilligt und ${n(res.totals.applied)} beantragt.${named[0] ? ` Am häufigsten: ${named[0].name}.` : ""}`}</Befund>
              <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                {[
                  ["Vorgänge mit Förderung", n(res.totals.topics)],
                  ["Bewilligt", n(res.totals.granted)],
                  ["Beantragt", n(res.totals.applied)],
                  ["Gebiete", n(res.totals.regions)],
                ].map(([k, v], i) => (
                  <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Förderprogramme</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Vorgänge je Programm und in wie vielen Gebieten. Ein Vorgang kann mehrere Programme nennen.</p>
                {legend}
                <ol className="m-0 list-none border-t border-slate-200 p-0">
                  {programs.map((p) => (
                    <li key={p.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-200 py-3 sm:grid-cols-[280px_minmax(0,1fr)_170px]">
                      <span className={`truncate text-[16px] ${p.other ? "text-slate-500" : ""}`}>{p.name}</span>
                      <span className="order-3 col-span-2 flex h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1" role="img" aria-label={`${p.name}: ${p.granted} bewilligt, ${p.applied} beantragt, ${p.mentioned} erwähnt`}>
                        <span style={{ width: `${(p.granted / maxP) * 100}%`, background: C.granted }} />
                        <span style={{ width: `${(p.applied / maxP) * 100}%`, background: C.applied }} />
                        <span style={{ width: `${(p.mentioned / maxP) * 100}%`, background: C.mentioned }} />
                      </span>
                      <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{n(p.n)}</b><span className="ml-2 text-slate-500">{n(p.regions)} Gebiete</span></span>
                    </li>
                  ))}
                </ol>
              </section></Reveal>

              {res.months.length > 1 && (
                <Reveal><section className="mt-12">
                  <h2 className="text-[22px] font-semibold">Im Zeitverlauf</h2>
                  <p className="mb-3 mt-1 text-[14px] text-slate-500">Vorgänge mit bewilligter oder beantragter Förderung je Monat der Sitzung.</p>
                  <div className="flex h-[160px] items-end gap-1.5 border-b border-slate-200" role="img" aria-label="Förderung je Monat">
                    {res.months.map((m) => (
                      <div key={m.m} className="flex min-w-0 flex-1 flex-col items-center justify-end" title={`${m.m}: ${m.granted} bewilligt, ${m.applied} beantragt`}>
                        <span className="w-full max-w-[36px] rounded-t-sm" style={{ height: `${(m.applied / maxM) * 140}px`, background: C.applied }} />
                        <span className="w-full max-w-[36px]" style={{ height: `${(m.granted / maxM) * 140}px`, background: C.granted }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex gap-1.5 text-[12px] text-slate-500">{res.months.map((m) => <span key={m.m} className="min-w-0 flex-1 truncate text-center">{MONTH.format(new Date(m.m + "-01"))}</span>)}</div>
                </section></Reveal>
              )}

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Gebiete mit vielen geförderten Vorhaben</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Vorgänge mit bewilligter oder beantragter Förderung je 10.000 Einwohner. Nur Gebiete ab {n(res.rule.minPop)} Einwohnern mit mindestens {n(res.rule.minCards)} Einträgen und {res.rule.minTopics} Vorgängen mit Förderung im Zeitraum ({n(res.totals.ranked)} Gebiete). Gezählt wird, wie oft Förderung in den Ratsunterlagen auftaucht, nicht die Höhe der Mittel.</p>
                {res.ranking.length === 0 ? <p className="text-[14px] text-slate-500">Zu wenige Gebiete für einen Vergleich.</p> : (
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {res.ranking.map((r, i) => (
                      <li key={r.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-200 py-3 sm:grid-cols-[28px_280px_minmax(0,1fr)_200px]">
                        <span className="text-[14px] tabular-nums text-slate-500">{i + 1}</span>
                        <span className="min-w-0"><span className="block truncate text-[16px]">{r.name}</span><span className="block truncate text-[12px] text-slate-500">{r.programs.map((p) => p.name).join(", ")}</span></span>
                        <span className="order-4 col-span-3 mt-1.5 flex h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1 sm:mt-0">
                          <span style={{ width: `${(r.grantedPer10k / maxR) * 100}%`, background: C.granted }} />
                          <span style={{ width: `${((r.per10k - r.grantedPer10k) / maxR) * 100}%`, background: C.applied }} />
                        </span>
                        <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{r.per10k.toLocaleString("de-DE")}</b><span className="ml-2 text-slate-500">{n(r.granted)} bew. · {n(r.applied)} beantr.</span></span>
                      </li>
                    ))}
                  </ol>
                )}
              </section></Reveal>

              {res.labels.length > 0 && (
                <Reveal><section className="mt-12">
                  <h2 className="text-[22px] font-semibold">Wofür gefördert wird</h2>
                  <p className="mb-3 mt-1 text-[14px] text-slate-500">Themenfelder der Vorgänge mit bewilligter oder beantragter Förderung.</p>
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {res.labels.slice(0, 10).map((l) => (
                      <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-200 py-3 sm:grid-cols-[280px_minmax(0,1fr)_120px]">
                        <span className="truncate text-[16px]">{l.name}</span>
                        <span className="order-3 col-span-2 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${l.share ?? 0}%` }} /></span>
                        <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{(l.share ?? 0).toLocaleString("de-DE")} %</b><span className="ml-2 text-slate-500">{n(l.n)}</span></span>
                      </li>
                    ))}
                  </ol>
                </section></Reveal>
              )}

              <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Gelesen werden Sätze im Volltext der Hauptdokumente, die von Fördergeld sprechen (Fördermittel, Förderbescheid, Zuwendung, Bundes- oder Landesmittel); daraus Programm und Stand (bewilligt, beantragt). Sammelberichte wie Mitteilungen, Haushalt oder Sachstände zählen nicht. Volltexte liegen nicht für alle Gebiete gleich vollständig vor. <Link href="/analytics/ueber#methodik" className="text-teal-600">Methode →</Link></p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
