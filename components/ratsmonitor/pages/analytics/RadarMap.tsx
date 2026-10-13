import { useEffect, useMemo, useState } from "react";
import { Reveal } from "./Reveal";
import { RegionMap } from "./RegionMap";
import { errorText, fetchJson } from "../../lib/fetchJson";

/* Karte eines Themenradars (server/integrations/analytics-radar-norms.mjs, radarMap): jedes Gebiet eingeordnet in seiner
   Vergleichsgruppe nach dem Anteil des Radars, eines Unterthemas oder des Suchbegriffs an allen Sachvorgängen der letzten
   12 Monate. Klick auf ein Gebiet zeigt seine Werte; „Ort auswerten“ setzt den Ortsfilter der Seite. */
interface MapItem { id: string; name: string; ags: string[]; level: number; k: number; n: number; share: number; median: number | null; p: number | null; reason: string }
interface MapData { window: { from: string; to: string }; level: "city" | "district"; topic: string; term: string; mode: "vergleich" | "anzahl"; counts: number[]; items: MapItem[]; rule: { minItems: number; minMonths: number; minTopic: number } }

const n = (v: number) => v.toLocaleString("de-DE");
const p = (v: number) => `${v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
const datum = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("de-DE");
const QUARTER = ["unteres Viertel", "zweites Viertel", "drittes Viertel", "oberes Viertel"];
const REASON: Record<string, string> = { daten: "zu wenig Unterlagen für einen Vergleich", gruppe: "zu wenige vergleichbare Gebiete", wenig: "zu wenige Vorgänge zu erwarten" };

/** radar: Themenradar; base: andere Auswertung mit Kartenmodus (map=1), etwa der Kita-Radar; topicLabel: Bezeichnung der Auswahl */
export function RadarMap({ radar, base, topics, q, exact, place, onPlace, topicLabel = "Thema", allLabel = "Alle Themen", what: whatAll = "der Vorgänge dieses Radars" }: {
  radar?: string; base?: string; topics: string[]; q: string; exact: boolean; place: string; onPlace: (ags: string) => void; topicLabel?: string; allLabel?: string; what?: string;
}) {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<"city" | "district">("city");
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    setError("");
    const qs = new URLSearchParams({ ...(radar ? { radar } : {}), map: "1", level, ...(topic ? { topic } : {}), ...(q ? { q } : {}), ...(exact ? { exact: "1" } : {}) });
    fetchJson<MapData>(`${base ?? "/api/analytics/themenradar"}?${qs}`, { signal: ctrl.signal }, "Die Karte konnte nicht berechnet werden.")
      .then(setData)
      .catch((e) => { if (!ctrl.signal.aborted) setError(errorText(e, "Die Karte konnte nicht berechnet werden.")); });
    return () => ctrl.abort();
  }, [radar, base, topic, level, q, exact]);

  const byAgs = useMemo(() => { const m = new Map<string, MapItem>(); for (const i of data?.items ?? []) for (const a of i.ags) m.set(a, i); return m; }, [data]);
  const levels = useMemo(() => { const v: Record<string, number> = {}; for (const i of data?.items ?? []) if (i.level) for (const a of i.ags) v[a] = i.level; return v; }, [data]);
  const sel = picked ? byAgs.get(picked) : undefined;
  const count = data?.mode === "anzahl";
  const what = q ? `der Vorgänge mit „${q}“${topic ? ` (${topicLabel} „${topic}“)` : ""}` : topic ? `der Vorgänge mit ${topicLabel} „${topic}“` : whatAll;
  const peers = level === "district" ? "ähnlichen Kreisen" : "ähnlichen Gemeinden (gleiche Art und Größe, zuerst im selben Land)";
  const chip = (on: boolean) => `h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-[14px] transition-colors ${on ? "border-teal-600 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`;

  return (
    <Reveal><section className="mt-8">
      <h2 className="text-[22px] font-semibold">{count ? "Karte: wo es vorkommt" : "Karte: viel oder wenig im Vergleich"}</h2>
      <p className="mb-3 mt-1 max-w-[860px] text-[14px] text-slate-500">{data
        ? count
          ? `Zahl ${what} je ${level === "district" ? "Kreis" : "Gemeinde"} vom ${datum(data.window.from)} bis ${datum(data.window.to)}. Für einen Vergleich mit ${peers} sind es zu wenige Vorgänge; die Karte zeigt deshalb nur, wo sie vorkommen.`
          : `Anteil ${what} an allen Sachvorgängen des Rats vom ${datum(data.window.from)} bis ${datum(data.window.to)} (ohne Formalien, gleiche Titel einmal), eingeordnet gegenüber ${peers}. Das Viertel sagt, wie häufig das Thema dort im Vergleich vorkommt, nicht, wie gut gearbeitet wird. Ort, Status und Datum der Suche gelten für die Karte nicht. Klick auf ein Gebiet zeigt seine Werte.`
        : "Karte wird berechnet …"}</p>
      {/* Mobil eine waagrecht scrollbare Zeile, sonst umbrechend */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label={`${topicLabel} der Karte`}>
        {["", ...topics].map((t) => <button key={t || "alle"} type="button" aria-pressed={topic === t} onClick={() => { setTopic(t); setPicked(""); }} className={chip(topic === t)}>{t || allLabel}</button>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Ebene">
        {([["city", "Gemeinden"], ["district", "Kreise"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => { setLevel(k); setPicked(""); }} className={chip(level === k)}>{l}</button>)}
      </div>
      {error && <p role="alert" className="mt-3 text-[14px]">{error}</p>}
      <div className="mt-4">
        <RegionMap level={level} levels={levels} picked={picked || place} onPick={(a) => setPicked(picked === a ? "" : a)}
          legend={count ? ["1 Vorgang", "2 Vorgänge", "3 bis 4 Vorgänge", "5 und mehr"] : QUARTER.map((x) => `${x[0].toUpperCase()}${x.slice(1)}`)}
          note={count ? "ohne Farbe: keine Vorgänge oder zu wenig Unterlagen" : "ohne Farbe: zu wenig Daten für einen Vergleich"}
          label={`Karte ${what}, ${level === "district" ? "Kreise" : "Gemeinden"}`}
          info={sel ? <>
            <b className="font-semibold">{sel.name}</b><br />
            <span className="text-slate-500">{sel.reason ? REASON[sel.reason] : count ? `${n(sel.k)} von ${n(sel.n)} Sachvorgängen` : `${p(sel.share)} (${n(sel.k)} von ${n(sel.n)}) · ${QUARTER[sel.level - 1]}${sel.median !== null ? ` · Mitte ${p(sel.median)}` : ""}`}</span><br />
            <button type="button" onClick={() => { onPlace(sel.ags.length === 1 ? sel.ags[0] : picked); setPicked(""); }} className="pointer-events-auto mt-1 text-[14px] font-medium text-teal-700 hover:underline">{sel.name} auswerten →</button>
          </> : picked ? <span className="text-slate-500">Für dieses Gebiet liegen im Zeitraum keine Unterlagen vor.</span> : undefined} />
      </div>
      {data && <p className="mt-2 text-[12px] text-slate-500">{count
        ? `${n(data.counts.slice(1).reduce((a, b) => a + b, 0))} ${level === "district" ? "Kreise" : "Gebiete"} mit Vorgängen.`
        : `${n(data.counts.slice(1).reduce((a, b) => a + b, 0))} ${level === "district" ? "Kreise" : "Gebiete"} eingeordnet, ${n(data.counts[0])} ohne genug Daten (mindestens ${n(data.rule.minItems)} Sachvorgänge in ${data.rule.minMonths} Monaten, und mindestens ${data.rule.minTopic} Vorgänge zu erwarten). Gemeindeverbände färben ihre Mitgliedsgemeinden.`}</p>}
    </section></Reveal>
  );
}
