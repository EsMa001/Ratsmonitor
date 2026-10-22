# Gelerntes Modell statt Regeln: Konzept

Stand 21.10.2026, Entwurf (zweite Fassung: vier Grundfragen). Begriffe: `requirements/begriffsbuch-kern.md`.

## Ziel

Rund 1.000.000 Berichte sollen mit **einem gemeinsamen Modell** vier Grundfragen sauber beantworten, ohne die bisherigen Wortlisten und Ausnahmen: **Art** (Sachpunkt, Ablauf, Personalie), **Thema** mit Unterthema und Unter-Unterthema, **Vorgangsart** (8, bei Vergaben mit Leistungsart) und **Status** (8). Hilfsschritte sind Hauptdokument, Ergebnisdokument und grobe Dokumentart. Alles Weitere wird daraus abgeleitet: „Formalien ausblenden“, Signale mit Filtern und Schritt, privater Bauantrag, Routinepunkte, Ausgang (Begriffsbuch, Abschnitt 8). Die Regeln bleiben nur als Vergleichsmaßstab, bis ein Kopf sie messbar schlägt.

Warum: Die Regeln wachsen mit jedem gesehenen Fehler um Einzelfall-Ausnahmen (Zählung 21.10.2026: rund ein Viertel der Ausschlussbegriffe der Signale sind Einzelfälle) und kennen kein Wort, das niemand eingetragen hat. Ein Modell lernt aus eingeordneten Beispielen, Dazulernen heißt einordnen und neu trainieren.

## Entscheidungen (Nico, 21.10.2026)

1. Ein lokales neuronales Modell darf im Nachtlauf laufen (kein fremder Dienst, keine Kosten je Aufruf).
2. Ergebnisse früherer Schritte dürfen in spätere eingehen (Kette Hauptdokument → Art → Thema); der Grundsatz von `readReport` „jede Regel liest nur Quellen“ gilt für das Modell nicht.
3. Der Themenkatalog bleibt (10 Themen, 70 Unterthemen, `shared/themes.mjs`).
4. Die erste große Einordnung umfasst den Kern (Stufe 1).
5. Die Komplexität wird reduziert: vier Grundfragen statt rund 100 Einzelentscheidungen; Signale werden abgeleitet. Unter-Unterthemen werden gleich mit eingeordnet, weil die Signale sie brauchen.
6. Für die Suche zählen zuerst Thema, Unterthema, Status und Art (für „Formalien ausblenden“).

## Ausbaustufen

| Stufe | Köpfe | Heute als Regel |
|---|---|---|
| 1 Kern | Art, Thema, Unterthema, Unter-Unterthema, Vorgangsart mit Leistungsart, Status; Hilfsschritte Hauptdokument, Ergebnisdokument, Dokumentart | `item-kind.mjs`, `themes.mjs`, `stage.mjs`, Status aus dem Import, `document-type.mjs`; Signale abgeleitet statt `topic-facts.mjs`/`plenara-x-signals.mjs` |
| 2 Verfahren und Personen | Schritte der Bauleitplanung und Wärmeplanung, Fraktion bei Anträgen | `topic-facts.mjs` (`plan`, `heat_plan`, `faction`) |
| 3 Werte und Kernsatz | „Wert zählt“ je Kandidat (25 Fakten), Kernsatz für kurze und lange Zusammenfassung | `topic-facts.mjs`, `ruleSummary` |

Formale Dinge bleiben Regeln: Zahlen- und Datumsformate (Kandidaten der Fakten), Abgleich mit dem Gebietskatalog (Mitgliedsgemeinde).

## Aufbau

