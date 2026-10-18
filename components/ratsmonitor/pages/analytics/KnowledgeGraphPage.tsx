import { Segmented, Folgen } from "./Kennzahlen";
import { ThemenLeiste, XKopf, XWeiter } from "./XKopf";
import { Befund, Fehler } from "./Befund";
import { RadarDrill } from "./RadarDrill";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCenter, IconMinus, IconPlus } from "../../components/icons";
import { DiffusionSearch } from "./DiffusionSearch";
import { GraphView, KIND, type GEdge, type GNode } from "./GraphView";
import { isFiller, prettyTerm, termStem } from "../../lib/terms";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useAnalysisRun } from "./useAnalysisRun";
import { MethodikNote } from "./Methodik";

interface Result {
  /** Datum des vorab berechneten Gesamtgraphen (nur dort gesetzt) */
  generated?: string;
  q: string;
  total: number;
  capped: boolean;
  sample: number;
  /** Längere Wörter, in denen der Begriff nur als Teil steckt („vereinbarung“ bei „Verein“) */
  partial?: { word: string; n: number }[];
  nodes: GNode[];
  edges: GEdge[];
  stats: { terms: number; topics: number; committees: number; lands: number; links: number };
}

/* Rahmenlos wie die übrigen plenara.X-Seiten (rm-legend statt rm-glass) */
const glass = "rm-legend";
const n = (v: number) => v.toLocaleString("de-DE");
const pct = (v: number, total: number) => (total ? `${Math.max(1, Math.round((v / total) * 100))} %` : "–");

/* Detailstufen: Begriffe, Themenfelder, Kanten je Knoten. Der Server liefert die Stufe „Detail“ (Knoten nach Rang),
   kleinere Stufen sind ein Ausschnitt davon; Umschalten ohne neue Anfrage */
type Level = "overview" | "normal" | "detail";
const LEVELS: Record<Level, { label: string; terms: number; topics: number; per: number }> = {
  overview: { label: "Überblick", terms: 12, topics: 4, per: 3 },
  normal: { label: "Normal", terms: 22, topics: 6, per: 4 },
  detail: { label: "Detail", terms: 45, topics: 8, per: 6 },
};

