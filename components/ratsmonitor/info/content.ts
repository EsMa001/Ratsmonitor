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
  /** Beleg für den Vorsprung: ein echter Plan, Sitzung für Sitzung (nur Seiten mit Live-Kopf, AnwenderLive.tsx) */
  beleg?: { titel: string; ort: string; ueberschrift?: string; text?: string; schritte: { d: string; label: string; gremium: string; href: string }[] };
  /** Kopfkarte: Signale der Branche als Chips [Auszug-Schlüssel aus plenara-x-teaser.mjs, Chip]; ohne Eintrag das feste Beispiel */
  kopf?: [string, string][];
  /** plenara.X-Auszüge: [Schlüssel aus plenara-x-teaser.mjs, Bezeichnung im Satz (Signale), Chip]; Chips wechseln den Auszug */
  xauszug?: [string, string, string?][];
  /** Video der Seite: Pfad ohne Endung (.mp4, .jpg, .vtt in public/videos), optional */
  video?: string;
  /** plenara.X-Links: [Titel, Satz, Adresse] */
  plenarax?: [string, string, string][];
  /** Themen „Auch im Blick“ (gleiche Reihenfolge wie die Beispiele) */
  watch: string[];
  closing: string;
  /** Suchbegriffe; der erste ist der Haupt-Suchbegriff */
  keywords: string[];
}

export const STATUS_LABEL: Record<Status, string> = { ok: "Beschlossen", wait: "Vertagt" };



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
  { q: "Was ist plenara.X und welcher Tarif enthält es?", a: "plenara.X sind die Analysen und Einblicke zu plenara: Atlas mit Ortsvergleich, Signale, Trends mit Ausgang der Vorgänge und Fakten aus den Unterlagen, dazu Fraktionen, Gremien, Themennetz und Aktuelles. Sie sind nur im Tarif Enterprise enthalten. In Basic und Pro bleibt die Suche mit allen Treffern und Benachrichtigungen." },
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
      { text: "**plenara.X**: Atlas, Signale, Trends, Fakten und Einblicke" },
      { text: "**Sitzungskalender** für Ihre Gebiete, auch mit Umkreis" },
      { text: "Benachrichtigungen an **bis zu 5 Kolleginnen und Kollegen**" },
    ],
    cta: "Enterprise wählen",
    submit: "Enterprise starten",
  },
];