- **Encoder:** `multilingual-e5-small` (MIT-Lizenz, geprüft 21.10.2026 auf huggingface.co), einmal mit den eingeordneten Berichten nachtrainiert (lokal, PyTorch auf dem Mac), dann als ONNX über `transformers.js` (Apache-2.0) in Node, Prozessor genügt. Nachtrainieren nur vor dem ersten Durchrechnen des Bestands oder selten, weil danach alle Einbettungen neu gerechnet werden müssen; Köpfe dagegen jederzeit neu. e5-base brachte keinen messbaren Gewinn.
- **Eingaben je Bericht:** Titel (nur Leerzeichen und Zeichen vereinheitlicht, keine `prepare`-Regeln), Gremium, Dokumentliste (Name, Größe, Reihenfolge), Textanfang je Dokument (etwa erste Seite).
- **Merkmale:** Einbettungen (je 384 Zahlen) von Titel, Dokumentnamen und Textanfängen, dazu gelernte Wortteile (3 bis 5 Buchstaben), beides gemeinsam in einem Kopf.
- **Köpfe als Kette:** Hauptdokument und Ergebnisdokument → Dokumentart → Art → Thema → Unterthema → Unter-Unterthema; Vorgangsart und Status nutzen Art, Thema und das Ergebnisdokument. Jeder Kopf bekommt die Ergebnisse der früheren als Eingabe und gibt eine Sicherheit aus; unter der Schwelle „unsicher“ (offen, Stand offen) statt geraten. Für den Status zählen zusätzlich Ergebnisfelder des Quellsystems und Sitzungsdatum als Merkmale.
- **Köpfe:** logistische Regression mit Bremse (Regularisierung), zweistufig: erst aus den Einbettungen (8-fach gewichtet), dann lernen die Wortteile nur die Korrektur; Unterthemen je Thema, Unter-Unterthemen je Unterthema ein eigener Kopf. Schwellen auf einem Abstimmungsteil der Lerndaten, danach neu gelernt auf allen, nie am Prüfsatz.

## Lerndaten

- **Pilot:** 200 Berichte vom Server (`tests/fixtures/kern-pilot.json`, 21.10.2026), eingeordnet nach der ersten Fassung des Begriffsbuchs; Doppel 20/20 gleich. Nur 89 hatten ein PDF, 72 Text. Neu einzuordnen nach der zweiten Fassung.
- **Gewichtung:** Berichte mit PDF und Ergebnisdokument höher gewichten, damit Hauptdokument, Dokumentart und Status genug Beispiele haben; seltene Status (abgelehnt, vertagt) und kleine Unterthemen gezielt dazu.
- **Groß:** 10.000 Lernberichte und 2.000 Prüfberichte (nie zum Lernen), geschichtet nach Land, Ratsinformationssystem, Gremienart und Sitzungsjahr. Einordnung mit Hilfsagenten nach dem Begriffsbuch, ohne Regelergebnis und Wortlisten; 10 % doppelt (Übereinstimmung messen), Stichprobe durch Nico.
- **Nachlegen (aktives Lernen):** nach dem ersten Training vor allem Berichte einordnen, bei denen das Modell unsicher ist.
- **Startmenge:** die 9.600 Titel der Themenversuche (`tests/fixtures/theme-*.json`), nur Thema und Unterthema.

## Messung und Freigabe

- Je Kopf Genauigkeit (vergebene Werte richtig) und Abdeckung (gewollte Werte erkannt) auf den 2.000 Prüfberichten, dazu kurze Titel getrennt.
- Die heutige Regel läuft auf denselben Prüfberichten mit.
- Freigabe je Kopf: mindestens so gut wie die Regel bei beiden Zahlen, oder ein vorher festgelegtes Ziel. Eintrag in `shared/rule-quality.json` wie bisher.

## Speicher und Server

- Einbettungen einmal je Bericht rechnen und speichern: eigene Tabelle mit Modellfassung, 1 Byte je Zahl (rund 360 MB für eine Million Titel), so lernen neue Köpfe ohne Neuberechnung. Ändert sich Encoder oder Eingabe, wird einmal alles neu gerechnet.
- Erstes Durchrechnen des Bestands: einige Stunden. Danach nachts nur neue Berichte (Job „Themen & Texte“), Köpfe ersetzen die Schritte Hauptdokument, Art, Stand und Thema in `readReport`.
- Danach wie bei jedem Versionswechsel: Kartenthemen (`topic_effective_labels`), Wortliste `--full`, `x_cases` neu.
- Einbau erst nach Freigabe, als eigener Schritt.

## Pflege

