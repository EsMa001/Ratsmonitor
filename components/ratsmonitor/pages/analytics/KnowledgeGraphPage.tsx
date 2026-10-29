import { Folgen } from "./Kennzahlen";
import { PendingVeil } from "./XBusy";
import { LevelPill, LevelSegmented, NetLegend, NetZoom, netLevel, type Level } from "./NetControls";
import { ThemenLeiste, XKopf, XWeiter } from "./XKopf";
import { ListSkeleton } from "./ListSkeleton";
import { SplitHandle } from "./SplitHandle";
import { Befund, Fehler } from "./Befund";
import { RadarDrill } from "./RadarDrill";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconChevronLeft } from "../../components/icons";
import { DiffusionSearch } from "./DiffusionSearch";
import { useClient } from "../../lib/useClient";
import { usePhone } from "../../lib/usePhone";
import { GraphView, KIND, type GEdge, type GNode } from "./GraphView";
import { isFiller, prettyTerm, termStem } from "../../lib/terms";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useAnalysisRun } from "./useAnalysisRun";
import { MethodikNote } from "./Methodik";
import { ListRow } from "./ListRow";

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
/* Farben der Punkte wie im Netz (dunkle Bühne): Mitte petrol mit weißem Rand, Begriffe petrol hell, Themen orange-braun */
const DOT: Record<"center" | "term" | "topic", { background: string; border: string }> = { center: { background: "var(--st-center)", border: "2px solid var(--st-center)" }, term: { background: "var(--st-mid)", border: "2px solid var(--st-mid)" }, topic: { background: "var(--st-accent)", border: "2px solid var(--st-accent)" } };
const n = (v: number) => v.toLocaleString("de-DE");
const pct = (v: number, total: number) => (total ? `${Math.max(1, Math.round((v / total) * 100))} %` : "–");

