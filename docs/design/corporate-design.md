# Corporate Design Plenara

Stand: 22.10.2026 (Farbschema Petrol klar in Abschnitt 3, 2 und 11; Investorenpräsentation mit Anwendungsfällen; erste Fassung 08.10.2026). Abgeleitet aus der öffentlichen Webseite, so wie sie heute ist (ohne Admin-Bereich). **Ist-Stand** heißt: so steht es im Code und sieht man auf der Seite. **Vorschlag** heißt: von mir ergänzt, damit das Design vollständig wird, bitte freigeben oder ändern.

Die Ansicht dazu: [`styleguide.html`](styleguide.html) (im Browser öffnen). Quellen im Code: `app/styles/*.css` (Farben in `tokens.css`), `components/ratsmonitor/components/Brand.tsx`, `components/ratsmonitor/lib/constants.ts`, `components/ratsmonitor/FRONTEND.md`.

## 1. Marke

- **Name:** Plenara. Schreibweise im Fließtext „Plenara“, die Analysen heißen „Plenara.X“.
- **Slogan (fest):** „Besser verstehen, was vor Ort beraten wird.“ Nicht ändern oder umformulieren (`docs/produkt/slogan.json`).
- **Idee hinter dem Zeichen (Ist-Stand):** Der Plenarsaal aus Sitzpunkten. Das p besteht aus kleinen Punkten in zwei Reihen, so wie Sitze in einem Ratssaal. Das Schlussquadrat ist der Punkt des Namens.
- **Charakter (Ist-Stand):** ruhig, hell, sachlich, offen. Viel Weiß, wenige Linien, ein einziger Akzent. Es soll sich wie ein Werkzeug anfühlen, nicht wie Werbung.

## 2. Logo

**Ist-Stand:** Das Logo in der Kopfzeile ist die Variante „Plenara v2 ■“ (`DEFAULT_LOGO = plenara-v2sq`).

- Bildmarke: p aus Sitzpunkten (zwei Reihen, außen kräftig, innen blasser) mit einem Bogen links als Stiel, alles in Petrol `#268478` (`--rm-fill`; bis 16.10.2026 Teal `#0d9488`).
- Schriftzug „lenara“ in IBM Plex Sans Regular (400), Farbe Text `#18181b`, Buchstabenabstand −0,015 em.
- Abschluss: ein Quadrat in Teal anstelle eines Punkts.
- **Plenara.X:** Wortmarke ohne Schlussquadrat, dahinter ein X aus kleiner werdenden, verblassenden Quadraten, die von einem Mittelquadrat auf der Grundlinie ausgehen. Alles in Teal.
- Auf schmalen Handys (unter 440 px) zeigt die Kopfzeile nur die Bildmarke ohne Schriftzug.
- Im Code liegen weitere Entwürfe (Quorumo, Parlamo, ältere Plenara-Varianten). Sie gehören **nicht** zum Auftritt und werden nicht verwendet.

**Festgelegt (16.10.2026):**

- Schutzraum um das Logo: mindestens die Höhe des Buchstabens „l“ auf allen Seiten.
- Mindestgröße: Schriftzug nicht kleiner als 20 px Schrifthöhe (Druck 6 mm), Bildmarke allein nicht kleiner als 16 px (5 mm).
- Auf dunklem Grund (`#191e1d`): Schriftzug Weiß, Bildmarke und Schlussquadrat bleiben Petrol `#268478`.
- Nicht erlaubt: Logo strecken, drehen, andere Farben als Teal, Tinte und Weiß, Schatten oder Verläufe, Schriftzug neu setzen.
- **Logo-Dateien** liegen in `docs/design/logo/` (Schriftzug als Pfade, keine Schrift nötig): `plenara-logo.svg/.png` (auf Weiß), `plenara-logo-dunkel.svg/.png`, `plenara-bildmarke.svg/.png`, `plenara-bildmarke-dunkel.svg`, `plenara-x-logo.svg/.png`, `plenara-x-logo-dunkel.svg/.png`, Profilbilder `plenara-profilbild.png` und `plenara-profilbild-dunkel.png` (1024 × 1024). Erzeugt aus der Geometrie in `Brand.tsx` mit `node docs/design/tools/export-logos.mjs`; nach Änderungen am Logo im Code dort neu erzeugen.
- Maschinenlesbare Fassung aller Festlegungen (Farben, Schrift, Logo, Präsentation): `docs/design/brand.json`.

