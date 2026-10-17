import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cameFromApp, useAppNav } from "../../state/nav";
import { IconChevronLeft } from "../../components/icons";
import { useEffect, useState } from "react";
import { PageBand } from "./PageBand";
import { MethodikText } from "./AnalyticsAbout";
import type { AnalyseId } from "../../info/branchen-enterprise";
import { Icon, type IconName } from "../../info/icons";
import { AnalyticsX } from "../../components/Brand";
import { ThemeIcon } from "../../components/icons";
import { useSearch } from "../../state/search";
import { THEMES } from "@/shared/themes.mjs";

/*
 * Kopf der plenara.X-Seiten: Brotkrumen, Titel, Frage und (bei Atlas und Trends) die Reiter. Ein Reiter ist eine eigene Adresse
 * mit der bisherigen Auswertung (Ortsvergleich, Beschlüsse); Suchbegriff und Ort gelten seitenübergreifend (gemeinsame Suche).
 */
type Seite = { icon: IconName; gruppe: "Analysen" | "Einblicke"; titel: string; frage: string; text: string; reiter?: [string, string][] };

const ATLAS: [string, string][] = [["/analytics/atlas", "Überblick"], ["/analytics/vergleich", "Vergleich"]];
const TRENDS: [string, string][] = [["/analytics/trends", "Verlauf"], ["/analytics/beschluesse", "Ausgang"]];

/* Reiter haben die Frage ihrer Seite im Kopf; als Kachel brauchen sie eine eigene */
const KACHEL_FRAGE: Record<string, string> = { "/analytics/vergleich": "Mit anderem Ort vergleichen", "/analytics/beschluesse": "Wie geht es aus?" };

/* Methodik je Seite (Texte in AnalyticsAbout.tsx); Trends erklärt auch die Ausbreitung */
const METHODIK_VON: Record<string, [AnalyseId, string][]> = {
  atlas: [["atlas", "Atlas"]], vergleich: [["vergleich", "Vergleich"]], signale: [["signale", "Signale"]], fakten: [["fakten", "Fakten"]],
  trends: [["trends", "Verlauf"], ["diffusion", "Ausbreitung"]], beschluesse: [["beschluesse", "Ausgang"]], fraktionen: [["fraktionen", "Fraktionen"]],
  gremien: [["gremien", "Gremien"]], graph: [["graph", "Themennetz"]], news: [["news", "Aktuelles"]],
};

const SEITEN: Record<string, Seite> = {
  atlas: { icon: "map", gruppe: "Analysen", titel: "plenara.X Atlas", frage: "Wie viel?", text: "Worüber die Räte beraten, wo und wie viel, nach 10 Themen.", reiter: ATLAS },
  vergleich: { icon: "mapPin", gruppe: "Analysen", titel: "plenara.X Atlas", frage: "Wie viel?", text: "Zwei Orte nebeneinander: Themen, Ausgang und was für jeden Ort typisch ist.", reiter: ATLAS },
  signale: { icon: "zap", gruppe: "Analysen", titel: "plenara.X Signale", frage: "Was entsteht?", text: "Einzelne Vorhaben mit Ort, Schritt und Quelle." },
  fakten: { icon: "tag", gruppe: "Analysen", titel: "plenara.X Fakten", frage: "Welcher Wert?", text: "Zahlen aus den Vorlagen der Räte, je Gemeinde, mit Quelle." },
  trends: { icon: "trendingUp", gruppe: "Analysen", titel: "plenara.X Trends", frage: "Was verändert sich?", text: "Begriffe, die zunehmen, und wie sie sich über die Gebiete ausbreiten.", reiter: TRENDS },
  beschluesse: { icon: "circleCheck", gruppe: "Analysen", titel: "plenara.X Trends", frage: "Was verändert sich?", text: "Wie die Vorgänge zum gewählten Begriff ausgehen: beschlossen, vertagt, abgelehnt, im Zeitverlauf.", reiter: TRENDS },
  fraktionen: { icon: "landmark", gruppe: "Einblicke", titel: "plenara.X Fraktionen", frage: "Wer will was?", text: "Welche Fraktionen welche Themen beantragen und was aus ihren Anträgen wird." },
  gremien: { icon: "users", gruppe: "Einblicke", titel: "plenara.X Gremien", frage: "Wer berät was?", text: "Welchen Weg Vorgänge durch die Gremien nehmen und wo sie entschieden werden." },
  graph: { icon: "network", gruppe: "Einblicke", titel: "plenara.X Themennetz", frage: "Was hängt zusammen?", text: "Womit ein Thema zusammenhängt: verwandte Begriffe als Netz zum Anklicken." },
  news: { icon: "newspaper", gruppe: "Einblicke", titel: "plenara.X Aktuelles", frage: "Was ist berichtenswert?", text: "Vorgänge nach Nachrichtenwert, je Vorgang eine Meldung mit wörtlichem Zitat und Quelle. Für Vorhaben nach Branche und Stand: Signale." },
};

