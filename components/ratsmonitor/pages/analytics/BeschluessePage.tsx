import { Kennzahlen, Segmented, Folgen, useOrtInAdresse } from "./Kennzahlen";
import { busyProps, HERO_MAIN, HERO_PANEL } from "./XBusy";
import { useSearch } from "../../state/search";
import { usePhone } from "../../lib/usePhone";
import { ThemenLeiste, XKopf, XWeiter } from "./XKopf";
import { ListSkeleton } from "./ListSkeleton";
import { SplitHandle } from "./SplitHandle";
import { Laden } from "./Laden";
import { Befund, zuThema, Fehler, Leer } from "./Befund";
import { Reveal } from "./Reveal";
import { useMemo, useState, useEffect } from "react";
import { RadarDrill } from "./RadarDrill";
import { STATUS_COLOR, STATUS } from "../../lib/constants";
import { DEC_COLORS, DecisionRow, MonthColumns, type Cut, type Month } from "./DecisionCharts";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useAnalysisRun } from "./useAnalysisRun";
import { pctText as pct } from "../../lib/format";
import { MethodikNote } from "./Methodik";
import Link from "next/link";
import { fetchJson } from "../../lib/fetchJson";

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

const n = (v: number) => v.toLocaleString("de-DE");

/** Offener Abschnitt mit Überschrift wie auf den übrigen plenara.X-Seiten (Wichtiges sichtbar, Nebensachen in Fold) */
function Abschnitt({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rm-sec">
      <h2 className="text-[22px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-slate-200">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[18px] font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      {children}
    </details>
  );
}