## 3. Farben

**Festgelegt (Farbschema „Petrol klar“, seit 17.10.2026; Übersicht `docs/farbschema-petrol-klar-2026-10-17.pdf`, Werte in `app/styles/tokens.css`, Block „Farbkonzept“).** Nur vier Farbfamilien plus Weiß und Schwarz: Grau, Petrol, Dunkelblau, Orange-Braun. Andere Farben, Töne oder Hex-Werte gibt es nicht, auch nicht in Präsentationen, Diagrammen oder Sonderfällen. Kontraste nach WCAG 2.x gegen Weiß.

| Name | Hex | Verwendung |
|---|---|---|
| Text | `#18181b` | Überschriften, Logo-Schrift, wichtiger Text |
| Grautext | `#52525b` | Fließtext, Erläuterungen, Meta, Fußnoten (7,5 : 1) |
| Grau hell | `#a1a1aa` | Seitenzahlen, Text auf dunklem Grund; auf Weiß nur dekorativ |
| **Petrol** | `#268478` | Marke, Hauptaktion, Hervorhebung, Balken, Karte, Flächen; als Text 4,5 : 1 |
| Petrol dunkel | `#1f7065` | Hover, kleiner Text auf hellen Petrol-Flächen |
| Petrol hell | `#e6f3f1` | zarte Flächen, Symbolkreise, Hinweisboxen |
| Dunkelblau | `#0c4a6e` | beschlossen, Neues, Info; zweite Diagrammfarbe |
| Link | `#29467a` | Links |
| Orange-Braun | `#b45309` | abgelehnt, Fehler, Warnung; dritte Diagrammfarbe |
| Weiß | `#ffffff` | Hintergrund |
| Fläche | `#f4f4f5` | Karten, Bänder |
| Linie | `#e4e4e7` | Rahmen von Feldern und Karten, Trennlinien |
| Dunkel | `#191e1d` | dunkle Flächen, Titel- und Schlussfolien, dunkle Fassung des Logos |

Kartenstufen (hell nach dunkel): `#bfe6e0`, `#86cbc1`, `#4fa89b`, `#0f5249`. Dunkelmodus: eigene Werte unter `html.rm-dark` in `tokens.css`.

**Regeln (aus `FRONTEND.md`):** Weiß, Linien statt Kästen und Kacheln, keine bunten Abzeichen, Status als schlichter Text. Petrol ist die einzige Farbe mit Bedeutung; Dunkelblau und Orange-Braun stehen nur für Status (beschlossen, abgelehnt) und Hinweise.

**Frühere Werte (bis 16.10.2026):** Teal `#0d9488` und `#0f766e`, Tinte `#0f172a`, Slate-Grautöne. Sie gelten nicht mehr; Logo-Dateien und Präsentationen sind am 22.10.2026 auf Petrol klar umgestellt. Das Favicon (`public/favicon.svg`, App-Symbole) trägt noch das alte Teal.

## 4. Schrift

- **IBM Plex Sans**, lokal eingebunden (Lizenz SIL OFL 1.1, Dateien in `public/fonts`), keine Anfrage an Google. Rückfall: Segoe UI, systemeigene Sans-Serif.
- Gewichte: Regular 400 (Logo, Fließtext), Medium 500 (Buttons, Menü), SemiBold 600 (Überschriften), Bold 700 (selten).
- Größen (feste Stufen): 12, 14, 16, 18, 22, 28, 44 px.

