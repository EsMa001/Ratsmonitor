/* Enterprise-Block der Branchenseiten: plenara.X-Analysen (Teil von Enterprise) und Team-Funktionen.
   Gleiches Gerüst für alle Branchen, Auswahl, Sätze und Anordnung je Branche. */
import type { IconName } from "./icons";

export type AnalyseId = "diffusion" | "graph" | "trends" | "vergleich" | "beschluesse" | "gremien" | "fraktionen" | "foerderung" | "bauleitplanung" | "kita" | "versorgung" | "verkehr" | "soziales" | "vergabe" | "klima" | "finanzlage" | "beteiligung" | "gebuehren" | "news";
/** Tools funktionieren mit jedem Suchbegriff; Politik, Finanzen und Radar sind fertige Auswertungen, nach der Frage geordnet */
/** atlas: Thema des plenara.X Atlas (/analytics/atlas), keine eigene Gruppe und kein eigener Eintrag in den Listen */
export type AnalyseGruppe = "tool" | "themen" | "atlas";

/* Gruppen mit Übersichtsseite (Menü „Analysen“, Brotkrumen der einzelnen Analysen) */
export const GRUPPEN: Record<Exclude<AnalyseGruppe, "atlas">, { name: string; kurz: string; href: string; text: string }> = {
  tool: { name: "plenara.X Tools", kurz: "Tools", href: "/analytics/tools", text: "Analysen, die mit jedem Suchbegriff funktionieren: Ausbreitung, Zusammenhänge, Trends, Ortsvergleich, Beschlüsse und Beratungswege." },
  themen: { name: "plenara.X Themen", kurz: "Themen", href: "/analytics/themen", text: "Fest vorgegebene Fragen ohne Suchbegriff: welche Fraktionen welche Themen beantragen und was daraus wird, und was gerade berichtenswert ist." },
};

export const ANALYSEN: Record<AnalyseId, { href: string; name: string; icon: IconName; group: AnalyseGruppe }> = {
  diffusion: { href: "/analytics/diffusion", name: "Ausbreitung", icon: "map", group: "tool" },
  graph: { href: "/analytics/graph", name: "Themennetz", icon: "network", group: "tool" },
  trends: { href: "/analytics/trends", name: "Trends", icon: "trendingUp", group: "tool" },
  vergleich: { href: "/analytics/vergleich", name: "Ortsvergleich", icon: "mapPin", group: "tool" },
  beschluesse: { href: "/analytics/beschluesse", name: "Beschlüsse", icon: "circleCheck", group: "tool" },
  gremien: { href: "/analytics/gremien", name: "Beratungswege", icon: "users", group: "tool" },
  fraktionen: { href: "/analytics/fraktionen", name: "Fraktionsprofil", icon: "landmark", group: "themen" },
  foerderung: { href: "/analytics/atlas?bereich=foerderung", name: "Förderradar", icon: "euro", group: "atlas" },
  bauleitplanung: { href: "/analytics/atlas?bereich=bauleitplanung", name: "Bauleitplanung", icon: "house", group: "atlas" },
  kita: { href: "/analytics/atlas?bereich=kita", name: "Kita-Radar", icon: "heart", group: "atlas" },
  versorgung: { href: "/analytics/atlas?bereich=versorgung", name: "Versorgungsradar", icon: "droplet", group: "atlas" },
  verkehr: { href: "/analytics/atlas?bereich=verkehr", name: "Verkehrsradar", icon: "bus", group: "atlas" },
  soziales: { href: "/analytics/atlas?bereich=soziales", name: "Vereins- und Sozialradar", icon: "handshake", group: "atlas" },
  vergabe: { href: "/analytics/atlas?bereich=vergabe", name: "Vergaberadar", icon: "clipboardList", group: "atlas" },
  klima: { href: "/analytics/atlas?bereich=klima", name: "Klima- und Energieradar", icon: "zap", group: "atlas" },
  finanzlage: { href: "/analytics/atlas?bereich=finanzlage", name: "Haushalt und Steuern", icon: "layers", group: "atlas" },
  beteiligung: { href: "/analytics/atlas?bereich=beteiligung", name: "Beteiligung", icon: "megaphone", group: "atlas" },
  news: { href: "/analytics/news", name: "Newsradar", icon: "newspaper", group: "themen" },
  gebuehren: { href: "/analytics/atlas?bereich=gebuehren", name: "Gebührenradar", icon: "tag", group: "atlas" },
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
      ["bauleitplanung", "Sehen Sie, welche Bebauungspläne in welchem Verfahrensschritt sind und wo Gewerbe-, Industrie- und Energieflächen entstehen."],
      ["graph", "Verknüpfen Sie Bauleitpläne, Veränderungssperren und Gewerbegebiete zu einem Netz."],
      ["gebuehren", "Grundbesitzabgaben im Blick: wo Abfall-, Abwasser- und Niederschlagswassergebühren neu kalkuliert, erhöht oder gesenkt werden."],
    ],
    team: ["Für Ihr Projektteam", "Sitzungskalender mit Umkreis um Ihre Flächen; Hinweise gehen an bis zu fünf weitere Personen aus Entwicklung und Planung."],
  },
  versorgung: {
    title: "Netze, Verträge und Gebühren im Blick",
    layout: "cards",
    analysen: [
      ["versorgung", "Konzessionen, Gebühren, Ausschreibungen und Ausbau bei Energie, Wärme, Wasser, Abwasser und Abfall."],
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
      ["finanzlage", "Wo Haushaltssicherung, Hebesätze, Kredite und Umlagen beraten werden und was daraus wird."],
      ["fraktionen", "Welche Fraktionen Anträge zu Ihren Themen stellen und was aus ihnen wird."],
    ],
    team: ["Für Geschäftsstelle und Mitglieder-Betreuung", "Sitzungskalender für Ihre Gebiete; bis zu fünf weitere Empfänger sehen jeden Alarm."],
  },
  planung: {
    title: "Verfahren, Aufträge und Förderung im Blick",
    layout: "cards",
    analysen: [
      ["vergabe", "Welche Planungs-, Ingenieur- und Gutachterleistungen Kommunen ausschreiben und vergeben."],
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
      ["kita", "Wo über Kita-Elternbeiträge entschieden wird und in welche Richtung."],
      ["news", "Was diese Woche berichtenswert ist: Vorgänge nach Nachrichtenwert, je Vorgang eine Meldung mit Zitat aus der Vorlage und Quelle."],
    ],
    team: ["Für Ihre Redaktion", "Der Sitzungskalender ist Ihre Wochenvorschau; bis zu fünf Kolleginnen und Kollegen bekommen dieselben Hinweise."],
  },
};
