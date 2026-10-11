import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { Befund, zuThema } from "./Befund";
import { Reveal } from "./Reveal";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";

interface Plan { id: string; title: string; region: string; date: string; stage: string; type: string; we: number | null }
interface Region { id: string; name: string; pop: number | null; plans: number; adopted: number; started: number; we: number; weKnown: number; plansPer10k: number | null; wePer1k: number | null }
interface Result {
  q: string;
  totals: { topics: number; plans: number; adopted: number; regions: number; we: number; weKnown: number };
  plansByStage: { name: string; n: number }[];
  months: { m: string; Aufstellung: number; Offenlage: number; Satzungsbeschluss: number }[];
  regions: Region[]; housingRegions: Region[]; housingPlans: Plan[]; adopted: Plan[];
  rule: { minPop: number; minPlans: number };
}

const n = (v: number) => v.toLocaleString("de-DE");
const DAY = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "2-digit" });
const MONTH = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });
/* Verfahrensschritte von hell nach kräftig; Aufhebung und Unklares grau */
const STEP_COLOR: Record<string, string> = { Aufstellung: "#ccfbf1", "Frühzeitige Beteiligung": "#99f6e4", Offenlage: "#5eead4", Abwägung: "#2dd4bf", Satzungsbeschluss: "#0d9488", Aufhebung: "#94a3b8", "Sonstiger Schritt": "#e2e8f0" };

