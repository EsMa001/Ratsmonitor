import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapEngine } from "../../lib/geo/mapEngine";
import { useData } from "../../state/data";
import { IconCenter, IconMinus, IconPlus } from "../../components/icons";

interface Reg { ags: string; name: string; first: string; last: string; n: number }
interface Result {
  q: string;
  regions: Reg[];
  series: { month: string; added: number; total: number }[];
  lands: { id: string; name: string; regions: number; first: string }[];
  stats: { regions: number; cards: number; first: string | null; last: string | null; p10: string | null; median: string | null; p90: string | null };
}

const EXAMPLES = ["Wärmeplanung", "Photovoltaik", "Windenergie", "Radverkehr", "Schulsozialarbeit"];
const DAY = 86400000;
const toDay = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / DAY);
const toIso = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);
const fmt = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : "–");
const months = (a: string, b: string) => Math.max(0, Math.round((toDay(b) - toDay(a)) / 30.44));

/** Stufe je Gebiet am gewählten Tag: 3 = neu (bis 3 Monate), 2 = bis 12 Monate, 1 = älter, 0 = noch nicht erreicht */
function levelAt(first: string, today: number) {
  const age = today - toDay(first);
  return age < 0 ? 0 : age <= 92 ? 3 : age <= 365 ? 2 : 1;
}

