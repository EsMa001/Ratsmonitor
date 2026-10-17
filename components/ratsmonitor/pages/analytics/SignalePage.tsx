import Link from "next/link";
import { useEffect, useState } from "react";
import { Factory, FileSignature, Flame, House, Bus, Droplets, RadioTower, Route, School, Sun, Wind, type LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { XKopf, XWeiter } from "./XKopf";
import { Laden } from "./Laden";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalysisRun } from "./useAnalysisRun";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RegionMap } from "./RegionMap";
import { errorText, fetchJson } from "../../lib/fetchJson";
import { Fehler, Leer } from "./Befund";
import { Folgen, Kennzahlen, MeinOrt, Segmented, ZeitPills, useOrtInAdresse, weekAgo } from "./Kennzahlen";
import { ArtIcon } from "../../components/ArtIcon";
import { ThemeIcon } from "../../components/icons";
import type { Article } from "../../types";
import { MethodikNote } from "./Methodik";
import { DateBadge } from "../../components/DateBadge";

/* Antwort von /api/x/signale (server/integrations/plenara-x-signals.mjs) */
interface Signal { id: string; name: string; who: string; count: number }
interface Phase { key: string; name: string; count: number }
interface Place { region: string; name: string; ags: string; count: number; members?: string[] }
/* Karte wie in der Trefferliste der Suche (cardsById), dazu Ort im Verband und Stand */
interface Item extends Partial<Article> { id: string; title: string; region: string; date: string; status: Article["status"]; phase: string; arts?: string[]; /* Schlüssel des Gebiets */ place?: string; /* erster Vorgang dieses Signals im Gebiet */ firstHere?: boolean }
interface Result { signals: Signal[]; signal: { id: string; name: string; who: string; phaseText: string; art: string | null }; arts: Phase[]; phases: Phase[]; places: Place[]; placeCount?: number; /* Vorgänge, die in ihrem Ort die ersten dieses Signals sind (ohne den Filter) */ firstCount?: number; total: number; offset: number; size: number; builtAt: string; items: Item[] }

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
/* Farben je Stand: Knopf (aktiv/inaktiv) und Etikett in der Karte. Bekannte Schritte fest in Verfahrensreihenfolge (früh blau, spät
   Petrol, Aufhebung orange), sonst der Reihe nach aus der Palette; „Sonstiges“ grau. */
