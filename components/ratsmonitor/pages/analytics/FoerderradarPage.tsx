import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { Befund, zuThema } from "./Befund";
import { Reveal } from "./Reveal";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RadarDrill } from "./RadarDrill";
import { RadarMap } from "./RadarMap";
import { Frame } from "./AtlasFrame";
import { errorText, fetchJson } from "../../lib/fetchJson";

interface Program { name: string; other: boolean; granted: number; applied: number; mentioned: number; n: number; regions: number; euroGranted: number; euroApplied: number; amounts: number }
interface EuroRegion { id: string; name: string; pop: number; amounts: number; granted: number; applied: number; perCapita: number; grantedPerCapita: number }
interface Amount { id: string; title: string; region: string; date: string; program: string; euro: number; status: "granted" | "applied" }
interface Region { id: string; name: string; pop: number; cards: number; granted: number; applied: number; per10k: number; grantedPer10k: number; programs: { name: string; n: number }[] }
interface Result {
  q: string;
  totals: { topics: number; granted: number; applied: number; regions: number; ranked: number; cards: number };
  programs: Program[];
  months: { m: string; granted: number; applied: number; mentioned: number }[];
  labels: { id: string; name: string; n: number; share: number | null }[];
  euro: { granted: number; applied: number; amounts: number; implausible: number; ranked: number };
  ranking: Region[];
  euroRanking: EuroRegion[];
  largest: Amount[];
  rule: { minCards: number; minPop: number; minTopics: number; minAmounts: number; maxPerCapita: number };
}

const n = (v: number) => v.toLocaleString("de-DE");
/** Euro kurz: 1,2 Mio. €, 450.000 € */
const eur = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio. €` : `${Math.round(v).toLocaleString("de-DE")} €`);
const eurPc = (v: number) => `${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const C = { granted: "#0d9488", applied: "#5eead4", mentioned: "#e2e8f0" };
const MONTH = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });

/* Rangliste „Euro je Einwohner“ vorerst nicht zeigen: Beträge stehen nur bei wenigen Vorgängen und Volltexte nicht überall gleich
   (Bewertung 11.10.2026); die Summe hinge davon ab, wie ausführlich ein Gebiet berichtet. Die Auswertung liefert sie weiter. */
const SHOW_EURO_RANKING = false;

