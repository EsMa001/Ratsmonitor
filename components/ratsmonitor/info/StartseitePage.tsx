import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BETREIBER } from "../lib/betreiber";
import { ABDECKUNG } from "./abdeckung";
import { LIMITS, PLAN_MAX, PRO_PRICE, useTier } from "../lib/tier";
import { useUi } from "../state/ui";
import { useOpenSearch } from "./blocks";
import { STATUS, type TopicStatus } from "@/shared/types";

/* Startseite (Reiter rechts neben Lena, noch nicht die Landingpage): Schaufenster des Datenbestands.
   Alle Zahlen kommen aus den öffentlichen, vorberechneten Abfragen /api/analytics/trends und /api/search/coverage;
   fehlt eine, bleibt der Abschnitt leer statt zu raten. Slogan: docs/produkt/slogan.json (fest). */

interface Term {
  term: string;
  nr: number;
  np: number;
  ratio: number;
  regions: number;
  regionsPrev: number;
  series: number[];
}
interface Topic {
  id: string;
  name: string;
  recent: number;
  prev: number;
  change: number;
  n: number;
}
interface Trends {
  window: number;
  ranges: { start: string; end: string };
  totals: { recent: number; prev: number; regions: number };
  rising: Term[];
  emerging: Term[];
  topics: Topic[];
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
  status: string;
  title: string;
  gemeinde?: string;
  gremium?: string;
}

/** Beispielsuchen unter dem Suchfeld */
const EXAMPLES = ["Bebauungsplan", "Wärmeplanung", "Windkraft", "Netzausbau", "Kita", "Photovoltaik"];
/** Themen, an denen die Analysen gezeigt werden */
const ANALYSIS_TERMS = ["Windkraft", "Wärmeplanung", "Photovoltaik", "Bebauungsplan", "Kita"];

/** Wörter, die in der Trendliste nur Rauschen wären (Ortsnamen, Verwaltungsfloskeln) */
const NOISE = new Set(["bayerischen", "köln", "gemarkung", "errichtung", "neubau", "flurstück", "flst", "nr", "straße", "str"]);

interface Diffusion {
  stats: { regions: number; cards: number; first: string; last: string };
  series: { month: string; added: number; total: number }[];
  lands: { id: string; name: string; regions: number }[];
}
interface Graph {
  total: number;
  nodes: { id: string; type: string; label: string; count: number }[];
  stats: { terms: number; topics: number; committees: number; lands: number; links: number };
}
interface Decisions {
  totals: { all: number; known: number; decided: number; knownShare: number };
  rates: { approval: number; rejection: number; postponement: number; open: number };
}

const nf = new Intl.NumberFormat("de-DE");
const day = (iso: string) => (iso ? iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(2, 4) : "");

