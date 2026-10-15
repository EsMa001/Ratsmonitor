import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { THEMES, SUBTOPICS } from "@/shared/themes.mjs";
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
   Unterthemen, der Verlauf, die Orte und die jüngsten Vorgänge; ohne Thema die 10 Themen. Gezählt werden
   Vorgänge (gleiche Titel je Gebiet einmal), Formalien nie; das Thema ist dasselbe wie im Themenfilter der Suche. */
interface Row { key: string; name: string; count: number; base: number; share: number | null; ags?: string; members?: string[] }
interface Item { id: string; title: string; region: string; date: string; status: string; stage: string | null; subs: string[]; times: number }
interface CompareRow { key: string; name: string; k: number; share: number; q1: number; median: number; q3: number; ratio: number | null; class: "mehr" | "weniger" | "ueblich" | null }
interface Compare { region: string; from: string; to: string; n: number; months: number; insufficient?: "items" | "months" | "group"; rule: { minItems: number; minMonths: number; minTopic: number }; group?: { label: string; n: number }; rows?: CompareRow[] }
interface Result { selection: { theme: string; sub: string; q: string }; total: number; unread: number; parts: Row[]; months: Row[]; regions: Row[]; recent: Item[]; compare: Compare | null; facts: Fact[] }
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
  const grid = "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 text-left sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto]";
  return (
    <ol className="m-0 list-none border-t border-slate-200 p-0">
      {rows.map((r) => {
        const rest = isRest(r), on = open === r.key;
        const inner = (
          <>
            <span className={`text-[16px] leading-snug ${rest ? "text-slate-500" : ""} ${mode === "select" && on ? "font-semibold" : ""}`}>{r.name}</span>
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
const HIGH_BAD = new Set(["hebesatz", "fee_rate", "dog_tax", "kita_fee", "land_price", "plot_price"]);
const GREEN_RED = ["#2f9e44", "#a9c934", "#f59f00", "#e03131"];
const mid = (vs: number[]) => { const s = [...vs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quart = (vs: number[], q: number) => { const s = [...vs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
function AtlasMap({ regions, facts, onList, listed, drill }: { regions: Row[]; facts: Fact[]; onList: (id: string) => void; listed: string; drill: (r: Row) => React.ReactNode }) {
  const [level, setLevel] = useState<"city" | "district">("city");
  const [picked, setPicked] = useState("");
  const [kind, setKind] = useState("");
  /* Fakt-, Kennzahl- und Ebenenwahl erst auf Wunsch einblenden */
  const [more, setMore] = useState(false);
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
      <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="mb-2 text-[14px] font-medium text-teal-700 hover:underline">
        {more ? "Karte anpassen ausblenden" : `Karte anpassen: ${fact ? fact.name : "Alle Vorgänge"}, ${level === "district" ? "Kreise" : "Gemeinden"}`}
      </button>
      {more && <>
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
      </>}
      {listedRow && <div className="mt-3">{drill(listedRow)}</div>}
    </section>
  );
}

/* Methodenhinweis eingeklappt: die Seite bleibt ruhig, wer es genau wissen will, klappt ihn auf */
function Hint({ children }: { children: React.ReactNode }) {
  return (
    <details className="mb-3 mt-1 max-w-[760px] text-[14px] text-slate-500">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-teal-700 hover:underline">So gelesen</summary>
      <p className="mt-1">{children}</p>
    </details>
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
      <Hint>Anteil an allen {n(c.n)} Sachvorgängen des eigenen Rats in den letzten 12 Monaten, verglichen mit {n(c.group!.n)} {c.group!.label}. „Üblich“ ist die mittlere Hälfte der Gruppe; eingeordnet wird erst ab {n(c.rule.minTopic)} Vorgängen und nur bei klarem Abstand. Dieser Vergleich gilt immer für 12 Monate und nur den eigenen Rat; die Zahlen darunter folgen Zeitraum und Filtern der Suche und können deshalb abweichen.</Hint>
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
 * theme: eines der 10 Themen oder "" (alle); sub: Unterthema oder "".
 * term: Suchbegriff aus einem geteilten Link (?q=), wird beim Öffnen einmal in die Suche übernommen.
 */
/* Werte aus den Unterlagen zeigt der Atlas seit 14.10.26 nicht mehr (Konzept docs/produkt/plenara-x-fakten-konzept.md): Signale
   haben die Seite /analytics/signale, Vergleichswerte kommen in den Ortsvergleich. Regeln, Daten und by=fact bleiben; true zeigt sie wieder. */
const SHOW_FACTS = false;

export function XAtlasView({ theme, sub, term, onTheme, onSub }: { theme: string; sub: string; term: string | null; onTheme: (id: string) => void; onSub: (id: string) => void }) {
  const { query, search } = useAnalyticsQuery();
  const sel = [theme && `theme=${theme}`, sub && `sub=${sub}`].filter(Boolean).join("&");
  const url = `/api/x?view=atlas${sel ? "&" + sel : ""}&${query}`;
  const { res, ranKey, loading, error, stale, run } = useAnalysisRun<Result>({ key: url, url, initial: !term, onDone: () => { setOpen(""); setPart(null); setAll(null); } });
  /* Aufgeklappte Liste: "month:2026-05", "region:<id>", "map:<id>" */
  const [open, setOpen] = useState("");
  /* Aufgeklappte Zeile der Gliederung rechts: null = die erste (Start), "" = keine */
  const [part, setPart] = useState<string | null>(null);
  /* Ganze Liste unten statt der jüngsten Vorgänge: nach „Alle … zeigen“ */
  const [all, setAll] = useState<{ by: string; value: string; label: string } | null>(null);
  const bottomRef = useRef<HTMLElement>(null);
  /* Andere Auswahl (Thema, Unterthema): gleich neu rechnen; das alte Ergebnis bleibt abgeblendet stehen */
  const [ranSel, setRanSel] = useState(sel);
  if (ranSel !== sel) {
    setRanSel(sel);
    setOpen("");
    run();
  }
  /* Suche oder Filter geändert: nach kurzer Pause von selbst neu rechnen (Themenleiste und Filter verhalten sich gleich) */
  useEffect(() => {
    if (!stale || loading) return;
    const t = setTimeout(() => run(), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, loading, url]);
  /* Begriff aus dem Link: in die Suche übernehmen und mit ihm rechnen (wie run() zusammen mit applySearch im selben Klick) */
  useEffect(() => {
    if (!term) return;
    search.applySearch(term);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Mit gewähltem Unterthema: alle Unterthemen des Themas mit ihren Zahlen (dieselbe Abfrage ohne Unterthema, Gliederung nach
     Unterthema); die Antwort der Auswahl selbst zählte nur die Überschneidungen mit dem gewählten */
  const [siblings, setSiblings] = useState<Row[] | null>(null);
  const listQuery = (() => { const p = new URLSearchParams(ranKey.split("?")[1] ?? ""); for (const k of ["view", "theme", "sub"]) p.delete(k); return p.toString(); })();
  useEffect(() => {
    if (!sub || !theme || !res) { setSiblings(null); return; }
    const c = new AbortController();
    fetch(`/api/x?theme=${theme}&by=sub&${listQuery}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ rows?: Row[] }>) : null)).then((b) => setSiblings(Array.isArray(b?.rows) ? b.rows : null)).catch(() => {});
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, sub, theme]);
  const toggle = (key: string) => setOpen(open === key ? "" : key);
  const listBase = `/api/x?list=1${sel ? "&" + sel : ""}`;
  const drill = (by: string, r: Row, label = r.name) => <RadarDrill base={listBase} query={listQuery} by={by} value={r.key} label={label} />;
  const opened = (by: string) => (open.startsWith(by + ":") ? open.slice(by.length + 1) : "");
  const [jump, setJump] = useState(0);
  const showAll = (by: string, value: string, label: string) => { setAll({ by, value, label }); setJump((j) => j + 1); };
  /* Nach „Alle … zeigen“ zur Liste unten springen, wenn sie gezeichnet ist */
  useEffect(() => { if (jump) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [jump]);

  const total = res?.total ?? 0;
  const themeName = theme ? THEMES.find((t: { id: string; name: string }) => t.id === theme)?.name ?? "" : "";
  const subName = sub ? SUBTOPICS.find((s: { id: string; name: string }) => s.id === sub)?.name ?? "" : "";
  /* Gliederung rechts: ohne Thema die Themen, mit Thema seine Unterthemen (mit gewähltem Unterthema dieselbe Liste, das gewählte hervorgehoben) */
  const partBy = theme ? "sub" : "theme";
  const parts = restLast(sub && siblings ? siblings : res?.parts ?? []);
  const firstPart = parts.find((p) => !isRest(p))?.key ?? "";
  const openPart = part === null ? (sub || firstPart) : part;
  /* Liste hinter einer Zeile: dieselbe Auswahl, aber ohne das gewählte Unterthema (sonst nur die Überschneidung) */
  const partBase = `/api/x?list=1${theme ? "&theme=" + theme : ""}`;
  const allRegions = res?.regions ?? [];
  /* Ohne Auswahl ist der Anteil überall 100 %, mit nur einem Gebiet (Ort gewählt) gibt es nichts zu vergleichen */
  const rankRegions = !!(theme || sub) && allRegions.length > 1;
  const regions = rankRegions ? allRegions.filter((r) => r.base >= MIN_BASE).sort((a, b) => (b.share ?? 0) - (a.share ?? 0)) : [];
  const [moreRegions, setMoreRegions] = useState(false);
  const month = opened("month");
  /* Monatsachse: auf dem Handy nur jeder dritte Monat beschriftet (vom jüngsten aus gezählt), sonst wäre jeder Name abgeschnitten */
  const nMonths = res?.months.length ?? 0;
  const where = allRegions.length === 1 ? `in ${allRegions[0].name}` : `in ${n(allRegions.length)} ${plural(allRegions.length, "Gebiet", "Gebieten")}`;
  /* Antwortzeile: Auswahl, Vorgänge, Gebiete und (mit Thema) Anteil an allen Sachvorgängen derselben Gebiete */
  const base = allRegions.reduce((s, r) => s + (r.base || 0), 0);
  /* Name und Zahlen aus derselben Antwort: während neu gerechnet wird, passt die Zeile weiter zu den abgeblendeten Zahlen */
  const rt = res?.selection.theme ?? "", rs = res?.selection.sub ?? "";
  const share = (rt || rs) && base ? Math.round((1000 * total) / base) / 10 : null;
  const what = [rt && THEMES.find((t: { id: string; name: string }) => t.id === rt)?.name, rs && SUBTOPICS.find((s: { id: string; name: string }) => s.id === rs)?.name].filter(Boolean).join(" › ");
  const answer = `${what ? what + ": " : ""}${n(total)} ${plural(total, "Vorgang", "Vorgänge")} ${where}${share !== null ? `, ${pct(share)} aller Sachvorgänge` : ""}${res?.selection.q ? ` zur Suche „${prettyTerm(res.selection.q)}“` : ""}.`;

  return (
    <section aria-label="Auswertung des Themas">
      <div className="mt-3 print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} startLabel="Auswerten" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {loading && !res && <Laden text="Auswertung wird berechnet …" />}
      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {res.total === 0 ? <p className="mt-10 text-[16px]">Für diese Auswahl gibt es keine Vorgänge.</p> : (
            <>
              <Befund>{answer}</Befund>

              {/* Links die Bilder (Karte, Zeitverlauf), rechts die Listen zum Anklicken; ab 1024 px nebeneinander, die linke Spalte bleibt stehen */}
              <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-12">
                <div className="min-w-0 lg:sticky lg:top-4 lg:col-span-7 lg:self-start">
                  {allRegions.length > 0 && <AtlasMap regions={allRegions} facts={SHOW_FACTS ? res.facts : []} listed={opened("map")} onList={(id) => toggle(`map:${id}`)} drill={(r) => drill("region", r)} />}
                  {nMonths > 1 && <section className="mt-8">
                    <h2 className="text-[22px] font-semibold">Im Zeitverlauf</h2>
                    <TimeLine months={res.months} share={!!(rt || rs)} open={month} onOpen={(k) => toggle(`month:${k}`)} />
                    {month && <div className="mt-3">{drill("month", res.months.find((m) => m.key === month)!, monthLabel(month))}</div>}
                  </section>}
                </div>

                <div className="min-w-0 lg:col-span-5">
                  {res.compare && <OrtImVergleich c={res.compare} theme={theme} />}

                  <section className={res.compare ? "mt-10" : ""}>
                    <h2 className="text-[22px] font-semibold">{theme ? `Unterthemen von ${themeName}` : "Themen"}</h2>
                    <p className="mb-3 mt-1 text-[14px] text-slate-500">Antippen zeigt die Vorgänge.</p>
                    <PartList rows={parts} open={openPart} selected={theme ? sub : ""} onOpen={(k) => setPart(openPart === k ? "" : k)}
                      label={(r) => `${n(r.count)}${r.share !== null && theme && !sub ? ` · ${pct(r.share)}` : ""}`}
                      drill={(r) => <RadarDrill base={partBase} query={listQuery} by={partBy} value={r.key} label={r.name} limit={5}
                        onAll={() => showAll(partBy, r.key, [themeName, r.name].filter(Boolean).join(" › "))}
                        footer={isRest(r) ? null : <button type="button" onClick={() => (theme ? onSub(sub === r.key ? "" : r.key) : onTheme(r.key))} className="mt-2 block text-[14px] font-medium text-teal-700 hover:underline">
                          {theme && sub === r.key ? "Eingrenzung aufheben" : `Auf „${r.name}“ eingrenzen →`}</button>} />} />
                  </section>

                  {rankRegions && <section className="mt-10">
                    <h2 className="text-[22px] font-semibold">Wo das Thema viel Raum hat</h2>
                    <Hint>Anteil an allen Sachvorgängen des Gebiets (gleiche Filter), nur Gebiete mit mindestens {MIN_BASE} Sachvorgängen. Klick zeigt die Vorgänge.</Hint>
                    {regions.length ? <>
                      <Bars rows={regions.slice(0, moreRegions ? 15 : 5)} mode="expand" open={opened("region")} onOpen={(k) => toggle(`region:${k}`)} drill={(r) => drill("region", r)} value={(r) => r.share ?? 0}
                        label={(r) => `${pct(r.share)} · ${n(r.count)}`} />
                      {regions.length > 5 && <button type="button" onClick={() => setMoreRegions(!moreRegions)} className="mt-2 text-[14px] font-medium text-teal-700 hover:underline">{moreRegions ? "Weniger Orte" : "Weitere Orte →"}</button>}
                    </> : <p className="text-[14px] text-slate-500">Kein Gebiet hat genug Sachvorgänge für einen Vergleich.</p>}
                  </section>}
                  {!(theme || sub) && allRegions.length > 1 && <p className="mt-10 text-[14px] text-slate-500">Thema wählen, um zu sehen, wo es viel Raum hat.</p>}
                </div>
              </div>

              <section ref={bottomRef} className="mt-14 scroll-mt-4">
                {all ? <>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <h2 className="text-[22px] font-semibold">Vorgänge: {all.label}</h2>
                    <button type="button" onClick={() => setAll(null)} className="text-[14px] font-medium text-teal-700 hover:underline">Jüngste Vorgänge zeigen</button>
                  </div>
                  <div className="mt-3"><RadarDrill base={partBase} query={listQuery} by={all.by} value={all.value} label={all.label} /></div>
                </> : <>
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
                </>}
              </section>
              {!SHOW_FACTS && <p className="mt-10 text-[14px] text-slate-500">Neue Baugebiete, Windparks, Wärmeplanung und mehr mit Stand und Kennzahlen: <Link href="/analytics/signale" className="font-medium text-teal-700 hover:underline">plenara.X Signale →</Link></p>}

              <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Gezählt werden Vorgänge: derselbe Titel in mehreren Gremien eines Gebiets zählt einmal. Formalien, Sammelpunkte, Besetzungen und Fragestunden zählen nicht.{res.unread ? ` ${n(res.unread)} Vorgänge sind noch nicht mit ihren Unterlagen gelesen; sie zählen beim Thema, aber noch ohne Unterthema.` : ""}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Gliederung rechts: Zeilen zum Aufklappen (Pfeil, Zahl in Petrol, Zeile reagiert); das gewählte Unterthema ist hervorgehoben */
function PartList({ rows, open, selected, onOpen, drill, label }: { rows: Row[]; open: string; selected: string; onOpen: (key: string) => void; drill: (r: Row) => React.ReactNode; label: (r: Row) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ol className="m-0 list-none border-t border-slate-200 p-0">
      {rows.map((r) => {
        const rest = isRest(r), on = open === r.key, picked = selected === r.key, dim = !!selected && !picked;
        return (
          <li key={r.key} className="border-b border-slate-200">
            <button type="button" onClick={() => onOpen(r.key)} aria-expanded={on}
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2.5 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto_16px] ${dim ? "opacity-70" : ""}`}>
              <span className={`text-[16px] leading-snug ${rest ? "text-slate-500" : ""} ${on || picked ? "font-semibold" : ""}`}>{r.name}</span>
              <span className="order-4 col-span-3 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1">
                <span className={`block h-full rounded-full ${rest ? "bg-slate-300" : picked ? "bg-slate-900" : "bg-teal-600"}`} style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <span className={`text-right text-[14px] font-semibold tabular-nums ${rest ? "text-slate-500" : "text-teal-700"}`}>{label(r)}</span>
              <span aria-hidden="true" className={`text-center text-[14px] ${rest ? "text-slate-500" : "text-teal-700"}`}>{on ? "▾" : "›"}</span>
            </button>
            {on && <div className="mb-3 ml-2">{drill(r)}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/* Zeitverlauf als Linie mit heller Fläche, ein Punkt je Monat (Klick zeigt die Vorgänge). Mit Thema der Anteil an allen
   Sachvorgängen des Monats (unabhängig davon, wie viele Räte schon erfasst sind), sonst die Anzahl. Der laufende Monat ist
   gestrichelt, weil er noch nicht vollständig ist; darüber der letzte vollständige Monat als Satz. */
function TimeLine({ months, share, open, onOpen }: { months: Row[]; share: boolean; open: string; onOpen: (key: string) => void }) {
  const W = 600, H = 140, P = 8;
  const now = new Date().toISOString().slice(0, 7);
  const v = (m: Row) => (share ? m.share ?? 0 : m.count);
  /* Achse vom kleinsten bis zum größten Wert (mit etwas Rand), damit der Verlauf sichtbar ist; die Zahlen stehen am Punkt */
  const vs = months.map(v), hi = Math.max(...vs), lo0 = Math.min(...vs), pad = (hi - lo0) * 0.25 || hi * 0.1 || 1;
  const lo = Math.max(0, lo0 - pad), top = hi + pad;
  const pts = months.map((m, i) => ({ m, x: P + (i * (W - 2 * P)) / Math.max(1, months.length - 1), y: P + (H - 2 * P) * (1 - (v(m) - lo) / (top - lo)) }));
  const running = pts.length > 1 && pts[pts.length - 1].m.key === now;
  const done = running ? pts.slice(0, -1) : pts;
  const line = (p: typeof pts) => p.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  const last = done[done.length - 1]?.m;
  const fmt = (m: Row) => (share ? `${n(m.count)} ${plural(m.count, "Vorgang", "Vorgänge")}, ${pct(m.share)} aller Sachvorgänge` : `${n(m.count)} ${plural(m.count, "Vorgang", "Vorgänge")}`);
  return (
    <>
      {last && <p className="mb-2 mt-1 text-[16px]"><b className="font-semibold">{monthLabel(last.key)}:</b> {fmt(last)}</p>}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-[140px] w-full" preserveAspectRatio="none" aria-hidden="true">
          <path d={`${line(done)} L${done[done.length - 1].x},${H} L${done[0].x},${H} Z`} className="fill-teal-50" />
          <path d={line(done)} fill="none" className="stroke-teal-700" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {running && <path d={line(pts.slice(-2))} fill="none" className="stroke-teal-700" strokeWidth="2.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
        </svg>
        {/* Punkte als Knöpfe über der Linie (rund bleiben trotz gestreckter Grafik) */}
        {pts.map((q, i) => {
          const on = open === q.m.key, cur = running && i === pts.length - 1;
          return <button key={q.m.key} type="button" onClick={() => onOpen(q.m.key)} aria-expanded={on}
            aria-label={`${monthLabel(q.m.key)}${cur ? " (laufend)" : ""}: ${fmt(q.m)}`} title={`${monthLabel(q.m.key)}: ${fmt(q.m)}`}
            className="group absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center"
            style={{ left: `${(q.x / W) * 100}%`, top: `${(q.y / H) * 100}%` }}>
            <span className={`block rounded-full border-2 border-teal-700 transition-transform group-hover:scale-125 ${on ? "h-3.5 w-3.5 bg-slate-900" : cur ? "h-2.5 w-2.5 bg-white" : "h-2.5 w-2.5 bg-teal-700"}`} />
          </button>;
        })}
      </div>
      <p className="mt-1 flex justify-between text-[12px] text-slate-500"><span>{MONTH.format(parseDate(months[0].key + "-01"))}</span>
        <span>{share ? "Anteil je Monat" : "Vorgänge je Monat"}{running ? " · gestrichelt: laufender Monat" : ""} · Punkt zeigt die Vorgänge</span>
        <span>{MONTH.format(parseDate(months[months.length - 1].key + "-01"))}</span></p>
    </>
  );
}
