import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapEngine } from "../../lib/geo/mapEngine";
import { useData } from "../../state/data";
import { IconCenter, IconMinus, IconPlus } from "../../components/icons";
import { DiffusionChart } from "./DiffusionChart";
import { DiffusionSearch, type PlayState } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";

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
const glass = "rm-glass";
/** Legende und Stufen: je länger die erste Erwähnung her ist, desto dunkler */
const LEGEND = [["#b3dfda", "bis 1 Monat"], ["#8ccdc7", "bis 3 Monate"], ["#6ebfb8", "bis 6 Monate"], ["#0f766e", "länger"]];

/** Stufe je Gebiet am gewählten Tag: 0 = noch nicht erreicht, 1 (hell) bis 4 (dunkel) nach Alter der ersten Erwähnung */
function levelAt(first: string, today: number) {
  const age = today - toDay(first);
  return age < 0 ? 0 : age <= 31 ? 1 : age <= 92 ? 2 : age <= 183 ? 3 : 4;
}

export function DiffusionPage() {
  const params = useSearchParams();
  const { geo } = useData();
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [want, setWant] = useState(false);
  const [error, setError] = useState("");
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const pickRef = useRef<(a: string) => void>(() => {});
  pickRef.current = (a) => setPicked((p) => (p === a ? "" : a));

  const { query, hasTerm, search } = useAnalyticsQuery();

  /* Beispiel- oder Direktlink (?thema=): Begriff in die Suche setzen und sofort starten */
  const given = useRef(params.get("thema"));
  useEffect(() => {
    if (!given.current) return;
    search.applySearch(given.current);
    given.current = null;
    setWant(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    /* wartet, bis der Begriff (z. B. aus einem Beispiel) in der Suche angekommen ist */
    if (!want || !hasTerm) return;
    setWant(false);
    setError("");
    setLoading(true);
    setPlaying(false);
    setPicked("");
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    fetch(`/api/analytics/diffusion?${query}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(body.error || "Die Analyse konnte nicht berechnet werden.");
        return body as unknown as Result;
      })
      .then((r) => {
        setRes(r);
        setRanKey(query);
        setLoading(false);
        if (r.stats.first) { setDay(toDay(r.stats.first)); setPlaying(true); }
      })
      .catch((e) => { if (ctrl.signal.aborted) return; setError(e.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, hasTerm]);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const firstDay = res?.stats.first ? toDay(res.stats.first) : 0;
  const lastDay = res?.stats.last ? toDay(res.stats.last) : 0;
  const byAgs = useMemo(() => new Map((res?.regions ?? []).map((r) => [r.ags, r])), [res]);
  const firsts = useMemo(() => (res?.regions ?? []).map((r) => toDay(r.first)).sort((a, b) => a - b), [res]);

  /* Eigene Karte (eigene Engine, unabhängig von der Startseite) */
  const engine = useMemo(() => (geo ? new MapEngine(geo, { onSelect: (a) => pickRef.current(a), onHover: () => {}, onViewChange: () => {}, onWheelHint: () => {} }) : null), [geo]);
  useEffect(() => {
    if (!engine) return;
    const detach = engine.attach(stageRef.current!, baseRef.current!, overRef.current!);
    engine.setLocked(false);
    engine.setExplore(true, null);
    engine.bottomInset = 76;
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
  useEffect(() => {
    if (engine && res) res.regions.length ? engine.focusMany(res.regions.map((r) => r.ags)) : engine.focusArea("");
  }, [engine, res]);

  /* Zeitraffer */
  useEffect(() => {
    if (!playing || !res) return;
    const step = Math.max(1, Math.round((lastDay - firstDay) / 150));
    const t = window.setInterval(() => setDay((d) => (d + step >= lastDay ? (setPlaying(false), lastDay) : d + step)), 60);
    return () => clearInterval(t);
  }, [playing, res, firstDay, lastDay]);

  const stale = !!res && ranKey !== query;
  const onPlay = () => {
    if (loading) return;
    if (!hasTerm) return setError("Bitte zuerst ein Thema in die Suche eingeben.");
    if (!res || stale) return setWant(true);
    if (day >= lastDay) setDay(firstDay);
    setPlaying((p) => !p);
  };
  const play: PlayState = loading ? "loading" : playing ? "playing" : res && !stale ? "paused" : "idle";

  const reached = res ? res.regions.filter((r) => toDay(r.first) <= day).length : 0;
  const share = res && res.stats.regions ? Math.round((reached / res.stats.regions) * 100) : 0;
  const sel = picked ? byAgs.get(picked) : undefined;
  const maxLand = Math.max(1, ...(res?.lands.map((l) => l.regions) ?? [1]));

  return (
    <main id="inhalt" className="mx-auto w-full max-w-[1100px] px-4 py-10 text-slate-900 sm:px-6">
      <p className="text-[14px] text-slate-500"><Link href="/analytics/ueber" className="text-teal-600">Plenara Analytics</Link> / Diffusionsanalyse</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Diffusionsanalyse</h1>
      <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Zeigt, wann ein Thema in welchem Gebiet zum ersten Mal in den Räten auftauchte, und wie es sich von dort ausbreitete.</p>

      <div className="mt-6"><DiffusionSearch play={play} onPlay={onPlay} onSubmit={() => setWant(true)} /></div>
      {!res && !loading && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
          <span className="text-slate-500">Beispiele:</span>
          {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => { search.applySearch(x); setWant(true); }} className="text-teal-600">{x}</button>)}
        </div>
      )}
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && !loading && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu analysieren.</p>}

      <section className="relative mt-6 h-[480px] overflow-hidden rounded-[22px] border border-slate-200 sm:h-[600px]" aria-label="Karte der Ausbreitung">
        <div ref={stageRef} className="absolute inset-0 touch-none select-none overflow-hidden bg-map-ground">
          <canvas ref={baseRef} aria-hidden="true" className="absolute left-0 top-0 block h-full w-full" />
          <canvas ref={overRef} role="img" aria-label={res ? `Karte: ${reached} von ${res.stats.regions} Gebieten erreicht` : "Karte von Deutschland"} className="absolute left-0 top-0 block h-full w-full" />
          {!geo && <div className="absolute inset-0 grid place-items-center text-[14px] text-slate-500">Karte wird aufgebaut …</div>}
        </div>

        {/* Legende oben links */}
        <div className={`${glass} absolute left-3 top-3 z-[6] rounded-2xl px-3 py-2 text-[12px] text-slate-700`}>
          <p className="mb-1 font-medium text-slate-900">Erste Erwähnung vor</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {LEGEND.map(([c, l]) => <li key={l} className="flex items-center gap-2"><i className="inline-block h-3 w-5 rounded-sm" style={{ background: c }} />{l}</li>)}
            <li className="flex items-center gap-2"><i className="inline-block h-3 w-5 rounded-sm" style={{ background: "#d7dce3" }} />noch nicht</li>
          </ul>
        </div>

        {/* Zoom oben rechts */}
        <div className={`${glass} absolute right-3 top-3 z-[6] flex flex-col overflow-hidden rounded-full`}>
          <button type="button" title="Vergrößern" aria-label="Vergrößern" onClick={() => engine?.zoomBy(1.6)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-600"><IconPlus size={16} /></button>
          <button type="button" title="Verkleinern" aria-label="Verkleinern" onClick={() => engine?.zoomBy(1 / 1.6)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-600"><IconMinus size={16} /></button>
          <button type="button" title="Auf Ergebnis zentrieren" aria-label="Auf Ergebnis zentrieren" onClick={() => (res?.regions.length ? engine?.focusMany(res.regions.map((r) => r.ags)) : engine?.focusArea(""))} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-600"><IconCenter size={16} /></button>
        </div>

        {/* Hinweise und Auswahl oben in der Mitte */}
        <div className="pointer-events-none absolute inset-x-16 top-3 z-[6] flex justify-center max-sm:inset-x-3 max-sm:top-auto max-sm:bottom-[88px]">
          {loading ? <span className={`${glass} rounded-full px-4 py-2 text-[14px] text-slate-700`}>Analyse wird berechnet …</span>
            : res && res.stats.regions === 0 ? <span className={`${glass} rounded-full px-4 py-2 text-[14px] text-slate-900`}>Keine Treffer für diese Suche.</span>
            : sel ? <span className={`${glass} rounded-2xl px-4 py-2 text-center text-[14px] text-slate-900`}><b className="font-semibold">{sel.name}</b><br /><span className="text-slate-500">erste Erwähnung {fmt(sel.first)} · {sel.n.toLocaleString("de-DE")} {sel.n === 1 ? "Eintrag" : "Einträge"}</span></span>
            : !res ? <span className={`${glass} rounded-full px-4 py-2 text-[14px] text-slate-700`}>Thema suchen und auf Start drücken</span> : null}
        </div>

        {/* Zeitregler unten */}
        {res && res.stats.regions > 0 && (
          <div className={`${glass} absolute inset-x-3 bottom-3 z-[6] flex items-center gap-3 rounded-full px-5 py-3 sm:inset-x-6`}>
            <span className="w-[64px] shrink-0 text-[16px] font-medium tabular-nums">{fmt(toIso(day))}</span>
            <input type="range" min={firstDay} max={lastDay} value={day} onChange={(e) => { setPlaying(false); setDay(Number(e.target.value)); }} aria-label="Datum" className="min-w-0 flex-1 accent-teal-600" />
            <span className="shrink-0 text-right text-[14px] tabular-nums text-slate-700"><b className="font-semibold">{reached.toLocaleString("de-DE")}</b><span className="max-sm:hidden"> / {res.stats.regions.toLocaleString("de-DE")}</span> · {share} %</span>
          </div>
        )}
      </section>

      {res && res.stats.regions > 0 && (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
            {[
              ["Erste Erwähnung", fmt(res.stats.first)],
              ["Hälfte erreicht", fmt(res.stats.median)],
              ["Von 10 % auf 90 %", res.stats.p10 && res.stats.p90 ? `${months(res.stats.p10, res.stats.p90)} Monate` : "–"],
              ["Einträge insgesamt", res.stats.cards.toLocaleString("de-DE")],
            ].map(([k, v], i) => (
              <div key={k} className={`px-4 ${i % 2 ? "border-l border-slate-200" : ""} ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{v}</dd></div>
            ))}
          </dl>

          <section className="mt-10">
            <h2 className="text-[22px] font-semibold">Ausbreitung im Zeitverlauf</h2>
            <p className="mb-4 mt-1 text-[14px] text-slate-500">Anteil der Gebiete, in denen das Thema bis zum jeweiligen Tag schon vorkam. Ein Klick in das Diagramm setzt die Karte auf dieses Datum.</p>
            <DiffusionChart firsts={firsts} series={res.series} day={day} onPick={(d) => { setPlaying(false); setDay(Math.min(lastDay, Math.max(firstDay, d))); }} />
          </section>

          <div className="mt-12 grid gap-12 md:grid-cols-2">
            <section>
              <h2 className="text-[22px] font-semibold">Vorreiter</h2>
              <p className="mb-3 mt-1 text-[14px] text-slate-500">Die zehn Gebiete mit der frühesten Erwähnung. Ein Klick zeigt sie auf der Karte.</p>
              <ol className="m-0 list-none border-t border-slate-200 p-0">
                {res.regions.slice(0, 10).map((r, i) => (
                  <li key={r.ags} className="border-b border-slate-200">
                    <button type="button" onClick={() => { setPicked(r.ags); engine?.focusArea(r.ags); window.scrollTo({ top: (document.querySelector('section[aria-label="Karte der Ausbreitung"]') as HTMLElement).offsetTop - 80, behavior: "smooth" }); }} className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 py-3 text-left hover:bg-slate-50">
                      <span className="text-[14px] tabular-nums text-slate-500">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[16px] text-slate-900">{r.name.split(" (")[0]}</span>
                        <span className="block truncate text-[12px] text-slate-500">{r.name.includes(" (") ? r.name.slice(r.name.indexOf("(") + 1, -1) + " · " : ""}{r.n.toLocaleString("de-DE")} {r.n === 1 ? "Eintrag" : "Einträge"}</span>
                      </span>
                      <span className="text-[14px] tabular-nums text-slate-500">{fmt(r.first)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <h2 className="text-[22px] font-semibold">Bundesländer</h2>
              <p className="mb-3 mt-1 text-[14px] text-slate-500">Erreichte Gebiete je Land und Datum der ersten Erwähnung.</p>
              <ol className="m-0 list-none border-t border-slate-200 p-0">
                {res.lands.map((l) => (
                  <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-200 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] text-slate-900">{l.name}</span>
                      <span className="mt-1.5 block h-[3px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${Math.max(3, (l.regions / maxLand) * 100)}%` }} /></span>
                    </span>
                    <span className="text-right text-[14px] tabular-nums text-slate-500"><b className="font-semibold text-slate-900">{l.regions.toLocaleString("de-DE")}</b> Gebiete<br />ab {fmt(l.first)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <p className="mt-10 text-[12px] text-slate-500">Als erste Erwähnung gilt das Datum des frühesten Eintrags im Datenbestand, der zur Suche passt. Gebiete mit unvollständigem Datenbestand können später erscheinen, als das Thema dort tatsächlich aufkam. Der Bestand reicht rund ein Jahr zurück: Ein Datum zu Beginn dieses Zeitraums heißt „schon zu Beginn des Bestands“, nicht „zuerst überhaupt“. Samtgemeinden zählen für alle ihre Mitgliedsgemeinden. <Link href="/analytics/ueber" className="text-teal-600">Methode →</Link></p>
        </>
      )}
    </main>
  );
}
