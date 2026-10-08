import Link from "next/link";
import { AnalyticsLogo } from "../../components/Brand";
import { IS_DEV, setTier } from "../../lib/tier";
import { PageBand } from "./PageBand";
import { LiveThumb } from "../../info/BranchenLive";
import { ANALYSEN, type AnalyseId } from "../../info/branchen-enterprise";

/* Was eine gesperrte Analyse zeigt: Pfad, Analyse, Beispielbegriff der Vorschau und ein Satz dazu */
const VORSCHAU: Record<string, { id: AnalyseId; term: string; text: string }> = {
  "/analytics/diffusion": { id: "diffusion", term: "Photovoltaik", text: "Zeigt, wie sich ein Thema über die Gebiete ausbreitet: wer zuerst dran war, wie schnell andere folgten und wo es noch fehlt. Als Zeitraffer auf der Karte." },
  "/analytics/graph": { id: "graph", term: "Photovoltaik", text: "Zeigt, womit ein Thema zusammenhängt: verwandte Begriffe, Themenfelder, Gremien und Länder als Netz." },
  "/analytics/trends": { id: "trends", term: "Photovoltaik", text: "Zeigt, welche Begriffe gerade aufkommen, zunehmen oder verschwinden, mit Verlaufskurven." },
  "/analytics/vergleich": { id: "vergleich", term: "Köln und Dortmund", text: "Stellt zwei Orte nebeneinander: Themenprofil, Verlauf, aktivste Gremien und typische Begriffe." },
  "/analytics/beschluesse": { id: "beschluesse", term: "Photovoltaik", text: "Zeigt, wie Vorgänge stehen und ausgehen: Beschlussquote, Vertagungen, Ablehnungen und die Dauer bis zur Entscheidung." },
  "/analytics/gremien": { id: "gremien", term: "Photovoltaik", text: "Zeigt, welchen Weg Vorgänge durch die Gremien nehmen und wo sie entschieden werden." },
};

/** Hinweis statt Analyse für alle ohne Enterprise (nur Oberfläche: serverseitig gibt es noch keine Tarifprüfung) */
export function AnalyticsLocked({ path = "" }: { path?: string }) {
  const v = VORSCHAU[path];
  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-12 text-slate-900">
      <PageBand>
        <p className="text-[14px] text-slate-500">plenara.X</p>
        <h1 className="mb-6 mt-4"><span className="sr-only">plenara.X</span><AnalyticsLogo size={56} /></h1>
        <p className="mt-3 max-w-[680px] text-[18px] text-slate-500">Die Analysen von plenara.X gehören zum Tarif Enterprise, für Organisationen, in denen mehrere Personen informiert werden sollen.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/preise#tarif" className="btn-primary">Enterprise anfragen</Link>
          <Link href="/analytics/ueber" className="btn-secondary">Was kann plenara.X?</Link>
          {IS_DEV && (
            <button type="button" onClick={() => setTier("enterprise")} className="ml-auto text-[12px] text-slate-500 underline underline-offset-2 hover:text-slate-700">
              Dev: als Enterprise fortfahren
            </button>
          )}
        </div>
      </PageBand>
      {v && (
        <section className="mt-10 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_320px]" aria-label={`Vorschau: ${ANALYSEN[v.id].name}`}>
          <div>
            <h2 className="m-0 text-[22px] font-semibold">{ANALYSEN[v.id].name}</h2>
            <p className="mt-2 max-w-[560px] text-[16px] leading-relaxed text-slate-500">{v.text}</p>
            <p className="mt-4 max-w-[560px] text-[14px] text-slate-500">Rechts sehen Sie eine Vorschau mit echten Daten. Mit dem Tarif Enterprise starten Sie die Analyse für jedes eigene Thema.</p>
          </div>
          <LiveThumb id={v.id} term={v.term} />
        </section>
      )}
    </main>
  );
}
