// Investorenpräsentation Plenara (12 Folien, wenige Worte, große Aussagen)
//   node build-investoren.mjs [ausgabe.pptx]     (vorher: npm install in docs/design/tools)
// Vorlage, Bausteine und Bilder: deck-lib.mjs. Prüfung ohne PowerPoint: render-praesentation.mjs <datei>.
// Zahlen: Startseite und /analytics/ueber von plenara.de (Stand 15.10.26), docs/videos/facts.json;
// Plan und Preise: docs/strategie/kommerzialisierungsstrategie.md (Stand 02.10.26), als Plan gekennzeichnet.
import { pres, C, HEX, SB, b64, LOGO, RATIO, IMG, textH, slide, head, T, card, iconCircle, stat, picture, OUT_DIR, join, finish } from "./deck-lib.mjs";
const OUT = process.argv[2] || join(OUT_DIR, "plenara-investoren.pptx");

/** Drei Spalten mit Symbol, großer Aussage und einem Satz */
function columns(s, items, { y = 1.6, headPt = 16, bodyPt = 12, h = 3.2 } = {}) {
  const n = items.length, gap = 0.3, w = (9 - gap * (n - 1)) / n;
  items.forEach(([icn, h1, body], i) => {
    const x = 0.5 + i * (w + gap);
    iconCircle(s, icn, x, y, 0.5);
    const hh = textH(h1, headPt, true, w);
    T(s, h1, { x, y: y + 0.7, w, h: hh + 0.02, fontSize: headPt, fontFace: SB });
    T(s, body, { x, y: y + 0.78 + hh, w, h: h - 0.8 - hh, fontSize: bodyPt, color: C.accent3 });
  });
}

pres.addSection({ title: "Investoren" });

// 1 Titel
{
  const s = slide("DUNKEL", "Investoren", "Plenara führt die Ratsinformationssysteme der Kommunen zu einem Portal zusammen: suchen, früh erfahren, verstehen.");
  s.addImage({ data: b64(LOGO.dark), x: 0.75, y: 1.05, w: 4.4, h: 4.4 / RATIO.logoDark });
  T(s, "Besser verstehen,\nwas vor Ort beraten wird.", { x: 0.8, y: 2.85, w: 8.4, h: 1.3, fontSize: 32, fontFace: SB, color: C.background1 });
  T(s, "Investorenpräsentation  ·  Oktober 2026  ·  www.plenara.de", { x: 0.8, y: 4.55, w: 8.4, h: 0.3, fontSize: 12, color: C.accent4 });
}

// 2 Problem
{
  const s = slide("HELL", "Investoren", "Kommunale Entscheidungen sind öffentlich, aber auf über 8.000 Systeme verteilt. Wer Aufträge, Flächen oder Standorte sucht, erfährt davon zu spät und beobachtet von Hand.");
  head(s, "Das Problem", "Öffentlich beschlossen, praktisch unsichtbar");
  columns(s, [
    ["FiGrid", "8.000 Systeme", "Jede Kommune veröffentlicht Beschlüsse in ihrem eigenen Ratsinformationssystem. Keines ist über Ortsgrenzen hinweg durchsuchbar."],
    ["FiClock", "Zu spät", "Wer Aufträge, Flächen oder Standorte sucht, liest davon im Amtsblatt oder in der Presse. Dann ist längst entschieden."],
    ["FiEye", "Von Hand", "Teams beobachten 10 bis 20 Kommunen. Der entscheidende Vorgang kommt aus einer, die nicht auf der Liste steht."],
  ]);
}

