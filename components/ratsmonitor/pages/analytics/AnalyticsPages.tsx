import { useEffect, type ComponentType } from "react";
import { BeschluessePage } from "./BeschluessePage";
import { ComparePage } from "./ComparePage";
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
import { MethodikUnten } from "./Methodik";

/** plenara.X: Übersicht und je Funktion eine Unterseite */
const PAGES: Record<string, ComponentType> = {
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
  /* plenara.X Ausschreibungen: Kategorie „Ausschreibungen und Vergaben“ als eigene Seite unter Einblicke */
  "/analytics/ausschreibungen": () => <SignalePage fest="vergaben" />,
  /* plenara.X Fakten: Werte aus den Unterlagen je Gemeinde auf der Karte (/api/x?view=fakten) */
  "/analytics/fakten": FaktenPage,
};

// Die Adressen stehen in lib/routes.ts (App.tsx braucht sie, ohne diese Seiten zu laden); PAGES muss sie alle bedienen.
export { isAnalyticsPath } from "../../lib/routes";

/** Nur die Übersichten (Start, Tools) sind frei; die Analysen gehören zu Enterprise */
const FREE = new Set<string>();

export function AnalyticsPages({ path }: { path: string }) {
  const { tier, ready } = useTier();
  useEffect(() => {
    window.scrollTo(0, 0);
    const gruppe = Object.values(GRUPPEN).find((g) => g.href === path);
    const TITEL: Record<string, string> = { "/analytics/atlas": "Atlas · plenara.X", "/analytics/signale": "Signale · plenara.X", "/analytics/ausschreibungen": "Ausschreibungen · plenara.X", "/analytics/fakten": "Fakten · plenara.X", "/analytics/news": "Aktuelles · plenara.X", 
      "/analytics/graph": "Themennetz · plenara.X", "/analytics/gremien": "Gremien · plenara.X", "/analytics/beschluesse": "Beschlusslage · plenara.X",
      "/analytics/vergleich": "Vergleich · plenara.X", "/analytics/trends": "Trends · plenara.X", "/analytics/fraktionen": "Fraktionen · plenara.X" };
    document.title = TITEL[path] ?? (gruppe ? gruppe.name : "plenara.X");
  }, [path]);
  const Page = PAGES[path];
  if (!Page) return null;
  if (FREE.has(path) || tier === "enterprise") return <><Page /><MethodikUnten seite={path.split("/").pop() ?? ""} /></>;
  /* Bis /api/me antwortet: neutral laden, nicht sperren */
  if (!ready) return <main id="inhalt" aria-busy="true" className="min-h-[60vh] w-full px-[max(1vw,16px)] pb-12" />;
  return <AnalyticsLocked path={path} />;
}
