import { useEffect, useRef, useState, type ReactNode } from "react";
import { ANALYSE_THUMBS } from "../pages/analytics/AnalyticsAbout";
import { Spark, type TrendKind } from "../pages/analytics/TrendViews";
import type { AnalyseId } from "./branchen-enterprise";

/* Mini-Ausschnitte der Plenara.X-Analysen mit echten Daten zum Suchbegriff der Branche.
   Geladen erst beim Sichtbarwerden; bei Fehler, leerem Ergebnis und für den Gebietsvergleich (braucht Orte)
   bleibt das schematische Vorschaubild. */

const nf = (v: number) => v.toLocaleString("de-DE");
const cache = new Map<string, Promise<unknown>>();
function load(id: string, term: string): Promise<any> {
  const key = id + "|" + term;
  if (!cache.has(key)) {
    const p = fetch(`/api/analytics/${id}?${new URLSearchParams({ q: term, level: "city" })}`).then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key) as Promise<any>;
}

const API: Partial<Record<AnalyseId, string>> = { beschluesse: "decisions", trends: "trends", diffusion: "diffusion", gremien: "network", graph: "graph" };

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

/** Ausschnitt je Analyse; null, wenn die Daten dafür nichts hergeben */
function mini(id: AnalyseId, d: any): ReactNode {
  if (id === "beschluesse") {
    const t = d.totals, r = d.rates;
    if (!t?.decided) return null;
    const months = (d.months ?? []).slice(-12) as { approved: number; postponed: number; rejected: number }[];
    const max = Math.max(...months.map((m) => m.approved + m.postponed + m.rejected), 1);
    return (
      <div>
        <p className="m-0 text-[28px] font-semibold leading-none text-slate-900">{String(r.approval).replace(".", ",")} %</p>
        <p className="m-0 mt-1 text-[13px] text-slate-500">beschlossen · {nf(t.decided)} entschiedene Vorgänge, {String(r.postponement).replace(".", ",")} % vertagt</p>
        <svg viewBox="0 0 120 36" preserveAspectRatio="none" className="mt-3 block h-9 w-full" role="img" aria-label="Entscheidungen je Monat">
          {months.map((m, i) => {
            const h = ((m.approved + m.postponed + m.rejected) / max) * 34, w = 120 / months.length;
            return <rect key={i} x={i * w + 1} y={35 - h} width={w - 2} height={h} fill="#0d9488" fillOpacity=".85" />;
          })}
        </svg>
      </div>
    );
  }
  if (id === "trends") {
    const rows = [...(d.rising ?? []), ...(d.emerging ?? [])].slice(0, 3) as { term: string; ratio: number; series: number[] }[];
    if (!rows.length) return null;
    return (
      <ul className="m-0 list-none space-y-2 p-0">
        {rows.map((t) => (
          <li key={t.term} className="flex items-center justify-between gap-3 text-[14px] text-slate-900">
            <span className="truncate">{t.term}</span>
            <span className="flex items-center gap-2"><span className="text-[13px] text-teal-600">×{String(t.ratio).replace(".", ",")}</span><Spark series={t.series} kind={"rising" as TrendKind} /></span>
          </li>
        ))}
      </ul>
    );
  }
  if (id === "diffusion") {
    const regions = ((d.regions ?? []) as { first: string }[]).filter((r) => r.first).sort((a, b) => a.first.localeCompare(b.first));
    if (regions.length < 3) return null;
    const t0 = Date.parse(regions[0].first), span = Math.max(Date.parse(regions[regions.length - 1].first) - t0, 1);
    const pts = regions.map((r, i) => `${((Date.parse(r.first) - t0) / span) * 120},${34 - ((i + 1) / regions.length) * 32}`).join(" ");
    return (
      <div>
        <p className="m-0 text-[28px] font-semibold leading-none text-slate-900">{nf(regions.length)}</p>
        <p className="m-0 mt-1 text-[13px] text-slate-500">Kommunen, erstmals seit {regions[0].first.slice(5, 7)}/{regions[0].first.slice(0, 4)}</p>
        <svg viewBox="0 0 120 36" preserveAspectRatio="none" className="mt-3 block h-9 w-full" role="img" aria-label="Ausbreitung über die Zeit">
          <polyline points={pts} fill="none" stroke="#0d9488" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    );
  }
  if (id === "gremien") {
    const rows = [...((d.edges ?? []) as { a: string; b: string; n: number }[])].sort((x, y) => y.n - x.n).slice(0, 4);
    if (!rows.length) return null;
    return <Bars rows={rows.map((e) => [`${e.a} → ${e.b}`, e.n])} />;
  }
  if (id === "graph") {
    const rows = ((d.nodes ?? []) as { type: string; label: string; count: number }[]).filter((n) => n.type === "term").slice(0, 5);
    if (!rows.length) return null;
    return <Bars rows={rows.map((n) => [n.label, n.count])} />;
  }
  return null;
}

export function LiveThumb({ id, term }: { id: AnalyseId; term: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [node, setNode] = useState<ReactNode>(null);
  const Thumb = ANALYSE_THUMBS[id];
  const api = API[id];
  useEffect(() => {
    if (!api || !ref.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [api]);
  useEffect(() => {
    if (!seen || !api) return;
    let alive = true;
    load(api, term).then((d) => { if (alive) setNode(mini(id, d)); }).catch(() => {});
    return () => { alive = false; };
  }, [seen, api, id, term]);
  return (
    <div ref={ref} className="relative">
      {node ? (
        <div className="min-h-[156px] rounded-[18px] border border-slate-200 bg-white p-5 pt-12">{node}</div>
      ) : (
        <Thumb />
      )}
      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[13px] text-slate-600 shadow-sm">
        {node ? "Aktuelle Daten" : "Beispiel"}: „{term}“
      </span>
    </div>
  );
}
