import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { Befund, zuThema } from "./Befund";
import { Reveal } from "./Reveal";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RadarExtra, type Extra } from "./RadarExtra";
import { RadarDrill } from "./RadarDrill";
import { RadarNorms, normsSentence, type Norms } from "./RadarNorms";
import { RadarMap } from "./RadarMap";
import { Frame } from "./AtlasFrame";
import { STATUS } from "../../lib/constants";
import { RADARS } from "@/shared/radars.mjs";
import { ANALYSEN, GRUPPEN, type AnalyseId } from "../../info/branchen-enterprise";

interface Topic { name: string; n: number; regions: number; decided: number; approved: number; rejected: number; postponed: number; open: number; rate: number | null; signals: { name: string; n: number }[] }
interface Result {
  q: string; radar: string; name: string;
  totals: { topics: number; regions: number; decided: number; rate: number | null };
  topics: Topic[];
  signals: { name: string; n: number }[];
  months: { m: string; total: number }[];
  recent: { id: string; title: string; region: string; date: string; status: string; signal: string; topics: string[] }[];
  rule: { minTopics: number; window: { from: string; to: string } };
  extra?: Extra | null;
  norms?: Norms | null;
  place?: string | null;
}

const n = (v: number) => v.toLocaleString("de-DE");
const pct = (v: number | null) => (v === null ? "–" : `${v.toLocaleString("de-DE")} %`);
const datum = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("de-DE");
const DAY = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "2-digit" });
const MONTH = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });
const statusLabel = (id: string) => STATUS.find((s) => s.id === id)?.label ?? "";
/* Wer berät: „im Rat der Stadt Billerbeck“, „im Kreistag des Kreises Coesfeld“, bei Verbänden „in den Räten der
   Verbandsgemeinde Schweich (mit den Räten der Mitgliedsgemeinden)“; dat: dasselbe nach „aus“ */
const ratOf = (p: string) => {
  const u = p.match(/^(Verbandsgemeinde|Samtgemeinde|Amt|Verwaltungsgemeinschaft) (.+)$/);
  if (u) { const r = `Räten ${u[1] === "Amt" ? "des Amtes" : `der ${u[1]}`} ${u[2]} (mit den Räten der Mitgliedsgemeinden)`; return { in: `In den ${r}`, dat: `den ${r}` }; }
  const m = p.match(/^(Kreis|Landkreis|Markt) (.+)$/);
  const gen = m ? `${{ Kreis: "des Kreises", Landkreis: "des Landkreises", Markt: "des Marktes" }[m[1]]} ${m[2]}` : `der ${p}`;
  const organ = `${m && /Kreis/.test(m[1]) ? "Kreistag" : "Rat"} ${gen}`;
  return { in: `Im ${organ}`, dat: `dem ${organ}` };
};

/** plenara.X – Themenradar (Versorgung, Verkehr, Vereine und Soziales, Vergabe, Klima und Energie, Haushalt und Steuern, Beteiligung);
 *  Unterthemen, Signale und Muster in shared/radars.mjs, Auswertung in server/integrations/analytics-radar.mjs */
