import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GNode = { id: string; type: "center" | "term" | "topic" | "committee" | "land"; label: string; count: number };
export type GEdge = { a: string; b: string; w: number; n: number; center?: boolean };
interface P extends GNode { r: number; x: number; y: number; vx: number; vy: number; fixed: boolean }

/** Farben je Art: Begriffe Akzentfarbe, Themen Schwarz, Gremien Grau, Länder weiß mit Ring */
export const KIND: Record<GNode["type"], { label: string; fill: string; stroke: string }> = {
  center: { label: "Suchbegriff", fill: "var(--rm-ac)", stroke: "var(--rm-ac)" },
  term: { label: "Begriff", fill: "var(--rm-fill)", stroke: "var(--rm-fill)" },
  topic: { label: "Thema", fill: "var(--rm-c900)", stroke: "var(--rm-c900)" },
  committee: { label: "Gremium", fill: "var(--rm-c400)", stroke: "var(--rm-c400)" },
  land: { label: "Land", fill: "#ffffff", stroke: "var(--rm-fill)" },
};

/** Kräftemodell: Abstoßung, Federn nach Kantengewicht, schwache Bindung ans Zentrum, Kollision */
function layout(nodes: P[], edges: GEdge[], iterations: number, alpha0 = 1) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  for (let it = 0; it < iterations; it++) {
    const alpha = alpha0 * (1 - it / iterations) + 0.02;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        const d = Math.sqrt(d2), f = (7000 / d2) * alpha, min = a.r + b.r + 34;
        let fx = (dx / d) * f, fy = (dy / d) * f;
        if (d < min) { const push = (min - d) * 0.25; fx += (dx / d) * push; fy += (dy / d) * push; }
        if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
        if (!b.fixed) { b.vx += fx; b.vy += fy; }
      }
    }
    for (const e of edges) {
      const a = by.get(e.a), b = by.get(e.b);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
      /* Themen, Gremien und Länder liegen als äußerer Ring; ihre Kanten zu Begriffen werden nur gezeichnet, ziehen aber nicht */
      if (!e.center && (a.type !== "term" || b.type !== "term")) continue;
      const outer = a.type !== "term" && a.type !== "center" ? a : b.type !== "term" && b.type !== "center" ? b : null;
      const target = e.center ? (outer ? 400 : 240) : 90 + (1 - Math.min(1, e.w * 2)) * 150;
      const k = e.center ? (outer ? 0.03 : 0.012) : 0.03 + e.w * 0.1;
      const f = (d - target) * k * alpha, fx = (dx / d) * f, fy = (dy / d) * f;
      if (!a.fixed) { a.vx += fx; a.vy += fy; }
      if (!b.fixed) { b.vx -= fx; b.vy -= fy; }
    }
    for (const n of nodes) {
      if (n.fixed) { n.vx = n.vy = 0; continue; }
      n.vx -= n.x * 0.002 * alpha; n.vy -= n.y * 0.002 * alpha;
      n.x += n.vx; n.y += n.vy; n.vx *= 0.8; n.vy *= 0.8;
    }
  }
}

const radius = (n: GNode, max: number) => (n.type === "center" ? 26 : 7 + 11 * Math.sqrt(n.count / Math.max(1, max)));

