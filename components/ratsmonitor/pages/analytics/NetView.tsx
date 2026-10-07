import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface NNode { id: string; name: string; in: number; out: number; starts: number; ends: number; stage: number; role: "start" | "bridge" | "end"; broker: number }
export interface NEdge { a: string; b: string; n: number; days: number | null }
interface P extends NNode { r: number; x: number; y: number; vx: number; vy: number; fixed: boolean }

export const ROLE: Record<NNode["role"], { label: string; fill: string; stroke: string; hint: string }> = {
  start: { label: "Einstieg", fill: "#cbd5e1", stroke: "#94a3b8", hint: "Vorgänge beginnen hier und gehen weiter" },
  bridge: { label: "Durchgang", fill: "#5eead4", stroke: "#0d9488", hint: "Vorgänge laufen etwa gleich viel hinein wie heraus" },
  end: { label: "Entscheidung", fill: "#0f766e", stroke: "#0f766e", hint: "Vorgänge enden überwiegend hier" },
};

/** Kräfte: Abstoßung, Federn nach Gewicht, Bindung an die Stufe (Einstieg links, Entscheidung rechts) */
function layout(nodes: P[], edges: NEdge[], span: number, iterations: number, alpha0 = 1) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const max = Math.max(1, ...edges.map((e) => e.n));
  for (let it = 0; it < iterations; it++) {
    const alpha = alpha0 * (1 - it / iterations) + 0.02;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
      const d = Math.sqrt(d2), f = (16000 / d2) * alpha, min = a.r + b.r + 60;
      let fx = (dx / d) * f, fy = (dy / d) * f;
      if (d < min) { const push = (min - d) * 0.3; fx += (dx / d) * push; fy += (dy / d) * push; }
      if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
      if (!b.fixed) { b.vx += fx; b.vy += fy; }
    }
    for (const e of edges) {
      const a = by.get(e.a), b = by.get(e.b);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
      const target = 150 + (1 - e.n / max) * 130, f = (d - target) * 0.012 * alpha * (0.4 + e.n / max), fx = (dx / d) * f, fy = (dy / d) * f;
      if (!a.fixed) { a.vx += fx; a.vy += fy; }
      if (!b.fixed) { b.vx -= fx; b.vy -= fy; }
    }
    for (const n of nodes) {
      if (n.fixed) { n.vx = n.vy = 0; continue; }
      n.vx += ((n.stage - 0.5) * span - n.x) * 0.06 * alpha; n.vy -= n.y * 0.006 * alpha;
      n.x += n.vx; n.y += n.vy; n.vx *= 0.78; n.vy *= 0.78;
    }
  }
}

const wrap = (s: string, w = 17) => {
  const words = s.split(/(?<=-)|\s+/).filter(Boolean), lines: string[] = [];
  let cur = "";
  for (const word of words) { const next = cur ? (cur.endsWith("-") ? cur + word : cur + " " + word) : word; if (next.length > w && cur) { lines.push(cur); cur = word; } else cur = next; }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
};

