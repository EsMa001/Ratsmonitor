import { useEffect, type ComponentType } from "react";
import { AnalyticsAbout } from "./AnalyticsAbout";
import { DiffusionPage } from "./DiffusionPage";
import { ComparePage } from "./ComparePage";
import { TrendsPage } from "./TrendsPage";
import { KnowledgeGraphPage } from "./KnowledgeGraphPage";

/** Plenara.X: Übersicht und je Funktion eine Unterseite */
const PAGES: Record<string, ComponentType> = {
  "/analytics": AnalyticsAbout,
  "/analytics/ueber": AnalyticsAbout,
  "/analytics/diffusion": DiffusionPage,
  "/analytics/graph": KnowledgeGraphPage,
  "/analytics/trends": TrendsPage,
  "/analytics/vergleich": ComparePage,
};

export const isAnalyticsPath = (p: string) => p in PAGES;

export function AnalyticsPages({ path }: { path: string }) {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = path === "/analytics/diffusion" ? "Diffusionsanalyse · Plenara.X" : path === "/analytics/graph" ? "Knowledge Graph · Plenara.X" : path === "/analytics/vergleich" ? "Gebietsvergleich · Plenara.X" : path === "/analytics/trends" ? "Trends und Frühindikatoren · Plenara.X" : "Über Plenara.X · Plenara";
  }, [path]);
  const Page = PAGES[path];
  return Page ? <Page /> : null;
}
