import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Laden } from "./Laden";
import { Befund } from "./Befund";
import { Reveal } from "./Reveal";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useAnalysisRun } from "./useAnalysisRun";
import { RadarDrill } from "./RadarDrill";
import { RegionMap } from "./RegionMap";
import { STATUS } from "../../lib/constants";
import { monthLabel, parseDate, plural } from "../../lib/text";
import { prettyTerm } from "../../lib/terms";

/* plenara.X Atlas auf der einen Abfrage (GET /api/x?view=atlas, server/integrations/plenara-x-query.mjs): je Thema die
   Unterthemen, was geschieht, der Verlauf, die Orte und die jüngsten Vorgänge; ohne Thema die 10 Themen. Gezählt werden
   Vorgänge (gleiche Titel je Gebiet einmal), Formalien nie; das Thema ist dasselbe wie im Themenfilter der Suche. */
interface Row { key: string; name: string; count: number; base: number; share: number | null; ags?: string; members?: string[] }
interface Item { id: string; title: string; region: string; date: string; status: string; stage: string | null; subs: string[]; times: number }
interface CompareRow { key: string; name: string; k: number; share: number; q1: number; median: number; q3: number; ratio: number | null; class: "mehr" | "weniger" | "ueblich" | null }
interface Compare { region: string; from: string; to: string; n: number; months: number; insufficient?: "items" | "months" | "group"; rule: { minItems: number; minMonths: number; minTopic: number }; group?: { label: string; n: number }; rows?: CompareRow[] }
interface Result { selection: { theme: string; sub: string; stage: string; q: string }; total: number; unread: number; parts: Row[]; stages: Row[]; months: Row[]; regions: Row[]; recent: Item[]; compare: Compare | null; facts: Fact[] }
interface Fact { kind: string; name: string; sum: { kind: string; name: string } | null; rows: (Row & { sum?: number; median?: { median: number; unit: string; n: number } })[]; map: { key: string; ags?: string; n: number; v: Record<string, { n: number; median: number; unit: string }> }[] }

const n = (v: number) => v.toLocaleString("de-DE");
const num = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 2 });
const pct = (v: number | null) => (v === null ? "–" : `${v.toLocaleString("de-DE")} %`);
const MONTH = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });
const day = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : "");
const statusLabel = (id: string) => STATUS.find((s) => s.id === id)?.label ?? "";
/* Orte erst ab so vielen Sachvorgängen in der Rangliste nach Anteil (sonst führen Orte mit 2 von 3 Vorgängen) */
const MIN_BASE = 30;
/* Restposten („Noch nicht eingeordnet“, „Sonstiges“, „Sonstiger Schritt“): grau und ans Ende der Liste */
const isRest = (r: Row) => r.key === "unklar" || r.key === "sonst" || /^Sonstige/.test(r.name);
const restLast = <T extends Row>(rows: T[]) => [...rows.filter((r) => !isRest(r)), ...rows.filter(isRest)];

/**
 * Eine Balkenliste. mode "expand": Klick öffnet die Vorgänge hinter der Zahl (aria-expanded); mode "select": Klick wählt den
 * Eintrag (aria-pressed, gewählter Eintrag dunkel). Restposten sind in der Auswahlliste nur Text.
 */