| Stil | Größe / Zeile | Gewicht | Sonstiges |
|---|---|---|---|
| Hauptüberschrift (H1) | 44 px, Zeilenhöhe 0,95 bis 1,0 | 600 | Buchstabenabstand −0,025 em, Tinte |
| Zwischenüberschrift (H2) | 22 px, Zeilenhöhe 1,25 | 600 | −0,02 em, Tinte |
| Unterüberschrift | 18 px, 1,3 | 600 | Tinte |
| Einleitung (Lead) | 18 px, 1,5 | 400 | Grau, höchstens 820 px breit |
| Fließtext | 16 px, 1,55 | 400 | Grau, Texte zum Lesen höchstens 80 Zeichen breit |
| Eyebrow (Kopfzeile) | 12 bis 14 px | 600 | Großbuchstaben, Abstand 0,1 bis 0,12 em, Teal |
| Meta, Status | 12 bis 14 px | 400 | Grau |

## 5. Layout und Raum

**Ist-Stand:**

- Seitlicher Rand: `max(1vw, 16px)`. Inhalte laufen bis fast an den Rand, Texte zum Lesen sind schmaler (bis 80 Zeichen).
- Abschnitte: etwa 76 px Abstand oben, 78 px unten, getrennt durch eine Haarlinie `#eef1f4`.
- Seitenkopf: Zurück-Link, Eyebrow mit Seitensymbol, große Überschrift, Einleitung. Im Hintergrund ein sehr zarter Teal-Schimmer (radialer Verlauf, 10 % Teal, rechts oben).
- Start: Vollflächige Karte mit schwebender Suchleiste in Milchglas. Milchglas gibt es nur auf der Karte, Menüs sind weiß.
- Formen: Pille (999 px) für Hauptaktionen, 10 px für Felder und Buttons, 16 bis 20 px für Karten, Teal-Box 18 px. Schatten selten und weich (`0 24px 60px rgba(15,23,42,.08)`).
- Mindest-Touchfläche 44 px.

## 6. Komponenten

| Element | Aussehen |
|---|---|
| Hauptaktion | Schwarze Pille (Tinte), weiße Schrift 16 px Medium, am Ende „→“. Hover: leicht transparenter. |
| Nebenaktion | Teal-Text mit „→“, ohne Rahmen, Hover grau hinterlegt. |
| Eingabefeld | 46 px hoch, Rahmen 1 px `#e2e8f0`, Radius 10 px, Fokus: Teal-Rahmen plus Ring 3 px Teal (16 %). |
| Fokus allgemein | 2 px Teal-Umriss, 2 px Abstand. |
| Pille (Filter, Themen) | 34 px hoch, Radius 999 px, weißer Hintergrund (80 %), Hover Teal-Text. |
| Karte (Formular, Vorschau) | Weiß oder Verlauf `#f8fafc` nach `#f1f5f9`, Rahmen `#e8edf2`, Radius 16 bis 20 px. |
| Hinweisbox dunkel | Hintergrund `#0b1220`, weiße Schrift, Radius 10 px, Teal-Symbolfläche. |
| Hinweisbox Teal | Teal `#0d9488`, weiße Schrift, Radius 18 px, Überschrift 22 px. |
| Tarifwahl | Karte mit 1 px Rand, gewählt: Rand und Innenlinie `#0b1220`. |
| Status | Grauer Text 12 px („Beschlossen“, „Vertagt“), keine Abzeichen. |
| Symbole | Linienstil, grau, ohne Beschriftung bei Teilen, Folgen, Speichern, Exportieren. |
| Fehler | Rosa Fläche `#fff1f2`, Rand `#fecdd3`, Radius 8 px, dunkler Text, Teal-Link „Erneut laden“. Meldungen unter Feldern in `#be123c`, 14 px. |

## 7. Bildsprache

**Ist-Stand:** Es gibt keine Fotos. Die Bildwelt besteht aus Punkten und Linien: Sitzpunkte (Logo), Diffusionsanalyse als Punktfeld in Teal-Abstufungen, Knowledge Graph als Netz aus Teal-Knoten mit grauen Linien, die Karte mit Teal-Stufen. Grafiken stehen auf Weiß in Karten mit zarter Linie.

**Festgelegt (16.10.2026):** Auch für Präsentationen, Videos, Social Media und Werbung bei diesem Vokabular bleiben (Punkte, Linien, Karte, Teal auf Weiß), keine Stockfotos, keine Verläufe außer dem zarten Teal-Schimmer. Eigene Screenshots der Seite sind die wichtigste Bildquelle.

