import { useDwell } from "../../lib/useDwell";
import { useState } from "react";
import { SUBTOPICS } from "@/shared/themes.mjs";
import { plural } from "../../lib/text";
import { ThemeIcon } from "../../components/icons";
import { pctText as pct } from "../../lib/format";

export interface Row { key: string; name: string; count: number; base: number; share: number | null; ags?: string; members?: string[] }
interface Item { id: string; title: string; region: string; date: string; status: string; stage: string | null; subs: string[]; times: number }
interface CompareRow { key: string; name: string; k: number; share: number; q1: number; median: number; q3: number; ratio: number | null; class: "mehr" | "weniger" | "ueblich" | null }
interface Compare { region: string; from: string; to: string; n: number; months: number; insufficient?: "items" | "months" | "group"; rule: { minItems: number; minMonths: number; minTopic: number }; group?: { label: string; n: number }; rows?: CompareRow[] }
export interface Result { selection: { theme: string; sub: string; q: string }; total: number; unread: number; parts: Row[]; months: Row[]; regions: Row[]; recent: Item[]; compare: Compare | null; facts: Fact[] }
export interface Fact { kind: string; name: string; sum: { kind: string; name: string } | null; rows: (Row & { sum?: number; median?: { median: number; unit: string; n: number } })[]; map: { key: string; ags?: string; n: number; v: Record<string, { n: number; median: number; unit: string }> }[] }

export const n = (v: number) => v.toLocaleString("de-DE");
/* Orte erst ab so vielen Sachvorgängen in der Rangliste nach Anteil (sonst führen Orte mit 2 von 3 Vorgängen) */
export const MIN_BASE = 30;
/* Restposten („Sonstiges“ = unklar, „Sonstiger Schritt“): grau und ans Ende der Liste */
export const isRest = (r: Row) => r.key === "unklar" || r.key === "sonst" || /^Sonstige/.test(r.name);
export const restLast = <T extends Row>(rows: T[]) => [...rows.filter((r) => !isRest(r)), ...rows.filter(isRest)];


/**
 * Eine Balkenliste. mode "expand": Klick öffnet die Vorgänge hinter der Zahl (aria-expanded); mode "select": Klick wählt den
 * Eintrag (aria-pressed, gewählter Eintrag dunkel). Restposten sind in der Auswahlliste nur Text.
 */
export function Bars({ rows, mode, open = "", onOpen, drill = () => null, value = (r) => r.count, label = (r) => n(r.count) }: {
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


/* Methodenhinweis eingeklappt: die Seite bleibt ruhig, wer es genau wissen will, klappt ihn auf */
export function Hint({ children }: { children: React.ReactNode }) {
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
export function OrtImVergleich({ c, theme, onPick }: { c: Compare; theme: string; onPick: (key: string) => void }) {
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

export type Level = "city" | "district";

/** Handy: Ebene der Karte (Gemeinden, Kreise) im Filterblatt statt als eigene Zeilen über und unter der Karte */
export function AtlasExtra({ level, onLevel }: { level: Level; onLevel: (l: Level) => void }) {
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


/** Gliederung rechts: Zeilen zum Aufklappen (Pfeil, Zahl in Petrol, Zeile reagiert); das gewählte Unterthema ist hervorgehoben */
export function PartList({ rows, open, selected, onOpen, drill, label, icons = false, onHover }: { /* Überfahren (Maus, Tastaturfokus): Vorschau auf der Karte; "" = keine */ onHover?: (key: string) => void; rows: Row[]; open: string; selected: string; icons?: boolean; onOpen: (key: string) => void; drill: (r: Row) => React.ReactNode; label: (r: Row) => string }) {
  /* Restposten („Sonstiges“) nicht als gleichrangige Zeile: klein darunter, aufklappbar wie die anderen */
  const main = rows.filter((r) => !isRest(r)), rests = rows.filter(isRest);
  const max = Math.max(1, ...main.map((r) => r.count));
  /* Überfahren mit der Maus: die Zeile wird in Petrol hervorgehoben, die übrigen bleiben unverändert (am Handy nichts) */
  const [hot, setHot] = useState("");
  /* Liste → Karte erst nach kurzem Verweilen; die Hervorhebung in der Liste sofort */
  const hoverD = useDwell((k: string) => onHover?.(k), "");
  const over = (k: string) => { if (typeof window !== "undefined" && window.matchMedia("(hover:hover)").matches) { setHot(k); hoverD(k); } };
  return (
    <>
    <ol className="m-0 list-none border-t border-slate-200 p-0">
      {main.map((r) => {
        const rest = isRest(r), on = open === r.key, picked = selected === r.key;
        return (
          <li key={r.key} className="border-b border-slate-200">
            <button type="button" onClick={() => onOpen(r.key)} aria-expanded={on} onMouseEnter={() => over(r.key)} onMouseLeave={() => over("")} onFocus={() => over(r.key)} onBlur={() => over("")}
              className={`grid w-full transition-colors grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2.5 text-left sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto_16px] ${hot === r.key ? "text-teal-700" : ""}`}>
              <span className={`flex items-center gap-2 text-[16px] leading-snug ${rest ? "text-slate-500" : ""} ${on || picked ? "font-semibold" : ""}`}>{icons && !rest && <ThemeIcon theme={r.key} size={18} className={`shrink-0 ${hot === r.key ? "text-teal-700" : "text-slate-500"}`} />}{r.name}</span>
              <span className="order-4 col-span-3 block h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1">
                <span className={`block h-full rounded-full ${rest ? "bg-slate-300" : picked ? "bg-slate-900" : hot === r.key ? "bg-teal-700" : "bg-teal-600"}`} style={{ width: `${(r.count / max) * 100}%` }} />
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
export function PlaceChip({ name, onClear }: { name: string; onClear: () => void }) {
  return <button type="button" onClick={onClear} aria-label={`Ort ${name} entfernen`}
    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-300 px-3 align-baseline text-[18px] font-semibold text-slate-900 hover:border-slate-500">{name} <span aria-hidden="true" className="text-[14px] text-slate-500">✕</span></button>;
}
