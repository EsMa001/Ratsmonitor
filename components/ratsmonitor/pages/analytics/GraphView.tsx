import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clampView, type NetBox, type NetViewState } from "../../lib/viewClamp";

const TYP: Record<string, string> = { center: "Suchbegriff", term: "Begriff", topic: "Thema", committee: "Gremium", land: "Land" };
export type GNode = { id: string; type: "center" | "term" | "topic" | "committee" | "land"; label: string; count: number };
export type GEdge = { a: string; b: string; w: number; n: number; center?: boolean };
interface P extends GNode { r: number; x: number; y: number; vx: number; vy: number; fixed: boolean }

/** Farben je Art: Begriffe Akzentfarbe, Themen Schwarz, Gremien Grau, Länder weiß mit Ring */
export const KIND: Record<GNode["type"], { label: string; fill: string; stroke: string }> = {
  center: { label: "Suchbegriff", fill: "var(--rm-ac)", stroke: "var(--rm-ac)" },
  term: { label: "Begriff", fill: "var(--rm-fill)", stroke: "var(--rm-fill)" },
  topic: { label: "Thema", fill: "var(--rm-c900)", stroke: "var(--rm-c900)" },
  committee: { label: "Gremium", fill: "var(--rm-c400)", stroke: "var(--rm-c400)" },
  land: { label: "Land", fill: "var(--rm-on)", stroke: "var(--rm-fill)" },
};

/** Feste Zufallszahl je Zeichenfolge (0 bis 1): gleiche Auswahl ergibt immer dasselbe Bild */
export function seeded(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10007) / 10007;
}

/** Kräftemodell: Abstoßung, Federn nach Kantengewicht, schwache Bindung ans Zentrum, Kollision */
function layout(nodes: P[], edges: GEdge[], iterations: number, alpha0 = 1, sc = 1, home?: Map<string, string>) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  for (let it = 0; it < iterations; it++) {
    const alpha = alpha0 * (1 - it / iterations) + 0.02;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = seeded(a.id + b.id) - 0.5; dy = seeded(b.id + a.id) - 0.5; d2 = 1; }
        const d = Math.sqrt(d2), f = (7000 * sc * sc / d2) * alpha, min = a.r + b.r + 34 * sc;
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
      const target = (e.center ? (outer ? 400 : 240) : 90 + (1 - Math.min(1, e.w * 2)) * 150) * sc;
      const k = e.center ? (outer ? 0.03 : 0.012) : 0.03 + e.w * 0.1;
      const f = (d - target) * k * alpha, fx = (dx / d) * f, fy = (dy / d) * f;
      if (!a.fixed) { a.vx += fx; a.vy += fy; }
      if (!b.fixed) { b.vx -= fx; b.vy -= fy; }
    }
    /* Begriffe rücken sanft zu ihrem stärksten Thema, so entstehen erkennbare Gruppen */
    if (home) for (const [tid, topId] of home) {
      const a = by.get(tid), b = by.get(topId);
      if (!a || !b || a.fixed) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy)), f = (d - 190 * sc) * 0.012 * alpha;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
    }
    for (const n of nodes) {
      if (n.fixed) { n.vx = n.vy = 0; continue; }
      n.vx -= n.x * 0.002 * alpha; n.vy -= n.y * 0.002 * alpha;
      n.x += n.vx; n.y += n.vy; n.vx *= 0.8; n.vy *= 0.8;
    }
  }
}

/** Konvexe Hülle (Monotone Chain) */
function convexHull(p: [number, number][]): [number, number][] {
  const s = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (s.length < 3) return s;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const q of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...s].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** Orte der Punkte in x-Richtung strecken (Breitbild) */
function stretchX(list: { x: number }[], f: number) { for (const n of list) n.x *= f; }

const radius = (n: GNode, max: number) => (n.type === "center" ? 26 : 7 + 11 * Math.sqrt(n.count / Math.max(1, max)));

