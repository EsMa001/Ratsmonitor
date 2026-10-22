// Investorenpräsentation Plenara: Problem, Lösung, Kern (die Datenbank), Kennzahlen, sechs Anwendungsfälle mit Screenshots,
// die stärksten Analysen, Markt, Geschäftsmodell, nächste Schritte.
//   node build-investoren.mjs [ausgabe.pptx]     (vorher: npm install in docs/design/tools, Screenshots mit screenshots.mjs)
// Zahlen: plenara.de Startseite und /datenabdeckung (Stand 22.10.26), öffentliche Auszüge /api/x/teaser (Stand 21.10.26),
// Anwenderseiten /anwender/*; Plan und Preise: docs/strategie/kommerzialisierungsstrategie.md (02.10.26), als Plan gekennzeichnet.
import { pres, C, HEX, SB, b64, LOGO, RATIO, IMG, shot, textH, slide, head, T, card, iconCircle, stat, picture, CHART_BASE, OUT_DIR, join, finish } from "./deck-lib.mjs";
const OUT = process.argv[2] || join(OUT_DIR, "plenara-investoren.pptx");

// Ausschnitte aus den Screenshots (Pixel im 2880 px breiten Bild)
const S = {
  startKarte: await shot("start", { left: 1560, top: 90, width: 1300, height: 1650 }),
  suche: await shot("suche-bplan", { left: 0, top: 150, width: 2880, height: 1650 }),
  artikel: await shot("artikel-waerme", { left: 0, top: 150, width: 2880, height: 1950 }),
  immo: await shot("anwender-immobilien", { left: 0, top: 620, width: 1960, height: 1180 }),
  immoKarte: await shot("anwender-immobilien", { left: 2010, top: 640, width: 850, height: 1080 }),
  planung: await shot("anwender-planung", { left: 0, top: 620, width: 1960, height: 1180 }),
  versorgung: await shot("anwender-versorgung", { left: 0, top: 620, width: 1960, height: 1180 }),
  verbaende: await shot("anwender-verbaende", { left: 0, top: 640, width: 1960, height: 560 }),
  presse: await shot("anwender-oeffentlichkeit", { left: 0, top: 640, width: 2200, height: 1020 }),
  alarme: await shot("alarme", { left: 0, top: 150, width: 2000, height: 1150 }),
};

/** Drei Spalten mit Symbol, Aussage und einem Satz */
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
/** Liste mit Petrol-Quadrat, fett gesetzter Aussage und Erläuterung */
function points(s, items, x, y, w, { headPt = 13, bodyPt = 11, gap = 0.2 } = {}) {
  let cy = y;
  for (const [h1, body] of items) {
    s.addShape(pres.ShapeType.rect, { x, y: cy + 0.06, w: 0.1, h: 0.1, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 } });
    const hh = textH(h1, headPt, true, w - 0.25);
    T(s, h1, { x: x + 0.25, y: cy, w: w - 0.25, h: hh + 0.02, fontSize: headPt, fontFace: SB });
    cy += hh + 0.04;
    if (body) { const bh = textH(body, bodyPt, false, w - 0.25); T(s, body, { x: x + 0.25, y: cy, w: w - 0.25, h: bh + 0.02, fontSize: bodyPt, color: C.accent3 }); cy += bh; }
    cy += gap;
  }
  return cy;
}
const note = (s, text, x = 0.5, y = 4.75, w = 9) => T(s, text, { x, y, w, h: 0.36, fontSize: 9.5, color: C.accent3 });
/** Anwendungsfall: Titel, Bild links, Punkte rechts, Beleg unten */
function usecase(s, { eyebrow, title, img, imgW = 5.2, items, beleg, notes }) {
  head(s, eyebrow, title);
  const p = picture(s, img, 0.5, 1.5, imgW, { maxH: 2.6 });
  points(s, items, p.x + p.w + 0.4, 1.55, 9.5 - (p.x + p.w + 0.4), { bodyPt: 10.5, gap: 0.14 });
  if (beleg) {
    s.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 4.25, w: 9, h: 0.7, rectRadius: 0.1, fill: { color: C.accent5 }, line: { color: C.accent5, width: 0 } });
    T(s, [{ text: beleg[0] + "  ", options: { fontFace: SB } }, { text: beleg[1] }], { x: 0.7, y: 4.3, w: 8.6, h: 0.6, fontSize: 10.5, color: C.accent2, valign: "middle" });
  }
  if (notes) s.addNotes(notes);
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
  const s = slide("HELL", "Investoren", "Kommunale Entscheidungen sind öffentlich, aber auf über 10.000 Systeme verteilt. Wer Aufträge, Flächen oder Standorte sucht, erfährt davon zu spät und beobachtet von Hand.");
  head(s, "Das Problem", "Öffentlich beschlossen, praktisch unsichtbar");
  columns(s, [
    ["FiGrid", "Über 10.000 Systeme", "Jede Kommune veröffentlicht Beschlüsse in ihrem eigenen Ratsinformationssystem. Keines ist über Ortsgrenzen hinweg durchsuchbar."],
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
    T(s, h1, { x: 1.15, y: y - 0.02, w: 3.2, h: 0.32, fontSize: 16, fontFace: SB });
    const bh = textH(body, 12, false, 3.2);
    T(s, body, { x: 1.15, y: y + 0.32, w: 3.2, h: bh + 0.02, fontSize: 12, color: C.accent3 });
    y += 0.32 + bh + 0.42;
  }
  picture(s, S.startKarte, 6.4, 1.45, 2.9, { maxH: 3.6, frame: false });
  note(s, "Startseite plenara.de, Stand 22.10.26: 140.198 Berichte in den letzten 30 Tagen.", 0.5, 4.75, 5.5);
}

