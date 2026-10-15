import { useEffect, type ComponentType } from "react";
import { AnalyticsAbout, AnalyticsGroupPage } from "./AnalyticsAbout";
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

/** plenara.X: Übersicht und je Funktion eine Unterseite */
const PAGES: Record<string, ComponentType> = {
  "/analytics": AnalyticsAbout,
  "/analytics/ueber": AnalyticsAbout,
  "/analytics/diffusion": DiffusionPage,
  "/analytics/graph": KnowledgeGraphPage,
  "/analytics/trends": TrendsPage,
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
  "/analytics/tools": () => <AnalyticsGroupPage group="tool" />,
  // Frühere Gruppen plenara.X Politik und Finanzen (Fraktionsprofil und Newsradar stehen jetzt bei den Tools)
  "/analytics/politik": () => <Umleiten to="/analytics/tools" />,
  "/analytics/finanzen": () => <Umleiten to="/analytics/tools" />,
};

// Die Adressen stehen in lib/routes.ts (App.tsx braucht sie, ohne diese Seiten zu laden); PAGES muss sie alle bedienen.
export { isAnalyticsPath } from "../../lib/routes";

/** Nur die Übersichten (Start, Tools) sind frei; die Analysen gehören zu Enterprise */
const FREE = new Set(["/analytics", "/analytics/ueber", "/analytics/tools", "/analytics/politik", "/analytics/finanzen"]);

export function AnalyticsPages({ path }: { path: string }) {
  const { tier, ready } = useTier();
  useEffect(() => {
    window.scrollTo(0, 0);
    const gruppe = Object.values(GRUPPEN).find((g) => g.href === path);
    const TITEL: Record<string, string> = { "/analytics/atlas": "plenara.X Atlas", "/analytics/signale": "Signale · plenara.X", "/analytics/fakten": "Fakten · plenara.X", "/analytics/news": "Newsradar · plenara.X", "/analytics/diffusion": "Ausbreitung · plenara.X",
      "/analytics/graph": "Themennetz · plenara.X", "/analytics/gremien": "Beratungswege · plenara.X", "/analytics/beschluesse": "Beschlüsse · plenara.X",
      "/analytics/vergleich": "Ortsvergleich · plenara.X", "/analytics/trends": "Trends · plenara.X", "/analytics/fraktionen": "Fraktionsprofil · plenara.X", "/analytics/tools": "plenara.X Tools" };
    document.title = TITEL[path] ?? (gruppe ? gruppe.name : "Über plenara.X · plenara");
  }, [path]);
  const Page = PAGES[path];
  if (!Page) return null;
  if (FREE.has(path) || tier === "enterprise") return <Page />;
  /* Bis /api/me antwortet: neutral laden, nicht sperren */
  if (!ready) return <main id="inhalt" aria-busy="true" className="min-h-[60vh] w-full px-[max(1vw,16px)] pb-12" />;
  return <AnalyticsLocked path={path} />;
}
