import Link from "next/link";
import { PageBand } from "./PageBand";
import { Befund } from "./Befund";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCenter, IconMinus, IconPlus } from "../../components/icons";
import { DiffusionSearch } from "./DiffusionSearch";
import { GraphView, KIND, type GEdge, type GNode } from "./GraphView";
import { isFiller, prettyTerm } from "../../lib/terms";
import { useAnalyticsQuery } from "./useAnalyticsQuery";

interface Result {
  /** Datum des vorab berechneten Gesamtgraphen (nur dort gesetzt) */
  generated?: string;
  q: string;
  total: number;
  capped: boolean;
  sample: number;
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
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [want, setWant] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [pair, setPair] = useState<GEdge | null>(null);
  const graphRef = useRef<HTMLElement | null>(null);
  const zoomRef = useRef<((f: number | "fit") => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const given = useRef(params.get("thema"));
  useEffect(() => {
    /* Ohne Direktlink und ohne Begriff in der Suche: mit einem Beispiel starten, damit die Seite nicht leer ist */
    if (!given.current && !hasTerm) given.current = "Windenergie";
    if (!given.current) { if (hasTerm) setWant(true); return; }
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
    setSelected("");
    setPair(null);
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    fetch(`/api/analytics/graph?${query}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(body.error || "Der Graph konnte nicht berechnet werden.");
        return body as unknown as Result;
      })
      .then((r) => { setRes(r); setRanKey(query); setLoading(false); })
      .catch((e) => { if (ctrl.signal.aborted) return; setError(e.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, hasTerm]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const stale = !!res && ranKey !== query;
  const onPlay = () => {
    if (loading) return;
    if (!hasTerm) return setError("Bitte zuerst ein Thema in die Suche eingeben.");
    setWant(true);
  };

  /* Nur Begriffe (und Themenfelder): keine Gremien, Länder oder Orte */
  const nodes = useMemo(() => (res ? res.nodes.filter((x) => x.type !== "committee" && x.type !== "land" && !(x.type === "term" && isFiller(x.label))).map((x) => (x.type === "term" ? { ...x, label: prettyTerm(x.label) } : x)) : []), [res]);
  const edges = useMemo(() => { const ids = new Set(nodes.map((x) => x.id)); return res ? res.edges.filter((e) => ids.has(e.a) && ids.has(e.b)) : []; }, [res, nodes]);
  const byId = useMemo(() => new Map(nodes.map((x) => [x.id, x])), [nodes]);
  const sel = selected ? byId.get(selected) : undefined;
  const links = useMemo(() => {
    if (!res || !selected) return [];
    return edges.filter((e) => !e.center && (e.a === selected || e.b === selected)).sort((a, b) => b.w - a.w).map((e) => ({ other: byId.get(e.a === selected ? e.b : e.a)!, e })).filter((x) => x.other);
  }, [res, edges, selected, byId]);
  const strongest = useMemo(() => edges.filter((e) => !e.center && e.a.startsWith("t:") && e.b.startsWith("t:")).sort((a, b) => b.w - a.w).slice(0, 10), [edges]);
  const activePair = pair && selected === pair.a ? pair : null;
  const empty = !!res && nodes.length <= 1;

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
      <p className="text-[14px] text-slate-500"><Link href="/analytics/ueber" className="text-teal-600">plenara.X</Link> / Knowledge Graph</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Knowledge Graph</h1>
      <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Zeigt, womit ein Thema in den Räten zusammenhängt: verwandte Begriffe und Themenfelder als Netz.</p>
      </PageBand>

      <div><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={onPlay} onSubmit={() => setWant(true)} startLabel="Graph erstellen" /></div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && !loading && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu erstellen.</p>}

      <section ref={graphRef} className="relative mt-6 h-[520px] overflow-hidden rounded-[22px] border border-slate-200 sm:h-[620px]" aria-label="Knowledge Graph">
        {res && !empty ? <GraphView nodes={nodes} edges={edges} selected={selected} pair={activePair} onSelect={(id) => { setPair(null); setSelected(id); }} zoomRef={zoomRef} /> : <div className="absolute inset-0 bg-map-ground" />}

        <div className={`${glass} absolute left-3 top-3 z-[6] rounded-2xl px-3 py-2 text-[12px] text-slate-700`}>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {(["center", "term", "topic"] as const).map((t) => (
              <li key={t} className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-full" style={{ background: KIND[t].fill, border: `2px solid ${KIND[t].stroke}` }} />{KIND[t].label}</li>
            ))}
          </ul>
        </div>

        <div className={`${glass} absolute right-3 top-3 z-[6] flex flex-col overflow-hidden rounded-full`}>
          <button type="button" title="Vergrößern" aria-label="Vergrößern" onClick={() => zoomRef.current?.(1.3)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-600"><IconPlus size={16} /></button>
          <button type="button" title="Verkleinern" aria-label="Verkleinern" onClick={() => zoomRef.current?.(1 / 1.3)} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-600"><IconMinus size={16} /></button>
          <button type="button" title="Ganzes Netz zeigen" aria-label="Ganzes Netz zeigen" onClick={() => zoomRef.current?.("fit")} className="grid h-10 w-10 place-items-center text-slate-700 hover:text-teal-600"><IconCenter size={16} /></button>
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
            {sel.type === "term" && <button type="button" onClick={() => { search.applySearch(sel.label); setWant(true); }} className="mt-2 text-[14px] font-medium text-teal-600">Graph um „{sel.label}“ neu aufbauen →</button>}
            {sel.type === "topic" && <button type="button" onClick={() => { search.setThema(sel.label); setWant(true); }} className="mt-2 text-[14px] font-medium text-teal-600">Auf dieses Thema eingrenzen →</button>}
          </div>
        )}
      </section>

      {res && !empty && (
        <>

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
                      <span className="text-[16px] text-teal-600 transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <p className="mt-10 text-[12px] text-slate-500">{res.q === "" ? `Grundlage ist eine gleichmäßig über den ganzen Bestand verteilte Stichprobe von ${n(res.total)} Einträgen${res.generated ? ` (Stand ${res.generated.split("-").reverse().join(".")})` : ""}.` : `Grundlage sind ${res.capped ? `die jüngsten ${n(res.sample)} von mehr passenden` : "alle passenden"} Einträge der Suche.`} Begriffe stammen aus den Titeln und sind nach ihrer Besonderheit gegenüber dem ganzen Bestand gewichtet; Formalien und Füllwörter bleiben außen vor. Eine Verbindung heißt: Beides kommt im selben Eintrag vor, nicht, dass das eine das andere verursacht. <Link href="/analytics/ueber" className="text-teal-600">Methode →</Link></p>
        </>
      )}
    </main>
  );
}
