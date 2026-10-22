import { isPhone } from "../../lib/usePhone";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useDarkMode } from "../../lib/useDarkMode";
import { MapEngine } from "../../lib/geo/mapEngine";
import { MAP_COLORS } from "../../lib/constants";
import { useData } from "../../state/data";
import { clearMapSlot, setMapSlot } from "../../lib/mapSlot";
import { IconCenter, IconMinus, IconPlus } from "../../components/icons";

/* Karte für plenara.X-Radare mit derselben Engine wie Suche und Ausbreitung: Gemeinden in Stufen 1 bis 4 eingefärbt
   (levels: Gemeindeschlüssel → Stufe), Klick wählt eine Gemeinde. Lage nur auf Gemeindeebene. */
/* Rahmenlos wie die übrigen plenara.X-Seiten (rm-legend statt rm-glass) */
const glass = "rm-legend";

export function RegionMap({ levels, legend, label, picked, onPick, info, level = "city", note, colors, tall = false, pins, dots, phoneStage = false }: {
  /* Handy: Karte als Bühne (randlos, Suche unten, Legende und Zoom oben, Hinweis weg); nur Themenatlas */ phoneStage?: boolean;
  /* Einzelne Vorgänge als Punkte statt eingefärbter Flächen (Projekte): Gebietsschlüssel → Zahl der Punkte */ dots?: Record<string, number>;
  levels: Record<string, number>; legend: string[]; label: string; picked: string; onPick: (ags: string) => void; info?: React.ReactNode;
  /* Gemeinden (Schlüssel 8 Stellen) oder Kreise (5 Stellen) */ level?: "city" | "district"; /* Zusatz unter der Legende, z. B. „grau: zu wenig Daten“ */ note?: string; /* eigene Farben je Stufe (sonst Abdeckung) */ colors?: string[]; /* höher auf breiten Bildschirmen (Atlas: halbe Breite) */ tall?: boolean; /* Orte als Schild auf der Karte: Gemeindeschlüssel (Verband: Mitglieder) und Name */ pins?: { ags: string[]; label: string }[];
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
  /* Hinweis, wenn jemand über der Karte scrollt, ohne sie gewählt zu haben: die Seite scrollt weiter, die Karte zoomt nicht */
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintRef = useRef(() => {});
  useEffect(() => {
    hintRef.current = () => { setHint(true); if (hintTimer.current) clearTimeout(hintTimer.current); hintTimer.current = setTimeout(() => setHint(false), 1400); };
  });
  // Die Karte ruft select erst bei einem Klick auf, nicht beim Rendern
  // eslint-disable-next-line react-hooks/refs
  const engine = useMemo(() => (geo ? new MapEngine(geo, { onSelect: select, onHover: () => {}, onViewChange: () => {}, onWheelHint: () => hintRef.current() }) : null), [geo, select]);
  const slotRef = useRef<HTMLDivElement>(null);
  /* Handy-Bühne: Höhe der Karte aus der tatsächlichen Lage (Platz bis zur unteren Leiste), damit die Suchleiste unten nie unter der Leiste liegt,
     egal wie viel Text die Seite über der Karte hat */
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxH, setBoxH] = useState<number | null>(null);
  useEffect(() => {
    if (!phoneStage) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = boxRef.current, bar = document.querySelector<HTMLElement>(".rm-tabbar");
      if (!el || !isPhone() || window.innerHeight < 500) { setBoxH(null); return; }
      const h = window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - (bar?.offsetHeight ?? 0) - 6;
      setBoxH(Math.max(240, Math.round(h)));
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    window.addEventListener("resize", schedule);
    return () => { ro.disconnect(); window.removeEventListener("resize", schedule); if (raf) cancelAnimationFrame(raf); };
  }, [phoneStage]);
  const [topInset, setTopInset] = useState(0);
  useEffect(() => {
    const el = slotRef.current;
    setMapSlot(el);
    /* Höhe von Suchleiste und Chips auf der Karte: so viel bleibt beim Einpassen oben frei */
    const ro = el ? new ResizeObserver(() => setTopInset(el.getBoundingClientRect().height ? Math.round(el.getBoundingClientRect().height + 8) : 0)) : null;
    if (el && ro) ro.observe(el);
    return () => { ro?.disconnect(); clearMapSlot(el); };
  }, []);
  const pinKey = pins?.map((p) => p.label + p.ags.join()).join("|") ?? "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { engine?.setPins(pins ?? []); }, [engine, pinKey]);
  const dark = useDarkMode()[0];
  useEffect(() => { engine?.setDark(dark); }, [engine, dark]);
  const colorKey = colors?.join() ?? "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { engine?.setPalette(colors ?? null); }, [engine, colorKey]);
  useEffect(() => {
    if (!engine) return;
    const detach = engine.attach(stageRef.current!, baseRef.current!, overRef.current!);
    engine.setLocked(false);
    engine.setExplore(true, null);
    engine.setWheelGuard(true);
    return detach;
  }, [engine]);
  /* Nach dem Anhängen (das den Kartenmodus ohne Punkte setzt): Punkte je Gebiet */
  const dotKey = dots ? Object.entries(dots).map(([a, k]) => a + ":" + k).join() : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!engine) return; engine.setStyle(dots ? "punkte" : "flaechen"); engine.setExplore(true, dots ?? null); }, [engine, dotKey]);
  const all = useMemo(() => (geo ? [...(level === "district" ? geo.krs : geo.gem).idx.keys()] : []), [geo, level]);
  const shown = useMemo(() => Object.keys(levels).filter((a) => levels[a] > 0), [levels]);
  /* Sanfter Wechsel: das alte Bild liegt kurz als Kopie über der Karte und blendet aus, statt dass die Farben hart umspringen */
  const ghostRef = useRef<HTMLCanvasElement>(null);
  const fadeOut = () => {
    const g = ghostRef.current, b = baseRef.current;
    if (!g || !b || !b.width || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    g.width = b.width; g.height = b.height;
    g.getContext("2d")?.drawImage(b, 0, 0);
    g.style.transition = "none"; g.style.opacity = "1";
    requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transition = "opacity 380ms ease-out"; g.style.opacity = "0"; }));
  };
  const firstDraw = useRef(true);
  useEffect(() => {
    if (!engine) return;
    if (firstDraw.current) firstDraw.current = false; else fadeOut();
    const v: Record<string, number> = {};
    for (const a of all) v[a] = 0;
    Object.assign(v, levels);
    engine.update(v, picked, null, all, level);
  }, [engine, levels, all, picked, level]);
  /* Zurück-Gefühl: Wer die Seite verlässt und zurückkommt, findet die Karte im selben Ausschnitt (10 Minuten, nur diese Sitzung) */
  const restoreRef = useRef<{ cx: number; cy: number; k: number } | null>(null);
  const skipFly = useRef(false);
  useEffect(() => {
    if (!engine) return;
    const key = `rm-mapview:${window.location.pathname}:${level}`;
    try {
      const raw = JSON.parse(sessionStorage.getItem(key) || "null");
      if (raw && Date.now() - raw.at < 10 * 60_000 && raw.v) { restoreRef.current = raw.v; skipFly.current = true; }
    } catch { /* ohne Speicher geht es auch */ }
    return () => {
      const v = engine.getView();
      if (v) { try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), v })); } catch { /* egal */ } }
    };
  }, [engine, level]);
  useEffect(() => {
    if (!engine) return;
    const phone = isPhone();
    /* Handy quer (kurz): wenig Platz, die Ränder für Auswahl und Suche schrumpfen */
    const short = phone && window.innerHeight < 500;
    engine.setFitInsets(phone ? (short ? 44 : phoneStage ? 74 : topInset) : 0, phone ? (short ? 44 : phoneStage ? topInset + 6 : 52) : 0);
    if (restoreRef.current) { engine.restoreView(restoreRef.current); restoreRef.current = null; return; }
    if (skipFly.current) { if (shown.length) skipFly.current = false; return; }
    if (shown.length) engine.focusMany(shown); else engine.focusArea("");
  }, [engine, shown, topInset, phoneStage]);
  /* Kamerafahrt: ein gewähltes Gebiet rückt mit seiner Umgebung ins Bild, ohne Wahl zurück auf die Ergebnisse */
  const firstPick = useRef(true);
  useEffect(() => {
    if (!engine) return;
    if (firstPick.current) { firstPick.current = false; return; }
    if (picked) engine.focusAreaWide(picked); else if (shown.length) engine.focusMany(shown); else engine.focusArea("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, picked]);


  return (
    <div className={`rm-mapwrap relative${phoneStage ? " max-sm:-mx-[max(1vw,16px)] max-sm:-mt-3" : ""}`}>
    {/* Handy: Platz für die Suchleiste der Seite oben auf der Karte (siehe lib/mapSlot.ts) */}
    <div ref={slotRef} className={phoneStage ? "absolute inset-x-2 bottom-2 z-30 flex flex-col-reverse gap-1 empty:hidden sm:hidden" : "absolute inset-x-0 top-2 z-30 empty:hidden sm:hidden"} />
    <div ref={boxRef} style={boxH ? { height: boxH } : undefined} className={`rm-mapbox relative h-[420px] overflow-hidden bg-slate-50 rounded-[22px] ${phoneStage ? "max-sm:rounded-none max-sm:h-[calc(100svh-170px-var(--rm-tabbar))]" : "max-sm:rounded-2xl max-sm:h-[300px]"} border max-sm:border-transparent border-slate-200 sm:h-[540px] ${tall ? "min-[640px]:h-[720px]" : ""}`}>
      <div ref={stageRef} className="rm-stage absolute inset-0 touch-none select-none overflow-hidden bg-map-ground">
        <canvas ref={baseRef} aria-hidden="true" className="absolute left-0 top-0 block h-full w-full" />
        <canvas ref={ghostRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 block h-full w-full opacity-0" />
        <canvas ref={overRef} role="img" aria-label={label} className="absolute left-0 top-0 block h-full w-full" />
        {!geo && <div className="absolute inset-0 grid place-items-center text-[14px] text-slate-500">Karte wird aufgebaut …</div>}
        <div aria-hidden="true" className={`pointer-events-none absolute inset-0 grid place-items-center bg-slate-900/25 transition-opacity duration-200 ${hint ? "opacity-100" : "opacity-0"}`}>
          <span className="rounded-full bg-white px-4 py-2 text-[14px] font-medium text-slate-900 shadow">Zum Zoomen in die Karte klicken oder Strg/⌘ + Scrollen</span>
        </div>
      </div>
      <div className={`${glass} absolute left-3 top-3 z-[6] rounded-2xl px-3 py-2 text-[12px] text-slate-700 ${phoneStage ? "rm-xlegend max-sm:top-[72px] max-sm:left-2 max-sm:right-auto max-sm:bottom-auto" : "max-sm:bottom-2 max-sm:left-2 max-sm:right-14 max-sm:top-auto"} max-sm:rounded-xl max-sm:px-2 max-sm:py-1`}>
        <ul className={`m-0 flex list-none flex-col gap-1 p-0 ${phoneStage ? "" : "max-sm:flex-row max-sm:flex-wrap max-sm:gap-x-2.5 max-sm:gap-y-0.5"}`}>
          {legend.map((l, i) => <li key={l} className="flex items-center gap-2 max-sm:gap-1"><i className="inline-block h-3 w-5 rounded-sm max-sm:w-3" style={{ background: colors?.[i] ?? MAP_COLORS.scale[i] }} /><span className="max-sm:hidden">{l}</span><span className="sm:hidden">{l.replace(/\s*Vorg\S*/, "").replace(" bis ", "–").replace("über ", ">")}</span></li>)}
        </ul>
        {note && <p className={`m-0 mt-1 max-w-[180px] text-slate-500 max-sm:mt-0 max-sm:max-w-none ${note.length > 40 || phoneStage ? "max-sm:hidden" : ""}`}>{note}</p>}
      </div>
      <div className={`${glass} absolute right-3 top-3 z-[6] flex flex-col overflow-hidden rounded-full ${phoneStage ? "max-sm:hidden" : "max-sm:bottom-2 max-sm:right-2 max-sm:top-auto"}`}>
        <button type="button" title="Vergrößern" aria-label="Vergrößern" onClick={() => engine?.zoomBy(1.6)} className={`${phoneStage ? "max-sm:hidden " : ""}grid h-8 w-8 place-items-center text-slate-700 hover:text-teal-700`}><IconPlus size={14} /></button>
        <button type="button" title="Verkleinern" aria-label="Verkleinern" onClick={() => engine?.zoomBy(1 / 1.6)} className={`${phoneStage ? "max-sm:hidden " : ""}grid h-8 w-8 place-items-center text-slate-700 hover:text-teal-700`}><IconMinus size={14} /></button>
        <button type="button" title="Auf Ergebnis zentrieren" aria-label="Auf Ergebnis zentrieren" onClick={() => (shown.length ? engine?.focusMany(shown) : engine?.focusArea(""))} className="grid h-8 w-8 place-items-center text-slate-700 hover:text-teal-700"><IconCenter size={14} /></button>
      </div>
      {info && <div className={`pointer-events-none absolute inset-x-16 top-3 z-[6] flex justify-center ${phoneStage ? "max-sm:inset-x-3 max-sm:top-[114px] max-sm:bottom-auto" : "max-sm:inset-x-3 max-sm:bottom-3 max-sm:top-auto"}`}><span className={`${glass} rounded-2xl px-4 py-2 text-center text-[14px] text-slate-900`}>{info}</span></div>}
    </div>
    </div>
  );
}
