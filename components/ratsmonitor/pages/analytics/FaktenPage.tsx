import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalysisRun } from "./useAnalysisRun";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RegionMap } from "./RegionMap";
import { RadarDrill } from "./RadarDrill";

/* plenara.X Fakten (GET /api/x?view=fakten, server/integrations/plenara-x-query.mjs): Werte aus den Unterlagen je Gemeinde
   auf der Karte, rot bis grün. Nur Werte ab 90 % gemessener Qualität (MAP_FACTS). Filter: Fakt, Wert (z. B. Grundsteuer B),
   Ort über die Suche. */
interface Row { key: string; name: string; count: number; ags?: string; members?: string[] }
interface FactMap { key: string; ags?: string; n: number; v: Record<string, { n: number; median: number; unit: string; sum?: number; last?: number; lastDate?: string; prev?: number; prevDate?: string }> }
/* dir: hoch ist schlecht (rot), gut (grün) oder nur eine Menge (Wohneinheiten, ohne Wertung) */
interface Fact { kind: string; dir: "bad" | "good" | "amount"; name: string; map: FactMap[] }
interface Result { regions: Row[]; facts: Fact[] }
/* v: gezeigter Wert (jüngster Wert oder Veränderung in %), last/prev: jüngster und voriger Wert mit Datum */
interface Area { v: number; name: string; key: string; n: number; sum?: number; last: number; date?: string; prev?: number; prevDate?: string; ags: string }

