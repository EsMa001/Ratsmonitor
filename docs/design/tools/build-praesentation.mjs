// Firmenpräsentation Plenara (ausführliche Produktfassung, 18 Folien)
//   node build-praesentation.mjs [ausgabe.pptx]     (vorher: npm install in docs/design/tools)
// Vorlage, Bausteine und Bilder: deck-lib.mjs. Prüfung ohne PowerPoint: render-praesentation.mjs.
import { pres, C, HEX, SB, b64, LOGO, RATIO, IMG, textH, slide, head, T, card, iconCircle, squareList, stat, picture, CHART_BASE, OUT_DIR, join, finish } from "./deck-lib.mjs";
const OUT = process.argv[2] || join(OUT_DIR, "plenara-firmenpraesentation.pptx");

pres.addSection({ title: "Plenara" });

// 1 Titel
{
  const s = slide("DUNKEL", "Plenara", "Begrüßung. Plenara ist ein Portal, das die öffentlichen Ratsinformationssysteme der Kommunen zusammenführt. Der Slogan ist fest: „Besser verstehen, was vor Ort beraten wird.“");
  s.addImage({ data: b64(LOGO.dark), x: 0.75, y: 1.05, w: 4.4, h: 4.4 / RATIO.logoDark });
  T(s, "Besser verstehen,\nwas vor Ort beraten wird.", { x: 0.8, y: 2.85, w: 8.4, h: 1.3, fontSize: 32, fontFace: SB, color: C.background1 });
  T(s, "Firmenpräsentation  ·  Stand 15.10.26  ·  www.plenara.de", { x: 0.8, y: 4.55, w: 8.4, h: 0.3, fontSize: 12, color: C.accent4 });
}

// 2 Ausgangslage
{
  const s = slide("HELL", "Plenara", "Ausgangslage: Beschlüsse stehen zuerst in den Ratsinformationssystemen, lange vor Presse und Ausschreibung. Jede Kommune betreibt ihr eigenes System. Die Zahlen stammen von der Startseite plenara.de, Stand 15.10.26.");
  head(s, "Ausgangslage", "Was vor Ort beraten wird, steht in über 8.000 Systemen");
  squareList(s, [
    ["Beschlüsse stehen zuerst im Ratsinformationssystem", "Bebauungspläne, Vergaben, Gebühren und Standorte werden dort beraten, bevor Presse oder Ausschreibung davon berichten."],
    ["Jede Kommune hat ihr eigenes System", "Wer mehrere Orte oder ein Thema verfolgt, muss täglich viele Portale öffnen und durchsuchen."],
    ["Plenara führt sie zusammen", "Ein Portal, eine Suche, ein Stand für ganz Deutschland. Jede Angabe führt zur Originalquelle."],
  ], 0.5, 1.55, 4.5);
  const img = picture(s, IMG.start, 5.4, 1.45, 1.75, { frame: false });
  let y = 1.5;
  for (const [v, l] of [["8.076", "Kommunen und Gebiete mit Ratsinformationssystem"], ["1.394.044", "Berichte aus Räten und Ausschüssen"], ["160.340", "Berichte in den letzten 30 Tagen"]]) {
    y = stat(s, 7.4, y, 2.2, v, l) + 0.28;
  }
  T(s, "Stand 15.10.26, plenara.de", { x: 7.4, y: 4.75, w: 2.2, h: 0.25, fontSize: 9, color: C.accent4 });
}

