import Link from "next/link";
import { ShareButton } from "../../components/ShareButton";
import { useScrollMemory } from "../../lib/useScrollMemory";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cameFromApp, useAppNav } from "../../state/nav";
import { IconChevronLeft } from "../../components/icons";
import { PageBand } from "./PageBand";
import { Icon, type IconName } from "../../info/icons";
import { AnalyticsX } from "../../components/Brand";
import { MapWheels } from "./MapWheels";
import { ThemeIcon } from "../../components/icons";
import { useSearch } from "../../state/search";
import { SUBTOPICS, THEMES } from "@/shared/themes.mjs";
import { SubtopicIcon } from "../../components/SubtopicIcon";
import { useRailFold, useRailPeek } from "../../lib/useRailFold";
import { useSubParam } from "../../lib/subParam";
import { useBandFigure, useCountUp } from "../../lib/bandFigure";

/*
 * Kopf der plenara.X-Seiten: Brotkrumen, Titel, Frage und (bei Atlas und Trends) die Reiter. Ein Reiter ist eine eigene Adresse
 * mit der bisherigen Auswertung (Ortsvergleich, Beschlüsse); Suchbegriff und Ort gelten seitenübergreifend (gemeinsame Suche).
 */
type Seite = { icon: IconName; gruppe: "Analysen" | "Einblicke" | "Hintergründe"; titel: string; frage: string; text: string; reiter?: [string, string][] };


/* Reiter haben die Frage ihrer Seite im Kopf; als Kachel brauchen sie eine eigene */
const KACHEL_FRAGE: Record<string, string> = { "/analytics/vergleich": "Mit anderem Ort vergleichen", "/analytics/beschluesse": "Wie geht es aus?" };

/* Im Kopf statt der Frage (die Fragen bleiben im Menü): was die Seite zeigt, in wenigen Worten */
const KURZ: Record<string, string> = {
  atlas: "Themen nach Ort und Zeit", vergleich: "Zwei Orte im Vergleich", signale: "Vorhaben vor Ort", fakten: "Werte aus den Vorlagen",
  trends: "Begriffe im Wandel", beschluesse: "Wie Vorgänge ausgehen", fraktionen: "Anträge der Fraktionen", gremien: "Wege durch die Gremien",
  graph: "Verwandte Themen", news: "Berichtenswerte Vorgänge", ausschreibungen: "Aufträge der Kommunen",
};

const SEITEN: Record<string, Seite> = {
  atlas: { icon: "map", gruppe: "Analysen", titel: "plenara.X Themenatlas", frage: "Wie viel?", text: "Worüber die Räte beraten, wo und wie viel, nach 10 Themen." },
  vergleich: { icon: "mapPin", gruppe: "Analysen", titel: "plenara.X Ortsvergleich", frage: "Wie steht mein Ort da?", text: "Zwei Orte nebeneinander: Themen, Beschlusslage und was für jeden Ort typisch ist." },
  signale: { icon: "zap", gruppe: "Einblicke", titel: "plenara.X Projekte", frage: "Was entsteht?", text: "Einzelne Projekte mit Ort, Schritt und Quelle." },
  fakten: { icon: "tag", gruppe: "Einblicke", titel: "plenara.X Werte", frage: "Welcher Wert?", text: "Zahlen aus den Vorlagen der Räte, je Gemeinde, mit Quelle." },
  trends: { icon: "trendingUp", gruppe: "Analysen", titel: "plenara.X Trends", frage: "Was verändert sich?", text: "Begriffe, die zunehmen, und wie sie sich über die Gebiete ausbreiten." },
  beschluesse: { icon: "circleCheck", gruppe: "Analysen", titel: "plenara.X Beschlusslage", frage: "Wie geht es aus?", text: "Wie die Vorgänge zum gewählten Thema ausgehen: beschlossen, vertagt, abgelehnt, im Zeitverlauf." },
  fraktionen: { icon: "landmark", gruppe: "Hintergründe", titel: "plenara.X Fraktionen", frage: "Wer möchte was?", text: "Welche Fraktionen welche Themen beantragen und was aus ihren Anträgen wird." },
  gremien: { icon: "users", gruppe: "Hintergründe", titel: "plenara.X Gremien", frage: "Wer berät was?", text: "Welchen Weg Vorgänge durch die Gremien nehmen und wo sie entschieden werden." },
  graph: { icon: "network", gruppe: "Hintergründe", titel: "plenara.X Themennetz", frage: "Was hängt zusammen?", text: "Womit ein Thema zusammenhängt: verwandte Begriffe als Netz zum Anklicken." },
  ausschreibungen: { icon: "clipboardList", gruppe: "Einblicke", titel: "plenara.X Ausschreibungen", frage: "Was wird vergeben?", text: "Welche Aufträge Kommunen ausschreiben und vergeben, nach Leistung und Schritt. Aus den Beschlüssen der Räte, nicht die Bekanntmachung selbst." },
  news: { icon: "newspaper", gruppe: "Einblicke", titel: "plenara.X Nachrichten", frage: "Was ist berichtenswert?", text: "Vorgänge nach Nachrichtenwert, je Vorgang eine Meldung mit wörtlichem Zitat und Quelle. Für Vorhaben nach Branche und Stand: Signale." },
};

