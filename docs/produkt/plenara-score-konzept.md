# plenara.X Score – Score-Modell (Entwurf 11.10.2026, nicht umgesetzt)

> **Stand nach Gespräch 11.10.2026 (geht dem Text unten vor):** keine eigene Säule „Offenheit“; stattdessen nur ein Bonus für eine
> OParl-Schnittstelle (aus der Quelle des Gebiets bekannt, keine eigene Abfrage), Vorschlag +2 Punkte, höchstens 100.
> Themen bestimmen den Score klar (Vorschlag: 85 % Themen, 15 % Arbeitsweise); je Thema Befassung und, wo messbar, Vorankommen
> (z. B. Beteiligung: Bürgerbegehren vorhanden und zugelassen). Kein Regler für die Gewichtung. Auf der Score-Seite steht eine
> feste, vollständige Definition, wie der Wert entsteht. Gewichte und Bonus noch festzulegen.

## Ziel und Entscheidungen

- Je Kommune **und je Kreis** eine **ganze Zahl von 0 bis 100**, gebildet nur aus unseren Ratsunterlagen.
- Seite **plenara.X Politik → „plenara.X Score“** (`/analytics/score`), **nur Enterprise**.
- **Karte** mit Umschalter **Kommunen / Kreise**. Kreise bekommen einen eigenen Score, gebildet nur aus dem, was im **Kreistag und
  seinen Ausschüssen** beraten wird; Gemeinden nur aus ihrem eigenen Rat (keine Mischung der Ebenen).
- **Bereiche filtern:** Die Karte zeigt wahlweise den Gesamtscore oder einen Bereich (Säule oder Teilbereich), damit man sehen
  kann, wie viel eine Kommune in einem Bereich macht und wie sie arbeitet.
- Zuerst **Häufigkeiten und Abläufe** (wie oft kommt etwas vor, wie weit kommt es, wie lange dauert es), keine Euro- oder
  Prozentwerte aus Texten. Hebesätze und Gebühren können später als Kennzahlen dazukommen, zählen aber nicht in den Score.
- 50 heißt immer „wie üblich bei vergleichbaren Kommunen“. Der Score ordnet ein, er bewertet keine Politik.

## Aufbau: vier Säulen

Der Score ordnet alle Kriterien in vier Säulen. Jede Säule besteht aus Teilbereichen oder Kennzahlen; was zu wenig Daten hat,
fällt heraus (siehe unten).

### Säule 1 – Themen: Wie viel befasst sich der Rat mit …?

Anteil des Bereichs an allen Sachvorgängen des Rats (letzte 12 Monate, ohne Formalien, gleiche Titel einmal), gegenüber der
Vergleichsgruppe. Teilbereiche aus den Radaren:

| Teilbereich | Quelle |
|---|---|
| Versorgung und Infrastruktur | Versorgungsradar |
| Verkehr und Mobilität | Verkehrsradar |
| Klima und Energie | Klimaradar |
| Bauen und Entwicklung | Bauleitplanung |
| Soziales, Jugend, Vereine | Sozialradar |
| Kinder und Familie | Kita-Vorgänge (später Schulen) |
| Fördermittel | Förderradar |

Nicht in Säule 1: Finanzlage, Gebühren, Vergabe (Pflichtaufgaben; „viel“ sagt dort nichts aus).

### Säule 2 – Vorankommen: Wie weit kommen Vorhaben?

Je Teilbereich, wo die Daten es hergeben:

- Bauen: Anteil der Pläne, die im Zeitraum den Satzungsbeschluss erreicht haben (Status beschlossen, nicht nur Tagesordnung).
- Klima: Stand der kommunalen Wärmeplanung (Stufe 0 bis 5).
- Fördermittel: Anteil bewilligter an genannten Programmen.
- Allgemein: Anteil der Sachvorgänge, die mit einer Entscheidung enden (beschlossen oder abgelehnt), statt offen zu bleiben.

### Säule 3 – Arbeitsweise: Wie zügig und klar wird beraten? (Beratungswege)

