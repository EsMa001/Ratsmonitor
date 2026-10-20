import { Kennzahlen, Folgen } from "./Kennzahlen";
import { ThemenLeiste, XKopf, XWeiter } from "./XKopf";
import { ListSkeleton } from "./ListSkeleton";
import { SplitHandle } from "./SplitHandle";
import { Laden } from "./Laden";
import { Befund, Fehler, Leer } from "./Befund";
import { Reveal } from "./Reveal";
import { useMemo, useRef, useState, useEffect } from "react";
import { DiffusionSearch } from "./DiffusionSearch";
import { NetView, NET_KIND, ROLE, type NetKind, type NEdge, type NNode } from "./NetView";
import { RadarDrill } from "./RadarDrill";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useAnalysisRun } from "./useAnalysisRun";
import { MethodikNote } from "./Methodik";
import { TabPane } from "./Tabs";
import { ListRow } from "./ListRow";
import { Segmented } from "./Kennzahlen";
import { LevelPill, LevelSegmented, NetLegend, NetZoom, netLevel, type Level } from "./NetControls";
import { usePhone } from "../../lib/usePhone";
import { useClient } from "../../lib/useClient";

interface Result {
  q: string; mode: "types" | "names"; pool: number; examined: number; capped: boolean; paths: number;
  nodes: NNode[]; edges: NEdge[]; routes: { path: string[]; n: number }[];
}
const n = (v: number) => v.toLocaleString("de-DE");