// 4 Kern: die Datenbank
{
  const s = slide("HELL", "Investoren", "Das Kern-Know-how: eine Datenbank, in der jeder Vorgang gelesen, eingeordnet, zusammengefasst und durchsuchbar ist. Beispiel Herborn: Auszug aus der Vorlage, Thema, Stand, Verlauf durch vier Gremien, Originalquelle.");
  head(s, "Der Kern", "Gelesen, eingeordnet, zusammengefasst, durchsuchbar");
  const p = picture(s, S.artikel, 0.5, 1.5, 4.9, { maxH: 3.3 });
  points(s, [
    ["Importiert", "Alle 10 Minuten aus den Ratsinformationssystemen von 8.119 Kommunen und Gebieten, nachts vollständig."],
    ["Gelesen", "Hauptdokument als PDF, Textebene und OCR. Der Auszug aus der Vorlage zeigt die Originalsätze."],
    ["Eingeordnet", "Thema, Art des Punkts, Stand des Verfahrens, Werte aus den Unterlagen. Regelbasiert, gemessen, nachvollziehbar."],
    ["Durchsuchbar", "Volltext über alle Kommunen, Verlauf durch die Gremien, Link zur Originalquelle. Kurzfassungen tragen ein KI-Label."],
  ], p.x + p.w + 0.4, 1.55, 9.5 - (p.x + p.w + 0.4), { bodyPt: 10.5, gap: 0.16 });
  note(s, "Beispiel: Kommunale Wärmeplanung Herborn, vier Gremien in neun Tagen, Stand 22.10.26.", 0.5, 4.85, 4.9);
}

// 5 Kennzahlen
{
  const s = slide("HELL", "Investoren", "Kennzahlen von plenara.de/datenabdeckung, Stand 22.10.26: 75 Prozent der Gemeinden, 85 Prozent der Einwohner, 1,51 Millionen Vorgänge durchsuchbar, rund 140.000 neue Berichte je Monat. Abdeckung je Bundesland als Balken.");
  head(s, "Kennzahlen", "Drei Viertel der Gemeinden, 85 % der Einwohner");
  const tiles = [["8.113", "von 10.751 Gemeinden mit Vorgängen aus ihrem Rat (75 %)"], ["71,3 Mio.", "Einwohner in abgedeckten Orten (85 % von 83,4 Mio.)"], ["1,51 Mio.", "Vorgänge durchsuchbar"], ["140.000", "neue Berichte je Monat, über 1,2 Mio. im Jahr"], ["258", "von 294 Landkreisen, 16 Bundesländer"]];
  tiles.forEach(([v, l], i) => {
    const x = 0.5 + i * 1.84;
    card(s, x, 1.5, 1.72, 1.45);
    stat(s, x + 0.15, 1.62, 1.45, v, l, { size: 22, labelPt: 9.5 });
  });
  s.addChart(pres.ChartType.bar, [{ name: "Abdeckung", labels: ["Berlin, Hamburg, Bremen", "Rheinland-Pfalz", "Mecklenburg-Vorp.", "Schleswig-Holstein", "Sachsen-Anhalt", "Nordrhein-Westfalen", "Niedersachsen", "Saarland", "Hessen", "Baden-Württemberg", "Brandenburg", "Bayern", "Sachsen", "Thüringen"], values: [100, 92, 86, 84, 83, 82, 80, 75, 72, 71, 69, 62, 54, 47] }], {
    ...CHART_BASE, x: 0.5, y: 3.05, w: 9, h: 1.95, barDir: "bar", catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25, valAxisHidden: true,
    title: "Anteil der Gemeinden je Bundesland, aus denen Vorgänge vorliegen (Prozent)", dataLabelPosition: "outEnd", catAxisLabelFontSize: 8, dataLabelFontSize: 8, barGapWidthPct: 35,
  });
}