Aus den Sitzungsstationen je Vorgang (vorhanden: `events`, Auswertung Beschlüsse und Beratungswege):

- **Dauer bis zum Beschluss:** Median der Tage von der ersten Beratung bis zur Entscheidung (kürzer = höherer Wert).
- **Stationen bis zum Beschluss:** Median der Gremien, die ein Vorgang durchläuft.
- **Vertagungen und Zurückverweisungen:** Anteil der Vorgänge, die mindestens einmal vertagt oder verwiesen wurden.
- **Rückstand:** Anteil der Vorgänge, die länger als 6 Monate ohne Entscheidung offen sind.

Wichtig: Vergleich nur innerhalb desselben Landes (Gemeindeordnungen schreiben unterschiedliche Wege vor) und gleicher Art.
„Schneller“ ist nicht immer besser; der Text sagt deshalb „zügiger als üblich“, nicht „besser“.

### Säule 4 – Offenheit: Wie zugänglich ist die Ratsarbeit?

Aus den Unterlagen selbst messbar:

- Anteil der öffentlichen Tagesordnungspunkte mit Vorlage (Dokument abrufbar).
- Vorlauf: Tage zwischen Veröffentlichung der Vorlage und Sitzung (wo das System das Datum liefert).
- Niederschriften veröffentlicht (Anteil der Sitzungen mit Niederschrift).
- Ergebnis gepflegt: Anteil der beratenen Vorgänge mit erkennbarem Ergebnis.
- Beteiligung: Einwohnerfragen, Bürgeranträge, Beiräte je 1.000 Sachvorgänge (aus dem Beteiligungsradar).

Hinweis: Diese Säule misst auch das Ratsinformationssystem und dessen Pflege; das steht auf der Seite.

## Rechnung

1. **Kennzahl je Gebiet** (z. B. Anteil, Median-Dauer). Anteile werden zum Mittel der Vergleichsgruppe hin geglättet:
   s = (k + 200·p₀) / (n + 200), damit kleine Zahlen nicht springen.
2. **Kennzahlwert 0–100** = Rang des Gebiets in seiner Vergleichsgruppe (Perzentil). Bei „weniger ist besser“ (Dauer,
   Vertagungen, Rückstand) umgedreht.
3. **Säulenwert** = Mittel der gültigen Kennzahl- bzw. Teilbereichswerte.
4. **Gesamtscore** = Mittel der gültigen Säulen, als ganze Zahl. Alle Säulen gleich gewichtet (später einstellbar).
5. **Vergleichsgruppe:** gleiche Art (kreisangehörige Gemeinde, kreisfreie Stadt, Gemeindeverband, Kreis) und Größenklasse,
   zuerst im selben Land; unter 15 Gebieten ohne Land, dann Nachbarklasse. Kreise nur mit Kreisen.

## Zu wenig Daten: was herausfällt

| Ebene | Regel |
|---|---|
| Gebiet | unter 100 Sachvorgängen oder unter 9 Monaten mit Sitzungen → kein Score (grau) |
| Themen-Teilbereich | erwartete Zahl n·p₀ unter 5 → fällt heraus (0 Treffer bei 12 erwarteten zählt dagegen, als niedriger Wert) |
| Dauer, Stationen | unter 20 entschiedenen Vorgängen mit mindestens 2 Stationen → fällt heraus |
| Vertagungen, Ergebnis | unter 50 Vorgängen mit bekanntem Status → fällt heraus |
| Offenheit | Kennzahl nur, wenn das System das Merkmal überhaupt liefert (z. B. Veröffentlichungsdatum) |
| Säule | mindestens die Hälfte ihrer Kennzahlen gültig, sonst fällt die Säule heraus |
| Gesamtscore | mindestens 3 von 4 Säulen gültig, sonst nur Säulenwerte |

Angezeigt wird immer, woraus der Wert besteht: „Score 62 · aus 3 von 4 Säulen, 9 von 14 Kennzahlen“ und je fehlender Kennzahl
der Grund.

## Seite „plenara.X Score“ (Enterprise, Politik)