// 3 Lösung
{
  const s = slide("HELL", "Investoren", "Plenara: eine Suche über ganz Deutschland, Alarme per E-Mail, Analysen über alle Kommunen. Live auf plenara.de, Suche ohne Anmeldung.");
  head(s, "Die Lösung", "Ein Portal für alles, was vor Ort beraten wird");
  const items = [
    ["FiSearch", "Suchen", "Ein Begriff, ganz Deutschland, jeder Treffer mit Stand und Originalquelle."],
    ["FiBell", "Früh erfahren", "Alarme per E-Mail, sobald ein Thema auf eine Tagesordnung kommt."],
    ["FiBarChart2", "Verstehen", "plenara.X zählt Vorgänge über alle Kommunen: Signale, Fakten, Trends."],
  ];
  let y = 1.6;
  for (const [icn, h1, body] of items) {
    iconCircle(s, icn, 0.5, y, 0.5);
    T(s, h1, { x: 1.15, y: y - 0.02, w: 3.0, h: 0.32, fontSize: 16, fontFace: SB });
    const bh = textH(body, 12, false, 3.0);
    T(s, body, { x: 1.15, y: y + 0.32, w: 3.0, h: bh + 0.02, fontSize: 12, color: C.accent3 });
    y += 0.32 + bh + 0.42;
  }
  picture(s, IMG.start, 4.9, 1.5, 4.6, { maxH: 3.5 });
}

// 4 Stand heute
{
  const s = slide("HELL", "Investoren", "Der Datenbestand steht: 8.076 Kommunen und Gebiete, 1,39 Millionen Berichte, 160.000 neue je Monat, Abruf alle 10 Minuten. Zahlen von der Startseite, Stand 15.10.26.");
  head(s, "Stand heute", "Live mit 8.076 Kommunen und Gebieten");
  const tiles = [["8.076", "Kommunen und Gebiete angebunden"], ["1,39 Mio.", "Berichte aus Räten und Ausschüssen"], ["160.000", "neue Berichte in den letzten 30 Tagen"], ["10 Min.", "Abstand zwischen zwei Abrufen"]];
  tiles.forEach(([v, l], i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, 1.6, 2.15, 1.7);
    stat(s, x + 0.2, 1.8, 1.8, v, l, { size: 30, labelPt: 11 });
  });
  T(s, "Von Berichten zu Antworten: Jeder Vorgang wird eingeordnet (Thema, Stand, Werte aus den Unterlagen) und führt zur Originalquelle. Suche und Karte sind ohne Anmeldung nutzbar; Konten, Alarme und plenara.X laufen in der Testphase.", { x: 0.5, y: 3.6, w: 9, h: 0.9, fontSize: 13, color: C.text1 });
  T(s, "Stand 15.10.26, plenara.de", { x: 0.5, y: 4.7, w: 9, h: 0.25, fontSize: 9.5, color: C.accent4 });
}

// 5 Produkt in Bildern
{
  const s = slide("HELL", "Investoren", "Beispiel Windkraft: 1.108 Treffer über alle Kommunen, Zahlen je Gebiet auf der Karte, jeder Vorgang mit Verlauf durch die Gremien und Originalunterlage.");
  head(s, "Das Produkt", "Vom Treffer zur Originalquelle in zwei Klicks");
  picture(s, IMG.karte, 0.5, 1.55, 4.9, { maxH: 3.1 });
  picture(s, IMG.artikel, 5.65, 1.55, 3.85, { maxH: 3.1 });
  T(s, "„Windkraft“: 1.108 Treffer, Zahlen je Gebiet auf der Karte", { x: 0.5, y: 4.7, w: 4.9, h: 0.3, fontSize: 10.5, color: C.accent3 });
  T(s, "Artikel mit Auszug aus der Vorlage und Link zur Quelle", { x: 5.65, y: 4.7, w: 3.85, h: 0.3, fontSize: 10.5, color: C.accent3 });
}

