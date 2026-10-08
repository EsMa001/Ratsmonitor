import Link from "next/link";
import { PageBand } from "./PageBand";
import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS } from "../../lib/constants";
import { useData } from "../../state/data";
import { LABELS } from "@/shared/labels.mjs";
import { DiffusionSearch } from "./DiffusionSearch";
import { CompareLines, PLACE_COLORS, TopicRow } from "./CompareCharts";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useSearchResults } from "../../state/search";

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

/* Beispiele mit Thema: geprüft, dass jeder Ort mindestens 30 Einträge dazu hat */
const EXAMPLES: [string, string][] = [["Schule, Köln, Dortmund", "Schule: Köln und Dortmund"], ["Haushalt, Köln, Düsseldorf, Dortmund", "Haushalt: Köln, Düsseldorf, Dortmund"], ["Bebauungsplan, Köln, Dortmund", "Bebauungsplan: Köln und Dortmund"], ["Verkehr, Köln, Düsseldorf, Dortmund", "Verkehr: Köln, Düsseldorf, Dortmund"]];
const n = (v: number) => v.toLocaleString("de-DE");
const STATUS_COLOR: Record<string, string> = { approved: "#0d9488", recommended: "#5eead4", consulting: "#99d6cf", announced: "#cbd5e1", rejected: "#0f172a", postponed: "#94a3b8", info: "#e2e8f0", unknown: "#f1f5f9" };
/* Wörter des Sitzungsbetriebs (Anfragen, Geschäftsordnung, Rollen), die eher die Schreibweise eines Ratsinformationssystems als die Themen eines Ortes zeigen */
const SITZUNGSWORT = /^(eingang|eingäng|anregung|beantwort|mündlich|absatz|gemeindeordnung|landes$|land$|geschäftsordnung|regularien|mitunterzeichn|mitwirkungsverbot|nachtrag|hinweis|angelegenheit|benennung|unbesetzt|anhörung|verpflichtung|mitglied|entscheidung|empfehlung|gruppe|ratsmitglied|berichterstatter|entgegennahme|einführung|stadtbezirk|bezirksvertretung|fraktion|unbeantwortet|ausschussmitglied|sitzung|niederschrift|tagesordnung)/;
const inhaltlich = (term: string) => !SITZUNGSWORT.test(term) && !/(fraktion|gruppe)/.test(term) && !/^(partei|wähler|früher|freie$)/.test(term);

/** Was beim Vergleich der Datenlage zu beachten ist: wenig Themenzuordnung, kaum erfasster Beschlussstatus */
function datenlage(p: Place): string[] {
  const out: string[] = [];
  const sampled = p.sampled || p.total;
  if (p.total === 0) out.push("keine Einträge");
  else if (p.total < 30) out.push(`nur ${p.total} ${p.total === 1 ? "Eintrag" : "Einträge"}, zu wenige für einen Vergleich`);
  if (sampled >= 30) {
    if (p.topics.n === 0) out.push("keinem Thema zugeordnet");
    else if (p.topics.n / sampled < 0.25) out.push(`nur ${Math.round((p.topics.n / sampled) * 100)} % einem Thema zugeordnet`);
    const share = (id: string) => p.status.list.find((x) => x.id === id)?.share ?? 0;
    if (share("approved") + share("rejected") < 1 && share("recommended") + share("consulting") + share("postponed") > 0) out.push("kaum Beschlüsse mit Ausgang erfasst");
  }
  return out;
}

const TOPIC_NAME = new Map<string, string>(LABELS.map((l: { id: string; name: string }) => [l.id, l.name]));