export function GremiennetzPage() {
  /* Das Netz ist die Hauptsache der Seite: auch am Handy zuerst ausgeklappt (lässt sich einklappen) */
  const [netz, setNetz] = useState(true);
  const [tab, setTab] = useState<"wege" | "routen" | "rollen">("wege");
  /* Handy: die Listen zuerst mit den ersten Einträgen, „Alle zeigen“ klappt den Rest auf */
  const [more, setMore] = useState({ e: false, r: false, o: false });
  const moreBtn = (k: "e" | "r" | "o", total: number, shown: number) => total > shown ? <button type="button" aria-expanded={more[k]} onClick={() => setMore((m) => ({ ...m, [k]: !m[k] }))} className="mt-1 text-[14px] font-medium text-teal-700 hover:underline sm:hidden">{more[k] ? "Weniger zeigen" : `Alle ${total} zeigen`}</button> : null;
  const { query } = useAnalyticsQuery();
  const [selected, setSelected] = useState("");
  /* Beratungsweg aus der Liste „Typische Beratungswege“: leuchtet im Netz von der ersten bis zur letzten Station */
  const [routeNo, setRouteNo] = useState<number | null>(null);
  const netRef = useRef<HTMLElement | null>(null);
  /* Der Hinweis zum Bedienen verschwindet nach 6 Sekunden */
  const [tipDone, setTipDone] = useState(false);
  const { res, ranKey, loading, error, stale, run } = useAnalysisRun<Result>({ key: query, url: `/api/analytics/network?${query}`, initial: true, fallback: "Das Netz konnte nicht berechnet werden.", onDone: () => setSelected("") });
  /* Neue Auswahl rechnet noch: statt des alten Ergebnisses pulsierende Kacheln (Bühne und Listen) */
  const pending = loading && !!res && ranKey !== query;
  useEffect(() => {
    if (!res) return;
    const id = window.setTimeout(() => setTipDone(true), 6000);
    return () => window.clearTimeout(id);
  }, [res]);
  /* Wie Trends und Signale: geänderte Suche oder Filter rechnen nach kurzer Pause von selbst neu */
  useEffect(() => {
    if (!stale || loading) return;
    const tm = setTimeout(() => run(), 400);
    return () => clearTimeout(tm);
  }, [stale, loading, run]);
  // Geöffnete Liste hinter einem Übergang („Von|Nach“)
  const [edge, setEdge] = useState("");
  const zoomRef = useRef<((f: number | "fit") => void) | null>(null);



  const byId = useMemo(() => new Map((res?.nodes ?? []).map((x) => [x.id, x])), [res]);
  const sel = selected ? byId.get(selected) : undefined;
  const around = useMemo(() => {
    if (!res || !selected) return { into: [] as NEdge[], from: [] as NEdge[] };
    return { into: res.edges.filter((e) => e.b === selected).sort((a, b) => b.n - a.n), from: res.edges.filter((e) => e.a === selected).sort((a, b) => b.n - a.n) };
  }, [res, selected]);
  /* Detailstufe wie im Themennetz: Überblick (die größten Gremien), Normal, Detail (alle); Standard nach Platz */
  const phone = usePhone();
  const wide = useClient(() => window.innerWidth >= 1024, false);
  const [chosen, setLevel] = useState<Level | null>(null);
  const level = netLevel(phone, wide, chosen);
  const routeIds = useMemo(() => {
    const r = res && routeNo !== null ? res.routes[routeNo] : null;
    if (!res || !r) return [] as string[];
    return r.path.map((p) => res.nodes.find((x) => x.name === p || x.id === p)?.id).filter((x): x is string => !!x);
  }, [res, routeNo]);
  const net = useMemo(() => {
    if (!res) return { nodes: [] as NNode[], edges: [] as NEdge[] };
    const keep = level === "detail" ? res.nodes.length : level === "normal" ? 12 : 7;
    const ids = new Set([...res.nodes].sort((a, b) => b.in + b.out - (a.in + a.out)).slice(0, keep).map((x) => x.id));
    for (const id of routeIds) ids.add(id);
    return { nodes: res.nodes.filter((x) => ids.has(x.id)), edges: res.edges.filter((e) => ids.has(e.a) && ids.has(e.b)) };
  }, [res, level, routeIds]);
  const empty = !!res && (res.paths < 5 || res.edges.length === 0);
  const top = res?.edges[0];
  const lag = useMemo(() => { const d = (res?.edges ?? []).flatMap((e) => (e.days === null ? [] : Array(Math.min(e.n, 50)).fill(e.days))).sort((a: number, b: number) => a - b); return d.length ? d[Math.floor(d.length / 2)] : null; }, [res]);
  const ranked = useMemo(() => [...(res?.nodes ?? [])].sort((a, b) => b.in + b.out - (a.in + a.out)), [res]);
  const maxFlow = ranked[0] ? ranked[0].in + ranked[0].out : 1;
  const maxEdge = res?.edges[0]?.n ?? 1;

  return (
    <main id="inhalt" className="rm-xnet rm-noplay w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <XKopf seite="gremien" />
      <SplitHandle />

      <ThemenLeiste />
      <div className="print:hidden"><DiffusionSearch follow={<Folgen heart hint="Auswahl unter Meine Suchen speichern" />} noPlay play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} /></div>
      {error && <Fehler onNochmal={() => run()}>{error}</Fehler>}
      {loading && !res && <Laden text="Netz wird berechnet …" />}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {empty ? (
            <Leer tipp={"Mit einer weiteren Auswahl, etwa ohne Ort oder mit längerem Zeitraum, wird das Netz aussagekräftiger."}>Zu wenige Vorgänge, die durch mehrere Gremien gelaufen sind ({n(res.paths)}).</Leer>
          ) : (
            <>
              <div className="max-sm:hidden">{res.routes[0] && <Befund>Der häufigste Weg: {res.routes[0].path.join(" → ")} ({n(res.routes[0].n)} Vorgänge).</Befund>}</div>
              <div className="max-sm:hidden"><Kennzahlen rest items={([
                  ["Vorgänge mit mehreren Gremien", n(res.paths)],
                  [res.mode === "types" ? "Gremienarten" : "Gremien", n(res.nodes.length)],
                  ["Vorgänge im häufigsten Übergang", top ? n(top.n) : "–"],
                  ["Tage im Mittel je Übergang", lag === null ? "–" : String(lag)]
                ] as [string, string][]).map(([label, value]) => ({ label, value }))} /></div>
              {res.nodes.length > 7 && <LevelSegmented options={[["overview", "Überblick"], ["normal", "Normal"], ["detail", "Detail"]]} value={level} onPick={setLevel} />}
              <section ref={netRef} className={`${netz ? "" : "max-sm:hidden"} rm-xstage rm-netstage relative mt-3 max-sm:mt-1 h-[360px] max-sm:h-[400px] overflow-hidden rounded-[22px] max-sm:rounded-2xl border border-slate-200 sm:h-[640px]`} aria-label="Beratungswege">
                <LevelPill value={level} onPick={setLevel} />
                {pending && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] animate-pulse bg-slate-100/70" />}
                <NetView route={routeIds.length > 1 ? routeIds : null} nodes={net.nodes} edges={net.edges} selected={selected} onSelect={(id) => { setRouteNo(null); setSelected(id); }} zoomRef={zoomRef} />
                <NetLegend items={(["rat", "haupt", "fach", "sonst"] as NetKind[]).map((r) => ({ key: r, label: NET_KIND[r].label, dot: { background: NET_KIND[r].fill } }))} note={<p className="mt-1.5 opacity-70 max-sm:hidden">Größe: Durchsatz · Linie: Vorgänge</p>} />
                <NetZoom zoomRef={zoomRef} />
                <div className="pointer-events-none absolute inset-x-16 top-3 z-[6] flex justify-center max-sm:hidden">
                  {!sel && !tipDone && <span className="rm-stage-chip rounded-full px-4 py-2 text-[14px]">Von links (Einstieg) nach rechts (Entscheidung) · Gremium anklicken</span>}
                </div>
                {sel && (
                  <div className="rm-glass rm-liquid absolute inset-x-3 bottom-3 z-[6] rounded-[24px] px-5 py-4 max-sm:rounded-2xl max-sm:py-3 sm:left-6 sm:right-auto sm:w-[420px]">
                    <div className="flex items-start justify-between gap-4 max-sm:items-center">
                      <div className="min-w-0">
                        <p className="text-[12px] text-slate-500 max-sm:hidden">{ROLE[sel.role].label}</p>
                        <p className="text-[18px] max-sm:text-[16px] max-sm:line-clamp-2 font-semibold">{sel.name}</p>
                        <p className="text-[14px] text-slate-700 max-sm:hidden">{n(sel.in)} kommen an · {n(sel.out)} gehen weiter</p>
                      </div>
                      <button type="button" onClick={() => setSelected("")} className="text-[14px] text-slate-500 hover:text-slate-900">Schließen</button>
                    </div>
                    {around.from.length > 0 && <p className="mt-2 line-clamp-2 text-[14px] text-slate-500 max-sm:hidden">Danach: {around.from.slice(0, 3).map((e) => e.b).join(", ")}</p>}
                  </div>
                )}
              </section>
              


              {pending && <ListSkeleton />}
              <div className={pending ? "hidden" : undefined}>
              <div className="mt-8 max-sm:hidden print:hidden"><Segmented label="Teil der Auswertung" options={[["wege", "Wichtigste Übergänge"], ["routen", "Typische Beratungswege"], ["rollen", "Rollen im Netz"]]} value={tab} onPick={setTab} /></div>
              <div className="mt-6 max-sm:mt-5 grid gap-12 max-sm:gap-6">
                <TabPane on={tab === "wege"}><section>
                  <h2 className="text-[22px] font-semibold">Wohin Vorgänge als Nächstes gehen</h2>
                  <p className="mb-3 mt-1 text-[14px] text-slate-500">Von welchem Gremium ein Vorgang an welches ging, und wie lange das im Mittel dauerte.</p>
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {res.edges.slice(0, !more.e ? 5 : 12).map((e) => {
                      const key = e.a + "|" + e.b;
                      return (
                        <ListRow key={e.a + e.b} title={e.a} sub={`→ ${e.b}`} value={<b className="font-semibold text-slate-900">{n(e.n)}</b>} valueSub={e.days === null ? "–" : `${e.days} Tage`} bar={(e.n / maxEdge) * 100} arrow={false}
                          expanded={edge === key} onClick={() => { setSelected(e.a); setEdge(edge === key ? "" : key); }}>
                          {edge === key && <RadarDrill base="/api/analytics/network?list=1" query={ranKey} by="edge" value={edge} label={`${e.a} → ${e.b}, Vorgänge`} />}
                        </ListRow>
                      );
                    })}
                  </ol>
                  {moreBtn("e", Math.min(12, res.edges.length), 5)}
                </section>
                </TabPane>
                <TabPane on={tab === "routen"}><section>
                  <h2 className="text-[22px] font-semibold">Welchen Weg Vorgänge nehmen</h2>
                  <p className="mb-3 mt-1 text-[14px] text-slate-500">Die häufigsten Folgen von Gremien (bis zu vier Stationen). Anklicken zeigt den Weg im Netz.</p>
                  <ol className="m-0 list-none border-t border-slate-200 p-0">
                    {(!more.r ? res.routes.slice(0, 5) : res.routes).map((r, i) => (
                      <li key={i} className="border-b border-slate-200 text-[14px]">
                        <button type="button" aria-pressed={routeNo === i} onClick={() => { const on = routeNo !== i; setRouteNo(on ? i : null); setSelected(""); if (on) { setNetz(true); netRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } }}
                          title="Im Netz zeigen" className={`flex w-full items-start justify-between gap-4 py-3 text-left max-sm:min-h-[44px] ${routeNo === i ? "bg-teal-50" : "hover:bg-slate-50"}`}>
                          <span className="min-w-0 text-slate-900">{r.path.map((p, j) => <span key={j}>{j > 0 && <span className="mx-1.5 text-teal-700">→</span>}{p}</span>)}</span>
                          <span className="shrink-0 tabular-nums text-slate-500">{n(r.n)}</span>
                        </button>
                      </li>
                    ))}
                    {!res.routes.length && <li className="py-3 text-[14px] text-slate-500">Keine wiederkehrenden Wege.</li>}
                  </ol>
                  {moreBtn("r", res.routes.length, 5)}
                </section></TabPane>
              </div>

              <TabPane on={tab === "rollen"}><Reveal>
              <section className="mt-12 max-sm:mt-5">
                <h2 className="text-[22px] font-semibold">Wer anfängt und wer entscheidet</h2>
                <p className="mb-3 mt-1 text-[14px] text-slate-500">Durchsatz je Gremium: eingehende und ausgehende Übergänge. Durchgänge verbinden Einstieg und Entscheidung.</p>
                <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 max-sm:block max-sm:border-t max-sm:border-slate-200">
                  {(!more.o ? ranked.slice(0, 6) : ranked).map((x) => (
                    <li key={x.id} className="sm:rounded-xl sm:bg-slate-50 max-sm:border-b max-sm:border-slate-200">
                      <button type="button" onClick={() => setSelected(x.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3 max-sm:py-2.5 text-left hover:bg-slate-100 sm:rounded-xl sm:px-4 sm:py-3.5">
                        <span className="truncate text-[16px] text-slate-900">{x.name}</span>
                        <span className="order-3 col-span-2 flex items-center gap-2 text-[14px] text-slate-500 max-sm:hidden"><i className="inline-block h-3 w-3 rounded-full" style={{ background: ROLE[x.role].fill, border: `2px solid ${ROLE[x.role].stroke}` }} />{ROLE[x.role].label}</span>
                        <span className="flex h-[6px] overflow-hidden rounded-full bg-slate-100 order-4 col-span-2 max-sm:order-3 max-sm:mt-1.5" style={{ width: `${Math.max(6, ((x.in + x.out) / maxFlow) * 100)}%` }}><span style={{ width: `${(x.in / Math.max(1, x.in + x.out)) * 100}%`, background: "var(--rm-ac)" }} /><span style={{ width: `${(x.out / Math.max(1, x.in + x.out)) * 100}%`, background: "var(--rm-c400)" }} /></span>
                        <span className="text-right text-[14px] tabular-nums"><b className="font-semibold text-slate-900">{n(x.in)}</b> rein · <b className="font-semibold text-slate-900">{n(x.out)}</b> raus</span>
                      </button>
                    </li>
                  ))}
                </ol>
                {moreBtn("o", ranked.length, 6)}
              </section>
              </Reveal></TabPane>
              </div>
            </>
          )}
          <MethodikNote>Grundlage sind {n(res.examined)}{res.capped ? ` gleichmäßig ausgewählte von ${n(res.pool)}` : ""} Vorgängen mit Beratung oder Entscheidung. Nur Vorgänge, die in mindestens zwei verschiedenen Gremien behandelt wurden, bilden Übergänge ({n(res.paths)}). Stationen werden nach Datum geordnet, aufeinanderfolgende Stationen im selben Gremium zählen einmal. {res.mode === "types" ? "Ohne einzelnen Ort sind die Gremien nach ihrer Art aus dem Namen zusammengefasst (zum Beispiel Haupt- und Verwaltungsausschuss), weil jeder Ort eigene Namen hat. " : "Mit einem Ort gelten dessen echte Gremiennamen. "}Wie vollständig die Stationen erfasst sind, hängt vom Ratsinformationssystem des Ortes ab; die Zeit je Übergang ist der Abstand der Sitzungstermine.</MethodikNote>
        </div>
      )}
    <XWeiter links={[["/analytics/beschluesse", "Beschlusslage"], ["/analytics/fraktionen", "Fraktionen"], ["/analytics/atlas", "plenara.X Themenatlas"]]} />
    </main>
  );
}
