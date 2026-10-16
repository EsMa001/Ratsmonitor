import Link from "next/link";
import { useState, useEffect } from "react";
import { Segmented } from "./Kennzahlen";
import { ThemenLeiste, XKopf, XWeiter } from "./XKopf";
import { Laden } from "./Laden";
import { Befund, Fehler, Leer } from "./Befund";
import { Reveal } from "./Reveal";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useAnalysisRun } from "./useAnalysisRun";

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
      <h3 className="m-0 mt-1.5 text-[20px] font-semibold leading-snug sm:text-[22px]"><Link href={`/beschluss/${i.id}`} className="text-slate-900 no-underline hover:text-teal-800">{i.headline}</Link></h3>
      <p className="m-0 mt-3 max-w-[820px] text-[16px] leading-relaxed text-slate-900">
        {i.lead} In der Vorlage heißt es: <q>{i.quote}</q>
        {i.more && <> Weiter heißt es dort: <q>{i.more}</q></>}
        {i.body.length > 0 && <> {i.body.join(" ")}</>}
      </p>
      <p className="m-0 mt-3 text-[12px] text-slate-500">Quelle: {i.source} · {HINWEIS}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href={`/beschluss/${i.id}`} className="text-[14px] font-medium text-teal-700 no-underline">Zum Vorgang →</Link>
        <button type="button" onClick={copy} className="text-[14px] font-medium text-teal-700">{copied ? "Kopiert" : "Meldung kopieren"}</button>
        <span className="text-[12px] text-slate-500"><span className="sr-only">Nachrichtenwert </span>Wert {i.score}: {i.why.join(" · ")}</span>
      </div>
    </article>
  );
}

/** plenara.X – Newsradar: berichtenswerte Vorgänge der letzten 30 und nächsten 10 Tage als Meldung mit Zitat und Quelle */
export function NewsradarPage() {
  const { query } = useAnalyticsQuery();
  const [days, setDays] = useState(30);
  const { res, loading, error, stale, run } = useAnalysisRun<Result>({ key: `${query}&days=${days}`, url: `/api/analytics/news?${query}&days=${days}`, initial: true });
  /* Wie Trends und Signale: geänderte Suche oder Filter rechnen nach kurzer Pause von selbst neu */
  useEffect(() => {
    if (!stale || loading) return;
    const tm = setTimeout(() => run(), 400);
    return () => clearTimeout(tm);
  }, [stale, loading, run]);

  const own = !!new URLSearchParams(query).get("from");

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <XKopf seite="news" />

      <ThemenLeiste />
      <div className="print:hidden"><DiffusionSearch noPlay play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} /></div>
      <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden" role="group" aria-label="Zeitraum">
        {own ? (
          <p className="m-0 text-[14px] text-slate-700">Zeitraum aus dem Filter{res?.own ? `: ${datum(res.from)} bis ${datum(res.to)}` : ""}</p>
        ) : (
          <>
            <Segmented label="Zeitraum" options={SPANS.map(([d, l]) => [String(d), l] as [string, string])} value={String(days)} onPick={(k) => setDays(+k)} />
            <span className="text-[12px] text-slate-500">und die nächsten 10 Tage</span>
          </>
        )}
      </div>
      {error && <Fehler>{error}</Fehler>}
      {loading && !res && <Laden text="Vorgänge werden bewertet …" />}

      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {res.items.length === 0 ? <Leer tipp="Einen längeren Zeitraum wählen oder den Suchbegriff kürzen; gezeigt werden nur Vorgänge mit zitierbarer Zusammenfassung.">Keine berichtenswerten Vorgänge in diesem Zeitraum.</Leer> : (
            <>
              <Befund>{`Von ${n(res.totals.considered)} Sachvorgängen zwischen ${datum(res.from)} und ${datum(res.to)} zeigt die Seite die ${res.items.length} mit dem höchsten Nachrichtenwert, höchstens ${res.rule.perRegion} je Gebiet.`}</Befund>
              <Reveal><section className="mt-6 border-t border-slate-200">
                {res.items.map((i) => <Meldung key={i.id} i={i} />)}
              </section></Reveal>
              <p className="mt-10 max-w-[900px] text-[12px] text-slate-500">Nachrichtenwert nach festen Regeln: Konflikt (abgelehnt, vertagt, nur mit Mehrheit beschlossen), Tragweite (Fördergeld, Kita-Beiträge, Gebühren, Steuern, Bürgerbegehren), Alltagsnähe des Themas und Aktualität. Der Kern jeder Meldung ist ein wörtliches Zitat aus der Regel-Zusammenfassung der Vorlage; Gremium, Datum und Ausgang stammen aus den Sitzungsdaten. Vorgänge ohne zitierbaren Satz erscheinen nicht. <Link href="/analytics/methodik" className="text-teal-700">Methode →</Link></p>
            </>
          )}
        </div>
      )}
    <XWeiter links={[["/analytics/signale", "plenara.X Signale"], ["/analytics/trends", "plenara.X Trends"]]} />
    </main>
  );
}