- **Kopf:** Befund, für wie viele Kommunen bzw. Kreise ein Score vorliegt, und der feste Hinweis zur Bedeutung.
- **Filter:** Ebene (Kommunen | Kreise), Bereich (Gesamt | eine Säule | ein Teilbereich), Land.
- **Karte** (Engine der Suche): Gebiete in vier Stufen nach Score (Viertel), grau = zu wenig Daten; Gemeindeverbände färben
  ihre Mitgliedsgemeinden; Kreise als Flächen der Kreise.
- **Ort suchen oder anklicken:** Feld mit Gesamtscore, vier Säulen, Teilbereichen und Kennzahlen als Balken mit Vergleichsbereich,
  Gründe für fehlende Teile, Links in die Radare und Beratungswege mit diesem Ort.
- **Ähnliche Kommunen:** Liste der Vergleichsgruppe des gewählten Orts mit Score, keine bundesweite Bestenliste.

## Texte

- Untertitel: „Wie häufig Themen in den Ratsunterlagen vorkommen, wie weit Vorhaben kommen und wie die Beratung läuft, verglichen
  mit ähnlichen Kommunen.“
- Fester Hinweis: „Der Score beruht nur auf den veröffentlichten Ratsunterlagen. Er misst Befassung und Ablauf, nicht die Qualität
  von Entscheidungen. Aufgaben, die beim Kreis liegen, erscheinen im Gemeinderat seltener.“

## Voraussetzungen aus der Bewertung vom 11.10.2026 (tmp/bewertung-radare-2.md)

Vor dem Score zu beheben, weil sie Teilwerte direkt verfälschen:

1. Ort aus dem Gremium lesen (Ortsgemeinde in der Verbandsgemeinde), Gemeindeverbände als Ort wählbar machen.
2. Fehltreffer der Themen (Ortsnamen wie Zweibrücken, „Verein“ in „Vereinbarung“, Zweckverbände ohne Versorgung, Besetzungen).
3. Gleiche Titel überall einmal zählen (Zähler wie Nenner).
4. Satzungsbeschluss nur mit Status beschlossen; abgelehnte Vorschläge nicht als Änderung.
5. Verbandsgemeinden mit vielen Ortsgemeinderäten: Vorgänge der Ortsgemeinden getrennt führen, sonst Verzerrung bei Kreisen und
   Verbänden.

## Technik

- `scripts/score.mjs` rechnet alle Kennzahlen, Säulen und Scores und schreibt sie in eine Tabelle `region_scores` (Gebiet, Ebene,
  Score, Säulen, Kennzahlen mit Wert und Gültigkeit, Gruppe, Stand). Neue Migration. Nachts nach den Fakten in `nightly.mjs`.
- Route `/api/analytics/score` liest nur die Tabelle (Karte bundesweit schnell; mit Ort die Einzelwerte). Enterprise-Prüfung wie
  bei den anderen plenara.X-Seiten.
- Bausteine aus `analytics-radar-norms.mjs` (Gruppen, Glättung, Mindestmengen) und `analytics-decisions.mjs` (Dauer).

## Umsetzung in Schritten

1. Voraussetzungen aus der Bewertung beheben (2–3 Tage).
2. Säulen 1 und 2 rechnen, Probelauf, Stabilität (Monate 1–6 gegen 7–12) und Stichprobe an 10 Orten (2 Tage).
3. Säule 3 aus Beratungswegen und Beschlüssen (1–2 Tage), Säule 4 aus Dokument- und Sitzungsdaten (1–2 Tage).
4. Tabelle, Skript, nächtlicher Schritt (1 Tag).
5. Seite mit Karte, Filtern, Ortsfeld, Methode, Vorschaubild (2 Tage).
6. Kalte Bewertung durch einen Agenten, Texte und Schwellen nachschärfen (0,5 Tag).

## Offene Fragen

1. Gewichtung: alle vier Säulen gleich, oder Themen stärker?
2. Säule 4 (Offenheit) misst teils das Ratsinformationssystem: drin lassen oder als eigene Anzeige neben dem Score?
3. Sollen Nutzer die Gewichtung selbst verschieben können (Regler je Säule)?
