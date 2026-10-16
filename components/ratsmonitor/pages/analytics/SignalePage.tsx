import Link from "next/link";
import { useEffect, useState } from "react";
import { Factory, FileSignature, Flame, House, Bus, Droplets, RadioTower, Route, School, Sun, Wind, type LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBand } from "./PageBand";
import { Laden } from "./Laden";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalysisRun } from "./useAnalysisRun";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RegionMap } from "./RegionMap";
import { errorText, fetchJson } from "../../lib/fetchJson";
import { Befund } from "./Befund";
import { ArtIcon } from "../../components/ArtIcon";
import { ThemeIcon } from "../../components/icons";
import type { Article } from "../../types";

/* Antwort von /api/x/signale (server/integrations/plenara-x-signals.mjs) */
interface Signal { id: string; name: string; who: string; count: number }
interface Phase { key: string; name: string; count: number }
interface Place { region: string; name: string; ags: string; count: number; members?: string[] }
/* Karte wie in der Trefferliste der Suche (cardsById), dazu Ort im Verband und Stand */
interface Item extends Partial<Article> { id: string; title: string; region: string; date: string; status: Article["status"]; phase: string; arts?: string[] }
interface Result { signals: Signal[]; signal: { id: string; name: string; who: string; phaseText: string; art: string | null }; arts: Phase[]; phases: Phase[]; places: Place[]; placeCount?: number; total: number; offset: number; size: number; builtAt: string; items: Item[] }

/* Signale und Zeiträume in derselben Reihenfolge wie im Backend; die Zahlen kommen mit der Antwort */
const SIGNALE: [string, string][] = [
  ["vergaben", "Ausschreibungen und Vergaben"], ["wohnbau", "Neue Wohnbaugebiete"], ["gewerbe", "Gewerbe, Industrie, Handel"], ["wind", "Windenergie"],
  ["solar", "Solarenergie"], ["waerme", "Wärme und Netze"], ["schulen", "Schulen, Kitas, Sport"], ["strasse", "Straßen und Brücken"],
  ["wasser", "Wasser und Hochwasser"], ["breitband", "Breitband und Mobilfunk"], ["mobil", "Mobilität"],
];
/* Symbol je Kategorie (Reihenfolge wie SIGNALE) */
const ICONS: Record<string, LucideIcon> = { vergaben: FileSignature, wohnbau: House, gewerbe: Factory, wind: Wind, solar: Sun, waerme: Flame, schulen: School, strasse: Route, wasser: Droplets, breitband: RadioTower, mobil: Bus };
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

/* Kurze Namen der Filterwerte (Leistung u. a.) für Pillen und Liste */
const ART_SHORT: Record<string, string> = { Planungsleistungen: "Planung", "Fahrzeuge und Ausstattung": "Fahrzeuge", "Sonstige Leistungen": "Sonstige", "Tiefbau und Straße": "Tiefbau", "Wasser und Abwasser": "Wasser", "IT und Glasfaser": "IT", "Batteriespeicher und Wasserstoff": "Speicher und Wasserstoff", "Hotel, Camping und Freizeit": "Hotel und Camping", "Bike- oder Lastenradverleih": "Radverleih", "Bürgerbus oder Rufbus": "Bürgerbus", "Sporthalle und Sportplatz": "Sport", "Weiterführende Schule": "Weiterf. Schule", "Gehweg und Barrierefreiheit": "Gehweg", "Ortsdurchfahrt und Kreisverkehr": "Ortsdurchfahrt", "Straßenausbau und -sanierung": "Straßenausbau", "Wärmenetz und Fernwärme": "Wärmenetz", "LED-Straßenbeleuchtung": "LED-Licht", "Hochwasser und Starkregen": "Hochwasser", "Bürger- und Kommunalbeteiligung": "Beteiligung", "Genehmigungsantrag (BImSchG)": "Genehmigung", "Glasfaser und Breitband": "Glasfaser" };
const artShort = (a: string) => ART_SHORT[a] ?? a;
/* Farbe des Stand-Punkts: die Flächenfarbe des Tons (bg-…-700) */
const STEP_DOTS = ["bg-sky-600", "bg-violet-600", "bg-amber-500", "bg-indigo-600", "bg-cyan-600", "bg-fuchsia-600", "bg-orange-500", "bg-blue-800"];
const dotOf = (name: string, order: string[]) => {
  if (/^Sonstig|Ohne Angabe|Noch nicht/.test(name)) return "bg-slate-400";
  const i = name in FIXED ? FIXED[name] : Math.max(0, order.indexOf(name));
  return STEP_DOTS[i % STEP_DOTS.length];
};

