import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DarkCta, PageHead } from "./blocks";
import { Icon } from "./icons";
import { useSearch } from "../state/search";

interface Source { id: string; name: string; kind: "city" | "district"; method: string; lastImport: string | null; articles: number; meetings: number; from: string | null; complete: boolean; failed: boolean }
interface Land { id: string; name: string; total: number; covered: number; population: number; populationCovered: number }
interface Data {
  totals: { areas: number; connected: number; withArticles: number; articles: number; latest: string | null };
  reach?: { municipalities: { total: number; covered: number }; population: { total: number; covered: number }; districts: { total: number; covered: number }; lands: Land[] };
  sources: Source[];
}

const n = (v: number) => v.toLocaleString("de-DE");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const day = (v: string | null) => (v ? new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "–");

/** Große Kennzahl mit feiner Fortschrittslinie */
function Big({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div>
      <p className="m-0 text-[64px] font-semibold leading-none tracking-[-0.03em] text-slate-900 max-sm:text-[44px]">{value} <span className="text-[36px] max-sm:text-[28px]">%</span></p>
      <p className="m-0 mt-3 text-[18px] font-medium text-slate-900">{label}</p>
      <span className="mt-3 block h-[4px] w-full max-w-[420px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${value}%` }} /></span>
      <p className="m-0 mt-2 text-[14px] text-slate-500">{sub}</p>
    </div>
  );
}