export function KnowledgeGraphPage() {
  /* Das Netz ist die Hauptsache der Seite: auch am Handy zuerst ausgeklappt (lässt sich einklappen) */
  const [netz, setNetz] = useState(true);
  const params = useSearchParams();
  const { query, search } = useAnalyticsQuery();
  // Liste der Vorgänge hinter dem gewählten Knoten
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState("");
  const [pair, setPair] = useState<GEdge | null>(null);
  const [level, setLevel] = useState<Level>("overview");
  const graphRef = useRef<HTMLElement | null>(null);
  const zoomRef = useRef<((f: number | "fit") => void) | null>(null);

  /* Direktlink (?thema=) oder der Begriff, der schon in der Suche steht; ohne Begriff das ganze Netz */
  const [given] = useState(() => params.get("thema"));
  const { res: runRes, ranKey: runKey, loading: runLoading, error: runError, run, runAfterChange } = useAnalysisRun<Result>({ key: query, url: `/api/analytics/graph?${query}`, initial: false, fallback: "Der Graph konnte nicht berechnet werden.", onDone: () => { setSelected(""); setPair(null); } });
  const res = runRes, ranKey = runKey, loading = runLoading;
  const [hint, setHint] = useState("");
  const error = hint || runError;
  /* Neu erstellen; ohne Begriff das Netz über alle Vorgänge (wie Trends, Beratungswege und Beschlüsse) */
  const start = () => { setHint(""); run(); };

  useEffect(() => {
    if (!given) { run(); return; }
    search.applySearch(given);
    runAfterChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stale = !!res && ranKey !== query;
  /* Wie die übrigen Seiten: geänderte Suche oder Filter erstellen das Netz nach kurzer Pause von selbst neu */
  useEffect(() => {
    if (!stale || loading) return;
    const tm = setTimeout(() => start(), 400);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, loading]);
  const onPlay = () => {
    if (loading) return;
    start();
  };

  /* Nur Begriffe (und Themenfelder): keine Gremien, Länder oder Orte */
  /* Beugungsformen eines Begriffs werden zu einem Knoten (größte Form gibt den Namen, Zählung summiert, höchstens Gesamtzahl) */
  const merged = useMemo(() => {
    if (!res) return { nodes: [] as GNode[], edges: [] as GEdge[] };
    const keep = res.nodes.filter((x) => x.type !== "committee" && x.type !== "land" && !(x.type === "term" && isFiller(x.label)));
    const bySt = new Map<string, GNode>(), idMap = new Map<string, string>(), out: GNode[] = [];
    for (const x of [...keep].sort((a, b) => b.count - a.count)) {
      if (x.type !== "term") { out.push(x); continue; }
      const st = termStem(x.label), hit = bySt.get(st);
      if (hit) { hit.count = Math.min(res.total, hit.count + x.count); idMap.set(x.id, hit.id); continue; }
      const c = { ...x, label: prettyTerm(x.label) };
      bySt.set(st, c); out.push(c);
    }
    /* Detailstufe: die vorderen Begriffe (Rang aus der Antwort) und Themenfelder */
    const L = LEVELS[level], rank = new Map(res.nodes.map((x, i) => [x.id, i]));
    const terms = out.filter((x) => x.type === "term").sort((a, b) => rank.get(a.id)! - rank.get(b.id)!).slice(0, L.terms);
    const topics = out.filter((x) => x.type === "topic").sort((a, b) => b.count - a.count).slice(0, L.topics);
    const visible = new Set([...terms, ...topics].map((x) => x.id));
    out.splice(0, out.length, ...out.filter((x) => x.type === "center" || visible.has(x.id)));
    const ids = new Set(out.map((x) => x.id)), em = new Map<string, GEdge>();
    for (const e of res.edges) {
      const a = idMap.get(e.a) ?? e.a, b = idMap.get(e.b) ?? e.b;
      if (a === b || !ids.has(a) || !ids.has(b)) continue;
      const key = a < b ? a + "|" + b : b + "|" + a, old = em.get(key);
      if (old) { old.n = Math.min(res.total, old.n + e.n); old.w = Math.max(old.w, e.w); } else em.set(key, { ...e, a, b });
    }
    /* Je Knoten nur seine stärksten Kanten (Zahl je Stufe), damit das Bild lesbar bleibt; jeder Knoten hängt am Zentrum */
    const per = new Map<string, number>(), kept: GEdge[] = [];
    for (const e of [...em.values()].sort((a, b) => b.w - a.w)) {
      if (e.center) { kept.push(e); continue; }
      const ca = per.get(e.a) || 0, cb = per.get(e.b) || 0;
      if (ca < L.per || cb < L.per) { kept.push(e); per.set(e.a, ca + 1); per.set(e.b, cb + 1); }
    }
    return { nodes: out, edges: kept };
  }, [res, level]);
  const nodes = merged.nodes, edges = merged.edges;
  const byId = useMemo(() => new Map(nodes.map((x) => [x.id, x])), [nodes]);
  const sel = selected ? byId.get(selected) : undefined;
  const links = useMemo(() => {
    if (!res || !selected) return [];
    return edges.filter((e) => !e.center && (e.a === selected || e.b === selected)).sort((a, b) => b.w - a.w).map((e) => ({ other: byId.get(e.a === selected ? e.b : e.a)!, e })).filter((x) => x.other);
  }, [res, edges, selected, byId]);
  /* Nur Begriffe, die zum Thema passen: die häufigsten des Netzes; seltene Paare wie „Belange · öffentlicher“ sagen nichts über das Thema */
  const strongest = useMemo(() => {
    const all = edges.filter((e) => !e.center && e.a.startsWith("t:") && e.b.startsWith("t:"));
    const top = new Set(nodes.filter((x) => x.id.startsWith("t:")).sort((a, b) => b.count - a.count).slice(0, 12).map((x) => x.id));
    const main = all.filter((e) => top.has(e.a) && top.has(e.b));
    return (main.length ? main : all).sort((a, b) => b.w - a.w).slice(0, 10);
  }, [edges, nodes]);
  const activePair = pair && selected === pair.a ? pair : null;
  const empty = !!res && nodes.length <= 1;

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <XKopf seite="graph" />

      <ThemenLeiste />
      <div className="print:hidden"><DiffusionSearch follow={<Folgen heart hint="Suche speichern: neue Vorgänge per Mail" />} noPlay play={loading ? "loading" : "idle"} onPlay={onPlay} onSubmit={() => start()} /></div>
      {error && <Fehler>{error}</Fehler>}

      {/* Antwort zuerst, dann das Netz */}
      {res && !empty && strongest[0] && <Befund>„{byId.get(strongest[0].a)?.label}“ und „{byId.get(strongest[0].b)?.label}“ kommen am häufigsten gemeinsam vor, in {n(strongest[0].n)} Einträgen.</Befund>}
      {/* Detailstufe über dem Netz, als Umschalter wie auf den übrigen Seiten */}
      {res && !empty && <div className={`${netz ? "" : "max-sm:hidden"} mt-6 flex justify-end print:hidden`}><Segmented label="Detailstufe" options={(Object.keys(LEVELS) as Level[]).map((l) => [l, LEVELS[l].label] as [Level, string])} value={level} onPick={setLevel} /></div>}
      {/* Handy: das Netz lässt sich ein- und ausklappen */}
      <button type="button" onClick={() => { const open = !netz; setNetz(open); if (open) setTimeout(() => graphRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }} aria-expanded={netz} className="mt-6 max-sm:inline-flex max-sm:min-h-[44px] max-sm:items-center text-[14px] font-medium text-teal-700 sm:hidden print:hidden">{netz ? "Netz ausblenden" : "Netz anzeigen →"}</button>
      {/* Handy: Legende über dem Netz statt darauf (sonst liegt sie über den Punkten) */}
      {res && !empty && netz && <ul className="m-0 mt-3 flex list-none gap-4 p-0 text-[12px] text-slate-700 sm:hidden">
        {(["center", "term", "topic"] as const).map((t) => (
          <li key={t} className="flex items-center gap-1.5"><i className={`inline-block h-3 w-3 rounded-full ${t === "topic" ? "rm-gdot" : ""}`} style={{ background: KIND[t].fill, border: `2px solid ${KIND[t].stroke}` }} />{KIND[t].label}</li>
        ))}
      </ul>}
      <section ref={graphRef} className={`${netz || !res || empty ? "" : "max-sm:hidden"} relative mt-3 h-[420px] max-sm:scroll-mt-14 overflow-hidden rounded-[22px] max-sm:rounded-2xl border max-sm:border-transparent border-slate-200 max-sm:h-[min(540px,calc(100dvh-250px))] sm:h-[620px]`} aria-label="Themennetz">
        {res && !empty ? <GraphView nodes={nodes} edges={edges} selected={selected} pair={activePair} onSelect={(id) => { setPair(null); setSelected(id); }} zoomRef={zoomRef} /> : <div className="absolute inset-0 bg-map-ground" />}

        <div className={`${glass} absolute left-3 top-3 z-[6] rounded-2xl px-3 py-2 text-[12px] text-slate-700 max-sm:hidden`}>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {(["center", "term", "topic"] as const).map((t) => (
              <li key={t} className="flex items-center gap-2"><i className={`inline-block h-3 w-3 rounded-full ${t === "topic" ? "rm-gdot" : ""}`} style={{ background: KIND[t].fill, border: `2px solid ${KIND[t].stroke}` }} />{KIND[t].label}</li>
            ))}
          </ul>
        </div>

        <div className={`${glass} absolute right-3 top-3 z-[6] flex flex-col overflow-hidden rounded-full`}>
          <button type="button" title="Vergrößern" aria-label="Vergrößern" onClick={() => zoomRef.current?.(1.3)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-700"><IconPlus size={16} /></button>
          <button type="button" title="Verkleinern" aria-label="Verkleinern" onClick={() => zoomRef.current?.(1 / 1.3)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-700"><IconMinus size={16} /></button>
          <button type="button" title="Ganzes Netz zeigen" aria-label="Ganzes Netz zeigen" onClick={() => zoomRef.current?.("fit")} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-700"><IconCenter size={16} /></button>
        </div>

        <div className="pointer-events-none absolute inset-x-16 top-3 z-[6] flex justify-center max-sm:inset-x-3 max-sm:top-auto max-sm:bottom-3">
          {loading ? <span className={`${glass} rounded-full px-4 py-2 text-[14px] text-slate-700`}>Graph wird berechnet …</span>
            : empty ? <span className={`${glass} rounded-full px-4 py-2 text-[14px] text-slate-900`}>Keine Vorgänge für diese Auswahl.</span>
            : !res ? <span className={`${glass} rounded-full px-4 py-2 text-[14px] text-slate-700`}>Auf Start drücken</span>
            : !sel ? <span className={`${glass} rounded-full px-4 py-2 text-[14px] text-slate-700 max-sm:hidden`}>Knoten anklicken oder ziehen</span> : null}
        </div>

        {sel && res && (
          <div className={`${glass} absolute inset-x-3 bottom-3 z-[6] rounded-[18px] px-4 py-3 sm:left-6 sm:right-auto sm:w-[420px]`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] text-slate-500">{KIND[sel.type].label}</p>
                <p className="truncate text-[16px] font-semibold">{sel.label}</p>
                <p className="text-[14px] text-slate-700">{n(sel.count)} von {n(res.total)} Einträgen ({pct(sel.count, res.total)})</p>
              </div>
              <button type="button" onClick={() => setSelected("")} aria-label="Auswahl schließen" className="text-[14px] text-slate-500 hover:text-slate-900">Schließen</button>
            </div>
            {activePair && <p className="mt-2 text-[14px] text-slate-700">Verbindung mit „{byId.get(activePair.b)?.label}“: gemeinsam in {n(activePair.n)} Einträgen.</p>}
            {links.length > 0 && <p className="mt-2 line-clamp-2 text-[14px] text-slate-500">Verbunden mit: {links.slice(0, 6).map((l) => l.other.label).join(", ")}</p>}
            {sel.type === "term" && <button type="button" onClick={() => { search.applySearch(sel.label); setHint(""); runAfterChange(); }} className="mt-2 text-[14px] font-medium text-teal-700">Graph um „{sel.label}“ neu aufbauen →</button>}
            {sel.type === "topic" && <button type="button" onClick={() => { search.setThema(sel.label); setHint(""); runAfterChange(); }} className="mt-2 text-[14px] font-medium text-teal-700">Auf dieses Thema eingrenzen →</button>}
            {res.q && sel.type !== "center" && <button type="button" onClick={() => setShowList(!showList)} aria-expanded={showList} className="ml-4 mt-2 text-[14px] font-medium text-teal-700">{showList ? "Vorgänge ausblenden" : "Vorgänge zeigen"}</button>}
            {res.q && showList && sel.type !== "center" && <div className="mt-2 max-h-[50vh] overflow-auto"><RadarDrill base="/api/analytics/graph?list=1" query={ranKey} by="node" value={sel.id} label={`„${sel.label}“`} /></div>}
          </div>
        )}
      </section>

      {res && !empty && (
        <>

          {!!res.partial?.length && (
            <p className="mt-4 max-w-[760px] text-[14px] text-slate-600">Der Begriff steckt auch in längeren Wörtern, etwa {res.partial.slice(0, 3).map((p) => `„${p.word}“ (${n(p.n)})`).join(", ")}. <button type="button" onClick={() => { search.setExact(true); start(); }} className="font-medium text-teal-700">Nur ganze Wörter →</button></p>
          )}
          <div className="mt-10 max-w-[820px]">
            <section>
              <h2 className="text-[22px] font-semibold">Stärkste Verbindungen</h2>
              <p className="mb-3 mt-1 text-[14px] text-slate-500">Begriffe, die in denselben Einträgen vorkommen.</p>
              <ol className="m-0 list-none border-t border-slate-200 p-0">
                {strongest.map((e, i) => (
                  <li key={e.a + e.b} className="border-b border-slate-200">
                    <button type="button" onClick={() => { setNetz(true); setSelected(e.a); setPair(e); graphRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="group grid w-full cursor-pointer grid-cols-[28px_1fr_auto_auto] items-center gap-3 py-3 text-left hover:bg-slate-50">
                      <span className="text-[14px] tabular-nums text-slate-500">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[16px] text-slate-900">{byId.get(e.a)?.label} · {byId.get(e.b)?.label}</span>
                        <span className="mt-1.5 block h-[3px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${Math.max(4, Math.min(100, e.w * 100))}%` }} /></span>
                      </span>
                      <span className="text-[14px] tabular-nums text-slate-500">{n(e.n)} Einträge</span>
                      <span className="text-[16px] text-teal-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <MethodikNote>{res.q === "" ? `Grundlage sind alle ${n(res.total)} Vorgänge${res.generated ? ` (Stand ${res.generated.split("-").reverse().join(".")})` : ""}.` : `Grundlage sind alle ${n(res.total)} passenden Vorgänge der Suche.`} Begriffe stammen aus den Titeln und sind nach ihrer Besonderheit gegenüber dem ganzen Bestand gewichtet; Formalien, Füllwörter, Anreden und Fraktionsnamen bleiben außen vor, ebenso Besetzungen und Fragestunden; derselbe Titel in mehreren Gremien eines Gebiets zählt einmal. Eine Verbindung heißt: Beides kommt im selben Eintrag vor, nicht, dass das eine das andere verursacht.</MethodikNote>
        </>
      )}
    <XWeiter links={[["/analytics/trends", "plenara.X Trends"], ["/analytics/atlas", "plenara.X Atlas"]]} />
    </main>
  );
}