// 3 Auf einen Blick
{
  const s = slide("HELL", "Plenara", "Die drei Bausteine: Suche mit Karte, Benachrichtigungen, plenara.X. Die Suche ist kostenlos nutzbar, plenara.X gehört zum Tarif Enterprise.");
  head(s, "Plenara auf einen Blick", "Ein Portal statt vieler Systeme");
  const cards = [
    ["FiSearch", "Suche und Karte", "Ganz Deutschland mit einem Begriff, Treffer auf der Karte, Stand jedes Vorgangs auf einen Blick.", ["Filter: Zeitraum, Thema, Status, Umkreis", "Export als Excel, CSV oder PDF", "Suche ohne Anmeldung nutzbar"]],
    ["FiBell", "Benachrichtigungen", "Alarme per E-Mail statt tägliches Suchen: sofort, täglich oder am Wunschtag.", ["Gespeicherte Suchen mit Glocke", "Wochenbericht am Wunschtag", "Sitzungskalender zum Abonnieren"]],
    ["FiBarChart2", "plenara.X", "Analysen über alle Kommunen: Signale, Fakten, Atlas und Tools, jede Zahl mit Vorgängen und Quelle.", ["Regelbasiert, kein KI-Modell im Ablauf", "Freigabe erst ab 90 % gemessener Qualität", "Teil des Tarifs Enterprise"]],
  ];
  const cw = 2.9, gap = 0.25, cy = 1.5, ch = 3.45;
  cards.forEach(([icn, h1, body, items], i) => {
    const x = 0.5 + i * (cw + gap);
    card(s, x, cy, cw, ch);
    iconCircle(s, icn, x + 0.25, cy + 0.25);
    T(s, h1, { x: x + 0.25, y: cy + 0.85, w: cw - 0.5, h: 0.3, fontSize: 15, fontFace: SB });
    const bh = textH(body, 11.5, false, cw - 0.5);
    T(s, body, { x: x + 0.25, y: cy + 1.2, w: cw - 0.5, h: bh + 0.02, fontSize: 11.5, color: C.accent3 });
    let y = cy + 1.2 + bh + 0.25;
    for (const it of items) {
      s.addShape(pres.ShapeType.rect, { x: x + 0.25, y: y + 0.05, w: 0.08, h: 0.08, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 } });
      const ih = textH(it, 11, false, cw - 0.75);
      T(s, it, { x: x + 0.45, y, w: cw - 0.7, h: ih + 0.02, fontSize: 11 });
      y += ih + 0.1;
    }
  });
}

// 4 Datenfluss
{
  const s = slide("HELL", "Plenara", "So entsteht der Datenbestand: Abruf alle 10 Minuten, Unterlagen als PDF mit Textebene und OCR, feste Regeln je Bericht, daraus Suche, Alarme und plenara.X. Kurzfassungen in der Suche tragen ein KI-Label; plenara.X selbst arbeitet ohne Modell.");
  head(s, "So entsteht der Datenbestand", "Vom Ratsinformationssystem zur Antwort");
  const steps = [
    ["FiDownload", "Abruf", "Alle 10 Minuten neue Berichte aus den Ratsinformationssystemen, nachts vollständig."],
    ["FiFileText", "Unterlagen", "Hauptdokument als PDF, Textebene lesen, Scans per OCR."],
    ["FiLayers", "Regeln", "Art des Punkts, Thema, Stand und Werte nach festen Regeln je Bericht."],
    ["FiSearch", "Suche und Alarme", "Trefferliste, Karte, Zeitstrahl; gespeicherte Suchen lösen E-Mails aus."],
    ["FiBarChart2", "plenara.X", "Vorgänge über alle Kommunen zählen: Signale, Fakten, Atlas, Tools."],
  ];
  const cw = 1.68, gap = 0.21, cy = 1.55, ch = 2.35, x0 = 0.5 + (9 - (5 * cw + 4 * gap)) / 2;
  steps.forEach(([icn, h1, body], i) => {
    const x = x0 + i * (cw + gap);
    card(s, x, cy, cw, ch);
    iconCircle(s, icn, x + 0.2, cy + 0.2, 0.4);
    T(s, String(i + 1), { x: x + cw - 0.5, y: cy + 0.22, w: 0.3, h: 0.3, fontSize: 12, fontFace: SB, color: C.accent4, align: "right" });
    const hh = textH(h1, 12.5, true, cw - 0.4);
    T(s, h1, { x: x + 0.2, y: cy + 0.75, w: cw - 0.4, h: hh + 0.02, fontSize: 12.5, fontFace: SB });
    T(s, body, { x: x + 0.2, y: cy + 0.8 + hh, w: cw - 0.4, h: ch - 0.9 - hh, fontSize: 10.5, color: C.accent3 });
    if (i < 4) T(s, "›", { x: x + cw, y: cy + ch / 2 - 0.2, w: gap, h: 0.4, fontSize: 16, color: C.accent4, align: "center", valign: "middle" });
  });
  s.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 4.15, w: 9, h: 0.75, rectRadius: 0.1, fill: { color: C.accent5 }, line: { color: C.accent5, width: 0 } });
  iconCircle(s, "FiCheckCircle", 0.7, 4.3, 0.44, { bg: C.background1 });
  T(s, [
    { text: "Jede Angabe führt zur Originalquelle. ", options: { fontFace: SB } },
    { text: "plenara.X arbeitet rein regelbasiert und ohne KI-Modell; Kurzfassungen in der Suche sind als KI-Text gekennzeichnet. Der Server erzeugt alles aus den Unterlagen der Kommunen." },
  ], { x: 1.3, y: 4.25, w: 8, h: 0.6, fontSize: 11.5, valign: "middle", color: C.accent2 });
}

