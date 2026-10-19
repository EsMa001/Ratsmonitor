import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clampView, type NetBox, type NetViewState } from "../../lib/viewClamp";

export interface NNode { id: string; name: string; in: number; out: number; starts: number; ends: number; stage: number; role: "start" | "bridge" | "end"; broker: number }
export interface NEdge { a: string; b: string; n: number; days: number | null }
interface P extends NNode { r: number; x: number; y: number; vx: number; vy: number; fixed: boolean }

export const ROLE: Record<NNode["role"], { label: string; fill: string; stroke: string; hint: string }> = {
  start: { label: "Einstieg", fill: "var(--rm-c300)", stroke: "var(--rm-c400)", hint: "Vorgänge beginnen hier und gehen weiter" },
  bridge: { label: "Durchgang", fill: "var(--color-teal-300)", stroke: "var(--rm-fill)", hint: "Vorgänge laufen etwa gleich viel hinein wie heraus" },
  end: { label: "Entscheidung", fill: "var(--rm-ac)", stroke: "var(--rm-ac)", hint: "Vorgänge enden überwiegend hier" },
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
  /* Wörter mit Leerzeichen getrennt; nach einem Bindestrich im Wort („Bau-Ausschuss“) darf ohne Leerzeichen umbrochen werden */
  const words = s.split(/\s+/).filter(Boolean).flatMap((x) => x.split(/(?<=\w-)(?=\w)/).map((p, i) => ({ p, glue: i > 0 })));
  const lines: string[] = [];
  let cur = "";
  for (const { p, glue } of words) { const next = cur ? (glue ? cur + p : cur + " " + p) : p; if (next.length > w && cur) { lines.push(cur); cur = p; } else cur = next; }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
};

