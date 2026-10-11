import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { Befund } from "./Befund";
import { Reveal } from "./Reveal";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";

interface Item {
  id: string; region: string; place: string; headline: string;
  dateline: { place: string; committee: string; date: string };
  lead: string; quote: string; more: string; body: string[]; source: string; score: number; why: string[];
}
interface Result {
  q: string; from: string; to: string; own: boolean;
  totals: { considered: number; read: number; quotable: number };
  items: Item[];
  rule: { back: number; ahead: number; perRegion: number; candidates: number };
}

const n = (v: number) => v.toLocaleString("de-DE");
const datum = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("de-DE");
const HINWEIS = "Automatisch aus Ratsunterlagen erstellt, nicht redaktionell geprüft.";
/* Schnellwahl des Zeitraums (Tage zurück); ein Zeitraum im Filter geht vor */
const SPANS: [number, string][] = [[30, "Letzte 30 Tage"], [90, "90 Tage"], [365, "12 Monate"]];

/** Meldung als Text zum Kopieren: Überschrift, Ortsmarke, Text, Quelle */
function asText(i: Item) {
  const link = typeof window === "undefined" ? `/beschluss/${i.id}` : `${window.location.origin}/beschluss/${i.id}`;
  return [i.headline, "", [i.lead, `In der Vorlage heißt es: „${i.quote}“`, i.more ? `Weiter heißt es dort: „${i.more}“` : "", ...i.body].filter(Boolean).join(" "), "", `Quelle: ${i.source}, ${link}`, HINWEIS].join("\n");
}

function Meldung({ i }: { i: Item }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(asText(i)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  };
  return (
    <article className="border-b border-slate-200 py-7">
      <p className="m-0 text-[12px] text-slate-500">{i.dateline.place}{i.dateline.committee ? ` · ${i.dateline.committee}` : ""} · {datum(i.dateline.date)}</p>
      <h3 className="m-0 mt-1.5 text-[20px] font-semibold leading-snug sm:text-[22px]"><a href={`/beschluss/${i.id}`} className="text-slate-900 no-underline hover:text-teal-700">{i.headline}</a></h3>
      <p className="m-0 mt-3 max-w-[820px] text-[16px] leading-relaxed text-slate-900">
        {i.lead} In der Vorlage heißt es: <q>{i.quote}</q>
        {i.more && <> Weiter heißt es dort: <q>{i.more}</q></>}
        {i.body.length > 0 && <> {i.body.join(" ")}</>}
      </p>
      <p className="m-0 mt-3 text-[12px] text-slate-500">Quelle: {i.source} · {HINWEIS}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href={`/beschluss/${i.id}`} className="text-[14px] font-medium text-teal-600 no-underline">Zum Vorgang →</a>
        <button type="button" onClick={copy} className="text-[14px] font-medium text-teal-600">{copied ? "Kopiert" : "Meldung kopieren"}</button>
        <span className="text-[12px] text-slate-500"><span className="sr-only">Nachrichtenwert </span>Wert {i.score}: {i.why.join(" · ")}</span>
      </div>
    </article>
  );
}

/** plenara.X – Newsradar: berichtenswerte Vorgänge der letzten 30 und nächsten 10 Tage als Meldung mit Zitat und Quelle */
export function NewsradarPage() {
  const { query } = useAnalyticsQuery();
  const [res, setRes] = useState<Result | null>(null);
  const [ranKey, setRanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [want, setWant] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!want) return;
    setWant(false);
    setError("");
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    const key = `${query}&days=${days}`;
    fetch(`/api/analytics/news?${key}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(body.error || "Die Auswertung konnte nicht berechnet werden.");
        return body as unknown as Result;
      })
      .then((r) => { setRes(r); setRanKey(key); setLoading(false); })
      .catch((e) => { if (ctrl.signal.aborted) return; setError(e.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);
  useEffect(() => () => abortRef.current?.abort(), []);
  const stale = !!res && ranKey !== `${query}&days=${days}` && !loading;
  const own = !!new URLSearchParams(query).get("from");

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
        <p className="text-[14px] text-slate-500"><Link href="/analytics/politik" className="text-teal-600">plenara.X Politik</Link> / Newsradar</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Newsradar</h1>
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Was in den Räten gerade berichtenswert ist: Vorgänge der letzten Wochen und der nächsten 10 Tage, nach Nachrichtenwert geordnet, je Vorgang eine Meldung mit wörtlichem Zitat aus der Vorlage und Quelle.</p>
      </PageBand>

      <div className="print:hidden"><DiffusionSearch play={loading ? "loading" : "idle"} onPlay={() => !loading && setWant(true)} onSubmit={() => setWant(true)} startLabel="Auswerten" /></div>
      <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden" role="group" aria-label="Zeitraum">
        {own ? (
          <p className="m-0 text-[14px] text-slate-700">Zeitraum aus dem Filter{res?.own ? `: ${datum(res.from)} bis ${datum(res.to)}` : ""}</p>
        ) : (
          <>
            <span className="text-[14px] text-slate-500">Zeitraum:</span>
            {SPANS.map(([d, label]) => (
              <button key={d} type="button" aria-pressed={days === d} disabled={loading} onClick={() => { if (d !== days) { setDays(d); setWant(true); } }}
                className={`h-9 rounded-full border px-4 text-[14px] transition-colors ${days === d ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}>{label}</button>
            ))}
            <span className="text-[12px] text-slate-500">und die nächsten 10 Tage</span>
          </>
        )}
      </div>
      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {stale && <p className="mt-3 text-[14px] text-slate-500">Suche oder Filter wurden geändert. Mit dem Start-Knopf neu auswerten.</p>}
      {loading && !res && <Laden text="Vorgänge werden bewertet …" />}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {res.items.length === 0 ? <p className="mt-10 text-[16px]">Für diese Suche gibt es im Zeitraum keinen Vorgang mit zitierbarer Zusammenfassung.</p> : (
            <>
              <Befund>{`Von ${n(res.totals.considered)} Sachvorgängen zwischen ${datum(res.from)} und ${datum(res.to)} zeigt das Newsradar die ${res.items.length} mit dem höchsten Nachrichtenwert, höchstens ${res.rule.perRegion} je Gebiet.`}</Befund>
              <Reveal><section className="mt-6 border-t border-slate-200">
                {res.items.map((i) => <Meldung key={i.id} i={i} />)}
              </section></Reveal>
              <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Nachrichtenwert nach festen Regeln: Konflikt (abgelehnt, vertagt, nur mit Mehrheit beschlossen), Tragweite (Fördergeld, Kita-Beiträge, Gebühren, Steuern, Bürgerbegehren), Alltagsnähe des Themas und Aktualität. Der Kern jeder Meldung ist ein wörtliches Zitat aus der Regel-Zusammenfassung der Vorlage; Gremium, Datum und Ausgang stammen aus den Sitzungsdaten. Vorgänge ohne zitierbaren Satz erscheinen nicht. <Link href="/analytics/ueber#methodik" className="text-teal-600">Methode →</Link></p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
