import { RailToggle } from "./RailToggle";
import { Segmented } from "../../components/Segmented";
import { SubtopicIcon } from "../../components/SubtopicIcon";
import { ThemeIcon } from "../../components/icons";
import { useSubParam } from "../../lib/subParam";
import { SUBTOPICS, THEMES } from "@/shared/themes.mjs";
import { useDwell } from "../../lib/useDwell";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, LayoutGrid, Factory, FileSignature, Flame, House, Bus, Droplets, RadioTower, Route, School, Sun, Wind, type LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { XKopf, XWeiter } from "./XKopf";
import { useRailFold } from "../../lib/useRailFold";
import { ListenKopf } from "./ListenKopf";
import { SplitHandle } from "./SplitHandle";
import { Laden } from "./Laden";
import { DiffusionSearch } from "./DiffusionSearch";
import { useAnalysisRun } from "./useAnalysisRun";
import { useAnalyticsQuery } from "./useAnalyticsQuery";
import { RegionMap } from "./RegionMap";
import { errorText, fetchJson } from "../../lib/fetchJson";
import { Fehler, Leer } from "./Befund";
import { Folgen, Kennzahlen, ZeitPills, countScale, useOrtInAdresse, weekAgo } from "./Kennzahlen";
import { AktiveFilter, Dropdown } from "../../components/Dropdown";
import { StepIcon } from "../../components/StepIcon";
import { ArtIcon } from "../../components/ArtIcon";
import type { Article } from "../../types";
import { MethodikNote } from "./Methodik";
import { MapWheels } from "./MapWheels";
import { ListSkeleton } from "./ListSkeleton";
import { DateBadge } from "../../components/DateBadge";

/* Antwort von /api/x/signale (server/integrations/plenara-x-signals.mjs) */
interface Signal { id: string; name: string; who: string; count: number }
interface Phase { key: string; name: string; count: number }
interface Place { region: string; name: string; ags: string; count: number; members?: string[] }
/* Karte wie in der Trefferliste der Suche (cardsById), dazu Ort im Verband und Stand */
interface Item extends Partial<Article> { id: string; title: string; region: string; date: string; status: Article["status"]; phase: string; arts?: string[]; /* Schlüssel des Gebiets */ place?: string; /* erster Vorgang dieses Signals im Gebiet */ firstHere?: boolean }
interface Result { /* subs=1 (Ausschreibungen): Treffer je Unterthema */ subs?: Phase[]; signals: Signal[]; signal: { id: string; name: string; who: string; phaseText: string; art: string | null }; arts: Phase[]; phases: Phase[]; places: Place[]; placeCount?: number; /* Vorgänge, die in ihrem Ort die ersten dieses Signals sind (ohne den Filter) */ firstCount?: number; total: number; offset: number; size: number; builtAt: string; items: Item[] }

/* Signale und Zeiträume in derselben Reihenfolge wie im Backend; die Zahlen kommen mit der Antwort */
const SIGNALE: [string, string][] = [
  ["wohnbau", "Neue Wohnbaugebiete"], ["gewerbe", "Gewerbe, Industrie, Handel"], ["wind", "Windenergie"],
  ["solar", "Solarenergie"], ["waerme", "Wärme und Netze"], ["schulen", "Schulen, Kitas, Sport"], ["strasse", "Straßen und Brücken"],
  ["wasser", "Wasser und Hochwasser"], ["breitband", "Breitband und Mobilfunk"], ["mobil", "Mobilität"],
];
/* Symbol je Kategorie (Reihenfolge wie SIGNALE) */
const ICONS: Record<string, LucideIcon> = { alle: LayoutGrid, vergaben: FileSignature, wohnbau: House, gewerbe: Factory, wind: Wind, solar: Sun, waerme: Flame, schulen: School, strasse: Route, wasser: Droplets, breitband: RadioTower, mobil: Bus };
/* „Alle Projekte“: alle Kategorien außer Ausschreibungen zusammen, wie eine Kategorie mit Karte und Liste (Filter ist die Kategorie) */
const ALLE = "alle";
const SIGNAL_IDS = new Set([ALLE, ...SIGNALE.map(([id]) => id)]);
const MIT_ALLE: [string, string][] = [[ALLE, "Alle Projekte"], ...SIGNALE];
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
const FIXED: Record<string, number> = {
  Aufstellung: 0, "Frühzeitige Beteiligung": 1, Offenlage: 2, Abwägung: 3, Satzungsbeschluss: 4, Aufhebung: 6,
  "Start und Beauftragung": 0, "Analyse und Zwischenstand": 1, "Entwurf und Beteiligung": 2, "Wärmeplan vorgelegt": 4, "Umsetzung und Fortschreibung": 5,
  "Antrag und Anfrage": 7, Ausschreibung: 0, Vergabe: 4, Nachtrag: 3, "Planung und Konzept": 0, "Ausschreibung und Vergabe": 2, "Bau und Sanierung": 4, "Bauanträge Dritter": 1, "Beteiligung": 3, "Bericht und Sachstand": 5,
};