// 5 Für wen
{
  const s = slide("HELL", "Plenara", "Zielgruppen und ihre Fragen. Branchen nutzen Signale und Alarme, Verbände und Kämmereien die Fakten, Politik und Presse die Tools. Die Suche ist für alle offen.");
  head(s, "Für wen", "Vier Gruppen, vier Fragen");
  const rows = [
    ["FiTruck", "Branchen", "Bau, Ingenieurbüros, Energie, Projektentwicklung, Telekommunikation, Mobilität", "Wo entsteht gerade etwas, das für uns ein Auftrag werden kann?", "Signale, Alarme, Suche"],
    ["FiUsers", "Verbände und Verwaltung", "Verbände, Kämmereien, Wirtschaftsförderung, Beratung", "Was kostet es wo, wo steigt es? Steuern, Gebühren, Haushalt, Preise", "Fakten, Atlas, Ortsvergleich"],
    ["FiMic", "Politik und Presse", "Fraktionen, Redaktionen, Forschung", "Wer beantragt was, wie entscheiden Gremien, was ist berichtenswert?", "Tools, Newsradar, Fraktionsprofil"],
    ["FiHome", "Bürgerinnen und Bürger", "Ehrenamt, Vereine, Nachbarschaft", "Was wird in meinem Ort beraten, und wann ist die Sitzung?", "Suche kostenlos, Kalender, Benachrichtigungen"],
  ];
  const cols = { icon: 0.5, who: 1.1, q: 4.0, what: 7.3 };
  T(s, "GRUPPE", { x: cols.who, y: 1.45, w: 2.7, h: 0.25, fontSize: 9, fontFace: SB, color: C.accent4, charSpacing: 1.5 });
  T(s, "FRAGE", { x: cols.q, y: 1.45, w: 3.1, h: 0.25, fontSize: 9, fontFace: SB, color: C.accent4, charSpacing: 1.5 });
  T(s, "IN PLENARA", { x: cols.what, y: 1.45, w: 2.2, h: 0.25, fontSize: 9, fontFace: SB, color: C.accent4, charSpacing: 1.5 });
  let y = 1.8;
  const rh = 0.8;
  for (const [icn, who, sub, q, what] of rows) {
    s.addShape(pres.ShapeType.line, { x: 0.5, y, w: 9, h: 0, line: { color: C.accent6, width: 0.75 } });
    iconCircle(s, icn, cols.icon, y + 0.17, 0.4);
    T(s, who, { x: cols.who, y: y + 0.14, w: 2.7, h: 0.25, fontSize: 12.5, fontFace: SB });
    T(s, sub, { x: cols.who, y: y + 0.4, w: 2.7, h: 0.48, fontSize: 9.5, color: C.accent3 });
    T(s, q, { x: cols.q, y: y + 0.14, w: 3.1, h: 0.6, fontSize: 11, color: C.text1 });
    T(s, what, { x: cols.what, y: y + 0.14, w: 2.2, h: 0.6, fontSize: 11, fontFace: SB, color: C.accent2 });
    y += rh;
  }
  s.addShape(pres.ShapeType.line, { x: 0.5, y, w: 9, h: 0, line: { color: C.accent6, width: 0.75 } });
}

// 6 Trenner
{
  const s = slide("TRENNER", "Plenara", "Teil 1: die Oberfläche von Plenara anhand echter Seiten vom 15.10.26.");
  T(s, "1", { x: 0.8, y: 1.6, w: 1, h: 0.5, fontSize: 14, fontFace: SB, color: C.accent1 });
  s.addText("Plenara", { placeholder: "title" });
  s.addText("Suche, Karte, Artikel und Benachrichtigungen", { placeholder: "sub" });
}

