import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalysisRun } from "./useAnalysisRun";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { errorText, fetchJson } from "../../lib/fetchJson";
import { ArticleCard } from "../../components/results/ArticleCard";
import type { Article } from "../../types";

/* Antwort von /api/x/signale (server/integrations/plenara-x-signals.mjs) */
interface Signal { id: string; name: string; who: string; count: number }
interface Phase { key: string; name: string; count: number }
interface Place { region: string; name: string; ags: string; count: number }
/* Karte wie in der Trefferliste der Suche (cardsById), dazu Ort im Verband, Stand und Kennzahlen */
interface Item extends Partial<Article> { id: string; title: string; region: string; date: string; status: Article["status"]; phase: string; facts: { kind: string; text: string }[] }
interface Result { signals: Signal[]; signal: { id: string; name: string; who: string; phaseText: string; art: string | null }; arts: Phase[]; phases: Phase[]; places: Place[]; placeCount?: number; total: number; offset: number; size: number; builtAt: string; items: Item[] }

/* Signale und Zeiträume in derselben Reihenfolge wie im Backend; die Zahlen kommen mit der Antwort */
const SIGNALE: [string, string][] = [
  ["vergaben", "Ausschreibungen und Vergaben"], ["wohnbau", "Neue Wohnbaugebiete"], ["gewerbe", "Gewerbe und Industrie"], ["wind", "Windenergie"],
  ["solar", "Solarenergie"], ["waerme", "Wärme und Effizienz"], ["schulen", "Schulen, Kitas, Sport"], ["pflege", "Pflege und Gesundheit"],
  ["handel", "Einzelhandel"], ["mobil", "Mobilität"],
];
const SIGNAL_IDS = new Set(SIGNALE.map(([id]) => id));
const ZEITRAUM: [string, string][] = [["3", "3 Monate"], ["6", "6 Monate"], ["12", "12 Monate"], ["alle", "Alles"]];
const n = (v: number) => v.toLocaleString("de-DE");
const day = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : "");
/* Beginn des Zeitraums: heute minus Monate, als Datum (der Bau der Zahlen ist täglich, ein Tag genauer lohnt nicht) */
const fromOf = (months: string) => {
  if (!months || months === "alle") return "";
  const d = new Date();
  d.setMonth(d.getMonth() - Number(months));
  return d.toISOString().slice(0, 10);
};
/* Farben je Stand: Knopf (aktiv/inaktiv) und Etikett in der Karte. Bekannte Schritte fest in Verfahrensreihenfolge (früh kühl, spät
   grün, Aufhebung rot), sonst der Reihe nach aus der Palette; „Sonstiges“ grau. */
