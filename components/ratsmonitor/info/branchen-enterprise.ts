/* Enterprise-Block der Branchenseiten: plenara.X-Analysen (Teil von Enterprise) und Team-Funktionen.
   Gleiches Gerüst für alle Branchen, Auswahl, Sätze und Anordnung je Branche. */
import type { IconName } from "./icons";

export type AnalyseId = "diffusion" | "graph" | "trends" | "vergleich" | "beschluesse" | "gremien" | "fraktionen" | "bauleitplanung" | "kita" | "versorgung" | "verkehr" | "soziales" | "atlas" | "signale" | "fakten" | "klima" | "finanzlage" | "beteiligung" | "news";
/** Tools funktionieren mit jedem Suchbegriff; Themen sind fertige Auswertungen; der Atlas zeigt die 10 Themen (feste Auswahlen darin für die Branchenseiten) */
/** atlas: Auswahl im plenara.X Atlas (/analytics/atlas: Thema oder Unterthema), keine eigene Gruppe und kein eigener Eintrag in den Listen */
export type AnalyseGruppe = "tool" | "atlas";

/* Gruppen mit Übersichtsseite (Menü „Analysen“, Brotkrumen der einzelnen Analysen) */
export const GRUPPEN: Record<Exclude<AnalyseGruppe, "atlas">, { name: string; kurz: string; href: string; text: string }> = {
  tool: { name: "plenara.X Tools", kurz: "Tools", href: "/analytics/tools", text: "Werkzeuge für eigene Fragen: Ausbreitung, Zusammenhänge, Trends, Ortsvergleich, Beschlüsse und Beratungswege mit jedem Suchbegriff, dazu Fraktionsprofil und Newsradar." },
};

export const ANALYSEN: Record<AnalyseId, { href: string; name: string; icon: IconName; group: AnalyseGruppe }> = {
  diffusion: { href: "/analytics/diffusion-alt", name: "Alt: Ausbreitung", icon: "map", group: "tool" },
  graph: { href: "/analytics/graph", name: "Themennetz", icon: "network", group: "tool" },
  trends: { href: "/analytics/trends-alt", name: "Alt: Trends", icon: "trendingUp", group: "tool" },
  vergleich: { href: "/analytics/vergleich", name: "Ortsvergleich", icon: "mapPin", group: "tool" },
  beschluesse: { href: "/analytics/beschluesse", name: "Beschlüsse", icon: "circleCheck", group: "tool" },
  gremien: { href: "/analytics/gremien", name: "Beratungswege", icon: "users", group: "tool" },
  fraktionen: { href: "/analytics/fraktionen", name: "Fraktionsprofil", icon: "landmark", group: "tool" },
  /* plenara.X Atlas und feste Auswahlen darin (Thema oder Unterthema; Namen wie im Atlas) */
  atlas: { href: "/analytics/atlas", name: "plenara.X Atlas", icon: "map", group: "atlas" },
  signale: { href: "/analytics/signale", name: "plenara.X Signale", icon: "zap", group: "atlas" },
  fakten: { href: "/analytics/fakten", name: "plenara.X Fakten", icon: "map", group: "atlas" },
  bauleitplanung: { href: "/analytics/atlas?thema=bauen&sub=bauen.plan", name: "Bauleitplanung", icon: "house", group: "atlas" },
  kita: { href: "/analytics/atlas?thema=bildung&sub=bildung.kitabetr", name: "Kitas: Betrieb, Träger und Beiträge", icon: "heart", group: "atlas" },
  versorgung: { href: "/analytics/atlas?thema=umwelt", name: "Umwelt, Klima & Energie", icon: "droplet", group: "atlas" },
  verkehr: { href: "/analytics/atlas?thema=mobilitaet", name: "Mobilität & Verkehr", icon: "bus", group: "atlas" },
  soziales: { href: "/analytics/atlas?thema=soziales", name: "Soziales & Gesundheit", icon: "handshake", group: "atlas" },
  klima: { href: "/analytics/atlas?thema=umwelt&sub=umwelt.klimaschutz", name: "Klimaschutz und Energieeffizienz", icon: "zap", group: "atlas" },
  finanzlage: { href: "/analytics/atlas?thema=finanzen", name: "Finanzen & Haushalt", icon: "layers", group: "atlas" },
  beteiligung: { href: "/analytics/atlas?thema=verwaltung&sub=verwaltung.beteil", name: "Bürgerbeteiligung und Beiräte", icon: "megaphone", group: "atlas" },
  news: { href: "/analytics/news", name: "Newsradar", icon: "newspaper", group: "tool" },
};