// 7 Suche und Karte
{
  const s = slide("HELL", "Plenara", "Beispiel „Windkraft“ ohne Ortswahl: 1.108 Treffer über alle Kommunen, Zahlen je Gebiet auf der Karte. Stand der Suche 11.10.26. Filter: Zeitraum, Thema, Status, Umkreis, exakter Begriff.");
  head(s, "Suche und Karte", "Ganz Deutschland mit einem Begriff");
  squareList(s, [
    ["1.108 Treffer für „Windkraft“", "Ohne Ortswahl über alle Kommunen, Stand der Suche 11.10.26."],
    ["Zahlen je Gebiet auf der Karte", "Flächen, Punkte und Häufungen; ein Klick auf ein Gebiet zeigt dessen Beschlüsse."],
    ["Gezielt eingrenzen", "Zeitraum, Thema, Status, Umkreis, künftige Sitzungen, exakter Begriff."],
    ["Ort direkt erkannt", "Stadt, Gemeinde, Kreis oder Region in derselben Suchleiste."],
  ], 0.5, 1.55, 3.5);
  picture(s, IMG.karte, 4.35, 1.5, 5.15, { maxH: 3.45 });
}

// 8 Trefferliste
{
  const s = slide("HELL", "Plenara", "Die Trefferliste zeigt zu jedem Vorgang den Zeitstrahl: Ortschaftsrat, Ausschuss, Rat, jeweils mit Datum und Stand. Status erscheint als schlichter Text. Export als Excel oder CSV.");
  head(s, "Trefferliste", "Stand jedes Vorgangs auf einen Blick");
  picture(s, IMG.liste, 0.5, 1.5, 9, { maxH: 2.3 });
  const cols = [
    ["FiClock", "Zeitstrahl", "Vom Ortschaftsrat über den Ausschuss bis zum Rat, mit Datum und Stand jeder Station."],
    ["FiCheckCircle", "Status als Text", "Angekündigt, in Beratung, beschlossen, vertagt, abgelehnt: ohne bunte Abzeichen."],
    ["FiDownload", "Export", "Trefferliste als Excel oder CSV, jeder Artikel als PDF oder zum Drucken."],
  ];
  cols.forEach(([icn, h1, body], i) => {
    const x = 0.5 + i * 3.1;
    iconCircle(s, icn, x, 4.05, 0.4);
    T(s, h1, { x: x + 0.55, y: 4.07, w: 2.3, h: 0.3, fontSize: 12.5, fontFace: SB });
    T(s, body, { x: x + 0.55, y: 4.35, w: 2.35, h: 0.7, fontSize: 10.5, color: C.accent3 });
  });
}

// 9 Artikel
{
  const s = slide("HELL", "Plenara", "Jeder Artikel zeigt den Auszug aus der Vorlage mit Originalsätzen, Vorlagennummer und Link zur Quelle. Rechts die Angaben auf einen Blick: Sitzung, Gremium, Vorlage, Gebiet, Stand, Quellenstand.");
  head(s, "Artikel", "Jede Angabe mit Originalquelle");
  picture(s, IMG.artikel, 0.5, 1.5, 5.6, { maxH: 3.45 });
  squareList(s, [
    ["Auszug aus der Vorlage", "Originalsätze mit Vorlagennummer und Link zur Quelle im Ratsinformationssystem."],
    ["Auf einen Blick", "Sitzung, Gremium, Vorlage, Gebiet, Stand und Quellenstand."],
    ["Verlauf", "Alle Stationen des Vorgangs mit ihren Unterlagen."],
    ["Merken, teilen, abonnieren", "Lesezeichen, Teilen, Glocke je Artikel, Export als PDF."],
  ], 6.5, 1.55, 3.0, { gap: 0.2 });
}

// 10 Benachrichtigungen
{
  const s = slide("HELL", "Plenara", "Benachrichtigungen: Jede Suche lässt sich speichern, neue Treffer kommen per E-Mail, sofort, täglich oder wöchentlich am Wunschtag. Dazu der Sitzungskalender zum Abonnieren.");
  head(s, "Benachrichtigungen", "Alarme per E-Mail statt tägliches Suchen");
  squareList(s, [
    ["Gespeicherte Suche mit Glocke", "Jede Suche lässt sich speichern; neue Treffer kommen per E-Mail."],
    ["Sofort, täglich oder wöchentlich", "Wochenbericht am Wunschtag, bis zu 5 Empfänger je Benachrichtigung (Enterprise)."],
    ["Sitzungskalender", "Sitzungen zu Ihren Themen abonnieren und keine Sitzung verpassen."],
    ["Fristen im Blick", "Auslegungen, Stellungnahmen und Vergaben rechtzeitig erfahren."],
  ], 0.5, 1.55, 3.9);
  picture(s, IMG.alarme, 4.75, 1.5, 4.75, { maxH: 3.45 });
}

