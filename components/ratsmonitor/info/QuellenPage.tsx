import { useEffect, useState } from "react";
import { DarkCta, PageHead } from "./blocks";
import Link from "next/link";

interface Source { id: string; name: string; kind: "city" | "district"; method: string; lastImport: string | null; articles: number; meetings: number; from: string | null; complete: boolean; failed: boolean }
interface Data { totals: { areas: number; connected: number; withArticles: number; articles: number; latest: string | null }; sources: Source[] }

const stamp = (v: string | null) => (v ? new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " Uhr" : "noch kein Abruf");
const n = (v: number) => v.toLocaleString("de-DE");
const TAB_ON = "border-b-2 border-teal-600 text-teal-600";
const TAB_OFF = "border-b-2 border-transparent text-slate-500 hover:text-slate-900";

/** Quellen & Abdeckung im aktuellen Design: Kennzahlen, Suche und eine Liste je angebundenem Gebiet */
export function QuellenPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [find, setFind] = useState("");
  const [only, setOnly] = useState<"articles" | "all">("articles");
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/sources", { signal: ctrl.signal })
      .then(async (r) => {
        const d = (await r.json()) as Data & { error?: string };
        if (!r.ok) throw Error(d.error || "Der Quellenstand ist gerade nicht erreichbar.");
        setData(d);
      })
      .catch((e) => !ctrl.signal.aborted && setError(e instanceof Error ? e.message : "Netzwerkfehler."));
    return () => ctrl.abort();
  }, []);
  const q = find.trim().toLowerCase();
  const list = (data?.sources ?? []).filter((s) => (only === "all" || s.articles > 0) && (!q || s.name.toLowerCase().includes(q)));

  return (
    <>
      <PageHead
        icon="layers"
        label="Daten"
        name="Quellen & Abdeckung"
        title={<>Woher die Daten<br />kommen.</>}
        lead="Alle Vorgänge stammen aus den offiziellen Ratsinformationssystemen der Kommunen. Offizielle Schnittstellen haben Vorrang, sonst werden die öffentlichen Ratsinformationsseiten gelesen. Die Abdeckung wird laufend ausgebaut."
      />
      <section className="ri-sec ri-sec--tight">
        {error && <p role="alert" className="text-slate-600">{error}</p>}
        {!data && !error && <p className="text-slate-500">Quellenstand wird geladen …</p>}
        {data && (
          <>
            {/* Kennzahlen in einer Zeile, nur durch Linien getrennt */}
            <dl className="m-0 grid grid-cols-2 border-y border-slate-200 sm:grid-cols-4">
              {[
                ["Gebiete mit Daten", n(data.totals.withArticles)],
                ["Angebundene Gebiete", n(data.totals.connected)],
                ["Vorgänge", n(data.totals.articles)],
                ["Letzter Abruf", stamp(data.totals.latest)],
              ].map(([label, value], i) => (
                <div key={label} className={`py-4 sm:px-4 ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}>
                  <dt className="text-[12px] uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="m-0 mt-1 text-[22px] font-semibold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[14px] text-slate-500">
              {n(data.totals.areas - data.totals.connected)} weitere Gebiete sind auswählbar, aber noch nicht an eine Datenquelle angebunden.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Gemeinde oder Kreis suchen …" aria-label="Gebiet suchen" className="h-11 min-w-0 flex-1 basis-[260px] rounded-xl border border-transparent bg-[#f8f9fa] px-4 text-[16px] outline-none placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:shadow-focus" />
              <div role="group" aria-label="Filter" className="flex items-center gap-4">
                {([["articles", "Mit Daten"], ["all", "Alle angebundenen"]] as const).map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={only === v} onClick={() => setOnly(v)} className={`py-1 text-[14px] ${only === v ? TAB_ON : TAB_OFF}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="m-0 mt-4 list-none border-t border-slate-200 p-0">
              {list.map((s) => (
                <li key={s.id} className="grid gap-x-6 gap-y-1 border-b border-slate-200 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="m-0 font-semibold text-slate-900">{s.name}</p>
                    <p className="m-0 text-[14px] text-slate-500">{s.method}</p>
                  </div>
                  <p className="m-0 text-[14px] text-slate-500">{s.articles ? `${n(s.articles)} Vorgänge · ${n(s.meetings)} Sitzungen` : "noch keine Vorgänge"}</p>
                  <p className="m-0 text-[14px] text-slate-500">Abruf: {stamp(s.lastImport)}</p>
                  <p className={`m-0 inline-flex items-center gap-1.5 text-[14px] ${s.failed ? "text-rose-700" : "text-slate-500"}`}>
                    <i aria-hidden="true" className={`h-2 w-2 rounded-full ${s.failed ? "bg-rose-600" : s.complete ? "bg-teal-600" : "bg-amber-500"}`} />
                    {s.failed ? "Abruf fehlgeschlagen" : s.complete ? "vollständig" : "mit Lücken"}
                  </p>
                </li>
              ))}
              {!list.length && <li className="py-6 text-slate-500">Kein angebundenes Gebiet passt zu Ihrer Suche.</li>}
            </ul>
          </>
        )}
      </section>
      <DarkCta
        title="Ihre Kommune fehlt?"
        sub="Sagen Sie uns, welche Gebiete für Sie wichtig sind. Wir binden sie bevorzugt an."
        action={
          <Link href="/kontakt" className="ri-btn ri-btn--inv">
            Kontakt aufnehmen
          </Link>
        }
      />
    </>
  );
}
