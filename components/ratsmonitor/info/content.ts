/* Texte des Dreistrichmenüs und der Infoseiten, übernommen aus der Übergabe-Dokumentation
   (Ratsmonitor-Dokumentation-Menue.pdf, Stand Oktober 2026). */
import type { IconName } from "./icons";

export type Status = "ok" | "wait";
export interface Example {
  place: string;
  committee: string;
  status: Status;
  title: string;
}
export interface Branche {
  slug: string;
  name: string;
  icon: IconName;
  title: string;
  intro: string;
  audience: string;
  example: Example;
  benefits: [IconName, string, string][];
  flowTitle: string;
  steps: [IconName, string][];
  /** Schritte, zu denen die Kommune Dokumente veröffentlicht („Ratsmonitor meldet“) */
  reported: number[];
  advantage: string;
  /* TODO: Kennzahl ist ein Beispielwert (Doku Kap. 8) – durch echte Werte aus dem Backend ersetzen */
  stat: [string, string];
  watch: string[];
  closing: string;
  /** Suchbegriffe; der erste ist der Haupt-Suchbegriff */
  keywords: string[];
}

export const STATUS_LABEL: Record<Status, string> = { ok: "Beschlossen", wait: "Vertagt" };

/* TODO: Beispiel-Treffer und Orte sind fiktiv (Doku Kap. 8) */
export const BRANCHEN: Branche[] = [
  {
    slug: "bauwesen",
    name: "Bauwesen & Immobilien",
    icon: "house",
    title: "Bauland sehen, bevor es Bauland ist.",
    intro: "Bevor ein Bagger anrollt, hat meist ein Ausschuss darüber beraten. Hier lesen Sie mit.",
    audience: "Projektentwickler, Investoren, Architekten",
    example: { place: "Lindenau", committee: "Bauausschuss", status: "ok", title: "Aufstellungsbeschluss zum Bebauungsplan Nr. 14 „Am Mühlgraben“" },
    benefits: [
      ["eye", "Flächen sehen, bevor sie am Markt sind", "Aufstellungsbeschlüsse zeigen neues Bauland oft Jahre vor dem ersten Exposé."],
      ["shieldCheck", "Risiken vor dem Kauf erkennen", "Veränderungssperren, Auflagen und Widerstände kennen, bevor Sie investieren."],
      ["handshake", "Früh am Tisch sitzen", "Mit Verwaltung und Politik sprechen, solange der Plan noch gestaltbar ist."],
    ],
    flowTitle: "Vom Aufstellungsbeschluss bis zum Baubeginn",
    steps: [["users", "Aufstellungsbeschluss"], ["map", "Frühzeitige Beteiligung"], ["fileText", "Offenlegung"], ["circleCheck", "Satzungsbeschluss"], ["house", "Baugenehmigung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie erfahren von einer Fläche, wenn sie zum ersten Mal in einem Gremium auftaucht, oft Jahre vor dem Baubeginn.",
    stat: ["312", "neue Aufstellungsbeschlüsse im letzten Monat"],
    watch: ["Aufstellungsbeschlüsse", "Offenlegungen", "Veränderungssperren", "Städtebauliche Verträge"],
    closing: "Ihr nächstes Grundstück steht schon auf einer Tagesordnung.",
    keywords: ["Aufstellungsbeschluss", "Bebauungsplan", "Veränderungssperre", "Offenlegung", "städtebaulicher Vertrag"],
  },
  {
    slug: "energie",
    name: "Energie & Stadtwerke",
    icon: "zap",
    title: "Konzessionen kennen, bevor sie vergeben sind.",
    intro: "Wer Wärme oder Strom ins Netz bringt, braucht die Kommune als Partner. Die Beschlüsse dazu stehen in den Ratsinformationssystemen.",
    audience: "Energieversorger, Netzbetreiber, Stadtwerke",
    example: { place: "Birkenfeld-Ost", committee: "Gemeinderat", status: "ok", title: "Kommunale Wärmeplanung: Eignungsgebiete für Fernwärme festgelegt" },
    benefits: [
      ["target", "Keine Konzession verpassen", "Auslaufende Strom- und Gasverträge in Ihrem Gebiet werden Ihnen automatisch gemeldet."],
      ["map", "Wärmenetze vorausplanen", "Sehen, wo Kommunen Fernwärme vorsehen und wo nicht."],
      ["trendingUp", "Den Markt im Blick", "Entscheidungen von Stadtwerken und Nachbarkommunen verfolgen."],
    ],
    flowTitle: "Von der Wärmeplanung bis zur Konzession",
    steps: [["map", "Wärmeplanung"], ["users", "Beratung im Rat"], ["calendar", "Konzession läuft aus"], ["clipboardList", "Vergabeverfahren"], ["zap", "Netzbetrieb"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen das Auslaufen einer Konzession, wenn es im Hauptausschuss angekündigt wird, und haben Zeit für ein Angebot.",
    stat: ["148", "Beschlüsse zu Wärmeplanung und Konzessionen im letzten Monat"],
    watch: ["Wärmeplanung", "Konzessionsverträge", "Netzausbau", "Städtische Beteiligungen"],
    closing: "Die nächste Konzession wird gerade beraten.",
    keywords: ["Wärmeplanung", "Konzessionsvertrag", "Fernwärme", "Stadtwerke", "Netzausbau"],
  },
  {
    slug: "kreislaufwirtschaft",
    name: "Kreislaufwirtschaft, Abfall & Wasser",
    icon: "droplet",
    title: "Aufträge kennen, bevor sie ausgeschrieben sind.",
    intro: "Entsorgungsverträge, neue Anlagen, Sanierungen: In den Räten entscheidet sich, wer die nächsten Aufträge bekommt.",
    audience: "Entsorgungsunternehmen, Recyclingbetriebe, Ingenieurbüros",
    example: { place: "Ahrenstedt", committee: "Umweltausschuss", status: "ok", title: "Neuvergabe der Abfallsammlung und -beförderung ab 2028" },
    benefits: [
      ["clipboardList", "Aufträge vor der Ausschreibung", "Auslaufende Entsorgungsverträge und Investitionen kennen, bevor sie vergeben werden."],
      ["droplet", "Die Infrastruktur-Pipeline", "Kläranlagen, Kanalnetze und Wertstoffhöfe bundesweit an einem Ort."],
      ["trendingUp", "Den Markt im Blick", "Sehen, welche Kommunen umstellen, rekommunalisieren oder neu ausschreiben."],
    ],
    flowTitle: "Vom Konzept bis zum neuen Auftrag",
    steps: [["fileText", "Abfallwirtschaftskonzept"], ["users", "Fachausschuss"], ["circleCheck", "Ratsbeschluss"], ["clipboardList", "Vergabebeschluss"], ["house", "Leistungsbeginn"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie erfahren von auslaufenden Verträgen und neuen Anlagen, sobald sie im Ausschuss beraten werden, Monate vor der Ausschreibung.",
    stat: ["226", "Beschlüsse zu Entsorgung und Vergaben im letzten Monat"],
    watch: ["Entsorgungsverträge", "Abfallwirtschaftskonzepte", "Anlagen und Wertstoffhöfe", "Kläranlagen und Kanalnetz"],
    closing: "Ihr nächster Auftrag wird gerade beschlossen.",
    keywords: ["Entsorgungsvertrag", "Abfallsammlung", "Abfallwirtschaftskonzept", "Wertstoffhof", "Kläranlage"],
  },
  {
    slug: "wirtschaft",
    name: "Wirtschaft & Verbände",
    icon: "briefcase",
    title: "Mitreden, bevor entschieden ist.",
    intro: "Hebesätze, Gewerbeflächen, Ausschreibungen: Wer die Interessen der Wirtschaft vertritt, muss wissen, was in den Räten ansteht.",
    audience: "Wirtschaftsverbände, Kammern, Unternehmen",
    example: { place: "Weidenbach", committee: "Vergabeausschuss", status: "ok", title: "Ausschreibung Gebäudereinigung städtischer Schulen 2027" },
    benefits: [
      ["megaphone", "Mitreden, solange beraten wird", "Stellung nehmen, bevor der Rat über Hebesätze und Flächen entscheidet."],
      ["euro", "Kosten früh kalkulieren", "Steuer- und Gebührenänderungen in die Planung einbeziehen, bevor sie gelten."],
      ["users", "Mitglieder informieren", "Verbände geben relevante Beschlüsse direkt an ihre Mitglieder weiter."],
    ],
    flowTitle: "Vom Haushaltsentwurf bis zum Steuerbescheid",
    steps: [["fileText", "Haushaltsentwurf"], ["users", "Finanzausschuss"], ["circleCheck", "Haushaltsbeschluss"], ["clipboardList", "Vergaben"], ["euro", "Bescheid"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen geplante Hebesatz-Erhöhungen schon im Haushaltsentwurf, bevor der Rat entscheidet.",
    stat: ["540", "Haushalts- und Vergabebeschlüsse im letzten Monat"],
    watch: ["Ausschreibungen", "Hebesätze", "Gewerbeflächen", "Sondernutzung und Märkte"],
    closing: "Die nächste Entscheidung steht schon auf der Tagesordnung.",
    keywords: ["Ausschreibung", "Hebesatz", "Gewerbefläche", "Sondernutzung", "Marktgebühren"],
  },
  {
    slug: "verkehr",
    name: "Verkehr & Infrastruktur",
    icon: "bus",
    title: "Projekte sehen, bevor sie ausgeschrieben sind.",
    intro: "Sanierungen, Radwegeprogramme, ÖPNV-Ausbau: Hier entstehen die Aufträge und Planungen von morgen.",
    audience: "Verkehrsbetriebe, Planungsbüros, Straßenbauunternehmen",
    example: { place: "Rothenfels", committee: "Bauausschuss", status: "ok", title: "Sanierung der Hauptstraße, 2. Bauabschnitt" },
    benefits: [
      ["clipboardList", "Projekte vor der Vergabe", "Sanierungs- und Ausbauvorhaben sehen, lange bevor ausgeschrieben wird."],
      ["road", "Bauprogramme der Region", "Straßen, Radwege und ÖPNV-Ausbau mehrerer Kommunen auf einen Blick."],
      ["handshake", "Früh Kontakt aufnehmen", "Mit Planungsämtern sprechen, solange das Projekt noch Form annimmt."],
    ],
    flowTitle: "Vom Antrag bis zur Baustelle",
    steps: [["megaphone", "Antrag"], ["users", "Verkehrsausschuss"], ["circleCheck", "Beschluss"], ["calendar", "Planung"], ["road", "Umsetzung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen Sanierungs- und Ausbauvorhaben, sobald sie im Ausschuss beraten werden, lange bevor ausgeschrieben wird.",
    stat: ["410", "Beschlüsse zu Straßen, Radwegen und ÖPNV im letzten Monat"],
    watch: ["Straßensanierung", "Parkraum", "ÖPNV", "Radwege und Verkehrsschauen"],
    closing: "Ihr nächstes Projekt steht schon im Ausschuss.",
    keywords: ["Straßensanierung", "Radwegekonzept", "ÖPNV", "Parkraumbewirtschaftung", "Verkehrsentwicklungsplan"],
  },
  {
    slug: "umwelt",
    name: "Umwelt & Flächennutzung",
    icon: "tree",
    title: "Gutachtenbedarf erkennen, bevor andere ihn sehen.",
    intro: "Jeder Plan braucht Gutachten, jeder Eingriff einen Ausgleich. Hier sehen Sie, wo der Bedarf entsteht.",
    audience: "Gutachter, Landschaftsplaner, Umweltbüros",
    example: { place: "Eichwalde-Süd", committee: "Umweltausschuss", status: "ok", title: "Ausgleichsmaßnahmen zum Bebauungsplan Nr. 22" },
    benefits: [
      ["search", "Gutachtenbedarf erkennen", "Sehen, wo neue Pläne Umweltberichte und Artenschutzgutachten brauchen."],
      ["map", "Ausgleichsflächen finden", "Beschlossene Ausgleichsmaßnahmen, für die noch Planer gesucht werden."],
      ["calendar", "Fristen sicher einhalten", "Beteiligungsphasen rechtzeitig kennen und Stellungnahmen einreichen."],
    ],
    flowTitle: "Vom Planentwurf bis zur Ausgleichsfläche",
    steps: [["map", "Planentwurf"], ["fileText", "Beteiligung"], ["circleCheck", "Beschluss"], ["map", "Ausgleich"], ["clipboardList", "Umsetzung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen, wo Gutachten und Ausgleichsflächen gebraucht werden, solange der Plan noch im Entwurf ist.",
    stat: ["135", "Landschaftspläne und Ausgleichsbeschlüsse im letzten Monat"],
    watch: ["Landschafts- und Grünordnungspläne", "Baumschutzsatzungen", "Immissionsschutz", "Ausgleichsmaßnahmen"],
    closing: "Der nächste Plan braucht schon ein Gutachten.",
    keywords: ["Ausgleichsmaßnahme", "Umweltbericht", "Artenschutzgutachten", "Landschaftsplan", "Grünordnungsplan"],
  },
  {
    slug: "medien",
    name: "Medien & Journalismus",
    icon: "newspaper",
    title: "Die Geschichte finden, bevor es andere tun.",
    intro: "Wichtige Themen stehen oft Wochen vor der Sitzung auf der Tagesordnung. Nur liest sie niemand.",
    audience: "Lokaljournalisten, Redakteure",
    example: { place: "Lindenau", committee: "Hauptausschuss", status: "wait", title: "Beschlussvorlage: Gutachten zur Zukunft des Hallenbads" },
    benefits: [
      ["eye", "Die Geschichte zuerst", "Vorlagen lesen, bevor die Sitzung stattfindet und andere berichten."],
      ["clock", "Ihre Wochenvorschau", "Montags wissen, was in Ihren Kommunen auf der Tagesordnung steht."],
      ["layers", "Vergleichen statt suchen", "Ähnliche Beschlüsse in Nachbarkommunen gegenüberstellen."],
    ],
    flowTitle: "Von der Vorlage bis zur Schlagzeile",
    steps: [["fileText", "Beschlussvorlage"], ["calendar", "Tagesordnung"], ["users", "Sitzung"], ["circleCheck", "Beschluss"], ["newspaper", "Berichterstattung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen ein Thema, sobald die Vorlage veröffentlicht ist, und können recherchieren, bevor die Sitzung stattfindet.",
    stat: ["9.400", "neue Beschlussvorlagen im letzten Monat"],
    watch: ["Beschlussvorlagen", "Tagesordnungen", "Fördergelder", "Haushalte"],
    closing: "Die nächste Geschichte steht schon in einer Vorlage.",
    keywords: ["Beschlussvorlage", "Tagesordnung", "Zuschuss", "Gutachten", "Haushalt"],
  },
  {
    slug: "vereine",
    name: "Vereine & soziale Träger",
    icon: "users",
    title: "Förderung sichern, bevor der Haushalt steht.",
    intro: "Zuschüsse, Hallenzeiten, Förderrichtlinien: Was der Rat beschließt, entscheidet über Ihre Arbeit vor Ort.",
    audience: "Vereine, soziale Träger, Kultur- und Bildungseinrichtungen",
    example: { place: "Ahrenstedt", committee: "Stadtrat", status: "ok", title: "Haushaltsplan 2027: Zuschüsse für Sport- und Kulturvereine" },
    benefits: [
      ["euro", "Förderung sichern", "Sehen, ob Ihr Zuschuss im Haushaltsentwurf steht oder gekürzt wird."],
      ["users", "Vorbereitet mitreden", "Vor der Ausschusssitzung wissen, was beraten wird."],
      ["fileText", "Richtlinien schnell finden", "Aktuelle Förder- und Gebührenordnungen ohne langes Suchen."],
    ],
    flowTitle: "Vom Förderantrag bis zum Geld im Verein",
    steps: [["megaphone", "Antrag"], ["fileText", "Haushaltsentwurf"], ["users", "Fachausschuss"], ["circleCheck", "Haushaltsbeschluss"], ["euro", "Auszahlung"]],
    reported: [1, 2, 3],
    advantage: "Sie sehen, ob Ihr Zuschuss im Haushaltsentwurf steht, und können reagieren, bevor er beschlossen ist.",
    stat: ["870", "Haushalts- und Förderbeschlüsse im letzten Monat"],
    watch: ["Haushaltspläne", "Kitas und Schulen", "Sport und Kultur", "Investitionsprogramme"],
    closing: "Ihr Zuschuss wird gerade beraten.",
    keywords: ["Haushaltsplan", "Kita-Gebühren", "Schulentwicklungsplanung", "Sportförderung", "Investitionsprogramm"],
  },
];

/* TODO: „< 24 Std.“ ist ein Beispielwert (Doku Kap. 8) */
export const NOTIFY_STAT: [string, string] = ["< 24 Std.", "von der Veröffentlichung bis zu Ihrer Benachrichtigung"];

export interface Qa {
  q: string;
  /** null: Antworttext liegt nur im Prototyp (Ratsmonitor-Unterseiten.html) vor */
  a: string | null;
}

/* TODO: Antworten außer zur ersten Frage aus Ratsmonitor-Unterseiten.html übernehmen (im PDF nicht abgebildet) */
export const FAQ: { group: string; items: Qa[] }[] = [
  {
    group: "Grundlagen",
    items: [
      {
        q: "Was ist Ratsmonitor?",
        a: "Ratsmonitor bündelt die Ratsinformationssysteme aller Kommunen in Deutschland in einer Suche. Vorlagen, Tagesordnungen und Beschlüsse finden Sie an einem Ort, jeweils mit Kommune, Gremium, Datum und Link zum Originaldokument.",
      },
      { q: "Wie aktuell sind die Daten?", a: null },
      { q: "Wie finde ich gezielt Dokumente aus meiner Heimatstadt oder Region?", a: null },
      { q: "Wie formuliere ich Suchanfragen am besten (z. B. für Bebauungspläne oder Satzungen)?", a: null },
    ],
  },
  {
    group: "Alarme und Tarife",
    items: [
      { q: "Wie funktionieren die Benachrichtigungen und E-Mail-Alarme?", a: null },
      { q: "Was ist der Unterschied zwischen gespeicherter Suche und Bookmark?", a: null },
      { q: "Kann ich meinen Tarif wechseln oder kündigen?", a: null },
    ],
  },
  {
    group: "Für Unternehmen und Organisationen",
    items: [
      { q: "Kann ich Ratsmonitor im Team nutzen?", a: null },
      { q: "Erhalte ich eine Rechnung für mein Unternehmen?", a: null },
      { q: "Kann ich mehrere Regionen oder Themen beobachten?", a: null },
      { q: "Was unterscheidet Ratsmonitor von Vergabeportalen?", a: null },
    ],
  },
];

/* TODO: Antworten aus Ratsmonitor-Unterseiten.html übernehmen (im PDF nicht abgebildet) */
export const PRICE_FAQ: Qa[] = [
  { q: "Gibt es eine Mindestlaufzeit?", a: null },
  { q: "Brauche ich für Free Zahlungsdaten?", a: null },
  { q: "Sind die Preise inklusive Mehrwertsteuer?", a: null },
  { q: "Kann ich später upgraden?", a: null },
];

export type PlanId = "free" | "pro" | "enterprise";
/** Text mit **fett** markierten Stellen */
export type Rich = string;
export interface Plan {
  id: PlanId;
  name: string;
  desc: string;
  amount: string;
  unit: string;
  note: string;
  short: string;
  items: [IconName, Rich][];
  features: { plus?: boolean; text: Rich }[];
  cta: string;
  submit: string;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    desc: "Zum Ausprobieren und für gelegentliche Recherchen.",
    amount: "0 €",
    unit: "dauerhaft kostenlos",
    note: "Ohne Zahlungsdaten, jederzeit nutzbar",
    short: "0 €",
    items: [["map", "Suche in ganz Deutschland"], ["user", "Keine E-Mail-Benachrichtigungen"]],
    features: [
      { text: "Suche in allen Ratsinformationssystemen" },
      { text: "Filter nach Gebiet, Thema und Zeitraum" },
      { text: "Kartenansicht der Treffer" },
      { text: "**1** gespeicherte Suche" },
      { text: "**1** Bookmark" },
    ],
    cta: "Kostenlos registrieren",
    submit: "Kostenlos registrieren",
  },
  {
    id: "pro",
    name: "Pro",
    desc: "Für alle, die ihre Themen und Gebiete regelmäßig beobachten.",
    amount: "9,99 €",
    unit: "pro Monat",
    note: "inkl. MwSt.",
    short: "9,99 € / Monat",
    items: [["map", "Suche in ganz Deutschland"], ["user", "E-Mail-Benachrichtigungen an Ihre Adresse"]],
    features: [
      { plus: true, text: "**Alles aus Free**, zusätzlich:" },
      { text: "Bis zu **5** gespeicherte Suchen" },
      { text: "Bis zu **5** Bookmarks" },
      { text: "**E-Mail-Benachrichtigung** bei neuen Treffern" },
    ],
    cta: "Pro wählen",
    submit: "Pro starten",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    desc: "Für Organisationen, in denen mehrere Personen informiert werden sollen.",
    amount: "49,99 €",
    unit: "pro Monat",
    note: "inkl. MwSt.",
    short: "49,99 € / Monat",
    items: [["map", "Suche in ganz Deutschland"], ["user", "Ihre Adresse + bis zu 5 weitere Empfänger"]],
    features: [
      { plus: true, text: "**Alles aus Pro**, zusätzlich:" },
      { text: "Benachrichtigungen an **bis zu 5 Kolleginnen und Kollegen**" },
    ],
    cta: "Enterprise wählen",
    submit: "Enterprise starten",
  },
];

export const COMPARE: [string, string, string, string][] = [
  ["Ratsinformationssysteme durchsuchen", "✓", "✓", "✓"],
  ["Gespeicherte Suchen", "1", "5", "5"],
  ["Bookmarks (gespeicherte Artikel)", "1", "5", "5"],
  ["E-Mail-Benachrichtigungen", "–", "✓", "✓"],
  ["Weitere Empfänger der Benachrichtigungen (z. B. Kollegen)", "–", "–", "bis zu 5"],
];

export const AGB_SECTIONS = [
  "Geltungsbereich",
  "Vertragsschluss und Registrierung",
  "Leistungen der Tarife Free, Pro und Enterprise",
  "Preise und Zahlung",
  "Laufzeit und Kündigung",
  "Haftung",
  "Schlussbestimmungen",
];

export const brancheBySlug = (slug: string) => BRANCHEN.find((b) => b.slug === slug);