// 11 Trenner plenara.X
pres.addSection({ title: "plenara.X" });
{
  const s = slide("TRENNER", "plenara.X", "Teil 2: plenara.X, der Analyse-Teil. Grundlage sind dieselben Ratsunterlagen wie in der Suche; plenara.X zählt Vorgänge über alle Kommunen.");
  T(s, "2", { x: 0.8, y: 1.6, w: 1, h: 0.5, fontSize: 14, fontFace: SB, color: C.accent1 });
  s.addImage({ data: b64(LOGO.xDark), x: 0.72, y: 2.1, w: 3.4, h: 3.4 / RATIO.xDark });
  s.addText("Analysen über alle Kommunen", { placeholder: "sub", y: 3.5 });
}

// 12 Ein Weg für alles
{
  const s = slide("HELL", "plenara.X", "Jede Auswertung geht denselben Weg: Auswahl über die normale Suche, Zählen der Vorgänge (Formalien nie, gleiche Titel je Gebiet einmal), Anreichern mit Thema, Art und Werten. Vier Seiten: Signale, Fakten, Atlas, Tools.");
  head(s, "plenara.X", "Ein Weg für alle Auswertungen");
  const steps = [
    ["FiFilter", "Auswahl", "über die normale Suche: Begriff, Ort, Zeitraum, Thema, Status"],
    ["FiHash", "Zählen", "Vorgänge statt Treffer: Formalien nie, gleiche Titel je Gebiet einmal"],
    ["FiLayers", "Anreichern", "Thema und Unterthema, Art des Vorgangs, Stand, Werte aus den Unterlagen"],
  ];
  const sw = 2.9, sg = 0.15, sy = 1.5, sh = 1.05, sx0 = 0.5 + (9 - (3 * sw + 2 * sg)) / 2;
  steps.forEach(([icn, h1, body], i) => {
    const x = sx0 + i * (sw + sg);
    card(s, x, sy, sw, sh, { fill: C.accent5, line: C.accent5 });
    iconCircle(s, icn, x + 0.2, sy + 0.3, 0.44, { bg: C.background1 });
    T(s, h1, { x: x + 0.78, y: sy + 0.2, w: sw - 0.95, h: 0.3, fontSize: 13, fontFace: SB, color: C.accent2 });
    T(s, body, { x: x + 0.78, y: sy + 0.47, w: sw - 0.95, h: 0.55, fontSize: 10, color: C.accent2 });
    if (i < 2) T(s, "›", { x: x + sw - 0.02, y: sy + sh / 2 - 0.2, w: sg + 0.04, h: 0.4, fontSize: 16, color: C.accent4, align: "center", valign: "middle" });
  });
  const pages = [
    ["FiRadio", "Signale", "Wo gerade etwas entsteht: Wohn- und Gewerbegebiete, Wind, Solar, Wärme, Schulen, Straßen, Mobilität. Je Vorgang Ort, Stand und Quelle."],
    ["FiMap", "Fakten", "Hebesätze, Gebühren, Jahresergebnisse und Grundstückspreise je Gemeinde auf der Karte. Nur Werte ab 90 % gemessener Qualität."],
    ["FiGrid", "Atlas", "Worüber die Räte beraten, nach den 10 Themen der Suche: Unterthemen, Verlauf, Orte und der Vergleich mit ähnlichen Gemeinden."],
    ["FiTool", "Tools", "Ausbreitung, Themennetz, Trends, Ortsvergleich, Beschlüsse, Beratungswege, Fraktionsprofil und Newsradar, mit jedem Suchbegriff."],
  ];
  const pw = 2.15, pg = 0.13, py = 2.78, ph = 2.3, px0 = 0.5 + (9 - (4 * pw + 3 * pg)) / 2;
  pages.forEach(([icn, h1, body], i) => {
    const x = px0 + i * (pw + pg);
    card(s, x, py, pw, ph);
    iconCircle(s, icn, x + 0.2, py + 0.2, 0.4);
    T(s, "plenara.X " + h1, { x: x + 0.2, y: py + 0.72, w: pw - 0.4, h: 0.3, fontSize: 12.5, fontFace: SB });
    T(s, body, { x: x + 0.2, y: py + 1.02, w: pw - 0.4, h: 1.22, fontSize: 10, color: C.accent3 });
  });
}