## 8. Ton und Sprache

**Ist-Stand:**

- Deutsch, Anrede „Sie“.
- Sachlich und kurz. Beispiele: „Einfache Preise. Jederzeit kündbar.“, „Besser verstehen, was vor Ort beraten wird.“
- Nur belegbare Aussagen, keine Superlative, keine Vergleiche mit anderen Anbietern (siehe `CLAUDE.md`, Produktvorteile).
- Datum mit zweistelligem Jahr („05.10.26“), „Stand“ statt „Datenstand“.
- Der Slogan steht am Ende jedes Videos groß unter dem Logo.

## 9. Abweichungen im Bestand

**Erledigt am 08.10.2026:**

| Befund | Lösung |
|---|---|
| Favicon und App-Symbole stammten von der früheren Marke (dunkelgrünes Quadrat mit Gebäude-Symbol) | Neu aus der Bildmarke (p aus Punkten, Teal): `public/favicon.svg` transparent, `icon-192.png`, `icon-512.png` und `apple-touch-icon.png` auf Weiß |
| Web-App-Manifest nannte „vor Ort · Münster“ | Name „Plenara“, Beschreibung mit Slogan, Farben Weiß und Teal |
| Seitentitel-Zusatz „Politik für Ihre Region“ | Titel im Tab: Startseite „Plenara“, alle anderen Seiten „Seitenname · Plenara“ (zum Beispiel „Preise · Plenara“); die Analyse-Seiten „… · Plenara.X“. Namen der Seiten in `lib/pageTitle.ts`. |
| Standardtexte der Push-Mitteilung („in Münster“, „Öffne vor Ort“) und Seitenbeschreibung („NRW und Niedersachsen“) | Auf Plenara und den Slogan umgestellt (`public/sw.js`, `app/layout.tsx`) |

**Noch offen:**

| Befund | Wo | Vorschlag |
|---|---|---|
| Ältere Design-Tokens (Kobaltblau `#2352AD`, Kopfzeile „vor Ort“) | `app/design-tokens.css`, `app/design-styles.css` | Gehören zu Admin und alten Analyseseiten, nicht zum Auftritt. Nicht übernehmen. |
| Teal als kleiner Text hat zu wenig Kontrast | Links, Eyebrows | Siehe Abschnitt 3 |

## 10. Offene Entscheidungen

Erledigt am 16.10.2026: Logo-Dateien, Schutzraum und Mindestgröße (Abschnitt 2), Kontrast der Akzentfarbe (Abschnitt 3), Logo auf dunklem Grund (Abschnitt 2), Profilbild und Präsentation (Abschnitt 11).

1. Vorlagen für Visitenkarte und E-Mail-Signatur im Stil von Abschnitt 11.
2. E-Mail-Layout (die Vorlagen liegen in `lib/mails.ts`) im gleichen Stil gestalten.

## 11. Präsentationen

**Festgelegt (16.10.2026).** Es gibt zwei Fassungen auf derselben Vorlage: die Investorenpräsentation `docs/design/praesentation/plenara-investoren.pptx` (20 Folien mit Screenshots der Seite, Anwendungsfällen und Kennzahlen) und die ausführliche Produktfassung `plenara-firmenpraesentation.pptx` (18 Folien: Plenara auf einen Blick, Datenfluss, Zielgruppen, Suche, Trefferliste, Artikel, Benachrichtigungen, plenara.X mit Signalen, Tools, Ausbreitung und Fakten, Qualität, Stufen) ist zugleich die Vorlage: Thema, Layouts und Bausteine daraus gelten für alle Präsentationen.