function PlanRow({ p, right }: { p: Plan; right: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-3">
      <a href={`/beschluss/${p.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-700">
        <span className="block truncate text-[16px]">{p.title}</span>
        <span className="block truncate text-[12px] text-slate-500">{p.region} · {p.stage} · {DAY.format(new Date(p.date))}</span>
      </a>
      <span className="self-center text-right text-[14px] font-semibold tabular-nums">{right}</span>
    </li>
  );
}

/** plenara.X – Bauleitplanung: Pläne nach Verfahrensschritt, Gebiete mit viel Planung, geplanter Wohnungsbau */
export function BauleitplanungPage() {
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
    fetch(`/api/analytics/bauleitplanung?${query}`, { signal: ctrl.signal })
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

  const stages = res?.plansByStage ?? [];
  const maxS = Math.max(1, ...stages.map((s) => s.n));
  const maxM = Math.max(1, ...(res?.months ?? []).map((m) => Math.max(m.Aufstellung, m.Offenlage, m.Satzungsbeschluss)));
  const maxR = Math.max(1, ...(res?.regions ?? []).map((r) => r.plansPer10k ?? 0));

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
        <p className="text-[14px] text-slate-500"><Link href="/analytics/radar" className="text-teal-600">plenara.X Radar</Link> / Bauleitplanung</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Bauleitplanung</h1>
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Welche Bebauungs- und Flächennutzungspläne in welchem Verfahrensschritt sind, wo viel geplant wird und wie viele Wohnungen entstehen sollen.</p>
      </PageBand>

      <div className="print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && setWant(true)} onSubmit={() => setWant(true)} startLabel="Auswerten" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu auswerten.</p>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {res.totals.plans === 0 ? <p className="mt-10 text-[16px]">Für diese Suche ist kein Bauleitplan erkannt.</p> : (
            <>
              <Befund>{`${zuThema(res.q)[0].toUpperCase()}${zuThema(res.q).slice(1)} sind ${n(res.totals.plans)} Bauleitpläne in ${n(res.totals.regions)} Gebieten in Arbeit, ${n(res.totals.adopted)} davon mit Satzungsbeschluss.${res.totals.we ? ` Genannt sind ${n(res.totals.we)} geplante Wohneinheiten.` : ""}`}</Befund>
              <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                {[["Pläne", n(res.totals.plans)], ["Satzungsbeschlüsse", n(res.totals.adopted)], ["Gebiete", n(res.totals.regions)], ["Geplante Wohneinheiten", n(res.totals.we)]].map(([k, v], i) => (
                  <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Pläne nach Verfahrensschritt</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Jeder Plan einmal, mit dem weitesten Schritt im Zeitraum. Ein Plan läuft meist über mehrere Sitzungen und Gremien.</p>
                <ol className="m-0 list-none border-t border-slate-200 p-0">
                  {stages.filter((s) => s.n > 0).map((s) => (
                    <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-200 py-3 sm:grid-cols-[240px_minmax(0,1fr)_100px]">
                      <span className="flex items-center gap-2 truncate text-[16px]"><i className="inline-block h-3 w-3 flex-none rounded-sm" style={{ background: STEP_COLOR[s.name] }} />{s.name}</span>
                      <span className="order-3 col-span-2 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className="block h-full rounded-full" style={{ width: `${(s.n / maxS) * 100}%`, background: STEP_COLOR[s.name] }} /></span>
                      <span className="text-right text-[14px] font-semibold tabular-nums">{n(s.n)}</span>
                    </li>
                  ))}
                </ol>
              </section></Reveal>

              {res.months.length > 1 && (
                <Reveal><section className="mt-12">
                  <h2 className="text-[22px] font-semibold">Im Zeitverlauf</h2>
                  <p className="mb-3 mt-1 text-[14px] text-slate-500">Aufstellungen, Offenlagen und Satzungsbeschlüsse je Monat der Sitzung.</p>
                  <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-700">
                    {(["Aufstellung", "Offenlage", "Satzungsbeschluss"] as const).map((k) => <li key={k} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: STEP_COLOR[k] }} />{k}</li>)}
                  </ul>
                  <div className="flex h-[160px] items-end gap-2 border-b border-slate-200" role="img" aria-label="Verfahrensschritte je Monat">
                    {res.months.map((m) => (
                      <div key={m.m} className="flex min-w-0 flex-1 items-end justify-center gap-[2px]" title={`${m.m}: ${m.Aufstellung} Aufstellungen, ${m.Offenlage} Offenlagen, ${m.Satzungsbeschluss} Satzungsbeschlüsse`}>
                        {(["Aufstellung", "Offenlage", "Satzungsbeschluss"] as const).map((k) => <span key={k} className="w-full max-w-[14px] rounded-t-sm" style={{ height: `${(m[k] / maxM) * 150}px`, background: STEP_COLOR[k] }} />)}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex gap-2 text-[12px] text-slate-500">{res.months.map((m) => <span key={m.m} className="min-w-0 flex-1 truncate text-center">{MONTH.format(new Date(m.m + "-01"))}</span>)}</div>
                </section></Reveal>
              )}

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Gebiete mit viel Planung</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Pläne je 10.000 Einwohner; nur Gebiete ab {n(res.rule.minPop)} Einwohnern mit mindestens {res.rule.minPlans} Plänen.</p>
                {res.regions.length === 0 ? <p className="text-[14px] text-slate-500">Zu wenige Gebiete für einen Vergleich.</p> : (
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {res.regions.map((r, i) => (
                      <li key={r.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-200 py-3 sm:grid-cols-[28px_280px_minmax(0,1fr)_190px]">
                        <span className="text-[14px] tabular-nums text-slate-500">{i + 1}</span>
                        <span className="truncate text-[16px]">{r.name}</span>
                        <span className="order-4 col-span-3 mt-1.5 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1 sm:mt-0"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${((r.plansPer10k ?? 0) / maxR) * 100}%` }} /></span>
                        <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{(r.plansPer10k ?? 0).toLocaleString("de-DE")}</b><span className="ml-2 text-slate-500">{n(r.plans)} Pläne · {n(r.adopted)} beschl.</span></span>
                      </li>
                    ))}
                  </ol>
                )}
              </section></Reveal>

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Geplanter Wohnungsbau</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Pläne mit den meisten genannten Wohneinheiten. Die Zahl steht nur bei {n(res.totals.weKnown)} Plänen im Hauptdokument, oft erst in der Begründung; die Summe ist deshalb eine Untergrenze.</p>
                {res.housingPlans.length === 0 ? <p className="text-[14px] text-slate-500">Keine Wohneinheiten genannt.</p> : (
                  <div className="grid gap-x-12 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <ol className="m-0 list-none border-t border-slate-200 p-0">{res.housingPlans.map((p) => <PlanRow key={p.id} p={p} right={`${n(p.we ?? 0)} WE`} />)}</ol>
                    <div className="mt-8 md:mt-0">
                      <h3 className="text-[16px] font-semibold">Nach Gebiet</h3>
                      <ol className="m-0 mt-2 list-none border-t border-slate-200 p-0">
                        {res.housingRegions.map((r) => <li key={r.id} className="flex justify-between gap-3 border-b border-slate-200 py-2 text-[14px]"><span className="truncate">{r.name}</span><span className="tabular-nums"><b className="font-semibold">{n(r.we)}</b>{r.wePer1k !== null && <span className="ml-2 text-slate-500">{r.wePer1k.toLocaleString("de-DE")} je 1.000 EW</span>}</span></li>)}
                      </ol>
                    </div>
                  </div>
                )}
              </section></Reveal>

              {res.adopted.length > 0 && (
                <Reveal><section className="mt-12">
                  <h2 className="text-[22px] font-semibold">Jüngste Satzungsbeschlüsse</h2>
                  <ol className="m-0 mt-3 list-none border-t border-slate-200 p-0">{res.adopted.map((p) => <PlanRow key={p.id} p={p} right={p.type === "Flächennutzungsplan" ? "FNP" : "B-Plan"} />)}</ol>
                </section></Reveal>
              )}

              <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Plan und Verfahrensschritt stammen aus dem Titel, sonst aus dem Beschlussvorschlag (nicht aus Verfahrensübersichten mit früheren Schritten). Bauanträge im Plangebiet, Stellungnahmen zu Plänen der Nachbargemeinden und Sammelberichte zählen nicht. Ein Plan wird je Gebiet über Nummer oder Namen zusammengefasst. <Link href="/analytics/ueber#methodik" className="text-teal-600">Methode →</Link></p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