/** Die Auswertungen im Kopfband (Desktop): die Seiten der eigenen Gruppe als Reiter, die anderen Gruppen unter „Weitere“; die aktuelle ist hervorgehoben */
const GRUPPEN: [string, string[]][] = [
  ["Analysen", ["atlas", "vergleich", "trends", "beschluesse"]],
  ["Einblicke", ["signale", "ausschreibungen", "news", "fakten"]],
  ["Hintergründe", ["fraktionen", "gremien", "graph"]],
];
const kurzName = (k: string) => SEITEN[k].titel.replace("plenara.X ", "");
function XSeiten({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const aktuell = path.split("/").pop() ?? "";
  const eigene = GRUPPEN.find(([, ks]) => ks.includes(aktuell)) ?? GRUPPEN[0];
  const andere = GRUPPEN.filter((g) => g !== eigene);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !panel.current?.contains(t)) setOpen(false); };
    const close = () => setOpen(false);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down); document.addEventListener("keydown", key); window.addEventListener("scroll", close, true); window.addEventListener("resize", close);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  /* Im Band erzwingt das Stylesheet weiße Schrift und helle Flächen: Unterschied nur über Strich und Deckkraft */
  const pill = (on: boolean) => `inline-flex h-8 items-center gap-1 px-1 text-[14px] transition-opacity ${on ? "font-semibold shadow-[inset_0_-2px_0_var(--rm-on)]" : "opacity-75 hover:opacity-100"}`;
  return (
    <nav aria-label="Auswertungen" className="relative z-20 flex items-center gap-4 max-sm:hidden print:hidden">
      {eigene[1].map((k) => <Link key={k} href={`/analytics/${k}`} aria-current={k === aktuell ? "page" : undefined} className={pill(k === aktuell)}>{kurzName(k)}</Link>)}
      <div ref={ref} className="relative">
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ top: Math.max(r.bottom + 4, (e.currentTarget.closest(".pl-band")?.getBoundingClientRect().bottom ?? 0) + 6), right: window.innerWidth - r.right }); setOpen((o) => !o); }} className={pill(false)}>
          Weitere<ChevronDown size={14} aria-hidden="true" />
        </button>
        {open && createPortal(
          <div ref={panel} role="menu" style={{ top: pos.top, right: pos.right }} className="fixed z-50 w-[340px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {andere.map(([gruppe, ks]) => (
              <div key={gruppe} role="group" aria-label={gruppe} className="py-1 first:pt-0 last:pb-0">
                <p className="m-0 px-3 pb-1 pt-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{gruppe}</p>
                {ks.map((k) => (
                  <Link key={k} role="menuitem" href={`/analytics/${k}`} onClick={() => setOpen(false)}
                    className="grid grid-cols-[1fr_auto] items-baseline gap-4 whitespace-nowrap rounded-lg px-3 py-2 text-[14px] text-slate-900 no-underline hover:bg-slate-50">
                    <span>{kurzName(k)}</span><span className="text-[12px] text-slate-500">{SEITEN[k].frage}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>, document.body)}
      </div>
    </nav>
  );
}

export function XKopf({ seite }: { seite: keyof typeof SEITEN }) {
  useScrollMemory();
  const s = SEITEN[seite], path = usePathname();
  const router = useRouter(), { goBack } = useAppNav();
  return (
    <PageBand compact>
      {/* Kein Pfad, nur Zurück wie auf den übrigen Seiten (Artikel) */}
      <div className="sm:flex sm:items-center sm:justify-between sm:gap-4">
        <button type="button" className="back-btn -ml-1.5 mb-1 print:hidden" onClick={() => (cameFromApp() ? router.back() : goBack())}><IconChevronLeft />Zurück</button>
        <XSeiten path={path} />
      </div>
      {/* Titel links, Kurzbeschreibung in der Mitte */}
      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-1 max-sm:grid-cols-[1fr_auto]">
        {/* Titel kurz, die Marke als kleines Abzeichen daneben  */}
        <h1 className="flex items-baseline gap-2.5 text-[28px] font-semibold leading-tight">
          {s.titel.replace("plenara.X ", "")}
          <MarkenAbzeichen />
        </h1>
        <BandMitte kurz={KURZ[seite] ?? s.frage} />
      </div>
      {s.reiter && (
        <nav aria-label="Ansicht" className="-mb-4 mt-3 flex gap-6 print:hidden">
          {s.reiter.map(([href, name]) => (
            <Link key={href} href={href} aria-current={href === path ? "page" : undefined} scroll={false}
              className={`border-b-2 pb-2 text-[16px] ${href === path ? "border-teal-700 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{name}</Link>
          ))}
        </nav>
      )}
    </PageBand>
  );
}

/** Querverweise unter einer Auswertung: dieselbe Suche auf einer anderen Seite weiterverfolgen. Als Kacheln, damit man sie sieht;
 *  „Frage (Seite)“ wird zu Frage groß und Seite klein darüber */
export function XWeiter({ links }: { links: [string, string][] }) {
  return (
    <nav aria-label="Weiter mit derselben Suche" className="mt-12 border-t border-slate-200 pt-6 max-sm:mt-6 max-sm:pt-3 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-[14px] font-semibold text-slate-700">Weiter mit derselben Suche</p>
        {/* Diese Ansicht weitergeben: die Auswahl steckt in der Adresse */}
        <ShareButton title={typeof document === "undefined" ? "plenara.X" : document.title} url={typeof window === "undefined" ? "" : window.location.href} label className="-my-2" />
      </div>
      <ul className="m-0 mt-3 grid grid-cols-1 list-none gap-3 p-0 max-sm:mt-1 max-sm:gap-0 max-sm:divide-y max-sm:divide-slate-200 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
        {links.map(([href, name]) => {
          /* Seite und Frage aus SEITEN (überall gleich); eigener Text nur, wenn die Seite dort fehlt */
          const path = href.split("?")[0], z = SEITEN[path.split("/").pop()!];
          const m = z ? [, (KACHEL_FRAGE[path] ?? z.frage), z.titel.replace("plenara.X ", "") + (z.reiter && z.reiter[0][0] !== path ? ` · ${z.reiter.find(([h]) => h === path)?.[1]}` : "")] : name.match(/^(.*) \((.*)\)$/);
          return (
            <li key={href}>
              <Link href={href} className="group flex h-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 transition-colors hover:bg-teal-50 max-sm:gap-2.5 max-sm:rounded-none max-sm:bg-transparent max-sm:px-0 max-sm:py-2.5">
                {z && <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-teal-700 max-sm:h-6 max-sm:w-6 max-sm:bg-transparent"><Icon name={z.icon} size={18} /></span>}
                <span className="mr-auto max-sm:flex max-sm:min-w-0 max-sm:flex-1 max-sm:items-baseline max-sm:justify-between max-sm:gap-2">
                  {m && <span className="block text-[12px] font-medium uppercase tracking-wide text-slate-500 max-sm:order-2 max-sm:normal-case max-sm:tracking-normal">{m[2]}</span>}
                  <span className="block text-[16px] font-semibold text-slate-900 group-hover:text-teal-800 max-sm:truncate max-sm:font-medium">{m ? m[1] : name}</span>
                </span>
                <span aria-hidden="true" className="text-[18px] text-teal-700 transition-transform group-hover:translate-x-1 max-sm:text-[14px]">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Die 10 Themen als Kacheln (Filter „Thema“ der gemeinsamen Suche), gleich auf Trends, Beschlusslage und den Einblicken; beim gewählten
    Thema klappen seine Unterthemen auf (Filter ?sub=, useSubParam), ein Klick außerhalb der Leiste schließt sie */
/* phone: false = am Handy ohne Walze (die Seite zeigt die Themen selbst auf der Karte) */
export function ThemenLeiste({ phone = true }: { phone?: boolean } = {}) {
  const search = useSearch();
  const [sub, setSub] = useSubParam();
  const [railRef, railFolded, railUnfold] = useRailFold(search.state.thema);
  const pickThema = (name: string) => { railUnfold(); if (sub) setSub(""); search.setThema(name); };
  const peek = useRailPeek();
  return (
    <>
      {/* Handy: die Themen als eine Walzen-Zeile (wischen blättert, ein Tipp öffnet die Liste) */}
      {phone && <MapWheels inline single label="Thema" value={search.state.thema} onPick={pickThema}
        items={[{ id: "", label: "Alle Themen", icon: <ThemeIcon theme="alle" size={16} className="text-slate-500" /> }, ...THEMES.map((t: { id: string; name: string }) => ({ id: t.name, label: t.name, icon: <ThemeIcon theme={t.id} size={16} className="text-slate-500" /> }))]} />}
      {/* Ab Tablet Kacheln; ab Desktop alle 11 in einer Reihe (Breite teilt sich auf) */}
      <nav ref={railRef} {...peek.nav} aria-label="Thema" className={`rm-xrail mb-4 hidden sm:block print:hidden${railFolded ? " rm-rail-folded" : ""}`}>
        <ul className="m-0 grid list-none grid-cols-6 gap-1 p-0 lg:grid-cols-11">
          {[{ id: "alle", name: "" }, ...THEMES.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))].map((t) => {
            const on = search.state.thema === t.name;
            return (
              <li key={t.id} {...(t.name ? peek.tile(t.id) : {})} className={[on && t.name ? "rm-rail-open" : "", t.name && peek.peek === t.id ? "rm-rail-peek" : ""].join(" ").trim() || undefined}>
                <button type="button" aria-pressed={on} onClick={() => pickThema(t.name)}
                  className={`flex h-full min-h-[60px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[12px] leading-tight ${on ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}>
                  <ThemeIcon theme={t.id} size={22} className={on ? "text-teal-700" : "text-slate-500"} />
                  <span>{t.name || "Alle Themen"}</span>
                </button>
                {/* Breiter Bildschirm: die Unterthemen klappen neben dem gewählten Thema auf (CSS blendet sie sonst aus) */}
                {t.name && <ul className="rm-rail-sub m-0 list-none p-0">
                  {SUBTOPICS.filter((x: { theme: string }) => x.theme === t.id).map((x: { id: string; short: string }) => (
                    <li key={x.id}><button type="button" aria-pressed={on && x.id === sub} onClick={() => { railUnfold(); if (!on) search.setThema(t.name); setSub(on && x.id === sub ? "" : x.id); }}>
                      <SubtopicIcon id={x.id} size={16} /><span>{x.short}</span></button></li>
                  ))}
                </ul>}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Marke neben dem Seitentitel: graues Abzeichen „plenara.X“, Text auf der Grundlinie von Titel und Frage */
function MarkenAbzeichen() {
  return (
    <span role="img" aria-label="plenara.X" className="rm-brandtag inline-flex items-baseline rounded-md bg-slate-100 px-[7px] pb-[3px] pt-[2px] text-[14px] font-semibold leading-none text-slate-700">
      <span style={{ letterSpacing: "-.015em" }}>plenara</span><span className="inline-block self-center" style={{ lineHeight: 0 }}><AnalyticsX centered /></span>
    </span>
  );
}

/** Mitte des Kopfbands: die Kennzahl der Seite groß (zählt kurz hoch), daneben klein ihre Bedeutung und was in 7 Tagen dazukam; ohne Zahl die Kurzbeschreibung */
function BandMitte({ kurz }: { kurz: string }) {
  const fig = useBandFigure();
  const value = useCountUp(fig?.value ?? "");
  if (!fig) return <p className="rm-band-mid m-0 whitespace-nowrap text-center text-[22px] opacity-90 max-sm:whitespace-normal max-sm:order-3 max-sm:col-span-2 max-sm:basis-full max-sm:text-left">{kurz}</p>;
  /* Handy: Kennzahl immer in eigener Zeile (basis-full); sonst passt sie beim Hochzählen erst neben den Titel und bricht dann um, das Band springt */
  const when = [fig.period, fig.week ? `+${fig.week.toLocaleString("de-DE")} in 7 Tagen` : ""].filter(Boolean).join(" · ");
  return (
    <div className="rm-band-mid text-left max-sm:order-3 max-sm:col-span-2 max-sm:basis-full max-sm:min-h-[33px]" title={kurz}>
      <p className="m-0 flex items-baseline gap-2 leading-none"><span className="shrink-0 whitespace-nowrap text-[44px] font-semibold tabular-nums max-sm:text-[28px]">{value || "\u00a0" /* Platz halten, bis die Zahl da ist: sonst springt das Band und mit ihm die Seite */}</span><span className="text-[18px] font-medium max-sm:leading-[1.2]">{fig.label}</span></p>
      <p className="m-0 mt-1.5 text-[14px] opacity-85">{fig.scope || kurz}</p>
      {when && <p className="m-0 text-[14px] opacity-70">{when}</p>}
    </div>
  );
}
