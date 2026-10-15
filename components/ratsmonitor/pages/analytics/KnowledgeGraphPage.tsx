import Link from "next/link";
import { PageBand } from "./PageBand";
import { Befund } from "./Befund";
import { RadarDrill } from "./RadarDrill";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCenter, IconMinus, IconPlus } from "../../components/icons";
import { DiffusionSearch } from "./DiffusionSearch";
import { GraphView, KIND, type GEdge, type GNode } from "./GraphView";
import { isFiller, prettyTerm, termStem } from "../../lib/terms";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useAnalysisRun } from "./useAnalysisRun";

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

const glass = "rm-glass";
const n = (v: number) => v.toLocaleString("de-DE");
const pct = (v: number, total: number) => (total ? `${Math.max(1, Math.round((v / total) * 100))} %` : "–");

export function KnowledgeGraphPage() {
  const params = useSearchParams();
  const { query, hasTerm, search } = useAnalyticsQuery();
  // Liste der Vorgänge hinter dem gewählten Knoten
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState("");
  const [pair, setPair] = useState<GEdge | null>(null);
  const graphRef = useRef<HTMLElement | null>(null);
  const zoomRef = useRef<((f: number | "fit") => void) | null>(null);

  /* Direktlink (?thema=) oder, ohne Link und ohne Begriff, das Beispiel „Photovoltaik“ mit vorab berechnetem Graphen (kein Warten) */
  const [given] = useState(() => params.get("thema"));
  const [example] = useState(() => !given && !hasTerm);
  const [pre, setPre] = useState<{ res: Result | null; loading: boolean }>({ res: null, loading: example });
  const { res: runRes, ranKey: runKey, loading: runLoading, error: runError, run, runAfterChange } = useAnalysisRun<Result>({ key: query, url: `/api/analytics/graph?${query}`, initial: false, fallback: "Der Graph konnte nicht berechnet werden.", onDone: () => { setSelected(""); setPair(null); } });
  /* Der vorab berechnete Graph gilt für die Suche, die beim Öffnen gesetzt wurde: nicht als veraltet anzeigen */
  const [preKey, setPreKey] = useState("");
  if (pre.res && !preKey && hasTerm) setPreKey(query);
  const res = runRes ?? pre.res, ranKey = runKey || preKey, loading = runLoading || pre.loading;
  const [hint, setHint] = useState("");
  const error = hint || runError;
  /* Neu erstellen; ohne Begriff warten, bis er in der Suche angekommen ist */
  const start = () => { setHint(""); if (hasTerm) run(); else runAfterChange(); };

  useEffect(() => {
    if (example) {
      search.applySearch("Photovoltaik");
      fetch("/data/graph-photovoltaik.json")
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Result>; })
        .then((r) => setPre({ res: r, loading: false }))
        .catch(() => { setPre({ res: null, loading: false }); run(); });
      return;
    }
    if (!given) { if (hasTerm) run(); return; }
    search.applySearch(given);
    runAfterChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stale = !!res && ranKey !== query;
  const onPlay = () => {
    if (loading) return;
    if (!hasTerm) return setHint("Bitte zuerst ein Thema in die Suche eingeben.");
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
    const ids = new Set(out.map((x) => x.id)), em = new Map<string, GEdge>();
    for (const e of res.edges) {
      const a = idMap.get(e.a) ?? e.a, b = idMap.get(e.b) ?? e.b;
      if (a === b || !ids.has(a) || !ids.has(b)) continue;
      const key = a < b ? a + "|" + b : b + "|" + a, old = em.get(key);
      if (old) { old.n = Math.min(res.total, old.n + e.n); old.w = Math.max(old.w, e.w); } else em.set(key, { ...e, a, b });
    }
    return { nodes: out, edges: [...em.values()] };
  }, [res]);
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
      <PageBand>
      <p className="text-[14px] text-slate-500"><Link href="/analytics/tools" className="text-teal-700">plenara.X Tools</Link> / Themennetz</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Themennetz</h1>
      <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Zeigt, womit ein Thema in den Räten zusammenhängt: verwandte Begriffe und Themenfelder als Netz.</p>
      </PageBand>

      <div className="print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={onPlay} onSubmit={() => start()} startLabel="Graph erstellen" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && !loading && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu erstellen.</p>}

      <section ref={graphRef} className="relative mt-6 h-[520px] overflow-hidden rounded-[22px] border border-slate-200 sm:h-[620px]" aria-label="Themennetz">
        {res && !empty ? <GraphView nodes={nodes} edges={edges} selected={selected} pair={activePair} onSelect={(id) => { setPair(null); setSelected(id); }} zoomRef={zoomRef} /> : <div className="absolute inset-0 bg-map-ground" />}

        <div className={`${glass} absolute left-3 top-3 z-[6] rounded-2xl px-3 py-2 text-[12px] text-slate-700`}>
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
            : empty ? <span className={`${glass} rounded-full px-4 py-2 text-[14px] text-slate-900`}>Keine Treffer für diese Suche.</span>
            : !res ? <span className={`${glass} rounded-full px-4 py-2 text-[14px] text-slate-700`}>Thema suchen und auf Start drücken</span>
            : !sel ? <span className={`${glass} rounded-full px-4 py-2 text-[14px] text-slate-700 max-sm:hidden`}>Knoten anklicken oder ziehen</span> : null}
        </div>

        {sel && res && (
          <div className={`${glass} absolute inset-x-3 bottom-3 z-[6] rounded-[22px] px-5 py-4 sm:inset-x-6`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] text-slate-500">{KIND[sel.type].label}</p>
                <p className="truncate text-[18px] font-semibold">{sel.label}</p>
                <p className="text-[14px] text-slate-700">{n(sel.count)} von {n(res.total)} Einträgen ({pct(sel.count, res.total)})</p>
              </div>
              <button type="button" onClick={() => setSelected("")} aria-label="Auswahl schließen" className="text-[14px] text-slate-500 hover:text-slate-900">Schließen</button>
            </div>
            {activePair && <p className="mt-2 text-[14px] text-slate-700">Verbindung mit „{byId.get(activePair.b)?.label}“: gemeinsam in {n(activePair.n)} Einträgen.</p>}
            {links.length > 0 && <p className="mt-2 line-clamp-2 text-[14px] text-slate-500">Verbunden mit: {links.slice(0, 6).map((l) => l.other.label).join(", ")}</p>}
            {sel.type === "term" && <button type="button" onClick={() => { search.applySearch(sel.label); start(); }} className="mt-2 text-[14px] font-medium text-teal-700">Graph um „{sel.label}“ neu aufbauen →</button>}
            {sel.type === "topic" && <button type="button" onClick={() => { search.setThema(sel.label); start(); }} className="mt-2 text-[14px] font-medium text-teal-700">Auf dieses Thema eingrenzen →</button>}
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
          {strongest[0] && <Befund>„{byId.get(strongest[0].a)?.label}“ und „{byId.get(strongest[0].b)?.label}“ kommen am häufigsten gemeinsam vor, in {n(strongest[0].n)} Einträgen.</Befund>}
          <div className="mt-10 max-w-[820px]">
            <section>
              <h2 className="text-[22px] font-semibold">Stärkste Verbindungen</h2>
              <p className="mb-3 mt-1 text-[14px] text-slate-500">Begriffe, die in denselben Einträgen vorkommen. Tippen Sie auf eine Verbindung, um sie im Netz oben zu markieren.</p>
              <ol className="m-0 list-none border-t border-slate-200 p-0">
                {strongest.map((e, i) => (
                  <li key={e.a + e.b} className="border-b border-slate-200">
                    <button type="button" onClick={() => { setSelected(e.a); setPair(e); graphRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="group grid w-full cursor-pointer grid-cols-[28px_1fr_auto_auto] items-center gap-3 py-3 text-left hover:bg-slate-50">
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
          <p className="mt-10 text-[12px] text-slate-500">{res.q === "" ? `Grundlage sind alle ${n(res.total)} Vorgänge${res.generated ? ` (Stand ${res.generated.split("-").reverse().join(".")})` : ""}.` : `Grundlage sind alle ${n(res.total)} passenden Vorgänge der Suche.`} Begriffe stammen aus den Titeln und sind nach ihrer Besonderheit gegenüber dem ganzen Bestand gewichtet; Formalien, Füllwörter, Anreden und Fraktionsnamen bleiben außen vor, ebenso Besetzungen und Fragestunden; derselbe Titel in mehreren Gremien eines Gebiets zählt einmal. Eine Verbindung heißt: Beides kommt im selben Eintrag vor, nicht, dass das eine das andere verursacht. <Link href="/analytics/ueber" className="text-teal-700">Methode →</Link></p>
        </>
      )}
    </main>
  );
}
