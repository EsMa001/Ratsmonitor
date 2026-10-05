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
  /** [Icon, Titel, Text, Suchbegriff passend zur Kachel] */
  benefits: [IconName, string, string, string][];
  flowTitle: string;
  steps: [IconName, string][];
  /** Schritte, zu denen die Kommune Dokumente veröffentlicht („Ratsmonitor meldet“) */
  reported: number[];
  advantage: string;
  /* TODO: Kennzahl ist ein Beispielwert (Doku Kap. 8) – durch echte Werte aus dem Backend ersetzen */
  stat: [string, string];
  watch: string[];
  /** Anwendungsfall je Thema aus „watch“ (gleiche Reihenfolge) */
  useCases?: string[];
  /** Symbol je Thema aus „watch“ (gleiche Reihenfolge) */
  watchIcons?: IconName[];
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
      ["eye", "Flächen sehen, bevor sie am Markt sind", "Aufstellungsbeschlüsse zeigen neues Bauland oft Jahre vor dem ersten Exposé.", "Aufstellungsbeschluss"],
      ["shieldCheck", "Risiken vor dem Kauf erkennen", "Veränderungssperren, Auflagen und Widerstände kennen, bevor Sie investieren.", "Veränderungssperre"],
      ["handshake", "Früh am Tisch sitzen", "Mit Verwaltung und Politik sprechen, solange der Plan noch gestaltbar ist.", "Bebauungsplan Entwurf"],
    ],
    flowTitle: "Vom Aufstellungsbeschluss bis zum Baubeginn",
    steps: [["users", "Aufstellungsbeschluss"], ["map", "Frühzeitige Beteiligung"], ["fileText", "Offenlegung"], ["circleCheck", "Satzungsbeschluss"], ["house", "Baugenehmigung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie erfahren von einer Fläche, wenn sie zum ersten Mal in einem Gremium auftaucht, oft Jahre vor dem Baubeginn.",
    stat: ["312", "neue Aufstellungsbeschlüsse im letzten Monat"],
    watch: ["Aufstellungsbeschlüsse", "Offenlegungen", "Veränderungssperren", "Städtebauliche Verträge", "Bebauungspläne", "Grundstücksverkäufe"],
    useCases: ["Sie erfahren, dass eine Kommune ein neues Baugebiet plant, Monate bevor die Flächen auf den Markt kommen, und können früh Kontakt zu Eigentümern und Verwaltung aufnehmen.", "Sie sehen, wann Planentwürfe öffentlich ausliegen, und können Fristen für Stellungnahmen und Einwendungen rechtzeitig einplanen.", "Sie erkennen Risiken vor einem Grundstückskauf: Eine Veränderungssperre kann Bauanträge in einem Gebiet für Jahre blockieren.", "Sie sehen, welche Kosten und Pflichten Kommunen Vorhabenträgern auferlegen, etwa für Erschließung, Kitas oder Sozialwohnungen.", "Sie verfolgen jeden Plan vom ersten Entwurf bis zur Satzung und wissen, was auf einer Fläche künftig erlaubt ist.", "Sie erfahren, wenn Kommunen eigene Grundstücke verkaufen oder in Erbpacht vergeben, oft mit Bewerbungsfrist."],
    watchIcons: ["fileText", "eye", "shieldCheck", "handshake", "map", "house"],
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
      ["target", "Keine Konzession verpassen", "Auslaufende Strom- und Gasverträge in Ihrem Gebiet werden Ihnen automatisch gemeldet.", "Energieversorgung"],
      ["map", "Wärmenetze vorausplanen", "Sehen, wo Kommunen Fernwärme vorsehen und wo nicht.", "Wärmeplanung"],
      ["trendingUp", "Den Markt im Blick", "Entscheidungen von Stadtwerken und Nachbarkommunen verfolgen.", "Stadtwerke"],
    ],
    flowTitle: "Von der Wärmeplanung bis zur Konzession",
    steps: [["map", "Wärmeplanung"], ["users", "Beratung im Rat"], ["calendar", "Konzession läuft aus"], ["clipboardList", "Vergabeverfahren"], ["zap", "Netzbetrieb"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen das Auslaufen einer Konzession, wenn es im Hauptausschuss angekündigt wird, und haben Zeit für ein Angebot.",
    stat: ["148", "Beschlüsse zu Wärmeplanung und Konzessionen im letzten Monat"],
    watch: ["Wärmeplanung", "Konzessionsverträge", "Netzausbau", "Städtische Beteiligungen", "Photovoltaik und Windkraft", "Förderprogramme"],
    useCases: ["Sie erfahren, wo Kommunen Wärmenetze vorsehen und wo nicht, und können Angebote, Netzausbau und Kundenberatung danach ausrichten.", "Sie sehen, wann Strom- und Gaskonzessionen auslaufen und neu vergeben werden, und können sich rechtzeitig bewerben.", "Sie verfolgen Beschlüsse zu Leitungen, Umspannwerken und Ladeinfrastruktur und erkennen frühzeitig Bedarf und Partner vor Ort.", "Sie sehen, wenn Kommunen Anteile an Stadtwerken kaufen oder verkaufen oder neue Gesellschaften gründen, und damit, wo sich Kooperationen ergeben.", "Sie sehen, wo Kommunen Flächen für Solar- und Windparks ausweisen oder eigene Anlagen planen.", "Sie erfahren, welche Klimaschutz- und Energieförderungen Kommunen beantragen und wo daraus Aufträge entstehen."],
    watchIcons: ["zap", "handshake", "layers", "landmark", "target", "euro"],
    closing: "Die nächste Konzession wird gerade beraten.",
    keywords: ["Wärmeplanung", "Konzessionsvertrag", "Fernwärme", "Stadtwerke", "Netzausbau"],
  },
  {
    slug: "entsorgung-und-wasser",
    name: "Entsorgung und Wasser",
    icon: "droplet",
    title: "Aufträge kennen, bevor sie ausgeschrieben sind.",
    intro: "Entsorgungsverträge, neue Anlagen, Sanierungen: In den Räten entscheidet sich, wer die nächsten Aufträge bekommt.",
    audience: "Entsorgungsunternehmen, Recyclingbetriebe, Ingenieurbüros",
    example: { place: "Ahrenstedt", committee: "Umweltausschuss", status: "ok", title: "Neuvergabe der Abfallsammlung und -beförderung ab 2028" },
    benefits: [
      ["clipboardList", "Aufträge vor der Ausschreibung", "Auslaufende Entsorgungsverträge und Investitionen kennen, bevor sie vergeben werden.", "Entsorgung"],
      ["droplet", "Die Infrastruktur-Pipeline", "Kläranlagen, Kanalnetze und Wertstoffhöfe bundesweit an einem Ort.", "Kläranlage"],
      ["trendingUp", "Den Markt im Blick", "Sehen, welche Kommunen umstellen, rekommunalisieren oder neu ausschreiben.", "Abfallwirtschaft"],
    ],
    flowTitle: "Vom Konzept bis zum neuen Auftrag",
    steps: [["fileText", "Abfallwirtschaftskonzept"], ["users", "Fachausschuss"], ["circleCheck", "Ratsbeschluss"], ["clipboardList", "Vergabebeschluss"], ["house", "Leistungsbeginn"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie erfahren von auslaufenden Verträgen und neuen Anlagen, sobald sie im Ausschuss beraten werden, Monate vor der Ausschreibung.",
    stat: ["226", "Beschlüsse zu Entsorgung und Vergaben im letzten Monat"],
    watch: ["Entsorgungsverträge", "Abfallwirtschaftskonzepte", "Anlagen und Wertstoffhöfe", "Kläranlagen und Kanalnetz", "Gebührensatzungen", "Straßenreinigung und Winterdienst"],
    useCases: ["Sie erfahren, wann Verträge für Abfallsammlung oder Verwertung auslaufen, und können sich auf die kommende Ausschreibung vorbereiten.", "Sie sehen, wie Kommunen ihre Abfallwirtschaft neu ordnen, etwa mit neuen Tonnen, Gebühren oder Sammelsystemen, und welche Leistungen künftig gebraucht werden.", "Sie erkennen Neubau, Erweiterung oder Schließung von Anlagen und Wertstoffhöfen und damit Bedarf an Bau, Technik und Betrieb.", "Sie verfolgen Sanierungs- und Investitionsbeschlüsse für Abwasseranlagen und erkennen Projekte lange vor der Vergabe.", "Sie sehen, wie sich Müll- und Abwassergebühren entwickeln, und erkennen daraus Kosten- und Leistungsänderungen.", "Sie verfolgen Neuvergaben und Änderungen bei Reinigung und Winterdienst, die häufig ausgeschrieben werden."],
    watchIcons: ["clipboardList", "layers", "house", "droplet", "euro", "road"],
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
      ["megaphone", "Mitreden, solange beraten wird", "Stellung nehmen, bevor der Rat über Hebesätze und Flächen entscheidet.", "Hebesatz"],
      ["euro", "Kosten früh kalkulieren", "Steuer- und Gebührenänderungen in die Planung einbeziehen, bevor sie gelten.", "Gebührensatzung"],
      ["users", "Mitglieder informieren", "Verbände geben relevante Beschlüsse direkt an ihre Mitglieder weiter.", "Gewerbegebiet"],
    ],
    flowTitle: "Vom Haushaltsentwurf bis zum Steuerbescheid",
    steps: [["fileText", "Haushaltsentwurf"], ["users", "Finanzausschuss"], ["circleCheck", "Haushaltsbeschluss"], ["clipboardList", "Vergaben"], ["euro", "Bescheid"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen geplante Hebesatz-Erhöhungen schon im Haushaltsentwurf, bevor der Rat entscheidet.",
    stat: ["540", "Haushalts- und Vergabebeschlüsse im letzten Monat"],
    watch: ["Ausschreibungen", "Hebesätze", "Gewerbeflächen", "Sondernutzung und Märkte", "Wirtschaftsförderung", "Innenstadtentwicklung"],
    useCases: ["Sie sehen, welche Aufträge eine Kommune plant, schon wenn der Rat das Projekt beschließt, nicht erst, wenn es im Vergabeportal steht.", "Sie erfahren früh, wenn Gewerbe- oder Grundsteuer steigen sollen, und können sich vor der Entscheidung einbringen.", "Sie sehen, wo neue Gewerbegebiete entstehen oder Flächen vergeben werden, und können Standortentscheidungen früher treffen.", "Sie verfolgen Regeln und Gebühren für Außengastronomie, Wochenmärkte und Veranstaltungen im öffentlichen Raum.", "Sie erfahren von Förderprogrammen, Gründerzentren und Ansiedlungsprojekten, bevor sie öffentlich beworben werden.", "Sie sehen Pläne für Leerstände, Fußgängerzonen und Citymanagement, die Lage und Frequenz Ihres Standorts verändern."],
    watchIcons: ["clipboardList", "euro", "briefcase", "tag", "trendingUp", "landmark"],
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
      ["clipboardList", "Projekte vor der Vergabe", "Sanierungs- und Ausbauvorhaben sehen, lange bevor ausgeschrieben wird.", "Straßensanierung"],
      ["road", "Bauprogramme der Region", "Straßen, Radwege und ÖPNV-Ausbau mehrerer Kommunen auf einen Blick.", "Radverkehr"],
      ["handshake", "Früh Kontakt aufnehmen", "Mit Planungsämtern sprechen, solange das Projekt noch Form annimmt.", "Verkehrsentwicklungsplan"],
    ],
    flowTitle: "Vom Antrag bis zur Baustelle",
    steps: [["megaphone", "Antrag"], ["users", "Verkehrsausschuss"], ["circleCheck", "Beschluss"], ["calendar", "Planung"], ["road", "Umsetzung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen Sanierungs- und Ausbauvorhaben, sobald sie im Ausschuss beraten werden, lange bevor ausgeschrieben wird.",
    stat: ["410", "Beschlüsse zu Straßen, Radwegen und ÖPNV im letzten Monat"],
    watch: ["Straßensanierung", "Parkraum", "ÖPNV", "Radwege und Verkehrsschauen", "Baustellen und Sperrungen", "Ladeinfrastruktur"],
    useCases: ["Sie sehen, welche Straßen in den nächsten Jahren saniert werden, für Planung, Angebote oder um Anlieger rechtzeitig zu informieren.", "Sie erfahren, wo Parkgebühren, Anwohnerparken oder Parkhäuser geplant sind, und welche Auswirkungen das auf Kunden und Mitarbeitende hat.", "Sie verfolgen Nahverkehrspläne, neue Linien und Taktänderungen und erkennen, wie sich die Erreichbarkeit von Standorten verändert.", "Sie sehen geplante Radwege, Tempo-30-Zonen und Ergebnisse von Verkehrsschauen, bevor sie umgesetzt werden.", "Sie erfahren früh von größeren Baumaßnahmen und Sperrungen, die Lieferwege, Kunden oder Einsätze betreffen.", "Sie sehen, wo Ladesäulen und Mobilitätsstationen geplant werden, als Auftrag oder Standortfaktor."],
    watchIcons: ["road", "mapPin", "bus", "target", "clock", "zap"],
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
      ["search", "Gutachtenbedarf erkennen", "Sehen, wo neue Pläne Umweltberichte und Artenschutzgutachten brauchen.", "Umweltbericht"],
      ["map", "Ausgleichsflächen finden", "Beschlossene Ausgleichsmaßnahmen, für die noch Planer gesucht werden.", "Ausgleich"],
      ["calendar", "Fristen sicher einhalten", "Beteiligungsphasen rechtzeitig kennen und Stellungnahmen einreichen.", "Öffentliche Auslegung"],
    ],
    flowTitle: "Vom Planentwurf bis zur Ausgleichsfläche",
    steps: [["map", "Planentwurf"], ["fileText", "Beteiligung"], ["circleCheck", "Beschluss"], ["map", "Ausgleich"], ["clipboardList", "Umsetzung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen, wo Gutachten und Ausgleichsflächen gebraucht werden, solange der Plan noch im Entwurf ist.",
    stat: ["135", "Landschaftspläne und Ausgleichsbeschlüsse im letzten Monat"],
    watch: ["Landschafts- und Grünordnungspläne", "Baumschutzsatzungen", "Immissionsschutz", "Ausgleichsmaßnahmen", "Gewässer und Hochwasserschutz", "Klimaanpassung"],
    useCases: ["Sie erkennen, wo Flächen geschützt, aufgewertet oder für Bebauung geöffnet werden sollen.", "Sie erfahren, wenn Kommunen Regeln zu Baumfällungen einführen oder ändern, wichtig für Bauvorhaben und Grundstückspflege.", "Sie verfolgen Beratungen zu Lärm, Geruch und Luftqualität, etwa bei Gewerbe, Verkehr oder Windkraft.", "Sie sehen, wo Ausgleichsflächen für Eingriffe in die Natur geplant werden, als Auftrag, Flächenangebot oder Planungsgrundlage.", "Sie verfolgen Renaturierungen, Deichbau und Starkregenvorsorge, als Planungsgrundlage oder Auftrag.", "Sie sehen Hitzeaktionspläne, Entsiegelung und Begrünung, die Kommunen beschließen und finanzieren."],
    watchIcons: ["map", "tree", "megaphone", "layers", "droplet", "shieldCheck"],
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
      ["eye", "Die Geschichte zuerst", "Vorlagen lesen, bevor die Sitzung stattfindet und andere berichten.", "Beschlussvorlage"],
      ["clock", "Ihre Wochenvorschau", "Montags wissen, was in Ihren Kommunen auf der Tagesordnung steht.", "Tagesordnung"],
      ["layers", "Vergleichen statt suchen", "Ähnliche Beschlüsse in Nachbarkommunen gegenüberstellen.", "Haushalt"],
    ],
    flowTitle: "Von der Vorlage bis zur Schlagzeile",
    steps: [["fileText", "Beschlussvorlage"], ["calendar", "Tagesordnung"], ["users", "Sitzung"], ["circleCheck", "Beschluss"], ["newspaper", "Berichterstattung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen ein Thema, sobald die Vorlage veröffentlicht ist, und können recherchieren, bevor die Sitzung stattfindet.",
    stat: ["9.400", "neue Beschlussvorlagen im letzten Monat"],
    watch: ["Beschlussvorlagen", "Tagesordnungen", "Fördergelder", "Haushalte", "Anfragen und Anträge", "Personalien"],
    useCases: ["Sie finden Vorlagen zu jedem Thema, bevor im Rat abgestimmt wird, und haben Zeit für Recherche, Nachfragen und Berichterstattung.", "Sie sehen auf einen Blick, was in den nächsten Sitzungen von Rat und Ausschüssen verhandelt wird, und können Termine planen.", "Sie verfolgen, welche Förderprogramme Kommunen beantragen oder vergeben und wofür das Geld eingesetzt wird.", "Sie erkennen Schwerpunkte, Kürzungen und Investitionen im kommunalen Haushalt und können sie über Jahre vergleichen.", "Sie sehen, welche Fragen Fraktionen stellen und welche Anträge sie einbringen, oft der Anfang einer Debatte.", "Sie erfahren von Wahlen, Besetzungen und Wechseln in Verwaltung, Aufsichtsräten und Gremien."],
    watchIcons: ["fileText", "calendar", "euro", "newspaper", "megaphone", "users"],
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
      ["euro", "Förderung sichern", "Sehen, ob Ihr Zuschuss im Haushaltsentwurf steht oder gekürzt wird.", "Zuschuss"],
      ["users", "Vorbereitet mitreden", "Vor der Ausschusssitzung wissen, was beraten wird.", "Jugendhilfeausschuss"],
      ["fileText", "Richtlinien schnell finden", "Aktuelle Förder- und Gebührenordnungen ohne langes Suchen.", "Förderrichtlinie"],
    ],
    flowTitle: "Vom Förderantrag bis zum Geld im Verein",
    steps: [["megaphone", "Antrag"], ["fileText", "Haushaltsentwurf"], ["users", "Fachausschuss"], ["circleCheck", "Haushaltsbeschluss"], ["euro", "Auszahlung"]],
    reported: [1, 2, 3],
    advantage: "Sie sehen, ob Ihr Zuschuss im Haushaltsentwurf steht, und können reagieren, bevor er beschlossen ist.",
    stat: ["870", "Haushalts- und Förderbeschlüsse im letzten Monat"],
    watch: ["Haushaltspläne", "Kitas und Schulen", "Sport und Kultur", "Investitionsprogramme", "Ehrenamt und Förderrichtlinien", "Bürgerbeteiligung"],
    useCases: ["Sie sehen früh, wo Zuschüsse gekürzt oder erhöht werden sollen, und können sich einbringen, bevor der Haushalt beschlossen ist.", "Sie verfolgen Bedarfspläne, Neubauten, Trägerwechsel und Betreuungsangebote in Ihrer Kommune.", "Sie erfahren von Hallennutzung, Sanierungen, Zuschüssen und Veranstaltungen, die Ihren Verein oder Ihre Einrichtung betreffen.", "Sie sehen, welche Projekte die Kommune in den nächsten Jahren finanzieren will, und wo sich Ihr Vorhaben einordnen lässt.", "Sie erkennen Änderungen an Zuschussregeln und Förderprogrammen für Ehrenamt, Vereine und Initiativen.", "Sie erfahren, wann Kommunen Beteiligungsverfahren starten, und können sich mit Ihrem Anliegen einbringen."],
    watchIcons: ["euro", "house", "users", "trendingUp", "handshake", "megaphone"],
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

export const FAQ: { group: string; items: Qa[] }[] = [
  {
    group: "Grundlagen",
    items: [
      {
        q: "Was ist Ratsmonitor?",
        a: "Ratsmonitor bündelt die Ratsinformationssysteme der Kommunen in einer Suche. Vorlagen, Tagesordnungen und Beschlüsse finden Sie an einem Ort, jeweils mit Kommune, Gremium, Datum und Link zu den Originalunterlagen. Die Abdeckung wird laufend auf ganz Deutschland ausgebaut.",
      },
      { q: "Wie aktuell sind die Daten?", a: "Die Daten werden regelmäßig direkt aus den offiziellen Ratsinformationssystemen abgerufen. Den genauen Stand sehen Sie in der Suche neben der Trefferzahl („Datenstand“ mit Datum und Uhrzeit). Welche Kommunen erfasst sind und wo es Lücken gibt, steht unter „Datenabdeckung“." },
      { q: "Wie finde ich gezielt Dokumente aus meiner Heimatstadt oder Region?", a: "Tippen Sie den Ortsnamen, den Kreis oder eine Region wie „Münsterland“ ins Suchfeld. In den Vorschlägen wählen Sie, ob nur die Gemeinde oder auch der Kreis durchsucht wird. Im Filter beziehen Sie mit dem Umkreis Nachbarorte ein." },
      { q: "Wie formuliere ich Suchanfragen am besten (z. B. für Bebauungspläne oder Satzungen)?", a: "Verwenden Sie Fachbegriffe, wie sie in Vorlagen stehen, z. B. „Bebauungsplan“, „Aufstellungsbeschluss“ oder „Satzung“. Mehrere Begriffe trennen Sie mit Komma, dann genügt einer davon (z. B. „Windenergie, Photovoltaik“). Mit den Filtern grenzen Sie nach Thema, Zeitraum und Status ein." },
    ],
  },
  {
    group: "Alarme und Tarife",
    items: [
      { q: "Wie funktionieren die Benachrichtigungen und E-Mail-Alarme?", a: "Speichern Sie eine Suche mit dem Herz neben dem Suchfeld. Unter „Gespeicherte Suchen“ schalten Sie für jede Suche E-Mail-Benachrichtigungen ein und wählen, ob Sie sofort, täglich oder wöchentlich informiert werden." },
      { q: "Was ist der Unterschied zwischen gespeicherter Suche und Bookmark?", a: "Eine gespeicherte Suche beobachtet ein Thema oder Gebiet und meldet neue Treffer. Ein Bookmark (gespeicherter Artikel) merkt sich einen einzelnen Vorgang; mit der Glocke werden Sie informiert, wenn er weiter beraten oder beschlossen wird." },
      { q: "Kann ich meinen Tarif wechseln oder kündigen?", a: "Ja. Sie können jederzeit auf einen höheren Tarif wechseln. Kostenpflichtige Tarife sind jederzeit kündbar, eine Mindestlaufzeit gibt es nicht." },
    ],
  },
  {
    group: "Für Unternehmen und Organisationen",
    items: [
      { q: "Kann ich Ratsmonitor im Team nutzen?", a: "Ja. Im Tarif Enterprise gehen Benachrichtigungen an bis zu fünf E-Mail-Adressen oder Verteiler je gespeicherter Suche, etwa an Kolleginnen und Kollegen oder ein Team-Postfach." },
      { q: "Erhalte ich eine Rechnung für mein Unternehmen?", a: "Für Unternehmen und Organisationen stimmen wir Abrechnung und Rechnungsstellung gern individuell ab. Sprechen Sie uns dazu über die Kontaktseite an." },
      { q: "Kann ich mehrere Regionen oder Themen beobachten?", a: "Ja. Legen Sie für jede Region oder jedes Thema eine eigene gespeicherte Suche an. In einer Suche können Sie außerdem mehrere Orte und mehrere Begriffe kombinieren. Wie viele Suchen Sie speichern können, hängt vom Tarif ab." },
      { q: "Was unterscheidet Ratsmonitor von Vergabeportalen?", a: "Vergabeportale zeigen Ausschreibungen, also das Ende eines Prozesses. Ratsmonitor zeigt, was davor in Räten und Ausschüssen beraten und beschlossen wird. So sehen Sie Projekte, bevor sie ausgeschrieben werden." },
    ],
  },
];

export const PRICE_FAQ: Qa[] = [
  { q: "Gibt es eine Mindestlaufzeit?", a: "Nein. Kostenpflichtige Tarife sind jederzeit kündbar." },
  { q: "Brauche ich für Basic Zahlungsdaten?", a: "Nein. Basic ist kostenlos und ohne Zahlungsdaten nutzbar." },
  { q: "Sind die Preise inklusive Mehrwertsteuer?", a: "Ja, alle angegebenen Preise verstehen sich inklusive Mehrwertsteuer." },
  { q: "Kann ich später upgraden?", a: "Ja, ein Wechsel auf einen höheren Tarif ist jederzeit möglich. Ihre gespeicherten Suchen und Artikel bleiben dabei erhalten." },
  { q: "Wie viele Suchen und Artikel kann ich speichern?", a: "Mit Basic eine Suche, einen Artikel und eine Benachrichtigung. Mit Pro und Enterprise jeweils bis zu 100 gespeicherte Suchen, bis zu 100 gespeicherte Artikel und bis zu 100 aktive Benachrichtigungen." },
  { q: "Welcher Tarif enthält den Sitzungskalender?", a: "Der Sitzungskalender mit Kalender-Abo ist nur im Tarif Enterprise enthalten. Er zeigt die Termine Ihrer Gebiete, auch mit Umkreis, und lässt sich in Apple Kalender, Outlook oder Google Kalender übernehmen." },
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
    name: "Basic",
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
      { text: "**1** gespeicherter Artikel" },
      { text: "**1** aktive Benachrichtigung" },
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
      { plus: true, text: "**Alles aus Basic**, zusätzlich:" },
      { text: "Bis zu **100** Suchen speichern" },
      { text: "Bis zu **100** Artikel speichern" },
      { text: "Bis zu **100** E-Mail-Benachrichtigungen" },
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
      { text: "**Sitzungskalender** für Ihre Gebiete, auch mit Umkreis" },
      { text: "Benachrichtigungen an **bis zu 5 Kolleginnen und Kollegen**" },
    ],
    cta: "Enterprise wählen",
    submit: "Enterprise starten",
  },
];

export const AGB_SECTIONS = [
  "Geltungsbereich",
  "Vertragsschluss und Registrierung",
  "Leistungen der Tarife Basic, Pro und Enterprise",
  "Preise und Zahlung",
  "Laufzeit und Kündigung",
  "Haftung",
  "Schlussbestimmungen",
];

export const brancheBySlug = (slug: string) => BRANCHEN.find((b) => b.slug === slug);
