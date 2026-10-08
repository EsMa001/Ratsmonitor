/* Enterprise-Block der Branchenseiten: Plenara.X-Analysen (Teil von Enterprise) und Team-Funktionen.
   Gleiches Gerüst für alle Branchen, Auswahl, Sätze und Anordnung je Branche. */
import type { IconName } from "./icons";

export type AnalyseId = "diffusion" | "graph" | "trends" | "vergleich" | "beschluesse" | "gremien";

export const ANALYSEN: Record<AnalyseId, { href: string; name: string; icon: IconName }> = {
  diffusion: { href: "/analytics/diffusion", name: "Diffusionsanalyse", icon: "map" },
  graph: { href: "/analytics/graph", name: "Knowledge Graph", icon: "layers" },
  trends: { href: "/analytics/trends", name: "Trends und Frühindikatoren", icon: "trendingUp" },
  vergleich: { href: "/analytics/vergleich", name: "Gebietsvergleich", icon: "mapPin" },
  beschluesse: { href: "/analytics/beschluesse", name: "Status und Beschlüsse", icon: "circleCheck" },
  gremien: { href: "/analytics/gremien", name: "Gremiennetz", icon: "users" },
};

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
  bauwesen: {
    title: "Sehen, wo ein Thema schon angekommen ist",
    layout: "lead",
    analysen: [
      ["diffusion", "Verfolgen Sie, in welchen Kommunen Begriffe wie Veränderungssperre oder Aufstellungsbeschluss zuerst auftauchten und wohin sie wandern."],
      ["beschluesse", "Beschlussquote, Vertagungen und Dauer zeigen, wie zügig Bauleitplanung in einer Kommune läuft."],
    ],
    team: ["Für Ihr Projektteam", "Sitzungskalender mit Umkreis um Ihre Flächen; Hinweise gehen an bis zu fünf weitere Personen aus Entwicklung und Planung."],
  },
  energie: {
    title: "Wärmeplanung im Vergleich",
    layout: "cards",
    analysen: [
      ["vergleich", "Stellen Sie 2 bis 4 Kommunen nebeneinander: Wer plant Fernwärme, wer nicht?"],
      ["trends", "Erkennen Sie früh, welche Themen rund um Konzessionen und Netze an Fahrt gewinnen."],
      ["gremien", "Sehen Sie den Weg einer Vorlage durch die Gremien, bis zur Entscheidung."],
    ],
    team: ["Für Vertrieb und Netzplanung", "Der Sitzungskalender zeigt Termine Ihres Netzgebiets; bis zu fünf Kolleginnen und Kollegen erhalten dieselben Hinweise."],
  },
  "entsorgung-und-wasser": {
    title: "Vergaben und Gebühren im Ortsvergleich",
    layout: "lead",
    analysen: [
      ["trends", "Sehen Sie, wann Neuvergaben in Ihrer Region häufiger werden."],
      ["vergleich", "Vergleichen Sie Ausschreibungen, Gebührensatzungen und Laufzeiten mehrerer Kommunen."],
    ],
    team: ["Für Ausschreibungsteam und Vertrieb", "Der Sitzungskalender nennt Ausschusstermine mit Entsorgungsthemen; bis zu fünf weitere Empfänger bekommen die Alarme."],
  },
  wirtschaft: {
    title: "Entscheidungen einordnen",
    layout: "cards",
    analysen: [
      ["beschluesse", "Wie oft wird in Ihrer Region vertagt, wie schnell beschlossen? Das zeigt, wann sich Mitreden lohnt."],
      ["gremien", "Wissen Sie, welches Gremium vor der Entscheidung berät."],
      ["trends", "Frühindikatoren für Gewerbeflächen, Hebesätze und Ausschreibungen."],
    ],
    team: ["Für Geschäftsstelle und Mitglieder-Betreuung", "Sitzungskalender für Ihre Gebiete; bis zu fünf weitere Empfänger sehen jeden Alarm."],
  },
  verkehr: {
    title: "Projekte bis zur Entscheidung begleiten",
    layout: "lead",
    analysen: [
      ["trends", "Erkennen Sie, wo Straßensanierung, Radwege und ÖPNV gerade aufkommen."],
      ["beschluesse", "Beschlossen oder vertagt: Der Status zeigt, wie ein Bauabschnitt vorankommt."],
      ["diffusion", "Sehen Sie, wie sich Förderthemen von Kommune zu Kommune ausbreiten."],
    ],
    team: ["Für Planung und Vergabe", "Der Sitzungskalender mit Umkreis zeigt Termine entlang Ihrer Strecken; bis zu fünf weitere Personen werden mitinformiert."],
  },
  umwelt: {
    title: "Zusammenhänge zwischen Plänen und Auflagen",
    layout: "cards",
    analysen: [
      ["graph", "Verknüpfen Sie Bebauungspläne, Ausgleichsmaßnahmen und Gutachten zu einem Netz."],
      ["diffusion", "Sehen Sie, wo neue Anforderungen wie Klimaanpassung zuerst beschlossen wurden."],
      ["vergleich", "Vergleichen Sie Auflagen und Beschlusslagen mehrerer Gebiete."],
    ],
    team: ["Für Gutachterteam und Projektleitung", "Sitzungskalender für Ihre Gebiete; bis zu fünf weitere Empfänger erhalten die Hinweise zu neuen Plänen."],
  },
  medien: {
    title: "Zusammenhänge für die Recherche",
    layout: "lead",
    analysen: [
      ["gremien", "Der Weg einer Vorlage durch die Gremien liefert den Zeitplan Ihrer Geschichte."],
      ["graph", "Verbindungen zwischen Personen, Vorlagen und Gremien sichtbar machen, bevor andere sie sehen."],
      ["vergleich", "Haushalte und Beschlüsse mehrerer Orte gegenüberstellen."],
    ],
    team: ["Für Ihre Redaktion", "Der Sitzungskalender ist Ihre Wochenvorschau; bis zu fünf Kolleginnen und Kollegen bekommen dieselben Hinweise."],
  },
  vereine: {
    title: "Förderung im Vergleich verstehen",
    layout: "cards",
    analysen: [
      ["beschluesse", "Sehen Sie, wie oft Haushalte beschlossen oder vertagt werden."],
      ["vergleich", "Vergleichen Sie Zuschüsse und Förderrichtlinien mehrerer Kommunen."],
      ["trends", "Erkennen Sie früh, wo Förderthemen wie Ehrenamt zunehmen."],
    ],
    team: ["Für Vorstand und Geschäftsstelle", "Der Sitzungskalender zeigt Haushaltsberatungen vor Ort; bis zu fünf weitere Personen aus dem Verein erhalten die Alarme."],
  },
};