- Einordnungen von Hand im Admin werden Lernbeispiele.
- Vierteljährlich eine frische Stichprobe messen; bei Verschlechterung nachlegen und neu trainieren. Modelldateien mit Version im Repo.

## Bisherige Versuche (Thema, nur Titel, 21.10.2026)

Prüfsatz `theme-check-a` (300 Sachpunkte, frisch); Kreuzvalidierung über 9.300 Lerntitel.

| Verfahren | Prüfsatz Genauigkeit / Abdeckung | Kreuzvalidierung |
|---|---|---|
| Regel themes-v3 | 89 % / 81 % (Unterthema 88 % / 94 %) | – |
| Wortteile, 9.300 Titel (`scripts/theme-study/model.mjs`) | 86 % / 81 % (Unterthema 90 % / 95 %) | 89 % / 83 % |
| Einbettung allein (`tmp/ml/head.mjs`) | – | 86 % / 66 % |
| Mischung 30 % Einbettung, 70 % Wortteile | – | 89 % / 85 % bzw. 91 % / 83 % |

Lernkurve der Wortteile auf dem Prüfsatz: 72 → 83 → 85 → 86 % Genauigkeit bei 520 → 1.520 → 4.520 → 8.520 Sachpunkten. Doppelte Einordnung: erstes Thema in 95 bis 96 % gleich.

## Versuche mit der großen Stichprobe (21./22.10.2026)

Lernen auf 3.940 eingeordneten Berichten (`kern-big.json`) plus 1.300 Nachlieferung (`kern-extra.json`) und 9.121 Zusatztiteln; Schwellen auf 440 Berichten (Abstimmungsteil, `i % 7 == 0`), danach neu gelernt auf allen; gemessen auf den 770 Prüfberichten (`set: check`). Skripte in `tmp/ml/` (nicht in Git): `train3.mjs` (Köpfe), `train4.mjs` (gemeinsame Schicht), `ft.py` (Encoder nachtrainieren, PyTorch auf dem M2, `~/code/ml-tools/venv`), `export.py` und `check-export.mjs` (ONNX für Node), `cmp-ft.mjs`. Doppel der Einordnung: 96 bis 99 % gleich je Feld (Empfehlung 90 %).

| Stand | Art | Status | Vorgangsart | Vorhaben | Hauptdok. | Dok.art | Thema G/A | Unterthema G/A | Unter-Unterthema G/A |
|---|---|---|---|---|---|---|---|---|---|
| Regeln heute | 91 | 78 | 73 | 81 | 79 | 75 | 84/75 | – | – |
| Lauf 3 (Köpfe, alles auf einmal gelernt) | 94 | 87 | 76 | 84 | 85 | 92 | 85/82 | 76/70 | 79/46 |
| Köpfe je Thema, Pakete, Lernrate fällt, neu gelernt | 94 | 88 | 77 | 86 | 83 | 91 | 88/81 | 81/69 | 72/58 |
| ohne Einbettung (Gegenprobe) | 94 | 88 | 77 | 86 | 83 | 91 | 89/81 | 81/68 | 77/52 |
| Einbettung 8-fach gewichtet | 95 | 91 | 78 | 88 | 83 | 92 | 90/84 | 83/69 | 78/50 |
| … zweistufig (erst Einbettung, dann Wortteile) | 96 | 91 | 78 | 86 | 88 | 93 | 90/86 | 79/74 | 63/53 |
| … gemeinsame verdeckte Schicht (Mischung 0,5) | 94 | 92 | 78 | 86 | 83 | 92 | 90/86 | 84/64 | 76/56 |
| **Encoder nachtrainiert (3 Durchgänge) + zweistufig** | **97** | **93** | **82** | **87** | **89** | **95** | **92/90** | **83/77** | **76/64** |
| dasselbe, Prüftexte mit 8-Bit-Encoder aus Node | 97 | 93 | 82 | 87 | 90 | 95 | 91/90 | 84/77 | 75/66 |
| Encoder 5 Durchgänge + zweistufig | 97 | 93 | 83 | 88 | 89 | 95 | 93/88 | 85/76 | 72/67 |