// 6 Anwendungsfall: Redaktionen
{
  const s = slide("HELL", "Investoren");
  usecase(s, {
    eyebrow: "Anwendungsfall: Redaktionen", title: "Recherche: Beschlüsse finden, bevor die Sitzung beginnt", img: S.presse, imgW: 5.4,
    items: [
      ["Die Sitzung vorab sehen", "Beschlussvorlagen erscheinen vor der Sitzung, nicht erst im Nachbericht."],
      ["Montags die Wochenvorschau", "Was in den eigenen Kommunen auf der Tagesordnung steht, kommt per E-Mail."],
      ["Berichtenswert, mit Zitat und Quelle", "Der Newsradar reiht Vorgänge nach Nachrichtenwert, je Vorgang eine Meldung mit Originalzitat."],
    ],
    beleg: ["Beleg Ahrensburg:", "Antrag zur Wärmeplanung über sechs Monate dreimal vertagt, dann beschlossen. Jede Vertagung war am Sitzungstag sichtbar."],
    notes: "Lokalredaktionen und Fachmedien: Vorlagen vor der Sitzung, Wochenvorschau, Newsradar mit Zitat und Quelle. Screenshot der Anwenderseite Öffentlichkeit mit den drei berichtenswerten Vorgängen vom Stand 22.10.26.",
  });
}

// 7 Anwendungsfall: Baugebiete
{
  const s = slide("HELL", "Investoren");
  usecase(s, {
    eyebrow: "Anwendungsfall: Immobilien und Bauen", title: "Bauland sehen, bevor es Bauland ist", img: S.immo, imgW: 5.4,
    items: [
      ["Flächen sehen, bevor sie am Markt sind", "Ein Aufstellungsbeschluss erscheint, sobald der Rat ihn fasst. Das Exposé kommt meist später."],
      ["Veränderungssperren vor dem Kauf prüfen", "Der Ratsbeschluss ist sichtbar, bevor der Kaufvertrag unterschrieben wird."],
      ["2.753 neue Wohnbaugebiete in 6 Monaten", "In 1.273 Kommunen, mit Stand je Vorgang: Aufstellung, Auslegung, Satzungsbeschluss."],
    ],
    beleg: ["Beleg Beckum:", "Gewerbegebiet „Neubeckumer Straße/Grüner Weg“ vom ersten Beschluss bis zur Satzung in acht Monaten, jede Station mit Quelle."],
    notes: "Projektentwicklung, Makler, Architekturbüros. Zahlen aus dem öffentlichen Auszug Wohnbaugebiete, Stand 21.10.26.",
  });
}

// 8 Anwendungsfall: Ausschreibungen und Planung
{
  const s = slide("HELL", "Investoren");
  usecase(s, {
    eyebrow: "Anwendungsfall: Ausschreibungen und Planung", title: "Aufträge sehen, bevor sie vergeben werden", img: S.planung, imgW: 5.4,
    items: [
      ["Gutachtenbedarf früh erkennen", "Neue Pläne brauchen Umweltberichte und Artenschutzgutachten. Die Beschlüsse nennen das, bevor ausgeschrieben wird."],
      ["Fristen der Auslegung kennen", "Öffentliche Auslegungen und Stellungnahmen haben feste Fristen. Sie erscheinen hier früh."],
      ["2.131 Vergaben von Planungsleistungen", "In 950 Kommunen in 6 Monaten, mit Stand: Ausschreibung, Vergabe, Nachtrag."],
    ],
    beleg: ["Beleg Marienberg:", "Radweg an der B 174: im März Bau des 1. Abschnitts vergeben, im Juni die Planung des 2. Abschnitts. Das nächste Los war früh sichtbar."],
    notes: "Ingenieurbüros, Umweltgutachter, Bauunternehmen. Zahlen aus dem öffentlichen Auszug Planungsleistungen, Stand 21.10.26.",
  });
}

