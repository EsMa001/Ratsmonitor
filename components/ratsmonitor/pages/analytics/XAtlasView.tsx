import { kurz } from "../../components/ChipRail";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { THEMES, SUBTOPICS } from "@/shared/themes.mjs";
import { Laden } from "./Laden";
import { Befund, Fehler } from "./Befund";
import { MeinOrtNeu } from "./MeinOrtNeu";
import { Folgen, Kennzahlen, MeinOrt, ZeitPills, countScale, useOrtInAdresse, weekAgo, zeitText } from "./Kennzahlen";
import { usePhone } from "../../lib/usePhone";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useAnalysisRun } from "./useAnalysisRun";
import { RadarDrill } from "./RadarDrill";
import { RegionMap } from "./RegionMap";
import { plural } from "../../lib/text";
import { prettyTerm } from "../../lib/terms";
import { ThemeIcon } from "../../components/icons";
import { SubtopicIcon } from "../../components/SubtopicIcon";
import { num, pctText as pct } from "../../lib/format";
import { MethodikNote } from "./Methodik";

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
/* Orte erst ab so vielen Sachvorgängen in der Rangliste nach Anteil (sonst führen Orte mit 2 von 3 Vorgängen) */
const MIN_BASE = 30;
/* Restposten („Sonstiges“ = unklar, „Sonstiger Schritt“): grau und ans Ende der Liste */
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
const HIGH_BAD = new Set(["hebesatz", "fee_rate", "dog_tax", "kita_fee", "land_price", "plot_price"]);
const GREEN_RED = ["var(--rm-ac)", "var(--color-teal-400)", "var(--color-amber-300)", "var(--rm-no)"];
const mid = (vs: number[]) => { const s = [...vs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quart = (vs: number[], q: number) => { const s = [...vs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
type Level = "city" | "district";

function AtlasMap({ regions, facts, onList, listed, drill, onPlace, onLevel, preview, level }: { /* Vorschau beim Überfahren einer Zeile: deren Name */ preview?: string; regions: Row[]; facts: Fact[]; onList: (id: string) => void; listed: string; drill: (r: Row) => React.ReactNode; onPlace: (ags: string) => void; onLevel: (l: Level) => void; /* Ebene der Karte: Gemeinden oder Kreise (gehört dem Filter, siehe AtlasExtra) */ level: Level }) {
  const [pk, setPk] = useState<{ l: string; v: string }>({ l: level, v: "" });
  const picked = pk.l === level ? pk.v : "";
  const setPicked = (v: string) => setPk({ l: level, v });
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
    /* Anzahl: Stufen nach Vierteln der Gebiete (countScale), damit die Karte über ganz Deutschland unterscheidet */
    const scale = countScale(vs);
    let cut: number[] = [], legend = scale.legend;
    if (metricOn && vs.length) { cut = [quart(vs, 0.25), quart(vs, 0.5), quart(vs, 0.75)]; legend = [`bis ${num(cut[0])}`, `bis ${num(cut[1])}`, `bis ${num(cut[2])}`, `über ${num(cut[2])}`].map((l) => `${l} ${unit}`); }
    const levels: Record<string, number> = {}, byAgs = new Map<string, { v: number; name: string; key: string; count: number; share: number | null; base: number }>();
    for (const [a, x] of area) { levels[a] = metricOn ? (x.v <= cut[0] ? 1 : x.v <= cut[1] ? 2 : x.v <= cut[2] ? 3 : 4) : scale.level(x.v); byAgs.set(a, x); }
    return { levels, byAgs, legend, unit, colors: metricOn && HIGH_BAD.has(kind) ? GREEN_RED : undefined };
  }, [regions, facts, metricOn, level, kind]);
  const sel = picked ? byAgs.get(picked) : undefined;
  const chip = (on: boolean) => `h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-[14px] transition-colors ${on ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`;
  const row = "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0";
  const listedRow = listed ? regions.find((r) => r.key === listed) : undefined;
  const what = !fact ? "Vorgänge der Auswahl" : metricOn ? `Median „${metricOn}“ der Vorgänge` : `Vorgänge mit Wert „${fact.name}“`;
  const valueText = (x: { v: number; count: number }) => metricOn ? `Median ${num(x.v)} ${unit}` : `${n(x.v)} ${plural(x.v, "Vorgang", "Vorgänge")}`;
  return (
    <section>
      <div className="relative">
        {/* Klick wählt das Gebiet als Ort (wie in den Signalen): Gemeinde oder, auf Kreisebene, Kreis */}
        <RegionMap tall level={level} levels={levels} picked={picked} onPick={(a) => { setPicked(picked === a ? "" : a); if (picked !== a && byAgs.has(a)) onPlace(a); }} legend={legend} colors={colors}
          note={preview ? `Vorschau: ${preview}` : metricOn ? `Viertel über alle Gebiete${HIGH_BAD.has(kind) ? "; rot: hoch" : ""}${level === "district" ? "; nur Werte der Kreise selbst" : ""}` : "ohne Farbe: keine Vorgänge"}
          label={`Karte: ${what} je ${level === "district" ? "Kreis" : "Gemeinde"}`}
          info={sel ? <>
            <b className="font-semibold">{sel.name}</b><br />
            <span className="text-slate-500">{valueText(sel)}</span>
            {sel.key && <><br /><button type="button" onClick={() => onList(sel.key)} className="pointer-events-auto mt-1 text-[14px] font-medium text-teal-700 hover:underline">{listed === sel.key ? "Vorgänge ausblenden" : "Vorgänge zeigen →"}</button></>}
          </> : picked ? <span className="text-slate-500">Hier gibt es keine Werte zur Auswahl.</span> : undefined} />
      </div>
      {/* Ebene sichtbar (nicht mehr unter „Karte anpassen“): Kreise wählen beim Klick den ganzen Kreis */}
      <div className="mt-3 flex flex-wrap items-center gap-2 max-sm:hidden" role="group" aria-label="Ebene der Karte">
        <span className="text-[14px] text-slate-500 max-sm:hidden">Ebene</span>
        {([["city", "Gemeinden"], ["district", "Kreise"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => onLevel(k)} className={chip(level === k)}>{l}</button>)}
        <span className="text-[14px] text-slate-500 max-sm:hidden">· Gebiet antippen wählt den Ort</span>
      </div>
      {facts.length > 0 && <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="mb-2 mt-2 text-[14px] font-medium text-teal-700 hover:underline">
        {more ? "Werte ausblenden" : `Karte zeigt: ${fact ? fact.name : "Alle Vorgänge"}`}
      </button>}
      {more && <>
      <div className={row} role="group" aria-label="Was die Karte zeigt">
        <button type="button" aria-pressed={!fact} onClick={() => { setKind(""); setMetric(""); setPicked(""); }} className={chip(!fact)}>Alle Vorgänge</button>
        {facts.filter((f) => f.map.length).map((f) => <button key={f.kind} type="button" aria-pressed={kind === f.kind} onClick={() => { setKind(f.kind); const m = [...new Set(f.map.flatMap((x) => Object.keys(x.v)))]; setMetric(m.length ? m.sort((a, b) => f.map.filter((x) => x.v[b]).length - f.map.filter((x) => x.v[a]).length)[0] : ""); setPicked(""); }} className={chip(kind === f.kind)}>{f.name}</button>)}
      </div>
      {fact && <div className={row + " mt-2"} role="group" aria-label="Kennzahl">
        <button type="button" aria-pressed={!metricOn} onClick={() => setMetric("")} className={chip(!metricOn)}>Anzahl</button>
        {metrics.map((m) => <button key={m} type="button" aria-pressed={metricOn === m} onClick={() => setMetric(m)} className={chip(metricOn === m)}>{m}</button>)}
      </div>}
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

const ZU_WENIG = { items: "zu wenige Sachvorgänge", months: "zu wenige Monate mit Sitzungen", group: "keine ausreichend große Vergleichsgruppe" };

/* Unsicherheit des Anteils k von n (Wilson, 95 %), in Prozent */
const wilson = (k: number, n: number) => {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h) * 100, Math.min(1, c + h) * 100];
};
const WORT = { mehr: "viel", weniger: "wenig", ueblich: "üblich" };

/** Ort im Vergleich als Skala: je Thema bzw. Unterthema der übliche Bereich der Vergleichsgruppe (grauer Streifen, mittlere Hälfte),
    der Ort als Punkt mit seiner Unsicherheit (Linie) und ein Wort. Reihenfolge wie die Liste darunter (nach Anzahl), damit nichts
    springt; Auffälliges fett. Klick wählt das Thema bzw. Unterthema für den Ort. */
function OrtImVergleich({ c, theme, onPick }: { c: Compare; theme: string; onPick: (key: string) => void }) {
  if (c.insufficient) return (
    <section><h2 className="text-[22px] font-semibold max-sm:text-[18px]">{c.region} im Vergleich</h2>
      <p className="mt-2 max-w-[760px] text-[16px]">Keine Einordnung möglich: {ZU_WENIG[c.insufficient]} ({n(c.n)} Sachvorgänge in {n(c.months)} Monaten; nötig sind {n(c.rule.minItems)} in {n(c.rule.minMonths)} Monaten).</p></section>
  );
  const rows = [...(c.rows ?? [])].map((r) => ({ ...r, name: SUBTOPICS.find((x: { id: string; short: string }) => x.id === r.key)?.short ?? r.name })).sort((a, b) => b.k - a.k);
  return (
    <section>
      <h2 className="text-[22px] font-semibold max-sm:text-[18px]">{c.region} im Vergleich</h2>
      <p className="mb-1 mt-1 text-[14px] text-slate-500">Grau: üblich bei {n(c.group!.n)} {c.group!.label}. Punkt: {c.region}, Linie: Unsicherheit.</p>
      <Hint>Anteil an allen {n(c.n)} Sachvorgängen des eigenen Rats in den letzten 12 Monaten. „Üblich“ ist die mittlere Hälfte der Gruppe; eingeordnet wird erst ab {n(c.rule.minTopic)} Vorgängen und nur, wenn die Unsicherheit klar außerhalb liegt.</Hint>
      <ol className="m-0 list-none border-t border-slate-200 p-0">
        {rows.map((r) => {
          const [lo, hi] = wilson(r.k, c.n), max = Math.max(r.q3, hi, r.share) * 1.2 || 1, at = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
          const marked = r.class === "mehr" || r.class === "weniger";
          return (
            <li key={r.key} className="border-b border-slate-200">
              <button type="button" onClick={() => onPick(r.key)} title={`${pct(r.share)}, üblich ${pct(r.q1)} bis ${pct(r.q3)}`}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 pb-6 pt-2.5 sm:pb-2.5 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,170px)_minmax(0,1fr)_88px]">
                <span className={`text-[16px] leading-snug ${marked ? "font-semibold" : ""}`}>{r.name}</span>
                <span className="relative order-3 col-span-2 block h-4 sm:order-none sm:col-span-1" aria-hidden="true">
                  <span className="absolute inset-x-0 top-[7px] h-[2px] bg-slate-100" />
                  <span className="absolute top-[3px] h-[10px] rounded-full bg-slate-300" style={{ left: at(r.q1), width: `calc(${at(r.q3)} - ${at(r.q1)})` }} />
                  <span className="absolute top-[7px] h-[2px] bg-teal-700" style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }} />
                  <span className="absolute top-[2px] -ml-[6px] h-3 w-3 rounded-full bg-teal-700" style={{ left: at(r.share) }} />
                  {/* Handy: kein Darüberfahren, darum die Zahlen unter der Skala */}
                  <span className="absolute left-0 top-[18px] text-[12px] text-slate-500 sm:hidden">üblich {pct(r.q1)} bis {pct(r.q3)}</span>
                </span>
                <span className={`text-right text-[14px] ${marked ? "font-semibold text-slate-900" : "text-slate-500"}`}>{r.class ? WORT[r.class] : "kaum Vorgänge"}<span className="block text-[12px] font-normal tabular-nums text-slate-500">{pct(r.share)}</span></span>
              </button>
            </li>
          );
        })}
      </ol>
      {!theme && <p className="mt-2 text-[12px] text-slate-500">Thema wählen, um die Unterthemen zu vergleichen.</p>}
    </section>
  );
}

