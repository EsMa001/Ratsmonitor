import Link from "next/link";
import { prettyTerm } from "../../lib/terms";
import { Segmented } from "./Kennzahlen";
import { XKopf, XWeiter } from "./XKopf";
import { Laden } from "./Laden";
import { Befund } from "./Befund";
import { Reveal } from "./Reveal";
import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS } from "../../lib/constants";
import { useData } from "../../state/data";
import { LABELS } from "@/shared/labels.mjs";
import { FIELD, PlaceField } from "./CompareFields";
import type { PlaceEntry } from "../../lib/place";
import { CompareLines, PLACE_COLORS, TopicPair } from "./CompareCharts";
import { RadarDrill } from "./RadarDrill";
import { todayLocal } from "../../lib/text";
import { errorText, fetchJson } from "../../lib/fetchJson";

interface Share { id: string; n: number; share: number }
interface Place {
  ags: string; scope: string; population: number | null; total: number; sampled: number; capped: boolean; perThousand: number | null;
  topics: { n: number; list: Share[] }; status: { n: number; list: Share[] };
  committees: { name: string; n: number }[]; months: { m: string; n: number }[];
  typical: { term: string; n: number; share: number; base: number; ratio: number; z: number }[];
}
interface Result {
  q: string; places: Place[]; months: string[];
  common: { term: string; shares: number[] }[];
  base: { total: number; sampled: number; topics: { n: number; list: Share[] }; status: { n: number; list: Share[] } };
}

/* Voreinstellung und Schnellwahl: Ortspaare mit gut gefülltem Datenbestand (ohne Thema) */
const ORT = { koeln: { ags: "05315", name: "Köln" }, dortmund: { ags: "05913", name: "Dortmund" }, duesseldorf: { ags: "05111", name: "Düsseldorf" } };
const asPlace = (o: { ags: string; name: string }): PlaceEntry => ({ ags: o.ags, name: o.name, kind: "stadt", n: o.name.toLowerCase() });
const n = (v: number) => v.toLocaleString("de-DE");
const STATUS_COLOR: Record<string, string> = { approved: "#0d9488", recommended: "#5eead4", consulting: "#99d6cf", announced: "#cbd5e1", rejected: "#0f172a", postponed: "#94a3b8", info: "#e2e8f0", unknown: "#f1f5f9" };
/* Wörter des Sitzungsbetriebs (Anfragen, Geschäftsordnung, Rollen), die eher die Schreibweise eines Ratsinformationssystems als die Themen eines Ortes zeigen */
const SITZUNGSWORT = /^(eingang|eingäng|anregung|beantwort|mündlich|absatz|gemeindeordnung|landes$|land$|geschäftsordnung|regularien|mitunterzeichn|mitwirkungsverbot|nachtrag|hinweis|angelegenheit|benennung|unbesetzt|anhörung|verpflichtung|mitglied|entscheidung|empfehlung|gruppe|ratsmitglied|berichterstatter|entgegennahme|einführung|stadtbezirk|bezirksvertretung|fraktion|unbeantwortet|ausschussmitglied|sitzung|niederschrift|tagesordnung)/;
const inhaltlich = (term: string) => !SITZUNGSWORT.test(term) && !/(fraktion|gruppe)/.test(term) && !/^(partei|wähler|früher|freie$)/.test(term);

/** Was beim Vergleich der Datenlage zu beachten ist: wenig Themenzuordnung, kaum erfasster Beschlussstatus */
function datenlage(p: Place): string[] {
  const out: string[] = [];
  const sampled = p.sampled || p.total;
  if (p.total === 0) out.push("keine Vorgänge");
  else if (p.total < 30) out.push(`nur ${p.total} ${p.total === 1 ? "Vorgang" : "Vorgänge"}, zu wenige für einen Vergleich`);
  if (sampled >= 30) {
    if (p.topics.n === 0) out.push("keinem Thema zugeordnet");
    else if (p.topics.n / sampled < 0.25) out.push(`nur ${Math.round((p.topics.n / sampled) * 100)} % einem Thema zugeordnet`);
    const share = (id: string) => p.status.list.find((x) => x.id === id)?.share ?? 0;
    if (share("approved") + share("rejected") < 1 && share("recommended") + share("consulting") + share("postponed") > 0) out.push("kaum Beschlüsse mit Ausgang erfasst");
  }
  return out;
}