// 9 Anwendungsfall: Versorgung und Wärme
{
  const s = slide("HELL", "Investoren");
  usecase(s, {
    eyebrow: "Anwendungsfall: Energie und Versorgung", title: "Wärmeplanung und Netze: vier Monate vor der Vergabe", img: S.versorgung, imgW: 5.4,
    items: [
      ["Keine Konzession verpassen", "Auslaufende Konzessions- und Entsorgungsverträge im eigenen Gebiet fallen früh auf."],
      ["3.816 Vorhaben zu Wärme und Netzen", "In 1.845 Kommunen in 6 Monaten: Wärmeplanung, Fernwärme, Sanierung, Netze, mit Stand je Vorgang."],
      ["Entscheidungen der Nachbarn", "Was Stadtwerke und Nachbarkommunen beschließen, lässt sich nebeneinander prüfen."],
    ],
    beleg: ["Beleg Gröbenzell:", "Kommunale Wärmeplanung vom Grundsatzbeschluss im Mai bis zur Vergabe der Planung im September. Wer Planung oder Netze anbietet, sah den Bedarf ab Mai."],
    notes: "Stadtwerke, Netzbetreiber, Wasser und Entsorgung, Projektierer. Screenshot der Anwenderseite Versorgung, Stand 22.10.26.",
  });
}

// 10 Anwendungsfall: Verbände und Kämmereien
{
  const s = slide("HELL", "Investoren");
  usecase(s, {
    eyebrow: "Anwendungsfall: Verbände und Kämmereien", title: "Mitreden, solange noch beraten wird", img: S.verbaende, imgW: 5.4,
    items: [
      ["Hebesätze und Gebühren vor der Entscheidung", "Hebesätze und Flächen werden im Ausschuss beraten. Eine Stellungnahme wirkt vor dem Beschluss."],
      ["Median Grundsteuer B: 465 %", "Üblich 347 bis 600 %, aus den Vorlagen von 808 Gemeinden; seit dem vorigen Wert 30 höher, 25 niedriger."],
      ["Mitglieder gezielt informieren", "Ein Beschluss betrifft oft viele Mitglieder gleichzeitig. Die Liste zeigt, wer betroffen ist."],
    ],
    beleg: ["Beleg Satow:", "Fortführung der Planung des Gewerbegebiets: binnen acht Tagen durch Fachausschuss, Hauptausschuss und Gemeindevertretung. Wer mitreden will, hat wenig Zeit."],
    notes: "Wirtschaftsverbände, Kammern, Mitgliederverbände, Vereine und Träger, Kämmereien. Hebesatz-Auszug Stand 21.10.26.",
  });
}

// 11 Anwendungsfall: Fraktionen und Bürger
{
  const s = slide("HELL", "Investoren");
  usecase(s, {
    eyebrow: "Anwendungsfall: Fraktionen, Vereine, Bürgerinnen und Bürger", title: "Wissen, was im eigenen Ort beraten wird", img: S.alarme, imgW: 5.0,
    items: [
      ["Ein Suchbegriff, eine E-Mail", "Ein gespeicherter Begriff meldet neue Beschlüsse in der eigenen Gemeinde: sofort, täglich oder wöchentlich."],
      ["Keine Sitzung verpassen", "Der Sitzungskalender zu den eigenen Themen lässt sich abonnieren."],
      ["Förderung und Zuschüsse im Blick", "Sehen, ob der eigene Zuschuss im Haushaltsentwurf steht oder gekürzt wird, bevor der Rat entscheidet."],
    ],
    beleg: ["Reichweite:", "Suche und Karte sind ohne Anmeldung offen. Das bringt Sichtbarkeit, Zitate in der Presse und Anfragen von Verbänden und Unternehmen."],
    notes: "Die kostenlose Suche ist die Reichweitenflanke; Konten mit Alarmen und Kalender sind die Brücke zu den Abos.",
  });
}