const TONES = [
  { on: "bg-sky-700 text-white", off: "bg-sky-50 text-sky-800 hover:bg-sky-100", tag: "bg-sky-50 text-sky-800" },
  { on: "bg-violet-700 text-white", off: "bg-violet-50 text-violet-800 hover:bg-violet-100", tag: "bg-violet-50 text-violet-800" },
  { on: "bg-amber-600 text-white", off: "bg-amber-50 text-amber-800 hover:bg-amber-100", tag: "bg-amber-50 text-amber-800" },
  { on: "bg-orange-700 text-white", off: "bg-orange-50 text-orange-800 hover:bg-orange-100", tag: "bg-orange-50 text-orange-800" },
  { on: "bg-emerald-700 text-white", off: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100", tag: "bg-emerald-50 text-emerald-800" },
  { on: "bg-teal-700 text-white", off: "bg-teal-50 text-teal-800 hover:bg-teal-100", tag: "bg-teal-50 text-teal-800" },
  { on: "bg-rose-700 text-white", off: "bg-rose-50 text-rose-800 hover:bg-rose-100", tag: "bg-rose-50 text-rose-800" },
  { on: "bg-indigo-700 text-white", off: "bg-indigo-50 text-indigo-800 hover:bg-indigo-100", tag: "bg-indigo-50 text-indigo-800" },
];
const GREY = { on: "bg-slate-700 text-white", off: "bg-slate-100 text-slate-700 hover:bg-slate-200", tag: "bg-slate-100 text-slate-700" };
const FIXED: Record<string, number> = {
  Aufstellung: 0, "Frühzeitige Beteiligung": 1, Offenlage: 2, Abwägung: 3, Satzungsbeschluss: 4, Aufhebung: 6,
  "Start und Beauftragung": 0, "Analyse und Zwischenstand": 1, "Entwurf und Beteiligung": 2, "Wärmeplan vorgelegt": 4, "Umsetzung und Fortschreibung": 5,
  "Antrag und Anfrage": 7, Ausschreibung: 0, Vergabe: 4, Nachtrag: 3, "Planung und Konzept": 0, "Ausschreibung und Vergabe": 2, "Bau und Sanierung": 4, "Bauanträge Dritter": 1, "Beteiligung": 3, "Bericht und Sachstand": 5,
};
const toneOf = (name: string, order: string[]) => {
  if (/^Sonstig|Ohne Angabe|Noch nicht/.test(name)) return GREY;
  if (name in FIXED) return TONES[FIXED[name]];
  const i = order.indexOf(name);
  return TONES[(i < 0 ? 0 : i) % TONES.length];
};

export const signaleHref = ({ signal = "", phase = "", art = "", zeit = "" }: { signal?: string; phase?: string; art?: string; zeit?: string }) => {
  const p = new URLSearchParams();
  if (signal) p.set("signal", signal);
  if (phase) p.set("stand", phase);
  if (art) p.set("art", art);
  if (zeit) p.set("zeit", zeit);
  return `/analytics/signale${p.size ? "?" + p : ""}`;
};

/**
 * plenara.X Signale (Konzept docs/produkt/plenara-x-fakten-konzept.md): neue Ereignisse je Branche als Liste, mit Ort, Stand und
 * Kennzahlen, statt Anteilen auf einer Karte. Signal, Stand und Zeitraum stehen in der Adresse (teilbar), Ort und Begriff in der Suche.
 */
export function SignalePage() {
  const params = useSearchParams(), router = useRouter(), path = usePathname();
  const signal = SIGNAL_IDS.has(params.get("signal") ?? "") ? params.get("signal")! : "vergaben";
  const phase = params.get("stand") ?? "";
  const art = params.get("art") ?? "";
  const zeitRaw = params.get("zeit");
  const zeit = zeitRaw === null ? "6" : ZEITRAUM.some(([k]) => k === zeitRaw) ? zeitRaw : "6";
  const pick = (next: { signal?: string; phase?: string; art?: string; zeit?: string }) => router.push(signaleHref({ signal: signal === "vergaben" ? "" : signal, phase, art, zeit: zeit === "6" ? "" : zeit, ...next }), { scroll: false });
  // Ungültige Werte in der Adresse still berichtigen
  const target = signaleHref({ signal: signal === "vergaben" ? "" : signal, phase, art, zeit: zeit === "6" ? "" : zeit });
  const current = path + (params.size ? "?" + params : "");
  useEffect(() => { if (current !== target && (params.has("signal") || params.has("zeit"))) router.replace(target, { scroll: false }); }, [current, target, router, params]);

  const { query } = useAnalyticsQuery();
  const open = (a: Article) => router.push(`/beschluss/${a.id}`);
  const hover = () => {};
  /* Zeitraum der Seite ersetzt den der Suche nur, wenn die Suche selbst keinen hat */
  const q = new URLSearchParams(query);
  if (fromOf(zeit) && !q.get("from")) q.set("from", fromOf(zeit));
  const url = `/api/x/signale?signal=${signal}${phase ? `&phase=${encodeURIComponent(phase)}` : ""}${art ? `&art=${encodeURIComponent(art)}` : ""}&${q}`;
  const { res, loading, error, stale, run } = useAnalysisRun<Result>({ key: url, url, initial: true });
  /* Auswahl, Stand, Zeitraum oder Suche geändert: neu rechnen (Auswahl sofort, Suche nach kurzer Pause) */
  useEffect(() => {
    if (!stale || loading) return;
    const t = setTimeout(() => run(), 400);
    return () => clearTimeout(t);
  }, [stale, loading, url, run]);
  /* Weitere Einträge: an die Antwort gehängt, gehören zu genau dieser Abfrage */
  const [more, setMore] = useState<{ url: string; items: Item[]; loading: boolean; error: string }>({ url: "", items: [], loading: false, error: "" });
  const extra = more.url === url ? more : { url, items: [] as Item[], loading: false, error: "" };
  const loadMore = () => {
    const offset = (res?.items.length ?? 0) + extra.items.length;
    setMore({ ...extra, loading: true, error: "" });
    fetchJson<Result>(`${url}&offset=${offset}`, {}, "Die Liste konnte nicht geladen werden.")
      .then((r) => setMore((m) => (m.url === url ? { ...m, items: [...m.items, ...r.items], loading: false } : m)))
      .catch((e) => setMore((m) => ({ ...m, loading: false, error: errorText(e, "Die Liste konnte nicht geladen werden.") })));
  };

  const items = [...(res?.items ?? []), ...extra.items];
  const zeitText = ZEITRAUM.find(([k]) => k === zeit)?.[1];
  const phaseOrder = (res?.phases ?? []).map((p) => p.name);

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
        <p className="text-[14px] text-slate-500"><Link href="/analytics/ueber" className="text-teal-700">plenara.X</Link> / Signale</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">plenara.X Signale</h1>
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Wo gerade etwas entsteht: neue Baugebiete, Windparks, Wärmeplanung und mehr, aus den Vorlagen der Räte gelesen. Mit Ort, Stand des Verfahrens, Kennzahlen und Originalquelle.</p>
      </PageBand>

      <nav aria-label="Signal" className="-mx-[max(1vw,16px)] overflow-x-auto px-[max(1vw,16px)] print:hidden">
        <ul className="m-0 flex w-max list-none gap-2 p-0">
          {SIGNALE.map(([id, label]) => {
            const c = res?.signals.find((s) => s.id === id)?.count;
            return (
              <li key={id}>
                <button type="button" aria-pressed={id === signal} onClick={() => pick({ signal: id === "vergaben" ? "" : id, phase: "", art: "" })}
                  className={`h-9 whitespace-nowrap rounded-full px-4 text-[14px] ${id === signal ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  {label}{c !== undefined && <span className={id === signal ? "text-slate-300" : "text-slate-500"}> {n(c)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4 print:hidden"><DiffusionSearch noPlay play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} /></div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] print:hidden" role="group" aria-label="Zeitraum">
        <span className="text-slate-500">Zeitraum</span>
        {ZEITRAUM.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={k === zeit} onClick={() => pick({ zeit: k === "6" ? "" : k })}
            className={k === zeit ? "font-semibold text-slate-900" : "text-teal-700 hover:underline"}>{label}</button>
        ))}
        {res && <span className="text-slate-500">{res.total === 0
            ? `Keine Vorgänge${zeit !== "alle" ? ` in den letzten ${zeitText}` : ""} für diese Auswahl.`
            : `${n(res.total)} ${res.total === 1 ? "Vorgang" : "Vorgänge"} in ${n(res.placeCount ?? res.places.length)} ${(res.placeCount ?? res.places.length) === 1 ? "Gebiet" : "Gebieten"}${zeit !== "alle" ? `, letzte ${zeitText}` : ""}${phase ? `, Stand „${res.phases.find((p) => p.key === phase)?.name ?? phase}“` : ""}${art ? `, ${res.signal.art ?? "Art"} „${art}“` : ""}.`}</span>}
      </div>

      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {loading && !res && <Laden text="Signale werden geladen …" />}
      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          <h2 className="mt-8 text-[22px] font-semibold">{res.signal.name}</h2>
          <p className="mt-1 text-[14px] text-slate-500">Für {res.signal.who}.</p>

          {res.signal.art && (res.arts ?? []).length > 0 && (
            <section className="mt-8" aria-label={res.signal.art}>
              <h3 className="text-[18px] font-semibold">{res.signal.art}</h3>
              <p className="mt-1 text-[14px] text-slate-500">Aus Titel, Vorlage und Begründung gelesen; ein Vorgang kann mehrere Werte haben. Klick grenzt die Liste ein.</p>
              <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
                <li><button type="button" aria-pressed={!art} onClick={() => pick({ art: "" })}
                  className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold ${!art ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"}`}>Alle</button></li>
                {res.arts.map((a) => (
                  <li key={a.key}>
                    <button type="button" aria-pressed={a.key === art} onClick={() => pick({ art: a.key === art ? "" : a.key })}
                      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold ${a.key === art ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"}`}>
                      {a.name} <span className="ml-1 opacity-75">{n(a.count)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {res.phases.length > 0 && (
            <section className="mt-8" aria-label="Stand">
              <h3 className="text-[18px] font-semibold">Stand</h3>
              <p className="mt-1 text-[14px] text-slate-500">{res.signal.phaseText} Klick grenzt die Liste ein.</p>
              <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
                <li><button type="button" aria-pressed={!phase} onClick={() => pick({ phase: "" })}
                  className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold ${!phase ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"}`}>Alle <span className="ml-1 opacity-75">{n(res.phases.reduce((a, p) => a + p.count, 0))}</span></button></li>
                {res.phases.map((p) => {
                  const t = toneOf(p.name, phaseOrder);
                  return (
                    <li key={p.key}>
                      <button type="button" aria-pressed={p.key === phase} onClick={() => pick({ phase: p.key === phase ? "" : p.key })}
                        className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold ${p.key === phase ? t.on : t.off}`}>
                        {p.name} <span className="ml-1 opacity-75">{n(p.count)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {res.places.length > 1 && (
            <section className="mt-8" aria-label="Wo">
              <h3 className="text-[18px] font-semibold">Wo am meisten</h3>
              <p className="mt-1 text-[14px] text-slate-500">{res.places.slice(0, 12).map((p) => `${p.name} ${n(p.count)}`).join(" · ")}{(res.placeCount ?? 0) > 12 ? ` · und ${n((res.placeCount ?? 0) - 12)} weitere` : ""}</p>
            </section>
          )}

          {items.length > 0 && (
            <section className="mt-8" aria-label="Vorgänge">
              <h3 className="text-[18px] font-semibold">Jüngste Vorgänge</h3>
              <div className="mt-2 flex flex-col">
                {items.map((r, i) => {
                  const a: Article = { thema: "", gremium: "", teaser: "", ags: "", ...r, gemeinde: r.region, month: r.date.slice(0, 7), hay: "" };
                  const facts = r.facts.filter((f) => f.text !== r.phase).map((f) => f.text);
                  return <ArticleCard key={r.id} article={a} index={i} terms={[]} onOpen={open} onHover={hover}
                    extra={<p className="m-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-slate-900"><span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold ${toneOf(r.phase, phaseOrder).tag}`}>{r.phase}</span>{facts.length > 0 && <span className="font-medium">{facts.join(" · ")}</span>}</p>} />;
                })}
              </div>
              {extra.error && <p role="alert" className="mt-2 text-[14px]">{extra.error}</p>}
              {items.length < res.total && (
                <button type="button" disabled={extra.loading} onClick={loadMore} className="mt-3 text-[14px] font-medium text-teal-700 hover:underline">
                  {extra.loading ? "Wird geladen …" : `Weitere ${n(Math.min(res.size, res.total - items.length))} laden →`}
                </button>
              )}
            </section>
          )}
          <p className="mt-8 text-[12px] text-slate-500">Stand {day(res.builtAt?.slice(0, 10) ?? "")}. Gelesen aus Titeln, Vorlagen und Begründungen; Werte ohne Gewähr, jede Angabe mit Originalquelle im Vorgang.</p>
        </div>
      )}
    </main>
  );
}
