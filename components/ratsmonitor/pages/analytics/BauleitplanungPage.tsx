import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { Befund, zuThema } from "./Befund";
import { Reveal } from "./Reveal";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RadarDrill } from "./RadarDrill";
import { RegionMap } from "./RegionMap";
import { STATUS } from "../../lib/constants";

interface Plan { id: string; title: string; region: string; date: string; stage: string; type: string; we: number | null }
interface Region { id: string; name: string; pop: number | null; plans: number; adopted: number; started: number; we: number; weKnown: number; plansPer10k: number | null; wePer1k: number | null }
interface Result {
  q: string;
  totals: { topics: number; plans: number; adopted: number; regions: number; we: number; weKnown: number };
  plansByStage: { name: string; n: number }[];
  months: { m: string; Aufstellung: number; Offenlage: number; Satzungsbeschluss: number }[];
  regions: Region[]; housingRegions: Region[]; housingPlans: Plan[]; adopted: Plan[];
  rule: { minPop: number; minPlans: number };
  uses?: { name: string; plans: number; adopted: number; regions: number; inter: number }[];
  usePlans?: UsePlan[];
}
interface UsePlan { id: string; title: string; region: string; date: string; stage: string; status: string; uses: string[]; inter: boolean; ags: string[] }

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

/* Gewerbe und Wirtschaft: die Arten, die zusammen „Wirtschaftsflächen“ ergeben */
const ECONOMY = ["Gewerbe", "Industrie", "Logistik", "Einzelhandel", "Rechenzentrum"];
const IN_PROGRESS = ["Aufstellung", "Frühzeitige Beteiligung", "Offenlage", "Abwägung"];
const statusLabel = (id: string) => STATUS.find((s) => s.id === id)?.label ?? "";