/* Thema (und Unterthema) im Atlas zur Kategorie: Hinweis unter der Antwortzeile */
const ATLAS_OF: Record<string, [string, string, string]> = {
  wohnbau: ["bauen", "bauen.wohnen", "Wohnungsbau"], gewerbe: ["wirtschaft", "wirtschaft.gewerbe", "Gewerbegebiete"], wind: ["umwelt", "umwelt.ee", "Erneuerbare"],
  solar: ["umwelt", "umwelt.ee", "Erneuerbare"], waerme: ["umwelt", "umwelt.waerme", "Wärme"], schulen: ["bildung", "", "Bildung & Betreuung"],
  strasse: ["mobilitaet", "mobilitaet.strasse", "Straßen und Brücken"], wasser: ["umwelt", "umwelt.wasser", "Wasser"], breitband: ["verwaltung", "verwaltung.breit", "Breitband"],
  mobil: ["mobilitaet", "", "Mobilität & Verkehr"],
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
 * plenara.X Signale (Konzept docs/produkt/plenara-x-fakten-konzept.md): neue Ereignisse je Branche als Liste, mit Ort und Stand
 * (keine Kennzahlen, die stehen in plenara.X Fakten). Signal, Stand und Zeitraum stehen in der Adresse (teilbar), Ort und Begriff in der Suche.
 */
/* Ausklappbare Karte: Vorgänge der Auswahl je Gemeinde (Verbände färben ihre Mitgliedsgemeinden) */
const STUFE = (c: number) => (c >= 5 ? 4 : c >= 3 ? 3 : c);
function SignalMap({ places, onPlace }: { places: Place[]; onPlace: (ags: string) => void }) {
  const [picked, setPicked] = useState(""), [level, setLevel] = useState<"city" | "district">("city");
  /* Gemeinden: Vorgänge je Gemeinde (Verbände färben ihre Mitgliedsgemeinden); Kreise: Summe aller Gebiete im Kreis */
  const byAgs = new Map<string, { name: string; count: number }>(), levels: Record<string, number> = {};
  for (const p of places) {
    const own = p.ags.length === 8 ? [p.ags] : [];
    if (level === "district") { const k = p.ags.slice(0, 5); if (k.length === 5) { const o = byAgs.get(k); byAgs.set(k, { name: p.ags.length === 5 ? p.name : o?.name ?? `Kreis ${k}`, count: (o?.count ?? 0) + p.count }); } continue; }
    for (const a of [...own, ...(p.members ?? []).filter((m) => m.length === 8)]) if (!byAgs.has(a) || own.includes(a)) byAgs.set(a, p);
  }
  for (const [a, p] of byAgs) levels[a] = STUFE(p.count);
  const sel = picked ? byAgs.get(picked) : undefined;
  return (
    <section className="print:hidden" aria-label="Karte">
      {/* Klick wählt das Gebiet als Ort (Gemeinde oder Kreis), wie im Atlas */}
      <RegionMap tall level={level} levels={levels} picked={picked} onPick={(a) => { setPicked(picked === a ? "" : a); if (picked !== a && byAgs.has(a)) onPlace(a); }} legend={["1 Vorgang", "2 Vorgänge", "3 bis 4 Vorgänge", "5 und mehr"]}
        note="ohne Farbe: keine Vorgänge" label={`Karte: Vorgänge der Auswahl je ${level === "district" ? "Kreis" : "Gemeinde"}`}
        info={sel ? <><b className="font-semibold">{sel.name}</b><br /><span className="text-slate-500">{n(sel.count)} {sel.count === 1 ? "Vorgang" : "Vorgänge"}</span></> : picked ? <span className="text-slate-500">Hier gibt es keine Vorgänge zur Auswahl.</span> : undefined} />
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Ebene der Karte">
        <span className="text-[14px] text-slate-500">Ebene</span>
        {([["city", "Gemeinden"], ["district", "Kreise"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => { setLevel(k); setPicked(""); }} className={PILL(level === k)}>{l}</button>)}
        <span className="text-[14px] text-slate-500">· Gebiet antippen wählt den Ort</span>
      </div>
    </section>
  );
}

/* Kompakte Filterzeile: Wort links, Pillen rechts (wie die Unterthemen im Atlas); Stand mit farbigem Punkt statt farbigem Text */
const PILL = (on: boolean) => `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[14px] ${on ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`;
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 w-[64px] text-[14px] text-slate-500">{label}</span>{children}
    </div>
  );
}

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

  const { query, search } = useAnalyticsQuery();
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
  /* Zuerst 10 zeigen; „Weitere“ zeigt die schon geladenen, dann lädt es nach */
  const [shownFor, setShownFor] = useState({ url: "", n: 10 });
  const shown = shownFor.url === url ? shownFor.n : 10;
  const showMore = () => {
    const next = shown + 10;
    setShownFor({ url, n: next });
    if (next > items.length && items.length < (res?.total ?? 0)) loadMore();
  };
  const zeitText = ZEITRAUM.find(([k]) => k === zeit)?.[1];
  const phaseOrder = (res?.phases ?? []).map((p) => p.name);

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand compact>
        <p className="text-[14px] text-slate-500"><Link href="/analytics/ueber" className="text-teal-700">plenara.X</Link> / Signale</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[28px] font-semibold leading-tight">plenara.X Signale</h1>
          <p className="text-[16px] text-slate-500">Wo gerade etwas entsteht, mit Ort, Stand und Quelle.</p>
        </div>
      </PageBand>

      {/* Kacheln wie im Atlas: Icon über dem Namen, nur die gewählte Kategorie mit heller Fläche; Handy 4 je Reihe */}
      <nav aria-label="Signal" className="print:hidden">
        <ul className="m-0 grid list-none grid-cols-4 gap-1 p-0 sm:flex sm:flex-wrap">
          {SIGNALE.map(([id, label]) => {
            const on = id === signal;
            const Icon = ICONS[id];
            return (
              <li key={id} className="sm:w-[104px]">
                <button type="button" aria-pressed={on} onClick={() => pick({ signal: id === "vergaben" ? "" : id, phase: "", art: "" })}
                  className={`flex h-[76px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[12px] leading-tight ${on ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}>
                  {Icon && <Icon size={24} strokeWidth={1.2} aria-hidden="true" className={on ? "text-teal-700" : "text-slate-500"} />}
                  <span className="line-clamp-2">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Filterwerte der Kategorie (Leistung, Vorhaben …) als kleine Kacheln mit Icon, durch eine Linie in Petrol von den Kategorien getrennt (wie die Unterthemen im Atlas) */}
      {res && res.signal.id === signal && (res.arts ?? []).length > 0 && <nav aria-label={res.signal.art ?? "Art"} className="mt-2 border-t-2 border-teal-600 pt-2 print:hidden">
        <ul className="m-0 grid list-none grid-cols-4 gap-1 p-0 sm:flex sm:flex-wrap">
          {[{ key: "", name: "Alle" }, ...res.arts].map((a) => {
            const on = a.key === art;
            return <li key={a.key || "alle"} className="sm:w-[100px]"><button type="button" aria-pressed={on} onClick={() => pick({ art: on || !a.key ? "" : a.key })}
              className={`flex h-[60px] w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center text-[12px] leading-tight ${on ? "bg-teal-700 font-semibold text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
              {a.key ? <ArtIcon value={a.key} size={20} className={on ? "text-white" : "text-slate-500"} /> : <ThemeIcon theme="alle" size={20} className={on ? "text-white" : "text-slate-500"} />}
              <span className="line-clamp-2">{a.key ? artShort(a.name) : "Alle"}</span></button></li>;
          })}
        </ul>
      </nav>}
      <div className="mt-4 print:hidden"><DiffusionSearch noPlay play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} /></div>

      {error && <p role="alert" className="mt-4 text-[14px] text-slate-900">{error}</p>}
      {loading && !res && <Laden text="Signale werden geladen …" />}
      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {/* Antwort zuerst, über die ganze Breite */}
          <Befund link={false} tight>{res.total === 0
            ? `${res.signal.name}: keine Vorgänge${zeit !== "alle" ? ` in den letzten ${zeit} Monaten` : ""} für diese Auswahl.`
            : `${res.signal.name}: ${n(res.total)} ${res.total === 1 ? "Vorgang" : "Vorgänge"} in ${n(res.placeCount ?? res.places.length)} ${(res.placeCount ?? res.places.length) === 1 ? "Gebiet" : "Gebieten"}${zeit !== "alle" ? ` in den letzten ${zeit} Monaten` : ""}${phase ? `, Schritt „${res.phases.find((p) => p.key === phase)?.name ?? phase}“` : ""}.`}</Befund>

          {ATLAS_OF[signal] && <p className="mt-1 text-[14px] text-slate-500">Wie viel Raum das Thema in den Räten hat: <Link href={`/analytics/atlas?thema=${ATLAS_OF[signal][0]}${ATLAS_OF[signal][1] ? `&sub=${ATLAS_OF[signal][1]}` : ""}`} className="font-medium text-teal-700 hover:underline">{ATLAS_OF[signal][2]} im Atlas →</Link></p>}
          {/* Links die Karte (bleibt stehen), rechts Filter und Vorgänge; ab 1024 px nebeneinander */}
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-12">
            <div className="min-w-0 lg:sticky lg:top-4 lg:col-span-6 lg:self-start">
              {res.places.length > 0 ? <SignalMap places={res.places} onPlace={(ags) => search.setArea(ags, "map")} /> : <p className="text-[14px] text-slate-500">Keine Gebiete zur Auswahl.</p>}
            </div>
            <div className="min-w-0 lg:col-span-6">
              <div className="flex flex-col gap-2 print:hidden">
                <FilterRow label="Zeitraum">
                  {ZEITRAUM.map(([k, label]) => <button key={k} type="button" aria-pressed={k === zeit} onClick={() => pick({ zeit: k === "6" ? "" : k })} className={PILL(k === zeit)}>{label}</button>)}
                </FilterRow>
                {res.phases.length > 0 && <FilterRow label="Schritt">
                  <button type="button" aria-pressed={!phase} onClick={() => pick({ phase: "" })} className={PILL(!phase)}>Alle</button>
                  {res.phases.map((p) => <button key={p.key} type="button" aria-pressed={p.key === phase} onClick={() => pick({ phase: p.key === phase ? "" : p.key })} className={PILL(p.key === phase)}>
                    <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${dotOf(p.name, phaseOrder)}`} />{p.name}<span className={`tabular-nums ${p.key === phase ? "text-white/80" : "text-slate-500"}`}>{n(p.count)}</span></button>)}
                </FilterRow>}
              </div>

              {items.length > 0 && (
                <section className="mt-6" aria-label="Vorgänge">
                  <h2 className="text-[22px] font-semibold">Neueste Vorgänge</h2>
                  <ol className="m-0 mt-2 list-none border-t border-slate-200 p-0">
                    {items.slice(0, shown).map((r) => (
                      <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-2.5">
                        <Link href={`/beschluss/${r.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-800">
                          <span className="line-clamp-2 text-[14px] leading-snug sm:text-[16px]">{r.title}</span>
                          <span className="block truncate text-[12px] text-slate-500">{[r.region, day(r.date), (r.status === "announced" || r.status === "consulting") && (r.status === "announced" ? "angekündigt" : "in Beratung"), r.gremium].filter(Boolean).join(" · ")}</span>
                        </Link>
                        <span className="self-center whitespace-nowrap text-right text-[12px] text-slate-500"><span className="block"><span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${dotOf(r.phase, phaseOrder)}`} />{r.phase}</span>{r.arts?.length ? <span className="block text-slate-900">{r.arts.map(artShort).join(", ")}</span> : null}</span>
                      </li>
                    ))}
                  </ol>
                  {extra.error && <p role="alert" className="mt-2 text-[14px]">{extra.error}</p>}
                  {shown < res.total && (
                    <button type="button" disabled={extra.loading} onClick={showMore} className="mt-3 text-[14px] font-medium text-teal-700 hover:underline">
                      {extra.loading ? "Wird geladen …" : `Weitere ${n(Math.min(10, res.total - shown))} zeigen →`}
                    </button>
                  )}
                </section>
              )}
              <p className="mt-6 text-[12px] text-slate-500">Stand {day(res.builtAt?.slice(0, 10) ?? "")}. Gelesen aus Titeln, Vorlagen und Begründungen; jede Angabe mit Originalquelle im Vorgang.</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