export function NetView({ nodes, edges, selected, onSelect, zoomRef }: { nodes: NNode[]; edges: NEdge[]; selected: string; onSelect: (id: string) => void; zoomRef?: React.MutableRefObject<((f: number | "fit") => void) | null> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  /* Namen in fester Bildschirmgröße (Handy und Desktop gleich), bei wenig Zoom nur die wichtigsten */
  const fitK = useRef(1);
  const bounds = useCallback((): NetBox => {
    const l = sim.current;
    if (!l.length) return { x0: 0, x1: 0, y0: 0, y1: 0 };
    return { x0: Math.min(...l.map((n) => n.x - n.r - 80)), x1: Math.max(...l.map((n) => n.x + n.r + 80)), y0: Math.min(...l.map((n) => n.y - n.r - 50)), y1: Math.max(...l.map((n) => n.y + n.r + 50)) };
  }, []);
  /* Jede Änderung von Zoom und Verschiebung bleibt innerhalb des Netzes */
  const put = useCallback((f: (v: NetViewState) => NetViewState) => setView((v) => clampView(f(v), bounds(), size.w, size.h, fitK.current, 3)), [bounds, size.w, size.h]);
  const sim = useRef<P[]>([]);
  /* Gezeichnet wird ein Abbild der Simulation (Zustand); gerechnet und gezogen wird in sim (Ref) */
  const [shown, setShown] = useState<P[]>([]);
  const draw = () => setShown(sim.current.map((n) => ({ ...n })));
  const [hover, setHover] = useState("");
  const drag = useRef<{ id: string; moved: boolean } | { pan: true; sx: number; sy: number; vx: number; vy: number } | null>(null);
  const raf = useRef(0);
  /* Zwei Finger (Handy): Zoomen, der Punkt zwischen den Fingern bleibt stehen */
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; k: number } | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* Ganzes Netz zeigen */
  const fit = useCallback((w = size.w, h = size.h) => {
    const list = sim.current;
    if (!list.length) return;
    const { x0, x1, y0, y1 } = bounds();
    const k = Math.min(1.3, Math.min(w / (x1 - x0), h / (y1 - y0)));
    fitK.current = k;
    setView({ k, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k });
  }, [size.w, size.h, bounds]);

  useEffect(() => {
    const max = Math.max(1, ...nodes.map((n) => n.in + n.out));
    const span = 980;
    // eslint-disable-next-line react-hooks/immutability
    sim.current = nodes.map((n, i) => ({ ...n, r: 12 + 24 * Math.sqrt((n.in + n.out) / max), x: (n.stage - 0.5) * span, y: ((i % 6) - 2.5) * 110 + (Math.random() - 0.5) * 30, vx: 0, vy: 0, fixed: false }));
    layout(sim.current, edges, span, 460);
    fit();
    /* Neue Daten: Startlage mit Zufall und Messung, einmal je Daten gerechnet; das Abbild folgt sofort */
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);
  useEffect(() => fit(), [size.w, size.h, fit]);
  useEffect(() => {
    if (zoomRef) zoomRef.current = (f) => (f === "fit" ? fit() : put((v) => ({ k: v.k * f, x: v.x * f, y: v.y * f })));
    return () => { if (zoomRef) zoomRef.current = null; };
  }, [zoomRef, fit, put, size.w, size.h]);

  const pos = (id: string) => sim.current.find((n) => n.id === id);
  const at = (id: string) => shown.find((n) => n.id === id);
  const toWorld = (cx: number, cy: number) => { const r = boxRef.current!.getBoundingClientRect(); return { x: (cx - r.left - size.w / 2 - view.x) / view.k, y: (cy - r.top - size.h / 2 - view.y) / view.k }; };
  const run = () => {
    cancelAnimationFrame(raf.current);
    let c = 0;
    const step = () => { layout(sim.current, edges, 980, 1, 0.3); draw(); if (++c < 40) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const maxN = useMemo(() => Math.max(1, ...edges.map((e) => e.n)), [edges]);
  const near = useMemo(() => { const m = new Set<string>(); const f = hover || selected; if (f) { m.add(f); for (const e of edges) { if (e.a === f) m.add(e.b); if (e.b === f) m.add(e.a); } } return m; }, [edges, hover, selected]);
  const focus = hover || selected;
  /* Rangfolge nach Durchsatz: die wichtigsten Namen zuerst */
  const rank = useMemo(() => new Map([...nodes].sort((a, b) => b.in + b.out - (a.in + a.out)).map((n, i) => [n.id, i] as const)), [nodes]);
  /* Handy: welche Namen Platz haben (Rangfolge: gewählte und ihre Nachbarn, dann nach Durchsatz; Namen außerhalb des Bildes entfallen) */
  const labelSet = useMemo(() => {
    const set = new Set<string>();
    const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const prio = (n: P) => (n.id === selected ? -2 : focus && near.has(n.id) ? -1 : rank.get(n.id) ?? 99);
    for (const n of [...shown].sort((a, b) => prio(a) - prio(b))) {
      const lines = wrap(n.name, 17), w = Math.max(...lines.map((l) => l.length)) * 6.8 + 8, h = lines.length * 15 + 2;
      const cx = size.w / 2 + view.x + n.x * view.k, y0 = size.h / 2 + view.y + n.y * view.k + Math.max(n.r * view.k, 7) + 3;
      const box = { x0: cx - w / 2, x1: cx + w / 2, y0, y1: y0 + h };
      if (box.x1 < 0 || box.x0 > size.w || box.y1 < 0 || box.y0 > size.h) continue;
      if (n.id !== selected && (box.x0 < 2 || box.x1 > size.w - 2 || box.y1 > size.h - 2)) continue;
      if (n.id !== selected && boxes.some((o) => box.x0 < o.x1 + 3 && o.x0 < box.x1 + 3 && box.y0 < o.y1 + 2 && o.y0 < box.y1 + 2)) continue;
      boxes.push(box); set.add(n.id);
    }
    return set;
  }, [shown, view, size.w, size.h, selected, focus, near, rank]);

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
      onPointerDown={(e) => {
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        (e.target as Element).setPointerCapture?.(e.pointerId);
        if (touches.current.size === 2) {
          const [p1, p2] = [...touches.current.values()];
          const dr = drag.current;
          if (dr && !("pan" in dr)) { const n = pos(dr.id); if (n) n.fixed = false; }
          drag.current = null;
          pinch.current = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, k: view.k };
          return;
        }
        const t = (e.target as Element).closest("[data-node]"); drag.current = t ? { id: t.getAttribute("data-node")!, moved: false } : { pan: true, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; if (t) { const n = pos(t.getAttribute("data-node")!); if (n) n.fixed = true; }
      }}
      onPointerMove={(e) => {
        if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.current && touches.current.size >= 2) {
          const [p1, p2] = [...touches.current.values()], r = boxRef.current!.getBoundingClientRect();
          const kNew = pinch.current.k * (Math.hypot(p1.x - p2.x, p1.y - p2.y) / pinch.current.d);
          const px = (p1.x + p2.x) / 2 - r.left - size.w / 2, py = (p1.y + p2.y) / 2 - r.top - size.h / 2;
          return put((v) => { const f = Math.max(fitK.current, Math.min(3, kNew)) / v.k; return { k: v.k * f, x: px - (px - v.x) * f, y: py - (py - v.y) * f }; });
        }
        const d = drag.current;
        if (!d) return;
        if ("pan" in d) return put((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
        const n = pos(d.id), w = toWorld(e.clientX, e.clientY);
        if (!n) return;
        d.moved = true; n.x = w.x; n.y = w.y; run();
      }}
      onPointerCancel={(e) => { touches.current.delete(e.pointerId); pinch.current = null; drag.current = null; }}
      onPointerUp={(e) => {
        touches.current.delete(e.pointerId);
        /* Nach dem Zoomen mit zwei Fingern nichts auswählen, bis alle Finger los sind */
        if (pinch.current) { if (!touches.current.size) pinch.current = null; return; }
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if ("pan" in d) { if (Math.abs(view.x - d.vx) + Math.abs(view.y - d.vy) < 3) onSelect(""); return; }
        const n = pos(d.id);
        if (n) n.fixed = false;
        if (!d.moved) onSelect(d.id === selected ? "" : d.id);
      }}
    >
      <svg width={size.w} height={size.h} role="img" aria-label="Gremien: Wege von Vorgängen durch die Gremien">
        <defs>
          <marker id="net-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" fill="var(--rm-c500)" /></marker>
          <marker id="net-arrow-on" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" fill="var(--rm-fill)" /></marker>
        </defs>
        <g transform={`translate(${size.w / 2 + view.x} ${size.h / 2 + view.y}) scale(${view.k})`}>
          {edges.map((e) => {
            const a = at(e.a), b = at(e.b);
            if (!a || !b) return null;
            const on = !!focus && (e.a === focus || e.b === focus);
            const w = 1 + 5.5 * Math.sqrt(e.n / maxN);
            /* Schwache Verbindungen erst zeigen, wenn eines ihrer Gremien gewählt ist */
            if (!on && e.n < maxN * 0.06) return null;
            return <path key={e.a + e.b} d={path(a, b, 0.14)} fill="none" stroke={on ? "var(--rm-fill)" : "var(--rm-c400)"} strokeOpacity={focus ? (on ? 0.9 : 0.06) : 0.45} strokeWidth={w} strokeLinecap="round" markerEnd={on ? "url(#net-arrow-on)" : "url(#net-arrow)"} style={{ pointerEvents: "none" }} />;
          })}
          {shown.map((n) => {
            const k = ROLE[n.role], on = !focus || near.has(n.id), sel = n.id === selected, lines = wrap(n.name, 17);
            /* Namen in fester Bildschirmgröße; gezeigt werden so viele, wie sich nicht überlappen (wichtige zuerst, beim Zoomen mehr) */
            const label = labelSet.has(n.id);
            const fs = 12.5 / view.k, lh = 15 / view.k, off = 14 / view.k, sw = 3 / view.k;
            return (
              <g key={n.id} data-node={n.id} transform={`translate(${n.x} ${n.y})`} opacity={on ? 1 : 0.2} style={{ cursor: "pointer" }} onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover("")}>
                {sel && <circle r={n.r + 6} fill="none" stroke="var(--rm-fill)" strokeWidth="2" strokeDasharray="3 4" />}
                <circle r={Math.max(n.r, 7 / view.k)} fill={k.fill} stroke={k.stroke} strokeWidth="2" />
                {label && <text textAnchor="middle" fontSize={fs} fill="var(--rm-c900)" stroke="var(--rm-white)" strokeWidth={sw} paintOrder="stroke" strokeLinejoin="round" style={{ pointerEvents: "none" }}>
                  {lines.map((l, i) => <tspan key={i} x="0" y={n.r + off + i * lh}>{l}</tspan>)}
                </text>}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
