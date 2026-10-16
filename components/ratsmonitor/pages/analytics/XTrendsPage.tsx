import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { THEMES } from "@/shared/themes.mjs";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalysisRun } from "./useAnalysisRun";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RegionMap } from "./RegionMap";
import { RadarDrill } from "./RadarDrill";
import { TrendMap, type Trend, type TrendKind } from "./TrendViews";
import { Folgen, Kennzahlen, MeinOrt, Segmented, countScale, useOrtInAdresse } from "./Kennzahlen";
import { MiniCurve, SpreadChart, SpreadMap, fmt, keysOf, toDay, type SpreadRegion } from "./XTrendsParts";
import { ThemeIcon } from "../../components/icons";
import { errorText, fetchJson } from "../../lib/fetchJson";
import { isFiller, prettyTerm } from "../../lib/terms";
import { useCatalog } from "../../lib/catalog";

/*
 * plenara.X Trends: Trends und Ausbreitung auf einer Seite. Die Liste rechnet wie das Tool Trends (/api/analytics/trends),
 * je Begriff dazu die neu erreichten Gebiete (part=spread); ein Klick zeigt die Ausbreitung des Begriffs wie das Tool
 * Ausbreitung (/api/analytics/diffusion). Die alten Tools bleiben unter /analytics/trends-alt und /analytics/diffusion-alt.
 * Karte und Ausbreitung gelten für ganz Deutschland (ein gewählter Ort wird markiert), Liste und Zahlen für die Auswahl.
 */
interface Result {
  q: string; window: number; ranges: { prevStart: string; start: string; end: string };
  totals: { recent: number; prev: number; regions: number };
  rising: Trend[]; emerging: Trend[]; falling: Trend[]; all: Trend[];
}
interface SpreadTerm { key: string; reached: number; added: number; first: string | null; curve: number[]; regions: [string, string][] }
interface Spread { ranges: Result["ranges"]; months: string[]; terms: SpreadTerm[]; moving: Record<string, number>; places: Record<string, { name: string; ags: string[] }> }
interface Diffusion {
  q: string; regions: SpreadRegion[]; lands: { id: string; name: string; regions: number; first: string }[];
  stats: { regions: number; cards: number; first: string | null; last: string | null; p10: string | null; median: string | null; p90: string | null; dataStart?: string | null };
}
type Sort = "auf" | "aus" | "ab";
interface Row extends Trend { kind: TrendKind; key: string }

const SORTS: [Sort, string, string][] = [
  ["auf", "Aufsteigend", "Deutlich häufiger als im Zeitraum davor; „neu“: davor kaum vorhanden"],
  ["aus", "Breitet sich aus", "Meiste Gebiete, die den Begriff im Zeitraum zum ersten Mal beraten haben"],
  ["ab", "Absteigend", "Deutlich seltener als im Zeitraum davor"],
];
const WINDOWS: [string, string][] = [["30", "30 Tage"], ["90", "90 Tage"], ["180", "180 Tage"]];
const n = (v: number) => v.toLocaleString("de-DE");
const ratio = (t: Trend) => (t.np === 0 ? "neu" : t.ratio >= 1 ? `×${t.ratio.toLocaleString("de-DE", { maximumFractionDigits: 1 })}` : `÷${(1 / t.ratio).toLocaleString("de-DE", { maximumFractionDigits: 1 })}`);
/* Karte und Ausbreitung: ganz Deutschland, ohne Ort und Umkreis der Suche */
const nationwide = (q: string) => { const p = new URLSearchParams(q); for (const k of ["area", "scope", "more", "within", "without"]) p.delete(k); return p.toString(); };
const months = (a: string, b: string) => Math.max(0, Math.round((toDay(b) - toDay(a)) / 30.44));

