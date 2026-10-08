/* Texte des Dreistrichmenüs und der Infoseiten, übernommen aus der Übergabe-Dokumentation
   (Ratsmonitor-Dokumentation-Menue.pdf, Stand Oktober 2026). */
import type { IconName } from "./icons";

export type Status = "ok" | "wait";
export interface Example {
  place: string;
  committee: string;
  status: Status;
  /** Statuswort wie im Bestand, z. B. „In Beratung“ */
  statusText?: string;
  /** Link zum Artikel (/beschluss/…) */
  href?: string;
  /** Statusschlüssel wie in der Startseite (announced, consulting, unknown, approved …) */
  statusId?: string;
  /** Verlauf wie in der Startseite: Datum (ISO), Gremium, Status */
  steps?: { d: string; c: string; s: string }[];
  /** Datum wie auf der Startseite: Tag, Monat, Jahr */
  datum?: [string, string, string];
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
  /** Rollen der Seite mit Icon (nur bei Anwenderseiten) */
  rollen?: { name: string; icon: IconName }[];
  /** Sechs Beispiele mit Verlauf, je Chip „Auch im Blick“ eines */
  examples?: Example[];
  /** [Icon, Titel, Text, Suchbegriff, Rolle (optional)] */
  benefits: [IconName, string, string, string, string?][];
  flowTitle: string;
  steps: [IconName, string][];
  /** Schritte, zu denen die Kommune Dokumente veröffentlicht („Ratsmonitor meldet“) */
  reported: number[];
  advantage: string;
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
const BRANCHEN_QUELLE: Branche[] = [
  {
    slug: "bauwesen",
    name: "Bauwesen & Immobilien",
    icon: "house",
    title: "Bauland sehen, bevor es Bauland ist.",
    intro: "Bevor ein Bagger anrollt, hat meist ein Ausschuss darüber beraten. Hier lesen Sie mit.",
    audience: "Projektentwickler, Investoren, Architekten",
    example: { place: "Lindenau", committee: "Bauausschuss", status: "ok", title: "Aufstellungsbeschluss zum Bebauungsplan Nr. 14 „Am Mühlgraben“" },
    benefits: [
      ["eye", "Flächen sehen, bevor sie am Markt sind", "Ein Aufstellungsbeschluss erscheint, sobald der Rat ihn fasst. Das Exposé kommt meist später.", "Aufstellungsbeschluss"],
      ["shieldCheck", "Veränderungssperren vor dem Kauf prüfen", "Ein Ratsbeschluss zur Veränderungssperre ist hier sichtbar, bevor Sie einen Kaufvertrag unterschreiben.", "Veränderungssperre"],
      ["handshake", "Bebauungspläne von Anfang an verfolgen", "Vom Aufstellungsbeschluss bis zur Satzung: Der Stand jedes Plans ist nachvollziehbar.", "Bebauungsplan Entwurf"],
    ],
    flowTitle: "Vom Aufstellungsbeschluss bis zum Baubeginn",
    steps: [["users", "Aufstellungsbeschluss"], ["map", "Frühzeitige Beteiligung"], ["fileText", "Offenlegung"], ["circleCheck", "Satzungsbeschluss"], ["house", "Baugenehmigung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie erfahren von einer Fläche, wenn sie zum ersten Mal in einem Gremium auftaucht, lange vor dem Baubeginn.",
    watch: ["Aufstellungsbeschlüsse", "Offenlegungen", "Veränderungssperren", "Städtebauliche Verträge", "Bebauungspläne", "Grundstücksverkäufe"],
    useCases: ["Sie erfahren, dass eine Kommune ein neues Baugebiet plant, Monate bevor die Flächen auf den Markt kommen, und können früh Kontakt zu Eigentümern und Verwaltung aufnehmen.", "Sie sehen, wann Planentwürfe öffentlich ausliegen, und können Fristen für Stellungnahmen und Einwendungen rechtzeitig einplanen.", "Sie erkennen Risiken vor einem Grundstückskauf: Eine Veränderungssperre kann Bauanträge in einem Gebiet für Jahre blockieren.", "Sie sehen, welche Kosten und Pflichten Kommunen Vorhabenträgern auferlegen, etwa für Erschließung, Kitas oder Sozialwohnungen.", "Sie verfolgen Pläne vom ersten Entwurf bis zur Satzung und wissen, was auf einer Fläche künftig erlaubt ist.", "Sie erfahren, wenn Kommunen eigene Grundstücke verkaufen oder in Erbpacht vergeben, oft mit Bewerbungsfrist."],
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
      ["target", "Konzessionen rechtzeitig sehen", "Auslaufende Konzessionsverträge tauchen in Ratsbeschlüssen auf, oft lange vor der Vergabe.", "Konzessionsvertrag"],
      ["map", "Wärmeplanung vor Ort verfolgen", "Welche Gebiete die Kommune für Fernwärme vorsieht, steht in den Beschlüssen zur Wärmeplanung.", "Wärmeplanung"],
      ["trendingUp", "Entscheidungen der Nachbarn sehen", "Was Stadtwerke und Nachbarkommunen beschließen, lässt sich nebeneinander prüfen.", "Stadtwerke"],
    ],
    flowTitle: "Von der Wärmeplanung bis zur Konzession",
    steps: [["map", "Wärmeplanung"], ["users", "Beratung im Rat"], ["calendar", "Konzession läuft aus"], ["clipboardList", "Vergabeverfahren"], ["zap", "Netzbetrieb"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen das Auslaufen einer Konzession, wenn es im Hauptausschuss angekündigt wird, und haben Zeit für ein Angebot.",
    watch: ["Wärmeplanung", "Konzessionsverträge", "Netzausbau", "Ladeinfrastruktur", "Photovoltaik und Windkraft", "Förderprogramme"],
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
      ["clipboardList", "Aufträge vor der Ausschreibung", "Entsorgungsverträge und Investitionen erscheinen in den Beschlüssen, bevor sie vergeben werden.", "Entsorgungsvertrag"],
      ["droplet", "Kläranlagen und Kanalnetze im Blick", "Beschlüsse zu Kläranlagen, Kanalnetzen und Wertstoffhöfen an einem Ort.", "Kläranlage"],
      ["trendingUp", "Umstellungen früh erkennen", "Wenn eine Kommune rekommunalisiert oder neu ausschreibt, steht das in den Beschlüssen.", "Abfallwirtschaftskonzept"],
    ],
    flowTitle: "Vom Konzept bis zum neuen Auftrag",
    steps: [["fileText", "Abfallwirtschaftskonzept"], ["users", "Fachausschuss"], ["circleCheck", "Ratsbeschluss"], ["clipboardList", "Vergabebeschluss"], ["house", "Leistungsbeginn"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie erfahren von auslaufenden Verträgen und neuen Anlagen, sobald sie im Ausschuss beraten werden, oft Monate vor der Ausschreibung.",
    watch: ["Entsorgungsverträge", "Abfallwirtschaftskonzepte", "Anlagen und Wertstoffhöfe", "Kläranlagen und Kanalnetz", "Gebührensatzungen", "Ausschreibungen"],
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
      ["megaphone", "Mitreden, solange beraten wird", "Hebesätze und Flächen werden im Ausschuss beraten. Eine Stellungnahme wirkt vor der Entscheidung.", "Hebesatz"],
      ["euro", "Gebühren früh kalkulieren", "Gebührensatzungen erscheinen, bevor sie gelten. Die Planung kann sie einbeziehen.", "Gebührensatzung"],
      ["users", "Mitglieder informieren", "Relevante Beschlüsse lassen sich direkt an Mitgliedsunternehmen weitergeben.", "Gewerbegebiet"],
    ],
    flowTitle: "Vom Haushaltsentwurf bis zum Steuerbescheid",
    steps: [["fileText", "Haushaltsentwurf"], ["users", "Finanzausschuss"], ["circleCheck", "Haushaltsbeschluss"], ["clipboardList", "Vergaben"], ["euro", "Bescheid"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen geplante Hebesatz-Erhöhungen schon im Haushaltsentwurf, bevor der Rat entscheidet.",
    watch: ["Ausschreibungen", "Hebesätze", "Gewerbeflächen", "Sondernutzung und Märkte", "Wirtschaftsförderung", "Innenstadtentwicklung"],
    useCases: ["Sie sehen, welche Aufträge eine Kommune plant, schon wenn der Rat das Projekt beschließt, nicht erst, wenn es im Vergabeportal steht.", "Sie erfahren früh, wenn Gewerbe- oder Grundsteuer steigen sollen, und können sich vor der Entscheidung einbringen.", "Sie sehen, wo neue Gewerbegebiete entstehen oder Flächen vergeben werden, und können Standortentscheidungen früher treffen.", "Sie verfolgen Regeln und Gebühren für Außengastronomie, Wochenmärkte und Veranstaltungen im öffentlichen Raum.", "Sie erfahren früh von Förderprogrammen, Gründerzentren und Ansiedlungsprojekten.", "Sie sehen Pläne für Leerstände, Fußgängerzonen und Citymanagement, die Lage und Frequenz Ihres Standorts verändern."],
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
      ["clipboardList", "Projekte vor der Vergabe sehen", "Sanierungen und Ausbauten stehen in den Ratsbeschlüssen, bevor ausgeschrieben wird.", "Straßensanierung"],
      ["road", "Bauprogramme der Region", "Straßen, Radwege und ÖPNV-Ausbau mehrerer Kommunen auf einen Blick.", "Radverkehr"],
      ["handshake", "Früh bei den Planungsämtern sein", "Verkehrsentwicklungspläne laufen über Beschlüsse. So sind Sie im richtigen Moment dabei.", "Verkehrsentwicklungsplan"],
    ],
    flowTitle: "Vom Antrag bis zur Baustelle",
    steps: [["megaphone", "Antrag"], ["users", "Verkehrsausschuss"], ["circleCheck", "Beschluss"], ["calendar", "Planung"], ["road", "Umsetzung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen Sanierungs- und Ausbauvorhaben, sobald sie im Ausschuss beraten werden, lange bevor ausgeschrieben wird.",
    watch: ["Straßensanierung", "Parkraum", "ÖPNV", "ÖPNV", "Baustellen und Sperrungen", "Ladeinfrastruktur"],
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
      ["search", "Gutachtenbedarf erkennen", "Neue Pläne brauchen Umweltberichte und Artenschutzgutachten. Die Beschlüsse nennen das.", "Umweltbericht"],
      ["map", "Ausgleichsflächen finden", "Beschlossene Ausgleichsmaßnahmen, für die Planer und Umweltbüros gesucht werden.", "Ausgleich"],
      ["calendar", "Fristen der Auslegung kennen", "Öffentliche Auslegungen haben feste Fristen. Sie erscheinen hier früh.", "Öffentliche Auslegung"],
    ],
    flowTitle: "Vom Planentwurf bis zur Ausgleichsfläche",
    steps: [["map", "Planentwurf"], ["fileText", "Beteiligung"], ["circleCheck", "Beschluss"], ["map", "Ausgleich"], ["clipboardList", "Umsetzung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen, wo Gutachten und Ausgleichsflächen gebraucht werden, solange der Plan noch im Entwurf ist.",
    watch: ["Klimaanpassung", "Immissionsschutz", "Immissionsschutz", "Ausgleichsmaßnahmen", "Gewässer und Hochwasserschutz", "Klimaanpassung"],
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
    intro: "Wichtige Themen stehen oft Wochen vor der Sitzung auf der Tagesordnung, die Vorlagen sind öffentlich.",
    audience: "Lokaljournalisten, Redakteure",
    example: { place: "Lindenau", committee: "Hauptausschuss", status: "wait", title: "Beschlussvorlage: Gutachten zur Zukunft des Hallenbads" },
    benefits: [
      ["eye", "Die Sitzung vorab sehen", "Beschlussvorlagen erscheinen vor der Sitzung, nicht erst im Nachbericht.", "Beschlussvorlage"],
      ["clock", "Die Wochenvorschau", "Montags wissen, was in Ihren Kommunen auf der Tagesordnung steht.", "Tagesordnung"],
      ["layers", "Ein Begriff, ganz Deutschland", "Ein Suchbegriff findet Beschlüsse in allen angebundenen Kommunen gleichzeitig.", "Haushalt"],
    ],
    flowTitle: "Von der Vorlage bis zur Schlagzeile",
    steps: [["fileText", "Beschlussvorlage"], ["calendar", "Tagesordnung"], ["users", "Sitzung"], ["circleCheck", "Beschluss"], ["newspaper", "Berichterstattung"]],
    reported: [0, 1, 2, 3],
    advantage: "Sie sehen ein Thema, sobald die Vorlage veröffentlicht ist, und können recherchieren, bevor die Sitzung stattfindet.",
    watch: ["Beschlussvorlagen", "Tagesordnungen", "Fördergelder", "Haushalte", "Haushaltspläne", "Personalien"],
    useCases: ["Sie finden Vorlagen zu Ihren Themen, bevor im Rat abgestimmt wird, und haben Zeit für Recherche, Nachfragen und Berichterstattung.", "Sie sehen auf einen Blick, was in den nächsten Sitzungen von Rat und Ausschüssen verhandelt wird, und können Termine planen.", "Sie verfolgen, welche Förderprogramme Kommunen beantragen oder vergeben und wofür das Geld eingesetzt wird.", "Sie erkennen Schwerpunkte, Kürzungen und Investitionen im kommunalen Haushalt und können sie über Jahre vergleichen.", "Sie sehen, welche Fragen Fraktionen stellen und welche Anträge sie einbringen, oft der Anfang einer Debatte.", "Sie erfahren von Wahlen, Besetzungen und Wechseln in Verwaltung, Aufsichtsräten und Gremien."],
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
    watch: ["Haushaltspläne", "Kitas und Schulen", "Sport und Kultur", "Investitionsprogramme", "Ehrenamt und Förderrichtlinien", "Bürgerbeteiligung"],
    useCases: ["Sie sehen früh, wo Zuschüsse gekürzt oder erhöht werden sollen, und können sich einbringen, bevor der Haushalt beschlossen ist.", "Sie verfolgen Bedarfspläne, Neubauten, Trägerwechsel und Betreuungsangebote in Ihrer Kommune.", "Sie erfahren von Hallennutzung, Sanierungen, Zuschüssen und Veranstaltungen, die Ihren Verein oder Ihre Einrichtung betreffen.", "Sie sehen, welche Projekte die Kommune in den nächsten Jahren finanzieren will, und wo sich Ihr Vorhaben einordnen lässt.", "Sie erkennen Änderungen an Zuschussregeln und Förderprogrammen für Ehrenamt, Vereine und Initiativen.", "Sie erfahren, wann Kommunen Beteiligungsverfahren starten, und können sich mit Ihrem Anliegen einbringen."],
    watchIcons: ["euro", "house", "users", "trendingUp", "handshake", "megaphone"],
    closing: "Ihr Zuschuss wird gerade beraten.",
    keywords: ["Haushaltsplan", "Kita-Gebühren", "Schulentwicklungsplanung", "Sportförderung", "Investitionsprogramm"],
  },
];


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
        a: "plenara bündelt die Ratsinformationssysteme der Kommunen in einer Suche. Vorlagen, Tagesordnungen und Beschlüsse finden Sie an einem Ort, jeweils mit Kommune, Gremium, Datum und Link zu den Originalunterlagen. Die Abdeckung wird laufend ausgebaut.",
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
      { q: "Kann ich plenara im Team nutzen?", a: "Ja. Im Tarif Enterprise gehen Benachrichtigungen an bis zu fünf E-Mail-Adressen oder Verteiler je gespeicherter Suche, etwa an Kolleginnen und Kollegen oder ein Team-Postfach." },
      { q: "Erhalte ich eine Rechnung für mein Unternehmen?", a: "Für Unternehmen und Organisationen stimmen wir Abrechnung und Rechnungsstellung gern individuell ab. Sprechen Sie uns dazu über die Kontaktseite an." },
      { q: "Kann ich mehrere Regionen oder Themen beobachten?", a: "Ja. Legen Sie für jede Region oder jedes Thema eine eigene gespeicherte Suche an. In einer Suche können Sie außerdem mehrere Orte und mehrere Begriffe kombinieren. Wie viele Suchen Sie speichern können, hängt vom Tarif ab." },
      { q: "Was unterscheidet plenara von Vergabeportalen?", a: "Vergabeportale zeigen Ausschreibungen, also das Ende eines Prozesses. plenara zeigt, was davor in Räten und Ausschüssen beraten und beschlossen wird. So sehen Sie Projekte, bevor sie ausgeschrieben werden." },
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
  { q: "Was ist plenara.X und welcher Tarif enthält es?", a: "plenara.X sind die Analysen zu plenara: Diffusion, Knowledge Graph, Trends, Gebietsvergleich, Beschlüsse sowie Gremiennetz. Sie sind nur im Tarif Enterprise enthalten. In Basic und Pro bleibt die Suche mit allen Treffern und Benachrichtigungen." },
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
    items: [["map", "Suche in allen angebundenen Gebieten"], ["user", "Keine E-Mail-Benachrichtigungen"]],
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
    items: [["map", "Suche in allen angebundenen Gebieten"], ["user", "E-Mail-Benachrichtigungen an Ihre Adresse"]],
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
    items: [["map", "Suche in allen angebundenen Gebieten"], ["user", "Ihre Adresse + bis zu 5 weitere Empfänger"]],
    features: [
      { plus: true, text: "**Alles aus Pro**, zusätzlich:" },
      { text: "**plenara.X**: Analysen zu Ausbreitung, Beschlüssen und Trends" },
      { text: "**Sitzungskalender** für Ihre Gebiete, auch mit Umkreis" },
      { text: "Benachrichtigungen an **bis zu 5 Kolleginnen und Kollegen**" },
    ],
    cta: "Enterprise wählen",
    submit: "Enterprise starten",
  },
];

/* Anwender: fünf Gruppen, je eine Seite. Die Inhalte der Branchen liefern Ablauf, Beispiel und Schlagwörter; die Rollen liefern den Nutzen. */
type Rolle = { name: string; icon: IconName; nutzen: [IconName, string, string, string][] };
const ANWENDER_GRUPPEN: { slug: string; name: string; basis: string; icon?: IconName; title: string; intro: string; closing: string; rollen: Rolle[] }[] = [
  { slug: "immobilien", name: "Immobilien", basis: "bauwesen", title: "Bauland sehen, bevor es Bauland ist.", intro: "Bebauungspläne, Veränderungssperren und Gewerbegebiete stehen in den Beschlüssen, bevor Flächen am Markt sind.", closing: "Den Standort früh im Blick behalten.", rollen: [
    { name: "Projektentwicklung", icon: "house", nutzen: [["eye", "Flächen sehen, bevor sie am Markt sind", "Ein Aufstellungsbeschluss erscheint, sobald der Rat ihn fasst. Das Exposé kommt meist später.", "Aufstellungsbeschluss"], ["handshake", "Früh am Tisch sitzen", "Solange der Plan noch gestaltbar ist, lässt sich mit Verwaltung und Politik sprechen.", "Bebauungsplan Entwurf"]] },
    { name: "Gewerbemakler und Investoren", icon: "briefcase", nutzen: [["shieldCheck", "Veränderungssperren vor dem Kauf prüfen", "Der Ratsbeschluss ist sichtbar, bevor Sie den Kaufvertrag unterschreiben.", "Veränderungssperre"], ["trendingUp", "Gewerbeflächen früh erkennen", "Gewerbegebiete und Gebietsänderungen tauchen in Beschlüssen auf, bevor sie vermarktet werden.", "Gewerbegebiet"]] },
    { name: "Architekturbüros", icon: "layoutGrid", nutzen: [["clipboardList", "Vorhaben vor dem Entwurf kennen", "Bebauungspläne zeigen, was gebaut werden darf, bevor der Entwurf beginnt.", "Bebauungsplan"], ["eye", "Einwände früh einplanen", "Auslegungen zeigen, wer sich zu einem Plan äußert und welche Fristen gelten.", "Öffentliche Auslegung"]] },
  ] },
  { slug: "versorgung", name: "Versorgung", basis: "energie", title: "Versorgung planen, bevor die Beschlüsse fallen.", intro: "Wärmeplanung, Konzessionen, Wasser und Entsorgung: Was Kommunen beschließen, betrifft Netze und Verträge.", closing: "Netze und Verträge früh im Blick.", rollen: [
    { name: "Stadtwerke und Netzbetreiber", icon: "landmark", nutzen: [["target", "Keine Konzession verpassen", "Auslaufende Konzessionsverträge in Ihrem Gebiet fallen früh auf.", "Konzessionsvertrag"], ["map", "Wärmenetze vorausplanen", "Sehen, wo Kommunen Fernwärme vorsehen und wo nicht.", "Wärmeplanung"]] },
    { name: "Wasser und Entsorgung", icon: "droplet", nutzen: [["clipboardList", "Aufträge vor der Ausschreibung", "Auslaufende Entsorgungsverträge und Investitionen erscheinen, bevor sie vergeben werden.", "Entsorgungsvertrag"], ["droplet", "Kläranlagen und Kanalnetze im Blick", "Beschlüsse zu Kläranlagen, Kanalnetzen und Wertstoffhöfen an einem Ort.", "Kläranlage"]] },
    { name: "Versorger im Wettbewerb", icon: "trendingUp", nutzen: [["trendingUp", "Entscheidungen der Nachbarn sehen", "Was Stadtwerke und Nachbarkommunen beschließen, lässt sich nebeneinander prüfen.", "Stadtwerke"], ["users", "Zuständigkeiten kennen", "Welche Ausschüsse über Netze und Verträge beraten, lässt sich in den Beschlüssen nachlesen.", "Netzausbau"]] },
  ] },
  { slug: "planung", name: "Planung", basis: "umwelt", icon: "map", title: "Gutachten und Aufträge sehen, bevor sie vergeben werden.", intro: "Umweltberichte, Ausgleichsflächen und Verkehrsprojekte: Wer früh weiß, was geplant wird, kann früh anbieten.", closing: "Aufträge früh im Blick.", rollen: [
    { name: "Umweltgutachter", icon: "search", nutzen: [["search", "Gutachtenbedarf erkennen", "Neue Pläne brauchen Umweltberichte und Artenschutzgutachten. Die Beschlüsse nennen das.", "Umweltbericht"], ["calendar", "Fristen der Auslegung kennen", "Öffentliche Auslegungen haben feste Fristen. Sie erscheinen hier früh.", "Öffentliche Auslegung"]] },
    { name: "Landschaftsplanung", icon: "map", nutzen: [["map", "Ausgleichsflächen finden", "Beschlossene Ausgleichsmaßnahmen, für die Planer gesucht werden.", "Ausgleich"], ["layers", "Grünordnung im Blick", "Grünordnungspläne zeigen, wo Eingriffe ausgeglichen werden müssen.", "Grünordnungsplan"]] },
    { name: "Verkehrs- und Ingenieurplanung", icon: "road", nutzen: [["road", "Bauprogramme der Region", "Straßen, Radwege und ÖPNV-Ausbau mehrerer Kommunen auf einen Blick.", "Radverkehr"], ["clipboardList", "Projekte vor der Vergabe sehen", "Sanierungen und Ausbauten stehen in Beschlüssen, bevor ausgeschrieben wird.", "Straßensanierung"]] },
  ] },
  { slug: "verbaende", name: "Verbände", basis: "wirtschaft", title: "Beschlüsse für Ihre Mitglieder einordnen.", intro: "Vom Hebesatz bis zur Förderrichtlinie: Verbände und Vereine erfahren, was ihre Mitglieder betrifft, und können rechtzeitig Stellung nehmen.", closing: "Mitglieder früh informieren.", rollen: [
    { name: "Wirtschaftsverbände und Kammern", icon: "megaphone", nutzen: [["megaphone", "Mitreden, solange beraten wird", "Hebesätze und Flächen werden im Ausschuss beraten. Eine Stellungnahme wirkt vor der Entscheidung.", "Hebesatz"], ["euro", "Gebühren früh kalkulieren", "Gebührensatzungen erscheinen, bevor sie gelten. Die Planung kann sie einbeziehen.", "Gebührensatzung"]] },
    { name: "Mitgliederverbände", icon: "handshake", nutzen: [["users", "Mitglieder informieren", "Relevante Beschlüsse lassen sich direkt an Mitgliedsunternehmen weitergeben.", "Gewerbegebiet"], ["layers", "Alle Mitglieder auf einen Blick", "Ein Beschluss betrifft oft viele Mitglieder gleichzeitig. Die Liste zeigt, wer betroffen ist.", "Sondernutzung"]] },
    { name: "Vereine und soziale Träger", icon: "heart", nutzen: [["euro", "Förderung sichern", "Sehen, ob Ihr Zuschuss im Haushaltsentwurf steht oder gekürzt wird.", "Zuschuss"], ["fileText", "Richtlinien schnell finden", "Aktuelle Förder- und Gebührenordnungen ohne langes Suchen.", "Förderrichtlinie"]] },
  ] },
  { slug: "oeffentlichkeit", name: "Öffentlichkeit", basis: "medien", title: "Beschlüsse finden, bevor die Sitzung beginnt.", intro: "Lokalredaktionen, Fachmedien und Bürgerinnen und Bürger sehen Vorlagen und Entscheidungen aus allen angebundenen Kommunen.", closing: "Vorlagen früh lesen, bevor andere berichten.", rollen: [
    { name: "Lokalredaktionen", icon: "newspaper", nutzen: [["eye", "Die Sitzung vorab sehen", "Beschlussvorlagen erscheinen vor der Sitzung, nicht erst im Nachbericht.", "Beschlussvorlage"], ["clock", "Die Wochenvorschau", "Montags wissen, was in Ihren Kommunen auf der Tagesordnung steht.", "Tagesordnung"]] },
    { name: "Fachmedien", icon: "fileText", nutzen: [["layers", "Ein Begriff, ganz Deutschland", "Ein Suchbegriff findet Beschlüsse in allen angebundenen Kommunen gleichzeitig.", "Haushalt"]] },
    { name: "Bürgerinnen und Bürger", icon: "mapPin", nutzen: [["bell", "Frühzeitig informiert sein", "Ein gespeicherter Suchbegriff meldet neue Beschlüsse in Ihrer Gemeinde per E-Mail.", "Frühzeitige Beteiligung"]] },
  ] },
];
import { BEISPIELE } from "./anwender-beispiele";
/* Echte Treffer aus dem Bestand je Basisbranche (Stand 08.10.26) */
const TREFFER_BASIS: Record<string, Example> = {
  bauwesen: { place: "Verwaltungsgemeinschaft Fuchstal", committee: "Gemeinderat", status: "wait", statusText: "Angekündigt", statusId: "announced", datum: ["8", "OKT", "26"], title: "Bauleitplanung: Bebauungsplan „Sportgelände Mittelschule“; Aufstellungsbeschluss" },
  energie: { steps: [{ d: "2026-09-08", c: "Ausschuss für Verkehr", s: "unknown" }, { d: "2026-10-08", c: "Gemeindevertretung", s: "consulting" }], place: "Gemeinde Rellingen", committee: "Gemeindevertretung", status: "wait", statusText: "In Beratung", statusId: "consulting", datum: ["8", "OKT", "26"], title: "Kommunale Wärmeplanung – Beschluss des Wärmeplans" },
  umwelt: { place: "Verbandsgemeinde Selters (Westerwald)", committee: "Hauptausschuss VG", status: "wait", statusText: "Stand offen", statusId: "unknown", datum: ["1", "OKT", "26"], title: "Information über die Umsetzung von Ausgleichsmaßnahmen" },
  wirtschaft: { place: "Gemeinde Achberg", committee: "Gemeinderat", status: "wait", statusText: "In Beratung", statusId: "consulting", datum: ["8", "OKT", "26"], title: "Nahwärmenetz Achberghalle; Ausführungsplanung und Auftrag Ausschreibungen" },
  medien: { place: "Stadt Lübeck", committee: "Werkausschuss EBL", status: "wait", statusText: "Angekündigt", statusId: "announced", datum: ["8", "OKT", "26"], title: "Beschlussvorlagen" },
};
/* Schlagwörter und Ablauf kommen von der Basisbranche; Nutzen je Rolle, mit Rollenname */
export const BRANCHEN: Branche[] = ANWENDER_GRUPPEN.map((g) => {
  const basis = BRANCHEN_QUELLE.find((b) => b.slug === g.basis)!;
  return {
    ...basis,
    icon: g.icon ?? basis.icon,
    examples: BEISPIELE[g.slug],
    example: BEISPIELE[g.slug][0],
    slug: g.slug,
    name: g.name,
    title: g.title,
    intro: g.intro,
    closing: g.closing,
    audience: g.rollen.map((r) => r.name).join(", "),
    ...(g.slug === "verbaende" ? { flowTitle: "Vom Haushaltsentwurf bis zum Bescheid", steps: [["fileText", "Haushaltsentwurf"], ["users", "Finanzausschuss"], ["circleCheck", "Haushaltsbeschluss"], ["euro", "Förderung und Gebühren"], ["mail", "Bescheid"]] as [IconName, string][] } : {}),
    rollen: g.rollen.map((r) => ({ name: r.name, icon: r.icon })),
    benefits: g.rollen.flatMap((r) => r.nutzen.map((n) => [...n, r.name] as [IconName, string, string, string, string])),
  };
});

export const brancheBySlug = (slug: string) => BRANCHEN.find((b) => b.slug === slug);
