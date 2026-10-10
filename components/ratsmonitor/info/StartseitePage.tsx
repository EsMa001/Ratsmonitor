import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BETREIBER } from "../lib/betreiber";
import { ABDECKUNG } from "./abdeckung";
import { LIMITS, PLAN_MAX, PRO_PRICE, useTier } from "../lib/tier";
import { useUi } from "../state/ui";
import { useOpenSearch } from "./blocks";
import { KnowledgeGraph } from "./StartseiteGraph";
import { STATUS, type TopicStatus } from "@/shared/types";

/* Startseite (Reiter rechts neben Lena, noch nicht die Landingpage): Kopf mit Karte und Suche, Ortsprüfung, ein Analyseblock, Alarm.
   Aufbau nach einer Runde mit zwanzig Rollen: nur das Nötige, die Auswertungen liegen unter /analytics. Abdeckung: info/abdeckung.ts. */

interface Cov {
  ags?: string;
  name: string;
  count: number;
  complete: boolean;
}
interface Hit {
  ags?: string;
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


const nf = new Intl.NumberFormat("de-DE");
const day = (iso: string) => (iso ? iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(2, 4) : "");

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
function CoverageMap({ cov, onPick, pins, replay }: { cov: Cov[]; onPick: (name: string) => void; pins: { k: string; active: boolean }[]; replay?: { first: Record<string, number>; t: number } | null }) {
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
        <style>{`.pl-reg{animation:plreg .6s ease-out both;transition:fill-opacity .15s}@keyframes plreg{from{opacity:0}to{opacity:1}}.pl-ping{transform-box:fill-box;transform-origin:center;animation:plping 1.8s ease-out infinite}@keyframes plping{0%{transform:scale(.6);opacity:.9}100%{transform:scale(3.2);opacity:0}}@media (prefers-reduced-motion:reduce){.pl-reg,.pl-ping{animation:none}}`}</style>
        {geo.regions.map((r) => {
          const e = byKreis.get(r.ags);
          const f = replay ? replay.first[r.ags] : undefined;
          const lit = replay ? f !== undefined && f <= replay.t : false;
          return (
            <path
              key={r.id}
              d={r.path}
              fill={replay ? (lit ? "#0d9488" : "#eef1f4") : e ? tone(e.full / e.n) : "#f1f5f9"}
              fillOpacity={hover === r.id ? 1 : replay ? (lit ? (replay.t - (f as number) < 30 * 86400000 ? 1 : 0.62) : 1) : e ? opacity(e.full / e.n) : 1}
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
        {pins.map((pin) => {
          const r = geo.regions.find((x) => x.ags === pin.k);
          if (!r) return null;
          const nums = (r.path.match(/-?\d+\.?\d*/g) ?? []).map(Number);
          const xs = nums.filter((_, i) => i % 2 === 0);
          const ys = nums.filter((_, i) => i % 2 === 1);
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
          const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
          return (
            <g key={pin.k} pointerEvents="none">
              {pin.active && <circle cx={cx} cy={cy} r="4" fill="none" stroke="#0f172a" strokeWidth="1.2" className="pl-ping" />}
              <circle cx={cx} cy={cy} r={pin.active ? 4.6 : 3} fill="#0f172a" stroke="#fff" strokeWidth="1.4" style={{ transition: "r .3s" }} />
            </g>
          );
        })}
        {geo.states.map((st) => (
          <path key={st.name} d={st.path} fill="none" stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" pointerEvents="none" />
        ))}
      </svg>
      <p aria-live="polite" style={{ margin: "8px 0 0", minHeight: 21, fontSize: 14, color: "#0f172a", textAlign: "center" }}>
        {tip || "Fahren Sie über einen Kreis."}
      </p>
      {replay ? (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", textAlign: "center" }}>
          <span style={{ color: "#0d9488" }}>■</span> Thema dort im Bestand erfasst (kräftig: im letzten Monat erstmals; der Bestand beginnt im Herbst 2025) · <span style={{ color: "#cbd5e1" }}>■</span> noch nicht
        </p>
      ) : (
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", textAlign: "center" }}>
        <span style={{ color: "#0d9488" }}>■</span> überwiegend vollständig · <span style={{ color: "#a6dcd5" }}>■</span> überwiegend teilweise · <span style={{ color: "#cbd5e1" }}>■</span> noch keine Berichte
      </p>
      )}
    </div>
  );
}

interface Window {
  total: number;
  places: number;
  articles: Hit[];
}

/** Ein Thema im Vergleich: letzte 30 Tage gegen die 30 Tage davor, gezählt über die Suche (jede Vorlage einmal, Gebiete einmal) */
function TopicChange({ end, openSearch, openSaveDialog, term, setTerm }: { end: string; openSearch: (term?: string) => void; openSaveDialog: () => void; term: string; setTerm: (t: string) => void }) {
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
      <p style={{ margin: "14px 0 0", display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: 14, color: "#64748b" }}>
        <span>Mehr mit plenara.X:</span>
        {[
          ["Ausbreitung", "/analytics/diffusion"],
          ["Wortnetz", "/analytics/graph"],
          ["Beschlüsse", "/analytics/beschluesse"],
          ["Trends", "/analytics/trends"],
          ["Gebietsvergleich", "/analytics/vergleich"],
          ["Gremiennetz", "/analytics/gremien"],
        ].map(([label, href]) => (
          <Link key={href} href={href} style={{ color: "#0d9488", fontWeight: 500 }}>
            {label} →
          </Link>
        ))}
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
  const { tier } = useTier();
  const [cov, setCov] = useState<Cov[] | null>(null);
  const [hit, setHit] = useState<Hit | null>(null);
  const [ahead, setAhead] = useState<number | null>(null);
  const [fresh, setFresh] = useState<Hit[]>([]);
  const [idx, setIdx] = useState(0);
  const [place, setPlace] = useState("");
  const [topic, setTopic] = useState(ANALYSIS_TERMS[1]);
  const [mode, setMode] = useState<"abdeckung" | "zeit">("abdeckung");
  const [rTopic, setRTopic] = useState(ANALYSIS_TERMS[1]);
  const [rData, setRData] = useState<{ first: Record<string, number>; start: number; end: number } | null>(null);
  const [rT, setRT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { openSaveDialog } = useUi();
  const [pick, setPick] = useState<Cov | null>(null);
  const [placeInfo, setPlaceInfo] = useState<{ total: number; upcoming: number; next: Hit[] } | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/search/coverage?level=city", { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ coverage?: Cov[] }>) : Promise.reject(new Error("coverage"))))
      .then((d) => setCov(Array.isArray(d.coverage) ? d.coverage : null))
      .catch(() => {});
    return () => ctl.abort();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  /* Die neuesten Vorlagen der letzten Woche, höchstens eine je Kreis, laufen als Punkte über die Karte */
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/search?from=${weekAgo}&to=${today}&noformal=1`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ articles?: Hit[] }>) : Promise.reject(new Error("neu"))))
      .then((d) => {
        const seen = new Set<string>();
        const out: Hit[] = [];
        for (const a of d.articles ?? []) {
          const k = a.ags?.slice(0, 5);
          if (!k || seen.has(k)) continue;
          seen.add(k);
          out.push(a);
          if (out.length >= 8) break;
        }
        setFresh(out);
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [today, weekAgo]);
  useEffect(() => {
    if (fresh.length < 2 || reduced()) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % fresh.length), 4200);
    return () => window.clearInterval(t);
  }, [fresh.length]);
  /* Zeitraffer: wann ein Thema in einem Kreis zum ersten Mal beraten wurde (Diffusionsanalyse) */
  useEffect(() => {
    if (mode !== "zeit") return;
    const ctl = new AbortController();
    setRData(null);
    setPlaying(false);
    fetch(`/api/analytics/diffusion?q=${encodeURIComponent(rTopic)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ regions?: { ags: string; first: string }[] }>) : Promise.reject(new Error("zeitraffer"))))
      .then((d) => {
        const first: Record<string, number> = {};
        let lo = Infinity;
        let hi = 0;
        for (const x of d.regions ?? []) {
          const k = x.ags.slice(0, 5);
          const t = Date.parse(x.first + "T12:00:00Z");
          if (!Number.isFinite(t)) continue;
          if (first[k] === undefined || t < first[k]) first[k] = t;
          lo = Math.min(lo, t);
          hi = Math.max(hi, t);
        }
        if (!Number.isFinite(lo)) return;
        setRData({ first, start: lo, end: hi });
        setRT(reduced() ? hi : lo);
        setPlaying(!reduced());
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [mode, rTopic]);
  useEffect(() => {
    if (!playing || !rData) return;
    let raf = 0;
    const t0 = performance.now();
    const from = rT >= rData.end ? rData.start : rT;
    const span = rData.end - from;
    const dur = Math.max(2000, 11000 * (span / (rData.end - rData.start)));
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setRT(from + span * p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, rData]); // eslint-disable-line react-hooks/exhaustive-deps
  const litCount = rData ? Object.values(rData.first).filter((t) => t <= rT).length : 0;
  const monthLabel = rData ? new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(rT)) : "";

  const pins = fresh.map((a, i) => ({ k: (a.ags ?? "").slice(0, 5), active: i === idx % Math.max(1, fresh.length) }));
  const current = fresh.length ? fresh[idx % fresh.length] : null;
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
  const q = place.trim().toLocaleLowerCase("de");
  const found = cov && q.length >= 3 ? cov.filter((c) => c.name.toLocaleLowerCase("de").includes(q)).slice(0, 5) : [];

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
                {ahead ? `${nf.format(ahead)} Vorgänge für kommende Sitzungen · ` : ""}Stand {day(today)}
              </p>
            )}
            {current && (
              <p key={current.id} className="pl-tick" style={{ margin: "10px 0 0", fontSize: 14, color: "#0f172a", minHeight: 44, maxWidth: 520 }}>
                <span style={{ color: "#0d9488", fontWeight: 600 }}>Gerade neu: </span>
                <Link href={`/beschluss/${current.id}`} style={{ color: "#0f172a", fontWeight: 500 }}>
                  {current.title.length > 90 ? current.title.slice(0, 90) + "…" : current.title}
                </Link>
                <span style={{ color: "#64748b" }}>
                  {current.gemeinde ? " · " + current.gemeinde : ""} · {day(current.date)}
                </span>
                <style>{`.pl-tick{animation:pltick .5s ease-out both}@keyframes pltick{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.pl-tick{animation:none}}`}</style>
              </p>
            )}
            <form onSubmit={submit} style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
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
            {cov ? <CoverageMap cov={cov} onPick={(n) => openSearch(n)} pins={mode === "zeit" ? [] : pins} replay={mode === "zeit" ? { first: rData?.first ?? {}, t: rData ? rT : 0 } : null} /> : <DotMap />}
            <div role="group" aria-label="Kartenansicht" style={{ margin: "12px 0 0", display: "flex", flexWrap: "wrap", gap: "6px 16px", justifyContent: "center", fontSize: 14 }}>
              {([["abdeckung", "Abdeckung"], ["zeit", "Zeitraffer"]] as const).map(([m, l]) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} style={{ padding: "0 0 2px", background: "none", border: 0, borderBottom: mode === m ? "2px solid #0d9488" : "2px solid transparent", color: mode === m ? "#0f172a" : "#64748b", fontWeight: 600, cursor: "pointer" }}>
                  {l}
                </button>
              ))}
              {mode === "zeit" &&
                ANALYSIS_TERMS.slice(0, 3).map((t) => (
                  <button key={t} type="button" aria-pressed={rTopic === t} onClick={() => setRTopic(t)} style={{ height: 28, padding: "0 12px", background: rTopic === t ? "#0f172a" : "#fff", color: rTopic === t ? "#fff" : "#0f172a", border: "1px solid #e2e8f0", borderRadius: 999, cursor: "pointer", fontSize: 13 }}>
                    {t}
                  </button>
                ))}
            </div>
            {mode === "zeit" && (
              <div style={{ margin: "10px auto 0", maxWidth: 440, display: "flex", alignItems: "center", gap: 12 }}>
                <button type="button" aria-label={playing ? "Anhalten" : "Abspielen"} disabled={!rData} onClick={() => setPlaying((p) => !p)} style={{ width: 36, height: 36, borderRadius: 18, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", cursor: "pointer", flex: "0 0 36px" }}>
                  {playing ? "❚❚" : "▶"}
                </button>
                <input
                  type="range"
                  aria-label="Zeitpunkt"
                  min={rData?.start ?? 0}
                  max={rData?.end ?? 1}
                  step={86400000}
                  value={rData ? rT : 0}
                  disabled={!rData}
                  onChange={(e) => {
                    setPlaying(false);
                    setRT(Number(e.target.value));
                  }}
                  style={{ flex: 1, accentColor: "#0d9488" }}
                />
              </div>
            )}
            {mode === "zeit" ? (
              <p style={{ margin: "10px 0 0", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 12 }}>
                {rData ? (
                  <>
                    <span style={{ fontSize: 44, lineHeight: 1, fontWeight: 600, color: "#0d9488", fontVariantNumeric: "tabular-nums" }}>{nf.format(litCount)}</span>
                    <span style={{ fontSize: 14, color: "#64748b" }}>
                      Kreise beraten „{rTopic}“ · bis {monthLabel}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 14, color: "#64748b" }}>Zeitraffer „{rTopic}“ wird geladen …</span>
                )}
              </p>
            ) : (
            <p style={{ margin: "14px 0 0", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 12 }}>
              <span style={{ fontSize: 44, lineHeight: 1, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{ABDECKUNG.anteil} %</span>
              <span style={{ fontSize: 14, color: "#64748b" }}>Abdeckung, {ABDECKUNG.kreise} % der Kreise</span>
            </p>
            )}
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

      <TopicChange end={today} openSearch={openSearch} openSaveDialog={openSaveDialog} term={topic} setTerm={setTopic} />

      <section className="ri-sec" style={{ paddingTop: 72, paddingBottom: 72 }}>
        <div className="mx-auto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "32px 64px", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, color: "#0d9488", fontWeight: 600 }}>Knowledge Graph</p>
            <h2 style={{ margin: "8px 0 0", fontSize: 28, lineHeight: 1.2, fontWeight: 600, color: "#0f172a" }}>Womit „{topic}“ zusammenhängt</h2>
            <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.5, color: "#64748b" }}>
              Jede Vorlage nennt Begriffe, Themenfelder und Gremien. Daraus entsteht das Netz: Wo viele Linien zusammenlaufen, hängt ein Thema fest zusammen.
            </p>
            <p style={{ margin: "16px 0 0" }}>
              <Link href={`/analytics/graph?q=${encodeURIComponent(topic)}`} style={{ color: "#0d9488", fontSize: 16, fontWeight: 500 }}>
                Knowledge Graph öffnen →
              </Link>
            </p>
          </div>
          <KnowledgeGraph term={topic} onPick={(t) => openSearch(t)} />
        </div>
      </section>

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
          <Link href="/datenabdeckung" style={{ color: "#0d9488" }}>
            Datenabdeckung
          </Link>
          {" · "}
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