/* Niedrig grün, hoch rot (Gebühren, Steuern, Preise); beim Jahresergebnis umgekehrt */
const GREEN_RED = ["#2f9e44", "#a9c934", "#f59f00", "#e03131"];
const RED_GREEN = [...GREEN_RED].reverse();
const num = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 2 });
const mid = (vs: number[]) => { const s = [...vs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quart = (vs: number[], q: number) => { const s = [...vs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
/* Werte eines Fakts, die meisten Gebiete zuerst */
const day = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const pctText = (v: number) => `${v > 0 ? "+" : ""}${v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
/* Veränderung in Stufen: gesunken, gestiegen bis 5 %, bis 15 %, über 15 % */
const CHANGE_CUT = [0, 5, 15];
const metricsOf = (f?: Fact) => f ? [...new Set(f.map.flatMap((m) => Object.keys(m.v)))].sort((a, b) => f.map.filter((m) => m.v[b]).length - f.map.filter((m) => m.v[a]).length) : [];

export function FaktenPage() {
  const params = useSearchParams(), router = useRouter(), path = usePathname();
  const { query } = useAnalyticsQuery();
  const url = `/api/x?view=fakten&${query}`;
  const { res, loading, error, run } = useAnalysisRun<Result>({ key: url, url, initial: true });
  const [level, setLevel] = useState<"city" | "district">("city");
  const [picked, setPicked] = useState("");
  const facts = res?.facts ?? [];
  const fact = facts.find((f) => f.kind === params.get("fakt")) ?? facts[0];
  const metrics = metricsOf(fact);
  const metric = metrics.includes(params.get("wert") ?? "") ? params.get("wert")! : metrics[0] ?? "";
  const pick = (next: { fakt?: string; wert?: string; ansicht?: string }) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); }
    setPicked("");
    router.replace(`${path}${p.size ? "?" + p : ""}`, { scroll: false });
  };

  /* Stand heute (jüngster Wert) oder Veränderung zum vorigen Wert */
  const change = params.get("ansicht") === "veraenderung";
  const { levels, byAgs, legend, unit, ranked } = useMemo(() => {
    const regions = res?.regions ?? [];
    const unit = fact?.map.find((m) => m.v[metric])?.v[metric].unit ?? "";
    const rowOf = new Map(regions.map((r) => [r.key, r]));
    type Val = Omit<Area, "name" | "key" | "ags">;
    const valOf = (x: FactMap["v"][string]): Val | null => {
      const last = x.last ?? x.median;
      if (change && (x.prev === undefined || !x.prev)) return null;
      return { v: change ? (100 * (last - x.prev!)) / Math.abs(x.prev!) : last, n: x.n, sum: x.sum, last, date: x.lastDate, prev: x.prev, prevDate: x.prevDate };
    };
    const val = new Map<string, Val>(), memberVal: [string, string, Val][] = [];
    for (const m of fact?.map ?? []) { const x = m.v[metric] && valOf(m.v[metric]); if (!x) continue; if (m.ags) memberVal.push([m.key, m.ags, x]); else val.set(m.key, x); }
    const area = new Map<string, Area>();
    if (level === "district") {
      /* Nur Werte der Kreise selbst (Kreistag), sonst färbte ein einzelner Ort den ganzen Kreis */
      for (const [k, x] of val) { const r = rowOf.get(k); if (r?.ags?.length === 5) area.set(r.ags, { ...x, name: r.name, key: r.key, ags: r.ags }); }
    } else {
      for (const [k, x] of val) {
        const r = rowOf.get(k); if (!r) continue;
        const own = r.ags?.length === 8 ? [r.ags] : [];
        for (const a of [...own, ...(r.members ?? []).filter((m) => m.length === 8)]) if (!area.has(a) || own.includes(a)) area.set(a, { ...x, name: r.name, key: r.key, ags: a });
      }
      for (const [k, a, x] of memberVal) { const r = rowOf.get(k); if (r && a.length === 8) area.set(a, { ...x, name: `${r.name}: Mitgliedsgemeinde`, key: r.key, ags: a }); }
    }
    const vs = [...area.values()].map((x) => x.v);
    const cut = change ? CHANGE_CUT : vs.length ? [quart(vs, 0.25), quart(vs, 0.5), quart(vs, 0.75)] : [];
    const legend = change ? ["gesunken", "gestiegen bis 5 %", "gestiegen bis 15 %", "gestiegen über 15 %"]
      : cut.length ? [`bis ${num(cut[0])}`, `bis ${num(cut[1])}`, `bis ${num(cut[2])}`, `über ${num(cut[2])}`].map((l) => `${l} ${unit}`) : [];
    const levels: Record<string, number> = {};
    for (const [a, x] of area) levels[a] = x.v <= cut[0] ? 1 : x.v <= cut[1] ? 2 : x.v <= cut[2] ? 3 : 4;
    /* Liste: jedes Gebiet einmal (ein Verband färbt mehrere Gemeinden) */
    const seen = new Map<string, Area>();
    for (const x of area.values()) if (!seen.has(x.name)) seen.set(x.name, x);
    const ranked = [...seen.values()].sort((a, b) => (fact?.dir === "good" && !change ? a.v - b.v : b.v - a.v));
    return { levels, byAgs: area, legend, unit, ranked };
  }, [res, fact, metric, level, change]);

  /* Einordnung eines Orts: Median des jüngsten Werts im Kreis und im Land (Gemeindeschlüssel: 5 bzw. 2 Stellen) */
  const peers = (x: Area) => {
    const all = [...byAgs.values()].filter((y) => y.ags !== x.ags);
    const of = (n: number) => { const vs = all.filter((y) => y.ags.slice(0, n) === x.ags.slice(0, n)).map((y) => y.last); return vs.length >= 3 ? mid(vs) : undefined; };
    return level === "city" ? { kreis: of(5), land: of(2) } : { kreis: undefined, land: of(2) };
  };
  const sel = picked ? byAgs.get(picked) : undefined;
  const chip = (on: boolean) => `h-7 whitespace-nowrap rounded-full px-3 text-[12px] font-medium ${on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`;
  const amount = fact?.dir === "amount";
  const valueText = (x: Area) => amount ? `${num(x.sum ?? 0)} Wohneinheiten in ${x.n} ${x.n === 1 ? "Vorgang" : "Vorgängen"}, ${num(x.v)} ${unit}`
    : `${num(x.last)} ${unit}${x.date ? ` (${day(x.date)})` : ""}${x.prev !== undefined ? `, vorher ${num(x.prev)} ${unit}${x.prevDate ? ` (${day(x.prevDate)})` : ""}` : ""}`;
  const peerText = (x: Area) => { const p = peers(x); return [p.kreis !== undefined && `Kreis ${num(p.kreis)} ${unit}`, p.land !== undefined && `Land ${num(p.land)} ${unit}`].filter(Boolean).join(" · "); };
  /* Vorgänge hinter dem Wert eines Gebiets (Liste wie im Atlas, eingegrenzt auf das Gebiet) */
  /* Liste unter der Karte (Klick in der Karte) oder in der Rangliste, nie beides */
  const [listed, setListed] = useState(""), [listedIn, setListedIn] = useState<"map" | "list">("map");
  const listedArea = listed ? [...byAgs.values()].find((x) => x.key === listed) : undefined;
  const show = (key: string, where: "map" | "list") => { setListedIn(where); setListed(listed === key && listedIn === where ? "" : key); };
  const listQuery = (() => { const p = new URLSearchParams(query); p.set("region", listed); return p.toString(); })();
  const [all, setAll] = useState(false);
  const shown = all ? ranked : ranked.slice(0, 10);

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
        <p className="text-[14px] text-slate-500"><Link href="/analytics/ueber" className="text-teal-700">plenara.X</Link> / Fakten</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">plenara.X Fakten</h1>
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Hebesätze, Gebühren, Jahresergebnisse, Preise und geplante Wohneinheiten aus den Vorlagen der Räte, je Gemeinde auf der Karte, mit den Vorgängen dahinter. Nur Werte, die in Stichproben zu mindestens 90 % stimmten.</p>
      </PageBand>

      <nav aria-label="Fakt" className="print:hidden">
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {facts.map((f) => <li key={f.kind}><button type="button" aria-pressed={f === fact} onClick={() => pick({ fakt: f.kind, wert: "" })} className={chip(f === fact)}>{f.name}</button></li>)}
        </ul>
      </nav>
      {metrics.length > 1 && <div className="mt-2 flex flex-wrap gap-2 print:hidden" role="group" aria-label="Wert">
        {metrics.map((m) => <button key={m} type="button" aria-pressed={m === metric} onClick={() => pick({ fakt: fact?.kind, wert: m })} className={`h-6 rounded-full border px-2.5 text-[12px] ${m === metric ? "border-teal-600 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}>{m}</button>)}
      </div>}

      {!amount && fact && <div className="mt-2 flex flex-wrap gap-2 print:hidden" role="group" aria-label="Ansicht">
        {([["", "Stand heute"], ["veraenderung", "Veränderung"]] as const).map(([k, l]) => <button key={k || "stand"} type="button" aria-pressed={change === !!k} onClick={() => pick({ ansicht: k })} className={chip(change === !!k)}>{l}</button>)}
      </div>}

      <div className="mt-4 print:hidden"><DiffusionSearch noPlay play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} /></div>

      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {loading && !res && <Laden text="Fakten werden geladen …" />}
      {res && !fact && <p className="mt-6 text-[14px] text-slate-500">Für diese Auswahl liegen keine geprüften Werte vor.</p>}
      {res && fact && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          <section className="mt-6">
            <RegionMap level={level} levels={levels} picked={picked} onPick={(a) => setPicked(picked === a ? "" : a)} legend={legend}
              colors={change ? (fact.dir === "good" ? RED_GREEN : GREEN_RED) : fact.dir === "good" ? RED_GREEN : fact.dir === "bad" ? GREEN_RED : undefined}
              note={change ? `Jüngster Wert gegen den vorigen; nur Gebiete mit zwei Werten${level === "district" ? "; nur Werte der Kreise selbst" : ""}` : `Viertel über alle Gebiete${fact.dir === "good" ? "; grün: hoch" : fact.dir === "bad" ? "; rot: hoch" : ""}${level === "district" ? "; nur Werte der Kreise selbst" : ""}`}
              label={`Karte: ${change ? "Veränderung " : ""}${fact.name}${metric ? ` „${metric}“` : ""} je ${level === "district" ? "Kreis" : "Gemeinde"}`}
              info={sel ? <><b className="font-semibold">{sel.name}</b><br /><span className="text-slate-500">{valueText(sel)}</span>{!amount && peerText(sel) && <><br /><span className="text-slate-500">Median {peerText(sel)}</span></>}
                <br /><button type="button" onClick={() => show(sel.key, "map")} className="pointer-events-auto mt-1 text-[14px] font-medium text-teal-700 hover:underline">{listed === sel.key ? "Vorgänge ausblenden" : "Vorgänge zeigen →"}</button></>
                : picked ? <span className="text-slate-500">Hier gibt es keinen Wert.</span> : undefined} />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]" role="group" aria-label="Ebene der Karte">
              {([["city", "Gemeinden"], ["district", "Kreise"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => { setLevel(k); setPicked(""); }} className={chip(level === k)}>{l}</button>)}
              <span className="text-slate-500">{!byAgs.size ? "Keine Werte" : change ? `${ranked.filter((x) => x.v > 0).length.toLocaleString("de-DE")} von ${ranked.length.toLocaleString("de-DE")} Gebieten gestiegen` : `Median ${num(mid([...byAgs.values()].map((x) => x.v)))} ${unit}, ${ranked.length.toLocaleString("de-DE")} Gebiete mit Wert`}</span>
            </div>
            {listedArea && listedIn === "map" && <div className="mt-4"><RadarDrill base="/api/x?list=1" query={listQuery} by={`fact:${fact.kind}`} value={metric} label={`${listedArea.name}: ${fact.name}${metric && metric !== "Wohneinheiten" ? ` „${metric}“` : ""}`} /></div>}
          </section>

          {ranked.length > 0 && <section className="mt-10">
            <h2 className="text-[22px] font-semibold">{change ? "Stärkster Anstieg zuerst" : fact.dir === "good" ? "Niedrigste Werte zuerst" : "Höchste Werte zuerst"}</h2>
            <p className="mt-1 text-[14px] text-slate-500">Klick auf einen Ort zeigt die Vorgänge, aus denen der Wert stammt.</p>
            <ol className="m-0 mt-3 list-none divide-y divide-slate-200 border-y border-slate-200 p-0">
              {shown.map((x) => <li key={x.name}>
                <button type="button" aria-expanded={listed === x.key && listedIn === "list"} onClick={() => show(x.key, "list")} className="flex w-full items-baseline justify-between gap-4 py-2 text-left text-[14px] hover:bg-slate-50">
                  <span className="min-w-0 truncate text-teal-700">{x.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-900">{change ? <>{pctText(x.v)}<span className="text-slate-500"> · {num(x.prev ?? 0)} → {num(x.last)} {unit}</span></> : <>{num(x.v)} {unit}</>}{change ? null : amount ? <span className="text-slate-500"> · {num(x.sum ?? 0)} WE</span> : x.n > 1 && <span className="text-slate-500"> · {x.n} Vorgänge</span>}</span>
                </button>
                {listed === x.key && listedIn === "list" && <div className="pb-3"><RadarDrill base="/api/x?list=1" query={listQuery} by={`fact:${fact.kind}`} value={metric} label={`${x.name}: ${fact.name}`} /></div>}
              </li>)}
            </ol>
            {ranked.length > 10 && <button type="button" onClick={() => setAll(!all)} className="mt-2 text-[14px] font-medium text-teal-700 hover:underline">{all ? "Weniger zeigen" : `Alle ${ranked.length.toLocaleString("de-DE")} zeigen`}</button>}
          </section>}
          <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Je Gebiet der jüngste in den Vorlagen der Räte genannte Wert (beschlossen oder vorgeschlagen, keine Vergleichswerte; mehrere am selben Tag: Median); Veränderung gegen den vorigen anderen Wert; Wohneinheiten als Summe je 1.000 Einwohner. Farben: Viertel über alle Gebiete mit Wert. Eingrenzen nach Ort oder Begriff über die Suche.</p>
        </div>
      )}
    </main>
  );
}
