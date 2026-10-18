import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Befund, Fehler } from "./Befund";
import { XKopf, XWeiter } from "./XKopf";
import { Laden } from "./Laden";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalysisRun } from "./useAnalysisRun";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RegionMap } from "./RegionMap";
import { RadarDrill } from "./RadarDrill";
import { Folgen, Kennzahlen, MeinOrt, Segmented, useOrtInAdresse } from "./Kennzahlen";
import { Baby, Banknote, Building2, Coins, Dog, Droplets, Factory, HandCoins, House, LayoutGrid, Map as MapIcon, Percent, Route, Ticket, Trash2, Wind, type LucideIcon } from "lucide-react";
import { num } from "../../lib/format";
import { MethodikNote } from "./Methodik";

/* plenara.X Fakten (GET /api/x?view=fakten, server/integrations/plenara-x-query.mjs): Werte aus den Unterlagen je Gemeinde
   auf der Karte, rot bis grün. Nur Werte ab 90 % gemessener Qualität (MAP_FACTS). Filter: Fakt, Wert (z. B. Grundsteuer B),
   Ort über die Suche. */
interface Row { key: string; name: string; count: number; ags?: string; members?: string[] }
interface FactMap { key: string; ags?: string; n: number; v: Record<string, { n: number; median: number; unit: string; sum?: number; last?: number; lastDate?: string; prev?: number; prevDate?: string }> }
/* dir: hoch ist schlecht (rot), gut (grün) oder nur eine Menge (Wohneinheiten, ohne Wertung) */
interface Fact { kind: string; dir: "bad" | "good" | "amount"; name: string; map: FactMap[] }
interface Result { regions: Row[]; facts: Fact[] }
/* v: gezeigter Wert (jüngster Wert oder Veränderung in %), last/prev: jüngster und voriger Wert mit Datum */
interface Area { /* Übersicht („Alle“): die Werte als Text */ items?: string[]; v: number; name: string; key: string; n: number; sum?: number; last: number; date?: string; prev?: number; prevDate?: string; ags: string }

