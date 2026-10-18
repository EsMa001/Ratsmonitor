import { useEffect, useRef, useState } from "react";
import { tick } from "../lib/haptic";

/**
 * Der Schalter mit mehreren Stellungen (Handy und Desktop gleich): grauer Rahmen mit sanft gerundeten Ecken (rounded-xl, Streifen 10 px), die gewählte Stelle liegt auf einem weißen
 * Streifen, der gleitet. Antippen wählt; mit dem Finger ziehen lässt den Streifen stufenlos folgen, gewählt (und geladen) wird beim
 * Loslassen. fill: über die ganze Breite, alle Stellungen gleich breit (Blätter); sonst so breit wie der Inhalt.
 */
export function Segmented<K extends string>({ options, value, onPick, label, fill = false, className = "" }: { options: [K, string, string?][]; value: K | ""; onPick: (k: K) => void; label: string; fill?: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; on: boolean } | null>(null);
  const moved = useRef(false);
  const [fx, setFx] = useState<number | null>(null);
  const [rects, setRects] = useState<{ l: number; w: number }[]>([]);
  const idx = options.findIndex(([k]) => k === value);
  /* Lage jeder Stelle messen (nach Layout und bei Größenänderung) */
  useEffect(() => {
    const measure = () => {
      const tabs = [...(box.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
      setRects(tabs.map((t) => ({ l: t.offsetLeft, w: t.offsetWidth })));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [options]);
  const pos = fx ?? (idx < 0 ? null : idx);
  const pill = (() => {
    if (pos === null || !rects.length) return null;
    const a = Math.min(rects.length - 1, Math.max(0, Math.floor(pos))), b = Math.min(rects.length - 1, a + 1), t = pos - a;
    return { l: rects[a].l + (rects[b].l - rects[a].l) * t, w: rects[a].w + (rects[b].w - rects[a].w) * t };
  })();
  const shown = fx === null ? idx : Math.round(fx);
  /* Fingerposition → Stelle als Kommazahl (zwischen den Mitten der Stellungen) */
  const at = (x: number) => {
    const el = box.current; if (!el || !rects.length) return 0;
    const left = el.getBoundingClientRect().left - el.scrollLeft;
    const c = rects.map((r) => left + r.l + r.w / 2);
    if (x <= c[0]) return 0;
    if (x >= c[c.length - 1]) return c.length - 1;
    const i = c.findIndex((v, j) => j < c.length - 1 && x >= v && x <= c[j + 1]);
    return i + (x - c[i]) / (c[i + 1] - c[i]);
  };
  return (
    <div ref={box} role="tablist" aria-label={label} style={fill ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
      className={`relative touch-pan-y rounded-xl bg-slate-100 p-1 ${fill ? "grid w-full" : "inline-flex max-w-full overflow-x-auto"} ${className}`}
      onPointerDown={(e) => { if (e.pointerType === "touch") { drag.current = { x: e.clientX, on: false }; moved.current = false; } }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d) return;
        if (!d.on && Math.abs(e.clientX - d.x) > 8) { d.on = true; moved.current = true; e.currentTarget.setPointerCapture(e.pointerId); }
        if (d.on) setFx(at(e.clientX));
      }}
      onPointerUp={() => { const f = fx; drag.current = null; setFx(null); if (f === null) return; const k = options[Math.round(f)]?.[0]; if (k !== undefined && k !== value) { tick(); onPick(k); } }}
      onPointerCancel={() => { drag.current = null; setFx(null); }}
      onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; } }}>
      {pill && <span aria-hidden="true" className={`absolute inset-y-1 rounded-[10px] bg-white shadow-sm motion-reduce:transition-none ${fx === null ? "transition-[left,width] duration-[260ms] ease-[cubic-bezier(.3,.7,.3,1)]" : ""}`} style={{ left: pill.l, width: pill.w }} />}
      {options.map(([k, l, hint], i) => (
        <button key={k} role="tab" type="button" aria-selected={k === value} title={hint} onClick={() => onPick(k)}
          className={`relative z-10 h-9 max-sm:h-10 shrink-0 whitespace-nowrap rounded-[10px] px-3 text-[14px] ${i === shown ? "font-semibold text-slate-900" : "text-slate-600 hover:text-slate-900"}`}>
          <span className="max-sm:hidden">{l}</span><span className="sm:hidden">{l.replace(" Monate", " Mon.")}</span>
        </button>
      ))}
    </div>
  );
}