/** Gewerbe, Industrie, Energie, Handel: Karte auf Gemeindeebene und Liste der Pläne, nach Art und Verfahrensstand */
function Uses({ uses, plans }: { uses: NonNullable<Result["uses"]>; plans: UsePlan[] }) {
  const [use, setUse] = useState("Wirtschaft");
  const [step, setStep] = useState<"" | "laufend" | "beschlossen">("");
  const [picked, setPicked] = useState("");
  const [all, setAll] = useState(false);
  const fits = (p: UsePlan) => (use === "Wirtschaft" ? p.uses.some((u) => ECONOMY.includes(u)) : p.uses.includes(use)) && (!step || (step === "beschlossen" ? p.stage === "Satzungsbeschluss" : IN_PROGRESS.includes(p.stage)));
  const list = plans.filter(fits);
  const levels = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of list) for (const a of p.ags) c[a] = (c[a] || 0) + 1;
    for (const a in c) c[a] = c[a] >= 5 ? 4 : c[a] >= 3 ? 3 : c[a] === 2 ? 2 : 1;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [use, step, plans]);
  const shown = (picked ? list.filter((p) => p.ags.includes(picked)) : list);
  const chips: [string, number][] = [["Wirtschaft", plans.filter((p) => p.uses.some((u) => ECONOMY.includes(u))).length], ...uses.map((u) => [u.name, u.plans] as [string, number])];
  const chip = (on: boolean) => `h-9 rounded-full border px-4 text-[14px] transition-colors ${on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`;
  return (
    <Reveal><section className="mt-12">
      <h2 className="text-[22px] font-semibold">Gewerbe, Industrie, Energie: wo wird geplant?</h2>
      <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Art des Plangebiets aus Titel und Planname (etwa „Gewerbegebiet Nord“, „SO Photovoltaik“), sonst aus dem Beschlussvorschlag. „Wirtschaft“ fasst Gewerbe, Industrie, Logistik, Einzelhandel und Rechenzentren zusammen. Die Karte zeigt die Gemeinde, nicht die Lage im Ort; die steht im Plannamen. Klick auf eine Gemeinde zeigt ihre Pläne.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Art des Plangebiets">
        {chips.filter(([, k]) => k > 0).map(([name, k]) => <button key={name} type="button" aria-pressed={use === name} onClick={() => { setUse(name); setPicked(""); setAll(false); }} className={chip(use === name)}>{name} <span className="tabular-nums opacity-80">{n(k)}</span></button>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Verfahrensstand">
        {([["", "Alle Schritte"], ["laufend", "Im Verfahren"], ["beschlossen", "Satzungsbeschluss"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={step === k} onClick={() => { setStep(k); setPicked(""); setAll(false); }} className={chip(step === k)}>{l}</button>)}
      </div>
      <div className="mt-4">
        <RegionMap levels={levels} legend={["1 Plan", "2 Pläne", "3 bis 4 Pläne", "5 und mehr"]} label={`Karte: Gemeinden mit Plänen der Art ${use}`} picked={picked} onPick={(a) => { setPicked(picked === a ? "" : a); setAll(false); }}
          info={picked ? <><b className="font-semibold">{shown[0]?.region ?? "Keine Pläne"}</b><br /><span className="text-slate-500">{n(shown.length)} {shown.length === 1 ? "Plan" : "Pläne"} · Klick erneut hebt die Auswahl auf</span></> : undefined} />
      </div>
      <p className="mt-3 text-[14px] text-slate-500">{`${n(shown.length)} ${shown.length === 1 ? "Plan" : "Pläne"}${picked ? " in der gewählten Gemeinde" : ""}${list.filter((p) => !p.ags.length).length && !picked ? `, davon ${n(list.filter((p) => !p.ags.length).length)} von Kreisen ohne Lage auf der Karte` : ""}.`}{picked && <> <button type="button" onClick={() => setPicked("")} className="text-teal-700 hover:underline">Alle Gemeinden zeigen</button></>}</p>
      <ol className="m-0 mt-2 list-none border-t border-slate-200 p-0">
        {(all ? shown : shown.slice(0, 10)).map((p) => (
          <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-3">
            <a href={`/beschluss/${p.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-700">
              <span className="block text-[14px] leading-snug sm:truncate sm:text-[16px]">{p.title}</span>
              <span className="block truncate text-[12px] text-slate-500">{[p.region, DAY.format(new Date(p.date)), p.uses.join(", "), p.inter && "interkommunal"].filter(Boolean).join(" · ")}</span>
            </a>
            <span className="self-center text-right text-[12px] text-slate-500"><span className="block text-[14px] text-slate-900">{p.stage}</span>{statusLabel(p.status) && <span className="block">{statusLabel(p.status)}</span>}</span>
          </li>
        ))}
      </ol>
      {shown.length > 10 && <button type="button" onClick={() => setAll(!all)} className="mt-2 text-[14px] text-teal-700 hover:underline">{all ? "Weniger zeigen" : `Alle ${n(shown.length)} zeigen`}</button>}
    </section></Reveal>
  );
}

/* Wohneinheiten vorerst nicht zeigen: sie stehen nur bei rund 1 % der Pläne im Hauptdokument, und Summen für die ganze Stadt
   werden einzelnen Plänen zugeschrieben (Bewertung 11.10.2026). Die Daten liefert die Auswertung weiter. */
const SHOW_HOUSING = false;

/** plenara.X – Bauleitplanung: Pläne nach Verfahrensschritt, Gebiete mit viel Planung, geplanter Wohnungsbau */
export function BauleitplanungPage() {
  const { query } = useAnalyticsQuery();
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [want, setWant] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  /* Aufgeklappte Liste hinter einer Zahl: "stage:Offenlage", "region:<id>" */
  const [open, setOpen] = useState("");
  const toggle = (key: string) => setOpen(open === key ? "" : key);
  const drill = (by: string, value: string, label: string) => open === `${by}:${value}` && <RadarDrill base="/api/analytics/bauleitplanung?list=1" query={ranKey} by={by} value={value} label={label} unit={["Plan", "Pläne"]} />;

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
      .then((r) => { setRes(r); setRanKey(query); setOpen(""); setLoading(false); })
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
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Welche Bebauungs- und Flächennutzungspläne in welchem Verfahrensschritt sind, wo viel geplant wird und wo Gewerbe-, Industrie- und Energieflächen entstehen.</p>
      </PageBand>

      <div className="print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && setWant(true)} onSubmit={() => setWant(true)} startLabel="Auswerten" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu auswerten.</p>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {res.totals.plans === 0 ? <p className="mt-10 text-[16px]">Für diese Suche ist kein Bauleitplan erkannt.</p> : (
            <>
              <Befund>{`${zuThema(res.q)[0].toUpperCase()}${zuThema(res.q).slice(1)} sind ${n(res.totals.plans)} Bauleitpläne in ${n(res.totals.regions)} Gebieten in Arbeit, ${n(res.totals.adopted)} davon mit Satzungsbeschluss.${SHOW_HOUSING && res.totals.we ? ` Genannt sind ${n(res.totals.we)} geplante Wohneinheiten.` : ""}`}</Befund>
              <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                {[["Pläne", n(res.totals.plans)], ["Satzungsbeschlüsse", n(res.totals.adopted)], ["Gebiete", n(res.totals.regions)], SHOW_HOUSING ? ["Geplante Wohneinheiten", n(res.totals.we)] : ["Vorgänge", n(res.totals.topics)]].map(([k, v], i) => (
                  <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Pläne nach Verfahrensschritt</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Jeder Plan einmal, mit dem weitesten Schritt im Zeitraum. Ein Plan läuft meist über mehrere Sitzungen und Gremien. Klick auf einen Schritt zeigt die Pläne.</p>
                <ol className="m-0 list-none border-t border-slate-200 p-0">
                  {stages.filter((s) => s.n > 0).map((s) => (
                    <li key={s.name} className="border-b border-slate-200">
                      <button type="button" onClick={() => toggle(`stage:${s.name}`)} aria-expanded={open === `stage:${s.name}`} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left sm:grid-cols-[240px_minmax(0,1fr)_100px] ${open === `stage:${s.name}` ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
                        <span className="flex items-center gap-2 truncate text-[16px]"><i className="inline-block h-3 w-3 flex-none rounded-sm" style={{ background: STEP_COLOR[s.name] }} />{s.name}</span>
                        <span className="order-3 col-span-2 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className="block h-full rounded-full" style={{ width: `${(s.n / maxS) * 100}%`, background: STEP_COLOR[s.name] }} /></span>
                        <span className="text-right text-[14px] font-semibold tabular-nums">{n(s.n)}</span>
                      </button>
                      {drill("stage", s.name, s.name)}
                    </li>
                  ))}
                </ol>
              </section></Reveal>

              {res.uses && res.uses.length > 0 && res.usePlans && <Uses uses={res.uses} plans={res.usePlans} />}

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
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Pläne je 10.000 Einwohner; nur Gebiete ab {n(res.rule.minPop)} Einwohnern mit mindestens {res.rule.minPlans} Plänen. Klick auf ein Gebiet zeigt seine Pläne.</p>
                {res.regions.length === 0 ? <p className="text-[14px] text-slate-500">Zu wenige Gebiete für einen Vergleich.</p> : (
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {res.regions.map((r, i) => (
                      <li key={r.id} className="border-b border-slate-200">
                        <button type="button" onClick={() => toggle(`region:${r.id}`)} aria-expanded={open === `region:${r.id}`} className={`grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 py-3 text-left sm:grid-cols-[28px_280px_minmax(0,1fr)_190px] ${open === `region:${r.id}` ? "bg-teal-50/60" : "hover:bg-slate-50"}`}>
                          <span className="text-[14px] tabular-nums text-slate-500">{i + 1}</span>
                          <span className="truncate text-[16px]">{r.name}</span>
                          <span className="order-4 col-span-3 mt-1.5 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1 sm:mt-0"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${((r.plansPer10k ?? 0) / maxR) * 100}%` }} /></span>
                          <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{(r.plansPer10k ?? 0).toLocaleString("de-DE")}</b><span className="ml-2 text-slate-500">{n(r.plans)} Pläne · {n(r.adopted)} beschl.</span></span>
                        </button>
                        {drill("region", r.id, r.name)}
                      </li>
                    ))}
                  </ol>
                )}
              </section></Reveal>

              {SHOW_HOUSING && (
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
              )}

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