/* Anwender: fünf Gruppen, je eine Seite. Die Inhalte der Branchen liefern Ablauf, Beispiel und Schlagwörter; die Rollen liefern den Nutzen. */
type Rolle = { name: string; icon: IconName; nutzen: [IconName, string, string, string][] };
const ANWENDER_GRUPPEN: { kopf?: Branche["kopf"]; xauszug?: Branche["xauszug"]; video?: string; beleg?: Branche["beleg"]; plenarax?: Branche["plenarax"]; slug: string; name: string; icon: IconName; watch: string[]; keywords: string[]; flowTitle: string; steps: [IconName, string][]; reported: number[]; title: string; intro: string; closing: string; rollen: Rolle[] }[] = [
  { beleg: { titel: "Gewerbegebiet „Neubeckumer Straße/Grüner Weg“", ort: "Beckum", schritte: [
    { d: "2026-01-28", label: "Aufstellungsbeschluss empfohlen", gremium: "Ausschuss für Stadtentwicklung", href: "/beschluss/nrw-05570008-vo-32437" },
    { d: "2026-06-30", label: "Aufstellungs- und Offenlagebeschluss empfohlen", gremium: "Ausschuss für Stadtentwicklung", href: "/beschluss/nrw-05570008-vo-36535" },
    { d: "2026-09-23", label: "Satzungsbeschluss", gremium: "Rat der Stadt Beckum", href: "/beschluss/nrw-05570008-vo-36690" },
  ] }, plenarax: [
    ["Neue Wohnbaugebiete", "Wo Kommunen neue Baugebiete planen, mit Stand je Vorgang.", "/analytics/signale?signal=wohnbau"],
    ["Bauleitplanung im Atlas", "Wo Bauleitplanung viel Raum hat, je Ort und Monat.", "/analytics/atlas?thema=bauen&sub=bauen.plan"],
  ], xauszug: [["wohnbau", "neue Wohnbaugebiete", "Wohnbaugebiete"], ["gewerbe", "Vorhaben für Gewerbe, Industrie und Handel", "Gewerbe"], ["grundsteuer", "", "Grundsteuer B"]], kopf: [["wohnbau", "Wohnbaugebiete"], ["gewerbe", "Gewerbe"]], video: "/videos/plenara-anwender-immobilien", slug: "immobilien", icon: "house", name: "Immobilien", watch: ["Bebauungspläne", "Aufstellungsbeschlüsse", "Veränderungssperren", "Städtebauliche Verträge"], keywords: ["Aufstellungsbeschluss", "Bebauungsplan", "Veränderungssperre", "Offenlegung", "städtebaulicher Vertrag"], flowTitle: "Vom Aufstellungsbeschluss bis zum Baubeginn", steps: [["users", "Aufstellungsbeschluss"], ["map", "Frühzeitige Beteiligung"], ["fileText", "Offenlegung"], ["circleCheck", "Satzungsbeschluss"], ["house", "Baugenehmigung"]], reported: [0, 1, 2, 3], title: "Bauland sehen, bevor es Bauland ist.", intro: "Bebauungspläne, Veränderungssperren und Gewerbegebiete stehen in den Beschlüssen, bevor Flächen am Markt sind.", closing: "Den Standort früh im Blick behalten.", rollen: [
    { name: "Projektentwicklung", icon: "house", nutzen: [["eye", "Flächen sehen, bevor sie am Markt sind", "Ein Aufstellungsbeschluss erscheint, sobald der Rat ihn fasst. Das Exposé kommt meist später.", "Aufstellungsbeschluss"], ["handshake", "Früh am Tisch sitzen", "Solange der Plan noch gestaltbar ist, lässt sich mit Verwaltung und Politik sprechen.", "Bebauungsplan Entwurf"]] },
    { name: "Gewerbemakler und Investoren", icon: "briefcase", nutzen: [["shieldCheck", "Veränderungssperren vor dem Kauf prüfen", "Der Ratsbeschluss ist sichtbar, bevor Sie den Kaufvertrag unterschreiben.", "Veränderungssperre"], ["trendingUp", "Gewerbeflächen früh erkennen", "Gewerbegebiete und Gebietsänderungen tauchen in Beschlüssen auf, bevor sie vermarktet werden.", "Gewerbegebiet"]] },
    { name: "Architekturbüros", icon: "layoutGrid", nutzen: [["clipboardList", "Vorhaben vor dem Entwurf kennen", "Bebauungspläne zeigen, was gebaut werden darf, bevor der Entwurf beginnt.", "Bebauungsplan"], ["eye", "Einwände früh einplanen", "Auslegungen zeigen, wer sich zu einem Plan äußert und welche Fristen gelten.", "Öffentliche Auslegung"]] },
  ] },
  { beleg: { titel: "Kommunale Wärmeplanung", ort: "Gröbenzell", ueberschrift: "4 Monate vor der Vergabe", text: "Kommunale Wärmeplanung in Gröbenzell: vom Grundsatzbeschluss bis zur Vergabe der Planung. Wer Planung oder Netze anbietet, sah den Bedarf ab Mai.", schritte: [
    { d: "2026-05-21", label: "Entscheidung über das weitere Vorgehen", gremium: "Gemeinderat", href: "/beschluss/de-09179126-vo-24667" },
    { d: "2026-07-30", label: "Vergabe der Ingenieurleistungen", gremium: "Gemeinderat", href: "/beschluss/de-09179126-top-3165--5" },
    { d: "2026-09-24", label: "Vergabe zur Erstellung der Wärmeplanung", gremium: "Gemeinderat", href: "/beschluss/de-09179126-vo-24839" },
  ] }, plenarax: [
    ["Wärme, Energieeffizienz und Netze", "Wo Kommunen Wärmeplanung, Netze und Effizienz beraten, mit Stand je Vorgang.", "/analytics/signale?signal=waerme"],
    ["Umwelt, Klima & Energie im Atlas", "Wo das Thema viel Raum hat, je Ort und Monat.", "/analytics/atlas?thema=umwelt"],
  ], xauszug: [["waerme", "Vorhaben zu Wärme und Netzen", "Wärme und Netze"], ["wind", "Vorhaben zur Windenergie", "Windenergie"], ["solar", "Vorhaben zur Solarenergie", "Solarenergie"], ["trend-umwelt", "", "Was zunimmt"]], kopf: [["waerme", "Wärme und Netze"], ["wind", "Windenergie"], ["solar", "Solarenergie"]], video: "/videos/plenara-anwender-versorgung", slug: "versorgung", icon: "zap", name: "Versorgung", watch: ["Wärmeplanung", "Fernwärme", "Ladeinfrastruktur", "Photovoltaik"], keywords: ["Wärmeplanung", "Konzessionsvertrag", "Fernwärme", "Stadtwerke", "Netzausbau"], flowTitle: "Von der Wärmeplanung bis zur Konzession", steps: [["map", "Wärmeplanung"], ["users", "Beratung im Rat"], ["calendar", "Konzession läuft aus"], ["clipboardList", "Vergabeverfahren"], ["zap", "Netzbetrieb"]], reported: [0, 1, 2, 3], title: "Wärmeplanung und Netze sehen, sobald die Vorlage kommt.", intro: "Wärmeplanung, Konzessionen, Wasser und Entsorgung: Was Kommunen beschließen, betrifft Netze und Verträge.", closing: "Netze und Verträge früh im Blick.", rollen: [
    { name: "Stadtwerke und Netzbetreiber", icon: "landmark", nutzen: [["target", "Keine Konzession verpassen", "Auslaufende Konzessionsverträge in Ihrem Gebiet fallen früh auf.", "Konzessionsvertrag"], ["map", "Wärmenetze vorausplanen", "Sehen, wo Kommunen Fernwärme vorsehen und wo nicht.", "Wärmeplanung"]] },
    { name: "Wasser und Entsorgung", icon: "droplet", nutzen: [["clipboardList", "Aufträge vor der Ausschreibung", "Auslaufende Entsorgungsverträge und Investitionen erscheinen, bevor sie vergeben werden.", "Entsorgungsvertrag"], ["droplet", "Kläranlagen und Kanalnetze im Blick", "Beschlüsse zu Kläranlagen, Kanalnetzen und Wertstoffhöfen an einem Ort.", "Kläranlage"]] },
    { name: "Versorger im Wettbewerb", icon: "trendingUp", nutzen: [["trendingUp", "Entscheidungen der Nachbarn sehen", "Was Stadtwerke und Nachbarkommunen beschließen, lässt sich nebeneinander prüfen.", "Stadtwerke"], ["users", "Zuständigkeiten kennen", "Welche Ausschüsse über Netze und Verträge beraten, lässt sich in den Beschlüssen nachlesen.", "Netzausbau"]] },
  ] },
  { beleg: { titel: "Radweg Marienberg–Reitzenhain", ort: "Marienberg", ueberschrift: "Bau vergeben, nächste Planung schon in Sicht", text: "Radweg Marienberg–Reitzenhain an der B 174: Im März vergab der Stadtrat den Bau des 1. Abschnitts, im Juni die Objekt- und Tragwerksplanung für den 2. Abschnitt. So sieht man, wie ein Vorhaben Abschnitt für Abschnitt weitergeht.", schritte: [
    { d: "2026-03-09", label: "Bauleistung 1. Abschnitt vergeben", gremium: "Stadtrat", href: "/beschluss/de-14521390-vo-4112" },
    { d: "2026-06-29", label: "Planung 2. Abschnitt vergeben", gremium: "Stadtrat", href: "/beschluss/de-14521390-vo-4218" },
  ] }, plenarax: [
    ["Straßen, Brücken und Radwege", "Wo Kommunen Bau und Sanierung beraten, mit Stand je Vorgang.", "/analytics/signale?signal=strasse"],
    ["Umwelt, Klima & Energie im Atlas", "Wo das Thema viel Raum hat, je Ort und Monat.", "/analytics/atlas?thema=umwelt"],
  ], xauszug: [["planung", "Vergaben von Planungsleistungen", "Planungsleistungen"], ["wohnbau", "neue Wohnbaugebiete, jedes mit Umweltbericht und Gutachten", "Wohnbaugebiete"], ["wind", "Vorhaben zur Windenergie", "Windenergie"], ["gewerbe", "Vorhaben für Gewerbe, Industrie und Handel", "Gewerbe"]], kopf: [["planung", "Planungsleistungen"], ["wohnbau", "Wohnbaugebiete"], ["wind", "Windenergie"]], video: "/videos/plenara-anwender-planung", slug: "planung", name: "Planung", icon: "map", watch: ["Planungsleistungen", "Radwege", "Klimaanpassung", "Hochwasserschutz"], keywords: ["Planungsleistungen", "Ausgleichsmaßnahme", "Umweltbericht", "Artenschutzgutachten", "Landschaftsplan", "Grünordnungsplan"], flowTitle: "Vom Planentwurf bis zur Ausgleichsfläche", steps: [["map", "Planentwurf"], ["fileText", "Beteiligung"], ["circleCheck", "Beschluss"], ["map", "Ausgleich"], ["clipboardList", "Umsetzung"]], reported: [0, 1, 2, 3], title: "Gutachten und Aufträge sehen, bevor sie vergeben werden.", intro: "Umweltberichte, Ausgleichsflächen und Verkehrsprojekte: Wer früh weiß, was geplant wird, kann früh anbieten.", closing: "Aufträge früh im Blick.", rollen: [
    { name: "Umweltgutachter", icon: "search", nutzen: [["search", "Gutachtenbedarf erkennen", "Neue Pläne brauchen Umweltberichte und Artenschutzgutachten. Die Beschlüsse nennen das.", "Umweltbericht"], ["calendar", "Fristen der Auslegung kennen", "Öffentliche Auslegungen haben feste Fristen. Sie erscheinen hier früh.", "Öffentliche Auslegung"]] },
    { name: "Landschaftsplanung", icon: "map", nutzen: [["map", "Ausgleichsflächen finden", "Beschlossene Ausgleichsmaßnahmen, für die Planer gesucht werden.", "Ausgleich"], ["layers", "Grünordnung im Blick", "Grünordnungspläne zeigen, wo Eingriffe ausgeglichen werden müssen.", "Grünordnungsplan"]] },
    { name: "Verkehrs- und Ingenieurplanung", icon: "road", nutzen: [["road", "Bauprogramme der Region", "Straßen, Radwege und ÖPNV-Ausbau mehrerer Kommunen auf einen Blick.", "Radverkehr"], ["clipboardList", "Projekte vor der Vergabe sehen", "Sanierungen und Ausbauten stehen in Beschlüssen, bevor ausgeschrieben wird.", "Straßensanierung"]] },
  ] },
  { beleg: { titel: "Fortführung Planung Gewerbegebiet", ort: "Satow", ueberschrift: "8 Tage durch 3 Gremien", text: "Fortführung der Planung des Gewerbegebiets Satow: Binnen acht Tagen beriet es der Fachausschuss, der Hauptausschuss und die Gemeindevertretung. Wer mitreden will, hat dafür wenig Zeit.", schritte: [
    { d: "2026-09-16", label: "Beratung im Fachausschuss", gremium: "Ausschuss für Gemeindeentwicklung, Bau und Verkehr", href: "/beschluss/de-13072093-top-463--13" },
    { d: "2026-09-17", label: "Beratung im Hauptausschuss", gremium: "Hauptausschuss", href: "/beschluss/de-13072093-top-464--19" },
    { d: "2026-09-24", label: "Beratung in der Gemeindevertretung", gremium: "Gemeindevertretung Satow", href: "/beschluss/de-13072093-top-465--17" },
  ] }, plenarax: [
    ["Hebesätze auf der Karte", "Hebesätze aus den Vorlagen, je Gemeinde im Vergleich.", "/analytics/fakten?fakt=hebesatz"],
    ["Ausschreibungen und Vergaben", "Welche Aufträge Kommunen vergeben, mit Stand je Vorgang.", "/analytics/signale?signal=vergaben"],
  ], xauszug: [["grundsteuer", "", "Grundsteuer B"], ["gewerbesteuer", "", "Gewerbesteuer"], ["netz", "", "Wege durch die Gremien"], ["gewerbe", "Vorhaben für Gewerbe, Industrie und Handel", "Gewerbe"]], kopf: [["gewerbe", "Gewerbe"], ["vergaben", "Ausschreibungen und Vergaben"]], video: "/videos/plenara-anwender-verbaende", slug: "verbaende", icon: "briefcase", name: "Verbände", watch: ["Hebesätze", "Gewerbeflächen", "Sondernutzung", "Innenstadt"], keywords: ["Hebesatz", "Ausschreibung", "Gewerbefläche", "Sondernutzung", "Marktgebühren"], flowTitle: "Vom Haushaltsentwurf bis zum Steuerbescheid", steps: [["fileText", "Haushaltsentwurf"], ["users", "Finanzausschuss"], ["circleCheck", "Haushaltsbeschluss"], ["clipboardList", "Vergaben"], ["euro", "Bescheid"]], reported: [0, 1, 2, 3], title: "Mitreden, solange noch beraten wird.", intro: "Vom Hebesatz bis zur Förderrichtlinie: Verbände und Vereine erfahren, was ihre Mitglieder betrifft, und können rechtzeitig Stellung nehmen.", closing: "Mitglieder früh informieren.", rollen: [
    { name: "Wirtschaftsverbände und Kammern", icon: "megaphone", nutzen: [["megaphone", "Mitreden, solange beraten wird", "Hebesätze und Flächen werden im Ausschuss beraten. Eine Stellungnahme wirkt vor der Entscheidung.", "Hebesatz"], ["euro", "Gebühren früh kalkulieren", "Gebührensatzungen erscheinen, bevor sie gelten. Die Planung kann sie einbeziehen.", "Gebührensatzung"]] },
    { name: "Mitgliederverbände", icon: "handshake", nutzen: [["users", "Mitglieder informieren", "Relevante Beschlüsse lassen sich direkt an Mitgliedsunternehmen weitergeben.", "Gewerbegebiet"], ["layers", "Alle Mitglieder auf einen Blick", "Ein Beschluss betrifft oft viele Mitglieder gleichzeitig. Die Liste zeigt, wer betroffen ist.", "Sondernutzung"]] },
    { name: "Vereine und soziale Träger", icon: "heart", nutzen: [["euro", "Förderung sichern", "Sehen, ob Ihr Zuschuss im Haushaltsentwurf steht oder gekürzt wird.", "Zuschuss"], ["fileText", "Richtlinien schnell finden", "Aktuelle Förder- und Gebührenordnungen ohne langes Suchen.", "Förderrichtlinie"]] },
  ] },
  { beleg: { titel: "Antrag zur Kommunalen Wärmeplanung", ort: "Ahrensburg", ueberschrift: "Mehrfach vertagt, dann beschlossen", text: "Antrag zur Fortentwicklung der Kommunalen Wärmeplanung in Ahrensburg: Über sechs Monate lag er in Ausschuss und Stadtverordnetenversammlung. Jede Vertagung war am Sitzungstag zu sehen.", schritte: [
    { d: "2026-03-11", label: "Vertagt", gremium: "Umweltausschuss", href: "/beschluss/de-01062001-top-4936--9" },
    { d: "2026-03-23", label: "Vertagt", gremium: "Stadtverordnetenversammlung", href: "/beschluss/de-01062001-top-4946--21" },
    { d: "2026-05-26", label: "Vertagt", gremium: "Stadtverordnetenversammlung", href: "/beschluss/de-01062001-top-4983--14" },
    { d: "2026-09-28", label: "Beschlossen", gremium: "Stadtverordnetenversammlung", href: "/beschluss/de-01062001-top-5041--21" },
  ] }, plenarax: [
    ["Aktuelles", "Was in den Räten gerade berichtenswert ist, je Vorgang mit Zitat und Quelle.", "/analytics/news"],
    ["Ausgang von Vorgängen", "Wie oft beschlossen, abgelehnt oder vertagt wird.", "/analytics/beschluesse"],
  ], xauszug: [["news-top", "", "Berichtenswert"], ["ausgang", "", "Wie Vorgänge ausgehen"], ["trend-alle", "", "Was zunimmt"], ["schulen", "Vorhaben zu Schulen, Kitas und Sport", "Schulen und Kitas"]], kopf: [["schulen", "Schulen und Kitas"], ["mobil", "Mobilität"], ["wohnbau", "Wohnbaugebiete"], ["waerme", "Wärme und Netze"]], video: "/videos/plenara-anwender-oeffentlichkeit", slug: "oeffentlichkeit", icon: "newspaper", name: "Öffentlichkeit", watch: ["Haushalt", "Zuschüsse", "Bürgerbegehren", "Schulen", "Kitas"], keywords: ["Beschlussvorlage", "Tagesordnung", "Zuschuss", "Gutachten", "Haushalt"], flowTitle: "Von der Vorlage bis zur Schlagzeile", steps: [["fileText", "Beschlussvorlage"], ["calendar", "Tagesordnung"], ["users", "Sitzung"], ["circleCheck", "Beschluss"], ["newspaper", "Berichterstattung"]], reported: [0, 1, 2, 3], title: "Beschlüsse finden, bevor die Sitzung beginnt.", intro: "Lokalredaktionen, Fachmedien und Bürgerinnen und Bürger sehen Vorlagen und Entscheidungen aus allen angebundenen Kommunen.", closing: "Vorlagen früh lesen, bevor andere berichten.", rollen: [
    { name: "Lokalredaktionen", icon: "newspaper", nutzen: [["eye", "Die Sitzung vorab sehen", "Beschlussvorlagen erscheinen vor der Sitzung, nicht erst im Nachbericht.", "Beschlussvorlage"], ["clock", "Die Wochenvorschau", "Montags wissen, was in Ihren Kommunen auf der Tagesordnung steht.", "Tagesordnung"]] },
    { name: "Fachmedien", icon: "fileText", nutzen: [["layers", "Ein Begriff, ganz Deutschland", "Ein Suchbegriff findet Beschlüsse in allen angebundenen Kommunen gleichzeitig.", "Haushalt"]] },
    { name: "Bürgerinnen und Bürger", icon: "mapPin", nutzen: [["bell", "Frühzeitig informiert sein", "Ein gespeicherter Suchbegriff meldet neue Beschlüsse in Ihrer Gemeinde per E-Mail.", "Frühzeitige Beteiligung"]] },
  ] },
];
import { BEISPIELE } from "./anwender-beispiele";
/* Die fünf Anwenderseiten (Menü „Anwender“); Nutzen je Rolle, mit Rollenname */
export const BRANCHEN: Branche[] = ANWENDER_GRUPPEN.map((g) => {
  return {
    icon: g.icon,
    watch: g.watch,
    beleg: g.beleg,
    video: g.video,
    xauszug: g.xauszug,
    kopf: g.kopf,
    plenarax: g.plenarax,
    keywords: g.keywords,
    flowTitle: g.flowTitle,
    steps: g.steps,
    reported: g.reported,
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