function Bars({ rows, mode, open = "", onOpen, drill = () => null, value = (r) => r.count, label = (r) => n(r.count) }: {
  rows: Row[]; mode: "expand" | "select"; open?: string; onOpen: (key: string) => void; drill?: (r: Row) => React.ReactNode;
  value?: (r: Row) => number; label?: (r: Row) => string;
}) {
  const max = Math.max(1, ...rows.map(value));
  const grid = "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 text-left sm:grid-cols-[260px_minmax(0,1fr)_minmax(120px,auto)]";
  return (
    <ol className="m-0 list-none border-t border-slate-200 p-0">
      {rows.map((r) => {
        const rest = isRest(r), on = open === r.key;
        const inner = (
          <>
            <span className={`truncate text-[16px] ${rest ? "text-slate-500" : ""} ${mode === "select" && on ? "font-semibold" : ""}`}>{r.name}</span>
            <span className="order-3 col-span-2 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1">
              <span className={`block h-full rounded-full ${rest ? "bg-slate-300" : mode === "select" && on ? "bg-slate-900" : "bg-teal-600"}`} style={{ width: `${(value(r) / max) * 100}%` }} />
            </span>
            <span className="text-right text-[14px] font-semibold tabular-nums">{label(r)}</span>
          </>
        );
        return (
          <li key={r.key} className="border-b border-slate-200">
            {mode === "select" && rest ? <div className={grid}>{inner}</div>
              : mode === "select" ? <button type="button" onClick={() => onOpen(r.key)} aria-pressed={on} className={grid}>{inner}</button>
              : <button type="button" onClick={() => onOpen(r.key)} aria-expanded={on} className={grid}>{inner}</button>}
            {mode === "expand" && on && drill(r)}
          </li>
        );
      })}
    </ol>
  );
}

/* Karte der Orte, oben unter der Suche. Ohne Fakt: Vorgänge der Auswahl je Gebiet. Mit Fakt: Vorgänge mit diesem Wert je Gebiet
   oder, bei Beträgen und Sätzen, der Median im Gebiet, in Vierteln über alle Gebiete eingefärbt; wo hohe Werte Kosten für die
   Bürger sind (Steuern, Gebühren, Beiträge, Preise), von grün nach rot. Gemeindeverbände färben ihre Mitgliedsgemeinden, die
   Kreise fassen alle Gebiete im Kreis zusammen (Summe, bei Kennzahlen der Median der Gebiete). */