/* Niedrig grün, hoch rot (Gebühren, Steuern, Preise); beim Jahresergebnis umgekehrt */
const GREEN_RED = ["var(--rm-ac)", "var(--color-teal-400)", "var(--color-amber-300)", "var(--rm-no)"];
const RED_GREEN = [...GREEN_RED].reverse();
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
  const { query, search } = useAnalyticsQuery();
  /* Werte für ganz Deutschland: ein gewählter Ort wird auf der Karte markiert und auf der Skala eingeordnet, nicht herausgefiltert */
  const url = `/api/x?view=fakten&${(() => { const p = new URLSearchParams(query); for (const k of ["area", "scope", "more", "within", "without"]) p.delete(k); return p; })()}`;
  const { res, loading, error, stale, run } = useAnalysisRun<Result>({ key: url, url, initial: true });
  /* Suche oder Filter geändert (auch ein entfernter Ort): nach kurzer Pause von selbst neu rechnen, wie im Atlas */
  useEffect(() => {
    if (!stale || loading) return;
    const t = setTimeout(() => run(), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, loading, url]);
  const [level, setLevel] = useState<"city" | "district">("city");
  const [picked, setPicked] = useState("");
  const facts = res?.facts ?? [];
  /* „Alle“: bei den Fakten wie viele Fakten je Gebiet einen Wert haben, bei den Werten ob es überhaupt einen gibt (Abdeckung) */
  const allFacts = params.get("fakt") === "alle";
  const fact = allFacts ? undefined : facts.find((f) => f.kind === params.get("fakt")) ?? facts[0];
  const metrics = metricsOf(fact);
  const allMetrics = !allFacts && params.get("wert") === "alle";
  const metric = allMetrics ? "" : metrics.includes(params.get("wert") ?? "") ? params.get("wert")! : metrics[0] ?? "";
  const overview = allFacts || allMetrics;
  const pick = (next: { fakt?: string; wert?: string; ansicht?: string; sortierung?: string }) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); }
    setPicked("");
    router.replace(`${path}${p.size ? "?" + p : ""}`, { scroll: false });
  };

  /* Stand heute (jüngster Wert) oder Veränderung zum vorigen Wert */
  const change = !overview && params.get("ansicht") === "veraenderung";
  /* Reihenfolge der Liste: niedrigste zuerst (Standard, wenn niedrig gut ist) oder höchste zuerst */
  const low = params.get("sortierung") === "niedrig" || (!params.get("sortierung") && facts.find((f) => f.kind === params.get("fakt"))?.dir === "good") || (!params.get("sortierung") && !params.get("fakt") && facts[0]?.dir === "good");
  const { levels, byAgs, legend, unit, ranked } = (() => {
    const regions = res?.regions ?? [];
    const unit = overview ? "" : fact?.map.find((m) => m.v[metric])?.v[metric].unit ?? "";
    const rowOf = new Map(regions.map((r) => [r.key, r]));
    type Val = Omit<Area, "name" | "key" | "ags">;
    const valOf = (x: FactMap["v"][string]): Val | null => {
      const last = x.last ?? x.median;
      if (change && (x.prev === undefined || !x.prev)) return null;
      return { v: change ? (100 * (last - x.prev!)) / Math.abs(x.prev!) : last, n: x.n, sum: x.sum, last, date: x.lastDate, prev: x.prev, prevDate: x.prevDate };
    };
    const val = new Map<string, Val>(), memberVal: [string, string, Val][] = [];
    if (overview) {
      /* Je Gebiet: Zahl der Fakten (Alle Fakten) bzw. der Werte (Alle Werte) und die Werte als Text */
      const acc = new Map<string, { items: string[]; n: number; ags?: string; key: string }>();
      for (const f of allFacts ? facts : fact ? [fact] : []) for (const m of f.map) {
        const id = m.key + "|" + (m.ags ?? ""), a = acc.get(id) ?? { items: [], n: 0, ags: m.ags, key: m.key };
        const vals = Object.entries(m.v);
        if (!vals.length) continue;
        a.n += allFacts ? 1 : vals.length;
        a.items.push(...(allFacts ? [`${f.name}: ${vals.map(([k, x]) => `${k} ${num(x.last ?? x.median)} ${x.unit}`).join(", ")}`] : vals.map(([k, x]) => `${k} ${num(x.last ?? x.median)} ${x.unit}`)));
        acc.set(id, a);
      }
      for (const a of acc.values()) { const x: Val = { v: a.n, n: a.n, last: a.n, items: a.items }; if (a.ags) memberVal.push([a.key, a.ags, x]); else val.set(a.key, x); }
    } else for (const m of fact?.map ?? []) { const x = m.v[metric] && valOf(m.v[metric]); if (!x) continue; if (m.ags) memberVal.push([m.key, m.ags, x]); else val.set(m.key, x); }
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
    const cut = overview ? [1, 2, 3] : change ? CHANGE_CUT : vs.length ? [quart(vs, 0.25), quart(vs, 0.5), quart(vs, 0.75)] : [];
    const legend = overview ? (allFacts ? ["1 Fakt", "2 Fakten", "3 Fakten", "4 und mehr"] : ["1 Wert", "2 Werte", "3 Werte", "4 und mehr"]) : change ? ["gesunken", "gestiegen bis 5 %", "gestiegen bis 15 %", "gestiegen über 15 %"]
      : cut.length ? [`bis ${num(cut[0])}`, `bis ${num(cut[1])}`, `bis ${num(cut[2])}`, `über ${num(cut[2])}`].map((l) => `${l} ${unit}`) : [];
    const levels: Record<string, number> = {};
    for (const [a, x] of area) levels[a] = x.v <= cut[0] ? 1 : x.v <= cut[1] ? 2 : x.v <= cut[2] ? 3 : 4;
    /* Liste: jedes Gebiet einmal (ein Verband färbt mehrere Gemeinden) */
    const seen = new Map<string, Area>();
    for (const x of area.values()) if (!seen.has(x.name)) seen.set(x.name, x);
    const ranked = [...seen.values()].sort((a, b) => (low && !change && !overview ? a.v - b.v : b.v - a.v));
    return { levels, byAgs: area, legend, unit, ranked };
  })();
  /* Abdeckung: Gebiete mit Wert von allen Gebieten mit Sachvorgängen in der Auswahl */
  const regionCount = res?.regions.length ?? 0;

  /* Einordnung eines Orts: Median des jüngsten Werts im Kreis und im Land (Gemeindeschlüssel: 5 bzw. 2 Stellen) */
  const peers = (x: Area) => {
    const all = [...byAgs.values()].filter((y) => y.ags !== x.ags);
    const of = (n: number) => { const vs = all.filter((y) => y.ags.slice(0, n) === x.ags.slice(0, n)).map((y) => y.last); return vs.length >= 3 ? mid(vs) : undefined; };
    return level === "city" ? { kreis: of(5), land: of(2) } : { kreis: undefined, land: of(2) };
  };
  const sel = picked ? byAgs.get(picked) : undefined;
  const chip = (on: boolean) => `h-7 whitespace-nowrap rounded-full px-3 text-[12px] font-medium ${on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`;
  const amount = fact?.dir === "amount";
  const factName = allFacts ? "Alle Fakten" : fact?.name ?? "";
  const valueText = (x: Area) => overview ? (x.items ?? []).join(" · ") : amount ? `${num(x.sum ?? 0)} Wohneinheiten in ${x.n} ${x.n === 1 ? "Vorgang" : "Vorgängen"}, ${num(x.v)} ${unit}`
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
  /* Gewählter Ort der Suche (Gemeinde, 8 Stellen) und Überfahren einer Zeile: auf der Karte hervorgehoben */
  const areaAgs = new URLSearchParams(query).get("area") ?? "";
  useOrtInAdresse(areaAgs, (a) => search.setArea(a, "ui"));
  const [hover, setHover] = useState("");
  const focus = sel ?? (areaAgs ? byAgs.get(areaAgs) : undefined);
  /* Antwort: Median, Spanne, Richtung seit dem vorigen Wert */
  const plain = !!fact && !overview && !amount && !change;
  const lasts = ranked.map((x) => x.last);
  const withPrev = ranked.filter((x) => x.prev !== undefined && x.prev !== x.last);
  const up = withPrev.filter((x) => x.last > x.prev!).length;
  const titleName = `${factName}${metric && metrics.length > 1 ? ` · ${metric}` : ""}`;

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <XKopf seite="fakten" />

      {/* Fakten als Kacheln wie die Themen im Atlas: Icon über dem Namen; Handy 4 je Reihe */}
      <nav aria-label="Fakt" className="print:hidden">
        <ul className="m-0 grid list-none grid-cols-4 gap-1 p-0 sm:flex sm:flex-wrap">
          {[{ kind: "alle", name: "Alle" }, ...facts].map((f) => {
            const on = f.kind === "alle" ? allFacts : f === fact;
            const Icon = FACT_ICONS[f.kind] ?? Coins;
            return (
              <li key={f.kind} className="sm:w-[104px]">
                <button type="button" aria-pressed={on} onClick={() => pick(f.kind === "alle" ? { fakt: "alle", wert: "", ansicht: "" } : { fakt: f.kind, wert: "" })}
                  className={`flex h-[76px] max-sm:h-[64px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[12px] leading-tight ${on ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}>
                  <Icon size={24} strokeWidth={1.2} aria-hidden="true" className={on ? "text-teal-700" : "text-slate-500"} />
                  {/* Weiches Trennzeichen vor dem Wortende („Abwasser-gebühren“): auf dem Handy sonst abgeschnitten */}
                  <span className="line-clamp-2 w-full hyphens-auto break-words">{f.name.replace(/(\p{Ll})(gebühren|steuer|sätze|preise)/u, "$1\u00AD$2")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {metrics.length > 1 && <nav aria-label="Wert" className="mt-2 border-t-2 border-teal-600 pt-2 print:hidden">
        <div className="flex flex-wrap gap-1.5 max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
          {[["alle", "Alle Werte"], ...metrics.map((m) => [m, m])].map(([k, l]) => {
            const on = k === "alle" ? allMetrics : k === metric;
            return <button key={k} type="button" aria-pressed={on} onClick={() => pick({ fakt: fact?.kind, wert: k, ...(k === "alle" ? { ansicht: "" } : {}) })}
              className={`h-8 max-sm:shrink-0 max-sm:whitespace-nowrap rounded-full border px-3 text-[14px] ${on ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}>{l}</button>;
          })}
        </div>
      </nav>}

      <div className="mt-4 print:hidden"><DiffusionSearch noPlay play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} /></div>

      {error && <Fehler>{error}</Fehler>}
      {loading && !res && <Laden text="Fakten werden geladen …" />}
      {res && !fact && !allFacts && <p className="mt-6 text-[14px] text-slate-500">Für diese Auswahl liegen keine geprüften Werte vor.</p>}
      {res && (fact || allFacts) && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {/* Antwort zuerst */}
          {plain && ranked.length > 0 && <Befund>
            {titleName}: üblich {num(quart(lasts, 0.25))} bis {num(quart(lasts, 0.75))} {unit}, Median {num(mid(lasts))} {unit}
            .
          </Befund>}
          <Kennzahlen scope={titleName} items={overview ? [{ value: n(ranked.length), label: "Gebiete mit Werten" }]
            : amount ? [{ value: num(ranked.reduce((a, x) => a + (x.sum ?? x.v), 0)), label: `${unit || "insgesamt"}` }, { value: n(ranked.length), label: "Gebiete" }]
            : change ? [{ value: n(ranked.filter((x) => x.v > 0).length), label: "Gebiete gestiegen" }, { value: n(ranked.filter((x) => x.v < 0).length), label: "gesunken" }]
            : [{ value: ranked.length ? `${num(mid(lasts))}` : "–", label: `Median${unit ? ` (${unit})` : ""}` }, { value: n(ranked.length), label: ranked.length === 1 ? "Gebiet mit Wert" : "Gebiete mit Wert" }, { value: n(up), label: "seit dem vorigen Wert höher" }]}>
            <MeinOrt current={areaAgs && focus && focus.ags === areaAgs ? { ags: areaAgs, name: focus.name } : null} onApply={(ags) => search.setArea(ags, "ui")} />
            <Folgen hint="Neue Vorgänge zu Ort und Suche per Mail (der Fakt wird noch nicht gespeichert)" />
          </Kennzahlen>
          {LINKS[fact?.kind ?? ""] && <p className="mt-1 text-[14px] text-slate-500">{LINKS[fact!.kind].map(([href, text], i) => <span key={href}>{i > 0 && " · "}<Link href={href} className="font-medium text-teal-700 hover:underline">{text} →</Link></span>)}</p>}

          {/* Links die Karte (bleibt stehen), rechts Einordnung und Rangliste; ab 1024 px nebeneinander */}
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-12">
            <div className="min-w-0 lg:sticky lg:top-4 lg:col-span-6 lg:self-start">
              <RegionMap tall level={level} levels={levels} picked={hover || picked || areaAgs} onPick={(a) => { setPicked(picked === a ? "" : a); }} legend={legend}
                colors={overview || !fact ? undefined : change ? (fact.dir === "good" ? RED_GREEN : GREEN_RED) : fact.dir === "good" ? RED_GREEN : fact.dir === "bad" ? GREEN_RED : undefined}
                note={overview ? `Wie viele ${allFacts ? "Fakten" : "Werte"} je Gebiet vorliegen; ohne Farbe: keiner` : change ? `Jüngster Wert gegen den vorigen; nur Gebiete mit zwei Werten${level === "district" ? "; nur Werte der Kreise selbst" : ""}` : `Viertel der Gebiete${level === "district" ? "; nur Werte der Kreise selbst" : ""}; ohne Farbe: kein Wert`}
                label={`Karte: ${change ? "Veränderung " : ""}${factName}${metric ? ` „${metric}“` : ""} je ${level === "district" ? "Kreis" : "Gemeinde"}`}
                info={sel ? <><b className="font-semibold">{sel.name}</b><br /><span className="text-slate-500">{valueText(sel)}</span>
                  <br /><button type="button" onClick={() => search.setArea(sel.ags, "map")} className="pointer-events-auto mt-1 text-[14px] font-medium text-teal-700 hover:underline">Diesen Ort wählen →</button></>
                  : picked ? <span className="text-slate-500">Hier gibt es keinen Wert.</span> : undefined} />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]" role="group" aria-label="Ebene der Karte">
                <span className="text-slate-500">Ebene</span>
                {([["city", "Gemeinden"], ["district", "Kreise"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => { setLevel(k); setPicked(""); }} className={chip(level === k)}>{l}</button>)}
              </div>
              {regionCount > 0 && <p className="mt-2 text-[14px] text-slate-500">Abdeckung: {n(ranked.length)} von {n(regionCount)} Gebieten mit Sachvorgängen haben einen Wert ({(Math.round((1000 * ranked.length) / regionCount) / 10).toLocaleString("de-DE")} %).</p>}
            </div>

            <div className="min-w-0 lg:col-span-6">
              {/* Ort im Vergleich: Wert des Orts auf der Skala aller Gebiete (Viertel und Median), dazu Kreis und Land */}
              {plain && focus && ranked.length >= 8 && <Skala x={focus} values={lasts} unit={unit} peer={peerText(focus)} good={fact!.dir === "good"} onList={() => show(focus.key, "map")} />}
              {plain && focus && listedArea && listedIn === "map" && <div className="mt-3"><RadarDrill base="/api/x?list=1" query={listQuery} by={`fact:${fact!.kind}`} value={metric} label={`${listedArea.name}: ${factName}`} limit={5} /></div>}

              {ranked.length > 0 && <section className={plain && focus ? "mt-8" : ""}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[22px] font-semibold">{overview ? `Meiste ${allFacts ? "Fakten" : "Werte"} zuerst` : amount ? "Größte zuerst" : "Gebiete"}</h2>
                  {fact && !overview && !amount && <Segmented label="Sortierung" value={change ? "veraenderung" : low ? "niedrig" : "hoch"}
                    options={[["hoch", "Höchste"], ["niedrig", "Niedrigste"], ["veraenderung", "Stärkster Anstieg", "Jüngster Wert gegen den vorigen; die Karte zeigt dann die Veränderung"]]}
                    onPick={(k) => pick(k === "veraenderung" ? { ansicht: "veraenderung", sortierung: "" } : { ansicht: "", sortierung: k })} />}
                </div>
                {plain && <p className="mt-1 text-[14px] text-slate-500">↑ ↓ gegenüber dem vorigen Wert</p>}
                <ol className="m-0 mt-3 list-none border-t border-slate-200 p-0" onMouseLeave={() => setHover("")}>
                  {shown.map((x) => <li key={x.name} className="border-b border-slate-200">
                    <button type="button" aria-expanded={listed === x.key && listedIn === "list"} onClick={() => show(x.key, "list")} onMouseEnter={() => setHover(x.ags)} onFocus={() => setHover(x.ags)} onBlur={() => setHover("")}
                      className={`flex w-full items-baseline justify-between gap-4 rounded-lg px-2 py-2.5 text-left text-[16px] hover:bg-slate-50 ${focus?.key === x.key ? "font-semibold" : ""}`}>
                      <span className="min-w-0 truncate">{x.name}</span>
                      <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                        {plain && x.prev !== undefined && x.prev !== x.last && <span title={`vorher ${num(x.prev)} ${unit}`} className="text-[12px] text-slate-500">{x.last > x.prev ? "↑" : "↓"} {pctText((100 * (x.last - x.prev)) / Math.abs(x.prev || 1))}</span>}
                        <span className="font-semibold text-teal-700">{overview ? <>{x.v} {allFacts ? (x.v === 1 ? "Fakt" : "Fakten") : x.v === 1 ? "Wert" : "Werte"}</> : change ? pctText(x.v) : amount ? `${num(x.sum ?? x.v)}` : `${num(x.last)} ${unit}`}</span>
                      </span>
                    </button>
                    {overview && <p className="m-0 -mt-1 px-2 pb-2 text-[12px] text-slate-500">{(x.items ?? []).join(" · ")}</p>}
                    {listed === x.key && listedIn === "list" && <div className="px-2 pb-3"><RadarDrill base="/api/x?list=1" query={listQuery} by={fact ? `fact:${fact.kind}` : "region"} value={fact ? metric : x.key} label={`${x.name}: ${factName}`} limit={5} /></div>}
                  </li>)}
                </ol>
                {ranked.length > 10 && <button type="button" onClick={() => setAll(!all)} className="mt-2 text-[14px] font-medium text-teal-700 hover:underline">{all ? "Weniger zeigen" : `Alle ${n(ranked.length)} zeigen`}</button>}
              </section>}
              <MethodikNote>Je Gebiet der jüngste genannte Wert (beschlossen oder vorgeschlagen, keine Vergleichswerte), dazu die Veränderung zum vorigen. Nur Werte mit mindestens 90 % Trefferquote in Stichproben.</MethodikNote>
            </div>
          </div>
        </div>
      )}
    <XWeiter links={[["/analytics/atlas", "Wie viel? (Atlas)"], ["/analytics/signale", "Was entsteht? (Signale)"]]} />
    </main>
  );
}