// 6 plenara.X
{
  const s = slide("HELL", "Investoren", "plenara.X macht aus dem Bestand Antworten: Signale (wo entsteht ein Auftrag), Fakten (was kostet es wo), Ausbreitung (wie schnell greift ein Thema um sich). Regelbasiert, gemessen, jede Zahl mit Quelle.");
  head(s, "plenara.X", "Aus Beratungen werden Antworten");
  columns(s, [
    ["FiRadio", "Wo entsteht ein Auftrag?", "Signale: Wind, Solar, Wärme, Wohnbau, Gewerbe, Glasfaser, Schulen. Je Vorgang Ort, Stand des Verfahrens und Quelle."],
    ["FiMap", "Was kostet es wo?", "Fakten: Hebesätze, Gebühren, Grundstückspreise je Gemeinde auf der Karte, mit Kreis- und Landesvergleich."],
    ["FiTrendingUp", "Wie schnell greift ein Thema um sich?", "Ausbreitung: 2.499 Kommunen haben „Photovoltaik“ seit Oktober 2025 erstmals beraten. Wer zuerst dran war, wer folgt, wo es noch fehlt."],
  ], { h: 2.6 });
  s.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 4.3, w: 9, h: 0.6, rectRadius: 0.1, fill: { color: C.accent5 }, line: { color: C.accent5, width: 0 } });
  T(s, [{ text: "Regelbasiert und gemessen: ", options: { fontFace: SB } }, { text: "kein Modell im Ablauf, Freigabe erst ab 90 % geprüfter Qualität, jede Zahl führt zu den Vorgängen und Originalquellen." }], { x: 0.7, y: 4.35, w: 8.6, h: 0.5, fontSize: 11.5, color: C.accent2, valign: "middle" });
}

// 7 Markt
{
  const s = slide("HELL", "Investoren", "Erster Markt: Projektierer für Wind, Solar und Speicher, die früh wissen müssen, was Räte planen. Zahlungsbereitschaft ist bei vergleichbaren Ausschreibungsdiensten belegt (2.000 bis 6.000 Euro je Jahr). Danach Bau, Glasfaser, Verbände, Agenturen, Presse. Die kostenlose Suche bringt Reichweite.");
  head(s, "Markt", "Wer früh wissen muss, was Räte planen");
  const rows = [
    ["FiWind", "Projektierer Wind, Solar, Speicher", "Einstiegssegment: jede Fläche beginnt mit einem Ratsbeschluss. Zahlungsbereitschaft bei vergleichbaren Diensten belegt: 2.000 bis 6.000 € je Jahr."],
    ["FiTruck", "Bau, Glasfaser, Wohnungswirtschaft", "Aufträge, bevor sie ausgeschrieben werden; Bebauungspläne und Markterkundungen, bevor sie öffentlich ausliegen."],
    ["FiUsers", "Verbände, Agenturen, Presse", "Viele Orte, ein Werkzeug: Mandanten-Suchen, Fakten je Gemeinde, Meldungen mit Zitat und Quelle."],
    ["FiHome", "Fraktionen, Bürgerinnen und Bürger", "Kostenlose Suche als Reichweitenflanke: Sichtbarkeit, Zitate in der Presse, Anfragen."],
  ];
  let y = 1.55;
  for (const [icn, h1, body] of rows) {
    s.addShape(pres.ShapeType.line, { x: 0.5, y, w: 9, h: 0, line: { color: C.accent6, width: 0.75 } });
    iconCircle(s, icn, 0.5, y + 0.17, 0.42);
    T(s, h1, { x: 1.1, y: y + 0.15, w: 3.1, h: 0.5, fontSize: 13, fontFace: SB });
    T(s, body, { x: 4.4, y: y + 0.15, w: 5.1, h: 0.6, fontSize: 11, color: C.accent3 });
    y += 0.82;
  }
  s.addShape(pres.ShapeType.line, { x: 0.5, y, w: 9, h: 0, line: { color: C.accent6, width: 0.75 } });
}

