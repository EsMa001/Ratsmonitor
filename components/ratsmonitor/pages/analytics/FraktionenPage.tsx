import { useState, useEffect } from "react";
import { busyProps, HERO_MAIN, HERO_PANEL } from "./XBusy";
import { Kennzahlen, Folgen } from "./Kennzahlen";
import { ThemenLeiste, XKopf, XWeiter } from "./XKopf";
import { ListSkeleton } from "./ListSkeleton";
import { SplitHandle } from "./SplitHandle";
import { Laden } from "./Laden";
import { Befund, zuThema, Fehler, Leer } from "./Befund";
import { Reveal } from "./Reveal";
import { DEC_COLORS, DecisionRow } from "./DecisionCharts";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RadarDrill } from "./RadarDrill";
import { useAnalysisRun } from "./useAnalysisRun";
import { MethodikNote } from "./Methodik";
import { TabPane } from "./Tabs";
import { ThemeIcon } from "../../components/icons";
import { ListenKopf, Reiter } from "./ListenKopf";
import { BarChart3, CircleCheck, LayoutGrid, type LucideIcon } from "lucide-react";

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
const cellColor = (i: number | null) => (i === null ? "transparent" : i >= 100 ? `rgba(38,132,120,${Math.min(0.85, (i - 100) / 150 + 0.08)})` : `rgba(161,161,170,${Math.min(0.5, (100 - i) / 160)})`);

/* Töne der fünf größten Fraktionen im Anteilsbalken (nur Farben aus „Petrol klar“, keine Parteifarben) */
/* Teile der Seite: Schlüssel, Reiter, Symbol, Titel im Kopf */
const TEILE: ["je" | "themen" | "ausgang", string, LucideIcon, string][] = [
  ["je", "Anträge je Fraktion", BarChart3, "Anträge und Anfragen je Fraktion"],
  ["themen", "Themenprofil", LayoutGrid, "Themenprofil"],
  ["ausgang", "Was aus den Anträgen wird", CircleCheck, "Was aus den Anträgen wird"],
];
const SHARE_TONES = ["bg-teal-700", "bg-sky-800", "bg-amber-600", "bg-teal-400", "bg-sky-500"];

