import Link from "next/link";
import { useState } from "react";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { Befund, zuThema } from "./Befund";
import { Reveal } from "./Reveal";
import { DEC_COLORS, DecisionRow } from "./DecisionCharts";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RadarDrill } from "./RadarDrill";
import { useAnalysisRun } from "./useAnalysisRun";

interface Cell { id: string; name: string; n: number; share: number | null; index: number | null }
interface Party {
  name: string; n: number; antrag: number; anfrage: number;
  decided: number; approved: number; rejected: number; postponed: number; open: number; rate: number | null;
  top: Cell[]; profile: Cell[]; months: { m: string; n: number }[];
}
interface Result {
  q: string;
  totals: { withFaction: number; facts: number };
  labels: { id: string; name: string; n: number; share: number | null }[];
  parties: Party[];
  small: { name: string; n: number }[];
}

const n = (v: number) => v.toLocaleString("de-DE");
/* Index 100 = wie alle Fraktionen: darüber Petrol, darunter hell; Stärke nach Abstand */
const cellColor = (i: number | null) => (i === null ? "transparent" : i >= 100 ? `rgba(13,148,136,${Math.min(0.85, (i - 100) / 150 + 0.08)})` : `rgba(148,163,184,${Math.min(0.5, (100 - i) / 160)})`);

