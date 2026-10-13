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
  "/analytics/tools": () => <AnalyticsGroupPage group="tool" />,
  "/analytics/themen": () => <AnalyticsGroupPage group="themen" />,
  // Frühere Gruppen plenara.X Politik und Finanzen
  "/analytics/politik": () => <Umleiten to="/analytics/themen" />,
  "/analytics/finanzen": () => <Umleiten to="/analytics/themen" />,
};

// Die Adressen stehen in lib/routes.ts (App.tsx braucht sie, ohne diese Seiten zu laden); PAGES muss sie alle bedienen.
export { isAnalyticsPath } from "../../lib/routes";

/** Nur die Übersichten (Start, Tools, Themen) sind frei; die Analysen gehören zu Enterprise */
const FREE = new Set(["/analytics", "/analytics/ueber", "/analytics/tools", "/analytics/themen", "/analytics/politik", "/analytics/finanzen"]);

export function AnalyticsPages({ path }: { path: string }) {
  const { tier } = useTier();
  useEffect(() => {
    window.scrollTo(0, 0);
    const gruppe = Object.values(GRUPPEN).find((g) => g.href === path);
    const TITEL: Record<string, string> = { "/analytics/atlas": "plenara.X Atlas", "/analytics/news": "Newsradar · plenara.X", "/analytics/diffusion": "Ausbreitung · plenara.X",
      "/analytics/graph": "Themennetz · plenara.X", "/analytics/gremien": "Beratungswege · plenara.X", "/analytics/beschluesse": "Beschlüsse · plenara.X",
      "/analytics/vergleich": "Ortsvergleich · plenara.X", "/analytics/trends": "Trends · plenara.X", "/analytics/fraktionen": "Fraktionsprofil · plenara.X", "/analytics/tools": "plenara.X Tools" };
    document.title = TITEL[path] ?? (gruppe ? gruppe.name : "Über plenara.X · plenara");
  }, [path]);
  const Page = PAGES[path];
  if (!Page) return null;
  return FREE.has(path) || tier === "enterprise" ? <Page /> : <AnalyticsLocked path={path} />;
}
