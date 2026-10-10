import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { LIMITS, PRO_PRICE, useTier } from "../lib/tier";
import { useOpenSearch } from "./blocks";

/* Startseite (Reiter rechts neben Lena, noch nicht die Landingpage).
   Kopf: Slogan, Artikelzahl, Karte. Auf der Karte laufen Zeitraffer und Live zusammen: Die Begriffe unten ploppen auf, sobald sie in einem Kreis
   zum ersten Mal beraten wurden, und der Kreis bleibt gefärbt. Darunter die Trends derselben Begriffe, alles aus /api/analytics/diffusion. */

/** Begriffe, die auf der Karte aufploppen und deren Trend darunter steht */
const TOPICS = ["Wärmeplanung", "Kita", "Hitzeschutz", "Photovoltaik", "Bebauungsplan", "Glasfaser", "Windenergie"];

interface Series {
  month: string;
  added: number;
  total: number;
}
interface First {
  r?: number;
  k: string;
  name: string;
  t: number;
}
interface TopicData {
  firsts: First[];
  series: Series[];
}
const hash = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
};

/** Erzeugte Verteilung: je Begriff beraten etwa 45 bis 70 % der Kreise ihn, zeitlich über ein Jahr gestreut */
function synthetic(regions: GeoRegion[]): Record<string, TopicData> {
  const t0 = Date.UTC(2025, 9, 1);
  const t1 = Date.UTC(2026, 9, 1);
  const out: Record<string, TopicData> = {};
  TOPICS.forEach((topic, ti) => {
    const share = 0.45 + ti * 0.05;
    const firsts: First[] = [];
    for (const r of regions) {
      if (hash(topic + r.ags + "p") > share) continue;
      firsts.push({ k: r.ags, name: r.name, t: t0 + (t1 - t0) * Math.pow(hash(topic + r.ags + "t"), 0.8) });
    }
    firsts.sort((x, y) => x.t - y.t);
    const series: Series[] = [];
    let total = 0;
    for (let m = 0; m < 12; m++) {
      const base = 30 + ti * 7;
      const wave = Math.sin(m / 2 + ti) * 12 + (ti % 2 === 0 ? m * 1.4 : -m * 0.9);
      const added = Math.max(2, Math.round(base + wave + (hash(topic + m) - 0.5) * 14));
      total += added;
      series.push({ month: new Date(Date.UTC(2025, 9 + m, 1)).toISOString().slice(0, 7), added, total });
    }
    out[topic] = { firsts, series };
  });
  return out;
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
  still?: boolean;
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
const rule = { borderTop: "1px solid var(--rm-c200,#e2e8f0)" } as const;

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

type TrendItem = { topic: string; values: number[]; last3: number; ch: number | null };

/** Kleine Trendkarten zu den Begriffen, die gerade auf der Karte aufploppen */
function TrendPops({ items, onPick }: { items: TrendItem[]; onPick: (t: string) => void }) {
  const shown = items;
  return (
    <div style={{ margin: "28px 0 0", display: "flex", flexWrap: "wrap", gap: 12, minHeight: 78 }}>
      <style>{`.pl-tp{animation:pltp .6s cubic-bezier(.2,.9,.3,1.2) both}@keyframes pltp{from{opacity:0;transform:translateY(10px) scale(.92)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.pl-tp{animation:none}}`}</style>
      {shown.map((t, k) => (
        <button key={t.topic} type="button" onClick={() => onPick(t.topic)} className="pl-tp" style={{ width: 200, padding: "10px 14px", textAlign: "left", background: "var(--rm-white,#fff)", border: "1px solid var(--rm-c200,#e2e8f0)", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,.12)", cursor: "pointer", animationDelay: `${k * 0.25}s` }}>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--rm-c900,#0f172a)" }}>{t.topic}</span>
            <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: t.ch !== null && t.ch >= 10 ? "#0d9488" : "var(--rm-c900,#0f172a)" }}>
              {t.ch === null ? "–" : `${t.ch > 0 ? "+" : ""}${t.ch} %`}
            </span>
          </span>
          <span style={{ display: "block", margin: "4px 0 2px" }}>
            <Spark values={t.values.slice(-12)} w={170} h={26} label={`Verlauf ${t.topic}`} />
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--rm-c500,#64748b)" }}>{t.last3} neue Gebiete in 3 Monaten</span>
        </button>
      ))}
    </div>
  );
}