/** id: Radar in shared/radars.mjs; analyse: Eintrag in ANALYSEN, falls er anders heißt (Haushalt und Steuern) */
/** embedded: im plenara.X Atlas (AtlasPage.tsx) ohne eigenen Seitenkopf, nur mit Zwischenüberschrift */
export function ThemeRadarPage({ id, analyse, embedded }: { id: keyof typeof RADARS; analyse?: AnalyseId; embedded?: boolean }) {
  const g = ANALYSEN[analyse ?? (id as AnalyseId)].group, gruppe = g === "atlas" ? { href: "/analytics/atlas", name: "plenara.X Atlas" } : GRUPPEN[g];
  const def = RADARS[id];
  const { query, search } = useAnalyticsQuery();
  /* Klick auf „Ort auswerten“ in der Karte: Ortsfilter setzen und auswerten, sobald die Abfrage den Ort enthält */
  const [runOnChange, setRunOnChange] = useState(false);
  useEffect(() => { if (runOnChange) { setRunOnChange(false); setWant(true); } }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  const qp = new URLSearchParams(query);
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [want, setWant] = useState(true);
  const [error, setError] = useState("");
  /* Aufgeklappte Liste hinter einer Zahl: "topic:Jugend", "signal:…", "month:2026-05", "region:<id>" */
  const [open, setOpen] = useState("");
  const toggle = (key: string) => setOpen(open === key ? "" : key);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!want) return;
    setWant(false);
    setError("");
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    fetch(`/api/analytics/themenradar?radar=${id}&${query}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(body.error || "Die Auswertung konnte nicht berechnet werden.");
        return body as unknown as Result;
      })
      .then((r) => { setRes(r); setRanKey(query); setOpen(""); setLoading(false); })
      .catch((e) => { if (ctrl.signal.aborted) return; setError(e.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);
  useEffect(() => () => abortRef.current?.abort(), []);
  const stale = !!res && ranKey !== query && !loading;

  const topics = [...(res?.topics ?? [])].sort((a, b) => b.n - a.n);
  const maxT = Math.max(1, ...topics.map((t) => t.n));
  const maxS = Math.max(1, ...(res?.signals ?? []).map((s) => s.n));
  const maxM = Math.max(1, ...(res?.months ?? []).map((m) => m.total));
  /* „Was geschieht“ nur, wenn die Signale etwas aussagen: über der Hälfte „Sonstiges“ sagen sie wenig (Bewertung 11.10.2026) */
  const other = res?.signals.find((s) => s.name === "Sonstiges")?.n ?? 0;
  const showSignals = !!res && other <= res.signals.reduce((a, s) => a + s.n, 0) / 2;
  const recent = res?.recent ?? [];
  const drill = (by: "topic" | "signal" | "month", value: string, label: string) => open === `${by}:${value}` && <RadarDrill radar={id} query={ranKey} by={by} value={value} label={label} />;
  const month = open.startsWith("month:") ? open.slice(6) : "";

  return (
    <Frame embedded={embedded}>
      {embedded ? <p className="mb-4 mt-6 max-w-[680px] text-[16px] text-slate-500">{def.kurz}</p> : <PageBand>
        <p className="text-[14px] text-slate-500"><Link href={gruppe.href} className="text-teal-600">{gruppe.name}</Link> / {def.name}</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">{def.name}</h1>
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">{def.kurz}</p>
      </PageBand>}

      <div className="print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && setWant(true)} onSubmit={() => setWant(true)} startLabel="Auswerten" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      <RadarMap radar={id} topics={[...def.topics.map(([t]) => String(t)), ...("fallback" in def && def.fallback ? [String(def.fallback)] : [])]} q={new URLSearchParams(ranKey || query).get("q") ?? ""} exact={new URLSearchParams(ranKey || query).get("exact") === "1"}
        place={qp.get("area") ?? ""} onPlace={(ags) => { search.setArea(ags, "ui"); setRunOnChange(true); }} />
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu auswerten.</p>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {res.totals.topics === 0 ? <p className="mt-10 text-[16px]">Für diese Suche ist nichts zu diesem Radar erkannt.</p> : (
            <>
              <Befund>{`${res.place && !res.q ? `${ratOf(res.place).in} gab es ${n(res.totals.topics)} Vorgänge` : `${zuThema(res.q)[0].toUpperCase()}${zuThema(res.q).slice(1)} gab es ${n(res.totals.topics)} Vorgänge in ${n(res.totals.regions)} Gebieten`}, am häufigsten zu „${topics[0]?.name}“ (${n(topics[0]?.n ?? 0)}).${normsSentence(res.norms)}`}</Befund>
              {res.place && <p className="mt-3 text-[14px] text-slate-500">Nur Vorgänge aus {ratOf(res.place).dat}: Vorgänge anderer Ebenen (etwa des Kreises) zählen hier nicht mit.</p>}
              <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                {[["Vorgänge", n(res.totals.topics)], ["Gebiete", n(res.totals.regions)], ["Themen mit Vorgängen", n(topics.filter((t) => t.n > 0).length)], ["Monate", n(res.months.length)]].map(([k, v], i) => (
                  <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>

              {res.norms && <RadarNorms x={res.norms} />}

              <RadarExtra extra={res.extra} radar={id} query={ranKey} />

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Themen</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Vorgänge je Thema und in wie vielen Gebieten; derselbe Titel in mehreren Gremien eines Gebiets zählt einmal. Ein Vorgang kann zu mehreren Themen gehören. Klick auf ein Thema zeigt seine Vorgänge.</p>
                <ol className="m-0 list-none border-t border-slate-200 p-0">
                  {topics.map((t) => {
                    return (
                      <li key={t.name} className="border-b border-slate-200">
                        <button type="button" onClick={() => toggle(`topic:${t.name}`)} aria-expanded={open === `topic:${t.name}`} disabled={t.n === 0} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3 text-left sm:grid-cols-[260px_minmax(0,1fr)_200px] ${open === `topic:${t.name}` ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
                          <span className="truncate text-[16px]">{t.name}</span>
                          <span className="order-3 col-span-2 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${(t.n / maxT) * 100}%` }} /></span>
                          <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{n(t.n)}</b><span className="ml-2 text-slate-500">{n(t.regions)} Gebiete</span></span>
                          <span className="order-4 col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-500 sm:col-span-3">
                            {showSignals && t.signals.filter((s) => s.name !== "Sonstiges").map((s) => <span key={s.name} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{s.name} {n(s.n)}</span>)}
                          </span>
                        </button>
                        {drill("topic", t.name, t.name)}
                      </li>
                    );
                  })}
                </ol>
              </section></Reveal>

              {showSignals && <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Was geschieht</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Art der Vorgänge, aus Titel oder Beschlussvorschlag gelesen. Klick zeigt die Vorgänge.</p>
                <ol className="m-0 list-none border-t border-slate-200 p-0">
                  {res.signals.map((s) => (
                    <li key={s.name} className="border-b border-slate-200">
                      <button type="button" onClick={() => toggle(`signal:${s.name}`)} aria-expanded={open === `signal:${s.name}`} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left sm:grid-cols-[260px_minmax(0,1fr)_100px] ${open === `signal:${s.name}` ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
                        <span className={`truncate text-[16px] ${s.name === "Sonstiges" ? "text-slate-500" : ""}`}>{s.name}</span>
                        <span className="order-3 col-span-2 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className={`block h-full rounded-full ${s.name === "Sonstiges" ? "bg-slate-300" : "bg-teal-400"}`} style={{ width: `${(s.n / maxS) * 100}%` }} /></span>
                        <span className="text-right text-[14px] font-semibold tabular-nums">{n(s.n)}</span>
                      </button>
                      {drill("signal", s.name, s.name)}
                    </li>
                  ))}
                </ol>
              </section></Reveal>}

              {res.months.length > 1 && (
                <Reveal><section className="mt-12">
                  <h2 className="text-[22px] font-semibold">Im Zeitverlauf</h2>
                  <p className="mb-3 mt-1 text-[14px] text-slate-500">Vorgänge je Monat der Sitzung. Klick auf einen Monat zeigt seine Vorgänge.</p>
                  <div className="flex h-[150px] items-end gap-1.5 border-b border-slate-200">
                    {res.months.map((m) => <button type="button" key={m.m} onClick={() => toggle(`month:${m.m}`)} aria-expanded={month === m.m} aria-label={`${MONTH.format(new Date(m.m + "-01"))}: ${n(m.total)} Vorgänge`} className="flex h-full min-w-0 flex-1 items-end justify-center hover:opacity-80"><span className={`w-full max-w-[36px] rounded-t-sm ${month && month !== m.m ? "bg-teal-600/40" : "bg-teal-600"}`} style={{ height: `${(m.total / maxM) * 140}px` }} /></button>)}
                  </div>
                  <div className="mt-1 flex gap-1.5 text-[12px] text-slate-500">{res.months.map((m) => <span key={m.m} className="min-w-0 flex-1 truncate text-center">{MONTH.format(new Date(m.m + "-01"))}</span>)}</div>
                  {month && <div className="mt-3">{drill("month", month, MONTH.format(new Date(month + "-01")))}</div>}
                </section></Reveal>
              )}

              {/* Rangliste der Gebiete entfällt: die Karte oben ordnet jedes Gebiet in seiner Vergleichsgruppe ein */}

              <Reveal><section className="mt-12">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h2 className="text-[22px] font-semibold">Jüngste Vorgänge</h2>
                </div>
                {recent.length === 0 ? <p className="mt-3 text-[14px] text-slate-500">Keine Vorgänge.</p> : (
                  <ol className="m-0 mt-3 list-none border-t border-slate-200 p-0">
                    {recent.map((r) => (
                      <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-3">
                        <Link href={`/beschluss/${r.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-700">
                          <span className="block truncate text-[16px]">{r.title}</span>
                          <span className="block truncate text-[12px] text-slate-500">{r.region} · {DAY.format(new Date(r.date))} · {r.topics.join(", ")}</span>
                        </Link>
                        <span className="self-center text-right text-[12px] text-slate-500">{r.signal !== "Sonstiges" && <span className="block">{r.signal}</span>}{statusLabel(r.status) && <span className="block">{statusLabel(r.status)}</span>}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section></Reveal>

              <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Erkannt wird am Titel, bei sehr kurzen Titeln am Beschlussvorschlag. Bauanträge Privater, Formalpunkte, Besetzungen und Sammelpunkte wie Mitteilungen zählen nicht. Eine Beschlussquote steht hier bewusst nicht: Sie lag in allen Radaren zwischen 84 und 96 % und sagt wenig, weil „beschlossen“ nur heißt, dass der Beschlussvorschlag angenommen wurde. <Link href="/analytics/ueber#methodik" className="text-teal-600">Methode →</Link></p>
            </>
          )}
        </div>
      )}
    </Frame>
  );
}