/* Detailstufen: Begriffe, Themenfelder, Kanten je Knoten. Der Server liefert die Stufe „Detail“ (Knoten nach Rang),
   kleinere Stufen sind ein Ausschnitt davon; Umschalten ohne neue Anfrage */
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
  /* Standard nach Platz: Desktop in voller Breite „Detail“, schmaler „Normal“, Handy „Überblick“ (weniger Punkte, lesbare Schrift) */
  const phone = usePhone();
  const [chosen, setLevel] = useState<Level | null>(null);
  const wide = useClient(() => window.innerWidth >= 640, false);
  const level = netLevel(phone, wide, chosen);
  const graphRef = useRef<HTMLElement | null>(null);
  const zoomRef = useRef<((f: number | "fit") => void) | null>(null);

  /* Direktlink (?thema=) oder der Begriff, der schon in der Suche steht; ohne Begriff das ganze Netz */
  const [given] = useState(() => params.get("thema"));
  const { res: runRes, ranKey: runKey, loading: runLoading, error: runError, run, runAfterChange } = useAnalysisRun<Result>({ key: query, url: `/api/analytics/graph?${query}`, initial: false, fallback: "Der Graph konnte nicht berechnet werden.", onDone: () => { setSelected(""); setPair(null); } });
  const [allPairs, setAllPairs] = useState(false);
  const TYP: Record<string, string> = { term: "Begriff", topic: "Thema", committee: "Gremium", land: "Land" };
  const res = runRes, ranKey = runKey, loading = runLoading;
  /* Neue Auswahl rechnet noch: statt des alten Ergebnisses pulsierende Kacheln (Bühne und Listen) */
  const pending = loading && !!res && ranKey !== query;
  const [hint, setHint] = useState("");
  /* Vorige Netze: „Zurück“ im Netz führt zu Begriff und Thema davor; der Hinweis zum Bedienen verschwindet nach 5 Sekunden */
  const [trail, setTrail] = useState<{ q: string; thema: string }[]>([]);
  const remember = () => setTrail((tr) => [...tr, { q: search.state.q, thema: search.state.thema }]);
  const back = () => {
    const prev = trail[trail.length - 1];
    if (!prev) return;
    setTrail((tr) => tr.slice(0, -1));
    search.applySearch(prev.q);
    search.setThema(prev.thema);
    setHint(""); setSelected(""); setPair(null);
    runAfterChange();
  };
  const [tipDone, setTipDone] = useState(false);
  useEffect(() => {
    if (!runRes) return;
    const id = window.setTimeout(() => setTipDone(true), 5000);
    return () => window.clearTimeout(id);
  }, [runRes]);
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
  const topNodes = useMemo(() => nodes.filter((x) => x.type !== "center").sort((x, y) => y.count - x.count).slice(0, 8), [nodes]);
  const sel = selected ? byId.get(selected) : undefined;
  const links = useMemo(() => {
    if (!res || !selected) return [];
    return edges.filter((e) => !e.center && (e.a === selected || e.b === selected)).sort((a, b) => b.w - a.w).map((e) => ({ other: byId.get(e.a === selected ? e.b : e.a)!, e })).filter((x) => x.other);
  }, [res, edges, selected, byId]);
  /* Nur Begriffe, die zum Thema passen: die häufigsten des Netzes; seltene Paare wie „Belange · öffentlicher“ sagen nichts über das Thema */
  /* Ohne Begriff (ganzer Bestand) zählt, was überdurchschnittlich oft zusammen vorkommt (Lift), nicht was nur häufig ist:
     „Baugb · Bebauungsplan“ steht bei jedem Bebauungsplan und sagt nichts. Mit Begriff bleibt die Rangfolge nach Stärke. */
  const lift = (e: GEdge) => { const a = byId.get(e.a), b = byId.get(e.b); return res && a && b && a.count > 0 && b.count > 0 ? (e.n * res.total) / (a.count * b.count) : 0; };
  const gesamt = !!res && res.q.trim() === "";
  const strongest = useMemo(() => {
    const all = edges.filter((e) => !e.center && e.a.startsWith("t:") && e.b.startsWith("t:"));
    if (gesamt) {
      const sure = all.filter((e) => e.n >= 10);
      return (sure.length ? sure : all).map((e) => ({ e, l: lift(e) })).sort((x, y) => y.l - x.l || y.e.n - x.e.n).slice(0, 10).map((x) => x.e);
    }
    const top = new Set(nodes.filter((x) => x.id.startsWith("t:")).sort((a, b) => b.count - a.count).slice(0, 12).map((x) => x.id));
    const main = all.filter((e) => top.has(e.a) && top.has(e.b));
    return (main.length ? main : all).sort((a, b) => b.w - a.w).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, nodes, gesamt, res]);
  /* Begriffe zum Anklicken für den Einstieg: die kennzeichnendsten des Netzes (der Server liefert sie nach Gewicht sortiert) */
  const einstieg = useMemo(() => nodes.filter((x) => x.type === "term").slice(0, 10), [nodes]);
  const activePair = pair && selected === pair.a ? pair : null;
  const empty = !!res && nodes.length <= 1;

  /* Der Satz zur Auswertung: am Desktop über dem Netz, am Handy unter dem Netz */
  const befund = res && !empty ? (gesamt ? <Befund noPhone>Über alle Vorgänge hängen vor allem diese Themen und Begriffe zusammen. Mit einem Begriff zeigt das Netz, was dazugehört.</Befund> : strongest[0] ? <Befund noPhone>„{byId.get(strongest[0].a)?.label}“ und „{byId.get(strongest[0].b)?.label}“ kommen am häufigsten gemeinsam vor, in {n(strongest[0].n)} Einträgen.</Befund> : null) : null;

  return (
    <main id="inhalt" className="rm-xnet rm-noplay w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <XKopf seite="graph" />
      <SplitHandle />

      <ThemenLeiste />
      <div className="print:hidden"><DiffusionSearch follow={<Folgen heart hint="Auswahl unter Meine Suchen speichern" />} noPlay play={loading ? "loading" : "idle"} onPlay={onPlay} onSubmit={() => start()} /></div>
      {error && <Fehler onNochmal={() => run()}>{error}</Fehler>}

      {/* Antwort zuerst, dann das Netz */}
      <div className="max-sm:hidden">{befund}</div>
      {res && !empty && gesamt && einstieg.length > 0 && (
        <div className="mt-4 print:hidden max-sm:hidden">
          <p className="m-0 text-[14px] text-slate-600 max-sm:text-[12px]">Mit einem Begriff beginnen:</p>
          <div className="mt-2 flex flex-wrap gap-2 max-sm:-mx-[max(1vw,16px)] max-sm:flex-nowrap max-sm:gap-1.5 max-sm:overflow-x-auto max-sm:px-[max(1vw,16px)] max-sm:pb-1 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
            {einstieg.map((x) => <button key={x.id} type="button" onClick={() => { remember(); search.applySearch(x.label); runAfterChange(); }} className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-800 max-sm:h-8 max-sm:shrink-0 max-sm:rounded-full max-sm:px-3 max-sm:text-[12px] hover:border-slate-400">{x.label}</button>)}
          </div>
        </div>
      )}
      {/* Detailstufe über dem Netz, als Umschalter wie auf den übrigen Seiten */}
      {res && !empty && <LevelSegmented options={(Object.keys(LEVELS) as Level[]).map((l) => [l, LEVELS[l].label])} value={level} onPick={setLevel} />}
      {/* Handy: das Netz lässt sich ein- und ausklappen */}
      <button type="button" onClick={() => { const open = !netz; setNetz(open); if (open) setTimeout(() => graphRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }} aria-expanded={netz} className="mt-6 max-sm:mt-0 max-sm:inline-flex max-sm:items-center text-[14px] font-medium text-teal-700 sm:hidden print:hidden">{netz ? "Netz ausblenden" : "Netz anzeigen →"}</button>
      <section ref={graphRef} className={`${netz || !res || empty ? "" : "max-sm:hidden"} rm-xstage rm-netstage relative mt-3 max-sm:mt-1 h-[420px] max-sm:scroll-mt-14 overflow-hidden rounded-[22px] max-sm:rounded-2xl border border-slate-200 max-sm:h-[400px] sm:h-[620px]`} aria-label="Themennetz">
        {!sel && <LevelPill value={level} onPick={setLevel} />}
        {pending && <PendingVeil />}
        {res && !empty ? <GraphView allLabels={level !== "overview"} nodes={nodes} edges={edges} selected={selected} pair={activePair} onSelect={(id) => { setPair(null); setSelected(id); }} zoomRef={zoomRef} /> : <div className="rm-netstage absolute inset-0" />}

        {trail.length > 0 && res && !empty && (
          <button type="button" onClick={back} className="rm-stage-chip absolute left-3 top-3 z-[7] max-sm:top-14 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium sm:top-[104px] hover:opacity-90">
            <IconChevronLeft size={16} />Zurück
          </button>
        )}
        <NetLegend items={(["center", "term", "topic"] as const).map((t) => ({ key: t, label: KIND[t].label, dot: DOT[t] }))} />

        <NetZoom zoomRef={zoomRef} />

        {loading && !res && <div aria-hidden="true" className="pointer-events-none absolute inset-0 animate-pulse rounded-[inherit] bg-slate-100/70" />}
        <div className="pointer-events-none absolute inset-x-16 bottom-3 z-[6] flex justify-center max-sm:inset-x-3">
          {loading ? <span className="rm-stage-chip rounded-full px-4 py-2 text-[14px]">Graph wird berechnet …</span>
            : empty ? <span className="rm-stage-chip rounded-full px-4 py-2 text-[14px]">Keine Vorgänge für diese Auswahl.</span>
            : !res ? <span className="rm-stage-chip rounded-full px-4 py-2 text-[14px]">Auf Start drücken</span>
            : !sel && !tipDone ? <span className="rm-stage-chip rounded-full px-4 py-2 text-[14px] max-sm:hidden">Knoten anklicken</span> : null}
        </div>

        {sel && res && (
          <div className="rm-glass rm-liquid absolute inset-x-3 bottom-3 z-[6] rounded-[24px] px-5 py-4 max-sm:px-4 max-sm:rounded-2xl max-sm:py-2.5 sm:left-6 sm:right-auto sm:w-[420px]">
            <div className="flex items-start justify-between gap-4 max-sm:items-center">
              <div className="min-w-0">
                <p className="text-[12px] text-slate-500 max-sm:hidden">{KIND[sel.type].label}</p>
                <p className="truncate text-[16px] font-semibold">{sel.label}</p>
                <p className="text-[14px] text-slate-700 max-sm:hidden">{n(sel.count)} von {n(res.total)} Einträgen ({pct(sel.count, res.total)})</p>
              </div>
              <button type="button" onClick={() => setSelected("")} aria-label="Auswahl schließen" className="text-[14px] text-slate-500 hover:text-slate-900">Schließen</button>
            </div>
            {activePair && <p className="mt-2 text-[14px] text-slate-700">Verbindung mit „{byId.get(activePair.b)?.label}“: gemeinsam in {n(activePair.n)} Einträgen.</p>}
            {links.length > 0 && <p className="mt-2 line-clamp-2 text-[14px] text-slate-500 max-sm:hidden">Verbunden mit: {links.slice(0, 6).map((l) => l.other.label).join(", ")}</p>}
            {/* Handy: verbundene Knoten als wischbare Chips, ein Tipp wählt sie (statt kleiner Punkte im Netz zu treffen) */}
            {links.length > 0 && (
              <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden" role="group" aria-label="Verbunden mit">
                {links.slice(0, 10).map((l) => (
                  <button key={l.other.id} type="button" onClick={() => setSelected(l.other.id)} className="inline-flex h-9 shrink-0 items-center rounded-full border border-slate-200 bg-white/80 px-3 text-[14px] text-slate-800">{l.other.label}</button>
                ))}
              </div>
            )}
            {/* Was man mit der Auswahl tun kann, mit kurzer Erklärung */}
            {(sel.type === "term" || sel.type === "topic" || (res.q && String(sel.type) !== "center")) && (
              <div className="mt-3 max-sm:mt-2 flex flex-wrap gap-2">
                {sel.type === "term" && <button type="button" onClick={() => { remember(); search.applySearch(sel.label); setHint(""); runAfterChange(); }} className="inline-flex h-10 items-center rounded-full bg-teal-700 px-4 text-[14px] font-medium text-white">Netz zu „{sel.label}“ zeigen</button>}
                {sel.type === "topic" && <button type="button" onClick={() => { remember(); search.setThema(sel.label); setHint(""); runAfterChange(); }} className="inline-flex h-10 items-center rounded-full bg-teal-700 px-4 text-[14px] font-medium text-white">Nur dieses Thema zeigen</button>}
                {res.q && String(sel.type) !== "center" && <button type="button" onClick={() => setShowList(!showList)} aria-expanded={showList} className="inline-flex h-10 items-center rounded-full border border-teal-700 px-4 text-[14px] font-medium text-teal-700">{showList ? "Vorgänge ausblenden" : "Vorgänge ansehen"}</button>}
              </div>
            )}
            {res.q && showList && sel.type !== "center" && <div className="mt-2 max-h-[50vh] overflow-auto"><RadarDrill base="/api/analytics/graph?list=1" query={ranKey} by="node" value={sel.id} label={`„${sel.label}“`} /></div>}
          </div>
        )}
      </section>
      <div className="sm:hidden">{befund}</div>

      {res && !empty && (
        <>

          {pending && <ListSkeleton />}
          <div className={pending ? "hidden" : undefined}>
          {!!res.partial?.length && (
            <p className="mt-4 max-w-[760px] text-[14px] text-slate-600">Der Begriff steckt auch in längeren Wörtern, etwa {res.partial.slice(0, 3).map((p) => `„${p.word}“ (${n(p.n)})`).join(", ")}. <button type="button" onClick={() => { search.setExact(true); start(); }} className="font-medium text-teal-700">Nur ganze Wörter →</button></p>
          )}
          <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-10 min-[640px]:grid-cols-2 max-sm:mt-5 max-sm:gap-y-5">
            <section>
              <h2 className="text-[22px] font-semibold">{gesamt ? "Auffällige Verbindungen" : "Stärkste Verbindungen"}</h2>
              <p className="mb-3 mt-1 text-[14px] text-slate-500">{gesamt ? "Begriffe, die viel öfter zusammen vorkommen, als es ihre Häufigkeit erwarten lässt." : "Begriffe, die in denselben Einträgen vorkommen."}</p>
              <ol className="m-0 list-none border-t border-slate-200 p-0">
                {(allPairs ? strongest : strongest.slice(0, 5)).map((e, i) => (
                  <ListRow key={e.a + e.b} nr={i + 1} title={`${byId.get(e.a)?.label} · ${byId.get(e.b)?.label}`} bar={e.w * 100} value={gesamt ? `${n(e.n)} Einträge · ×${Math.round(lift(e)).toLocaleString("de-DE")}` : `${n(e.n)} Einträge`}
                    onClick={() => { setNetz(true); setSelected(e.a); setPair(e); graphRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }} />
                ))}
              </ol>
              {strongest.length > 5 && <button type="button" aria-expanded={allPairs} onClick={() => setAllPairs(!allPairs)} className="mt-2 inline-flex min-h-[44px] items-center text-[14px] font-medium text-teal-700">{allPairs ? "Weniger Verbindungen zeigen" : `Alle ${strongest.length} Verbindungen zeigen`}</button>}
            </section>
            {/* Rechts daneben: die häufigsten Knoten des Netzes (Begriffe, Themen, Gremien, Länder); Klick zeigt sie im Netz */}
            {topNodes.length > 0 && <section>
              <h2 className="text-[22px] font-semibold">Häufigste Knoten</h2>
              <p className="mb-3 mt-1 text-[14px] text-slate-500">Begriffe, Themen, Gremien und Länder mit den meisten Einträgen im Netz.</p>
              <ol className="m-0 list-none border-t border-slate-200 p-0">
                {topNodes.map((x, i) => (
                  <ListRow key={x.id} nr={i + 1} title={x.label} tag={TYP[x.type] ?? ""} value={`${n(x.count)} Einträge`}
                    onClick={() => { setNetz(true); setSelected(x.id); setPair(null); graphRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }} />
                ))}
              </ol>
            </section>}
          </div>
          <MethodikNote>{res.q === "" ? `Grundlage sind alle ${n(res.total)} Vorgänge${res.generated ? ` (Stand ${res.generated.split("-").reverse().join(".")})` : ""}.` : `Grundlage sind alle ${n(res.total)} passenden Vorgänge der Suche.`} Begriffe stammen aus den Titeln und sind nach ihrer Besonderheit gegenüber dem ganzen Bestand gewichtet; Formalien, Füllwörter, Anreden und Fraktionsnamen bleiben außen vor, ebenso Besetzungen und Fragestunden; derselbe Titel in mehreren Gremien eines Gebiets zählt einmal. Eine Verbindung heißt: Beides kommt im selben Eintrag vor, nicht, dass das eine das andere verursacht.</MethodikNote>
          </div>
        </>
      )}
    <XWeiter links={[["/analytics/trends", "plenara.X Trends"], ["/analytics/atlas", "plenara.X Themenatlas"]]} />
    </main>
  );
}