- **Format** 16:9 (10 × 5,625 Zoll). **Thema „Plenara“** mit den Farben aus Abschnitt 3: Text `#18181b`, Hintergrund Weiß, zweite Fläche `#f4f4f5`, dunkle Fläche `#191e1d`, Akzent 1 Petrol `#268478`, Akzent 2 Petrol dunkel `#1f7065`, Akzent 3 Grautext `#52525b`, Akzent 4 Grau hell `#a1a1aa`, Akzent 5 Petrol hell `#e6f3f1`, Akzent 6 Linie `#e4e4e7`; Diagramme in Petrol, Dunkelblau `#0c4a6e` und Orange-Braun `#b45309`. Alle Elemente nutzen Themenfarben; wer das Thema ändert, ändert die ganze Präsentation.
- **Schrift** IBM Plex Sans; Überschriften SemiBold (Windows-Name der Schrift: „IBM Plex Sans SmBld“), Text Regular. Die Schrift muss auf dem Rechner installiert sein (`public/fonts`, OFL); ohne sie fällt PowerPoint auf eine Systemschrift zurück.
- **Drei Layouts:** HELL (Inhaltsfolie: Eyebrow 10 pt in Teal dunkel gesperrt, Titel 24 pt SemiBold, Logo unten links, Seitenzahl unten rechts), DUNKEL (Titel- und Schlussfolie mit Punktraster, Logo-Fassung dunkel, Slogan 32 pt Weiß), TRENNER (Abschnitt: Titel 36 pt Weiß, Untertitel 16 pt Grau hell).
- **Größen:** Titel 24, Zwischenüberschriften 12,5 bis 15 SemiBold, Text 10 bis 13, Fußnoten 9 bis 9,5 in Grau hell, Kennzahlen 24 bis 32 SemiBold. Ränder 0,5 Zoll, Inhalt zwischen 1,45 und 5,05 Zoll Höhe.
- **Bausteine:** Teal-Quadrat als Aufzählungszeichen (wie das Schlussquadrat im Logo), Karten mit Fläche `#f8fafc` und Rahmen `#e2e8f0` (Radius 0,1 Zoll), Symbole im Linienstil (Feather) in Teal dunkel auf Kreis in Teal hell, Hinweisboxen in Teal hell mit Text in Teal dunkel, Screenshots der echten Seite in weißem Rahmen mit weichem Schatten, Kennzahlen groß mit kleiner Erläuterung, Diagramme nativ in einer Farbe (Teal) mit Beschriftung 10 pt Grau.
- **Nicht erlaubt:** Farbbalken und Akzentstreifen, Linien unter Titeln, Fotos aus Bilddatenbanken, mehr als eine Akzentfarbe, Verläufe (außer dem Teal-Schimmer der Webseite), Text ohne Beleg. Jede Zahl trägt ihren Stand („Stand 15.10.26“).
- **Inhalt:** Aussagen nur aus `docs/produkt/vorteile.json` (Stufe A in Überschriften), Zahlen von der Seite selbst (Startseite, `/analytics/ueber`) oder aus `docs/videos/facts.json`; der Slogan steht auf Titel- und Schlussfolie.

**Werkzeuge** (`docs/design/tools/`, eigenes `package.json`, einmal `npm install` dort):

| Befehl | Zweck |
|---|---|
| `node export-logos.mjs` | Logo-Dateien aus `Brand.tsx` neu erzeugen (SVG mit Pfaden, PNG) |
| `BASE=http://localhost:18080 node screenshots.mjs` | Screenshots der öffentlichen Seiten (Tunnel zum Server, siehe `docs/betrieb/node-server.md`) nach `praesentation/screenshots/` |
| `node build-praesentation.mjs` | Produktfassung (18 Folien, ausführlich) neu bauen; Texte und Folien stehen im Skript, die Vorlage in `deck-lib.mjs` |
| `node build-investoren.mjs` | Investorenfassung `plenara-investoren.pptx` (20 Folien: Problem, Lösung, Kern, Kennzahlen, sechs Anwendungsfälle mit Screenshots, plenara.X mit drei Analysen, Markt, Geschäftsmodell, Warum Plenara, nächste Schritte); Zahlen von plenara.de und den öffentlichen Auszügen, Plan und Preise aus `docs/strategie`, als Plan gekennzeichnet |
| `node render-praesentation.mjs` | Folien ohne PowerPoint als PNG nach `tmp/praesentation-vorschau/` rendern (echte Plex-Schriften, meldet Textüberläufe; Diagramme nur als Rahmen) |