// 13 Signale
{
  const s = slide("HELL", "plenara.X", "Signale: zehn Kategorien von Ereignissen, je Vorgang Art (Filter) und Stand des Verfahrens. Die Qualität ist je Kategorie an 20 Stichproben gemessen (14.10.26); Kategorien ohne Messung sind nicht freigegeben.");
  head(s, "plenara.X Signale", "Wo gerade etwas entsteht");
  const cats = [["FiFileText", "Ausschreibungen und Vergaben"], ["FiHome", "Neue Wohnbaugebiete"], ["FiBriefcase", "Gewerbe- und Industrieflächen"], ["FiWind", "Windenergie"], ["FiSun", "Solarenergie"], ["FiThermometer", "Wärme und Energieeffizienz"], ["FiBookOpen", "Schulen, Kitas und Sportstätten"], ["FiHeart", "Pflege und Gesundheit"], ["FiShoppingCart", "Einzelhandel und Nahversorgung"], ["FiNavigation", "Mobilität"]];
  cats.forEach(([icn, name], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 2.35, y = 1.5 + row * 0.6;
    iconCircle(s, icn, x, y, 0.36);
    T(s, name, { x: x + 0.46, y: y + 0.02, w: 1.85, h: 0.36, fontSize: 10.5, valign: "middle" });
  });
  T(s, "Je Vorgang: Ort, Art als Filter (zum Beispiel Freiflächen-PV, Agri-PV, Dach-PV) und Stand des Verfahrens (Antrag, Bauleitplanung, Genehmigung, Vergabe).", { x: 0.5, y: 4.55, w: 4.5, h: 0.5, fontSize: 10, color: C.accent3 });
  s.addChart(pres.ChartType.bar, [{ name: "richtig", labels: ["Vergaben", "Windenergie", "Gewerbe", "Solar", "Wärme", "Wohnbau"], values: [20, 20, 19, 19, 18, 15] }], {
    ...CHART_BASE, x: 5.3, y: 1.45, w: 4.2, h: 3.0, barDir: "bar", catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: 20, valAxisMajorUnit: 5,
    title: "Richtig erkannt je 20 Stichproben", dataLabelPosition: "outEnd",
  });
  T(s, "Stichproben vom 14.10.26, nur Kategorien mit Messung. Freigabe im Produkt erst ab 90 % Qualität und 80 % Trefferquote.", { x: 5.3, y: 4.5, w: 4.2, h: 0.5, fontSize: 9.5, color: C.accent4 });
}

// 14 Ortsvergleich und Beschlüsse
{
  const s = slide("HELL", "plenara.X", "Beispiel Klimaschutz (Stand 08.10.26): Ortsvergleich zählt Beratungen je Ort; das Beschlüsse-Tool zeigt, wie Gremien entscheiden: 281 Beschlüsse, 54,7 % einstimmig, 26 % vertagt, 6,4 % abgelehnt, die Hälfte nach 14 Tagen entschieden.");
  head(s, "plenara.X Tools", "Zahlen statt Eindrücke: Ortsvergleich und Beschlüsse");
  s.addChart(pres.ChartType.bar, [{ name: "Beratungen", labels: ["Erfurt", "Münster", "Stuttgart", "Leipzig", "Mainz", "Köln"], values: [274, 49, 29, 25, 18, 5] }], {
    ...CHART_BASE, x: 0.5, y: 1.45, w: 4.7, h: 3.15, barDir: "bar", catAxisOrientation: "maxMin", valAxisMinVal: 0,
    title: "Beratungen zu „Klimaschutz“ je Ort", dataLabelPosition: "outEnd",
  });
  T(s, "Ortsvergleich, Stand 08.10.26", { x: 0.5, y: 4.65, w: 4.7, h: 0.25, fontSize: 9.5, color: C.accent4 });
  const tiles = [["281", "Beschlüsse zu Klimaschutz"], ["54,7 %", "davon einstimmig"], ["26 %", "vertagt oder verwiesen"], ["14 Tage", "bis die Hälfte entschieden war"]];
  tiles.forEach(([v, l], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 5.7 + col * 2.0, y = 1.55 + row * 1.45;
    card(s, x - 0.15, y - 0.15, 1.85, 1.25);
    stat(s, x, y, 1.6, v, l, { size: 24 });
  });
  T(s, "Beschlüsse-Tool, Beispiel „Klimaschutz“, Stand 08.10.26. 6,4 % der Vorgänge wurden abgelehnt.", { x: 5.55, y: 4.5, w: 3.95, h: 0.5, fontSize: 9.5, color: C.accent4 });
}

