import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS } from "../../lib/constants";
import { DEC_COLORS, DecisionRow, MonthColumns, type Cut, type Month } from "./DecisionCharts";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";

interface VRow { id: string; name: string; n: number; vote: number; unanimous: number | null; changeN: number; changed: number | null }
interface Result {
  q: string;
  totals: { all: number; known: number; decided: number; knownShare: number | null };
  status: { id: string; n: number }[];
  rates: { approval: number | null; rejection: number | null; postponement: number | null; open: number };
  months: Month[];
  unclassified: { decided: number };
  topics: Cut[]; kinds: Cut[]; lands: Cut[];
  votes: { sampled: number; of: number; capped: boolean; all: VRow; topics: VRow[]; kinds: VRow[] };
  duration: { n: number; median: number | null; p25: number | null; p75: number | null; p90: number | null; topics: { id: string; name: string; n: number; median: number; p90: number }[] };
}

const STATUS_COLOR: Record<string, string> = { approved: "#0d9488", recommended: "#5eead4", consulting: "#99d6cf", announced: "#cbd5e1", rejected: "#0f172a", postponed: "#94a3b8", info: "#e2e8f0" };
const EXAMPLES = ["Radverkehr", "Haushalt", "Bebauungsplan", "Schule", "Windenergie"];
const n = (v: number) => v.toLocaleString("de-DE");
const pct = (v: number | null) => (v === null ? "–" : `${v.toLocaleString("de-DE")} %`);