/** Interaktives Netz: Ziehen von Knoten und Hintergrund, Auswahl und Hervorhebung der Nachbarn */
export function GraphView({ nodes, edges, selected, pair, onSelect, zoomRef }: { nodes: GNode[]; edges: GEdge[]; selected: string; pair?: GEdge | null; onSelect: (id: string) => void; zoomRef?: React.MutableRefObject<((f: number | "fit") => void) | null> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const sim = useRef<P[]>([]);
  /* Gezeichnet wird ein Abbild der Simulation (Zustand); gerechnet und gezogen wird in sim (Ref) */
  const [shown, setShown] = useState<P[]>([]);
  const draw = () => setShown(sim.current.map((n) => ({ ...n })));
  const [hover, setHover] = useState("");
  const drag = useRef<{ id: string; moved: boolean } | { pan: true; sx: number; sy: number; vx: number; vy: number } | null>(null);
  const raf = useRef(0);
  /* Zoomen mit zwei Fingern (Handy) und Trackpad-Geste bzw. Strg + Mausrad: Punkt unter den Fingern bleibt stehen */
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; k: number } | null>(null);
  const zoomAt = useCallback((k: number, cx: number, cy: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect(), px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2;
    setView((v) => {
      const k2 = Math.max(0.3, Math.min(4, k)), f = k2 / v.k;
      return { k: k2, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
  }, []);
  const viewK = useRef(1);
  useEffect(() => { viewK.current = view.k; }, [view.k]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(viewK.current * Math.exp(-e.deltaY / 200), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomAt]);

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
    const x0 = Math.min(...list.map((n) => n.x - n.r - 70)), x1 = Math.max(...list.map((n) => n.x + n.r + 70));
    const y0 = Math.min(...list.map((n) => n.y - n.r - 20)), y1 = Math.max(...list.map((n) => n.y + n.r + 20));
    const k = Math.min(1.3, Math.min(w / (x1 - x0), h / (y1 - y0)));
    setView({ k, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k });
  }, [size.w, size.h]);

  /* Neues Netz: Startlage nach Art in Ringen, dann vorberechnen */
  useEffect(() => {
    const max = Math.max(1, ...nodes.filter((n) => n.type !== "center").map((n) => n.count));
    const groups: Record<string, number> = { term: 0, topic: 0, committee: 0, land: 0 };
    const total: Record<string, number> = { term: 0, topic: 0, committee: 0, land: 0 };
    for (const n of nodes) if (n.type !== "center") total[n.type]++;
    const sector: Record<string, [number, number, number]> = { term: [0, 6.28, 250], topic: [4.6, 5.4, 420], committee: [5.6, 6.9, 420], land: [1.4, 3.0, 420] };
    sim.current = nodes.map((n) => {
      const r = radius(n, max);
      if (n.type === "center") return { ...n, r, x: 0, y: 0, vx: 0, vy: 0, fixed: false };
      const [a0, a1, rad] = sector[n.type], i = groups[n.type]++, t = total[n.type] > 1 ? i / (total[n.type] - 1) : 0.5;
      const ang = a0 + (a1 - a0) * t;
      return { ...n, r, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, vx: 0, vy: 0, fixed: false };
    });
    layout(sim.current, edges, 420);
    fit();
    /* Neue Daten: Startlage mit Zufall und Messung, einmal je Daten gerechnet; das Abbild folgt sofort */
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);
  useEffect(() => fit(), [size.w, size.h, fit]);

  useEffect(() => {
    if (zoomRef) zoomRef.current = (f) => (f === "fit" ? fit() : setView((v) => ({ ...v, k: Math.max(0.3, Math.min(4, v.k * f)), x: v.x * f, y: v.y * f })));
    return () => { if (zoomRef) zoomRef.current = null; };
  }, [zoomRef, fit]);

  const pos = (id: string) => sim.current.find((n) => n.id === id);
  const at = (id: string) => shown.find((n) => n.id === id);
  const toWorld = (cx: number, cy: number) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: (cx - r.left - size.w / 2 - view.x) / view.k, y: (cy - r.top - size.h / 2 - view.y) / view.k };
  };
  const run = () => {
    cancelAnimationFrame(raf.current);
    let n = 0;
    const step = () => { layout(sim.current, edges, 1, 0.35); draw(); if (++n < 40) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) { if (e.center) continue; (m.get(e.a) ?? m.set(e.a, new Set()).get(e.a)!).add(e.b); (m.get(e.b) ?? m.set(e.b, new Set()).get(e.b)!).add(e.a); }
    return m;
  }, [edges]);
  const focus = hover || selected;
  const near = focus ? neighbours.get(focus) : null;
  /* Eine gewählte Verbindung hebt genau ihre beiden Begriffe und die Linie dazwischen hervor */
  const pairOn = !!pair && !hover;
  const lit = (id: string) => (pairOn ? id === pair!.a || id === pair!.b || id === "q" : !focus || id === focus || id === "q" || !!near?.has(id));

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 touch-none select-none overflow-hidden bg-white"
      onPointerDown={(e) => {
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* Zeiger schon weg */ }
        /* Zweiter Finger: Ziehen endet, Zoomen mit zwei Fingern beginnt */
        if (touches.current.size === 2) {
          const [a, b] = [...touches.current.values()];
          const d = drag.current;
          if (d && !("pan" in d)) { const n = pos(d.id); if (n) n.fixed = false; }
          drag.current = null;
          pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.k };
          return;
        }
        const t = (e.target as Element).closest("[data-node]"); drag.current = t ? { id: t.getAttribute("data-node")!, moved: false } : { pan: true, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; if (t) { const n = pos(t.getAttribute("data-node")!); if (n) n.fixed = true; } }}
      onPointerMove={(e) => {
        if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.current && touches.current.size >= 2) {
          const [a, b] = [...touches.current.values()];
          return zoomAt(pinch.current.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d), (a.x + b.x) / 2, (a.y + b.y) / 2);
        }
        const d = drag.current;
        if (!d) return;
        if ("pan" in d) return setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
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
      <svg width={size.w} height={size.h} role="img" aria-label="Themennetz: Begriffe, Themen, Gremien und Länder, die mit dem Suchbegriff zusammenhängen">
        <g transform={`translate(${size.w / 2 + view.x} ${size.h / 2 + view.y}) scale(${view.k})`}>
          {edges.map((e) => {
            const a = at(e.a), b = at(e.b);
            if (!a || !b) return null;
            const on = pairOn ? e.a === pair!.a && e.b === pair!.b : focus && (e.a === focus || e.b === focus);
            /* Kanten zu Themen, Gremien und Ländern erscheinen erst, wenn man einen der Knoten wählt */
            const outer = !e.center && !(a.type === "term" && b.type === "term");
            const op = e.center ? (on ? 0.5 : 0.07) : outer ? (on ? 0.8 : 0) : focus ? (on ? 0.85 : 0.07) : 0.3 + Math.min(0.45, e.w);
            return <line key={e.a + e.b} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? "var(--rm-fill)" : "var(--rm-c400)"} strokeOpacity={op} strokeWidth={e.center ? 1 : 1 + Math.min(4, e.w * 9)} strokeLinecap="round" />;
          })}
          {shown.map((n) => {
            const k = KIND[n.type], on = lit(n.id), sel = n.id === selected || (pairOn && (n.id === pair!.a || n.id === pair!.b));
            return (
              <g key={n.id} data-node={n.id} transform={`translate(${n.x} ${n.y})`} opacity={on ? 1 : 0.18} style={{ cursor: "pointer" }} onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover("")}>
                {sel && <circle r={n.r + 6} fill="none" stroke="var(--rm-fill)" strokeWidth="2" strokeDasharray="3 4" />}
                <circle className={n.type === "topic" ? "rm-gtopic" : undefined} r={n.r} fill={k.fill} stroke={k.stroke} strokeWidth={n.type === "land" ? 2.5 : 0} fillOpacity={n.type === "term" ? 0.88 : 1} />
                {n.type === "center" && <rect x="-7" y="-7" width="14" height="14" fill="#fff" />}
                <text className="rm-gtext" y={n.type === "center" ? n.r + 18 : n.r + 15} textAnchor="middle" fontSize={n.type === "center" ? 18 : 12} fontWeight={n.type === "center" ? 600 : 400} fill="var(--rm-c900)" stroke="var(--rm-white)" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round" style={{ pointerEvents: "none" }}>{n.label}</text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