export function ComparePage() {
  const { geo } = useData();
  const { query, search } = useAnalyticsQuery();
  const results = useSearchResults();
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [want, setWant] = useState(false);
  const [error, setError] = useState("");
  const [perHead, setPerHead] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /* Orte aus der Suche: erster Ort (area) und weitere (more) */
  const placeCount = useMemo(() => { const p = new URLSearchParams(query); return (p.get("area") ? 1 : 0) + (p.get("more") ? p.get("more")!.split(",").filter(Boolean).length : 0); }, [query]);
  /* „(Kreis)“ nur bei echten Landkreisen; eine kreisfreie Stadt heißt einfach wie die Stadt */
  const name = (ags: string, scope: string) => { const i = geo?.info(ags); return (i?.name ?? ags) + (scope === "with" && ags.length === 5 && /^(Landkreis|Kreis|Stadtkreis) /.test(i?.meta ?? "") ? " (Kreis)" : ""); };

  useEffect(() => {
    /* wartet, bis die gewählten Orte (z. B. aus einem Beispiel) in der Suche angekommen sind */
    if (!want || placeCount < 2) return;
    setWant(false);
    setError("");
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    fetch(`/api/analytics/compare?${query}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(body.error || "Der Vergleich konnte nicht berechnet werden.");
        return body as unknown as Result;
      })
      .then((r) => { setRes(r); setRanKey(query); setLoading(false); })
      .catch((e) => { if (ctrl.signal.aborted) return; setError(e.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, placeCount]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const stale = !!res && ranKey !== query && !loading;
  const onPlay = () => {
    if (loading) return;
    if (placeCount < 2) return setError("Bitte in der Suche mindestens zwei Orte wählen, zum Beispiel „Münster, Osnabrück“.");
    setError("");
    setWant(true);
  };

  const names = res ? res.places.map((p) => name(p.ags, p.scope)) : [];
  const topicRows = useMemo(() => {
    if (!res) return [];
    return LABELS.filter((l: { id: string }) => l.id !== "unklar").map((l: { id: string; name: string }) => {
      const shares = res.places.map((p) => p.topics.list.find((t) => t.id === l.id)?.share ?? 0);
      return { id: l.id, name: l.name, shares, base: res.base.topics.list.find((t) => t.id === l.id)?.share ?? 0 };
    }).filter((r) => Math.max(...r.shares, r.base) >= 1).sort((a, b) => Math.max(...b.shares) - Math.max(...a.shares));
  }, [res]);
  const maxTopic = Math.max(5, ...topicRows.flatMap((r) => [...r.shares, r.base]));
  const lines = useMemo(() => !res ? [] : res.places.map((p, i) => ({
    color: PLACE_COLORS[i], name: names[i],
    values: res.months.map((m) => { const v = p.months.find((x) => x.m === m)?.n ?? 0; return perHead && p.population ? (v / p.population) * 1000 : v; }),
  })), [res, perHead]); // eslint-disable-line react-hooks/exhaustive-deps

  const legend = (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[14px]">
      {names.map((nm, i) => <li key={nm + i} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-full" style={{ background: PLACE_COLORS[i] }} />{nm}</li>)}
    </ul>
  );
  const cols = res ? res.places.length : 2;
  const grid = { gridTemplateColumns: `minmax(130px,1.1fr) repeat(${cols}, minmax(0,1fr))` };

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
      <p className="text-[14px] text-slate-500"><Link href="/analytics/ueber" className="text-teal-600">Plenara.X</Link> / Gebietsvergleich</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Gebietsvergleich</h1>
      <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Stellt zwei bis vier Orte nebeneinander: womit sie sich beschäftigen, wie Vorlagen ausgehen und was für den jeweiligen Ort typisch ist. Als Maßstab dienen alle Gebiete.</p>
      </PageBand>

      <div><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={onPlay} onSubmit={() => setWant(true)} startLabel="Vergleich starten" /></div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
        <span className="text-slate-500">Thema und Orte oben im Suchfeld wählen, zum Beispiel „Schule, Köln, Dortmund“ (Orte mit Komma trennen, höchstens vier). Das Thema ist optional, mit Thema wird der Vergleich aussagekräftiger.{!res && " Beispiele:"}</span>
        {!res && EXAMPLES.map(([v, l]) => <button key={v} type="button" onClick={() => { search.applySearch(v); setWant(true); }} className="text-teal-600">{l}</button>)}
      </div>
      {placeCount === 1 && !res && <p className="mt-3 text-[14px] text-slate-500">Ein Ort ist gewählt. Es braucht mindestens einen weiteren.</p>}
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche, Orte oder Filter wurden geändert. Mit dem Start-Knopf neu vergleichen.</p>}
      {loading && !res && <p className="mt-8 text-[16px] text-slate-500">Vergleich wird berechnet …</p>}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <section className="mt-10">
            <h2 className="text-[22px] font-semibold">Überblick</h2>
            <div className="mt-3 overflow-x-auto"><div className="min-w-[560px] border-t border-slate-200 text-[16px]">
              <div className="grid items-end gap-4 border-b border-slate-200 py-3" style={grid}>
                <span />
                {res.places.map((p, i) => <span key={p.ags + p.scope} className="flex items-center gap-2 font-semibold"><i className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: PLACE_COLORS[i] }} /><span className="min-w-0 truncate">{names[i]}</span></span>)}
              </div>
              {([
                ["Einträge", (p: Place) => n(p.total)],
                ["je 1.000 Einwohner", (p: Place) => (p.perThousand === null ? "–" : p.perThousand.toLocaleString("de-DE"))],
                ["Einwohner", (p: Place) => (p.population ? n(p.population) : "–")],
              ] as [string, (p: Place) => string][]).map(([k, f]) => (
                <div key={k} className="grid gap-4 border-b border-slate-200 py-3" style={grid}><span className="text-[14px] text-slate-500">{k}</span>{res.places.map((p) => <b key={p.ags + p.scope} className="font-semibold tabular-nums">{f(p)}</b>)}</div>
              ))}
              {res.places.some((p) => datenlage(p).length) && (
                <div className="grid gap-4 border-b border-slate-200 py-3" style={grid}>
                  <span className="text-[14px] text-slate-500">Datenlage</span>
                  {res.places.map((p) => { const d = datenlage(p); return <span key={p.ags + p.scope} className="text-[14px] text-slate-700">{d.length ? d.join(", ") : "ohne Auffälligkeit"}</span>; })}
                </div>
              )}
              <div className="grid gap-4 border-b border-slate-200 py-3" style={grid}>
                <span className="text-[14px] text-slate-500">Aktivste Gremien</span>
                {res.places.map((p) => <ul key={p.ags + p.scope} className="m-0 list-none p-0 text-[14px]">{p.committees.slice(0, 4).map((c) => <li key={c.name} className="mb-1 flex justify-between gap-2"><span className="min-w-0 truncate" title={c.name}>{c.name}</span><span className="tabular-nums text-slate-500">{n(c.n)}</span></li>)}{!p.committees.length && <li className="text-slate-500">–</li>}</ul>)}
              </div>
            </div></div>
          </section>

          <section className="mt-12">
            <h2 className="text-[22px] font-semibold">Themenprofil</h2>
            <p className="mb-3 mt-1 text-[14px] text-slate-500">Anteil der Themenfelder an den eingeordneten Einträgen. Die senkrechte Marke zeigt den Wert für alle Gebiete. Ein Klick auf ein Themenfeld vergleicht alle gewählten Orte nur in diesem Themenfeld (statt mit dem Suchbegriff).</p>
            {legend}
            {res.places.map((p, i) => { const d = datenlage(p).filter((x) => x.includes("Thema")); return d.length ? <p key={p.ags + p.scope} className="m-0 mt-2 text-[14px] text-slate-700"><b className="font-semibold">{names[i]}:</b> {d[0]}. Die Anteile sind deshalb nur eingeschränkt vergleichbar.</p> : null; })}
            <ol className="m-0 mt-3 list-none border-t border-slate-200 p-0">{topicRows.map((r) => <TopicRow key={r.id} name={r.name} shares={r.shares} base={r.base} max={maxTopic} onPick={() => { search.applySearch(results.liveHits.map((h) => h.phraseRaw).join(", "), { thema: r.name }); setWant(true); }} />)}</ol>
            {!topicRows.length && <p className="py-4 text-[14px] text-slate-500">Zu wenige eingeordnete Einträge für ein Themenprofil.</p>}
          </section>

          <section className="mt-12">
            <h2 className="text-[22px] font-semibold">Stand der Vorlagen</h2>
            <p className="mb-4 mt-1 text-[14px] text-slate-500">Wie die Einträge je Ort stehen (Anteile in %).</p>
            {[...res.places.map((p, i) => ({ label: names[i], list: p.status.list, color: PLACE_COLORS[i] })), { label: "Alle Gebiete", list: res.base.status.list, color: "#475569" }].map((row) => (
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
          </section>

          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-[22px] font-semibold">Verlauf</h2><p className="mt-1 text-[14px] text-slate-500">Einträge je Monat.</p></div>
              <div role="radiogroup" aria-label="Maß" className="flex gap-1 text-[14px]">
                {([[false, "Anzahl"], [true, "je 1.000 Einwohner"]] as const).map(([v, l]) => <button key={l} type="button" role="radio" aria-checked={perHead === v} onClick={() => setPerHead(v)} className={`h-8 rounded-full border px-3.5 ${perHead === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{l}</button>)}
              </div>
            </div>
            <div className="my-3">{legend}</div>
            <CompareLines months={res.months} series={lines} />
          </section>

          <section className="mt-12">
            <h2 className="text-[22px] font-semibold">Typisch für den Ort</h2>
            <p className="mb-3 mt-1 text-[14px] text-slate-500">Begriffe, die im Ort deutlich häufiger vorkommen als in allen Gebieten (Faktor in Klammern). Ortsnamen und Wörter des Sitzungsbetriebs (zum Beispiel „Anregungen“, „Beantwortung“) sind ausgenommen.</p>
            <div className="grid gap-x-8 gap-y-8" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(${cols > 2 ? 220 : 280}px,1fr))` }}>
              {res.places.map((p, i) => (
                <div key={p.ags + p.scope}>
                  <h3 className="flex items-center gap-2 text-[16px] font-semibold"><i className="inline-block h-3 w-3 rounded-full" style={{ background: PLACE_COLORS[i] }} />{names[i]}</h3>
                  <ol className="m-0 mt-2 list-none border-t border-slate-200 p-0">
                    {p.typical.filter((t) => inhaltlich(t.term)).slice(0, 10).map((t) => <li key={t.term} className="flex justify-between gap-3 border-b border-slate-200 py-2 text-[14px]"><Link href={`/analytics/trends?thema=${encodeURIComponent(t.term)}`} className="min-w-0 truncate text-slate-900 hover:text-teal-600">{t.term}</Link><span className="tabular-nums text-slate-500">×{t.ratio.toLocaleString("de-DE")}</span></li>)}
                    {!p.typical.some((t) => inhaltlich(t.term)) && <li className="py-2 text-[14px] text-slate-500">Keine auffälligen Begriffe.</li>}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          {res.common.some((c) => inhaltlich(c.term)) && (
            <section className="mt-12">
              <h2 className="text-[22px] font-semibold">Gemeinsame Begriffe</h2>
              <p className="mb-3 mt-1 text-[14px] text-slate-500">Kommen in allen gewählten Orten vor. Anteil an den Einträgen je Ort.</p>
              <ol className="m-0 list-none border-t border-slate-200 p-0">
                {res.common.filter((c) => inhaltlich(c.term)).map((c) => <li key={c.term} className="grid gap-3 border-b border-slate-200 py-2 text-[14px]" style={grid}><span className="truncate text-[16px] text-slate-900">{c.term}</span>{c.shares.map((s, i) => <span key={i} className="tabular-nums text-slate-500">{s.toLocaleString("de-DE")} %</span>)}</li>)}
              </ol>
            </section>
          )}

          <p className="mt-10 text-[12px] text-slate-500">Maßstab sind alle Gebiete der Gemeindeebene mit denselben Filtern ({n(res.base.total)} Einträge). Zahlen und Verlauf sind exakt; Themenprofil, Stand der Vorlagen, gemeinsame und typische Begriffe stammen aus einer gleichmäßigen Stichprobe von höchstens 6.000 Einträgen je Ort. „Typisch“ verlangt mindestens den 1,8-fachen Anteil und einen deutlichen Unterschied (z-Wert ab 3). Unterschiede im Datenbestand (z. B. wie vollständig ein Ratsinformationssystem erfasst ist) wirken auf die Zahlen; Einträge je 1.000 Einwohner sind deshalb ein Anhaltspunkt, kein Maß für politische Aktivität. <Link href="/analytics/ueber" className="text-teal-600">Methode →</Link></p>
        </div>
      )}
    </main>
  );
}
