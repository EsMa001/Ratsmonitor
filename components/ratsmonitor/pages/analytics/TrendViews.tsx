import { prettyTerm } from "../../lib/terms";
import { useEffect, useRef, useState } from "react";

export interface Trend { term: string; nr: number; np: number; ratio: number; z: number; regions: number; regionsPrev: number; series: number[] }
export type TrendKind = "rising" | "emerging" | "falling" | "steady";
const COLOR: Record<TrendKind, string> = { rising: "#0d9488", emerging: "#0f766e", falling: "#94a3b8", steady: "#cbd5e1" };

/** Verlaufskurve der wöchentlichen Anteile: der Zeitraum davor hellgrau, der aktuelle in der Akzentfarbe */
export function Spark({ series, kind }: { series: number[]; kind: TrendKind }) {
  const W = 120, H = 30, n = series.length, half = n / 2;
  const max = Math.max(...series, 1e-9);
  const pt = (v: number, i: number) => `${(i / Math.max(1, n - 1)) * W},${H - 3 - (v / max) * (H - 6)}`;
  const first = series.slice(0, Math.ceil(half) + 1).map((v, i) => pt(v, i)).join(" ");
  const second = series.slice(Math.floor(half)).map((v, i) => pt(v, i + Math.floor(half))).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Verlauf" className="block">
      <line x1={(half / Math.max(1, n - 1)) * W} x2={(half / Math.max(1, n - 1)) * W} y1="0" y2={H} stroke="#e2e8f0" strokeDasharray="2 3" />
      <polyline points={first} fill="none" stroke="#cbd5e1" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={second} fill="none" stroke={COLOR[kind === "steady" ? "rising" : kind]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Trendkarte: x = Einträge im aktuellen Zeitraum (log), y = Veränderung gegenüber davor (log), Größe = Zahl der Gebiete */
export function TrendMap({ items, selected, onSelect }: { items: (Trend & { kind: TrendKind })[]; selected: string; onSelect: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 800));
    ro.observe(el);
    setW(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);
  const H = w < 520 ? 320 : 400, L = 44, R = 14, T = 14, B = 34;
  if (!items.length) return <div ref={ref} />;
  const maxN = Math.max(...items.map((t) => t.nr), 10), minN = Math.min(...items.map((t) => t.nr), 5);
  const lx = (v: number) => L + ((Math.log(v) - Math.log(minN * 0.8)) / (Math.log(maxN * 1.2) - Math.log(minN * 0.8))) * (w - L - R);
  const ymax = Math.log2(Math.max(4, ...items.map((t) => t.ratio))) + 0.2, ymin = -Math.max(1.5, ...items.map((t) => -Math.log2(t.ratio))) - 0.2;
  const ly = (r: number) => T + ((ymax - Math.log2(r)) / (ymax - ymin)) * (H - T - B);
  const rad = (g: number) => 4 + Math.min(10, Math.sqrt(g) * 0.9);
  const ticks = [0.25, 0.5, 1, 2, 4, 8].filter((r) => Math.log2(r) <= ymax && Math.log2(r) >= ymin);
  /* Beschriftet werden die auffälligsten (Anstieg, Neu, Abstieg), damit es lesbar bleibt */
  const labelled = new Set(items.filter((t) => t.kind !== "steady").sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, w < 520 ? 6 : 14).map((t) => t.term));
  if (selected) labelled.add(selected);
  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={H} role="img" aria-label="Trendkarte: Begriffe nach Häufigkeit und Veränderung" className="block">
        {ticks.map((r) => (
          <g key={r}>
            <line x1={L} x2={w - R} y1={ly(r)} y2={ly(r)} stroke={r === 1 ? "#94a3b8" : "#e2e8f0"} strokeDasharray={r === 1 ? "" : "3 4"} />
            <text x={L - 8} y={ly(r) + 4} textAnchor="end" fontSize="12" fill="#64748b">{r === 1 ? "gleich" : r > 1 ? `×${r}` : `÷${1 / r}`}</text>
          </g>
        ))}
        <text x={L} y={H - 8} fontSize="12" fill="#64748b">weniger Einträge</text>
        <text x={w - R} y={H - 8} fontSize="12" fill="#64748b" textAnchor="end">mehr Einträge im aktuellen Zeitraum →</text>
        {items.map((t) => {
          const x = lx(t.nr), y = ly(t.ratio), on = t.term === selected;
          return (
            <g key={t.term} style={{ cursor: "pointer" }} onClick={() => onSelect(on ? "" : t.term)} opacity={selected && !on ? 0.35 : 1}>
              <circle cx={x} cy={y} r={rad(t.regions)} fill={COLOR[t.kind]} fillOpacity={t.kind === "steady" ? 0.55 : 0.8} stroke={on ? "#0f172a" : "#fff"} strokeWidth={on ? 2 : 1.2} />
              {labelled.has(t.term) && <text x={x} y={y - rad(t.regions) - 5} textAnchor={x > w - 90 ? "end" : x < 70 ? "start" : "middle"} fontSize="12" fill="#0f172a" stroke="#fff" strokeWidth="3.5" paintOrder="stroke" style={{ pointerEvents: "none" }}>{prettyTerm(t.term)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
