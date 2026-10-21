import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { IconPin } from "../components/icons";
import { Ladefehler, useOpenSearch } from "./blocks";
import { todayLocal } from "../lib/text";
import { useMe } from "../lib/account";
import { usePhone } from "../lib/usePhone";
import topicList from "./startseite-topics.json";

/* Startseite (noch nicht die Landingpage).
   Kopf: Slogan, Artikelzahl, Karte. Auf der Karte laufen Zeitraffer und Live zusammen: Die Begriffe unten ploppen auf, sobald sie in einem Kreis
   zum ersten Mal beraten wurden. Darunter die Trends derselben Begriffe, alles aus /api/analytics/diffusion. */

/** Begriffe, die auf der Karte aufploppen und deren Trend darunter steht */
const TOPICS: string[] = topicList;

interface Series {
  month: string;
  added: number;
  total: number;
}
interface First {
  r?: number;
  p?: boolean;
  k: string;
  name: string;
  t: number;
}
interface TopicData {
  firsts: First[];
  series: Series[];
}
/** public/data/startseite-trends.json (scripts/startseite-trends.mjs, aus /api/analytics/diffusion): je Begriff und Kreis die erste
 *  Beratung [Kreis, Gemeinde, Datum] und je Monat die neu hinzugekommenen Gebiete */
interface Snapshot {
  stand: string;
  topics: Record<string, { f: [string, string, string][]; series: Series[] }>;
}
const toTopic = (d: Snapshot["topics"][string]): TopicData => ({
  firsts: d.f.map(([k, name, day]) => ({ k, name, t: Date.parse(day + "T00:00:00Z") })),
  series: d.series,
});