// 8 Geschäftsmodell
{
  const s = slide("HELL", "Investoren", "Abo-Erlöse ohne Beratungsaufwand: Self-Service für Einzelnutzer und Teams, Enterprise mit plenara.X für Verbände und Agenturen, später ein Daten-Feed an Nicht-Wettbewerber. Preiskorridor aus der Strategie vom 02.10.26, als Plan gekennzeichnet.");
  head(s, "Geschäftsmodell", "Abo-Erlöse, Software statt Beratung");
  const cols = [
    ["FiUser", "Self-Service", "149 bis 990 € je Monat", "Einzelnutzer und Teams: Suche, Alarme, Export. Monatlich kündbar, Start ohne Gespräch."],
    ["FiBriefcase", "Enterprise", "ab 6.000 € je Jahr", "Verbände, Agenturen, Konzerne: Mandanten-Suchen, Reporting, plenara.X mit allen Analysen."],
    ["FiDatabase", "Daten-Feed", "ab Phase 3", "Strukturierte Vorgänge als Feed, nur an Nicht-Wettbewerber. Zweitverwertung derselben Infrastruktur."],
  ];
  const w = 2.9, gap = 0.15, y = 1.55, h = 2.55;
  cols.forEach(([icn, h1, price, body], i) => {
    const x = 0.5 + i * (w + gap) + (9 - (3 * w + 2 * gap)) / 2;
    card(s, x, y, w, h);
    iconCircle(s, icn, x + 0.25, y + 0.25, 0.44);
    T(s, h1, { x: x + 0.25, y: y + 0.85, w: w - 0.5, h: 0.3, fontSize: 14, fontFace: SB });
    T(s, price, { x: x + 0.25, y: y + 1.15, w: w - 0.5, h: 0.35, fontSize: 16, fontFace: SB, color: C.accent2 });
    T(s, body, { x: x + 0.25, y: y + 1.6, w: w - 0.5, h: 0.9, fontSize: 11, color: C.accent3 });
  });
  T(s, "Preise: Plan aus der Kommerzialisierungsstrategie (Stand 02.10.26), in der Testphase auf Anfrage. Die kostenlose Suche bleibt als Reichweitenflanke; Förderung nur für den offenen Datensockel, nie für den Kern.", { x: 0.5, y: 4.3, w: 9, h: 0.6, fontSize: 10.5, color: C.accent3 });
}

// 9 Warum Plenara
{
  const s = slide("HELL", "Investoren", "Vier Dinge, die schwer zu kopieren sind: der vollständige Zulauf aus über 8.000 Systemen, Struktur statt Volltext, belegbare Zahlen mit offen gezeigter Abdeckung, ein Portal für Suche, Alarme und Analysen.");
  head(s, "Warum Plenara", "Vier Dinge, die schwer zu kopieren sind");
  const items = [
    ["FiDownload", "Der Zulauf", "8.076 Systeme angebunden, alle 10 Minuten neue Berichte, nachts vollständig. Jahre an Anbindungsarbeit, die niemand überspringt."],
    ["FiLayers", "Struktur statt Volltext", "Jeder Bericht wird zum Vorgang: Thema, Stand, Verlauf durch die Gremien, Werte aus den Unterlagen. Regelbasiert und gemessen."],
    ["FiShield", "Belegbar", "Jede Zahl führt zur Originalquelle. Abdeckung und Grenzen werden offen gezeigt, vor dem Kauf."],
    ["FiBox", "Ein Portal", "Suche, Alarme und Analysen aus einem Bestand. Jede neue Auswertung nutzt denselben Weg, ohne neues Datenmodell."],
  ];
  items.forEach(([icn, h1, body], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 4.65, y = 1.6 + row * 1.65;
    iconCircle(s, icn, x, y, 0.46);
    T(s, h1, { x: x + 0.6, y: y - 0.02, w: 3.7, h: 0.32, fontSize: 15, fontFace: SB });
    T(s, body, { x: x + 0.6, y: y + 0.33, w: 3.7, h: 1.1, fontSize: 11.5, color: C.accent3 });
  });
}