/** Interaktives Netz: Ziehen von Knoten und Hintergrund, Auswahl und Hervorhebung der Nachbarn */
export function GraphView({ nodes, edges, selected, pair, onSelect, zoomRef, allLabels = false }: { allLabels?: boolean; nodes: GNode[]; edges: GEdge[]; selected: string; pair?: GEdge | null; onSelect: (id: string) => void; zoomRef?: React.MutableRefObject<((f: number | "fit") => void) | null> }) {
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
  /* Zoom und Verschieben bleiben innerhalb des Netzes: nicht weiter hinaus als das ganze Netz, der Inhalt verlässt die Fläche nie */
  const fitK = useRef(1);
  const bounds = useCallback((): NetBox => {
    const l = sim.current;
    if (!l.length) return { x0: 0, x1: 0, y0: 0, y1: 0 };
    return { x0: Math.min(...l.map((n) => n.x - n.r - 70)), x1: Math.max(...l.map((n) => n.x + n.r + 70)), y0: Math.min(...l.map((n) => n.y - n.r - 20)), y1: Math.max(...l.map((n) => n.y + n.r + 44)) };
  }, []);
  const put = useCallback((f: (v: NetViewState) => NetViewState) => setView((v) => clampView(f(v), bounds(), size.w, size.h, fitK.current, 4)), [bounds, size.w, size.h]);
  const zoomAt = useCallback((k: number, cx: number, cy: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect(), px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2;
    put((v) => {
      const k2 = Math.max(fitK.current, Math.min(4, k)), f = k2 / v.k;
      return { k: k2, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
  }, [put]);
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

  const fitTarget = useCallback((w = size.w, h = size.h) => {
    const list = sim.current;
    if (!list.length) return null;
    const x0 = Math.min(...list.map((n) => n.x - n.r - 70)), x1 = Math.max(...list.map((n) => n.x + n.r + 70));
    const y0 = Math.min(...list.map((n) => n.y - n.r - 20)), y1 = Math.max(...list.map((n) => n.y + n.r + 44));
    const k = Math.min(1.3, Math.min(w / (x1 - x0), h / (y1 - y0)));
    return { k, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k };
  }, [size.w, size.h]);
  const fit = useCallback((w = size.w, h = size.h) => {
    const to = fitTarget(w, h);
    if (!to) return;
    fitK.current = to.k;
    setView(to);
  }, [size.w, size.h, fitTarget]);

  /* Breiter Bildschirm: die Lage in die Breite ziehen (nur die Orte der Punkte, nicht die Schrift), damit die Fläche genutzt wird */
  const sx = useRef(1);
  const widen = useCallback(() => {
    const list = sim.current;
    if (!list.length) return;
    const x0 = Math.min(...list.map((n) => n.x - n.r - 70)), x1 = Math.max(...list.map((n) => n.x + n.r + 70));
    const y0 = Math.min(...list.map((n) => n.y - n.r - 20)), y1 = Math.max(...list.map((n) => n.y + n.r + 44));
    const base = ((x1 - x0) - 0) / sx.current;
    const next = size.w >= 700 && size.h > 0 ? Math.min(2.2, Math.max(1, (size.w / size.h) / (base / (y1 - y0)))) : 1;
    if (Math.abs(next - sx.current) < 0.02) return;
    const f = next / sx.current;
    stretchX(list, f);
    sx.current = next;
  }, [size.w, size.h]);

  /* Stärkstes Thema je Begriff (aus den Kanten zwischen Begriff und Thema) */
  const home = useMemo(() => {
    const kind = new Map(nodes.map((n) => [n.id, n.type] as const));
    const best = new Map<string, { id: string; w: number }>();
    for (const e of edges) {
      if (e.center) continue;
      const [term, topic] = kind.get(e.a) === "term" && kind.get(e.b) === "topic" ? [e.a, e.b] : kind.get(e.b) === "term" && kind.get(e.a) === "topic" ? [e.b, e.a] : ["", ""];
      if (term && e.w > (best.get(term)?.w ?? -1)) best.set(term, { id: topic, w: e.w });
    }
    return new Map([...best].map(([k, v]) => [k, v.id] as const));
  }, [nodes, edges]);
  /* Neues Netz: Startlage nach Art in Ringen, dann vorberechnen */
  useEffect(() => {
    const max = Math.max(1, ...nodes.filter((n) => n.type !== "center").map((n) => n.count));
    const groups: Record<string, number> = { term: 0, topic: 0, committee: 0, land: 0 };
    const total: Record<string, number> = { term: 0, topic: 0, committee: 0, land: 0 };
    for (const n of nodes) if (n.type !== "center") total[n.type]++;
    const sc = size.w < 520 ? 0.6 : 1; /* Handy: engeres Netz, damit die Schrift lesbar bleibt */
    const sector: Record<string, [number, number, number]> = { term: [0, 6.28, 250 * sc], topic: [4.6, 5.4, 420 * sc], committee: [5.6, 6.9, 420 * sc], land: [1.4, 3.0, 420 * sc] };
    sim.current = nodes.map((n) => {
      const r = radius(n, max);
      if (n.type === "center") return { ...n, r, x: 0, y: 0, vx: 0, vy: 0, fixed: false };
      const [a0, a1, rad] = sector[n.type], i = groups[n.type]++, t = total[n.type] > 1 ? i / (total[n.type] - 1) : 0.5;
      const ang = a0 + (a1 - a0) * t;
      return { ...n, r, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, vx: 0, vy: 0, fixed: false };
    });
    layout(sim.current, edges, 420, 1, sc, home);
    sx.current = 1;
    widen();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fit();
    /* Neue Daten: Startlage mit Zufall und Messung, einmal je Daten gerechnet; das Abbild folgt sofort */
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, home]);
  useEffect(() => {
    widen();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fit(); draw();
  }, [size.w, size.h, fit, widen]);

  useEffect(() => {
    if (zoomRef) zoomRef.current = (f) => (f === "fit" ? fit() : put((v) => ({ k: v.k * f, x: v.x * f, y: v.y * f })));
    return () => { if (zoomRef) zoomRef.current = null; };
  }, [zoomRef, fit, put]);

  const pos = (id: string) => sim.current.find((n) => n.id === id);
  const at = (id: string) => shown.find((n) => n.id === id);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) { if (e.center) continue; (m.get(e.a) ?? m.set(e.a, new Set()).get(e.a)!).add(e.b); (m.get(e.b) ?? m.set(e.b, new Set()).get(e.b)!).add(e.a); }
    return m;
  }, [edges]);
  /* Beschriftet sind Mitte, Themen und die größeren Begriffe; alle anderen beim Darüberfahren, in der Auswahl und beim Heranzoomen */
  const labelled = useMemo(() => {
    const rest = nodes.filter((n) => n.type !== "center" && n.type !== "topic").sort((a, b) => b.count - a.count);
    return new Set(rest.slice(0, Math.max(6, Math.ceil(rest.length * 0.45))).map((n) => n.id));
  }, [nodes]);
  const focus = hover || selected;
  const near = focus ? neighbours.get(focus) : null;
  /* Weiche Flächen hinter den Gruppen (Thema mit mindestens drei Begriffen): umschließende Hülle der Punkte */
  const hulls = useMemo(() => {
    const by = new Map(shown.map((n) => [n.id, n] as const));
    const groups = new Map<string, P[]>();
    for (const [term, topic] of home) { const a = by.get(term), b = by.get(topic); if (a && b) (groups.get(topic) ?? groups.set(topic, [b]).get(topic)!).push(a); }
    const out: { id: string; d: string }[] = [];
    for (const [id, pts] of groups) {
      if (pts.length < 4) continue;
      const hull = convexHull(pts.map((n) => [n.x, n.y] as [number, number]));
      if (hull.length < 3) continue;
      out.push({ id, d: "M" + hull.map(([x, y]) => `${x},${y}`).join("L") + "Z" });
    }
    return out;
  }, [shown, home]);
  /* Kamerafahrt: die Auswahl samt Nachbarn rückt sanft ins Bild, ohne Auswahl fährt die Ansicht aufs ganze Netz zurück */
  const viewNow = useRef(view);
  useEffect(() => { viewNow.current = view; }, [view]);
  const anim = useRef(0);
  const glide = useCallback((to: NetViewState) => {
    cancelAnimationFrame(anim.current);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setView(to); return; }
    const from = viewNow.current, t0 = performance.now(), dur = 480;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setView({ k: from.k + (to.k - from.k) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
      if (p < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => () => cancelAnimationFrame(anim.current), []);
  const firstSel = useRef(true);
  useEffect(() => {
    if (firstSel.current) { firstSel.current = false; return; }
    const id = requestAnimationFrame(() => {
      const list = sim.current;
      if (!list.length) return;
      if (!selected) { const to = fitTarget(); if (to) { fitK.current = to.k; glide(to); } return; }
      const ids = new Set([selected, ...(neighbours.get(selected) ?? [])]);
      const sub = list.filter((n) => ids.has(n.id));
      if (!sub.length) return;
      /* unten Platz für die Detailkarte lassen */
      const x0 = Math.min(...sub.map((n) => n.x - n.r - 70)), x1 = Math.max(...sub.map((n) => n.x + n.r + 70));
      const y0 = Math.min(...sub.map((n) => n.y - n.r - 50)), y1 = Math.max(...sub.map((n) => n.y + n.r + 44 + (size.w >= 700 ? 190 : 0)));
      const k = Math.max(fitK.current, Math.min(1.9, size.w / (x1 - x0), size.h / (y1 - y0)));
      glide({ k, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  /* Beschriftungen ohne Überlappung: wichtige zuerst (Mitte, Auswahl und Nachbarn, Themen, dann nach Häufigkeit); wer sich mit einer schon gesetzten überlappt, erscheint beim Darüberfahren oder Zoomen */
  const labelSet = useMemo(() => {
    const set = new Set<string>();
    const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const rank = new Map([...nodes].sort((a, b) => b.count - a.count).map((n, i) => [n.id, i] as const));
    const wanted = (n: P) => n.type === "center" || allLabels || (n.type === "topic" && size.w >= 520) || labelled.has(n.id) || focus === n.id || !!near?.has(n.id) || n.id === selected || view.k >= 1.7;
    const prio = (n: P) => (n.type === "center" ? -3 : n.id === selected || n.id === focus ? -2 : near?.has(n.id) ? -1 : n.type === "topic" ? 0 : 1 + (rank.get(n.id) ?? 99));
    for (const n of [...shown].filter(wanted).sort((a, b) => prio(a) - prio(b))) {
      const fs = n.type === "center" ? 17 : n.type === "topic" ? 13.5 : 12.5, w = n.label.length * fs * 0.52 + 10, h = fs + 4;
      const cx = size.w / 2 + view.x + n.x * view.k, y0 = size.h / 2 + view.y + n.y * view.k + Math.max(n.r * view.k, 6) + 4;
      const box = { x0: cx - w / 2, x1: cx + w / 2, y0, y1: y0 + h };
      if (box.x1 < 0 || box.x0 > size.w || box.y1 < 0 || box.y0 > size.h) continue;
      if (n.type !== "center" && boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      boxes.push(box); set.add(n.id);
    }
    return set;
  }, [shown, view, size, selected, focus, near, nodes, allLabels, labelled]);
  /* Eine gewählte Verbindung hebt genau ihre beiden Begriffe und die Linie dazwischen hervor */
  const pairOn = !!pair && !hover;
  const lit = (id: string) => (pairOn ? id === pair!.a || id === pair!.b || id === "q" : !focus || id === focus || id === "q" || !!near?.has(id));

  return (
    <div
      ref={boxRef}
      className="rm-netstage absolute inset-0 touch-none select-none overflow-hidden"
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
        if ("pan" in d) return put((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
        /* Knoten lassen sich nicht wegziehen; nur Anklicken wählt */
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
      <svg width={size.w} height={size.h} role="group" aria-label="Themennetz: Begriffe, Themen, Gremien und Länder, die mit dem Suchbegriff zusammenhängen. Mit der Tabulator-Taste durch die Knoten gehen, Enter wählt, Escape hebt die Wahl auf">
        <g transform={`translate(${size.w / 2 + view.x} ${size.h / 2 + view.y}) scale(${view.k})`}>
          {allLabels && !focus && !pairOn && hulls.map((h) => <path key={h.id} d={h.d} fill="var(--st-mid)" fillOpacity={0.07} stroke="var(--st-mid)" strokeOpacity={0.07} strokeWidth={34} strokeLinejoin="round" style={{ pointerEvents: "none" }} />)}
          {edges.map((e) => {
            const a = at(e.a), b = at(e.b);
            if (!a || !b) return null;
            const on = pairOn ? e.a === pair!.a && e.b === pair!.b : focus && (e.a === focus || e.b === focus);
            /* Kanten zu Themen, Gremien und Ländern erscheinen erst, wenn man einen der Knoten wählt */
            const outer = !e.center && !(a.type === "term" && b.type === "term");
            const op = e.center ? (on ? 0.55 : 0.1) : outer ? (on ? 0.85 : 0) : focus ? (on ? 0.9 : 0.05) : 0.22 + Math.min(0.5, e.w * 1.2);
            /* Leicht gebogen: Kontrollpunkt seitlich der Mitte */
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, bend = e.center ? 0.05 : 0.12;
            const d = `M${a.x},${a.y} Q${mx - dy * bend},${my + dx * bend} ${b.x},${b.y}`;
            const strong = !e.center && e.w > 0.3;
            return <path key={e.a + e.b} d={d} fill="none" stroke={on || strong ? "var(--st-edge-hi)" : "var(--st-mid)"} strokeOpacity={op} strokeWidth={e.center ? 0.8 : 0.8 + Math.min(3.2, e.w * 8)} strokeLinecap="round" className={on ? "rm-gflow" : undefined} strokeDasharray={on ? "2 7" : undefined} />;
          })}
          {shown.map((n, i) => {
            const on = lit(n.id), sel = n.id === selected || (pairOn && (n.id === pair!.a || n.id === pair!.b)), hot = focus === n.id || sel;
            const topic = n.type === "topic", center = n.type === "center";
            const glow = topic ? "var(--st-accent)" : "var(--st-mid)";
            return (
              <g key={n.id} data-node={n.id} transform={`translate(${n.x} ${n.y})`} opacity={on ? 1 : 0.24} style={{ cursor: "pointer", transition: "opacity .25s" }} onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover("")}
                role="button" tabIndex={0} aria-pressed={n.id === selected} aria-label={`${n.label}, ${TYP[n.type] ?? "Knoten"}${n.type === "center" ? "" : `, ${n.count.toLocaleString("de-DE")} Einträge`}`} onFocus={() => setHover(n.id)} onBlur={() => setHover("")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(n.id === selected ? "" : n.id); } else if (e.key === "Escape" && n.id === selected) { e.preventDefault(); onSelect(""); } }}>
                <g className="rm-gin" style={{ animationDelay: `${Math.min(700, i * 26)}ms` }}>
                  {center && <circle className="rm-gpulse" r={n.r + 8} fill="none" stroke="var(--st-edge-hi)" strokeWidth="1.5" />}
                  {center && <circle className="rm-gpulse rm-gpulse2" r={n.r + 8} fill="none" stroke="var(--st-edge-hi)" strokeWidth="1" />}
                  {/* Hof: weicher Schein um jeden Knoten, stärker bei Auswahl */}
                  <circle r={n.r * (hot ? 2.6 : 1.9)} fill={glow} opacity={hot ? 0.32 : center ? 0.28 : 0.16} style={{ transition: "all .25s" }} />
                  <circle r={n.r} fill={center ? "var(--st-center)" : topic ? "var(--st-accent)" : "var(--st-mid)"} stroke={hot ? "var(--st-text)" : "none"} strokeWidth={hot ? 2 : 0} />
                  {center && <circle r={n.r * 0.45} fill="var(--st-center-core)" />}
                  {labelSet.has(n.id) && <text className="rm-gtext" y={n.r + (center ? 20 : 15) / view.k} textAnchor="middle" fontSize={(center ? 17 : topic ? 13.5 : 12.5) / view.k} fontWeight={center || topic ? 600 : 400} fill={topic ? "var(--st-topic-text)" : "var(--st-text)"} stroke="var(--st-bg)" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round" style={{ pointerEvents: "none" }}>{n.label}</text>}
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