export function DiffusionPage() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("thema") ?? "";
  const { geo } = useData();
  const [input, setInput] = useState(q);
  const [res, setRes] = useState<Result | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const pickRef = useRef<(a: string) => void>(() => {});
  pickRef.current = (a) => setPicked((p) => (p === a ? "" : a));

  useEffect(() => setInput(q), [q]);

  /* Abfrage: bei jeder Änderung des Begriffs frisch aus der Datenbank */
  useEffect(() => {
    setPlaying(false);
    setPicked("");
    if (!q.trim()) { setRes(null); setState("idle"); return; }
    const ctrl = new AbortController();
    setState("loading");
    fetch(`/api/analytics/diffusion?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(body.error || "Die Analyse konnte nicht berechnet werden.");
        return body as unknown as Result;
      })
      .then((r) => { setRes(r); setState("idle"); setDay(r.stats.last ? toDay(r.stats.last) : 0); })
      .catch((e) => { if (ctrl.signal.aborted) return; setError(e.message); setState("error"); });
    return () => ctrl.abort();
  }, [q]);

  const first = res?.stats.first ? toDay(res.stats.first) : 0;
  const last = res?.stats.last ? toDay(res.stats.last) : 0;
  const byAgs = useMemo(() => new Map((res?.regions ?? []).map((r) => [r.ags, r])), [res]);

  /* Eigene Karte (eigene Engine, unabhängig von der Startseite) */
  const engine = useMemo(() => (geo ? new MapEngine(geo, { onSelect: (a) => pickRef.current(a), onHover: () => {}, onViewChange: () => {}, onWheelHint: () => {} }) : null), [geo]);
  useEffect(() => {
    if (!engine) return;
    const detach = engine.attach(stageRef.current!, baseRef.current!, overRef.current!);
    engine.setLocked(false);
    engine.setExplore(true, null);
    return detach;
  }, [engine]);
  const allAgs = useMemo(() => (geo ? [...geo.gem.idx.keys()] : []), [geo]);
  useEffect(() => {
    if (!engine) return;
    const levels: Record<string, number> = {};
    for (const a of allAgs) levels[a] = 0;
    if (res) for (const r of res.regions) levels[r.ags] = levelAt(r.first, day);
    engine.update(levels, picked, null, allAgs, "city");
  }, [engine, res, day, allAgs, picked]);

  /* Zeitraffer */
  useEffect(() => {
    if (!playing || !res) return;
    const step = Math.max(1, Math.round((last - first) / 150));
    const t = window.setInterval(() => setDay((d) => (d + step >= last ? (setPlaying(false), last) : d + step)), 60);
    return () => clearInterval(t);
  }, [playing, res, first, last]);

  const reached = res ? res.regions.filter((r) => toDay(r.first) <= day).length : 0;
  const share = res && res.stats.regions ? Math.round((reached / res.stats.regions) * 100) : 0;
  const sel = picked ? byAgs.get(picked) : undefined;

  const submit = (v: string) => {
    const t = v.trim();
    router.push(t ? `/analytics/diffusion?thema=${encodeURIComponent(t)}` : "/analytics/diffusion");
  };

  return (
    <main id="inhalt" className="mx-auto w-full max-w-[1100px] px-4 py-10 text-slate-900 sm:px-6">
      <p className="text-[14px] text-slate-500"><Link href="/analytics" className="text-teal-600">Plenara Analytics</Link> / Diffusionsanalyse</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Diffusionsanalyse</h1>
      <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Zeigt, wann ein Thema in welchem Gebiet zum ersten Mal in den Räten auftauchte, und wie es sich von dort ausbreitete.</p>

      <form onSubmit={(e) => { e.preventDefault(); submit(input); }} className="mt-6 flex flex-wrap items-center gap-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Thema, z. B. Wärmeplanung" aria-label="Thema" maxLength={200} className="h-12 min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-5 text-[16px] outline-none focus:border-teal-600" />
        <button type="submit" className="h-12 rounded-full bg-slate-900 px-6 text-[14px] font-medium text-white">Analysieren →</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
        {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => submit(x)} className="text-teal-600">{x}</button>)}
      </div>

      {state === "error" && <p role="alert" className="mt-6 text-[16px] text-slate-900">{error}</p>}

      <section className="relative mt-8 h-[440px] overflow-hidden border-y border-slate-200 sm:h-[560px]" aria-label="Karte der Ausbreitung">
        <div ref={stageRef} className="absolute inset-0 touch-none select-none overflow-hidden bg-map-ground">
          <canvas ref={baseRef} aria-hidden="true" className="absolute left-0 top-0 block h-full w-full" />
          <canvas ref={overRef} role="img" aria-label={res ? `Karte: ${reached} von ${res.stats.regions} Gebieten erreicht` : "Karte von Deutschland"} className="absolute left-0 top-0 block h-full w-full" />
          {!geo && <div className="absolute inset-0 grid place-items-center text-[14px] text-slate-500">Karte wird aufgebaut …</div>}
        </div>
        <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-full border border-slate-200 bg-white">
          <button type="button" title="Vergrößern" aria-label="Vergrößern" onClick={() => engine?.zoomBy(1.6)} className="grid h-10 w-10 place-items-center"><IconPlus size={16} /></button>
          <button type="button" title="Verkleinern" aria-label="Verkleinern" onClick={() => engine?.zoomBy(1 / 1.6)} className="grid h-10 w-10 place-items-center"><IconMinus size={16} /></button>
          <button type="button" title="Ganz Deutschland" aria-label="Ganz Deutschland" onClick={() => engine?.focusArea("")} className="grid h-10 w-10 place-items-center"><IconCenter size={16} /></button>
        </div>
        {state === "loading" && <div className="absolute inset-x-0 top-3 text-center text-[14px] text-slate-500">Analyse wird berechnet …</div>}
        {state === "idle" && !res && !q && <div className="pointer-events-none absolute inset-x-0 top-3 text-center text-[14px] text-slate-500">Thema eingeben, um die Ausbreitung zu sehen.</div>}
        {res && res.stats.regions === 0 && <div className="pointer-events-none absolute inset-x-0 top-3 text-center text-[14px] text-slate-900">Zu „{res.q}“ gibt es keine Treffer.</div>}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-x-3 gap-y-1 bg-white/90 px-3 py-2 sm:right-auto text-[12px] text-slate-500">
          {[["#0f766e", "neu (bis 3 Monate)"], ["#6ebfb8", "bis 1 Jahr"], ["#b3dfda", "länger her"], ["#d7dce3", "noch nicht"]].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5 whitespace-nowrap"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />{l}</span>
          ))}
        </div>
      </section>

      {res && res.stats.regions > 0 && (
        <>
          <div className="mt-5 flex items-center gap-4">
            <button type="button" onClick={() => { if (day >= last) setDay(first); setPlaying((p) => !p); }} className="h-10 shrink-0 rounded-full bg-slate-900 px-5 text-[14px] font-medium text-white">{playing ? "Pause" : "Zeitraffer →"}</button>
            <input type="range" min={first} max={last} value={day} onChange={(e) => { setPlaying(false); setDay(Number(e.target.value)); }} aria-label="Datum" className="min-w-0 flex-1 accent-teal-600" />
            <span className="w-[72px] shrink-0 text-right text-[16px] font-medium tabular-nums">{fmt(toIso(day))}</span>
          </div>
          <p className="mt-2 text-[16px]"><b className="font-semibold">{reached.toLocaleString("de-DE")}</b> von {res.stats.regions.toLocaleString("de-DE")} Gebieten erreicht ({share} %)</p>
          {sel && <p className="mt-1 text-[14px] text-slate-500">{sel.name}: erste Erwähnung {fmt(sel.first)}, zuletzt {fmt(sel.last)}, {sel.n.toLocaleString("de-DE")} {sel.n === 1 ? "Eintrag" : "Einträge"}</p>}

          <Curve res={res} day={day} onPick={(d) => { setPlaying(false); setDay(d); }} />

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-200 pt-6 sm:grid-cols-4">
            {[
              ["Erste Erwähnung", fmt(res.stats.first)],
              ["Hälfte erreicht", fmt(res.stats.median)],
              ["Von 10 % bis 90 %", res.stats.p10 && res.stats.p90 ? `${months(res.stats.p10, res.stats.p90)} Monate` : "–"],
              ["Einträge insgesamt", res.stats.cards.toLocaleString("de-DE")],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
            ))}
          </dl>

          <div className="mt-10 grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-[18px] font-semibold">Vorreiter</h2>
              <ol className="mt-2 divide-y divide-slate-200 border-y border-slate-200">
                {res.regions.slice(0, 10).map((r) => (
                  <li key={r.ags}><button type="button" onClick={() => { setPicked(r.ags); engine?.focusArea(r.ags); }} className="flex w-full justify-between gap-3 py-2 text-left text-[14px]"><span>{r.name}</span><span className="tabular-nums text-slate-500">{fmt(r.first)}</span></button></li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className="text-[18px] font-semibold">Bundesländer</h2>
              <ol className="mt-2 divide-y divide-slate-200 border-y border-slate-200">
                {res.lands.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 py-2 text-[14px]"><span>{l.name}</span><span className="tabular-nums text-slate-500">{l.regions.toLocaleString("de-DE")} Gebiete · ab {fmt(l.first)}</span></li>
                ))}
              </ol>
            </div>
          </div>
          <p className="mt-8 text-[12px] text-slate-500">Als erste Erwähnung gilt das Datum des frühesten Eintrags im Datenbestand, der den Begriff enthält. Gebiete ohne vollständigen Datenbestand können später erscheinen, als das Thema dort tatsächlich aufkam. Samtgemeinden zählen für alle ihre Mitgliedsgemeinden.</p>
        </>
      )}
    </main>
  );
}

/** Kurve der erreichten Gebiete über die Zeit; Klick setzt den Zeitraffer auf das Datum */
function Curve({ res, day, onPick }: { res: Result; day: number; onPick: (d: number) => void }) {
  const W = 1000, H = 160, P = 4;
  const s = res.series;
  if (s.length < 2) return null;
  const t0 = toDay(s[0].month + "-01"), t1 = toDay(res.stats.last!);
  const x = (d: number) => P + ((d - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / res.stats.regions) * (H - 2 * P);
  const pts = s.map((m) => [x(toDay(m.month + "-01")), y(m.total)] as const);
  const path = "M" + pts.map(([a, b], i) => (i ? `L${a},${pts[i - 1][1]} L${a},${b}` : `${a},${b}`)).join(" ") + ` L${W - P},${pts.at(-1)![1]}`;
  return (
    <div className="mt-6">
      <h2 className="text-[18px] font-semibold">Erreichte Gebiete im Zeitverlauf</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-[160px] w-full cursor-pointer" role="img" aria-label="Kurve der erreichten Gebiete" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onPick(Math.round(t0 + ((e.clientX - r.left) / r.width) * (t1 - t0))); }} preserveAspectRatio="none">
        <path d={path} fill="none" stroke="#0d9488" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <line x1={x(Math.min(t1, Math.max(t0, day)))} x2={x(Math.min(t1, Math.max(t0, day)))} y1="0" y2={H} stroke="#0f172a" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[12px] text-slate-500"><span>{fmt(toIso(t0))}</span><span>{fmt(toIso(t1))}</span></div>
    </div>
  );
}