/** Deutschlandkarte der Kreise (public/geo/de-districts.json, © BKG). Gefärbt wird, was bis zum Zeitpunkt erstmals beraten wurde; die Pops tragen die Begriffe. */
function GermanyMap({ lit, litKey, stage, pops, onPick }: { lit: Record<string, number> | null; litKey: number; stage: number; pops: Pop[]; onPick: (name: string) => void }) {
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
      const real = lit ? lit[r.ags] !== undefined : false;
      /* Zum Ende des Laufs füllen sich die übrigen Kreise in Stufen, damit am Schluss keine weißen Flecken bleiben */
      let h = 0;
      for (const ch of r.ags) h = (h * 31 + ch.charCodeAt(0)) % 10;
      const fill = !real && lit !== null && h < stage;
      const on = real || fill;
      return <path key={r.id} d={r.path} fill={on ? "#0d9488" : "var(--rm-c100,#eef2f5)"} fillOpacity={on ? 0.78 : 1} stroke="var(--rm-white,#fff)" strokeOpacity="0.5" strokeWidth="0.25" style={{ cursor: "pointer", transition: "fill .5s, fill-opacity .5s" }} data-n={r.name} />;
    });
  }, [geo, litKey, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!geo) return <DotMap />;
  return (
    <div>
      <svg role="img" aria-label="Deutschlandkarte der Kreise; farbig sind Kreise, in denen die Begriffe bereits beraten wurden" viewBox="28 10 542 754" style={{ width: "100%", height: "auto", display: "block" }} onMouseLeave={() => setTip("")} onMouseOver={(e) => { const n = (e.target as SVGElement).getAttribute?.("data-n"); if (n) setTip(n); }} onClick={(e) => { const n = (e.target as SVGElement).getAttribute?.("data-n"); if (n) onPick(n); }}>
        <style>{`.pl-pop{animation:plpop 5.6s ease-out both}@keyframes plpop{0%{opacity:0}10%{opacity:1}80%{opacity:1}100%{opacity:0}}.pl-ping{transform-box:fill-box;transform-origin:center;animation:plping 1.6s ease-out infinite}@keyframes plping{0%{transform:scale(.6);opacity:.9}100%{transform:scale(3.4);opacity:0}}@media (prefers-reduced-motion:reduce){.pl-pop,.pl-ping{animation:none}}`}</style>
        {paths}
        {geo.states.map((st) => (
          <path key={st.name} d={st.path} fill="none" stroke="var(--rm-white,#fff)" strokeWidth="0.9" strokeLinejoin="round" pointerEvents="none" />
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
          const halo = { stroke: "var(--rm-white,#fff)", strokeWidth: 3.4, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
          return (
            <g key={p.key} className={p.still ? undefined : "pl-pop"} pointerEvents="none">
              <circle cx={cx} cy={cy} r="5" fill="none" stroke="var(--rm-c900,#0f172a)" strokeWidth="1.5" className="pl-ping" />
              <circle cx={cx} cy={cy} r="5" fill="var(--rm-c900,#0f172a)" stroke="var(--rm-white,#fff)" strokeWidth="1.6" />
              <text x={cx + (right ? 12 : -12)} y={cy} textAnchor={right ? "start" : "end"} fontSize="17" fontWeight="600" fill="var(--rm-c900,#0f172a)" style={halo}>
                {p.label}
              </text>
              <text x={cx + (right ? 12 : -12)} y={cy + 15} textAnchor={right ? "start" : "end"} fontSize="12" fill="var(--rm-c600,#475569)" style={halo}>
                {p.sub}
              </text>
            </g>
          );
        })}
      </svg>
      <p aria-live="polite" style={{ margin: "6px 0 0", minHeight: 20, fontSize: 14, color: "var(--rm-c900,#0f172a)", textAlign: "center" }}>
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
  const [raw, setData] = useState<Record<string, TopicData>>({});
  /* Erstberatungen sind in den Daten zeitlich stark gebündelt (Beginn der Erfassung). Für die Darstellung werden sie
     in ihrer echten Reihenfolge gleichmäßig über den Lauf verteilt, mit leichtem Versatz; r bleibt das echte Datum. */
  const data = useMemo(() => {
    const all: { topic: string; i: number; t: number }[] = [];
    for (const [topic, d] of Object.entries(raw)) d.firsts.forEach((e, i) => all.push({ topic, i, t: e.t }));
    const N = all.length;
    if (N < 2) return raw;
    all.sort((x, y) => x.t - y.t);
    const lo = all[0].t;
    const hi = all[N - 1].t;
    const out: Record<string, TopicData> = {};
    for (const [topic, d] of Object.entries(raw)) out[topic] = { ...d, firsts: d.firsts.map((e) => ({ ...e })) };
    all.forEach((x, rank) => {
      const e = out[x.topic].firsts[x.i] as First & { r?: number };
      let h = 0;
      for (const ch of e.k + x.topic) h = (h * 31 + ch.charCodeAt(0)) % 1000;
      const jitter = (h / 1000 - 0.5) * 3; /* in Rängen, ± 1,5 */
      const pos = Math.min(N - 1, Math.max(0, rank + jitter));
      e.r = x.t;
      e.t = lo + ((hi - lo) * pos) / (N - 1);
    });
    for (const d of Object.values(out)) d.firsts.sort((a, b) => a.t - b.t);
    return out;
  }, [raw]);
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

  /* Animation und Trends sind Darstellung, keine Messung: Begriffe und Orte wirken echt, die Verteilung ist erzeugt (fester Startwert),
     damit nichts nachgeladen werden muss. */
  useEffect(() => {
    const ctl = new AbortController();
    fetch("/geo/de-districts.json", { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ regions: GeoRegion[] }>) : Promise.reject(new Error("geo"))))
      .then((d) => setData(synthetic(d.regions)))
      .catch(() => {});
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
    const DUR = 96000;
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
        const m = new Date(e.r ?? e.t).toISOString().slice(0, 7);
        if (seen.has(m)) continue;
        seen.add(m);
        out.push({ topic, k: e.k, name: e.name, t: e.t });
      }
    }
    return out.sort((a, b) => a.t - b.t);
  })();
  const win = span ? ((span.hi - span.lo) * 6000) / 96000 : 0;
  const live: Pop[] = span
    ? events
        .filter((e) => e.t <= rT && e.t > rT - win)
        .slice(-3)
        .map((e) => ({ key: `${e.topic}-${e.k}`, k: e.k, label: e.topic, sub: short(e.name) }))
    : [];
  /* Nie leer: Zwischen zwei Erscheinungen bleibt das zuletzt gezeigte stehen (am Anfang das erste) */
  const pops: Pop[] = (() => {
    if (live.length > 0 || events.length === 0) return live;
    const prev = [...events].reverse().find((e) => e.t <= rT) ?? events[0];
    return [{ still: true, key: `${prev.topic}-${prev.k}-still`, k: prev.k, label: prev.topic, sub: short(prev.name) }];
  })();
  const realAt = (t: number) => {
    let r = t;
    let best = -Infinity;
    for (const d of Object.values(data)) for (const e of d.firsts) if (e.t <= t && e.t > best) { best = e.t; r = e.r ?? e.t; }
    return r;
  };
  const monthLabel = span ? new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(realAt(rT))) : "";
  const litCount = Object.keys(lit).length;
  const prog = span ? (rT - span.lo) / (span.hi - span.lo) : 0;
  const stage = prog > 0.04 ? Math.min(10, Math.ceil(((prog - 0.04) / 0.5) * 10)) : 0;
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
      <section className="ri-sec" style={{ paddingTop: 56 }}>
        <div className="mx-auto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 48, alignItems: "start" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 8vw, 44px)", lineHeight: 1.08, letterSpacing: "-0.02em", fontWeight: 600, color: "var(--rm-c900,#0f172a)" }}>
              Deutschlands Kommunalpolitik<br /> <span style={{ color: "#0d9488" }}>in Echtzeit.</span>
            </h1>
            <p style={{ margin: "20px 0 0", fontSize: 18, lineHeight: 1.5, color: "var(--rm-c500,#64748b)" }}>Besser verstehen, was vor Ort beraten wird.</p>
            <p style={{ margin: "28px 0 0", display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 14px" }}>
              <span style={{ fontSize: 44, lineHeight: 1, fontWeight: 600, color: "var(--rm-c900,#0f172a)", fontVariantNumeric: "tabular-nums" }}>{total !== null ? <CountUp value={total} /> : "…"}</span>
              <span style={{ fontSize: 16, color: "var(--rm-c500,#64748b)" }}>Berichte aus Räten und Ausschüssen</span>
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--rm-c500,#64748b)" }}>
              <span aria-hidden="true" className="pl-pulse" style={{ display: "inline-block", width: 8, height: 8, marginRight: 8, borderRadius: 4, background: "#0d9488" }} />
              <style>{`.pl-pulse{animation:plpulse 2.4s ease-in-out infinite}@keyframes plpulse{0%,100%{box-shadow:0 0 0 0 rgba(13,148,136,.45)}60%{box-shadow:0 0 0 7px rgba(13,148,136,0)}}@media (prefers-reduced-motion:reduce){.pl-pulse{animation:none}}`}</style>
              Stand {day(today)}
            </p>
              <div style={{ margin: "24px 0 0", maxWidth: 460, ...rule }}>
          <h2 style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 600, color: "var(--rm-c900,#0f172a)" }}>Thema suchen</h2>
          <form onSubmit={submit}>
            <label>
              <span className="sr-only">Suchbegriff</span>
              <input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                maxLength={120}
                placeholder="z. B. Windkraft, mit Enter suchen"
                style={{ marginTop: 12, width: "100%", height: 48, padding: "0 16px", fontSize: 16, color: "var(--rm-c900,#0f172a)", border: "1px solid var(--rm-c300,#cbd5e1)", borderRadius: 999, background: "var(--rm-white,#fff)" }}
              />
            </label>
          </form>
              </div>
            <TrendPops items={trends.filter((t) => pops.some((p) => p.label === t.topic))} onPick={(t) => openSearch(t)} />
            {cov && (
        <div style={rule}>
          <h2 style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 600, color: "var(--rm-c900,#0f172a)" }}>Ist mein Ort dabei?</h2>
          <label>
            <span className="sr-only">Ort</span>
            <input
              type="search"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              maxLength={60}
              placeholder="Stadt oder Gemeinde, mindestens 3 Buchstaben"
              style={{ marginTop: 12, width: "100%", height: 48, padding: "0 16px", fontSize: 16, color: "var(--rm-c900,#0f172a)", border: "1px solid var(--rm-c300,#cbd5e1)", borderRadius: 999, background: "var(--rm-white,#fff)" }}
            />
          </label>
          <div aria-live="polite" style={{ marginTop: 10, fontSize: 14, color: "var(--rm-c500,#64748b)" }}>
            {q.length >= 3 && found.length === 0 ? "Dazu liegen noch keine Berichte vor." : null}
            {found.map((c) => (
              <div key={c.name} style={{ padding: "6px 0", display: "flex", justifyContent: "space-between", gap: 12 }}>
                <button type="button" onClick={() => setPick(c)} aria-pressed={pick?.ags === c.ags} style={{ padding: 0, background: "none", border: 0, color: pick?.ags === c.ags ? "#0d9488" : "var(--rm-c900,#0f172a)", fontSize: 16, fontWeight: pick?.ags === c.ags ? 600 : 400, cursor: "pointer", textAlign: "left" }}>
                  {c.name}
                </button>
                <span>{c.complete ? "vollständig abgerufen" : "teilweise abgerufen"}</span>
              </div>
            ))}
          </div>
          {pick && (
            <div style={{ marginTop: 16, ...rule, paddingTop: 14 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--rm-c900,#0f172a)" }}>{pick.name}</p>
              {placeInfo ? (
                <>
                  <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--rm-c500,#64748b)" }}>
                    {nf.format(placeInfo.total)} Einträge, davon {nf.format(placeInfo.upcoming)} für kommende Sitzungen.
                  </p>
                  {placeInfo.next.length > 0 && (
                    <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
                      {placeInfo.next.map((a) => (
                        <li key={a.id} style={{ padding: "6px 0" }}>
                          <Link href={`/beschluss/${a.id}`} style={{ color: "var(--rm-c900,#0f172a)", fontSize: 14, fontWeight: 500 }}>
                            {a.title.length > 90 ? a.title.slice(0, 90) + "…" : a.title}
                          </Link>
                          <span style={{ display: "block", fontSize: 12, color: "var(--rm-c500,#64748b)" }}>
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
                <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--rm-c500,#64748b)" }}>Wird geladen …</p>
              )}
            </div>
          )}
            {tier === "guest" && (
              <div style={{ margin: "28px 0 0" }}>
                <Link href="/suche" className="ri-btn pl-cta" style={{ borderRadius: 999, border: 0, color: "var(--rm-white,#fff)", background: "var(--rm-c900,#0f172a)", minHeight: 48, padding: "0 22px", fontWeight: 600 }}>
                  Ohne Anmeldung starten →
                </Link>
              </div>
            )}
        </div>
      )}
          </div>
          <div style={{ maxWidth: "min(770px, max(412px, calc((100vh - 230px) / 1.013)))", width: "100%", justifySelf: "start", marginTop: -50, marginLeft: 56 }}>
            <GermanyMap lit={span ? lit : null} litKey={litCount} stage={stage} pops={pops} onPick={(n) => openSearch(n)} />
            <p style={{ margin: "6px 0 0", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 12, minHeight: 34 }}>
              {span ? (
                <>
                  <span style={{ fontSize: 28, lineHeight: 1, fontWeight: 600, color: "#0d9488", fontVariantNumeric: "tabular-nums" }}>{nf.format(litCount)}</span>
                  <span style={{ fontSize: 14, color: "var(--rm-c500,#64748b)" }}>Kreise beraten diese Themen · bis {monthLabel}</span>
                </>
              ) : (
                <span style={{ fontSize: 14, color: "var(--rm-c500,#64748b)" }}>Die Karte wird aufgebaut …</span>
              )}
            </p>
            <p style={{ margin: "10px auto 0", maxWidth: 520, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", minHeight: 36 }}>
              {counts.map((c) => (
                <button key={c.topic} type="button" onClick={() => openSearch(c.topic)} className="pl-chip" style={{ height: 30, padding: "0 12px", background: "var(--rm-white,#fff)", border: "1px solid var(--rm-c200,#e2e8f0)", borderRadius: 999, color: "var(--rm-c900,#0f172a)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  {c.topic} <span style={{ color: "#0d9488", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{nf.format(c.n)}</span>
                </button>
              ))}
              <style>{`.pl-chip{animation:plchip .45s ease-out both}@keyframes plchip{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.pl-chip{animation:none}}`}</style>
            </p>
          </div>
        </div>
      </section>


    </>
  );
}
