import { useEffect, useRef, useState, type ReactNode } from "react";
import { ANALYSE_THUMBS } from "../pages/analytics/AnalyticsAbout";
import { Spark, type TrendKind } from "../pages/analytics/TrendViews";
import type { AnalyseId } from "./branchen-enterprise";

/* Mini-Ausschnitte der Plenara.X-Analysen zum Suchbegriff der Branche. Sie kommen aus einem Schnappschuss
   (public/data/branchen-ausschnitte.json, erzeugt mit scripts/build-branchen-ausschnitte.mjs), nicht aus der API:
   Plenara.X ist Teil von Enterprise, die Branchenseiten zeigen nur diese feste Auswahl. Fehlt ein Eintrag
   (leer, Gebietsvergleich), bleibt das schematische Vorschaubild. */

const nf = (v: number) => v.toLocaleString("de-DE");
type Snap = { generated?: string; items: Record<string, any>; geo?: { w: number; h: number; pts: number[] } };
let snapshot: Promise<Snap> | null = null;
const getJson = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
});
function load(): Promise<Snap> {
  if (!snapshot) {
    /* Gemeinde-Punkte für die Mini-Karte der Diffusion; ohne sie bleibt nur der Text */
    snapshot = Promise.all([getJson("/data/branchen-ausschnitte.json"), getJson("/data/gemeinde-punkte.json").catch(() => undefined)]).then(([d, geo]) => ({ ...(d as Snap), geo: geo as Snap["geo"] }));
    snapshot.catch(() => (snapshot = null));
  }
  return snapshot;
}

function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <ul className="m-0 list-none space-y-2 p-0">
      {rows.map(([label, n]) => (
        <li key={label} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] items-center gap-3 text-[13px] text-slate-600">
          <span className="truncate">{label}</span>
          <span className="h-2 rounded bg-slate-100"><span className="block h-2 rounded bg-teal-600" style={{ width: `${(n / max) * 100}%` }} /></span>
          <span className="tabular-nums text-slate-500">{nf(n)}</span>
        </li>
      ))}
    </ul>
  );
}

const CLS = ["#b3dfda", "#8ccdc7", "#6ebfb8", "#0f766e"];
const KIND_FILL: Record<string, [string, string]> = { center: ["#0f766e", "#0f766e"], term: ["#0d9488", "#0d9488"], topic: ["#0f172a", "#0f172a"], committee: ["#94a3b8", "#94a3b8"], land: ["#ffffff", "#0d9488"] };
const short = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

/** Mini-Karte der Diffusion: jede Gemeinde ein Punkt, gefärbt nach Alter der ersten Erwähnung (wie die Legende der Analyse) */
function DiffusionMap({ map, geo }: { map: string; geo: NonNullable<Snap["geo"]> }) {
  const groups: string[] = ["", "", "", "", ""];
  for (let i = 0; i < map.length; i++) groups[+map[i]] += `M${geo.pts[2 * i]} ${geo.pts[2 * i + 1]}h0`;
  const colors = [CLS[0], CLS[1], CLS[2], CLS[3], "#d5dce5"];
  return (
    <svg viewBox={`-4 -4 ${geo.w + 8} ${geo.h + 8}`} className="block h-[190px] w-auto flex-none" role="img" aria-label="Karte: Gemeinden nach Alter der ersten Erwähnung">
      {[4, 3, 2, 1, 0].map((c) => <path key={c} d={groups[c]} stroke={colors[c]} strokeWidth={c === 4 ? 6 : 7.5} strokeLinecap="round" fill="none" />)}
    </svg>
  );
}