/** Handy: Ebene der Karte (Gemeinden, Kreise) im Filterblatt statt als eigene Zeilen über und unter der Karte */
function AtlasExtra({ level, onLevel }: { level: Level; onLevel: (l: Level) => void }) {
  const chip = (on: boolean) => `h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-[14px] transition-colors ${on ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700"}`;
  return (
    <div className="flex flex-col gap-2 border-b border-slate-200 pb-2">
      <div role="group" aria-label="Ebene der Karte" className="flex items-center justify-between gap-2">
        <span className="text-[14px] text-slate-700">Karte zeigt</span>
        <span className="flex gap-1.5">
          {([["city", "Gemeinden"], ["district", "Kreise"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => onLevel(k)} className={chip(level === k)}>{l}</button>)}
        </span>
      </div>
    </div>
  );
}

/**
 * theme: eines der 10 Themen oder "" (alle); sub: Unterthema oder "".
 * term: Suchbegriff aus einem geteilten Link (?q=), wird beim Öffnen einmal in die Suche übernommen.
 */
/* Werte aus den Unterlagen zeigt der Atlas seit 14.10.26 nicht mehr (Konzept docs/produkt/plenara-x-fakten-konzept.md): Signale
   haben die Seite /analytics/signale, Vergleichswerte kommen in den Ortsvergleich. Regeln, Daten und by=fact bleiben; true zeigt sie wieder. */
const SHOW_FACTS = false;


export function XAtlasView({ theme, sub, zeit = "", term, onTheme, onSub, onZeit }: { theme: string; sub: string; zeit?: string; term: string | null; onTheme: (id: string) => void; onSub: (id: string) => void; onZeit: (z: string) => void }) {
  const phone = usePhone();
  const [level, setLevel] = useState<Level>("city");
  const { query: baseQuery, search } = useAnalyticsQuery();
  /* Zeitraum der Seite (Monate zurück ab heute) ersetzt den der Suche nur, wenn die Suche selbst keinen hat (wie in den Signalen) */
  const query = (() => { const q = new URLSearchParams(baseQuery); if (zeit && !q.get("from")) { const d = new Date(); d.setMonth(d.getMonth() - Number(zeit)); q.set("from", d.toISOString().slice(0, 10)); } return q.toString(); })();
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
  const [sib, setSib] = useState<{ key: string; rows: Row[] | null } | null>(null);
  const listQuery = (() => { const p = new URLSearchParams(ranKey.split("?")[1] ?? ""); for (const k of ["view", "theme", "sub"]) p.delete(k); return p.toString(); })();
  useEffect(() => {
    if (!sub || !theme || !res) return;
    const c = new AbortController(), key = `${theme}|${listQuery}`;
    fetch(`/api/x?theme=${theme}&by=sub&${listQuery}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ rows?: Row[] }>) : null)).then((b) => setSib({ key, rows: Array.isArray(b?.rows) ? b.rows : null })).catch(() => {});
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, sub, theme]);
  /* Antwort nur zur aktuellen Auswahl verwenden (ohne Unterthema keine) */
  const siblings = sub && theme && res && sib?.key === `${theme}|${listQuery}` ? sib.rows : null;
  const [week, setWeek] = useState<number | null>(null);
  useEffect(() => {
    if (!res) return;
    const q = new URLSearchParams(listQuery); q.set("from", weekAgo());
    const c = new AbortController();
    fetch(`/api/x?by=theme${sel ? "&" + sel : ""}&${q}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ total?: number }>) : null)).then((b) => setWeek(typeof b?.total === "number" ? b.total : null)).catch(() => {});
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);
  const toggle = (key: string) => setOpen(open === key ? "" : key);
  const listBase = `/api/x?list=1${sel ? "&" + sel : ""}`;
  /* Handy: die Vorgänge hinter einer Zeile als Walze (10 neueste, „Alle … zeigen“ am Ende) */
  const drill = (by: string, r: Row, label = r.name) => <RadarDrill base={listBase} query={listQuery} by={by} value={r.key} label={label} limit={phone ? 3 : undefined} onAll={phone ? () => showAll(by, r.key, label) : undefined} />;
  const opened = (by: string) => (open.startsWith(by + ":") ? open.slice(by.length + 1) : "");
  const [jump, setJump] = useState(0);
  /* „Alle … zeigen“ ist ein Schritt im Verlauf (#alle): Zurück schließt die Liste, statt die Seite zu verlassen */
  const showAll = (by: string, value: string, label: string) => {
    if (location.hash !== "#alle") history.pushState(history.state, "", location.pathname + location.search + "#alle");
    setAll({ by, value, label }); setJump((j) => j + 1);
  };
  const closeAll = () => { if (location.hash === "#alle") history.back(); else setAll(null); };
  useEffect(() => {
    const on = () => { if (location.hash !== "#alle") setAll(null); };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  /* Nach „Alle … zeigen“ zur Liste unten springen, wenn sie gezeichnet ist */
  useEffect(() => { if (jump) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [jump]);

  const total = res?.total ?? 0;
  const themeName = theme ? THEMES.find((t: { id: string; name: string }) => t.id === theme)?.name ?? "" : "";
  /* Unterthemen im Atlas mit Kurznamen (shared/themes.mjs: short); Suche und Filter behalten den vollen Namen */
  const short = (r: Row) => ({ ...r, name: SUBTOPICS.find((x: { id: string; short: string }) => x.id === r.key)?.short ?? r.name });
  const subName = sub ? SUBTOPICS.find((s: { id: string; short: string }) => s.id === sub)?.short ?? "" : "";
  /* Gliederung rechts: ohne Thema die Themen, mit Thema seine Unterthemen (mit gewähltem Unterthema dieselbe Liste, das gewählte hervorgehoben) */
  const partBy = theme ? "sub" : "theme";
  const parts = restLast(sub && siblings ? siblings : res?.parts ?? []).map((p) => (theme ? short(p) : p));
  const firstPart = parts.find((p) => !isRest(p))?.key ?? "";
  const openPart = part === null ? (sub || firstPart) : part;
  /* Liste hinter einer Zeile: dieselbe Auswahl, aber ohne das gewählte Unterthema (sonst nur die Überschneidung) */
  /* Richtung je Zeile: Anteil in den letzten N Monaten (Zeitraum der Seite, sonst 6) gegenüber den N Monaten davor; gezeigt nur,
     wenn sich der Anteil deutlich ändert (Faktor ab 1,25, z ab 2, mindestens 5 Vorgänge), sonst nichts */
  const span = Number(zeit) || 6;
  const [dirs, setDirs] = useState<{ for: string; v: Map<string, number> } | null>(null);
  const dirFor = `${partBy}|${theme}|${baseQuery}|${span}`;
  useEffect(() => {
    if (!res || new URLSearchParams(baseQuery).get("from")) return;
    const ago = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString().slice(0, 10); };
    const get = (from: string, to: string) => { const q = new URLSearchParams(baseQuery); q.set("from", from); if (to) q.set("to", to); return fetch(`/api/x?by=${partBy}${theme ? "&theme=" + theme : ""}&${q}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ rows?: Row[] }>) : null)).then((b) => b?.rows ?? []); };
    const c = new AbortController();
    Promise.all([get(ago(span), ""), get(ago(2 * span), ago(span))]).then(([a, b]) => {
      const sum = (l: Row[]) => l.filter((r) => !isRest(r)).reduce((x, r) => x + r.count, 0), A = sum(a), B = sum(b), prev = new Map(b.map((r) => [r.key, r.count]));
      const v = new Map<string, number>();
      if (A && B) for (const r of a) {
        if (isRest(r)) continue;
        const k = r.count, j = prev.get(r.key) ?? 0, pa = k / A, pb = j / B, pool = (k + j) / (A + B);
        const z = (pa - pb) / (Math.sqrt(pool * (1 - pool) * (1 / A + 1 / B)) || 1e-9), ratio = (pa + 0.5 / A) / (pb + 0.5 / B);
        if (k + j >= 5 && Math.abs(z) >= 2 && (ratio >= 1.25 || ratio <= 0.8)) v.set(r.key, ratio);
      }
      setDirs({ for: dirFor, v });
    }).catch(() => {});
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, dirFor]);
  const dirOf = (r: Row) => { const x = dirs?.for === dirFor ? dirs.v.get(r.key) : undefined; if (!x) return null;
    const up = x >= 1, f = (up ? x : 1 / x).toLocaleString("de-DE", { maximumFractionDigits: 1 });
    return <span title={`Anteil der letzten ${span} Monate gegenüber den ${span} Monaten davor`} className={`ml-1 whitespace-nowrap text-[12px] font-medium tabular-nums ${up ? "text-teal-700" : "text-slate-500"}`}>{up ? "↑" : "↓"} {up ? "×" : "÷"}{f}</span>; };
  /* Vorschau auf der Karte beim Überfahren einer Zeile (Thema oder Unterthema): deren Gebiete, nach kurzer Pause geladen */
  const [hoverKey, setHoverKey] = useState("");
  const [preview, setPreview] = useState<{ key: string; rows: Row[] } | null>(null);
  useEffect(() => {
    if (!hoverKey || isRest({ key: hoverKey } as Row)) return;
    const c = new AbortController();
    const t = setTimeout(() => {
      const p = new URLSearchParams(listQuery);
      fetch(`/api/x?by=region&${theme ? `theme=${theme}&sub=${hoverKey}` : `theme=${hoverKey}`}&${p}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ rows?: Row[] }>) : null))
        .then((b) => { if (b?.rows) setPreview({ key: hoverKey, rows: b.rows }); }).catch(() => {});
    }, 220);
    return () => { clearTimeout(t); c.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverKey]);
  useOrtInAdresse(new URLSearchParams(baseQuery).get("area") ?? "", (a) => search.setArea(a, "ui"));
  /* Auf dem Handy steht der Inhalt des Unterthemas unter der Karte: nach der Wahl dorthin scrollen */
  const subRef = useRef<HTMLElement>(null);
  const lastSub = useRef(sub);
  useEffect(() => { if (sub && sub !== lastSub.current && window.innerWidth < 1024) subRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); lastSub.current = sub; }, [sub, res]);
  const shownPreview = hoverKey && preview?.key === hoverKey ? preview : null;
  const partBase = `/api/x?list=1${theme ? "&theme=" + theme : ""}`;
  /* Mit Unterthema: Größe des Themas (für den Anteil) und die Unterthemen, die im selben Vorgang mit vorkommen (Antwort der Auswahl) */
  /* Zahl des Unterthemas sofort nach dem Klick: aus der Antwort des Themas (vor dem Klick schon da), sonst aus der Auswahl selbst */
  const [subCounts, setSubCounts] = useState<{ theme: string; rows: Row[] } | null>(null);
  if (res && !res.selection.sub && res.selection.theme && subCounts?.rows !== res.parts) setSubCounts({ theme: res.selection.theme, rows: res.parts });
  const known = subCounts?.theme === theme ? subCounts.rows : null;
  const subCount = sub ? (siblings ?? known)?.find((p) => p.key === sub)?.count ?? (res?.selection.sub === sub ? total : undefined) : undefined;
  const themeTotal = sub ? (siblings?.[0]?.base ?? known?.[0]?.base ?? 0) : 0;
  const together = sub && res?.selection.sub === sub ? restLast(res.parts).map(short).filter((p) => p.key !== sub && !isRest(p) && p.count > 0).slice(0, 6).map((p) => ({ ...p, share: total ? Math.round((1000 * p.count) / total) / 10 : null })) : [];
  const allRegions = res?.regions ?? [];
  /* Ohne Auswahl ist der Anteil überall 100 %, mit nur einem Gebiet (Ort gewählt) gibt es nichts zu vergleichen */
  const rankRegions = !!(theme || sub) && allRegions.length > 1;
  const regions = rankRegions ? allRegions.filter((r) => r.base >= MIN_BASE).sort((a, b) => (b.share ?? 0) - (a.share ?? 0)) : [];
  const [moreRegions, setMoreRegions] = useState(false);
  /* Antwortzeile: Auswahl, Vorgänge, Gebiete und (mit Thema) Anteil an allen Sachvorgängen derselben Gebiete */
  /* Name und Zahlen aus derselben Antwort: während neu gerechnet wird, passt die Zeile weiter zu den abgeblendeten Zahlen */
  const rt = res?.selection.theme ?? "", rs = res?.selection.sub ?? "";
  const what = [rt && THEMES.find((t: { id: string; name: string }) => t.id === rt)?.name, rs && SUBTOPICS.find((s: { id: string; short: string }) => s.id === rs)?.short].filter(Boolean).join(" › ");
  /* Mit Ort (Vergleich möglich): Ortssatz statt der allgemeinen Zeile */
  const cmp = res?.compare && !res.compare.insufficient ? res.compare : null;
  /* Gleicher Zeitraum wie der Vergleich (12 Monate); die Zahl der Auswahl steht in der Liste darunter */
  const placeRest = cmp ? `: ${n(cmp.n)} Sachvorgänge in den letzten 12 Monaten, verglichen mit ${n(cmp.group!.n)} ${cmp.group!.label}.` : "";
  const areaAgs = new URLSearchParams(ranKey.split("?")[1] ?? "").get("area") ?? "";
  /* Gewählter Ort (Filter der Suche): mit ✕ an der Antwortzeile, damit man ihn dort sieht und entfernen kann */
  const place = new URLSearchParams(ranKey.split("?")[1] ?? "").get("area") ? (cmp?.region ?? res?.compare?.region ?? (allRegions.length === 1 ? allRegions[0].name : "")) : "";

  return (
    <section aria-label="Auswertung des Themas">
      {/* Unterthemen als kleine Kacheln (Icon, Name), durch eine Linie in Petrol von den Themen getrennt; Handy 4 je Reihe */}
      {theme && <nav aria-label="Unterthema" className="mt-2 border-t-2 border-teal-600 pt-2 print:hidden">
        <ul className="m-0 grid list-none grid-cols-4 gap-1 p-0 sm:flex sm:flex-wrap">
          {SUBTOPICS.filter((x: { theme: string }) => x.theme === theme).map((x: { id: string; short: string }) => {
            const on = x.id === sub;
            return <li key={x.id} className="sm:w-[100px]"><button type="button" aria-pressed={on} onClick={() => onSub(on ? "" : x.id)}
              className={`flex h-[68px] w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center text-[12px] leading-tight max-sm:h-[46px] max-sm:gap-0 max-sm:px-0.5 max-sm:[hyphens:auto] max-sm:[overflow-wrap:anywhere] ${on ? "bg-teal-700 font-semibold text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
              <SubtopicIcon id={x.id} size={20} className={`max-sm:h-4 max-sm:w-4 ${on ? "text-white" : "text-slate-500"}`} />
              <span className="line-clamp-2"><span className="max-sm:hidden">{x.short}</span><span className="sm:hidden">{kurz(x.short)}</span></span></button></li>;
          })}
        </ul>
      </nav>}
      <div className="mt-2 max-sm:mt-0 print:hidden"><DiffusionSearch follow={<Folgen heart before={() => { if (theme) search.setThema(theme); }} hint="Auswahl unter Meine Suchen speichern" />} play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} startLabel="Auswerten" extra={<AtlasExtra level={level} onLevel={setLevel} />} /></div>
      {error && <Fehler>{error}</Fehler>}
      {loading && !res && <Laden karte text="Auswertung wird berechnet …" />}
      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {res.total === 0 ? <div role="status" className="mt-6 max-w-[760px] border-l-2 border-slate-300 py-1 pl-4">
            {/* Wie Leer (Befund.tsx), aber mit Knöpfen statt Tipp */}
            <p className="m-0 text-[18px] font-semibold leading-snug text-slate-900">Keine Vorgänge für diese Auswahl.</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] font-medium text-teal-700">
              {sub && <button type="button" onClick={() => onSub("")}>Unterthema entfernen →</button>}
              {!sub && theme && <button type="button" onClick={() => onTheme("")}>Alle Themen zeigen →</button>}
              {new URLSearchParams(ranKey.split("?")[1] ?? "").get("area") && <button type="button" onClick={() => search.clearArea()}>Ganz Deutschland zeigen →</button>}
              {res.selection.q && <button type="button" onClick={() => search.applySearch("")}>Suchbegriff entfernen →</button>}
            </div>
          </div> : (
            <>
              {/* Mit Ort: der Ort als Chip mit ✕ am Satzanfang (dort sieht man ihn und kann ihn entfernen); sonst große Kennzahlen */}
              {place && cmp ? <Befund tight><PlaceChip name={place} onClear={() => search.clearArea()} />{placeRest} <MeinOrt current={areaAgs ? { ags: areaAgs, name: place } : null} onApply={(ags) => search.setArea(ags, "ui")} /></Befund>
                : <Kennzahlen week={week} scope={[what || "Alle Themen", res.selection.q ? `„${prettyTerm(res.selection.q)}“` : "", place || ""].filter(Boolean).join(" · ")} period={zeitText(zeit)} items={[{ value: n(total), label: plural(total, "Vorgang", "Vorgänge") }]}>
                  {place && <PlaceChip name={place} onClear={() => search.clearArea()} />}
                  <span className="max-sm:hidden"><ZeitPills value={zeit} onPick={onZeit} /></span>
                  {place && <MeinOrt current={areaAgs ? { ags: areaAgs, name: place } : null} onApply={(ags) => search.setArea(ags, "ui")} />}
                </Kennzahlen>}

              {!place && <MeinOrtNeu onApply={(ags) => search.setArea(ags, "ui")} />}
              {place && cmp && <div className="mt-2 max-sm:hidden"><ZeitPills value={zeit} onPick={onZeit} /></div>}
              {/* Links die Karte (halbe Breite, dafür höher), rechts die Listen zum Anklicken; ab 1024 px nebeneinander, die Karte bleibt stehen */}
              <div className="mt-4 max-sm:mt-2 grid grid-cols-1 gap-x-8 gap-y-8 max-sm:gap-y-4 lg:grid-cols-12">
                <div className="min-w-0 lg:sticky lg:top-4 lg:col-span-6 lg:self-start">
                  {allRegions.length > 0 && <AtlasMap level={level} onLevel={setLevel} onPlace={(ags) => search.setArea(ags, "map")} regions={shownPreview ? shownPreview.rows : allRegions} preview={shownPreview ? (parts.find((p) => p.key === shownPreview.key)?.name ?? "") : undefined} facts={SHOW_FACTS && !shownPreview ? res.facts : []} listed={opened("map")} onList={(id) => toggle(`map:${id}`)} drill={(r) => drill("region", r)} />}
                </div>

                <div className="min-w-0 lg:col-span-6">
                  {res.compare && <OrtImVergleich c={res.compare} theme={theme} onPick={(k) => (theme ? onSub(sub === k ? "" : k) : onTheme(k))} />}

                  {sub ? <>
                    {/* Mit Unterthema: rechts sein Inhalt statt der Liste aller Unterthemen (zum Wechseln dienen die Pillen oben) */}
                    <section ref={subRef} className={`scroll-mt-4 ${res.compare ? "mt-8" : ""}`}>
                      <h2 className="flex items-center gap-2 text-[22px] font-semibold max-sm:text-[18px]"><ThemeIcon theme={theme} size={24} className="shrink-0 text-teal-700" />{subName}</h2>
                      <p className="mb-3 mt-1 text-[14px] text-slate-500">{subCount !== undefined ? `${n(subCount)} ${plural(subCount, "Vorgang", "Vorgänge")}${themeTotal ? `, ${pct(Math.round((1000 * subCount) / themeTotal) / 10)} von ${themeName}` : ""}. ` : ""}Die neuesten:</p>
                      <RadarDrill base={partBase} query={listQuery} by="sub" value={sub} label={subName} limit={3} onAll={() => showAll("sub", sub, [themeName, subName].join(" › "))} />
                      <p className="mt-3 text-[14px] text-slate-500">Wie es sich ausbreitet: <Link href={`/analytics/trends?begriff=${encodeURIComponent(subName)}`} className="font-medium text-teal-700 hover:underline">„{subName}“ in den Trends →</Link></p>
                    </section>
                  </> : <section className={res.compare ? "mt-8 max-sm:mt-5" : ""}>
                    <h2 className="flex items-center gap-2 text-[22px] font-semibold max-sm:text-[18px]">{theme && <ThemeIcon theme={theme} size={24} className="text-teal-700" />}{theme ? <>Unterthemen<span className="max-sm:hidden"> von {themeName}</span></> : "Themen"}</h2>
                    <PartList rows={parts} icons={!theme} open={openPart} dir={dirOf} onHover={setHoverKey} selected={theme ? sub : ""} onOpen={(k) => setPart(openPart === k ? "" : k)}
                      label={(r) => (phone ? `${n(r.count)} ${plural(r.count, "Vorgang", "Vorgänge")}` : `${n(r.count)}${r.share !== null && theme && !sub ? ` · ${pct(r.share)}` : ""}`)}
                      drill={(r) => <RadarDrill base={partBase} query={listQuery} by={partBy} value={r.key} label={r.name} limit={3}
                        onAll={() => showAll(partBy, r.key, [themeName, r.name].filter(Boolean).join(" › "))}
                        footer={isRest(r) ? null : <button type="button" onClick={() => (theme ? onSub(sub === r.key ? "" : r.key) : onTheme(r.key))} className="mt-2 block text-[14px] font-medium text-teal-700 hover:underline">
                          {theme && sub === r.key ? "Eingrenzung aufheben" : <>Auf „{r.name}“ eingrenzen<span className="max-sm:hidden"> →</span></>}</button>} />} />
                  </section>}

                  {rankRegions && <section className="mt-8 max-sm:mt-5">
                    <h2 className="text-[22px] font-semibold max-sm:text-[18px]">Wo <span className="max-sm:hidden">{sub ? `„${subName}“` : `„${themeName}“`} </span>viel Raum hat</h2>
                    <div className="max-sm:hidden"><Hint>Anteil an allen Sachvorgängen des Gebiets (gleiche Filter), nur Gebiete mit mindestens {MIN_BASE} Sachvorgängen. Klick zeigt die Vorgänge.</Hint></div>
                    {regions.length ? <>
                      <Bars rows={regions.slice(0, moreRegions ? 15 : 5)} mode="expand" open={opened("region")} onOpen={(k) => toggle(`region:${k}`)} drill={(r) => drill("region", r)} value={(r) => r.share ?? 0}
                        label={(r) => (phone ? `${n(r.count)} ${plural(r.count, "Vorgang", "Vorgänge")}` : `${pct(r.share)} · ${n(r.count)}`)} />
                      {regions.length > 5 && <button type="button" aria-expanded={moreRegions} onClick={() => setMoreRegions(!moreRegions)} className="mt-2 text-[14px] font-medium text-teal-700 hover:underline max-sm:mt-3 max-sm:flex max-sm:w-full max-sm:items-center max-sm:gap-3 max-sm:rounded-xl max-sm:border max-sm:border-teal-600/30 max-sm:px-3 max-sm:py-2 max-sm:text-teal-800 max-sm:no-underline">
                        <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-full bg-teal-50 text-teal-700 sm:hidden"><MapPin size={18} strokeWidth={1.6} /></span>
                        <span className="max-sm:flex-1 max-sm:text-left">{moreRegions ? "Weniger Orte" : <>Weitere Orte<span className="max-sm:hidden"> →</span></>}</span>
                        <span aria-hidden="true" className="flex-none text-teal-700 sm:hidden">{moreRegions ? <ChevronUp size={18} strokeWidth={1.6} /> : <ChevronDown size={18} strokeWidth={1.6} />}</span>
                      </button>}
                    </> : <p className="text-[14px] text-slate-500">Kein Gebiet hat genug Sachvorgänge für einen Vergleich.</p>}
                  </section>}
                  {!(theme || sub) && allRegions.length > 1 && <p className="mt-8 text-[14px] text-slate-500">Thema wählen, um zu sehen, wo es viel Raum hat.</p>}
                  {sub && together.length > 0 && <section className="mt-8 max-sm:mt-5">
                    <h2 className="text-[22px] font-semibold max-sm:text-[18px]">Oft zusammen mit</h2>
                    <p className="mb-3 mt-1 text-[14px] text-slate-500 max-sm:hidden">Anteil der Vorgänge zu „{subName}“, die auch dieses Unterthema haben. Klick wechselt dorthin.</p>
                    <Bars rows={together} mode="select" onOpen={(k) => onSub(k)} value={(r) => r.count} label={(r) => pct(r.share)} />
                  </section>}
                </div>
              </div>

              {/* Ganze Liste nur nach „Alle … zeigen“; die neuesten Vorgänge stehen schon in der aufgeklappten Zeile rechts */}
              <section ref={bottomRef} className="scroll-mt-4">
                {all && <div className="mt-10">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <h2 className="text-[22px] font-semibold max-sm:text-[18px]">Vorgänge: {all.label}</h2>
                    <button type="button" onClick={closeAll} className="text-[14px] font-medium text-teal-700 hover:underline">Schließen</button>
                  </div>
                  <div className="mt-3"><RadarDrill base={partBase} query={listQuery} by={all.by} value={all.value} label={all.label} /></div>
                </div>}
              </section>

              <MethodikNote>Gezählt werden Vorgänge: derselbe Titel in mehreren Gremien eines Gebiets zählt einmal. Formalien, Sammelpunkte, Besetzungen und Fragestunden zählen nicht.{res.unread ? ` ${n(res.unread)} Vorgänge sind noch nicht mit ihren Unterlagen gelesen; sie zählen beim Thema, aber noch ohne Unterthema.` : ""}</MethodikNote>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Gliederung rechts: Zeilen zum Aufklappen (Pfeil, Zahl in Petrol, Zeile reagiert); das gewählte Unterthema ist hervorgehoben */
function PartList({ rows, open, selected, onOpen, drill, label, icons = false, dir, onHover }: { /* Richtung gegenüber dem Zeitraum davor */ dir?: (r: Row) => React.ReactNode; /* Überfahren (Maus, Tastaturfokus): Vorschau auf der Karte; "" = keine */ onHover?: (key: string) => void; rows: Row[]; open: string; selected: string; icons?: boolean; onOpen: (key: string) => void; drill: (r: Row) => React.ReactNode; label: (r: Row) => string }) {
  /* Restposten („Sonstiges“) nicht als gleichrangige Zeile: klein darunter, aufklappbar wie die anderen */
  const main = rows.filter((r) => !isRest(r)), rests = rows.filter(isRest);
  const max = Math.max(1, ...main.map((r) => r.count));
  return (
    <>
    <ol className="m-0 list-none border-t border-slate-200 p-0">
      {main.map((r) => {
        const rest = isRest(r), on = open === r.key, picked = selected === r.key, dim = !!selected && !picked;
        return (
          <li key={r.key} className="border-b border-slate-200">
            <button type="button" onClick={() => onOpen(r.key)} aria-expanded={on} onMouseEnter={() => onHover?.(r.key)} onMouseLeave={() => onHover?.("")} onFocus={() => onHover?.(r.key)} onBlur={() => onHover?.("")}
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2.5 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto_16px] ${dim ? "opacity-70" : ""}`}>
              <span className={`flex items-center gap-2 text-[16px] leading-snug ${rest ? "text-slate-500" : ""} ${on || picked ? "font-semibold" : ""}`}>{icons && !rest && <ThemeIcon theme={r.key} size={18} className="shrink-0 text-slate-500" />}{r.name}{dir?.(r)}</span>
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
    {rests.map((r) => (
      <div key={r.key} className="mt-2">
        <button type="button" onClick={() => onOpen(r.key)} aria-expanded={open === r.key} className="max-sm:inline-flex max-sm:min-h-[44px] max-sm:items-center px-2 text-left text-[14px] text-slate-500 hover:text-slate-900">
          Dazu {n(r.count)} {plural(r.count, "Vorgang", "Vorgänge")} unter „{r.name}“ {open === r.key ? "▾" : "›"}</button>
        {open === r.key && <div className="mb-3 ml-2 mt-2">{drill(r)}</div>}
      </div>
    ))}
    </>
  );
}

/** Gewählter Ort als Chip mit ✕ in der Antwortzeile */
function PlaceChip({ name, onClear }: { name: string; onClear: () => void }) {
  return <button type="button" onClick={onClear} aria-label={`Ort ${name} entfernen`}
    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-300 px-3 align-baseline text-[18px] font-semibold text-slate-900 hover:border-slate-500">{name} <span aria-hidden="true" className="text-[14px] text-slate-500">✕</span></button>;
}
