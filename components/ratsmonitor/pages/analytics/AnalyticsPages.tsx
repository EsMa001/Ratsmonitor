import { useEffect, type ComponentType } from "react";
import { AnalyticsGroupPage, MethodikPage } from "./AnalyticsAbout";
import { DiffusionPage } from "./DiffusionPage";
import { BeschluessePage } from "./BeschluessePage";
import { ComparePage } from "./ComparePage";
import { TrendsPage } from "./TrendsPage";
import { GremiennetzPage } from "./GremiennetzPage";
import { KnowledgeGraphPage } from "./KnowledgeGraphPage";
import { FraktionenPage } from "./FraktionenPage";
import { NewsradarPage } from "./NewsradarPage";
import { AtlasPage } from "./AtlasPage";
import { SignalePage } from "./SignalePage";
import { FaktenPage } from "./FaktenPage";
import { XTrendsPage } from "./XTrendsPage";
import { GRUPPEN } from "../../info/branchen-enterprise";
import { AnalyticsLocked } from "./AnalyticsLocked";
import { useTier } from "../../lib/tier";
import { useRouter } from "next/navigation";

/** Frühere Adresse: ersetzt sie im Verlauf durch die neue (Lesezeichen und alte Links funktionieren weiter) */
function Umleiten({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(to, { scroll: false }); }, [router, to]);
  return null;
}

/** Alte Adresse der Ausbreitung: auf plenara.X Trends, ein mitgegebener Begriff öffnet dort seinen Steckbrief */
function ZuTrends() {
  const t = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const begriff = t?.get("thema") || t?.get("q") || "";
  return <Umleiten to={`/analytics/trends${begriff ? `?begriff=${encodeURIComponent(begriff)}` : ""}`} />;
}

/** plenara.X: Übersicht und je Funktion eine Unterseite */
const PAGES: Record<string, ComponentType> = {
  /* Methodik aller Analysen (verlinkt unter jeder Auswertung); eine Übersichtsseite /analytics gibt es nicht mehr */
  "/analytics/methodik": MethodikPage,
  /* Frühere Adresse der Ausbreitung: jetzt Teil von plenara.X Trends (Begriff aus ?thema= oder ?q= wird gewählt) */
  "/analytics/diffusion": () => <ZuTrends />,
  /* Die alten Werkzeuge bleiben unverändert als Sicherung */
  "/analytics/diffusion-alt": DiffusionPage,
  "/analytics/trends-alt": TrendsPage,
  "/analytics/graph": KnowledgeGraphPage,
  /* plenara.X Trends: Trends und Ausbreitung auf einer Seite */
  "/analytics/trends": XTrendsPage,
  "/analytics/vergleich": ComparePage,
  "/analytics/beschluesse": BeschluessePage,
  "/analytics/gremien": GremiennetzPage,
  "/analytics/fraktionen": FraktionenPage,
  "/analytics/news": NewsradarPage,
  /* plenara.X Atlas: die 10 Themen auf der einen Abfrage /api/x */
  "/analytics/atlas": () => <AtlasPage />,
  /* plenara.X Signale: neue Ereignisse je Branche als Liste (/api/x/signale) */
  "/analytics/signale": SignalePage,
  /* plenara.X Fakten: Werte aus den Unterlagen je Gemeinde auf der Karte (/api/x?view=fakten) */
  "/analytics/fakten": FaktenPage,
  /* plenara.X Einblicke: Fraktionen, Gremien, Themennetz, News (Übersicht); die frühere Seite Tools leitet hierher */
  "/analytics/einblicke": () => <AnalyticsGroupPage group="tool" />,
  "/analytics/tools": () => <Umleiten to="/analytics/einblicke" />,
  // Frühere Gruppen plenara.X Politik und Finanzen (Fraktionsprofil und Newsradar stehen jetzt bei den Tools)
  "/analytics/politik": () => <Umleiten to="/analytics/einblicke" />,
  "/analytics/finanzen": () => <Umleiten to="/analytics/einblicke" />,
};

// Die Adressen stehen in lib/routes.ts (App.tsx braucht sie, ohne diese Seiten zu laden); PAGES muss sie alle bedienen.
export { isAnalyticsPath } from "../../lib/routes";

/** Nur die Übersichten (Start, Tools) sind frei; die Analysen gehören zu Enterprise */
const FREE = new Set(["/analytics/methodik", "/analytics/tools", "/analytics/einblicke", "/analytics/politik", "/analytics/finanzen"]);

export function AnalyticsPages({ path }: { path: string }) {
  const { tier, ready } = useTier();
  useEffect(() => {
    window.scrollTo(0, 0);
    const gruppe = Object.values(GRUPPEN).find((g) => g.href === path);
    const TITEL: Record<string, string> = { "/analytics/atlas": "plenara.X Atlas", "/analytics/signale": "Signale · plenara.X", "/analytics/fakten": "Fakten · plenara.X", "/analytics/news": "Aktuelles · plenara.X", "/analytics/diffusion-alt": "Alt: Ausbreitung · plenara.X", "/analytics/trends-alt": "Alt: Trends · plenara.X",
      "/analytics/graph": "Themennetz · plenara.X", "/analytics/gremien": "Gremien · plenara.X", "/analytics/beschluesse": "Ausgang · plenara.X Trends",
      "/analytics/vergleich": "Vergleich · plenara.X Atlas", "/analytics/trends": "plenara.X Trends", "/analytics/fraktionen": "Fraktionen · plenara.X" };
    document.title = TITEL[path] ?? (gruppe ? gruppe.name : path === "/analytics/methodik" ? "Methodik · plenara.X" : "plenara.X");
  }, [path]);
  const Page = PAGES[path];
  if (!Page) return null;
  if (FREE.has(path) || tier === "enterprise") return <Page />;
  /* Bis /api/me antwortet: neutral laden, nicht sperren */
  if (!ready) return <main id="inhalt" aria-busy="true" className="min-h-[60vh] w-full px-[max(1vw,16px)] pb-12" />;
  return <AnalyticsLocked path={path} />;
}