/** Mini-Netz des Knowledge Graph: Suchbegriff in der Mitte, Begriffe, Themen, Gremien und Länder ringsum */
function MiniGraph({ nodes, edges }: { nodes: [string, string, number][]; edges: [number, number, number][] }) {
  const W = 260, H = 150, cx = W / 2, cy = H / 2;
  const pos = nodes.map((_, i) => {
    if (i === 0) return [cx, cy] as const;
    const a = ((i - 1) / (nodes.length - 1)) * Math.PI * 2 - Math.PI / 2;
    return [Math.round((cx + Math.cos(a) * 92) * 10) / 10, Math.round((cy + Math.sin(a) * 52) * 10) / 10] as const;
  });
  const max = Math.max(...nodes.slice(1).map((n) => n[2]), 1);
  const linked = new Set(edges.flatMap((e) => [e[0], e[1]]));
  return (
    <svg viewBox={`-28 0 ${W + 56} ${H}`} className="block h-auto w-full" role="img" aria-label="Netz aus Begriffen, Themen und Gremien rund um den Suchbegriff">
      {nodes.map((_, i) => i > 0 && !linked.has(i) && <line key={"s" + i} x1={cx} y1={cy} x2={pos[i][0]} y2={pos[i][1]} stroke="#cbd5e1" strokeWidth="0.8" />)}
      {edges.map(([a, b, w], i) => <line key={i} x1={pos[a][0]} y1={pos[a][1]} x2={pos[b][0]} y2={pos[b][1]} stroke="#94a3b8" strokeOpacity={0.35 + w} strokeWidth={0.8 + w * 4} />)}
      {nodes.map(([type, label, n], i) => {
        const [fill, stroke] = KIND_FILL[type] ?? KIND_FILL.term;
        const r = i === 0 ? 9 : 3.5 + Math.sqrt(n / max) * 4.5;
        const left = pos[i][0] < cx - 4, right = pos[i][0] > cx + 4;
        return (
          <g key={i}>
            <circle cx={pos[i][0]} cy={pos[i][1]} r={r} fill={fill} stroke={stroke} strokeWidth="1.6" />
            <text x={pos[i][0] + (left ? -r - 3 : right ? r + 3 : 0)} y={pos[i][1] + (left || right ? 3 : -r - 3)} textAnchor={left ? "end" : right ? "start" : "middle"} fontSize="8.5" fill="#475569" stroke="#fff" strokeWidth="2.4" paintOrder="stroke">{short(label, 15)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Mini-Fluss des Gremiennetzes: von oben links (Eingang) nach unten rechts (Entscheidung), Linienstärke = Zahl der Wege */
function MiniFlow({ nodes, edges }: { nodes: [string, number, number][]; edges: [number, number, number][] }) {
  const W = 300, H = 190, PAD = 16;
  const order = nodes.map((_, i) => i).sort((a, b) => nodes[a][1] - nodes[b][1]);
  const pos = nodes.map(() => [0, 0] as [number, number]);
  /* nach Rang statt nach Stufenwert verteilt, damit die Gremien nicht in einer Spalte kleben */
  order.forEach((i, k) => {
    pos[i] = [Math.round(PAD + 30 + (k * (W - 2 * PAD - 60)) / Math.max(order.length - 1, 1)), Math.round(PAD + (k * (H - 2 * PAD)) / Math.max(order.length - 1, 1))];
  });
  const maxN = Math.max(...edges.map((e) => e[2]), 1), maxS = Math.max(...nodes.map((n) => n[2]), 1);
  const fill = (st: number) => (st < 0.4 ? "#94a3b8" : st < 0.7 ? "#2dd4bf" : "#0f766e");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Weg der Vorlagen durch die Gremien, von Eingang bis Entscheidung">
      {edges.map(([a, b, n], i) => {
        const [x1, y1] = pos[a], [x2, y2] = pos[b], my = (y1 + y2) / 2;
        return <path key={i} d={`M${x1} ${y1}C${x1 + 40} ${my} ${x2 - 40} ${my} ${x2} ${y2}`} fill="none" stroke="#94a3b8" strokeOpacity=".5" strokeWidth={1.2 + (n / maxN) * 6} />;
      })}
      {nodes.map(([name, st, size], i) => {
        const r = 5 + Math.sqrt(size / maxS) * 7, right = pos[i][0] < W * 0.62;
        return (
          <g key={i}>
            <circle cx={pos[i][0]} cy={pos[i][1]} r={r} fill={fill(st)} stroke="#fff" strokeWidth="1.5" />
            <text x={pos[i][0] + (right ? r + 5 : -r - 5)} y={pos[i][1] + 4} textAnchor={right ? "start" : "end"} fontSize="11" fill="#475569" stroke="#fff" strokeWidth="3" paintOrder="stroke">{short(name, 20)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Ausschnitt je Analyse; null, wenn der Schnappschuss dafür nichts enthält */
function mini(id: AnalyseId, d: any, geo?: Snap["geo"]): ReactNode {
  if (!d) return null;
  if (id === "beschluesse") {
    const months = d.months as [number, number, number][];
    const max = Math.max(...months.map((m) => m[0] + m[1] + m[2]), 1);
    return (
      <div>
        <p className="m-0 text-[28px] font-semibold leading-none text-slate-900">{String(d.approval).replace(".", ",")} %</p>
        <p className="m-0 mt-1 text-[13px] text-slate-500">beschlossen · {nf(d.decided)} entschiedene Vorgänge, {String(d.postponement).replace(".", ",")} % vertagt</p>
        <svg viewBox="0 0 120 36" preserveAspectRatio="none" className="mt-3 block h-9 w-full" role="img" aria-label="Entscheidungen je Monat">
          {months.map((m, i) => {
            const h = ((m[0] + m[1] + m[2]) / max) * 34, w = 120 / months.length;
            return <rect key={i} x={i * w + 1} y={35 - h} width={w - 2} height={h} fill="#0d9488" fillOpacity=".85" />;
          })}
        </svg>
      </div>
    );
  }
  if (id === "trends") {
    return (
      <ul className="m-0 list-none space-y-2 p-0">
        {(d.rows as { term: string; ratio: number; series: number[] }[]).map((t) => (
          <li key={t.term} className="flex items-center justify-between gap-3 text-[14px] text-slate-900">
            <span className="truncate">{t.term}</span>
            <span className="flex items-center gap-2"><span className="text-[13px] text-teal-600">×{String(t.ratio).replace(".", ",")}</span><Spark series={t.series} kind={"rising" as TrendKind} /></span>
          </li>
        ))}
      </ul>
    );
  }
  if (id === "diffusion") {
    const text = (
      <>
        <p className="m-0 text-[28px] font-semibold leading-none text-slate-900">{nf(d.count)}</p>
        <p className="m-0 mt-1 text-[13px] text-slate-500">Kommunen, erstmals seit {d.first.slice(5, 7)}/{d.first.slice(0, 4)}</p>
      </>
    );
    if (d.map && geo) return <div className="flex items-center justify-between gap-3"><div>{text}</div><DiffusionMap map={d.map} geo={geo} /></div>;
    const pts = (d.pts as number[]).map((v, i, a) => `${(i / (a.length - 1)) * 120},${34 - (v / d.count) * 32}`).join(" ");
    return (
      <div>
        {text}
        <svg viewBox="0 0 120 36" preserveAspectRatio="none" className="mt-3 block h-9 w-full" role="img" aria-label="Ausbreitung über die Zeit">
          <polyline points={pts} fill="none" stroke="#0d9488" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    );
  }
  if (id === "gremien") return d.nodes ? <MiniFlow nodes={d.nodes} edges={d.edges} /> : null;
  if (id === "graph") return d.nodes ? <MiniGraph nodes={d.nodes} edges={d.edges} /> : null;
  return null;
}

export function LiveThumb({ id, term }: { id: AnalyseId; term: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [node, setNode] = useState<ReactNode>(null);
  const [stand, setStand] = useState("");
  const Thumb = ANALYSE_THUMBS[id];
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen) return;
    let alive = true;
    load().then((d) => { if (!alive) return; const m = mini(id, d.items[`${id}|${term}`], d.geo); setNode(m); if (m && d.generated) setStand(d.generated.split("-").reverse().join(".")); }).catch((e) => console.error("LiveThumb", id, e));
    return () => { alive = false; };
  }, [seen, id, term]);
  return (
    <div ref={ref} className="relative">
      {node ? (
        <div className="min-h-[260px] rounded-[18px] border border-slate-200 bg-transparent p-5 pt-12">{node}</div>
      ) : (
        <Thumb />
      )}
      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[13px] text-slate-600 shadow-sm">
        {node ? "Daten" : "Beispiel"}: „{term}“
      </span>
      {node && stand && <p className="m-0 mt-1.5 text-[12px] text-slate-500">Stand {stand}</p>}
    </div>
  );
}
