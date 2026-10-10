import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BETREIBER } from "../lib/betreiber";
import { LIMITS, PRO_PRICE, useTier } from "../lib/tier";
import { useOpenSearch } from "./blocks";

/* Startseite (Reiter rechts neben Lena, noch nicht die Landingpage).
   Kopf: Slogan, Artikelzahl, Karte. Auf der Karte laufen Zeitraffer und Live zusammen: Die Begriffe unten ploppen auf, sobald sie in einem Kreis
   zum ersten Mal beraten wurden, und der Kreis bleibt gefärbt. Darunter die Trends derselben Begriffe, alles aus /api/analytics/diffusion. */

/** Begriffe, die auf der Karte aufploppen und deren Trend darunter steht */
const TOPICS = ["Wärmeplanung", "Kita", "Hitzeschutz", "Photovoltaik", "Bebauungsplan"];
const EXAMPLES = ["Bebauungsplan", "Wärmeplanung", "Hitzeschutz", "Kita", "Photovoltaik"];

interface Series {
  month: string;
  added: number;
  total: number;
}
interface First {
  k: string;
  name: string;
  t: number;
}
interface TopicData {
  firsts: First[];
  series: Series[];
}
interface Cov {
  ags?: string;
  name: string;
  count: number;
  complete: boolean;
}
interface Hit {
  id: string;
  date: string;
  title: string;
  gemeinde?: string;
  gremium?: string;
}
interface Pop {
  key: string;
  k: string;
  label: string;
  sub: string;
}
interface GeoRegion {
  id: string;
  name: string;
  ags: string;
  path: string;
}

const nf = new Intl.NumberFormat("de-DE");
const day = (iso: string) => (iso ? iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(2, 4) : "");
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const short = (n: string) => n.replace(/^(Stadt|Gemeinde|Markt|Verbandsgemeinde|Samtgemeinde) /, "");
const rule = { borderTop: "1px solid #e2e8f0" } as const;

/** Zahl, die einmal hochzählt (nicht bei reduzierter Bewegung) */
function CountUp({ value }: { value: number }) {
  const [v, setV] = useState(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) return setV(value);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1600);
      setV(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{nf.format(v)}</>;
}

