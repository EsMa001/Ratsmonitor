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
import { useSignedInHint } from "../../lib/signedInHint";
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
  const signedIn = useSignedInHint();
  useEffect(() => {
    window.scrollTo(0, 0);
    const gruppe = Object.values(GRUPPEN).find((g) => g.href === path);
    const TITEL: Record<string, string> = { "/analytics/atlas": "Themenatlas · plenara.X", "/analytics/signale": "Projekte · plenara.X", "/analytics/ausschreibungen": "Ausschreibungen · plenara.X", "/analytics/fakten": "Werte · plenara.X", "/analytics/news": "Nachrichten · plenara.X", 
      "/analytics/graph": "Themennetz · plenara.X", "/analytics/gremien": "Gremien · plenara.X", "/analytics/beschluesse": "Beschlusslage · plenara.X",
      "/analytics/vergleich": "Vergleich · plenara.X", "/analytics/trends": "Trends · plenara.X", "/analytics/fraktionen": "Fraktionen · plenara.X" };
    document.title = TITEL[path] ?? (gruppe ? gruppe.name : "plenara.X");
  }, [path]);
  const Page = PAGES[path];
  if (!Page) return null;
  /* Ruhiger Übergang zwischen den Seiten: der Inhalt blendet kurz ein (nur Deckkraft), die Auswahl der Suche bleibt */
  if (FREE.has(path) || tier === "enterprise") return <div key={path} className="rm-pagein"><Page /><MethodikUnten seite={path.split("/").pop() ?? ""} /></div>;
  /* Bis /api/me antwortet: Gäste ohne Sitzung sehen gleich die Vorschau (steht so auch im Server-HTML), Angemeldete laden neutral */
  if (!ready && signedIn === false) return <AnalyticsLocked path={path} />;
  if (!ready) return <main id="inhalt" aria-busy="true" className="min-h-[60vh] w-full px-[max(1vw,16px)] pb-12" />;
  return <AnalyticsLocked path={path} />;
}