/* Was plenara.X leistet, vor den Beispielen jeder Branche: jeweils die passende Analyse als Vorschau */
export const PLENARAX_VORTEILE: [AnalyseId, string, string][] = [
  ["diffusion", "Ausbreitung sehen", "Wo ein Begriff zuerst auftaucht und in welchen Kommunen er danach folgt."],
  ["beschluesse", "Beschlüsse einordnen", "Quote, Vertagungen und Dauer zeigen, wie zügig eine Kommune entscheidet."],
  ["gremien", "Den Weg durch die Gremien verstehen", "Welche Ausschüsse einen Beschluss vorbereiten, bevor der Rat entscheidet."],
];

export interface EnterpriseBlock {
  title: string;
  /** Die erste Analyse wird groß gezeigt, wenn layout = "lead"; sonst drei gleiche Karten */
  layout: "lead" | "cards";
  /** Analyse und ein Satz, was sie für diese Branche zeigt */
  analysen: [AnalyseId, string][];
  /** Überschrift und Satz zu Sitzungskalender und weiteren Empfängern */
  team: [string, string];
}

export const ENTERPRISE: Record<string, EnterpriseBlock> = {
  immobilien: {
    title: "Sehen, wo ein Thema schon angekommen ist",
    layout: "lead",
    analysen: [
      ["bauleitplanung", "Sehen Sie, welche Bebauungs- und Flächennutzungspläne wo beraten werden und in welchem Verfahrensschritt sie sind."],
      ["graph", "Verknüpfen Sie Bauleitpläne, Veränderungssperren und Gewerbegebiete zu einem Netz."],
    ],
    team: ["Für Ihr Projektteam", "Sitzungskalender mit Umkreis um Ihre Flächen; Hinweise gehen an bis zu fünf weitere Personen aus Entwicklung und Planung."],
  },
  versorgung: {
    title: "Netze, Verträge und Gebühren im Blick",
    layout: "cards",
    analysen: [
      ["versorgung", "Konzessionen, Gebühren, Ausschreibungen und Ausbau bei Energie, Wärme, Wasser, Abwasser und Abfall."],
      ["bauleitplanung", "Erkennen Sie neue Baugebiete früh: Aufstellung, Offenlage und Satzungsbeschluss, je Gebiet und im Zeitverlauf."],
    ],
    team: ["Für Vertrieb und Netzplanung", "Der Sitzungskalender zeigt Termine Ihres Netzgebiets; bis zu fünf Kolleginnen und Kollegen erhalten dieselben Hinweise."],
  },
  verbaende: {
    title: "Entscheidungen einordnen",
    layout: "cards",
    analysen: [
      ["finanzlage", "Wo Haushaltssicherung, Hebesätze, Kredite und Umlagen beraten werden, mit den genannten Hebesätzen je Steuerart."],
      ["fraktionen", "Welche Fraktionen Anträge zu Ihren Themen stellen und was aus ihnen wird."],
    ],
    team: ["Für Geschäftsstelle und Mitglieder-Betreuung", "Sitzungskalender für Ihre Gebiete; bis zu fünf weitere Empfänger sehen jeden Alarm."],
  },
  planung: {
    title: "Verfahren, Aufträge und Förderung im Blick",
    layout: "cards",
    analysen: [
      ["bauleitplanung", "Welche Pläne in welchem Verfahrensschritt sind, je Gebiet und im Zeitverlauf."],
    ],
    team: ["Für Gutachterteam und Projektleitung", "Sitzungskalender für Ihre Gebiete; bis zu fünf weitere Empfänger erhalten die Hinweise zu neuen Plänen."],
  },
  oeffentlichkeit: {
    title: "Zusammenhänge für die Recherche",
    layout: "lead",
    analysen: [
      ["fraktionen", "Welche Fraktionen welche Themen beantragen und was aus ihren Anträgen wird."],
      ["kita", "Wo über Kitas, Träger und Elternbeiträge beraten wird, mit den Vorlagen dazu."],
      ["news", "Was diese Woche berichtenswert ist: Vorgänge nach Nachrichtenwert, je Vorgang eine Meldung mit Zitat aus der Vorlage und Quelle."],
    ],
    team: ["Für Ihre Redaktion", "Der Sitzungskalender ist Ihre Wochenvorschau; bis zu fünf Kolleginnen und Kollegen bekommen dieselben Hinweise."],
  },
};