// 15 Ausbreitung und Fakten
{
  const s = slide("HELL", "plenara.X", "Ausbreitung zeigt, wer zuerst dran war und wie schnell andere folgten: 2.499 Kommunen haben Photovoltaik seit Oktober 2025 erstmals beraten. Fakten: Werte aus den Unterlagen je Gemeinde; auf der Karte erst ab 90 % gemessener Qualität, derzeit Bauleitplanung, Hebesätze und Fraktion.");
  head(s, "plenara.X Ausbreitung und Fakten", "Sehen, wie sich ein Thema ausbreitet");
  const p = picture(s, IMG.ausbreitung, 0.5, 1.5, 3.7);
  stat(s, 0.5, p.y + p.h + 0.2, 4.2, "2.499 Kommunen", "haben „Photovoltaik“ seit 10/2025 erstmals beraten. Ausbreitung, Stand 08.10.26.", { size: 20 });
  T(s, "Werte aus den Unterlagen", { x: 5.1, y: 1.5, w: 4.4, h: 0.3, fontSize: 13, fontFace: SB });
  T(s, "Je Gemeinde auf der Karte, rot bis grün, mit Kreis- und Landesmedian und den Vorgängen hinter jedem Wert.", { x: 5.1, y: 1.82, w: 4.4, h: 0.5, fontSize: 10.5, color: C.accent3 });
  const facts = ["Hebesätze", "Wasser- und Abwassergebühr", "Schritt der Wärmeplanung", "Zuschüsse an Vereine", "Bauleitplanung, Wohnbau", "Kita-Gebühren", "Jahresergebnis", "Wind- und Solarleistung", "Gewerbegrundstückspreise", "Hundesteuer"];
  facts.forEach((f, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 5.1 + col * 2.25, y = 2.45 + row * 0.33;
    s.addShape(pres.ShapeType.rect, { x, y: y + 0.08, w: 0.08, h: 0.08, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 } });
    T(s, f, { x: x + 0.18, y, w: 2.07, h: 0.3, fontSize: 10 });
  });
  s.addShape(pres.ShapeType.roundRect, { x: 5.1, y: 4.2, w: 4.4, h: 0.75, rectRadius: 0.1, fill: { color: C.accent5 }, line: { color: C.accent5, width: 0 } });
  T(s, [{ text: "Qualitätstor: ", options: { fontFace: SB } }, { text: "auf der Karte erst ab 90 % gemessener Qualität, derzeit Bauleitplanung, Hebesätze und Fraktion. Nur ausdrücklich genannte Werte, keine Schätzungen." }], { x: 5.3, y: 4.27, w: 4.05, h: 0.62, fontSize: 10, color: C.accent2, valign: "middle" });
}

// 16 Qualität
{
  const s = slide("HELL", "plenara.X", "Grenzen offen benannt: Die Regeln sind gemessen (frische Stichproben 14.10.26): Formalien 88 % erkannt, Thema 91 % richtig, wo ein Thema vergeben ist, Stand des Verfahrens 91 %. Freigabe im Produkt erst ab 90 %. Datenstand steht über jeder Trefferliste.");
  head(s, "Qualität", "Grenzen und Abdeckung offen benannt");
  const tiles = [["88 %", "Formalien erkannt (Art des Punkts)"], ["91 %", "Thema richtig, wo ein Thema vergeben ist (80 % über alle Titel)"], ["91 %", "Stand des Verfahrens richtig („Was geschieht“)"], ["90 %", "Schwelle für die Freigabe im Atlas und auf der Karte"]];
  tiles.forEach(([v, l], i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, 1.5, 2.15, 1.45);
    stat(s, x + 0.2, 1.65, 1.8, v, l, { size: 28 });
  });
  T(s, "Frische Stichproben vom 14.10.26 an ungesehenen Berichten; Zahlen werden nach jeder Messung aktualisiert.", { x: 0.5, y: 3.0, w: 9, h: 0.25, fontSize: 9.5, color: C.accent4 });
  const cols = [
    ["FiLayers", "Regelbasiert statt Modell", "Jede Regel liest nur Titel, Beschlussvorschlag und Unterlage. Ergebnisse sind nachvollziehbar und wiederholbar."],
    ["FiClock", "Stand sichtbar", "Datum und Uhrzeit über jeder Trefferliste, Quellenstand je Artikel, Abdeckung je Bundesland."],
    ["FiShield", "Nur belegbare Zahlen", "Jede Zahl führt zu den Vorgängen und Originalquellen. Nicht gemessene Regeln bleiben gesperrt."],
  ];
  cols.forEach(([icn, h1, body], i) => {
    const x = 0.5 + i * 3.1;
    iconCircle(s, icn, x, 3.45, 0.4);
    T(s, h1, { x: x + 0.55, y: 3.47, w: 2.3, h: 0.3, fontSize: 12.5, fontFace: SB });
    T(s, body, { x: x + 0.55, y: 3.75, w: 2.35, h: 1.1, fontSize: 10.5, color: C.accent3 });
  });
}