/* Verlauf der letzten 24 Monate als kleine Linie (Anträge und Anfragen je Monat) */
function Spark({ months }: { months: { m: string; n: number }[] }) {
  const last = months.slice(-24);
  if (last.length < 3) return <span aria-hidden="true" />;
  const max = Math.max(1, ...last.map((x) => x.n)), w = 80, h = 22;
  const pts = last.map((x, i) => `${((i / (last.length - 1)) * w).toFixed(1)},${(h - 2 - (x.n / max) * (h - 4)).toFixed(1)}`).join(" ");
  return <svg aria-hidden="true" width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block overflow-visible"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
/* Themen, die eine Fraktion deutlich häufiger aufgreift als die übrigen (Index ab 120), als kleine Symbole */
function TopThemen({ top, label = false }: { top: Cell[]; label?: boolean }) {
  if (!top.length) return null;
  return <span className="flex flex-wrap items-center gap-1">{top.map((c) => <span key={c.id} title={`${c.name}: ${((c.index ?? 100) / 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })}-mal so häufig wie bei allen Fraktionen`}
    className={`inline-flex h-6 items-center gap-1 rounded-md bg-teal-50 text-teal-800 ${label ? "px-1.5 text-[12px]" : "w-6 justify-center"}`}><ThemeIcon theme={c.id} size={14} />{label && <span>{c.name.split(/ [&,] /)[0]}</span>}</span>)}</span>;
}

/** plenara.X – Fraktionsprofil: Anträge und Anfragen je Fraktion, Themenprofil und was aus den Anträgen wird */
export function FraktionenPage() {
  const { query } = useAnalyticsQuery();
  const { res, ranKey, loading, error, stale, run } = useAnalysisRun<Result>({ key: query, url: `/api/analytics/fraktionen?${query}`, initial: true });
  /* Neue Auswahl rechnet noch: statt des alten Ergebnisses sofort pulsierende Kacheln */
  const pending = loading && !!res && ranKey !== query;
  /* Wie Trends und Signale: geänderte Suche oder Filter rechnen nach kurzer Pause von selbst neu */
  useEffect(() => {
    if (!stale || loading) return;
    const tm = setTimeout(() => run(), 400);
    return () => clearTimeout(tm);
  }, [stale, loading, run]);
  // Geöffnete Liste hinter einer Zahl („all:SPD“, „decided:SPD“)
  const [open, setOpen] = useState("");
  /* Fokus auf einen Ausgang beim Überfahren der Legende */
  const [hotOutcome, setHotOutcome] = useState("");
  /* Handy: nur die ersten 6 Fraktionen je Liste, bis „Alle zeigen“ */
  const [allP, setAllP] = useState(false);
  const [tab, setTab] = useState<"je" | "themen" | "ausgang">("je");
  /* Handy, Themenprofil: Fraktionen, deren alle Themen aufgeklappt sind */
  const [openT, setOpenT] = useState<Record<string, boolean>>({});
  const rowHide = (i: number) => (!allP && i >= 6 ? " hidden" : "");
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
    <main id="inhalt" className={HERO_MAIN}>
      <XKopf seite="fraktionen" />
      <SplitHandle />

      <ThemenLeiste />
      <div className="print:hidden"><DiffusionSearch follow={<Folgen heart hint="Auswahl unter Meine Suchen speichern" />} noPlay play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} /></div>
      {error && <Fehler onNochmal={() => run()}>{error}</Fehler>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}

      {res && (
        <div {...busyProps(loading)}>
          {parties.length === 0 ? <Leer>Keine Anträge oder Anfragen einer Fraktion für diese Auswahl.</Leer> : (
            <>
              <div className={HERO_PANEL}>
              <Befund noPhone>{`${zuThema(res.q)[0].toUpperCase()}${zuThema(res.q).slice(1)} sind ${n(res.totals.withFaction)} Anträge und Anfragen einer Fraktion zugeordnet. Die meisten stellt ${busiest.name} (${n(busiest.n)}).`}</Befund>
              <Kennzahlen rest items={([
                  ["Vorgänge mit Fraktion", n(res.totals.withFaction)],
                  ["Fraktionen", n(parties.length)],
                  ["Anträge", n(parties.reduce((a, p) => a + p.antrag, 0))],
                  ["Anfragen", n(parties.reduce((a, p) => a + p.anfrage, 0))]
                ] as [string, string][]).map(([label, value]) => ({ label, value }))} />
              {/* Anteile der Fraktionen an allen Anträgen und Anfragen: ein Balken, die fünf größten einzeln, der Rest zusammen */}
              {(() => {
                const sum = parties.reduce((a, p) => a + p.n, 0) || 1, top = parties.slice(0, 5), rest = sum - top.reduce((a, p) => a + p.n, 0);
                const parts = [...top.map((p, i) => ({ name: p.name, v: p.n, c: SHARE_TONES[i] })), ...(rest > 0 ? [{ name: "Übrige", v: rest, c: "bg-slate-300" }] : [])];
                const pc = (v: number) => `${Math.round((v / sum) * 100)} %`;
                return <div className="mt-6 max-w-[900px] max-sm:hidden">
                  <div className="flex h-5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={parts.map((x) => `${x.name} ${pc(x.v)}`).join(", ")}>
                    {parts.map((x) => <span key={x.name} className={x.c} style={{ width: `${(x.v / sum) * 100}%` }} />)}
                  </div>
                  <ul className="m-0 mt-3 grid list-none grid-cols-3 gap-x-4 gap-y-2 p-0">
                    {parts.map((x) => <li key={x.name} className="flex items-baseline gap-2 text-[14px] text-slate-700">
                      <i className={`inline-block h-3 w-3 flex-none translate-y-0.5 rounded-sm ${x.c}`} />
                      <span className="min-w-0"><b className="text-[22px] font-semibold tabular-nums text-slate-900">{pc(x.v)}</b> <span className="break-words">{x.name}</span></span>
                    </li>)}
                  </ul>
                  <p className="m-0 mt-3 text-[12px] text-slate-500">Anteil an allen Anträgen und Anfragen einer Fraktion; gemeinsame Anträge zählen bei jeder beteiligten Fraktion.</p>
                </div>;
              })()}
              {/* Wer setzt welche Themen, und wie oft wird beschlossen: je größere Fraktion eine Zeile */}
              <div className="mt-8 max-w-[900px] max-sm:hidden">
                <p className="m-0 text-[12px] font-medium uppercase tracking-wide text-slate-500">Schwerpunkte und Beschlussquote</p>
                <ul className="m-0 mt-2 list-none border-t border-slate-200 p-0">
                  {parties.slice(0, 6).map((p) => <li key={p.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-200 py-2">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"><span className="truncate text-[14px] font-semibold text-slate-900">{p.name}</span>
                    {p.top.length ? <TopThemen top={p.top} label /> : <span className="text-[12px] text-slate-500">ohne deutlichen Schwerpunkt</span>}</span>
                    <span className="text-right text-[12px] text-slate-500" title={`${n(p.approved)} von ${n(p.decided)} entschiedenen Anträgen beschlossen`}>{p.rate !== null && p.decided >= 10 ? <><b className="text-[16px] font-semibold tabular-nums text-teal-700">{Math.round(p.rate)} %</b> beschlossen</> : "zu wenig entschieden"}</span>
                  </li>)}
                </ul>
                <p className="m-0 mt-2 text-[12px] text-slate-500">Symbole: Themen, die die Fraktion deutlich häufiger aufgreift als alle Fraktionen zusammen.</p>
              </div>
              </div>

              {pending && <ListSkeleton />}
              <div className={pending ? "hidden" : undefined}>
              {/* Kopf wie auf Projekte und Nachrichten, darunter die drei Teile als Reiter mit Symbol (Petrol-Linie unter dem gewählten) */}
              <div className="mt-4 max-sm:hidden print:hidden">
                <ListenKopf eyebrow="Fraktionen" icon={(() => { const I = TEILE.find(([k]) => k === tab)![2]; return <I size={20} strokeWidth={1.4} />; })()} title={TEILE.find(([k]) => k === tab)![3]} count={`${n(parties.length)} Fraktionen · ${n(res.totals.withFaction)} Vorgänge`} />
                <div className="mt-4"><Reiter label="Teil der Auswertung" items={TEILE.map(([k, l, I]) => [k, l, I] as ["je" | "themen" | "ausgang", string, LucideIcon])} value={tab} onPick={setTab} /></div>
              </div>
              <TabPane on={tab === "je"}>
              <Reveal><section className="rm-sec">
                <h2 className="text-[22px] font-semibold sm:sr-only">Anträge und Anfragen je Fraktion</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Gemeinsame Anträge zählen bei jeder beteiligten Fraktion. <span className="sm:hidden">Zahl rechts: Anträge und Anfragen zusammen; Tippen zeigt die Liste.</span></p>
                <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-700">
                  <li className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-teal-600" />Anträge</li>
                  <li className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-teal-200" />Anfragen</li>
                </ul>
                <ol className="rm-focusrows m-0 list-none border-t border-slate-200 p-0">
                  {parties.map((p, i) => (
                    <li key={p.name} className={"border-b border-slate-200" + rowHide(i)}>
                      <button type="button" onClick={() => toggle(`all:${p.name}`)} aria-expanded={open === `all:${p.name}`} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] max-sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 max-sm:gap-2 py-3 max-sm:py-0.5 max-sm:min-h-[44px] text-left sm:grid-cols-[200px_minmax(0,1fr)_80px_150px] ${open === `all:${p.name}` ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
                      <span className="min-w-0"><span className="block truncate text-[16px] max-sm:text-[14px]">{p.name}</span><span className="mt-1 block max-sm:hidden"><TopThemen top={p.top} /></span></span>
                      <span className="order-3 col-span-2 flex h-[8px] overflow-hidden rounded-full bg-slate-100 max-sm:order-none max-sm:col-span-1 sm:order-none sm:col-span-1" role="img" aria-label={`${p.name}: ${n(p.antrag)} Anträge, ${n(p.anfrage)} Anfragen`}>
                        <span className="bg-teal-600" style={{ width: `${(p.antrag / maxN) * 100}%` }} />
                        <span className="bg-teal-200" style={{ width: `${(p.anfrage / maxN) * 100}%` }} />
                      </span>
                      <span className="text-teal-700 max-sm:hidden" title="Anträge und Anfragen je Monat, letzte 24 Monate"><Spark months={p.months} /></span>
                      <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{n(p.n)}</b><span className="ml-2 text-slate-500 max-sm:hidden">{n(p.antrag)} / {n(p.anfrage)}</span></span>
                      </button>
                      {drill("all", p.name, `${p.name}: Anträge und Anfragen`)}
                    </li>
                  ))}
                </ol>
                {res.small.length > 0 && <p className="mt-2 text-[12px] text-slate-500">Mit weniger als 10 Vorgängen nicht einzeln gezeigt: {res.small.map((s) => `${s.name} (${s.n})`).join(", ")}.</p>}
              </section></Reveal>

              {parties.length > 6 && <button type="button" onClick={() => setAllP(!allP)} className="mt-3 inline-flex min-h-[44px] items-center text-[14px] font-medium text-teal-700">{allP ? "Weniger Fraktionen zeigen" : `Alle ${parties.length} Fraktionen zeigen`}</button>}
              </TabPane>
              <TabPane on={tab === "themen"}>
              <Reveal><section className="rm-sec">
                <h2 className="text-[22px] font-semibold sm:sr-only">Themenprofil</h2>
                <p className="mb-4 max-sm:mb-2 mt-1 max-w-[760px] text-[14px] text-slate-500 max-sm:line-clamp-2">Anteil je Themenfeld an den Anträgen und Anfragen einer Fraktion. Kräftiges Petrol: deutlich häufiger als bei den anderen.</p>
                {/* Handy: je Fraktion eine Zeile mit den Themen untereinander statt der breiten Tabelle (kein Querscrollen) */}
                <ul className="m-0 list-none border-t border-slate-200 p-0 sm:hidden">
                  {parties.map((p, i) => (
                    <li key={p.name} className={"border-b border-slate-200 py-2" + rowHide(i)}>
                      <p className="m-0 text-[14px] font-semibold text-slate-900">{p.name}</p>
                      {/* Die drei Themen, die diese Fraktion deutlich häufiger aufgreift als die übrigen; alle Themen dahinter */}
                      {(() => {
                        const cells = cols.map((c) => ({ c, cell: p.profile.find((x) => x.id === c.id) }));
                        const ok = cells.filter((x) => x.cell && x.cell.n >= 3 && x.cell.index !== null && x.cell.share !== null && x.cell.share !== undefined);
                        const top3 = [...ok].sort((a, b) => (b.cell!.index ?? 0) - (a.cell!.index ?? 0)).slice(0, 3).sort((a, b) => (b.cell!.share ?? 0) - (a.cell!.share ?? 0));
                        const chip = ({ c, cell }: { c: (typeof cols)[number]; cell?: Cell }) => { const idx = cell && cell.n >= 3 ? cell.index : null; return <span key={c.id} className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] ${idx !== null && idx >= 160 ? "text-white" : "text-slate-800"}`} style={{ background: idx !== null && idx >= 100 ? cellColor(idx) : "var(--rm-c100)" }}>{c.name.split(" & ")[0]}<b className="font-semibold tabular-nums">{cell?.share !== null && cell?.share !== undefined ? `${Math.round(cell.share)} %` : "–"}</b></span>; };
                        return <>
                          {top3.length > 0 ? <div className="mt-1.5 flex flex-wrap gap-1.5">{top3.map(chip)}</div> : <p className="m-0 mt-1 text-[12px] text-slate-500">Zu wenige Anträge für ein Themenprofil.</p>}
                          {ok.length > top3.length && <button type="button" aria-expanded={!!openT[p.name]} onClick={() => setOpenT((o) => ({ ...o, [p.name]: !o[p.name] }))} className="inline-flex min-h-0 h-7 items-center text-[12px] font-medium text-teal-700 hover:underline">{openT[p.name] ? "Weniger Themen" : "Alle Themen zeigen"}</button>}
                          {openT[p.name] && <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">{cells.map(({ c, cell }) => { const idx = cell && cell.n >= 3 ? cell.index : null; return <div key={c.id} className="flex items-center justify-between gap-2 text-[12px]"><span className="truncate text-slate-500">{c.name.split(" & ")[0]}</span><span className={`shrink-0 rounded px-1.5 tabular-nums ${idx !== null && idx >= 160 ? "text-white" : "text-slate-700"}`} style={{ background: cellColor(idx) }}>{cell?.share !== null && cell?.share !== undefined ? `${Math.round(cell.share)} %` : "–"}</span></div>; })}</div>}
                        </>;
                      })()}
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto sm:block">
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
              </TabPane>

              <TabPane on={tab === "ausgang"}>
              <Reveal><section className="rm-sec">
                <h2 className="text-[22px] font-semibold sm:sr-only">Was aus den Anträgen wird</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Anteil beschlossener Anträge an den entschiedenen, je Fraktion ab 10 Anträgen. Empfiehlt die Vorlage, dem Antrag nicht zu folgen, zählt er als abgelehnt.</p>
                <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-700">
                  {([["beschlossen", DEC_COLORS.approved, "approved"], ["vertagt", DEC_COLORS.postponed, "postponed"], ["abgelehnt", DEC_COLORS.rejected, "rejected"]] as const).map(([l, c, k]) => <li key={l} onMouseEnter={() => setHotOutcome(k)} onMouseLeave={() => setHotOutcome("")} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />{l}</li>)}
                </ul>
                {decided.length === 0 ? <p className="text-[14px] text-slate-500">Zu wenige entschiedene Anträge für diese Suche.</p> : (
                  <ol className="rm-focusrows m-0 list-none border-t border-slate-200 p-0">{(allP ? decided : decided.slice(0, 6)).map((p) => <DecisionRow hot={hotOutcome} key={p.name} cut={{ id: p.name, name: p.name, decided: p.decided, approved: p.approved, rejected: p.rejected, postponed: p.postponed, rate: p.rate }} onToggle={() => toggle(`decided:${p.name}`)} expanded={open === `decided:${p.name}`} drill={drill("decided", p.name, `${p.name}: Anträge mit Entscheidung`)} />)}</ol>
                )}
              </section></Reveal>
              </TabPane>

              <MethodikNote>Die Quote ist ein Anhaltspunkt, keine Bewertung einer Partei.</MethodikNote>
              </div>
            </>
          )}
        </div>
      )}
    <XWeiter links={[["/analytics/trends", "plenara.X Trends"], ["/analytics/beschluesse", "Beschlusslage"], ["/analytics/gremien", "Gremien"]]} />
    </main>
  );
}
