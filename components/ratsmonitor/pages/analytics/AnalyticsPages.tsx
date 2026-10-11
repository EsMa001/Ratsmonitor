import { useEffect, type ComponentType } from "react";
import { AnalyticsAbout, AnalyticsGroupPage } from "./AnalyticsAbout";
import { DiffusionPage } from "./DiffusionPage";
import { BeschluessePage } from "./BeschluessePage";
import { ComparePage } from "./ComparePage";
import { TrendsPage } from "./TrendsPage";
import { GremiennetzPage } from "./GremiennetzPage";
import { KnowledgeGraphPage } from "./KnowledgeGraphPage";
import { FraktionenPage } from "./FraktionenPage";
import { FoerderradarPage } from "./FoerderradarPage";
import { BauleitplanungPage } from "./BauleitplanungPage";
import { KitaRadarPage } from "./KitaRadarPage";
import { AnalyticsLocked } from "./AnalyticsLocked";
import { useTier } from "../../lib/tier";

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
  "/analytics/foerderung": FoerderradarPage,
  "/analytics/bauleitplanung": BauleitplanungPage,
  "/analytics/kita": KitaRadarPage,
  "/analytics/tools": () => <AnalyticsGroupPage group="tool" />,
  "/analytics/radar": () => <AnalyticsGroupPage group="radar" />,
};

// Die Adressen stehen in lib/routes.ts (App.tsx braucht sie, ohne diese Seiten zu laden); PAGES muss sie alle bedienen.
export { isAnalyticsPath } from "../../lib/routes";

/** Nur die Übersichten (Start, Tools, Radar) sind frei; die Analysen gehören zu Enterprise */
const FREE = new Set(["/analytics", "/analytics/ueber", "/analytics/tools", "/analytics/radar"]);

export function AnalyticsPages({ path }: { path: string }) {
  const { tier } = useTier();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = path === "/analytics/diffusion" ? "Ausbreitung · plenara.X" : path === "/analytics/graph" ? "Themennetz · plenara.X" : path === "/analytics/gremien" ? "Beratungswege · plenara.X" : path === "/analytics/beschluesse" ? "Beschlüsse · plenara.X" : path === "/analytics/vergleich" ? "Ortsvergleich · plenara.X" : path === "/analytics/trends" ? "Trends · plenara.X" : path === "/analytics/fraktionen" ? "Fraktionsprofil · plenara.X" : path === "/analytics/foerderung" ? "Förderradar · plenara.X" : path === "/analytics/bauleitplanung" ? "Bauleitplanung · plenara.X" : path === "/analytics/kita" ? "Kita-Radar · plenara.X" : path === "/analytics/tools" ? "plenara.X Tools" : path === "/analytics/radar" ? "plenara.X Radar" : "Über plenara.X · plenara";
  }, [path]);
  const Page = PAGES[path];
  if (!Page) return null;
  return FREE.has(path) || tier === "enterprise" ? <Page /> : <AnalyticsLocked path={path} />;
}
