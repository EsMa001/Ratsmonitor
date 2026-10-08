import { useEffect, useRef, useState, type ReactNode } from "react";
import { ANALYSE_THUMBS } from "../pages/analytics/AnalyticsAbout";
import { Spark, type TrendKind } from "../pages/analytics/TrendViews";
import type { AnalyseId } from "./branchen-enterprise";

/* Mini-Ausschnitte der Plenara.X-Analysen zum Suchbegriff der Branche. Sie kommen aus einem Schnappschuss
   (public/data/branchen-ausschnitte.json, erzeugt mit scripts/build-branchen-ausschnitte.mjs), nicht aus der API:
   Plenara.X ist Teil von Enterprise, die Branchenseiten zeigen nur diese feste Auswahl. Fehlt ein Eintrag
   (leer, Gebietsvergleich), bleibt das schematische Vorschaubild. */

const nf = (v: number) => v.toLocaleString("de-DE");
let snapshot: Promise<{ items: Record<string, any> }> | null = null;
function load(): Promise<{ items: Record<string, any> }> {
  if (!snapshot) {
    snapshot = fetch("/data/branchen-ausschnitte.json").then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
    snapshot.catch(() => (snapshot = null));
  }
  return snapshot;
}

function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <ul className="m-0 list-none space-y-2 p-0">
      {rows.map(([label, n]) => (
        <li key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-3 text-[13px] text-slate-600">
          <span className="truncate">{label}</span>
          <span className="h-2 rounded bg-slate-100"><span className="block h-2 rounded bg-teal-600" style={{ width: `${(n / max) * 100}%` }} /></span>
          <span className="tabular-nums text-slate-500">{nf(n)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ausschnitt je Analyse; null, wenn der Schnappschuss dafür nichts enthält */
function mini(id: AnalyseId, d: any): ReactNode {
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
    const pts = (d.pts as number[]).map((v, i, a) => `${(i / (a.length - 1)) * 120},${34 - (v / d.count) * 32}`).join(" ");
    return (
      <div>
        <p className="m-0 text-[28px] font-semibold leading-none text-slate-900">{nf(d.count)}</p>
        <p className="m-0 mt-1 text-[13px] text-slate-500">Kommunen, erstmals seit {d.first.slice(5, 7)}/{d.first.slice(0, 4)}</p>
        <svg viewBox="0 0 120 36" preserveAspectRatio="none" className="mt-3 block h-9 w-full" role="img" aria-label="Ausbreitung über die Zeit">
          <polyline points={pts} fill="none" stroke="#0d9488" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    );
  }
  if (id === "gremien") return <Bars rows={(d.edges as [string, string, number][]).map(([a, b, n]) => [`${a} → ${b}`, n])} />;
  if (id === "graph") return <Bars rows={d.terms as [string, number][]} />;
  return null;
}

export function LiveThumb({ id, term }: { id: AnalyseId; term: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [node, setNode] = useState<ReactNode>(null);
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
    load().then((d) => { if (alive) setNode(mini(id, d.items[`${id}|${term}`])); }).catch((e) => console.error("LiveThumb", id, e));
    return () => { alive = false; };
  }, [seen, id, term]);
  return (
    <div ref={ref} className="relative">
      {node ? (
        <div className="min-h-[156px] rounded-[18px] border border-slate-200 bg-transparent p-5 pt-12">{node}</div>
      ) : (
        <Thumb />
      )}
      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[13px] text-slate-600 shadow-sm">
        {node ? "Daten" : "Beispiel"}: „{term}“
      </span>
    </div>
  );
}