interface Cov {
  ags?: string;
  name: string;
  count: number;
  complete: boolean;
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

/** Zahl, die einmal hochzählt (nicht bei reduzierter Bewegung) */
function CountUp({ value }: { value: number }) {
  const [v, setV] = useState(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) return;
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
  return <>{nf.format(reduced() ? value : v)}</>;
}

/** Verlaufslinie ohne Achsen; Endpunkt als Punkt */
function Spark({ values, w = 400, h = 60, label }: { values: number[]; w?: number; h?: number; label: string }) {
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * (w - 6) + 3).toFixed(1)},${(h - 4 - (v / max) * (h - 8)).toFixed(1)}`);
  const last = pts[pts.length - 1]?.split(",") ?? ["0", "0"];
  return (
    <svg role="img" aria-label={label} width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--rm-fill)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3.4" fill="var(--rm-fill)" />
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
        /* Dunkelblau des Farbschemas (sky-600) aus der Variable, nicht als feste Zahl */
        const sky = getComputedStyle(document.documentElement).getPropertyValue("--color-sky-600").trim();
        if (!sky) return;
        ctx.fillStyle = sky;
        ctx.globalAlpha = 0.28;
        for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i], pts[i + 1], 1.5, 1.5);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, []);
  return <canvas ref={ref} role="img" aria-label="Deutschlandkarte aus Punkten, jeder Punkt eine Gemeinde" className="block aspect-[508/680] h-auto w-full" />;
}

type TrendItem = { topic: string; values: number[]; last3: number; ch: number | null };

/** Kleine Trendkarten zu den Begriffen, die gerade auf der Karte aufploppen */
function TrendPops({ items, onPick }: { items: TrendItem[]; onPick: (t: string) => void }) {
  const shown = items;
  return (
    <div className="pl-trends mt-7 flex min-h-[78px] flex-wrap gap-3">
      {shown.map((t, k) => (
        <button key={t.topic} type="button" onClick={() => onPick(t.topic)} className="pl-tp w-[200px] cursor-pointer rounded-[14px] border border-[var(--rm-c200)] bg-[var(--rm-white)] px-[14px] py-[10px] text-left shadow-[0_8px_24px_rgba(0,0,0,.12)]" style={{ animationDelay: `${k * 0.25}s` }}>
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-[14px] font-[600] text-[var(--rm-c900)]">{t.topic}</span>
            <span className={`text-[14px] font-[600] tabular-nums ${t.ch !== null && t.ch >= 10 ? "text-[var(--rm-fill)]" : "text-[var(--rm-c900)]"}`}>
              {t.ch === null ? "–" : `${t.ch > 0 ? "+" : ""}${t.ch} %`}
            </span>
          </span>
          <span className="mb-0.5 mt-1 block">
            <Spark values={t.values.slice(-12)} w={170} h={26} label={`Verlauf ${t.topic}`} />
          </span>
          <span className="block text-[12px] text-[var(--rm-c500)]">{t.last3} neue Gebiete in 3 Monaten</span>
        </button>
      ))}
    </div>
  );
}

/* Kreisdatei einmal je Seitenaufruf laden: Karte und Mittelpunkte der Pops brauchen sie beide */
type Districts = { regions: GeoRegion[]; states?: { name: string; path: string }[] };
let districts: Promise<Districts> | null = null;
const loadDistricts = () =>
  (districts ??= fetch("/geo/de-districts.json")
    .then((r) => (r.ok ? (r.json() as Promise<Districts>) : Promise.reject(new Error("geo"))))
    .catch((e) => {
      districts = null;
      throw e;
    }));

/** Deutschlandkarte der Kreise (public/geo/de-districts.json, © BKG), ganz eingefärbt; die Pops zeigen, wo ein Begriff zum ersten Mal beraten wurde. */
function GermanyMap({ pops, onPick }: { pops: Pop[]; onPick: (name: string) => void }) {
  const [geo, setGeo] = useState<{ regions: GeoRegion[]; states: { name: string; path: string }[] } | null>(null);
  const [tip, setTip] = useState("");
  useEffect(() => {
    let live = true;
    loadDistricts()
      .then((d) => live && setGeo({ regions: d.regions, states: d.states ?? [] }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const paths = useMemo(() => {
    if (!geo) return null;
    return geo.regions.map((r) => {
      return <path key={r.id} d={r.path} fill="var(--rm-fill)" fillOpacity={0.78} stroke="var(--rm-white)" strokeOpacity="0.5" strokeWidth="0.25" className="cursor-pointer transition-[fill,fill-opacity] duration-500" data-n={r.name} />;
    });
  }, [geo]);
  if (!geo) return <DotMap />;
  return (
    <div>
      <svg role="img" aria-label="Deutschlandkarte der Kreise; eingeblendet ist, wo Begriffe wie Wärmeplanung oder Photovoltaik zum ersten Mal beraten wurden" viewBox="12 8 560 758" className="block h-auto w-full" onMouseLeave={() => setTip("")} onMouseOver={(e) => { const n = (e.target as SVGElement).getAttribute?.("data-n"); if (n) setTip(n); }} onClick={(e) => { const n = (e.target as SVGElement).getAttribute?.("data-n"); if (n) onPick(n); }}>
        {paths}
        {geo.states.map((st) => (
          <path key={st.name} d={st.path} fill="none" stroke="var(--rm-white)" strokeWidth="0.9" strokeLinejoin="round" pointerEvents="none" />
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
          const halo = { stroke: "var(--rm-white)", strokeWidth: 3.4, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
          return (
            <g key={p.key} className={p.still ? "pl-still" : "pl-pop"} pointerEvents="none">
              <circle cx={cx} cy={cy} r="5" fill="none" stroke="var(--rm-c900)" strokeWidth="1.5" className="pl-ping" />
              <circle cx={cx} cy={cy} r="5" fill="var(--rm-c900)" stroke="var(--rm-white)" strokeWidth="1.6" />
              <text x={cx + (right ? 12 : -12)} y={cy} textAnchor={right ? "start" : "end"} fontSize="17" fontWeight="600" fill="var(--rm-c900)" style={halo}>
                {p.label}
              </text>
              <text x={cx + (right ? 12 : -12)} y={cy + 15} textAnchor={right ? "start" : "end"} fontSize="12" fill="var(--rm-c600)" style={halo}>
                {p.sub}
              </text>
            </g>
          );
        })}
      </svg>
      <p aria-live="polite" className="min-h-5 text-center text-[14px] text-[var(--rm-c900)]" style={{ margin: "6px 0 0" }}>
        {tip || " "}
      </p>
    </div>
  );
}

export function StartseitePage() {
  const openSearch = useOpenSearch();
  const phone = usePhone();
  const me = useMe();
  const [term, setTerm] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [zFehler, setZFehler] = useState(false);
  const [versuch, setVersuch] = useState(0);
  const [cov, setCov] = useState<Cov[] | null>(null);
  const [allTotal, setAllTotal] = useState<number | null>(null);
  const [raw, setData] = useState<Record<string, TopicData>>({});
  const [cent, setCent] = useState<Record<string, [number, number]>>({});
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
    /* Auftritte: je Begriff und Monat der erste Kreis, in zufällig wirkenden, aber gleichmäßigen Abständen über den Lauf gelegt */
    const picks: { topic: string; e: First }[] = [];
    for (const [topic, d] of Object.entries(out)) {
      const seen = new Set<string>();
      for (const e of [...d.firsts].sort((x, y) => (x.r ?? x.t) - (y.r ?? y.t))) {
        const m = new Date(e.r ?? e.t).toISOString().slice(0, 7);
        if (seen.has(m)) continue;
        seen.add(m);
        picks.push({ topic, e });
      }
    }
    picks.sort((x, y) => (x.e.r ?? x.e.t) - (y.e.r ?? y.e.t));
    const gaps = picks.map((x, i) => {
      let h = 0;
      for (const ch of x.topic + x.e.k + i) h = (h * 31 + ch.charCodeAt(0)) % 1000;
      return 0.55 + (h / 1000) * 0.9;
    });
    const sum = gaps.reduce((u, v) => u + v, 0);
    let acc = 0;
    picks.forEach((x, i) => {
      /* der erste Auftritt steht gleich am Anfang des Laufs, damit die Karte nie leer beginnt */
      x.e.t = lo + (hi - lo) * (acc / sum) * 0.96;
      acc += gaps[i];
      x.e.p = true;
    });
    for (const d of Object.values(out)) d.firsts.sort((a, b) => a.t - b.t);
    return out;
  }, [raw]);
  const [rTAnim, setRT] = useState(0);
  const [place, setPlace] = useState("");
  const today = todayLocal();

  /* Artikelzahl und Abdeckungsliste (für „Ist mein Ort dabei?“). Die drei undatierten Adressen stehen auch als Preload in
     app/(monitor)/page.tsx; bei Änderungen beide Stellen anpassen. */
  useEffect(() => {
    const ctl = new AbortController();
    /* Zahl der Einträge der letzten 30 Tage (nicht der Gesamtbestand) */
    const from = todayLocal(-30);
    /* Nur die Zähler (part=facets): dieselbe Zahl, ohne Trefferliste zu suchen */
    fetch(`/api/search?q=&area=&label=&month=&from=${from}&to=${today}&scope=with&status=&level=city&part=facets`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ total?: number }>) : Promise.reject(new Error("gesamt"))))
      .then((d) => { setTotal(typeof d.total === "number" ? d.total : null); setZFehler(false); })
      .catch(() => { if (!ctl.signal.aborted) setZFehler(true); });
    fetch("/api/search?part=facets", { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ total?: number }>) : Promise.reject(new Error("gesamt"))))
      .then((d) => setAllTotal(typeof d.total === "number" ? d.total : null))
      .catch(() => {});
    fetch("/api/search/coverage?level=city", { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ coverage?: Cov[] }>) : Promise.reject(new Error("coverage"))))
      .then((d) => setCov(Array.isArray(d.coverage) ? d.coverage : null))
      .catch(() => {});
    return () => ctl.abort();
  }, [today, versuch]);

  /* Animation und Trends aus echten Daten: welche Gemeinde einen Begriff wann zum ersten Mal beraten hat und wie viele Gebiete je
     Monat dazukamen. Täglich vorab gerechnet (scripts/startseite-trends.mjs, Job „startseite-trends“, /api/startseite-trends), weil die
     Auswertung je Begriff zu lange dauert; ohne Eintrag gilt public/data/startseite-trends.json. Die Karte selbst ist ganz eingefärbt. */
  useEffect(() => {
    const ctl = new AbortController();
    loadDistricts()
      .then((d) => {
        if (ctl.signal.aborted) return;
        const c: Record<string, [number, number]> = {};
        for (const r of d.regions) {
          const nums = (r.path.match(/-?\d+\.?\d*/g) ?? []).map(Number);
          const xs = nums.filter((_, i) => i % 2 === 0);
          const ys = nums.filter((_, i) => i % 2 === 1);
          if (xs.length) c[r.ags] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
        }
        setCent(c);
      })
      .catch(() => {});
    /* Täglich berechneter Stand (Job „startseite-trends“), sonst der mitgelieferte */
    const load = (url: string) => fetch(url, { signal: ctl.signal }).then((r) => (r.ok ? (r.json() as Promise<Snapshot>) : Promise.reject(new Error("trends"))));
    load("/api/startseite-trends")
      .catch(() => (ctl.signal.aborted ? Promise.reject(new Error("abort")) : load("/data/startseite-trends.json")))
      .then((d) => setData(Object.fromEntries(TOPICS.filter((t) => d.topics[t]?.f.length).map((t) => [t, toTopic(d.topics[t])]))))
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
  /* Reduzierte Bewegung: gleich der Endstand, ohne Ablauf */
  const rT = span && reduced() ? span.hi : rTAnim;
  useEffect(() => {
    if (!span) return;
    if (reduced()) return;
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

  /* Pops: je Begriff und Monat höchstens eines, vier gleichzeitig, jedes kurz sichtbar */
  const events = (() => {
    const out: { topic: string; k: string; name: string; t: number }[] = [];
    for (const [topic, d] of Object.entries(data)) for (const e of d.firsts) if (e.p) out.push({ topic, k: e.k, name: e.name, t: e.t });
    return out.sort((a, b) => a.t - b.t);
  })();
  const win = span ? ((span.hi - span.lo) * 6000) / 96000 : 0;
  const live: Pop[] = (() => {
    if (!span) return [];
    /* Älteres bleibt stehen, Neues wartet, wenn sich die beschrifteten Flächen auf der Karte überlappen würden (Schriftgrößen wie im CSS: Handy 34/26, sonst 17/12) */
    const fs1 = phone ? 34 : 17, fs2 = phone ? 26 : 12;
    const boxOf = (e: (typeof events)[number]) => {
      const c = cent[e.k];
      if (!c) return null;
      const w = Math.max(e.topic.length * fs1 * 0.6, short(e.name).length * fs2 * 0.55) + 24;
      const left = c[0] < 330 ? c[0] - 8 : c[0] - w + 8;
      return { x0: left, x1: left + w, y0: c[1] - fs1 - 4, y1: c[1] + fs2 + 12 };
    };
    const hit = (a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>) => !!a && !!b && a.x0 < b.x1 + 10 && b.x0 < a.x1 + 10 && a.y0 < b.y1 + 8 && b.y0 < a.y1 + 8;
    const ok: typeof events = [];
    for (const e of events.filter((x) => x.t <= rT && x.t > rT - win)) {
      const b = boxOf(e);
      const clash = b && ok.some((o) => hit(b, boxOf(o)));
      if (!clash) ok.push(e);
    }
    return ok.slice(phone ? -2 : -3).map((e) => ({ key: `${e.topic}-${e.k}`, k: e.k, label: e.topic, sub: short(e.name) }));
  })();
  /* Nie leer: Zwischen zwei Erscheinungen bleibt das zuletzt gezeigte stehen (am Anfang das erste) */
  const pops: Pop[] = (() => {
    if (live.length > 0 || events.length === 0) return live;
    const prev = [...events].reverse().find((e) => e.t <= rT) ?? events[0];
    return [{ still: true, key: `${prev.topic}-${prev.k}-still`, k: prev.k, label: prev.topic, sub: short(prev.name) }];
  })();

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


  const submit = (e: FormEvent) => {
    e.preventDefault();
    openSearch(term.trim() || undefined);
  };
  const q = place.trim().toLocaleLowerCase("de");
  const found = cov && q.length >= 3 ? cov.filter((c) => c.name.toLocaleLowerCase("de").includes(q)).slice(0, 5) : [];

  return (
    <>
      <section className="ri-sec pl-hero">
        <div className="pl-grid mx-auto grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-12">
          <div className="pl-left pt-10">
            <h1 className="pl-h1 text-[clamp(28px,8vw,44px)] font-[600] leading-[1.08] tracking-[-0.02em] text-[var(--rm-c900)]">
              Deutschlands Kommunalpolitik<br /> <span className="text-[var(--rm-ac)]">in Echtzeit.</span>
            </h1>
            <p className="pl-slogan text-[18px] leading-normal text-[var(--rm-c500)]">Besser verstehen, was vor Ort beraten wird.</p>
            <p className="pl-num flex flex-wrap items-baseline gap-x-[14px] gap-y-1">
              <span className="text-[44px] font-[600] leading-none tabular-nums text-[var(--rm-c900)]">{total !== null ? <CountUp value={total} /> : zFehler ? "–" : "…"}</span>
              <span className="text-[16px] text-[var(--rm-c500)]">Berichte aus Räten und Ausschüssen in den letzten 30 Tagen</span>
              {zFehler && total === null && <Ladefehler text="Die Zahl ist gerade nicht verfügbar." onRetry={() => { setZFehler(false); setVersuch((n) => n + 1); }} />}
            </p>
            <p className="pl-stand text-[14px] text-[var(--rm-c500)]" style={{ margin: "10px 0 0" }}>
              <span aria-hidden="true" className="pl-pulse mr-2 inline-block size-2 rounded-full bg-[var(--rm-fill)]" />
              Stand {day(today)}
            </p>
              <div className="pl-search mt-6 max-w-[460px] border-t border-[var(--rm-c200)]">
          <h2 className="pl-h2 text-[22px] font-[600] text-[var(--rm-c900)]">Thema suchen</h2>
          <form onSubmit={submit}>
            <label>
              <span className="sr-only">Suchbegriff</span>
              <input autoComplete="off"
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                maxLength={120}
                placeholder="Thema suchen, z. B. Windkraft"
                className="mt-3 h-12 w-full rounded-full border border-[var(--rm-c300)] bg-[var(--rm-white)] px-4 text-[16px] text-[var(--rm-c900)]"
              />
            </label>
          </form>
              </div>
            <TrendPops items={trends.filter((t) => pops.some((p) => p.label === t.topic))} onPick={(t) => openSearch(t)} />
            {cov && (
        <div className="pl-ort border-t border-[var(--rm-c200)]">
          <h2 className="pl-h2 text-[22px] font-[600] text-[var(--rm-c900)]">Ist mein Ort dabei?</h2>
          <label>
            <span className="sr-only">Ort</span>
            <input autoComplete="off"
              type="search"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              maxLength={60}
              placeholder="Ort: Stadt oder Gemeinde"
              className="mt-3 h-12 w-full rounded-full border border-[var(--rm-c300)] bg-[var(--rm-white)] px-4 text-[16px] text-[var(--rm-c900)]"
            />
          </label>
          <div aria-live="polite" className="mt-2 text-[14px] text-[var(--rm-c500)]">
            {q.length >= 3 && found.length === 0 ? "Dazu liegen noch keine Berichte vor." : null}
            {found.length > 0 && (
              <div role="listbox" aria-label="Orte" className="rounded-2xl border border-[var(--rm-c200)] bg-[var(--rm-white)] p-1.5 shadow-[0_8px_24px_rgba(24,24,27,.10)]">
                {found.map((c) => (
                  <button key={c.name} type="button" role="option" aria-selected="false" className="pl-opt grid min-h-10 w-full cursor-pointer grid-cols-[18px_minmax(0,1fr)] items-center gap-2 rounded-[10px] border-0 bg-transparent px-2 py-1.5 text-left" onClick={() => openSearch(short(c.name))} >
                    <IconPin size={16} className="text-slate-500" />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium text-[var(--rm-c900)]">{c.name}</span>
                      <span className="block text-[12px] text-[var(--rm-c500)]">{c.complete ? "vollständig abgerufen" : "teilweise abgerufen"}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
            <div className="pl-ctawrap mt-7">
              <Link href="/suche" className="ri-btn pl-cta">
                {me.user ? "Suche starten →" : "Ohne Anmeldung starten →"}
              </Link>
            </div>
            <p className="pl-source max-w-[460px] text-[14px] leading-normal text-[var(--rm-c500)]" style={{ margin: "14px 0 0" }}>
              {`Aus den öffentlichen Ratsinformationssystemen${cov ? ` von ${nf.format(cov.length)} Kommunen und Gebieten` : " der Kommunen"}${allTotal !== null ? `: insgesamt ${nf.format(allTotal)} Berichte aus Räten und Ausschüssen` : ""}.`}
            </p>
          </div>
          <div className="pl-mapwrap -mt-[50px] ml-14 w-[calc(100%-3.5rem)] max-w-[min(679px,max(362px,calc((100vh_-_230px)_/_1.149)))] justify-self-start">
            <GermanyMap pops={pops} onPick={(n) => openSearch(n)} />
          </div>
        </div>
      </section>


    </>
  );
}