export function XKopf({ seite }: { seite: keyof typeof SEITEN }) {
  const s = SEITEN[seite], path = usePathname();
  const router = useRouter(), { goBack } = useAppNav();
  /* Methodik: kleiner Info-Knopf neben der Frage; „Methodik“ unter den Ergebnissen (#methodik) öffnet dasselbe Feld */
  const [info, setInfo] = useState(false);
  useEffect(() => {
    const auf = () => { if (location.hash === "#methodik") { setInfo(true); document.getElementById("methodik")?.scrollIntoView({ behavior: "smooth", block: "start" }); } };
    auf();
    window.addEventListener("hashchange", auf);
    return () => window.removeEventListener("hashchange", auf);
  }, []);
  /* Ort zwischen Atlas und Vergleich mitnehmen (?ort=) */
  const ort = useSearchParams().get("ort");
  const mit = (href: string) => (ort && s.reiter === ATLAS ? `${href}?ort=${ort}` : href);
  return (
    <PageBand compact>
      {/* Kein Pfad, nur Zurück wie auf den übrigen Seiten (Artikel) */}
      <button type="button" className="back-btn -ml-1.5 mb-1 print:hidden" onClick={() => (cameFromApp() ? router.back() : goBack())}><IconChevronLeft />Zurück</button>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {/* Titel kurz, die Marke als kleines Abzeichen daneben  */}
        <h1 className="flex items-baseline gap-2.5 text-[28px] font-semibold leading-tight">
          {s.titel.replace("plenara.X ", "")}
          <MarkenAbzeichen />
        </h1>
        <p className="text-[16px] text-slate-500"><b className="font-semibold text-slate-700">{s.frage}</b> {s.text.replace(/\s*\S+$/, "")}{" "}
          {/* Letztes Wort und Fragezeichen bleiben zusammen, sonst steht das Symbol auf dem Handy allein in einer Zeile */}
          <span className="whitespace-nowrap">{s.text.match(/\S+$/)?.[0]}<button type="button" onClick={() => setInfo(!info)} aria-expanded={info} aria-controls="methodik" title="Methodik: worauf die Zahlen beruhen"
            className="ml-2 inline-flex h-6 w-6 translate-y-[3px] items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-teal-700 print:hidden">
            <Icon name="circleHelp" size={16} /><span className="sr-only">Methodik</span>
          </button></span>
        </p>
      </div>
      {info && METHODIK_VON[seite] && (
        <div id="methodik" className="mt-4 max-w-[900px] scroll-mt-24 border-l-2 border-teal-600 pl-4">
          <div className="flex items-baseline justify-between gap-4">
            <p className="m-0 text-[14px] font-semibold text-slate-900">Methodik</p>
            <button type="button" onClick={() => { setInfo(false); if (location.hash === "#methodik") history.replaceState(history.state, "", location.pathname + location.search); }} className="text-[14px] text-slate-500 hover:text-slate-900">Schließen</button>
          </div>
          <MethodikText ids={METHODIK_VON[seite]} />
        </div>
      )}
      {s.reiter && (
        <nav aria-label="Ansicht" className="-mb-4 mt-3 flex gap-6 print:hidden">
          {s.reiter.map(([href, name]) => (
            <Link key={href} href={mit(href)} aria-current={href === path ? "page" : undefined} scroll={false}
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
      {/* Handy: Auswahlfeld statt drei Reihen Kacheln */}
      <label className="mb-3 block sm:hidden print:hidden">
        <span className="sr-only">Thema</span>
        <select value={search.state.thema} onChange={(e) => search.setThema(e.target.value)} className="select-base h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[16px]">
          <option value="">Alle Themen</option>
          {THEMES.map((t: { id: string; name: string }) => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </label>
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
    <span role="img" aria-label="plenara.X" className="inline-flex items-baseline rounded-md bg-slate-100 px-[7px] pb-[3px] pt-[2px] text-[14px] font-semibold leading-none text-slate-700">
      <span style={{ letterSpacing: "-.015em" }}>plenara</span><span className="inline-block self-center" style={{ lineHeight: 0 }}><AnalyticsX centered /></span>
    </span>
  );
}
