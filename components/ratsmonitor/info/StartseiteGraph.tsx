import { useEffect, useRef, useState } from "react";

/* Wortnetz zu einem Thema: Begriffe, Themenfelder und Gremien als bewegtes Netz (Daten: /api/analytics/graph).
   Kleine Kraftsimulation ohne Bibliothek; Knoten nach Häufigkeit, Linien nach Stärke der Verbindung. */

interface GNode {
  id: string;
  type: string;
  label: string;
  count: number;
}
interface GEdge {
  a: string;
  b: string;
  n: number;
}
interface Sim {
  id: string;
  type: string;
  label: string;
  count: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const COLOR: Record<string, string> = { center: "#0f172a", term: "#0d9488", topic: "#5fb8ae", committee: "#64748b" };

export function KnowledgeGraph({ term, onPick }: { term: string; onPick: (text: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState<{ total: number; nodes: number; links: number } | null>(null);
  const [hover, setHover] = useState("");

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctl = new AbortController();
    let raf = 0;
    let nodes: Sim[] = [];
    let edges: GEdge[] = [];
    let alive = true;
    const W = 720;
    const H = 460;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const step = () => {
      const k = nodes.length;
      for (let i = 0; i < k; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < k; j++) {
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const f = 2600 / d2;
          const d = Math.sqrt(d2);
          dx /= d;
          dy /= d;
          a.vx += dx * f;
          a.vy += dy * f;
          b.vx -= dx * f;
          b.vy -= dy * f;
        }
        a.vx += (W / 2 - a.x) * 0.004;
        a.vy += (H / 2 - a.y) * 0.004;
      }
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (const e of edges) {
        const a = byId.get(e.a);
        const b = byId.get(e.b);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const f = (d - 90) * 0.012;
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f;
        b.vy -= (dy / d) * f;
      }
      for (const n of nodes) {
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x = Math.min(W - 40, Math.max(40, n.x + n.vx));
        n.y = Math.min(H - 24, Math.max(24, n.y + n.vy));
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      ctx.lineCap = "round";
      for (const e of edges) {
        const a = byId.get(e.a);
        const b = byId.get(e.b);
        if (!a || !b) continue;
        ctx.strokeStyle = "rgba(100,116,139,0.22)";
        ctx.lineWidth = Math.min(2.4, 0.5 + Math.log10(1 + e.n) * 0.7);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      nodes.forEach((n, i) => {
        const pulse = n.type === "center" ? 1 + 0.06 * Math.sin(t / 500) : 1 + 0.03 * Math.sin(t / 700 + i);
        ctx.fillStyle = (COLOR[n.type] ?? "#64748b") + (n.type === "center" ? "" : "cc");
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * pulse, 0, Math.PI * 2);
        ctx.fill();
        if (n.type !== "center") {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
      const label = (n: Sim) => {
        ctx.font = (n.type === "center" ? "600 16px" : "500 13px") + ' "IBM Plex Sans", system-ui, sans-serif';
        ctx.fillStyle = "#0f172a";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y - n.r - 6);
      };
      const top = [...nodes].sort((a, b) => b.count - a.count).slice(0, 9);
      for (const n of top) label(n);
      const h = nodes.find((n) => n.id === hover);
      if (h && !top.includes(h)) label(h);
    };

    fetch(`/api/analytics/graph?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ total: number; nodes: GNode[]; edges: GEdge[] }>) : Promise.reject(new Error("graph"))))
      .then((d) => {
        if (!alive) return;
        const max = Math.max(1, ...d.nodes.map((n) => n.count));
        nodes = d.nodes.slice(0, 40).map((n, i) => {
          const ang = (i / Math.max(1, d.nodes.length)) * Math.PI * 2;
          return { ...n, x: W / 2 + Math.cos(ang) * 160, y: H / 2 + Math.sin(ang) * 120, vx: 0, vy: 0, r: n.type === "center" ? 17 : 5 + Math.sqrt(n.count / max) * 14 };
        });
        const ids = new Set(nodes.map((n) => n.id));
        edges = d.edges.filter((e) => ids.has(e.a) && ids.has(e.b));
        setInfo({ total: d.total, nodes: nodes.length, links: edges.length });
        for (let i = 0; i < 260; i++) step();
        if (reduced()) return draw(0);
        const loop = (t: number) => {
          step();
          draw(t);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        cv.onmousemove = (ev) => {
          const rect = cv.getBoundingClientRect();
          const x = ((ev.clientX - rect.left) / rect.width) * W;
          const y = ((ev.clientY - rect.top) / rect.height) * H;
          const n = nodes.find((m) => (m.x - x) ** 2 + (m.y - y) ** 2 <= (m.r + 4) ** 2);
          setHover(n?.id ?? "");
        };
        cv.onclick = () => {
          const n = nodes.find((m) => m.id === hover);
          if (n && n.type === "term") onPick(`${term} ${n.label}`);
        };
      })
      .catch(() => {});
    return () => {
      alive = false;
      ctl.abort();
      cancelAnimationFrame(raf);
    };
  }, [term]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <canvas ref={ref} role="img" aria-label={`Wortnetz zum Thema ${term}: Begriffe, Themenfelder und Gremien`} style={{ width: "100%", height: "auto", aspectRatio: "720 / 460", display: "block", cursor: hover ? "pointer" : "default" }} />
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b" }}>
        {info ? `${info.total.toLocaleString("de-DE")} Vorlagen, ${info.nodes} Begriffe, Themenfelder und Gremien, ${info.links} Verbindungen. ` : "Wird aufgebaut … "}
        Größe zeigt die Häufigkeit; ein Klick auf einen Begriff sucht ihn zusammen mit dem Thema.
      </p>
    </div>
  );
}