export function BeschluessePage() {
  const { query, search } = useAnalyticsQuery();
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [want, setWant] = useState(true);
  const [error, setError] = useState("");
  const [cut, setCut] = useState<"topics" | "kinds" | "lands">("kinds");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!want) return;
    setWant(false);
    setError("");
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    fetch(`/api/analytics/decisions?${query}`, { signal: ctrl.signal })
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

  const statusRows = useMemo(() => (res ? res.status.filter((s) => s.id !== "unknown" && s.n > 0) : []), [res]);
  const statusTotal = statusRows.reduce((a, s) => a + s.n, 0);
  const cuts = res ? res[cut] : [];
  const dmax = res?.duration.p90 ?? 1;

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] py-10 text-slate-900">
      <p className="text-[14px] text-slate-500"><Link href="/analytics/ueber" className="text-teal-600">Plenara.X</Link> / Status und Beschlüsse</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Status und Beschlüsse</h1>
      <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Zeigt, wie Vorgänge stehen und ausgehen: Beschlussquote, Vertagungen und Ablehnungen, wie einig Gremien entscheiden, wie oft Vorlagen geändert werden und wie lange ein Vorgang bis zum Beschluss braucht.</p>

      <div className="mt-6"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && setWant(true)} onSubmit={() => setWant(true)} startLabel="Auswerten" /></div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
        <span className="text-slate-500">Ohne Eingabe gilt der ganze Bestand. Beispiele:</span>
        {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => { search.applySearch(x); setWant(true); }} className="text-teal-600">{x}</button>)}
      </div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu auswerten.</p>}
      {loading && !res && <p className="mt-8 text-[16px] text-slate-500">Auswertung wird berechnet …</p>}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {res.totals.all === 0 ? <p className="mt-10 text-[16px]">Keine Einträge für diese Suche.</p> : (
            <>
              <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                {[
                  ["Beschlussquote", pct(res.rates.approval)],
                  ["Vertagt", pct(res.rates.postponement)],
                  ["Abgelehnt", pct(res.rates.rejection)],
                  ["Entscheidungen", n(res.totals.decided)],
                ].map(([k, v], i) => (
                  <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>
              <p className="mt-4 max-w-[820px] text-[14px] text-slate-500">Die Quoten beziehen sich auf Vorgänge mit Entscheidung (beschlossen, vertagt, abgelehnt). Bei {pct(res.totals.knownShare === null ? null : Math.round((100 - res.totals.knownShare) * 10) / 10)} der {n(res.totals.all)} Einträge ist der Status nicht bekannt; ein Status ist nur bei {n(res.totals.known)} erfasst.</p>

              <section className="mt-12">
                <h2 className="text-[22px] font-semibold">Stand der Vorgänge</h2>
                <p className="mb-4 mt-1 text-[14px] text-slate-500">Alle Einträge mit bekanntem Status.</p>
                <div className="flex h-[16px] w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Stand der Vorgänge">
                  {statusRows.map((s) => <span key={s.id} title={`${STATUS.find((x) => x.id === s.id)?.label ?? s.id}: ${n(s.n)}`} style={{ width: `${(s.n / statusTotal) * 100}%`, background: STATUS_COLOR[s.id] }} />)}
                </div>
                <ul className="m-0 mt-3 grid list-none gap-x-6 gap-y-1 p-0 text-[14px] sm:grid-cols-2 lg:grid-cols-4">
                  {statusRows.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1"><span className="flex items-center gap-2"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: STATUS_COLOR[s.id] }} />{STATUS.find((x) => x.id === s.id)?.label ?? s.id}</span><span className="tabular-nums text-slate-500">{n(s.n)} · {Math.round((s.n / statusTotal) * 100)} %</span></li>)}
                </ul>
              </section>

              <section className="mt-12">
                <h2 className="text-[22px] font-semibold">Entscheidungen im Zeitverlauf</h2>
                <p className="mb-4 mt-1 text-[14px] text-slate-500">Beschlossen, vertagt und abgelehnt je Monat.</p>
                <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-700">
                  {([["beschlossen", DEC_COLORS.approved], ["vertagt", DEC_COLORS.postponed], ["abgelehnt", DEC_COLORS.rejected]] as const).map(([l, c]) => <li key={l} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />{l}</li>)}
                </ul>
                <MonthColumns months={res.months} />
              </section>

              <section className="mt-12">
                <div role="tablist" aria-label="Aufteilung" className="flex gap-6 border-b border-slate-200">
                  {([["kinds", "Gremienebene"], ["topics", "Themenfeld"], ["lands", "Bundesland"]] as const).map(([id, l]) => (
                    <button key={id} type="button" role="tab" aria-selected={cut === id} onClick={() => setCut(id)} className={`-mb-px border-b-2 pb-3 text-[16px] ${cut === id ? "border-teal-600 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{l}</button>
                  ))}
                </div>
                <p className="mb-2 mt-3 text-[14px] text-slate-500">Beschlussquote und Anteil vertagt und abgelehnt{cut === "topics" ? `. Nur ${n(res.totals.decided - res.unclassified.decided)} der ${n(res.totals.decided)} Entscheidungen sind einem Themenfeld zugeordnet.` : cut === "kinds" ? ". Ausschüsse und Ortsgremien empfehlen meist nur, der Rat beschließt: Ihre Quote ist mit der des Rats nicht direkt vergleichbar." : "."}</p>
                {cuts.length === 0 ? <p className="py-4 text-[14px] text-slate-500">Zu wenige Entscheidungen für diese Aufteilung.</p> : <ol className="m-0 list-none border-t border-slate-200 p-0">{cuts.map((c) => <DecisionRow key={c.id} cut={c} />)}</ol>}
              </section>

              <section className="mt-12">
                <h2 className="text-[22px] font-semibold">Abstimmung und Änderungen</h2>
                <p className="mb-4 mt-1 text-[14px] text-slate-500">Aus dem Ergebnistext der Beschlüsse gelesen. Stichprobe von {n(res.votes.sampled)} der {n(res.votes.of)} Vorgänge mit Entscheidung.</p>
                <dl className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                  {[
                    ["Einstimmig", pct(res.votes.all.unanimous)],
                    ["Mehrheitlich", res.votes.all.unanimous === null ? "–" : pct(Math.round((100 - res.votes.all.unanimous) * 10) / 10)],
                    ["Geändert beschlossen", pct(res.votes.all.changed)],
                    ["Mit Angabe zur Abstimmung", n(res.votes.all.vote)],
                  ].map(([k, v], i) => (
                    <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                  ))}
                </dl>
                <div className="mt-8 grid gap-12 md:grid-cols-2">
                  {([["Nach Gremienebene", res.votes.kinds], ["Umstrittenste Themenfelder", res.votes.topics]] as [string, VRow[]][]).map(([title, rows]) => (
                    <div key={title}>
                      <h3 className="text-[16px] font-semibold">{title}</h3>
                      <p className="mb-2 mt-1 text-[12px] text-slate-500">Anteil einstimmiger Beschlüsse (nur mit Angabe zur Abstimmung)</p>
                      <ol className="m-0 list-none border-t border-slate-200 p-0">
                        {rows.filter((r) => r.unanimous !== null).map((r) => (
                          <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-200 py-3">
                            <span className="truncate text-[16px] text-slate-900">{r.name}</span>
                            <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{pct(r.unanimous)}</b><span className="ml-2 text-slate-500">{n(r.vote)}</span></span>
                            <span className="col-span-2 mt-1.5 block h-[4px] overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${r.unanimous}%` }} /></span>
                          </li>
                        ))}
                        {!rows.some((r) => r.unanimous !== null) && <li className="py-3 text-[14px] text-slate-500">Zu wenige Angaben.</li>}
                      </ol>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-12">
                <h2 className="text-[22px] font-semibold">Durchlaufzeit</h2>
                <p className="mb-4 mt-1 text-[14px] text-slate-500">Tage von der ersten Station eines Vorgangs bis zur Entscheidung. Nur Vorgänge mit mindestens zwei datierten Stationen ({n(res.duration.n)} in der Stichprobe).</p>
                {res.duration.median === null ? <p className="text-[14px] text-slate-500">Zu wenige Vorgänge mit mehreren Stationen.</p> : (
                  <>
                    <dl className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                      {[["Mittlere Dauer", `${res.duration.median} Tage`], ["Die Hälfte zwischen", `${res.duration.p25} und ${res.duration.p75} Tagen`], ["Neun von zehn bis", `${res.duration.p90} Tage`], ["Vorgänge", n(res.duration.n)]].map(([k, v], i) => (
                        <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                      ))}
                    </dl>
                    {res.duration.topics.length > 0 && (
                      <ol className="m-0 mt-6 list-none border-t border-slate-200 p-0">
                        {res.duration.topics.map((t) => (
                          <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-200 py-3 sm:grid-cols-[220px_minmax(0,1fr)_150px]">
                            <span className="truncate text-[16px] text-slate-900">{t.name}</span>
                            <span className="relative order-3 col-span-2 block h-[6px] rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className="absolute left-0 top-0 block h-full rounded-full bg-teal-600" style={{ width: `${Math.min(100, (t.median / dmax) * 100)}%` }} /><span className="absolute top-[-3px] block h-[12px] w-px bg-slate-900/70" style={{ left: `${Math.min(100, (t.p90 / dmax) * 100)}%` }} /></span>
                            <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{t.median} Tage</b><span className="ml-2 text-slate-500">{t.n}</span></span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                )}
              </section>
            </>
          )}
          <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Stand der Vorgänge, Verlauf und Aufteilungen zählen alle passenden Einträge genau. Abstimmung, Änderungen und Durchlaufzeit stammen aus einer gleichmäßigen Stichprobe der Vorgänge mit Entscheidung. „Einstimmig“, „mehrheitlich“ und „geändert“ werden aus dem Ergebnistext der Beschlussstation gelesen; fehlt dort die Angabe, zählt der Vorgang nicht mit. Der Status ist nur bei einem Teil der Einträge bekannt, und Ablehnungen sind in den Quellen selten vermerkt; die Quoten sind deshalb ein Anhaltspunkt. Noch offene Vorgänge fehlen in der Durchlaufzeit, die dadurch eher zu kurz ausfällt. <Link href="/analytics/ueber" className="text-teal-600">Methode →</Link></p>
        </div>
      )}
    </main>
  );
}
