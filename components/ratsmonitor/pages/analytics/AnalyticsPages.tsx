import { useEffect, type ComponentType } from "react";
import { AnalyticsAbout } from "./AnalyticsAbout";
import { DiffusionPage } from "./DiffusionPage";
import { BeschluessePage } from "./BeschluessePage";
import { ComparePage } from "./ComparePage";
import { TrendsPage } from "./TrendsPage";
import { GremiennetzPage } from "./GremiennetzPage";
import { KnowledgeGraphPage } from "./KnowledgeGraphPage";
import { AnalyticsLocked } from "./AnalyticsLocked";
import { useTier } from "../../lib/tier";

/** Plenara.X: Übersicht und je Funktion eine Unterseite */
const PAGES: Record<string, ComponentType> = {
  "/analytics": AnalyticsAbout,
  "/analytics/ueber": AnalyticsAbout,
  "/analytics/diffusion": DiffusionPage,
  "/analytics/graph": KnowledgeGraphPage,
  "/analytics/trends": TrendsPage,
  "/analytics/vergleich": ComparePage,
  "/analytics/beschluesse": BeschluessePage,
  "/analytics/gremien": GremiennetzPage,
};

export const isAnalyticsPath = (p: string) => p in PAGES;

/** Nur „Über Plenara.X“ ist frei; die Analysen gehören zu Enterprise */
const FREE = new Set(["/analytics", "/analytics/ueber"]);

export function AnalyticsPages({ path }: { path: string }) {
  const { tier } = useTier();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = path === "/analytics/diffusion" ? "Diffusionsanalyse · plenara.X" : path === "/analytics/graph" ? "Knowledge Graph · plenara.X" : path === "/analytics/gremien" ? "Gremiennetz · plenara.X" : path === "/analytics/beschluesse" ? "Beschlüsse · plenara.X" : path === "/analytics/vergleich" ? "Gebietsvergleich · plenara.X" : path === "/analytics/trends" ? "Trends und Frühindikatoren · plenara.X" : "Über plenara.X · plenara";
  }, [path]);
  const Page = PAGES[path];
  if (!Page) return null;
  return FREE.has(path) || tier === "enterprise" ? <Page /> : <AnalyticsLocked path={path} />;
}