// 17 Stufen
{
  const s = slide("HELL", "plenara.X", "Stufen: Gast ohne Konto mit 10 Treffern je Suche; Basic, Pro und Enterprise mit Konto. plenara.X und der Sitzungskalender gehören zu Enterprise. In der Testphase schalten wir Stufen auf Anfrage frei; die Preise folgen.");
  head(s, "Stufen", "Einfache Preise, jederzeit kündbar");
  const tiers = [
    ["Gast", "0 €", "ohne Konto", ["Suche in allen Gebieten", "10 Treffer je Suche", "Direkt loslegen"]],
    ["Basic", "Preis folgt", "mit Konto", ["Alle Treffer", "Filter und Umkreis", "1 gespeicherte Suche", "1 aktive Benachrichtigung"]],
    ["Pro", "Preis folgt", "monatlich kündbar", ["Alle Treffer, Filter, Umkreis", "100 gespeicherte Suchen", "100 gespeicherte Artikel", "100 Benachrichtigungen"]],
    ["Enterprise", "Preis folgt", "für Teams", ["Alles aus Pro", "Sitzungskalender mit Abo", "plenara.X: alle Analysen", "5 E-Mail-Empfänger je Alarm"]],
  ];
  const tw = 2.15, tg = 0.13, ty = 1.5, th = 3.0, tx0 = 0.5 + (9 - (4 * tw + 3 * tg)) / 2;
  tiers.forEach(([name, price, sub, items], i) => {
    const x = tx0 + i * (tw + tg);
    const ent = i === 3;
    card(s, x, ty, tw, th, ent ? { fill: C.text2, line: C.text2 } : {});
    T(s, name, { x: x + 0.2, y: ty + 0.2, w: tw - 0.4, h: 0.3, fontSize: 13, fontFace: SB, color: ent ? C.background1 : C.text1 });
    T(s, price, { x: x + 0.2, y: ty + 0.5, w: tw - 0.4, h: 0.4, fontSize: 20, fontFace: SB, color: ent ? C.accent1 : C.text1 });
    T(s, sub, { x: x + 0.2, y: ty + 0.9, w: tw - 0.4, h: 0.25, fontSize: 9.5, color: ent ? C.accent4 : C.accent3 });
    let y = ty + 1.3;
    for (const it of items) {
      s.addShape(pres.ShapeType.rect, { x: x + 0.2, y: y + 0.06, w: 0.08, h: 0.08, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 } });
      const ih = textH(it, 10, false, tw - 0.6);
      T(s, it, { x: x + 0.38, y, w: tw - 0.58, h: ih + 0.02, fontSize: 10, color: ent ? C.background1 : C.text1 });
      y += ih + 0.1;
    }
  });
  T(s, "Plenara in der Testphase: Stufen schalten wir derzeit auf Anfrage frei, die Preise folgen. Stand 15.10.26, plenara.de/preise.", { x: 0.5, y: 4.65, w: 9, h: 0.3, fontSize: 9.5, color: C.accent4 });
}

// 18 Schluss
{
  const s = slide("DUNKEL", "plenara.X", "Abschluss mit dem Slogan. Kontakt über www.plenara.de.");
  s.addImage({ data: b64(LOGO.dark), x: 0.75, y: 1.05, w: 3.2, h: 3.2 / RATIO.logoDark });
  T(s, "Besser verstehen,\nwas vor Ort beraten wird.", { x: 0.8, y: 2.5, w: 8.4, h: 1.3, fontSize: 32, fontFace: SB, color: C.background1 });
  T(s, "www.plenara.de", { x: 0.8, y: 3.95, w: 8.4, h: 0.4, fontSize: 16, fontFace: SB, color: C.accent1 });
  T(s, "Beschlüsse und Beratungen aus den offiziellen Ratsinformationssystemen der Kommunen. Maßgeblich sind stets die verlinkten Originalunterlagen.", { x: 0.8, y: 4.45, w: 7, h: 0.5, fontSize: 11, color: C.accent4 });
}

await finish(OUT);