/** Kleines Liniendiagramm der Wochenanteile; ohne Achsen, nur der Verlauf */
function Spark({ values, w = 120, h = 32, label, fluid }: { values: number[]; w?: number; h?: number; label: string; fluid?: boolean }) {
  const max = Math.max(...values, 1e-9);
  const pts = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`);
  return (
    <svg role="img" aria-label={label} width={fluid ? "100%" : w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio={fluid ? "none" : undefined} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts.join(" ")} fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1]?.split(",")[0]} cy={pts[pts.length - 1]?.split(",")[1]} r="3" fill="#0d9488" />
    </svg>
  );
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Zahl, die einmal hochzählt (nicht bei reduzierter Bewegung) */
function CountUp({ value }: { value: number }) {
  const [v, setV] = useState(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) return setV(value);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setV(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{nf.format(v)}</>;
}

/** Deutschland aus Punkten: jeder Punkt eine Gemeinde (public/data/gemeinde-punkte.json); ein leiser Schein wandert von Nord nach Süd */
function DotMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let raf = 0;
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
        const draw = (t: number) => {
          ctx.clearRect(0, 0, w, h);
          const band = ((t / 5200) % 1.4) * 1.2 - 0.1;
          for (let i = 0; i < pts.length; i += 2) {
            const y = pts[i + 1] / h;
            const d = Math.max(0, 1 - Math.abs(y - band) / 0.07);
            ctx.fillStyle = d > 0 ? `rgba(13,148,136,${(0.28 + 0.62 * d).toFixed(2)})` : "rgba(100,116,139,0.28)";
            ctx.fillRect(pts[i], pts[i + 1], 1.5, 1.5);
          }
        };
        if (reduced()) return draw(0);
        const loop = (t: number) => {
          draw(t);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      })
      .catch(() => {});
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={ref} role="img" aria-label="Deutschlandkarte aus Punkten, jeder Punkt eine Gemeinde" style={{ width: "100%", height: "auto", display: "block", aspectRatio: "508 / 680" }} />;
}

interface GeoRegion {
  id: string;
  name: string;
  ags: string;
  path: string;
}

/** Abdeckungskarte: jeder Kreis nach dem Anteil vollständig abgerufener Gemeinden (public/geo/de-districts.json: die Kreise aus de-areas.json, © BKG) */
function CoverageMap({ cov, onPick }: { cov: Cov[]; onPick: (name: string) => void }) {
  const [geo, setGeo] = useState<{ viewBox: string; regions: GeoRegion[]; states: { name: string; path: string }[] } | null>(null);
  const [tip, setTip] = useState<string>("");
  const [hover, setHover] = useState("");
  useEffect(() => {
    const ctl = new AbortController();
    fetch("/geo/de-districts.json", { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ regions: GeoRegion[]; states?: { name: string; path: string }[] }>) : Promise.reject(new Error("geo"))))
      .then((d) => setGeo({ viewBox: "28 10 542 754", regions: d.regions, states: d.states ?? [] }))
      .catch(() => {});
    return () => ctl.abort();
  }, []);
  const byKreis = (() => {
    const m = new Map<string, { n: number; full: number }>();
    for (const c of cov) {
      const k = c.ags?.slice(0, 5);
      if (!k) continue;
      const e = m.get(k) ?? { n: 0, full: 0 };
      e.n += 1;
      if (c.complete) e.full += 1;
      m.set(k, e);
    }
    return m;
  })();
  if (!geo) return <DotMap />;
  /* Drei ruhige Stufen statt Verlauf: überwiegend vollständig, teilweise, ohne Berichte */
  const tone = (f: number) => (f >= 0.6 ? "#0d9488" : "#a6dcd5");
  const opacity = (f: number) => (f >= 0.6 ? 0.78 : 0.7);
  return (
    <div>
      <svg role="img" aria-label="Karte der Datenabdeckung nach Landkreisen" viewBox={geo.viewBox} style={{ width: "100%", height: "auto", display: "block" }} onMouseLeave={() => (setTip(""), setHover(""))}>
        <style>{`.pl-reg{animation:plreg .6s ease-out both;transition:fill-opacity .15s}@keyframes plreg{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.pl-reg{animation:none}}`}</style>
        {geo.regions.map((r) => {
          const e = byKreis.get(r.ags);
          return (
            <path
              key={r.id}
              d={r.path}
              fill={e ? tone(e.full / e.n) : "#f1f5f9"}
              fillOpacity={hover === r.id ? 1 : e ? opacity(e.full / e.n) : 1}
              className="pl-reg"
              style={{ cursor: "pointer", animationDelay: `${Math.round(((Number(r.path.slice(1).split(/[ ,LMZ]/)[1]) || 10) - 10) / 754 * 1100)}ms`, ...(hover === r.id ? { stroke: "#0f172a", strokeOpacity: 1, strokeWidth: 0.9 } : null) }}
              stroke="#fff"
              strokeOpacity="0.25"
              strokeWidth="0.2"
              onMouseEnter={() => (setHover(r.id), setTip(e ? `${r.name}: ${nf.format(e.n)} Gemeinden mit Berichten, ${nf.format(e.full)} vollständig abgerufen` : `${r.name}: noch keine Berichte`))}
              onClick={() => onPick(r.name)}
            />
          );
        })}
        {geo.states.map((st) => (
          <path key={st.name} d={st.path} fill="none" stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" pointerEvents="none" />
        ))}
      </svg>
      <p aria-live="polite" style={{ margin: "8px 0 0", minHeight: 21, fontSize: 14, color: "#0f172a", textAlign: "center" }}>
        {tip || "Fahren Sie über einen Kreis."}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", textAlign: "center" }}>
        <span style={{ color: "#0d9488" }}>■</span> überwiegend vollständig · <span style={{ color: "#a6dcd5" }}>■</span> überwiegend teilweise · <span style={{ color: "#cbd5e1" }}>■</span> noch keine Berichte
      </p>
    </div>
  );
}

/** plenara.X: Ausbreitung, Wortnetz und Beschlüsse zu einem Thema, live aus dem Bestand */
function Analyses({ openSearch, cov }: { openSearch: (term?: string) => void; cov: Cov[] | null }) {
  const [term, setTerm] = useState(ANALYSIS_TERMS[0]);
  const [d, setD] = useState<Diffusion | null>(null);
  const [g, setG] = useState<Graph | null>(null);
  const [c, setC] = useState<Decisions | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    setD(null);
    setG(null);
    setC(null);
    const get = <T,>(kind: string, set: (v: T) => void) =>
      fetch(`/api/analytics/${kind}?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(kind))))
        .then(set)
        .catch(() => {});
    get<Diffusion>("diffusion", setD);
    get<Graph>("graph", setG);
    get<Decisions>("decisions", setC);
    return () => ctl.abort();
  }, [term]);
  const q = encodeURIComponent(term);
  const link = { color: "#0d9488", fontSize: 16, fontWeight: 500 } as const;
  const cardHead = { margin: "16px 0 0", fontSize: 18, fontWeight: 600, color: "#0f172a" } as const;
  const sub = { margin: "6px 0 0", fontSize: 14, color: "#64748b" } as const;
  return (
    <section className="ri-sec" style={{ paddingTop: 96, paddingBottom: 96 }}>
      <p style={{ margin: 0, fontSize: 14, color: "#0d9488", fontWeight: 600 }}>plenara.X</p>
      <h2 style={{ margin: "8px 0 0", fontSize: 28, lineHeight: 1.2, fontWeight: 600, color: "#0f172a" }}>Aus allen Beratungen lesen, was auf Sie zukommt</h2>
      <p style={{ margin: "10px 0 0", fontSize: 16, lineHeight: 1.5, color: "#64748b", maxWidth: 720 }}>
        Zu jedem Begriff zeigt plenara.X, wo er auftaucht, womit er zusammenhängt und wie darüber entschieden wird, über den ganzen Bestand.
      </p>
      <div role="group" aria-label="Thema wählen" style={{ margin: "18px 0 0", display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 14 }}>
        <span style={{ color: "#64748b" }}>Thema</span>
        {ANALYSIS_TERMS.map((t) => (
          <button key={t} type="button" aria-pressed={term === t} onClick={() => setTerm(t)} style={{ padding: "0 0 2px", background: "none", border: 0, borderBottom: term === t ? "2px solid #0d9488" : "2px solid transparent", color: term === t ? "#0f172a" : "#64748b", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "48px 64px" }}>
        <div style={rule}>
          <h3 style={cardHead}>Wo es schon angekommen ist</h3>
          <p style={{ ...sub, color: "#0f172a" }}>Sehen Sie, in welchen Gebieten ein Thema schon beraten wird, bevor es bei Ihnen auf die Tagesordnung kommt.</p>
          {d ? (
            <>
              <p style={{ margin: "14px 0 0", display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 44, lineHeight: 1, fontWeight: 600, color: "#0d9488", fontVariantNumeric: "tabular-nums" }}>{nf.format(d.stats.regions)}</span>
                <span style={{ fontSize: 14, color: "#64748b" }}>Gebiete beraten „{term}“, erstmals {day(d.stats.first)}</span>
              </p>
              <div style={{ marginTop: 12 }}>
                <Spark fluid values={d.series.map((m) => m.total)} w={300} h={72} label={`Zahl der Gebiete mit ${term}, kumuliert nach Monaten`} />
              </div>
              <p style={{ ...sub, marginTop: 10 }}>
                {(() => {
                  /* Anteil je Land an den Gebieten mit Berichten, damit kleinteilige Länder nicht allein wegen ihrer Gemeindezahl vorn stehen */
                  const base = new Map<string, number>();
                  for (const x of cov ?? []) if (x.ags) base.set(x.ags.slice(0, 2), (base.get(x.ags.slice(0, 2)) ?? 0) + 1);
                  const share = d.lands
                    .map((l) => ({ name: l.name, pct: base.get(l.id) ? Math.round((l.regions / (base.get(l.id) as number)) * 100) : null }))
                    .filter((l): l is { name: string; pct: number } => l.pct !== null)
                    .sort((x, y) => y.pct - x.pct)
                    .slice(0, 3);
                  return share.length ? `Am stärksten, gemessen an den Gebieten je Land: ${share.map((l) => `${l.name} (${l.pct} %)`).join(", ")}` : "";
                })()}
              </p>
            </>
          ) : (
            <div aria-hidden="true" style={{ marginTop: 14, height: 8, width: "70%", borderRadius: 4, background: "#f1f5f9" }} />
          )}
          <Link href={`/analytics/diffusion?q=${q}`} style={{ ...link, display: "inline-block", marginTop: 12 }}>
            Diffusionsanalyse →
          </Link>
        </div>
        <div style={rule}>
          <h3 style={cardHead}>Womit es zusammenhängt</h3>
          <p style={{ ...sub, color: "#0f172a" }}>Erkennen Sie, mit welchen Begriffen, Themenfeldern und Gremien ein Thema verbunden ist.</p>
          {g ? (
            <>
              <p style={sub}>
                {nf.format(g.total)} Einträge, verbunden mit {g.stats.terms} Begriffen, {g.stats.topics} Themenfeldern und {g.stats.committees} Gremien.
              </p>
              <p style={{ margin: "12px 0 0", display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 16 }}>
                {g.nodes
                  .filter((n) => n.type === "term")
                  .slice(0, 6)
                  .map((n, i) => (
                    <button key={n.id} type="button" onClick={() => openSearch(`${term} ${n.label}`)} style={{ padding: 0, background: "none", border: 0, color: "#0f172a", fontSize: i < 2 ? 18 : i < 4 ? 16 : 14, fontWeight: i < 2 ? 600 : 400, cursor: "pointer" }}>
                      {n.label} <span style={{ color: "#0d9488", fontSize: 12 }}>{nf.format(n.count)}</span>
                    </button>
                  ))}
              </p>
            </>
          ) : (
            <div aria-hidden="true" style={{ marginTop: 14, height: 8, width: "70%", borderRadius: 4, background: "#f1f5f9" }} />
          )}
          <Link href={`/analytics/graph?q=${q}`} style={{ ...link, display: "inline-block", marginTop: 12 }}>
            Knowledge Graph →
          </Link>
        </div>
        <div style={rule}>
          <h3 style={cardHead}>Wie entschieden wird</h3>
          <p style={{ ...sub, color: "#0f172a" }}>Schätzen Sie ein, wie ähnliche Vorlagen bisher ausgegangen sind.</p>
          {c ? (
            <>
              <p style={sub}>
                Bei {nf.format(c.totals.decided)} entschiedenen Vorgängen: {String(c.rates.approval).replace(".", ",")} % Zustimmung, {String(c.rates.rejection).replace(".", ",")} % Ablehnung, {String(c.rates.postponement).replace(".", ",")} % Vertagung.
              </p>
              <div style={{ marginTop: 12, height: 10, display: "flex", borderRadius: 5, overflow: "hidden", background: "#f1f5f9" }} aria-hidden="true">
                <span style={{ width: `${c.rates.approval}%`, background: "#0d9488" }} />
                <span style={{ width: `${c.rates.postponement}%`, background: "#cbd5e1" }} />
                <span style={{ width: `${c.rates.rejection}%`, background: "#94a3b8" }} />
              </div>
              <p style={{ ...sub, marginTop: 10 }}>Von {nf.format(c.totals.all)} Vorgängen zum Thema ist bei {nf.format(c.totals.known)} der Ausgang bekannt.</p>
            </>
          ) : (
            <div aria-hidden="true" style={{ marginTop: 14, height: 8, width: "70%", borderRadius: 4, background: "#f1f5f9" }} />
          )}
          <Link href="/analytics/beschluesse" style={{ ...link, display: "inline-block", marginTop: 12 }}>
            Beschlüsse →
          </Link>
        </div>
        <div style={rule}>
          <h3 style={cardHead}>Weitere Auswertungen</h3>
          <p style={{ ...sub, color: "#0f172a" }}>Steigende Begriffe früh erkennen, Orte nebeneinanderlegen, den Weg einer Vorlage durch die Gremien verfolgen.</p>
          <p style={{ margin: "12px 0 0", display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
            <Link href="/analytics/trends" style={link}>
              Trends →
            </Link>
            <Link href="/analytics/vergleich" style={link}>
              Gebietsvergleich →
            </Link>
            <Link href="/analytics/gremien" style={link}>
              Gremiennetz →
            </Link>
          </p>
        </div>
      </div>
      <p style={{ margin: "28px 0 0", fontSize: 14, color: "#64748b" }}>
        Alle Auswertungen laufen über denselben Bestand wie die Suche; jede Zahl lässt sich bis zum Originaldokument zurückverfolgen.{" "}
        <Link href="/analytics/ueber" style={{ color: "#0d9488", fontWeight: 500 }}>
          Mehr zu plenara.X →
        </Link>
      </p>
    </section>
  );
}

const rule = { borderTop: "1px solid #e2e8f0" } as const;

export function StartseitePage() {
  const openSearch = useOpenSearch();
  const [term, setTerm] = useState("");
  const [trends, setTrends] = useState<Trends | null>(null);
  const { tier } = useTier();
  const [cov, setCov] = useState<Cov[] | null>(null);
  const [hit, setHit] = useState<Hit | null>(null);
  const [ahead, setAhead] = useState<number | null>(null);
  const [place, setPlace] = useState("");
  const { openSaveDialog } = useUi();
  const [pick, setPick] = useState<Cov | null>(null);
  const [placeInfo, setPlaceInfo] = useState<{ total: number; upcoming: number; next: Hit[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/analytics/trends?window=30", { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Trends>) : Promise.reject(new Error("trends"))))
      .then((d) => setTrends(d))
      .catch((e) => (e as Error).name !== "AbortError" && setFailed(true));
    fetch("/api/search/coverage?level=city", { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ coverage?: Cov[] }>) : Promise.reject(new Error("coverage"))))
      .then((d) => setCov(Array.isArray(d.coverage) ? d.coverage : null))
      .catch(() => {});
    return () => ctl.abort();
  }, []);

  /* Die Trendabfrage ist die langsamste; Stand und kommende Sitzungen warten nicht auf sie */
  const today = trends?.ranges.end ?? new Date().toISOString().slice(0, 10);
  useEffect(() => {
    if (!today) return;
    const ctl = new AbortController();
    fetch("/api/search?from=" + today, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ total?: number }>) : Promise.reject(new Error("vorsprung"))))
      .then((d) => setAhead(typeof d.total === "number" ? d.total : null))
      .catch(() => {});
    return () => ctl.abort();
  }, [today]);

  useEffect(() => {
    if (!pick?.ags) return setPlaceInfo(null);
    const ctl = new AbortController();
    setPlaceInfo(null);
    const day0 = today;
    const get = (extra: string) =>
      fetch(`/api/search?area=${pick.ags}${extra}`, { signal: ctl.signal }).then((r) => (r.ok ? (r.json() as Promise<{ total: number; articles: Hit[] }>) : Promise.reject(new Error("ort"))));
    Promise.all([get(""), get(`&from=${day0}&sort=asc&noformal=1`)])
      .then(([all, up]) => setPlaceInfo({ total: all.total, upcoming: up.total, next: up.articles.slice(0, 3) }))
      .catch(() => {});
    return () => ctl.abort();
  }, [pick, today]);

  const exampleTerm = "Bebauungsplan";
  useEffect(() => {
    const ctl = new AbortController();
    setHit(null);
    fetch("/api/search?q=" + encodeURIComponent(exampleTerm), { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ articles?: Hit[] }>) : Promise.reject(new Error("treffer"))))
      .then((d) => setHit(d.articles?.[0] ?? null))
      .catch(() => {});
    return () => ctl.abort();
  }, [exampleTerm]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    openSearch(term.trim() || undefined);
  };

  /* Erkenntnis: der neue Begriff mit den meisten Gebieten, sonst der am deutlichsten steigende */
  const byReach = (a: Term, b: Term) => b.regions - a.regions || b.nr - a.nr;
  const fresh = trends ? trends.emerging.filter((t) => !NOISE.has(t.term)).sort(byReach).slice(0, 5) : [];
  const lead = fresh[0] ?? trends?.rising[0];
  const rising = trends ? trends.rising.filter((t) => !NOISE.has(t.term) && t.regions >= 10 && t.ratio >= 1.8).sort((a, b) => b.ratio - a.ratio || b.regions - a.regions).slice(0, 5) : [];
  const topics = trends ? [...trends.topics].filter((t) => t.n >= 5).slice(0, 6) : [];
  const topMax = Math.max(1, ...topics.map((t) => Math.abs(t.change)));

  const q = place.trim().toLocaleLowerCase("de");
  const found = cov && q.length >= 3 ? cov.filter((c) => c.name.toLocaleLowerCase("de").includes(q)).slice(0, 5) : [];
  const figures: { value: number; label: string; percent?: boolean }[] = [];
  if (ahead) figures.push({ value: ahead, label: `Vorgänge stehen schon für kommende Sitzungen auf der Tagesordnung` });
  figures.push({ value: ABDECKUNG.anteil, label: `Abdeckung der Städte und Gemeinden, ${ABDECKUNG.kreise} % der Kreise sind dabei`, percent: true });
  if (trends) {
    figures.push({ value: trends.totals.recent, label: `Einträge in den letzten ${trends.window} Tagen` });
    figures.push({ value: trends.totals.regions, label: `Gebiete mit Neuem seit ${day(trends.ranges.start)}` });
  }

  return (
    <>
      <section className="ri-sec" style={{ paddingTop: 64, background: "radial-gradient(ellipse 1000px 520px at 88% -15%, rgba(13,148,136,.10), rgba(13,148,136,0) 70%), #fff" }}>
        <div className="mx-auto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 48, alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 8vw, 44px)", lineHeight: 1.08, letterSpacing: "-0.02em", fontWeight: 600, color: "#0f172a" }}>Deutschlands Kommunalpolitik <span style={{ color: "#0d9488" }}>in Echtzeit.</span></h1>
            <p style={{ margin: "20px 0 0", fontSize: 18, lineHeight: 1.5, color: "#64748b", maxWidth: 480 }}>Früher wissen, was vor Ort beraten wird: ein Portal statt vieler Systeme, ein Begriff für ganz Deutschland, jede Angabe mit Originalquelle.</p>
            {(
              <p style={{ margin: "14px 0 0", fontSize: 14, color: "#64748b" }}>
                <span aria-hidden="true" className="pl-pulse" style={{ display: "inline-block", width: 8, height: 8, marginRight: 8, borderRadius: 4, background: "#0d9488" }} />
                <style>{`.pl-pulse{animation:plpulse 2.4s ease-in-out infinite}@keyframes plpulse{0%,100%{box-shadow:0 0 0 0 rgba(13,148,136,.45)}60%{box-shadow:0 0 0 7px rgba(13,148,136,0)}}@media (prefers-reduced-motion:reduce){.pl-pulse{animation:none}}`}</style>
                Stand {day(today)} · Originalquelle bei jedem Vorgang
              </p>
            )}
            <form onSubmit={submit} style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 260px" }}>
                <span className="sr-only">Suchbegriff</span>
                <input
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  maxLength={120}
                  placeholder="Thema suchen, z. B. Windkraft"
                  style={{ width: "100%", height: 56, padding: "0 22px", fontSize: 16, color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(15,23,42,.06), 0 8px 24px rgba(15,23,42,.06)", outlineColor: "#0d9488" }}
                />
              </label>
              <button type="submit" className="ri-btn" style={{ borderRadius: 999, background: "#0f172a", color: "#fff", minHeight: 56, padding: "0 26px" }}>
                Suchen →
              </button>
            </form>
            <div style={{ margin: "14px 0 0", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {EXAMPLES.slice(0, 3).map((e) => (
                <button key={e} type="button" onClick={() => openSearch(e)} style={{ height: 32, padding: "0 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 999, color: "#0f172a", fontSize: 14, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {e}
                </button>
              ))}
            </div>
            {tier === "guest" ? (
              <div style={{ margin: "22px 0 0" }}>
                <Link href="/registrieren?tarif=free" className="ri-btn" style={{ borderRadius: 999, border: "1px solid #0d9488", color: "#0d9488", background: "#fff", minHeight: 48, padding: "0 22px", fontWeight: 600 }}>
                  Kostenlos starten →
                </Link>
                <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, color: "#64748b" }}>
                  Gast: {LIMITS.guest.maxResults} Treffer · Konto: alle Treffer, Filter, Alarm per E-Mail · Pro {PRO_PRICE.replace(" / Monat", "")} im Monat, jederzeit kündbar.{" "}
                  <Link href="/preise" style={{ color: "#0d9488" }}>
                    Tarife →
                  </Link>
                </p>
              </div>
            ) : (
              <p style={{ margin: "22px 0 0", fontSize: 16, color: "#0f172a" }}>
                <Link href="/funktionen/benachrichtigungen" style={{ color: "#0d9488", fontWeight: 600 }}>
                  Alarme einrichten →
                </Link>
                <span style={{ color: "#64748b" }}> oder </span>
                <Link href="/lena" style={{ color: "#0d9488", fontWeight: 600 }}>
                  Lena fragen →
                </Link>
              </p>
            )}
          </div>
          <div style={{ maxWidth: 560, width: "100%", justifySelf: "end" }}>
            {cov ? <CoverageMap cov={cov} onPick={(n) => openSearch(n)} /> : <DotMap />}
            <p style={{ margin: "14px 0 0", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 12 }}>
              <span style={{ fontSize: 44, lineHeight: 1, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{ABDECKUNG.anteil} %</span>
              <span style={{ fontSize: 14, color: "#64748b" }}>Abdeckung, {ABDECKUNG.kreise} % der Kreise</span>
            </p>
          </div>
        </div>
      </section>

        {cov && (
          <section className="ri-sec ri-sec--tight">
          <div className="mx-auto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 48 }}>
            <div style={rule}>
              <h2 style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 600, color: "#0f172a" }}>Ist mein Ort dabei?</h2>
              <label>
                <span className="sr-only">Ort</span>
                <input
                  type="search"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  maxLength={60}
                  placeholder="Name der Stadt oder Gemeinde"
                  style={{ marginTop: 12, width: "100%", height: 48, padding: "0 16px", fontSize: 16, color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 999, background: "#fff" }}
                />
              </label>
              <div aria-live="polite" style={{ marginTop: 10, fontSize: 14, color: "#64748b" }}>
                {q.length < 3 ? "Mindestens drei Buchstaben." : found.length === 0 ? "Dazu liegen noch keine Berichte vor." : null}
                {found.map((c) => (
                  <div key={c.name} style={{ padding: "6px 0", display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <button type="button" onClick={() => setPick(c)} aria-pressed={pick?.ags === c.ags} style={{ padding: 0, background: "none", border: 0, color: pick?.ags === c.ags ? "#0d9488" : "#0f172a", fontSize: 16, fontWeight: pick?.ags === c.ags ? 600 : 400, cursor: "pointer", textAlign: "left" }}>
                      {c.name}
                    </button>
                    <span>
                      {c.complete ? "vollständig abgerufen" : "teilweise abgerufen"}
                    </span>
                  </div>
                ))}
              </div>
              {pick && (
                <div style={{ marginTop: 16, ...rule, paddingTop: 14 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#0f172a" }}>{pick.name}</p>
                  {placeInfo ? (
                    <>
                      <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>
                        {nf.format(placeInfo.total)} Einträge, davon {nf.format(placeInfo.upcoming)} für kommende Sitzungen.{" "}
                        {pick.complete ? "Der Bestand ist vollständig abgerufen." : "Der letzte Abruf war lückenhaft, der Bestand wird fortgeführt."}
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
                      <p style={{ margin: "10px 0 0", display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            openSearch(pick.name.replace(/^(Stadt|Gemeinde|Markt) /, ""));
                            window.setTimeout(openSaveDialog, 700);
                          }}
                          style={{ padding: 0, background: "none", border: 0, color: "#0d9488", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                        >
                          Alarm: jede neue Vorlage dieses Orts per E-Mail →
                        </button>
                        <button type="button" onClick={() => openSearch(pick.name.replace(/^(Stadt|Gemeinde|Markt) /, ""))} style={{ padding: 0, background: "none", border: 0, color: "#0d9488", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
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
            {hit && (
              <div style={rule}>
                <h2 style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 600, color: "#0f172a" }}>So sieht ein Treffer aus</h2>
                <p style={{ margin: "12px 0 0", fontSize: 14, color: "#64748b" }}>
                  {day(hit.date)}
                  {hit.gemeinde ? " · " + hit.gemeinde : ""}
                  {hit.gremium ? " · " + hit.gremium : ""} · {STATUS[hit.status as TopicStatus]?.label ?? "Stand unklar"}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 16, lineHeight: 1.45, color: "#0f172a", fontWeight: 500 }}>{hit.title}</p>
                <div style={{ marginTop: 12, display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <Link href={`/beschluss/${hit.id}`} style={{ color: "#0d9488", fontSize: 16, fontWeight: 500 }}>
                    Vorgang mit Originalquelle →
                  </Link>
                  {exampleTerm && (
                    <button type="button" onClick={() => openSearch(exampleTerm)} style={{ padding: 0, background: "none", border: 0, color: "#0d9488", fontSize: 16, fontWeight: 500, cursor: "pointer" }}>
                      Mehr zu „{exampleTerm}“ →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          </section>
      )}

      {figures.length > 0 && (
        <>
        <section className="ri-sec ri-sec--tight">
          <div className="mx-auto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 32 }}>
            {figures.map((f) => (
              <div key={f.label} style={{ ...rule, paddingTop: 16 }}>
                <div style={{ fontSize: 44, lineHeight: 1.1, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}><CountUp value={f.value} />{f.percent ? " %" : ""}</div>
                <div style={{ marginTop: 6, fontSize: 14, color: "#64748b" }}>{f.label}</div>
              </div>
            ))}
          </div>
          {trends && (
            <p style={{ margin: "20px 0 0", fontSize: 14, color: "#64748b", maxWidth: 820 }}>
              Stand {day(trends.ranges.end)}. Quelle sind die Ratsinformationssysteme der Kommunen, jede Angabe verweist auf das Originaldokument.{" "}
              <Link href="/datenabdeckung" style={{ color: "#0d9488", fontWeight: 500 }}>
                Datenabdeckung →
              </Link>
            </p>
          )}
        </section>

        </>
      )}

      <Analyses openSearch={openSearch} cov={cov} />

      {lead && trends && (
        <section className="ri-sec">
          <div className="mx-auto" style={{ }}>
            <p style={{ margin: 0, fontSize: 14, color: "#0d9488", fontWeight: 600 }}>Was auffällt: Erkenntnis der letzten {trends.window} Tage</p>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b", maxWidth: 640 }}>Verglichen wird mit den {trends.window} Tagen davor, über alle Gebiete mit Berichten.</p>
            <div style={{ marginTop: 14, display: "flex", gap: 40, flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ flex: "1 1 360px" }}>
                <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.25, fontWeight: 600, color: "#0f172a" }}>
                  „{lead.term}“ wird in {nf.format(lead.regions)} {lead.regions === 1 ? "Gebiet" : "Gebieten"} beraten
                  {lead.regionsPrev > 0 ? `, davor in ${nf.format(lead.regionsPrev)}.` : ", davor kaum."}
                </h2>
                <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.5, color: "#64748b" }}>
                  {nf.format(lead.nr)} Einträge im Zeitraum, {nf.format(lead.np)} im Zeitraum davor. Verglichen werden Anteile an allen Einträgen, nicht Rohzahlen.
                </p>
                <button type="button" onClick={() => openSearch(lead.term)} style={{ marginTop: 16, padding: 0, background: "none", border: 0, color: "#0d9488", fontSize: 16, fontWeight: 500, cursor: "pointer" }}>
                  In der Suche ansehen →
                </button>
                <Link href="/analytics/ueber" style={{ marginLeft: 20, color: "#0d9488", fontSize: 16, fontWeight: 500 }}>
                  So wird gerechnet →
                </Link>
              </div>
              <Spark values={lead.series} w={260} h={64} label={`Verlauf des Begriffs ${lead.term} nach Wochen`} />
            </div>
          </div>
        </section>
      )}

      {(fresh.length > 0 || rising.length > 0) && (
        <section className="ri-sec">
          <div className="mx-auto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 48 }}>
            {[
              { title: "Neu aufgetaucht", rows: fresh },
              { title: "Deutlich häufiger", rows: rising },
            ].map(
              (g) =>
                g.rows.length > 0 && (
                  <div key={g.title}>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#0f172a" }}>{g.title}</h2>
                    <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
                      {g.rows.map((t) => (
                        <li key={t.term} style={{ ...rule }}>
                          <button type="button" onClick={() => openSearch(t.term)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "12px 0", background: "none", border: 0, cursor: "pointer", textAlign: "left" }}>
                            <span style={{ flex: 1, fontSize: 16, color: "#0f172a", fontWeight: 500 }}>
                              {t.term}
                              <span style={{ display: "block", fontSize: 14, color: "#64748b", fontWeight: 400 }}>
                                {nf.format(t.regions)} {t.regions === 1 ? "Gebiet" : "Gebiete"} · {nf.format(t.nr)} Einträge{g.title === "Deutlich häufiger" ? ` · ${String(t.ratio).replace(".", ",")}-mal so häufig` : ""}
                              </span>
                            </span>
                            <Spark values={t.series} w={96} h={28} label={`Verlauf von ${t.term}`} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )}
          </div>
        </section>
      )}

      {topics.length > 0 && (
        <section className="ri-sec">
          <div className="mx-auto" style={{ }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#0f172a" }}>Themenfelder: Anteil gegenüber dem Zeitraum davor</h2>
            <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
              {topics.map((t) => (
                <li key={t.id} style={{ ...rule, display: "flex", alignItems: "center", gap: 16, padding: "12px 0" }}>
                  <span style={{ flex: "0 0 180px", fontSize: 16, color: "#0f172a" }}>{t.name}</span>
                  <span style={{ flex: 1, height: 8, position: "relative", background: "#f1f5f9", borderRadius: 4 }} aria-hidden="true">
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        borderRadius: 4,
                        background: t.change >= 0 ? "#0d9488" : "#94a3b8",
                        width: `${(Math.abs(t.change) / topMax) * 50}%`,
                        ...(t.change >= 0 ? { left: "50%" } : { right: "50%" }),
                      }}
                    />
                  </span>
                  <span style={{ flex: "0 0 150px", textAlign: "right", fontSize: 14, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                    {t.change >= 0 ? "+" : "−"}
                    {nf.format(Math.abs(t.change))} Prozentpunkte
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {failed && !trends && (
        <section className="ri-sec ri-sec--tight">
          <p className="mx-auto" style={{ fontSize: 16, color: "#64748b" }}>
            Die Auswertung ist gerade nicht erreichbar. Die Suche funktioniert trotzdem.
          </p>
        </section>
      )}

      <section className="ri-sec">
        <div className="mx-auto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 48 }}>
          <div style={rule}>
            <h2 style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 600, color: "#0f172a" }}>Alarme statt tägliches Suchen</h2>
            <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5, color: "#64748b" }}>Speichern Sie eine Suche und erhalten Sie neue Vorgänge per E-Mail, auf Wunsch als Wochenbericht.</p>
            <Link href="/funktionen/benachrichtigungen" style={{ display: "inline-block", marginTop: 12, color: "#0d9488", fontSize: 16, fontWeight: 500 }}>
              Benachrichtigungen →
            </Link>
          </div>
          <div style={rule}>
            <h2 style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 600, color: "#0f172a" }}>Fragen Sie Lena</h2>
            <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5, color: "#64748b" }}>„Was gibt es zu Photovoltaik in Billerbeck?“ Lena antwortet nur mit dem, was in den Unterlagen steht, samt Fundstelle.</p>
            <Link href="/lena" style={{ display: "inline-block", marginTop: 12, color: "#0d9488", fontSize: 16, fontWeight: 500 }}>
              Zu Lena →
            </Link>
          </div>
        </div>
        <p className="mx-auto" style={{ margin: "48px auto 0", fontSize: 14, color: "#64748b" }}>
          Ein Angebot der {BETREIBER.name}. Daten stammen aus den öffentlichen Ratsinformationssystemen, maßgeblich sind die Originalunterlagen.{" "}
          <Link href="/impressum" style={{ color: "#0d9488" }}>
            Impressum
          </Link>
          {" · "}
          <Link href="/datenschutz" style={{ color: "#0d9488" }}>
            Datenschutz
          </Link>
        </p>
        {tier === "guest" && (
          <div className="mx-auto" style={{ marginTop: 28 }}>
            <Link href="/registrieren?tarif=free" className="ri-btn" style={{ borderRadius: 999, background: "#0f172a", color: "#fff", minHeight: 52, padding: "0 28px" }}>
              Kostenlos starten →
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
