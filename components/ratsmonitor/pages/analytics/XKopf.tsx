import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cameFromApp, useAppNav } from "../../state/nav";
import { IconChevronLeft } from "../../components/icons";
import { PageBand } from "./PageBand";
import { Icon, type IconName } from "../../info/icons";
import { AnalyticsX } from "../../components/Brand";
import { ThemeIcon } from "../../components/icons";
import { WheelPicker } from "../../components/WheelPicker";
import { useSearch } from "../../state/search";
import { THEMES } from "@/shared/themes.mjs";
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
  atlas: { icon: "map", gruppe: "Analysen", titel: "plenara.X Atlas", frage: "Wie viel?", text: "Worüber die Räte beraten, wo und wie viel, nach 10 Themen." },
  vergleich: { icon: "mapPin", gruppe: "Analysen", titel: "plenara.X Ortsvergleich", frage: "Wie steht mein Ort da?", text: "Zwei Orte nebeneinander: Themen, Ausgang und was für jeden Ort typisch ist." },
  signale: { icon: "zap", gruppe: "Einblicke", titel: "plenara.X Signale", frage: "Was entsteht?", text: "Einzelne Vorhaben mit Ort, Schritt und Quelle." },
  fakten: { icon: "tag", gruppe: "Einblicke", titel: "plenara.X Fakten", frage: "Welcher Wert?", text: "Zahlen aus den Vorlagen der Räte, je Gemeinde, mit Quelle." },
  trends: { icon: "trendingUp", gruppe: "Analysen", titel: "plenara.X Trends", frage: "Was verändert sich?", text: "Begriffe, die zunehmen, und wie sie sich über die Gebiete ausbreiten." },
  beschluesse: { icon: "circleCheck", gruppe: "Analysen", titel: "plenara.X Ausgang", frage: "Wie geht es aus?", text: "Wie die Vorgänge zum gewählten Thema ausgehen: beschlossen, vertagt, abgelehnt, im Zeitverlauf." },
  fraktionen: { icon: "landmark", gruppe: "Hintergründe", titel: "plenara.X Fraktionen", frage: "Wer möchte was?", text: "Welche Fraktionen welche Themen beantragen und was aus ihren Anträgen wird." },
  gremien: { icon: "users", gruppe: "Hintergründe", titel: "plenara.X Gremien", frage: "Wer berät was?", text: "Welchen Weg Vorgänge durch die Gremien nehmen und wo sie entschieden werden." },
  graph: { icon: "network", gruppe: "Hintergründe", titel: "plenara.X Themennetz", frage: "Was hängt zusammen?", text: "Womit ein Thema zusammenhängt: verwandte Begriffe als Netz zum Anklicken." },
  ausschreibungen: { icon: "clipboardList", gruppe: "Einblicke", titel: "plenara.X Ausschreibungen", frage: "Was wird vergeben?", text: "Welche Aufträge Kommunen ausschreiben und vergeben, nach Leistung und Schritt. Aus den Beschlüssen der Räte, nicht die Bekanntmachung selbst." },
  news: { icon: "newspaper", gruppe: "Einblicke", titel: "plenara.X Aktuelles", frage: "Was ist berichtenswert?", text: "Vorgänge nach Nachrichtenwert, je Vorgang eine Meldung mit wörtlichem Zitat und Quelle. Für Vorhaben nach Branche und Stand: Signale." },
};

