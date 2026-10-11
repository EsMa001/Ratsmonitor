import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { Befund, zuThema } from "./Befund";
import { Reveal } from "./Reveal";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RadarDrill } from "./RadarDrill";

type Direction = "Erhöhung" | "Senkung" | "Beitragsfreiheit" | "Verpflegung" | "Neufassung";
interface Decision { id: string; title: string; region: string; date: string; direction: Direction; euro: string | null }
interface Result {
  q: string;
  totals: { fees: number; feeRegions: number; projects: number; places: number; placeRegions: number };
  directions: { name: Direction; n: number }[];
  months: ({ m: string } & Record<Direction, number>)[];
  decisions: Decision[];
  feeRegions: ({ id: string; name: string; n: number } & Record<Direction, number>)[];
  placeRegions: { id: string; name: string; pop: number | null; places: number; projects: number; per1k: number | null }[];
  projects: { id: string; title: string; region: string; date: string; places: number }[];
}

const n = (v: number) => v.toLocaleString("de-DE");
const DAY = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "2-digit" });
const MONTH = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });
const COLOR: Record<Direction, string> = { Erhöhung: "#0f172a", Senkung: "#0d9488", Beitragsfreiheit: "#5eead4", Verpflegung: "#94a3b8", Neufassung: "#e2e8f0" };
const LABEL: Record<Direction, string> = { Erhöhung: "Erhöhung", Senkung: "Senkung", Beitragsfreiheit: "Beitragsfreiheit", Verpflegung: "Verpflegung", Neufassung: "Sonstige Änderung der Satzung" };
const ORDER: Direction[] = ["Erhöhung", "Senkung", "Beitragsfreiheit", "Verpflegung", "Neufassung"];

/* Neue Plätze vorerst nicht zeigen: zu wenige Projekte mit Platzzahl, und ein Neubau zählt je Vergabe-Vorlage (ein Gewerk je
   Vorlage) mehrfach (Bewertung 11.10.2026). Die Daten liefert die Auswertung weiter. */
const SHOW_PLACES = false;

