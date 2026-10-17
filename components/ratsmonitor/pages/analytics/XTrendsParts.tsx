import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDarkMode } from "../../lib/useDarkMode";
import { MapEngine } from "../../lib/geo/mapEngine";
import { useData } from "../../state/data";
import { IconCenter, IconMinus, IconPlus } from "../../components/icons";

/* Bausteine der Seite plenara.X Trends: Karte der Ausbreitung mit Zeitregler und Kurve der erreichten Gebiete (Linie mit Fläche).
   Eigene Bausteine, damit die alten Tools Trends und Ausbreitung unverändert bleiben. */

export const DAY = 86400000;
export const toDay = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / DAY);
export const toIso = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);
export const fmt = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : "–");
/* Rahmenlos wie die übrigen plenara.X-Seiten (rm-legend statt rm-glass) */
const glass = "rm-legend";
/* Wie die Ausbreitung: je länger die erste Erwähnung her ist, desto dunkler */
export const AGE_LEGEND: [string, string][] = [["var(--rm-map1)", "bis 1 Monat"], ["var(--rm-map2)", "bis 3 Monate"], ["var(--rm-map3)", "bis 6 Monate"], ["var(--rm-ac)", "länger"]];
const levelAt = (first: string, today: number) => { const age = today - toDay(first); return age < 0 ? 0 : age <= 31 ? 1 : age <= 92 ? 2 : age <= 183 ? 3 : 4; };

export interface SpreadRegion { ags: string; name: string; first: string; n: number; members?: string[]; atStart?: boolean }
export const keysOf = (r: SpreadRegion) => r.members ?? [r.ags];