export function ComparePage() {
  const { geo } = useData();
  /* Vom Atlas mit gewähltem Ort (?ort=): dieser Ort ist Ort 1, verglichen mit Köln (bzw. Dortmund); sonst Köln und Dortmund */
  const [von] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("ort") ?? "").match(/^\d{5,9}$/)?.[0] ?? "");
  const [ort1, setOrt1] = useState<PlaceEntry | null>(() => (von ? asPlace({ ags: von, name: geo?.info(von)?.name ?? "" }) : asPlace(ORT.koeln)));
  const [ort2, setOrt2] = useState<PlaceEntry | null>(() => asPlace(von === ORT.koeln.ags ? ORT.dortmund : von ? ORT.koeln : ORT.dortmund));
  /* Name des mitgebrachten Orts, sobald die Gebiete geladen sind */
  if (ort1 && !ort1.name && geo?.info(ort1.ags)) setOrt1(asPlace({ ags: ort1.ags, name: geo.info(ort1.ags)!.name }));
  const [thema, setThema] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  /* Beim Öffnen gleich vergleichen, wenn zwei verschiedene Orte vorbelegt sind */
  const [opening] = useState(() => !!ort1 && !!ort2 && ort1.ags !== ort2.ags);
  const [loading, setLoading] = useState(opening);
  const [error, setError] = useState("");
  const [perHead, setPerHead] = useState(false);
  /* Geöffnete Liste hinter einer Zahl: Abschnitt (at), Art (all, label, committee, term), Wert und die Orte (Index) */
  const [drill, setDrill] = useState<{ at: string; by: string; value: string; label: string; idx: number[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const buildQuery = (a: PlaceEntry | null, b: PlaceEntry | null, t: string) =>
    a && b ? new URLSearchParams({ q: t.trim(), area: a.ags, label: "", month: "", from: "", to: todayLocal(), scope: "only", status: "", level: "city", more: b.ags + ":only" }).toString() : "";
  const query = buildQuery(ort1, ort2, thema);
  /* „(Kreis)“ nur bei echten Landkreisen; eine kreisfreie Stadt heißt einfach wie die Stadt */
  const name = (ags: string) => { const i = geo?.info(ags); return (i?.name ?? ags) + (ags.length === 5 && /^(Landkreis|Kreis|Stadtkreis) /.test(i?.meta ?? "") ? " (Kreis)" : ""); };

  const run = (a = ort1, b = ort2, t = thema) => {
    if (!a || !b) return setError("Bitte beide Orte wählen.");
    if (a.ags === b.ags) return setError("Bitte zwei verschiedene Orte wählen.");
    setError("");
    setLoading(true);
    fetchCompare(buildQuery(a, b, t));
  };
  /* Nur der Abruf (setzt erst mit der Antwort Zustand), auch für den Start beim Öffnen */
  const fetchCompare = (q: string) => {
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    fetchJson<Result>(`/api/analytics/compare?${q}`, { signal: ctrl.signal }, "Der Vergleich konnte nicht berechnet werden.")
      .then((r) => { setRes(r); setRanKey(q); setDrill(null); setLoading(false); })
      .catch((e) => { if (ctrl.signal.aborted) return; setError(errorText(e, "Die Auswertung konnte nicht berechnet werden.")); setLoading(false); });
  };
  /* Beim Öffnen sofort mit den vorbelegten Orten vergleichen, damit die Seite nicht leer ist */
  useEffect(() => { if (opening) fetchCompare(query); return () => abortRef.current?.abort(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stale = !!res && ranKey !== query && !loading;

  const names = res ? res.places.map((p) => name(p.ags)) : [];
  const topicRows = useMemo(() => {
    if (!res) return [];
    /* Anteile an den Vorgängen mit Thema: „Noch nicht eingeordnet“ (auch Formalien und Sammelpunkte, die kein Thema haben)
       zählt nicht mit */
    const aus = new Set(["unklar"]);
    const shareOf = (t: { list: Share[] }, id: string) => {
      const total = t.list.filter((x) => !aus.has(x.id)).reduce((sum, x) => sum + x.n, 0);
      return total ? ((t.list.find((x) => x.id === id)?.n ?? 0) / total) * 100 : 0;
    };
    return LABELS.filter((l: { id: string }) => !aus.has(l.id)).map((l: { id: string; name: string }) => ({
      id: l.id, name: l.name, shares: res.places.map((p) => shareOf(p.topics, l.id)), base: shareOf(res.base.topics, l.id),
    })).filter((r) => Math.max(...r.shares, r.base) >= 1).sort((a, b) => Math.max(...b.shares) - Math.max(...a.shares));
  }, [res]);
  const maxTopic = Math.max(5, ...topicRows.flatMap((r) => [...r.shares, r.base]));
  const pick = (at: string, by: string, value: string, label: string, idx: number[]) =>
    setDrill(drill && drill.at === at && drill.by === by && drill.value === value && drill.idx.join() === idx.join() ? null : { at, by, value, label, idx });
  const isOpen = (at: string, by: string, value: string, i?: number) => !!drill && drill.at === at && drill.by === by && drill.value === value && (i === undefined || drill.idx.includes(i));
  const drillAt = (at: string) => res && drill && drill.at === at ? (
    <div className={`mt-3 grid gap-4 ${drill.idx.length > 1 ? "md:grid-cols-2" : ""}`}>
      {drill.idx.map((i) => <RadarDrill key={i} base={`/api/analytics/compare?place=${res.places[i].ags}`} query={ranKey} by={drill.by} value={drill.value} label={`${names[i]}: ${drill.label}`} />)}
    </div>
  ) : null;
  const linkCls = (on: boolean) => `text-left hover:text-teal-800 hover:underline ${on ? "text-teal-700 underline" : ""}`;
  const lines = useMemo(() => !res ? [] : res.places.map((p, i) => ({
    color: PLACE_COLORS[i], name: names[i],
    values: res.months.map((m) => { const v = p.months.find((x) => x.m === m)?.n ?? 0; return perHead && p.population ? (v / p.population) * 1000 : v; }),
  })), [res, perHead]); // eslint-disable-line react-hooks/exhaustive-deps

  const legend = (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[14px]">
      {names.map((nm, i) => <li key={nm + i} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-full" style={{ background: PLACE_COLORS[i] }} />{nm}</li>)}
    </ul>
  );
  /* Beschriftung, zwei Orte, Unterschied */
  const rowCls = "grid grid-cols-2 gap-x-4 gap-y-1 border-b border-slate-200 py-3 md:grid-cols-[minmax(130px,1.1fr)_repeat(2,minmax(0,1fr))_minmax(120px,.8fr)] md:gap-y-0";
  /* Unterschied zweier Zahlen: wer mehr hat und um welchen Faktor */
  const diff = (a: number | null, b: number | null) => {
    if (!a || !b) return "–";
    const r = Math.max(a, b) / Math.min(a, b);
    return r < 1.2 ? "ähnlich" : `${a > b ? names[0] : names[1]}: ${r.toLocaleString("de-DE", { maximumFractionDigits: 1 })}-fach`;
  };

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <XKopf seite="vergleich" />

      <section aria-label="Vergleich einstellen" className="print:hidden mt-2 border-b border-slate-200 pb-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <PlaceField label="Ort 1" color={PLACE_COLORS[0]} value={ort1} onChange={setOrt1} onEnter={() => run()} />
          <PlaceField label="Ort 2" color={PLACE_COLORS[1]} value={ort2} onChange={setOrt2} onEnter={() => run()} />
          <div className="min-w-0">
            <label htmlFor="vergleich-thema" className="mb-1.5 block text-[14px] font-medium text-slate-700">Thema <span className="font-normal text-slate-500">(optional)</span></label>
            <input id="vergleich-thema" type="search" value={thema} onChange={(e) => setThema(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") run(); }} placeholder="beliebiger Begriff" className={FIELD} />
          </div>
          <button type="button" onClick={() => run()} disabled={loading} aria-label={loading ? "Wird berechnet" : "Vergleichen"} title="Vergleichen" className="inline-flex h-11 w-11 items-center justify-center justify-self-end rounded-full bg-slate-900 text-white transition-opacity hover:opacity-85 disabled:opacity-60 md:justify-self-auto">{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" /></svg>}</button>
        </div>
      </section>
      {error && <p role="alert" className="mt-4 text-[14px] font-medium text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Orte oder Thema wurden geändert. Mit „Vergleichen“ neu berechnen.</p>}
      {loading && !res && <Laden text="Vergleich wird berechnet …" />}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {(() => {
            const [a, b] = res.places; const x = a?.perThousand, y = b?.perThousand;
            if (!a || !b || !x || !y) return null;
            const hi = x >= y, r = Math.round((Math.max(x, y) / Math.min(x, y)) * 10) / 10;
            return <Befund>{names[hi ? 0 : 1]} berät je 1.000 Einwohner {r <= 1.1 ? "etwa so viel wie" : `${r.toLocaleString("de-DE")}-mal so viel wie`} {names[hi ? 1 : 0]}.</Befund>;
          })()}
          <Reveal>
          <section className="mt-10">
            <h2 className="text-[22px] font-semibold">Überblick</h2>
            <div className="mt-3"><div className="border-t border-slate-200 text-[16px]">
              <div className={rowCls + " items-end"}>
                <span className="hidden md:block" />
                {res.places.map((p, i) => <span key={p.ags + p.scope} className="flex items-center gap-2 font-semibold"><i className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: PLACE_COLORS[i] }} /><span className="min-w-0 truncate">{names[i]}</span></span>)}
                <span className="hidden text-[14px] text-slate-500 md:block">Unterschied</span>
              </div>
              {([
                ["Vorgänge", (p: Place) => n(p.total), (p: Place) => p.total],
                ["je 1.000 Einwohner", (p: Place) => (p.perThousand === null ? "–" : p.perThousand.toLocaleString("de-DE")), (p: Place) => p.perThousand],
                ["Einwohner", (p: Place) => (p.population ? n(p.population) : "–"), (p: Place) => p.population],
              ] as [string, (p: Place) => string, (p: Place) => number | null][]).map(([k, f, num]) => (
                <div key={k} className={rowCls}><span className="col-span-2 text-[14px] text-slate-500 md:col-span-1">{k}</span>{res.places.map((p, i) => k === "Vorgänge" ? <button key={p.ags + p.scope} type="button" onClick={() => pick("overview", "all", "", "alle Vorgänge", [i])} aria-expanded={isOpen("overview", "all", "", i)} className={`font-semibold tabular-nums ${linkCls(isOpen("overview", "all", "", i))}`}>{f(p)}</button> : <b key={p.ags + p.scope} className="font-semibold tabular-nums">{f(p)}</b>)}<span className="col-span-2 text-[14px] text-slate-700 md:col-span-1"><span className="md:hidden">Unterschied: </span>{diff(num(res.places[0]), num(res.places[1]))}</span></div>
              ))}
              <div className={rowCls}>
                <span className="col-span-2 text-[14px] text-slate-500 md:col-span-1">Aktivste Gremien</span>
                {res.places.map((p, i) => <ul key={p.ags + p.scope} className="m-0 list-none p-0 text-[14px]">{p.committees.slice(0, 4).map((c) => <li key={c.name} className="mb-1 flex justify-between gap-2"><button type="button" onClick={() => pick("overview", "committee", c.name, c.name, [i])} aria-expanded={isOpen("overview", "committee", c.name, i)} className={`min-w-0 truncate ${linkCls(isOpen("overview", "committee", c.name, i))}`} title={c.name}>{c.name}</button><span className="tabular-nums text-slate-500">{n(c.n)}</span></li>)}{!p.committees.length && <li className="text-slate-500">–</li>}</ul>)}
                <span className="hidden md:block" />
              </div>
            </div></div>
            {drillAt("overview")}
            {res.places.some((p) => p.total < 30) && (
              <p role="status" className="m-0 mt-3 text-[14px] font-medium text-slate-900">Zu wenige Vorgänge für einen belastbaren Vergleich: {res.places.map((p, i) => ({ p, i })).filter(({ p }) => p.total < 30).map(({ p, i }) => `${names[i]} (${p.total})`).join(", ")}. Ein weiter gefasstes oder gar kein Thema hilft.</p>
            )}
            <p className="m-0 mt-3 text-[12px] text-slate-500">Der Unterschied bei den Vorgängen zeigt auch, wie vollständig die Quellen der beiden Orte sind. Er ist kein Maß für politische Aktivität.</p>
          </section>
          </Reveal>

          <Reveal>
          <section className="mt-12">
            <h2 className="text-[22px] font-semibold">Themenprofil</h2>
            <p className="mb-3 mt-1 text-[14px] text-slate-500">Anteil der Themen an den Vorgängen mit Thema; Formalien und noch nicht eingeordnete Vorgänge zählen nicht mit. Die senkrechte Marke zeigt den Wert für alle Gebiete.</p>
            {res.places.map((p, i) => { const d = datenlage(p).filter((x) => x.includes("Thema")); return d.length ? <p key={p.ags + p.scope} className="m-0 mt-3 border-l-2 border-slate-900 pl-3 text-[16px] text-slate-900"><b className="font-semibold">{names[i]}:</b> {d[0]}. Die Anteile sind deshalb nur eingeschränkt vergleichbar.</p> : null; })}
            {legend}
            <ol className="m-0 mt-3 list-none border-t border-slate-200 p-0">{topicRows.map((r) => <TopicPair key={r.id} name={r.name} a={r.shares[0]} b={r.shares[1]} base={r.base} max={maxTopic} onPick={() => pick("topics", "label", r.id, r.name, [0, 1])} />)}</ol>
            {!topicRows.length && <p className="py-4 text-[14px] text-slate-500">Zu wenige eingeordnete Vorgänge für ein Themenprofil.</p>}
            {drillAt("topics")}
          </section>
          </Reveal>

          <Reveal>
          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-[22px] font-semibold">Verlauf</h2><p className="mt-1 text-[14px] text-slate-500">Vorgänge je Monat.</p></div>
              <Segmented label="Maß" options={[["anzahl", "Anzahl"], ["kopf", "je 1.000 Einwohner"]]} value={perHead ? "kopf" : "anzahl"} onPick={(k) => setPerHead(k === "kopf")} />
            </div>
            <div className="my-3">{legend}</div>
            <CompareLines months={res.months} series={lines} />
          </section>
          </Reveal>

          {(() => {
            const typ = res.places.map((p) => p.typical.filter((t) => inhaltlich(t.term)).slice(0, 8));
            const com = res.common.filter((c) => inhaltlich(c.term)).slice(0, 10);
            const list = "m-0 mt-2 list-none border-t border-slate-200 p-0";
            const row = "flex justify-between gap-3 border-b border-slate-200 py-2 text-[14px]";
            const only = (i: number) => (
              <div>
                <h3 className="flex items-center gap-2 text-[16px] font-semibold"><i className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: PLACE_COLORS[i] }} /><span className="min-w-0 truncate">Typisch für {names[i]}</span></h3>
                <ol className={list}>
                  {typ[i].map((t) => <li key={t.term} className={row}><button type="button" onClick={() => pick("terms", "term", t.term, `„${prettyTerm(t.term)}“`, [i])} aria-expanded={isOpen("terms", "term", t.term, i)} className={`min-w-0 truncate text-slate-900 ${linkCls(isOpen("terms", "term", t.term, i))}`}>{prettyTerm(t.term)}</button><span className="tabular-nums text-slate-500">×{t.ratio.toLocaleString("de-DE")}</span></li>)}
                  {!typ[i].length && <li className="py-2 text-[14px] text-slate-500">Keine auffälligen Begriffe.</li>}
                </ol>
              </div>
            );
            return (
              <section className="mt-12">
                <h2 className="text-[22px] font-semibold">Begriffe im Vergleich</h2>
                <p className="mb-4 mt-1 text-[14px] text-slate-500">Links und rechts: Begriffe, die im jeweiligen Ort deutlich häufiger vorkommen als in allen Gebieten (Faktor in Klammern). Ein Klick auf einen Begriff, ein Thema, ein Gremium oder die Zahl der Vorgänge zeigt die Vorgänge dahinter. In der Mitte: Begriffe, die in beiden Orten vorkommen (Anteil an den Vorgängen je Ort). Ortsnamen und Wörter des Sitzungsbetriebs (zum Beispiel „Anregungen“, „Beantwortung“) sind ausgenommen.</p>
                <div className="grid gap-x-8 gap-y-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
                  {only(0)}
                  <div className="md:order-none">
                    <h3 className="text-[16px] font-semibold">In beiden Orten</h3>
                    <ol className={list}>
                      {com.map((c) => <li key={c.term} className={row}><button type="button" onClick={() => pick("terms", "term", c.term, `„${prettyTerm(c.term)}“`, [0, 1])} aria-expanded={isOpen("terms", "term", c.term)} className={`min-w-0 truncate text-slate-900 ${linkCls(isOpen("terms", "term", c.term) && drill!.idx.length > 1)}`}>{prettyTerm(c.term)}</button><span className="flex shrink-0 items-center gap-2 tabular-nums text-slate-600">{c.shares.map((v, k) => <span key={k} className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: PLACE_COLORS[k] }} />{v.toLocaleString("de-DE")} %</span>)}</span></li>)}
                      {!com.length && <li className="py-2 text-[14px] text-slate-500">Keine gemeinsamen Begriffe.</li>}
                    </ol>
                  </div>
                  {only(1)}
                </div>
                {drillAt("terms")}
              </section>
            );
          })()}

          <Reveal>
          <details className="group mt-12 border-t border-slate-200 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[22px] font-semibold [&::-webkit-details-marker]:hidden">
              Details
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <p className="mb-1 mt-2 text-[14px] text-slate-500">Datenlage der beiden Orte und Stand der Vorlagen.</p>
            <div className="mt-5">
              <h3 className="text-[18px] font-semibold">Datenlage</h3>
              <p className="mb-2 mt-1 text-[14px] text-slate-500">Was beim Vergleich zu beachten ist: Wie gut die Quellen der Orte gefüllt und eingeordnet sind.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {res.places.map((p, i) => { const d = datenlage(p); return (
                  <div key={p.ags + p.scope} className="rounded-[14px] border border-slate-200 p-4">
                    <h4 className="m-0 flex items-center gap-2 text-[16px] font-semibold"><i className="inline-block h-3 w-3 rounded-full" style={{ background: PLACE_COLORS[i] }} />{names[i]}</h4>
                    <p className="m-0 mt-2 text-[14px] text-slate-700">{d.length ? d.join(", ") : "ohne Auffälligkeit"}</p>
                  </div>
                ); })}
              </div>
            </div>
          <div className="mt-8">
            <h3 className="text-[18px] font-semibold">Stand der Vorlagen</h3>
            <p className="mb-4 mt-1 text-[14px] text-slate-500">Wie die Vorgänge je Ort stehen (Anteile in %).</p>
            {[...res.places.map((p, i) => ({ label: names[i], list: p.status.list, color: PLACE_COLORS[i] })), { label: "Alle Gebiete", list: res.base.status.list, color: "var(--rm-c600,#475569)" }].map((row) => (
              <div key={row.label} className="mb-3 grid items-center gap-3 sm:grid-cols-[200px_1fr]">
                <span className="flex items-center gap-2 text-[14px]"><i className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} /><span className="truncate">{row.label}</span></span>
                <span className="flex h-[14px] w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Stand der Vorlagen in ${row.label}`}>
                  {row.list.map((s) => s.share > 0 && <span key={s.id} title={`${STATUS.find((x) => x.id === s.id)?.label ?? s.id}: ${s.share} %`} style={{ width: `${s.share}%`, background: STATUS_COLOR[s.id] }} />)}
                </span>
              </div>
            ))}
            <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px] text-slate-700">
              {STATUS.map((s) => <li key={s.id} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: STATUS_COLOR[s.id] }} />{s.label}</li>)}
            </ul>
          </div>
          </details>
          </Reveal>

          <p className="mt-10 text-[12px] text-slate-500">Maßstab sind alle Gebiete der Gemeindeebene mit denselben Filtern ({n(res.base.total)} Vorgänge). Jeder Ort zählt nur seinen eigenen Rat (eine Gemeinde ohne Kreistag, ein Kreis ohne seine Gemeinden); derselbe Titel in mehreren Gremien zählt einmal, einzeln geführte Einwohnerfragen und Besetzungen zählen nicht. Alle Zahlen zählen alle passenden Vorgänge; Gremien aus den Stationen jedes Vorgangs. „Typisch“ verlangt mindestens den 1,8-fachen Anteil und einen deutlichen Unterschied (z-Wert ab 3). Unterschiede im Datenbestand (z. B. wie vollständig ein Ratsinformationssystem erfasst ist) wirken auf die Zahlen; Vorgänge je 1.000 Einwohner sind deshalb ein Anhaltspunkt, kein Maß für politische Aktivität. <Link href="/analytics/ueber" className="text-teal-700">Methode →</Link></p>
        </div>
      )}
    <XWeiter links={[["/analytics/fraktionen", "Fraktionen"], ["/analytics/gremien", "Gremien"]]} />
    </main>
  );
}