// 12 plenara.X
{
  const s = slide("HELL", "Investoren", "plenara.X: dieselbe Datenbank, gezählt über alle Kommunen. Vier Seiten: Signale, Fakten, Atlas, Tools. Regelbasiert, gemessen, jede Zahl mit Quelle.");
  head(s, "plenara.X", "Aus 1,5 Millionen Vorgängen werden Antworten");
  const pages = [
    ["FiRadio", "Signale", "Wo gerade etwas entsteht: Wohnbau, Gewerbe, Wind, Solar, Wärme, Schulen, Straßen, Mobilität. Je Vorgang Ort, Stand und Quelle."],
    ["FiMap", "Fakten", "Hebesätze, Gebühren, Jahresergebnisse und Grundstückspreise je Gemeinde auf der Karte, mit Kreis- und Landesmedian."],
    ["FiGrid", "Atlas", "Worüber die Räte beraten, nach zehn Themen: Unterthemen, Verlauf, Orte und der Vergleich mit ähnlichen Gemeinden."],
    ["FiTool", "Tools", "Ausbreitung, Themennetz, Trends, Ortsvergleich, Beschlüsse, Beratungswege, Fraktionsprofil, Newsradar."],
  ];
  const pw = 2.15, pg = 0.13, py = 1.55, ph = 2.5, px0 = 0.5 + (9 - (4 * pw + 3 * pg)) / 2;
  pages.forEach(([icn, h1, body], i) => {
    const x = px0 + i * (pw + pg);
    card(s, x, py, pw, ph);
    iconCircle(s, icn, x + 0.2, py + 0.2, 0.44);
    T(s, "plenara.X " + h1, { x: x + 0.2, y: py + 0.78, w: pw - 0.4, h: 0.3, fontSize: 13, fontFace: SB });
    T(s, body, { x: x + 0.2, y: py + 1.1, w: pw - 0.4, h: 1.35, fontSize: 10.5, color: C.accent3 });
  });
  s.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 4.25, w: 9, h: 0.65, rectRadius: 0.1, fill: { color: C.accent5 }, line: { color: C.accent5, width: 0 } });
  T(s, [{ text: "Regelbasiert und gemessen: ", options: { fontFace: SB } }, { text: "kein Modell im Ablauf, Freigabe erst ab 90 % geprüfter Qualität, jede Zahl führt zu den Vorgängen und Originalquellen. Teil des Tarifs Enterprise." }], { x: 0.7, y: 4.3, w: 8.6, h: 0.55, fontSize: 11, color: C.accent2, valign: "middle" });
}

// 13 Beste Analysen: Signale
{
  const s = slide("HELL", "Investoren", "Signale auf der Karte: jeder Punkt ein Vorhaben der letzten sechs Monate. Wohnbau 2.753 Vorgänge in 1.273 Kommunen, Windenergie 1.734 in 824, Vergaben von Planungsleistungen 2.131 in 950. Stand 21.10.26, öffentliche Auszüge.");
  head(s, "Analyse: Signale", "Wo Deutschland baut, plant und vergibt");
  const p = picture(s, S.immoKarte, 0.5, 1.5, 2.6, { maxH: 3.4 });
  const rows = [["2.753", "neue Wohnbaugebiete", "in 1.273 Kommunen; Stand je Vorgang: Aufstellung, Auslegung, Satzungsbeschluss"], ["1.734", "Vorhaben zur Windenergie", "in 824 Kommunen; Planung, Genehmigung, Beteiligung und Betrieb"], ["2.131", "Vergaben von Planungsleistungen", "in 950 Kommunen; Ausschreibung, Vergabe, Nachtrag"]];
  rows.forEach(([v, l, b], i) => {
    const y = 1.5 + i * 1.08, x = p.x + p.w + 0.5;
    T(s, v, { x, y, w: 1.6, h: 0.5, fontSize: 28, fontFace: SB, color: C.accent2 });
    T(s, l, { x: x + 1.7, y: y + 0.02, w: 4.3, h: 0.3, fontSize: 13, fontFace: SB });
    T(s, b, { x: x + 1.7, y: y + 0.32, w: 4.3, h: 0.5, fontSize: 10.5, color: C.accent3 });
  });
  note(s, "Jeweils die letzten sechs Monate, Stand 21.10.26. Je Vorgang Ort, Art als Filter und Stand des Verfahrens; Freigabe nur für Kategorien mit gemessener Qualität ab 90 %.", p.x + p.w + 0.5, 4.75, 5.9);
}