Befunde:
- Die Köpfe nutzten die Einbettung zunächst fast nicht (Gegenprobe ohne Einbettung gleich gut); die Wortteile lernten die Lernberichte auswendig. Gewicht 8 statt 1 behebt das; 16-fach, e5-base (doppelte Rechenzeit), stärkere Bremse der Wortteile und die gemeinsame Schicht bringen danach nichts Messbares.
- Erst das Nachtrainieren des Encoders bringt einen klaren Sprung (Vorgangsart +4, Thema-Abdeckung +4, Unterthema-Abdeckung +8). Mehr Durchgänge bringen nichts mehr; 3 genügen (29 min auf dem M2, Einbetten aller 22.590 Texte 2 min).
- Sicherheitswert (≥ 0,7): Art 98 % richtig bei 96 % der Punkte, Status 94 % bei 95 %, Vorgangsart 91 % bei 77 %.
- Umwandlung für Node: ungekürzt (470 MB) exakt gleich wie PyTorch; 8 Bit nur für die Rechenschichten, je Spalte (407 MB): Kosinus 0,98 bis 0,99, Messwerte unverändert. Die von PyTorch gespeicherte Wortzerlegung zerlegt in transformers.js das erste Wort anders; die des Originals (`Xenova/multilingual-e5-small`) verwenden.
- Ausgereizt ohne neue Daten: Unter-Unterthema, Vorgangsart, Vorhaben und Planschritt (28 Prüffälle) brauchen mehr Einordnungen; Hausform und Empfehlung zu selten für einen Kopf.
- Die Prüfberichte wurden für die Wahl der Varianten mehrfach benutzt; die Zahlen sind deshalb etwas zu gut. Vor der Freigabe eine frische Stichprobe messen.
- Nicht gemessen: Wirkung bei Berichten ohne PDF getrennt, kurze Titel getrennt.

## Einführung (22.10.2026, Zweig `modell`)

- Code: `shared/model/` (Merkmale, Köpfe, Unter-Unterthemen), `server/model/model-files.mjs`, `scripts/model/` (apply, train, finetune.py, export.py, manifest, check-encoder), Migrationen 0046 (`model_labels`) und 0047 (Thema `model-v1` im View der Labels). Betrieb: `docs/betrieb/node-server.md`, „Modell“.
- Gelernte Fassung `e5-small-ft1+heads-dbc392293089`, Messwerte in `shared/model-quality.json`: Art 97, Status 93, Vorgangsart 81, Vorhaben 86, Thema 92/89, Unterthema 83/77, Unter-Unterthema 76/64, Dokumentart 95, Haupt- 89, Ergebnisdokument 91 %; Schritt 67 % (33), Leistungsart 75 % (36), Wer 44/53 % (43).
- Ersetzt: Titelregel, Art, Thema, „Was geschieht“ (Vorgangsart), Hauptdokument in readReport, Signal-Regeln, private Bauanträge, Newsradar-Einordnung, Social-Media-Auswahl. Sicherer Status (ab 0,7) in `topics.status`.
- Nicht ersetzt: Fraktionsprofil (Fakt `faction`, bis „Wer“ besser ist: Wortteile der ersten Seite als Merkmal), Zusammenfassung, Fakten, `primaryPdf` beim Laden, Begriffe des Themennetzes (Wortzerlegung, keine Einordnung).
- Lokal geprüft auf 2.000 echten Berichten: 12 ms je Text auf dem Mac, zweiter Lauf ohne neue Arbeit. Server noch nicht eingerichtet; vor dem ersten Durchlauf messen (`apply.mjs --measure 200`).
- Streitquote je Unterthema für Social Media erst nach dem ersten Lauf auf dem Server lernen (`scripts/learn-social.mjs`).

## Offene Punkte

- Grenzfälle im Begriffsbuch: entschieden 21.10.2026 (jeweils der Vorschlag).
- Ob die Zusammenfassung (Stufe 3) eigene, kleinere Lerndaten bekommt (1.500 bis 2.000 Berichte mit markierten Kernsätzen).
- Rechenleistung des Servers für das erste Durchrechnen prüfen.