export function NetView({ nodes, edges, selected, onSelect, zoomRef }: { nodes: NNode[]; edges: NEdge[]; selected: string; onSelect: (id: string) => void; zoomRef?: React.MutableRefObject<((f: number | "fit") => void) | null> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [, bump] = useState(0);
  const [hover, setHover] = useState("");
  const sim = useRef<P[]>([]);
  const drag = useRef<{ id: string; moved: boolean } | { pan: true; sx: number; sy: number; vx: number; vy: number } | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback((w = size.w, h = size.h) => {
    const list = sim.current;
    if (!list.length) return;
    const x0 = Math.min(...list.map((n) => n.x - n.r - 80)), x1 = Math.max(...list.map((n) => n.x + n.r + 80));
    const y0 = Math.min(...list.map((n) => n.y - n.r - 50)), y1 = Math.max(...list.map((n) => n.y + n.r + 50));
    const k = Math.min(1.3, Math.min(w / (x1 - x0), h / (y1 - y0)));
    setView({ k, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k });
  }, [size.w, size.h]);

  useEffect(() => {
    const max = Math.max(1, ...nodes.map((n) => n.in + n.out));
    const span = 980;
    sim.current = nodes.map((n, i) => ({ ...n, r: 12 + 24 * Math.sqrt((n.in + n.out) / max), x: (n.stage - 0.5) * span, y: ((i % 6) - 2.5) * 110 + (Math.random() - 0.5) * 30, vx: 0, vy: 0, fixed: false }));
    layout(sim.current, edges, span, 460);
    fit();
    bump((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);
  useEffect(() => fit(), [size.w, size.h, fit]);
  useEffect(() => {
    if (zoomRef) zoomRef.current = (f) => (f === "fit" ? fit() : setView((v) => ({ ...v, k: Math.max(0.3, Math.min(3, v.k * f)), x: v.x * f, y: v.y * f })));
    return () => { if (zoomRef) zoomRef.current = null; };
  }, [zoomRef, fit]);

  const pos = (id: string) => sim.current.find((n) => n.id === id);
  const toWorld = (cx: number, cy: number) => { const r = boxRef.current!.getBoundingClientRect(); return { x: (cx - r.left - size.w / 2 - view.x) / view.k, y: (cy - r.top - size.h / 2 - view.y) / view.k }; };
  const run = () => {
    cancelAnimationFrame(raf.current);
    let c = 0;
    const step = () => { layout(sim.current, edges, 980, 1, 0.3); bump((v) => v + 1); if (++c < 40) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const maxN = useMemo(() => Math.max(1, ...edges.map((e) => e.n)), [edges]);
  const near = useMemo(() => { const m = new Set<string>(); const f = hover || selected; if (f) { m.add(f); for (const e of edges) { if (e.a === f) m.add(e.b); if (e.b === f) m.add(e.a); } } return m; }, [edges, hover, selected]);
  const focus = hover || selected;

  /* Gebogene Kante von Rand zu Rand, Pfeilspitze am Ziel */
  const path = (a: P, b: P, bend: number) => {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy)), ux = dx / d, uy = dy / d;
    const sx = a.x + ux * a.r, sy = a.y + uy * a.r, ex = b.x - ux * (b.r + 6), ey = b.y - uy * (b.r + 6);
    const mx = (sx + ex) / 2 - uy * d * bend, my = (sy + ey) / 2 + ux * d * bend;
    return `M${sx},${sy} Q${mx},${my} ${ex},${ey}`;
  };

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 touch-none select-none overflow-hidden bg-white"
      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); const t = (e.target as Element).closest("[data-node]"); drag.current = t ? { id: t.getAttribute("data-node")!, moved: false } : { pan: true, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; if (t) { const n = pos(t.getAttribute("data-node")!); if (n) n.fixed = true; } }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if ("pan" in d) return setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
        const n = pos(d.id), w = toWorld(e.clientX, e.clientY);
        if (!n) return;
        d.moved = true; n.x = w.x; n.y = w.y; run();
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if ("pan" in d) { if (Math.abs(view.x - d.vx) + Math.abs(view.y - d.vy) < 3) onSelect(""); return; }
        const n = pos(d.id);
        if (n) n.fixed = false;
        if (!d.moved) onSelect(d.id === selected ? "" : d.id);
      }}
    >
      <svg width={size.w} height={size.h} role="img" aria-label="Gremiennetz: Wege von Vorgängen durch die Gremien">
        <defs>
          <marker id="net-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" fill="#64748b" /></marker>
          <marker id="net-arrow-on" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" fill="#0d9488" /></marker>
        </defs>
        <g transform={`translate(${size.w / 2 + view.x} ${size.h / 2 + view.y}) scale(${view.k})`}>
          {edges.map((e) => {
            const a = pos(e.a), b = pos(e.b);
            if (!a || !b) return null;
            const on = !!focus && (e.a === focus || e.b === focus);
            const w = 1 + 5.5 * Math.sqrt(e.n / maxN);
            /* Schwache Verbindungen erst zeigen, wenn eines ihrer Gremien gewählt ist */
            if (!on && e.n < maxN * 0.06) return null;
            return <path key={e.a + e.b} d={path(a, b, 0.14)} fill="none" stroke={on ? "#0d9488" : "#94a3b8"} strokeOpacity={focus ? (on ? 0.9 : 0.06) : 0.45} strokeWidth={w} strokeLinecap="round" markerEnd={on ? "url(#net-arrow-on)" : "url(#net-arrow)"} style={{ pointerEvents: "none" }} />;
          })}
          {sim.current.map((n) => {
            const k = ROLE[n.role], on = !focus || near.has(n.id), sel = n.id === selected, lines = wrap(n.name);
            return (
              <g key={n.id} data-node={n.id} transform={`translate(${n.x} ${n.y})`} opacity={on ? 1 : 0.2} style={{ cursor: "pointer" }} onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover("")}>
                {sel && <circle r={n.r + 6} fill="none" stroke="#0d9488" strokeWidth="2" strokeDasharray="3 4" />}
                <circle r={n.r} fill={k.fill} stroke={k.stroke} strokeWidth="2" />
                <text textAnchor="middle" fontSize="12" fill="#0f172a" stroke="#fff" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round" style={{ pointerEvents: "none" }}>
                  {lines.map((l, i) => <tspan key={i} x="0" y={n.r + 15 + i * 14}>{l}</tspan>)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