// 14 Beste Analysen: Fakten und Beschlüsse
{
  const s = slide("HELL", "Investoren", "Fakten: Werte aus den Unterlagen je Gemeinde, zum Beispiel Hebesätze (808 Gemeinden, Median 465 Prozent). Beschlüsse: von 91.164 entschiedenen Vorgängen wurden 92 Prozent beschlossen, 4,2 vertagt, 3,8 abgelehnt; 76,6 Prozent einstimmig; die Hälfte nach 14 Tagen entschieden. Öffentliche Auszüge, Stand 21.10.26.");
  head(s, "Analyse: Fakten und Beschlüsse", "Was kostet es wo, und wie Räte entscheiden");
  card(s, 0.5, 1.5, 4.3, 3.4);
  T(s, "Hebesätze Grundsteuer B", { x: 0.75, y: 1.7, w: 3.8, h: 0.3, fontSize: 13, fontFace: SB });
  T(s, "465 %", { x: 0.75, y: 2.05, w: 3.8, h: 0.7, fontSize: 40, fontFace: SB, color: C.accent2 });
  T(s, "Median aus den Vorlagen von 808 Gemeinden. Üblich 347 bis 600 %. Seit dem vorigen Wert: 30 Gemeinden höher, 25 niedriger.", { x: 0.75, y: 2.85, w: 3.8, h: 0.9, fontSize: 11, color: C.accent3 });
  T(s, "Auf der Karte je Gemeinde, mit Kreis- und Landesmedian und den Vorgängen hinter jedem Wert. Weitere Werte: Gebühren, Wärmeplanung, Zuschüsse, Grundstückspreise, Jahresergebnis.", { x: 0.75, y: 3.8, w: 3.8, h: 1.0, fontSize: 10.5, color: C.text1 });
  s.addChart(pres.ChartType.bar, [{ name: "Anteil", labels: ["beschlossen", "vertagt oder verwiesen", "abgelehnt"], values: [92, 4.2, 3.8] }], {
    ...CHART_BASE, x: 5.1, y: 1.45, w: 4.4, h: 2.0, barDir: "bar", catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: 100, valAxisHidden: true,
    chartColors: [HEX.teal, HEX.sky, HEX.amber], invertedColors: [HEX.teal], title: "Wie Vorgänge ausgehen (Prozent von 91.164 entschiedenen)", dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", barGapWidthPct: 40,
  });
  const tiles = [["76,6 %", "einstimmig entschieden"], ["14 Tage", "bis die Hälfte entschieden war"], ["91.164", "entschiedene Vorgänge im Bestand"]];
  tiles.forEach(([v, l], i) => {
    const x = 5.1 + i * 1.5;
    stat(s, x, 3.65, 1.4, v, l, { size: 18, labelPt: 9.5 });
  });
  note(s, "Öffentliche Auszüge von plenara.de, Stand 21.10.26; die vollständigen Seiten gehören zum Tarif Enterprise.", 5.1, 4.72, 4.4);
}

