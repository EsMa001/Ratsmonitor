import { restLast } from "@/shared/rest-last.mjs";
import { useMemo, useState } from "react";
import { ZeitPills, countScale } from "./Kennzahlen";
import { RegionMap } from "./RegionMap";
import { plural } from "../../lib/text";
import { num } from "../../lib/format";
import { Row, Fact, Level, n } from "./AtlasParts";

/* Karte der Orte, oben unter der Suche. Ohne Fakt: Vorgänge der Auswahl je Gebiet. Mit Fakt: Vorgänge mit diesem Wert je Gebiet
   oder, bei Beträgen und Sätzen, der Median im Gebiet, in Vierteln über alle Gebiete eingefärbt; wo hohe Werte Kosten für die
   Bürger sind (Steuern, Gebühren, Beiträge, Preise), von grün nach rot. Gemeindeverbände färben ihre Mitgliedsgemeinden, die
   Kreise fassen alle Gebiete im Kreis zusammen (Summe, bei Kennzahlen der Median der Gebiete). */
const HIGH_BAD = new Set(["hebesatz", "fee_rate", "dog_tax", "kita_fee", "land_price", "plot_price"]);
const GREEN_RED = ["var(--rm-ac)", "var(--color-teal-400)", "var(--color-amber-300)", "var(--rm-no)"];
const mid = (vs: number[]) => { const s = [...vs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quart = (vs: number[], q: number) => { const s = [...vs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

export function AtlasMap({ regions, facts, onList, listed, drill, onPlace, onLevel, preview, level, zeit, onZeit, chips }: { /* Handy: Auswahl als Chips auf der Karte */ chips?: React.ReactNode; /* Zeitraum: am breiten Bildschirm auf der Karte */ zeit?: string; onZeit?: (z: string) => void; /* Vorschau beim Überfahren einer Zeile: deren Name */ preview?: string; regions: Row[]; facts: Fact[]; onList: (id: string) => void; listed: string; drill: (r: Row) => React.ReactNode; onPlace: (ags: string) => void; onLevel: (l: Level) => void; /* Ebene der Karte: Gemeinden oder Kreise (gehört dem Filter, siehe AtlasExtra) */ level: Level }) {
  const [pk, setPk] = useState<{ l: string; v: string }>({ l: level, v: "" });
  const picked = pk.l === level ? pk.v : "";
  const setPicked = (v: string) => setPk({ l: level, v });
  const [kind, setKind] = useState("");
  /* Fakt-, Kennzahl- und Ebenenwahl erst auf Wunsch einblenden */
  const [more, setMore] = useState(false);
  const [metric, setMetric] = useState("");
  const fact = facts.find((f) => f.kind === kind);
  const metrics = fact ? restLast([...new Set(fact.map.flatMap((m) => Object.keys(m.v)))].sort((a, b) => fact.map.filter((m) => m.v[b]).length - fact.map.filter((m) => m.v[a]).length), (x) => x) : [];
  const metricOn = metrics.includes(metric) ? metric : "";
  const { levels, byAgs, legend, unit, colors } = useMemo(() => {
    const fact = facts.find((f) => f.kind === kind);
    const unit = metricOn && fact ? fact.map.find((m) => m.v[metricOn])?.v[metricOn].unit ?? "" : "";
    /* Wert je Gebiet (Schlüssel des Katalogs) */
    const val = new Map<string, number>(), memberVal: [string, string, number][] = [];
    if (!fact) for (const r of regions) val.set(r.key, r.count);
    /* Einträge mit ags gehören zu einer genannten Mitgliedsgemeinde eines Verbands und färben nur sie */
    else for (const m of fact.map) { const x = metricOn ? m.v[metricOn]?.median : m.n; if (x === undefined) continue; if (m.ags) memberVal.push([m.key, m.ags, x]); else val.set(m.key, x); }
    const rowOf = new Map(regions.map((r) => [r.key, r]));
    /* Fläche (Gemeinde- oder Kreisschlüssel) → Wert, Name, Katalog-Schlüssel */
    const area = new Map<string, { v: number; name: string; key: string; count: number; share: number | null; base: number }>();
    if (level === "district") {
      const acc = new Map<string, number[]>();
      /* Kennzahlen nur vom Kreis selbst (Kreistag), sonst färbte ein einzelner Ort den ganzen Kreis; Anzahl als Summe aller Gebiete */
      for (const [k, v] of val) { const a = rowOf.get(k)?.ags; if (a && (metricOn ? a.length === 5 : a.length >= 5)) acc.set(a.slice(0, 5), [...(acc.get(a.slice(0, 5)) ?? []), v]); }
      for (const [a, vs] of acc) { const own = regions.find((r) => r.ags === a); area.set(a, { v: metricOn ? mid(vs) : vs.reduce((x, y) => x + y, 0), name: own?.name ?? `Kreis ${a}`, key: own?.key ?? "", count: vs.length, share: null, base: 0 }); }
    } else {
      for (const [k, v] of val) {
        const r = rowOf.get(k); if (!r) continue;
        const own = r.ags?.length === 8 ? [r.ags] : [];
        for (const a of [...own, ...(r.members ?? []).filter((m) => m.length === 8)]) if (!area.has(a) || own.includes(a)) area.set(a, { v, name: r.name, key: r.key, count: r.count, share: r.share, base: r.base });
      }
      for (const [k, a, v] of memberVal) { const r = rowOf.get(k); if (r && a.length === 8) area.set(a, { v, name: `${r.name}: Mitgliedsgemeinde`, key: r.key, count: r.count, share: r.share, base: r.base }); }
    }
    const vs = [...area.values()].map((x) => x.v);
    /* Anzahl: Stufen nach Vierteln der Gebiete (countScale), damit die Karte über ganz Deutschland unterscheidet */
    const scale = countScale(vs);
    let cut: number[] = [], legend = scale.legend;
    if (metricOn && vs.length) { cut = [quart(vs, 0.25), quart(vs, 0.5), quart(vs, 0.75)]; legend = [`bis ${num(cut[0])}`, `bis ${num(cut[1])}`, `bis ${num(cut[2])}`, `über ${num(cut[2])}`].map((l) => `${l} ${unit}`); }
    const levels: Record<string, number> = {}, byAgs = new Map<string, { v: number; name: string; key: string; count: number; share: number | null; base: number }>();
    for (const [a, x] of area) { levels[a] = metricOn ? (x.v <= cut[0] ? 1 : x.v <= cut[1] ? 2 : x.v <= cut[2] ? 3 : 4) : scale.level(x.v); byAgs.set(a, x); }
    return { levels, byAgs, legend, unit, colors: metricOn && HIGH_BAD.has(kind) ? GREEN_RED : undefined };
  }, [regions, facts, metricOn, level, kind]);
  const sel = picked ? byAgs.get(picked) : undefined;
  const chip = (on: boolean) => `h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-[14px] transition-colors ${on ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`;
  const row = "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0";
  const listedRow = listed ? regions.find((r) => r.key === listed) : undefined;
  const what = !fact ? "Vorgänge der Auswahl" : metricOn ? `Median „${metricOn}“ der Vorgänge` : `Vorgänge mit Wert „${fact.name}“`;
  const valueText = (x: { v: number; count: number }) => metricOn ? `Median ${num(x.v)} ${unit}` : `${n(x.v)} ${plural(x.v, "Vorgang", "Vorgänge")}`;
  return (
    <section>
      <div className="relative">
        {/* Klick wählt das Gebiet als Ort (wie in den Signalen): Gemeinde oder, auf Kreisebene, Kreis */}
        <RegionMap tall phoneStage level={level} levels={levels} picked={picked} onPick={(a) => { setPicked(picked === a ? "" : a); if (picked !== a && byAgs.has(a)) onPlace(a); }} legend={legend} colors={colors}
          note={preview ? `Vorschau: ${preview}` : metricOn ? `Viertel über alle Gebiete${HIGH_BAD.has(kind) ? "; rot: hoch" : ""}${level === "district" ? "; nur Werte der Kreise selbst" : ""}` : "ohne Farbe: keine Vorgänge"}
          label={`Karte: ${what} je ${level === "district" ? "Kreis" : "Gemeinde"}`}
          info={sel ? <>
            <b className="font-semibold">{sel.name}</b><br />
            <span className="text-slate-500">{valueText(sel)}</span>
            {sel.key && <><br /><button type="button" onClick={() => onList(sel.key)} className="pointer-events-auto mt-1 text-[14px] font-medium text-teal-700 hover:underline">{listed === sel.key ? "Vorgänge ausblenden" : "Vorgänge zeigen →"}</button></>}
          </> : picked ? <span className="text-slate-500">Hier gibt es keine Werte zur Auswahl.</span> : undefined} />
        {chips}
      </div>
      {/* Ebene sichtbar (nicht mehr unter „Karte anpassen“): Kreise wählen beim Klick den ganzen Kreis */}
      <div className="rm-xtop">
      <div className="rm-xebene mt-3 flex flex-wrap items-center gap-2 max-sm:hidden" role="group" aria-label="Ebene der Karte">
        <span className="text-[14px] text-slate-500 max-sm:hidden">Ebene</span>
        {([["city", "Gemeinden"], ["district", "Kreise"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => onLevel(k)} className={chip(level === k)}>{l}</button>)}
        <span className="text-[14px] text-slate-500 max-sm:hidden">· Gebiet antippen wählt den Ort</span>
      </div>
      {onZeit && <div className="rm-xzeit"><ZeitPills value={zeit ?? ""} onPick={onZeit} /></div>}
      </div>
      {facts.length > 0 && <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="mb-2 mt-2 text-[14px] font-medium text-teal-700 hover:underline">
        {more ? "Werte ausblenden" : `Karte zeigt: ${fact ? fact.name : "Alle Vorgänge"}`}
      </button>}
      {more && <>
      <div className={row} role="group" aria-label="Was die Karte zeigt">
        <button type="button" aria-pressed={!fact} onClick={() => { setKind(""); setMetric(""); setPicked(""); }} className={chip(!fact)}>Alle Vorgänge</button>
        {facts.filter((f) => f.map.length).map((f) => <button key={f.kind} type="button" aria-pressed={kind === f.kind} onClick={() => { setKind(f.kind); const m = [...new Set(f.map.flatMap((x) => Object.keys(x.v)))]; setMetric(m.length ? m.sort((a, b) => f.map.filter((x) => x.v[b]).length - f.map.filter((x) => x.v[a]).length)[0] : ""); setPicked(""); }} className={chip(kind === f.kind)}>{f.name}</button>)}
      </div>
      {fact && <div className={row + " mt-2"} role="group" aria-label="Kennzahl">
        <button type="button" aria-pressed={!metricOn} onClick={() => setMetric("")} className={chip(!metricOn)}>Anzahl</button>
        {metrics.map((m) => <button key={m} type="button" aria-pressed={metricOn === m} onClick={() => setMetric(m)} className={chip(metricOn === m)}>{m}</button>)}
      </div>}
      </>}
      {listedRow && <div className="mt-3">{drill(listedRow)}</div>}
    </section>
  );
}