const TONES = [
  { on: "bg-sky-900 text-white", off: "bg-sky-50 text-sky-800 hover:bg-sky-100", tag: "bg-sky-50 text-sky-800" },
  { on: "bg-sky-700 text-white", off: "bg-sky-50 text-sky-800 hover:bg-sky-100", tag: "bg-sky-50 text-sky-800" },
  { on: "bg-slate-600 text-white", off: "bg-slate-50 text-slate-800 hover:bg-slate-100", tag: "bg-slate-50 text-slate-800" },
  { on: "bg-amber-600 text-white", off: "bg-amber-50 text-amber-800 hover:bg-amber-100", tag: "bg-amber-50 text-amber-800" },
  { on: "bg-teal-700 text-white", off: "bg-teal-50 text-teal-800 hover:bg-teal-100", tag: "bg-teal-50 text-teal-800" },
  { on: "bg-teal-600 text-white", off: "bg-teal-50 text-teal-800 hover:bg-teal-100", tag: "bg-teal-50 text-teal-800" },
  { on: "bg-amber-700 text-white", off: "bg-amber-50 text-amber-800 hover:bg-amber-100", tag: "bg-amber-50 text-amber-800" },
  { on: "bg-slate-800 text-white", off: "bg-slate-50 text-slate-800 hover:bg-slate-100", tag: "bg-slate-50 text-slate-800" },
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
const STEP_DOTS = ["bg-sky-900", "bg-sky-700", "bg-slate-500", "bg-amber-500", "bg-teal-700", "bg-teal-600", "bg-amber-700", "bg-slate-700"];
const dotOf = (name: string, order: string[]) => {
  if (/^Sonstig|Ohne Angabe|Noch nicht/.test(name)) return "bg-slate-400";
  const i = name in FIXED ? FIXED[name] : Math.max(0, order.indexOf(name));
  return STEP_DOTS[i % STEP_DOTS.length];
};

/* Thema (und Unterthema) im Atlas zur Kategorie: Hinweis unter der Antwortzeile */
/* Begriff je Signal für die Ausbreitung in plenara.X Trends */
const TRENDS_OF: Record<string, string> = { vergaben: "Vergabe", wohnbau: "Baugebiet", gewerbe: "Gewerbegebiet", wind: "Windenergie", solar: "Photovoltaik", waerme: "Wärmeplanung", schulen: "Schulsanierung", strasse: "Straßenausbau", wasser: "Hochwasserschutz", breitband: "Glasfaser", mobil: "Bürgerbus" };
const ATLAS_OF: Record<string, [string, string, string]> = {
  wohnbau: ["bauen", "bauen.wohnen", "Wohnungsbau"], gewerbe: ["wirtschaft", "wirtschaft.gewerbe", "Gewerbegebiete"], wind: ["umwelt", "umwelt.ee", "Erneuerbare"],
  solar: ["umwelt", "umwelt.ee", "Erneuerbare"], waerme: ["umwelt", "umwelt.waerme", "Wärme"], schulen: ["bildung", "", "Bildung & Betreuung"],
  strasse: ["mobilitaet", "mobilitaet.strasse", "Straßen und Brücken"], wasser: ["umwelt", "umwelt.wasser", "Wasser"], breitband: ["verwaltung", "verwaltung.breit", "Breitband"],
  mobil: ["mobilitaet", "", "Mobilität & Verkehr"],
};

/* Ort aus der Adresse (useOrtInAdresse hält ?ort aktuell, auch ohne den Router) */
const ortNow = () => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("ort") ?? "");
export const signaleHref = ({ signal = "", phase = "", art = "", zeit = "", ort = "", erstmals = "", basis = "/analytics/signale" }: { signal?: string; phase?: string; art?: string; zeit?: string; ort?: string; erstmals?: string; basis?: string }) => {
  const p = new URLSearchParams();
  if (signal) p.set("signal", signal);
  if (phase) p.set("stand", phase);
  if (art) p.set("art", art);
  if (zeit) p.set("zeit", zeit);
  if (erstmals) p.set("erstmals", erstmals);
  if (ort) p.set("ort", ort);
  return `${basis}${p.size ? "?" + p : ""}`;
};

/**
 * plenara.X Signale (Konzept docs/produkt/plenara-x-fakten-konzept.md): neue Ereignisse je Branche als Liste, mit Ort und Stand
 * (keine Kennzahlen, die stehen in plenara.X Fakten). Signal, Stand und Zeitraum stehen in der Adresse (teilbar), Ort und Begriff in der Suche.
 */
