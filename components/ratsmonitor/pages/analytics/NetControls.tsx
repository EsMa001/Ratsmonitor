import type { MutableRefObject, ReactNode } from "react";
import { IconCenter, IconMinus, IconPlus } from "../../components/icons";
import { Segmented } from "./Kennzahlen";

/* Bedienelemente, die Themennetz und Gremiennetz gemeinsam haben */

export type Level = "overview" | "normal" | "detail";

/** Detailstufe: Desktop wählbar (Standard je Breite), am Handy nur zwei Stufen: „Normal“ (= overview) und „Detail“ (= normal) */
export const netLevel = (phone: boolean, wide: boolean, chosen: Level | null): Level =>
  phone ? (chosen === "normal" ? "normal" : "overview") : chosen ?? (wide ? "detail" : "normal");

/** Desktop: Umschalter der Detailstufe über dem Netz */
export function LevelSegmented({ options, value, onPick }: { options: [Level, string][]; value: Level; onPick: (l: Level) => void }) {
  return <div className="max-sm:hidden rm-xseg mt-6 flex justify-end print:hidden"><Segmented label="Detailstufe" options={options} value={value} onPick={onPick} /></div>;
}

/** Handy: Glas-Pille auf dem Netz mit den zwei Stufen */
export function LevelPill({ value, onPick }: { value: Level; onPick: (l: Level) => void }) {
  return (
    <div role="group" aria-label="Detailstufe" className="rm-stage-chip absolute bottom-2 left-1/2 z-[7] flex -translate-x-1/2 gap-0.5 rounded-full p-0.5 text-[12px] sm:hidden">
      {(["overview", "normal"] as const).map((l) => <button key={l} type="button" aria-pressed={value === l} onClick={() => onPick(l)} className={`h-8 rounded-full px-4 ${value === l ? "bg-teal-700 text-white" : "text-slate-700"}`}>{l === "overview" ? "Normal" : "Detail"}</button>)}
    </div>
  );
}

/** Legende oben links auf dem Netz (Handy: waagerecht, mittig, so breit wie der Inhalt) */
export function NetLegend({ items, note }: { items: { key: string; label: string; dot: React.CSSProperties }[]; note?: ReactNode }) {
  return (
    <div className="rm-stage-chip absolute left-3 top-3 z-[6] rounded-2xl px-3 py-2 text-[12px] max-sm:left-1/2 max-sm:w-max max-sm:max-w-[calc(100%-16px)] max-sm:-translate-x-1/2 max-sm:top-2 max-sm:px-3 max-sm:py-1.5 max-sm:text-[12px]">
      <ul className="m-0 flex list-none flex-col gap-1 p-0 max-sm:flex-row max-sm:flex-wrap max-sm:justify-center max-sm:gap-x-3 max-sm:gap-y-0.5">
        {items.map((i) => <li key={i.key} className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-full" style={{ ...i.dot, boxShadow: "0 0 0 1px rgba(24,24,27,.25)" }} />{i.label}</li>)}
      </ul>
      {note}
    </div>
  );
}

/** Zoom-Knöpfe (nur Desktop; am Handy zoomt man mit zwei Fingern) */
export function NetZoom({ zoomRef }: { zoomRef: MutableRefObject<((f: number | "fit") => void) | null> }) {
  const btn = "grid h-8 w-8 place-items-center text-[var(--st-text)] hover:text-teal-700";
  return (
    <div className="rm-stage-chip rm-netzoom absolute bottom-3 left-3 z-[6] flex flex-col overflow-hidden rounded-full max-sm:hidden">
      <button type="button" title="Vergrößern" aria-label="Vergrößern" onClick={() => zoomRef.current?.(1.3)} className={btn}><IconPlus size={14} /></button>
      <button type="button" title="Verkleinern" aria-label="Verkleinern" onClick={() => zoomRef.current?.(1 / 1.3)} className={btn}><IconMinus size={14} /></button>
      <button type="button" title="Ganzes Netz zeigen" aria-label="Ganzes Netz zeigen" onClick={() => zoomRef.current?.("fit")} className={btn}><IconCenter size={14} /></button>
    </div>
  );
}