// 10 Warum jetzt
{
  const s = slide("HELL", "Investoren", "Warum jetzt: Energiewende und Wärmeplanung erzeugen in jeder Region Tausende Vorgänge; die Ratsinformationssysteme sind flächendeckend online; der Datenbestand von Plenara steht, der Vertrieb kann starten.");
  head(s, "Warum jetzt", "Drei Gründe");
  columns(s, [
    ["FiSun", "Die Nachfrage ist da", "Wind, Solar, Speicher, Wärmeplanung, Glasfaser: Jede Fläche und jeder Auftrag beginnt mit einem Ratsbeschluss. 2.499 Kommunen haben allein Photovoltaik in einem Jahr neu beraten."],
    ["FiGlobe", "Die Quellen sind offen", "Ratsinformationssysteme sind flächendeckend online, ein Teil davon mit offener Schnittstelle. Unterlagen sind öffentliche Dokumente."],
    ["FiCheckCircle", "Der Bestand steht", "1,39 Millionen Berichte, laufend aktualisiert, strukturiert und belegbar. Was fehlt, ist Vertrieb, nicht Technik."],
  ]);
}

// 11 Nächste Schritte
{
  const s = slide("HELL", "Investoren", "Plan aus der Kommerzialisierungsstrategie (02.10.26): erst Fundament und Piloten bei Projektierern, dann Self-Service und zahlende Kunden, dann Daten-Feed und weitere Segmente.");
  head(s, "Nächste Schritte", "Vom Datenbestand zum Umsatz");
  const phases = [
    ["1", "Monat 1 bis 3", "Fundament", "Konten, Alarme und Preise live. Zielregionen ohne Lücken. 100 persönliche Kontakte, 10 Demos, erste Pilotrechnungen."],
    ["2", "Monat 4 bis 9", "Kunden", "Piloten werden Kunden, Self-Service-Abschluss ohne Gespräch. Ziel: 8 bis 10 zahlende Kunden."],
    ["3", "Monat 10 bis 18", "Skalierung", "Daten-Feed an Nicht-Wettbewerber, weitere Segmente und Regionen, Enterprise mit plenara.X."],
  ];
  const w = 2.9, gap = 0.15, y = 1.6, h = 2.5;
  phases.forEach(([num, when, h1, body], i) => {
    const x = 0.5 + i * (w + gap) + (9 - (3 * w + 2 * gap)) / 2;
    card(s, x, y, w, h);
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 } });
    T(s, num, { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, fontSize: 16, fontFace: SB, color: C.background1, align: "center", valign: "middle" });
    T(s, when, { x: x + 0.9, y: y + 0.3, w: w - 1.1, h: 0.25, fontSize: 10, color: C.accent3 });
    T(s, h1, { x: x + 0.9, y: y + 0.5, w: w - 1.1, h: 0.3, fontSize: 15, fontFace: SB });
    T(s, body, { x: x + 0.25, y: y + 1.05, w: w - 0.5, h: 1.4, fontSize: 11.5, color: C.accent3 });
  });
  T(s, "Plan, Stand 02.10.26. Messgrößen je Phase: Demos, Pilotrechnungen, zahlende Kunden, monatlich wiederkehrender Umsatz.", { x: 0.5, y: 4.35, w: 9, h: 0.5, fontSize: 10.5, color: C.accent3 });
}

// 12 Schluss
{
  const s = slide("DUNKEL", "Investoren", "Abschluss und Gesprächseinladung.");
  s.addImage({ data: b64(LOGO.dark), x: 0.75, y: 1.05, w: 3.2, h: 3.2 / RATIO.logoDark });
  T(s, "Besser verstehen,\nwas vor Ort beraten wird.", { x: 0.8, y: 2.5, w: 8.4, h: 1.3, fontSize: 32, fontFace: SB, color: C.background1 });
  T(s, "Max Espelkott  ·  www.plenara.de", { x: 0.8, y: 3.95, w: 8.4, h: 0.4, fontSize: 16, fontFace: SB, color: C.accent1 });
  T(s, "Suche und Karte sind ohne Anmeldung offen: plenara.de. Alle Zahlen dieser Präsentation stammen von der Seite selbst (Stand 15.10.26) oder sind als Plan gekennzeichnet.", { x: 0.8, y: 4.45, w: 7.5, h: 0.6, fontSize: 11, color: C.accent4 });
}

await finish(OUT);