const STUFE = (c: number) => (c >= 5 ? 4 : c >= 3 ? 3 : c);
const HIGH_BAD = new Set(["hebesatz", "fee_rate", "park_fee", "dog_tax", "kita_fee", "land_price"]);
const GREEN_RED = ["#2f9e44", "#a9c934", "#f59f00", "#e03131"];
const mid = (vs: number[]) => { const s = [...vs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quart = (vs: number[], q: number) => { const s = [...vs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
function AtlasMap({ regions, facts, onList, listed, drill }: { regions: Row[]; facts: Fact[]; onList: (id: string) => void; listed: string; drill: (r: Row) => React.ReactNode }) {
  const [level, setLevel] = useState<"city" | "district">("city");
  const [picked, setPicked] = useState("");
  const [kind, setKind] = useState("");
  const [metric, setMetric] = useState("");
  const fact = facts.find((f) => f.kind === kind);
  const metrics = fact ? [...new Set(fact.map.flatMap((m) => Object.keys(m.v)))].sort((a, b) => fact.map.filter((m) => m.v[b]).length - fact.map.filter((m) => m.v[a]).length) : [];
  const metricOn = metrics.includes(metric) ? metric : "";
  const { levels, byAgs, legend, unit, colors } = useMemo(() => {
    const fact = facts.find((f) => f.kind === kind);
    const unit = metricOn && fact ? fact.map.find((m) => m.v[metricOn])?.v[metricOn].unit ?? "" : "";
    /* Wert je Gebiet (Schlüssel des Katalogs) */
    const val = new Map<string, number>(), memberVal: [string, string, number][] = [];
    if (!fact) for (const r of regions) val.set(r.key, r.count);
    /* Einträge mit ags gehören zu einer genannten Mitgliedsgemeinde eines Verbands und färben nur sie */
    else for (const m of fact.map) { const x = metricOn ? m.v[metricOn]?.median : m.n; if (x === undefined) continue; if (m.ags) memberVal.push([m.key, m.ags, x]); else val.set(m.key, x); }
    const rowOf = new Map(regions.map((r) => [r.key, r]));
    /* Fläche (Gemeinde- oder Kreisschlüssel) → Wert, Name, Katalog-Schlüssel */
    const area = new Map<string, { v: number; name: string; key: string; count: number; share: number | null; base: number }>();
    if (level === "district") {
      const acc = new Map<string, number[]>();
      /* Kennzahlen nur vom Kreis selbst (Kreistag), sonst färbte ein einzelner Ort den ganzen Kreis; Anzahl als Summe aller Gebiete */
      for (const [k, v] of val) { const a = rowOf.get(k)?.ags; if (a && (metricOn ? a.length === 5 : a.length >= 5)) acc.set(a.slice(0, 5), [...(acc.get(a.slice(0, 5)) ?? []), v]); }
      for (const [a, vs] of acc) { const own = regions.find((r) => r.ags === a); area.set(a, { v: metricOn ? mid(vs) : vs.reduce((x, y) => x + y, 0), name: own?.name ?? `Kreis ${a}`, key: own?.key ?? "", count: vs.length, share: null, base: 0 }); }
    } else {
      for (const [k, v] of val) {
        const r = rowOf.get(k); if (!r) continue;
        const own = r.ags?.length === 8 ? [r.ags] : [];
        for (const a of [...own, ...(r.members ?? []).filter((m) => m.length === 8)]) if (!area.has(a) || own.includes(a)) area.set(a, { v, name: r.name, key: r.key, count: r.count, share: r.share, base: r.base });
      }
      for (const [k, a, v] of memberVal) { const r = rowOf.get(k); if (r && a.length === 8) area.set(a, { v, name: `${r.name}: Mitgliedsgemeinde`, key: r.key, count: r.count, share: r.share, base: r.base }); }
    }
    const vs = [...area.values()].map((x) => x.v);
    let cut: number[] = [], legend = ["1 Vorgang", "2 Vorgänge", "3 bis 4 Vorgänge", "5 und mehr"];
    if (metricOn && vs.length) { cut = [quart(vs, 0.25), quart(vs, 0.5), quart(vs, 0.75)]; legend = [`bis ${num(cut[0])}`, `bis ${num(cut[1])}`, `bis ${num(cut[2])}`, `über ${num(cut[2])}`].map((l) => `${l} ${unit}`); }
    const levels: Record<string, number> = {}, byAgs = new Map<string, { v: number; name: string; key: string; count: number; share: number | null; base: number }>();
    for (const [a, x] of area) { levels[a] = metricOn ? (x.v <= cut[0] ? 1 : x.v <= cut[1] ? 2 : x.v <= cut[2] ? 3 : 4) : STUFE(x.v); byAgs.set(a, x); }
    return { levels, byAgs, legend, unit, colors: metricOn && HIGH_BAD.has(kind) ? GREEN_RED : undefined };
  }, [regions, facts, metricOn, level, kind]);
  const sel = picked ? byAgs.get(picked) : undefined;
  const chip = (on: boolean) => `h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-[14px] transition-colors ${on ? "border-teal-600 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`;
  const row = "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0";
  const listedRow = listed ? regions.find((r) => r.key === listed) : undefined;
  const what = !fact ? "Vorgänge der Auswahl" : metricOn ? `Median „${metricOn}“ der Vorgänge` : `Vorgänge mit Wert „${fact.name}“`;
  const valueText = (x: { v: number; count: number }) => metricOn ? `Median ${num(x.v)} ${unit}` : `${n(x.v)} ${plural(x.v, "Vorgang", "Vorgänge")}`;
  return (
    <section className="mt-6">
      <div className="relative">
        <RegionMap level={level} levels={levels} picked={picked} onPick={(a) => setPicked(picked === a ? "" : a)} legend={legend} colors={colors}
          note={metricOn ? `Viertel über alle Gebiete${HIGH_BAD.has(kind) ? "; rot: hoch" : ""}${level === "district" ? "; nur Werte der Kreise selbst" : ""}` : "ohne Farbe: keine Vorgänge"}
          label={`Karte: ${what} je ${level === "district" ? "Kreis" : "Gemeinde"}`}
          info={sel ? <>
            <b className="font-semibold">{sel.name}</b><br />
            <span className="text-slate-500">{valueText(sel)}</span>
            {sel.key && <><br /><button type="button" onClick={() => onList(sel.key)} className="pointer-events-auto mt-1 text-[14px] font-medium text-teal-700 hover:underline">{listed === sel.key ? "Vorgänge ausblenden" : "Vorgänge zeigen →"}</button></>}
          </> : picked ? <span className="text-slate-500">Hier gibt es keine Werte zur Auswahl.</span> : undefined} />
      </div>
      <p className="mb-2 mt-3 text-[14px] text-slate-500">Die Karte zeigt {what} je {level === "district" ? "Kreis" : "Gemeinde"}. Klick auf ein Gebiet zeigt den Wert und die Vorgänge.</p>
      <div className={row} role="group" aria-label="Was die Karte zeigt">
        <button type="button" aria-pressed={!fact} onClick={() => { setKind(""); setMetric(""); setPicked(""); }} className={chip(!fact)}>Alle Vorgänge</button>
        {facts.filter((f) => f.map.length).map((f) => <button key={f.kind} type="button" aria-pressed={kind === f.kind} onClick={() => { setKind(f.kind); const m = [...new Set(f.map.flatMap((x) => Object.keys(x.v)))]; setMetric(m.length ? m.sort((a, b) => f.map.filter((x) => x.v[b]).length - f.map.filter((x) => x.v[a]).length)[0] : ""); setPicked(""); }} className={chip(kind === f.kind)}>{f.name}</button>)}
      </div>
      {fact && <div className={row + " mt-2"} role="group" aria-label="Kennzahl">
        <button type="button" aria-pressed={!metricOn} onClick={() => setMetric("")} className={chip(!metricOn)}>Anzahl</button>
        {metrics.map((m) => <button key={m} type="button" aria-pressed={metricOn === m} onClick={() => setMetric(m)} className={chip(metricOn === m)}>{m}</button>)}
      </div>}
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Ebene der Karte">
        {([["city", "Gemeinden"], ["district", "Kreise"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => { setLevel(k); setPicked(""); }} className={chip(level === k)}>{l}</button>)}
      </div>
      {listedRow && <div className="mt-3">{drill(listedRow)}</div>}
    </section>
  );
}

const KLASSE = { mehr: "häufiger als üblich", weniger: "seltener als üblich", ueblich: "im üblichen Bereich" };
const ZU_WENIG = { items: "zu wenige Sachvorgänge", months: "zu wenige Monate mit Sitzungen", group: "keine ausreichend große Vergleichsgruppe" };

/** Ort im Vergleich: Anteil je Unterthema (ohne Thema: je Thema) an allen Sachvorgängen des eigenen Rats, eingeordnet in der Gruppe */
function OrtImVergleich({ c, theme }: { c: Compare; theme: string }) {
  if (c.insufficient) return (
    <section className="mt-10"><h2 className="text-[22px] font-semibold">{c.region} im Vergleich</h2>
      <p className="mt-2 max-w-[760px] text-[16px]">Keine Einordnung möglich: {ZU_WENIG[c.insufficient]} ({n(c.n)} Sachvorgänge in {n(c.months)} Monaten; nötig sind {n(c.rule.minItems)} in {n(c.rule.minMonths)} Monaten).</p></section>
  );
  const rows = [...(c.rows ?? [])].sort((a, b) => (b.class === "mehr" ? 2 : b.class === "weniger" ? 1 : 0) - (a.class === "mehr" ? 2 : a.class === "weniger" ? 1 : 0) || b.share - a.share);
  return (
    <section className="mt-10">
      <h2 className="text-[22px] font-semibold">{c.region} im Vergleich</h2>
      <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Anteil an allen {n(c.n)} Sachvorgängen des eigenen Rats in den letzten 12 Monaten, verglichen mit {n(c.group!.n)} {c.group!.label}. „Üblich“ ist die mittlere Hälfte der Gruppe; eingeordnet wird erst ab {n(c.rule.minTopic)} Vorgängen und nur bei klarem Abstand. Dieser Vergleich gilt immer für 12 Monate und nur den eigenen Rat; die Zahlen darunter folgen Zeitraum und Filtern der Suche und können deshalb abweichen.</p>
      <ol className="m-0 list-none border-t border-slate-200 p-0">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-slate-200 py-2.5 sm:grid-cols-[260px_minmax(0,1fr)_auto]">
            <span className="truncate text-[16px]">{r.name}</span>
            <span className="order-3 col-span-2 text-[12px] text-slate-500 sm:order-none sm:col-span-1">üblich {pct(r.q1)} bis {pct(r.q3)}</span>
            <span className="text-right text-[14px] tabular-nums"><b className="font-semibold">{pct(r.share)}</b>
              <span className={`ml-2 ${r.class === "mehr" || r.class === "weniger" ? "text-slate-900" : "text-slate-500"}`}>{r.class ? KLASSE[r.class] + (r.ratio ? ` (${r.ratio.toLocaleString("de-DE")}-fach)` : "") : `${n(r.k)} Vorgänge`}</span></span>
          </li>
        ))}
      </ol>
      {!theme && <p className="mt-2 text-[12px] text-slate-500">Thema wählen, um die Unterthemen zu vergleichen.</p>}
    </section>
  );
}

/**
 * theme: eines der 10 Themen oder "" (alle); sub: Unterthema oder ""; stage: Wert von „Was geschieht“ oder "".
 * term: Suchbegriff aus einem geteilten Link (?q=), wird beim Öffnen einmal in die Suche übernommen.
 */
export function XAtlasView({ theme, sub, stage, term, onTheme, onSub }: { theme: string; sub: string; stage: string; term: string | null; onTheme: (id: string) => void; onSub: (id: string) => void }) {
  const { query, search } = useAnalyticsQuery();
  const sel = [theme && `theme=${theme}`, sub && `sub=${sub}`, stage && `stage=${stage}`].filter(Boolean).join("&");
  const url = `/api/x?view=atlas${sel ? "&" + sel : ""}&${query}`;
  const { res, ranKey, loading, error, stale, run } = useAnalysisRun<Result>({ key: url, url, initial: !term, onDone: () => setOpen("") });
  /* Aufgeklappte Liste: "stage:bau", "month:2026-05", "region:<id>", "fact:plan:Aufstellung" */
  const [open, setOpen] = useState("");
  /* Andere Auswahl (Thema, Unterthema, „Was geschieht“): gleich neu rechnen; das alte Ergebnis bleibt abgeblendet stehen */
  const [ranSel, setRanSel] = useState(sel);
  if (ranSel !== sel) {
    setRanSel(sel);
    setOpen("");
    run();
  }
  /* Begriff aus dem Link: in die Suche übernehmen und mit ihm rechnen (wie run() zusammen mit applySearch im selben Klick) */
  useEffect(() => {
    if (!term) return;
    search.applySearch(term);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggle = (key: string) => setOpen(open === key ? "" : key);
  const listBase = `/api/x?list=1${sel ? "&" + sel : ""}`;
  /* Filter der zuletzt ausgewerteten Abfrage ohne Auswahl und Ansicht (die stehen in listBase) */
  const listQuery = (() => { const p = new URLSearchParams(ranKey.split("?")[1] ?? ""); for (const k of ["view", "theme", "sub", "stage"]) p.delete(k); return p.toString(); })();
  const drill = (by: string, r: Row, label = r.name) => <RadarDrill base={listBase} query={listQuery} by={by} value={r.key} label={label} />;
  const opened = (by: string) => (open.startsWith(by + ":") ? open.slice(by.length + 1) : "");

  const total = res?.total ?? 0;
  /* Mit gewähltem Unterthema zeigt die Liste, wie oft die übrigen Unterthemen mit ihm zusammen vorkommen (Anteil an seinen Vorgängen) */
  const subName = sub ? res?.parts.find((p) => p.key === sub)?.name ?? "" : "";
  const parts = restLast(res?.parts ?? []).map((p) => (sub && total ? { ...p, share: Math.round((1000 * p.count) / total) / 10 } : p));
  const allRegions = res?.regions ?? [];
  /* Ohne Auswahl ist der Anteil überall 100 %, mit nur einem Gebiet (Ort gewählt) gibt es nichts zu vergleichen */
  const rankRegions = !!(theme || sub || stage) && allRegions.length > 1;
  const regions = rankRegions ? allRegions.filter((r) => r.base >= MIN_BASE).sort((a, b) => (b.share ?? 0) - (a.share ?? 0)).slice(0, 15) : [];
  const stages = restLast((res?.stages ?? []).filter((s) => s.key !== ""));
  const maxM = Math.max(1, ...(res?.months ?? []).map((m) => m.count));
  const month = opened("month");
  /* Monatsachse: auf dem Handy nur jeder dritte Monat beschriftet (vom jüngsten aus gezählt), sonst wäre jeder Name abgeschnitten */
  const nMonths = res?.months.length ?? 0;
  const where = allRegions.length === 1 ? `in ${allRegions[0].name}` : `in ${n(allRegions.length)} ${plural(allRegions.length, "Gebiet", "Gebieten")}`;

  return (
    <section aria-label="Auswertung des Themas">
      <div className="mt-4 print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} startLabel="Auswerten" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu auswerten.</p>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}
      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {res.total === 0 ? <p className="mt-10 text-[16px]">Für diese Auswahl gibt es keine Vorgänge.</p> : (
            <>
              {allRegions.length > 0 && <AtlasMap regions={allRegions} facts={res.facts} listed={opened("map")} onList={(id) => toggle(`map:${id}`)} drill={(r) => drill("region", r)} />}

              <Befund>{`${n(res.total)} ${plural(res.total, "Vorgang", "Vorgänge")} ${where}${res.selection.q ? ` zur Suche „${prettyTerm(res.selection.q)}“` : ""}.`}</Befund>

              {res.compare && <Reveal><OrtImVergleich c={res.compare} theme={theme} /></Reveal>}

              <Reveal><section className="mt-10">
                <h2 className="text-[22px] font-semibold">{sub ? `Überschneidungen mit „${subName}“` : theme ? "Unterthemen" : "Themen"}</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">{sub
                  ? `Wie viele der ${n(total)} Vorgänge zu „${subName}“ auch andere Unterthemen haben; Anteil an diesen ${n(total)} Vorgängen. Klick wählt ein anderes Unterthema.`
                  : theme
                    ? "Ein Vorgang kann mehrere Unterthemen haben; erkannt am Titel, sonst an Betreff und Beschlussvorschlag. Klick wählt das Unterthema."
                    : "Vorgänge je Thema; das Thema ist dasselbe wie im Themenfilter der Suche. Klick wählt das Thema."}</p>
                {theme && sub && <button type="button" onClick={() => onSub("")} className="mb-3 text-[14px] font-medium text-teal-700 hover:underline">Alle Unterthemen zeigen →</button>}
                <Bars rows={parts} mode="select" open={sub} onOpen={(k) => (theme ? onSub(k === sub ? "" : k) : onTheme(k))}
                  label={(r) => `${n(r.count)}${r.share !== null && theme ? ` · ${pct(r.share)}` : ""}`} />
              </section></Reveal>

              {stages.length > 1 && <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Was geschieht</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Art der Vorgänge, aus dem Titel gelesen (Antrag, Planung, Vergabe, Bau …). Klick zeigt die Vorgänge.</p>
                <Bars rows={stages} mode="expand" open={opened("stage")} onOpen={(k) => toggle(`stage:${k}`)} drill={(r) => drill("stage", r)} />
              </section></Reveal>}

              {nMonths > 1 && <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Im Zeitverlauf</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Vorgänge je Monat der Sitzung. Klick auf einen Monat zeigt seine Vorgänge.</p>
                <div className="flex h-[150px] items-end gap-1.5 border-b border-slate-200">
                  {res.months.map((m) => <button type="button" key={m.key} onClick={() => toggle(`month:${m.key}`)} aria-expanded={month === m.key} aria-label={`${monthLabel(m.key)}: ${n(m.count)} Vorgänge`}
                    className="flex h-full min-w-0 flex-1 items-end"><span className={`block w-full rounded-t ${month === m.key ? "bg-slate-900" : "bg-teal-600"}`} style={{ height: `${(m.count / maxM) * 100}%` }} /></button>)}
                </div>
                <div aria-hidden="true" className="mt-1 flex gap-1.5 text-[12px] text-slate-500">{res.months.map((m, i) => (
                  <span key={m.key} className={`min-w-0 flex-1 text-center sm:truncate ${(nMonths - 1 - i) % 3 === 0 ? "max-sm:flex max-sm:justify-center max-sm:whitespace-nowrap" : "max-sm:invisible"}`}>{MONTH.format(parseDate(m.key + "-01"))}</span>
                ))}</div>
                {month && <div className="mt-3">{drill("month", res.months.find((m) => m.key === month)!, monthLabel(month))}</div>}
              </section></Reveal>}

              {res.facts.length > 0 && <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Werte aus den Unterlagen</h2>
                <p className="mb-1 mt-1 max-w-[760px] text-[14px] text-slate-500">Aus den Texten der Unterlagen gelesen; gezeigt wird nur, was in Stichproben zu mindestens 90 % stimmte. Bei Beträgen und Sätzen steht der Median der Vorgänge dabei. Klick zeigt die Vorgänge mit ihrem Wert.</p>
                {res.facts.map((f) => (
                  <div key={f.kind} className="mt-6">
                    <h3 className="mb-2 text-[16px] font-semibold">{f.name}</h3>
                    <Bars rows={restLast(f.rows)} mode="expand" open={opened("fact:" + f.kind)} onOpen={(k) => toggle(`fact:${f.kind}:${k}`)} drill={(r) => drill("fact:" + f.kind, r)}
                      label={(r) => { const x = r as Fact["rows"][number]; return `${n(r.count)}${f.sum ? ` · ${n(x.sum ?? 0)} ${f.sum.name}` : ""}${x.median ? ` · Median ${num(x.median.median)} ${x.median.unit}` : ""}`; }} />
                  </div>
                ))}
              </section></Reveal>}

              {rankRegions && <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Wo das Thema viel Raum hat</h2>
                <p className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">Anteil an allen Sachvorgängen des Gebiets (gleiche Filter), nur Gebiete mit mindestens {MIN_BASE} Sachvorgängen. Klick zeigt die Vorgänge.</p>
                {regions.length ? <Bars rows={regions} mode="expand" open={opened("region")} onOpen={(k) => toggle(`region:${k}`)} drill={(r) => drill("region", r)} value={(r) => r.share ?? 0}
                  label={(r) => `${pct(r.share)} · ${n(r.count)}`} /> : <p className="text-[14px] text-slate-500">Kein Gebiet hat genug Sachvorgänge für einen Vergleich.</p>}
              </section></Reveal>}
              {!(theme || sub || stage) && allRegions.length > 1 && <p className="mt-12 text-[14px] text-slate-500">Thema wählen, um zu sehen, wo es viel Raum hat.</p>}

              <Reveal><section className="mt-12">
                <h2 className="text-[22px] font-semibold">Jüngste Vorgänge</h2>
                <ol className="m-0 mt-3 list-none border-t border-slate-200 p-0">
                  {res.recent.map((r) => (
                    <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-3">
                      <Link href={`/beschluss/${r.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-800">
                        <span className="block truncate text-[16px]">{r.title}</span>
                        <span className="block truncate text-[12px] text-slate-500">{[r.region, day(r.date), r.times > 1 && `in ${r.times} Sitzungen`].filter(Boolean).join(" · ")}</span>
                      </Link>
                      <span className="self-center text-right text-[12px] text-slate-500">{statusLabel(r.status)}</span>
                    </li>
                  ))}
                </ol>
              </section></Reveal>

              <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Gezählt werden Vorgänge: derselbe Titel in mehreren Gremien eines Gebiets zählt einmal. Formalien, Sammelpunkte, Besetzungen und Fragestunden zählen nicht.{res.unread ? ` ${n(res.unread)} Vorgänge sind noch nicht mit ihren Unterlagen gelesen; sie zählen beim Thema, aber noch ohne Unterthema und ohne „Was geschieht“.` : ""}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