export function XKopf({ seite }: { seite: keyof typeof SEITEN }) {
  const s = SEITEN[seite], path = usePathname();
  const router = useRouter(), { goBack } = useAppNav();
  return (
    <PageBand compact>
      {/* Kein Pfad, nur Zurück wie auf den übrigen Seiten (Artikel) */}
      <button type="button" className="back-btn -ml-1.5 mb-1 print:hidden" onClick={() => (cameFromApp() ? router.back() : goBack())}><IconChevronLeft />Zurück</button>
      {/* Titel links, Kurzbeschreibung in der Mitte, Symbol der Seite rechts (weiß im Petrol-Band) */}
      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-1 max-sm:grid-cols-[1fr_auto]">
        {/* Titel kurz, die Marke als kleines Abzeichen daneben  */}
        <h1 className="flex items-baseline gap-2.5 text-[28px] font-semibold leading-tight">
          {s.titel.replace("plenara.X ", "")}
          <MarkenAbzeichen />
        </h1>
        <BandMitte kurz={KURZ[seite] ?? s.frage} />
        {/* Das Symbol der Seite ist zugleich der Knopf für die Methodik */}
        <a href="#methodik" title="Methodik: worauf die Zahlen beruhen" className="rm-bandicon justify-self-end pr-6 max-sm:pr-2 print:hidden">
          <Icon name={s.icon} size={44} /><span className="sr-only">Methodik</span>
        </a>
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
    <nav aria-label="Weiter mit derselben Suche" className="mt-12 border-t border-slate-200 pt-6 print:hidden">
      <p className="m-0 text-[14px] font-semibold text-slate-700">Weiter mit derselben Suche</p>
      <ul className="m-0 mt-3 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(([href, name]) => {
          /* Seite und Frage aus SEITEN (überall gleich); eigener Text nur, wenn die Seite dort fehlt */
          const z = SEITEN[href.split("/").pop()!];
          const m = z ? [, (KACHEL_FRAGE[href] ?? z.frage), z.titel.replace("plenara.X ", "") + (z.reiter && z.reiter[0][0] !== href ? ` · ${z.reiter.find(([h]) => h === href)?.[1]}` : "")] : name.match(/^(.*) \((.*)\)$/);
          return (
            <li key={href}>
              <Link href={href} className="group flex h-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 transition-colors hover:bg-teal-50">
                {z && <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-teal-700"><Icon name={z.icon} size={18} /></span>}
                <span className="mr-auto">
                  {m && <span className="block text-[12px] font-medium uppercase tracking-wide text-slate-500">{m[2]}</span>}
                  <span className="block text-[16px] font-semibold text-slate-900 group-hover:text-teal-800">{m ? m[1] : name}</span>
                </span>
                <span aria-hidden="true" className="text-[18px] text-teal-700 transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Die 10 Themen als Kacheln (Filter „Thema“ der gemeinsamen Suche), gleich auf Trends, Ausgang und den Einblicken */
export function ThemenLeiste() {
  const search = useSearch();
  return (
    <>
      {/* Handy: Chip-Reihe zum Wischen statt drei Reihen Kacheln */}
      <WheelPicker label="Thema" className="mb-3" value={search.state.thema} onPick={(name) => search.setThema(name)}
        items={[{ id: "", label: "Alle Themen", name: "alle" }, ...THEMES.map((t: { id: string; name: string }) => ({ id: t.name, label: t.name, name: t.id }))].map((t) => ({ id: t.id, label: t.label, icon: <ThemeIcon theme={t.name} size={18} className="text-slate-500" />, iconOn: <ThemeIcon theme={t.name} size={18} className="text-white" /> }))} />
      {/* Ab Tablet Kacheln; ab Desktop alle 11 in einer Reihe (Breite teilt sich auf) */}
      <nav aria-label="Thema" className="mb-4 hidden sm:block print:hidden">
        <ul className="m-0 grid list-none grid-cols-6 gap-1 p-0 lg:grid-cols-11">
          {[{ id: "alle", name: "" }, ...THEMES.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))].map((t) => {
            const on = search.state.thema === t.name;
            return (
              <li key={t.id}>
                <button type="button" aria-pressed={on} onClick={() => search.setThema(t.name)}
                  className={`flex h-[68px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[12px] leading-tight ${on ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}>
                  <ThemeIcon theme={t.id} size={22} className={on ? "text-teal-700" : "text-slate-500"} />
                  <span className="line-clamp-2">{t.name || "Alle Themen"}</span>
                </button>
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
  if (!fig) return <p className="rm-band-mid m-0 whitespace-nowrap text-center text-[22px] opacity-90 max-sm:order-3 max-sm:col-span-2 max-sm:text-left">{kurz}</p>;
  const when = [fig.period, fig.week ? `+${fig.week.toLocaleString("de-DE")} in 7 Tagen` : ""].filter(Boolean).join(" · ");
  return (
    <div className="rm-band-mid text-left max-sm:order-3 max-sm:col-span-2" title={kurz}>
      <p className="m-0 flex items-baseline gap-2 leading-none"><span className="text-[44px] font-semibold tabular-nums max-sm:text-[28px]">{value}</span><span className="text-[18px] font-medium">{fig.label}</span></p>
      <p className="m-0 mt-1.5 text-[14px] opacity-85">{fig.scope || kurz}</p>
      {when && <p className="m-0 text-[14px] opacity-70">{when}</p>}
    </div>
  );
}