export function BeschluessePage() {
  const { query } = useAnalyticsQuery();
  const search = useSearch();
  /* ?ort= aus dem Ortsvergleich setzt den Ort der Suche (und bleibt in der Adresse aktuell) */
  useOrtInAdresse(new URLSearchParams(query).get("area") ?? "", (a) => search.setArea(a, "ui"));
  /* ?q= aus einem Weiter-Verweis (z. B. Werte → Beschlüsse dazu): einmal beim Öffnen als Suchbegriff, dann aus der Adresse nehmen */
  useEffect(() => {
    const u = new URL(window.location.href), q = u.searchParams.get("q")?.trim();
    if (!q) return;
    search.applySearch(q);
    u.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", u.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { res, ranKey, loading, error, stale, run } = useAnalysisRun<Result>({ key: query, url: `/api/analytics/decisions?${query}`, initial: true });
  /* Neue Auswahl rechnet noch: statt des alten Ergebnisses sofort pulsierende Kacheln */
  const pending = loading && !!res && ranKey !== query;
  /* Wie Trends und Signale: geänderte Suche oder Filter rechnen nach kurzer Pause von selbst neu */
  useEffect(() => {
    if (!stale || loading) return;
    const tm = setTimeout(() => run(), 400);
    return () => clearTimeout(tm);
  }, [stale, loading, run]);
  // Geöffnete Liste hinter einer Zeile („kind:rat“)
  const [open, setOpen] = useState("");
  /* Fokus auf einen Status: beim Überfahren der Legende bzw. des Balkens treten die übrigen Anteile zurück */
  const [hotStatus, setHotStatus] = useState("");
  const [hotOutcome, setHotOutcome] = useState("");
  const phone = usePhone();
  const [cut, setCut] = useState<"topics" | "kinds" | "lands">("kinds");
  /* Vergleichswert: dieselbe Auswertung über alle Vorgänge (einmal geladen, serverseitig zwischengespeichert) */
  const [base, setBase] = useState<Result | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetchJson<Result>("/api/analytics/decisions", { signal: c.signal }, "Der Vergleichswert konnte nicht geladen werden.").then(setBase).catch(() => {});
    return () => c.abort();
  }, []);
  const showBase = !!base && !!res && res.totals.decided !== base.totals.decided;
  /* Listen zuerst kurz, „Alle zeigen“ klappt auf */
  const [allCut, setAllCut] = useState(false);
  const toggle = (open: boolean, set: (v: boolean) => void, total: number, label: string) => total > 6 ? <button type="button" aria-expanded={open} onClick={() => set(!open)} className="mt-2 inline-flex min-h-[44px] items-center text-[14px] font-medium text-teal-700">{open ? `Weniger ${label} zeigen` : `Alle ${total} ${label} zeigen`}</button> : null;



  const statusRows = useMemo(() => (res ? res.status.filter((s) => s.id !== "unknown" && s.n > 0) : []), [res]);
  const statusTotal = statusRows.reduce((a, s) => a + s.n, 0);
  const cuts = res ? res[cut] : [];

  return (
    <main id="inhalt" className={HERO_MAIN}>
      <XKopf seite="beschluesse" />
      <SplitHandle />

      <ThemenLeiste />
      <div className="print:hidden"><DiffusionSearch follow={<Folgen heart hint="Auswahl unter Meine Suchen speichern" />} noPlay play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} /></div>
      {error && <Fehler onNochmal={() => run()}>{error}</Fehler>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}

      {res && (
        <div {...busyProps(loading)}>
          {res.totals.all === 0 ? <Leer>Keine Vorgänge für diese Auswahl.</Leer> : (
            <>
              <div className={HERO_PANEL}>
              <Befund>{`${zuThema(res.q)[0].toUpperCase()}${zuThema(res.q).slice(1)} werden ${pct(res.rates.approval)} der ${n(res.totals.decided)} Entscheidungen beschlossen, ${pct(res.rates.postponement)} vertagt und ${pct(res.rates.rejection)} abgelehnt.${res.duration.median !== null ? ` Im Median dauert es ${res.duration.median} Tage bis zur Entscheidung.` : ""}`}</Befund>
              <p className="mt-2 max-w-[760px] text-[14px] text-slate-500 max-sm:hidden">Grundlage: {n(res.totals.decided)} Vorgänge mit bekannter Entscheidung, das sind {n(res.totals.known)} von {n(res.totals.all)} Einträgen mit bekanntem Status{res.totals.knownShare !== null ? ` (${pct(res.totals.knownShare)} aller Einträge)` : ""}. Die übrigen Einträge zeigen keinen Status.</p>
              <Kennzahlen rest={!phone} items={([
                  ["Beschlussquote", pct(res.rates.approval)],
                  ["Vertagt", pct(res.rates.postponement)],
                  ["Abgelehnt", pct(res.rates.rejection)],
                  ["Entscheidungen", n(res.totals.decided)]
                ] as [string, string][]).map(([label, value]) => ({ label, value }))} />

              {/* Wie gehen Vorgänge zu dieser Auswahl aus: ein Balken, daneben der Wert für alle Vorgänge; Dauer in einer Zeile */}
              <div className="mt-6 max-w-[900px]">
                <div className="flex h-5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`beschlossen ${pct(res.rates.approval)}, vertagt ${pct(res.rates.postponement)}, abgelehnt ${pct(res.rates.rejection)}`}>
                  {([[res.rates.approval, DEC_COLORS.approved], [res.rates.postponement, DEC_COLORS.postponed], [res.rates.rejection, DEC_COLORS.rejected]] as [number | null, string][]).map(([v, c], i) => <span key={i} style={{ width: `${v ?? 0}%`, background: c }} />)}
                </div>
                <ul className="m-0 mt-3 grid list-none grid-cols-3 gap-4 p-0 max-sm:grid-cols-1">
                  {([["beschlossen", res.rates.approval, base?.rates.approval, DEC_COLORS.approved], ["vertagt", res.rates.postponement, base?.rates.postponement, DEC_COLORS.postponed], ["abgelehnt", res.rates.rejection, base?.rates.rejection, DEC_COLORS.rejected]] as [string, number | null, number | null | undefined, string][]).map(([l, v, b, c]) => (
                    <li key={l} className="flex items-baseline gap-2 text-[14px] text-slate-700">
                      <i className="inline-block h-3 w-3 flex-none translate-y-0.5 rounded-sm" style={{ background: c }} />
                      <span><b className="text-[22px] font-semibold tabular-nums text-slate-900">{pct(v)}</b> {l}</span>
                      {showBase && b !== undefined && b !== null && <span className="text-[12px] text-slate-500">(alle Vorgänge: {pct(b)})</span>}
                    </li>
                  ))}
                </ul>
                {res.duration.median !== null && (
                  <p className="m-0 mt-3 text-[14px] text-slate-600 max-sm:hidden">
                    Dauer bis zur Entscheidung: meist {res.duration.p25} bis {res.duration.p75} Tage, in der Mitte {res.duration.median}{showBase && base?.duration.median != null ? ` (alle Vorgänge: ${base.duration.median})` : ""}. <Link href="/analytics/gremien" className="font-medium text-teal-700 hover:underline">Wege und Dauer in den Gremien →</Link>
                  </p>
                )}
              </div>
                {/* Handy: Grundlage und Dauer ruhig eingeklappt statt zwei Absätze mehr */}
                <details className="mt-3 text-[14px] text-slate-600 sm:hidden"><summary className="cursor-pointer font-medium text-teal-700">Grundlage und Dauer</summary>
                  <p className="m-0 mt-2">Grundlage: {n(res.totals.decided)} Vorgänge mit bekannter Entscheidung, das sind {n(res.totals.known)} von {n(res.totals.all)} Einträgen mit bekanntem Status{res.totals.knownShare !== null ? ` (${pct(res.totals.knownShare)} aller Einträge)` : ""}. Die übrigen Einträge zeigen keinen Status.</p>
                  {res.duration.median !== null && <p className="m-0 mt-2">Dauer bis zur Entscheidung: meist {res.duration.p25} bis {res.duration.p75} Tage, in der Mitte {res.duration.median}{showBase && base?.duration.median != null ? ` (alle Vorgänge: ${base.duration.median})` : ""}. <Link href="/analytics/gremien" className="font-medium text-teal-700 hover:underline">Wege und Dauer in den Gremien →</Link></p>}
                </details>
              </div>


              



              {pending && <ListSkeleton />}
              <div className={pending ? "hidden" : undefined}>
              <Abschnitt title="Aufteilung">
              <div className="pb-6 max-sm:pb-0 pt-2">
                <Segmented label="Aufteilung" fill={phone} options={[["kinds", "Gremienebene"], ["topics", "Themenfeld"], ["lands", "Bundesland"]]} value={cut} onPick={setCut} />
                <p className="mb-2 mt-3 text-[14px] text-slate-500">Beschlussquote und Anteil vertagt und abgelehnt{cut === "topics" ? `. Nur ${n(res.totals.decided - res.unclassified.decided)} der ${n(res.totals.decided)} Entscheidungen sind einem Themenfeld zugeordnet.` : cut === "kinds" ? ". Ausschüsse empfehlen nur: Für sie steht die Zahl der Empfehlungen statt einer Quote." : "."}{cut !== "kinds" ? " Grau: im üblichen Rahmen." : ""}</p>
                {cuts.length === 0 ? <p className="py-4 text-[14px] text-slate-500">Zu wenige Entscheidungen für diese Aufteilung.</p> : <ol className="m-0 list-none border-t border-slate-200 p-0">{(allCut ? cuts : cuts.slice(0, 6)).map((c) => { const by = { kinds: "kind", topics: "label", lands: "land" }[cut], k = `${by}:${c.id}`; return <DecisionRow hot={hotOutcome} key={c.id} cut={c} onToggle={() => setOpen(open === k ? "" : k)} expanded={open === k} drill={open === k && <RadarDrill base="/api/analytics/decisions?list=1" query={ranKey} by={by} value={c.id} label={`${c.name}, Vorgänge mit Entscheidung`} />} />; })}</ol>}
                {toggle(allCut, setAllCut, cuts.length, "Einträge")}
              </div>
              </Abschnitt>
              <Reveal><section className="rm-sec">
                <h2 className="text-[22px] font-semibold">Entscheidungen im Zeitverlauf</h2>
                <p className="mb-4 mt-1 text-[14px] text-slate-500">Beschlossen, vertagt und abgelehnt je Monat.</p>
                <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-700">
                  {([["beschlossen", DEC_COLORS.approved, "approved"], ["vertagt", DEC_COLORS.postponed, "postponed"], ["abgelehnt", DEC_COLORS.rejected, "rejected"]] as const).map(([l, c, k]) => <li key={l} onMouseEnter={() => setHotOutcome(k)} onMouseLeave={() => setHotOutcome("")} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />{l}</li>)}
                </ul>
                <MonthColumns months={res.months} />
              </section></Reveal>
              
              <div className="rm-sec border-t border-slate-200">
              <Fold title="Abstimmung und Änderungen">
              <div className="pb-6 max-sm:pb-0 pt-2">
                <p className="mb-4 mt-1 text-[14px] text-slate-500">Aus dem Ergebnistext der Beschlüsse gelesen; das nennen nur manche Ratsinformationssysteme, die Werte gelten nur für Vorgänge mit Angabe. Grundlage: alle {n(res.votes.of)} Vorgänge mit Entscheidung.</p>
                <dl className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                  {[
                    [`Einstimmig (von ${n(res.votes.all.vote)} mit Angabe)`, pct(res.votes.all.unanimous)],
                    ["Mehrheitlich", res.votes.all.unanimous === null ? "–" : pct(Math.round((100 - res.votes.all.unanimous) * 10) / 10)],
                    [`Geändert (von ${n(res.votes.all.changeN)} mit Angabe)`, pct(res.votes.all.changed)],
                    ["Mit Angabe zur Abstimmung", n(res.votes.all.vote)],
                  ].map(([k, v], i) => (
                    <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                  ))}
                </dl>
                <div className="mt-8 grid grid-cols-1 gap-12 md:grid-cols-2 max-sm:mt-5 max-sm:gap-5">
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
              </div>
              </Fold>
              <Fold title="Stand der Vorgänge und Datenlage">
              <div className="pb-6 max-sm:pb-0 pt-2">
                <p className="mb-4 mt-1 text-[14px] text-slate-500">Alle Einträge mit bekanntem Status.</p>
                <div className="flex h-[16px] w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Stand der Vorgänge">
                  {statusRows.map((s) => <span key={s.id} title={`${STATUS.find((x) => x.id === s.id)?.label ?? s.id}: ${n(s.n)}`} onMouseEnter={() => setHotStatus(s.id)} onMouseLeave={() => setHotStatus("")} className="transition-opacity duration-200" style={{ width: `${(s.n / statusTotal) * 100}%`, background: STATUS_COLOR[s.id], opacity: hotStatus && hotStatus !== s.id ? 0.3 : 1 }} />)}
                </div>
                <ul className="m-0 mt-3 grid list-none grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-6 gap-y-1 p-0 text-[14px]">
                  {statusRows.map((s) => <li key={s.id} onMouseEnter={() => setHotStatus(s.id)} onMouseLeave={() => setHotStatus("")} className={`flex items-center justify-between gap-3 border-b border-slate-100 py-1 transition-opacity duration-200 ${hotStatus && hotStatus !== s.id ? "opacity-50" : ""}`}><span className="flex items-center gap-2"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: STATUS_COLOR[s.id] }} />{STATUS.find((x) => x.id === s.id)?.label ?? s.id}</span><span className="tabular-nums text-slate-500">{n(s.n)} · {Math.round((s.n / statusTotal) * 100)} %</span></li>)}
                </ul>
              </div>
              <MethodikNote>Abstimmung, Änderungen und Durchlaufzeit zählen Vorgänge mit Entscheidung; „einstimmig“, „mehrheitlich“ und „geändert“ stammen aus dem Ergebnistext. Der Status ist nur bei einem Teil bekannt, Ablehnungen sind selten vermerkt: die Quoten sind ein Anhaltspunkt. Offene Vorgänge fehlen in der Durchlaufzeit.</MethodikNote>
              </Fold>
              </div>
              </div>
            </>
          )}
        </div>
      )}
    <XWeiter links={[["/analytics/gremien", "Gremien"], ["/analytics/fraktionen", "Fraktionen"]]} />
    </main>
  );
}