const n = (v: number) => v.toLocaleString("de-DE");
/* Icon je Fakt (Kacheln) */
const FACT_ICONS: Record<string, LucideIcon> = {
  alle: LayoutGrid, hebesatz: Percent, fee_rate: Droplets, annual_result: Banknote, land_price: Factory, housing: House, budget: Coins, second_home_tax: Building2,
  amusement_tax: Ticket, kita_fee: Baby, dog_tax: Dog, plot_price: MapIcon, grant: HandCoins, ee_power: Wind, waste_fee: Trash2, plan_area: MapIcon, wind_count: Wind, road: Route,
};
/* Wo es zum Fakt weitergeht: Menge im Atlas, Vorhaben in den Signalen */
const LINKS: Record<string, [string, string][]> = {
  hebesatz: [["/analytics/atlas?thema=finanzen", "Finanzen & Haushalt im Atlas"]],
  budget: [["/analytics/atlas?thema=finanzen", "Finanzen & Haushalt im Atlas"]],
  annual_result: [["/analytics/atlas?thema=finanzen", "Finanzen & Haushalt im Atlas"]],
  fee_rate: [["/analytics/atlas?thema=umwelt", "Umwelt, Klima & Energie im Atlas"], ["/analytics/signale?signal=wasser", "Wasser und Hochwasser in den Signalen"]],
  kita_fee: [["/analytics/atlas?thema=bildung&sub=bildung.kitabetr", "Kitas im Atlas"]],
  housing: [["/analytics/signale?signal=wohnbau", "Neue Wohnbaugebiete in den Signalen"]],
  plot_price: [["/analytics/signale?signal=wohnbau", "Neue Wohnbaugebiete in den Signalen"]],
  plan_area: [["/analytics/signale?signal=wohnbau", "Neue Wohnbaugebiete in den Signalen"], ["/analytics/signale?signal=gewerbe", "Gewerbe in den Signalen"]],
  land_price: [["/analytics/signale?signal=gewerbe", "Gewerbe, Industrie, Handel in den Signalen"]],
  ee_power: [["/analytics/signale?signal=wind", "Windenergie in den Signalen"], ["/analytics/signale?signal=solar", "Solarenergie in den Signalen"]],
  wind_count: [["/analytics/signale?signal=wind", "Windenergie in den Signalen"]],
  road: [["/analytics/signale?signal=strasse", "Straßen und Brücken in den Signalen"]],
};