/** Datenabdeckung für Nutzerinnen und Nutzer: wie viel von Deutschland wir abdecken, nach Land, und die Frage „Ist mein Ort dabei?“. Keine Gesamtliste aller Orte. */
export function QuellenPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [find, setFind] = useState("");
  const router = useRouter();
  const search = useSearch();
  const open = (id: string) => {
    search.setArea(id.replace(/^de-/, ""), "ui", { zoom: true });
    router.push("/");
  };
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
  const hits = useMemo(() => (q.length >= 2 && data ? data.sources.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6) : []), [q, data]);
  const reach = data?.reach;
  const lands = useMemo(() => {
    const list = (reach?.lands ?? []).filter((l) => l.total > 1 || l.covered > 0);
    return [...list.filter((l) => l.covered > 0).sort((a, b) => pct(b.covered, b.total) - pct(a.covered, a.total)), ...list.filter((l) => l.covered === 0)];
  }, [reach]);
  const landsWithData = lands.filter((l) => l.covered > 0).length;

  return (
    <>
      <PageHead
        icon="layers"
        label="Daten"
        name="Datenabdeckung"
        title={<>Kommunalpolitik aus<br />ganz Deutschland.</>}
        lead="Beschlüsse, Vorlagen und Beratungen aus den offiziellen Ratsinformationssystemen der Kommunen, an einem Ort durchsuchbar und mit Verweis auf die Originalquelle. Die Abdeckung wächst laufend."
      />
      <section className="ri-sec ri-sec--tight">
        {error && <p role="alert" className="text-slate-600">{error}</p>}
        {!data && !error && <p className="text-slate-500">Abdeckung wird geladen …</p>}
        {data && reach && (
          <>
            <div className="grid gap-12 sm:grid-cols-2">
              <Big value={pct(reach.municipalities.covered, reach.municipalities.total)} label="der Gemeinden Deutschlands sind dabei" sub={`${n(reach.municipalities.covered)} von ${n(reach.municipalities.total)} Gemeinden mit Vorgängen aus ihrem Rat`} />
              <Big value={pct(reach.population.covered, reach.population.total)} label="der Einwohner leben in abgedeckten Orten" sub={`${(reach.population.covered / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 })} von ${(reach.population.total / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Millionen Menschen`} />
            </div>
            <dl className="m-0 mt-12 grid grid-cols-2 border-t border-slate-200 sm:grid-cols-4">
              {[
                [n(data.totals.articles), "Vorgänge durchsuchbar"],
                [`${n(reach.districts.covered)} von ${n(reach.districts.total)}`, "Landkreise"],
                [n(landsWithData), "Bundesländer mit Daten"],
                [day(data.totals.latest), "Letzter Abruf"],
              ].map(([value, label], i) => (
                <div key={label} className={`py-4 sm:px-4 ${i ? "sm:border-l sm:border-slate-200" : "sm:pl-0"}`}>
                  <dd className="m-0 text-[22px] font-semibold text-slate-900">{value}</dd>
                  <dt className="mt-1 text-[14px] text-slate-500">{label}</dt>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      {data && reach && (
        <section className="ri-sec ri-sec--tight">
          <div className="grid gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
            <div>
              <h2 className="ri-h2">Ist Ihr Ort dabei?</h2>
              <p className="m-0 mt-2 max-w-[520px] text-[16px] text-slate-500">Gemeinde, Stadt oder Kreis eingeben und nachsehen.</p>
            </div>
            <div>
              <div className="relative max-w-[640px]">
                <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" size={18} /></span>
                <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Ort eingeben, z. B. Münster" aria-label="Ort suchen" className="h-14 w-full rounded-full border border-slate-300 bg-white pl-12 pr-5 text-[16px] text-slate-900 outline-none focus:border-teal-600" />
              </div>
              {q.length >= 2 && (
                <ul className="m-0 mt-4 max-w-[640px] list-none border-t border-slate-200 p-0">
                  {hits.map((s) => (
                    <li key={s.id} className="border-b border-slate-200">
                      <button type="button" onClick={() => open(s.id)} className="flex w-full cursor-pointer flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-0 bg-transparent px-0 py-3 text-left hover:text-teal-600">
                        <span className="font-semibold text-slate-900">{s.name}</span>
                        <span className="text-[14px] text-slate-500">{s.articles ? `${n(s.articles)} Vorgänge · ${n(s.meetings)} Sitzungen · Abruf ${day(s.lastImport)}` : "angebunden, erste Vorgänge folgen"}</span>
                      </button>
                    </li>
                  ))}
                  {!hits.length && <li className="border-b border-slate-200 py-4 text-slate-600">Zu „{find.trim()}“ liegt noch nichts vor. Orte einer Samtgemeinde oder eines Amtes stehen unter dem Namen des Verbands. <Link href="/kontakt" className="text-teal-600">Sagen Sie uns, was Sie brauchen →</Link></li>}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {data && reach && (
        <section className="ri-sec ri-sec--tight">
          <h2 className="ri-h2">Abdeckung nach Bundesland</h2>
          <p className="m-0 mt-2 max-w-[680px] text-[16px] text-slate-500">Anteil der Gemeinden, aus denen Vorgänge vorliegen.</p>
          <ol className="m-0 mt-6 list-none border-t border-slate-200 p-0">
            {lands.map((l) => {
              const p = pct(l.covered, l.total);
              return (
                <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-slate-200 py-3 sm:grid-cols-[220px_minmax(0,1fr)_200px]">
                  <span className="truncate text-[16px] text-slate-900">{l.name}</span>
                  <span className="order-3 col-span-2 block h-[6px] rounded-full bg-slate-100 sm:order-none sm:col-span-1"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${l.covered ? Math.max(2, p) : 0}%` }} /></span>
                  <span className="text-right text-[14px] tabular-nums text-slate-500">{l.covered ? <><b className="font-semibold text-slate-900">{p} %</b> · {n(l.covered)} von {n(l.total)}</> : "noch nicht angebunden"}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}


      <section className="ri-sec ri-sec--tight">
        <h2 className="ri-h2">Hinter den Kulissen</h2>
        <p className="m-0 mt-3 max-w-[760px] text-[16px] leading-relaxed text-slate-500">Damit fast eine Million Vorgänge sofort durchsuchbar bleiben, arbeitet unter Plenara eine eigens aufgebaute, hochperformante Datenbank mit intelligenter Suche: Wortlisten und vorberechnete Zahlen statt langem Blättern. Das macht Antworten in Bruchteilen einer Sekunde möglich und ist die Grundlage für die Analysen in <Link href="/analytics/ueber" className="text-teal-600">Plenara.X</Link>.</p>
      </section>

      <DarkCta
        title="Ihre Kommune fehlt?"
        sub="Wir bauen die Abdeckung laufend aus. Sagen Sie uns, welche Gebiete für Sie wichtig sind, wir binden sie bevorzugt an."
        action={
          <Link href="/kontakt" className="ri-btn ri-btn--inv">
            Kontakt aufnehmen
          </Link>
        }
      />
    </>
  );
}
