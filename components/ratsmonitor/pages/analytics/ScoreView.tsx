import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Reveal } from "./Reveal";
import { RegionMap } from "./RegionMap";
import { Laden } from "./Laden";
import { errorText, fetchJson } from "../../lib/fetchJson";

/* plenara.X Score im Atlas (server/integrations/analytics-score.mjs): je Gemeinde oder Kreis eine Zahl von 0 bis 100 aus der
   Befassung mit den Atlas-Themen (Rang in der Vergleichsgruppe) und der Arbeitsweise (Vertagungen), 50 = wie üblich.
   Karte in vier Stufen nach dem Rang des Scores; Klick oder Suche zeigt, woraus der Wert besteht. */
interface Work { p: number; share: number; median: number; n: number }
interface Item { id: string; name: string; ags: string[]; score: number | null; band: number; themes: Record<string, number | null>; themeScore: number | null; work: Work | null; oparl: boolean; n: number; reason: string }
interface Data { window: { from: string; to: string }; level: "city" | "district"; counts: number[]; bands: ([number, number] | null)[]; items: Item[]; themes: { id: string; name: string; used: boolean }[];
  rule: { minItems: number; minMonths: number; minGroup: number; themeWeight: number; workWeight: number; oparlBonus: number; minThemes: number; minDecided: number } }

const n = (v: number) => v.toLocaleString("de-DE");
const datum = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
const QUARTER = ["Unteres Viertel", "Zweites Viertel", "Drittes Viertel", "Oberes Viertel"];
const REASON: Record<string, string> = {
  daten: "zu wenig Unterlagen für einen Vergleich",
  themen: "zu wenige Themen mit genug Vorgängen",
  gruppe: "zu wenige vergleichbare Gebiete",
};

/** Balken 0–100 mit Markierung bei 50 (üblich) */
function Bar({ value }: { value: number }) {
  return (
    <span className="relative block h-[8px] rounded-full bg-slate-100" aria-hidden="true">
      <span className="absolute inset-y-0 left-0 rounded-full bg-teal-600" style={{ width: `${Math.max(2, value)}%` }} />
      <span className="absolute -top-[3px] h-[14px] w-px bg-slate-400" style={{ left: "50%" }} />
    </span>
  );
}