/** Ort im Vergleich: Wert des Orts auf der Skala aller Gebiete; hell die mittlere Hälfte (übliche Spanne), Strich der Median */
function Skala({ x, values, unit, peer, good, onList }: { x: Area; values: number[]; unit: string; peer: string; good: boolean; onList: () => void }) {
  const lo = quart(values, 0.02), hi = quart(values, 0.98), span = hi - lo || 1;
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / span) * 100))}%`;
  const q1 = quart(values, 0.25), q3 = quart(values, 0.75), m = mid(values);
  const where = x.last < q1 ? (good ? "niedriger als üblich" : "niedriger als üblich") : x.last > q3 ? "höher als üblich" : "im üblichen Bereich";
  return (
    <section aria-label={`${x.name} im Vergleich`}>
      <h2 className="text-[22px] font-semibold">{x.name}</h2>
      <p className="mt-1 text-[16px]"><b className="font-semibold text-teal-700">{num(x.last)} {unit}</b>{x.date ? <span className="text-slate-500"> ({day(x.date)})</span> : null}, {where}.{x.prev !== undefined && x.prev !== x.last ? <span className="text-slate-500"> Vorher {num(x.prev)} {unit}{x.prevDate ? ` (${day(x.prevDate)})` : ""}.</span> : null}</p>
      <div className="relative mt-4 h-8" role="img" aria-label={`Skala: übliche Spanne ${num(q1)} bis ${num(q3)} ${unit}, Median ${num(m)}, ${x.name} ${num(x.last)}`}>
        <div className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-slate-100" />
        <div className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-teal-100" style={{ left: at(q1), width: `calc(${at(q3)} - ${at(q1)})` }} />
        <div className="absolute top-1/2 h-4 w-[2px] -translate-y-1/2 bg-slate-500" style={{ left: at(m) }} />
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-teal-700 shadow" style={{ left: at(x.last) }} />
      </div>
      <p className="mt-1 flex justify-between text-[12px] tabular-nums text-slate-500"><span>{num(lo)} {unit}</span><span>üblich {num(q1)} bis {num(q3)} · Median {num(m)}</span><span>{num(hi)} {unit}</span></p>
      {peer && <p className="mt-2 text-[14px] text-slate-500">Median {peer}</p>}
      <button type="button" onClick={onList} className="mt-2 text-[14px] font-medium text-teal-700 hover:underline">Vorgänge zu diesem Wert →</button>
    </section>
  );
}