/** Verlaufslinie ohne Achsen; Endpunkt als Punkt */
function Spark({ values, w = 400, h = 60, label }: { values: number[]; w?: number; h?: number; label: string }) {
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * (w - 6) + 3).toFixed(1)},${(h - 4 - (v / max) * (h - 8)).toFixed(1)}`);
  const last = pts[pts.length - 1]?.split(",") ?? ["0", "0"];
  return (
    <svg role="img" aria-label={label} width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts.join(" ")} fill="none" stroke="#0d9488" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3.4" fill="#0d9488" />
    </svg>
  );
}

/** Punkte, solange die Kartendaten laden: jeder Punkt eine Gemeinde */
function DotMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let dead = false;
    fetch("/data/gemeinde-punkte.json")
      .then((r) => (r.ok ? (r.json() as Promise<{ w: number; h: number; pts: number[] }>) : Promise.reject(new Error("punkte"))))
      .then(({ w, h, pts }) => {
        if (dead) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = w * dpr;
        cv.height = h * dpr;
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.fillStyle = "rgba(100,116,139,0.28)";
        for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i], pts[i + 1], 1.5, 1.5);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, []);
  return <canvas ref={ref} role="img" aria-label="Deutschlandkarte aus Punkten, jeder Punkt eine Gemeinde" style={{ width: "100%", height: "auto", display: "block", aspectRatio: "508 / 680" }} />;
}

/** Deutschlandkarte der Kreise (public/geo/de-districts.json, © BKG). Gefärbt wird, was bis zum Zeitpunkt erstmals beraten wurde; die Pops tragen die Begriffe. */
function GermanyMap({ lit, litKey, pops, onPick }: { lit: Record<string, number> | null; litKey: number; pops: Pop[]; onPick: (name: string) => void }) {
  const [geo, setGeo] = useState<{ regions: GeoRegion[]; states: { name: string; path: string }[] } | null>(null);
  const [tip, setTip] = useState("");
  useEffect(() => {
    const ctl = new AbortController();
    fetch("/geo/de-districts.json", { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ regions: GeoRegion[]; states?: { name: string; path: string }[] }>) : Promise.reject(new Error("geo"))))
      .then((d) => setGeo({ regions: d.regions, states: d.states ?? [] }))
      .catch(() => {});
    return () => ctl.abort();
  }, []);
  const paths = useMemo(() => {
    if (!geo) return null;
    return geo.regions.map((r) => {
      const on = lit ? lit[r.ags] !== undefined : false;
      return <path key={r.id} d={r.path} fill={on ? "#0d9488" : "#eef2f5"} fillOpacity={on ? 0.78 : 1} stroke="#fff" strokeOpacity="0.5" strokeWidth="0.25" style={{ cursor: "pointer", transition: "fill .5s, fill-opacity .5s" }} data-n={r.name} />;
    });
  }, [geo, litKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!geo) return <DotMap />;
  return (
    <div>
      <svg role="img" aria-label="Deutschlandkarte der Kreise; farbig sind Kreise, in denen die Begriffe bereits beraten wurden" viewBox="28 10 542 754" style={{ width: "100%", height: "auto", display: "block" }} onMouseLeave={() => setTip("")} onMouseOver={(e) => { const n = (e.target as SVGElement).getAttribute?.("data-n"); if (n) setTip(n); }} onClick={(e) => { const n = (e.target as SVGElement).getAttribute?.("data-n"); if (n) onPick(n); }}>
        <style>{`.pl-pop{animation:plpop 2.8s ease-out both}@keyframes plpop{0%{opacity:0}10%{opacity:1}80%{opacity:1}100%{opacity:0}}.pl-ping{transform-box:fill-box;transform-origin:center;animation:plping 1.6s ease-out infinite}@keyframes plping{0%{transform:scale(.6);opacity:.9}100%{transform:scale(3.4);opacity:0}}@media (prefers-reduced-motion:reduce){.pl-pop,.pl-ping{animation:none}}`}</style>
        {paths}
        {geo.states.map((st) => (
          <path key={st.name} d={st.path} fill="none" stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" pointerEvents="none" />
        ))}
        {pops.map((p) => {
          const r = geo.regions.find((x) => x.ags === p.k);
          if (!r) return null;
          const nums = (r.path.match(/-?\d+\.?\d*/g) ?? []).map(Number);
          const xs = nums.filter((_, i) => i % 2 === 0);
          const ys = nums.filter((_, i) => i % 2 === 1);
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
          const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
          const right = cx < 330;
          const halo = { stroke: "#fff", strokeWidth: 3.4, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
          return (
            <g key={p.key} className="pl-pop" pointerEvents="none">
              <circle cx={cx} cy={cy} r="5" fill="none" stroke="#0f172a" strokeWidth="1.5" className="pl-ping" />
              <circle cx={cx} cy={cy} r="5" fill="#0f172a" stroke="#fff" strokeWidth="1.6" />
              <text x={cx + (right ? 12 : -12)} y={cy} textAnchor={right ? "start" : "end"} fontSize="17" fontWeight="600" fill="#0f172a" style={halo}>
                {p.label}
              </text>
              <text x={cx + (right ? 12 : -12)} y={cy + 15} textAnchor={right ? "start" : "end"} fontSize="12" fill="#475569" style={halo}>
                {p.sub}
              </text>
            </g>
          );
        })}
      </svg>
      <p aria-live="polite" style={{ margin: "6px 0 0", minHeight: 20, fontSize: 14, color: "#0f172a", textAlign: "center" }}>
        {tip || " "}
      </p>
    </div>
  );
}

export function StartseitePage() {
  const openSearch = useOpenSearch();
  const { tier } = useTier();
  const [term, setTerm] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [cov, setCov] = useState<Cov[] | null>(null);
  const [data, setData] = useState<Record<string, TopicData>>({});
  const [rT, setRT] = useState(0);
  const [place, setPlace] = useState("");
  const [pick, setPick] = useState<Cov | null>(null);
  const [placeInfo, setPlaceInfo] = useState<{ total: number; upcoming: number; next: Hit[] } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  /* Artikelzahl und Abdeckungsliste (für die Ortsprüfung) */
  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/search", { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ total?: number }>) : Promise.reject(new Error("gesamt"))))
      .then((d) => setTotal(typeof d.total === "number" ? d.total : null))
      .catch(() => {});
    fetch("/api/search/coverage?level=city", { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ coverage?: Cov[] }>) : Promise.reject(new Error("coverage"))))
      .then((d) => setCov(Array.isArray(d.coverage) ? d.coverage : null))
      .catch(() => {});
    return () => ctl.abort();
  }, []);

  /* Je Begriff: wann er in welchem Kreis zuerst beraten wurde und wie viele Gebiete je Monat neu dazukamen (Diffusionsanalyse); die Karte beginnt mit dem ersten */
  useEffect(() => {
    const ctl = new AbortController();
    (async () => {
      const acc: Record<string, TopicData> = {};
      for (const t of TOPICS) {
        try {
          const r = await fetch(`/api/analytics/diffusion?q=${encodeURIComponent(t)}`, { signal: ctl.signal });
          if (!r.ok) continue;
          const d = (await r.json()) as { regions?: { ags: string; name: string; first: string }[]; series?: Series[] };
          const byK = new Map<string, First>();
          for (const x of d.regions ?? []) {
            const k = x.ags.slice(0, 5);
            const tt = Date.parse(x.first + "T12:00:00Z");
            if (!Number.isFinite(tt)) continue;
            const cur = byK.get(k);
            if (!cur || tt < cur.t) byK.set(k, { k, name: x.name, t: tt });
          }
          acc[t] = { firsts: [...byK.values()].sort((a, b) => a.t - b.t), series: d.series ?? [] };
          setData({ ...acc });
        } catch {
          if (ctl.signal.aborted) return;
        }
      }
    })();
    return () => ctl.abort();
  }, []);

  /* Zeitachse über alle geladenen Begriffe, als Schleife */
  const span = (() => {
    let lo = Infinity;
    let hi = 0;
    for (const d of Object.values(data)) for (const e of d.firsts) { lo = Math.min(lo, e.t); hi = Math.max(hi, e.t); }
    return Number.isFinite(lo) && hi > lo ? { lo, hi } : null;
  })();
  useEffect(() => {
    if (!span) return;
    if (reduced()) return setRT(span.hi);
    const DUR = 30000;
    const HOLD = 4000;
    const t0 = performance.now();
    let raf = 0;
    let lastDraw = 0;
    const tick = (now: number) => {
      if (now - lastDraw >= 100) {
        lastDraw = now;
        const c = (now - t0) % (DUR + HOLD);
        setRT(span.lo + (span.hi - span.lo) * Math.min(1, c / DUR));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [span?.lo, span?.hi]); // eslint-disable-line react-hooks/exhaustive-deps

  const lit: Record<string, number> = {};
  for (const d of Object.values(data)) for (const e of d.firsts) if (e.t <= rT && (lit[e.k] === undefined || e.t < lit[e.k])) lit[e.k] = e.t;
  /* Pops: je Begriff und Monat höchstens eines, vier gleichzeitig, jedes kurz sichtbar */
  const events = (() => {
    const out: { topic: string; k: string; name: string; t: number }[] = [];
    for (const [topic, d] of Object.entries(data)) {
      const seen = new Set<string>();
      for (const e of d.firsts) {
        const m = new Date(e.t).toISOString().slice(0, 7);
        if (seen.has(m)) continue;
        seen.add(m);
        out.push({ topic, k: e.k, name: e.name, t: e.t });
      }
    }
    return out.sort((a, b) => a.t - b.t);
  })();
  const win = span ? ((span.hi - span.lo) * 3000) / 30000 : 0;
  const pops: Pop[] = span
    ? events
        .filter((e) => e.t <= rT && e.t > rT - win)
        .slice(-4)
        .map((e) => ({ key: `${e.topic}-${e.k}`, k: e.k, label: e.topic, sub: short(e.name) }))
    : [];
  const monthLabel = span ? new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(rT)) : "";
  const litCount = Object.keys(lit).length;
  const counts = TOPICS.filter((t) => data[t]).map((t) => ({ topic: t, n: data[t].firsts.filter((e) => e.t <= rT).length }));

  /* Trends: neu beratende Gebiete je Monat, ohne den ersten (Beginn der Erfassung) und den unvollständigen laufenden Monat */
  const trends = TOPICS.filter((t) => data[t]).map((t) => {
    const all = data[t].series;
    const full = all.slice(1, -1);
    const values = full.map((m) => m.added);
    const last3 = values.slice(-3).reduce((a, b) => a + b, 0);
    const prev3 = values.slice(-6, -3).reduce((a, b) => a + b, 0);
    const ch = prev3 > 0 ? Math.round(((last3 - prev3) / prev3) * 100) : null;
    return { topic: t, values, last3, prev3, ch, months: full.length, lastMonth: full[full.length - 1]?.month ?? "" };
  });

  /* Ortsprüfung: Ergebnis zum angeklickten Ort */
  useEffect(() => {
    if (!pick?.ags) return setPlaceInfo(null);
    const ctl = new AbortController();
    setPlaceInfo(null);
    const get = (extra: string) =>
      fetch(`/api/search?area=${pick.ags}${extra}`, { signal: ctl.signal }).then((r) => (r.ok ? (r.json() as Promise<{ total: number; articles: Hit[] }>) : Promise.reject(new Error("ort"))));
    Promise.all([get(""), get(`&from=${today}&sort=asc&noformal=1`)])
      .then(([all, up]) => setPlaceInfo({ total: all.total, upcoming: up.total, next: up.articles.slice(0, 3) }))
      .catch(() => {});
    return () => ctl.abort();
  }, [pick, today]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    openSearch(term.trim() || undefined);
  };
  const q = place.trim().toLocaleLowerCase("de");
  const found = cov && q.length >= 3 ? cov.filter((c) => c.name.toLocaleLowerCase("de").includes(q)).slice(0, 5) : [];
  const monthName = (m: string) => (m ? new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(m + "-15T12:00:00Z")) : "");

  return (
    <>
      <section className="ri-sec" style={{ paddingTop: 64, background: "radial-gradient(ellipse 1000px 520px at 88% -15%, rgba(13,148,136,.10), rgba(13,148,136,0) 70%), #fff" }}>
        <div className="mx-auto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 48, alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 8vw, 44px)", lineHeight: 1.08, letterSpacing: "-0.02em", fontWeight: 600, color: "#0f172a" }}>
              Deutschlands Kommunalpolitik <span style={{ color: "#0d9488" }}>in Echtzeit.</span>
            </h1>
            <p style={{ margin: "20px 0 0", fontSize: 18, lineHeight: 1.5, color: "#64748b" }}>Früher wissen, was vor Ort beraten wird.</p>
            <p style={{ margin: "28px 0 0", display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 14px" }}>
              <span style={{ fontSize: 44, lineHeight: 1, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{total !== null ? <CountUp value={total} /> : "…"}</span>
              <span style={{ fontSize: 16, color: "#64748b" }}>Artikel aus Räten und Ausschüssen</span>
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 14, color: "#64748b" }}>
              <span aria-hidden="true" className="pl-pulse" style={{ display: "inline-block", width: 8, height: 8, marginRight: 8, borderRadius: 4, background: "#0d9488" }} />
              <style>{`.pl-pulse{animation:plpulse 2.4s ease-in-out infinite}@keyframes plpulse{0%,100%{box-shadow:0 0 0 0 rgba(13,148,136,.45)}60%{box-shadow:0 0 0 7px rgba(13,148,136,0)}}@media (prefers-reduced-motion:reduce){.pl-pulse{animation:none}}`}</style>
              Stand {day(today)}
            </p>
            {tier === "guest" && (
              <div style={{ margin: "28px 0 0" }}>
                <Link href="/registrieren?tarif=free" className="ri-btn" style={{ borderRadius: 999, border: "1px solid #0d9488", color: "#0d9488", background: "#fff", minHeight: 48, padding: "0 22px", fontWeight: 600 }}>
                  Kostenlos starten →
                </Link>
                <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, color: "#64748b" }}>
                  Gast: {LIMITS.guest.maxResults} Treffer · Konto: alle und Filter · Pro {PRO_PRICE.replace(" / Monat", "")}.{" "}
                  <Link href="/preise" style={{ color: "#0d9488" }}>
                    Tarife →
                  </Link>
                </p>
              </div>
            )}
          </div>
          <div style={{ maxWidth: "min(560px, max(300px, calc((100vh - 230px) / 1.39)))", width: "100%", justifySelf: "end" }}>
            <GermanyMap lit={span ? lit : null} litKey={litCount} pops={pops} onPick={(n) => openSearch(n)} />
            <p style={{ margin: "6px 0 0", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 12, minHeight: 34 }}>
              {span ? (
                <>
                  <span style={{ fontSize: 28, lineHeight: 1, fontWeight: 600, color: "#0d9488", fontVariantNumeric: "tabular-nums" }}>{nf.format(litCount)}</span>
                  <span style={{ fontSize: 14, color: "#64748b" }}>Kreise beraten diese Themen · bis {monthLabel}</span>
                </>
              ) : (
                <span style={{ fontSize: 14, color: "#64748b" }}>Die Karte wird aufgebaut …</span>
              )}
            </p>
            <p style={{ margin: "10px auto 0", maxWidth: 520, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", minHeight: 36 }}>
              {counts.map((c) => (
                <button key={c.topic} type="button" onClick={() => openSearch(c.topic)} className="pl-chip" style={{ height: 30, padding: "0 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 999, color: "#0f172a", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  {c.topic} <span style={{ color: "#0d9488", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{nf.format(c.n)}</span>
                </button>
              ))}
              <style>{`.pl-chip{animation:plchip .45s ease-out both}@keyframes plchip{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.pl-chip{animation:none}}`}</style>
            </p>
          </div>
        </div>
      </section>

      <section className="ri-sec ri-sec--tight" style={{ paddingTop: 48, paddingBottom: 0, borderBottom: 0 }}>
        <div className="mx-auto" style={{ maxWidth: 720 }}>
          <form onSubmit={submit} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 280px" }}>
              <span className="sr-only">Suchbegriff</span>
              <input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                maxLength={120}
                placeholder="Thema suchen, z. B. Windkraft"
                style={{ width: "100%", height: 56, padding: "0 22px", fontSize: 16, color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(15,23,42,.06), 0 8px 24px rgba(15,23,42,.06)" }}
              />
            </label>
            <button type="submit" className="ri-btn" style={{ borderRadius: 999, background: "#0f172a", color: "#fff", minHeight: 56, padding: "0 26px" }}>
              Suchen →
            </button>
          </form>
          <div style={{ margin: "14px 0 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EXAMPLES.map((e) => (
              <button key={e} type="button" onClick={() => openSearch(e)} style={{ height: 32, padding: "0 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 999, color: "#0f172a", fontSize: 14, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                {e}
              </button>
            ))}
          </div>
        </div>
      </section>

      {trends.length > 0 && (
        <section className="ri-sec" style={{ paddingTop: 96, paddingBottom: 96 }}>
          <p style={{ margin: 0, fontSize: 14, color: "#0d9488", fontWeight: 600 }}>Trends</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 28, lineHeight: 1.2, fontWeight: 600, color: "#0f172a" }}>Wo diese Themen neu dazukommen</h2>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: "#64748b", maxWidth: 680 }}>
            Gebiete, die einen Begriff in einem Monat zum ersten Mal beraten, je Monat. Verglichen werden die letzten drei vollen Monate mit den drei davor. Der Bestand beginnt im Herbst 2025; der erste und der laufende Monat sind nicht dargestellt.{" "}
            <Link href="/analytics/trends" style={{ color: "#0d9488", fontWeight: 500 }}>
              Trends und Frühindikatoren →
            </Link>
          </p>
          <ul style={{ margin: "28px 0 0", padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "0 64px" }}>
            {trends.map((t) => (
              <li key={t.topic} style={{ ...rule, padding: "18px 0 22px" }}>
                <button type="button" onClick={() => openSearch(t.topic)} style={{ width: "100%", padding: 0, background: "none", border: 0, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 22, fontWeight: 600, color: "#0f172a" }}>{t.topic}</span>
                    <span style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: t.ch !== null && t.ch >= 10 ? "#0d9488" : "#0f172a" }}>
                      {t.ch === null ? "neu" : `${t.ch >= 0 ? "+" : "−"}${Math.abs(t.ch)} %`}
                    </span>
                  </span>
                  <span style={{ display: "block", marginTop: 12 }}>
                    <Spark values={t.values} label={`Neu beratende Gebiete je Monat: ${t.topic}`} />
                  </span>
                  <span style={{ display: "block", marginTop: 6, fontSize: 14, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                    {nf.format(t.last3)} neue Gebiete in den letzten drei Monaten, davor {nf.format(t.prev3)} · zuletzt {monthName(t.lastMonth)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cov && (
        <section className="ri-sec ri-sec--tight" style={{ paddingTop: 64 }}>
          <div className="mx-auto" style={{ maxWidth: 720 }}>
            <div style={rule}>
              <h2 style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 600, color: "#0f172a" }}>Ist mein Ort dabei?</h2>
              <label>
                <span className="sr-only">Ort</span>
                <input
                  type="search"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  maxLength={60}
                  placeholder="Stadt oder Gemeinde, mindestens 3 Buchstaben"
                  style={{ marginTop: 12, width: "100%", height: 48, padding: "0 16px", fontSize: 16, color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 999, background: "#fff" }}
                />
              </label>
              <div aria-live="polite" style={{ marginTop: 10, fontSize: 14, color: "#64748b" }}>
                {q.length >= 3 && found.length === 0 ? "Dazu liegen noch keine Berichte vor." : null}
                {found.map((c) => (
                  <div key={c.name} style={{ padding: "6px 0", display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <button type="button" onClick={() => setPick(c)} aria-pressed={pick?.ags === c.ags} style={{ padding: 0, background: "none", border: 0, color: pick?.ags === c.ags ? "#0d9488" : "#0f172a", fontSize: 16, fontWeight: pick?.ags === c.ags ? 600 : 400, cursor: "pointer", textAlign: "left" }}>
                      {c.name}
                    </button>
                    <span>{c.complete ? "vollständig abgerufen" : "teilweise abgerufen"}</span>
                  </div>
                ))}
              </div>
              {pick && (
                <div style={{ marginTop: 16, ...rule, paddingTop: 14 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#0f172a" }}>{pick.name}</p>
                  {placeInfo ? (
                    <>
                      <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>
                        {nf.format(placeInfo.total)} Einträge, davon {nf.format(placeInfo.upcoming)} für kommende Sitzungen.
                      </p>
                      {placeInfo.next.length > 0 && (
                        <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
                          {placeInfo.next.map((a) => (
                            <li key={a.id} style={{ padding: "6px 0" }}>
                              <Link href={`/beschluss/${a.id}`} style={{ color: "#0f172a", fontSize: 14, fontWeight: 500 }}>
                                {a.title.length > 90 ? a.title.slice(0, 90) + "…" : a.title}
                              </Link>
                              <span style={{ display: "block", fontSize: 12, color: "#64748b" }}>
                                {day(a.date)}
                                {a.gremium ? " · " + a.gremium : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p style={{ margin: "10px 0 0" }}>
                        <button type="button" onClick={() => openSearch(short(pick.name))} style={{ padding: 0, background: "none", border: 0, color: "#0d9488", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                          Alle ansehen →
                        </button>
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>Wird geladen …</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="ri-sec">
        <div className="mx-auto" style={{ maxWidth: 720 }}>
          <div style={rule}>
            <h2 style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 600, color: "#0f172a" }}>Fragen Sie Lena</h2>
            <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5, color: "#64748b" }}>„Was gibt es zu Photovoltaik in Billerbeck?“ Lena antwortet nur mit dem, was in den Unterlagen steht, samt Fundstelle.</p>
            <Link href="/lena" style={{ display: "inline-block", marginTop: 12, color: "#0d9488", fontSize: 16, fontWeight: 500 }}>
              Zu Lena →
            </Link>
          </div>
        </div>
        <p className="mx-auto" style={{ margin: "48px auto 0", fontSize: 14, color: "#64748b" }}>
          Ein Angebot der {BETREIBER.name}. Quelle sind die öffentlichen Ratsinformationssysteme der Kommunen, maßgeblich sind die Originalunterlagen.{" "}
          <Link href="/impressum" style={{ color: "#0d9488" }}>
            Impressum
          </Link>
          {" · "}
          <Link href="/datenschutz" style={{ color: "#0d9488" }}>
            Datenschutz
          </Link>
        </p>
      </section>
    </>
  );
}