/** Karte mit Zeitregler: Gebiete eingefärbt nach Alter der ersten Erwähnung am gewählten Tag; Klick wählt ein Gebiet */
export function SpreadMap({ regions, day, firstDay, lastDay, onDay, playing, onToggle, picked, onPick, info }: {
  regions: SpreadRegion[]; day: number; firstDay: number; lastDay: number; onDay: (d: number) => void; playing: boolean; onToggle: () => void;
  picked: string; onPick: (ags: string) => void; info?: React.ReactNode;
}) {
  const { geo } = useData();
  const stageRef = useRef<HTMLDivElement>(null), baseRef = useRef<HTMLCanvasElement>(null), overRef = useRef<HTMLCanvasElement>(null);
  const pickRef = useRef(onPick);
  useEffect(() => { pickRef.current = onPick; });
  const select = useCallback((a: string) => pickRef.current(a), []);
  // Die Karte ruft select erst bei einem Klick auf
  // eslint-disable-next-line react-hooks/refs
  const engine = useMemo(() => (geo ? new MapEngine(geo, { onSelect: select, onHover: () => {}, onViewChange: () => {}, onWheelHint: () => {} }) : null), [geo, select]);
  const dark = useDarkMode()[0];
  useEffect(() => { engine?.setDark(dark); }, [engine, dark]);
  useEffect(() => { engine?.setPalette(AGE_LEGEND.map(([c]) => c)); }, [engine]);
  useEffect(() => {
    if (!engine) return;
    const detach = engine.attach(stageRef.current!, baseRef.current!, overRef.current!);
    engine.setLocked(false);
    engine.setExplore(true, null);
    engine.setWheelGuard(true);
    engine.setBottomInset(76);
    return detach;
  }, [engine]);
  const all = useMemo(() => (geo ? [...geo.gem.idx.keys()] : []), [geo]);
  useEffect(() => {
    if (!engine) return;
    const v: Record<string, number> = {};
    for (const a of all) v[a] = 0;
    for (const r of regions) for (const a of keysOf(r)) v[a] = Math.max(v[a] ?? 0, levelAt(r.first, day));
    engine.update(v, picked, null, all, "city");
  }, [engine, regions, day, all, picked]);
  /* Nur bei neuen Daten auf das Ergebnis zentrieren, nicht bei jedem Tag des Zeitraffers */
  useEffect(() => { if (!engine) return; if (regions.length) engine.focusMany(regions.flatMap(keysOf)); else engine.focusArea(""); }, [engine, regions]);
  const reached = regions.filter((r) => toDay(r.first) <= day).length;

  return (
    <section className="relative h-[420px] overflow-hidden rounded-[22px] border border-slate-200 sm:h-[540px] lg:h-[720px]" aria-label="Karte der Ausbreitung">
      <div ref={stageRef} className="absolute inset-0 touch-none select-none overflow-hidden bg-map-ground">
        <canvas ref={baseRef} aria-hidden="true" className="absolute left-0 top-0 block h-full w-full" />
        <canvas ref={overRef} role="img" aria-label={`Karte: ${reached} von ${regions.length} Gebieten erreicht am ${fmt(toIso(day))}`} className="absolute left-0 top-0 block h-full w-full" />
        {!geo && <div className="absolute inset-0 grid place-items-center text-[14px] text-slate-500">Karte wird aufgebaut …</div>}
      </div>
      <div className={`${glass} absolute left-3 top-3 z-[6] rounded-2xl px-3 py-2 text-[12px] text-slate-700`}>
        <p className="m-0 mb-1 font-medium text-slate-900">Erste Erwähnung vor</p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {AGE_LEGEND.map(([c, l]) => <li key={l} className="flex items-center gap-2"><i className="inline-block h-3 w-5 rounded-sm" style={{ background: c }} />{l}</li>)}
          <li className="flex items-center gap-2"><i className="inline-block h-3 w-5 rounded-sm" style={{ background: "var(--rm-c200)" }} />noch nicht</li>
        </ul>
      </div>
      <div className={`${glass} absolute right-3 top-3 z-[6] flex flex-col overflow-hidden rounded-full`}>
        <button type="button" title="Vergrößern" aria-label="Vergrößern" onClick={() => engine?.zoomBy(1.6)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-700"><IconPlus size={16} /></button>
        <button type="button" title="Verkleinern" aria-label="Verkleinern" onClick={() => engine?.zoomBy(1 / 1.6)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-700"><IconMinus size={16} /></button>
        <button type="button" title="Auf Ergebnis zentrieren" aria-label="Auf Ergebnis zentrieren" onClick={() => (regions.length ? engine?.focusMany(regions.flatMap(keysOf)) : engine?.focusArea(""))} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-700"><IconCenter size={16} /></button>
      </div>
      {info && <div className="pointer-events-none absolute inset-x-16 top-3 z-[6] flex justify-center max-sm:inset-x-3 max-sm:bottom-[88px] max-sm:top-auto"><span className={`${glass} rounded-2xl px-4 py-2 text-center text-[14px] text-slate-900`}>{info}</span></div>}
      {regions.length > 0 && (
        <div className={`${glass} absolute inset-x-3 bottom-3 z-[6] flex items-center gap-3 rounded-full px-3 py-2 sm:inset-x-6`}>
          <PlayButton playing={playing} onToggle={onToggle} />
          <span className="w-[64px] shrink-0 text-[16px] font-medium tabular-nums">{fmt(toIso(day))}</span>
          <input type="range" min={firstDay} max={lastDay} value={day} onChange={(e) => onDay(Number(e.target.value))} aria-label="Datum" className="min-w-0 flex-1 accent-teal-600" />
          <span className="shrink-0 text-right text-[14px] tabular-nums text-slate-700"><b className="font-semibold">{reached.toLocaleString("de-DE")}</b><span className="max-sm:hidden"> / {regions.length.toLocaleString("de-DE")}</span></span>
        </div>
      )}
    </section>
  );
}

export function PlayButton({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label={playing ? "Zeitraffer anhalten" : "Zeitraffer abspielen"} title={playing ? "Zeitraffer anhalten" : "Zeitraffer abspielen"}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-700 text-white hover:bg-teal-800">
      {playing ? <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" /></svg>
        : <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>}
    </button>
  );
}

/**
 * Erreichte Gebiete im Zeitverlauf als Linie mit Fläche (statt Säulen), über den ganzen Bestand; der gewählte Zeitraum der
 * Trends ist hinterlegt. Klicken oder Ziehen setzt den Tag der Karte.
 */
export function SpreadChart({ firsts, day, onPick, window: win }: { firsts: number[]; day: number; onPick: (d: number) => void; window: [number, number] }) {
  const drag = useRef(false);
  if (firsts.length < 2) return null;
  const W = 1000, H = 200, total = firsts.length;
  const t0 = firsts[0], t1 = Math.max(firsts[total - 1], win[1], t0 + 1);
  const x = (d: number) => ((Math.min(t1, Math.max(t0, d)) - t0) / (t1 - t0)) * W;
  const y = (k: number) => H - (k / total) * (H - 8) - 4;
  /* Treppe: je Tag mit neuer Erwähnung ein Schritt */
  let path = `M0,${y(0)}`;
  firsts.forEach((d, i) => { path += ` L${x(d).toFixed(1)},${y(i).toFixed(1)} L${x(d).toFixed(1)},${y(i + 1).toFixed(1)}`; });
  path += ` L${W},${y(total)}`;
  const reached = firsts.filter((d) => d <= day).length;
  const at = (e: React.PointerEvent<SVGSVGElement>) => { const b = e.currentTarget.getBoundingClientRect(); onPick(Math.round(t0 + ((e.clientX - b.left) / b.width) * (t1 - t0))); };
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[160px] w-full cursor-ew-resize touch-none sm:h-[200px]" role="img"
        aria-label={`Erreichte Gebiete im Zeitverlauf: ${total.toLocaleString("de-DE")} seit ${fmt(toIso(t0))}, am ${fmt(toIso(day))} ${reached.toLocaleString("de-DE")}`}
        onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); at(e); }} onPointerMove={(e) => drag.current && at(e)} onPointerUp={() => { drag.current = false; }}>
        <rect x={x(win[0])} y={0} width={Math.max(2, x(win[1]) - x(win[0]))} height={H} className="fill-slate-400/10" />
        <path d={`${path} L${W},${H} L0,${H} Z`} className="fill-teal-600/10" />
        <path d={path} fill="none" className="stroke-teal-600" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <line x1={x(day)} x2={x(day)} y1={0} y2={H} className="stroke-slate-900" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[12px] tabular-nums text-slate-500">
        <span>{fmt(toIso(t0))}</span><span>grau: gewählter Zeitraum</span><span>{fmt(toIso(t1))}</span>
      </figcaption>
    </figure>
  );
}

/** Kleine Kurve der erreichten Gebiete (zwölf Monatsenden) für eine Zeile der Liste */
export function MiniCurve({ curve }: { curve: number[] }) {
  const W = 96, H = 28, max = Math.max(1, ...curve), min = Math.min(...curve);
  const span = Math.max(1, max - min);
  const pts = curve.map((v, i) => [(i / (curve.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)]);
  const line = pts.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" className="shrink-0">
      <path d={`${line} L${W},${H} L0,${H} Z`} className="fill-teal-600/10" />
      <path d={line} fill="none" className="stroke-teal-600" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
