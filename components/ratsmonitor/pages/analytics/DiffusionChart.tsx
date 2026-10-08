import { useRef } from "react";
/** Kurve der erreichten Gebiete (Anteil in %) mit den neu erreichten Gebieten je Monat als Säulen; Klicken, Ziehen oder die Pfeiltasten wählen das Datum, die Taste steuert den Zeitraffer */
interface Props { firsts: number[]; series: { month: string; added: number }[]; day: number; onPick: (d: number) => void; playing: boolean; onToggle: () => void }
const DAY = 86400000;
const toDay = (iso: string) => Math.floor(Date.parse(iso + "T00:00:00Z") / DAY);
const fmt = (d: number) => { const s = new Date(d * DAY).toISOString(); return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(2, 4)}`; };

/** Glatte, nie fallende Kurve durch die Punkte (monotone kubische Interpolation) */
function smooth(p: [number, number][]) {
  const n = p.length;
  const dx = p.slice(1).map((a, i) => a[0] - p[i][0]);
  const m = p.slice(1).map((a, i) => (a[1] - p[i][1]) / dx[i]);
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = Math.hypot(a, b);
    if (h > 3) { t[i] = (3 * a * m[i]) / h; t[i + 1] = (3 * b * m[i]) / h; }
  }
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) d += ` C${p[i][0] + dx[i] / 3},${p[i][1] + (t[i] * dx[i]) / 3} ${p[i + 1][0] - dx[i] / 3},${p[i + 1][1] - (t[i + 1] * dx[i]) / 3} ${p[i + 1][0]},${p[i + 1][1]}`;
  return d;
}

export function DiffusionChart({ firsts, series, day, onPick, playing, onToggle }: Props) {
  const drag = useRef(false);
  if (firsts.length < 2) return null;
  const W = 1000, H = 240, total = firsts.length;
  const t0 = firsts[0], t1 = Math.max(firsts[total - 1], t0 + 1);
  const x = (d: number) => ((d - t0) / (t1 - t0)) * W;
  const y = (share: number) => H - share * (H - 8) - 4;
  /* Anteil der bis zum Tag erreichten Gebiete (firsts ist aufsteigend sortiert) */
  const share = (d: number) => { let lo = 0, hi = total; while (lo < hi) { const mid = (lo + hi) >> 1; if (firsts[mid] <= d) lo = mid + 1; else hi = mid; } return lo / total; };
  const N = 80;
  const pts: [number, number][] = Array.from({ length: N + 1 }, (_, i) => { const d = t0 + ((t1 - t0) * i) / N; return [x(d), y(share(d))]; });
  const line = smooth(pts);
  const maxAdd = Math.max(...series.map((s) => s.added), 1);
  const barW = Math.max(3, Math.min(26, (W / Math.max(series.length, 1)) * 0.55));
  const cur = Math.min(t1, Math.max(t0, day));
  const left = (x(cur) / W) * 100, top = (y(share(cur)) / H) * 100;
  /* Tag unter dem Zeiger (Klicken und Ziehen) */
  const dayAt = (e: React.PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); return Math.round(t0 + (Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1)) * (t1 - t0)); };
  const key = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 30 : 7;
    const to = e.key === "ArrowLeft" || e.key === "ArrowDown" ? cur - step : e.key === "ArrowRight" || e.key === "ArrowUp" ? cur + step : e.key === "Home" ? t0 : e.key === "End" ? t1 : null;
    if (to == null) return;
    e.preventDefault();
    onPick(Math.min(t1, Math.max(t0, to)));
  };
  return (
    <figure className="m-0">
      <div className="mb-3 flex items-center gap-3">
        <button type="button" onClick={onToggle} aria-label={playing ? "Zeitraffer anhalten" : "Zeitraffer abspielen"} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-900 text-white transition-opacity hover:opacity-85">
          {playing ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg> : <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>}
        </button>
        <span className="text-[16px] font-medium tabular-nums">{fmt(cur)}</span>
        <span className="text-[14px] text-slate-500">{Math.round(share(cur) * 100)} % der Gebiete erreicht · Linie oder Punkt ziehen</span>
      </div>
      <div className="relative ml-12" style={{ height: H }} tabIndex={0} role="slider" aria-label="Datum im Zeitverlauf" aria-valuemin={t0} aria-valuemax={t1} aria-valuenow={cur} aria-valuetext={`${fmt(cur)}, ${Math.round(share(cur) * 100)} % der Gebiete erreicht`} onKeyDown={key}>
        {[0, 0.5, 1].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-slate-200" style={{ top: `${(y(g) / H) * 100}%` }}>
            <span className="absolute -left-12 w-10 -translate-y-1/2 whitespace-nowrap text-right text-[12px] text-slate-500">{Math.round(g * 100)} %</span>
          </div>
        ))}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full cursor-ew-resize touch-pan-y select-none" role="img" aria-label="Anteil der erreichten Gebiete im Zeitverlauf" onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); onPick(dayAt(e)); }} onPointerMove={(e) => { if (drag.current) onPick(dayAt(e)); }} onPointerUp={(e) => { drag.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }} onPointerCancel={() => { drag.current = false; }}>
          <defs><linearGradient id="dc-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d9488" stopOpacity=".22" /><stop offset="1" stopColor="#0d9488" stopOpacity="0" /></linearGradient></defs>
          {series.map((s) => { const h = (s.added / maxAdd) * H * 0.4; return <rect key={s.month} x={x(toDay(s.month + "-15")) - barW / 2} y={H - 4 - h} width={barW} height={h} fill="#99d6cf" opacity=".55" rx="2" />; })}
          <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#dc-fill)" />
          <path d={line} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <line x1={x(cur)} x2={x(cur)} y1="0" y2={H} stroke="#0f172a" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-teal-600 shadow-md ring-4 ring-teal-600/20" style={{ left: `${left}%`, top: `${top}%` }} />
      </div>
      <figcaption className="ml-12 mt-1 flex justify-between text-[12px] text-slate-500"><span>{fmt(t0)}</span><span>Linie: erreichte Gebiete in % · Säulen: neu je Monat</span><span>{fmt(t1)}</span></figcaption>
    </figure>
  );
}
