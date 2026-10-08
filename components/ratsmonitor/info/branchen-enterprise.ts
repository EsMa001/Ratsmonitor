/* Enterprise-Block der Branchenseiten: Plenara.X-Analysen (Teil von Enterprise) und Team-Funktionen.
   Gleiches Gerüst für alle Branchen, Auswahl, Sätze und Anordnung je Branche. */
import type { IconName } from "./icons";

export type AnalyseId = "diffusion" | "graph" | "trends" | "vergleich" | "beschluesse" | "gremien";

export const ANALYSEN: Record<AnalyseId, { href: string; name: string; icon: IconName }> = {
  diffusion: { href: "/analytics/diffusion", name: "Diffusionsanalyse", icon: "map" },
  graph: { href: "/analytics/graph", name: "Knowledge Graph", icon: "network" },
  trends: { href: "/analytics/trends", name: "Trends und Frühindikatoren", icon: "trendingUp" },
  vergleich: { href: "/analytics/vergleich", name: "Gebietsvergleich", icon: "mapPin" },
  beschluesse: { href: "/analytics/beschluesse", name: "Status und Beschlüsse", icon: "circleCheck" },
  gremien: { href: "/analytics/gremien", name: "Gremiennetz", icon: "users" },
};

/* Was Plenara.X leistet, vor den Beispielen jeder Branche: jeweils die passende Analyse als Vorschau */
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
      ["graph", "Verknüpfen Sie Bauleitpläne, Veränderungssperren und Gewerbegebiete zu einem Netz."],
      ["trends", "Erkennen Sie früh, welche Flächenthemen in Ihrer Region an Fahrt gewinnen."],
    ],
    team: ["Für Ihr Projektteam", "Sitzungskalender mit Umkreis um Ihre Flächen; Hinweise gehen an bis zu fünf weitere Personen aus Entwicklung und Planung."],
  },
  versorgung: {
    title: "",
    layout: "cards",
    analysen: [],
    team: ["Für Vertrieb und Netzplanung", "Der Sitzungskalender zeigt Termine Ihres Netzgebiets; bis zu fünf Kolleginnen und Kollegen erhalten dieselben Hinweise."],
  },
  verbaende: {
    title: "Entscheidungen einordnen",
    layout: "cards",
    analysen: [
      ["vergleich", "Vergleichen Sie Hebesätze und Gewerbeflächen mehrerer Kommunen nebeneinander."],
      ["graph", "Verbinden Sie Themen, Gremien und Personen, die Ihre Mitglieder betreffen."],
      ["trends", "Frühindikatoren für Gewerbeflächen, Hebesätze und Ausschreibungen."],
    ],
    team: ["Für Geschäftsstelle und Mitglieder-Betreuung", "Sitzungskalender für Ihre Gebiete; bis zu fünf weitere Empfänger sehen jeden Alarm."],
  },
  planung: {
    title: "",
    layout: "cards",
    analysen: [],
    team: ["Für Gutachterteam und Projektleitung", "Sitzungskalender für Ihre Gebiete; bis zu fünf weitere Empfänger erhalten die Hinweise zu neuen Plänen."],
  },
  oeffentlichkeit: {
    title: "Zusammenhänge für die Recherche",
    layout: "lead",
    analysen: [
      ["trends", "Erkennen Sie früh, welche Themen in Ihrer Recherche an Fahrt gewinnen."],
      ["graph", "Verbindungen zwischen Personen, Vorlagen und Gremien sichtbar machen, bevor andere sie sehen."],
      ["vergleich", "Haushalte und Beschlüsse mehrerer Orte gegenüberstellen."],
    ],
    team: ["Für Ihre Redaktion", "Der Sitzungskalender ist Ihre Wochenvorschau; bis zu fünf Kolleginnen und Kollegen bekommen dieselben Hinweise."],
  },
};
