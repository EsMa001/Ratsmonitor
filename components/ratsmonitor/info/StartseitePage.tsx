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
  all?: Term[];
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
const NOISE = new Set(["bayerischen", "köln", "gemarkung", "errichtung", "neubau", "flurstück", "flst", "nr", "straße", "str", "satzungsbeschluss", "baugenehmigung", "abbruch", "stadtbezirk", "beschluss", "antrag", "vorlage", "änderung", "aufstellung"]);

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
          <Link href={`/analytics/diffusion?q=${q}`} style={{ ...link, display: "inline-block", marginTop: 16 }}>
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
                    <button key={n.id} type="button" onClick={() => openSearch(`${term} ${n.label}`)} style={{ padding: 0, background: "none", border: 0, color: "#0f172a", fontSize: i < 2 ? 22 : i < 4 ? 16 : 14, fontWeight: i < 2 ? 600 : 400, cursor: "pointer" }}>
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

interface Window {
  total: number;
  places: number;
  articles: Hit[];
}

/** Ein Thema im Vergleich: letzte 30 Tage gegen die 30 Tage davor, gezählt über die Suche (jede Vorlage einmal, Gebiete einmal) */
function TopicChange({ end, openSearch, openSaveDialog }: { end: string; openSearch: (term?: string) => void; openSaveDialog: () => void }) {
  const [term, setTerm] = useState(ANALYSIS_TERMS[1]);
  const [data, setData] = useState<Record<string, { now: Window; before: Window }>>({});
  const [all, setAll] = useState<{ now: number; before: number } | null>(null);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const endDate = new Date(end + "T12:00:00Z");
  const mid = iso(new Date(endDate.getTime() - 30 * 86400000));
  const start = iso(new Date(endDate.getTime() - 60 * 86400000));
  useEffect(() => {
    const ctl = new AbortController();
    const win = (t: string, from: string, to: string) =>
      fetch(`/api/search?q=${encodeURIComponent(t)}&from=${from}&to=${to}`, { signal: ctl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<{ total: number; badgeCounts?: Record<string, number>; articles?: Hit[] }>) : Promise.reject(new Error("fenster"))))
        .then((d): Window => ({ total: d.total, places: Object.keys(d.badgeCounts ?? {}).length, articles: d.articles ?? [] }));
    const count = (from: string, to: string) =>
      fetch(`/api/search?from=${from}&to=${to}`, { signal: ctl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<{ total: number }>) : Promise.reject(new Error("gesamt"))))
        .then((d) => d.total);
    Promise.all([count(mid, end), count(start, mid)])
      .then(([n, b]) => setAll({ now: n, before: b }))
      .catch(() => {});
    ANALYSIS_TERMS.forEach((t) => {
      Promise.all([win(t, mid, end), win(t, start, mid)])
        .then(([now, before]) => setData((m) => ({ ...m, [t]: { now, before } })))
        .catch(() => {});
    });
    return () => ctl.abort();
  }, [end, mid, start]);
  const cur = data[term];
  /* Veränderung des Anteils an allen Einträgen des Fensters, damit mehr Einträge insgesamt nicht als Themenzuwachs erscheinen */
  const share = (d: { now: Window; before: Window }) =>
    all && all.now > 0 && all.before > 0 && d.before.total > 0 ? Math.round(((d.now.total / all.now) / (d.before.total / all.before) - 1) * 100) : null;
  /* Balken und Marke zeigen den Anteil an allen Vorlagen des jeweiligen Fensters; jede Zeile hat ihre eigene Skala, damit auch kleine Themen lesbar bleiben */
  const shareNow = (d: { now: Window }) => (all && all.now > 0 ? d.now.total / all.now : 0);
  const shareBefore = (d: { before: Window }) => (all && all.before > 0 ? d.before.total / all.before : 0);
  const rowMax = (d: { now: Window; before: Window }) => Math.max(0.0001, shareNow(d), shareBefore(d)) * 1.15;
  /* Unter 100 Vorlagen in einem der Fenster ist die Veränderung ein Hinweis, kein Befund */
  const uncertain = (d: { now: Window; before: Window }) => d.now.total < 100 || d.before.total < 100;
  const q = encodeURIComponent(term);
  return (
    <section className="ri-sec" style={{ paddingTop: 96, paddingBottom: 96 }}>
      <p style={{ margin: 0, fontSize: 14, color: "#0d9488", fontWeight: 600 }}>Was sich verändert</p>
      <h2 style={{ margin: "8px 0 0", fontSize: 28, lineHeight: 1.2, fontWeight: 600, color: "#0f172a" }}>Wie sich Themen verändern</h2>
      <p style={{ margin: "10px 0 0", fontSize: 14, color: "#64748b", maxWidth: 680 }}>
        Anteil des Themas an allen Vorlagen: letzte 30 Tage gegen die 30 Tage davor{all ? ` (insgesamt ${nf.format(all.now)} statt ${nf.format(all.before)} Vorlagen)` : ""}. Der Zuwachs ist um den Anstieg des Gesamtbestands bereinigt. Kleine Zahlen sind Hinweise, keine Beweise.{" "}
        <Link href="/analytics/ueber" style={{ color: "#0d9488", fontWeight: 500 }}>
          So wird gerechnet →
        </Link>
      </p>
      <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "40px 64px", alignItems: "start" }}>
        <div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {ANALYSIS_TERMS.map((t) => {
              const d = data[t];
              const ch = d ? share(d) : null;
              return (
                <li key={t} style={rule}>
                  <button type="button" aria-pressed={term === t} onClick={() => setTerm(t)} style={{ width: "100%", padding: "14px 0", background: "none", border: 0, cursor: "pointer", textAlign: "left" }}>
                    <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: 18, fontWeight: term === t ? 600 : 500, color: term === t ? "#0d9488" : "#0f172a" }}>{t}</span>
                      <b style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: d && !uncertain(d) && ch !== null && ch >= 10 ? "#0d9488" : "#0f172a" }}>
                        {d && ch !== null ? `${ch >= 0 ? "+" : "−"}${Math.abs(ch)} %` : "…"}
                      </b>
                    </span>
                    <span style={{ display: "block", marginTop: 2, textAlign: "right", fontSize: 14, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                      {d ? `${nf.format(d.now.total)} Vorlagen, davor ${nf.format(d.before.total)}${uncertain(d) ? " · unsicher, kleine Zahl" : ""}` : ""}
                    </span>
                    <span aria-hidden="true" style={{ display: "block", marginTop: 8, height: 6, position: "relative", background: "#f1f5f9", borderRadius: 3 }}>
                      {d && (
                        <>
                          <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(shareNow(d) / rowMax(d)) * 100}%`, background: term === t ? "#0d9488" : "#5fb8ae", borderRadius: 3 }} />
                          <span style={{ position: "absolute", top: -4, bottom: -4, left: `${(shareBefore(d) / rowMax(d)) * 100}%`, width: 2, background: "#475569" }} />
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b" }}>Balken: Anteil an allen Vorlagen der letzten 30 Tage; Marke: Anteil in den 30 Tagen davor; jede Zeile mit eigener Skala. Die Themen sind häufig gesuchte Begriffe, keine Auswahl nach Auffälligkeit. Neu angebundene Quellen können den Bestand verändern; bereinigt ist nur das Gesamtvolumen.</p>
        </div>
        <div>
          {cur ? (
            <>
              <h3 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 600, color: "#0f172a" }}>
                „{term}“: {nf.format(cur.now.total)} Vorlagen in {nf.format(cur.now.places)} Gebieten, davor {nf.format(cur.before.total)} in {nf.format(cur.before.places)}.
              </h3>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b" }}>
                {cur.now.places >= cur.before.places
                  ? `In ${nf.format(cur.now.places - cur.before.places)} Gebieten mehr als im Zeitraum davor beraten.`
                  : `In ${nf.format(cur.before.places - cur.now.places)} Gebieten weniger als im Zeitraum davor beraten.`}
              </p>
              <h4 style={{ margin: "20px 0 0", fontSize: 14, fontWeight: 600, color: "#64748b" }}>Neueste Vorlagen</h4>
              <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none" }}>
                {cur.now.articles.slice(0, 3).map((a) => (
                  <li key={a.id} style={{ ...rule, padding: "10px 0" }}>
                    <Link href={`/beschluss/${a.id}`} style={{ color: "#0f172a", fontSize: 16, fontWeight: 500 }}>
                      {a.title.length > 100 ? a.title.slice(0, 100) + "…" : a.title}
                    </Link>
                    <span style={{ display: "block", marginTop: 2, fontSize: 14, color: "#64748b" }}>
                      {day(a.date)}
                      {a.gemeinde ? " · " + a.gemeinde : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <div style={{ margin: "20px 0 0", display: "flex", flexWrap: "wrap", gap: "12px 24px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    openSearch(term);
                    window.setTimeout(openSaveDialog, 700);
                  }}
                  className="ri-btn"
                  style={{ borderRadius: 999, background: "#0f172a", color: "#fff", minHeight: 48, padding: "0 22px" }}
                >
                  Alarm für „{term}“ →
                </button>
                <button type="button" onClick={() => openSearch(term)} style={{ padding: 0, background: "none", border: 0, color: "#0d9488", fontSize: 16, fontWeight: 500, cursor: "pointer" }}>
                  Alle Vorlagen →
                </button>
                <Link href={`/analytics/diffusion?q=${q}`} style={{ color: "#0d9488", fontSize: 16, fontWeight: 500 }}>
                  Ausbreitung →
                </Link>
              </div>
            </>
          ) : (
            <div aria-hidden="true" style={{ marginTop: 14, height: 8, width: "70%", borderRadius: 4, background: "#f1f5f9" }} />
          )}
        </div>
      </div>
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
  const rel = (t: Topic) => (t.prev > 0 ? (t.recent - t.prev) / t.prev : 0);
  const topics = trends ? [...trends.topics].filter((t) => t.n >= 20).sort((x, y) => Math.abs(rel(y)) - Math.abs(rel(x))).slice(0, 6) : [];
  const topMax = Math.max(1, ...topics.map((t) => Math.max(t.recent, t.prev))) * 1.15;

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
                  Gast: {LIMITS.guest.maxResults} Treffer · Konto: alle, Filter, Alarm · Pro {PRO_PRICE.replace(" / Monat", "")}.{" "}
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
          <div style={{ maxWidth: "min(560px, max(300px, calc((100vh - 270px) / 1.39)))", width: "100%", justifySelf: "end" }}>
            {cov ? <CoverageMap cov={cov} onPick={(n) => openSearch(n)} /> : <DotMap />}
            <p style={{ margin: "14px 0 0", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 12 }}>
              <span style={{ fontSize: 44, lineHeight: 1, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{ABDECKUNG.anteil} %</span>
              <span style={{ fontSize: 14, color: "#64748b" }}>Abdeckung, {ABDECKUNG.kreise} % der Kreise</span>
            </p>
          </div>
        </div>
      </section>

        {cov && (
          <section className="ri-sec ri-sec--tight" style={{ paddingTop: 72 }}>
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
                  placeholder="Stadt oder Gemeinde, mindestens 3 Buchstaben"
                  style={{ marginTop: 12, width: "100%", height: 48, padding: "0 16px", fontSize: 16, color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 999, background: "#fff" }}
                />
              </label>
              <div aria-live="polite" style={{ marginTop: 10, fontSize: 14, color: "#64748b" }}>
                {q.length < 3 ? null : found.length === 0 ? "Dazu liegen noch keine Berichte vor." : null}
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

      <TopicChange end={today} openSearch={openSearch} openSaveDialog={openSaveDialog} />

      {topics.length > 0 && trends && (
        <section className="ri-sec">
          <div className="mx-auto">
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#0f172a" }}>Themenfelder</h2>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>
              Anteil an allen Einträgen der letzten {trends.window} Tage. Die Marke zeigt den Anteil davor; sortiert nach der größten Veränderung.
            </p>
            <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
              {topics.map((t, i) => {
                const r = Math.round(rel(t) * 100);
                return (
                  <li key={t.id} style={{ ...rule, display: "flex", alignItems: "center", gap: 16, padding: "12px 0" }}>
                    <span style={{ flex: "0 0 200px", fontSize: 16, color: "#0f172a", fontWeight: i === 0 ? 600 : 400 }}>{t.name}</span>
                    <span style={{ flex: 1, height: 6, position: "relative", background: "#f1f5f9", borderRadius: 3 }} aria-hidden="true">
                      <span style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${(t.recent / topMax) * 100}%`, borderRadius: 3, background: i === 0 ? "#0d9488" : "#99d6cf" }} />
                      <span style={{ position: "absolute", top: -4, bottom: -4, left: `${(t.prev / topMax) * 100}%`, width: 2, background: "#94a3b8" }} />
                    </span>
                    <span style={{ flex: "0 0 300px", textAlign: "right", fontSize: 14, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                      <b style={{ color: r >= 10 ? "#0d9488" : "#0f172a", fontWeight: 600 }}>
                        {r >= 0 ? "+" : "−"}
                        {Math.abs(r)} %
                      </b>{" "}
                      ({String(t.recent).replace(".", ",")} % statt {String(t.prev).replace(".", ",")} %) · {nf.format(t.n)} Einträge
                    </span>
                  </li>
                );
              })}
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
