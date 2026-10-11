/* Enterprise-Block der Branchenseiten: plenara.X-Analysen (Teil von Enterprise) und Team-Funktionen.
   Gleiches Gerüst für alle Branchen, Auswahl, Sätze und Anordnung je Branche. */
import type { IconName } from "./icons";

export type AnalyseId = "diffusion" | "graph" | "trends" | "vergleich" | "beschluesse" | "gremien" | "fraktionen" | "foerderung" | "bauleitplanung" | "kita";
/** Tools funktionieren mit jedem Suchbegriff; Radare sind fertige Auswertungen zu einem festen Thema */
export type AnalyseGruppe = "tool" | "radar";

export const ANALYSEN: Record<AnalyseId, { href: string; name: string; icon: IconName; group: AnalyseGruppe }> = {
  diffusion: { href: "/analytics/diffusion", name: "Ausbreitung", icon: "map", group: "tool" },
  graph: { href: "/analytics/graph", name: "Themennetz", icon: "network", group: "tool" },
  trends: { href: "/analytics/trends", name: "Trends", icon: "trendingUp", group: "tool" },
  vergleich: { href: "/analytics/vergleich", name: "Ortsvergleich", icon: "mapPin", group: "tool" },
  beschluesse: { href: "/analytics/beschluesse", name: "Beschlüsse", icon: "circleCheck", group: "tool" },
  gremien: { href: "/analytics/gremien", name: "Beratungswege", icon: "users", group: "tool" },
  fraktionen: { href: "/analytics/fraktionen", name: "Fraktionsprofil", icon: "landmark", group: "radar" },
  foerderung: { href: "/analytics/foerderung", name: "Förderradar", icon: "euro", group: "radar" },
  bauleitplanung: { href: "/analytics/bauleitplanung", name: "Bauleitplanung", icon: "house", group: "radar" },
  kita: { href: "/analytics/kita", name: "Kita-Radar", icon: "heart", group: "radar" },
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
      ["bauleitplanung", "Sehen Sie, welche Bebauungspläne in welchem Verfahrensschritt sind und wie viele Wohnungen entstehen sollen."],
      ["graph", "Verknüpfen Sie Bauleitpläne, Veränderungssperren und Gewerbegebiete zu einem Netz."],
      ["trends", "Erkennen Sie früh, welche Flächenthemen in Ihrer Region an Fahrt gewinnen."],
    ],
    team: ["Für Ihr Projektteam", "Sitzungskalender mit Umkreis um Ihre Flächen; Hinweise gehen an bis zu fünf weitere Personen aus Entwicklung und Planung."],
  },
  versorgung: {
    title: "Neue Baugebiete und Förderung im Blick",
    layout: "cards",
    analysen: [
      ["bauleitplanung", "Erkennen Sie neue Baugebiete früh: Aufstellung, Offenlage und Satzungsbeschluss, mit geplanten Wohneinheiten."],
      ["foerderung", "Sehen Sie, wo Fördermittel für Wärme, Energie und Breitband beantragt und bewilligt werden."],
    ],
    team: ["Für Vertrieb und Netzplanung", "Der Sitzungskalender zeigt Termine Ihres Netzgebiets; bis zu fünf Kolleginnen und Kollegen erhalten dieselben Hinweise."],
  },
  verbaende: {
    title: "Entscheidungen einordnen",
    layout: "cards",
    analysen: [
      ["foerderung", "Sehen Sie, welche Förderprogramme in den Kommunen Ihrer Mitglieder beantragt und bewilligt werden."],
      ["fraktionen", "Welche Fraktionen Anträge zu Ihren Themen stellen und was aus ihnen wird."],
      ["vergleich", "Vergleichen Sie Hebesätze und Gewerbeflächen mehrerer Kommunen nebeneinander."],
    ],
    team: ["Für Geschäftsstelle und Mitglieder-Betreuung", "Sitzungskalender für Ihre Gebiete; bis zu fünf weitere Empfänger sehen jeden Alarm."],
  },
  planung: {
    title: "Verfahren und Förderung im Blick",
    layout: "cards",
    analysen: [
      ["bauleitplanung", "Welche Pläne in welchem Verfahrensschritt sind, je Gebiet und im Zeitverlauf."],
      ["foerderung", "Welche Förderprogramme Kommunen nutzen, etwa Städtebauförderung oder Klimaanpassung."],
    ],
    team: ["Für Gutachterteam und Projektleitung", "Sitzungskalender für Ihre Gebiete; bis zu fünf weitere Empfänger erhalten die Hinweise zu neuen Plänen."],
  },
  oeffentlichkeit: {
    title: "Zusammenhänge für die Recherche",
    layout: "lead",
    analysen: [
      ["fraktionen", "Welche Fraktionen welche Themen beantragen und was aus ihren Anträgen wird."],
      ["kita", "Wo über Kita-Elternbeiträge entschieden wird und wo neue Kita-Plätze entstehen."],
      ["trends", "Erkennen Sie früh, welche Themen in Ihrer Recherche an Fahrt gewinnen."],
    ],
    team: ["Für Ihre Redaktion", "Der Sitzungskalender ist Ihre Wochenvorschau; bis zu fünf Kolleginnen und Kollegen bekommen dieselben Hinweise."],
  },
};