/** onTheme: Thema im Atlas öffnen (nur Themen, die der Atlas führt) */
export function ScoreView({ onTheme, atlasThemes }: { onTheme: (id: string) => void; atlasThemes: readonly string[] }) {
  const [level, setLevel] = useState<"city" | "district">("city");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState("");
  const [find, setFind] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    setError("");
    setData(null);
    fetchJson<Data>(`/api/analytics/score?level=${level}`, { signal: ctrl.signal }, "Der Score konnte nicht berechnet werden.")
      .then(setData)
      .catch((e) => { if (!ctrl.signal.aborted) setError(errorText(e, "Der Score konnte nicht berechnet werden.")); });
    return () => ctrl.abort();
  }, [level]);

  const byAgs = useMemo(() => { const m = new Map<string, Item>(); for (const i of data?.items ?? []) for (const a of i.ags) m.set(a, i); return m; }, [data]);
  const levels = useMemo(() => { const v: Record<string, number> = {}; for (const i of data?.items ?? []) if (i.band) for (const a of i.ags) v[a] = i.band; return v; }, [data]);
  const names = useMemo(() => (data?.items ?? []).map((i) => i.name).sort((a, b) => a.localeCompare(b, "de")), [data]);
  const sel = picked ? byAgs.get(picked) : undefined;
  const scored = data ? data.counts.slice(1).reduce((a, b) => a + b, 0) : 0;
  const unit = level === "district" ? ["Kreis", "Kreise", "Kreisen"] : ["Gemeinde", "Gemeinden", "Gemeinden"];
  const chip = (on: boolean) => `h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-[14px] transition-colors ${on ? "border-teal-600 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`;
  const legend = data ? data.bands.map((b, i) => (b ? `${QUARTER[i]}: ${b[0] === b[1] ? b[0] : `${b[0]} bis ${b[1]}`}` : QUARTER[i])) : QUARTER;
  const pickName = (name: string) => { setFind(name); const i = data?.items.find((x) => x.name === name); if (i) setPicked(i.ags[0]); };

  return (
    <section aria-label="plenara.X Score">
      <p className="mb-4 mt-6 max-w-[680px] text-[16px] text-slate-500">Wie häufig die Themen des Atlas in den Ratsunterlagen vorkommen und wie die Beratung läuft, verglichen mit ähnlichen Kommunen. 50 heißt: wie üblich.</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2" role="group" aria-label="Ebene">
          {([["city", "Gemeinden"], ["district", "Kreise"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => { setLevel(k); setPicked(""); setFind(""); }} className={chip(level === k)}>{l}</button>)}
        </div>
        <label className="flex min-w-0 flex-1 basis-[240px] items-center gap-2 sm:max-w-[360px]">
          <span className="sr-only">Ort suchen</span>
          <input list="score-orte" value={find} onChange={(e) => pickName(e.target.value)} placeholder={`${unit[0]} suchen`}
            className="h-9 w-full rounded-full border border-slate-300 bg-white px-4 text-[14px] text-slate-900 placeholder:text-slate-500 focus:border-teal-600 focus:outline-none" />
          <datalist id="score-orte">{names.map((x) => <option key={x} value={x} />)}</datalist>
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-[14px]">{error}</p>}
      {!data && !error && <Laden text="Score wird berechnet …" />}
      <div className="mt-4">
        <RegionMap level={level} levels={levels} picked={picked} onPick={(a) => setPicked(picked === a ? "" : a)} legend={legend}
          note="ohne Farbe: zu wenig Daten für einen Score" label={`Karte plenara.X Score, ${unit[1]}`}
          info={sel ? <>
            <b className="font-semibold">{sel.name}</b><br />
            <span className="text-slate-500">{sel.score !== null ? `Score ${sel.score} · ${QUARTER[sel.band - 1]}` : REASON[sel.reason] ?? "kein Score"}</span>
          </> : picked ? <span className="text-slate-500">Für dieses Gebiet liegen keine Unterlagen vor.</span> : undefined} />
      </div>
      {data && <p className="mt-2 text-[12px] text-slate-500">{`${n(scored)} ${unit[1]} mit Score, ${n(data.counts[0])} ohne genug Daten. Zeitraum ${datum(data.window.from)} bis ${datum(data.window.to)}.`}</p>}

      {sel && data && (
        <Reveal><section className="mt-8 max-w-[760px]" aria-label={`Score von ${sel.name}`}>
          <h3 className="text-[18px] font-semibold">{sel.name}</h3>
          {sel.score === null ? <p className="mt-1 text-[14px] text-slate-500">Kein Score: {REASON[sel.reason] ?? "zu wenig Daten"} ({n(sel.n)} Sachvorgänge im Zeitraum).</p> : <>
            <p className="mt-1 text-[14px] text-slate-500">{`Score ${sel.score} aus ${Object.values(sel.themes).filter((v) => v !== null).length} von ${data.themes.filter((t) => t.used).length} Themen${sel.work ? " und der Arbeitsweise" : ", ohne Arbeitsweise (zu wenige Vorgänge mit bekanntem Ausgang)"}${sel.oparl ? `, mit ${data.rule.oparlBonus} Punkten für die OParl-Schnittstelle` : ""}. ${n(sel.n)} Sachvorgänge im Zeitraum.`}</p>
            <p className="mt-4 text-[44px] font-semibold leading-none tabular-nums">{sel.score}</p>
          </>}
          <ol className="m-0 mt-6 list-none border-t border-slate-200 p-0">
            {data.themes.map((t) => {
              const v = sel.themes[t.id];
              const inAtlas = atlasThemes.includes(t.id);
              return (
                <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-x-4 gap-y-1.5 border-b border-slate-200 py-2.5 sm:grid-cols-[220px_minmax(0,1fr)_48px]">
                  <span className="truncate text-[14px]">{inAtlas ? <button type="button" onClick={() => onTheme(t.id)} className="text-left text-teal-700 hover:underline">{t.name}</button> : t.id === "foerderung" ? <Link href="/analytics/foerderung" className="text-teal-700 hover:underline">{t.name}</Link> : t.name}</span>
                  <span className="order-3 col-span-2 sm:order-none sm:col-span-1">{v !== null ? <Bar value={v} /> : <span className="text-[12px] text-slate-500">{t.used ? "zu wenige Vorgänge für einen Vergleich" : "bundesweit zu selten erkannt, zählt nicht"}</span>}</span>
                  <span className="text-right text-[14px] font-semibold tabular-nums">{v ?? "–"}</span>
                </li>
              );
            })}
            <li className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-x-4 gap-y-1.5 border-b border-slate-200 py-2.5 sm:grid-cols-[220px_minmax(0,1fr)_48px]">
              <span className="truncate text-[14px]"><Link href="/analytics/beschluesse" className="text-teal-700 hover:underline">Arbeitsweise</Link></span>
              <span className="order-3 col-span-2 sm:order-none sm:col-span-1">{sel.work ? <><Bar value={sel.work.p} /><span className="mt-1 block text-[12px] text-slate-500">{`${n(sel.work.share)} % vertagt (üblich ${n(sel.work.median)} %), aus ${n(sel.work.n)} Vorgängen mit Entscheidung`}</span></> : <span className="text-[12px] text-slate-500">zu wenige Vorgänge mit bekanntem Ausgang</span>}</span>
              <span className="text-right text-[14px] font-semibold tabular-nums">{sel.work?.p ?? "–"}</span>
            </li>
          </ol>
        </section></Reveal>
      )}

      {data && (
        <Reveal><section className="mt-12 max-w-[860px]">
          <h3 className="text-[18px] font-semibold">So entsteht der Score</h3>
          <ol className="m-0 mt-3 list-decimal space-y-2 pl-5 text-[14px] text-slate-700">
            <li>Je Thema: Anteil der Vorgänge zum Thema an allen Sachvorgängen des eigenen Rats in den letzten 12 Monaten (ohne Formalien, gleiche Titel einmal). {level === "district" ? "Bei Kreisen zählen Kreistag und Ausschüsse." : "Bei Gemeinden zählt nur der eigene Rat."}</li>
            <li>Dieser Anteil wird in der Vergleichsgruppe eingeordnet (gleiche Art und Größe, zuerst im selben Land, mindestens {n(data.rule.minGroup)} Gebiete): 0 = seltener als alle anderen, 50 = wie üblich, 100 = häufiger als alle anderen.</li>
            <li>Arbeitsweise: Anteil vertagter Vorgänge an allen mit Entscheidung (beschlossen, abgelehnt, vertagt), ebenso eingeordnet; weniger Vertagungen ergeben einen höheren Wert. Erst ab {n(data.rule.minDecided)} Vorgängen mit Entscheidung.</li>
            <li>{`Score = ${Math.round(data.rule.themeWeight * 100)} % Mittel der Themen + ${Math.round(data.rule.workWeight * 100)} % Arbeitsweise (fehlt sie, nur die Themen), als ganze Zahl. Wird das Gebiet über eine OParl-Schnittstelle gelesen, kommen ${data.rule.oparlBonus} Punkte hinzu, höchstens 100.`}</li>
            <li>{`Kein Score bei unter ${n(data.rule.minItems)} Sachvorgängen oder unter ${data.rule.minMonths} Monaten mit Sitzungen, oder wenn weniger als ${data.rule.minThemes} Themen genug Vorgänge für einen Vergleich haben.`}</li>
            <li>Die Farben der Karte teilen alle {unit[1]} mit Score in vier gleich große Gruppen.</li>
          </ol>
          <p className="mt-4 text-[12px] text-slate-500">Der Score beruht nur auf den veröffentlichten Ratsunterlagen. Er misst Befassung und Ablauf, nicht die Qualität von Entscheidungen. Aufgaben, die beim Kreis liegen, erscheinen im Gemeinderat seltener.</p>
        </section></Reveal>
      )}
    </section>
  );
}