// 15 Beste Analysen: Trends und Beratungswege
{
  const s = slide("HELL", "Investoren", "Trends: Begriffe, die in den letzten 90 Tagen in deutlich mehr Gemeinden auftauchen, zum Beispiel Hitzeschutz in 211 Gemeinden statt 63. Beratungswege: 35.611 Wege durch die Gremien, der häufigste vom Haupt- und Verwaltungsausschuss in den Rat in acht Tagen.");
  head(s, "Analyse: Trends und Beratungswege", "Was zunimmt, und wie lange der Weg in den Rat dauert");
  s.addChart(pres.ChartType.bar, [
    { name: "90 Tage davor", labels: ["Hitzeschutz", "Haushaltsplanung", "Weihnachtsmarkt"], values: [63, 79, 50] },
    { name: "letzte 90 Tage", labels: ["Hitzeschutz", "Haushaltsplanung", "Weihnachtsmarkt"], values: [211, 172, 125] },
  ], {
    ...CHART_BASE, x: 0.5, y: 1.45, w: 4.4, h: 2.9, barDir: "col", chartColors: [HEX.line, HEX.teal], showLegend: true, legendPos: "b", legendFontFace: "+mn-lt", legendFontSize: 9, legendColor: HEX.grey,
    title: "Gemeinden, in denen der Begriff beraten wurde", dataLabelPosition: "outEnd", valAxisHidden: true,
  });
  note(s, "Trends über alle Vorgänge, Fenster 90 Tage, Stand 21.10.26.", 0.5, 4.45, 4.4);
  T(s, "Beratungswege", { x: 5.3, y: 1.5, w: 4.2, h: 0.3, fontSize: 13, fontFace: SB });
  T(s, "35.611 Wege durch die Gremien, die häufigsten:", { x: 5.3, y: 1.8, w: 4.2, h: 0.3, fontSize: 10.5, color: C.accent3 });
  const ways = [["Haupt- und Verwaltungsausschuss", "9.621", "8 Tage"], ["Bau-, Planungs- und Stadtentwicklungsausschuss", "6.451", "14 Tage"], ["Finanz- und Rechnungsprüfungsausschuss", "5.136", "9 Tage"], ["Bildungs-, Jugend-, Kultur- und Sportausschuss", "2.241", "16 Tage"]];
  let y = 2.2;
  for (const [from, count, days] of ways) {
    s.addShape(pres.ShapeType.line, { x: 5.3, y, w: 4.2, h: 0, line: { color: C.accent6, width: 0.75 } });
    T(s, from + " › Rat", { x: 5.3, y: y + 0.08, w: 2.9, h: 0.5, fontSize: 10, color: C.text1 });
    T(s, count, { x: 8.2, y: y + 0.08, w: 0.7, h: 0.25, fontSize: 11, fontFace: SB, align: "right" });
    T(s, days, { x: 8.95, y: y + 0.08, w: 0.55, h: 0.25, fontSize: 10, color: C.accent3, align: "right" });
    y += 0.58;
  }
  s.addShape(pres.ShapeType.line, { x: 5.3, y, w: 4.2, h: 0, line: { color: C.accent6, width: 0.75 } });
  note(s, "Wege und mittlere Dauer vom Ausschuss bis zum Rat oder Kreistag, Stand 21.10.26.", 5.3, 4.72, 4.2);
}

// 16 Markt
{
  const s = slide("HELL", "Investoren", "Erster Markt: Projektierer für Wind, Solar und Speicher. Zahlungsbereitschaft bei vergleichbaren Ausschreibungsdiensten belegt (2.000 bis 6.000 Euro je Jahr). Danach Bau, Glasfaser, Verbände, Agenturen, Presse.");
  head(s, "Markt", "Wer früh wissen muss, was Räte planen");
  const rows = [
    ["FiWind", "Projektierer Wind, Solar, Speicher", "Einstiegssegment: jede Fläche beginnt mit einem Ratsbeschluss. Zahlungsbereitschaft bei vergleichbaren Diensten belegt: 2.000 bis 6.000 € je Jahr."],
    ["FiTruck", "Bau, Planung, Glasfaser, Wohnungswirtschaft", "Aufträge, bevor sie ausgeschrieben werden; Bebauungspläne und Markterkundungen, bevor sie öffentlich ausliegen."],
    ["FiUsers", "Verbände, Kämmereien, Agenturen, Presse", "Viele Orte, ein Werkzeug: Mandanten-Suchen, Fakten je Gemeinde, Meldungen mit Zitat und Quelle."],
    ["FiHome", "Fraktionen, Bürgerinnen und Bürger", "Kostenlose Suche als Reichweitenflanke: Sichtbarkeit, Zitate in der Presse, Anfragen."],
  ];
  let y = 1.55;
  for (const [icn, h1, body] of rows) {
    s.addShape(pres.ShapeType.line, { x: 0.5, y, w: 9, h: 0, line: { color: C.accent6, width: 0.75 } });
    iconCircle(s, icn, 0.5, y + 0.17, 0.42);
    T(s, h1, { x: 1.1, y: y + 0.15, w: 3.2, h: 0.5, fontSize: 13, fontFace: SB });
    T(s, body, { x: 4.5, y: y + 0.15, w: 5.0, h: 0.6, fontSize: 11, color: C.accent3 });
    y += 0.82;
  }
  s.addShape(pres.ShapeType.line, { x: 0.5, y, w: 9, h: 0, line: { color: C.accent6, width: 0.75 } });
}

