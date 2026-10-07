import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCenter, IconMinus, IconPlus } from "../../components/icons";
import { DiffusionSearch } from "./DiffusionSearch";
import { NetView, ROLE, type NEdge, type NNode } from "./NetView";
import { useAnalyticsQuery } from "./useAnalyticsQuery";

interface Result {
  q: string; mode: "types" | "names"; pool: number; examined: number; capped: boolean; paths: number;
  nodes: NNode[]; edges: NEdge[]; routes: { path: string[]; n: number }[];
}
const glass = "rm-glass";
const n = (v: number) => v.toLocaleString("de-DE");
const EXAMPLES = ["Radverkehr", "Haushalt", "Bebauungsplan", "Schule", "Windenergie"];

export function GremiennetzPage() {
  const { query, search } = useAnalyticsQuery();
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [want, setWant] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const zoomRef = useRef<((f: number | "fit") => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!want) return;
    setWant(false);
    setError("");
    setLoading(true);
    setSelected("");
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    fetch(`/api/analytics/network?${query}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(body.error || "Das Netz konnte nicht berechnet werden.");
        return body as unknown as Result;
      })
      .then((r) => { setRes(r); setRanKey(query); setLoading(false); })
      .catch((e) => { if (ctrl.signal.aborted) return; setError(e.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);
  useEffect(() => () => abortRef.current?.abort(), []);
  const stale = !!res && ranKey !== query && !loading;

  const byId = useMemo(() => new Map((res?.nodes ?? []).map((x) => [x.id, x])), [res]);
  const sel = selected ? byId.get(selected) : undefined;
  const around = useMemo(() => {
    if (!res || !selected) return { into: [] as NEdge[], from: [] as NEdge[] };
    return { into: res.edges.filter((e) => e.b === selected).sort((a, b) => b.n - a.n), from: res.edges.filter((e) => e.a === selected).sort((a, b) => b.n - a.n) };
  }, [res, selected]);
  const empty = !!res && (res.paths < 5 || res.edges.length === 0);
  const top = res?.edges[0];
  const lag = useMemo(() => { const d = (res?.edges ?? []).flatMap((e) => (e.days === null ? [] : Array(Math.min(e.n, 50)).fill(e.days))).sort((a: number, b: number) => a - b); return d.length ? d[Math.floor(d.length / 2)] : null; }, [res]);
  const ranked = useMemo(() => [...(res?.nodes ?? [])].sort((a, b) => b.in + b.out - (a.in + a.out)), [res]);
  const maxFlow = ranked[0] ? ranked[0].in + ranked[0].out : 1;
  const maxEdge = res?.edges[0]?.n ?? 1;

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] py-10 text-slate-900">
      <p className="text-[14px] text-slate-500"><Link href="/analytics/ueber" className="text-teal-600">Plenara.X</Link> / Gremiennetz</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Gremiennetz</h1>
      <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Zeigt, welchen Weg Vorgänge durch die Gremien nehmen: wo sie beginnen, welche Gremien dazwischen liegen, wo sie entschieden werden und wie lange der Weg dauert.</p>

      <div className="mt-6"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && setWant(true)} onSubmit={() => setWant(true)} startLabel="Netz berechnen" /></div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
        <span className="text-slate-500">Ohne Eingabe gilt der ganze Bestand; mit genau einem Ort erscheinen dessen echte Gremien. Beispiele:</span>
        {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => { search.applySearch(x); setWant(true); }} className="text-teal-600">{x}</button>)}
      </div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu berechnen.</p>}
      {loading && !res && <p className="mt-8 text-[16px] text-slate-500">Netz wird berechnet …</p>}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {empty ? (
            <p className="mt-10 max-w-[680px] text-[16px]">Für diese Auswahl gibt es zu wenige Vorgänge, die durch mehrere Gremien gelaufen sind ({n(res.paths)} in der Stichprobe). Mit einer weiteren Auswahl, etwa ohne Ort oder mit längerem Zeitraum, wird das Netz aussagekräftiger.</p>
          ) : (
            <>
              <section className="relative mt-8 h-[520px] overflow-hidden rounded-[22px] border border-slate-200 sm:h-[640px]" aria-label="Gremiennetz">
                <NetView nodes={res.nodes} edges={res.edges} selected={selected} onSelect={setSelected} zoomRef={zoomRef} />
                <div className={`${glass} absolute left-3 top-3 z-[6] rounded-2xl px-3 py-2 text-[12px] text-slate-700`}>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {(["start", "bridge", "end"] as const).map((r) => <li key={r} className="flex items-center gap-2" title={ROLE[r].hint}><i className="inline-block h-3 w-3 rounded-full" style={{ background: ROLE[r].fill, border: `2px solid ${ROLE[r].stroke}` }} />{ROLE[r].label}</li>)}
                  </ul>
                  <p className="mt-1.5 text-slate-500">Größe: Durchsatz · Linie: Vorgänge</p>
                </div>
                <div className={`${glass} absolute right-3 top-3 z-[6] flex flex-col overflow-hidden rounded-full`}>
                  <button type="button" title="Vergrößern" aria-label="Vergrößern" onClick={() => zoomRef.current?.(1.3)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-600"><IconPlus size={16} /></button>
                  <button type="button" title="Verkleinern" aria-label="Verkleinern" onClick={() => zoomRef.current?.(1 / 1.3)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-600"><IconMinus size={16} /></button>
                  <button type="button" title="Ganzes Netz zeigen" aria-label="Ganzes Netz zeigen" onClick={() => zoomRef.current?.("fit")} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-600"><IconCenter size={16} /></button>
                </div>
                <div className="pointer-events-none absolute inset-x-16 top-3 z-[6] flex justify-center max-sm:hidden">
                  {!sel && <span className={`${glass} rounded-full px-4 py-2 text-[14px] text-slate-700`}>Von links (Einstieg) nach rechts (Entscheidung) · Gremium anklicken</span>}
                </div>
                {sel && (
                  <div className={`${glass} absolute inset-x-3 bottom-3 z-[6] rounded-[22px] px-5 py-4 sm:inset-x-6`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[12px] text-slate-500">{ROLE[sel.role].label}</p>
                        <p className="text-[18px] font-semibold">{sel.name}</p>
                        <p className="text-[14px] text-slate-700">{n(sel.in)} Vorgänge kommen an, {n(sel.out)} gehen weiter · {n(sel.starts)} beginnen hier, {n(sel.ends)} enden hier</p>
                      </div>
                      <button type="button" onClick={() => setSelected("")} className="text-[14px] text-slate-500 hover:text-slate-900">Schließen</button>
                    </div>
                    <div className="mt-2 grid gap-x-8 gap-y-1 text-[14px] text-slate-500 sm:grid-cols-2">
                      <p className="line-clamp-2">Davor: {around.into.length ? around.into.slice(0, 3).map((e) => `${e.a} (${n(e.n)})`).join(", ") : "–"}</p>
                      <p className="line-clamp-2">Danach: {around.from.length ? around.from.slice(0, 3).map((e) => `${e.b} (${n(e.n)}${e.days !== null ? `, ${e.days} Tage` : ""})`).join(", ") : "–"}</p>
                    </div>
                  </div>
                )}
              </section>

              <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                {[
                  ["Vorgänge mit mehreren Gremien", n(res.paths)],
                  [res.mode === "types" ? "Gremienarten" : "Gremien", n(res.nodes.length)],
                  ["Häufigster Übergang", top ? `${n(top.n)} Vorgänge` : "–"],
                  ["Mittlere Zeit je Übergang", lag === null ? "–" : `${lag} Tage`],
                ].map(([k, v], i) => (
                  <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>

              <div className="mt-12 grid gap-12 lg:grid-cols-2">
                <section>
                  <h2 className="text-[22px] font-semibold">Wichtigste Übergänge</h2>
                  <p className="mb-3 mt-1 text-[14px] text-slate-500">Von welchem Gremium ein Vorgang an welches ging, und wie lange das im Mittel dauerte.</p>
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {res.edges.slice(0, 12).map((e) => (
                      <li key={e.a + e.b} className="border-b border-slate-200">
                        <button type="button" onClick={() => setSelected(e.a)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-3 text-left hover:bg-slate-50">
                          <span className="min-w-0 text-[16px] text-slate-900"><span className="block truncate">{e.a}</span><span className="block truncate text-slate-500">→ {e.b}</span></span>
                          <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{n(e.n)}</b><span className="block text-slate-500">{e.days === null ? "–" : `${e.days} Tage`}</span></span>
                          <span className="col-span-2 mt-1.5 block h-[3px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${Math.max(3, (e.n / maxEdge) * 100)}%` }} /></span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
                <section>
                  <h2 className="text-[22px] font-semibold">Typische Beratungswege</h2>
                  <p className="mb-3 mt-1 text-[14px] text-slate-500">Die häufigsten Folgen von Gremien (bis zu vier Stationen).</p>
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {res.routes.map((r, i) => (
                      <li key={i} className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 text-[14px]">
                        <span className="min-w-0 text-slate-900">{r.path.map((p, j) => <span key={j}>{j > 0 && <span className="mx-1.5 text-teal-600">→</span>}{p}</span>)}</span>
                        <span className="shrink-0 tabular-nums text-slate-500">{n(r.n)}</span>
                      </li>
                    ))}
                    {!res.routes.length && <li className="py-3 text-[14px] text-slate-500">Keine wiederkehrenden Wege.</li>}
                  </ol>
                </section>
              </div>

              <section className="mt-12">
                <h2 className="text-[22px] font-semibold">Rollen im Netz</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Durchsatz je Gremium: eingehende und ausgehende Übergänge. Durchgänge verbinden Einstieg und Entscheidung.</p>
                <ol className="m-0 list-none border-t border-slate-200 p-0">
                  {ranked.map((x) => (
                    <li key={x.id} className="border-b border-slate-200">
                      <button type="button" onClick={() => setSelected(x.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-3 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,1.2fr)_130px_minmax(0,1fr)_150px]">
                        <span className="truncate text-[16px] text-slate-900">{x.name}</span>
                        <span className="flex items-center gap-2 text-[14px] text-slate-500 max-sm:hidden"><i className="inline-block h-3 w-3 rounded-full" style={{ background: ROLE[x.role].fill, border: `2px solid ${ROLE[x.role].stroke}` }} />{ROLE[x.role].label}</span>
                        <span className="flex h-[6px] overflow-hidden rounded-full bg-slate-100 max-sm:order-3 max-sm:col-span-2 max-sm:mt-1.5" style={{ width: `${Math.max(6, ((x.in + x.out) / maxFlow) * 100)}%` }}><span style={{ width: `${(x.in / Math.max(1, x.in + x.out)) * 100}%`, background: "#0f766e" }} /><span style={{ width: `${(x.out / Math.max(1, x.in + x.out)) * 100}%`, background: "#94a3b8" }} /></span>
                        <span className="text-right text-[14px] tabular-nums"><b className="font-semibold text-slate-900">{n(x.in)}</b> rein · <b className="font-semibold text-slate-900">{n(x.out)}</b> raus</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
          <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Grundlage sind {n(res.examined)}{res.capped ? ` gleichmäßig ausgewählte von ${n(res.pool)}` : ""} Vorgängen mit Beratung oder Entscheidung. Nur Vorgänge, die in mindestens zwei verschiedenen Gremien behandelt wurden, bilden Übergänge ({n(res.paths)}). Stationen werden nach Datum geordnet, aufeinanderfolgende Stationen im selben Gremium zählen einmal. {res.mode === "types" ? "Ohne einzelnen Ort sind die Gremien nach ihrer Art aus dem Namen zusammengefasst (zum Beispiel Haupt- und Verwaltungsausschuss), weil jeder Ort eigene Namen hat. " : "Mit einem Ort gelten dessen echte Gremiennamen. "}Wie vollständig die Stationen erfasst sind, hängt vom Ratsinformationssystem des Ortes ab; die Zeit je Übergang ist der Abstand der Sitzungstermine. <Link href="/analytics/ueber" className="text-teal-600">Methode →</Link></p>
        </div>
      )}
    </main>
  );
}