export function XTrendsPage() {
  const router = useRouter(), path = usePathname(), params = useSearchParams();
  const begriff = params.get("begriff") ?? "";
  const sort = (["aus", "ab"].includes(params.get("sort") ?? "") ? params.get("sort") : "auf") as Sort;
  const zeit = WINDOWS.some(([k]) => k === params.get("zeit")) ? params.get("zeit")! : "90";
  /* Jede Auswahl ein Schritt im Verlauf (Zurück führt zur vorigen Auswahl) */
  const pick = (next: { begriff?: string; sort?: string; zeit?: string }) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v); else p.delete(k);
    if (p.get("sort") === "auf") p.delete("sort");
    if (p.get("zeit") === "90") p.delete("zeit");
    router.push(path + (p.size ? "?" + p : ""), { scroll: false });
  };

  const { query, search } = useAnalyticsQuery();
  const url = `/api/analytics/trends?${query}&window=${zeit}`;
  const { res, loading, error, stale, run } = useAnalysisRun<Result>({ key: url, url, initial: true, fallback: "Die Trends konnten nicht berechnet werden." });
  useEffect(() => {
    if (!stale || loading) return;
    const t = setTimeout(() => run(), 400);
    return () => clearTimeout(t);
  }, [stale, loading, url, run]);

  /* Ortsnamen sind kein Trend („Köln“, „Lübeck“ steigen, wenn dort viel beraten wird): einteilige Namen der Gebiete ohne
     Zusatz wie „Stadt“, in der Schreibweise der Begriffe (klein, ohne Umlaute); nur auf dieser Seite, das alte Tool bleibt gleich */
  const catalog = useCatalog(true);
  const placeWords = useMemo(() => {
    const norm = (w: string) => w.toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");
    const set = new Set<string>();
    for (const r of catalog ?? []) { const core = r.name.replace(/^(Stadt|Gemeinde|Markt|Ortsgemeinde|Samtgemeinde|Verbandsgemeinde|Verwaltungsgemeinschaft|Amt|Landkreis|Kreis|Hansestadt|Universitätsstadt|Kreisstadt|Große Kreisstadt|Flecken) /, "").trim(); if (!/[\s-]/.test(core) && core.length >= 4) set.add(norm(core)); }
    return set;
  }, [catalog]);
  /* Liste wie das Tool Trends: ohne Füllwörter; Aufsteiger und Neues erst ab 3 Gebieten (ein einzelnes Dokument ist kein Trend) */
  const lists = useMemo(() => {
    if (!res) return null;
    const min = Math.min(3, res.totals.regions);
    const ok = (l: Trend[], kind: TrendKind, many: boolean): Row[] => l.filter((t) => !isFiller(t.term) && !placeWords.has(t.key ?? t.term) && (!many || t.regions >= min)).map((t) => ({ ...t, kind, key: t.key ?? t.term }));
    const up = [...ok(res.emerging, "emerging", true), ...ok(res.rising, "rising", true)].sort((a, b) => b.z - a.z);
    const down = ok(res.falling, "falling", false);
    const seen = new Set([...up, ...down].map((t) => t.key));
    const more = ok(res.all, "steady", false).filter((t) => !seen.has(t.key)).slice(0, Math.max(0, 40 - seen.size));
    return { up, down, more };
  }, [res, placeWords]);

  /* Ausbreitung der gezeigten Begriffe (eine Abfrage für alle), lädt nach der Liste */
  const keys = lists ? [...lists.up, ...lists.down, ...lists.more].map((t) => t.key).slice(0, 40) : [];
  const spreadUrl = keys.length ? `/api/analytics/trends?part=spread&keys=${encodeURIComponent(keys.join(","))}&${nationwide(query)}&window=${zeit}` : "";
  const [spread, setSpread] = useState<{ url: string; data: Spread | null; error: string }>({ url: "", data: null, error: "" });
  useEffect(() => {
    if (!spreadUrl) return;
    const c = new AbortController();
    fetchJson<Spread>(spreadUrl, { signal: c.signal }, "Die Ausbreitung konnte nicht geladen werden.")
      .then((data) => setSpread({ url: spreadUrl, data, error: "" }))
      .catch((e) => { if (!c.signal.aborted) setSpread({ url: spreadUrl, data: null, error: errorText(e, "Die Ausbreitung konnte nicht geladen werden.") }); });
    return () => c.abort();
  }, [spreadUrl]);
  const sp = spread.url === spreadUrl ? spread.data : null;
  const byKey = useMemo(() => new Map((sp?.terms ?? []).map((t) => [t.key, t])), [sp]);

  const rows: Row[] = !lists ? [] : sort === "auf" ? lists.up : sort === "ab" ? lists.down
    : [...lists.up, ...lists.down, ...lists.more].filter((t) => (byKey.get(t.key)?.added ?? 0) >= 3).sort((a, b) => byKey.get(b.key)!.added - byKey.get(a.key)!.added || b.z - a.z);
  const [limit, setLimit] = useState({ for: "", n: 10 });
  const shown = limit.for === url + sort ? limit.n : 10;
  const [overview, setOverview] = useState(false);

  /* Vorschau beim Überfahren einer Zeile (Tastatur: Fokus): die Ausbreitung dieses Begriffs auf der Karte */
  const [hover, setHover] = useState("");

  /* Gewählter Ort der Suche (Gemeinde, 8 Stellen): auf der Karte markiert */
  const area = new URLSearchParams(query).get("area") ?? "";
  useOrtInAdresse(area, (a) => search.setArea(a, "ui"));
  const areaName = useMemo(() => { if (!sp || !area) return ""; for (const p of Object.values(sp.places)) if (p.ags.includes(area)) return p.name; return ""; }, [sp, area]);

  /* Steckbrief: Ausbreitung des gewählten Begriffs wie im Tool Ausbreitung */
  const diffUrl = begriff ? `/api/analytics/diffusion?${(() => { const p = new URLSearchParams(nationwide(query)); p.set("q", begriff); return p; })()}` : "";
  const [diff, setDiff] = useState<{ url: string; data: Diffusion | null; error: string }>({ url: "", data: null, error: "" });
  useEffect(() => {
    if (!diffUrl) return;
    const c = new AbortController();
    fetchJson<Diffusion>(diffUrl, { signal: c.signal }, "Die Ausbreitung konnte nicht berechnet werden.")
      .then((data) => setDiff({ url: diffUrl, data, error: "" }))
      .catch((e) => { if (!c.signal.aborted) setDiff({ url: diffUrl, data: null, error: errorText(e, "Die Ausbreitung konnte nicht berechnet werden.") }); });
    return () => c.abort();
  }, [diffUrl]);
  const df = diff.url === diffUrl ? diff.data : null;
  const firsts = useMemo(() => (df?.regions ?? []).map((r) => toDay(r.first)).sort((a, b) => a - b), [df]);
  const firstDay = firsts[0] ?? 0, lastDay = Math.max(firsts.at(-1) ?? 0, toDay(new Date().toISOString()));
  const [dayState, setDayState] = useState<{ for: string; d: number }>({ for: "", d: 0 });
  const day = dayState.for === diffUrl ? dayState.d : lastDay;
  const setDay = (d: number) => setDayState({ for: diffUrl, d: Math.min(lastDay, Math.max(firstDay, d)) });
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !df) return;
    const step = Math.max(1, Math.round((lastDay - firstDay) / 150));
    const t = window.setInterval(() => setDayState((s) => { const d = (s.for === diffUrl ? s.d : lastDay) + step; if (d >= lastDay) setPlaying(false); return { for: diffUrl, d: Math.min(d, lastDay) }; }), 60);
    return () => clearInterval(t);
  }, [playing, df, firstDay, lastDay, diffUrl]);
  const toggle = () => { if (!playing && day >= lastDay) setDay(firstDay); setPlaying((p) => !p); };
  const [mapPick, setMapPick] = useState("");

  const selRow = begriff ? [...(lists?.up ?? []), ...(lists?.down ?? []), ...(lists?.more ?? [])].find((t) => t.term.toLowerCase() === begriff.toLowerCase()) : undefined;
  const selSpread = selRow ? byKey.get(selRow.key) : undefined;

  const hoverName = rows.find((r) => r.key === hover)?.term ?? hover;
  /* Karte ohne Begriff: Grundzustand oder Vorschau der überfahrenen Zeile */
  const map = useMemo(() => {
    if (!sp) return null;
    const flat = (id: string) => sp.places[id]?.ags ?? [];
    const prev = hover ? byKey.get(hover) : undefined;
    const levels: Record<string, number> = {};
    if (prev) {
      /* Wellen: früher, im Zeitraum davor, neu im Zeitraum */
      for (const [id, d] of prev.regions) { const w = d >= sp.ranges.start ? 3 : d >= sp.ranges.prevStart ? 2 : 1; for (const a of flat(id)) levels[a] = Math.max(levels[a] ?? 0, w); }
      return { levels, legend: ["früher", "im Zeitraum davor", "neu im Zeitraum"], colors: ["#cbd5e1", "#6ebfb8", "#0f766e"], label: `Karte: Ausbreitung von „${prettyTerm(hoverName)}“`, note: "Vorschau; Klick auf den Begriff öffnet die ganze Ausbreitung" };
    }
    const vals: [string, number][] = [];
    for (const [id, v] of Object.entries(sp.moving)) for (const a of flat(id)) vals.push([a, v]);
    const scale = countScale(vals.map(([, v]) => v));
    for (const [a, v] of vals) levels[a] = Math.max(levels[a] ?? 0, scale.level(v));
    return { levels, legend: scale.legend.map((l) => l.replace(/^1 Vorgänge$/, "1 Begriff").replace(/Vorgänge$/, "Begriffe")), colors: undefined, label: "Karte: wo sich gerade viel bewegt", note: "Begriffe der Liste, die das Gebiet im Zeitraum zum ersten Mal beraten hat" };
  }, [sp, hover, byKey, hoverName]);

  const moving = sp ? Object.keys(sp.moving).length : null;
  const zeitText = WINDOWS.find(([k]) => k === zeit)![1];
  const top = lists?.up[0], wide = sp && lists ? [...lists.up, ...lists.more].map((t) => ({ t, s: byKey.get(t.key) })).filter((x) => x.s).sort((a, b) => b.s!.added - a.s!.added)[0] : undefined;

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand compact>
        <p className="text-[14px] text-slate-500"><Link href="/analytics/ueber" className="text-teal-700">plenara.X</Link> / Trends</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[28px] font-semibold leading-tight">plenara.X Trends</h1>
          <p className="text-[16px] text-slate-500"><b className="font-semibold text-slate-700">Was verändert sich?</b> Begriffe, die zunehmen, und wie sie sich über die Gebiete ausbreiten.</p>
        </div>
      </PageBand>

      {/* Themen als Filter gegen das Rauschen der Begriffe (Filter „Thema“ der Suche) */}
      <nav aria-label="Thema" className="print:hidden">
        <ul className="m-0 grid list-none grid-cols-4 gap-1 p-0 sm:flex sm:flex-wrap">
          {[{ id: "alle", name: "" }, ...THEMES.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))].map((t) => {
            const on = search.state.thema === t.name;
            return (
              <li key={t.id} className="sm:w-[104px]">
                <button type="button" aria-pressed={on} onClick={() => search.setThema(t.name)}
                  className={`flex h-[68px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[12px] leading-tight ${on ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}>
                  <ThemeIcon theme={t.id} size={22} className={on ? "text-teal-700" : "text-slate-500"} />
                  <span className="line-clamp-2">{t.name || "Alle Themen"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-4 print:hidden"><DiffusionSearch noPlay play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} /></div>

      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {loading && !res && <Laden text="Trends werden berechnet …" />}
      {res && lists && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {/* Antwort zuerst */}
          {top && <p className="mt-6 max-w-[900px] text-[20px] font-semibold leading-snug">
            Am stärksten zugenommen: „{prettyTerm(top.term)}“ ({ratio(top)}{wide?.s && wide.t.key === top.key && wide.s.added > 0 ? `, +${n(wide.s.added)} Gebiete, die meisten neuen` : ""})
            {wide?.s && wide.t.key !== top.key && wide.s.added > 0 ? <>, am meisten neue Gebiete: „{prettyTerm(wide.t.term)}“ (+{n(wide.s.added)})</> : null}.
          </p>}
          <Kennzahlen items={[
            { value: n(lists.up.length), label: "aufsteigende Begriffe" },
            { value: n(lists.up.filter((t) => t.kind === "emerging").length), label: "neu aufgekommen" },
            { value: moving === null ? "…" : n(moving), label: "Gebiete mit neuen Themen" },
          ]}>
            <span>{zeitText} gegenüber den {zeitText} davor · {n(res.totals.recent)} Vorgänge</span>
            <span className="inline-flex flex-wrap gap-1 print:hidden" role="group" aria-label="Zeitraum">
              {WINDOWS.map(([k, l]) => <button key={k} type="button" aria-pressed={k === zeit} onClick={() => pick({ zeit: k })}
                className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[14px] ${k === zeit ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}>{l}</button>)}
            </span>
            <MeinOrt current={area && areaName ? { ags: area, name: areaName } : null} onApply={(ags) => search.setArea(ags, "ui")} />
            <Folgen />
          </Kennzahlen>

          <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-12">
            {/* Links die Karte: immer Ausbreitung */}
            <div className="min-w-0 lg:sticky lg:top-4 lg:col-span-6 lg:self-start">
              {begriff ? (df ? <SpreadMap regions={df.regions} day={day} firstDay={firstDay} lastDay={lastDay} onDay={(d) => { setPlaying(false); setDay(d); }} playing={playing} onToggle={toggle}
                  picked={mapPick || area} onPick={(a) => setMapPick(mapPick === a ? "" : a)}
                  info={(() => { const r = df.regions.find((x) => keysOf(x).includes(mapPick)); return r ? <><b className="font-semibold">{r.name}</b><br /><span className="text-slate-500">erste Erwähnung {fmt(r.first)} · {n(r.n)} {r.n === 1 ? "Eintrag" : "Einträge"}</span></> : undefined; })()} />
                : <div className="grid h-[420px] place-items-center rounded-[22px] border border-slate-200 text-[14px] text-slate-500 sm:h-[540px] lg:h-[720px]">{diff.error && diff.url === diffUrl ? diff.error : "Ausbreitung wird berechnet …"}</div>)
                : map ? <RegionMap tall levels={map.levels} legend={map.legend} colors={map.colors} label={map.label} note={map.note} picked={area} onPick={(a) => search.setArea(a, "map")} />
                : <div className="grid h-[420px] place-items-center rounded-[22px] border border-slate-200 text-[14px] text-slate-500 sm:h-[540px] lg:h-[720px]">{spread.error || "Karte wird berechnet …"}</div>}
            </div>

            <div className="min-w-0 lg:col-span-6">
              {begriff ? (
                <Steckbrief begriff={begriff} row={selRow} spread={selSpread} df={df} error={diff.url === diffUrl ? diff.error : ""} firsts={firsts} day={day}
                  onDay={(d) => { setPlaying(false); setDay(d); }} playing={playing} onToggle={toggle} res={res} area={area} zeitText={zeitText}
                  listQuery={`${query}&window=${zeit}`} onBack={() => (window.history.length > 1 ? router.back() : pick({ begriff: "" }))} />
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Segmented label="Sortierung" options={SORTS} value={overview ? "" : sort} onPick={(k) => { setOverview(false); pick({ sort: k }); }} />
                    <button type="button" aria-pressed={overview} onClick={() => setOverview((o) => !o)} className="h-8 rounded-full px-3 text-[14px] text-teal-700 hover:bg-teal-50">{overview ? "Liste" : "Übersicht"}</button>
                  </div>
                  <p className="mt-2 text-[14px] text-slate-500">{SORTS.find(([k]) => k === sort)![2]}. <span className="max-sm:hidden">×2,3: Anteil im Zeitraum gegenüber davor · +34: Gebiete zum ersten Mal dabei.</span></p>

                  {overview ? (
                    <div className="mt-4"><TrendMap items={[...lists.up, ...lists.down, ...lists.more]} selected="" onSelect={(t) => pick({ begriff: t })} /></div>
                  ) : rows.length === 0 ? (
                    <p className="mt-6 text-[16px] text-slate-500">{sort === "aus" && !sp ? "Ausbreitung wird berechnet …" : `Keine Begriffe in dieser Auswahl. Ein längerer Zeitraum oder „Alle Themen“ zeigen mehr.`}</p>
                  ) : (
                    <ol className="m-0 mt-3 list-none border-t border-slate-200 p-0" onMouseLeave={() => setHover("")}>
                      {rows.slice(0, shown).map((t) => {
                        const s = byKey.get(t.key);
                        return (
                          <li key={t.key} className="border-b border-slate-200">
                            <button type="button" onClick={() => pick({ begriff: t.term })} onMouseEnter={() => setHover(t.key)} onFocus={() => setHover(t.key)} onBlur={() => setHover("")}
                              className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 py-3 text-left sm:grid-cols-[1fr_64px_88px_96px] ${hover === t.key ? "bg-slate-50" : ""}`}>
                              <span className="min-w-0 truncate text-[16px] text-slate-900">
                                {prettyTerm(t.term)}{t.kind === "emerging" && <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-[12px] font-medium text-teal-800">neu</span>}
                                <span className="ml-2 text-[12px] text-slate-500 max-sm:hidden">{n(t.nr)} Vorgänge</span>
                              </span>
                              <span className={`text-right text-[16px] font-semibold tabular-nums ${sort === "aus" ? "max-sm:hidden" : ""} ${t.kind === "falling" ? "text-slate-500" : "text-teal-700"}`}>{ratio(t)}</span>
                              <span className={`text-right text-[14px] tabular-nums text-slate-700 ${sort === "aus" ? "" : "max-sm:hidden"}`}>{s ? `+${n(s.added)} Gebiete` : <span className="inline-block h-3 w-14 animate-pulse rounded bg-slate-100" />}</span>
                              <span className="max-sm:hidden">{s ? <MiniCurve curve={s.curve} /> : <span className="inline-block h-7 w-24 animate-pulse rounded bg-slate-50" />}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {!overview && rows.length > shown && <button type="button" onClick={() => setLimit({ for: url + sort, n: shown + 10 })} className="mt-3 h-9 rounded-full border border-slate-300 px-4 text-[14px] text-slate-700 hover:border-slate-400">Weitere {Math.min(10, rows.length - shown)} zeigen</button>}
                  {res.q.trim() && <p className="mt-4 text-[14px]"><button type="button" onClick={() => pick({ begriff: res.q.trim() })} className="font-medium text-teal-700">Ausbreitung von „{prettyTerm(res.q.trim())}“ ansehen →</button></p>}
                  <p className="mt-6 text-[12px] text-slate-500">Gezählt werden Sachvorgänge ohne private Bauanträge. „+N Gebiete“ zählt Gebiete in ganz Deutschland, die den Begriff im Zeitraum zum ersten Mal im Titel hatten; neu angebundene Gebiete zählen nicht. Die alten Werkzeuge: <Link href="/analytics/trends-alt" className="text-teal-700">Alt: Trends</Link> · <Link href="/analytics/diffusion-alt" className="text-teal-700">Alt: Ausbreitung</Link>.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** Steckbrief eines Begriffs: Antwort, Kurve mit Zeitraffer, Kennzahlen, Ort, Länder, erste und jüngste Gebiete, Vorgänge */
function Steckbrief({ begriff, row, spread, df, error, firsts, day, onDay, playing, onToggle, res, area, zeitText, listQuery, onBack }: {
  begriff: string; row?: Row; spread?: SpreadTerm; df: Diffusion | null; error: string; firsts: number[]; day: number; onDay: (d: number) => void; playing: boolean; onToggle: () => void;
  res: Result; area: string; zeitText: string; listQuery: string; onBack: () => void;
}) {
  const name = prettyTerm(begriff);
  /* Auf dem Handy steht der Steckbrief unter der Karte: dorthin scrollen */
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (window.innerWidth < 1024) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [begriff]);
  const here = df && area ? df.regions.findIndex((r) => keysOf(r).includes(area)) : -1;
  const maxLand = Math.max(1, ...(df?.lands.map((l) => l.regions) ?? [1]));
  const fresh = df ? df.regions.filter((r) => !r.atStart) : [];
  return (
    <section ref={ref} aria-label={`Steckbrief ${name}`} className="scroll-mt-4">
      <button type="button" onClick={onBack} className="h-8 rounded-full px-2 text-[14px] font-medium text-teal-700 hover:bg-teal-50">← Alle Trends</button>
      <h2 className="mt-2 text-[28px] font-semibold leading-tight">{name}</h2>
      {error && <p role="alert" className="mt-3 text-[14px]">{error}</p>}
      {!df && !error && <Laden text="Ausbreitung wird berechnet …" />}
      {df && (df.stats.regions === 0 ? <p className="mt-3 text-[16px] text-slate-500">Keine Vorgänge zu diesem Begriff.</p> : <>
        <p className="mt-2 text-[18px] leading-snug">
          {row ? <>{row.np === 0 ? "Neu aufgekommen" : <><b className="font-semibold text-teal-700">{ratio(row)}</b> gegenüber den {zeitText} davor</>}{spread ? <>, <b className="font-semibold">+{n(spread.added)} Gebiete</b> neu</> : null}; </> : null}
          seit {fmt(df.stats.first)} in <b className="font-semibold">{n(df.stats.regions)}</b> {df.stats.regions === 1 ? "Gebiet" : "Gebieten"}.
          {here >= 0 && <> Am gewählten Ort seit {fmt(df.regions[here].first)}, Gebiet Nr. {n(here + 1)} von {n(df.regions.length)}.</>}
          {area && here < 0 && <> Am gewählten Ort bisher nicht.</>}
        </p>

        <h3 className="mt-6 text-[16px] font-semibold">Erreichte Gebiete im Zeitverlauf</h3>
        <p className="mb-2 mt-0.5 text-[14px] text-slate-500">Seit dem ersten Eintrag; Klicken oder Ziehen setzt die Karte auf den Tag.</p>
        <SpreadChart firsts={firsts} day={day} onPick={onDay} window={[toDay(res.ranges.start), toDay(res.ranges.end)]} />
        <button type="button" onClick={onToggle} className="mt-2 h-8 rounded-full border border-teal-700 px-3 text-[14px] font-medium text-teal-700 hover:bg-teal-50">{playing ? "Zeitraffer anhalten" : "Zeitraffer abspielen"}</button>

        <dl className="mt-6 grid grid-cols-2 gap-y-4 sm:grid-cols-4">
          {[["Frühester Eintrag", fmt(df.stats.first)], ["Hälfte im Bestand", fmt(df.stats.median)], ["Von 10 % auf 90 %", df.stats.p10 && df.stats.p90 ? `${months(df.stats.p10, df.stats.p90)} Monate` : "–"], ["Einträge insgesamt", n(df.stats.cards)]].map(([k, v], i) => (
            <div key={k} className={`px-3 ${i % 2 ? "border-l border-slate-200" : "pl-0"} ${i ? "sm:border-l sm:border-slate-200 sm:pl-3" : ""}`}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="m-0 mt-1 text-[20px] font-semibold tabular-nums">{v}</dd></div>
          ))}
        </dl>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <Places title="Vorreiter" hint="Am frühesten neu, nicht schon zu Beginn ihres Bestands" items={fresh.slice(0, 5)} />
          <Places title="Zuletzt dazugekommen" hint="Die jüngsten ersten Erwähnungen" items={[...df.regions].reverse().slice(0, 5)} />
        </div>

        <h3 className="mt-8 text-[16px] font-semibold">Bundesländer</h3>
        <ol className="m-0 mt-2 list-none border-t border-slate-200 p-0">
          {df.lands.map((l) => (
            <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-200 py-2">
              <span className="min-w-0"><span className="block truncate text-[14px]">{l.name}</span><span className="mt-1 block h-[3px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${Math.max(3, (l.regions / maxLand) * 100)}%` }} /></span></span>
              <span className="text-right text-[14px] tabular-nums text-slate-500"><b className="font-semibold text-slate-900">{n(l.regions)}</b> ab {fmt(l.first)}</span>
            </li>
          ))}
        </ol>

        {row && <div className="mt-8"><RadarDrill base="/api/analytics/trends?list=1" query={listQuery} by="term" value={row.key} label={`Vorgänge mit „${name}“ im Zeitraum`} limit={5} /></div>}
        <p className="mt-6 text-[14px]"><Link href={`/analytics/diffusion-alt?thema=${encodeURIComponent(begriff)}`} className="text-teal-700">Im alten Werkzeug Ausbreitung öffnen →</Link></p>
      </>)}
    </section>
  );
}

function Places({ title, hint, items }: { title: string; hint: string; items: SpreadRegion[] }) {
  return (
    <section>
      <h3 className="text-[16px] font-semibold">{title}</h3>
      <p className="mb-2 mt-0.5 text-[12px] text-slate-500">{hint}</p>
      <ol className="m-0 list-none border-t border-slate-200 p-0">
        {items.map((r) => <li key={r.ags} className="flex justify-between gap-3 border-b border-slate-200 py-2 text-[14px]"><span className="min-w-0 truncate">{r.name}</span><span className="shrink-0 tabular-nums text-slate-500">{fmt(r.first)}</span></li>)}
      </ol>
    </section>
  );
}