/** plenara.X – Kita-Radar: Entscheidungen zu Elternbeiträgen (Richtung) und neue Kita-Plätze */
export function KitaRadarPage() {
  const { query } = useAnalyticsQuery();
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [want, setWant] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  /* Aufgeklappte Liste hinter einer Richtung (Erhöhung, Senkung …) */
  const [open, setOpen] = useState("");

  useEffect(() => {
    if (!want) return;
    setWant(false);
    setError("");
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    fetch(`/api/analytics/kita?${query}`, { signal: ctrl.signal })
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

  const count = (d: Direction) => res?.directions.find((x) => x.name === d)?.n ?? 0;
  const maxD = Math.max(1, ...(res?.directions ?? []).map((d) => d.n));
  const maxM = Math.max(1, ...(res?.months ?? []).map((m) => ORDER.reduce((a, d) => a + m[d], 0)));
  const legend = (
    <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-700">
      {ORDER.map((d) => <li key={d} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm border border-slate-200" style={{ background: COLOR[d] }} />{LABEL[d]}</li>)}
    </ul>
  );

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
        <p className="text-[14px] text-slate-500"><Link href="/analytics/radar" className="text-teal-600">plenara.X Radar</Link> / Kita-Radar</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Kita-Radar</h1>
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Wo über Elternbeiträge entschieden wird und in welche Richtung.</p>
      </PageBand>

      <div className="print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && setWant(true)} onSubmit={() => setWant(true)} startLabel="Auswerten" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu auswerten.</p>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {res.totals.fees + (SHOW_PLACES ? res.totals.projects : 0) === 0 ? <p className="mt-10 text-[16px]">Für diese Suche sind keine Kita-Beiträge oder neuen Plätze erkannt.</p> : (
            <>
              <Befund>{`${zuThema(res.q)[0].toUpperCase()}${zuThema(res.q).slice(1)} gab es ${n(res.totals.fees)} Vorgänge zu Kita-Elternbeiträgen in ${n(res.totals.feeRegions)} Gebieten: ${n(count("Erhöhung"))} Erhöhungen, ${n(count("Senkung"))} Senkungen und ${n(count("Beitragsfreiheit"))}-mal Beitragsfreiheit.${SHOW_PLACES && res.totals.places ? ` Genannt sind ${n(res.totals.places)} neue Kita-Plätze.` : ""}`}</Befund>
              <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                {[["Vorgänge zu Beiträgen", n(res.totals.fees)], ["Erhöhungen", n(count("Erhöhung"))], ["Senkungen und Beitragsfreiheit", n(count("Senkung") + count("Beitragsfreiheit"))], SHOW_PLACES ? ["Neue Kita-Plätze", n(res.totals.places)] : ["Gebiete", n(res.totals.feeRegions)]].map(([k, v], i) => (
                  <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Elternbeiträge: in welche Richtung</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Vorgänge zu Elternbeiträgen, Gebühren- und Beitragssatzungen für Kitas, Krippen und Tagespflege. Die Höhe der Beiträge wird nicht verglichen: Sie steht je Monat, Einkommensstufe, Alter und Betreuungszeit verschieden da. Klick auf eine Richtung zeigt die Vorgänge.</p>
                <ol className="m-0 list-none border-t border-slate-200 p-0">
                  {ORDER.map((d) => (
                    <li key={d} className="border-b border-slate-200">
                      <button type="button" disabled={!count(d)} onClick={() => setOpen(open === d ? "" : d)} aria-expanded={open === d} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left sm:grid-cols-[280px_minmax(0,1fr)_100px] ${open === d ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
                        <span className="flex items-center gap-2 truncate text-[16px]"><i className="inline-block h-3 w-3 flex-none rounded-sm border border-slate-200" style={{ background: COLOR[d] }} />{LABEL[d]}</span>
                        <span className="order-3 col-span-2 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className="block h-full rounded-full" style={{ width: `${(count(d) / maxD) * 100}%`, background: COLOR[d] }} /></span>
                        <span className="text-right text-[14px] font-semibold tabular-nums">{n(count(d))}</span>
                      </button>
                      {open === d && <RadarDrill base="/api/analytics/kita?list=1" query={ranKey} by="direction" value={d} label={LABEL[d]} />}
                    </li>
                  ))}
                </ol>
              </section></Reveal>

              {res.months.length > 1 && (
                <Reveal><section className="mt-12">
                  <h2 className="text-[22px] font-semibold">Im Zeitverlauf</h2>
                  {legend}
                  <div className="flex h-[150px] items-end gap-1.5 border-b border-slate-200" role="img" aria-label="Vorgänge zu Elternbeiträgen je Monat">
                    {res.months.map((m) => (
                      <div key={m.m} className="flex min-w-0 flex-1 flex-col-reverse items-center" title={ORDER.map((d) => `${LABEL[d]}: ${m[d]}`).join(", ")}>
                        {ORDER.map((d) => <span key={d} className="w-full max-w-[36px]" style={{ height: `${(m[d] / maxM) * 140}px`, background: COLOR[d] }} />)}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex gap-1.5 text-[12px] text-slate-500">{res.months.map((m) => <span key={m.m} className="min-w-0 flex-1 truncate text-center">{MONTH.format(new Date(m.m + "-01"))}</span>)}</div>
                </section></Reveal>
              )}

              {res.decisions.length > 0 && (
                <Reveal><section className="mt-12">
                  <h2 className="text-[22px] font-semibold">Jüngste Entscheidungen</h2>
                  <p className="mb-3 mt-1 text-[14px] text-slate-500">Ohne sonstige Änderungen der Satzung. Ein genannter Betrag steht zur Orientierung dabei.</p>
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {res.decisions.map((d) => (
                      <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-3">
                        <a href={`/beschluss/${d.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-700">
                          <span className="block truncate text-[16px]">{d.title}</span>
                          <span className="block truncate text-[12px] text-slate-500">{d.region} · {DAY.format(new Date(d.date))}{d.euro ? ` · genannt: ${d.euro} €` : ""}</span>
                        </a>
                        <span className="self-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium" style={{ background: d.direction === "Erhöhung" ? "#0f172a" : d.direction === "Verpflegung" ? "#e2e8f0" : "#ccfbf1", color: d.direction === "Erhöhung" ? "#fff" : "#0f172a" }}>{LABEL[d.direction]}</span>
                      </li>
                    ))}
                  </ol>
                </section></Reveal>
              )}

              {SHOW_PLACES && res.projects.length > 0 && (
                <Reveal><section className="mt-12">
                  <h2 className="text-[22px] font-semibold">Neue Kita-Plätze</h2>
                  <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Neubau, Erweiterung und zusätzliche Gruppen mit genannter Platzzahl. Bestand und Bedarfsplanungen zählen nicht; nicht jeder Ausbau nennt Plätze.</p>
                  <div className="grid gap-x-12 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <ol className="m-0 list-none border-t border-slate-200 p-0">
                      {res.projects.map((p) => (
                        <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-3">
                          <a href={`/beschluss/${p.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-700"><span className="block truncate text-[16px]">{p.title}</span><span className="block truncate text-[12px] text-slate-500">{p.region} · {DAY.format(new Date(p.date))}</span></a>
                          <span className="self-center text-right text-[14px] font-semibold tabular-nums">{n(p.places)} Plätze</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-8 md:mt-0">
                      <h3 className="text-[16px] font-semibold">Nach Gebiet</h3>
                      <ol className="m-0 mt-2 list-none border-t border-slate-200 p-0">
                        {res.placeRegions.map((r) => <li key={r.id} className="flex justify-between gap-3 border-b border-slate-200 py-2 text-[14px]"><span className="truncate">{r.name}</span><span className="tabular-nums"><b className="font-semibold">{n(r.places)}</b>{r.per1k !== null && <span className="ml-2 text-slate-500">{r.per1k.toLocaleString("de-DE")} je 1.000 EW</span>}</span></li>)}
                      </ol>
                    </div>
                  </div>
                </section></Reveal>
              )}

              <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Gelesen werden Titel und Volltext der Hauptdokumente: Elternbeiträge, Gebühren- und Beitragssatzungen nur mit Bezug zu Kita, Krippe oder Tagespflege (keine Straßen- oder Vereinsbeiträge); die Richtung aus Wörtern wie „erhöht“, „gesenkt“, „beitragsfrei“. Sammelpunkte wie Mitteilungen zählen nicht. <Link href="/analytics/ueber#methodik" className="text-teal-600">Methode →</Link></p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
