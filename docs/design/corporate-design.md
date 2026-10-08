# Corporate Design Plenara

Stand: 08.10.2026. Abgeleitet aus der öffentlichen Webseite, so wie sie heute ist (ohne Admin-Bereich). **Ist-Stand** heißt: so steht es im Code und sieht man auf der Seite. **Vorschlag** heißt: von mir ergänzt, damit das Design vollständig wird, bitte freigeben oder ändern.

Die Ansicht dazu: [`styleguide.html`](styleguide.html) (im Browser öffnen). Quellen im Code: `app/ratsmonitor.css`, `app/ratsmonitor-info.css`, `components/ratsmonitor/components/Brand.tsx`, `components/ratsmonitor/lib/constants.ts`, `components/ratsmonitor/FRONTEND.md`.

## 1. Marke

- **Name:** Plenara. Schreibweise im Fließtext „Plenara“, die Analysen heißen „Plenara.X“.
- **Slogan (fest):** „Früher wissen, was vor Ort beraten wird.“ Nicht ändern oder umformulieren (`docs/produkt/slogan.json`).
- **Idee hinter dem Zeichen (Ist-Stand):** Der Plenarsaal aus Sitzpunkten. Das p besteht aus kleinen Punkten in zwei Reihen, so wie Sitze in einem Ratssaal. Das Schlussquadrat ist der Punkt des Namens.
- **Charakter (Ist-Stand):** ruhig, hell, sachlich, offen. Viel Weiß, wenige Linien, ein einziger Akzent. Es soll sich wie ein Werkzeug anfühlen, nicht wie Werbung.

## 2. Logo

**Ist-Stand:** Das Logo in der Kopfzeile ist die Variante „Plenara v2 ■“ (`DEFAULT_LOGO = plenara-v2sq`).

- Bildmarke: p aus Sitzpunkten (zwei Reihen, außen kräftig, innen blasser) mit einem Bogen links als Stiel, alles in Teal `#0d9488`.
- Schriftzug „lenara“ in IBM Plex Sans Regular (400), Farbe Tinte `#0f172a`, Buchstabenabstand −0,015 em.
- Abschluss: ein Quadrat in Teal anstelle eines Punkts.
- **Plenara.X:** Wortmarke ohne Schlussquadrat, dahinter ein X aus kleiner werdenden, verblassenden Quadraten, die von einem Mittelquadrat auf der Grundlinie ausgehen. Alles in Teal.
- Auf schmalen Handys (unter 440 px) zeigt die Kopfzeile nur die Bildmarke ohne Schriftzug.
- Im Code liegen weitere Entwürfe (Quorumo, Parlamo, ältere Plenara-Varianten). Sie gehören **nicht** zum Auftritt und werden nicht verwendet.

**Vorschlag (noch nicht festgelegt):**

- Schutzraum um das Logo: mindestens die Höhe des Buchstabens „l“ auf allen Seiten.
- Mindestgröße: Schriftzug nicht kleiner als 20 px Schrifthöhe, Bildmarke allein nicht kleiner als 16 px.
- Nicht erlaubt: Logo strecken, drehen, andere Farben als Teal und Tinte, Schatten oder Verläufe, Schrift ersetzen.
- Logo-Dateien (SVG, PNG) aus dem Code exportieren und ablegen, bisher gibt es sie nur als Komponente.

## 3. Farben

**Ist-Stand.** Die Seite nutzt die Tailwind-Paletten Slate (Grautöne) und Teal. Kontraste nach WCAG 2.x gegen Weiß.