/* Ausklappbare Karte: Vorgänge der Auswahl je Gemeinde (Verbände färben ihre Mitgliedsgemeinden) */
function SignalMap({ places, onPlace, hover = "" }: { places: Place[]; onPlace: (ags: string) => void; /* Gebiet der überfahrenen Zeile (Schlüssel des Katalogs): auf der Karte hervorgehoben */ hover?: string }) {
  const [own, setPicked] = useState(""), [level, setLevel] = useState<"city" | "district">("city");
  /* Gemeinden: Vorgänge je Gemeinde (Verbände färben ihre Mitgliedsgemeinden); Kreise: Summe aller Gebiete im Kreis */
  const byAgs = new Map<string, { name: string; count: number }>();
  for (const p of places) {
    const own = p.ags.length === 8 ? [p.ags] : [];
    if (level === "district") { const k = p.ags.slice(0, 5); if (k.length === 5) { const o = byAgs.get(k); byAgs.set(k, { name: p.ags.length === 5 ? p.name : o?.name ?? `Kreis ${k}`, count: (o?.count ?? 0) + p.count }); } continue; }
    for (const a of [...own, ...(p.members ?? []).filter((m) => m.length === 8)]) if (!byAgs.has(a) || own.includes(a)) byAgs.set(a, p);
  }
  /* Ein Punkt je Vorgang (Signale zeigen einzelne Vorhaben, der Atlas Mengen als Flächen); Verbände verteilen ihre Punkte auf die Mitglieder */
  const dots: Record<string, number> = {};
  for (const p of places) {
    if (level === "district") { const k = p.ags.slice(0, 5); if (k.length === 5) dots[k] = (dots[k] ?? 0) + p.count; continue; }
    const keys = p.ags.length === 8 ? [p.ags] : (p.members ?? []).filter((m) => m.length === 8);
    keys.forEach((a, i) => { const k = Math.floor(p.count / keys.length) + (i < p.count % keys.length ? 1 : 0); if (k) dots[a] = (dots[a] ?? 0) + k; });
  }
  /* Vorschau: das Gebiet der überfahrenen Zeile (bei Verbänden die erste Mitgliedsgemeinde, auf Kreisebene der Kreis) */
  const hov = hover ? places.find((p) => p.region === hover) : undefined;
  const hovAgs = hov ? (level === "district" ? hov.ags.slice(0, 5) : hov.ags.length === 8 ? hov.ags : hov.members?.[0] ?? "") : "";
  const picked = hovAgs || own;
  const sel = picked ? byAgs.get(picked) : undefined;
  return (
    <section className="print:hidden" aria-label="Karte">
      {/* Klick wählt das Gebiet als Ort (Gemeinde oder Kreis), wie im Atlas */}
      <RegionMap tall level={level} levels={{}} dots={dots} colors={["var(--rm-fill)"]} picked={picked} onPick={(a) => { setPicked(picked === a ? "" : a); if (picked !== a && byAgs.has(a)) onPlace(a); }} legend={["1 Punkt = 1 Vorgang"]}
        note="Punkte liegen zufällig im Gebiet" label={`Karte: Vorgänge der Auswahl je ${level === "district" ? "Kreis" : "Gemeinde"}`}
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

/* fest: Seite für genau eine Kategorie (plenara.X Ausschreibungen = Kategorie „vergaben“, eigene Adresse, ohne Kategorienwahl) */
export function SignalePage({ fest }: { fest?: string } = {}) {
  const params = useSearchParams(), router = useRouter(), path = usePathname();
  const basis = fest ? "/analytics/ausschreibungen" : "/analytics/signale";
  const signal = fest ?? (SIGNAL_IDS.has(params.get("signal") ?? "") ? params.get("signal")! : "vergaben");
  const phase = params.get("stand") ?? "";
  const art = params.get("art") ?? "";
  const zeitRaw = params.get("zeit");
  const zeit = zeitRaw === null ? "6" : ZEITRAUM.some(([k]) => k === zeitRaw) ? zeitRaw : "6";
  /* Nur Vorgänge, die in ihrem Ort die ersten dieses Signals sind */
  const erstmals = params.get("erstmals") === "1" ? "1" : "";
  const pick = (next: { signal?: string; phase?: string; art?: string; zeit?: string; erstmals?: string }) => router.push(signaleHref({ basis, signal: signal === "vergaben" ? "" : signal, phase, art, zeit: zeit === "6" ? "" : zeit, ort: ortNow(), erstmals, ...next }), { scroll: false });
  // Ungültige Werte in der Adresse still berichtigen
  const target = signaleHref({ basis, signal: signal === "vergaben" ? "" : signal, phase, art, zeit: zeit === "6" ? "" : zeit, erstmals, ort: /^\d{5,9}$/.test(params.get("ort") ?? "") ? params.get("ort")! : "" });
  const current = path + (params.size ? "?" + params : "");
  useEffect(() => { if (current !== target && (params.has("signal") || params.has("zeit"))) router.replace(target, { scroll: false }); }, [current, target, router, params]);

  const { query, search } = useAnalyticsQuery();
  /* Zeitraum der Seite ersetzt den der Suche nur, wenn die Suche selbst keinen hat */
  const q = new URLSearchParams(query);
  if (fromOf(zeit) && !q.get("from")) q.set("from", fromOf(zeit));
  const url = `/api/x/signale?signal=${signal}${phase ? `&phase=${encodeURIComponent(phase)}` : ""}${art ? `&art=${encodeURIComponent(art)}` : ""}${erstmals ? "&first=1" : ""}&${q}`;
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

  const areaAgs = new URLSearchParams(query).get("area") ?? "";
  const items = [...(res?.items ?? []), ...extra.items];
  /* In den letzten 7 Tagen beraten (Sitzungsdatum), in derselben Auswahl (nur die Zahl) */
  const [week, setWeek] = useState<number | null>(null);
  useEffect(() => {
    if (!res) return;
    const c = new AbortController();
    fetch(`${url.replace(/&from=[^&]*/, "")}&from=${weekAgo()}`, { signal: c.signal }).then((r) => (r.ok ? (r.json() as Promise<{ total?: number }>) : null)).then((b) => setWeek(typeof b?.total === "number" ? b.total : null)).catch(() => {});
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);
  /* Zuerst 10 zeigen; „Weitere“ zeigt die schon geladenen, dann lädt es nach */
  const [shownFor, setShownFor] = useState({ url: "", n: 10 });
  const shown = shownFor.url === url ? shownFor.n : 10;
  const showMore = () => {
    const next = shown + 10;
    setShownFor({ url, n: next });
    if (next > items.length && items.length < (res?.total ?? 0)) loadMore();
  };
  const zeitText = ZEITRAUM.find(([k]) => k === zeit)?.[1];
  const [hoverPlace, setHoverPlace] = useState("");
  useOrtInAdresse(areaAgs, (a) => search.setArea(a, "ui"));
  /* Antwort mit Namen: die Orte mit den meisten Vorgängen */
  const topPlaces = res ? [...res.places].sort((a, b) => b.count - a.count).slice(0, 3) : [];
  const phaseOrder = (res?.phases ?? []).map((p) => p.name);

  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <XKopf seite={fest ? "ausschreibungen" : "signale"} />

      {/* Kacheln wie im Atlas: Icon über dem Namen, nur die gewählte Kategorie mit heller Fläche; Handy: Auswahlfeld */}
      {!fest && <label className="block sm:hidden print:hidden">
        <span className="sr-only">Signal</span>
        <select value={signal} onChange={(e) => pick({ signal: e.target.value === "vergaben" ? "" : e.target.value, phase: "", art: "" })} className="select-base h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[16px]">
          {SIGNALE.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>}
      {!fest && <nav aria-label="Signal" className="hidden sm:block print:hidden">
        <ul className="m-0 grid list-none grid-cols-5 gap-1 p-0 lg:grid-cols-10">
          {SIGNALE.map(([id, label]) => {
            const on = id === signal;
            const Icon = ICONS[id];
            return (
              <li key={id}>
                <button type="button" aria-pressed={on} onClick={() => pick({ signal: id === "vergaben" ? "" : id, phase: "", art: "" })}
                  className={`flex h-[76px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[12px] leading-tight ${on ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}>
                  {Icon && <Icon size={24} strokeWidth={1.2} aria-hidden="true" className={on ? "text-teal-700" : "text-slate-500"} />}
                  <span className="line-clamp-2">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>}

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

      {error && <Fehler>{error}</Fehler>}
      {loading && !res && <Laden text={fest ? "Ausschreibungen werden geladen …" : "Signale werden geladen …"} />}
      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {/* Antwort zuerst: große Kennzahlen, über die ganze Breite */}
          {res.total === 0 ? <Leer tipp="Einen längeren Zeitraum, eine andere Art oder „Alle Themen“ wählen, oder den Ort entfernen.">{`Keine Vorgänge für diese Auswahl: ${res.signal.name}${zeit !== "alle" ? `, letzte ${zeit} Monate` : ""}.`}</Leer>
            : <Kennzahlen week={week} band={fest ? "Ausschreibungen" : "Signale"} scope={[res.signal.name, art ? artShort(art) : "", phase ? `Schritt „${res.phases.find((p) => p.key === phase)?.name ?? phase}“` : "", areaAgs && res.places.length === 1 ? res.places[0].name : ""].filter(Boolean).join(" · ")} period={zeit === "alle" ? "gesamter Zeitraum" : zeitText ? `letzte ${zeitText}` : undefined} items={[{ value: n(res.total), label: res.total === 1 ? "Vorgang" : "Vorgänge" }, { value: n(res.placeCount ?? res.places.length), label: (res.placeCount ?? res.places.length) === 1 ? "Gebiet" : "Gebiete" }]}>
              <span>{res.signal.name}{art ? ` · ${artShort(art)}` : ""}{phase ? ` · Schritt „${res.phases.find((p) => p.key === phase)?.name ?? phase}“` : ""}</span>
              <ZeitPills value={zeit} all="alle" onPick={(k) => pick({ zeit: k === "6" ? "" : k })} />
              <MeinOrt current={areaAgs && res.places.length === 1 ? { ags: areaAgs, name: res.places[0].name } : null} onApply={(ags) => search.setArea(ags, "ui")} />
              <Folgen hint="Neue Vorgänge zu Ort und Suche per Mail (die Signalkategorie wird noch nicht gespeichert)" />
            </Kennzahlen>}

          {topPlaces.length > 1 && res.total > 0 && <p className="mt-3 text-[18px] font-semibold leading-snug">Am meisten in {topPlaces.map((p, i) => <span key={p.region}>{i ? (i === topPlaces.length - 1 ? " und " : ", ") : ""}<button type="button" onClick={() => search.setArea(p.ags || p.members?.[0] || "", "ui")} className="font-semibold text-teal-700 hover:underline">{p.name}</button> ({n(p.count)})</span>)}.</p>}
          {(ATLAS_OF[signal] || TRENDS_OF[signal]) && <p className="mt-1 text-[14px] text-slate-500">
            {ATLAS_OF[signal] && <>Wie viel Raum das Thema in den Räten hat: <Link href={`/analytics/atlas?thema=${ATLAS_OF[signal][0]}${ATLAS_OF[signal][1] ? `&sub=${ATLAS_OF[signal][1]}` : ""}`} className="font-medium text-teal-700 hover:underline">{ATLAS_OF[signal][2]} im Atlas →</Link></>}
            {ATLAS_OF[signal] && TRENDS_OF[signal] && " · "}
            {TRENDS_OF[signal] && <>Wie es sich ausbreitet: <Link href={`/analytics/trends?begriff=${encodeURIComponent(TRENDS_OF[signal])}`} className="font-medium text-teal-700 hover:underline">„{TRENDS_OF[signal]}“ in den Trends →</Link></>}
          </p>}
          {/* Links die Karte (bleibt stehen), rechts Filter und Vorgänge; ab 1024 px nebeneinander */}
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-12">
            <div className="min-w-0 lg:sticky lg:top-4 lg:col-span-6 lg:self-start">
              {res.places.length > 0 ? <SignalMap places={res.places} hover={hoverPlace} onPlace={(ags) => search.setArea(ags, "map")} /> : <p className="text-[14px] text-slate-500">Keine Gebiete zur Auswahl.</p>}
            </div>
            <div className="min-w-0 lg:col-span-6">
              <div className="flex flex-col gap-2 print:hidden">
                {res.phases.length > 0 && <FilterRow label="Schritt">
                  <button type="button" aria-pressed={!phase} onClick={() => pick({ phase: "" })} className={PILL(!phase)}>Alle</button>
                  {res.phases.map((p) => <button key={p.key} type="button" aria-pressed={p.key === phase} onClick={() => pick({ phase: p.key === phase ? "" : p.key })} className={PILL(p.key === phase)}>
                    <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${dotOf(p.name, phaseOrder)}`} />{p.name}<span className={`tabular-nums ${p.key === phase ? "text-white/80" : "text-slate-500"}`}>{n(p.count)}</span></button>)}
                </FilterRow>}
              </div>

              {(items.length > 0 || !!erstmals) && (
                <section className="mt-6" aria-label="Vorgänge">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[22px] font-semibold">{erstmals ? "Erstmals im Ort" : "Neueste Vorgänge"}</h2>
                    {res.firstCount !== undefined && (res.firstCount > 0 || !!erstmals) && <Segmented label="Auswahl" value={erstmals ? "erst" : "neu"} onPick={(k) => pick({ erstmals: k === "erst" ? "1" : "" })}
                      options={[["neu", "Neueste"], ["erst", `Erstmals hier${res.firstCount ? ` (${n(res.firstCount)})` : ""}`, "Nur Vorgänge, die in ihrem Ort die ersten dieser Art sind (Bestand des Orts seit mindestens einem Jahr davor)"]]} />}
                  </div>
                  {items.length === 0 && <Leer tipp="„Erstmals hier“ zählt nur Gebiete mit mindestens 12 Monaten Daten davor; „Neueste“ zeigt alle Vorgänge.">In dieser Auswahl ist kein Vorgang der erste seiner Art im Ort.</Leer>}
                  <ol className="m-0 mt-2 list-none border-t border-slate-200 p-0">
                    {items.slice(0, shown).map((r) => (
                      <li key={r.id} onMouseEnter={() => setHoverPlace(r.place ?? "")} onMouseLeave={() => setHoverPlace("")} onFocus={() => setHoverPlace(r.place ?? "")} onBlur={() => setHoverPlace("")} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-2.5">
                        <DateBadge iso={r.date} />
                        <Link href={`/beschluss/${r.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-800">
                          <span className="line-clamp-2 text-[14px] leading-snug sm:text-[16px]">{r.firstHere && <span title="Der erste Vorgang dieser Art in diesem Ort (Bestand seit mindestens einem Jahr davor)" className="mr-1.5 rounded-full bg-teal-50 px-2 py-0.5 align-[1px] text-[12px] font-medium text-teal-800">erstmals hier</span>}{r.title}</span>
                          <span className="block truncate text-[12px] text-slate-500">{[r.region, (r.status === "announced" || r.status === "consulting") && (r.status === "announced" ? "angekündigt" : "in Beratung"), r.gremium].filter(Boolean).join(" · ")}</span>
                        </Link>
                        <span className="self-center whitespace-nowrap text-right text-[12px] text-slate-500"><span className="block"><span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${dotOf(r.phase, phaseOrder)}`} />{r.phase}</span>{r.arts?.length ? <span className="block text-slate-900">{r.arts.map(artShort).join(", ")}</span> : null}</span>
                      </li>
                    ))}
                  </ol>
                  {extra.error && <Fehler>{extra.error}</Fehler>}
                  {shown < res.total && (
                    <button type="button" disabled={extra.loading} onClick={showMore} className="mt-3 text-[14px] font-medium text-teal-700 hover:underline">
                      {extra.loading ? "Wird geladen …" : `Weitere ${n(Math.min(10, res.total - shown))} zeigen →`}
                    </button>
                  )}
                </section>
              )}
              <MethodikNote>Stand {day(res.builtAt?.slice(0, 10) ?? "")}. Gelesen aus Titeln, Vorlagen und Begründungen; jede Angabe mit Originalquelle im Vorgang.</MethodikNote>
            </div>
          </div>
        </div>
      )}
    <XWeiter links={fest ? [["/analytics/signale", "Was entsteht? (Signale)"], ["/analytics/news", "Was ist berichtenswert? (Aktuelles)"], ["/analytics/atlas", "Wie viel? (Atlas)"]] : [["/analytics/news", "Was ist berichtenswert? (Aktuelles)"], ["/analytics/atlas", "Wie viel? (Atlas)"]]} />
    </main>
  );
}