// 17 Geschäftsmodell
{
  const s = slide("HELL", "Investoren", "Abo-Erlöse ohne Beratungsaufwand: Self-Service für Einzelnutzer und Teams, Enterprise mit plenara.X für Verbände und Agenturen, später ein Daten-Feed an Nicht-Wettbewerber. Preiskorridor aus der Strategie vom 02.10.26, als Plan gekennzeichnet.");
  head(s, "Geschäftsmodell", "Abo-Erlöse, Software statt Beratung");
  const cols = [
    ["FiUser", "Self-Service", "149 bis 990 € je Monat", "Einzelnutzer und Teams: Suche, Alarme, Export. Monatlich kündbar, Start ohne Gespräch."],
    ["FiBriefcase", "Enterprise", "ab 6.000 € je Jahr", "Verbände, Agenturen, Konzerne: Mandanten-Suchen, Reporting, plenara.X mit allen Analysen."],
    ["FiDatabase", "Daten-Feed", "ab Phase 3", "Strukturierte Vorgänge als Feed, nur an Nicht-Wettbewerber. Zweitverwertung derselben Datenbank."],
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

// 18 Warum Plenara
{
  const s = slide("HELL", "Investoren", "Vier Dinge, die schwer zu kopieren sind: der Zulauf aus über 8.000 Systemen, Struktur statt Volltext, belegbare Zahlen mit offen gezeigter Abdeckung, ein Portal für Suche, Alarme und Analysen.");
  head(s, "Warum Plenara", "Vier Dinge, die schwer zu kopieren sind");
  const items = [
    ["FiDownload", "Der Zulauf", "8.119 Kommunen und Gebiete angebunden, alle 10 Minuten neue Berichte, nachts vollständig. Jahre an Anbindungsarbeit, die niemand überspringt."],
    ["FiLayers", "Struktur statt Volltext", "Jeder Bericht wird zum Vorgang: Thema, Stand, Verlauf durch die Gremien, Werte aus den Unterlagen. Regelbasiert und gemessen."],
    ["FiShield", "Belegbar", "Jede Zahl führt zur Originalquelle. Abdeckung und Grenzen werden offen gezeigt, vor dem Kauf."],
    ["FiBox", "Ein Portal", "Suche, Alarme und Analysen aus einer Datenbank. Jede neue Auswertung nutzt denselben Weg, ohne neues Datenmodell."],
  ];
  items.forEach(([icn, h1, body], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 4.65, y = 1.6 + row * 1.65;
    iconCircle(s, icn, x, y, 0.46);
    T(s, h1, { x: x + 0.6, y: y - 0.02, w: 3.7, h: 0.32, fontSize: 15, fontFace: SB });
    T(s, body, { x: x + 0.6, y: y + 0.33, w: 3.7, h: 1.1, fontSize: 11.5, color: C.accent3 });
  });
}

// 19 Nächste Schritte
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

// 20 Schluss
{
  const s = slide("DUNKEL", "Investoren", "Abschluss und Gesprächseinladung.");
  s.addImage({ data: b64(LOGO.dark), x: 0.75, y: 1.05, w: 3.2, h: 3.2 / RATIO.logoDark });
  T(s, "Besser verstehen,\nwas vor Ort beraten wird.", { x: 0.8, y: 2.5, w: 8.4, h: 1.3, fontSize: 32, fontFace: SB, color: C.background1 });
  T(s, "Max Espelkott  ·  www.plenara.de", { x: 0.8, y: 3.95, w: 8.4, h: 0.4, fontSize: 16, fontFace: SB, color: C.accent1 });
  T(s, "Suche und Karte sind ohne Anmeldung offen: plenara.de. Alle Zahlen dieser Präsentation stammen von der Seite selbst (Stand 21. und 22.10.26) oder sind als Plan gekennzeichnet.", { x: 0.8, y: 4.45, w: 7.5, h: 0.6, fontSize: 11, color: C.accent4 });
}

await finish(OUT);