/* Kurze Namen der Filterwerte (Leistung u. a.) für Pillen und Liste */
const ART_SHORT: Record<string, string> = { "Planung und Ingenieurleistung": "Planung", "Lieferung und Fahrzeuge": "Lieferung", "IT und Digitales": "IT", Planungsleistungen: "Planung", "Fahrzeuge und Ausstattung": "Fahrzeuge", "Sonstige Leistungen": "Sonstige", "Tiefbau und Straße": "Tiefbau", "Wasser und Abwasser": "Wasser", "IT und Glasfaser": "IT", "Batteriespeicher und Wasserstoff": "Speicher und Wasserstoff", "Hotel, Camping und Freizeit": "Hotel und Camping", "Bike- oder Lastenradverleih": "Radverleih", "Bürgerbus oder Rufbus": "Bürgerbus", "Sporthalle und Sportplatz": "Sport", "Weiterführende Schule": "Weiterf. Schule", "Gehweg und Barrierefreiheit": "Gehweg", "Ortsdurchfahrt und Kreisverkehr": "Ortsdurchfahrt", "Straßenausbau und -sanierung": "Straßenausbau", "Wärmenetz und Fernwärme": "Wärmenetz", "LED-Straßenbeleuchtung": "LED-Licht", "Hochwasser und Starkregen": "Hochwasser", "Bürger- und Kommunalbeteiligung": "Beteiligung", "Genehmigungsantrag (BImSchG)": "Genehmigung", "Glasfaser und Breitband": "Glasfaser" };
const artShort = (a: string) => ART_SHORT[a] ?? a;
/* Farbe des Stands (Icon in Filter und Liste): fester Ton je Schritt, sonst nach Reihenfolge */
const STEP_TONES = ["text-sky-900", "text-sky-700", "text-slate-500", "text-amber-500", "text-teal-700", "text-teal-600", "text-amber-700", "text-slate-700"];
const toneOf = (name: string, order: string[]) => {
  if (/^Sonstig|Ohne Angabe|Noch nicht/.test(name)) return "text-slate-400";
  const i = name in FIXED ? FIXED[name] : Math.max(0, order.indexOf(name));
  return STEP_TONES[i % STEP_TONES.length];
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
const signaleHref = ({ signal = "", phase = "", art = "", zeit = "", ort = "", erstmals = "", gruppe = "", sub = "", basis = "/analytics/signale" }: { signal?: string; phase?: string; art?: string; zeit?: string; ort?: string; erstmals?: string; gruppe?: string; sub?: string; basis?: string }) => {
  const p = new URLSearchParams();
  if (signal) p.set("signal", signal);
  if (gruppe) p.set("gruppe", gruppe);
  if (phase) p.set("stand", phase);
  if (art) p.set("art", art);
  if (zeit) p.set("zeit", zeit);
  if (erstmals) p.set("erstmals", erstmals);
  if (ort) p.set("ort", ort);
  if (sub) p.set("sub", sub);
  return `${basis}${p.size ? "?" + p : ""}`;
};

/**
 * plenara.X Signale (Konzept docs/produkt/plenara-x-fakten-konzept.md): neue Ereignisse je Branche als Liste, mit Ort und Stand
 * (keine Kennzahlen, die stehen in plenara.X Fakten). Signal, Stand und Zeitraum stehen in der Adresse (teilbar), Ort und Begriff in der Suche.
 */
/* Ausklappbare Karte: Vorgänge der Auswahl je Gemeinde (Verbände färben ihre Mitgliedsgemeinden) */
function SignalMap({ places, onPlace, hover = "", zeit, onZeit, schritt, wheels, pill }: { /* Handy: Auswahl als Walzen und Schritt als Pille auf der Karte */ wheels?: React.ReactNode; pill?: React.ReactNode; /* Schritt-Auswahl (Glas auf der Karte, nur am breiten Bildschirm) */ schritt?: React.ReactNode; /* Zeitraum: am breiten Bildschirm auf der Karte */ zeit?: string; onZeit?: (z: string) => void; places: Place[]; onPlace: (ags: string) => void; /* Gebiet der überfahrenen Zeile (Schlüssel des Katalogs): auf der Karte hervorgehoben */ hover?: string }) {
  const [own, setPicked] = useState(""), [level, setLevel] = useState<"city" | "district">("city");
  /* Gemeinden: Vorgänge je Gemeinde (Verbände färben ihre Mitgliedsgemeinden); Kreise: Summe aller Gebiete im Kreis */
  const byAgs = new Map<string, { name: string; count: number }>();
  for (const p of places) {
    const own = p.ags.length === 8 ? [p.ags] : [];
    if (level === "district") { const k = p.ags.slice(0, 5); if (k.length === 5) { const o = byAgs.get(k); byAgs.set(k, { name: p.ags.length === 5 ? p.name : o?.name ?? `Kreis ${k}`, count: (o?.count ?? 0) + p.count }); } continue; }
    for (const a of [...own, ...(p.members ?? []).filter((m) => m.length === 8)]) if (!byAgs.has(a) || own.includes(a)) byAgs.set(a, p);
  }
  /* Flächen wie im Atlas: Gemeinden (bzw. Kreise) mit Vorgängen eingefärbt, vier Stufen nach Vierteln der Gebiete (countScale) */
  const scale = countScale([...byAgs.values()].map((x) => x.count));
  const levels: Record<string, number> = {};
  for (const [a, x] of byAgs) levels[a] = scale.level(x.count);
  /* Vorschau: das Gebiet der überfahrenen Zeile (bei Verbänden die erste Mitgliedsgemeinde, auf Kreisebene der Kreis) */
  const hov = hover ? places.find((p) => p.region === hover) : undefined;
  const hovAgs = hov ? (level === "district" ? hov.ags.slice(0, 5) : hov.ags.length === 8 ? hov.ags : hov.members?.[0] ?? "") : "";
  const picked = hovAgs || own;
  const sel = picked ? byAgs.get(picked) : undefined;
  return (
    <section className="relative print:hidden" aria-label="Karte">
      {/* Klick wählt das Gebiet als Ort (Gemeinde oder Kreis), wie im Atlas */}
      <RegionMap tall phoneStage level={level} levels={levels} picked={picked} onPick={(a) => { setPicked(picked === a ? "" : a); if (picked !== a && byAgs.has(a)) onPlace(a); }} legend={scale.legend}
        note="ohne Farbe: keine Vorgänge" label={`Karte: Vorgänge der Auswahl je ${level === "district" ? "Kreis" : "Gemeinde"}`}
        info={sel ? <><b className="font-semibold">{sel.name}</b><br /><span className="text-slate-500">{n(sel.count)} {sel.count === 1 ? "Vorgang" : "Vorgänge"}</span></> : picked ? <span className="text-slate-500">Hier gibt es keine Vorgänge zur Auswahl.</span> : undefined} />
      {wheels}
      {pill}
      <div className="rm-xtop">
      <div className="rm-xebene mt-3 flex flex-wrap items-center gap-2 max-sm:hidden" role="group" aria-label="Ebene der Karte">
        <span className="text-[14px] text-slate-500">Ebene</span>
        {([["city", "Gemeinden"], ["district", "Kreise"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => { setLevel(k); setPicked(""); }} className={PILL(level === k)}>{l}</button>)}
        <span className="text-[14px] text-slate-500">· Gebiet antippen wählt den Ort</span>
      </div>
      {onZeit && <div className="rm-xzeit"><ZeitPills value={zeit ?? ""} all="alle" onPick={onZeit} /></div>}
      {schritt && <div className="rm-xschritt">{schritt}</div>}
      </div>
    </section>
  );
}

/* Kompakte Filterzeile: Wort links, Pillen rechts (wie die Unterthemen im Atlas); Stand mit farbigem Punkt statt farbigem Text */
const PILL = (on: boolean) => `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[14px] ${on ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`;
/* fest: Seite für genau eine Kategorie (plenara.X Ausschreibungen = Kategorie „vergaben“, eigene Adresse, ohne Kategorienwahl) */
export function SignalePage({ fest }: { fest?: string } = {}) {
  const params = useSearchParams(), router = useRouter(), path = usePathname();
  const basis = fest ? "/analytics/ausschreibungen" : "/analytics/signale";
  /* Standard: die erste Kategorie (steht dann nicht in der Adresse); „Ausschreibungen und Vergaben“ ist seit 18.10.2026 eine eigene Seite unter Einblicke */
  const standard = fest ?? SIGNALE[0][0];
  const signal = fest ?? (SIGNAL_IDS.has(params.get("signal") ?? "") ? params.get("signal")! : standard);
  const phase = params.get("stand") ?? "";
  /* Stand grob (Ausschreibungen): noch offen oder entschieden; der Schritt (stand) wählt darin genauer */
  const gruppe = ["offen", "entschieden"].includes(params.get("gruppe") ?? "") ? params.get("gruppe")! : "";
  const subNow = () => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("sub") ?? "");
  const art = params.get("art") ?? "";
  const zeitRaw = params.get("zeit");
  const zeit = zeitRaw === null ? "6" : ZEITRAUM.some(([k]) => k === zeitRaw) ? zeitRaw : "6";
  /* Nur Vorgänge, die in ihrem Ort die ersten dieses Signals sind */
  /* Die Ansicht „Erstmals hier“ gibt es nicht mehr (Schalter und Überschrift entfallen); ältere Links mit ?erstmals=1 zeigen die normale Liste */
  const erstmals = "";
  const pick = (next: { signal?: string; phase?: string; art?: string; zeit?: string; erstmals?: string; gruppe?: string }) => router.push(signaleHref({ basis, signal: signal === standard ? "" : signal, phase, art, zeit: zeit === "6" ? "" : zeit, ort: ortNow(), erstmals, gruppe, sub: subNow(), ...next }), { scroll: false });
  const [railRef, railFolded, railUnfold] = useRailFold(signal);
  // Ungültige Werte in der Adresse still berichtigen
  const target = signaleHref({ basis, signal: signal === standard ? "" : signal, phase, art, zeit: zeit === "6" ? "" : zeit, erstmals, gruppe, sub: params.get("sub") ?? "", ort: /^\d{5,9}$/.test(params.get("ort") ?? "") ? params.get("ort")! : "" });
  const current = path + (params.size ? "?" + params : "");
  useEffect(() => {
    /* alte Links (…/signale?signal=vergaben) führen auf die Seite Ausschreibungen */
    if (!fest && params.get("signal") === "vergaben") { router.replace(signaleHref({ basis: "/analytics/ausschreibungen", phase, art, zeit: zeit === "6" ? "" : zeit, erstmals, ort: /^\d{5,9}$/.test(params.get("ort") ?? "") ? params.get("ort")! : "" }), { scroll: false }); return; }
    if (current !== target && (params.has("signal") || params.has("zeit"))) router.replace(target, { scroll: false });
  }, [current, target, router, params, fest, phase, art, zeit, erstmals]);

  const { query, search } = useAnalyticsQuery();
  /* Unterthema aus der Themenleiste (?sub=), für den Kopf der Liste */
  const [subId, setSub] = useSubParam();
  const subTheme = THEMES.find((t: { id: string }) => t.id === SUBTOPICS.find((x: { id: string }) => x.id === subId)?.theme)?.name;
  /* Ausschreibungen: Thema (Filter der Suche, gilt auf allen plenara.X-Seiten) über den Bereichen; ein Bereich eines anderen Themas fällt weg */
  /* Der Suchfilter speichert den Namen des Themas („Umwelt, Klima & Energie“), hier wird mit der Kennung gearbeitet */
  const thema = THEMES.find((t: { id: string; name: string }) => t.name === search.state.thema)?.id ?? "";
  const pickThema = (id: string) => { if (subId && id && !subId.startsWith(id + ".")) setSub(""); search.setThema(THEMES.find((t: { id: string; name: string }) => t.id === id)?.name ?? ""); };
  const ofThema = <T extends { key: string }>(list: T[]) => (thema ? list.filter((b) => b.key.startsWith(thema + ".")) : list);
  /* Zeitraum der Seite ersetzt den der Suche nur, wenn die Suche selbst keinen hat */
  const q = new URLSearchParams(query);
  if (fromOf(zeit) && !q.get("from")) q.set("from", fromOf(zeit));
  const url = `/api/x/signale?signal=${signal}${phase ? `&phase=${encodeURIComponent(phase)}` : ""}${art ? `&art=${encodeURIComponent(art)}` : ""}${erstmals ? "&first=1" : ""}${fest ? "&subs=1" : ""}${gruppe ? `&group=${gruppe}` : ""}&${q}`;
  const { res, ranKey, loading, error, stale, run } = useAnalysisRun<Result>({ key: url, url, initial: true });
  /* Neue Auswahl rechnet noch: statt des alten Ergebnisses sofort pulsierende Kacheln */
  const pending = loading && !!res && ranKey !== url;
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
  /* Ausschreibungen, Desktop: zuerst die zehn Bereiche mit den meisten Treffern, „Weitere“ klappt alle auf */
  const [alleBereiche, setAlleBereiche] = useState(false);
  /* Liste → Karte erst nach kurzem Verweilen (sonst zoomt die Karte bei jedem Überfahren) */
  const hoverPlaceD = useDwell(setHoverPlace, "");
  /* Karte standardmäßig eingeklappt (Signale und Ausschreibungen); aufklappen auf Wunsch */
  const [kartePick, setKartePick] = useState<boolean | null>(null);
  const karte = kartePick ?? true;
  const setKarte = (f: (k: boolean) => boolean) => setKartePick(f(karte));
  useOrtInAdresse(areaAgs, (a) => search.setArea(a, "ui"));
  /* Antwort mit Namen: die Orte mit den meisten Vorgängen */
  const phaseOrder = (res?.phases ?? []).map((p) => p.name);
  /* „Alle Projekte“: der Filterwert ist die Kategorie; ihr Symbol aus der Kategorienleiste */
  const catIcon = (name: string) => { const id = res?.signals.find((x) => x.name === name)?.id; const I = id ? ICONS[id] : undefined; return I ? <I size={14} strokeWidth={1.4} className="text-slate-500" /> : null; };

  /* Schritt-Auswahl: in der Filterzeile, am breiten Bildschirm stattdessen als Glas auf der Karte */

  return (
    <main id="inhalt" className={`${karte ? "rm-xwide rm-noplay " : ""}w-full px-[max(1vw,16px)] pb-10 text-slate-900`}>
      <XKopf seite={fest ? "ausschreibungen" : "signale"} />
      <SplitHandle />

      {/* Kacheln wie im Atlas: Icon über dem Namen, nur die gewählte Kategorie mit heller Fläche; Handy: Auswahlfeld */}
      {/* Ausschreibungen: eine Kategorie, deshalb die Themen als Kacheln wie auf den übrigen Seiten */}
      {/* Ausschreibungen: statt der Themen die Bereiche (Unterthemen) mit Treffern, die meisten zuerst; Handy: als Walze mit allen Bereichen */}
      {fest && res && (res.subs ?? []).length > 0 && (() => {
        const subs = ofThema(res.subs ?? []), top = subs.slice(0, 10), mehr = subs.length - top.length;
        /* Ein gewählter Bereich bleibt sichtbar, auch wenn er nicht unter den ersten zehn ist */
        const shown = alleBereiche ? subs : [...top, ...subs.filter((b) => b.key === subId && !top.includes(b))];
        const bereiche = [{ key: "", name: "Alle Bereiche", count: 0 }, ...shown];
        const short = (k: string, name: string) => SUBTOPICS.find((x: { id: string }) => x.id === k)?.short ?? name;
        return <>
          <nav aria-label="Thema" className="rm-xrail mb-1 hidden sm:block print:hidden">
            <ul className="m-0 grid list-none grid-cols-6 gap-1 p-0 min-[640px]:grid-cols-11">
              {[{ id: "", name: "Alle Themen" }, ...THEMES].map((t: { id: string; name: string }) => { const on = t.id === thema; return <li key={t.id || "alle"}>
                <button type="button" aria-pressed={on} title={t.name} onClick={() => pickThema(on ? "" : t.id)}
                  className={`flex h-full min-h-[60px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[12px] leading-tight ${on ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}>
                  <ThemeIcon theme={t.id || "alle"} size={20} className={on ? "text-teal-700" : "text-slate-500"} />
                  <span className="line-clamp-2 min-w-0">{t.name}</span>
                </button></li>; })}
            </ul>
          </nav>
          <nav aria-label="Bereich" className="rm-xrail mb-4 hidden border-t border-slate-200 pt-1 sm:block print:hidden">
            <ul className="m-0 grid list-none grid-cols-6 gap-1 p-0 min-[640px]:grid-cols-11">
              {bereiche.map((b) => { const on = b.key === subId; return <li key={b.key || "alle"}>
                <button type="button" aria-pressed={on} title={b.key ? `${b.name}: ${n(b.count)}` : b.name} onClick={() => setSub(on ? "" : b.key)}
                  className={`flex h-full min-h-[60px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[12px] leading-tight ${on ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}>
                  {b.key ? <SubtopicIcon id={b.key} size={20} /> : <LayoutGrid size={20} strokeWidth={1.2} aria-hidden="true" className={on ? "text-teal-700" : "text-slate-500"} />}
                  <span className="line-clamp-2 min-w-0 flex-1">{b.key ? short(b.key, b.name) : b.name}</span>
                  {b.key ? <span className="tabular-nums text-slate-500">{n(b.count)}</span> : null}
                </button></li>; })}
              {mehr > 0 && <li><button type="button" aria-expanded={alleBereiche} onClick={() => setAlleBereiche(!alleBereiche)}
                className="flex h-full min-h-[60px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[12px] leading-tight text-teal-700 hover:bg-slate-50">
                {alleBereiche ? <ChevronUp size={20} strokeWidth={1.2} aria-hidden="true" /> : <ChevronDown size={20} strokeWidth={1.2} aria-hidden="true" />}
                <span>{alleBereiche ? "Weniger" : `Weitere (${mehr})`}</span>
              </button></li>}
            </ul>
          <RailToggle /></nav>
        </>;
      })()}
      {!fest && <nav ref={railRef} aria-label="Signal" className={`rm-xrail hidden sm:block print:hidden${railFolded ? " rm-rail-folded" : ""}`}>
        <ul className="m-0 grid list-none grid-cols-6 gap-1 p-0 min-[640px]:grid-cols-11">
          {MIT_ALLE.map(([id, label]) => {
            const on = id === signal;
            const Icon = ICONS[id];
            return (
              <li key={id} className={on && id !== ALLE ? "rm-rail-open" : undefined}>
                <button type="button" title={label} aria-pressed={on} onClick={() => { railUnfold(); pick({ signal: id === standard ? "" : id, phase: "", art: "" }); }}
                  className={`flex h-full min-h-[68px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[12px] leading-tight ${on ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}>
                  {Icon && <Icon size={24} strokeWidth={1.2} aria-hidden="true" className={on ? "text-teal-700" : "text-slate-500"} />}
                  <span>{label}</span>
                </button>
                {/* Breiter Bildschirm: die Arten klappen nach links aus der Kategorie auf (CSS blendet sie sonst aus) */}
                {on && id !== ALLE && res && res.signal.id === signal && (res.arts ?? []).length > 0 && <ul className="rm-rail-sub m-0 list-none p-0">
                  {res.arts.map((a) => <li key={a.key}><button type="button" aria-pressed={a.key === art} onClick={() => pick({ art: a.key === art ? "" : a.key })}>
                    <ArtIcon value={a.key} size={16} /><span>{artShort(a.name)}</span></button></li>)}
                </ul>}
              </li>
            );
          })}
        </ul>
      <RailToggle /></nav>}

      <div className="mt-4 print:hidden"><DiffusionSearch filterUp follow={<Folgen heart hint="Auswahl unter Meine Suchen speichern" />} noPlay play={loading ? "loading" : "idle"} onPlay={() => !loading && run()} onSubmit={() => run()} /></div>
      {/* Desktop: eine Filterzeile unter der Suche: Zeitraum, Schritt, Art als Auswahllisten, aktive Filter als Chips (Handy: Blätter und Räder) */}
      <div className="rm-xfilter mt-3 flex min-h-9 flex-wrap items-center gap-2 max-sm:hidden print:hidden">
        <span className="rm-zeit-std contents"><ZeitPills value={zeit} all="alle" onPick={(k) => pick({ zeit: k === "6" ? "" : k })} /></span>
        {res && signal !== ALLE && res.signal.id === signal && (res.arts ?? []).length > 0 && <span className="rm-art-std contents"><Dropdown label={res.signal.art ?? "Art"} value={art} onPick={(id) => pick({ art: id })}
          items={[{ id: "", label: "Alle" }, ...res.arts.map((a) => ({ id: a.key, label: artShort(a.name), icon: <ArtIcon value={a.key} size={16} className="text-slate-500" /> }))]} /></span>}
        {/* Breit mit Karte: keine Chips, die Auswahl steht in den Kacheln (rm-xfilter-chips in analytics.css) */}
        <span className="rm-xfilter-chips contents"><AktiveFilter onReset={() => pick({ phase: "", art: "", zeit: "" })} chips={[
          ...(zeit !== "6" ? [{ key: "zeit", label: zeit === "alle" ? "Gesamter Zeitraum" : `Letzte ${zeit} Monate`, onClear: () => pick({ zeit: "" }) }] : []),
          ...(phase ? [{ key: "phase", label: `Schritt: ${res?.phases.find((p) => p.key === phase)?.name ?? phase}`, onClear: () => pick({ phase: "" }) }] : []),
          ...(art ? [{ key: "art", label: artShort(art), onClear: () => pick({ art: "" }) }] : []),
        ]} /></span>
      </div>

      {error && <Fehler onNochmal={() => run()}>{error}</Fehler>}
      {loading && !res && <Laden text={fest ? "Ausschreibungen werden geladen …" : "Projekte werden geladen …"} />}
      {res && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {/* Antwort zuerst: große Kennzahlen, über die ganze Breite */}
          {res.total === 0 ? <Leer tipp="Einen längeren Zeitraum, eine andere Art oder „Alle Themen“ wählen, oder den Ort entfernen.">{`Keine Vorgänge für diese Auswahl: ${res.signal.name}${zeit !== "alle" ? `, letzte ${zeit} Monate` : ""}.`}</Leer>
            : <Kennzahlen week={week} band={fest ? "Ausschreibungen" : "Projekte"} scope={[res.signal.name, art ? artShort(art) : "", phase ? `Schritt „${res.phases.find((p) => p.key === phase)?.name ?? phase}“` : "", areaAgs && res.places.length === 1 ? res.places[0].name : ""].filter(Boolean).join(" · ")} period={zeit === "alle" ? "gesamter Zeitraum" : zeitText ? `letzte ${zeitText}` : undefined} items={[{ value: n(res.total), label: res.total === 1 ? "Vorgang" : "Vorgänge" }, { value: n(res.placeCount ?? res.places.length), label: (res.placeCount ?? res.places.length) === 1 ? "Gebiet" : "Gebiete" }]}>
            </Kennzahlen>}

          {/* Links die Karte (bleibt stehen), rechts Filter und Vorgänge; ab 640 px nebeneinander */}
          <div className="rm-karte-toggle mt-4 print:hidden max-sm:hidden">
            <button type="button" aria-expanded={karte} aria-controls="signale-karte" onClick={() => setKarte((k) => !k)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[14px] text-slate-700 hover:border-slate-400">
              {karte ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}{karte ? "Karte ausblenden" : "Karte zeigen"}
            </button>
          </div>
          <div className={`rm-xsplit${karte ? "" : " rm-xsplit--solo"} mt-4 grid grid-cols-1 gap-x-8 gap-y-8 max-sm:gap-y-5 min-[640px]:grid-cols-12`}>
            {karte && <div id="signale-karte" className="rm-xsplit-map min-w-0 min-[640px]:sticky min-[640px]:top-4 min-[640px]:col-span-6 min-[640px]:self-start">
              {res.places.length > 0 ? <SignalMap places={res.places} hover={hoverPlace} onPlace={(ags) => search.setArea(ags, "map")} zeit={zeit} onZeit={(k) => pick({ zeit: k === "6" ? "" : k })} 
                /* Ausschreibungen: keine Kategorien (eine feste Kategorie); Handy: Bereich und Leistung als Doppelwalze auf der Karte, wie die Kategorie auf Projekte */
                wheels={fest ? <><MapWheels single label="Thema" value={thema} onPick={pickThema}
                  items={[{ id: "", label: "Alle Themen", icon: <ThemeIcon theme="alle" size={16} className="text-slate-500" /> }, ...THEMES.map((t: { id: string; name: string }) => ({ id: t.id, label: t.name, icon: <ThemeIcon theme={t.id} size={16} className="text-slate-500" /> }))]} />
                  <MapWheels lower label="Bereich" subLabel={res.signal.art ?? "Leistung"} subAll="Alle Leistungen" value={subId} onPick={(id) => setSub(id)}
                  items={[{ id: "", label: "Alle Bereiche", icon: <LayoutGrid size={16} strokeWidth={1.4} aria-hidden="true" className="text-slate-500" /> }, ...ofThema(res.subs ?? []).map((b) => ({ id: b.key, label: SUBTOPICS.find((x: { id: string }) => x.id === b.key)?.short ?? b.name, icon: <SubtopicIcon id={b.key} size={16} /> }))]}
                  subs={res.signal.id === signal && (res.arts ?? []).length > 0 ? res.arts.filter((a) => a.key).map((a) => ({ id: a.key, label: artShort(a.name), icon: <ArtIcon value={a.key} size={14} className="text-slate-500" /> })) : undefined} subValue={art} onSub={(id) => pick({ art: id })} /></>
                  : <MapWheels label="Kategorie" subLabel="Art" subAll="Alle Arten" value={signal === standard ? "" : signal} onPick={(id) => pick({ signal: id, phase: "", art: "" })}
                  items={MIT_ALLE.map(([id, lab]) => { const I = ICONS[id]; return { id: id === standard ? "" : id, label: lab, icon: I ? <I size={16} strokeWidth={1.4} aria-hidden="true" className="text-slate-500" /> : undefined }; })}
                  subs={signal !== ALLE && res.signal.id === signal && (res.arts ?? []).length > 0 ? res.arts.map((a) => ({ id: a.key, label: artShort(a.name), icon: <ArtIcon value={a.key} size={14} className="text-slate-500" /> })) : undefined} subValue={art} onSub={(id) => pick({ art: id })} />} /> : <p className="text-[14px] text-slate-500">Keine Gebiete zur Auswahl.</p>}
            </div>}
            <div className={`min-w-0 ${karte ? "min-[640px]:col-span-6" : "min-[640px]:col-span-12"}`}>
              {pending && <ListSkeleton />}
              <div className={pending ? "hidden" : undefined}>

              {(items.length > 0 || !!erstmals) && (
                <section className="mt-6" aria-label="Neueste Vorgänge">
                  {/* Überschrift: was gewählt ist (Kategorie oder Art), mit Ort, falls einer gewählt ist; Schritt darunter klein */}
                  {/* Kopf der Liste: Symbol der Kategorie bzw. Art, rechts die Zahl */}
                  <ListenKopf eyebrow="Neueste Vorgänge" count={`${n(res.total)} ${res.total === 1 ? "Vorgang" : "Vorgänge"}`}
                    icon={art ? <ArtIcon value={art} size={20} /> : (() => { const I = ICONS[res.signal.id]; return I ? <I size={20} strokeWidth={1.4} /> : null; })()}
                    title={(() => {
                      /* Wo man sich befindet: Kategorie, dann Thema, Unterthema, Art und Schritt der Auswahl, dahinter der Ort */
                      const subName = SUBTOPICS.find((x: { id: string }) => x.id === subId)?.short;
                      const pfad = [res.signal.name, search.state.thema, (!search.state.thema || subTheme === search.state.thema) ? subName : "", art ? artShort(art) : "", phase ? res.phases.find((p) => p.key === phase)?.name ?? "" : ""].filter(Boolean) as string[];
                      return <span title={pfad.join(" › ")}>{pfad.map((t, i) => <span key={t + i} className={i === pfad.length - 1 ? "" : "font-normal text-slate-500"}>{i > 0 && <span aria-hidden="true" className="mx-1 font-normal text-slate-300">›</span>}{t}</span>)}{areaAgs && res.places.length === 1 ? <span className="font-normal text-slate-500"> in {res.places[0].name}</span> : null}</span>;
                    })()} />
                  {/* Schritt als Filter direkt über der Liste, mit denselben Farben wie in den Zeilen; bei „Alle Projekte“ nicht (die Kategorien haben verschiedene Schritte), bei Ausschreibungen nicht (dort ist er der Status, den das Filterfenster schon hat) */}
                  {!fest && signal !== ALLE && res.signal.id === signal && res.phases.length > 1 && <ul aria-label="Schritt" className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0 print:hidden max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none]">
                    {[{ key: "", name: "Alle Schritte", count: res.phases.reduce((a, p) => a + p.count, 0) }, ...res.phases].map((p) => {
                      const on = p.key === phase;
                      return <li key={p.key || "alle"} className="max-sm:shrink-0"><button type="button" aria-pressed={on} title={`${p.name}: ${n(p.count)}`} onClick={() => pick({ phase: on ? "" : p.key })}
                        className={`flex h-[76px] w-[76px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center text-[12px] leading-tight max-sm:h-8 max-sm:w-auto max-sm:flex-row max-sm:gap-1.5 max-sm:whitespace-nowrap max-sm:rounded-full max-sm:border max-sm:px-3 max-sm:[&_svg]:h-4 max-sm:[&_svg]:w-4 ${on ? "bg-slate-100 font-semibold text-slate-900 max-sm:border-slate-300" : "text-slate-700 hover:bg-slate-50 max-sm:border-slate-200"}`}>
                        {p.key ? <StepIcon name={p.name} size={20} className={toneOf(p.name, phaseOrder)} /> : <LayoutGrid size={20} strokeWidth={1.4} aria-hidden="true" className="text-slate-500" />}
                        <span className="line-clamp-2 w-full hyphens-auto break-words max-sm:w-auto max-sm:line-clamp-none">{p.key ? p.name : "Alle"}</span>
                        <span className="tabular-nums text-slate-500">{n(p.count)}</span></button></li>;
                    })}
                  </ul>}
                  {/* Ausschreibungen: die Leistung als zweite Kachelreihe (auf Projekte klappt sie aus der Kategorie auf) */}
                  {fest && res.signal.id === signal && (res.arts ?? []).length > 1 && <p className="m-0 mt-3 max-sm:hidden text-[12px] font-medium uppercase tracking-wide text-slate-500 print:hidden">{res.signal.art ?? "Leistung"}: was eingekauft wird</p>}
                  {fest && res.signal.id === signal && (res.arts ?? []).length > 1 && <ul aria-label={res.signal.art ?? "Leistung"} className="m-0 mt-1 max-sm:hidden flex list-none flex-wrap gap-1.5 p-0 print:hidden max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none]">
                    {[{ key: "", name: "Alle", count: res.arts.reduce((a2, x) => a2 + x.count, 0) }, ...res.arts].map((x) => {
                      const on = x.key === art;
                      return <li key={x.key || "alle"} className="max-sm:shrink-0"><button type="button" aria-pressed={on} title={`${x.name}: ${n(x.count)}`} onClick={() => pick({ art: on ? "" : x.key })}
                        className={`flex h-[76px] w-[76px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center text-[12px] leading-tight max-sm:h-8 max-sm:w-auto max-sm:flex-row max-sm:gap-1.5 max-sm:whitespace-nowrap max-sm:rounded-full max-sm:border max-sm:px-3 max-sm:[&_svg]:h-4 max-sm:[&_svg]:w-4 ${on ? "bg-slate-100 font-semibold text-slate-900 max-sm:border-slate-300" : "text-slate-700 hover:bg-slate-50 max-sm:border-slate-200"}`}>
                        {x.key ? <ArtIcon value={x.key} size={20} className="text-teal-700" /> : <LayoutGrid size={20} strokeWidth={1.4} aria-hidden="true" className="text-slate-500" />}
                        <span className="line-clamp-2 w-full hyphens-auto break-words max-sm:w-auto max-sm:line-clamp-none">{x.key ? artShort(x.name) : "Alle"}</span>
                        <span className="tabular-nums text-slate-500">{n(x.count)}</span></button></li>;
                    })}
                  </ul>}
                  {/* Ausschreibungen: Stand erst grob (noch offen, entschieden), darin auf Wunsch der genaue Status */}
                  {fest && res.signal.id === signal && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
                    <span className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Stand</span>
                    <Segmented label="Stand" options={[["", "Alle"], ["offen", "Noch offen", "angekündigt, in Beratung, empfohlen, vertagt"], ["entschieden", "Entschieden", "beschlossen, abgelehnt, zur Kenntnis"]]} value={gruppe} onPick={(k) => pick({ gruppe: k, phase: "" })} />
                    {res.phases.length > 1 && <ul aria-label="Genauer Stand" className="m-0 flex list-none flex-wrap gap-1.5 p-0 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none]">
                      {res.phases.map((p) => { const on = p.key === phase; return <li key={p.key} className="max-sm:shrink-0"><button type="button" aria-pressed={on} onClick={() => pick({ phase: on ? "" : p.key })}
                        className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[12px] ${on ? "border-teal-700 bg-teal-50 font-semibold text-teal-900" : "border-slate-200 text-slate-700 hover:text-teal-700"}`}>
                        <StepIcon name={p.name} size={14} className={toneOf(p.name, phaseOrder)} />{p.name}<span className="tabular-nums text-slate-500">{n(p.count)}</span></button></li>; })}
                    </ul>}
                  </div>}
                  {items.length === 0 && <Leer>Keine Vorgänge in dieser Auswahl.</Leer>}
                  <ol className="m-0 mt-2 list-none border-t border-slate-200 p-0">
                    {items.slice(0, shown).map((r) => (
                      <li key={r.id} onMouseEnter={() => hoverPlaceD(r.place ?? "")} onMouseLeave={() => hoverPlaceD("")} onFocus={() => hoverPlaceD(r.place ?? "")} onBlur={() => hoverPlaceD("")} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 border-b border-slate-200 py-2.5 max-sm:grid-cols-[auto_minmax(0,1fr)]">
                        <DateBadge iso={r.date} />
                        <Link href={`/beschluss/${r.id}`} className="min-w-0 text-slate-900 no-underline hover:text-teal-800">
                          <span className="line-clamp-2 text-[14px] leading-snug max-sm:line-clamp-3 max-sm:text-[14px] sm:text-[16px]">{r.firstHere && <span title="Der erste Vorgang dieser Art in diesem Ort (Bestand seit mindestens einem Jahr davor)" className="mr-1.5 rounded-full bg-teal-50 px-2 py-0.5 align-[1px] text-[12px] font-medium text-teal-800">erstmals hier</span>}{r.title}</span>
                          <span className="block truncate text-[12px] text-slate-500">{[r.region, (r.status === "announced" || r.status === "consulting") && (r.status === "announced" ? "angekündigt" : "in Beratung"), r.gremium].filter(Boolean).join(" · ")}</span>
                        {/* Handy: Schritt und, solange keine Art gewählt ist, die Art stehen klein unter dem Titel; so bleibt Platz für den Titel */}
                        <span className="mt-0.5 block truncate text-[12px] text-slate-600 sm:hidden"><StepIcon name={r.phase} size={14} className={`mr-1 inline-block align-[-2px] ${toneOf(r.phase, phaseOrder)}`} />{r.phase}{!art && r.arts?.length ? <span className="text-slate-900"> · {r.arts.map(artShort).join(", ")}</span> : null}</span>
                        </Link>
                        <span className="flex flex-col items-end gap-1 self-center whitespace-nowrap max-sm:hidden">
                          {/* Schritt und Art als kleine Etiketten mit Symbol: der Schritt in seiner Farbe, die Art mit dem Symbol der Art bzw. Kategorie */}
                          <span className="inline-flex h-6 items-center gap-1.5 rounded-md bg-slate-100 px-2 text-[12px] text-slate-700"><StepIcon name={r.phase} size={14} className={toneOf(r.phase, phaseOrder)} />{r.phase}</span>
                          {(r.arts ?? []).slice(0, 2).map((a) => { const cat = catIcon(a); return <span key={a} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-slate-200 px-2 text-[12px] text-slate-700">{cat ?? <ArtIcon value={a} size={14} className="text-slate-500" />}{artShort(a)}</span>; })}
                        </span>
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
              </div>
              <MethodikNote>Stand {day(res.builtAt?.slice(0, 10) ?? "")}. Gelesen aus Titeln, Vorlagen und Begründungen; jede Angabe mit Originalquelle im Vorgang.</MethodikNote>
            </div>
          </div>
        </div>
      )}
    <XWeiter links={[...(fest ? [["/analytics/signale", "Was entsteht? (Projekte)"]] : []), ["/analytics/news", "Was ist berichtenswert? (Nachrichten)"],
      /* Atlas und Trends gleich mit dem Thema bzw. Begriff dieser Seite */
      [ATLAS_OF[signal] ? `/analytics/atlas?thema=${ATLAS_OF[signal][0]}${ATLAS_OF[signal][1] ? `&sub=${ATLAS_OF[signal][1]}` : ""}` : "/analytics/atlas", "Wie viel? (Themenatlas)"],
      ...(TRENDS_OF[signal] ? [[`/analytics/trends?begriff=${encodeURIComponent(TRENDS_OF[signal])}`, "Was verändert sich? (Trends)"]] : [])] as [string, string][]} />
    </main>
  );
}