| Name | Hex | Verwendung | Kontrast auf Weiß |
|---|---|---|---|
| Tinte (slate-900) | `#0f172a` | Überschriften, Logo-Schrift, Hauptbutton, wichtiger Text | 17,9 : 1 |
| Grau (slate-500) | `#64748b` | Fließtext, Erläuterungen, Meta, Symbole | 4,8 : 1 |
| Grau hell (slate-400) | `#94a3b8` | Platzhalter, Hinweise, nur dekorativ | 2,6 : 1 |
| **Teal (teal-600)** | `#0d9488` | **Akzent:** Logo, Links, Eyebrows, Häkchen, Fokus, Hauptfläche in Hinweisboxen | 3,7 : 1 |
| Teal dunkel (teal-700) | `#0f766e` | Hover, höchste Kartenstufe, Auswahl auf der Karte | 5,5 : 1 |
| Teal hell (teal-50) | `#f0fdfa` | zarte Flächen und Hinweise | |
| Weiß | `#ffffff` | Hintergrund | |
| Fläche (slate-50) | `#f8fafc` | Bänder, Kartenhintergrund | |
| Fläche (slate-100) | `#f1f5f9` | Hover, Symbolflächen | |
| Linie Abschnitt | `#eef1f4` | Trennlinien zwischen Abschnitten | |
| Linie Karte | `#e8edf2` | Rahmen von Karten | |
| Linie Feld | `#e2e8f0` | Rahmen von Eingabefeldern und Karten | |
| Dunkel | `#0b1220` | dunkle Hinweiskarten, Auswahlrahmen Tarif | |
| Fehler (rose-700) | `#be123c` | Fehlermeldungen unter Feldern | 6,3 : 1 |
| Fehlerfläche (rose-50, Rand rose-200) | `#fff1f2`, Rand `#fecdd3` | Fehlerbox, z. B. „Die Suche konnte nicht abgeschlossen werden“ | |
| Umkreis auf der Karte | `#d1665a` | Radius-Ring (Umkreissuche) | |

Kartenstufen (Abdeckung, hell nach dunkel): `#b3dfda`, `#8ccdc7`, `#6ebfb8`, `#0f766e`. Karte: Grund `#ffffff`, Nachbarländer `#f8f9fa`, Linie `#d3d8df`.

Warnhinweise nutzen Amber (Tailwind `amber-50` Fläche, `amber-200` Rand, `amber-800` Text). Sie kommen selten vor.

**Regeln (Ist-Stand, aus `FRONTEND.md`):** Weiß, Linien statt Kästen und Kacheln, keine bunten Abzeichen, Status als schlichter grauer Text. Teal ist die einzige Farbe mit Bedeutung.

**Vorschlag zum Kontrast:** Teal `#0d9488` erreicht auf Weiß nur 3,7 : 1. Das genügt für große Schrift, Linien und Symbole, aber nicht für kleinen Text (Richtwert 4,5 : 1). Das betrifft Links, die kleinen Eyebrow-Zeilen und weißen Text auf Teal-Flächen. Für kleinen Text auf Weiß empfehle ich `#0f766e` (5,5 : 1) und für Flächen mit weißem Text ebenfalls `#0f766e`. Das ändert den Eindruck kaum. **Entschieden (08.10.26):** `#0f766e` für kleinen Text und für Flächen mit weißem Text, `#0d9488` bleibt für große Flächen, Linien und Symbole.

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

**Vorschlag:** Auch für Videos, Social Media und Werbung bei diesem Vokabular bleiben (Punkte, Linien, Karte, Teal auf Weiß), keine Stockfotos, keine Verläufe außer dem zarten Teal-Schimmer. Eigene Screenshots der Seite sind die wichtigste Bildquelle.

## 8. Ton und Sprache

**Ist-Stand:**

- Deutsch, Anrede „Sie“.
- Sachlich und kurz. Beispiele: „Einfache Preise. Jederzeit kündbar.“, „Früher wissen, was vor Ort beraten wird.“
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

1. Logo-Dateien (SVG, PNG, Schutzraum, Mindestgröße) festlegen und exportieren.
2. Kontrast der Akzentfarbe (Teal oder dunkleres Teal für kleinen Text).
3. Vorlagen für Visitenkarte, E-Mail-Signatur, Social-Media-Profilbild, Präsentation und Videos (Videos haben bereits ein eigenes System in `docs/videos`).
4. E-Mail-Layout (die Vorlagen liegen in `lib/mails.ts`) im gleichen Stil gestalten.
5. Wie das Logo auf dunklem Grund aussieht (heute gibt es nur die Fassung auf Weiß).
