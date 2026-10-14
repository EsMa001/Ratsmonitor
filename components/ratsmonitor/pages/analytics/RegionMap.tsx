import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDarkMode } from "../../lib/useDarkMode";
import { MapEngine } from "../../lib/geo/mapEngine";
import { MAP_COLORS } from "../../lib/constants";
import { useData } from "../../state/data";
import { IconCenter, IconMinus, IconPlus } from "../../components/icons";

/* Karte für plenara.X-Radare mit derselben Engine wie Suche und Ausbreitung: Gemeinden in Stufen 1 bis 4 eingefärbt
   (levels: Gemeindeschlüssel → Stufe), Klick wählt eine Gemeinde. Lage nur auf Gemeindeebene. */
const glass = "rm-glass";

export function RegionMap({ levels, legend, label, picked, onPick, info, level = "city", note }: {
  levels: Record<string, number>; legend: string[]; label: string; picked: string; onPick: (ags: string) => void; info?: React.ReactNode;
  /* Gemeinden (Schlüssel 8 Stellen) oder Kreise (5 Stellen) */ level?: "city" | "district"; /* Zusatz unter der Legende, z. B. „grau: zu wenig Daten“ */ note?: string;
}) {
  const { geo } = useData();
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  });
  /* Stabiler Weg zum aktuellen onPick, die Karte wird nur einmal je Geodaten gebaut */
  const select = useCallback((a: string) => pickRef.current(a), []);
  // Die Karte ruft select erst bei einem Klick auf, nicht beim Rendern
  // eslint-disable-next-line react-hooks/refs
  const engine = useMemo(() => (geo ? new MapEngine(geo, { onSelect: select, onHover: () => {}, onViewChange: () => {}, onWheelHint: () => {} }) : null), [geo, select]);
  const dark = useDarkMode()[0];
  useEffect(() => { engine?.setDark(dark); }, [engine, dark]);
  useEffect(() => {
    if (!engine) return;
    const detach = engine.attach(stageRef.current!, baseRef.current!, overRef.current!);
    engine.setLocked(false);
    engine.setExplore(true, null);
    return detach;
  }, [engine]);
  const all = useMemo(() => (geo ? [...(level === "district" ? geo.krs : geo.gem).idx.keys()] : []), [geo, level]);
  const shown = useMemo(() => Object.keys(levels).filter((a) => levels[a] > 0), [levels]);
  useEffect(() => {
    if (!engine) return;
    const v: Record<string, number> = {};
    for (const a of all) v[a] = 0;
    Object.assign(v, levels);
    engine.update(v, picked, null, all, level);
  }, [engine, levels, all, picked, level]);
  useEffect(() => { if (!engine) return; if (shown.length) engine.focusMany(shown); else engine.focusArea(""); }, [engine, shown]);

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[22px] border border-slate-200 sm:h-[540px]">
      <div ref={stageRef} className="absolute inset-0 touch-none select-none overflow-hidden bg-map-ground">
        <canvas ref={baseRef} aria-hidden="true" className="absolute left-0 top-0 block h-full w-full" />
        <canvas ref={overRef} role="img" aria-label={label} className="absolute left-0 top-0 block h-full w-full" />
        {!geo && <div className="absolute inset-0 grid place-items-center text-[14px] text-slate-500">Karte wird aufgebaut …</div>}
      </div>
      <div className={`${glass} absolute left-3 top-3 z-[6] rounded-2xl px-3 py-2 text-[12px] text-slate-700`}>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {legend.map((l, i) => <li key={l} className="flex items-center gap-2"><i className="inline-block h-3 w-5 rounded-sm" style={{ background: MAP_COLORS.scale[i] }} />{l}</li>)}
        </ul>
        {note && <p className="m-0 mt-1 max-w-[180px] text-slate-500">{note}</p>}
      </div>
      <div className={`${glass} absolute right-3 top-3 z-[6] flex flex-col overflow-hidden rounded-full`}>
        <button type="button" title="Vergrößern" aria-label="Vergrößern" onClick={() => engine?.zoomBy(1.6)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-700"><IconPlus size={16} /></button>
        <button type="button" title="Verkleinern" aria-label="Verkleinern" onClick={() => engine?.zoomBy(1 / 1.6)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-700"><IconMinus size={16} /></button>
        <button type="button" title="Auf Ergebnis zentrieren" aria-label="Auf Ergebnis zentrieren" onClick={() => (shown.length ? engine?.focusMany(shown) : engine?.focusArea(""))} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-700"><IconCenter size={16} /></button>
      </div>
      {info && <div className="pointer-events-none absolute inset-x-16 top-3 z-[6] flex justify-center max-sm:inset-x-3 max-sm:bottom-3 max-sm:top-auto"><span className={`${glass} rounded-2xl px-4 py-2 text-center text-[14px] text-slate-900`}>{info}</span></div>}
    </div>
  );
}
