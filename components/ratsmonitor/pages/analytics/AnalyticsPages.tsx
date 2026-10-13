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
import { RADARS } from "@/shared/radars.mjs";
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
  "/analytics/foerderung": () => <AtlasPage initial="foerderung" />,
  "/analytics/news": NewsradarPage,
  /* Themenradare: eine Seite, der plenara.X Atlas; die früheren Einzeladressen zeigen ihn mit ihrem Thema */
  "/analytics/atlas": () => <AtlasPage />,
  "/analytics/kita": () => <AtlasPage initial="kita" />,
  "/analytics/bauleitplanung": () => <AtlasPage initial="bauleitplanung" />,
  "/analytics/versorgung": () => <AtlasPage initial="versorgung" />,
  "/analytics/verkehr": () => <AtlasPage initial="verkehr" />,
  "/analytics/soziales": () => <AtlasPage initial="soziales" />,
  "/analytics/vergabe": () => <AtlasPage initial="vergabe" />,
  "/analytics/klima": () => <AtlasPage initial="klima" />,
  "/analytics/finanzlage": () => <AtlasPage initial="finanzlage" />,
  "/analytics/beteiligung": () => <AtlasPage initial="beteiligung" />,
  "/analytics/gebuehren": () => <AtlasPage initial="gebuehren" />,
  "/analytics/tools": () => <AnalyticsGroupPage group="tool" />,
  "/analytics/themen": () => <AnalyticsGroupPage group="themen" />,
  // Frühere Gruppen plenara.X Politik und Finanzen
  "/analytics/politik": () => <Umleiten to="/analytics/themen" />,
  "/analytics/finanzen": () => <Umleiten to="/analytics/themen" />,
  // Frühere Übersicht plenara.X Radar: die Themen stehen im Atlas
  "/analytics/radar": () => <AtlasPage />,
};

// Die Adressen stehen in lib/routes.ts (App.tsx braucht sie, ohne diese Seiten zu laden); PAGES muss sie alle bedienen.
export { isAnalyticsPath } from "../../lib/routes";

/** Nur die Übersichten (Start, Tools, Themen) sind frei; die Analysen gehören zu Enterprise */
const FREE = new Set(["/analytics", "/analytics/ueber", "/analytics/tools", "/analytics/themen", "/analytics/politik", "/analytics/finanzen"]);

export function AnalyticsPages({ path }: { path: string }) {
  const { tier, ready } = useTier();
  useEffect(() => {
    window.scrollTo(0, 0);
    const radar = RADARS[path.slice("/analytics/".length) as keyof typeof RADARS], gruppe = Object.values(GRUPPEN).find((g) => g.href === path);
    document.title = path === "/analytics/atlas" || path === "/analytics/radar" ? "plenara.X Atlas" : path === "/analytics/finanzlage" ? "Haushalt und Steuern · plenara.X" : path === "/analytics/news" ? "Newsradar · plenara.X" : gruppe ? gruppe.name : radar ? `${radar.name} · plenara.X` : path === "/analytics/diffusion" ? "Ausbreitung · plenara.X" : path === "/analytics/graph" ? "Themennetz · plenara.X" : path === "/analytics/gremien" ? "Beratungswege · plenara.X" : path === "/analytics/beschluesse" ? "Beschlüsse · plenara.X" : path === "/analytics/vergleich" ? "Ortsvergleich · plenara.X" : path === "/analytics/trends" ? "Trends · plenara.X" : path === "/analytics/fraktionen" ? "Fraktionsprofil · plenara.X" : path === "/analytics/foerderung" ? "Förderradar · plenara.X" : path === "/analytics/bauleitplanung" ? "Bauleitplanung · plenara.X" : path === "/analytics/kita" ? "Kita-Radar · plenara.X" : path === "/analytics/tools" ? "plenara.X Tools" : path === "/analytics/radar" ? "plenara.X Radar" : "Über plenara.X · plenara";
  }, [path]);
  const Page = PAGES[path];
  if (!Page) return null;
  if (FREE.has(path) || tier === "enterprise") return <Page />;
  /* Bis /api/me antwortet: neutral laden, nicht sperren */
  if (!ready) return <main id="inhalt" aria-busy="true" className="min-h-[60vh] w-full px-[max(1vw,16px)] pb-12" />;
  return <AnalyticsLocked path={path} />;
}
