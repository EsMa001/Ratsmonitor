import { useEffect, type ComponentType } from "react";
import { AnalyticsAbout } from "./AnalyticsAbout";
import { DiffusionPage } from "./DiffusionPage";

/** Plenara Analytics: Übersicht und je Funktion eine Unterseite */
const PAGES: Record<string, ComponentType> = {
  "/analytics": AnalyticsAbout,
  "/analytics/ueber": AnalyticsAbout,
  "/analytics/diffusion": DiffusionPage,
};

export const isAnalyticsPath = (p: string) => p in PAGES;

export function AnalyticsPages({ path }: { path: string }) {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = path !== "/analytics/diffusion" ? "Über Plenara Analytics · Plenara" : "Diffusionsanalyse · Plenara Analytics";
  }, [path]);
  const Page = PAGES[path];
  return Page ? <Page /> : null;
}