/** plenara.X – Fraktionsprofil: Anträge und Anfragen je Fraktion, Themenprofil und was aus den Anträgen wird */
export function FraktionenPage() {
  const { query } = useAnalyticsQuery();
  const { res, ranKey, loading, error, stale, run } = useAnalysisRun<Result>({ key: query, url: `/api/analytics/fraktionen?${query}`, initial: true });
  // Geöffnete Liste hinter einer Zahl („all:SPD“, „decided:SPD“)
  const [open, setOpen] = useState("");
  const toggle = (k: string) => setOpen(open === k ? "" : k);

  /* Liste hinter einer Zeile: alle Vorgänge der Fraktion (all) oder ihre Anträge mit Entscheidung (decided) */
  const drill = (outcome: "all" | "decided", party: string, label: string) => open === `${outcome}:${party}` && <RadarDrill base={`/api/analytics/fraktionen?${outcome === "decided" ? "outcome=decided" : "list=1"}`} query={ranKey} by="party" value={party} label={label} />;

  const parties = res?.parties ?? [];
  const maxN = Math.max(1, ...parties.map((p) => p.n));
  const decided = parties.filter((p) => p.decided >= 10);
  /* Spalten der Profiltabelle: die häufigsten Themenfelder aller Fraktionsanträge */
  const cols = (res?.labels ?? []).slice(0, 8);
  const busiest = parties[0];

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
        <p className="text-[14px] text-slate-500"><Link href="/analytics/tools" className="text-teal-700">plenara.X Tools</Link> / Fraktionsprofil</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Fraktionsprofil</h1>
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Welche Fraktionen Anträge und Anfragen stellen, zu welchen Themen, und was aus ihren Anträgen wird.</p>
      </PageBand>

      <div className="print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} startLabel="Auswerten" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu auswerten.</p>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {parties.length === 0 ? <p className="mt-10 text-[16px]">Für diese Suche sind keine Anträge oder Anfragen einer Fraktion erkannt.</p> : (
            <>
              <Befund>{`${zuThema(res.q)[0].toUpperCase()}${zuThema(res.q).slice(1)} sind ${n(res.totals.withFaction)} Anträge und Anfragen einer Fraktion zugeordnet. Die meisten stellt ${busiest.name} (${n(busiest.n)}).`}</Befund>
              <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                {[
                  ["Vorgänge mit Fraktion", n(res.totals.withFaction)],
                  ["Fraktionen", n(parties.length)],
                  ["Anträge", n(parties.reduce((a, p) => a + p.antrag, 0))],
                  ["Anfragen", n(parties.reduce((a, p) => a + p.anfrage, 0))],
                ].map(([k, v], i) => (
                  <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Anträge und Anfragen je Fraktion</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Gemeinsame Anträge zählen bei jeder beteiligten Fraktion.</p>
                <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-700">
                  <li className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-teal-600" />Anträge</li>
                  <li className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-teal-200" />Anfragen</li>
                </ul>
                <ol className="m-0 list-none border-t border-slate-200 p-0">
                  {parties.map((p) => (
                    <li key={p.name} className="border-b border-slate-200">
                      <button type="button" onClick={() => toggle(`all:${p.name}`)} aria-expanded={open === `all:${p.name}`} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left sm:grid-cols-[240px_minmax(0,1fr)_150px] ${open === `all:${p.name}` ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
                      <span className="truncate text-[16px]">{p.name}</span>
                      <span className="order-3 col-span-2 flex h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1" role="img" aria-label={`${p.name}: ${n(p.antrag)} Anträge, ${n(p.anfrage)} Anfragen`}>
                        <span className="bg-teal-600" style={{ width: `${(p.antrag / maxN) * 100}%` }} />
                        <span className="bg-teal-200" style={{ width: `${(p.anfrage / maxN) * 100}%` }} />
                      </span>
                      <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{n(p.n)}</b><span className="ml-2 text-slate-500">{n(p.antrag)} / {n(p.anfrage)}</span></span>
                      </button>
                      {drill("all", p.name, `${p.name}: Anträge und Anfragen`)}
                    </li>
                  ))}
                </ol>
                {res.small.length > 0 && <p className="mt-2 text-[12px] text-slate-500">Mit weniger als 10 Vorgängen nicht einzeln gezeigt: {res.small.map((s) => `${s.name} (${s.n})`).join(", ")}.</p>}
              </section></Reveal>

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Themenprofil</h2>
                <p className="mb-4 mt-1 max-w-[760px] text-[14px] text-slate-500">Anteil eines Themenfelds an den Anträgen und Anfragen einer Fraktion, verglichen mit allen Fraktionen (Index 100 = wie alle). Kräftiges Petrol: deutlich häufiger als bei den anderen.</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-[14px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[12px] text-slate-500">
                        <th className="py-2 pr-3 font-normal">Fraktion</th>
                        {cols.map((c) => <th key={c.id} className="px-1 py-2 text-center font-normal">{c.name.split(" & ")[0]}</th>)}
                        <th className="py-2 pl-3 font-normal">Typisch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parties.map((p) => (
                        <tr key={p.name} className="border-b border-slate-200">
                          <td className="whitespace-nowrap py-2 pr-3">{p.name}</td>
                          {cols.map((c) => {
                            const cell = p.profile.find((x) => x.id === c.id);
                            const idx = cell && cell.n >= 3 ? cell.index : null;
                            return <td key={c.id} className="px-1 py-1 text-center tabular-nums"><span className={`block rounded px-1 py-1 ${idx !== null && idx >= 160 ? "text-white" : "text-slate-700"}`} style={{ background: cellColor(idx) }} title={cell ? `${c.name}: ${cell.share ?? 0} % der Einträge (${n(cell.n)}), Index ${cell.index ?? "–"}` : undefined}>{cell?.share !== null && cell?.share !== undefined ? `${Math.round(cell.share)} %` : "–"}</span></td>;
                          })}
                          <td className="py-2 pl-3 text-slate-500">{p.top.length ? p.top.map((t) => t.name).join(", ") : "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section></Reveal>

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Was aus den Anträgen wird</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Anteil der Anträge, deren Beschlussvorschlag beschlossen wurde, an den Anträgen mit Entscheidung; empfiehlt der Beschlussvorschlag, dem Antrag nicht zu folgen, zählt er als abgelehnt. Nur Fraktionen mit mindestens 10 entschiedenen Anträgen. Derselbe Antrag in Ausschuss und Rat zählt einmal; Besetzungen und Umbesetzungen zählen nicht. Anfragen zählen nicht, sie werden beantwortet.</p>
                <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-700">
                  {([["beschlossen", DEC_COLORS.approved], ["vertagt", DEC_COLORS.postponed], ["abgelehnt", DEC_COLORS.rejected]] as const).map(([l, c]) => <li key={l} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />{l}</li>)}
                </ul>
                {decided.length === 0 ? <p className="text-[14px] text-slate-500">Zu wenige entschiedene Anträge für diese Suche.</p> : (
                  <ol className="m-0 list-none border-t border-slate-200 p-0">{decided.map((p) => <DecisionRow key={p.name} cut={{ id: p.name, name: p.name, decided: p.decided, approved: p.approved, rejected: p.rejected, postponed: p.postponed, rate: p.rate }} onToggle={() => toggle(`decided:${p.name}`)} expanded={open === `decided:${p.name}`} drill={drill("decided", p.name, `${p.name}: Anträge mit Entscheidung`)} />)}</ol>
                )}
              </section></Reveal>

              <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Die Fraktion wird aus der Antragswendung in Titel oder Textanfang gelesen („Antrag der SPD-Fraktion“); lokale Wählergruppen sind zusammengefasst. Sammelpunkte wie „Beantwortung von Anfragen“ zählen nicht. Der Status ist nur bei einem Teil der Anträge bekannt; die Quote ist ein Anhaltspunkt, keine Bewertung einer Partei. <Link href="/analytics/ueber#methodik" className="text-teal-700">Methode →</Link></p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