/** plenara.X – Förderradar: Förderprogramme in den Ratsunterlagen, beantragt und bewilligt, je Gebiet und Monat */
/** embedded: im plenara.X Atlas (AtlasPage.tsx) ohne eigenen Seitenkopf */
export function FoerderradarPage({ embedded }: { embedded?: boolean } = {}) {
  const { query, search } = useAnalyticsQuery();
  /* Klick auf „Ort auswerten“ in der Karte: Ortsfilter setzen und auswerten, sobald die Abfrage den Ort enthält */
  const [runOnChange, setRunOnChange] = useState(false);
  useEffect(() => { if (runOnChange) { setRunOnChange(false); setWant(true); } }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  const [res, setRes] = useState<Result | null>(null);
  // Geöffnete Liste hinter einer Zahl („program:Ganztagsausbau“, „region:<Gebiet>“)
  const [open, setOpen] = useState("");
  const toggle = (k: string) => setOpen(open === k ? "" : k);
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
    fetchJson<Result>(`/api/analytics/foerderung?${query}`, { signal: ctrl.signal }, "Die Auswertung konnte nicht berechnet werden.")
      .then((r) => { setRes(r); setRanKey(query); setLoading(false); })
      .catch((e) => { if (ctrl.signal.aborted) return; setError(errorText(e, "Die Auswertung konnte nicht berechnet werden.")); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);
  useEffect(() => () => abortRef.current?.abort(), []);
  const stale = !!res && ranKey !== query && !loading;
  const drill = (by: "program" | "region", value: string, label: string) => open === `${by}:${value}` && <RadarDrill base="/api/analytics/foerderung?list=1" query={ranKey} by={by} value={value} label={label} />;

  const programs = res?.programs ?? [];
  const named = programs.filter((p) => !p.other);
  const maxP = Math.max(1, ...programs.map((p) => p.n));
  const maxM = Math.max(1, ...(res?.months ?? []).map((m) => m.granted + m.applied));
  const maxR = Math.max(1, ...(res?.ranking ?? []).map((r) => r.per10k));
  const maxE = Math.max(1, ...(res?.euroRanking ?? []).map((r) => r.perCapita));
  const legend = (
    <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-700">
      {([["bewilligt", C.granted], ["beantragt", C.applied], ["nur erwähnt", C.mentioned]] as const).map(([l, c]) => <li key={l} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />{l}</li>)}
    </ul>
  );

  return (
    <Frame embedded={embedded}>
      {embedded ? <p className="mb-4 mt-6 max-w-[680px] text-[16px] text-slate-500">Welche Förderprogramme in den Ratsunterlagen auftauchen, wo sie beantragt und wo bewilligt werden.</p> : <PageBand>
        <p className="text-[14px] text-slate-500"><Link href="/analytics/atlas" className="text-teal-700">plenara.X Atlas</Link> / Förderradar</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Förderradar</h1>
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Welche Förderprogramme in den Ratsunterlagen auftauchen, wo sie beantragt und wo bewilligt werden.</p>
      </PageBand>}

      <div className="print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && setWant(true)} onSubmit={() => setWant(true)} startLabel="Auswerten" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {/* Karte wie in den Themenradaren: Anteil der Vorgänge mit Förderung, wählbar je Förderprogramm (die häufigsten genannten) */}
      {(() => { const qp = new URLSearchParams(ranKey || query); return <RadarMap base="/api/analytics/foerderung" topics={named.slice(0, 8).map((p) => p.name)} topicLabel="Programm" allLabel="Alle Förderungen" what="der Vorgänge mit Förderung"
        q={qp.get("q") ?? ""} exact={qp.get("exact") === "1"} place={new URLSearchParams(query).get("area") ?? ""} onPlace={(ags) => { search.setArea(ags, "ui"); setRunOnChange(true); }} />; })()}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu auswerten.</p>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {res.totals.topics === 0 ? <p className="mt-10 text-[16px]">Für diese Suche ist keine Förderung in den Unterlagen erkannt.</p> : (
            <>
              <Befund>{`${zuThema(res.q)[0].toUpperCase()}${zuThema(res.q).slice(1)} nennen ${n(res.totals.topics)} Vorgänge Fördergeld, ${n(res.totals.granted)} davon bewilligt und ${n(res.totals.applied)} beantragt.${named[0] ? ` Am häufigsten: ${named[0].name}.` : ""}${res.euro.amounts ? ` ${n(res.euro.amounts)} nennen einen Förderbetrag, zusammen ${eur(res.euro.granted)} bewilligt und ${eur(res.euro.applied)} beantragt.` : ""}`}</Befund>
              <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                {[
                  ["Vorgänge mit Förderung", n(res.totals.topics)],
                  ["Bewilligt", n(res.totals.granted)],
                  ["Beantragt", n(res.totals.applied)],
                  ["Gebiete", n(res.totals.regions)],
                  ["Betrag bewilligt", eur(res.euro.granted)],
                  ["Betrag beantragt", eur(res.euro.applied)],
                  ["Mit Betrag", n(res.euro.amounts)],
                  ["Programme", n(named.filter((p) => p.n > 0).length)],
                ].map(([k, v], i) => (
                  <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i % 4 ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Förderprogramme</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Vorgänge je Programm und in wie vielen Gebieten, darunter die genannten Beträge (bewilligt und beantragt). Ein Vorgang kann mehrere Programme nennen.</p>
                {legend}
                <ol className="m-0 list-none border-t border-slate-200 p-0">
                  {programs.map((p) => (
                    <li key={p.name} className="border-b border-slate-200">
                      <button type="button" onClick={() => toggle(`program:${p.name}`)} aria-expanded={open === `program:${p.name}`} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left sm:grid-cols-[280px_minmax(0,1fr)_170px] ${open === `program:${p.name}` ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
                      <span className={`truncate text-[16px] ${p.other ? "text-slate-500" : ""}`}>{p.name}</span>
                      <span className="order-3 col-span-2 flex h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1" role="img" aria-label={`${p.name}: ${p.granted} bewilligt, ${p.applied} beantragt, ${p.mentioned} erwähnt`}>
                        <span style={{ width: `${(p.granted / maxP) * 100}%`, background: C.granted }} />
                        <span style={{ width: `${(p.applied / maxP) * 100}%`, background: C.applied }} />
                        <span style={{ width: `${(p.mentioned / maxP) * 100}%`, background: C.mentioned }} />
                      </span>
                      <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{n(p.n)}</b><span className="ml-2 text-slate-500">{n(p.regions)} Gebiete</span>{p.amounts > 0 && <span className="block text-[12px] text-slate-500">{eur(p.euroGranted + p.euroApplied)} in {n(p.amounts)} Beträgen</span>}</span>
                      </button>
                      {drill("program", p.name, p.name)}
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
                      <li key={r.id} className="border-b border-slate-200">
                      <button type="button" onClick={() => toggle(`region:${r.id}`)} aria-expanded={open === `region:${r.id}`} className={`grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 py-3 text-left sm:grid-cols-[28px_280px_minmax(0,1fr)_200px] ${open === `region:${r.id}` ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
                        <span className="text-[14px] tabular-nums text-slate-500">{i + 1}</span>
                        <span className="min-w-0"><span className="block truncate text-[16px]">{r.name}</span><span className="block truncate text-[12px] text-slate-500">{r.programs.map((p) => p.name).join(", ")}</span></span>
                        <span className="order-4 col-span-3 mt-1.5 flex h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1 sm:mt-0">
                          <span style={{ width: `${(r.grantedPer10k / maxR) * 100}%`, background: C.granted }} />
                          <span style={{ width: `${((r.per10k - r.grantedPer10k) / maxR) * 100}%`, background: C.applied }} />
                        </span>
                        <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{r.per10k.toLocaleString("de-DE")}</b><span className="ml-2 text-slate-500">{n(r.granted)} bew. · {n(r.applied)} beantr.</span></span>
                      </button>
                      {drill("region", r.id, `${r.name}: bewilligte und beantragte Förderung`)}
                      </li>
                    ))}
                  </ol>
                )}
              </section></Reveal>

              {SHOW_EURO_RANKING && (
              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Förderbeträge je Einwohner</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Summe der in den Unterlagen genannten Förderbeträge (bewilligt und beantragt) je Einwohner. Nur Gebiete ab {n(res.rule.minPop)} Einwohnern mit mindestens {n(res.rule.minCards)} Einträgen und {res.rule.minAmounts} Beträgen ({n(res.euro.ranked)} Gebiete). Die meisten Vorgänge nennen keinen Betrag: die Summen sind eine Untergrenze und hängen davon ab, wie ausführlich ein Gebiet berichtet.</p>
                {res.euroRanking.length === 0 ? <p className="text-[14px] text-slate-500">Zu wenige Gebiete mit Beträgen für einen Vergleich.</p> : (
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {res.euroRanking.map((r, i) => (
                      <li key={r.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-200 py-3 sm:grid-cols-[28px_280px_minmax(0,1fr)_220px]">
                        <span className="text-[14px] tabular-nums text-slate-500">{i + 1}</span>
                        <span className="min-w-0"><span className="block truncate text-[16px]">{r.name}</span><span className="block truncate text-[12px] text-slate-500">{n(r.pop)} Einwohner · {n(r.amounts)} Beträge</span></span>
                        <span className="order-4 col-span-3 mt-1.5 flex h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1 sm:mt-0">
                          <span style={{ width: `${(r.grantedPerCapita / maxE) * 100}%`, background: C.granted }} />
                          <span style={{ width: `${((r.perCapita - r.grantedPerCapita) / maxE) * 100}%`, background: C.applied }} />
                        </span>
                        <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{eurPc(r.perCapita)}</b><span className="ml-2 text-slate-500">{eur(r.granted + r.applied)}</span></span>
                      </li>
                    ))}
                  </ol>
                )}
              </section></Reveal>
              )}

              {res.largest.length > 0 && (
                <Reveal><section className="mt-12">
                  <h2 className="text-[22px] font-semibold">Größte genannte Beträge</h2>
                  <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Zum Nachprüfen: die Vorgänge mit den höchsten Förderbeträgen in der Auswertung. Einzelne Beträge über {n(res.rule.maxPerCapita)} € je Einwohner des Gebiets bleiben als vermutlicher Lesefehler außen vor ({n(res.euro.implausible)}).</p>
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {res.largest.map((a) => (
                      <li key={a.id + a.program} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-slate-200 py-3">
                        <span className="min-w-0"><Link href={`/beschluss/${a.id}`} className="block truncate text-[16px] text-slate-900 no-underline hover:text-teal-800">{a.title}</Link><span className="block truncate text-[12px] text-slate-500">{a.region} · {new Date(a.date).toLocaleDateString("de-DE")} · {a.program}</span></span>
                        <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{eur(a.euro)}</b><span className="block text-[12px] text-slate-500">{a.status === "granted" ? "bewilligt" : "beantragt"}</span></span>
                      </li>
                    ))}
                  </ol>
                </section></Reveal>
              )}

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

              <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Gelesen werden Sätze im Volltext der Hauptdokumente, die von Fördergeld sprechen (Fördermittel, Förderbescheid, Zuwendung, Bundes- oder Landesmittel); daraus Programm und Stand (bewilligt, beantragt). Beträge zählen nur, wenn sie unmittelbar an einem Förderwort stehen („Zuwendung in Höhe von …“), nicht Gesamtkosten, Eigenanteile, förderfähige Kosten, Höchstbeträge oder Programmtöpfe; je Gebiet derselbe Betrag zum selben Programm einmal. Sammelberichte wie Mitteilungen, Haushalt oder Sachstände zählen nicht, ebenso wenig verfallende, zurückzuzahlende, über Jahre erwartete oder in früheren Jahren bewilligte Mittel, Anfragen und abgelehnte Vorgänge. Alle Zahlen zählen Vorgänge: derselbe Titel in mehreren Gremien eines Gebiets einmal. Vorgänge einer Mitgliedsgemeinde stehen unter ihrem Namen; in den Ranglisten zählt ein Gemeindeverband nur mit seinen eigenen Gremien. Nennt ein Satz mehrere Programme, gilt das, das dem Förderwort am nächsten steht. Volltexte liegen nicht für alle Gebiete gleich vollständig vor. <Link href="/analytics/ueber#methodik" className="text-teal-700">Methode →</Link></p>
            </>
          )}
        </div>
      )}
    </Frame>
  );
}
