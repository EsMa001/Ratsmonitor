import Link from "next/link";
import { AnalyticsLogo } from "../../components/Brand";
import { IS_DEV, setTier } from "../../lib/tier";
import { PageBand } from "./PageBand";

/** Hinweis statt Analyse für alle ohne Enterprise (nur Oberfläche: serverseitig gibt es noch keine Tarifprüfung) */
export function AnalyticsLocked() {
  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-12 text-slate-900">
      <PageBand>
        <p className="text-[14px] text-slate-500">Plenara.X</p>
        <h1 className="mb-6 mt-4"><span className="sr-only">Plenara.X</span><AnalyticsLogo size={56} /></h1>
        <p className="mt-3 max-w-[680px] text-[18px] text-slate-500">Die Analysen von Plenara.X gehören zum Tarif Enterprise, für Organisationen, in denen mehrere Personen informiert werden sollen.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/preise#tarif" className="btn-primary">Enterprise anfragen</Link>
          <Link href="/analytics/ueber" className="btn-secondary">Was kann Plenara.X?</Link>
          {IS_DEV && (
            <button type="button" onClick={() => setTier("enterprise")} className="ml-auto text-[12px] text-slate-500 underline underline-offset-2 hover:text-slate-700">
              Dev: als Enterprise fortfahren
            </button>
          )}
        </div>
      </PageBand>
    </main>
  );
}
