import { ShareButton } from "../../components/ShareButton";
import { busyProps, HERO_MAIN, HERO_PANEL } from "./XBusy";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Segmented, Folgen, useOrtInAdresse } from "./Kennzahlen";
import { useSearch } from "../../state/search";
import { ThemenLeiste, XKopf, XWeiter } from "./XKopf";
import { ListSkeleton } from "./ListSkeleton";
import { SplitHandle } from "./SplitHandle";
import { Laden } from "./Laden";
import { Befund, Fehler, Leer } from "./Befund";
import { Reveal } from "./Reveal";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { useAnalysisRun } from "./useAnalysisRun";
import { MethodikNote } from "./Methodik";

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

function Meldung({ i, hide, nr, total }: { i: Item; hide?: boolean; nr: number; total: number }) {
  const [copied, setCopied] = useState(false);
  /* Handy: Überschrift, Satz und Zitat; der Rest hinter „Weiterlesen“ */
  const [weiter, setWeiter] = useState(false);
  const rest = weiter ? "" : "hidden";
  const copy = () => {
    navigator.clipboard?.writeText(asText(i)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  };
  return (
    <article id={`meldung-${nr}`} className={`scroll-mt-16 border-b border-slate-200 py-6 max-sm:py-3.5 ${hide ? "hidden" : ""}`}>
      <p className="m-0 text-[12px] text-slate-500"><b className="font-semibold text-teal-700 sm:hidden">{nr} von {total} · </b>{i.dateline.place}{i.dateline.committee ? ` · ${i.dateline.committee}` : ""} · {datum(i.dateline.date)}</p>
      <h3 className="m-0 mt-1 text-[18px] font-semibold leading-snug sm:text-[22px]"><Link href={`/beschluss/${i.id}`} className="text-slate-900 no-underline hover:text-teal-800">{i.headline}</Link></h3>
      <p className="m-0 mt-3 max-sm:mt-2 max-w-[820px] text-[16px] leading-relaxed max-sm:leading-[1.5] text-slate-900">
        {i.lead} In der Vorlage heißt es: <q>{i.quote}</q>
        {i.more && <span className={rest}> Weiter heißt es dort: <q>{i.more}</q></span>}
        {i.body.length > 0 && <span className={rest}> {i.body.join(" ")}</span>}
      </p>
      <p className={`m-0 mt-3 text-[12px] text-slate-500 ${rest}`}>Quelle: {i.source} · {HINWEIS}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-0 max-sm:mt-1">
        {(i.more || i.body.length > 0) && <button type="button" onClick={() => setWeiter(!weiter)} aria-expanded={weiter} className="inline-flex min-h-[44px] items-center text-[14px] font-medium text-teal-700">{weiter ? "Weniger" : "Weiterlesen"}</button>}
        <Link href={`/beschluss/${i.id}`} className="inline-flex max-sm:min-h-[44px] items-center text-[14px] font-medium text-teal-700 no-underline">Zum Vorgang →</Link>
        <button type="button" onClick={copy} className="inline-flex max-sm:hidden items-center text-[14px] font-medium text-teal-700">{copied ? "Kopiert" : "Meldung kopieren"}</button>
        <ShareButton title={i.headline} url={typeof window === "undefined" ? `/beschluss/${i.id}` : `${window.location.origin}/beschluss/${i.id}`} className="sm:hidden" />
        <span className={`text-[12px] text-slate-500 ${rest}`}><span className="sr-only">Nachrichtenwert </span>Wert {i.score}: {i.why.join(" · ")}</span>
      </div>
    </article>
  );
}

/** plenara.X – Newsradar: berichtenswerte Vorgänge der letzten 30 und nächsten 10 Tage als Meldung mit Zitat und Quelle */
export function NewsradarPage() {
  const { query } = useAnalyticsQuery();
  const search = useSearch();
  useOrtInAdresse(new URLSearchParams(query).get("area") ?? "", (a) => search.setArea(a, "ui"));
  const [days, setDays] = useState(30);
  /* Handy: zuerst fünf Meldungen, „Weitere laden“ zeigt je fünf mehr */
  const [sicht, setSicht] = useState(5);
  const { res, ranKey, loading, error, stale, run } = useAnalysisRun<Result>({ key: `${query}&days=${days}`, url: `/api/analytics/news?${query}&days=${days}`, initial: true });
  /* Neue Auswahl rechnet noch: statt des alten Ergebnisses sofort pulsierende Kacheln */
  const pending = loading && !!res && ranKey !== `${query}&days=${days}`;
  /* Wie Trends und Signale: geänderte Suche oder Filter rechnen nach kurzer Pause von selbst neu */
  useEffect(() => {
    if (!stale || loading) return;
    const tm = setTimeout(() => run(), 400);
    return () => clearTimeout(tm);
  }, [stale, loading, run]);

  const own = !!new URLSearchParams(query).get("from");

  return (
    <main id="inhalt" className={HERO_MAIN}>
      <XKopf seite="news" />
      <SplitHandle />

      <ThemenLeiste />
      <div className="print:hidden"><DiffusionSearch follow={<Folgen heart hint="Auswahl unter Meine Suchen speichern" />} noPlay play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} /></div>
      <div className={`rm-xfilter rm-zeit-std mt-3 flex flex-wrap items-center gap-2 print:hidden${own ? "" : " max-sm:hidden"}`} role="group" aria-label="Zeitraum">
        {own ? (
          <p className="m-0 text-[14px] text-slate-700">Zeitraum aus dem Filter{res?.own ? `: ${datum(res.from)} bis ${datum(res.to)}` : ""}</p>
        ) : (
          <>
            <Segmented label="Zeitraum" options={SPANS.map(([d, l]) => [String(d), l] as [string, string])} value={String(days)} onPick={(k) => setDays(+k)} />
            <span className="text-[12px] text-slate-500">und die nächsten 10 Tage</span>
          </>
        )}
      </div>
      {error && <Fehler onNochmal={() => run()}>{error}</Fehler>}
      {loading && !res && <Laden text="Vorgänge werden bewertet …" />}

      {res && (
        <div {...busyProps(loading)}>
          {res.items.length === 0 ? <Leer tipp="Einen längeren Zeitraum wählen oder den Suchbegriff kürzen; gezeigt werden nur Vorgänge mit zitierbarer Zusammenfassung.">Keine berichtenswerten Vorgänge in diesem Zeitraum.</Leer> : (
            <>
              <div className={HERO_PANEL}>
              <Befund>{`Von ${n(res.totals.considered)} Sachvorgängen zwischen ${datum(res.from)} und ${datum(res.to)} zeigt die Seite die ${res.items.length} mit dem höchsten Nachrichtenwert, höchstens ${res.rule.perRegion} je Gebiet.`}</Befund>
                {!own && <div className="rm-xtop"><div className="rm-xzeit"><Segmented label="Zeitraum" options={SPANS.map(([dd, l]) => [String(dd), l] as [string, string])} value={String(days)} onPick={(k) => setDays(+k)} /></div></div>}
              </div>
              {pending && <ListSkeleton />}
              <div className={pending ? "hidden" : undefined}>
              <nav aria-label="Meldungen" className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden">
                {res.items.map((k, n) => (n >= sicht) ? null : <a key={k.id} href={`#meldung-${n + 1}`} className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 text-[14px] text-slate-700 no-underline"><b className="font-semibold tabular-nums text-teal-700">{n + 1}</b>{k.dateline.place.replace(/^(Stadt|Gemeinde|Markt|Verbandsgemeinde|Samtgemeinde|Hansestadt) /, "")}</a>)}
              </nav>
              <Reveal><section className="mt-4 max-sm:mt-3 border-t border-slate-200">
                {res.items.map((k, n) => <Meldung key={k.id} i={k} nr={n + 1} total={res.items.length} hide={n >= sicht} />)}
                {res.items.length > sicht && <button type="button" onClick={() => setSicht((v) => v + 5)} className="inline-flex min-h-[44px] items-center text-[14px] font-medium text-teal-700">{`Weitere ${Math.min(5, res.items.length - sicht)} Meldungen laden`}</button>}
              </section></Reveal>
              <MethodikNote>Nachrichtenwert nach festen Regeln: Konflikt, Tragweite, Alltagsnähe und Aktualität. Jede Meldung zitiert wörtlich aus der Vorlage; Vorgänge ohne zitierbaren Satz erscheinen nicht.</MethodikNote>
              </div>
            </>
          )}
        </div>
      )}
    <XWeiter links={[["/analytics/signale", "plenara.X Projekte"], ["/analytics/trends", "plenara.X Trends"]]} />
    </main>
  );
}
